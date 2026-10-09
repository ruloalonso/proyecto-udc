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
import { LAUNCH_TICKS } from "./match.js";
import { World, type SentCache } from "./world.js";

const [L1] = LAUNCH_TICKS as [number];

const { colonists, crab, abilities } = GAME_CONFIG;
const RELEASE_TICKS = Math.round(colonists.releaseInterval / TICK_SECONDS);
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
  it("el Alto Mando abre un edificio al empezar la evacuación y salen de uno en uno por su puerta", () => {
    const { w, me } = setup();
    run(w, 5);
    expect(w.colonyStatus()).toMatchObject({
      buildings: [null, null, null, null],
      evacuating: null,
    });
    w.admin(me.id, "nextPhase");
    const events = run(w, 1);
    const opened = events.find((e) => e.k === "activate");
    expect(opened).toMatchObject({ k: "activate", colonists: colonists.perBuilding });
    const building = opened!.k === "activate" ? opened!.building : -1;
    expect(w.colonyStatus().evacuating).toBe(building);
    expect(w.crabs!.colonistCount).toBe(1);
    w.crabs!.forEachColonist((c) => expect(dist(c, MAP.routes[building]!.exit)).toBeLessThan(4));
    run(w, RELEASE_TICKS);
    expect(w.crabs!.colonistCount).toBe(2);
    expect(w.colonyStatus().buildings[building]).toBe(colonists.perBuilding - 2);
  });

  it("al despegar cada lanzadera abre el siguiente, y acercarse a un edificio ya no lo abre", () => {
    const { w, me } = setup(door);
    toEvacuation(w, me.id);
    const first = w.colonyStatus().evacuating;
    // Junto a la puerta del primer edificio de la lista: solo está abierto el que ha elegido.
    expect(w.colonyStatus().buildings.filter((b) => b !== null)).toHaveLength(1);
    w.match.jumpTo(L1);
    w.director!.jumpTo(L1);
    const events = run(w, 1);
    const second = w.colonyStatus().evacuating;
    expect(second).not.toBe(first);
    expect(events).toContainEqual({
      k: "activate",
      building: second,
      colonists: colonists.perBuilding,
    });
  });

  it("caminan hasta la plataforma y esperan allí", () => {
    const { w, me } = setup();
    toEvacuation(w, me.id);
    // Los primeros 5 de la fila.
    run(w, RELEASE_TICKS * 4, true);
    const first: number[] = [];
    w.crabs!.forEachColonist((c) => first.push(c.id));
    expect(first).toHaveLength(5);
    // ~100 m a 3 m/s, con margen.
    run(w, Math.round(50 / TICK_SECONDS), true);
    const pad = MAP.landingPad;
    // Los que llegan después los empujan un poco: margen de 2 m sobre el borde.
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
