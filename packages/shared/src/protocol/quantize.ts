import { GAME_CONFIG } from "../config/game.config.js";

const { positionScale, yawScale } = GAME_CONFIG.net;

export const quantizePos = (v: number) => Math.round(v * positionScale);
export const dequantizePos = (v: number) => v / positionScale;
export const quantizeYaw = (v: number) => Math.round(normalizeAngle(v) * yawScale);
export const dequantizeYaw = (v: number) => v / yawScale;

/** Lleva un ángulo al rango (−π, π]. */
export function normalizeAngle(a: number): number {
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r <= -Math.PI) r += Math.PI * 2;
  return r;
}

/** Interpola ángulos por el camino más corto. */
export function lerpAngle(a: number, b: number, t: number): number {
  return a + normalizeAngle(b - a) * t;
}
