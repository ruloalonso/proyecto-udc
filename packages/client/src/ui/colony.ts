/**
 * Rótulo de un edificio de colonos (E6-2). Sin activar no se sabe cuántos hay dentro (spec §4.5);
 * activado, cuántos quedan.
 */
export function buildingLabel(remaining: number | null): string {
  if (remaining === null) return "¿Colonos?";
  if (remaining === 0) return "Vacío";
  return remaining === 1 ? "1 colono" : `${remaining} colonos`;
}

/** Aviso al activar un edificio, en el tono de la casa. */
export function activateText(who: string | null, building: number, colonists: number): string {
  const by = who === null ? "Ha activado" : `${who} activa`;
  return (
    `${by} el edificio ${building + 1}: ${colonists} colonos salen hacia la plataforma. ` +
    "Escóltelos; son contribuyentes."
  );
}
