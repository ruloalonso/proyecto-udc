import { describe, expect, it } from "vitest";
import { GAME_CONFIG, MAP, TICK_SECONDS, type MapData } from "@udc/shared";
import { World } from "./world.js";

const { soldier } = GAME_CONFIG;
const DEFUNCT_TICKS = Math.round(soldier.defunctSeconds / TICK_SECONDS);
const open: MapData = { ...MAP, obstacles: [], dummies: [] };

/** Mata a un soldado como lo haría un remate o el tiempo. */
function kill(world: World, id: number): void {
  world["killSoldier"](world.soldiers.get(id)!, "time");
}

function squad() {
  const world = new World(open);
  world.squadBots = true;
  const me = world.addHuman()!;
  const bots = [...world.soldiers.values()].filter((s) => s.bot);
  return { world, me, bots };
}

describe("World: defunción y relevo (E5-4)", () => {
  it("al morir, el soldado desaparece para siempre (sin reaparición)", () => {
    const { world, me } = squad();
    kill(world, me.id);
    expect(world.soldiers.has(me.id)).toBe(false);
    expect(world.events).toContainEqual({ k: "death", src: me.id, cause: "time" });
  });

  it(`tras ${soldier.defunctSeconds} s de defunción, el jugador releva a un bot en pie`, () => {
    const { world, me, bots } = squad();
    bots[0]!.downedUntil = 9999; // Un bot derribado no vale.
    kill(world, me.id);
    for (let i = 0; i < DEFUNCT_TICKS - 1; i++) world.step();
    expect(world.takeReliefs()).toEqual([]);
    world.step();
    const [relief] = world.takeReliefs();
    expect(relief?.from).toBe(me.id);
    expect(relief?.to).not.toBe(bots[0]!.id);
    const taken = world.soldiers.get(relief!.to!)!;
    expect(taken.bot).toBeNull();
    expect(world.events).toContainEqual({ k: "control", src: taken.id, bot: false });
  });

  it("si no queda ningún bot en pie, pasa a espectador", () => {
    const { world, me, bots } = squad();
    for (const b of bots) b.downedUntil = 9999;
    kill(world, me.id);
    for (let i = 0; i < DEFUNCT_TICKS; i++) world.step();
    expect(world.takeReliefs()).toEqual([{ from: me.id, to: null }]);
  });

  it("un bot que muere desaparece sin relevo: el pelotón pierde un fusil", () => {
    const { world, bots } = squad();
    const before = world.soldiers.size;
    kill(world, bots[0]!.id);
    for (let i = 0; i < DEFUNCT_TICKS + 1; i++) world.step();
    expect(world.soldiers.size).toBe(before - 1);
    expect(world.takeReliefs()).toEqual([]);
  });
});
