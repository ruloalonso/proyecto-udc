import type { Point } from "../map/index.js";

/**
 * Primer punto del tramo `a → b` que toca un círculo de radio `r` centrado en `c`, como fracción
 * del tramo (0 = en `a`, 1 = en `b`), o `null` si no lo toca. Si `a` ya está dentro, 0.
 * Sirve para proyectiles rápidos: no atraviesan nada aunque avancen más que su tamaño en un tick.
 */
export function segmentCircleHit(a: Point, b: Point, c: Point, r: number): number | null {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const fx = a.x - c.x;
  const fz = a.z - c.z;
  const cc = fx * fx + fz * fz - r * r;
  if (cc <= 0) return 0;
  const aa = dx * dx + dz * dz;
  if (aa === 0) return null;
  const bb = 2 * (fx * dx + fz * dz);
  const disc = bb * bb - 4 * aa * cc;
  if (disc < 0) return null;
  const t = (-bb - Math.sqrt(disc)) / (2 * aa);
  return t >= 0 && t <= 1 ? t : null;
}
