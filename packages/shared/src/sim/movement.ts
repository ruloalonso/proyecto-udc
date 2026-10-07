import { GAME_CONFIG, TICK_SECONDS } from "../config/game.config.js";
import type { MapData } from "../map/index.js";
import { pushCircleOutOfBox } from "./collision.js";

export interface MoveState {
  x: number;
  z: number;
  /** Orientación en radianes. 0 = mirando hacia +Z. */
  yaw: number;
}

export interface MoveInput {
  /** Número de secuencia creciente, asignado por el cliente. */
  seq: number;
  /** Adelante (+1) / atrás (−1). */
  forward: number;
  /** Derecha (+1) / izquierda (−1). */
  strafe: number;
  /** Orientación del personaje en radianes. */
  yaw: number;
}

const clampAxis = (v: number) => (Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);

/**
 * Avanza un tick de movimiento de un soldado.
 * La usan el servidor (autoridad) y el cliente (predicción): tiene que ser determinista.
 *
 * Los soldados no colisionan entre sí, solo con el mapa: el cliente ve a los demás en
 * el pasado y no podría predecir el choque de forma exacta (ver docs/decisiones.md).
 */
export function stepMovement(state: MoveState, input: MoveInput, map: MapData): MoveState {
  const { speed, backwardAndStrafeFactor, radius } = GAME_CONFIG.soldier;
  const forward = clampAxis(input.forward);
  const strafe = clampAxis(input.strafe);
  const yaw = Number.isFinite(input.yaw) ? input.yaw : state.yaw;

  let x = state.x;
  let z = state.z;

  if (forward !== 0 || strafe !== 0) {
    // Normalizar para no correr más en diagonal.
    const len = Math.hypot(forward, strafe);
    const f = forward / len;
    const s = strafe / len;
    const slow = forward < 0 || strafe !== 0 ? backwardAndStrafeFactor : 1;
    const dist = speed * slow * TICK_SECONDS;

    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    // Adelante = (sin, cos); derecha = (cos, −sin).
    x += (f * sin + s * cos) * dist;
    z += (f * cos - s * sin) * dist;
  }

  for (const box of map.obstacles) {
    const pushed = pushCircleOutOfBox(x, z, radius, box);
    x = pushed.x;
    z = pushed.z;
  }

  const half = map.size / 2 - radius;
  x = Math.max(-half, Math.min(half, x));
  z = Math.max(-half, Math.min(half, z));

  return { x, z, yaw };
}
