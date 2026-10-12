import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { GAME_CONFIG, MAP, TICK_SECONDS } from "@udc/shared";
import { buildNavMesh, type NavMap } from "../ai/navmesh.js";
import { PREP_TICKS } from "./match.js";
import { World } from "./world.js";

const DEFUNCT_TICKS = Math.round(GAME_CONFIG.soldier.defunctSeconds / TICK_SECONDS);

let nav: NavMap;
let world: World;
beforeAll(async () => {
  nav = await buildNavMesh(MAP);
});
afterAll(() => nav.destroy());
afterEach(() => world?.crabs?.destroy());

/** Pelotón de 8: un jugador y 7 bots. */
function squad() {
  world = new World({ ...MAP, dummies: [] }, nav);
  world.squadBots = true;
  const me = world.addHuman()!;
  return { world, me };
}

/** Avanza `n` ticks con los soldados inmortales. */
function run(w: World, n: number): void {
  for (let i = 0; i < n; i++) {
    w.step();
    for (const s of w.soldiers.values()) s.hp = GAME_CONFIG.soldier.health;
  }
}

/** Mata a todo el pelotón, como lo haría el enjambre. */
function wipe(w: World): void {
  for (const s of [...w.soldiers.values()]) w["killSoldier"](s, "time");
}

describe("World: fases de la partida (E6-1)", () => {
  it("en la preparación no sale ningún centollo; en la evacuación, sí", () => {
    const { world } = squad();
    run(world, PREP_TICKS - 1);
    expect(world.match.phase).toBe("prep");
    expect(world.crabs!.count).toBe(0);
    run(world, 200);
    expect(world.match.phase).toBe("evacuation");
    expect(world.crabs!.count).toBeGreaterThan(0);
  });

  it("al caer todo el pelotón, resultado: el director se para y no salen más centollos", () => {
    const { world } = squad();
    run(world, PREP_TICKS + 200);
    wipe(world);
    world.step();
    expect(world.match.phase).toBe("result");
    expect(world.director!.isRunning).toBe(false);
    expect(world.takeMatchStatus()).toMatchObject({ phase: "result" });
    const crabs = world.crabs!.count;
    run(world, 100);
    expect(world.crabs!.count).toBeLessThanOrEqual(crabs);
  });

  it("los jugadores muertos pasan a espectador y quien llega durante el resultado, también", () => {
    const { world, me } = squad();
    run(world, 10);
    wipe(world);
    run(world, DEFUNCT_TICKS);
    expect(world.takeReliefs()).toEqual([{ from: me.id, to: null }]);
    expect(world.addHuman()).toBeNull();
  });

  it("nueva partida: vuelve al principio y el primero que entra llega con 7 bots", () => {
    const { world } = squad();
    run(world, PREP_TICKS + 200);
    wipe(world);
    world.step();
    world.resetMatch();
    expect(world.match.phase).toBe("waiting");
    expect(world.crabs!.count).toBe(0);
    expect(world.soldiers.size).toBe(0);
    const me = world.addHuman()!;
    expect(me).not.toBeNull();
    expect(world.soldiers.size).toBe(GAME_CONFIG.match.maxPlayers);
    world.step();
    expect(world.match.phase).toBe("prep");
  });

  it("si el último jugador con soldado se va pero queda alguien conectado, la partida sigue con un bot", () => {
    const { world, me } = squad();
    run(world, 10);
    world.removeHuman(me.id, true);
    expect(world.soldiers.get(me.id)?.bot).not.toBeNull();
    world.step();
    expect(world.match.phase).toBe("prep");
    // Si no queda nadie, vuelve al principio.
    world.removeHuman(me.id, false);
    expect(world.soldiers.size).toBe(0);
    expect(world.match.phase).toBe("waiting");
  });
});
