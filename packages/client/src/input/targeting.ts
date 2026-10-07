export interface TabCandidate {
  id: number;
  x: number;
  z: number;
}

export interface TabViewer {
  x: number;
  z: number;
  /** Hacia dónde mira la cámara, en la convención de la simulación (0 = +Z). */
  yaw: number;
}

/**
 * Siguiente objetivo al pulsar Tab (E2-4).
 *
 * Candidatos: los que están a `range` metros o menos y dentro de un cono de
 * semiángulo `halfAngle` alrededor de la dirección de la cámara. Se ordenan por
 * distancia y Tab pasa al siguiente del objetivo actual, volviendo al primero
 * al llegar al final. Si no hay candidatos, se conserva el objetivo actual.
 */
export function nextTabTarget(
  viewer: TabViewer,
  candidates: Iterable<TabCandidate>,
  currentId: number | null,
  range: number,
  halfAngle: number,
): number | null {
  const fx = Math.sin(viewer.yaw);
  const fz = Math.cos(viewer.yaw);
  const minCos = Math.cos(halfAngle);

  const inView: { id: number; dist: number }[] = [];
  for (const c of candidates) {
    const dx = c.x - viewer.x;
    const dz = c.z - viewer.z;
    const dist = Math.hypot(dx, dz);
    if (dist > range) continue;
    if (dist > 0 && (dx * fx + dz * fz) / dist < minCos) continue;
    inView.push({ id: c.id, dist });
  }
  if (inView.length === 0) return currentId;

  inView.sort((a, b) => a.dist - b.dist || a.id - b.id);
  const index = inView.findIndex((c) => c.id === currentId);
  return inView[(index + 1) % inView.length]!.id;
}
