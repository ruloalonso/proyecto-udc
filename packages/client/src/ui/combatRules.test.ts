import { describe, expect, it } from "vitest";
import { AbilityId, EntityKind, GAME_CONFIG, MAP, type MapData } from "@udc/shared";
import {
  abilityBlocker,
  fireBlocker,
  maxHealthOf,
  slotCooldown,
  type AbilityContext,
} from "./combatRules.js";

const open: MapData = { ...MAP, obstacles: [] };
const walled: MapData = {
  ...MAP,
  obstacles: [{ id: "m", kind: "wall", x: 0, z: 5, w: 4, d: 1, h: 3, rot: 0 }],
};
const ctx = (over: Partial<AbilityContext> = {}): AbilityContext => ({
  ready: true,
  casting: false,
  moving: false,
  self: { x: 0, z: 0 },
  target: { x: 0, z: 10 },
  map: open,
  ...over,
});

describe("fireBlocker", () => {
  it("nada lo impide a alcance y con visión", () => {
    expect(fireBlocker({ x: 0, z: 0 }, { x: 0, z: 10 }, 30, open)).toBeNull();
  });

  it("fuera de alcance", () => {
    expect(fireBlocker({ x: 0, z: 0 }, { x: 0, z: 31 }, 30, open)).toBe("outOfRange");
  });

  it("sin línea de visión", () => {
    expect(fireBlocker({ x: 0, z: 0 }, { x: 0, z: 10 }, 30, walled)).toBe("noLineOfSight");
  });
});

describe("abilityBlocker", () => {
  it("apuntando no se puede usar nada", () => {
    expect(abilityBlocker(AbilityId.Stim, ctx({ casting: true }))).toBe("casting");
  });

  it("en enfriamiento", () => {
    expect(abilityBlocker(AbilityId.Grenade, ctx({ ready: false }))).toBe("cooldown");
  });

  it("el disparo apuntado necesita objetivo, estar quieto, alcance y visión", () => {
    const { range } = GAME_CONFIG.abilities.aimedShot;
    expect(abilityBlocker(AbilityId.AimedShot, ctx({ target: null }))).toBe("noTarget");
    expect(abilityBlocker(AbilityId.AimedShot, ctx({ moving: true }))).toBe("moving");
    expect(abilityBlocker(AbilityId.AimedShot, ctx({ target: { x: 0, z: range + 1 } }))).toBe(
      "outOfRange",
    );
    expect(abilityBlocker(AbilityId.AimedShot, ctx({ map: walled }))).toBe("noLineOfSight");
    expect(abilityBlocker(AbilityId.AimedShot, ctx())).toBeNull();
  });

  it("la granada y el estimulante no necesitan objetivo ni estar quieto", () => {
    expect(abilityBlocker(AbilityId.Grenade, ctx({ target: null, moving: true }))).toBeNull();
    expect(abilityBlocker(AbilityId.Stim, ctx({ target: null, moving: true }))).toBeNull();
  });
});

describe("slotCooldown", () => {
  const none = { remaining: 0, total: 1000 };

  it("lista: sin barrido ni número", () => {
    expect(slotCooldown({ remaining: 0, total: 6000 }, none)).toEqual({ fraction: 0, label: "" });
  });

  it("enfriamiento propio: barrido y segundos redondeados hacia arriba", () => {
    expect(slotCooldown({ remaining: 4200, total: 6000 }, none)).toEqual({
      fraction: 0.7,
      label: "5",
    });
  });

  it("solo el global: barrido sin número", () => {
    expect(slotCooldown({ remaining: 0, total: 6000 }, { remaining: 500, total: 1000 })).toEqual({
      fraction: 0.5,
      label: "",
    });
  });

  it("si el propio acaba más tarde que el global, manda el propio", () => {
    const view = slotCooldown({ remaining: 3000, total: 6000 }, { remaining: 800, total: 1000 });
    expect(view.label).toBe("3");
  });
});

describe("maxHealthOf", () => {
  it("usa la vida de la configuración", () => {
    expect(maxHealthOf(EntityKind.Dummy)).toBe(GAME_CONFIG.dummy.health);
    expect(maxHealthOf(EntityKind.Soldier)).toBe(GAME_CONFIG.soldier.health);
  });
});
