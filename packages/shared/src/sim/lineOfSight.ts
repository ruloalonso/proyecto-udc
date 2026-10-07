import type { MapData, Obstacle, Point } from "../map/index.js";

/**
 * ¿Atraviesa el segmento a→b la caja? Rozar un borde o una esquina no cuenta.
 * Misma convención de rotación que `pushCircleOutOfBox` (ver collision.ts).
 */
export function segmentCrossesBox(a: Point, b: Point, box: Obstacle): boolean {
  const cos = Math.cos(box.rot);
  const sin = Math.sin(box.rot);
  // Extremos en coordenadas locales de la caja.
  const ax = (a.x - box.x) * cos + (a.z - box.z) * sin;
  const az = -(a.x - box.x) * sin + (a.z - box.z) * cos;
  const bx = (b.x - box.x) * cos + (b.z - box.z) * sin;
  const bz = -(b.x - box.x) * sin + (b.z - box.z) * cos;

  // Recorte por franjas (slabs): el tramo [t0, t1] del segmento que queda dentro.
  let t0 = 0;
  let t1 = 1;
  for (const [p, q, half] of [
    [ax, bx, box.w / 2],
    [az, bz, box.d / 2],
  ] as const) {
    const d = q - p;
    if (d === 0) {
      // Paralelo a esta franja: o va por dentro o no la toca.
      if (p <= -half || p >= half) return false;
      continue;
    }
    let tIn = (-half - p) / d;
    let tOut = (half - p) / d;
    if (tIn > tOut) [tIn, tOut] = [tOut, tIn];
    t0 = Math.max(t0, tIn);
    t1 = Math.min(t1, tOut);
    if (t0 >= t1) return false;
  }
  return true;
}

/**
 * Línea de visión entre dos puntos (E3-3): ningún obstáculo del mapa se cruza
 * en medio. El mundo es plano, así que cualquier obstáculo tapa, sea cual sea su altura.
 */
export function hasLineOfSight(a: Point, b: Point, map: MapData): boolean {
  for (const box of map.obstacles) {
    if (segmentCrossesBox(a, b, box)) return false;
  }
  return true;
}
