/** Milisegundos que se mantiene una elección a mano mientras el servidor no la confirma. */
const MANUAL_HOLD_MS = 1000;

/**
 * Objetivo del jugador en el cliente (E3-5). Manda el servidor: elige solo cuando el soldado
 * se queda sin objetivo y lo cuenta en cada snapshot. Lo que el jugador elige a mano (clic, Tab,
 * Escape) se ve al momento y se mantiene hasta que el servidor lo confirma, para que el anillo
 * no parpadee mientras el mensaje va de camino; si no llega a confirmarlo (el objetivo murió
 * antes), manda el servidor pasado un segundo.
 */
export class TargetSync {
  current: number | null = null;
  private manual: { id: number | null; until: number } | null = null;

  /** Elección a mano. Devuelve `true` si cambia y hay que mandarla al servidor. */
  choose(id: number | null, now: number): boolean {
    if (id === this.current) return false;
    this.current = id;
    this.manual = { id, until: now + MANUAL_HOLD_MS };
    return true;
  }

  /** Objetivo que tiene el servidor, según el último snapshot. */
  fromServer(id: number | null, now: number): void {
    if (this.manual) {
      if (id !== this.manual.id && now < this.manual.until) return;
      this.manual = null;
    }
    this.current = id;
  }

  /** Una entidad deja de dibujarse: si era el objetivo, se quita aquí (el servidor ya lo sabe). */
  removed(id: number): void {
    if (this.current === id) this.current = null;
  }
}
