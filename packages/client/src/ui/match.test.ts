import { describe, expect, it } from "vitest";
import { clock, phaseText } from "./match.js";

describe("letrero de la fase (E6-1)", () => {
  it("formatea minutos y segundos hacia arriba", () => {
    expect(clock(125)).toBe("2:05");
    expect(clock(0.2)).toBe("0:01");
    expect(clock(-3)).toBe("0:00");
  });

  it("cuenta atrás de la preparación y del próximo despegue", () => {
    expect(phaseText({ phase: "prep", left: 24.3, nextLaunch: null })).toBe(
      "Despliegue. Los centollos llegan en 0:25",
    );
    expect(phaseText({ phase: "evacuation", left: 500, nextLaunch: { n: 2, in: 61 } })).toBe(
      "Evacuación · lanzadera 2 en 1:01",
    );
    expect(phaseText({ phase: "final", left: null, nextLaunch: null })).toBe(
      "Oleada final · No quedan lanzaderas",
    );
  });

  it("sin partida o con el resultado, no hay letrero", () => {
    expect(phaseText({ phase: "waiting", left: null, nextLaunch: null })).toBeNull();
    expect(phaseText({ phase: "result", left: 10, nextLaunch: null })).toBeNull();
  });
});
