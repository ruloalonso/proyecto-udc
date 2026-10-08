import { describe, expect, it } from "vitest";
import { overviewRadius } from "./overview.js";

describe("overviewRadius", () => {
  it("en pantalla apaisada manda el alto: el mapa cabe de arriba abajo", () => {
    const r = overviewRadius(200, 0.8, 16 / 9, 1);
    expect(Math.tan(0.4) * r).toBeCloseTo(100);
  });

  it("en pantalla vertical manda el ancho", () => {
    const r = overviewRadius(200, 0.8, 0.5, 1);
    expect(Math.tan(0.4) * 0.5 * r).toBeCloseTo(100);
  });

  it("con margen, un poco más lejos", () => {
    expect(overviewRadius(200, 0.8, 1.5)).toBeGreaterThan(overviewRadius(200, 0.8, 1.5, 1));
  });
});
