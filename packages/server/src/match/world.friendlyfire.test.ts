import { describe, expect, it } from "vitest";
import { AbilityId, GAME_CONFIG, MAP, type MapData } from "@udc/shared";
import { ABILITY_TICKS } from "./abilities.js";
import { World } from "./world.js";

const { grenade } = GAME_CONFIG.abilities;
const { health } = GAME_CONFIG.soldier;
const open: MapData = { ...MAP, obstacles: [], dummies: [] };

/** Lanza una granada desde `me` al punto (x, z) y espera a que explote. */
function throwAndWait(world: World, meId: number, x: number, z: number): void {
  world.queueInput(meId, {
    seq: 0,
    forward: 0,
    strafe: 0,
    yaw: 0,
    ability: { id: AbilityId.Grenade, x, z },
  });
  for (let i = 0; i <= ABILITY_TICKS.grenadeFuse; i++) world.step();
}

describe("World: fuego amigo de la granada (E3-6)", () => {
  it("daña a los aliados y a quien la lanza dentro del radio; fuera del radio, no", () => {
    const world = new World(open);
    const me = world.addSoldier();
    const near = world.addSoldier();
    const far = world.addSoldier();
    me.state = { x: 0, z: 0, yaw: 0 };
    near.state = { x: 2, z: 5, yaw: 0 };
    far.state = { x: 0, z: 5 + grenade.radius + 1, yaw: 0 };
    throwAndWait(world, me.id, 0, 3);
    expect(me.hp).toBe(health - grenade.damage);
    expect(near.hp).toBe(health - grenade.damage);
    expect(far.hp).toBe(health);
    const hits = world.events.filter((e) => e.k === "damage" && e.by === "grenade");
    expect(hits.map((e) => e.k === "damage" && e.dst).sort()).toEqual([me.id, near.id].sort());
  });

  it("los obstáculos cubren también a los soldados", () => {
    const wall = { id: "m", kind: "wall" as const, x: 0, z: 5, w: 6, d: 0.5, h: 3, rot: 0 };
    const world = new World({ ...open, obstacles: [wall] });
    const me = world.addSoldier();
    const covered = world.addSoldier();
    me.state = { x: 0, z: 0, yaw: 0 };
    covered.state = { x: 0, z: 6.5, yaw: 0 };
    throwAndWait(world, me.id, 0, 3.5);
    expect(covered.hp).toBe(health);
  });

  it("no daña a un soldado invulnerable", () => {
    const world = new World(open);
    world.adminEnabled = true;
    const me = world.addSoldier();
    me.state = { x: 0, z: 0, yaw: 0 };
    world.admin(me.id, "invulnerable");
    throwAndWait(world, me.id, 0, 1);
    expect(me.hp).toBe(health);
  });

  it("el fuego automático atraviesa a un aliado en la línea de tiro sin dañarlo", () => {
    const world = new World({ ...open, dummies: [{ x: 0, z: 20 }] });
    const me = world.addSoldier();
    const ally = world.addSoldier();
    me.state = { x: 0, z: 0, yaw: 0 };
    ally.state = { x: 0, z: 10, yaw: 0 };
    const dummy = [...world.dummies.values()][0]!;
    world.setTarget(me.id, dummy.id);
    for (let i = 0; i < 40; i++) world.step();
    expect(dummy.hp).toBeLessThan(GAME_CONFIG.dummy.health);
    expect(ally.hp).toBe(health);
  });
});
