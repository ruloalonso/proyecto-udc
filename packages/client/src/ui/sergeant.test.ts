import { describe, expect, it } from "vitest";
import {
  fillLine,
  lineSeconds,
  SERGEANT_TEXTS,
  SergeantQueue,
  sergeantLine,
  type SergeantMoment,
} from "./sergeant.js";

const MOMENTS: SergeantMoment[] = [
  "start",
  "evacuate",
  "death",
  "launch",
  "launchEmpty",
  "firstSpitter",
  "burrowWarning",
  "finalWave",
  "lastDeath",
  "result",
];
const HOLES = new Set(["recluta", "colonos", "lanzadera", "madriguera", "edificio"]);

describe("textos del sargento (sargento.json)", () => {
  it("tiene nombre y frases para todos los momentos, sin huecos desconocidos", () => {
    expect(SERGEANT_TEXTS.name.length).toBeGreaterThan(0);
    for (const moment of MOMENTS) {
      const lines = SERGEANT_TEXTS.lines[moment];
      expect(lines?.length, moment).toBeGreaterThan(0);
      for (const line of lines) {
        for (const [, hole] of line.matchAll(/\{(\w+)\}/g))
          expect(HOLES.has(hole!), line).toBe(true);
      }
    }
  });
});

describe("sargento (E6-6)", () => {
  const source = { name: "Sargento", lines: { ...SERGEANT_TEXTS.lines, death: ["A", "B", "C"] } };

  it("la misma frase para el mismo tick (todos los jugadores leen lo mismo)", () => {
    expect(sergeantLine("death", 1234, {}, source)).toBe(sergeantLine("death", 1234, {}, source));
    const seen = new Set(
      Array.from({ length: 30 }, (_, t) => sergeantLine("death", t, {}, source)),
    );
    expect(seen.size).toBe(3);
  });

  it("rellena los huecos con los datos de la partida", () => {
    expect(
      fillLine("{recluta} cae; {colonos} a salvo", { recluta: "Recluta nº 3", colonos: 12 }),
    ).toBe("Recluta nº 3 cae; 12 a salvo");
    expect(fillLine("sin dato: {madriguera}", {})).toBe("sin dato: {madriguera}");
  });

  it("una frase cada vez, lo que pida su longitud", () => {
    const q = new SergeantQueue();
    q.push("start", "primera");
    q.push("death", "segunda");
    expect(q.show(0)).toBe("primera");
    expect(q.show(lineSeconds("primera") - 0.1)).toBe("primera");
    expect(q.show(lineSeconds("primera"))).toBe("segunda");
    expect(q.show(100)).toBeNull();
  });

  it("si se acumulan, descarta antes las menos importantes", () => {
    const q = new SergeantQueue();
    q.push("start", "habla");
    q.show(0);
    q.push("death", "muerte 1");
    q.push("death", "muerte 2");
    q.push("death", "muerte 3");
    q.push("finalWave", "oleada final");
    const said: string[] = [];
    for (let t = 1; t < 60; t += 0.5) {
      const line = q.show(t);
      if (line && said.at(-1) !== line) said.push(line);
    }
    expect(said).toEqual(["habla", "muerte 2", "muerte 3", "oleada final"]);
  });
});
