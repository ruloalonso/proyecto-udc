import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  AbilityId,
  GAME_CONFIG,
  MAP,
  TICK_SECONDS,
  type GameEvent,
  type MapData,
} from "@udc/shared";
import { buildNavMesh, type NavMap } from "../ai/navmesh.js";
import { World } from "./world.js";

const { soldier } = GAME_CONFIG;
const RESCUE_TICKS = Math.round(soldier.rescue.seconds / TICK_SECONDS);
const open: MapData = { ...MAP, obstacles: [], dummies: [] };

function knockDown(world: World, id: number): void {
  world.soldiers.get(id)!.hp = 1;
  world["applyDamage"]({ k: "damage", src: 0, dst: id, amount: 10, by: "bite" });
}

/** Rescatador en (0, 0) y derribado a 1,5 m, en un mapa vacío. */
function setup(map: MapData = open, nav?: NavMap) {
  const world = new World(map, nav);
  const me = world.addSoldier();
  const down = world.addSoldier();
  me.state = { x: 0, z: 0, yaw: 0 };
  down.state = { x: 0, z: 1.5, yaw: 0 };
  knockDown(world, down.id);
  let seq = 0;
  /** Una entrada del rescatador (y un tick). */
  const input = (over: Partial<{ forward: number; revive: number; ability: AbilityId }> = {}) => {
    const { ability, ...rest } = over;
    world.queueInput(me.id, {
      seq: seq++,
      forward: 0,
      strafe: 0,
      yaw: 0,
      ...rest,
      ...(ability ? { ability: { id: ability } } : {}),
    });
    world.step();
    return world.events;
  };
  const run = (n: number) => {
    const all: GameEvent[] = [];
    for (let i = 0; i < n; i++) {
      world.step();
      all.push(...world.events);
    }
    return all;
  };
  return { world, me, down, input, run };
}

describe("World: rescate (E5-2)", () => {
  it(`pulsar F una vez basta: a los ${soldier.rescue.seconds} s se levanta con el ${soldier.rescue.healthFraction * 100}% de vida`, () => {
    const { me, down, input, run } = setup();
    expect(input({ revive: down.id })).toContainEqual({
      k: "rescue",
      src: me.id,
      dst: down.id,
      ticks: RESCUE_TICKS,
    });
    expect(down.state.pinned).toBe(true);
    // Sin más entradas (ni F mantenida).
    expect(run(RESCUE_TICKS - 1).some((e) => e.k === "rescued")).toBe(false);
    expect(run(1)).toContainEqual({ k: "rescued", src: me.id, dst: down.id });
    expect(down.hp).toBe(Math.round(soldier.health * soldier.rescue.healthFraction));
    expect(down.state.downed).toBeUndefined();
    expect(down.state.pinned).toBeUndefined();
    expect(down.downedUntil).toBeNull();
  });

  it("no empieza más allá del alcance", () => {
    const { down, input } = setup();
    down.state = { ...down.state, z: soldier.rescue.range + 0.5 };
    expect(input({ revive: down.id }).some((e) => e.k === "rescue")).toBe(false);
  });

  it("se puede empezar con el derribado arrastrándose: se queda quieto", () => {
    const { world, down, input } = setup();
    world.queueInput(down.id, { seq: 0, forward: 1, strafe: 0, yaw: 0 });
    input({ revive: down.id });
    const at = { x: down.state.x, z: down.state.z };
    for (let seq = 1; seq < 20; seq++) {
      world.queueInput(down.id, { seq, forward: 1, strafe: 0, yaw: 0 });
      world.step();
    }
    expect(down.state.x).toBe(at.x);
    expect(down.state.z).toBe(at.z);
    expect(down.rescuedBy).not.toBeNull();
  });

  it("moverse el rescatador lo corta, y el derribado vuelve a poder moverse", () => {
    const { me, down, input } = setup();
    input({ revive: down.id });
    expect(input({ forward: 1 })).toContainEqual({
      k: "rescueStop",
      src: me.id,
      dst: down.id,
      reason: "moved",
    });
    expect(down.state.pinned).toBeUndefined();
    expect(down.rescuedBy).toBeNull();
  });

  it("recibir daño el rescatador lo corta", () => {
    const { world, me, down, input } = setup();
    input({ revive: down.id });
    world["applyDamage"]({ k: "damage", src: 0, dst: me.id, amount: 5, by: "bite" });
    expect(world.events).toContainEqual({
      k: "rescueStop",
      src: me.id,
      dst: down.id,
      reason: "damaged",
    });
  });

  it("usar una habilidad lo corta", () => {
    const { me, down, input } = setup();
    input({ revive: down.id });
    expect(input({ ability: AbilityId.Stim })).toContainEqual({
      k: "rescueStop",
      src: me.id,
      dst: down.id,
      reason: "ability",
    });
  });

  it("mientras rescata, no dispara", () => {
    const { world, me, down, input, run } = setup({ ...open, dummies: [{ x: 0, z: 15 }] });
    const dummy = [...world.dummies.values()][0]!;
    world.setTarget(me.id, dummy.id);
    input({ revive: down.id });
    const shots = run(RESCUE_TICKS - 1).filter((e) => e.k === "damage" && e.src === me.id);
    expect(shots).toHaveLength(0);
  });
});

describe("World: los centollos y el rescate", () => {
  let nav: NavMap;
  let world: World | undefined;
  beforeAll(async () => {
    nav = await buildNavMesh(MAP);
  });
  afterAll(() => nav.destroy());
  afterEach(() => world?.crabs?.destroy());

  it("mientras le rescatan, los rasos van a por el rescatador (el derribado no es objetivo)", () => {
    const s = setup({ ...MAP, dummies: [] }, nav);
    world = s.world;
    s.me.state = { x: 0, z: 40, yaw: 0 };
    s.down.state = { ...s.down.state, x: 0, z: 41.5 };
    s.me.nextShotTick = s.down.nextShotTick = Number.POSITIVE_INFINITY;
    s.world.spawnCrab({ x: 0, z: 30 });
    s.input({ revive: s.down.id });
    const events = s.run(100);
    expect(events.some((e) => e.k === "damage" && e.dst === s.down.id)).toBe(false);
    expect(events.some((e) => e.k === "damage" && e.by === "bite" && e.dst === s.me.id)).toBe(true);
    // El mordisco al rescatador corta el rescate.
    expect(events.some((e) => e.k === "rescueStop" && e.reason === "damaged")).toBe(true);
  });
});
