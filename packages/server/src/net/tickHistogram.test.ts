import { describe, expect, it } from "vitest";
import { TickHistogram } from "./tickHistogram.js";

describe("TickHistogram", () => {
  it("da media, percentiles, máximo y el porcentaje por encima del presupuesto", () => {
    const h = new TickHistogram();
    // 1..100 ms, desordenados.
    for (let i = 100; i >= 1; i--) h.record(i);
    const s = h.summary(90);
    expect(s.count).toBe(100);
    expect(s.avg).toBeCloseTo(50.5);
    expect(s.p50).toBe(50);
    expect(s.p95).toBe(95);
    expect(s.p99).toBe(99);
    expect(s.max).toBe(100);
    expect(s.overBudgetPct).toBe(10);
  });

  it("sin muestras, todo a cero", () => {
    expect(new TickHistogram().summary(10)).toMatchObject({ count: 0, max: 0, overBudgetPct: 0 });
  });

  it("un pico aislado sube el máximo pero no el p99", () => {
    const h = new TickHistogram();
    for (let i = 0; i < 1000; i++) h.record(2);
    h.record(40);
    const s = h.summary(10);
    expect(s.max).toBe(40);
    expect(s.p99).toBe(2);
    expect(s.overBudgetPct).toBeCloseTo(0.1, 1);
  });
});
