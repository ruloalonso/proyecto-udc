/**
 * Rótulo de un edificio de colonos (E6-2). Sin abrir no se sabe cuántos hay dentro (spec §4.5);
 * abierto, cuántos quedan; el que se evacua, además, lo dice.
 */
export function buildingLabel(remaining: number | null, evacuating = false): string {
  if (remaining === null) return "¿Colonos?";
  if (remaining === 0) return "Evacuado";
  if (evacuating) return `Evacuando · ${remaining}`;
  return remaining === 1 ? "1 colono" : `${remaining} colonos`;
}

/**
 * Edificio que se marca (columna de luz, rótulo resaltado y flecha): el que se evacua, mientras
 * le queden colonos dentro (#78). Vacío, deja de marcarse aunque su fila siga en camino.
 */
export function markedBuilding(
  buildings: readonly (number | null)[],
  evacuating: number | null,
): number | null {
  if (evacuating === null) return null;
  return (buildings[evacuating] ?? 0) > 0 ? evacuating : null;
}

/** Aviso cuando el Alto Mando ordena evacuar un edificio. */
export function activateText(building: number, colonists: number): string {
  return (
    `Orden del Alto Mando: evacuad el edificio ${building + 1}. ` +
    `${colonists} colonos saldrán de uno en uno hacia la plataforma. Escoltadlos.`
  );
}
