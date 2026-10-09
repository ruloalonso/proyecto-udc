import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  AbilityId,
  EntityKind,
  GAME_CONFIG,
  MAP,
  stepMovement,
  TICK_SECONDS,
  type MapData,
  type GameEvent,
} from "@udc/shared";
import { buildNavMesh, type NavMap } from "../ai/navmesh.js";
import { AUTO_FIRE_INTERVAL_TICKS } from "./combat.js";
import { World, type SentCache } from "./world.js";

const { soldier } = GAME_CONFIG;
const DOWNED_TICKS = Math.round(soldier.downed.seconds / TICK_SECONDS);
const DOWNED_FIRE_TICKS = Math.round(AUTO_FIRE_INTERVAL_TICKS * soldier.downed.fireIntervalFactor);
const open: MapData = { ...MAP, obstacles: [], dummies: [] };

/** Deja al soldado a 0 de vida con un golpe. */
function knockDown(world: World, id: number): void {
  const s = world.soldiers.get(id)!;
  s.hp = 1;
  world["applyDamage"]({ k: "damage", src: 0, dst: id, amount: 10, by: "bite" });
}

describe("World: derribado (E5-1)", () => {
  it("a 0 de vida cae derribado: evento, marca en el movimiento y cuenta atrás en el snapshot", () => {
    const world = new World(open);
    const me = world.addSoldier();
    knockDown(world, me.id);
    expect(me.hp).toBe(0);
    expect(me.state.downed).toBe(true);
    expect(world.events).toContainEqual({ k: "downed", src: me.id, ticks: DOWNED_TICKS });
    const you = world.buildSnapshot(me.id, new Map()).you!;
    expect(you.downed).toBe(true);
    expect(you.downedTicks).toBe(DOWNED_TICKS);
  });

  it("derribado no recibe más daño", () => {
    const world = new World(open);
    const me = world.addSoldier();
    knockDown(world, me.id);
    world.events = [];
    world["applyDamage"]({ k: "damage", src: 0, dst: me.id, amount: 50, by: "bite" });
    expect(me.hp).toBe(0);
    expect(world.events).toHaveLength(0);
  });

  it("se arrastra a la velocidad de arrastre, igual que predice el cliente", () => {
    const world = new World(open);
    const me = world.addSoldier();
    me.state = { x: 0, z: 0, yaw: 0 };
    knockDown(world, me.id);
    let predicted = me.state;
    for (let seq = 0; seq < 20; seq++) {
      const input = { seq, forward: 1, strafe: 0, yaw: 0 };
      world.queueInput(me.id, input);
      predicted = stepMovement(predicted, input, open);
      world.step();
    }
    expect(me.state.z).toBeCloseTo(20 * soldier.downed.crawlSpeed * TICK_SECONDS);
    expect(me.state).toEqual(predicted);
  });

  it("no usa habilidades", () => {
    const world = new World(open);
    const me = world.addSoldier();
    knockDown(world, me.id);
    world.queueInput(me.id, {
      seq: 0,
      forward: 0,
      strafe: 0,
      yaw: 0,
      ability: { id: AbilityId.Stim },
    });
    world.step();
    expect(me.hp).toBe(0);
    expect(world.events.some((e) => e.k === "stim")).toBe(false);
  });

  it("dispara con fuego lento si está quieto; arrastrándose, no dispara", () => {
    const world = new World({ ...open, dummies: [{ x: 0, z: 10 }] });
    const me = world.addSoldier();
    me.state = { x: 0, z: 0, yaw: 0 };
    const dummy = [...world.dummies.values()][0]!;
    dummy.hp = 10_000;
    world.setTarget(me.id, dummy.id);
    knockDown(world, me.id);

    const shotTicks: number[] = [];
    for (let i = 0; i < DOWNED_FIRE_TICKS * 3; i++) {
      world.step();
      if (world.events.some((e) => e.k === "damage" && e.src === me.id)) shotTicks.push(world.tick);
    }
    expect(shotTicks.length).toBeGreaterThanOrEqual(2);
    expect(shotTicks[1]! - shotTicks[0]!).toBe(DOWNED_FIRE_TICKS);

    let shotsWhileCrawling = 0;
    for (let seq = 0; seq < DOWNED_FIRE_TICKS * 3; seq++) {
      world.queueInput(me.id, { seq, forward: -1, strafe: 0, yaw: 0 });
      world.step();
      shotsWhileCrawling += world.events.filter((e) => e.k === "damage" && e.src === me.id).length;
    }
    expect(shotsWhileCrawling).toBe(0);
  });

  it("arrastrándose no dispara aunque haya ticks sin entradas (jitter de la red)", () => {
    const world = new World({ ...open, dummies: [{ x: 0, z: 10 }] });
    const me = world.addSoldier();
    me.state = { x: 0, z: 0, yaw: 0 };
    const dummy = [...world.dummies.values()][0]!;
    dummy.hp = 10_000;
    world.setTarget(me.id, dummy.id);
    knockDown(world, me.id);
    let shots = 0;
    let seq = 0;
    for (let i = 0; i < DOWNED_FIRE_TICKS * 4; i++) {
      // Llega una entrada (arrastrándose hacia atrás) cada tres ticks; en los otros, ninguna.
      if (i % 3 === 0) world.queueInput(me.id, { seq: seq++, forward: -1, strafe: 0, yaw: 0 });
      world.step();
      shots += world.events.filter((e) => e.k === "damage" && e.src === me.id).length;
    }
    expect(shots).toBe(0);
    // Al soltar (llega una entrada quieta), vuelve a disparar.
    world.queueInput(me.id, { seq: seq++, forward: 0, strafe: 0, yaw: 0 });
    for (let i = 0; i < DOWNED_FIRE_TICKS + 1; i++) {
      world.step();
      shots += world.events.filter((e) => e.k === "damage" && e.src === me.id).length;
    }
    expect(shots).toBeGreaterThan(0);
  });

  it("los demás le ven con vida 0", () => {
    const world = new World(open);
    const me = world.addSoldier();
    const other = world.addSoldier();
    const sent: SentCache = new Map();
    world.buildSnapshot(me.id, sent);
    knockDown(world, other.id);
    expect(world.buildSnapshot(me.id, sent).hp).toEqual([other.id, 0]);
  });

  it(`a los ${soldier.downed.seconds} s sin rescate muere`, () => {
    const world = new World(open);
    const me = world.addSoldier();
    knockDown(world, me.id);
    for (let i = 0; i < DOWNED_TICKS - 1; i++) world.step();
    expect(me.state.downed).toBe(true);
    world.step();
    expect(world.events).toContainEqual({ k: "death", src: me.id, cause: "time" });
    // Sin reaparición (E5-4): el soldado desaparece del mundo.
    expect(world.soldiers.has(me.id)).toBe(false);
  });
});

