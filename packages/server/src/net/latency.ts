/** Condiciones de red simuladas en desarrollo (E7-2). */
export interface NetworkSimulation {
  /** Retardo fijo por sentido, en ms (la ida y vuelta es el doble). */
  latencyMs: number;
  /** Retardo aleatorio extra por mensaje, entre 0 y este valor, en ms. */
  jitterMs: number;
  /** Probabilidad (0–1) de que un mensaje se pierda y haya que retransmitirlo. */
  loss: number;
  /** Lo que tarda una retransmisión, en ms (como el RTO de TCP). */
  rtoMs: number;
}

export interface ChannelDeps {
  random?: () => number;
  now?: () => number;
  schedule?: (fn: () => void, ms: number) => void;
}

/**
 * Un sentido de una conexión con las condiciones de `sim`.
 *
 * WebSocket va sobre TCP: los mensajes llegan siempre y en orden. Un paquete perdido
 * no desaparece: se retransmite y todo lo que viene detrás espera (bloqueo de cabeza
 * de línea). Eso es lo que se simula; tirar mensajes rompería el protocolo de deltas,
 * que da por hecho que todo llega.
 *
 * Cada conexión necesita su canal de entrada y el de salida: un retraso en uno no
 * frena a los demás.
 */
export function createSimulatedChannel(
  sim: NetworkSimulation,
  { random = Math.random, now = () => performance.now(), schedule = setTimeout }: ChannelDeps = {},
): (deliver: () => void) => void {
  if (sim.latencyMs <= 0 && sim.jitterMs <= 0 && sim.loss <= 0) return (deliver) => deliver();

  // Cola en orden de entrega (los instantes nunca bajan) y un único temporizador.
  const queue: { at: number; deliver: () => void }[] = [];
  let lastAt = 0;
  let scheduled = false;

  const pump = () => {
    scheduled = false;
    const t = now();
    while (queue.length > 0 && queue[0]!.at <= t) queue.shift()!.deliver();
    if (queue.length > 0) {
      scheduled = true;
      schedule(pump, queue[0]!.at - t);
    }
  };

  return (deliver) => {
    const t = now();
    let at = t + sim.latencyMs + random() * sim.jitterMs;
    if (sim.loss > 0 && random() < sim.loss) at += sim.rtoMs;
    // En orden: si el anterior aún no ha llegado, este espera detrás.
    at = Math.max(at, lastAt);
    lastAt = at;
    queue.push({ at, deliver });
    if (!scheduled) {
      scheduled = true;
      schedule(pump, at - t);
    }
  };
}

/** Lee la simulación de las variables de entorno (SIM_LATENCY_MS, SIM_JITTER_MS, SIM_LOSS, SIM_RTO_MS). */
export function simulationFromEnv(env: NodeJS.ProcessEnv): NetworkSimulation {
  const num = (name: string, fallback: number) => {
    const v = Number(env[name] ?? fallback);
    return Number.isFinite(v) && v >= 0 ? v : fallback;
  };
  return {
    latencyMs: num("SIM_LATENCY_MS", 0),
    jitterMs: num("SIM_JITTER_MS", 0),
    loss: Math.min(1, num("SIM_LOSS", 0)),
    rtoMs: num("SIM_RTO_MS", 200),
  };
}
