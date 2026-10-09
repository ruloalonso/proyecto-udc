/**
 * Prueba de carga (E7-5): 8 bots que combaten contra 150 centollos (la mezcla de la oleada
 * final) durante 10 minutos, con los 4 edificios activados (200 colonos, E6-2), y comprobación
 * de NFR-01 y NFR-03.
 *
 * Uso: pnpm loadtest [-- segundos]   (por defecto, 600)
 *
 * Arranca un servidor propio en un puerto libre, sin red simulada y con `LOAD_REPORT`, para que
 * mida cada tick (reloj y CPU) y la bajada por cliente; lanza los bots; al acabar, para el
 * servidor, lee su informe y lo resume. Termina con error si no se cumple algún requisito.
 *
 * Criterio de NFR-01 (ver docs/decisiones.md): el p99 del tiempo de CPU del tick por debajo de
 * 10 ms. El tiempo de reloj se muestra, pero en un portátil con los bots al lado incluye
 * esperas que no son del servidor.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GAME_CONFIG } from "@udc/shared";

interface TickSummary {
  count: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  overBudgetPct: number;
}

/** El informe que escribe el servidor (`server/src/net/loadReport.ts`). */
interface LoadReport {
  seconds: number;
  wall: TickSummary;
  cpu: TickSummary;
  downKBps: number;
  avgPlayers: number;
  avgCrabs: number;
}

const args = process.argv.slice(2).filter((a) => a !== "--");
const SECONDS = Number(args[0] ?? 600);
const BOTS = GAME_CONFIG.match.maxPlayers;
const { maxAlive, spitterRatioTo } = GAME_CONFIG.director;
const SPITTERS = Math.round(maxAlive * spitterRatioTo);
const CRABS = maxAlive - SPITTERS;
const { tickMs: TICK_BUDGET, downKBps: DOWN_BUDGET } = GAME_CONFIG.budget;

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = join(here, "../../server");
const botsDir = join(here, "..");

/** Un puerto libre en esta máquina. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, () => {
      const address = probe.address();
      probe.close(() => resolve(typeof address === "object" && address ? address.port : 0));
    });
  });
}

/** Ejecuta un script TypeScript con tsx, desde la carpeta de su paquete. */
function run(cwd: string, script: string, scriptArgs: string[], env: NodeJS.ProcessEnv) {
  return spawn(process.execPath, ["--import", "tsx", script, ...scriptArgs], {
    cwd,
    env,
    stdio: ["ignore", "pipe", "inherit"],
  });
}

/** Llama a `onLine` con cada línea de la salida estándar del proceso. */
function lines(child: ChildProcess, onLine: (line: string) => void): void {
  let buffer = "";
  child.stdout?.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";
    parts.forEach(onLine);
  });
}

const exited = (child: ChildProcess) =>
  new Promise<void>((resolve) => {
    if (child.exitCode !== null) resolve();
    else child.once("exit", () => resolve());
  });

const ms = (v: number) => `${v.toFixed(2)} ms`;
const summaryLine = (s: TickSummary) =>
  `media ${ms(s.avg)} · p50 ${ms(s.p50)} · p95 ${ms(s.p95)} · p99 ${ms(s.p99)}` +
  ` · máx ${ms(s.max)} · >${TICK_BUDGET} ms: ${s.overBudgetPct.toFixed(2)}%`;

async function main(): Promise<void> {
  const port = await freePort();
  const reportPath = join(mkdtempSync(join(tmpdir(), "udc-carga-")), "informe.json");
  // Sin red simulada: NFR-01 y NFR-03 miden el servidor.
  const env = { ...process.env };
  for (const key of ["SIM_LATENCY_MS", "SIM_JITTER_MS", "SIM_LOSS", "SIM_RTO_MS"]) delete env[key];

  console.log(
    `Prueba de carga: ${BOTS} bots, ${CRABS} rasos y ${SPITTERS} escupidores, ${SECONDS} s` +
      ` (puerto ${port})`,
  );
  const server = run(serverDir, "src/index.ts", [], {
    ...env,
    PORT: String(port),
    CRABS: String(CRABS),
    SPITTERS: String(SPITTERS),
    LOAD_REPORT: reportPath,
    // Peor caso (E6-2): los 200 colonos en marcha además de los centollos. `BUILDINGS=closed`
    // para medir sin ellos.
    BUILDINGS: process.env.BUILDINGS ?? "open",
  });
  const ready = new Promise<void>((resolve) => {
    let progress = 0;
    lines(server, (line) => {
      if (line.includes("escuchando")) resolve();
      // Progreso cada 30 s (la consola del servidor informa cada 5).
      if (line.startsWith("tick ") && progress++ % 6 === 0) console.log(`  ${line}`);
    });
  });
  await ready;

  let damage = 0;
  let deaths = 0;
  const bots = run(botsDir, "src/index.ts", [String(BOTS), String(SECONDS)], {
    ...env,
    SERVER_URL: `ws://localhost:${port}`,
  });
  lines(bots, (line) => {
    damage += Number(/daño\s+(\d+)/.exec(line)?.[1] ?? 0);
    deaths += Number(/muertes (\d+)/.exec(line)?.[1] ?? 0);
  });
  await exited(bots);

  server.kill("SIGINT");
  await exited(server);
  const report = JSON.parse(readFileSync(reportPath, "utf8")) as LoadReport;

  const nfr01 = report.cpu.p99 < TICK_BUDGET;
  const nfr03 = report.downKBps < DOWN_BUDGET;
  const mark = (ok: boolean) => (ok ? "✓" : "✗");
  console.log("");
  console.log(
    `Medido       ${report.seconds.toFixed(0)} s con ${report.avgPlayers.toFixed(1)} jugadores y ${report.avgCrabs.toFixed(1)} centollos de media`,
  );
  console.log(`Tick (CPU)   ${summaryLine(report.cpu)}`);
  console.log(`Tick (reloj) ${summaryLine(report.wall)}`);
  console.log(`Bajada       ${report.downKBps.toFixed(1)} KB/s por cliente`);
  console.log(`Combate      ${damage} de daño hecho, ${deaths} muerte${deaths === 1 ? "" : "s"}`);
  console.log(`${mark(nfr01)} NFR-01: p99 del tick de CPU < ${TICK_BUDGET} ms`);
  console.log(`${mark(nfr03)} NFR-03: bajada media < ${DOWN_BUDGET} KB/s por cliente`);
  if (report.wall.overBudgetPct > 0) {
    console.log(
      `  (El reloj pasa de ${TICK_BUDGET} ms en el ${report.wall.overBudgetPct.toFixed(2)}% de los ticks:` +
        " esperas de la máquina, no trabajo del servidor, si el de CPU no lo hace.)",
    );
  }
  process.exit(nfr01 && nfr03 ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
