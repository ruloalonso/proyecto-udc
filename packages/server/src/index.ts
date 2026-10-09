import { WebSocketServer, type WebSocket } from "ws";
import {
  decodeMessage,
  encodeMessage,
  GAME_CONFIG,
  MAP,
  TICK_MS,
  type ClientMessage,
  type ServerMessage,
} from "@udc/shared";
import { buildNavMesh } from "./ai/navmesh.js";
import { sanitizeAbility } from "./match/abilities.js";
import { World, type SentCache } from "./match/world.js";
import { createSimulatedChannel, simulationFromEnv } from "./net/latency.js";
import { TickStats } from "./net/tickStats.js";
import { LoadRecorder } from "./net/loadReport.js";
import { writeFileSync } from "node:fs";

const PORT = Number(process.env.PORT ?? 8080);
/** Red simulada en desarrollo (E7-2): SIM_LATENCY_MS, SIM_JITTER_MS, SIM_LOSS, SIM_RTO_MS. */
const SIM = simulationFromEnv(process.env);
/**
 * Prueba de carga (E7-5, `pnpm loadtest`): con `LOAD_REPORT=ruta`, el servidor mide cada tick y,
 * al recibir SIGINT o SIGTERM, escribe el informe en JSON en esa ruta y termina.
 */
const LOAD_REPORT = process.env.LOAD_REPORT;
const load = LOAD_REPORT ? new LoadRecorder() : null;

interface Session {
  socket: WebSocket;
  /** Se ha alistado: recibe el mundo aunque no tenga soldado (defunción, espectador). */
  joined: boolean;
  /** Soldado que controla, o `null` si está muerto o de espectador. */
  soldierId: number | null;
  /** Soldado que acaba de morir, mientras espera el relevo (E5-4). */
  deadId: number | null;
  sent: SentCache;
  alive: boolean;
  bytesSent: number;
  /** Canales simulados de cada sentido (independientes por conexión, como en TCP). */
  inbound: (deliver: () => void) => void;
  outbound: (deliver: () => void) => void;
}

// Navmesh de los centollos (E4-1): se genera antes de crear el mundo y aceptar conexiones.
const navStart = performance.now();
const navMap = await buildNavMesh();
console.log(
  `Navmesh: ${navMap.polyCount} polígonos en ${(performance.now() - navStart).toFixed(0)} ms`,
);

// Los muñecos de prueba solo si están activados en la configuración (los tests los usan siempre).
const world = new World(GAME_CONFIG.dummy.enabled ? MAP : { ...MAP, dummies: [] }, navMap);
/** Comandos de administración (E7-3): solo en desarrollo, `pnpm dev` arranca con `--admin`. */
world.adminEnabled = process.argv.includes("--admin");
/** El pelotón es siempre de 8: los puestos libres los ocupan bots del servidor (E5-6). */
world.squadBots = true;
if (world.adminEnabled) console.log("Comandos de administración activados (solo desarrollo)");
/** Modo de prueba hasta el director (E4-4): `CRABS=105 SPITTERS=45` los mantiene vivos. */
world.crabQuota = Math.max(0, Number(process.env.CRABS ?? 0) || 0);
world.spitterQuota = Math.max(0, Number(process.env.SPITTERS ?? 0) || 0);
/** Prueba de carga (E7-5): `BUILDINGS=open` activa todos los edificios al empezar la evacuación. */
world.openAllBuildings = process.env.BUILDINGS === "open";
if (world.openAllBuildings) console.log("Edificios: todos activados al empezar la evacuación");
if (world.crabQuota + world.spitterQuota > 0) {
  console.log(`Modo de prueba: ${world.crabQuota} rasos y ${world.spitterQuota} escupidores`);
}
const sessions = new Set<Session>();

function send(session: Session, msg: ServerMessage): void {
  const data = encodeMessage(msg);
  session.bytesSent += data.byteLength;
  if (session.soldierId !== null) load?.addBytes(data.byteLength);
  session.outbound(() => {
    if (session.socket.readyState === session.socket.OPEN) session.socket.send(data);
  });
}

