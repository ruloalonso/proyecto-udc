import { type TransformNode, Vector3 } from "@babylonjs/core";
import {
  canAutoFireAt,
  EntityKind,
  GAME_CONFIG,
  hasLineOfSight,
  isHostile,
  MAP,
  TICK_MS,
  type GameEvent,
  type ServerMessage,
  type WelcomeMessage,
} from "@udc/shared";
import { Controls } from "./input/controls.js";
import { nextTabTarget } from "./input/targeting.js";
import { Effects } from "./render/effects.js";
import { FollowCamera } from "./render/followCamera.js";
import { Connection } from "./net/connection.js";
import { LocalPrediction } from "./net/prediction.js";
import { RemoteEntities } from "./net/remoteEntities.js";
import { createEngine, createGameScene } from "./render/scene.js";
import { Hud } from "./ui/hud.js";

const SERVER_URL: string =
  import.meta.env.VITE_SERVER_URL ?? `ws://${window.location.hostname}:8080`;

const canvas = document.getElementById("game") as HTMLCanvasElement;
const enlist = document.getElementById("enlist") as HTMLElement;
const form = document.getElementById("enlist-form") as HTMLFormElement;
const nickInput = document.getElementById("nick") as HTMLInputElement;
const errorBox = document.getElementById("enlist-error") as HTMLElement;
const submit = form.querySelector("button") as HTMLButtonElement;

nickInput.focus();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  submit.disabled = true;
  errorBox.textContent = "";
  try {
    await startGame(nickInput.value.trim());
  } catch (err) {
    errorBox.textContent = err instanceof Error ? err.message : String(err);
    submit.disabled = false;
  }
});

/** Espera el primer mensaje de bienvenida (o rechazo) tras enviar `join`. */
function waitForWelcome(queue: ServerMessage[]): Promise<WelcomeMessage> {
  return new Promise((resolve, reject) => {
    const deadline = performance.now() + 5000;
    const check = () => {
      const msg = queue.shift();
      if (msg?.t === "welcome") return resolve(msg);
      if (msg?.t === "rejected") return reject(new Error(msg.reason));
      if (performance.now() > deadline) return reject(new Error("El servidor no responde."));
      window.setTimeout(check, 20);
    };
    check();
  });
}

