/**
 * Bots headless para probar el servidor (E7-4, versión H1).
 * Se alistan, deambulan por el mapa y miden latencia y tráfico.
 *
 * Uso: pnpm bots -- [número de bots] [segundos]   (por defecto: 4 bots, sin límite)
 * Servidor: variable SERVER_URL (por defecto ws://localhost:8080).
 */
import WebSocket from "ws";
import {
  decodeMessage,
  encodeMessage,
  TICK_MS,
  type ClientMessage,
  type ServerMessage,
} from "@uos/shared";

const args = process.argv.slice(2).filter((a) => a !== "--");
const COUNT = Number(args[0] ?? 4);
const DURATION_S = Number(args[1] ?? 0);
const URL = process.env.SERVER_URL ?? "ws://localhost:8080";

interface BotStats {
  name: string;
  snapshots: number;
  bytes: number;
  rtt: number;
  others: number;
  x: number;
  z: number;
}

const stats: BotStats[] = [];

function startBot(index: number): void {
  const socket = new WebSocket(URL);
  const st: BotStats = {
    name: `bot-${index}`,
    snapshots: 0,
    bytes: 0,
    rtt: 0,
    others: 0,
    x: 0,
    z: 0,
  };
  stats.push(st);
  const known = new Set<number>();
  let seq = 0;
  let yaw = Math.random() * Math.PI * 2;
  let forward = 1;
  let timer: NodeJS.Timeout | undefined;

  const send = (msg: ClientMessage) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(encodeMessage(msg));
  };

  socket.on("open", () => send({ t: "join", nick: st.name }));

  socket.on("message", (data: Buffer) => {
    st.bytes += data.byteLength;
    const msg = decodeMessage<ServerMessage>(data);
    switch (msg.t) {
      case "welcome":
        st.name = msg.recruitName;
        timer = setInterval(() => {
          // Cambiar de rumbo de vez en cuando; a veces pararse.
          if (Math.random() < 0.03) yaw += (Math.random() - 0.5) * 2;
          if (Math.random() < 0.01) forward = forward === 0 ? 1 : 0;
          send({ t: "input", seq: seq++, forward, strafe: 0, yaw });
          if (seq % 20 === 0) send({ t: "ping", time: performance.now() });
        }, TICK_MS);
        break;
      case "snapshot":
        st.snapshots++;
        for (const e of msg.changed) known.add(e.id);
        for (const id of msg.removed) known.delete(id);
        st.others = known.size;
        if (msg.you) {
          st.x = msg.you.x;
          st.z = msg.you.z;
        }
        break;
      case "pong":
        st.rtt = performance.now() - msg.time;
        break;
      case "rejected":
        console.error(`${st.name}: rechazado (${msg.reason})`);
        socket.close();
        break;
    }
  });

  socket.on("close", () => clearInterval(timer));
  socket.on("error", (err) => console.error(`${st.name}: ${err.message}`));
}

for (let i = 0; i < COUNT; i++) setTimeout(() => startBot(i), i * 100);

const report = setInterval(() => {
  for (const s of stats) {
    console.log(
      `${s.name.padEnd(22)} snapshots/s ${(s.snapshots / 5).toFixed(1).padStart(5)}` +
        ` | ${(s.bytes / 5 / 1024).toFixed(2)} KB/s | rtt ${s.rtt.toFixed(1)} ms` +
        ` | ve a ${s.others} | pos ${s.x.toFixed(1)}, ${s.z.toFixed(1)}`,
    );
    s.snapshots = 0;
    s.bytes = 0;
  }
  console.log("---");
}, 5000);

if (DURATION_S > 0) {
  setTimeout(() => {
    clearInterval(report);
    process.exit(0);
  }, DURATION_S * 1000);
}
