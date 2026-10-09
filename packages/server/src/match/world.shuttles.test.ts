import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  AbilityId,
  EntityKind,
  GAME_CONFIG,
  MAP,
  TICK_SECONDS,
  type GameEvent,
  type Point,
} from "@udc/shared";
import { buildNavMesh, type NavMap } from "../ai/navmesh.js";
import { FINAL_TICK, LAUNCH_TICKS, PREP_TICKS } from "./match.js";
import { World } from "./world.js";

const pad = MAP.landingPad;
const cfg = GAME_CONFIG.shuttles;
const [L1] = LAUNCH_TICKS as [number];
const ticks = (s: number) => Math.round(s / TICK_SECONDS);

let nav: NavMap;
let world: World;
beforeAll(async () => {
  nav = await buildNavMesh(MAP);
});
afterAll(() => nav.destroy());
afterEach(() => world?.crabs?.destroy());

/** Mundo con un soldado invulnerable en `at`, con la partida ya empezada. */
function setup(at: Point = { x: 0, z: 30 }) {
  world = new World({ ...MAP, dummies: [] }, nav);
  const me = world.addSoldier();
  me.state = { ...me.state, ...at, yaw: 0 };
  me.invulnerable = true;
  me.nextShotTick = Number.POSITIVE_INFINITY;
  world.step();
  return { w: world, me };
}

/** Salta al tick `t` de la partida, como los comandos de administración, y lo da. */
function stepAt(w: World, t: number): GameEvent[] {
  w.match.jumpTo(t);
  w.director!.jumpTo(t);
  w.shuttle.jumpTo(t);
  w.step();
  return w.events;
}

/** Avanza `n` ticks quitando los centollos del director (no los colonos). */
function runQuiet(w: World, n: number): GameEvent[] {
  const all: GameEvent[] = [];
  for (let i = 0; i < n; i++) {
    w.step();
    all.push(...w.events);
    const crabs: number[] = [];
    w.crabs!.forEach((c) => crabs.push(c.id));
    crabs.forEach((id) => w.crabs!.remove(id));
  }
  return all;
}

function colonistIds(w: World): number[] {
  const ids: number[] = [];
  w.crabs!.forEachColonist((c) => ids.push(c.id));
  return ids;
}

/** Revienta la nave como lo haría el enjambre. */
function destroyShuttle(w: World): void {
  w["applyDamage"]({ k: "damage", src: 1, dst: w.shuttleId, amount: cfg.health, by: "bite" });
}

