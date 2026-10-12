import type { LobbyMessage, LobbyPlayer } from "@udc/shared";
import { describe, expect, it } from "vitest";
import { lobbyView } from "./lobby.js";

const player = (nick: string, over: Partial<LobbyPlayer> = {}): LobbyPlayer => ({
  nick,
  place: "lobby",
  ready: false,
  host: false,
  you: false,
  ...over,
});
const lobby = (players: LobbyPlayer[], over: Partial<LobbyMessage> = {}): LobbyMessage => ({
  t: "lobby",
  players,
  canStart: false,
  match: null,
  ...over,
});

describe("sala de espera (E6-9)", () => {
  it("cada uno con su estado: listo, no listo, leyendo el parte", () => {
    const view = lobbyView(
      lobby([
        player("Ana", { host: true, ready: true }),
        player("Rulo", { you: true }),
        player("Eva", { place: "report" }),
      ]),
    );
    expect(view.rows.map((r) => [r.nick, r.status, r.state, r.host, r.you])).toEqual([
      ["Ana", "Listo", "ready", true, false],
      ["Rulo", "No listo", "waiting", false, true],
      ["Eva", "Leyendo el parte", "away", false, false],
    ]);
  });

  it("el botón de listo cambia; solo el anfitrión ve «Empezar»", () => {
    const guest = lobbyView(lobby([player("Ana", { host: true }), player("Rulo", { you: true })]));
    expect(guest.ready).toEqual({ show: true, label: "Listo", next: true });
    expect(guest.start.show).toBe(false);
    expect(guest.hint).toContain("Ana");
    const ready = lobbyView(lobby([player("Rulo", { you: true, ready: true })]));
    expect(ready.ready).toEqual({ show: true, label: "No estoy listo", next: false });
  });

  it("el anfitrión empieza cuando están todos listos; si no, cuántos faltan", () => {
    const host = (canStart: boolean, others: LobbyPlayer[]) =>
      lobbyView(
        lobby([player("Rulo", { you: true, host: true, ready: true }), ...others], { canStart }),
      );
    const blocked = host(false, [player("Ana"), player("Eva", { place: "report" })]);
    expect(blocked.start).toEqual({ show: true, enabled: false });
    expect(blocked.hint).toBe("Faltan 2 por estar listos.");
    expect(host(false, [player("Ana")]).hint).toBe("Falta 1 por estar listos.");
    expect(host(true, [player("Ana", { ready: true })]).start).toEqual({
      show: true,
      enabled: true,
    });
  });

  it("con una partida en marcha, se ofrece unirse en vez de empezar", () => {
    const view = lobbyView(
      lobby([player("Rulo", { you: true, host: true }), player("Ana", { place: "match" })], {
        match: { phase: "evacuation", seconds: 270 },
      }),
    );
    expect(view.match).toBe("Partida en curso · Evacuación · 4:30");
    expect(view.start.show).toBe(false);
    expect(view.ready.show).toBe(false);
  });
});
