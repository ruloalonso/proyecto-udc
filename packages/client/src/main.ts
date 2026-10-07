import type { TransformNode } from "@babylonjs/core";
import { TICK_MS, type ServerMessage, type WelcomeMessage } from "@udc/shared";
import { Controls } from "./input/controls.js";
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
      if (msg.t !== "snapshot") continue;
      local.reconcile(msg);
      const { added, removed } = remotes.applySnapshot(msg);
      for (const e of added) remoteNodes.set(e.id, game.createSoldier(e.id, false));
      for (const id of removed) {
        game.disposeSoldier(id);
        remoteNodes.delete(id);
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
    const renderTick = remotes.renderTick(now);
    for (const [id, node] of remoteNodes) {
      const entity = remotes.entities.get(id);
      const p = entity && remotes.poseAt(entity, renderTick);
      if (!p) continue;
      node.position.set(p.x, 0, p.z);
      node.rotation.y = p.yaw;
    }

    // 5. Cámara detrás del personaje.
    followCamera.update(
      pose.x,
      pose.z,
      controls.yaw + controls.cameraYawOffset,
      controls.cameraPitch,
      controls.cameraDistance,
      dt,
    );

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
