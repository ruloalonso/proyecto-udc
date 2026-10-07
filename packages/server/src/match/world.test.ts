import { describe, expect, it } from "vitest";
import { EntityKind, MAP } from "@udc/shared";
import { World, type SentCache } from "./world.js";

describe("World: muñecos de prueba", () => {
  it("crea un muñeco por cada punto del mapa", () => {
    expect(new World().dummies.size).toBe(MAP.dummies.length);
  });

  it("los envía en el primer snapshot, con nombre, y no en los siguientes", () => {
    const world = new World();
    const me = world.addSoldier();
    const sent: SentCache = new Map();

    const first = world.buildSnapshot(me.id, sent);
    const dummies = first.changed.filter((e) => e.kind === EntityKind.Dummy);
    expect(dummies).toHaveLength(MAP.dummies.length);
    expect(dummies.every((e) => e.name)).toBe(true);

    world.step();
    const second = world.buildSnapshot(me.id, sent);
    expect(second.changed.filter((e) => e.kind === EntityKind.Dummy)).toHaveLength(0);
    expect(second.removed).toHaveLength(0);
  });
});

describe("World: selección de objetivo", () => {
  const setup = () => {
    const world = new World();
    const me = world.addSoldier();
    const other = world.addSoldier();
    const dummyId = [...world.dummies.keys()][0]!;
    return { world, me, other, dummyId };
  };

  it("acepta un muñeco como objetivo", () => {
    const { world, me, dummyId } = setup();
    world.setTarget(me.id, dummyId);
    expect(me.targetId).toBe(dummyId);
  });

  it("no acepta a un aliado como objetivo", () => {
    const { world, me, other } = setup();
    world.setTarget(me.id, other.id);
    expect(me.targetId).toBeNull();
  });

  it("no acepta una entidad que no existe y quita el objetivo anterior", () => {
    const { world, me, dummyId } = setup();
    world.setTarget(me.id, dummyId);
    world.setTarget(me.id, 9999);
    expect(me.targetId).toBeNull();
  });

  it("null quita el objetivo", () => {
    const { world, me, dummyId } = setup();
    world.setTarget(me.id, dummyId);
    world.setTarget(me.id, null);
    expect(me.targetId).toBeNull();
  });

  it("se quita el objetivo si la entidad desaparece", () => {
    const { world, me, dummyId } = setup();
    world.setTarget(me.id, dummyId);
    world.dummies.delete(dummyId);
    world.step();
    expect(me.targetId).toBeNull();
  });
});
