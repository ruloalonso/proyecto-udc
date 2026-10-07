import { describe, expect, it } from "vitest";
import { AbilityId, GAME_CONFIG } from "@udc/shared";
import {
  ABILITY_TICKS,
  isReady,
  readyCooldowns,
  remainingCooldowns,
  sanitizeAbility,
} from "./abilities.js";

describe("ABILITY_TICKS", () => {
  it("pasa los segundos de la configuración a ticks", () => {
    const { tickRate } = GAME_CONFIG.net;
    expect(ABILITY_TICKS.globalCooldown).toBe(tickRate);
    expect(ABILITY_TICKS.aimedShotCast).toBe(1.5 * tickRate);
    expect(ABILITY_TICKS.stimCooldown).toBe(30 * tickRate);
  });
});

describe("enfriamientos", () => {
  it("una habilidad está lista si lo están ella y el enfriamiento global", () => {
    const cd = readyCooldowns();
    expect(isReady(cd, AbilityId.Stim, 1)).toBe(true);
    cd.global = 10;
    expect(isReady(cd, AbilityId.Stim, 5)).toBe(false);
    cd.global = 0;
    cd[AbilityId.Stim] = 10;
    expect(isReady(cd, AbilityId.Stim, 5)).toBe(false);
    expect(isReady(cd, AbilityId.Grenade, 5)).toBe(true);
  });

  it("remainingCooldowns cuenta los ticks que faltan, sin negativos", () => {
    const cd = { ...readyCooldowns(), global: 12, [AbilityId.Grenade]: 50 };
    expect(remainingCooldowns(cd, 10)).toEqual([2, 0, 40, 0]);
  });
});

describe("sanitizeAbility", () => {
  it("acepta usos válidos", () => {
    expect(sanitizeAbility({ id: 1, target: 7 })).toEqual({ id: 1, target: 7 });
    expect(sanitizeAbility({ id: 2, x: 1.5, z: -3 })).toEqual({ id: 2, x: 1.5, z: -3 });
    expect(sanitizeAbility({ id: 3 })).toEqual({ id: 3 });
  });

  it("descarta basura", () => {
    expect(sanitizeAbility(undefined)).toBeUndefined();
    expect(sanitizeAbility("hola")).toBeUndefined();
    expect(sanitizeAbility({ id: 4 })).toBeUndefined();
    expect(sanitizeAbility({ id: "1" })).toBeUndefined();
  });

  it("ignora campos con valores no válidos", () => {
    expect(sanitizeAbility({ id: 1, target: 1.5 })).toEqual({ id: 1 });
    expect(sanitizeAbility({ id: 2, x: Number.NaN, z: 3 })).toEqual({ id: 2 });
  });
});
