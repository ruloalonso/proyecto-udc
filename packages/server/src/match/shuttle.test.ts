import { describe, expect, it } from "vitest";
import { GAME_CONFIG, TICK_SECONDS } from "@udc/shared";
import { LAUNCH_TICKS } from "./match.js";
import { Shuttle } from "./shuttle.js";

const cfg = GAME_CONFIG.shuttles;
const ticks = (s: number) => Math.round(s / TICK_SECONDS);
const [L1, L2] = LAUNCH_TICKS as [number, number];

describe("Shuttle: lanzaderas que embarcan al llegar y se pueden destruir (#72)", () => {
  it("embarcan los que llegan; al despegar, se los lleva a salvo y la siguiente se posa después", () => {
    const s = new Shuttle();
    s.board(3);
    s.board(2);
    expect(s.aboard).toBe(5);
    expect(s.depart(1, L1)).toBe(5);
    expect(s.docked).toBe(false);
    expect(s.trip).toBe(2);
    // Sin nave posada no sube nadie.
    s.board(4);
    expect(s.aboard).toBe(0);
    const back = L1 + ticks(cfg.landDelay + cfg.landSeconds);
    s.step(back - 1);
    expect(s.docked).toBe(false);
    s.step(back);
    expect(s.docked).toBe(true);
    expect(s.landedNow).toBe(true);
    expect(s.hp).toBe(cfg.health);
  });

  it("destruida, mueren los de a bordo y la de reemplazo tarda en llegar", () => {
    const s = new Shuttle();
    s.board(20);
    expect(s.damage(cfg.health - 1, 100)).toBeNull();
    expect(s.damage(5, 120)).toBe(20);
    expect(s.docked).toBe(false);
    expect(s.trip).toBe(2);
    expect(s.status(0, 1000, 120).arrivesAtTick).toBe(1000 + ticks(cfg.replacementSeconds));
    // Ya no hay nada que dañar.
    expect(s.damage(999, 121)).toBeNull();
  });

  it("el viaje destruido se pierde: la de reemplazo despega a la hora del viaje siguiente", () => {
    const s = new Shuttle();
    s.damage(cfg.health, 100);
    s.step(100 + ticks(cfg.replacementSeconds));
    expect(s.docked).toBe(true);
    s.board(7);
    expect(s.depart(1, L1)).toBeNull();
    expect(s.docked).toBe(true);
    expect(s.depart(2, L2)).toBe(7);
  });

  it("tras la última no viene ninguna", () => {
    const s = new Shuttle();
    s.jumpTo(LAUNCH_TICKS.at(-1)!);
    expect(s.trip).toBe(LAUNCH_TICKS.length);
    expect(s.depart(LAUNCH_TICKS.length, LAUNCH_TICKS.at(-1)!)).toBe(0);
    expect(s.trip).toBeNull();
    expect(s.status(0, 0, 0).arrivesAtTick).toBeNull();
  });

  it("al reiniciar, posada, entera y vacía", () => {
    const s = new Shuttle();
    s.board(3);
    s.damage(100, 10);
    s.reset();
    expect(s).toMatchObject({ docked: true, trip: 1, hp: cfg.health, aboard: 0 });
  });
});
