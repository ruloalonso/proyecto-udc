import { GAME_CONFIG } from "@udc/shared";
import { describe, expect, it } from "vitest";
import { squadRows } from "./squad.js";

const MAX = GAME_CONFIG.soldier.health;

describe("panel del pelotón (E2-6)", () => {
  it("en orden de alistamiento, con su vida; el propio, marcado", () => {
    const rows = squadRows(
      [
        { id: 5, label: "Recluta nº 5 (bot)", hp: MAX / 2 },
        { id: 3, label: "Rulo", hp: MAX, me: true },
      ],
      new Map(),
    );
    expect(rows.map((r) => [r.id, r.label, r.hp, r.state, r.me])).toEqual([
      [3, "Rulo", 1, "ok", true],
      [5, "Recluta nº 5 (bot)", 0.5, "ok", false],
    ]);
  });

  it("derribados con su cuenta atrás o «rescatando»", () => {
    const rows = squadRows(
      [
        { id: 1, label: "A", hp: 0, downedLeft: 12.3 },
        { id: 2, label: "B", hp: 0, downedLeft: 20, rescuing: true },
        { id: 4, label: "C", hp: 0, downedLeft: null },
      ],
      new Map(),
    );
    expect(rows.map((r) => [r.state, r.detail])).toEqual([
      ["downed", "13 s"],
      ["downed", "rescatando"],
      ["downed", "derribado"],
    ]);
  });

  it("los muertos se quedan tachados en su sitio; tu cuerpo anterior también", () => {
    const rows = squadRows(
      [{ id: 9, label: "Rulo #2", hp: MAX, me: true }],
      new Map([
        [3, "Rulo"],
        [6, "Recluta nº 6 (bot)"],
      ]),
    );
    expect(rows.map((r) => [r.id, r.label, r.state])).toEqual([
      [3, "Rulo", "dead"],
      [6, "Recluta nº 6 (bot)", "dead"],
      [9, "Rulo #2", "ok"],
    ]);
  });
});
