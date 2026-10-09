import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { GAME_CONFIG, MAP, type GameEvent, type Point } from "@udc/shared";
import { buildNavMesh, type NavMap } from "../ai/navmesh.js";
import { FINAL_TICK, LAUNCH_TICKS, PREP_TICKS } from "./match.js";
import { World } from "./world.js";

const pad = MAP.landingPad;
const [L1] = LAUNCH_TICKS as [number];

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
  world.step();
  return { w: world, me };
}

/** Avanza hasta el tick `t` de la partida (el siguiente paso es `t`) y lo da. */
function stepAt(w: World, t: number): GameEvent[] {
  w.match.jumpTo(t);
  w.director!.jumpTo(t);
  w.step();
  return w.events;
}

function colonistIds(w: World): number[] {
  const ids: number[] = [];
  w.crabs!.forEachColonist((c) => ids.push(c.id));
  return ids;
}

describe("World: lanzaderas (E6-3)", () => {
  it("al despegar embarcan los colonos de la plataforma; los de fuera esperan a la siguiente", () => {
    const { w } = setup();
    const onPad = [10_000, 10_001, 10_002];
    onPad.forEach((id, i) => {
      const at = { x: pad.x + i * 2 - 2, z: pad.z + 6 };
      w.crabs!.spawnColonist(id, at, at);
    });
    const outside = { x: pad.x, z: pad.z - pad.radius - 6 };
    w.crabs!.spawnColonist(10_003, outside, outside);

    const events = stepAt(w, L1);
    expect(events).toContainEqual({ k: "launch", n: 1, boarded: 3 });
    expect(colonistIds(w)).toEqual([10_003]);
    expect(w.matchStatus()).toMatchObject({ launches: 1, saved: 3 });
  });

  it("una lanzadera que despega vacía también cuenta", () => {
    const { w } = setup();
    expect(stepAt(w, L1)).toContainEqual({ k: "launch", n: 1, boarded: 0 });
    expect(w.matchStatus()).toMatchObject({ launches: 1, saved: 0 });
  });

  it("la última abre la oleada final; después los edificios ni se activan ni sueltan a nadie", () => {
    const door = MAP.routes[0]!.exit;
    const { w } = setup(door);
    const events = stepAt(w, FINAL_TICK);
    expect(events).toContainEqual({
      k: "launch",
      n: GAME_CONFIG.shuttles.launches.length,
      boarded: 0,
    });
    expect(events).toContainEqual({ k: "finalWave" });
    for (let i = 0; i < 40; i++) w.step();
    expect(w.colonyStatus().buildings[0]).toBeNull();
    expect(w.crabs!.colonistCount).toBe(0);
  });

  it("los colonos esperan en un anillo, sin pisar el centro donde se posa la lanzadera", () => {
    const door = MAP.routes[3]!.exit;
    const { w } = setup(door);
    stepAt(w, PREP_TICKS); // Empieza la evacuación: activa el edificio y salen los primeros.
    // 60 s sin centollos: llegan los primeros grupos.
    for (let i = 0; i < 1200; i++) {
      w.step();
      const crabs: number[] = [];
      w.crabs!.forEach((c) => crabs.push(c.id));
      crabs.forEach((id) => w.crabs!.remove(id));
    }
    const near: number[] = [];
    w.crabs!.forEachColonist((c) => near.push(Math.hypot(c.x - pad.x, c.z - pad.z)));
    expect(near.length).toBeGreaterThan(0);
    const arrived = near.filter((d) => d <= pad.radius);
    expect(arrived.length).toBeGreaterThan(0);
    for (const d of arrived) {
      expect(d).toBeGreaterThan(GAME_CONFIG.colonists.padInnerRadius - 1);
    }
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