describe("World: lanzaderas (E6-3)", () => {
  it("los colonos embarcan al llegar; al despegar, los de a bordo pasan a salvo", () => {
    const { w } = setup();
    stepAt(w, PREP_TICKS);
    const onPad = [10_000, 10_001, 10_002];
    onPad.forEach((id, i) => {
      const at = { x: pad.x + i * 2 - 2, z: pad.z + 6 };
      w.crabs!.spawnColonist(id, at, at);
    });
    const outside = { x: pad.x, z: pad.z - pad.radius - 6 };
    w.crabs!.spawnColonist(10_003, outside, outside);
    w.step();
    expect(w.shuttle.aboard).toBe(3);
    for (const id of onPad) expect(colonistIds(w)).not.toContain(id);
    expect(colonistIds(w)).toContain(10_003);

    // Al despegar se los lleva (los que suben en el último tick, también).
    w.match.jumpTo(L1);
    w.director!.jumpTo(L1);
    const events: GameEvent[] = [];
    w.step();
    events.push(...w.events);
    expect(events).toContainEqual({ k: "launch", n: 1, boarded: 3 });
    expect(w.matchStatus()).toMatchObject({ launches: 1, saved: 3 });
    expect(w.shuttle.docked).toBe(false);
  });

  it("una lanzadera que despega vacía también cuenta", () => {
    const { w } = setup();
    expect(stepAt(w, L1)).toContainEqual({ k: "launch", n: 1, boarded: 0 });
    expect(w.matchStatus()).toMatchObject({ launches: 1, saved: 0 });
  });

  it("la última abre la oleada final; después los edificios no sueltan a nadie", () => {
    const { w } = setup();
    const events = stepAt(w, FINAL_TICK);
    expect(events).toContainEqual({ k: "launch", n: cfg.launches.length, boarded: 0 });
    expect(events).toContainEqual({ k: "finalWave" });
    for (let i = 0; i < 40; i++) w.step();
    expect(w.crabs!.colonistCount).toBe(0);
  });

  it("cada nave que aterriza trae un edificio nuevo, pero solo cuando se ha vaciado el anterior", () => {
    const { w } = setup();
    stepAt(w, PREP_TICKS);
    const first = w.colonyStatus().evacuating;
    // El primero se vacía hacia 1:40 de evacuación; el siguiente no se abre hasta que aterriza
    // la segunda nave, después del primer despegue.
    const landing = L1 + ticks(cfg.landDelay + cfg.landSeconds);
    runQuiet(w, landing - PREP_TICKS - 2);
    expect(w.colonyStatus().evacuating).toBe(first);
    expect(w.colonyStatus().buildings[first!]).toBe(0);
    runQuiet(w, 3);
    expect(w.shuttle.docked).toBe(true);
    expect(w.colonyStatus().evacuating).not.toBe(first);
  });

  it("sin nave posada, los que llegan esperan en un anillo de la plataforma, sin pisar el centro", () => {
    const { w } = setup();
    stepAt(w, PREP_TICKS);
    w.shuttle.damage(cfg.health, w.match.elapsedTicks);
    // Menos de lo que tarda la de reemplazo: llegan los primeros y esperan.
    runQuiet(w, ticks(cfg.replacementSeconds) - 40);
    const before = new Map<number, Point>();
    w.crabs!.forEachColonist((c) => before.set(c.id, { x: c.x, z: c.z }));
    runQuiet(w, 10);
    // Los que ya no se mueven han llegado a su sitio (los demás aún cruzan la plataforma).
    const waiting: number[] = [];
    w.crabs!.forEachColonist((c) => {
      const b = before.get(c.id);
      if (b && Math.hypot(c.x - b.x, c.z - b.z) < 0.05)
        waiting.push(Math.hypot(c.x - pad.x, c.z - pad.z));
    });
    expect(waiting.length).toBeGreaterThan(0);
    for (const d of waiting) {
      expect(d).toBeLessThanOrEqual(pad.radius);
      expect(d).toBeGreaterThan(GAME_CONFIG.colonists.padInnerRadius - 1);
    }
    expect(w.shuttle.aboard).toBe(0);
  });

  it("en el modo de prueba (CRABS), las lanzaderas despegan igual", () => {
    world = new World({ ...MAP, dummies: [] }, nav);
    world.crabQuota = 5;
    const me = world.addSoldier();
    me.invulnerable = true;
    world.step();
    expect(stepAt(world, L1)).toContainEqual({ k: "launch", n: 1, boarded: 0 });
  });
});

