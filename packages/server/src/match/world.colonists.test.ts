import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  AbilityId,
  EntityKind,
  GAME_CONFIG,
  MAP,
  TICK_SECONDS,
  type DamageEvent,
  type GameEvent,
  type Point,
} from "@udc/shared";
import { buildNavMesh, type NavMap } from "../ai/navmesh.js";
import { World, type SentCache } from "./world.js";

const { colonists, crab, abilities } = GAME_CONFIG;
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
const door = MAP.routes[0]!.exit;

let nav: NavMap;
let world: World;
beforeAll(async () => {
  nav = await buildNavMesh(MAP);
});
afterAll(() => nav.destroy());
afterEach(() => world?.crabs?.destroy());

/** Mundo con navmesh y un soldado invulnerable en `at`, mirando al norte. */
function setup(at: Point = { x: 0, z: 40 }) {
  world = new World({ ...MAP, dummies: [] }, nav);
  world.adminEnabled = true;
  const me = world.addSoldier();
  me.state = { ...me.state, ...at, yaw: 0 };
  me.invulnerable = true;
  return { w: world, me };
}

/** Pasa a la evacuación, como la tecla N de administración. */
function toEvacuation(w: World, id: number): void {
  w.step();
  w.admin(id, "nextPhase");
  w.step();
}

/** Quita los centollos del director (no los colonos). */
function removeCrabs(w: World): void {
  const ids: number[] = [];
  w.crabs!.forEach((c) => ids.push(c.id));
  for (const id of ids) w.crabs!.remove(id);
}

function run(w: World, ticks: number, quiet = false): GameEvent[] {
  const all: GameEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    w.step();
    if (quiet) removeCrabs(w);
    all.push(...w.events);
  }
  return all;
}

function colonistPose(w: World, id: number): Point | undefined {
  let pose: Point | undefined;
  w.crabs!.forEachColonist((c) => {
    if (c.id === id) pose = c;
  });
  return pose;
}

const bites = (events: GameEvent[]) =>
  events.filter((e): e is DamageEvent => e.k === "damage" && e.by === "bite");