function handleMessage(session: Session, msg: ClientMessage): void {
  switch (msg.t) {
    case "join": {
      if (session.joined) return;
      if (world.isFull) {
        send(session, {
          t: "rejected",
          reason: "La partida está completa. Inténtalo en unos minutos.",
        });
        return;
      }
      // Releva a un bot del pelotón, o llega con 7 bots si es el primero (E5-6).
      const soldier = world.addHuman();
      session.joined = true;
      const nick =
        String(msg.nick ?? "")
          .trim()
          .slice(0, 20) || "anónimo";
      if (!soldier) {
        // Sin bots en pie que relevar, o con la partida terminada: espectador hasta la
        // siguiente (E5-5, E6-1).
        console.log(`[+] ${nick} entra de espectador. Jugadores: ${world.humanCount}`);
        const { x, z } = MAP.landingPad;
        send(session, {
          t: "welcome",
          playerId: -1,
          recruitName: "Espectador",
          tick: world.tick,
          spawn: { x, z, yaw: 0 },
          admin: world.adminEnabled,
        });
        send(session, world.matchStatus());
        send(session, world.colonyStatus());
        send(session, { t: "spectate" });
        return;
      }
      session.soldierId = soldier.id;
      console.log(`[+] ${soldier.name} (${nick}) se alista. Jugadores: ${world.humanCount}`);
      send(session, {
        t: "welcome",
        playerId: soldier.id,
        recruitName: soldier.name,
        tick: world.tick,
        spawn: { ...soldier.state },
        admin: world.adminEnabled,
      });
      // En qué fase está la partida, qué madrigueras están abiertas y cuándo despega la próxima
      // lanzadera.
      send(session, world.matchStatus());
      send(session, world.colonyStatus());
      const director = world.directorStatus();
      if (director) send(session, director);
      return;
    }
    case "admin": {
      if (session.soldierId === null) return;
      const text = world.admin(session.soldierId, msg.cmd);
      if (text) send(session, { t: "adminResult", text });
      return;
    }
    case "input": {
      if (session.soldierId === null) return;
      world.queueInput(session.soldierId, {
        seq: msg.seq,
        forward: Number(msg.forward),
        strafe: Number(msg.strafe),
        yaw: Number(msg.yaw),
        ability: sanitizeAbility(msg.ability),
        ...(Number.isInteger(msg.revive) ? { revive: msg.revive } : {}),
      });
      return;
    }
    case "target": {
      if (session.soldierId === null) return;
      world.setTarget(session.soldierId, Number.isInteger(msg.id) ? msg.id : null);
      return;
    }
    case "ping": {
      send(session, { t: "pong", time: msg.time });
      return;
    }
  }
}

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (socket) => {
  const session: Session = {
    socket,
    joined: false,
    soldierId: null,
    deadId: null,
    sent: new Map(),
    alive: true,
    bytesSent: 0,
    inbound: createSimulatedChannel(SIM),
    outbound: createSimulatedChannel(SIM),
  };
  sessions.add(session);

  socket.on("pong", () => (session.alive = true));

  socket.on("message", (raw, isBinary) => {
    if (!isBinary) return;
    const data = Array.isArray(raw) ? Buffer.concat(raw) : Buffer.from(raw as ArrayBuffer);
    session.inbound(() => {
      // Con red simulada, puede llegar después de cerrarse la conexión.
      if (!sessions.has(session)) return;
      try {
        handleMessage(session, decodeMessage<ClientMessage>(data));
      } catch {
        // Mensaje mal formado: se ignora.
      }
    });
  });

  socket.on("close", () => {
    sessions.delete(session);
    // Con más gente conectada (aunque esté de espectador), la partida sigue: su soldado pasa a
    // bot. Si no queda nadie, vuelve al principio.
    const others = [...sessions].some((s) => s.joined);
    if (session.soldierId !== null) {
      world.removeHuman(session.soldierId, others);
      console.log(`[-] Soldado ${session.soldierId} desconectado. Jugadores: ${world.humanCount}`);
    } else if (session.joined && !others) {
      world.resetMatch();
    }
  });
});

// Detectar conexiones muertas.
setInterval(() => {
  for (const s of sessions) {
    if (!s.alive) {
      s.socket.terminate();
      continue;
    }
    s.alive = false;
    s.socket.ping();
  }
}, 10_000);

// ---- Defunción, relevo y espectadores (E5-4) ----

/** El jugador pasa a controlar este soldado (relevo, o pelotón nuevo). */
function assignSoldier(session: Session, soldierId: number): void {
  const soldier = world.soldiers.get(soldierId);
  if (!soldier) return;
  session.soldierId = soldierId;
  const { x, z, yaw } = soldier.state;
  send(session, {
    t: "relief",
    playerId: soldierId,
    recruitName: soldier.name,
    state: { x, z, yaw },
    hp: soldier.hp,
  });
}

function updateReliefs(): void {
  // Muertes: el soldado de la sesión ya no existe. Espera el relevo tras la defunción.
  for (const s of sessions) {
    if (s.soldierId === null || world.soldiers.has(s.soldierId)) continue;
    s.deadId = s.soldierId;
    s.soldierId = null;
  }
  for (const { from, to } of world.takeReliefs()) {
    const session = [...sessions].find((s) => s.deadId === from);
    if (!session) continue;
    session.deadId = null;
    if (to === null) send(session, { t: "spectate" });
    else assignSoldier(session, to);
  }
}

