import { describe, expect, it } from "vitest";
import {
  AbilityId,
  GAME_CONFIG,
  MAP,
  STIM_TICKS,
  type AbilityUse,
  type GameEvent,
  type MapData,
} from "@udc/shared";
import { ABILITY_TICKS } from "./abilities.js";
import { World } from "./world.js";

const { aimedShot, grenade, stim } = GAME_CONFIG.abilities;

/** Mundo con un soldado a 4 m al norte del muñeco de (0, 24), mirando hacia él. */
function setup() {
  const world = new World();
  const me = world.addSoldier();
  const dummy = [...world.dummies.values()].find((d) => d.x === 0 && d.z === 24)!;
  me.state = { x: 0, z: 28, yaw: Math.PI };
  // Sin fuego automático: la selección automática elegiría al muñeco y estas pruebas miden solo
  // el daño de la habilidad.
  me.nextShotTick = Number.POSITIVE_INFINITY;
  let seq = 0;
  /** Una entrada (con habilidad opcional) y un tick. Devuelve los eventos del tick. */
  const tick = (ability?: AbilityUse, forward = 0): GameEvent[] => {
    world.queueInput(me.id, { seq: seq++, forward, strafe: 0, yaw: me.state.yaw, ability });
    world.step();
    return world.events;
  };
  /** Ticks sin entradas nuevas. Devuelve todos los eventos. */
  const idle = (n: number): GameEvent[] => {
    const all: GameEvent[] = [];
    for (let i = 0; i < n; i++) all.push(...tick());
    return all;
  };
  return { world, me, dummy, tick, idle };
}

const kinds = (events: GameEvent[]) => events.map((e) => e.k);

describe("disparo apuntado", () => {
  const use = (target: number): AbilityUse => ({ id: AbilityId.AimedShot, target });

  it("tarda lo que dice la configuración, hace su daño y entonces empieza el enfriamiento", () => {
    const { world, me, dummy, tick, idle } = setup();
    expect(kinds(tick(use(dummy.id)))).toEqual(["cast"]);
    expect(me.cast).not.toBeNull();

    const during = idle(ABILITY_TICKS.aimedShotCast - 1);
    expect(during.filter((e) => e.k === "damage")).toHaveLength(0);

    const end = tick();
    expect(end).toContainEqual({ k: "castEnd", src: me.id, ok: true });
    expect(end).toContainEqual({
      k: "damage",
      src: me.id,
      dst: dummy.id,
      amount: aimedShot.damage,
      by: "aimed",
    });
    expect(dummy.hp).toBe(GAME_CONFIG.dummy.health - aimedShot.damage);
    expect(me.cast).toBeNull();
    expect(me.cooldowns[AbilityId.AimedShot]).toBe(world.tick + ABILITY_TICKS.aimedShotCooldown);
  });

  it("moverse lo interrumpe y no gasta su enfriamiento", () => {
    const { me, dummy, tick, idle } = setup();
    tick(use(dummy.id));
    idle(5);
    expect(tick(undefined, 1)).toContainEqual({ k: "castEnd", src: me.id, ok: false });
    expect(me.cast).toBeNull();
    expect(me.cooldowns[AbilityId.AimedShot]).toBe(0);
  });

  it("el fuego automático se detiene mientras se apunta", () => {
    const { world, me, dummy, tick, idle } = setup();
    world.setTarget(me.id, dummy.id);
    tick(use(dummy.id)); // en este tick ya está apuntando: no hay fuego automático
    const during = idle(ABILITY_TICKS.aimedShotCast - 1);
    expect(during.filter((e) => e.k === "damage" && e.by === "auto")).toHaveLength(0);
  });

  it("no empieza sin línea de visión", () => {
    const { world, me, tick } = setup();
    const hidden = [...world.dummies.values()].find((d) => d.x === -20 && d.z === 12)!;
    me.state = { x: MAP.spawn.x, z: MAP.spawn.z, yaw: Math.PI };
    expect(tick(use(hidden.id))).toEqual([]);
  });

  it("no empieza fuera de alcance", () => {
    const { me, dummy, tick } = setup();
    me.state = { x: 0, z: dummy.z + aimedShot.range + 1, yaw: Math.PI };
    expect(tick(use(dummy.id))).toEqual([]);
  });
});

