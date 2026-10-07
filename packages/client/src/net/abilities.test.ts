import { describe, expect, it } from "vitest";
import { AbilityId, GAME_CONFIG, TICK_MS } from "@udc/shared";
import { AbilityState } from "./abilities.js";

const GCD_MS = GAME_CONFIG.abilities.globalCooldown * 1000;

describe("AbilityState", () => {
  it("al principio todo está listo", () => {
    expect(new AbilityState().canUse(AbilityId.Stim, 0)).toBe(true);
  });

  it("toma los enfriamientos del servidor", () => {
    const a = new AbilityState();
    a.update([0, 0, 0, 10], 0, 1000);
    expect(a.canUse(AbilityId.Stim, 1000)).toBe(false);
    expect(a.canUse(AbilityId.Grenade, 1000)).toBe(true);
    expect(a.canUse(AbilityId.Stim, 1000 + 10 * TICK_MS)).toBe(true);
  });

  it("tras usar una, supone el enfriamiento global hasta que el servidor confirme la entrada", () => {
    const a = new AbilityState();
    a.used(5, 1000);
    // Un snapshot que aún no ha procesado la entrada 5 no borra la suposición.
    a.update([0, 0, 0, 0], 4, 1050);
    expect(a.canUse(AbilityId.Grenade, 1050)).toBe(false);
    expect(a.canUse(AbilityId.Grenade, 1000 + GCD_MS)).toBe(true);
  });

  it("cuando el servidor confirma la entrada, manda él (por ejemplo, si la rechazó)", () => {
    const a = new AbilityState();
    a.used(5, 1000);
    a.update([0, 0, 0, 0], 5, 1100);
    expect(a.canUse(AbilityId.Grenade, 1100)).toBe(true);
  });

  it("apuntando no se puede usar nada", () => {
    const a = new AbilityState();
    a.casting = true;
    expect(a.canUse(AbilityId.Stim, 0)).toBe(false);
  });
});