describe("World: colonos (E6-2)", () => {
  it("en la preparación, acercarse no activa nada; en la evacuación, sí, y salen por la puerta", () => {
    const { w, me } = setup(door);
    run(w, 5);
    expect(w.colonyStatus().buildings[0]).toBeNull();
    w.admin(me.id, "nextPhase");
    const events = run(w, 1);
    expect(events).toContainEqual({
      k: "activate",
      src: me.id,
      building: 0,
      colonists: colonists.perBuilding,
    });
    const out = w.crabs!.colonistCount;
    expect(out).toBeGreaterThanOrEqual(colonists.group.min);
    expect(out).toBeLessThanOrEqual(colonists.group.max);
    expect(w.colonyStatus().buildings[0]).toBe(colonists.perBuilding - out);
    w.crabs!.forEachColonist((c) => expect(dist(c, door)).toBeLessThan(4));
  });

  it("caminan hasta la plataforma y esperan allí", () => {
    const { w } = setup(door);
    toEvacuation(w, [...w.soldiers.keys()][0]!);
    const first: number[] = [];
    w.crabs!.forEachColonist((c) => first.push(c.id));
    // ~100 m a 3 m/s, con margen para los atascos.
    run(w, Math.round(50 / TICK_SECONDS), true);
    const pad = MAP.landingPad;
    // Los grupos que llegan después los empujan un poco: margen de 2 m sobre el borde.
    for (const id of first) {
      expect(dist(colonistPose(w, id)!, pad)).toBeLessThanOrEqual(pad.radius + 2);
    }
  });

  it("con un centollo cerca entran en pánico y corren más", () => {
    const { w } = setup();
    const from = { x: 0, z: -20 };
    const goal = { x: 0, z: 20 };
    const calm = 10_000;
    w.crabs!.spawnColonist(calm, from, goal);
    run(w, 20);
    const a = colonistPose(w, calm)!;
    run(w, 20);
    const calmSpeed = dist(a, colonistPose(w, calm)!) / (20 * TICK_SECONDS);
    expect(calmSpeed).toBeLessThanOrEqual(colonists.speed + 0.1);

    const scared = 10_001;
    w.crabs!.spawnColonist(scared, { x: 10, z: -20 }, { x: 10, z: 20 });
    w.spawnCrab({ x: 10, z: -24 });
    run(w, 10);
    const b = colonistPose(w, scared)!;
    run(w, 10);
    const scaredSpeed = dist(b, colonistPose(w, scared)!) / (10 * TICK_SECONDS);
    expect(scaredSpeed).toBeGreaterThan(colonists.speed + 1);
  });

  it("los rasos van a por los colonos antes que a por un soldado más cercano", () => {
    const { w, me } = setup({ x: 4, z: -15 });
    me.invulnerable = false;
    const colonist = 10_000;
    const at = { x: -10, z: -8 };
    w.crabs!.spawnColonist(colonist, at, at);
    w.spawnCrab({ x: 0, z: -20 });
    const events = run(w, 60);
    const hits = bites(events);
    expect(hits.some((e) => e.dst === colonist)).toBe(true);
    expect(hits.some((e) => e.dst === me.id)).toBe(false);
  });

  it("persiguiendo a un colono, muerde al soldado que le tapa el paso", () => {
    const { w, me } = setup();
    me.invulnerable = false; // Si no, el mordisco ni se registra.
    const crabId = w.spawnCrab({ x: 0, z: -20 })!;
    const c = w.crabs!.pose(crabId)!;
    // El soldado, pegado al raso y entre él y el colono.
    me.state = { ...me.state, x: c.x, z: c.z + 1.2 };
    const colonist = 10_000;
    const at = { x: c.x, z: c.z + 20 };
    w.crabs!.spawnColonist(colonist, at, at);
    const events = run(w, 3);
    expect(bites(events).some((e) => e.dst === me.id)).toBe(true);
  });

  it(`una granada los deja malheridos (${colonists.health} de vida) y no los mata`, () => {
    const { w, me } = setup({ x: 0, z: 0 });
    const colonist = 10_000;
    const at = { x: 0, z: 10 };
    w.crabs!.spawnColonist(colonist, at, at);
    w.queueInput(me.id, {
      seq: 0,
      forward: 0,
      strafe: 0,
      yaw: 0,
      ability: { id: AbilityId.Grenade, ...at },
    });
    run(w, Math.round(abilities.grenade.fuseTime / TICK_SECONDS) + 2);
    let hp: number | undefined;
    w.crabs!.forEachColonist((c) => {
      if (c.id === colonist) hp = c.hp;
    });
    expect(hp).toBe(colonists.health - abilities.grenade.damage);
  });

  it(`mueren a los ${Math.ceil(colonists.health / crab.bite.damage)} mordiscos`, () => {
    const { w } = setup();
    const colonist = 10_000;
    w.crabs!.spawnColonist(colonist, { x: 0, z: 0 }, { x: 0, z: 0 });
    const needed = Math.ceil(colonists.health / crab.bite.damage);
    for (let i = 1; i < needed; i++)
      expect(w.crabs!.damage(colonist, crab.bite.damage)).toBe(false);
    expect(w.crabs!.damage(colonist, crab.bite.damage)).toBe(true);
    expect(w.crabs!.isColonist(colonist)).toBe(false);
  });

  it("viajan en el snapshot con su vida y no se pueden seleccionar", () => {
    const { w, me } = setup();
    const colonist = 10_000;
    w.crabs!.spawnColonist(colonist, { x: 0, z: 0 }, { x: 0, z: 0 });
    const added = w
      .buildSnapshot(me.id, new Map() as SentCache)
      .added.find((e) => e.id === colonist);
    expect(added).toMatchObject({
      kind: EntityKind.Colonist,
      name: "Colono",
      hp: colonists.health,
    });
    w.setTarget(me.id, colonist);
    expect(me.targetId).toBeNull();
  });

  it("al reiniciar la partida, ni colonos ni edificios activados", () => {
    const { w, me } = setup(door);
    toEvacuation(w, me.id);
    expect(w.crabs!.colonistCount).toBeGreaterThan(0);
    w.resetMatch();
    expect(w.crabs!.colonistCount).toBe(0);
    expect(w.colonyStatus().buildings.every((b) => b === null)).toBe(true);
  });
});