describe("World: naves destructibles (#72)", () => {
  it("los rasos cerca de la plataforma muerden la nave", () => {
    const { w } = setup({ x: 60, z: -60 });
    stepAt(w, PREP_TICKS);
    w.spawnCrab({ x: pad.x + 12, z: pad.z });
    const events = runQuietKeepCrabs(w, 80);
    const bites = events.filter(
      (e) => e.k === "damage" && e.dst === w.shuttleId && e.by === "bite",
    );
    expect(bites.length).toBeGreaterThan(0);
    expect(w.shuttle.hp).toBeLessThan(cfg.health);
  });

  it("los escupidores también la atacan", () => {
    const { w } = setup({ x: 60, z: -60 });
    stepAt(w, PREP_TICKS);
    w.spawnCrab({ x: pad.x + 22, z: pad.z }, EntityKind.Spitter);
    const events = runQuietKeepCrabs(w, 200);
    expect(events.some((e) => e.k === "damage" && e.dst === w.shuttleId && e.by === "spit")).toBe(
      true,
    );
  });

  it("en la preparación nadie la ataca", () => {
    const { w } = setup({ x: 60, z: -60 });
    w.spawnCrab({ x: pad.x + 12, z: pad.z });
    const events = runQuietKeepCrabs(w, 80);
    expect(events.some((e) => e.k === "damage" && e.dst === w.shuttleId)).toBe(false);
  });

  it("una granada propia también la daña", () => {
    const { w, me } = setup({ x: pad.x, z: pad.z - 15 });
    stepAt(w, PREP_TICKS);
    w.queueInput(me.id, {
      seq: 0,
      forward: 0,
      strafe: 0,
      yaw: 0,
      ability: { id: AbilityId.Grenade, x: pad.x, z: pad.z - 7 },
    });
    runQuiet(w, ticks(GAME_CONFIG.abilities.grenade.fuseTime) + 2);
    expect(w.shuttle.hp).toBe(cfg.health - GAME_CONFIG.abilities.grenade.damage);
  });

  it("destruida, explota: mueren los de a bordo y hace daño en área, también a los derribados", () => {
    const { w, me } = setup({ x: 60, z: -60 });
    stepAt(w, PREP_TICKS);
    const near = w.addSoldier();
    near.state = { x: pad.x + 8, z: pad.z, yaw: 0 };
    const down = w.addSoldier();
    down.state = { x: pad.x - 8, z: pad.z, yaw: 0 };
    w["downSoldier"](down);
    const far = w.addSoldier();
    far.state = { x: pad.x, z: pad.z - cfg.explosion.radius - 5, yaw: 0 };
    w.shuttle.board(12);
    const crab = w.spawnCrab({ x: pad.x, z: pad.z + 10 })!;
    w.step();
    destroyShuttle(w);
    const events = w.events;
    expect(events).toContainEqual({ k: "shuttleDestroyed", n: 1, aboard: 12 });
    expect(events).toContainEqual({
      k: "explosion",
      src: w.shuttleId,
      x: pad.x,
      z: pad.z,
      radius: cfg.explosion.radius,
    });
    expect(near.downedUntil).not.toBeNull(); // 150 de daño: al suelo.
    expect(w.soldiers.has(down.id)).toBe(false); // El derribado muere.
    expect(events).toContainEqual({ k: "death", src: down.id, cause: "blast" });
    expect(far.hp).toBe(GAME_CONFIG.soldier.health);
    expect(w.crabs!.has(crab)).toBe(false);
    expect(me.hp).toBe(GAME_CONFIG.soldier.health);
    expect(w.shuttle.docked).toBe(false);
  });

  it("tras destruirla, la de reemplazo llega a los 45 s y sirve al viaje siguiente", () => {
    const { w } = setup({ x: 60, z: -60 });
    stepAt(w, PREP_TICKS);
    destroyShuttle(w);
    expect(w.shuttleStatus()).toMatchObject({ docked: false, trip: 2 });
    runQuiet(w, ticks(cfg.replacementSeconds) - 1);
    expect(w.shuttle.docked).toBe(false);
    runQuiet(w, 2);
    expect(w.shuttle.docked).toBe(true);
    // El viaje 1 se ha perdido: a su hora no despega nada.
    w.match.jumpTo(L1);
    w.director!.jumpTo(L1);
    w.step();
    expect(w.events.some((e) => e.k === "launch")).toBe(false);
    expect(w.shuttleStatus()).toMatchObject({ docked: true, trip: 2 });
  });
});

/** Avanza `n` ticks sin quitar centollos. */
function runQuietKeepCrabs(w: World, n: number): GameEvent[] {
  const all: GameEvent[] = [];
  for (let i = 0; i < n; i++) {
    w.step();
    all.push(...w.events);
  }
  return all;
}
