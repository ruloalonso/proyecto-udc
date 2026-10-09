import { describe, expect, it } from "vitest";
import type { Obstacle } from "../map/index.js";
import { distanceToBox, pushCircleOutOfBox } from "./collision.js";

const box = (rot = 0): Obstacle => ({ id: "b", kind: "crate", x: 0, z: 0, w: 4, d: 2, h: 1, rot });

describe("pushCircleOutOfBox", () => {
  it("no toca un círculo lejano", () => {
    expect(pushCircleOutOfBox(10, 10, 0.5, box())).toEqual({ x: 10, z: 10 });
  });

  it("empuja un círculo que roza el lateral", () => {
    expect(pushCircleOutOfBox(2.2, 0, 0.5, box()).x).toBeCloseTo(2.5);
  });

  it("saca un centro que está dentro", () => {
    expect(pushCircleOutOfBox(0, 0.9, 0.5, box()).z).toBeCloseTo(1.5);
  });

  it("respeta la rotación de la caja", () => {
    // Girada 90º, su lado largo (w = 4) queda sobre el eje Z.
    const p = pushCircleOutOfBox(0, 2.2, 0.5, box(Math.PI / 2));
    expect(p.x).toBeCloseTo(0);
    expect(p.z).toBeCloseTo(2.5);
  });
});

describe("distanceToBox", () => {
  const box = { id: "b", kind: "building" as const, x: 10, z: 0, w: 4, d: 2, h: 3, rot: 0 };

  it("0 dentro y la distancia al borde fuera", () => {
    expect(distanceToBox(10, 0, box)).toBe(0);
    expect(distanceToBox(15, 0, box)).toBeCloseTo(3);
    expect(distanceToBox(10, 4, box)).toBeCloseTo(3);
    expect(distanceToBox(15, 4, box)).toBeCloseTo(Math.hypot(3, 3));
  });

  it("respeta la rotación de la caja", () => {
    const rotated = { ...box, rot: Math.PI / 2 };
    // Girada 90°, el lado largo queda a lo largo de Z.
    expect(distanceToBox(10, 3, rotated)).toBeCloseTo(1);
    expect(distanceToBox(13, 0, rotated)).toBeCloseTo(2);
  });
});
