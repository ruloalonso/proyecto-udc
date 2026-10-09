/**
 * Rótulo de un edificio de colonos (E6-2). Sin abrir no se sabe cuántos hay dentro (spec §4.5);
 * abierto, cuántos quedan; el que se evacua, además, lo dice.
 */
export function buildingLabel(remaining: number | null, evacuating = false): string {
  if (remaining === null) return "¿Colonos?";
  if (evacuating) return remaining === 0 ? "Evacuado" : `Evacuando · ${remaining}`;
  if (remaining === 0) return "Vacío";
  return remaining === 1 ? "1 colono" : `${remaining} colonos`;
}

/** Aviso cuando el Alto Mando ordena evacuar un edificio. */
export function activateText(building: number, colonists: number): string {
  return (
    `Orden del Alto Mando: evacuad el edificio ${building + 1}. ` +
    `${colonists} colonos saldrán de uno en uno hacia la plataforma. Escoltadlos.`
  );
}
