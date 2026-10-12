import { GAME_CONFIG } from "@udc/shared";
import { describe, expect, it } from "vitest";
import {
  NEWSREEL_TEXTS,
  TOTAL_COLONISTS,
  newsreelView,
  nextText,
  verdictFor,
  type Verdict,
} from "./newsreel.js";

const { retreat, heroic } = GAME_CONFIG.match.verdict;
const HOLES = new Set(["colonos", "total", "tiempo", "segundos"]);

describe("noticiario (E6-4)", () => {
  it("son 200 colonos: 50 en cada uno de los 4 edificios", () => {
    expect(TOTAL_COLONISTS).toBe(200);
  });

  it("veredicto según la fracción de colonos a salvo", () => {
    expect(verdictFor(0, 200)).toBe("massacre");
    expect(verdictFor(retreat * 200 - 1, 200)).toBe("massacre");
    expect(verdictFor(retreat * 200, 200)).toBe("retreat");
    expect(verdictFor(heroic * 200 - 1, 200)).toBe("retreat");
    expect(verdictFor(heroic * 200, 200)).toBe("heroic");
    expect(verdictFor(200, 200)).toBe("heroic");
  });

  it("resuelve titular, cifras y parte de bajas, de más a menos abatidos", () => {
    const view = newsreelView(
      {
        saved: 130,
        survivedSeconds: 605,
        tick: 1234,
        report: {
          crabsKilled: 412,
          soldiers: [
            { id: 3, name: "Recluta nº 3", kills: 20, rescues: 0 },
            { id: 1, name: "Recluta nº 1", nick: "Rulo", kills: 55, rescues: 2 },
            { id: 2, name: "Recluta nº 2", kills: 20, rescues: 1 },
          ],
        },
      },
      NEWSREEL_TEXTS,
      200,
    );
    expect(view.verdict).toBe("heroic");
    expect(view.label).toBe(NEWSREEL_TEXTS.verdicts.heroic.label);
    expect(view.headline).not.toMatch(/\{\w+\}/);
    expect(view.lead).not.toMatch(/\{\w+\}/);
    expect(view.figures.map((f) => f.value)).toEqual(["130 / 200", "412", "3", "10:05"]);
    // A igualdad de abatidos, en el orden en que cayeron.
    expect(view.roll).toEqual([
      { name: "Recluta nº 1", player: "Rulo", kills: 55, rescues: 2 },
      { name: "Recluta nº 3", player: NEWSREEL_TEXTS.roll.bot, kills: 20, rescues: 0 },
      { name: "Recluta nº 2", player: NEWSREEL_TEXTS.roll.bot, kills: 20, rescues: 1 },
    ]);
  });

  it("cuenta atrás de la siguiente partida", () => {
    expect(nextText(4.2)).toBe("Nuevo pelotón en 5 s.");
    expect(nextText(-1)).toBe("Nuevo pelotón en 0 s.");
  });
});

describe("textos del noticiario (noticiario.json)", () => {
  it("tiene titulares y entradillas para los tres veredictos, sin huecos desconocidos", () => {
    const verdicts: Verdict[] = ["massacre", "retreat", "heroic"];
    const lines = [NEWSREEL_TEXTS.next];
    for (const verdict of verdicts) {
      const v = NEWSREEL_TEXTS.verdicts[verdict];
      expect(v.label.length, verdict).toBeGreaterThan(0);
      expect(v.headlines.length, verdict).toBeGreaterThan(0);
      expect(v.leads.length, verdict).toBeGreaterThan(0);
      lines.push(...v.headlines, ...v.leads);
    }
    for (const line of lines) {
      for (const [, hole] of line.matchAll(/\{(\w+)\}/g)) expect(HOLES.has(hole!), line).toBe(true);
    }
  });
});
