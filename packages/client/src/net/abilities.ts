import { GAME_CONFIG, TICK_MS, type AbilityId, type OwnState } from "@udc/shared";

const { abilities } = GAME_CONFIG;
const GLOBAL_COOLDOWN_MS = abilities.globalCooldown * 1000;

/** Duración total de cada enfriamiento en ms, en el orden de `OwnState.cd`. */
export const COOLDOWN_TOTAL_MS = [
  GLOBAL_COOLDOWN_MS,
  abilities.aimedShot.cooldown * 1000,
  abilities.grenade.cooldown * 1000,
  abilities.stim.cooldown * 1000,
] as const;

/**
 * Lo que el cliente sabe de sus habilidades: cuándo vuelve a estar lista cada una y
 * si está apuntando. Manda el servidor (`OwnState.cd`); entre que se usa una habilidad
 * y el servidor confirma esa entrada, se supone gastado el enfriamiento global para no
 * mandarla dos veces (ni predecir dos veces el estimulante).
 */
export class AbilityState {
  /** `performance.now()` en que vuelve a estar lista: [global, 1, 2, 3]. */
  private readyAt = [0, 0, 0, 0];
  private lastUsedSeq = -1;
  /** Apuntando (entre los eventos `cast` y `castEnd` propios). */
  casting = false;

  /** Con cada snapshot: enfriamientos que faltan en ticks y última entrada confirmada. */
  update(cd: OwnState["cd"], ack: number, now: number): void {
    const fromServer = cd.map((ticks) => now + ticks * TICK_MS);
    this.readyAt =
      ack >= this.lastUsedSeq
        ? fromServer
        : this.readyAt.map((readyAt, i) => Math.max(readyAt, fromServer[i]!));
  }

  /** Enfriamientos (propio y global) listos. No tiene en cuenta si se está apuntando. */
  isReady(id: AbilityId, now: number): boolean {
    return now >= this.readyAt[0]! && now >= this.readyAt[id]!;
  }

  canUse(id: AbilityId, now: number): boolean {
    return !this.casting && this.isReady(id, now);
  }

  /** Lo que falta de un enfriamiento (0 = global, 1–3 = habilidades) y su duración total, en ms. */
  cooldown(index: 0 | AbilityId, now: number): { remaining: number; total: number } {
    return {
      remaining: Math.max(0, this.readyAt[index]! - now),
      total: COOLDOWN_TOTAL_MS[index],
    };
  }

  /** Se ha mandado el uso de una habilidad en la entrada `seq`. */
  used(seq: number, now: number): void {
    this.lastUsedSeq = seq;
    this.readyAt[0] = Math.max(this.readyAt[0]!, now + GLOBAL_COOLDOWN_MS);
  }
}
