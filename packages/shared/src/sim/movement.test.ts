import { describe, expect, it } from "vitest";
import { GAME_CONFIG, TICK_SECONDS } from "../config/game.config.js";
import type { MapData } from "../map/index.js";
import { stepMovement } from "./movement.js";

const emptyMap: MapData = {
  name: "test",
  size: 200,
  obstacles: [],
  landingPad: { x: 0, z: 0, radius: 1 },
  spawn: { x: 0, z: 0, radius: 1 },
  burrows: [],
};

const step = GAME_CONFIG.soldier.speed * TICK_SECONDS;
const input = (forward: number, strafe: number, yaw = 0, seq = 1) => ({
  seq,
  forward,
  strafe,
  yaw,
});

describe("stepMovement", () => {
  it("avanza hacia +Z con yaw 0", () => {
    const s = stepMovement({ x: 0, z: 0, yaw: 0 }, input(1, 0), emptyMap);
    expect(s.x).toBeCloseTo(0);
    expect(s.z).toBeCloseTo(step);
  });

  it("la derecha es +X con yaw 0", () => {
    const s = stepMovement({ x: 0, z: 0, yaw: 0 }, input(0, 1), emptyMap);
    expect(s.x).toBeGreaterThan(0);
    expect(s.z).toBeCloseTo(0);
  });

  it("no corre más en diagonal", () => {
    const s = stepMovement({ x: 0, z: 0, yaw: 0 }, input(1, 1), emptyMap);
    expect(Math.hypot(s.x, s.z)).toBeLessThanOrEqual(step + 1e-9);
  });

  it("es más lento hacia atrás", () => {
    const s = stepMovement({ x: 0, z: 0, yaw: 0 }, input(-1, 0), emptyMap);
    expect(-s.z).toBeCloseTo(step * GAME_CONFIG.soldier.backwardAndStrafeFactor);
  });

  it("ignora entradas fuera de rango o no numéricas", () => {
    const a = stepMovement({ x: 0, z: 0, yaw: 0 }, input(50, 0), emptyMap);
    expect(a.z).toBeCloseTo(step);
    const b = stepMovement({ x: 0, z: 0, yaw: 0 }, input(Number.NaN, 0), emptyMap);
    expect(b).toEqual({ x: 0, z: 0, yaw: 0 });
  });

  it("no atraviesa obstáculos", () => {
    const map: MapData = {
      ...emptyMap,
      obstacles: [{ id: "b", kind: "crate", x: 0, z: 2, w: 4, d: 2, h: 2, rot: 0 }],
    };
    let s = { x: 0, z: 0, yaw: 0 };
    for (let i = 0; i < 40; i++) s = stepMovement(s, input(1, 0, 0, i), map);
    expect(s.z).toBeLessThanOrEqual(1 - GAME_CONFIG.soldier.radius + 1e-6);
  });

  it("no sale del mapa", () => {
    let s = { x: 0, z: 0, yaw: 0 };
    for (let i = 0; i < 1000; i++) s = stepMovement(s, input(1, 0, 0, i), emptyMap);
    expect(s.z).toBeLessThanOrEqual(100);
  });

  it("es determinista", () => {
    const a = stepMovement({ x: 1.23, z: 4.56, yaw: 0.7 }, input(1, -1, 0.9), emptyMap);
    const b = stepMovement({ x: 1.23, z: 4.56, yaw: 0.7 }, input(1, -1, 0.9), emptyMap);
    expect(a).toEqual(b);
  });
});
