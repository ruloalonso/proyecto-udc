import { describe, expect, it } from "vitest";
import { clock, launchText, phaseText } from "./match.js";

describe("letrero de la fase (E6-1)", () => {
  it("formatea minutos y segundos hacia arriba", () => {
    expect(clock(125)).toBe("2:05");
    expect(clock(0.2)).toBe("0:01");
    expect(clock(-3)).toBe("0:00");
  });

  it("cuenta atrás de la preparación y del próximo despegue", () => {
    expect(phaseText({ phase: "prep", left: 24.3, nextLaunch: null, saved: 0 })).toBe(
      "Despliegue. Los centollos llegan en 0:25",
    );
    expect(
      phaseText({ phase: "evacuation", left: 500, nextLaunch: { n: 2, in: 61 }, saved: 37 }),
    ).toBe("Evacuación · lanzadera 2 en 1:01 · 37 a salvo");
    expect(phaseText({ phase: "final", left: null, nextLaunch: null, saved: 120 })).toBe(
      "Oleada final · No quedan lanzaderas · 120 a salvo",
    );
  });

  it("sin partida o con el resultado, no hay letrero", () => {
    expect(phaseText({ phase: "waiting", left: null, nextLaunch: null, saved: 0 })).toBeNull();
    expect(phaseText({ phase: "result", left: 10, nextLaunch: null, saved: 0 })).toBeNull();
  });

  it("aviso de despegue (E6-3): con colonos o vacía", () => {
    expect(launchText(2, 37)).toBe(
      "Despega la lanzadera 2 con 37 colonos. Los que no caben, a defender.",
    );
    expect(launchText(1, 1)).toContain("con 1 colono.");
    expect(launchText(3, 0)).toBe("La lanzadera 3 despega vacía. El Estado anota el despilfarro.");
  });
});
