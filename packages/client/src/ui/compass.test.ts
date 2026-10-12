import { MAP } from "@udc/shared";
import { describe, expect, it } from "vitest";
import { bearingOf, CARDINALS, stripPosition } from "./compass.js";

describe("brújula (E2-7)", () => {
  it("el norte es +Z, donde está la madriguera «norte»; el este, +X", () => {
    const norte = MAP.burrows.find((b) => b.id === "norte")!;
    expect(bearingOf({ x: 0, z: 0 }, norte)).toBeCloseTo(0);
    const este = MAP.burrows.find((b) => b.id === "este")!;
    expect(bearingOf({ x: 0, z: 10 }, este)).toBeCloseTo(Math.PI / 2, 0);
    expect(CARDINALS.find((c) => c.label === "E")!.bearing).toBeCloseTo(Math.PI / 2);
  });

  it("mirando al norte, el este queda a la derecha y el oeste a la izquierda", () => {
    expect(stripPosition(0, 0)).toEqual({ x: 0, outside: false });
    expect(stripPosition(Math.PI / 4, 0).x).toBeCloseTo(0.5);
    expect(stripPosition(-Math.PI / 4, 0).x).toBeCloseTo(-0.5);
  });

  it("gira con la cámara: mirando al este, el norte queda a la izquierda", () => {
    expect(stripPosition(0, Math.PI / 4).x).toBeCloseTo(-0.5);
  });

  it("lo que queda detrás se pega al borde por el que hay que girar", () => {
    expect(stripPosition(Math.PI, Math.PI / 6)).toEqual({ x: 1, outside: true });
    expect(stripPosition(Math.PI, -Math.PI / 6)).toEqual({ x: -1, outside: true });
  });
});
