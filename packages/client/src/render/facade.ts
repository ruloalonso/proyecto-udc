import type { Point } from "@udc/shared";

/** Caja del mapa, con la convención de rotación de `shared/src/sim/collision.ts`. */
interface Box {
  x: number;
  z: number;
  w: number;
  d: number;
  rot: number;
}

export interface Facade {
  /** Centro de la pared, en el suelo. */
  x: number;
  z: number;
  /** Normal hacia fuera. */
  nx: number;
  nz: number;
  /** Ancho de la pared. */
  width: number;
}

/**
 * La pared de una caja que mira hacia `toward` (para los carteles de los edificios, #78: la de
 * la puerta, que da a la plataforma). Los ejes locales pasan a mundo como en la colisión:
 * X → (cos rot, sin rot) y Z → (−sin rot, cos rot).
 */
export function facadeFacing(box: Box, toward: Point): Facade {
  const cos = Math.cos(box.rot);
  const sin = Math.sin(box.rot);
  const faces = [
    { nx: cos, nz: sin, half: box.w / 2, width: box.d },
    { nx: -cos, nz: -sin, half: box.w / 2, width: box.d },
    { nx: -sin, nz: cos, half: box.d / 2, width: box.w },
    { nx: sin, nz: -cos, half: box.d / 2, width: box.w },
  ];
  const dx = toward.x - box.x;
  const dz = toward.z - box.z;
  let best = faces[0]!;
  for (const f of faces) if (f.nx * dx + f.nz * dz > best.nx * dx + best.nz * dz) best = f;
  return {
    x: box.x + best.nx * best.half,
    z: box.z + best.nz * best.half,
    nx: best.nx,
    nz: best.nz,
    width: best.width,
  };
}
