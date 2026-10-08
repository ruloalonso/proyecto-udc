import {
  AbilityId,
  BotBrain,
  canAutoFireAt,
  canShootAt,
  DIRECTOR_PHASE_NAMES,
  clampToRange,
  EntityKind,
  GAME_CONFIG,
  hasLineOfSight,
  isHostile,
  isMoving,
  keepSoldierInMap,
  MAP,
  nearestShootable,
  STIM_TICKS,
  stepMovement,
  TICK_SECONDS,
  withSpeedBoost,
  emptyDelta,
  writeEntity,
  writeRemovals,
  type AbilityUse,
  type BotEntity,
  type DeathCause,
  type RescueStopReason,
  type AdminCommand,
  type DirectorMessage,
  type DamageEvent,
  type GameEvent,
  type MapData,
  type MoveState,
  type PlayerInput,
  type Point,
  type SentCache,
  type SnapshotMessage,
} from "@udc/shared";
import type { NavMap } from "../ai/navmesh.js";
import { Director } from "../ai/director.js";
import { CrabSwarm, type CrabKind, type SoldierBody } from "../ai/swarm.js";
import {
  ABILITY_TICKS,
  isReady,
  readyCooldowns,
  remainingCooldowns,
  type AbilityCooldowns,
} from "./abilities.js";
import { AUTO_FIRE_INTERVAL_TICKS, autoFire } from "./combat.js";

const { aimedShot, grenade, stim } = GAME_CONFIG.abilities;

export interface Soldier {
  id: number;
  name: string;
  state: MoveState;
  /** Entradas recibidas pendientes de procesar, en orden. */
  inputs: PlayerInput[];
  /** Última secuencia aceptada en la cola. */
  lastQueuedSeq: number;
  /** Última secuencia procesada (se confirma al cliente). */
  lastProcessedSeq: number;
  /** Objetivo seleccionado (siempre una entidad hostil que existe). */
  targetId: number | null;
  /** El objetivo lo eligió el jugador (clic o Tab): se respeta hasta que muere. */
  targetManual: boolean;
  /**
   * Selección automática (E3-5): sin objetivo, o con uno automático al que no se puede
   * disparar, tick a partir del cual se elige otro.
   */
  autoTargetTick: number | null;
  /** Primer tick en el que el fuego automático vuelve a estar listo. */
  nextShotTick: number;
  hp: number;
  cooldowns: AbilityCooldowns;
  /** Disparo apuntado en curso (mientras dura, el fuego automático se detiene). */
  cast: { targetId: number; endTick: number } | null;
  /** Comando de administración: no recibe daño (E7-3). */
  invulnerable: boolean;
  /** Derribado (E5-1): tick en que muere si nadie lo rescata, o `null` si está en pie. */
  downedUntil: number | null;
  /**
   * La última entrada recibida pedía moverse. Derribado, no dispara mientras se arrastra:
   * se mira la última entrada y no solo las de este tick, porque con el jitter de la red hay
   * ticks sin entradas aunque el jugador siga pulsando moverse.
   */
  wantsToMove: boolean;
  /** Ticks seguidos que lleva un raso rematándolo (E5-3); 0 si nadie lo remata. */
  finishTicks: number;
  /** Rescate que está haciendo (E5-2): a quién y en qué tick termina. */
  rescue: { targetId: number; endTick: number } | null;
  /** Derribado: quién le está rescatando, o `null`. */
  rescuedBy: number | null;
  /**
   * Soldado del servidor (E5-6): su entrada la genera el cerebro de los bots en cada tick.
   * `null` si lo controla un jugador.
   */
  bot: { brain: BotBrain; seq: number } | null;
}

/** Granada en el aire. */
interface Grenade {
  src: number;
  x: number;
  z: number;
  explodeTick: number;
}

/** Muñeco de prueba de H2: objetivo hostil estático. */
export interface Dummy {
  id: number;
  name: string;
  /** Índice de su punto en `map.dummies` (reaparece en el mismo sitio). */
  spot: number;
  x: number;
  z: number;
  hp: number;
}

/** Lo último que se le envió a un cliente sobre cada entidad, para mandar solo cambios. */
export type { SentCache };

/** Objetivo hostil: muñeco o centollo. */
interface HostileView extends Point {
  id: number;
}

/** Nombre con el que ven los clientes a cada tipo de centollo (marco de objetivo). */
const CRAB_NAMES: Record<CrabKind, string> = {
  [EntityKind.Crab]: "Centollo raso",
  [EntityKind.Spitter]: "Escupidor",
};
const CRAB_RADIUS: Record<CrabKind, number> = {
  [EntityKind.Crab]: GAME_CONFIG.crab.radius,
  [EntityKind.Spitter]: GAME_CONFIG.spitter.radius,
};
const SPIT_NAME = "Escupitajo";

