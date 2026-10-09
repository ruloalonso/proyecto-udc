import { describe, expect, it } from "vitest";
import { GAME_CONFIG, TICK_SECONDS } from "@udc/shared";
import { LoadRecorder } from "./loadReport.js";

describe("LoadRecorder", () => {
  it("bajada por cliente: bytes entre segundos-jugador", () => {
    const r = new LoadRecorder();
    // 1 s con 2 jugadores, 20 KB a cada uno.
    for (let i = 0; i < GAME_CONFIG.net.tickRate; i++) r.recordTick(1, 1, 1, 2, 150);
    r.addBytes(2 * 20 * 1024);
    const report = r.report();
    expect(report.seconds).toBeCloseTo(1);
    expect(report.downKBps).toBeCloseTo(20);
    expect(report.avgPlayers).toBe(2);
    expect(report.avgCrabs).toBe(150);
  });

  it("no cuenta los ticks sin jugadores", () => {
    const r = new LoadRecorder();
    r.recordTick(50, 50, 50, 0, 0);
    r.recordTick(2, 1, 0.8, 1, 10);
    const report = r.report();
    expect(report.seconds).toBeCloseTo(TICK_SECONDS);
    expect(report.wall.max).toBe(2);
    expect(report.cpu.max).toBe(1);
    expect(report.threadCpu.max).toBe(0.8);
  });
});
