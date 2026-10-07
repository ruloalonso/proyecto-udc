import { AbilityId, GAME_CONFIG, TICK_SECONDS, type AbilityUse, type OwnState } from "@udc/shared";

const { abilities } = GAME_CONFIG;
const ticks = (seconds: number) => Math.round(seconds / TICK_SECONDS);

/** Tiempos de las habilidades, en ticks. */
export const ABILITY_TICKS = {
  globalCooldown: ticks(abilities.globalCooldown),
  aimedShotCast: ticks(abilities.aimedShot.castTime),
  aimedShotCooldown: ticks(abilities.aimedShot.cooldown),
  grenadeFuse: ticks(abilities.grenade.fuseTime),
  grenadeCooldown: ticks(abilities.grenade.cooldown),
  stimCooldown: ticks(abilities.stim.cooldown),
} as const;

/** Tick en el que vuelve a estar lista cada habilidad (y el enfriamiento global). */
export interface AbilityCooldowns {
  global: number;
  [AbilityId.AimedShot]: number;
  [AbilityId.Grenade]: number;
  [AbilityId.Stim]: number;
}

export const readyCooldowns = (): AbilityCooldowns => ({
  global: 0,
  [AbilityId.AimedShot]: 0,
  [AbilityId.Grenade]: 0,
  [AbilityId.Stim]: 0,
});

/** ¿Se puede usar la habilidad en este tick? */
export function isReady(cooldowns: AbilityCooldowns, id: AbilityId, tick: number): boolean {
  return tick >= cooldowns.global && tick >= cooldowns[id];
}

/** Ticks que faltan para cada enfriamiento, en el orden de `OwnState.cd`. */
export function remainingCooldowns(cooldowns: AbilityCooldowns, tick: number): OwnState["cd"] {
  const left = (readyAt: number) => Math.max(0, readyAt - tick);
  return [
    left(cooldowns.global),
    left(cooldowns[AbilityId.AimedShot]),
    left(cooldowns[AbilityId.Grenade]),
    left(cooldowns[AbilityId.Stim]),
  ];
}

/** Valida el uso de habilidad que manda el cliente (no hay que fiarse de lo que llega). */
export function sanitizeAbility(raw: unknown): AbilityUse | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const { id, target, x, z } = raw as Record<string, unknown>;
  if (id !== AbilityId.AimedShot && id !== AbilityId.Grenade && id !== AbilityId.Stim) {
    return undefined;
  }
  const use: AbilityUse = { id };
  if (Number.isInteger(target)) use.target = target as number;
  if (Number.isFinite(x) && Number.isFinite(z)) {
    use.x = x as number;
    use.z = z as number;
  }
  return use;
}
