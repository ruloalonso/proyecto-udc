import { WebSocketServer, type WebSocket } from "ws";
import {
  decodeMessage,
  encodeMessage,
  GAME_CONFIG,
  TICK_MS,
  type ClientMessage,
  type ServerMessage,
} from "@uos/shared";
import { World, type SentCache } from "./match/world.js";
import { withSimulatedLatency } from "./net/latency.js";

const PORT = Number(process.env.PORT ?? 8080);
const SIM_LATENCY_MS = Number(process.env.SIM_LATENCY_MS ?? 0);
const SIM_JITTER_MS = Number(process.env.SIM_JITTER_MS ?? 0);

interface Session {
  socket: WebSocket;
  soldierId: number | null;
  sent: SentCache;
  alive: boolean;
  bytesSent: number;
}

const world = new World();
const sessions = new Set<Session>();
const delay = withSimulatedLatency(SIM_LATENCY_MS, SIM_JITTER_MS);

function send(session: Session, msg: ServerMessage): void {
  const data = encodeMessage(msg);
  session.bytesSent += data.byteLength;
  delay(() => {
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
      });
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
  const session: Session = { socket, soldierId: null, sent: new Map(), alive: true, bytesSent: 0 };
  sessions.add(session);

  socket.on("pong", () => (session.alive = true));

  socket.on("message", (raw, isBinary) => {
    if (!isBinary) return;
    const data = Array.isArray(raw) ? Buffer.concat(raw) : Buffer.from(raw as ArrayBuffer);
    delay(() => {
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

let tickTimeTotal = 0;
let tickTimeMax = 0;
let ticksMeasured = 0;
let nextTickAt = performance.now();

function runTick(): void {
  const start = performance.now();

  world.step();
  for (const session of sessions) {
    if (session.soldierId === null) continue;
    send(session, world.buildSnapshot(session.soldierId, session.sent));
  }

  const elapsed = performance.now() - start;
  tickTimeTotal += elapsed;
  tickTimeMax = Math.max(tickTimeMax, elapsed);
  ticksMeasured++;
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
  if (ticksMeasured === 0) return;
  const players = world.soldiers.size;
  const bytes = [...sessions].reduce((acc, s) => acc + s.bytesSent, 0);
  const perClient = players > 0 ? bytes / players / 5 / 1024 : 0;
  console.log(
    `tick ${world.tick} | jugadores ${players} | tick medio ${(tickTimeTotal / ticksMeasured).toFixed(2)} ms` +
      ` | máx ${tickTimeMax.toFixed(2)} ms | bajada ${perClient.toFixed(1)} KB/s por cliente`,
  );
  tickTimeTotal = 0;
  tickTimeMax = 0;
  ticksMeasured = 0;
  for (const s of sessions) s.bytesSent = 0;
}, 5_000);

console.log(
  `Servidor de Proyecto UOS escuchando en ws://localhost:${PORT} a ${GAME_CONFIG.net.tickRate} ticks/s` +
    (SIM_LATENCY_MS
      ? ` (latencia simulada ${SIM_LATENCY_MS}±${SIM_JITTER_MS} ms por sentido)`
      : ""),
);