const DOWNED_TICKS = Math.round(GAME_CONFIG.soldier.downed.seconds / TICK_SECONDS);
const FINISH_TICKS = Math.round(GAME_CONFIG.soldier.downed.finishSeconds / TICK_SECONDS);
const RESCUE_TICKS = Math.round(GAME_CONFIG.soldier.rescue.seconds / TICK_SECONDS);
const DEFUNCT_TICKS = Math.round(GAME_CONFIG.soldier.defunctSeconds / TICK_SECONDS);
/** El derribado dispara con fuego lento (spec §3.2). */
const DOWNED_FIRE_TICKS = Math.round(
  AUTO_FIRE_INTERVAL_TICKS * GAME_CONFIG.soldier.downed.fireIntervalFactor,
);
const AUTO_SELECT_TICKS = Math.round(GAME_CONFIG.targeting.autoSelectDelay / TICK_SECONDS);
const DUMMY_RESPAWN_TICKS = Math.round(GAME_CONFIG.dummy.respawnSeconds / TICK_SECONDS);

export class World {
  tick = 0;
  readonly soldiers = new Map<number, Soldier>();
  readonly dummies = new Map<number, Dummy>();
  /** Eventos del último tick (daño...). Se envían a todos los clientes. */
  events: GameEvent[] = [];
  private dummyRespawns: { spot: number; atTick: number }[] = [];
  private grenades: Grenade[] = [];
  private nextEntityId = 1;
  private nextRecruitNumber: number = GAME_CONFIG.recruit.firstNumber;
  /** Centollos (E4-2, E4-3). Sin navmesh no hay centollos (algunos tests). */
  readonly crabs: CrabSwarm | null;
  /**
   * Modo de prueba hasta que exista el director (E4-4): rasos y escupidores que se mantienen
   * vivos, saliendo por turnos de las madrigueras. Variables `CRABS` y `SPITTERS` del servidor.
   */
  crabQuota = 0;
  spitterQuota = 0;
  /**
   * Director de oleadas (E4-4). Empieza con el primer soldado y se reinicia al irse todos.
   * No actúa en el modo de prueba (`crabQuota`, `spitterQuota`).
   */
  readonly director: Director | null;
  /** Comandos de administración permitidos (servidor arrancado con `--admin`, E7-3). */
  adminEnabled = false;
  /**
   * Completar el pelotón con soldados del servidor (E5-6). Lo activa el servidor; los tests,
   * cuando lo necesitan.
   */
  squadBots = false;
  /** Eventos ocurridos entre ticks (relevos): se envían con los del siguiente tick. */
  private pendingEvents: GameEvent[] = [];
  /** Dentro de `step` (los eventos van al tick actual). */
  private stepping = false;
  /** Jugadores muertos esperando relevo, tras la pantalla de defunción (E5-4). */
  private pendingReliefs: { deadId: number; atTick: number }[] = [];
  private reliefs: { from: number; to: number | null }[] = [];
  private nextBurrow = 0;

  constructor(
    private readonly map: MapData = MAP,
    nav?: NavMap,
  ) {
    this.crabs = nav ? new CrabSwarm(nav, map, () => this.nextEntityId++) : null;
    this.director = nav ? new Director(map) : null;
    map.dummies.forEach((_, spot) => this.spawnDummy(spot));
  }

  /** Crea un muñeco en su punto del mapa. Cada aparición es una entidad nueva. */
  private spawnDummy(spot: number): void {
    const p = this.map.dummies[spot]!;
    const id = this.nextEntityId++;
    this.dummies.set(id, {
      id,
      name: `Centollo de cartón nº ${spot + 1}`,
      spot,
      x: p.x,
      z: p.z,
      hp: GAME_CONFIG.dummy.health,
    });
  }

  /** No caben más jugadores (los bots no cuentan: se relevan). */
  get isFull(): boolean {
    return this.humanCount >= GAME_CONFIG.match.maxPlayers;
  }

  /** Punto de aparición al azar junto a la plataforma, mirando hacia el sur (−Z), hacia los centollos. */
  private spawnState(): MoveState {
    const { spawn } = this.map;
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * spawn.radius;
    return { x: spawn.x + Math.cos(angle) * r, z: spawn.z + Math.sin(angle) * r, yaw: Math.PI };
  }

  addSoldier(): Soldier {
    const soldier: Soldier = {
      id: this.nextEntityId++,
      name: `Recluta nº ${(this.nextRecruitNumber++).toLocaleString("es-ES")}`,
      state: this.spawnState(),
      inputs: [],
      lastQueuedSeq: -1,
      lastProcessedSeq: -1,
      targetId: null,
      targetManual: false,
      autoTargetTick: null,
      nextShotTick: 0,
      hp: GAME_CONFIG.soldier.health,
      cooldowns: readyCooldowns(),
      cast: null,
      invulnerable: false,
      downedUntil: null,
      wantsToMove: false,
      finishTicks: 0,
      rescue: null,
      rescuedBy: null,
      bot: null,
    };
    this.soldiers.set(soldier.id, soldier);
    return soldier;
  }

