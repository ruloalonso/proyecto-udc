/**
 * Simulador para afinar el director de oleadas: juega una partida completa, acelerada y sin red,
 * con 8 soldados que piensan con el cerebro de los bots (`BotBrain`) y el director de verdad, y
 * cuenta cuándo mueren y cuántos quedan en pie (sin reaparición: cada muerte es para siempre).
 * Por cada viaje (#80): cuándo sale la fila del edificio que se evacua, cuántos centollos hay
 * mientras tanto y cuántos rondan la fila, y cuántos colonos mueren y embarcan.
 *
 * Uso: pnpm tune [-- base empujón crecimiento semilla]
 *   base        `director.baseRate` (centollos por minuto)
 *   empujón     `director.pushFactor`
 *   crecimiento `director.growthPerMinute`
 *   semilla     del azar (para comparar configuraciones con la misma partida)
 * Lo que no se indique sale de `game.config.ts`. Una partida tarda unos segundos.
 */
import { BotBrain, EntityKind, GAME_CONFIG, MAP, TICK_SECONDS, type BotEntity } from "@udc/shared";
import { buildNavMesh } from "../ai/navmesh.js";
import { remainingCooldowns } from "../match/abilities.js";
import { World } from "../match/world.js";

const [base, push, growth, seedArg] = process.argv
  .slice(2)
  .filter((a) => a !== "--")
  .map(Number);

// Solo para esta herramienta: se sobrescriben los valores de la configuración en memoria.
const director = GAME_CONFIG.director as unknown as Record<string, number>;
if (base !== undefined && !Number.isNaN(base)) director.baseRate = base;
if (push !== undefined && !Number.isNaN(push)) director.pushFactor = push;
if (growth !== undefined && !Number.isNaN(growth)) director.growthPerMinute = growth;

// Azar reproducible: el de la partida (apariciones, madrigueras) y el de los bots.
let seed = seedArg && !Number.isNaN(seedArg) ? seedArg : 1;
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
Math.random = random;

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

const nav = await buildNavMesh(MAP);
const world = new World({ ...MAP, dummies: [] }, nav);
// Sin reaparición (E5-4): cada muerte es un soldado menos. Por eso se lleva el cerebro por id.
const brains = new Map<number, BotBrain>();
for (let i = 0; i < GAME_CONFIG.match.maxPlayers; i++) {
  brains.set(world.addSoldier().id, new BotBrain(MAP, random));
}

const perMinute: number[] = [];
/** Soldados en pie al acabar cada minuto (sin reaparición, el pelotón se desangra). */
const alivePerMinute: number[] = [];
const windowDeaths = windows.map(() => 0);
const windowPeak = windows.map(() => 0);
let firstDeath: number | null = null;
let wipedAt: number | null = null;

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
const trips: Trip[] = [];
/** Cada cuántos ticks se mide la presión sobre la fila. */
const SAMPLE_TICKS = 10;
const NEAR = 20;

for (let t = 1; t <= end && world.soldiers.size > 0; t++) {
  const entities: BotEntity[] = [];
  world.crabs!.forEach((c) => entities.push({ id: c.id, kind: c.kind, x: c.x, z: c.z }));
  for (const s of world.soldiers.values()) {
    entities.push({ id: s.id, kind: EntityKind.Soldier, x: s.state.x, z: s.state.z });
  }
  for (const s of world.soldiers.values()) {
    const brain = brains.get(s.id)!;
    const self = {
      x: s.state.x,
      z: s.state.z,
      yaw: s.state.yaw,
      hp: s.hp,
      cd: remainingCooldowns(s.cooldowns, world.tick),
      target: s.targetId,
    };
    const others = entities.filter((e) => e.id !== s.id);
    const { forward, strafe, yaw, ability } = brain.think(self, others);
    world.queueInput(s.id, { seq: t, forward, strafe, yaw, ...(ability ? { ability } : {}) });
  }
  world.step();

  const trip = trips[trips.length - 1];
  for (const e of world.events) {
    if (e.k === "activate") {
      trips.push({
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
    } else if (trip && e.k === "colonistKilled") trip.killed++;
    else if (trip && e.k === "launch" && trip.launchAt === null) {
      trip.launchAt = t;
      trip.boarded = e.boarded;
    } else if (trip && e.k === "shuttleDestroyed") trip.destroyed = true;
  }
  const current = trips[trips.length - 1];
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
  if (died > 0 && firstDeath === null) firstDeath = t;
  const minute = Math.floor((t * TICK_SECONDS) / 60);
  perMinute[minute] = (perMinute[minute] ?? 0) + died;
  alivePerMinute[minute] = world.soldiers.size;
  if (world.soldiers.size === 0) wipedAt = t;
  windows.forEach((w, i) => {
    if (t < w.from || t >= w.to) return;
    windowDeaths[i]! += died;
    windowPeak[i] = Math.max(windowPeak[i]!, world.crabs!.count);
  });
}

const clock = (t: number) => {
  const s = Math.round(t * TICK_SECONDS);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
console.log(
  `base ${director.baseRate} · empujón × ${director.pushFactor} · crecimiento ${director.growthPerMinute}` +
    ` · semilla ${seedArg || 1}`,
);
console.log(`Primera muerte  ${firstDeath === null ? "ninguna" : clock(firstDeath)}`);
console.log(`Pelotón caído   ${wipedAt === null ? "no" : clock(wipedAt)}`);
console.log(
  `Muertes/minuto  ${Array.from({ length: perMinute.length }, (_, i) => perMinute[i] ?? 0).join(" ")}`,
);
console.log(
  `En pie/minuto   ${Array.from({ length: alivePerMinute.length }, (_, i) => alivePerMinute[i] ?? 0).join(" ")}`,
);
for (const [i, w] of windows.entries()) {
  console.log(`${w.name.padEnd(16)}${windowDeaths[i]} muertes, pico de ${windowPeak[i]} centollos`);
}
console.log(
  "Viajes (edificio · fila · centollos medios/pico · junto a la fila · colonos muertos/embarcados)",
);
for (const [i, trip] of trips.entries()) {
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
world.crabs!.destroy();
nav.destroy();
