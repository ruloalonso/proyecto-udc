import { WebSocketServer, type WebSocket } from "ws";
import {
  decodeMessage,
  encodeMessage,
  GAME_CONFIG,
  MAP,
  TICK_MS,
  TICK_SECONDS,
  type ClientMessage,
  type LobbyMessage,
  type LobbyPlace,
  type ServerMessage,
} from "@udc/shared";
import { buildNavMesh } from "./ai/navmesh.js";
import { sanitizeAbility } from "./match/abilities.js";
import { canStart, hostOf } from "./match/lobby.js";
import { World, type SentCache } from "./match/world.js";
import { createSimulatedChannel, simulationFromEnv } from "./net/latency.js";
import { TickStats } from "./net/tickStats.js";
import { LoadRecorder } from "./net/loadReport.js";
import { staticHandler } from "./net/static.js";
import { writeFileSync } from "node:fs";
import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 8080);
/**
 * Despliegue (E7-6): con `CLIENT_DIR` (el `dist` de `vite build`), el servidor sirve también el
 * cliente por el mismo puerto y el cliente se conecta a `/ws`. Sin ella (desarrollo), el cliente
 * lo sirve Vite.
 */
const CLIENT_DIR = process.env.CLIENT_DIR;
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
  /** Se ha alistado (ha mandado su apodo): está en la sala, en la partida o en el noticiario. */
  joined: boolean;
  /**
   * Dónde está (E6-9): en la sala de espera, en la partida (jugando, en la defunción o mirando;
   * recibe el mundo) o leyendo el noticiario de la que acaba de terminar.
   */
  place: LobbyPlace;
  /** En la sala: listo para empezar. */
  ready: boolean;
  /** Orden de llegada: el anfitrión es quien entró primero. */
  order: number;
  /** Soldado que controla, o `null` si está muerto o de espectador. */
  soldierId: number | null;
  /** Apodo con el que entró: se ve sobre su soldado (E2-5). */
  nick: string;
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
/** Para el orden de llegada de cada conexión (el anfitrión es la más antigua). */
let arrivals = 0;
/**
 * En el resultado, pasado el clímax (y la retirada de los centollos), la partida se cierra y el
 * servidor queda en reposo (E7-7): quien lee el noticiario ya no necesita el mundo.
 */
const RESULT_HOLD_TICKS = Math.round((GAME_CONFIG.match.climax.seconds + 3) / TICK_SECONDS);

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
      const nick =
        String(msg.nick ?? "")
          .trim()
          .slice(0, 20) || "anónimo";
      // A la sala de espera, en la bodega de la nave (E6-9): de ahí se empieza o se une.
      session.joined = true;
      session.nick = nick;
      session.place = "lobby";
      session.ready = false;
      session.order = ++arrivals;
      console.log(`[+] ${nick} sube a la nave. Conectados: ${joinedSessions().length}`);
      const { x, z } = MAP.landingPad;
      send(session, {
        t: "welcome",
        playerId: -1,
        recruitName: "En la nave",
        tick: world.tick,
        spawn: { x, z, yaw: 0 },
        admin: world.adminEnabled,
      });
      broadcastLobby();
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
    case "ready": {
      if (session.place !== "lobby") return;
      session.ready = msg.ready === true;
      broadcastLobby();
      return;
    }
    case "start": {
      const seats = joinedSessions();
      if (hostOf(seats) !== session || !canStart(seats) || matchRunning()) return;
      newMatch(seats);
      return;
    }
    case "joinMatch": {
      // Con la partida en marcha: encarnar un bot en pie o mirar (E6-9).
      if (session.place !== "lobby" || !matchRunning()) return;
      enterMatch(session);
      const soldier = msg.as === "bot" ? world.addHuman(session.nick) : null;
      if (soldier) {
        console.log(
          `[+] ${session.nick} encarna a ${soldier.name}. Jugadores: ${world.humanCount}`,
        );
        assignSoldier(session, soldier.id);
      } else {
        send(session, { t: "spectate" });
      }
      broadcastLobby();
      return;
    }
    case "toLobby": {
      // Del noticiario a la nave (E6-9), cuando cada uno quiere.
      if (session.place !== "report") return;
      toLobby(session);
      broadcastLobby();
      return;
    }
  }
}

