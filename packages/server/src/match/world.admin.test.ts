import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { GAME_CONFIG, MAP, TICK_SECONDS } from "@udc/shared";
import { buildNavMesh, type NavMap } from "../ai/navmesh.js";
import { World } from "./world.js";

const ticks = (seconds: number) => Math.round(seconds / TICK_SECONDS);

let nav: NavMap;
let world: World;
beforeAll(async () => {
  nav = await buildNavMesh(MAP);
});
afterAll(() => nav.destroy());
afterEach(() => world?.crabs?.destroy());

function setup(admin = true) {
  world = new World({ ...MAP, dummies: [] }, nav);
  world.adminEnabled = admin;
  const me = world.addSoldier();
  return { w: world, me };
}

describe("World: comandos de administración (E7-3)", () => {
  it("sin --admin se ignoran", () => {
    const { w, me } = setup(false);
    expect(w.admin(me.id, "invulnerable")).toBeNull();
    expect(me.invulnerable).toBe(false);
  });

  it("invulnerable: los centollos no le quitan vida ni reaparece; se puede revocar", () => {
    const { w, me } = setup();
    expect(w.admin(me.id, "invulnerable")).toContain("concedida");
    me.state = { ...me.state, x: 0, z: 40, yaw: 0 };
    me.nextShotTick = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 6; i++) w.spawnCrab({ x: -3 + i, z: 30 });
    let bites = 0;
    for (let t = 0; t < 200; t++) {
      w.step();
      bites += w.events.filter((e) => e.k === "downed" || e.k === "death").length;
    }
    expect(me.hp).toBe(GAME_CONFIG.soldier.health);
    expect(bites).toBe(0);
    expect(w.buildSnapshot(me.id, new Map()).you?.invulnerable).toBe(true);

    expect(w.admin(me.id, "invulnerable")).toContain("revocada");
    for (let t = 0; t < 40; t++) w.step();
    expect(me.hp).toBeLessThan(GAME_CONFIG.soldier.health);
    expect(w.buildSnapshot(me.id, new Map()).you?.invulnerable).toBeUndefined();
  });

  it("matar centollos vacía el enjambre", () => {
    const { w, me } = setup();
    for (let i = 0; i < 10; i++) w.spawnCrab(MAP.burrows[0]!);
    expect(w.admin(me.id, "killAll")).toContain("10 centollos");
    expect(w.crabs!.count).toBe(0);
  });

  it("saltar fase, lanzar oleada y oleada final mueven al director", () => {
    const { w, me } = setup();
    w.step(); // Empieza el director.
    expect(w.admin(me.id, "nextPhase")).toContain("fondo");
    w.step();
    expect(w.director!.phaseAt(ticks(GAME_CONFIG.director.startDelay))).toBe("background");
    expect(w.admin(me.id, "nextPush")).toContain("empujón");
    w.step();
    expect(w.directorStatus()!.phase).toBe("push");
    expect(w.admin(me.id, "finalWave")).toContain("oleada final");
    w.step();
    expect(w.directorStatus()!.phase).toBe("final");
    expect(w.admin(me.id, "nextPhase")).toContain("Ya es la oleada final");
  });

  it("en el modo de prueba no hay director que mover", () => {
    const { w, me } = setup();
    w.crabQuota = 3;
    expect(w.admin(me.id, "nextPhase")).toContain("modo de prueba");
  });
});
