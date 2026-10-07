import {
  EntityKind,
  GAME_CONFIG,
  MAP,
  quantizePos,
  quantizeYaw,
  stepMovement,
  type MoveInput,
  type MoveState,
  type NetEntity,
  type SnapshotMessage,
} from "@uos/shared";

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
}

/** Lo último que se le envió a un cliente sobre cada entidad, para mandar solo cambios. */
export type SentCache = Map<number, { x: number; z: number; yaw: number }>;

export class World {
  tick = 0;
  readonly soldiers = new Map<number, Soldier>();
  private nextEntityId = 1;
  private nextRecruitNumber: number = GAME_CONFIG.recruit.firstNumber;

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

  /** Avanza la simulación un tick. */
  step(): void {
    this.tick++;
    const { maxInputsPerTick } = GAME_CONFIG.net;
    for (const s of this.soldiers.values()) {
      // Se procesan varias entradas por tick para absorber el jitter de red,
      // con un tope para limitar trampas de velocidad.
      const batch = s.inputs.splice(0, maxInputsPerTick);
      for (const input of batch) {
        s.state = stepMovement(s.state, input, MAP);
        s.lastProcessedSeq = input.seq;
      }
    }
  }

  /** Construye el snapshot para un jugador concreto y actualiza su caché de envíos. */
  buildSnapshot(viewerId: number | null, sent: SentCache): SnapshotMessage {
    const changed: NetEntity[] = [];
    const removed: number[] = [];

    for (const s of this.soldiers.values()) {
      if (s.id === viewerId) continue;
      const q = {
        x: quantizePos(s.state.x),
        z: quantizePos(s.state.z),
        yaw: quantizeYaw(s.state.yaw),
      };
      const prev = sent.get(s.id);
      if (!prev) {
        changed.push({ id: s.id, kind: EntityKind.Soldier, ...q, name: s.name });
      } else if (prev.x !== q.x || prev.z !== q.z || prev.yaw !== q.yaw) {
        changed.push({ id: s.id, kind: EntityKind.Soldier, ...q });
      } else {
        continue;
      }
      sent.set(s.id, q);
    }

    for (const id of sent.keys()) {
      if (!this.soldiers.has(id)) {
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
