import { describe, expect, it } from "vitest";
import { GAME_CONFIG, TICK_SECONDS } from "@udc/shared";
import { FINAL_TICK, Match, PREP_TICKS } from "./match.js";

const RESULT_TICKS = Math.round(GAME_CONFIG.match.resultSeconds / TICK_SECONDS);

/** Avanza `n` ticks con `soldiers` soldados en pie. */
function run(match: Match, n: number, soldiers = 8): void {
  for (let i = 0; i < n; i++) match.step(soldiers);
}

describe("Match: fases de la partida (E6-1)", () => {
  it("espera sin nadie y empieza la preparación con el primer soldado", () => {
    const m = new Match();
    run(m, 10, 0);
    expect(m.phase).toBe("waiting");
    m.step(8);
    expect(m.phase).toBe("prep");
    expect(m.isActive).toBe(true);
  });

  it(`preparación de ${GAME_CONFIG.match.prepSeconds} s, evacuación y oleada final con el último despegue`, () => {
    const m = new Match();
    run(m, PREP_TICKS - 1);
    expect(m.phase).toBe("prep");
    m.step(8);
    expect(m.phase).toBe("evacuation");
    run(m, FINAL_TICK - PREP_TICKS - 1);
    expect(m.phase).toBe("evacuation");
    m.step(8);
    expect(m.phase).toBe("final");
  });

  it("la oleada final no tiene fin: solo acaba cuando cae el último soldado", () => {
    const m = new Match();
    run(m, FINAL_TICK + Math.round(3600 / TICK_SECONDS));
    expect(m.phase).toBe("final");
    m.step(0);
    expect(m.phase).toBe("result");
  });

  it("termina en cuanto no queda nadie, aunque no haya despegado la última lanzadera", () => {
    const m = new Match();
    run(m, PREP_TICKS + 100);
    m.step(0);
    expect(m.phase).toBe("result");
    expect(m.isActive).toBe(false);
    expect(m.status(1000)).toMatchObject({
      phase: "result",
      survivedSeconds: Math.round((PREP_TICKS + 101) * TICK_SECONDS),
    });
    // Aunque vuelva a haber soldados, el resultado se queda hasta la siguiente partida.
    m.step(8);
    expect(m.phase).toBe("result");
  });

  it(`a los ${GAME_CONFIG.match.resultSeconds} s del resultado toca otra partida; al reiniciar, espera`, () => {
    const m = new Match();
    run(m, 50);
    m.step(0);
    run(m, RESULT_TICKS - 1, 0);
    expect(m.restartDue).toBe(false);
    m.step(0);
    expect(m.restartDue).toBe(true);
    m.reset();
    expect(m.phase).toBe("waiting");
    expect(m.restartDue).toBe(false);
  });

  it("el estado dice en qué tick del servidor acaba cada fase", () => {
    const m = new Match();
    m.step(8);
    expect(m.status(500)).toEqual({ t: "match", phase: "prep", endsAtTick: 500 + PREP_TICKS - 1 });
    run(m, PREP_TICKS);
    expect(m.status(500)).toEqual({
      t: "match",
      phase: "evacuation",
      endsAtTick: 500 + FINAL_TICK - PREP_TICKS - 1,
    });
    run(m, FINAL_TICK);
    expect(m.status(500)).toEqual({ t: "match", phase: "final", endsAtTick: null });
    m.step(0);
    expect(m.status(500).endsAtTick).toBe(500 + RESULT_TICKS);
  });

  it("solo avisa de los cambios de fase", () => {
    const m = new Match();
    expect(m.takeChanged()).toBe(true);
    m.step(8);
    expect(m.takeChanged()).toBe(true);
    run(m, 10);
    expect(m.takeChanged()).toBe(false);
    run(m, PREP_TICKS);
    expect(m.takeChanged()).toBe(true);
  });

  it("saltar de fase (administración) lleva el reloj al tick pedido", () => {
    const m = new Match();
    m.step(8);
    m.jumpTo(FINAL_TICK);
    m.step(8);
    expect(m.phase).toBe("final");
  });
});
