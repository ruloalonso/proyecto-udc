import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { EntityKind, GAME_CONFIG, MAP, type GameEvent } from "@udc/shared";
import { buildNavMesh, type NavMap } from "../ai/navmesh.js";
import { World, type SentCache } from "./world.js";

const SQUAD = GAME_CONFIG.match.maxPlayers;

let nav: NavMap;
let world: World;
beforeAll(async () => {
  nav = await buildNavMesh(MAP);
});
afterAll(() => nav.destroy());
afterEach(() => world?.crabs?.destroy());

function setup(): World {
  world = new World({ ...MAP, dummies: [] }, nav);
  world.squadBots = true;
  return world;
}

const bots = (w: World) => [...w.soldiers.values()].filter((s) => s.bot);

describe("World: pelotón completado con bots (E5-6)", () => {
  it(`el primer jugador llega con ${SQUAD - 1} bots`, () => {
    const w = setup();
    const me = w.addHuman()!;
    expect(me.bot).toBeNull();
    expect(w.soldiers.size).toBe(SQUAD);
    expect(bots(w)).toHaveLength(SQUAD - 1);
    expect(w.humanCount).toBe(1);
  });

  it("el siguiente releva a un bot en pie, que conserva su estado; el pelotón sigue en 8", () => {
    const w = setup();
    w.addHuman();
    const [downed, standing] = bots(w);
    downed!.downedUntil = 999;
    standing!.state = { ...standing!.state, x: 12, z: 34 };
    standing!.hp = 70;
    standing!.lastQueuedSeq = 500;

    const second = w.addHuman()!;
    expect(second.id).toBe(standing!.id);
    expect(second.bot).toBeNull();
    expect(second.state.x).toBe(12);
    expect(second.hp).toBe(70);
    expect(w.soldiers.size).toBe(SQUAD);
    expect(w.humanCount).toBe(2);
    // Acepta la numeración del cliente nuevo, desde cero.
    w.queueInput(second.id, { seq: 0, forward: 1, strafe: 0, yaw: 0 });
    expect(second.inputs).toHaveLength(1);
  });

  it("el relevo se anuncia en el siguiente tick, y los bots viajan marcados en el snapshot", () => {
    const w = setup();
    const me = w.addHuman()!;
    const added = w.buildSnapshot(me.id, new Map() as SentCache).added;
    const soldiers = added.filter((e) => e.kind === EntityKind.Soldier);
    expect(soldiers).toHaveLength(SQUAD - 1);
    expect(soldiers.every((e) => e.bot)).toBe(true);

    const second = w.addHuman()!;
    w.step();
    expect(w.events).toContainEqual({ k: "control", src: second.id, bot: false });
  });

  it("al irse un jugador, su soldado pasa a ser bot; al irse el último, no queda nadie", () => {
    const w = setup();
    const a = w.addHuman()!;
    const b = w.addHuman()!;
    w.removeHuman(b.id);
    expect(w.soldiers.get(b.id)?.bot).not.toBeNull();
    expect(w.soldiers.size).toBe(SQUAD);
    w.removeHuman(a.id);
    expect(w.soldiers.size).toBe(0);
  });

  it("con la partida en marcha y ningún bot en pie, el que llega entra de espectador (E5-5)", () => {
    const w = setup();
    w.addHuman();
    for (const b of bots(w)) b.downedUntil = 9999;
    expect(w.addHuman()).toBeNull();
    expect(w.humanCount).toBe(1);
  });

  it(`con ${SQUAD} jugadores el pelotón está lleno`, () => {
    const w = setup();
    for (let i = 0; i < SQUAD; i++) w.addHuman();
    expect(bots(w)).toHaveLength(0);
    expect(w.isFull).toBe(true);
  });

  it("los bots combaten solos", () => {
    const w = setup();
    w.crabQuota = 20;
    const me = w.addHuman()!;
    me.invulnerable = true;
    const botIds = new Set(bots(w).map((s) => s.id));
    const events: GameEvent[] = [];
    for (let t = 0; t < 600; t++) {
      w.step();
      events.push(...w.events);
    }
    const botShots = events.filter((e) => e.k === "damage" && botIds.has(e.src));
    expect(botShots.length).toBeGreaterThan(20);
  });
});
