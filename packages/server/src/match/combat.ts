import { GAME_CONFIG, TICK_SECONDS, type DamageEvent } from "@udc/shared";

const { damage, range, interval } = GAME_CONFIG.combat.autoFire;

/** Ticks entre dos disparos del fuego automático. */
export const AUTO_FIRE_INTERVAL_TICKS = Math.round(interval / TICK_SECONDS);

export interface AutoFireShooter {
  id: number;
  state: { x: number; z: number };
  targetId: number | null;
  /** Primer tick en el que el arma vuelve a estar lista. */
  nextShotTick: number;
}

export interface AutoFireTarget {
  id: number;
  x: number;
  z: number;
}

/**
 * Fuego automático (E3-1): dispara si el objetivo seleccionado existe, está a
 * alcance y el arma está lista. Devuelve el daño que hay que aplicar y deja el
 * arma en enfriamiento, o `null` si no dispara.
 *
 * El enfriamiento es del arma, no del objetivo: cambiar de objetivo no permite
 * disparar antes.
 */
export function autoFire(
  tick: number,
  shooter: AutoFireShooter,
  target: AutoFireTarget | undefined,
): DamageEvent | null {
  if (!target || shooter.targetId !== target.id) return null;
  if (tick < shooter.nextShotTick) return null;
  if (Math.hypot(target.x - shooter.state.x, target.z - shooter.state.z) > range) return null;
  shooter.nextShotTick = tick + AUTO_FIRE_INTERVAL_TICKS;
  return { k: "damage", src: shooter.id, dst: target.id, amount: damage };
}
