/** Resumen de una serie de tiempos de tick, en ms. */
export interface TickSummary {
  count: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  /** Porcentaje de ticks por encima del presupuesto. */
  overBudgetPct: number;
}

/**
 * Todos los tiempos de tick de una prueba de carga (E7-5), para dar percentiles. Diez minutos a
 * 20 Hz son 12.000 números: se guardan tal cual.
 */
export class TickHistogram {
  private readonly samples: number[] = [];

  record(ms: number): void {
    this.samples.push(ms);
  }

  summary(budgetMs: number): TickSummary {
    const sorted = [...this.samples].sort((a, b) => a - b);
    const n = sorted.length;
    if (n === 0) return { count: 0, avg: 0, p50: 0, p95: 0, p99: 0, max: 0, overBudgetPct: 0 };
    /** Percentil por el método del rango más cercano. */
    const pct = (p: number) => sorted[Math.min(n - 1, Math.ceil((p / 100) * n) - 1)]!;
    return {
      count: n,
      avg: sorted.reduce((a, b) => a + b, 0) / n,
      p50: pct(50),
      p95: pct(95),
      p99: pct(99),
      max: sorted[n - 1]!,
      overBudgetPct: (sorted.filter((ms) => ms > budgetMs).length / n) * 100,
    };
  }
}
