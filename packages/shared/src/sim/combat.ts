import { GAME_CONFIG } from "../config/game.config.js";
import type { MapData, Point } from "../map/index.js";
import { hasLineOfSight } from "./lineOfSight.js";

/**
 * ¿Puede el fuego automático alcanzar `to` desde `from`? A alcance y con línea de visión.
 * La decide el servidor; el cliente la usa solo para avisar (anillo del objetivo).
 */
export function canAutoFireAt(from: Point, to: Point, map: MapData): boolean {
  const { range } = GAME_CONFIG.combat.autoFire;
  if (Math.hypot(to.x - from.x, to.z - from.z) > range) return false;
  return hasLineOfSight(from, to, map);
}