/**
 * Nueva partida con todos los conectados (E6-1; provisional hasta el botón de E6-5): el primero
 * llega con 7 bots y los demás relevan a uno; si sobran, espectadores.
 */
function newMatch(): void {
  world.resetMatch();
  const joined = [...sessions].filter((s) => s.joined);
  console.log(`Nueva partida. Jugadores: ${joined.length}`);
  for (const s of joined) {
    s.deadId = null;
    s.soldierId = null;
    const soldier = world.addHuman();
    if (soldier) assignSoldier(s, soldier.id);
    else send(s, { t: "spectate" });
  }
}

// ---- Bucle de simulación a tick fijo ----

/** Para la consola (cada 5 s) y para el panel F3 de los clientes (cada segundo). */
const consoleStats = new TickStats();
const clientStats = new TickStats();
let nextTickAt = performance.now();

function runTick(): void {
  const start = performance.now();
  const cpuStart = load ? process.cpuUsage() : null;

  world.step();
  const events = world.events.length > 0 ? world.events : null;
  const director = world.takeDirectorStatus();
  const match = world.takeMatchStatus();
  const colony = world.takeColonyStatus();
  if (match?.phase === "result") {
    console.log(`El pelotón ha caído tras ${match.survivedSeconds ?? 0} s.`);
  }
  updateReliefs();
  for (const session of sessions) {
    if (!session.joined) continue;
    send(session, world.buildSnapshot(session.soldierId, session.sent));
    if (events) send(session, { t: "events", tick: world.tick, events });
    if (director) send(session, director);
    if (match) send(session, match);
    if (colony) send(session, colony);
  }
  if (world.match.restartDue) newMatch();

  const elapsed = performance.now() - start;
  if (load && cpuStart) {
    const cpu = process.cpuUsage(cpuStart);
    load.recordTick(
      elapsed,
      (cpu.user + cpu.system) / 1000,
      world.humanCount,
      world.crabs?.count ?? 0,
    );
  }
  consoleStats.record(elapsed);
  clientStats.record(elapsed);

  if (world.tick % GAME_CONFIG.net.tickRate === 0) {
    const stats = clientStats.take();
    if (stats) {
      for (const session of sessions) {
        if (session.soldierId === null) continue;
        send(session, { t: "stats", tickMs: stats.avg, tickMaxMs: stats.max });
      }
    }
  }
}

function scheduleLoop(): void {
  const now = performance.now();
  // Recuperar ticks perdidos sin entrar en espiral si el proceso se atasca.
  let caughtUp = 0;
  while (now >= nextTickAt && caughtUp < 5) {
    runTick();
    nextTickAt += TICK_MS;
    caughtUp++;
  }
  if (now - nextTickAt > TICK_MS * 5) nextTickAt = now;
  setTimeout(scheduleLoop, Math.max(0, nextTickAt - performance.now()));
}
scheduleLoop();

// Estadísticas cada 5 s.
setInterval(() => {
  const stats = consoleStats.take();
  if (!stats) return;
  const players = world.humanCount;
  const bytes = [...sessions].reduce((acc, s) => acc + s.bytesSent, 0);
  const perClient = players > 0 ? bytes / players / 5 / 1024 : 0;
  console.log(
    `tick ${world.tick} | jugadores ${players} | centollos ${world.crabs?.count ?? 0}` +
      ` | tick medio ${stats.avg.toFixed(2)} ms` +
      ` | máx ${stats.max.toFixed(2)} ms | bajada ${perClient.toFixed(1)} KB/s por cliente`,
  );
  for (const s of sessions) s.bytesSent = 0;
}, 5_000);

console.log(
  `Servidor de Proyecto UDC escuchando en ws://localhost:${PORT} a ${GAME_CONFIG.net.tickRate} ticks/s` +
    (SIM.latencyMs || SIM.jitterMs || SIM.loss
      ? ` (red simulada: ${SIM.latencyMs}±${SIM.jitterMs} ms por sentido` +
        (SIM.loss
          ? `, ${(SIM.loss * 100).toFixed(1)}% de pérdida con retransmisión a ${SIM.rtoMs} ms`
          : "") +
        ")"
      : ""),
);

if (load && LOAD_REPORT) {
  const finish = () => {
    writeFileSync(LOAD_REPORT, JSON.stringify(load.report(), null, 2));
    process.exit(0);
  };
  process.on("SIGINT", finish);
  process.on("SIGTERM", finish);
  console.log(`Prueba de carga: el informe irá a ${LOAD_REPORT}`);
}
