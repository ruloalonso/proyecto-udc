import { GAME_CONFIG, TICK_SECONDS } from "@udc/shared";

const { landDelay, landSeconds, liftoffSeconds } = GAME_CONFIG.shuttles;

/** Altura a la que la lanzadera se pierde de vista (metros sobre la plataforma). */
export const SHUTTLE_TOP = 60;

/** Lo que el cliente sabe de las lanzaderas. */
export interface ShuttleTimeline {
  /** Tick del servidor del último despegue visto, o `null` si aún no ha despegado ninguna. */
  lastLaunchTick: number | null;
  /** ¿Queda alguna por despegar? Tras la última no vuelve ninguna. */
  moreToCome: boolean;
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
 * Animación de las lanzaderas (E6-3), solo visual: posada en la plataforma hasta su despegue;
 * sube acelerando durante `liftoffSeconds` hasta perderse; la siguiente baja frenando a los
 * `landDelay` segundos del despegue y tarda `landSeconds` en posarse. Tras la última, nada.
 * `tick` puede tener decimales (el tick interpolado que se dibuja).
 */
export function shuttlePose(
  tick: number,
  { lastLaunchTick, moreToCome }: ShuttleTimeline,
): ShuttlePose {
  if (lastLaunchTick === null) return moreToCome ? LANDED : GONE;
  const t = (tick - lastLaunchTick) * TICK_SECONDS;
  if (t < 0) return LANDED;
  if (t < liftoffSeconds) {
    const p = t / liftoffSeconds;
    return { visible: true, height: SHUTTLE_TOP * p * p, thrust: true };
  }
  if (!moreToCome || t < landDelay) return GONE;
  if (t < landDelay + landSeconds) {
    const p = 1 - (t - landDelay) / landSeconds;
    return { visible: true, height: SHUTTLE_TOP * p * p, thrust: true };
  }
  return LANDED;
}
