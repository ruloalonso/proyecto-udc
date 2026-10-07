import { describe, expect, it } from "vitest";
import type { Obstacle } from "../map/index.js";
import { pushCircleOutOfBox } from "./collision.js";

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
