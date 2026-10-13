/**
 * Cursor sobre el juego: la mano encima de lo que se puede pulsar (un centollo para elegirlo
 * de objetivo; de espectador, un compañero para seguirle) y la mira mientras se apunta la
 * granada, que se lanza con el clic. Arrastrando para girar la cámara, el normal.
 */
export type GameCursor = "" | "pointer" | "crosshair";

export function cursorFor(state: {
  dragging: boolean;
  aimingGrenade: boolean;
  overClickable: boolean;
}): GameCursor {
  if (state.dragging) return "";
  if (state.aimingGrenade) return "crosshair";
  return state.overClickable ? "pointer" : "";
}

/** Cada cuánto se mira qué hay bajo el puntero (el `pick` recorre las mallas: no a cada frame). */
export const HOVER_PICK_MS = 100;