  /** Jugadores conectados (los soldados que no son bots). */
  get humanCount(): number {
    let n = 0;
    for (const s of this.soldiers.values()) if (!s.bot) n++;
    return n;
  }

  /**
   * Entra un jugador (E5-6). Con el pelotón completado por bots, el primero llega con 7 bots y
   * los siguientes relevan a un bot en pie: se quedan con su soldado tal cual y empiezan a numerar
   * sus entradas de cero. Si no queda ningún bot en pie, `null`: entra de espectador (E5-5).
   * Sin bots (tests), es un soldado más.
   */
  addHuman(): Soldier | null {
    if (!this.squadBots) return this.addSoldier();
    if (this.soldiers.size > 0) {
      // Partida en marcha: releva a un bot en pie; si no queda ninguno, espectador (E5-5).
      const standing = [...this.soldiers.values()].find(
        (s) => s.bot && s.downedUntil === null && s.rescuedBy === null,
      );
      if (standing) this.setControl(standing, false);
      return standing ?? null;
    }
    const human = this.addSoldier();
    while (this.soldiers.size < GAME_CONFIG.match.maxPlayers) {
      this.setControl(this.addSoldier(), true);
    }
    return human;
  }

  /**
   * Se va un jugador (E5-6). Si quedan otros, su soldado pasa a ser un bot (el pelotón no pierde
   * un fusil); si era el último, se quitan todos los bots (y el director se reinicia solo).
   */
  removeHuman(id: number): void {
    const s = this.soldiers.get(id);
    if (!s) return;
    if (!this.squadBots) return this.removeSoldier(id);
    if (this.humanCount > 1) return this.setControl(s, true);
    for (const other of [...this.soldiers.keys()]) this.removeSoldier(other);
  }

  /** Pasa un soldado a bot o a jugador. La cola de entradas empieza de cero. */
  private setControl(s: Soldier, bot: boolean): void {
    s.bot = bot ? { brain: new BotBrain(this.map), seq: 0 } : null;
    s.inputs = [];
    s.lastQueuedSeq = -1;
    s.lastProcessedSeq = -1;
    // Fuera del tick (al entrar o salir un jugador), sale con los eventos del siguiente.
    (this.stepping ? this.events : this.pendingEvents).push({ k: "control", src: s.id, bot });
  }

  /** Los bots del servidor deciden su entrada de este tick con el cerebro de los bots (E7-4). */
  private thinkBots(): void {
    let entities: BotEntity[] | null = null;
    for (const s of this.soldiers.values()) {
      if (!s.bot) continue;
      entities ??= this.botEntities();
      const self = {
        x: s.state.x,
        z: s.state.z,
        yaw: s.state.yaw,
        hp: s.hp,
        cd: remainingCooldowns(s.cooldowns, this.tick),
        target: s.targetId,
      };
      const others = entities.filter((e) => e.id !== s.id);
      const { forward, strafe, yaw, ability } = s.bot.brain.think(self, others);
      this.queueInput(s.id, {
        seq: s.bot.seq++,
        forward,
        strafe,
        yaw,
        ...(ability ? { ability } : {}),
      });
    }
  }

  /** Lo que ve un bot: hostiles y soldados. */
  private botEntities(): BotEntity[] {
    const entities: BotEntity[] = [];
    for (const d of this.dummies.values()) {
      entities.push({ id: d.id, kind: EntityKind.Dummy, x: d.x, z: d.z });
    }
    this.crabs?.forEach((c) => entities.push({ id: c.id, kind: c.kind, x: c.x, z: c.z }));
    for (const s of this.soldiers.values()) {
      entities.push({ id: s.id, kind: EntityKind.Soldier, x: s.state.x, z: s.state.z });
    }
    return entities;
  }

  removeSoldier(id: number): void {
    const s = this.soldiers.get(id);
    if (s?.rescue) this.stopRescue(s, "range");
    const rescuer = s?.rescuedBy !== null && s ? this.soldiers.get(s.rescuedBy) : undefined;
    if (rescuer) this.stopRescue(rescuer, "died");
    this.soldiers.delete(id);
  }

  queueInput(id: number, input: PlayerInput): void {
    const s = this.soldiers.get(id);
    if (!s) return;
    if (!Number.isInteger(input.seq) || input.seq <= s.lastQueuedSeq) return;
    s.lastQueuedSeq = input.seq;
    s.inputs.push(input);
    const { maxQueuedInputs } = GAME_CONFIG.net;
    if (s.inputs.length > maxQueuedInputs) s.inputs.splice(0, s.inputs.length - maxQueuedInputs);
  }

  /** Hace aparecer un centollo cerca de `at`. Devuelve su id, o `null` si no se pudo. */
  spawnCrab(at: Point, kind: CrabKind = EntityKind.Crab): number | null {
    if (!this.crabs) return null;
    const id = this.nextEntityId++;
    return this.crabs.spawn(id, at, kind) ? id : null;
  }

