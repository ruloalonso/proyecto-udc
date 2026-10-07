import {
  EntityKind,
  GAME_CONFIG,
  isHostile,
  MAP,
  quantizePos,
  quantizeYaw,
  stepMovement,
  TICK_SECONDS,
  type DamageEvent,
  type GameEvent,
  type MoveInput,
  type MoveState,
  type NetEntity,
  type SnapshotMessage,
} from "@udc/shared";
import { autoFire } from "./combat.js";

export interface Soldier {
  id: number;
  name: string;
  state: MoveState;
  /** Entradas recibidas pendientes de procesar, en orden. */
  inputs: MoveInput[];
  /** Última secuencia aceptada en la cola. */
  lastQueuedSeq: number;
  /** Última secuencia procesada (se confirma al cliente). */
  lastProcessedSeq: number;
  /** Objetivo seleccionado (siempre una entidad hostil que existe). */
  targetId: number | null;
  /** Primer tick en el que el fuego automático vuelve a estar listo. */
  nextShotTick: number;
}

/** Muñeco de prueba de H2: objetivo hostil estático. */
export interface Dummy {
  id: number;
  name: string;
  /** Índice de su punto en `MAP.dummies` (reaparece en el mismo sitio). */
  spot: number;
  x: number;
  z: number;
  hp: number;
}

interface SentState {
  x: number;
  z: number;
  yaw: number;
  hp?: number;
}

/** Lo último que se le envió a un cliente sobre cada entidad, para mandar solo cambios. */
export type SentCache = Map<number, SentState>;

const DUMMY_RESPAWN_TICKS = Math.round(GAME_CONFIG.dummy.respawnSeconds / TICK_SECONDS);

export class World {
  tick = 0;
  readonly soldiers = new Map<number, Soldier>();
  readonly dummies = new Map<number, Dummy>();
  /** Eventos del último tick (daño...). Se envían a todos los clientes. */
  events: GameEvent[] = [];
  private dummyRespawns: { spot: number; atTick: number }[] = [];
  private nextEntityId = 1;
  private nextRecruitNumber: number = GAME_CONFIG.recruit.firstNumber;

  constructor() {
    MAP.dummies.forEach((_, spot) => this.spawnDummy(spot));
  }

  /** Crea un muñeco en su punto del mapa. Cada aparición es una entidad nueva. */
  private spawnDummy(spot: number): void {
    const p = MAP.dummies[spot]!;
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

  get isFull(): boolean {
    return this.soldiers.size >= GAME_CONFIG.match.maxPlayers;
  }

  addSoldier(): Soldier {
    const { spawn } = MAP;
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * spawn.radius;
    const soldier: Soldier = {
      id: this.nextEntityId++,
      name: `Recluta nº ${(this.nextRecruitNumber++).toLocaleString("es-ES")}`,
      // Aparecen mirando hacia el sur (−Z), hacia donde vendrán los centollos.
      state: { x: spawn.x + Math.cos(angle) * r, z: spawn.z + Math.sin(angle) * r, yaw: Math.PI },
      inputs: [],
      lastQueuedSeq: -1,
      lastProcessedSeq: -1,
      targetId: null,
      nextShotTick: 0,
    };
    this.soldiers.set(soldier.id, soldier);
    return soldier;
  }

  removeSoldier(id: number): void {
    this.soldiers.delete(id);
  }

  queueInput(id: number, input: MoveInput): void {
    const s = this.soldiers.get(id);
    if (!s) return;
    if (!Number.isInteger(input.seq) || input.seq <= s.lastQueuedSeq) return;
    s.lastQueuedSeq = input.seq;
    s.inputs.push(input);
    const { maxQueuedInputs } = GAME_CONFIG.net;
    if (s.inputs.length > maxQueuedInputs) s.inputs.splice(0, s.inputs.length - maxQueuedInputs);
  }

  /** Tipo de una entidad que existe, o `null` si no existe. */
  kindOf(id: number): EntityKind | null {
    if (this.soldiers.has(id)) return EntityKind.Soldier;
    if (this.dummies.has(id)) return EntityKind.Dummy;
    return null;
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
  }

  /** Aplica daño a una entidad y lo registra como evento del tick. */
  private applyDamage(event: DamageEvent): void {
    const dummy = this.dummies.get(event.dst);
    if (!dummy) return;
    dummy.hp -= event.amount;
    this.events.push(event);
    if (dummy.hp <= 0) {
      this.dummies.delete(dummy.id);
      this.dummyRespawns.push({ spot: dummy.spot, atTick: this.tick + DUMMY_RESPAWN_TICKS });
    }
  }

  /** Avanza la simulación un tick. */
  step(): void {
    this.tick++;
    this.events = [];

    const due = this.dummyRespawns.filter((r) => r.atTick <= this.tick);
    if (due.length > 0) {
      this.dummyRespawns = this.dummyRespawns.filter((r) => r.atTick > this.tick);
      for (const r of due) this.spawnDummy(r.spot);
    }

    const { maxInputsPerTick } = GAME_CONFIG.net;
    for (const s of this.soldiers.values()) {
      // Se procesan varias entradas por tick para absorber el jitter de red,
      // con un tope para limitar trampas de velocidad.
      const batch = s.inputs.splice(0, maxInputsPerTick);
      for (const input of batch) {
        s.state = stepMovement(s.state, input, MAP);
        s.lastProcessedSeq = input.seq;
      }
      if (s.targetId !== null && !this.isValidTarget(s.targetId)) s.targetId = null;
    }

    // Combate, después de mover a todos.
    for (const s of this.soldiers.values()) {
      if (s.targetId === null) continue;
      const shot = autoFire(this.tick, s, this.dummies.get(s.targetId), MAP);
      if (shot) this.applyDamage(shot);
    }
  }

  /** Construye el snapshot para un jugador concreto y actualiza su caché de envíos. */
  buildSnapshot(viewerId: number | null, sent: SentCache): SnapshotMessage {
    const changed: NetEntity[] = [];
    const removed: number[] = [];

    const diff = (
      id: number,
      kind: EntityKind,
      name: string,
      x: number,
      z: number,
      yaw: number,
      hp?: number,
    ) => {
      const q: SentState = { x: quantizePos(x), z: quantizePos(z), yaw: quantizeYaw(yaw) };
      if (hp !== undefined) q.hp = hp;
      const prev = sent.get(id);
      if (!prev) {
        changed.push({ id, kind, ...q, name });
      } else if (prev.x !== q.x || prev.z !== q.z || prev.yaw !== q.yaw || prev.hp !== q.hp) {
        changed.push({ id, kind, ...q });
      } else {
        return;
      }
      sent.set(id, q);
    };

    for (const s of this.soldiers.values()) {
      if (s.id === viewerId) continue;
      diff(s.id, EntityKind.Soldier, s.name, s.state.x, s.state.z, s.state.yaw);
    }
    // Los muñecos miran al norte, hacia la colonia. Solo viajan al aparecer o al cambiar su vida.
    for (const d of this.dummies.values()) diff(d.id, EntityKind.Dummy, d.name, d.x, d.z, 0, d.hp);

    for (const id of sent.keys()) {
      if (this.kindOf(id) === null) {
        removed.push(id);
        sent.delete(id);
      }
    }

    const me = viewerId !== null ? this.soldiers.get(viewerId) : undefined;
    return {
      t: "snapshot",
      tick: this.tick,
      ack: me?.lastProcessedSeq ?? -1,
      you: me ? { ...me.state } : null,
      changed,
      removed,
    };
  }
}