const serveClient = CLIENT_DIR ? staticHandler(CLIENT_DIR) : null;
const http = createServer((req, res) => {
  if (serveClient) void serveClient(req, res);
  else res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Proyecto UDC");
});
// El WebSocket va por el mismo puerto, en cualquier ruta (el cliente desplegado usa /ws).
const wss = new WebSocketServer({ server: http, maxPayload: GAME_CONFIG.net.maxMessageBytes });
http.listen(PORT);

wss.on("connection", (socket) => {
  // Por internet (E7-6): un tope de conexiones abiertas, para que nadie las acapare.
  if (sessions.size >= GAME_CONFIG.net.maxConnections) {
    socket.close(1013, "Servidor lleno");
    return;
  }
  const session: Session = {
    socket,
    joined: false,
    place: "lobby",
    ready: false,
    order: 0,
    soldierId: null,
    nick: "",
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
    if (!session.joined) return;
    console.log(`[-] ${session.nick} se desconecta. Conectados: ${joinedSessions().length}`);
    // Con más gente en la partida (aunque sea mirando), sigue: su soldado pasa a bot. Si no queda
    // nadie en ella, se cierra y el servidor queda en reposo (E7-7).
    const inMatch = [...sessions].some((s) => s.place === "match" || s.place === "report");
    if (session.soldierId !== null) world.removeHuman(session.soldierId, inMatch);
    else if (!inMatch && world.match.phase !== "waiting") world.resetMatch();
    broadcastLobby();
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

/** Sesiones alistadas: en la sala, en la partida o leyendo el noticiario. */
const joinedSessions = () => [...sessions].filter((s) => s.joined);

/** Hay una partida en marcha (a la que se puede unir quien está en la sala). */
const matchRunning = () => {
  const phase = world.match.phase;
  return phase === "prep" || phase === "evacuation" || phase === "final";
};

/** La sala de espera para cada conectado (E6-9): quién está, si está listo y quién manda. */
function broadcastLobby(): void {
  const seats = joinedSessions();
  const host = hostOf(seats);
  const startable = canStart(seats) && !matchRunning();
  const match: LobbyMessage["match"] = matchRunning()
    ? { phase: world.match.phase, seconds: Math.round(world.match.elapsedTicks * TICK_SECONDS) }
    : null;
  const ordered = [...seats].sort((a, b) => a.order - b.order);
  for (const s of seats) {
    send(s, {
      t: "lobby",
      players: ordered.map((p) => ({
        nick: p.nick,
        place: p.place,
        ready: p.ready,
        host: p === host,
        you: p === s,
      })),
      canStart: startable,
      match,
    });
  }
}

/** Entra en la partida: recibirá el mundo desde cero (todo como nuevo en el snapshot). */
function enterMatch(session: Session): void {
  session.place = "match";
  session.ready = false;
  session.sent = new Map();
  session.deadId = null;
  session.soldierId = null;
  send(session, world.matchStatus());
  send(session, world.colonyStatus());
  send(session, world.shuttleStatus());
  const director = world.directorStatus();
  if (director) send(session, director);
}

/** Vuelve a la sala, sin listo y sin soldado. */
function toLobby(session: Session): void {
  session.place = "lobby";
  session.ready = false;
  session.soldierId = null;
  session.deadId = null;
}

/**
 * Nueva partida con los de la sala, cuando el anfitrión la empieza (E6-9): el primero llega
 * con 7 bots y los demás relevan a uno; si sobran, espectadores.
 */
function newMatch(seats: readonly Session[]): void {
  world.resetMatch();
  console.log(`Nueva partida. Jugadores: ${seats.length}`);
  for (const s of seats) {
    enterMatch(s);
    const soldier = world.addHuman(s.nick);
    if (soldier) assignSoldier(s, soldier.id);
    else send(s, { t: "spectate" });
  }
  broadcastLobby();
  ensureLoop();
}

// ---- Bucle de simulación a tick fijo ----

/** Para la consola (cada 5 s) y para el panel F3 de los clientes (cada segundo). */
const consoleStats = new TickStats();
const clientStats = new TickStats();
let nextTickAt = performance.now();

function runTick(): void {
  const start = performance.now();
  const cpuStart = load ? process.cpuUsage() : null;
  const threadStart = load ? process.threadCpuUsage() : null;

  world.step();
  const events = world.events.length > 0 ? world.events : null;
  const director = world.takeDirectorStatus();
  const match = world.takeMatchStatus();
  const colony = world.takeColonyStatus();
  const shuttle = world.takeShuttleStatus();
  if (match?.phase === "result") {
    console.log(`El pelotón ha caído tras ${match.survivedSeconds ?? 0} s.`);
  }
  updateReliefs();
  for (const session of sessions) {
    // El mundo, a quien está en la partida (y al noticiario, para el clímax).
    if (session.place !== "match" && session.place !== "report") continue;
    send(session, world.buildSnapshot(session.soldierId, session.sent));
    if (events) send(session, { t: "events", tick: world.tick, events });
    if (director) send(session, director);
    if (match) send(session, match);
    if (colony) send(session, colony);
    if (shuttle) send(session, shuttle);
  }
  // Ha caído el pelotón: todos al noticiario (E6-4); de ahí, cada uno vuelve a la nave.
  if (match?.phase === "result") {
    for (const s of sessions) if (s.place === "match") s.place = "report";
    broadcastLobby();
  }
  // Pasado el clímax, la partida se cierra y el servidor queda en reposo (E7-7).
  if (world.match.resultTicks >= RESULT_HOLD_TICKS) {
    world.resetMatch();
    broadcastLobby();
  }

  const elapsed = performance.now() - start;
  if (load && cpuStart && threadStart) {
    const cpu = process.cpuUsage(cpuStart);
    const thread = process.threadCpuUsage(threadStart);
    load.recordTick(
      elapsed,
      (cpu.user + cpu.system) / 1000,
      (thread.user + thread.system) / 1000,
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

/**
 * Servidor en reposo (E7-7): solo simula durante una partida. Sin ella (nadie conectado, o
 * todos en la sala) no hay ticks ni registro.
 */
const simulating = () => world.match.phase !== "waiting" || world.soldiers.size > 0;
let looping = false;

/** Arranca el bucle si hay partida y no está en marcha. */
function ensureLoop(): void {
  if (looping || !simulating()) return;
  looping = true;
  nextTickAt = performance.now();
  scheduleLoop();
}

function scheduleLoop(): void {
  if (!simulating()) {
    looping = false;
    console.log("Sin partida: en reposo.");
    return;
  }
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

// Estadísticas cada 5 s.
setInterval(() => {
  const stats = consoleStats.take();
  if (!stats) return;
  const players = world.humanCount;
  const bytes = [...sessions].reduce((acc, s) => acc + s.bytesSent, 0);
  // Entre las conexiones, no entre los jugadores con soldado: los muertos siguen recibiendo el
  // mundo como espectadores (con 1 vivo y 7 mirando salía 8 veces más).
  const clients = [...sessions].filter((s) => s.joined).length;
  const perClient = clients > 0 ? bytes / clients / 5 / 1024 : 0;
  console.log(
    `tick ${world.tick} | jugadores ${players} | conexiones ${clients}` +
      ` | centollos ${world.crabs?.count ?? 0}` +
      ` | tick medio ${stats.avg.toFixed(2)} ms` +
      ` | máx ${stats.max.toFixed(2)} ms | bajada ${perClient.toFixed(1)} KB/s por cliente`,
  );
  for (const s of sessions) s.bytesSent = 0;
}, 5_000);

console.log(
  `Servidor de Proyecto UDC escuchando en ws://localhost:${PORT} a ${GAME_CONFIG.net.tickRate} ticks/s` +
    (CLIENT_DIR ? `, sirviendo el cliente de ${CLIENT_DIR} en http://localhost:${PORT}` : "") +
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
