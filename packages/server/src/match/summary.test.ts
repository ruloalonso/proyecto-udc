import { describe, expect, it } from "vitest";
import { summaryLines, type MatchSummary } from "./summary.js";

const summary: MatchSummary = {
  survivedSeconds: 432,
  launches: 3,
  shuttles: 4,
  saved: 112,
  colonists: 200,
  crabsKilled: 812,
  downs: 23,
  fallen: [
    { name: "Recluta nº 3", kills: 41, rescues: 1, seconds: 185, cause: "time" },
    { name: "Recluta nº 1", nick: "Rulo #2", kills: 88, rescues: 3, seconds: 432, cause: "alone" },
  ],
};

describe("resumen de la partida en los registros (E7-8)", () => {
  it("cabecera con lo que aguantó y lo que salvó; derribos, rescates y causas", () => {
    const [head, totals] = summaryLines(summary);
    expect(head).toBe(
      "Parte de la partida: resistió 7:12 · 3 de 4 lanzaderas · 112 de 200 colonos a salvo · " +
        "812 centollos abatidos",
    );
    expect(totals).toBe(
      "  23 derribos · 4 rescates · 2 muertes (se le acabó el tiempo: 1, " +
        "nadie en pie para rescatarle: 1) · 1 caído con jugador",
    );
  });

  it("cada baja con su minuto, quién era, lo que hizo y de qué cayó; y todo en JSON", () => {
    const lines = summaryLines(summary);
    expect(lines[2]).toBe(
      "   3:05  Recluta nº 3 (bot) · 41 abatidos · 1 rescate · se le acabó el tiempo",
    );
    expect(lines[3]).toBe(
      "   7:12  Rulo #2 · 88 abatidos · 3 rescates · nadie en pie para rescatarle",
    );
    const json = lines.at(-1)!;
    expect(json.startsWith("  JSON ")).toBe(true);
    expect(JSON.parse(json.slice("  JSON ".length))).toEqual(summary);
  });
});
