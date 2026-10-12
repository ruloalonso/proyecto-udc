import { describe, expect, it } from "vitest";
import { bearingTo, downedMarkerName } from "./downedAllies.js";

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

describe("flecha hacia un derribado (E5-8)", () => {
  it("su nombre y los segundos que le quedan, o que le están rescatando", () => {
    expect(downedMarkerName("Recluta nº 3 (bot)", 12.2, false)).toBe("Recluta nº 3 (bot) · 13 s");
    expect(downedMarkerName("Recluta nº 3 (bot)", 12.2, true)).toBe(
      "Recluta nº 3 (bot) · rescatando",
    );
    expect(downedMarkerName("Rulo", null, false)).toBe("Rulo");
    expect(downedMarkerName("Rulo", -1, false)).toBe("Rulo · 0 s");
  });
});
