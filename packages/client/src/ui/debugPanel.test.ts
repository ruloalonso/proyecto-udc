import { describe, expect, it } from "vitest";
import { GAME_CONFIG } from "@udc/shared";
import { debugLines, type DebugInfo, type DebugLine } from "./debugPanel.js";

const info = (over: Partial<DebugInfo> = {}): DebugInfo => ({
  fps: 60,
  engine: "WebGL",
  rtt: 150,
  serverTick: 100,
  tickMs: 0.4,
  tickMaxMs: 1.2,
  soldiers: 2,
  dummies: 7,
  crabs: 105,
  spitters: 45,
  pending: 3,
  correction: 0,
  downKBps: 2,
  upKBps: 1,
  hp: 100,
  x: 0,
  z: 36,
  ...over,
});
const find = (lines: DebugLine[], start: string) => lines.find((l) => l.text.startsWith(start))!;

describe("debugLines", () => {
  it("muestra el tiempo de tick del servidor, las entidades y la red", () => {
    const lines = debugLines(info());
    expect(find(lines, "Servidor").text).toContain("0.40 ms/tick (máx 1.20)");
    expect(find(lines, "Entidades").text).toContain(
      "2 soldados, 105 rasos, 45 escupidores, 7 muñecos",
    );
    expect(find(lines, "Red").text).toContain("↓ 2.00 KB/s · ↑ 1.00 KB/s");
    expect(lines.some((l) => l.bad)).toBe(false);
  });

  it("singular para uno", () => {
    expect(
      find(debugLines(info({ soldiers: 1, dummies: 1, crabs: 1, spitters: 1 })), "Entidades").text,
    ).toContain("1 soldado, 1 raso, 1 escupidor, 1 muñeco");
  });

  it("antes del primer dato del servidor, lo dice", () => {
    expect(find(debugLines(info({ tickMs: null, tickMaxMs: null })), "Servidor").text).toContain(
      "esperando",
    );
  });

  it("marca en rojo lo que supera NFR-01 y NFR-03", () => {
    const lines = debugLines(
      info({
        tickMaxMs: GAME_CONFIG.budget.tickMs + 1,
        downKBps: GAME_CONFIG.budget.downKBps + 1,
      }),
    );
    expect(find(lines, "Servidor").bad).toBe(true);
    expect(find(lines, "Red").bad).toBe(true);
  });
});
