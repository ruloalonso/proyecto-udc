import { describe, expect, it } from "vitest";
import { destroyedText, shuttleText } from "./shuttle.js";

describe("panel de la lanzadera (#72)", () => {
  it("posada, con los de a bordo; si viene, cuánto falta; tras la última, nada", () => {
    expect(shuttleText({ docked: true, trip: 2, aboard: 23 }, null)).toBe(
      "Lanzadera 2 · 23 a bordo",
    );
    expect(shuttleText({ docked: false, trip: 3, aboard: 0 }, 32.2)).toBe(
      "Lanzadera 3 en camino · 0:33",
    );
    expect(shuttleText({ docked: false, trip: null, aboard: 0 }, null)).toBeNull();
  });

  it("aviso al destruirla", () => {
    expect(destroyedText(2, 17)).toContain("con 17 colonos a bordo");
    expect(destroyedText(2, 0)).toBe("¡Han destruido la lanzadera 2! El comandante solicita otra.");
  });
});
