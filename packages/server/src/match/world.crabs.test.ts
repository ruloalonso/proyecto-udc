import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
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

const { crab, soldier } = GAME_CONFIG;
const BITE_TICKS = Math.round(crab.bite.interval / TICK_SECONDS);
const CONTACT = crab.radius + soldier.radius;
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

let nav: NavMap;
let world: World;
beforeAll(async () => {
  nav = await buildNavMesh(MAP);
});
afterAll(() => nav.destroy());
afterEach(() => world?.crabs?.destroy());

/** Mundo con navmesh y sin muñecos de por medio. */
function setup(): World {
  world = new World(MAP, nav);
  for (const id of [...world.dummies.keys()]) world.dummies.delete(id);
  return world;
}

/** Avanza `ticks` ticks y devuelve todos los eventos. */
function run(w: World, ticks: number): GameEvent[] {
  const all: GameEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    w.step();
    all.push(...w.events);
  }
  return all;
}

const bites = (events: GameEvent[]) =>
  events.filter((e): e is DamageEvent => e.k === "damage" && e.by === "bite");

/**
 * Coloca a un soldado en un punto (sin entradas, se queda quieto). Mira al norte, de espaldas a
 * los centollos de las pruebas (llegan del sur): así la selección automática no los abate.
 */
function placeSoldier(w: World, at: Point) {
  const s = w.addSoldier();
  s.state = { ...s.state, ...at, yaw: 0 };
  return s;
}