  /** Tipo de una entidad que existe, o `null` si no existe. */
  kindOf(id: number): EntityKind | null {
    if (this.soldiers.has(id)) return EntityKind.Soldier;
    if (this.dummies.has(id)) return EntityKind.Dummy;
    return this.crabs?.kindOf(id) ?? null;
  }

  /** Posición de un objetivo hostil que existe, o `undefined`. */
  private hostile(id: number): HostileView | undefined {
    const dummy = this.dummies.get(id);
    if (dummy) return dummy;
    const crab = this.crabs?.pose(id);
    return crab ? { id, ...crab } : undefined;
  }

  private isValidTarget(id: number): boolean {
    const kind = this.kindOf(id);
    return kind !== null && isHostile(kind);
  }

  /** Selección de objetivo pedida por el cliente. Si no es válida, se quita el objetivo. */
  setTarget(soldierId: number, targetId: number | null): void {
    const s = this.soldiers.get(soldierId);
    if (!s) return;
    s.targetId = targetId !== null && this.isValidTarget(targetId) ? targetId : null;
    s.targetManual = s.targetId !== null;
    s.autoTargetTick = null;
  }

  /** Todos los objetivos hostiles que existen (muñecos y centollos). */
  private hostiles(): HostileView[] {
    const all: HostileView[] = [...this.dummies.values()];
    this.crabs?.forEach((c) => all.push(c));
    return all;
  }

  /**
   * Selección automática (E3-5, §4.2). Sin objetivo, pasado un breve retardo, se elige el hostil
   * más cercano al que se puede disparar; si no hay ninguno, se vuelve a mirar en cada tick.
   * Un objetivo elegido a mano se respeta hasta que muere. Uno elegido por la selección
   * automática se respeta mientras se le pueda disparar; si lleva el retardo sin poder (se ha
   * salido del cono, del alcance o está tapado) y hay otro de frente, se cambia.
   */
  private autoTarget(s: Soldier, hostiles: () => HostileView[]): void {
    if (s.targetId !== null) {
      const current = s.targetManual ? undefined : this.hostile(s.targetId);
      if (!current || canAutoFireAt(s.state, current, this.map)) {
        s.autoTargetTick = null;
        return;
      }
      s.autoTargetTick ??= this.tick + AUTO_SELECT_TICKS;
    } else {
      s.targetManual = false;
      // Se nota un tick después de perderlo (el objetivo muere en el combate del tick anterior):
      // el retardo se cuenta desde entonces.
      s.autoTargetTick ??= this.tick + AUTO_SELECT_TICKS - 1;
    }
    if (this.tick < s.autoTargetTick) return;
    const target = nearestShootable(s.state, hostiles(), this.map);
    if (!target) return;
    s.targetId = target.id;
    s.autoTargetTick = null;
  }

  /** Aplica daño a una entidad y lo registra como evento del tick. */
  private applyDamage(event: DamageEvent): void {
    const dummy = this.dummies.get(event.dst);
    if (dummy) {
      dummy.hp -= event.amount;
      this.events.push(event);
      if (dummy.hp <= 0) {
        this.dummies.delete(dummy.id);
        this.dummyRespawns.push({ spot: dummy.spot, atTick: this.tick + DUMMY_RESPAWN_TICKS });
      }
      return;
    }
    if (this.crabs?.has(event.dst)) {
      this.events.push(event);
      this.crabs.damage(event.dst, event.amount);
      return;
    }
    const soldier = this.soldiers.get(event.dst);
    if (!soldier || soldier.invulnerable) return;
    // Al rescatador, cualquier daño le corta el rescate (spec §3.2).
    if (soldier.rescue) this.stopRescue(soldier, "damaged");
    if (soldier.downedUntil !== null) {
      // Derribado: solo le hace algo la granada, y lo mata (E5-3). Los mordiscos no: lo rematan.
      if (event.by !== "grenade") return;
      this.events.push(event);
      this.killSoldier(soldier, "grenade");
      return;
    }
    soldier.hp = Math.max(0, soldier.hp - event.amount);
    this.events.push(event);
    if (soldier.hp === 0) this.downSoldier(soldier);
  }

  /**
   * Muere un derribado (E5-3): un fusil menos para siempre, sin reaparición (spec §3.2). Si era
   * un jugador, tras la pantalla de defunción releva a un bot en pie o pasa a espectador (E5-4).
   */
  private killSoldier(s: Soldier, cause: DeathCause): void {
    if (s.finishTicks > 0) this.events.push({ k: "finishStop", dst: s.id });
    this.events.push({ k: "death", src: s.id, cause });
    if (!s.bot) this.pendingReliefs.push({ deadId: s.id, atTick: this.tick + DEFUNCT_TICKS });
    this.removeSoldier(s.id);
  }

