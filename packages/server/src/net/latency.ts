/**
 * Retrasa la ejecución de callbacks para simular latencia de red en desarrollo (E7-2).
 * Conserva el orden de entrega, como haría una conexión TCP real.
 * Se aplica en ambos sentidos, así que la latencia de ida y vuelta es el doble.
 */
export function withSimulatedLatency(latencyMs: number, jitterMs: number) {
  if (latencyMs <= 0 && jitterMs <= 0) {
    return (fn: () => void) => fn();
  }
  let lastDeliveryAt = 0;
  return (fn: () => void) => {
    const now = performance.now();
    const at = Math.max(now + latencyMs + Math.random() * jitterMs, lastDeliveryAt);
    lastDeliveryAt = at;
    setTimeout(fn, at - now);
  };
}
