import { describe, expect, it } from "vitest";
import { TickStats } from "./tickStats.js";

describe("TickStats", () => {
  it("sin ticks no hay datos", () => {
    expect(new TickStats().take()).toBeNull();
  });

  it("da la media y el máximo de la ventana", () => {
    const stats = new TickStats();
    for (const ms of [1, 2, 6]) stats.record(ms);
    expect(stats.take()).toEqual({ avg: 3, max: 6 });
  });

  it("cada lectura empieza una ventana nueva", () => {
    const stats = new TickStats();
    stats.record(9);
    stats.take();
    stats.record(1);
    expect(stats.take()).toEqual({ avg: 1, max: 1 });
  });
});
