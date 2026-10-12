import type { LobbyMessage, LobbyPlayer, MatchPhase } from "@udc/shared";
import { clock } from "./match.js";

/**
 * Sala de espera en la nave (E6-9): la bodega de la lanzadera, con los reclutas que esperan.
 * Cada uno marca «Listo»; el anfitrión (quien entró primero) empieza cuando lo están todos,
 * también los que siguen leyendo el noticiario. Con una partida en marcha, se puede unir
 * encarnando un bot o mirando.
 */

const PLACE_TEXT = {
  report: "Leyendo el parte",
  match: "En combate",
} as const;

const PHASE_TEXT: Partial<Record<MatchPhase, string>> = {
  prep: "Despliegue",
  evacuation: "Evacuación",
  final: "Oleada final",
};

export interface LobbyRow {
  nick: string;
  status: string;
  state: "ready" | "waiting" | "away";
  host: boolean;
  you: boolean;
}

export interface LobbyView {
  rows: LobbyRow[];
  /** El botón de listo: si se ve y qué dice. */
  ready: { show: boolean; label: string; next: boolean };
  /** El botón de empezar (solo el anfitrión) y por qué no se puede, si no se puede. */
  start: { show: boolean; enabled: boolean };
  /** Debajo: qué falta para empezar, o quién empieza. */
  hint: string;
  /** Partida en marcha a la que unirse, o `null`. */
  match: string | null;
}

const statusOf = (p: LobbyPlayer): Pick<LobbyRow, "status" | "state"> =>
  p.place === "lobby"
    ? { status: p.ready ? "Listo" : "No listo", state: p.ready ? "ready" : "waiting" }
    : { status: PLACE_TEXT[p.place], state: "away" };

export function lobbyView(msg: LobbyMessage): LobbyView {
  const you = msg.players.find((p) => p.you) ?? null;
  const host = msg.players.find((p) => p.host) ?? null;
  const inLobby = you?.place === "lobby";
  const notReady = msg.players.filter((p) => !(p.place === "lobby" && p.ready)).length;
  let hint: string;
  if (msg.match) {
    hint = "Hay una partida en marcha: únase o espere a la siguiente.";
  } else if (you?.host) {
    hint = msg.canStart
      ? "Todos listos. Usted manda, anfitrión."
      : `${notReady === 1 ? "Falta" : "Faltan"} ${notReady} por estar listos.`;
  } else {
    hint = `Empieza ${host?.nick ?? "el anfitrión"} cuando estén todos listos.`;
  }
  const match = msg.match
    ? `Partida en curso · ${PHASE_TEXT[msg.match.phase] ?? ""} · ${clock(msg.match.seconds)}`
    : null;
  return {
    rows: msg.players.map((p) => ({ nick: p.nick, host: p.host, you: p.you, ...statusOf(p) })),
    ready: {
      show: inLobby && !msg.match,
      label: you?.ready ? "No estoy listo" : "Listo",
      next: !(you?.ready ?? false),
    },
    start: { show: (you?.host ?? false) && !msg.match, enabled: msg.canStart },
    hint,
    match: inLobby ? match : null,
  };
}

/** El panel de la sala, a la derecha de la bodega. */
export class LobbyPanel {
  private readonly root: HTMLElement;
  private readonly list: HTMLElement;
  private readonly readyButton: HTMLButtonElement;
  private readonly startButton: HTMLButtonElement;
  private readonly hint: HTMLElement;
  private readonly matchBox: HTMLElement;
  private readonly matchText: HTMLElement;
  private nextReady = true;
  onReady: (ready: boolean) => void = () => {};
  onStart: () => void = () => {};
  onJoin: (as: "bot" | "spectator") => void = () => {};

  constructor(parent: HTMLElement) {
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = "") => {
      const e = document.createElement(tag);
      e.className = cls;
      e.textContent = text;
      return e;
    };
    this.root = el("div", "lobby");
    this.root.hidden = true;
    const panel = el("div", "lobby__panel");
    this.list = el("div", "lobby__list");
    this.readyButton = el("button", "lobby__button lobby__button--ready");
    this.readyButton.addEventListener("click", () => this.onReady(this.nextReady));
    this.startButton = el("button", "lobby__button lobby__button--start", "Empezar");
    this.startButton.addEventListener("click", () => this.onStart());
    this.hint = el("div", "lobby__hint");
    this.matchBox = el("div", "lobby__match");
    this.matchText = el("div", "lobby__match-text");
    const asBot = el("button", "lobby__button", "Encarnar un bot");
    asBot.addEventListener("click", () => this.onJoin("bot"));
    const asSpectator = el("button", "lobby__button", "Mirar");
    asSpectator.addEventListener("click", () => this.onJoin("spectator"));
    this.matchBox.append(this.matchText, asBot, asSpectator);
    panel.append(
      el("div", "lobby__title", "Bodega de la lanzadera"),
      el(
        "div",
        "lobby__subtitle",
        "Reclutas en formación. El Alto Mando agradece su puntualidad y lamenta lo demás.",
      ),
      this.list,
      this.readyButton,
      this.startButton,
      this.hint,
      this.matchBox,
    );
    this.root.append(panel);
    parent.append(this.root);
  }

  show(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  update(view: LobbyView): void {
    this.list.replaceChildren(
      ...view.rows.map((r) => {
        const row = document.createElement("div");
        row.className = `lobby__row lobby__row--${r.state}${r.you ? " lobby__row--you" : ""}`;
        const nick = document.createElement("span");
        nick.className = "lobby__nick";
        nick.textContent = r.host ? `★ ${r.nick}` : r.nick;
        const status = document.createElement("span");
        status.className = "lobby__status";
        status.textContent = r.status;
        row.append(nick, status);
        return row;
      }),
    );
    this.readyButton.hidden = !view.ready.show;
    this.readyButton.textContent = view.ready.label;
    this.nextReady = view.ready.next;
    this.startButton.hidden = !view.start.show;
    this.startButton.disabled = !view.start.enabled;
    this.hint.textContent = view.hint;
    this.matchBox.hidden = view.match === null;
    if (view.match) this.matchText.textContent = view.match;
  }
}