describe("World: sin remate (E5-3, #70)", () => {
  let nav: NavMap;
  let world: World;
  beforeAll(async () => {
    nav = await buildNavMesh(MAP);
  });
  afterAll(() => nav.destroy());
  afterEach(() => world?.crabs?.destroy());

  /** Un derribado en (0, 40) mirando al norte (no dispara a lo que llega del sur). */
  function setup() {
    world = new World({ ...MAP, dummies: [] }, nav);
    const down = world.addSoldier();
    down.state = { x: 0, z: 40, yaw: 0 };
    down.nextShotTick = Number.POSITIVE_INFINITY;
    knockDown(world, down.id);
    return down;
  }

  it("sin remate (#70): los rasos no atacan al derribado, ni le muerden ni le matan", () => {
    const down = setup();
    world.spawnCrab({ x: 0, z: 36 });
    for (let t = 0; t < 200; t++) {
      world.step();
      for (const e of world.events) {
        expect(e.k === "damage" && e.dst === down.id).toBe(false);
        expect(e.k === "death").toBe(false);
      }
    }
    expect(down.state.downed).toBe(true);
  });

  it("los escupidores tampoco", () => {
    const down = setup();
    world.spawnCrab({ x: 0, z: 30 }, EntityKind.Spitter);
    for (let t = 0; t < 200; t++) {
      world.step();
      for (const e of world.events) expect(e.k === "damage" && e.dst === down.id).toBe(false);
    }
    expect(down.state.downed).toBe(true);
  });

  it("si su objetivo cae derribado, el raso busca a otro en pie", () => {
    world = new World({ ...MAP, dummies: [] }, nav);
    const first = world.addSoldier();
    const second = world.addSoldier();
    first.state = { x: 0, z: 40, yaw: 0 };
    second.state = { x: 3, z: 41, yaw: 0 };
    first.nextShotTick = second.nextShotTick = Number.POSITIVE_INFINITY;
    world.spawnCrab({ x: 0, z: 36 });
    let bitten = false;
    for (let t = 0; t < 200 && !bitten; t++) {
      world.step();
      bitten = world.events.some((e) => e.k === "damage" && e.by === "bite" && e.dst === first.id);
    }
    expect(bitten).toBe(true);
    knockDown(world, first.id);
    const events: GameEvent[] = [];
    for (let t = 0; t < 100; t++) {
      world.step();
      events.push(...world.events);
    }
    expect(events.some((e) => e.k === "damage" && e.by === "bite" && e.dst === first.id)).toBe(
      false,
    );
    expect(events.some((e) => e.k === "damage" && e.by === "bite" && e.dst === second.id)).toBe(
      true,
    );
  });
});

describe("World: la granada mata al derribado (E5-3)", () => {
  it("una granada aliada sobre un derribado lo mata", () => {
    const world = new World(open);
    const me = world.addSoldier();
    const down = world.addSoldier();
    me.state = { x: 0, z: 0, yaw: 0 };
    down.state = { x: 0, z: 8, yaw: 0 };
    knockDown(world, down.id);
    world.queueInput(me.id, {
      seq: 0,
      forward: 0,
      strafe: 0,
      yaw: 0,
      ability: { id: AbilityId.Grenade, x: 0, z: 8 },
    });
    const events = [];
    for (let i = 0; i < 40; i++) {
      world.step();
      events.push(...world.events);
    }
    expect(events).toContainEqual({ k: "death", src: down.id, cause: "grenade" });
  });
});