describe("World: centollos rasos", () => {
  it("aparecen sobre la navmesh y viajan completos en el primer snapshot", () => {
    const w = setup();
    const me = placeSoldier(w, { x: 0, z: 40 });
    const id = w.spawnCrab({ x: 0, z: -95 })!;
    expect(id).not.toBeNull();
    expect(w.kindOf(id)).toBe(EntityKind.Crab);

    const sent: SentCache = new Map();
    const added = w.buildSnapshot(me.id, sent).added.find((e) => e.id === id);
    expect(added).toMatchObject({ kind: EntityKind.Crab, name: "Centollo raso", hp: crab.health });

    run(w, 10);
    const moved = w.buildSnapshot(me.id, sent).moved;
    expect(moved[0]).toBe(id);
  });

  it("sin soldados a la vista, avanzan hacia la colonia", () => {
    const w = setup();
    const id = w.spawnCrab({ x: 0, z: -95 })!;
    const start = w.crabs!.pose(id)!;
    run(w, 40);
    const now = w.crabs!.pose(id)!;
    // 2 s a 6 m/s: bastante más cerca de la plataforma.
    expect(dist(start, MAP.landingPad) - dist(now, MAP.landingPad)).toBeGreaterThan(8);
  });

  it("van a por el soldado a la vista y le muerden al llegar, una vez por segundo", () => {
    const w = setup();
    const s = placeSoldier(w, { x: 0, z: 40 });
    w.spawnCrab({ x: 0, z: 25 });

    // ~15 m a 6 m/s, más la frenada al llegar: el primero hacia los 2,5 s.
    const events = run(w, 90);
    const myBites = bites(events).filter((e) => e.dst === s.id);
    expect(myBites.length).toBeGreaterThanOrEqual(2);
    expect(myBites[0]!.amount).toBe(crab.bite.damage);
    expect(s.hp).toBe(soldier.health - myBites.length * crab.bite.damage);

    // Entre dos mordiscos del mismo centollo pasa un segundo.
    const ticks: number[] = [];
    const w2 = setup();
    const s2 = placeSoldier(w2, { x: 0, z: 40 });
    w2.spawnCrab({ x: 0, z: 25 });
    for (let i = 0; i < 80; i++) {
      w2.step();
      if (bites(w2.events).some((e) => e.dst === s2.id)) ticks.push(w2.tick);
    }
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks[1]! - ticks[0]!).toBe(BITE_TICKS);
  });

  it("no hacen caso a los soldados que están más lejos que su alcance de detección", () => {
    const w = setup();
    placeSoldier(w, { x: 0, z: 40 });
    // Más allá del alcance, y al otro lado del mapa respecto a la plataforma.
    const id = w.spawnCrab({ x: 90, z: -90 })!;
    const events = run(w, 20);
    expect(bites(events)).toHaveLength(0);
    expect(dist(w.crabs!.pose(id)!, { x: 0, z: 40 })).toBeGreaterThan(crab.aggroRange);
  });

  it(`como mucho ${crab.maxMeleeAttackers} muerden al mismo soldado; el resto va a por otro`, () => {
    const w = setup();
    const a = placeSoldier(w, { x: -6, z: 40 });
    const b = placeSoldier(w, { x: 6, z: 40 });
    for (let i = 0; i < 5; i++) w.spawnCrab({ x: -6 + i * 0.1, z: 30 });

    const events = run(w, 120);
    const biters = (id: number) =>
      new Set(
        bites(events)
          .filter((e) => e.dst === id)
          .map((e) => e.src),
      );
    expect(biters(a.id).size).toBeLessThanOrEqual(crab.maxMeleeAttackers);
    expect(biters(b.id).size).toBeGreaterThan(0);
  });

  it("no se meten dentro de los soldados", () => {
    const w = setup();
    const s = placeSoldier(w, { x: 0, z: 40 });
    for (let i = 0; i < 12; i++) w.spawnCrab({ x: -3 + (i % 6), z: 28 - Math.floor(i / 6) });
    for (let t = 0; t < 100; t++) {
      w.step();
      // Que no muera durante la prueba.
      s.hp = soldier.health;
      w.crabs!.forEach((c) => expect(dist(c, s.state)).toBeGreaterThanOrEqual(CONTACT - 0.01));
    }
  });

  it("los soldados tampoco los atraviesan", () => {
    const w = setup();
    const s = placeSoldier(w, { x: 0, z: 40 });
    // Un centollo justo delante (al sur), y el soldado anda hacia él sin dispararle.
    s.nextShotTick = Number.POSITIVE_INFINITY;
    w.spawnCrab({ x: 0, z: 37 });
    for (let seq = 0; seq < 40; seq++) {
      w.queueInput(s.id, { seq, forward: 1, strafe: 0, yaw: Math.PI });
      w.step();
      s.hp = soldier.health;
      w.crabs!.forEach((c) => expect(dist(c, s.state)).toBeGreaterThanOrEqual(CONTACT - 0.01));
    }
  });

  it("mueren con el fuego automático y desaparecen del snapshot", () => {
    const w = setup();
    const me = placeSoldier(w, { x: 0, z: 40 });
    me.state = { ...me.state, yaw: Math.PI };
    const id = w.spawnCrab({ x: 0, z: 25 })!;
    const sent: SentCache = new Map();
    w.buildSnapshot(me.id, sent);
    w.setTarget(me.id, id);

    let removed = false;
    for (let t = 0; t < 200 && !removed; t++) {
      w.step();
      me.hp = soldier.health;
      // El soldado se gira hacia el centollo para tenerlo en el cono.
      const c = w.crabs!.pose(id);
      if (c) me.state = { ...me.state, yaw: Math.atan2(c.x - me.state.x, c.z - me.state.z) };
      removed = w.buildSnapshot(me.id, sent).removed.includes(id);
    }
    expect(removed).toBe(true);
    expect(w.kindOf(id)).toBeNull();
    // Como con los muñecos, el objetivo se quita en el tick siguiente.
    w.step();
    expect(me.targetId).toBeNull();
  });

  it("a 0 de vida, el soldado reaparece en la plataforma con la vida llena (provisional)", () => {
    const w = setup();
    const s = placeSoldier(w, { x: 0, z: 10 });
    s.hp = crab.bite.damage;
    w.spawnCrab({ x: 0, z: 0 });

    let respawned = false;
    for (let t = 0; t < 100 && !respawned; t++) {
      w.step();
      respawned = w.events.some((e) => e.k === "respawn" && e.src === s.id);
    }
    expect(respawned).toBe(true);
    expect(s.hp).toBe(soldier.health);
    expect(dist(s.state, MAP.spawn)).toBeLessThanOrEqual(MAP.spawn.radius);
  });

  it("modo de prueba: mantiene los centollos pedidos", () => {
    const w = setup();
    w.crabQuota = 20;
    run(w, 5);
    expect(w.crabs!.count).toBe(20);
  });
});
