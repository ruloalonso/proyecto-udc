import { GAME_CONFIG, TICK_MS, type AbilityId, type OwnState } from "@udc/shared";

const GLOBAL_COOLDOWN_MS = GAME_CONFIG.abilities.globalCooldown * 1000;

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

  canUse(id: AbilityId, now: number): boolean {
    return !this.casting && now >= this.readyAt[0]! && now >= this.readyAt[id]!;
  }

  /** Se ha mandado el uso de una habilidad en la entrada `seq`. */
  used(seq: number, now: number): void {
    this.lastUsedSeq = seq;
    this.readyAt[0] = Math.max(this.readyAt[0]!, now + GLOBAL_COOLDOWN_MS);
  }
}
