import { type TransformNode, Vector3 } from "@babylonjs/core";
import {
  AbilityId,
  clampToRange,
  EntityKind,
  GAME_CONFIG,
  hasLineOfSight,
  isHostile,
  MAP,
  TICK_MS,
  type AbilityUse,
  type GameEvent,
  type PlayerInput,
  type ServerMessage,
  type WelcomeMessage,
} from "@udc/shared";
import { Controls } from "./input/controls.js";
import { nextTabTarget } from "./input/targeting.js";
import { Effects } from "./render/effects.js";
import { FollowCamera } from "./render/followCamera.js";
import { AbilityState } from "./net/abilities.js";
import { Connection } from "./net/connection.js";
import { LocalPrediction } from "./net/prediction.js";
import { RemoteEntities } from "./net/remoteEntities.js";
import { createEngine, createGameScene } from "./render/scene.js";
import { CombatHud, type SlotView } from "./ui/combatHud.js";
import {
  abilityBlocker,
  BLOCKER_TEXT,
  fireBlocker,
  maxHealthOf,
  slotCooldown,
  type AbilityContext,
} from "./ui/combatRules.js";
import { Hud } from "./ui/hud.js";

/** Alturas (solo visuales) de los efectos de combate. */
const MUZZLE_Y = GAME_CONFIG.soldier.height * 0.7;
const HIT_Y = GAME_CONFIG.dummy.height * 0.6;
const NUMBER_Y = GAME_CONFIG.dummy.height + 0.3;

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
  const combatHud = new CombatHud();

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

  // Habilidades (E3-2): el cliente manda la intención con la entrada del tick; decide el servidor.
  const abilities = new AbilityState();
  let hp: number = GAME_CONFIG.soldier.health;
  /** Habilidad que se manda con la próxima entrada. */
  let pendingAbility: AbilityUse | undefined;
  /** Apuntando la granada con la retícula. */
  let aimingGrenade = false;
  /** Hasta cuándo brilla cada soldado remoto por el estimulante (`performance.now()`). */
  const remoteBoostUntil = new Map<number, number>();

  const nodeOf = (id: number) => (id === welcome.playerId ? localNode : remoteNodes.get(id));

  /** Muestra un evento con las posiciones que se están dibujando ahora. */
  const playEvent = (event: GameEvent) => {
    const mine = event.src === welcome.playerId;
    switch (event.k) {
      case "damage": {
        const from = nodeOf(event.src);
        const to = remoteNodes.get(event.dst);
        if (!to) return;
        if (from && event.by !== "grenade") {
          effects.shot(
            new Vector3(from.position.x, MUZZLE_Y, from.position.z),
            new Vector3(to.position.x, HIT_Y, to.position.z),
            event.by === "aimed",
          );
        }
        // Como en WoW, cada jugador solo ve los números de su propio daño.
        if (mine) {
          effects.damageNumber(new Vector3(to.position.x, NUMBER_Y, to.position.z), event.amount);
        }
        return;
      }
      case "cast":
        if (mine) {
          abilities.casting = true;
          hud.startCast("Disparo apuntado", event.ticks * TICK_MS);
        }
        return;
      case "castEnd":
        if (mine) {
          abilities.casting = false;
          hud.endCast(event.ok);
        }
        return;
      case "grenade": {
        const from = nodeOf(event.src);
        effects.grenade(
          new Vector3(from?.position.x ?? event.fromX, MUZZLE_Y, from?.position.z ?? event.fromZ),
          new Vector3(event.x, 0.15, event.z),
          (event.ticks * TICK_MS) / 1000,
        );
        return;
      }
      case "explosion":
        effects.explosion(new Vector3(event.x, 0.5, event.z), GAME_CONFIG.abilities.grenade.radius);
        return;
      case "stim":
        if (!mine) remoteBoostUntil.set(event.src, performance.now() + event.ticks * TICK_MS);
        return;
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

  controls.onEscape = () => {
    if (aimingGrenade) aimingGrenade = false;
    else setTarget(null);
  };
  controls.onRightClick = () => (aimingGrenade = false);
  controls.onClick = (x, y) => {
    if (aimingGrenade) {
      aimingGrenade = false;
      const p = game.groundPointAt(x, y);
      if (!p) return;
      const blocker = abilityBlocker(AbilityId.Grenade, abilityContext(AbilityId.Grenade));
      if (blocker) return combatHud.alert(BLOCKER_TEXT[blocker]);
      const at = clampToRange(local.current, p, GAME_CONFIG.abilities.grenade.range);
      pendingAbility = { id: AbilityId.Grenade, x: at.x, z: at.z };
      return;
    }
    const id = game.pickHostile(x, y);
    if (id !== null) setTarget(id);
  };
  /** Lo que el cliente sabe ahora para decidir si una habilidad se puede usar. */
  const abilityContext = (id: AbilityId): AbilityContext => {
    const target = targetId !== null ? remoteNodes.get(targetId) : undefined;
    return {
      ready: abilities.isReady(id, performance.now()),
      casting: abilities.casting,
      moving: controls.wantsToMove(),
      self: view,
      target: target ? target.position : null,
      map: MAP,
    };
  };

  controls.onAbility = (id) => {
    const blocker = abilityBlocker(id, abilityContext(id));
    if (blocker) {
      // Pulsar 2 otra vez mientras se apunta la granada la cancela.
      if (id === AbilityId.Grenade && aimingGrenade) aimingGrenade = false;
      else combatHud.alert(BLOCKER_TEXT[blocker]);
      return;
    }
    if (id === AbilityId.AimedShot) {
      if (targetId !== null) pendingAbility = { id, target: targetId };
    } else if (id === AbilityId.Grenade) {
      aimingGrenade = !aimingGrenade; // Pulsar 2 otra vez también cancela.
    } else {
      pendingAbility = { id };
    }
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
  let downKBps = 0;
  let upKBps = 0;
  /** Último tiempo de tick que ha mandado el servidor (mensaje `stats`). */
  let serverStats: { tickMs: number; tickMaxMs: number } | null = null;

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
      if (msg.t === "stats") {
        serverStats = msg;
        continue;
      }
      if (msg.t !== "snapshot") continue;
      local.reconcile(msg);
      if (msg.you) {
        abilities.update(msg.you.cd, msg.ack, now);
        if (msg.you.hp < hp) combatHud.flashDamage();
        hp = msg.you.hp;
      }
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
      const input: PlayerInput = { seq: seq++, forward, strafe, yaw: controls.yaw };
      if (pendingAbility) {
        input.ability = pendingAbility;
        pendingAbility = undefined;
        abilities.used(input.seq, now);
      }
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
      remoteBoostUntil.delete(id);
    }

    // Estimulante: el propio, de la predicción; el de los demás, de su evento.
    game.setBoost(welcome.playerId, (local.current.boostTicks ?? 0) > 0);
    for (const [id, until] of remoteBoostUntil) {
      game.setBoost(id, now < until);
      if (now >= until) remoteBoostUntil.delete(id);
    }

    // Retícula de la granada, a lo sumo a su alcance.
    const aimed = aimingGrenade && game.groundPointAt(controls.pointerX, controls.pointerY);
    game.showReticle(aimed ? clampToRange(pose, aimed, GAME_CONFIG.abilities.grenade.range) : null);

    // Objetivo: anillo (gris si no se le puede disparar) y marco del HUD. Decide el servidor.
    const targetNode = targetId !== null ? (remoteNodes.get(targetId) ?? null) : null;
    const targetEntity = targetId !== null ? remotes.entities.get(targetId) : undefined;
    const targetBlocker =
      targetNode && fireBlocker(pose, targetNode.position, GAME_CONFIG.combat.autoFire.range, MAP);
    game.showTargetMarker(targetNode, targetNode !== null && targetBlocker === null);

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

    const slots: SlotView[] = [AbilityId.AimedShot, AbilityId.Grenade, AbilityId.Stim].map((id) => {
      const blocker = abilityBlocker(id, abilityContext(id));
      return {
        id,
        cooldown: slotCooldown(abilities.cooldown(id, now), abilities.cooldown(0, now)),
        // El enfriamiento ya se ve en el barrido: solo se atenúa por otros motivos.
        blocked: blocker !== null && blocker !== "cooldown",
      };
    });
    const maxTargetHp = targetEntity ? maxHealthOf(targetEntity.kind) : 0;
    combatHud.update({
      hp,
      maxHp: GAME_CONFIG.soldier.health,
      target:
        targetNode && targetEntity
          ? {
              name: targetEntity.name,
              hp: targetEntity.hp ?? maxTargetHp,
              maxHp: maxTargetHp,
              distance: Math.hypot(targetNode.position.x - pose.x, targetNode.position.z - pose.z),
              status: targetBlocker ? BLOCKER_TEXT[targetBlocker] : null,
            }
          : null,
      slots,
    });

    effects.update(dt);
    hud.update();
    game.scene.render();

    // 6. Depuración.
    if (now - bytesWindowStart >= 1000) {
      const seconds = (now - bytesWindowStart) / 1000;
      const bytes = connection.takeBytes();
      downKBps = bytes.received / 1024 / seconds;
      upKBps = bytes.sent / 1024 / seconds;
      bytesWindowStart = now;
    }
    let soldiers = 1;
    let dummies = 0;
    for (const e of remotes.entities.values()) {
      if (e.kind === EntityKind.Soldier) soldiers++;
      else if (e.kind === EntityKind.Dummy) dummies++;
    }
    hud.updateDebug({
      fps: engine.getFps(),
      engine: engine.name,
      rtt: connection.rtt,
      serverTick: remotes.latestTick,
      tickMs: serverStats?.tickMs ?? null,
      tickMaxMs: serverStats?.tickMaxMs ?? null,
      soldiers,
      dummies,
      pending: local.pendingCount,
      correction: local.lastCorrection,
      downKBps,
      upKBps,
      hp,
      x: pose.x,
      z: pose.z,
    });
  });
}
