import { describe, expect, it } from "vitest";
import { GAME_CONFIG, TICK_SECONDS } from "../config/game.config.js";
import { MAP, type MapData } from "../map/index.js";
import { AbilityId, EntityKind } from "../protocol/messages.js";
import { BotBrain, type BotEntity, type BotSelf } from "./brain.js";

const { bot, soldier, abilities } = GAME_CONFIG;
const open: MapData = { ...MAP, obstacles: [] };
const READY = [0, 0, 0, 0] as const;
/** Ninguna habilidad lista (para probar solo el movimiento). */
const BUSY = [99, 99, 99, 99] as const;

const self = (over: Partial<BotSelf> = {}): BotSelf => ({
  x: 0,
  z: 0,
  yaw: 0,
  hp: 100,
  cd: BUSY,
  target: null,
  ...over,
});
let nextId = 1;
const crab = (x: number, z: number, kind: EntityKind = EntityKind.Crab): BotEntity => ({
  id: nextId++,
  kind,
  x,
  z,
});

describe("BotBrain: movimiento", () => {
  it("gira hacia el hostil más cercano, como mucho lo que da un tick", () => {
    const brain = new BotBrain(open);
    // Enemigo a la derecha (+X): yaw = π/2.
    const d = brain.think(self(), [crab(15, 0), crab(30, 0)]);
    expect(d.yaw).toBeCloseTo(soldier.turnSpeed * TICK_SECONDS);
    // Ya de cara, no gira más.
    const d2 = brain.think(self({ yaw: Math.PI / 2 }), [crab(15, 0)]);
    expect(d2.yaw).toBeCloseTo(Math.PI / 2);
  });

  it("retrocede si lo tiene encima, se acerca si está lejos y si no, se queda", () => {
    const brain = new BotBrain(open);
    expect(brain.think(self(), [crab(0, bot.keepAway - 1)]).forward).toBe(-1);
    expect(brain.think(self(), [crab(0, bot.approachRange + 1)]).forward).toBe(1);
    expect(brain.think(self(), [crab(0, (bot.keepAway + bot.approachRange) / 2)]).forward).toBe(0);
  });

  it("no hace caso a lo que está fuera de su alcance: patrulla cerca de la plataforma", () => {
    const brain = new BotBrain(open, () => 0.5);
    const at = { x: MAP.landingPad.x, z: MAP.landingPad.z - 30 };
    const d = brain.think(self(at), [crab(at.x, at.z - bot.engageRange - 5)]);
    expect(d.forward).toBe(1);
    // Va hacia el norte (hacia la plataforma), no hacia el centollo del sur.
    expect(Math.cos(d.yaw)).toBeGreaterThan(0);
  });

  it("con escupidores cerca se mueve de lado y cambia de sentido cada tanto", () => {
    const brain = new BotBrain(open);
    const spitter = crab(0, 15, EntityKind.Spitter);
    const strafes = Array.from(
      { length: Math.round((bot.strafeSwitch * 3) / TICK_SECONDS) },
      () => brain.think(self(), [spitter]).strafe,
    );
    expect(strafes.every((s) => s !== 0)).toBe(true);
    expect(new Set(strafes).size).toBe(2);
  });

  it("si está atascado patrullando, cambia de punto", () => {
    const brain = new BotBrain(open);
    const first = brain.think(self(), []).yaw;
    let changed = false;
    for (let i = 0; i < (bot.stuckSeconds * 3) / TICK_SECONDS && !changed; i++) {
      // Siempre en el mismo sitio: atascado.
      changed = Math.abs(brain.think(self({ yaw: first }), []).yaw - first) > 1e-6;
    }
    expect(changed).toBe(true);
  });
});

