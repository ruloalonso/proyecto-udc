import { describe, expect, it } from "vitest";
import { EntityKind, isHostile } from "./messages.js";

describe("isHostile", () => {
  it("los muñecos de prueba son hostiles", () => {
    expect(isHostile(EntityKind.Dummy)).toBe(true);
  });

  it("los soldados no son hostiles", () => {
    expect(isHostile(EntityKind.Soldier)).toBe(false);
  });
});

describe("isHostile (centollos)", () => {
  it("los centollos rasos son hostiles", () => {
    expect(isHostile(EntityKind.Crab)).toBe(true);
  });
});

describe("isHostile (escupidores)", () => {
  it("los escupidores son hostiles y sus escupitajos no", () => {
    expect(isHostile(EntityKind.Spitter)).toBe(true);
    expect(isHostile(EntityKind.Spit)).toBe(false);
  });
});
