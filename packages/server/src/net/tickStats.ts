/** Acumula la duración de los ticks y da la media y el máximo de cada ventana. */
export class TickStats {
  private total = 0;
  private max = 0;
  private count = 0;

  record(ms: number): void {
    this.total += ms;
    this.max = Math.max(this.max, ms);
    this.count++;
  }

  /** Media y máximo desde la última llamada (y empieza una ventana nueva). `null` si no hubo ticks. */
  take(): { avg: number; max: number } | null {
    if (this.count === 0) return null;
    const result = { avg: this.total / this.count, max: this.max };
    this.total = 0;
    this.max = 0;
    this.count = 0;
    return result;
  }
}
