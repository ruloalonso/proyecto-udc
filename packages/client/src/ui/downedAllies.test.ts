import { describe, expect, it } from "vitest";
import { bearingTo } from "./downedAllies.js";

describe("bearingTo", () => {
  const me = { x: 0, z: 0, yaw: 0 };

  it("delante, 0; a la derecha (+X), positivo; detrás, ±π", () => {
    expect(bearingTo(me, { x: 0, z: 10 }).angle).toBeCloseTo(0);
    expect(bearingTo(me, { x: 10, z: 0 }).angle).toBeCloseTo(Math.PI / 2);
    expect(bearingTo(me, { x: -10, z: 0 }).angle).toBeCloseTo(-Math.PI / 2);
    expect(Math.abs(bearingTo(me, { x: 0, z: -10 }).angle)).toBeCloseTo(Math.PI);
  });

  it("es relativo a hacia dónde mira la cámara", () => {
    // Mirando a +X, lo que está en +X queda delante.
    expect(bearingTo({ ...me, yaw: Math.PI / 2 }, { x: 10, z: 0 }).angle).toBeCloseTo(0);
  });

  it("da la distancia", () => {
    expect(bearingTo(me, { x: 3, z: 4 }).distance).toBeCloseTo(5);
  });
});
