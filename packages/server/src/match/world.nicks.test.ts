import { describe, expect, it } from "vitest";
import { EntityKind, GAME_CONFIG, MAP, TICK_SECONDS, type MapData } from "@udc/shared";
import { World, type SentCache } from "./world.js";

const DEFUNCT_TICKS = Math.round(GAME_CONFIG.soldier.defunctSeconds / TICK_SECONDS);
const open: MapData = { ...MAP, obstacles: [], dummies: [] };

function squad() {
  const world = new World(open);
  world.squadBots = true;
  const me = world.addHuman("rulo")!;
  return { world, me };
}

describe("World: apodos sobre los jugadores (E2-5)", () => {
  it("el soldado de cada jugador viaja con su apodo; los bots, sin nada", () => {
    const { world, me } = squad();
    const other = world.addHuman("ana")!;
    const added = world.buildSnapshot(me.id, new Map() as SentCache).added;
    const soldiers = added.filter((e) => e.kind === EntityKind.Soldier);
    expect(soldiers.find((e) => e.id === other.id)?.nick).toBe("ana");
    for (const bot of soldiers.filter((e) => e.bot)) expect(bot).not.toHaveProperty("nick");
  });

  it("quien llega tarde releva a un bot y el evento de control lleva su apodo", () => {
    const { world } = squad();
    const other = world.addHuman("ana")!;
    world.step();
    expect(world.events).toContainEqual({ k: "control", src: other.id, bot: false, nick: "ana" });
    expect(other.nick).toBe("ana");
  });

  it("si se desconecta, su soldado vuelve a ser bot y pierde el apodo", () => {
    const { world } = squad();
    const other = world.addHuman("ana")!;
    world.step();
    world.removeHuman(other.id, true);
    world.step();
    expect(other.nick).toBeNull();
    expect(world.events).toContainEqual({ k: "control", src: other.id, bot: true });
  });

  it("al morir, el apodo pasa al bot que releva", () => {
    const { world, me } = squad();
    world["killSoldier"](me, "time");
    for (let i = 0; i < DEFUNCT_TICKS; i++) world.step();
    const [relief] = world.takeReliefs();
    const body = world.soldiers.get(relief!.to!)!;
    expect(body.nick).toBe("rulo");
    expect(world.events).toContainEqual({ k: "control", src: body.id, bot: false, nick: "rulo" });
  });
});
