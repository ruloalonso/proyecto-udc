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

/** Posición y orientación (yaw = 0 mira hacia +Z). */
export interface Pose extends Point {
  yaw: number;
}

/** ¿Está `to` dentro del cono frontal de `from`, de semiángulo `halfAngle`? */
export function isFacing(from: Pose, to: Point, halfAngle: number): boolean {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const dist = Math.hypot(dx, dz);
  if (dist === 0) return true;
  // Adelante = (sin yaw, cos yaw).
  return (dx * Math.sin(from.yaw) + dz * Math.cos(from.yaw)) / dist >= Math.cos(halfAngle) - 1e-9;
}

/** Motivo por el que un soldado no puede disparar a un objetivo. */
export type ShotBlocker = "outOfRange" | "notFacing" | "noLineOfSight";

/**
 * ¿Por qué no puede disparar `from` a `to` a `range` metros? `null` si puede:
 * a alcance, de cara (cono frontal del soldado) y con línea de visión.
 * La decide el servidor; el cliente la usa para avisar (anillo, marco y barra).
 */
export function shotBlocker(
  from: Pose,
  to: Point,
  range: number,
  map: MapData,
): ShotBlocker | null {
  if (Math.hypot(to.x - from.x, to.z - from.z) > range) return "outOfRange";
  if (!isFacing(from, to, GAME_CONFIG.combat.facingHalfAngle)) return "notFacing";
  if (!hasLineOfSight(from, to, map)) return "noLineOfSight";
  return null;
}

export const canShootAt = (from: Pose, to: Point, range: number, map: MapData): boolean =>
  shotBlocker(from, to, range, map) === null;

/** ¿Puede el fuego automático alcanzar `to` desde `from`? */
export const canAutoFireAt = (from: Pose, to: Point, map: MapData): boolean =>
  canShootAt(from, to, GAME_CONFIG.combat.autoFire.range, map);

/**
 * Selección automática (E3-5, §4.2): el candidato más cercano al que `from` puede disparar ya
 * con el fuego automático (a alcance, en el cono frontal y con línea de visión), o `null`.
 * La línea de visión, que es lo más caro, solo se mira en los que mejorarían al mejor actual.
 */
export function nearestShootable<T extends Point>(
  from: Pose,
  candidates: Iterable<T>,
  map: MapData,
): T | null {
  const { range } = GAME_CONFIG.combat.autoFire;
  const { facingHalfAngle } = GAME_CONFIG.combat;
  let best: T | null = null;
  let bestDist: number = range;
  for (const c of candidates) {
    const d = Math.hypot(c.x - from.x, c.z - from.z);
    if (d > bestDist || (best !== null && d === bestDist)) continue;
    if (!isFacing(from, c, facingHalfAngle)) continue;
    if (!hasLineOfSight(from, c, map)) continue;
    best = c;
    bestDist = d;
  }
  return best;
}
