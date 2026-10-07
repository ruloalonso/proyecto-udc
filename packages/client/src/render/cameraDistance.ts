/**
 * Distancia de la cámara para este frame.
 *
 * - `desired`: la distancia elegida con la rueda.
 * - `blocked`: distancia máxima libre de obstáculos, o `null` si no hay ninguno.
 *
 * Se acerca al instante (para no atravesar nunca un obstáculo) y se aleja con
 * suavizado exponencial (para no dar tirones al rozar una caja).
 */
export function smoothCameraDistance(
  current: number,
  desired: number,
  blocked: number | null,
  dt: number,
  easeOutRate: number,
): number {
  const limit = blocked === null ? desired : Math.min(desired, blocked);
  if (limit <= current) return limit;
  return limit - (limit - current) * Math.exp(-easeOutRate * dt);
}
