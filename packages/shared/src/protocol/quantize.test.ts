import { describe, expect, it } from "vitest";
import { lerpAngle, normalizeAngle, quantizePos, dequantizePos } from "./quantize.js";

describe("quantize", () => {
  it("cuantiza posiciones al centímetro", () => {
    expect(dequantizePos(quantizePos(12.3456))).toBeCloseTo(12.35, 5);
  });

  it("normaliza ángulos", () => {
    expect(normalizeAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(normalizeAngle(-3 * Math.PI)).toBeCloseTo(Math.PI);
  });

  it("interpola ángulos por el camino corto", () => {
    const r = lerpAngle(Math.PI - 0.1, -Math.PI + 0.1, 0.5);
    expect(Math.abs(normalizeAngle(r))).toBeCloseTo(Math.PI);
  });
});
