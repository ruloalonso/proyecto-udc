import { describe, expect, it } from "vitest";
import { EntityKind } from "@udc/shared";
import { nameTagOf } from "./nameTags.js";

describe("apodos sobre los jugadores (E2-5)", () => {
  it("los soldados de jugadores llevan su apodo; los bots, nada", () => {
    expect(nameTagOf({ kind: EntityKind.Soldier, nick: "rulo" })).toBe("rulo");
    expect(nameTagOf({ kind: EntityKind.Soldier, bot: true })).toBeNull();
    // Un bot recién relevado por un jugador llega con el apodo en el evento de control.
    expect(nameTagOf({ kind: EntityKind.Soldier, bot: false, nick: "ana" })).toBe("ana");
  });

  it("nada sobre lo que no es un soldado", () => {
    expect(nameTagOf({ kind: EntityKind.Crab })).toBeNull();
    expect(nameTagOf({ kind: EntityKind.Colonist })).toBeNull();
  });
});
