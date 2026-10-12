/**
 * Simulador para afinar el director de oleadas y los bots: juega partidas completas, aceleradas
 * y sin red, con el pelotón entero de bots del servidor (los mismos que acompañan a un jugador,
 * E5-6) y el director de verdad. Cuenta cuándo caen (sin reaparición: cada muerte es para
 * siempre), los derribos y rescates, y por cada viaje (#80) cuándo sale la fila del edificio que
 * se evacua, cuántos centollos hay mientras tanto y cuántos rondan la fila, y cuántos colonos
 * mueren y embarcan. También el tiempo de cada tick.
 *
 * Uso: pnpm tune [-- base empujón crecimiento semilla partidas]
 *   base        `director.baseRate` (centollos por minuto)
 *   empujón     `director.pushFactor`
 *   crecimiento `director.growthPerMinute`
 *   semilla     del azar (para comparar configuraciones con la misma partida)
 *   partidas    cuántas partidas seguidas, con semillas consecutivas: una línea por partida y
 *               la media (con una sola, el detalle)
 * Lo que no se indique sale de `game.config.ts`. Una partida tarda unos segundos.
 * `TUNE_BOT='{"escortShare":0}'` cambia valores de `bot` (para comparar con y sin una pieza).
 */
import { GAME_CONFIG, MAP, TICK_SECONDS } from "@udc/shared";
import { buildNavMesh, type NavMap } from "../ai/navmesh.js";
import { World } from "../match/world.js";

const [base, push, growth, seedArg, gamesArg] = process.argv
  .slice(2)
  .filter((a) => a !== "--")
  .map(Number);

// Solo para esta herramienta: se sobrescriben los valores de la configuración en memoria.
const director = GAME_CONFIG.director as unknown as Record<string, number>;
if (base !== undefined && !Number.isNaN(base)) director.baseRate = base;
if (push !== undefined && !Number.isNaN(push)) director.pushFactor = push;
if (growth !== undefined && !Number.isNaN(growth)) director.growthPerMinute = growth;
// Valores de los bots (E5-7), en JSON: TUNE_BOT='{"escortShare":0,"reviveRange":0}'.
Object.assign(GAME_CONFIG.bot, JSON.parse(process.env.TUNE_BOT ?? "{}"));
const firstSeed = seedArg && !Number.isNaN(seedArg) ? seedArg : 1;
const games = gamesArg && !Number.isNaN(gamesArg) ? Math.max(1, Math.round(gamesArg)) : 1;

const ticks = (seconds: number) => Math.round(seconds / TICK_SECONDS);
const { launches } = GAME_CONFIG.shuttles;
const { pushSeconds } = GAME_CONFIG.director;
const finalStart = launches[launches.length - 1]!;
const end = ticks(finalStart + 60);
/** Ventanas que se resumen: cada empujón y el primer minuto de la oleada final. */
const windows = [
  ...launches.map((l, i) => ({
    name: `empujón ${i + 1}`,
    from: ticks(l - pushSeconds),
    to: ticks(l),
  })),
  { name: "final (60 s)", from: ticks(finalStart), to: end },
];
/** Cada cuántos ticks se mide la presión sobre la fila. */
const SAMPLE_TICKS = 10;
const NEAR = 20;

/** Un viaje: desde que el Alto Mando abre su edificio hasta que despega su lanzadera. */
interface Trip {
  building: number;
  from: number;
  emptyAt: number | null;
  launchAt: number | null;
  samples: number;
  crabsSum: number;
  peak: number;
  /** Centollos a menos de `NEAR` m de algún colono en camino (sumados por muestra). */
  nearSum: number;
  killed: number;
  boarded: number | null;
  destroyed: boolean;
}

interface Game {
  seed: number;
  /** Tick de cada muerte, en orden. */
  falls: number[];
  wipedAt: number | null;
  downs: number;
  rescues: number;
  rescuesCut: number;
  /** Muertos por desangrarse (se les acabó el tiempo derribados). */
  bledOut: number;
  /** Muertes por causa (tiempo, sin nadie en pie, granada, nave). */
  causes: Record<string, number>;
  /** Colonos muertos por el camino. */
  colonistsKilled: number;
  shipsDestroyed: number;
  saved: number;
  perMinute: number[];
  alivePerMinute: number[];
  windowDeaths: number[];
  windowPeak: number[];
  trips: Trip[];
  tickMs: number[];
}