describe("BotBrain: habilidades", () => {
  it("con poca vida usa el estimulante", () => {
    const brain = new BotBrain(open);
    const d = brain.think(self({ hp: bot.stimHp, cd: READY }), [crab(0, 15)]);
    expect(d.ability).toEqual({ id: AbilityId.Stim });
  });

  it("lanza la granada a un grupo a distancia segura", () => {
    const brain = new BotBrain(open);
    const group = [crab(0, 12), crab(1, 12.5), crab(-1, 12.5)];
    expect(brain.think(self({ cd: READY }), group).ability).toEqual({
      id: AbilityId.Grenade,
      x: 0,
      z: 12,
    });
  });

  it("no lanza la granada si el grupo lo tiene encima ni si hay un aliado cerca", () => {
    const brain = new BotBrain(open);
    const close = [crab(0, 3), crab(1, 3), crab(-1, 3)];
    expect(brain.think(self({ cd: READY }), close).ability).toBeUndefined();
    const group = [crab(0, 12), crab(1, 12.5), crab(-1, 12.5)];
    const ally: BotEntity = { id: 99, kind: EntityKind.Soldier, x: 0, z: 13 };
    expect(brain.think(self({ cd: READY }), [...group, ally]).ability).toBeUndefined();
  });

  it("tampoco si hay colonos junto al grupo (la granada también les hiere, E6-2)", () => {
    const brain = new BotBrain(open);
    const group = [crab(0, 12), crab(1, 12.5), crab(-1, 12.5)];
    const colonist: BotEntity = { id: 98, kind: EntityKind.Colonist, x: 0, z: 13 };
    expect(brain.think(self({ cd: READY }), [...group, colonist]).ability).toBeUndefined();
  });

  it("tampoco cerca de la nave de la plataforma (#72)", () => {
    const brain = new BotBrain(open);
    const pad = open.landingPad;
    const me = self({ x: pad.x, z: pad.z - 20, yaw: 0, cd: READY });
    const group = [
      crab(pad.x, pad.z - 7),
      crab(pad.x + 1, pad.z - 7.5),
      crab(pad.x - 1, pad.z - 7.5),
    ];
    expect(brain.think(me, group).ability).toBeUndefined();
  });

  it("no lanza la granada a un centollo suelto", () => {
    const brain = new BotBrain(open);
    expect(brain.think(self({ cd: READY }), [crab(0, 12)]).ability).toBeUndefined();
  });

  it("disparo apuntado al escupidor que tiene de objetivo, si está tranquilo; y se queda quieto", () => {
    const brain = new BotBrain(open);
    const spitter = crab(0, 20, EntityKind.Spitter);
    const d = brain.think(self({ cd: READY, target: spitter.id }), [spitter]);
    expect(d.ability).toEqual({ id: AbilityId.AimedShot, target: spitter.id });
    expect(d.forward).toBe(0);
    expect(d.strafe).toBe(0);
    // Mientras dura el lanzamiento, sigue quieto aunque haya escupidores.
    const castTicks = Math.round(abilities.aimedShot.castTime / TICK_SECONDS);
    for (let i = 0; i < castTicks; i++) {
      const next = brain.think(self({ target: spitter.id }), [spitter]);
      expect(next.forward).toBe(0);
      expect(next.strafe).toBe(0);
    }
  });

  it("no usa el disparo apuntado con centollos cerca", () => {
    const brain = new BotBrain(open);
    const spitter = crab(0, 20, EntityKind.Spitter);
    const d = brain.think(self({ cd: READY, target: spitter.id }), [spitter, crab(0, 6)]);
    expect(d.ability?.id).not.toBe(AbilityId.AimedShot);
  });
});

describe("BotBrain: derribado (E5-1)", () => {
  it("se queda quieto, de cara al enemigo y sin habilidades", () => {
    const brain = new BotBrain(open);
    const d = brain.think(self({ hp: 0, cd: READY }), [
      crab(15, 0),
      crab(15.5, 0),
      crab(14.5, 0.5),
    ]);
    expect(d.forward).toBe(0);
    expect(d.strafe).toBe(0);
    expect(d.ability).toBeUndefined();
    expect(d.yaw).toBeGreaterThan(0);
  });
});
