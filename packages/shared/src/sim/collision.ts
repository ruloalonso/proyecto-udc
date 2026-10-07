import type { Obstacle } from "../map/index.js";

/**
 * Empuja un círculo fuera de una caja orientada sobre el plano XZ.
 * Devuelve la posición corregida (o la misma si no hay colisión).
 *
 * Convención de rotación: un punto local (lx, lz) pasa a mundo como
 *   x = box.x + lx·cos(rot) − lz·sin(rot)
 *   z = box.z + lx·sin(rot) + lz·cos(rot)
 * (En Babylon, que es levógiro, equivale a mesh.rotation.y = −rot.)
 */
export function pushCircleOutOfBox(
  x: number,
  z: number,
  radius: number,
  box: Obstacle,
): { x: number; z: number } {
  const cos = Math.cos(box.rot);
  const sin = Math.sin(box.rot);
  const dx = x - box.x;
  const dz = z - box.z;
  const lx = dx * cos + dz * sin;
  const lz = -dx * sin + dz * cos;

  const hw = box.w / 2;
  const hd = box.d / 2;

  let nx: number;
  let nz: number;

  if (Math.abs(lx) < hw && Math.abs(lz) < hd) {
    // Centro dentro de la caja: sacar por el lado más cercano.
    const penX = hw - Math.abs(lx);
    const penZ = hd - Math.abs(lz);
    if (penX < penZ) {
      nx = Math.sign(lx || 1) * (hw + radius);
      nz = lz;
    } else {
      nx = lx;
      nz = Math.sign(lz || 1) * (hd + radius);
    }
  } else {
    const cx = Math.max(-hw, Math.min(hw, lx));
    const cz = Math.max(-hd, Math.min(hd, lz));
    const ox = lx - cx;
    const oz = lz - cz;
    const distSq = ox * ox + oz * oz;
    if (distSq >= radius * radius) return { x, z };
    const dist = Math.sqrt(distSq);
    nx = cx + (ox / dist) * radius;
    nz = cz + (oz / dist) * radius;
  }

  return {
    x: box.x + nx * cos - nz * sin,
    z: box.z + nx * sin + nz * cos,
  };
}
