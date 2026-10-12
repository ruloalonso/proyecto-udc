import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { GAME_CONFIG, MAP, TICK_SECONDS, type BotOrder, type GameEvent } from "@udc/shared";
import { buildNavMesh, type NavMap } from "../ai/navmesh.js";
import { World } from "./world.js";

const { bot } = GAME_CONFIG;
const ticks = (seconds: number) => Math.round(seconds / TICK_SECONDS);

let nav: NavMap;
let world: World;
beforeAll(async () => {
  nav = await buildNavMesh(MAP);
});
afterAll(() => nav.destroy());
afterEach(() => world?.crabs?.destroy());

/** Un jugador y 7 bots del servidor. */
function squad() {
  world = new World({ ...MAP, dummies: [] }, nav);
  world.squadBots = true;
  const me = world.addHuman("Rulo")!;
  return { w: world, me };
}

function knockDown(w: World, id: number): void {
  w.soldiers.get(id)!.hp = 1;
  w["applyDamage"]({ k: "damage", src: 0, dst: id, amount: 10, by: "bite" });
}

function run(w: World, n: number): GameEvent[] {
  const all: GameEvent[] = [];
  for (let i = 0; i < n; i++) {
    w.step();
    all.push(...w.events);
  }
  return all;
}

const orders = (w: World) => w["botOrders"] as ReadonlyMap<number, BotOrder>;

describe("World: compañeros que rescatan y escoltan (E5-7)", () => {
  it("un bot va a rescatar al jugador derribado y lo levanta, con la misma entrada que un jugador", () => {
    const { w, me } = squad();
    run(w, 10); // Preparación: sin centollos.
    knockDown(w, me.id);
    const events = run(w, ticks(GAME_CONFIG.soldier.downed.seconds - 1));
    const rescue = events.find((e) => e.k === "rescue" && e.dst === me.id);
    expect(rescue).toBeDefined();
    expect(w.soldiers.get(rescue!.k === "rescue" ? rescue!.src : -1)?.bot).not.toBeNull();
    expect(events).toContainEqual(expect.objectContaining({ k: "rescued", dst: me.id }));
    expect(me.downedUntil).toBeNull();
  });

  it("con una fila en marcha, la mitad de los bots se va a escoltarla y llega a sus puestos", () => {
    const { w, me } = squad();
    w.adminEnabled = true;
    w.step();
    w.admin(me.id, "nextPhase"); // A la evacuación: el Alto Mando abre un edificio.
    run(w, ticks(bot.ordersInterval) + 1);
    const escorts = [...orders(w)].filter(([, o]) => o.kind === "escort");
    expect(escorts).toHaveLength(Math.round(7 * bot.escortShare));
    // Por la navmesh, rodeando lo que haga falta.
    run(w, ticks(30));
    const near = [...orders(w)].filter(([id, o]) => {
      const s = w.soldiers.get(id);
      return (
        s &&
        o.kind === "escort" &&
        Math.hypot(s.state.x - o.post.x, s.state.z - o.post.z) <= bot.escortLeash
      );
    });
    expect(near.length).toBeGreaterThanOrEqual(escorts.length - 1);
  });
});
