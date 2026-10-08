import type { EntityKind, NetEntity, SnapshotMessage } from "./messages.js";
import { quantizePos, quantizeYaw } from "./quantize.js";

/*
 * Snapshots compactos (E4-2, NFR-03).
 *
 * Una entidad nueva para un cliente viaja completa (`added`). Después, solo lo que cambia:
 * movimientos como diferencias enteras respecto a lo último que se le envió a ese cliente,
 * en un array plano (`moved`), y cambios de vida (`hp`). MessagePack guarda los enteros
 * pequeños en un byte, así que un centollo que corre ocupa unos 6 bytes por tick.
 *
 * Las diferencias son de valores ya cuantizados: el cliente las suma y llega exactamente
 * al mismo entero que el servidor, sin errores acumulados. Funciona porque WebSocket va
 * sobre TCP: todo lo enviado llega y en orden.
 */

/** Lo último que se le envió a un cliente sobre una entidad (cuantizado). */
export interface SentEntity {
  x: number;
  z: number;
  yaw: number;
  hp?: number;
}

/** Lo último enviado a un cliente sobre cada entidad, por id. */
export type SentCache = Map<number, SentEntity>;

/** Partes del snapshot que describen las entidades. */
export type EntityDelta = Pick<SnapshotMessage, "added" | "moved" | "hp" | "removed">;

export const emptyDelta = (): EntityDelta => ({ added: [], moved: [], hp: [], removed: [] });

/** Valores por entrada de `moved`: id, dx, dz, dyaw. */
export const MOVE_STRIDE = 4;

/**
 * Añade una entidad al delta de un cliente si es nueva o ha cambiado, y actualiza su caché.
 * Posición en metros y orientación en radianes (sin cuantizar).
 */
export function writeEntity(
  delta: EntityDelta,
  sent: SentCache,
  entity: {
    id: number;
    kind: EntityKind;
    name: string;
    x: number;
    z: number;
    yaw: number;
    hp?: number;
    /** Soldado bot: solo viaja al aparecer (los cambios, con el evento `control`). */
    bot?: boolean;
  },
): void {
  const q: SentEntity = {
    x: quantizePos(entity.x),
    z: quantizePos(entity.z),
    yaw: quantizeYaw(entity.yaw),
  };
  if (entity.hp !== undefined) q.hp = entity.hp;

  const prev = sent.get(entity.id);
  if (!prev) {
    const added: NetEntity = { id: entity.id, kind: entity.kind, name: entity.name, ...q };
    if (entity.bot) added.bot = true;
    delta.added.push(added);
  } else {
    if (q.x !== prev.x || q.z !== prev.z || q.yaw !== prev.yaw) {
      delta.moved.push(entity.id, q.x - prev.x, q.z - prev.z, q.yaw - prev.yaw);
    }
    if (q.hp !== undefined && q.hp !== prev.hp) delta.hp.push(entity.id, q.hp);
  }
  sent.set(entity.id, q);
}

/** Quita de la caché y marca como eliminadas las entidades que ya no existen. */
export function writeRemovals(
  delta: EntityDelta,
  sent: SentCache,
  exists: (id: number) => boolean,
): void {
  for (const id of sent.keys()) {
    if (exists(id)) continue;
    delta.removed.push(id);
    sent.delete(id);
  }
}

/** Recorre los movimientos de un snapshot. */
export function forEachMove(
  moved: readonly number[],
  fn: (id: number, dx: number, dz: number, dyaw: number) => void,
): void {
  for (let i = 0; i + MOVE_STRIDE <= moved.length; i += MOVE_STRIDE) {
    fn(moved[i]!, moved[i + 1]!, moved[i + 2]!, moved[i + 3]!);
  }
}

/** Recorre los cambios de vida de un snapshot. */
export function forEachHp(hp: readonly number[], fn: (id: number, hp: number) => void): void {
  for (let i = 0; i + 2 <= hp.length; i += 2) fn(hp[i]!, hp[i + 1]!);
}