  /** Relevos que tocan este tick: a un bot en pie, o a espectador si no queda ninguno. */
  private updateReliefs(): void {
    const due = this.pendingReliefs.filter((r) => r.atTick <= this.tick);
    if (due.length === 0) return;
    this.pendingReliefs = this.pendingReliefs.filter((r) => r.atTick > this.tick);
    for (const { deadId } of due) {
      const bot = [...this.soldiers.values()].find(
        (s) => s.bot && s.downedUntil === null && s.rescuedBy === null,
      );
      if (bot) this.setControl(bot, false);
      this.reliefs.push({ from: deadId, to: bot?.id ?? null });
    }
  }

  /**
   * Relevos resueltos desde la última llamada (E5-4): el jugador del soldado `from` pasa a
   * controlar `to`, o a espectador si `to` es `null`. Los consume el servidor de red.
   */
  takeReliefs(): { from: number; to: number | null }[] {
    const reliefs = this.reliefs;
    this.reliefs = [];
    return reliefs;
  }

  /**
   * Pulsar F junto a un aliado derribado (E5-2). Hace falta estar en pie, a su alcance y que
   * nadie lo esté rematando ni rescatando. El derribado se queda inmóvil mientras tanto (aunque
   * se estuviera arrastrando).
   */
  private startRescue(s: Soldier, targetId: number): void {
    const target = this.soldiers.get(targetId);
    if (!target || target === s || s.downedUntil !== null || s.rescue) return;
    if (target.downedUntil === null || target.rescuedBy !== null || target.finishTicks > 0) return;
    const { range } = GAME_CONFIG.soldier.rescue;
    if (Math.hypot(target.state.x - s.state.x, target.state.z - s.state.z) > range) return;
    if (s.cast) this.endCast(s, false);
    s.rescue = { targetId, endTick: this.tick + RESCUE_TICKS };
    target.rescuedBy = s.id;
    target.state = { ...target.state, pinned: true };
    this.events.push({ k: "rescue", src: s.id, dst: targetId, ticks: RESCUE_TICKS });
  }

  /** Corta el rescate de `s` (el rescatador). El derribado vuelve a poder moverse. */
  private stopRescue(s: Soldier, reason: RescueStopReason): void {
    const rescue = s.rescue;
    if (!rescue) return;
    s.rescue = null;
    const target = this.soldiers.get(rescue.targetId);
    if (target) {
      target.rescuedBy = null;
      const state = { ...target.state };
      delete state.pinned;
      target.state = state;
    }
    this.events.push({ k: "rescueStop", src: s.id, dst: rescue.targetId, reason });
  }

  /** Rescates en curso: se completan a su hora o se cortan si dejan de cumplirse. */
  private updateRescues(): void {
    const { range, healthFraction } = GAME_CONFIG.soldier.rescue;
    for (const s of this.soldiers.values()) {
      const rescue = s.rescue;
      if (!rescue) continue;
      const target = this.soldiers.get(rescue.targetId);
      if (!target || target.downedUntil === null) {
        this.stopRescue(s, "died");
        continue;
      }
      if (Math.hypot(target.state.x - s.state.x, target.state.z - s.state.z) > range) {
        this.stopRescue(s, "range");
        continue;
      }
      if (this.tick < rescue.endTick) continue;
      // Rescatado: se levanta con parte de la vida.
      s.rescue = null;
      target.rescuedBy = null;
      target.downedUntil = null;
      target.finishTicks = 0;
      target.hp = Math.round(GAME_CONFIG.soldier.health * healthFraction);
      const state = { ...target.state };
      delete state.downed;
      delete state.pinned;
      target.state = state;
      this.events.push({ k: "rescued", src: s.id, dst: target.id });
    }
  }

  /** A 0 de vida, el soldado cae derribado (E5-1, spec §3.2). */
  private downSoldier(s: Soldier): void {
    if (s.cast) this.endCast(s, false);
    s.downedUntil = this.tick + DOWNED_TICKS;
    s.state = { ...s.state, downed: true };
    this.events.push({ k: "downed", src: s.id, ticks: DOWNED_TICKS });
  }

  /**
   * Uso de una habilidad, en la entrada en que llega. Si no se puede (enfriamiento,
   * objetivo no válido, ya apuntando), se ignora.
   */
  private useAbility(s: Soldier, use: AbilityUse): void {
    // Derribado: sin habilidades (spec §3.2).
    if (s.downedUntil !== null) return;
    if (s.cast || !isReady(s.cooldowns, use.id, this.tick)) return;

    switch (use.id) {
      case AbilityId.AimedShot: {
        const target = use.target !== undefined ? this.hostile(use.target) : undefined;
        if (!target || !canShootAt(s.state, target, aimedShot.range, this.map)) return;
        const ticks = ABILITY_TICKS.aimedShotCast;
        s.cast = { targetId: target.id, endTick: this.tick + ticks };
        this.events.push({ k: "cast", src: s.id, ability: use.id, target: target.id, ticks });
        break;
      }
      case AbilityId.Grenade: {
        if (use.x === undefined || use.z === undefined) return;
        const at = clampToRange(s.state, { x: use.x, z: use.z }, grenade.range);
        const ticks = ABILITY_TICKS.grenadeFuse;
        this.grenades.push({ src: s.id, ...at, explodeTick: this.tick + ticks });
        this.events.push({
          k: "grenade",
          src: s.id,
          fromX: s.state.x,
          fromZ: s.state.z,
          ...at,
          ticks,
        });
        s.cooldowns[AbilityId.Grenade] = this.tick + ABILITY_TICKS.grenadeCooldown;
        break;
      }
      case AbilityId.Stim: {
        // Antes de mover esta entrada, igual que en la predicción del cliente.
        s.state = withSpeedBoost(s.state);
        s.hp = Math.min(GAME_CONFIG.soldier.health, s.hp + stim.heal);
        s.cooldowns[AbilityId.Stim] = this.tick + ABILITY_TICKS.stimCooldown;
        this.events.push({ k: "stim", src: s.id, ticks: STIM_TICKS });
        break;
      }
    }
    s.cooldowns.global = this.tick + ABILITY_TICKS.globalCooldown;
  }

