import { describe, expect, it } from "vitest";
import { GAME_CONFIG, MAP, TICK_SECONDS, type MapData } from "@udc/shared";
import { SpitTrack } from "./spits.js";

const { spit } = GAME_CONFIG.spitter;
const STEP = spit.speed * TICK_SECONDS;
const open: MapData = { ...MAP, obstacles: [] };
const far = { x: 100, z: 100 };

describe("SpitTrack", () => {
  it("avanza en línea recta a su velocidad desde el primer snapshot", () => {
    // Hacia +Z (yaw = 0), visto por primera vez en el tick 10.
    const t = new SpitTrack({ x: 1, z: 2 }, 0, 10);
    expect(t.update(10, far, open)).toEqual({ x: 1, z: 2 });
    const p = t.update(14, far, open)!;
    expect(p.x).toBeCloseTo(1);
    expect(p.z).toBeCloseTo(2 + 4 * STEP);
  });

  it("deja de dibujarse al agotar su alcance", () => {
    const t = new SpitTrack({ x: 0, z: 0 }, 0, 0);
    expect(t.update(spit.range / STEP - 1, far, open)).not.toBeNull();
    expect(t.update(spit.range / STEP, far, open)).toBeNull();
  });

  it("deja de dibujarse al tocar al jugador, aunque avance más que su tamaño", () => {
    const t = new SpitTrack({ x: 0, z: 0 }, 0, 0);
    expect(t.update(5, { x: 0.3, z: 8 }, open)).not.toBeNull();
    // Entre el tick 5 y el 12 pasa por z = 8.
    expect(t.update(12, { x: 0.3, z: 8 }, open)).toBeNull();
    // Y ya no vuelve a dibujarse.
    expect(t.update(13, far, open)).toBeNull();
  });

  it("si el jugador se aparta a tiempo, sigue de largo", () => {
    const t = new SpitTrack({ x: 0, z: 0 }, 0, 0);
    expect(t.update(5, { x: 0, z: 8 }, open)).not.toBeNull();
    expect(t.update(12, { x: 3, z: 8 }, open)).not.toBeNull();
  });

  it("lo que ya pasó de largo no le da al jugador", () => {
    const t = new SpitTrack({ x: 0, z: 0 }, 0, 0);
    t.update(12, far, open);
    // El jugador se pone en un punto por el que el escupitajo ya pasó.
    expect(t.update(13, { x: 0, z: 3 }, open)).not.toBeNull();
  });

  it("deja de dibujarse al chocar con un obstáculo", () => {
    const walled: MapData = {
      ...MAP,
      obstacles: [{ id: "m", kind: "wall", x: 0, z: 6, w: 4, d: 1, h: 3, rot: 0 }],
    };
    const t = new SpitTrack({ x: 0, z: 0 }, 0, 0);
    expect(t.update(5, far, walled)).not.toBeNull();
    expect(t.update(10, far, walled)).toBeNull();
  });
});
