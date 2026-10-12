import { describe, expect, it } from "vitest";
import { canStart, hostOf, type Seat } from "./lobby.js";

const seat = (order: number, place: Seat["place"] = "lobby", ready = true): Seat => ({
  order,
  place,
  ready,
});

describe("sala de espera (E6-9)", () => {
  it("el anfitrión es quien entró primero; si se va, el siguiente", () => {
    const a = seat(1);
    const b = seat(2);
    const c = seat(3);
    expect(hostOf([b, a, c])).toBe(a);
    expect(hostOf([c, b])).toBe(b);
    expect(hostOf([])).toBeNull();
  });

  it("se puede empezar con todos en la sala y listos", () => {
    expect(canStart([seat(1), seat(2)])).toBe(true);
    expect(canStart([seat(1), seat(2, "lobby", false)])).toBe(false);
    expect(canStart([])).toBe(false);
  });

  it("quien lee el noticiario bloquea; con una partida en marcha, no se empieza otra", () => {
    expect(canStart([seat(1), seat(2, "report", false)])).toBe(false);
    expect(canStart([seat(1), seat(2, "match", false)])).toBe(false);
  });
});
