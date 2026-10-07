import { WebSocketServer, type WebSocket } from "ws";
import {
  decodeMessage,
  encodeMessage,
  GAME_CONFIG,
  TICK_MS,
  type ClientMessage,
  type ServerMessage,
} from "@udc/shared";
import { sanitizeAbility } from "./match/abilities.js";
import { World, type SentCache } from "./match/world.js";
import { createSimulatedChannel, simulationFromEnv } from "./net/latency.js";
import { TickStats } from "./net/tickStats.js";

const PORT = Number(process.env.PORT ?? 8080);
/** Red simulada en desarrollo (E7-2): SIM_LATENCY_MS, SIM_JITTER_MS, SIM_LOSS, SIM_RTO_MS. */
const SIM = simulationFromEnv(process.env);

interface Session {
  socket: WebSocket;
  soldierId: number | null;
  sent: SentCache;
  alive: boolean;
  bytesSent: number;
  /** Canales simulados de cada sentido (independientes por conexión, como en TCP). */
  inbound: (deliver: () => void) => void;
  outbound: (deliver: () => void) => void;
}

const world = new World();
const sessions = new Set<Session>();

function send(session: Session, msg: ServerMessage): void {
  const data = encodeMessage(msg);
  session.bytesSent += data.byteLength;
  session.outbound(() => {
    if (session.socket.readyState === session.socket.OPEN) session.socket.send(data);
  });
}

function handleMessage(session: Session, msg: ClientMessage): void {
  switch (msg.t) {
    case "join": {
      if (session.soldierId !== null) return;
      if (world.isFull) {
        send(session, {
          t: "rejected",
          reason: "La partida está completa. Inténtalo en unos minutos.",
        });
        return;
      }
      const soldier = world.addSoldier();
      session.soldierId = soldier.id;
      const nick =
        String(msg.nick ?? "")
          .trim()
          .slice(0, 20) || "anónimo";
      console.log(`[+] ${soldier.name} (${nick}) se alista. Jugadores: ${world.soldiers.size}`);
      send(session, {
        t: "welcome",
        playerId: soldier.id,
        recruitName: soldier.name,
        tick: world.tick,
        spawn: { ...soldier.state },
      });
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
    soldierId: null,
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
    if (session.soldierId !== null) {
      world.removeSoldier(session.soldierId);
      console.log(
        `[-] Soldado ${session.soldierId} desconectado. Jugadores: ${world.soldiers.size}`,
      );
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

// ---- Bucle de simulación a tick fijo ----

/** Para la consola (cada 5 s) y para el panel F3 de los clientes (cada segundo). */
const consoleStats = new TickStats();
const clientStats = new TickStats();
let nextTickAt = performance.now();

function runTick(): void {
  const start = performance.now();

  world.step();
  const events = world.events.length > 0 ? world.events : null;
  for (const session of sessions) {
    if (session.soldierId === null) continue;
    send(session, world.buildSnapshot(session.soldierId, session.sent));
    if (events) send(session, { t: "events", tick: world.tick, events });
  }

  const elapsed = performance.now() - start;
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
  const players = world.soldiers.size;
  const bytes = [...sessions].reduce((acc, s) => acc + s.bytesSent, 0);
  const perClient = players > 0 ? bytes / players / 5 / 1024 : 0;
  console.log(
    `tick ${world.tick} | jugadores ${players} | tick medio ${stats.avg.toFixed(2)} ms` +
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