  private endCast(s: Soldier, ok: boolean): void {
    s.cast = null;
    this.events.push({ k: "castEnd", src: s.id, ok });
  }

  /** Disparo apuntado: se cancela si el objetivo desaparece; al acabar, necesita alcance y visión. */
  private updateCast(s: Soldier): void {
    const cast = s.cast;
    if (!cast) return;
    const target = this.hostile(cast.targetId);
    if (!target) return this.endCast(s, false);
    if (this.tick < cast.endTick) return;
    if (!canShootAt(s.state, target, aimedShot.range, this.map)) return this.endCast(s, false);
    this.endCast(s, true);
    // El enfriamiento empieza al completarlo; si se interrumpe, solo cuenta el global.
    s.cooldowns[AbilityId.AimedShot] = this.tick + ABILITY_TICKS.aimedShotCooldown;
    this.applyDamage({
      k: "damage",
      src: s.id,
      dst: target.id,
      amount: aimedShot.damage,
      by: "aimed",
    });
  }

  /** Granadas que caen este tick: dañan a los hostiles en el radio que no estén a cubierto. */
  private updateGrenades(): void {
    const due = this.grenades.filter((g) => g.explodeTick <= this.tick);
    if (due.length === 0) return;
    this.grenades = this.grenades.filter((g) => g.explodeTick > this.tick);
    for (const g of due) {
      this.events.push({ k: "explosion", src: g.src, x: g.x, z: g.z });
      // Una granada que explota dentro de una madriguera abierta la tapona (§4.2).
      const burrow = this.director?.isRunning ? this.director.burrowAt(g) : null;
      if (burrow !== null && burrow !== undefined) this.events.push(...this.director!.plug(burrow));
      // Daña a los hostiles y también a los soldados, quien la lanza incluido (E3-6): fuego
      // amigo solo con la granada. Los obstáculos cubren.
      const hit: HostileView[] = this.hostiles();
      for (const s of this.soldiers.values()) hit.push({ id: s.id, x: s.state.x, z: s.state.z });
      for (const h of hit) {
        if (Math.hypot(h.x - g.x, h.z - g.z) > grenade.radius) continue;
        if (!hasLineOfSight(g, h, this.map)) continue;
        this.applyDamage({
          k: "damage",
          src: g.src,
          dst: h.id,
          amount: grenade.damage,
          by: "grenade",
        });
      }
    }
  }

  /** Los centollos no se dejan atravesar (§7.5): el soldado se queda en contacto. */
  private pushOutOfCrabs(s: Soldier): void {
    const crabs = this.crabs;
    if (!crabs || crabs.count === 0) return;
    let { x, z } = s.state;
    crabs.forEach((c) => {
      const contact = GAME_CONFIG.soldier.radius + CRAB_RADIUS[c.kind];
      const dx = x - c.x;
      const dz = z - c.z;
      const d = Math.hypot(dx, dz);
      if (d >= contact) return;
      const nx = d > 1e-6 ? dx / d : 0;
      const nz = d > 1e-6 ? dz / d : 1;
      x = c.x + nx * contact;
      z = c.z + nz * contact;
    });
    if (x === s.state.x && z === s.state.z) return;
    ({ x, z } = keepSoldierInMap(x, z, this.map));
    s.state = { ...s.state, x, z };
  }

  /** Modo de prueba: mantiene las cuotas de cada tipo, uno por madriguera y tick como mucho. */
  private refillCrabs(): void {
    const crabs = this.crabs;
    if (!crabs) return;
    const burrows = this.map.burrows;
    const missing: CrabKind[] = [];
    for (let n = crabs.countOf(EntityKind.Crab); n < this.crabQuota; n++) {
      missing.push(EntityKind.Crab);
    }
    for (let n = crabs.countOf(EntityKind.Spitter); n < this.spitterQuota; n++) {
      missing.push(EntityKind.Spitter);
    }
    for (const kind of missing.slice(0, burrows.length)) {
      this.spawnCrab(burrows[this.nextBurrow++ % burrows.length]!, kind);
    }
  }

