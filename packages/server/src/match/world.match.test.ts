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

  it("en el resultado, pasado el clímax, se retiran los centollos (nadie los ve y costaban CPU)", () => {
    const { world } = squad();
    run(world, PREP_TICKS + 400);
    expect(world.crabs!.count).toBeGreaterThan(0);
    wipe(world);
    world.step();
    // Durante el clímax siguen ahí.
    run(world, Math.round(GAME_CONFIG.match.climax.seconds / TICK_SECONDS));
    expect(world.crabs!.count).toBeGreaterThan(0);
    run(world, Math.round(3 / TICK_SECONDS));
    expect(world.crabs!.count).toBe(0);
    expect(world.match.phase).toBe("result");
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

  it("el resultado lleva el parte (E6-4): abatidos de cada uno y caídos en orden", () => {
    const { world, me } = squad();
    world.addHuman("Rulo");
    run(world, PREP_TICKS + 10);
    const crab = 50_000;
    expect(world.crabs!.spawn(crab, { x: 0, z: 0 })).toBe(true);
    world["applyDamage"]({ k: "damage", src: me.id, dst: crab, amount: 1000, by: "auto" });
    const first = [...world.soldiers.values()].find((s) => s.id !== me.id)!;
    world["killSoldier"](first, "time");
    wipe(world);
    world.step();
    const { report } = world.takeMatchStatus()!;
    expect(report!.crabsKilled).toBe(1);
    expect(report!.soldiers).toHaveLength(8);
    expect(report!.soldiers[0]!.id).toBe(first.id);
    const mine = report!.soldiers.find((s) => s.id === me.id)!;
    expect(mine).toMatchObject({ kills: 1, rescues: 0 });
    expect(report!.soldiers.filter((s) => s.nick === "Rulo")).toHaveLength(1);
    // Partida nueva: el parte empieza de cero.
    world.resetMatch();
    world.addHuman();
    expect(world.tally.report()).toEqual({ crabsKilled: 0, soldiers: [] });
  });

  it("al relevar, el apodo lleva el número de cuerpo (E2-8), también en el parte (E6-4)", () => {
    world = new World({ ...MAP, dummies: [] }, nav);
    world.squadBots = true;
    const me = world.addHuman("Rulo")!;
    run(world, 10);
    const bodies = [me];
    for (let i = 0; i < 2; i++) {
      world["killSoldier"](bodies[bodies.length - 1]!, "time");
      const events = [];
      for (let t = 0; t < DEFUNCT_TICKS; t++) {
        world.step();
        events.push(...world.events);
      }
      const [relief] = world.takeReliefs();
      const next = world.soldiers.get(relief!.to!)!;
      expect(events).toContainEqual({
        k: "control",
        src: next.id,
        bot: false,
        nick: `Rulo #${i + 2}`,
      });
      bodies.push(next);
    }
    world["killSoldier"](bodies[2]!, "time");
    expect(world.tally.report().soldiers.map((s) => s.nick)).toEqual([
      "Rulo",
      "Rulo #2",
      "Rulo #3",
    ]);
    // Partida nueva: vuelve a ser el primer cuerpo.
    world.resetMatch();
    const again = world.addHuman("Rulo")!;
    expect(again.body).toBe(1);
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