describe("granada", () => {
  const throwAt = (x: number, z: number): AbilityUse => ({ id: AbilityId.Grenade, x, z });

  it("explota tras su tiempo de vuelo y daña al muñeco del radio", () => {
    const { me, dummy, tick, idle } = setup();
    const thrown = tick(throwAt(dummy.x + 1, dummy.z));
    expect(thrown).toContainEqual(
      expect.objectContaining({ k: "grenade", src: me.id, x: 1, z: 24 }),
    );

    const flight = idle(ABILITY_TICKS.grenadeFuse - 1);
    expect(flight.filter((e) => e.k === "explosion")).toHaveLength(0);

    const boom = tick();
    expect(boom).toContainEqual({ k: "explosion", src: me.id, x: 1, z: 24 });
    expect(boom).toContainEqual({
      k: "damage",
      src: me.id,
      dst: dummy.id,
      amount: grenade.damage,
      by: "grenade",
    });
  });

  it("no daña fuera del radio", () => {
    const { dummy, tick, idle } = setup();
    tick(throwAt(dummy.x + grenade.radius + 0.5, dummy.z));
    idle(ABILITY_TICKS.grenadeFuse);
    expect(dummy.hp).toBe(GAME_CONFIG.dummy.health);
  });

  it("un punto más allá del alcance se acerca al máximo en la misma dirección", () => {
    const { me, tick } = setup();
    const e = tick(throwAt(0, 28 - 100)).find((x) => x.k === "grenade");
    expect(e).toMatchObject({ x: 0, z: 28 - grenade.range });
    expect(me.cooldowns[AbilityId.Grenade]).toBeGreaterThan(0);
  });

  it("los obstáculos cubren de la explosión", () => {
    // Mapa de prueba: un muñeco en el origen y, en un caso, un muro entre él y la granada.
    const base: MapData = { ...MAP, obstacles: [], dummies: [{ x: 0, z: 0 }] };
    const wall = { id: "m", kind: "wall" as const, x: 0, z: 2, w: 6, d: 0.5, h: 3, rot: 0 };
    const hpAfterGrenade = (map: MapData) => {
      const world = new World(map);
      const me = world.addSoldier();
      me.state = { x: 0, z: 10, yaw: Math.PI };
      me.nextShotTick = Number.POSITIVE_INFINITY; // Solo cuenta la granada.
      const dummy = [...world.dummies.values()][0]!;
      world.queueInput(me.id, {
        seq: 0,
        forward: 0,
        strafe: 0,
        yaw: Math.PI,
        ability: throwAt(0, 3.5),
      });
      for (let i = 0; i <= ABILITY_TICKS.grenadeFuse; i++) world.step();
      return dummy.hp;
    };
    expect(hpAfterGrenade(base)).toBe(GAME_CONFIG.dummy.health - grenade.damage);
    expect(hpAfterGrenade({ ...base, obstacles: [wall] })).toBe(GAME_CONFIG.dummy.health);
  });
});

describe("estimulante", () => {
  const use: AbilityUse = { id: AbilityId.Stim };

  it("cura sin pasar del máximo", () => {
    const { me, tick, idle } = setup();
    me.hp = 50;
    tick(use);
    expect(me.hp).toBe(50 + stim.heal);
    idle(ABILITY_TICKS.stimCooldown);
    me.hp = GAME_CONFIG.soldier.health - 5;
    tick(use);
    expect(me.hp).toBe(GAME_CONFIG.soldier.health);
  });

  it("acelera desde la misma entrada en que se usa", () => {
    const plain = setup();
    plain.tick(undefined, 1);
    const boosted = setup();
    boosted.tick(use, 1);
    const moved = (s: { me: { state: { z: number } } }) => 28 - s.me.state.z;
    expect(moved(boosted)).toBeCloseTo(moved(plain) * (1 + stim.speedBonus));
    expect(boosted.me.state.boostTicks).toBe(STIM_TICKS - 1);
  });

  it("respeta su enfriamiento", () => {
    const { tick, idle } = setup();
    expect(kinds(tick(use))).toEqual(["stim"]);
    idle(ABILITY_TICKS.stimCooldown - 2);
    // (En ese tick el Alto Mando puede abrir un edificio: solo cuentan los del estimulante.)
    expect(tick(use).filter((e) => e.k !== "activate")).toEqual([]);
    expect(kinds(tick(use))).toEqual(["stim"]);
  });
});

describe("enfriamiento global y estado propio", () => {
  it("bloquea otra habilidad durante su duración", () => {
    const { dummy, tick, idle } = setup();
    tick({ id: AbilityId.Stim });
    expect(tick({ id: AbilityId.Grenade, x: dummy.x, z: dummy.z })).toEqual([]);
    idle(ABILITY_TICKS.globalCooldown - 2);
    expect(kinds(tick({ id: AbilityId.Grenade, x: dummy.x, z: dummy.z }))).toEqual(["grenade"]);
  });

  it("no se pueden usar habilidades mientras se apunta", () => {
    const { dummy, tick, idle } = setup();
    tick({ id: AbilityId.AimedShot, target: dummy.id });
    idle(ABILITY_TICKS.globalCooldown);
    expect(tick({ id: AbilityId.Stim })).toEqual([]);
  });

  it("el snapshot propio lleva vida, enfriamientos y velocidad extra", () => {
    const { world, me, tick } = setup();
    tick({ id: AbilityId.Stim });
    const you = world.buildSnapshot(me.id, new Map()).you!;
    expect(you.hp).toBe(GAME_CONFIG.soldier.health);
    expect(you.boostTicks).toBe(STIM_TICKS - 1);
    expect(you.cd).toEqual([ABILITY_TICKS.globalCooldown, 0, 0, ABILITY_TICKS.stimCooldown]);
  });
});