  /** Director de oleadas: empieza con el primer soldado, se reinicia al irse todos. */
  private updateDirector(): void {
    const { director, crabs } = this;
    if (!director || !crabs) return;
    if (this.soldiers.size === 0) {
      if (director.isRunning) {
        director.reset();
        crabs.clear();
      }
      return;
    }
    if (!director.isRunning) director.start();
    const { spawns, events } = director.step(crabs.count);
    this.events.push(...events);
    for (const { burrow, kind } of spawns) {
      const b = this.map.burrows[burrow]!;
      // En cualquier punto de la madriguera (el crowd los separa).
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * GAME_CONFIG.director.burrowRadius * 0.8;
      this.spawnCrab({ x: b.x + Math.cos(angle) * r, z: b.z + Math.sin(angle) * r }, kind);
    }
  }

  /**
   * Comandos de administración (E7-3), solo si el servidor arrancó con `--admin`. Devuelve el
   * texto que ve quien lo pidió, o `null` si están desactivados.
   */
  admin(soldierId: number, cmd: AdminCommand): string | null {
    if (!this.adminEnabled) return null;
    const s = this.soldiers.get(soldierId);
    if (!s) return null;
    switch (cmd) {
      case "invulnerable":
        s.invulnerable = !s.invulnerable;
        return s.invulnerable
          ? "Invulnerabilidad concedida por el Alto Mando. No se acostumbre."
          : "Invulnerabilidad revocada. Vuelve a ser prescindible.";
      case "killAll": {
        const n = this.crabs?.count ?? 0;
        this.crabs?.clear();
        return `${n} centollos exterminados por decreto.`;
      }
      case "nextPhase":
      case "nextPush":
      case "finalWave": {
        const director = this.director;
        if (!director || this.crabQuota + this.spitterQuota > 0) {
          return "No hay director de oleadas (modo de prueba con CRABS o SPITTERS).";
        }
        const to =
          cmd === "nextPhase"
            ? director.nextPhaseTick()
            : cmd === "nextPush"
              ? director.nextPushTick()
              : director.finalTick;
        if (to === null) return "Ya es la oleada final. No hay nada después.";
        director.jumpTo(to);
        return `Orden del Alto Mando: ${DIRECTOR_PHASE_NAMES[director.phaseAt(to)]}.`;
      }
    }
  }

  /** Estado del director para los clientes, o `null` si no hay director. */
  directorStatus(): DirectorMessage | null {
    return this.director?.status(this.tick) ?? null;
  }

  /** Estado del director si ha cambiado desde la última llamada (para enviarlo), o `null`. */
  takeDirectorStatus(): DirectorMessage | null {
    return this.director?.takeChanged() ? this.directorStatus() : null;
  }

  /** Centollos: IA, movimiento, mordiscos y escupitajos. */
  private updateCrabs(): void {
    if (!this.crabs) return;
    if (this.crabQuota + this.spitterQuota > 0) this.refillCrabs();
    else this.updateDirector();
    const bodies: SoldierBody[] = [];
    for (const s of this.soldiers.values()) {
      const body: SoldierBody = {
        id: s.id,
        x: s.state.x,
        z: s.state.z,
        downed: s.downedUntil !== null,
      };
      // Mientras le rescatan, los centollos van a por el rescatador (spec §3.2).
      if (s.rescuedBy !== null) body.rescuer = s.rescuedBy;
      bodies.push(body);
    }
    for (const hit of this.crabs.step(this.tick, bodies)) this.applyDamage(hit);
    this.updateFinishing();
  }

  /**
   * Remates (E5-3): un raso pegado a un derribado lo mata en `finishSeconds`. Si se corta (el raso
   * muere o se aparta), vuelve a empezar de cero: matarlo a tiempo lo salva.
   */
  private updateFinishing(): void {
    const finishing = this.crabs?.finishing;
    for (const s of [...this.soldiers.values()]) {
      const exposed = s.downedUntil !== null && !s.invulnerable && s.rescuedBy === null;
      const crab = exposed ? finishing?.get(s.id) : undefined;
      if (crab === undefined) {
        if (s.finishTicks > 0) this.events.push({ k: "finishStop", dst: s.id });
        s.finishTicks = 0;
        continue;
      }
      if (s.finishTicks === 0) {
        this.events.push({ k: "finish", src: crab, dst: s.id, ticks: FINISH_TICKS });
      }
      s.finishTicks++;
      if (s.finishTicks >= FINISH_TICKS) this.killSoldier(s, "finish");
    }
  }

  /** Avanza la simulación un tick. */
  step(): void {
    this.stepping = true;
    try {
      this.stepInner();
    } finally {
      this.stepping = false;
    }
  }