async function startGame(nick: string): Promise<void> {
  const inbox: ServerMessage[] = [];
  const connection = new Connection(
    SERVER_URL,
    (msg) => inbox.push(msg),
    (reason) => {
      errorBox.textContent = reason;
      enlist.hidden = false;
      submit.disabled = true;
    },
  );
  await connection.connect();
  connection.send({ t: "join", nick });
  const welcome = await waitForWelcome(inbox);

  enlist.hidden = true;
  const hud = new Hud(welcome.recruitName);

  const engine = await createEngine(canvas);
  const game = createGameScene(engine);
  const controls = new Controls(canvas, welcome.spawn.yaw);
  const followCamera = new FollowCamera(game.scene, game.camera, game.cameraBlockers);
  controls.onToggleDebug = () => hud.toggleDebug();

  const local = new LocalPrediction(welcome.spawn);
  const remotes = new RemoteEntities();
  const localNode = game.createSoldier(welcome.playerId, true);
  const remoteNodes = new Map<number, TransformNode>();
  const effects = new Effects(game.scene, document.getElementById("floaters") as HTMLElement);
  /** Eventos esperando a que se dibuje su tick. */
  let pendingEvents: { tick: number; event: GameEvent }[] = [];

  /** Muestra un evento con las posiciones que se están dibujando ahora. */
  const playEvent = (event: GameEvent) => {
    const from = event.src === welcome.playerId ? localNode : remoteNodes.get(event.src);
    const to = remoteNodes.get(event.dst);
    if (!from || !to) return;
    const muzzle = new Vector3(from.position.x, GAME_CONFIG.soldier.height * 0.7, from.position.z);
    const hit = new Vector3(to.position.x, GAME_CONFIG.dummy.height * 0.6, to.position.z);
    effects.shot(muzzle, hit);
    // Como en WoW, cada jugador solo ve los números de su propio daño.
    if (event.src === welcome.playerId) {
      effects.damageNumber(
        new Vector3(to.position.x, GAME_CONFIG.dummy.height + 0.3, to.position.z),
        event.amount,
      );
    }
  };

  // Selección de objetivo: el cliente la muestra al momento y el servidor la valida.
  let targetId: number | null = null;
  const setTarget = (id: number | null) => {
    if (id === targetId) return;
    targetId = id;
    connection.send({ t: "target", id });
  };
  // Lo que ve el jugador ahora mismo, para elegir objetivo con Tab.
  let view = { x: welcome.spawn.x, z: welcome.spawn.z, yaw: welcome.spawn.yaw };
  let renderTick = 0;

  controls.onClearTarget = () => setTarget(null);
  controls.onClick = (x, y) => {
    const id = game.pickHostile(x, y);
    if (id !== null) setTarget(id);
  };
  controls.onTab = () => {
    const candidates = [];
    for (const entity of remotes.entities.values()) {
      if (!isHostile(entity.kind)) continue;
      const p = remotes.poseAt(entity, renderTick);
      // Tab no elige objetivos tapados por obstáculos (E3-3).
      if (p && hasLineOfSight(view, p, MAP)) candidates.push({ id: entity.id, x: p.x, z: p.z });
    }
    const { tabRange, tabHalfAngle } = GAME_CONFIG.targeting;
    setTarget(nextTabTarget(view, candidates, targetId, tabRange, tabHalfAngle));
  };

  let seq = 0;
  let accumulator = 0;
  let lastFrame = performance.now();
  let bytesWindowStart = performance.now();
  let downKbps = 0;

  window.addEventListener("resize", () => engine.resize());

  engine.runRenderLoop(() => {
    const now = performance.now();
    const dt = Math.min(0.25, (now - lastFrame) / 1000);
    lastFrame = now;

    // 1. Mensajes del servidor.
    for (let msg = inbox.shift(); msg; msg = inbox.shift()) {
      if (msg.t === "events") {
        // Los propios se ven al llegar (el jugador local se dibuja en el presente);
        // los de los demás, cuando la interpolación llega a su tick.
        for (const event of msg.events) {
          pendingEvents.push({
            tick: event.src === welcome.playerId ? -Infinity : msg.tick,
            event,
          });
        }
        continue;
      }
      if (msg.t !== "snapshot") continue;
      local.reconcile(msg);
      for (const e of remotes.applySnapshot(msg)) {
        const node =
          e.kind === EntityKind.Dummy ? game.createDummy(e.id) : game.createSoldier(e.id, false);
        remoteNodes.set(e.id, node);
      }
    }

    // 2. Entrada a tick fijo: se envía al servidor y se predice en local.
    controls.update(dt);
    accumulator += dt * 1000;
    while (accumulator >= TICK_MS) {
      accumulator -= TICK_MS;
      const { forward, strafe } = controls.axes();
      const input = { seq: seq++, forward, strafe, yaw: controls.yaw };
      connection.send({ t: "input", ...input });
      local.applyInput(input);
    }

    // 3. Dibujar el jugador local (interpolado entre ticks previstos).
    const pose = local.renderPose(accumulator / TICK_MS, dt);
    localNode.position.set(pose.x, 0, pose.z);
    localNode.rotation.y = controls.yaw;

    // 4. Dibujar entidades remotas en el pasado.
    renderTick = remotes.renderTick(now);
    for (const [id, node] of remoteNodes) {
      const entity = remotes.entities.get(id);
      const p = entity && remotes.poseAt(entity, renderTick);
      if (!p) continue;
      node.position.set(p.x, 0, p.z);
      node.rotation.y = p.yaw;
    }

    // Eventos que ya tocan, antes de quitar entidades: el disparo que mata aún tiene a quién apuntar.
    pendingEvents = pendingEvents.filter(({ tick, event }) => {
      if (tick > renderTick) return true;
      playEvent(event);
      return false;
    });
    for (const id of remotes.takeRemoved(renderTick)) {
      if (id === targetId) setTarget(null);
      game.disposeEntity(id);
      remoteNodes.delete(id);
    }

    // Aviso visual: el servidor decide, pero el anillo se apaga si no se le puede disparar.
    const targetNode = targetId !== null ? (remoteNodes.get(targetId) ?? null) : null;
    game.showTargetMarker(
      targetNode,
      !!targetNode && canAutoFireAt(pose, targetNode.position, MAP),
    );

    // 5. Cámara detrás del personaje.
    view = { x: pose.x, z: pose.z, yaw: controls.yaw + controls.cameraYawOffset };
    followCamera.update(
      view.x,
      view.z,
      view.yaw,
      controls.cameraPitch,
      controls.cameraDistance,
      dt,
    );

    effects.update(dt);
    game.scene.render();

    // 6. Depuración.
    if (now - bytesWindowStart >= 1000) {
      downKbps = connection.takeBytesReceived() / 1024 / ((now - bytesWindowStart) / 1000);
      bytesWindowStart = now;
    }
    hud.updateDebug({
      fps: engine.getFps(),
      engine: engine.name,
      rtt: connection.rtt,
      serverTick: remotes.latestTick,
      remotes: remotes.entities.size,
      pending: local.pendingCount,
      correction: local.lastCorrection,
      downKbps,
      x: pose.x,
      z: pose.z,
    });
  });
}
