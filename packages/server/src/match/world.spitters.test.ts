import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  EntityKind,
  GAME_CONFIG,
  MAP,
  TICK_SECONDS,
  type DamageEvent,
  type GameEvent,
  type MapData,
  type Point,
} from "@udc/shared";
import { buildNavMesh, type NavMap } from "../ai/navmesh.js";
import { World, type SentCache } from "./world.js";

const { spitter, soldier } = GAME_CONFIG;
const SPIT_TICKS = Math.round(spitter.spit.interval / TICK_SECONDS);
/** Ticks que tarda un escupitajo en agotar su alcance. */
const SPIT_LIFE = Math.ceil(spitter.spit.range / (spitter.spit.speed * TICK_SECONDS));
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

let nav: NavMap;
let world: World;
beforeAll(async () => {
  nav = await buildNavMesh(MAP);
});
afterAll(() => nav.destroy());
afterEach(() => world?.crabs?.destroy());

function setup(map: MapData = MAP): World {
  world = new World({ ...map, dummies: [] }, nav);
  return world;
}

/**
 * Soldado quieto mirando al norte. Los escupidores de las pruebas llegan del sur: así la
 * selección automática no los abate. Inmortal (se le rellena la vida en cada tick).
 */
function placeSoldier(w: World, at: Point) {
  const s = w.addSoldier();
  s.state = { ...s.state, ...at, yaw: 0 };
  return s;
}

const spitHits = (events: GameEvent[]) =>
  events.filter((e): e is DamageEvent => e.k === "damage" && e.by === "spit");

/** Ids de los escupitajos que existen ahora. */
function spitIds(w: World): number[] {
  const ids: number[] = [];
  w.crabs!.forEachSpit((s) => ids.push(s.id));
  return ids;
}

