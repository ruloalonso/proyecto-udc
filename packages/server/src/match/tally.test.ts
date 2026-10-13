import { describe, expect, it } from "vitest";
import { Tally } from "./tally.js";

describe("Tally: parte del noticiario (E6-4)", () => {
  it("apunta abatidos y rescates de cada soldado y los lista en el orden en que caen", () => {
    const t = new Tally();
    t.enlist(1, "Recluta nº 1");
    t.enlist(2, "Recluta nº 2");
    t.crabKilled(1);
    t.crabKilled(1);
    t.crabKilled(2);
    t.rescued(2);
    t.fell(2, null);
    t.fell(1, "Rulo");
    expect(t.report()).toEqual({
      crabsKilled: 3,
      soldiers: [
        { id: 2, name: "Recluta nº 2", kills: 1, rescues: 1 },
        { id: 1, name: "Recluta nº 1", nick: "Rulo", kills: 2, rescues: 0 },
      ],
    });
  });

  it("los centollos que no mata un soldado cuentan en el total, no para nadie", () => {
    const t = new Tally();
    t.enlist(1, "Recluta nº 1");
    t.crabKilled(999); // La nave al explotar.
    t.fell(1, null);
    expect(t.report()).toEqual({
      crabsKilled: 1,
      soldiers: [{ id: 1, name: "Recluta nº 1", kills: 0, rescues: 0 }],
    });
  });

  it("empieza de cero en la partida siguiente", () => {
    const t = new Tally();
    t.enlist(1, "Recluta nº 1");
    t.crabKilled(1);
    t.fell(1, null);
    t.reset();
    expect(t.report()).toEqual({ crabsKilled: 0, soldiers: [] });
  });

  it("para los registros (E7-8): derribos, y cuándo y de qué cae cada uno; el noticiario, igual", () => {
    const t = new Tally();
    t.enlist(1, "Recluta nº 1");
    t.enlist(2, "Recluta nº 2");
    t.downed();
    t.downed();
    t.crabKilled(1);
    t.fell(2, null, 95, "time");
    t.fell(1, "Rulo", 140, "alone");
    expect(t.summary()).toEqual({
      crabsKilled: 1,
      downs: 2,
      fallen: [
        { name: "Recluta nº 2", kills: 0, rescues: 0, seconds: 95, cause: "time" },
        { name: "Recluta nº 1", nick: "Rulo", kills: 1, rescues: 0, seconds: 140, cause: "alone" },
      ],
    });
    // El parte del noticiario no lleva lo de los registros.
    expect(Object.keys(t.report().soldiers[0]!)).toEqual(["id", "name", "kills", "rescues"]);
    t.reset();
    expect(t.summary()).toEqual({ crabsKilled: 0, downs: 0, fallen: [] });
  });
});