function play(nav: NavMap, seed: number): Game {
  // Azar reproducible: el de la partida (apariciones, madrigueras) y el de los bots.
  let state = seed;
  Math.random = () => ((state = (state * 16807) % 2147483647) - 1) / 2147483646;

  const world = new World({ ...MAP, dummies: [] }, nav);
  world.squadBots = true;
  world.addBotSquad();

  const g: Game = {
    seed,
    falls: [],
    wipedAt: null,
    downs: 0,
    rescues: 0,
    rescuesCut: 0,
    bledOut: 0,
    causes: {},
    colonistsKilled: 0,
    shipsDestroyed: 0,
    saved: 0,
    perMinute: [],
    alivePerMinute: [],
    windowDeaths: windows.map(() => 0),
    windowPeak: windows.map(() => 0),
    trips: [],
    tickMs: [],
  };

  for (let t = 1; t <= end && world.soldiers.size > 0; t++) {
    const start = performance.now();
    world.step();
    g.tickMs.push(performance.now() - start);

    const trip = g.trips[g.trips.length - 1];
    for (const e of world.events) {
      if (e.k === "activate") {
        g.trips.push({
          building: e.building,
          from: t,
          emptyAt: null,
          launchAt: null,
          samples: 0,
          crabsSum: 0,
          peak: 0,
          nearSum: 0,
          killed: 0,
          boarded: null,
          destroyed: false,
        });
      } else if (e.k === "downed") g.downs++;
      else if (e.k === "rescued") g.rescues++;
      else if (e.k === "rescueStop" && e.reason !== "died") g.rescuesCut++;
      else if (e.k === "death") {
        g.falls.push(t);
        g.causes[e.cause] = (g.causes[e.cause] ?? 0) + 1;
        if (e.cause === "time") g.bledOut++;
      } else if (e.k === "colonistKilled") {
        g.colonistsKilled++;
        if (trip) trip.killed++;
      } else if (e.k === "shuttleDestroyed") {
        g.shipsDestroyed++;
        if (trip) trip.destroyed = true;
      } else if (trip && e.k === "launch" && trip.launchAt === null) {
        trip.launchAt = t;
        trip.boarded = e.boarded;
      }
    }
    const current = g.trips[g.trips.length - 1];
    if (current && current.launchAt === null && t % SAMPLE_TICKS === 0) {
      if (current.emptyAt === null && world.colony.remainingIn(current.building) === 0) {
        current.emptyAt = t;
      }
      const walking: { x: number; z: number }[] = [];
      world.crabs!.forEachColonist((c) => walking.push(c));
      let near = 0;
      world.crabs!.forEach((c) => {
        if (walking.some((w) => Math.hypot(w.x - c.x, w.z - c.z) < NEAR)) near++;
      });
      current.samples++;
      current.crabsSum += world.crabs!.count;
      current.peak = Math.max(current.peak, world.crabs!.count);
      current.nearSum += near;
    }

    const died = world.events.filter((e) => e.k === "death").length;
    const minute = Math.floor((t * TICK_SECONDS) / 60);
    g.perMinute[minute] = (g.perMinute[minute] ?? 0) + died;
    g.alivePerMinute[minute] = world.soldiers.size;
    if (world.soldiers.size === 0) g.wipedAt = t;
    windows.forEach((w, i) => {
      if (t < w.from || t >= w.to) return;
      g.windowDeaths[i]! += died;
      g.windowPeak[i] = Math.max(g.windowPeak[i]!, world.crabs!.count);
    });
  }
  g.saved = world.match.saved;
  world.crabs!.destroy();
  return g;
}

const clock = (t: number) => {
  const s = Math.round(t * TICK_SECONDS);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const series = (values: number[]) =>
  Array.from({ length: values.length }, (_, i) => values[i] ?? 0).join(" ");
const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(p * (sorted.length - 1))] ?? 0;
};
const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