describe("World: escupidores", () => {
  it("se acercan a su distancia preferida, se paran y escupen cada 2,5 s", () => {
    const w = setup();
    const s = placeSoldier(w, { x: 0, z: 40 });
    const id = w.spawnCrab({ x: 0, z: 18 }, EntityKind.Spitter)!;
    expect(w.kindOf(id)).toBe(EntityKind.Spitter);

    const hitTicks: number[] = [];
    for (let t = 0; t < 200; t++) {
      w.step();
      s.hp = soldier.health;
      if (spitHits(w.events).some((e) => e.dst === s.id && e.src === id)) hitTicks.push(w.tick);
    }
    const here = w.crabs!.pose(id)!;
    expect(dist(here, s.state)).toBeLessThanOrEqual(spitter.preferredRange + 0.5);
    expect(dist(here, s.state)).toBeGreaterThan(spitter.preferredRange - 2);
    expect(hitTicks.length).toBeGreaterThanOrEqual(3);
    expect(hitTicks[1]! - hitTicks[0]!).toBe(SPIT_TICKS);
    expect(hitTicks[2]! - hitTicks[1]!).toBe(SPIT_TICKS);
  });

  it("el escupitajo hace su daño al que le da", () => {
    const w = setup();
    const s = placeSoldier(w, { x: 0, z: 40 });
    w.spawnCrab({ x: 0, z: 26 }, EntityKind.Spitter);
    let hit: DamageEvent | undefined;
    for (let t = 0; t < 80 && !hit; t++) {
      w.step();
      hit = spitHits(w.events)[0];
    }
    expect(hit).toMatchObject({ dst: s.id, amount: spitter.spit.damage, by: "spit" });
    expect(s.hp).toBe(soldier.health - spitter.spit.damage);
  });

  it("moverse de lado lo esquiva", () => {
    const w = setup();
    const s = placeSoldier(w, { x: -15, z: 40 });
    w.spawnCrab({ x: 0, z: 26 }, EntityKind.Spitter);
    let hits = 0;
    let launched = 0;
    const seen = new Set<number>();
    // Andando hacia el este (de lado respecto al escupidor) durante 8 s.
    for (let seq = 0; seq < 160; seq++) {
      w.queueInput(s.id, { seq, forward: 0, strafe: 1, yaw: 0 });
      w.step();
      s.hp = soldier.health;
      hits += spitHits(w.events).length;
      for (const id of spitIds(w)) {
        if (!seen.has(id)) launched++;
        seen.add(id);
      }
    }
    expect(launched).toBeGreaterThanOrEqual(2);
    expect(hits).toBe(0);
  });

  it(`no pasan de ${spitter.spit.range} m`, () => {
    const w = setup();
    const s = placeSoldier(w, { x: 0, z: 40 });
    w.spawnCrab({ x: 0, z: 26 }, EntityKind.Spitter);
    // Al ver el primer escupitajo, el soldado se aparta: tiene que perderse al agotar su alcance.
    let spit: number | undefined;
    let life = 0;
    for (let t = 0; t < 200; t++) {
      w.step();
      const ids = spitIds(w);
      if (spit === undefined && ids.length > 0) {
        spit = ids[0]!;
        s.state = { ...s.state, x: 10 };
      }
      if (spit === undefined) continue;
      if (!ids.includes(spit)) break;
      life++;
    }
    // Ticks en los que existe, contando el del lanzamiento: hasta recorrer el alcance entero.
    expect(life).toBe(SPIT_LIFE);
  });

  it("los obstáculos los paran", () => {
    // Un muro 2 m detrás del soldado; el soldado se aparta y el escupitajo choca con el muro.
    const wall = { id: "m", kind: "wall" as const, x: 0, z: -64, w: 10, d: 1, h: 3, rot: 0 };
    const w = setup({ ...MAP, obstacles: [...MAP.obstacles, wall] });
    const s = placeSoldier(w, { x: 0, z: -66 });
    s.state = { ...s.state, yaw: 0 };
    w.spawnCrab({ x: 0, z: -80 }, EntityKind.Spitter);
    let spit: number | undefined;
    let life = 0;
    for (let t = 0; t < 200; t++) {
      w.step();
      const ids = spitIds(w);
      if (spit === undefined && ids.length > 0) {
        spit = ids[0]!;
        s.state = { ...s.state, x: 6, z: -70 };
      }
      if (spit === undefined) continue;
      if (!ids.includes(spit)) break;
      life++;
    }
    expect(spit).toBeDefined();
    // El muro está a ~16 m del escupidor: se pierde antes de agotar los 18 m.
    expect(life).toBeLessThan(SPIT_LIFE - 2);
  });

  it("atraviesan a los centollos", () => {
    const w = setup();
    const s = placeSoldier(w, { x: 0, z: 40 });
    w.spawnCrab({ x: 0, z: 26 }, EntityKind.Spitter);
    // Rasos entre el escupidor y el soldado.
    for (let i = 0; i < 4; i++) w.spawnCrab({ x: -0.5 + i * 0.3, z: 32 });
    let spitDamage = 0;
    for (let t = 0; t < 120; t++) {
      w.step();
      s.hp = soldier.health;
      spitDamage += spitHits(w.events).length;
    }
    expect(spitDamage).toBeGreaterThan(0);
  });

  it("no tienen tope de atacantes", () => {
    const w = setup();
    const s = placeSoldier(w, { x: 0, z: 40 });
    for (let i = 0; i < 5; i++) w.spawnCrab({ x: -6 + i * 3, z: 22 }, EntityKind.Spitter);
    const shooters = new Set<number>();
    for (let t = 0; t < 200; t++) {
      w.step();
      s.hp = soldier.health;
      for (const e of spitHits(w.events)) shooters.add(e.src);
    }
    expect(shooters.size).toBe(5);
  });

  it("viajan en el snapshot: el escupidor con su vida y el escupitajo como entidad", () => {
    const w = setup();
    const me = placeSoldier(w, { x: 0, z: 40 });
    const id = w.spawnCrab({ x: 0, z: 26 }, EntityKind.Spitter)!;
    const sent: SentCache = new Map();
    const first = w.buildSnapshot(me.id, sent).added.find((e) => e.id === id);
    expect(first).toMatchObject({
      kind: EntityKind.Spitter,
      name: "Escupidor",
      hp: spitter.health,
    });

    let spit;
    for (let t = 0; t < 60 && !spit; t++) {
      w.step();
      me.hp = soldier.health;
      spit = w.buildSnapshot(me.id, sent).added.find((e) => e.kind === EntityKind.Spit);
    }
    expect(spit).toMatchObject({ kind: EntityKind.Spit, name: "Escupitajo" });
    expect(spit?.hp).toBeUndefined();
  });

  it("la selección automática los elige y el fuego los abate", () => {
    const w = setup();
    const me = placeSoldier(w, { x: 0, z: 40 });
    me.state = { ...me.state, yaw: Math.PI }; // De cara al escupidor.
    const id = w.spawnCrab({ x: 0, z: 26 }, EntityKind.Spitter)!;
    for (let t = 0; t < 200 && w.kindOf(id) !== null; t++) {
      w.step();
      me.hp = soldier.health;
    }
    expect(w.kindOf(id)).toBeNull();
  });
});
