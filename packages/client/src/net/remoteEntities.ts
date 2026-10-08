import {
  EntityKind,
  dequantizePos,
  dequantizeYaw,
  forEachHp,
  forEachMove,
  GAME_CONFIG,
  lerpAngle,
  TICK_MS,
  type SentEntity,
  type SnapshotMessage,
} from "@udc/shared";

interface Sample {
  tick: number;
  x: number;
  z: number;
  yaw: number;
}

export interface RemoteEntity {
  id: number;
  kind: EntityKind;
  name: string;
  /** Vida actual (solo en entidades que pueden recibir daño). */
  hp?: number;
  /** Soldado controlado por el servidor (E5-6). Cambia con el evento `control`. */
  bot?: boolean;
  /** Último estado recibido, cuantizado (los movimientos llegan como diferencias sobre él). */
  q: SentEntity;
  history: Sample[];
  /** Tick en el que el servidor la eliminó; se quita al dibujar ese tick. */
  removedAt?: number;
}

/** Nombre para mostrar: los bots llevan "(bot)" detrás (E5-6). */
export const displayName = (entity: Pick<RemoteEntity, "name" | "bot">): string =>
  entity.bot ? `${entity.name} (bot)` : entity.name;

export interface RenderPose {
  x: number;
  z: number;
  yaw: number;
}

/**
 * Mantiene el estado de las entidades remotas y las dibuja en el pasado
 * (unos ~100 ms) interpolando entre snapshots, para que se muevan con suavidad.
 */
export class RemoteEntities {
  readonly entities = new Map<number, RemoteEntity>();
  /** Diferencia estimada entre el tick del servidor y el reloj local (en ticks). */
  private clockOffset: number | null = null;
  latestTick = 0;

  /** Llamar con cada snapshot. Devuelve las entidades nuevas. */
  applySnapshot(snap: SnapshotMessage): RemoteEntity[] {
    this.updateClock(snap.tick);
    this.latestTick = snap.tick;

    const added: RemoteEntity[] = [];
    const changedIds = new Set<number>();
    const sampleOf = (q: SentEntity): Sample => ({
      tick: snap.tick,
      x: dequantizePos(q.x),
      z: dequantizePos(q.z),
      yaw: dequantizeYaw(q.yaw),
    });

    for (const e of snap.added) {
      changedIds.add(e.id);
      const q: SentEntity = { x: e.x, z: e.z, yaw: e.yaw };
      const entity: RemoteEntity = { id: e.id, kind: e.kind, name: e.name, q, history: [] };
      if (e.hp !== undefined) entity.hp = e.hp;
      if (e.bot) entity.bot = true;
      entity.history.push(sampleOf(q));
      this.entities.set(e.id, entity);
      added.push(entity);
    }

    forEachMove(snap.moved, (id, dx, dz, dyaw) => {
      const entity = this.entities.get(id);
      if (!entity) return;
      changedIds.add(id);
      entity.q.x += dx;
      entity.q.z += dz;
      entity.q.yaw += dyaw;
      entity.history.push(sampleOf(entity.q));
    });

    forEachHp(snap.hp, (id, hp) => {
      const entity = this.entities.get(id);
      if (entity) entity.hp = hp;
    });

    // Las entidades que no cambian no vienen en el snapshot: se repite su última muestra
    // para que la interpolación no "estire" el movimiento a través del hueco.
    for (const entity of this.entities.values()) {
      if (changedIds.has(entity.id) || entity.removedAt !== undefined) continue;
      const last = entity.history[entity.history.length - 1];
      if (last) entity.history.push({ ...last, tick: snap.tick });
    }

    // No se quitan aún: se siguen dibujando hasta que la interpolación llegue a ese tick.
    // Los escupitajos se dibujan adelantados (ver `spits.ts`): se quitan ya.
    for (const id of snap.removed) {
      const entity = this.entities.get(id);
      if (entity) entity.removedAt = entity.kind === EntityKind.Spit ? -Infinity : snap.tick;
    }

    this.trimHistory();
    return added;
  }

  /** Quita las entidades eliminadas cuyo momento ya se está dibujando. Devuelve sus ids. */
  takeRemoved(renderTick: number): number[] {
    const ids: number[] = [];
    for (const entity of this.entities.values()) {
      if (entity.removedAt !== undefined && entity.removedAt <= renderTick) ids.push(entity.id);
    }
    for (const id of ids) this.entities.delete(id);
    return ids;
  }

  /** Tick del servidor que toca dibujar ahora (en el pasado, con decimales). */
  renderTick(now: number): number {
    if (this.clockOffset === null) return this.latestTick;
    return now / TICK_MS + this.clockOffset - GAME_CONFIG.net.interpolationDelayTicks;
  }

  poseAt(entity: RemoteEntity, tick: number): RenderPose | null {
    const h = entity.history;
    const first = h[0];
    const last = h[h.length - 1];
    if (!first || !last) return null;
    if (tick <= first.tick) return first;
    if (tick >= last.tick) return last;

    for (let i = h.length - 2; i >= 0; i--) {
      const a = h[i]!;
      if (a.tick <= tick) {
        const b = h[i + 1]!;
        const t = (tick - a.tick) / (b.tick - a.tick || 1);
        return {
          x: a.x + (b.x - a.x) * t,
          z: a.z + (b.z - a.z) * t,
          yaw: lerpAngle(a.yaw, b.yaw, t),
        };
      }
    }
    return last;
  }

  private updateClock(serverTick: number): void {
    const sample = serverTick - performance.now() / TICK_MS;
    if (this.clockOffset === null) {
      this.clockOffset = sample;
    } else if (Math.abs(sample - this.clockOffset) > 10) {
      // Salto grande (pestaña en segundo plano, reconexión): resincronizar.
      this.clockOffset = sample;
    } else {
      this.clockOffset += (sample - this.clockOffset) * 0.05;
    }
  }

  private trimHistory(): void {
    const keepFrom = this.latestTick - 40;
    for (const entity of this.entities.values()) {
      const h = entity.history;
      let drop = 0;
      // Conservar siempre al menos una muestra anterior al rango.
      while (drop < h.length - 2 && h[drop + 1]!.tick < keepFrom) drop++;
      if (drop > 0) h.splice(0, drop);
    }
  }
}
