import { describe, expect, it } from "vitest";
import { EntityKind, GAME_CONFIG, MAP } from "@udc/shared";
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

describe("World: fuego automático contra muñecos", () => {
  const { health, respawnSeconds } = GAME_CONFIG.dummy;
  const { damage } = GAME_CONFIG.combat.autoFire;
  const shotsToKill = Math.ceil(health / damage);

  /** Soldado a 4 m de un muñeco, con él como objetivo. */
  const setup = () => {
    const world = new World();
    const me = world.addSoldier();
    const dummy = [...world.dummies.values()][0]!;
    me.state = { x: dummy.x, z: dummy.z + 4, yaw: Math.PI };
    world.setTarget(me.id, dummy.id);
    return { world, me, dummy };
  };

  /** Avanza ticks hasta que haya `n` eventos de daño en total. */
  const stepUntilShots = (world: World, n: number) => {
    let shots = 0;
    for (let i = 0; i < 1000 && shots < n; i++) {
      world.step();
      shots += world.events.length;
    }
    return shots;
  };

  it("dispara en el primer tick y emite un evento de daño", () => {
    const { world, me, dummy } = setup();
    world.step();
    expect(world.events).toEqual([{ k: "damage", src: me.id, dst: dummy.id, amount: damage }]);
    expect(dummy.hp).toBe(health - damage);
  });

  it("envía la vida en el snapshot y la reenvía cuando cambia", () => {
    const { world, me, dummy } = setup();
    const sent: SentCache = new Map();
    const first = world.buildSnapshot(me.id, sent).changed.find((e) => e.id === dummy.id);
    expect(first?.hp).toBe(health);

    world.step();
    const second = world.buildSnapshot(me.id, sent).changed.find((e) => e.id === dummy.id);
    expect(second?.hp).toBe(health - damage);
  });

  it("los soldados no llevan vida en el snapshot (todavía)", () => {
    const { world, me } = setup();
    const other = world.addSoldier();
    const e = world.buildSnapshot(me.id, new Map()).changed.find((c) => c.id === other.id);
    expect(e).toBeDefined();
    expect("hp" in e!).toBe(false);
  });

  it("el muñeco muere, desaparece, se quita el objetivo y reaparece con id nuevo", () => {
    const { world, me, dummy } = setup();
    const sent: SentCache = new Map();
    world.buildSnapshot(me.id, sent);

    expect(stepUntilShots(world, shotsToKill)).toBe(shotsToKill);
    expect(world.dummies.has(dummy.id)).toBe(false);
    expect(world.buildSnapshot(me.id, sent).removed).toContain(dummy.id);

    world.step();
    expect(me.targetId).toBeNull();

    const diedAt = world.tick - 1;
    while (world.tick < diedAt + respawnSeconds * GAME_CONFIG.net.tickRate) world.step();
    const reborn = [...world.dummies.values()].find((d) => d.spot === dummy.spot);
    expect(reborn).toBeDefined();
    expect(reborn!.id).not.toBe(dummy.id);
    expect(reborn!.hp).toBe(health);
  });

  it("no dispara a un muñeco tapado por un muro (mapa real)", () => {
    const { world, me } = setup();
    const hidden = [...world.dummies.values()].find((d) => d.x === -20 && d.z === 12)!;
    me.state = { x: MAP.spawn.x, z: MAP.spawn.z, yaw: Math.PI };
    world.setTarget(me.id, hidden.id);
    for (let i = 0; i < 40; i++) world.step();
    expect(hidden.hp).toBe(health);
    expect(me.targetId).toBe(hidden.id);
  });

  it("no dispara a un muñeco fuera de alcance", () => {
    const { world, me, dummy } = setup();
    me.state = { x: dummy.x, z: dummy.z + GAME_CONFIG.combat.autoFire.range + 1, yaw: Math.PI };
    world.step();
    expect(world.events).toHaveLength(0);
    expect(dummy.hp).toBe(health);
  });
});