function printGame(g: Game): void {
  console.log(`Primera muerte  ${g.falls.length ? clock(g.falls[0]!) : "ninguna"}`);
  console.log(`Pelotón caído   ${g.wipedAt === null ? "no" : clock(g.wipedAt)}`);
  console.log(`Caídas          ${g.falls.map(clock).join(" ") || "ninguna"}`);
  console.log(
    `Derribos        ${g.downs} · rescates ${g.rescues} (cortados ${g.rescuesCut})` +
      ` · desangrados ${g.bledOut}`,
  );
  console.log(`Muertes/minuto  ${series(g.perMinute)}`);
  console.log(`En pie/minuto   ${series(g.alivePerMinute)}`);
  for (const [i, w] of windows.entries()) {
    console.log(
      `${w.name.padEnd(16)}${g.windowDeaths[i]} muertes, pico de ${g.windowPeak[i]} centollos`,
    );
  }
  console.log(
    "Viajes (edificio · fila · centollos medios/pico · junto a la fila · colonos muertos/embarcados)",
  );
  for (const [i, trip] of g.trips.entries()) {
    const avg = (sum: number) => (trip.samples ? Math.round(sum / trip.samples) : 0);
    const fila = `${clock(trip.from)}–${trip.emptyAt === null ? "?" : clock(trip.emptyAt)}`;
    const launched = trip.destroyed
      ? "nave destruida"
      : `${trip.boarded ?? "?"} embarcados a las ${trip.launchAt === null ? "?" : clock(trip.launchAt)}`;
    console.log(
      `  ${i + 1}. edificio ${trip.building + 1} · fila ${fila} · ${avg(trip.crabsSum)}/${trip.peak}` +
        ` · ${avg(trip.nearSum)} · ${trip.killed} muertos, ${launched}`,
    );
  }
  console.log(
    `Colonos a salvo ${g.saved} · naves destruidas ${g.shipsDestroyed}` +
      ` · tick medio ${mean(g.tickMs).toFixed(2)} ms, p99 ${percentile(g.tickMs, 0.99).toFixed(2)} ms`,
  );
}

const nav = await buildNavMesh(MAP);
console.log(
  `base ${director.baseRate} · empujón × ${director.pushFactor} · crecimiento ${director.growthPerMinute}` +
    ` · semilla ${firstSeed}${games > 1 ? ` · ${games} partidas` : ""}`,
);
const results: Game[] = [];
for (let i = 0; i < games; i++) {
  const g = play(nav, firstSeed + i);
  results.push(g);
  if (games === 1) {
    printGame(g);
    break;
  }
  console.log(
    `semilla ${String(g.seed).padStart(3)} · cae ${g.wipedAt === null ? "no  " : clock(g.wipedAt)}` +
      ` · derribos ${g.downs} · rescates ${g.rescues} (cortados ${g.rescuesCut})` +
      ` · desangrados ${g.bledOut} · naves destruidas ${g.shipsDestroyed} · a salvo ${g.saved}` +
      ` · colonos muertos ${g.colonistsKilled}`,
  );
}
if (games > 1) {
  // Sin caer en la partida simulada cuenta como el final de la simulación.
  const wiped = results.map((g) => g.wipedAt ?? end);
  console.log(
    `Media           cae ${clock(mean(wiped))} (antes de la oleada final: ` +
      `${results.filter((g) => g.wipedAt !== null && g.wipedAt < ticks(finalStart)).length}/${games})` +
      ` · derribos ${mean(results.map((g) => g.downs)).toFixed(1)}` +
      ` · rescates ${mean(results.map((g) => g.rescues)).toFixed(1)}` +
      ` (cortados ${mean(results.map((g) => g.rescuesCut)).toFixed(1)})` +
      ` · desangrados ${mean(results.map((g) => g.bledOut)).toFixed(1)}` +
      ` · naves destruidas ${mean(results.map((g) => g.shipsDestroyed)).toFixed(1)}` +
      ` · a salvo ${mean(results.map((g) => g.saved)).toFixed(0)}` +
      ` · colonos muertos ${mean(results.map((g) => g.colonistsKilled)).toFixed(1)}`,
  );
  // Sangría (objetivo de E5-7): de la primera muerte a la última, si cae antes de la final.
  const early = results.filter((g) => g.wipedAt !== null && g.wipedAt < ticks(finalStart));
  const bleed = early.map((g) => g.wipedAt! - g.falls[0]!);
  console.log(
    `Sangría         de la primera muerte a la última ${clock(mean(bleed))} de media` +
      ` · en menos de 2 min: ${bleed.filter((b) => b < ticks(120)).length}/${early.length}`,
  );
  const causes = new Map<string, number>();
  for (const g of results) {
    for (const [cause, n] of Object.entries(g.causes))
      causes.set(cause, (causes.get(cause) ?? 0) + n);
  }
  console.log(
    `Muertes         ${[...causes].map(([c, n]) => `${c} ${(n / games).toFixed(1)}`).join(" · ")}`,
  );
  const allTicks = results.flatMap((g) => g.tickMs);
  console.log(
    `Tick            medio ${mean(allTicks).toFixed(2)} ms · p99 ${percentile(allTicks, 0.99).toFixed(2)} ms`,
  );
}
nav.destroy();
