import { GAME_CONFIG, TICK_SECONDS } from "@udc/shared";
import { TickHistogram, type TickSummary } from "./tickHistogram.js";

/** Informe de una prueba de carga (E7-5), en JSON. */
export interface LoadReport {
  /** Segundos medidos (con algún jugador conectado). */
  seconds: number;
  /** Tiempo de tick de reloj: incluye las esperas si la máquina está ocupada con otra cosa. */
  wall: TickSummary;
  /** Tiempo de tick de CPU del proceso: lo que el servidor trabaja de verdad. */
  cpu: TickSummary;
  /**
   * Tiempo de tick de CPU del hilo que lo ejecuta. El del proceso suma además lo que hacen a la
   * vez otros hilos (el marcado concurrente del recolector de basura), que no retrasa el tick.
   */
  threadCpu: TickSummary;
  /** Bajada media por cliente, en KB/s. */
  downKBps: number;
  /** Jugadores y centollos vivos, de media. */
  avgPlayers: number;
  avgCrabs: number;
}

/**
 * Mide una prueba de carga (E7-5): cada tick, su tiempo de reloj y de CPU, cuántos jugadores y
 * centollos había y cuántos bytes se mandaron a los jugadores. Solo cuenta mientras hay alguien.
 */
export class LoadRecorder {
  private readonly wall = new TickHistogram();
  private readonly cpu = new TickHistogram();
  private readonly threadCpu = new TickHistogram();
  private ticks = 0;
  private playerTicks = 0;
  private crabTicks = 0;
  private bytes = 0;

  /** Bytes enviados a un jugador. */
  addBytes(n: number): void {
    this.bytes += n;
  }

  recordTick(
    wallMs: number,
    cpuMs: number,
    threadCpuMs: number,
    players: number,
    crabs: number,
  ): void {
    if (players === 0) return;
    this.wall.record(wallMs);
    this.cpu.record(cpuMs);
    this.threadCpu.record(threadCpuMs);
    this.ticks++;
    this.playerTicks += players;
    this.crabTicks += crabs;
  }

  report(): LoadReport {
    const budget = GAME_CONFIG.budget.tickMs;
    const clientSeconds = this.playerTicks * TICK_SECONDS;
    return {
      seconds: this.ticks * TICK_SECONDS,
      wall: this.wall.summary(budget),
      cpu: this.cpu.summary(budget),
      threadCpu: this.threadCpu.summary(budget),
      downKBps: clientSeconds > 0 ? this.bytes / clientSeconds / 1024 : 0,
      avgPlayers: this.ticks > 0 ? this.playerTicks / this.ticks : 0,
      avgCrabs: this.ticks > 0 ? this.crabTicks / this.ticks : 0,
    };
  }
}
