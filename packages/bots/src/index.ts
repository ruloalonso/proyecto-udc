/**
 * Bots headless (E7-4): se alistan, combaten con el comportamiento básico de `BotBrain` (el que
 * heredarán los compañeros del servidor, E5-6) y miden latencia, tráfico y combate.
 * Son para pruebas de red y de carga (E7-5).
 *
 * Uso: pnpm bots -- [número de bots] [segundos]   (por defecto: 4 bots, sin límite)
 * Servidor: variable SERVER_URL (por defecto ws://localhost:8080).
 */
import WebSocket from "ws";
import {
  BotBrain,
  decodeMessage,
  dequantizePos,
  encodeMessage,
  forEachMove,
  MAP,
  TICK_MS,
  type BotEntity,
  type BotSelf,
  type ClientMessage,
  type EntityKind,
  type ServerMessage,
} from "@udc/shared";

const args = process.argv.slice(2).filter((a) => a !== "--");
const COUNT = Number(args[0] ?? 4);
const DURATION_S = Number(args[1] ?? 0);
const URL = process.env.SERVER_URL ?? "ws://localhost:8080";
/** Segundos entre informes. */
const REPORT_S = 5;

interface BotStats {
  name: string;
  snapshots: number;
  bytes: number;
  rtt: number;
  others: number;
  x: number;
  z: number;
  hp: number;
  /** Daño hecho y muertes (reapariciones) desde el último informe. */
  damage: number;
  deaths: number;
  /** Habilidades usadas desde el último informe: granadas, disparos apuntados, estimulantes. */
  grenades: number;
  aimed: number;
  stims: number;
}

const stats: BotStats[] = [];

/** Lo que el bot sabe de cada entidad (posición cuantizada, como llega en los snapshots). */
interface Known {
  kind: EntityKind;
  x: number;
  z: number;
}

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
    hp: 0,
    damage: 0,
    deaths: 0,
    grenades: 0,
    aimed: 0,
    stims: 0,
  };
  stats.push(st);
  const known = new Map<number, Known>();
  const brain = new BotBrain(MAP);
  let me: BotSelf | null = null;
  let myId = -1;
  let seq = 0;
  let timer: NodeJS.Timeout | undefined;

  const send = (msg: ClientMessage) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(encodeMessage(msg));
  };

  /** Una entrada por tick, como un cliente de verdad. */
  const act = () => {
    if (!me) return;
    const entities: BotEntity[] = [];
    for (const [id, e] of known) {
      entities.push({ id, kind: e.kind, x: dequantizePos(e.x), z: dequantizePos(e.z) });
    }
    const { forward, strafe, yaw, ability } = brain.think(me, entities);
    me = { ...me, yaw };
    send({ t: "input", seq: seq++, forward, strafe, yaw, ...(ability ? { ability } : {}) });
    if (seq % 20 === 0) send({ t: "ping", time: performance.now() });
  };

  socket.on("open", () => send({ t: "join", nick: st.name }));

  socket.on("message", (data: Buffer) => {
    st.bytes += data.byteLength;
    const msg = decodeMessage<ServerMessage>(data);
    switch (msg.t) {
      case "welcome":
        st.name = msg.recruitName;
        myId = msg.playerId;
        timer = setInterval(act, TICK_MS);
        break;
      case "snapshot":
        st.snapshots++;
        for (const e of msg.added) known.set(e.id, { kind: e.kind, x: e.x, z: e.z });
        forEachMove(msg.moved, (id, dx, dz) => {
          const e = known.get(id);
          if (!e) return;
          e.x += dx;
          e.z += dz;
        });
        for (const id of msg.removed) known.delete(id);
        st.others = known.size;
        if (msg.you && myId >= 0) {
          // La orientación la manda el bot: se conserva la suya.
          me = { ...msg.you, yaw: me?.yaw ?? msg.you.yaw };
          st.x = msg.you.x;
          st.z = msg.you.z;
          st.hp = msg.you.hp;
        }
        break;
      case "events":
        for (const e of msg.events) {
          if (e.k === "damage" && e.src === myId) st.damage += e.amount;
          if (e.k === "death" && e.src === myId) {
            st.deaths++;
            me = null; // Sin soldado hasta el relevo (E5-4).
          }
          if (e.k === "grenade" && e.src === myId) st.grenades++;
          if (e.k === "castEnd" && e.src === myId && e.ok) st.aimed++;
          if (e.k === "stim" && e.src === myId) st.stims++;
        }
        break;
      case "relief":
        // Releva a otro soldado del pelotón (E5-4): sigue jugando con él.
        myId = msg.playerId;
        st.name = msg.recruitName;
        me = { ...msg.state, hp: msg.hp, cd: [0, 0, 0, 0], target: null };
        break;
      case "spectate":
        me = null;
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
      `${s.name.padEnd(22)} snapshots/s ${(s.snapshots / REPORT_S).toFixed(1).padStart(5)}` +
        ` | ${(s.bytes / REPORT_S / 1024).toFixed(2)} KB/s | rtt ${s.rtt.toFixed(1)} ms` +
        ` | ve a ${s.others} | vida ${String(s.hp).padStart(3)}` +
        ` | daño ${String(s.damage).padStart(4)} | muertes ${s.deaths}` +
        ` | g/a/e ${s.grenades}/${s.aimed}/${s.stims}` +
        ` | pos ${s.x.toFixed(1)}, ${s.z.toFixed(1)}`,
    );
    s.snapshots = 0;
    s.bytes = 0;
    s.damage = 0;
    s.deaths = 0;
    s.grenades = 0;
    s.aimed = 0;
    s.stims = 0;
  }
  console.log("---");
}, REPORT_S * 1000);

if (DURATION_S > 0) {
  setTimeout(() => {
    clearInterval(report);
    process.exit(0);
  }, DURATION_S * 1000);
}
