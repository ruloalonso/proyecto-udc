import { GAME_CONFIG, TICK_SECONDS } from "@udc/shared";

const { landSeconds, liftoffSeconds } = GAME_CONFIG.shuttles;
const LIFTOFF_TICKS = liftoffSeconds / TICK_SECONDS;
const LAND_TICKS = landSeconds / TICK_SECONDS;

/** Altura a la que la lanzadera se pierde de vista (metros sobre la plataforma). */
export const SHUTTLE_TOP = 60;

/** Lo que el cliente sabe de la lanzadera (mensaje `shuttle` y evento `launch`). */
export interface ShuttleTimeline {
  /** Posada en la plataforma. */
  docked: boolean;
  /** Tick del servidor del último despegue (no de una destrucción), o `null`. */
  leftAtTick: number | null;
  /** Tick del servidor en que se posa la que viene, o `null`. */
  arrivesAtTick: number | null;
}

/** Dónde dibujar la lanzadera. */
export interface ShuttlePose {
  visible: boolean;
  /** Metros sobre su sitio en la plataforma. */
  height: number;
  /** Con el chorro encendido (despegando o aterrizando). */
  thrust: boolean;
}

const LANDED: ShuttlePose = { visible: true, height: 0, thrust: false };
const GONE: ShuttlePose = { visible: false, height: 0, thrust: false };

/**
 * Animación de las lanzaderas (E6-3), solo visual: posada mientras lo esté en el servidor; al
 * despegar sube acelerando durante `liftoffSeconds` hasta perderse; la que viene baja frenando
 * durante los `landSeconds` antes de posarse. Destruida, desaparece (la explosión la pinta otro).
 * `tick` puede tener decimales (el tick interpolado que se dibuja).
 */
export function shuttlePose(
  tick: number,
  { docked, leftAtTick, arrivesAtTick }: ShuttleTimeline,
): ShuttlePose {
  if (docked) return LANDED;
  if (leftAtTick !== null && tick >= leftAtTick && tick - leftAtTick < LIFTOFF_TICKS) {
    const p = (tick - leftAtTick) / LIFTOFF_TICKS;
    return { visible: true, height: SHUTTLE_TOP * p * p, thrust: true };
  }
  if (arrivesAtTick !== null && tick < arrivesAtTick && arrivesAtTick - tick <= LAND_TICKS) {
    const p = (arrivesAtTick - tick) / LAND_TICKS;
    return { visible: true, height: SHUTTLE_TOP * p * p, thrust: true };
  }
  return GONE;
}
