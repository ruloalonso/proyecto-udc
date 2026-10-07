import { GAME_CONFIG } from "../config/game.config.js";
import type { MapData, Point } from "../map/index.js";
import { hasLineOfSight } from "./lineOfSight.js";

/** Lleva `to` a como mucho `range` metros de `from`, en la misma dirección (granada). */
export function clampToRange(from: Point, to: Point, range: number): Point {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const dist = Math.hypot(dx, dz);
  if (dist <= range) return { x: to.x, z: to.z };
  return { x: from.x + (dx / dist) * range, z: from.z + (dz / dist) * range };
}

/** ¿Se puede disparar a `to` desde `from`? A `range` metros o menos y con línea de visión. */
export function canShootAt(from: Point, to: Point, range: number, map: MapData): boolean {
  if (Math.hypot(to.x - from.x, to.z - from.z) > range) return false;
  return hasLineOfSight(from, to, map);
}

/**
 * ¿Puede el fuego automático alcanzar `to` desde `from`?
 * La decide el servidor; el cliente la usa solo para avisar (anillo del objetivo).
 */
export function canAutoFireAt(from: Point, to: Point, map: MapData): boolean {
  return canShootAt(from, to, GAME_CONFIG.combat.autoFire.range, map);
}