  private stepInner(): void {
    this.tick++;
    this.events = this.pendingEvents;
    this.pendingEvents = [];

    const due = this.dummyRespawns.filter((r) => r.atTick <= this.tick);
    if (due.length > 0) {
      this.dummyRespawns = this.dummyRespawns.filter((r) => r.atTick > this.tick);
      for (const r of due) this.spawnDummy(r.spot);
    }

    this.updateReliefs();
    this.thinkBots();

    const { maxInputsPerTick } = GAME_CONFIG.net;
    // La lista de hostiles solo se construye si algún soldado la necesita, y una vez por tick.
    let hostiles: HostileView[] | null = null;
    const getHostiles = () => (hostiles ??= this.hostiles());
    /** Soldados que se han movido este tick (derribados: no disparan, E5-1). */
    const crawling = new Set<number>();
    for (const s of this.soldiers.values()) {
      // Se procesan varias entradas por tick para absorber el jitter de red,
      // con un tope para limitar trampas de velocidad.
      const batch = s.inputs.splice(0, maxInputsPerTick);
      let movedThisTick = false;
      for (const input of batch) {
        // Usar una habilidad o moverse corta el rescate que esté haciendo (E5-2).
        if (input.ability && s.rescue) this.stopRescue(s, "ability");
        if (input.ability) this.useAbility(s, input.ability);
        if (input.revive !== undefined) this.startRescue(s, input.revive);
        if (s.rescue && isMoving(input)) this.stopRescue(s, "moved");
        if (s.cast && isMoving(input)) this.endCast(s, false);
        if (isMoving(input)) movedThisTick = true;
        s.wantsToMove = isMoving(input);
        s.state = stepMovement(s.state, input, this.map);
        s.lastProcessedSeq = input.seq;
      }
      if (movedThisTick) crawling.add(s.id);
      // Si nadie lo rescata a tiempo, muere (E5-3).
      if (s.downedUntil !== null && this.tick >= s.downedUntil) this.killSoldier(s, "time");
      // Fuera de la simulación compartida: el cliente no predice este choque (§7.5).
      this.pushOutOfCrabs(s);
      if (s.targetId !== null && !this.isValidTarget(s.targetId)) s.targetId = null;
      this.autoTarget(s, getHostiles);
    }

    this.updateRescues();

    // Combate, después de mover a todos.
    for (const s of this.soldiers.values()) this.updateCast(s);
    this.updateGrenades();
    for (const s of this.soldiers.values()) {
      // Mientras apunta, el fuego automático se detiene. Derribado: fuego lento, y solo si no
      // se ha arrastrado este tick (nunca las dos cosas a la vez).
      // Rescatando, tampoco: tiene las manos ocupadas (E5-2).
      if (s.targetId === null || s.cast || s.rescue) continue;
      const downed = s.downedUntil !== null;
      if (downed && (s.wantsToMove || crawling.has(s.id))) continue;
      const interval = downed ? DOWNED_FIRE_TICKS : AUTO_FIRE_INTERVAL_TICKS;
      const shot = autoFire(this.tick, s, this.hostile(s.targetId), this.map, interval);
      if (shot) this.applyDamage(shot);
    }

    this.updateCrabs();
  }

  /** Construye el snapshot para un jugador concreto y actualiza su caché de envíos. */
  buildSnapshot(viewerId: number | null, sent: SentCache): SnapshotMessage {
    const delta = emptyDelta();

    for (const s of this.soldiers.values()) {
      if (s.id === viewerId) continue;
      const { x, z, yaw } = s.state;
      // La vida viaja para que los aliados vean quién está derribado (vida 0).
      writeEntity(delta, sent, {
        id: s.id,
        kind: EntityKind.Soldier,
        name: s.name,
        x,
        z,
        yaw,
        hp: s.hp,
        bot: s.bot !== null,
      });
    }
    // Los muñecos miran al norte, hacia la colonia. Solo viajan al aparecer o al cambiar su vida.
    for (const d of this.dummies.values()) {
      writeEntity(delta, sent, { ...d, kind: EntityKind.Dummy, yaw: 0 });
    }
    this.crabs?.forEach((c) => writeEntity(delta, sent, { ...c, name: CRAB_NAMES[c.kind] }));
    this.crabs?.forEachSpit((spit) => {
      writeEntity(delta, sent, { ...spit, kind: EntityKind.Spit, name: SPIT_NAME });
    });
    writeRemovals(delta, sent, (id) => this.kindOf(id) !== null);

    const me = viewerId !== null ? this.soldiers.get(viewerId) : undefined;
    return {
      t: "snapshot",
      tick: this.tick,
      ack: me?.lastProcessedSeq ?? -1,
      you: me
        ? {
            ...me.state,
            hp: me.hp,
            target: me.targetId,
            ...(me.invulnerable ? { invulnerable: true as const } : {}),
            ...(me.downedUntil !== null ? { downedTicks: me.downedUntil - this.tick } : {}),
            cd: remainingCooldowns(me.cooldowns, this.tick),
          }
        : null,
      ...delta,
    };
  }
}
