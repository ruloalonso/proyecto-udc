import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  AbilityId,
  BurrowState,
  GAME_CONFIG,
  MAP,
  TICK_SECONDS,
  type GameEvent,
} from "@udc/shared";
import { buildNavMesh, type NavMap } from "../ai/navmesh.js";
import { World } from "./world.js";

const cfg = GAME_CONFIG.director;
const ticks = (seconds: number) => Math.round(seconds / TICK_SECONDS);
const north = MAP.burrows.findIndex((b) => b.id === "norte");

let nav: NavMap;
let world: World;
beforeAll(async () => {
  nav = await buildNavMesh(MAP);
});
afterAll(() => nav.destroy());
afterEach(() => world?.crabs?.destroy());

function setup(): World {
  world = new World({ ...MAP, dummies: [] }, nav);
  return world;
}

/** Avanza `n` ticks con los soldados inmortales. Devuelve los eventos. */
function run(w: World, n: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < n; i++) {
    w.step();
    for (const s of w.soldiers.values()) s.hp = GAME_CONFIG.soldier.health;
    events.push(...w.events);
  }
  return events;
}

describe("World: director de oleadas", () => {
  it("empieza con el primer soldado: calma y luego centollos por las madrigueras abiertas", () => {
    const w = setup();
    run(w, 10);
    expect(w.director!.isRunning).toBe(false);

    w.addSoldier();
    run(w, ticks(GAME_CONFIG.match.prepSeconds) - 1);
    expect(w.crabs!.count).toBe(0);
    run(w, ticks(10));
    expect(w.crabs!.count).toBeGreaterThan(0);

    const open = w.directorStatus()!.burrows.flatMap((s, i) => (s === BurrowState.Open ? [i] : []));
    expect(open).toHaveLength(cfg.initialBurrows);
  });

  it("una granada sobre una madriguera abierta la tapona", () => {
    const w = setup();
    const me = w.addSoldier();
    run(w, ticks(GAME_CONFIG.match.prepSeconds));
    expect(w.directorStatus()!.burrows[north]).toBe(BurrowState.Open);

    // A 12 m de la madriguera norte, mirando hacia ella; la granada cae en su centro.
    const b = MAP.burrows[north]!;
    me.state = { x: b.x, z: b.z - 12, yaw: 0 };
    w.queueInput(me.id, {
      seq: 0,
      forward: 0,
      strafe: 0,
      yaw: 0,
      ability: { id: AbilityId.Grenade, x: b.x, z: b.z },
    });
    const events = run(w, ticks(GAME_CONFIG.abilities.grenade.fuseTime) + 1);
    expect(events).toContainEqual({ k: "burrow", burrow: north, state: BurrowState.Plugged });
    expect(w.directorStatus()!.burrows[north]).toBe(BurrowState.Plugged);
  });

  it("al irse el último soldado se reinicia: sin centollos y todo cerrado", () => {
    const w = setup();
    const me = w.addSoldier();
    run(w, ticks(GAME_CONFIG.match.prepSeconds + 10));
    expect(w.crabs!.count).toBeGreaterThan(0);

    w.removeHuman(me.id);
    run(w, 1);
    expect(w.director!.isRunning).toBe(false);
    expect(w.crabs!.count).toBe(0);
    expect(w.directorStatus()!.burrows.every((s) => s === BurrowState.Closed)).toBe(true);
  });

  it("el estado solo se manda cuando cambia", () => {
    const w = setup();
    w.addSoldier();
    run(w, 1);
    expect(w.takeDirectorStatus()).not.toBeNull();
    run(w, 1);
    expect(w.takeDirectorStatus()).toBeNull();
    // Al empezar el aviso de las primeras madrigueras, cambia.
    let changed = false;
    for (let i = 0; i < ticks(GAME_CONFIG.match.prepSeconds) && !changed; i++) {
      run(w, 1);
      changed = w.takeDirectorStatus() !== null;
    }
    expect(changed).toBe(true);
  });

  it("en el modo de prueba (CRABS) el director no actúa", () => {
    const w = setup();
    w.crabQuota = 5;
    w.addSoldier();
    const events = run(w, ticks(GAME_CONFIG.match.prepSeconds) + 5);
    expect(w.director!.isRunning).toBe(false);
    expect(events.some((e) => e.k === "burrow")).toBe(false);
    expect(w.crabs!.count).toBe(5);
  });
});
