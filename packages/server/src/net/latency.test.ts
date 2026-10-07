import { describe, expect, it } from "vitest";
import { createSimulatedChannel, simulationFromEnv, type NetworkSimulation } from "./latency.js";

/** Reloj y temporizadores falsos: el tiempo solo avanza con `advance`. */
function fakeClock() {
  let t = 0;
  const timers: { at: number; fn: () => void }[] = [];
  return {
    now: () => t,
    schedule: (fn: () => void, ms: number) => void timers.push({ at: t + ms, fn }),
    advance(ms: number) {
      const end = t + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        const next = timers[0];
        if (!next || next.at > end) break;
        timers.shift();
        t = next.at;
        next.fn();
      }
      t = end;
    },
  };
}

/** Azar con valores fijos, en orden. */
const sequence =
  (...values: number[]) =>
  () =>
    values.shift() ?? 0;

const sim = (over: Partial<NetworkSimulation> = {}): NetworkSimulation => ({
  latencyMs: 75,
  jitterMs: 0,
  loss: 0,
  rtoMs: 200,
  ...over,
});

describe("createSimulatedChannel", () => {
  it("sin simulación entrega al momento", () => {
    const got: number[] = [];
    createSimulatedChannel(sim({ latencyMs: 0 }))(() => got.push(1));
    expect(got).toEqual([1]);
  });

  it("entrega tras la latencia, no antes", () => {
    const clock = fakeClock();
    const send = createSimulatedChannel(sim(), { ...clock, random: sequence() });
    const got: number[] = [];
    send(() => got.push(1));
    clock.advance(74);
    expect(got).toEqual([]);
    clock.advance(1);
    expect(got).toEqual([1]);
  });

  it("con jitter conserva el orden: el segundo espera al primero", () => {
    const clock = fakeClock();
    // Primero con 18 ms de jitter, segundo con 2 ms (llegaría antes si no hubiera orden).
    const send = createSimulatedChannel(sim({ jitterMs: 20 }), {
      ...clock,
      random: sequence(0.9, 0.1),
    });
    const got: number[] = [];
    send(() => got.push(1));
    clock.advance(5);
    send(() => got.push(2));
    clock.advance(1000);
    expect(got).toEqual([1, 2]);
  });

  it("un mensaje perdido llega con la retransmisión y retrasa a los siguientes", () => {
    const clock = fakeClock();
    // Primer mensaje: jitter 0 y "perdido" (0 < 0,5). Segundo: jitter 0 y no perdido (0,9).
    const send = createSimulatedChannel(sim({ loss: 0.5 }), {
      ...clock,
      random: sequence(0, 0, 0, 0.9),
    });
    const got: number[] = [];
    send(() => got.push(1));
    clock.advance(50);
    send(() => got.push(2)); // llegaría a los 125 ms, pero va detrás del perdido
    clock.advance(200); // t = 250: aún no ha llegado el perdido (75 + 200 = 275)
    expect(got).toEqual([]);
    clock.advance(25); // t = 275
    expect(got).toEqual([1, 2]);
  });

  it("cada canal es independiente: una pérdida en uno no frena al otro", () => {
    const clock = fakeClock();
    const lossy = createSimulatedChannel(sim({ loss: 1 }), { ...clock, random: sequence(0, 0) });
    const clean = createSimulatedChannel(sim(), { ...clock, random: sequence(0) });
    const got: string[] = [];
    lossy(() => got.push("a"));
    clean(() => got.push("b"));
    clock.advance(75);
    expect(got).toEqual(["b"]);
    clock.advance(200);
    expect(got).toEqual(["b", "a"]);
  });
});

describe("simulationFromEnv", () => {
  it("lee las variables y pone valores por defecto", () => {
    expect(
      simulationFromEnv({ SIM_LATENCY_MS: "75", SIM_JITTER_MS: "20", SIM_LOSS: "0.02" }),
    ).toEqual({
      latencyMs: 75,
      jitterMs: 20,
      loss: 0.02,
      rtoMs: 200,
    });
    expect(simulationFromEnv({})).toEqual({ latencyMs: 0, jitterMs: 0, loss: 0, rtoMs: 200 });
  });

  it("ignora valores no válidos y limita la pérdida a 1", () => {
    expect(simulationFromEnv({ SIM_LATENCY_MS: "abc", SIM_LOSS: "7" })).toMatchObject({
      latencyMs: 0,
      loss: 1,
    });
  });
});
