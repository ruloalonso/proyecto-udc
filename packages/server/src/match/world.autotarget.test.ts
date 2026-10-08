import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GAME_CONFIG, MAP, TICK_SECONDS, type DamageEvent, type MapData } from "@udc/shared";
import { buildNavMesh, type NavMap } from "../ai/navmesh.js";
import { World } from "./world.js";

const AUTO_SELECT_TICKS = Math.round(GAME_CONFIG.targeting.autoSelectDelay / TICK_SECONDS);

/** Muñecos en (0, 24) y (0, 18), sin obstáculos; el soldado en (0, 28) mirando al sur. */
const map: MapData = {
  ...MAP,
  obstacles: [],
  dummies: [
    { x: 0, z: 24 },
    { x: 0, z: 18 },
  ],
};

function setup() {
  const world = new World(map);
  const me = world.addSoldier();
  me.state = { x: 0, z: 28, yaw: Math.PI };
  const [near, far] = [...world.dummies.values()];
  const steps = (n: number) => {
    for (let i = 0; i < n; i++) world.step();
  };
  return { world, me, near: near!, far: far!, steps };
}

describe("World: selección automática (E3-5)", () => {
  it(`sin objetivo, elige el más cercano de frente a los ${AUTO_SELECT_TICKS} ticks, no antes`, () => {
    const { me, near, steps } = setup();
    steps(AUTO_SELECT_TICKS - 1);
    expect(me.targetId).toBeNull();
    steps(1);
    expect(me.targetId).toBe(near.id);
  });

  it("no elige lo que no tiene delante; en cuanto se encara, sí, sin más espera", () => {
    const { me, near, steps } = setup();
    me.state = { ...me.state, yaw: 0 }; // De espaldas a los muñecos.
    steps(AUTO_SELECT_TICKS * 3);
    expect(me.targetId).toBeNull();
    me.state = { ...me.state, yaw: Math.PI };
    steps(1);
    expect(me.targetId).toBe(near.id);
  });

  it("respeta el objetivo elegido a mano aunque haya otro más cerca", () => {
    const { world, me, far, steps } = setup();
    world.setTarget(me.id, far.id);
    me.nextShotTick = Number.POSITIVE_INFINITY; // Que no muera durante la prueba.
    steps(AUTO_SELECT_TICKS * 4);
    expect(me.targetId).toBe(far.id);
  });

  it("un objetivo automático al que ya no se puede disparar se cambia tras el retardo", () => {
    const { me, near, far, steps } = setup();
    steps(AUTO_SELECT_TICKS);
    expect(me.targetId).toBe(near.id);
    me.nextShotTick = Number.POSITIVE_INFINITY; // Que no muera ninguno.
    // El cercano se pone a la espalda del soldado: fuera del cono.
    near.z = 32;
    steps(AUTO_SELECT_TICKS);
    expect(me.targetId).toBe(near.id);
    steps(1);
    expect(me.targetId).toBe(far.id);
  });

  it("si no hay otro de frente, se queda con el que tenía", () => {
    const { world, me, near, far, steps } = setup();
    steps(AUTO_SELECT_TICKS);
    me.nextShotTick = Number.POSITIVE_INFINITY;
    world.dummies.delete(far.id);
    near.z = 32;
    steps(AUTO_SELECT_TICKS * 4);
    expect(me.targetId).toBe(near.id);
  });

  it("uno elegido a mano se respeta aunque ya no se le pueda disparar", () => {
    const { world, me, near, steps } = setup();
    world.setTarget(me.id, near.id);
    me.nextShotTick = Number.POSITIVE_INFINITY;
    near.z = 32;
    steps(AUTO_SELECT_TICKS * 4);
    expect(me.targetId).toBe(near.id);
  });

  it("respeta el objetivo automático aunque aparezca otro más cerca", () => {
    const { me, near, far, steps } = setup();
    steps(AUTO_SELECT_TICKS);
    me.nextShotTick = Number.POSITIVE_INFINITY;
    far.z = 26; // Ahora el otro está más cerca, y también de frente.
    steps(AUTO_SELECT_TICKS * 4);
    expect(me.targetId).toBe(near.id);
  });

  it("elegir a mano cambia el objetivo al momento", () => {
    const { world, me, near, far, steps } = setup();
    steps(AUTO_SELECT_TICKS);
    expect(me.targetId).toBe(near.id);
    world.setTarget(me.id, far.id);
    expect(me.targetId).toBe(far.id);
  });

  it("cuando muere el objetivo, elige otro tras el retardo", () => {
    const { world, me, near, far, steps } = setup();
    steps(AUTO_SELECT_TICKS);
    near.hp = 1; // El siguiente disparo lo mata.
    for (let i = 0; i < 40 && world.dummies.has(near.id); i++) world.step();
    expect(world.dummies.has(near.id)).toBe(false);
    // El retardo cuenta desde el tick en que murió.
    steps(AUTO_SELECT_TICKS - 1);
    expect(me.targetId).toBeNull();
    steps(1);
    expect(me.targetId).toBe(far.id);
  });

  it("Escape quita el objetivo y, si hay alguno de frente, vuelve a elegir tras el retardo", () => {
    const { world, me, near, steps } = setup();
    steps(AUTO_SELECT_TICKS);
    world.setTarget(me.id, null);
    expect(me.targetId).toBeNull();
    steps(AUTO_SELECT_TICKS - 1);
    expect(me.targetId).toBeNull();
    steps(1);
    expect(me.targetId).toBe(near.id);
  });

  it("el snapshot propio lleva el objetivo del servidor", () => {
    const { world, me, near, steps } = setup();
    expect(world.buildSnapshot(me.id, new Map()).you?.target).toBeNull();
    steps(AUTO_SELECT_TICKS);
    expect(world.buildSnapshot(me.id, new Map()).you?.target).toBe(near.id);
  });
});

describe("World: selección automática contra centollos", () => {
  let nav: NavMap;
  beforeAll(async () => {
    nav = await buildNavMesh(MAP);
  });
  afterAll(() => nav.destroy());

  it("contra la masa no hace falta pulsar Tab para seguir disparando", () => {
    const world = new World({ ...MAP, dummies: [] }, nav);
    const me = world.addSoldier();
    // Al sur de la plataforma, mirando hacia ella: allí se amontonan los que no tienen hueco
    // para morderle, y los otros tres vienen a por él.
    me.state = { x: 0, z: 25, yaw: 0 };
    for (let i = 0; i < 40; i++) world.spawnCrab({ x: (i % 8) - 4, z: 50 + Math.floor(i / 8) });

    const shots: DamageEvent[] = [];
    for (let t = 0; t < 30 / TICK_SECONDS; t++) {
      world.step();
      me.hp = GAME_CONFIG.soldier.health; // Inmortal durante la prueba.
      for (const e of world.events) {
        if (e.k === "damage" && e.src === me.id && e.by === "auto") shots.push(e);
      }
    }
    const killed = new Set(shots.map((e) => e.dst).filter((id) => world.kindOf(id) === null));
    // Sin ningún mensaje `target`: dispara casi sin parar y va abatiendo uno tras otro.
    const maxShots = 30 / GAME_CONFIG.combat.autoFire.interval;
    expect(shots.length).toBeGreaterThan(maxShots * 0.6);
    expect(killed.size).toBeGreaterThanOrEqual(5);
    world.crabs?.destroy();
  });
});
