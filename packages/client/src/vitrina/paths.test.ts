import { describe, expect, it } from "vitest";
import { CIRCLE_RADIUS, GO_SECONDS, LINE_LENGTH, poseAt, TURN_RATE } from "./paths.js";

describe("recorridos de la vitrina (E7-9)", () => {
  it("quieto, en el centro mirando a +Z; girando, sin moverse", () => {
    expect(poseAt("quieto", 5, 6)).toEqual({ x: 0, z: 0, yaw: 0 });
    const turning = poseAt("girar", 2, 6);
    expect([turning.x, turning.z]).toEqual([0, 0]);
    expect(turning.yaw).toBeCloseTo(2 * TURN_RATE);
  });

  it("en círculo, a su radio, a la velocidad pedida y mirando hacia donde va", () => {
    const dt = 0.01;
    const a = poseAt("circulo", 1, 6);
    const b = poseAt("circulo", 1 + dt, 6);
    expect(Math.hypot(a.x, a.z + CIRCLE_RADIUS)).toBeCloseTo(CIRCLE_RADIUS);
    expect(Math.hypot(b.x - a.x, b.z - a.z) / dt).toBeCloseTo(6, 1);
    const heading = Math.atan2(b.x - a.x, b.z - a.z);
    expect(Math.cos(heading - a.yaw)).toBeGreaterThan(0.99);
  });

  it("en línea: ida hacia +Z y vuelta mirando hacia atrás, sin salirse del tramo", () => {
    const speed = 4;
    const leg = LINE_LENGTH / speed;
    expect(poseAt("linea", 0, speed)).toEqual({ x: 0, z: -LINE_LENGTH / 2, yaw: 0 });
    expect(poseAt("linea", leg * 0.5, speed).yaw).toBe(0);
    expect(poseAt("linea", leg * 1.5, speed).yaw).toBe(Math.PI);
    for (let t = 0; t < 10; t += 0.1) {
      expect(Math.abs(poseAt("linea", t, speed).z)).toBeLessThanOrEqual(LINE_LENGTH / 2 + 1e-9);
    }
  });

  it("arranca y para: anda, se queda quieto y vuelve en sentido contrario", () => {
    const speed = 6;
    const moving = poseAt("arranca", GO_SECONDS * 0.5, speed);
    const stopped1 = poseAt("arranca", GO_SECONDS * 1.2, speed);
    const stopped2 = poseAt("arranca", GO_SECONDS * 1.8, speed);
    expect(stopped1).toEqual(stopped2);
    expect(moving.z).toBeLessThan(stopped1.z);
    expect(poseAt("arranca", GO_SECONDS * 2.5, speed).yaw).toBe(Math.PI);
  });
});
