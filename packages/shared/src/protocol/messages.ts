import { decode, encode } from "@msgpack/msgpack";

export const EntityKind = {
  Soldier: 1,
  /** Muñeco de prueba de H2. */
  Dummy: 2,
} as const;
export type EntityKind = (typeof EntityKind)[keyof typeof EntityKind];

/** Entidades a las que un soldado puede seleccionar y disparar. */
export function isHostile(kind: EntityKind): boolean {
  return kind === EntityKind.Dummy;
}

/**
 * Estado de red de una entidad.
 * Posiciones en centímetros y orientación en milirradianes (enteros, ocupan menos).
 * `name` solo se envía la primera vez que el cliente ve la entidad.
 */
export interface NetEntity {
  id: number;
  kind: EntityKind;
  x: number;
  z: number;
  yaw: number;
  name?: string;
}

// ---- Cliente → servidor ----

export interface JoinMessage {
  t: "join";
  nick: string;
}

export interface InputMessage {
  t: "input";
  seq: number;
  forward: number;
  strafe: number;
  yaw: number;
}

/** Selección de objetivo (`null` para quitarlo). El servidor la valida. */
export interface TargetMessage {
  t: "target";
  id: number | null;
}

export interface PingMessage {
  t: "ping";
  time: number;
}

export type ClientMessage = JoinMessage | InputMessage | TargetMessage | PingMessage;

// ---- Servidor → cliente ----

export interface WelcomeMessage {
  t: "welcome";
  playerId: number;
  recruitName: string;
  tick: number;
  spawn: { x: number; z: number; yaw: number };
}

export interface SnapshotMessage {
  t: "snapshot";
  tick: number;
  /** Última entrada del jugador procesada por el servidor. */
  ack: number;
  /** Estado autoritativo exacto del propio jugador (metros y radianes, sin cuantizar). */
  you: { x: number; z: number; yaw: number } | null;
  /** Entidades nuevas o que han cambiado desde el último snapshot enviado a este cliente. */
  changed: NetEntity[];
  /** Ids de entidades eliminadas. */
  removed: number[];
}

export interface PongMessage {
  t: "pong";
  time: number;
}

export interface RejectedMessage {
  t: "rejected";
  reason: string;
}

export type ServerMessage = WelcomeMessage | SnapshotMessage | PongMessage | RejectedMessage;

export const encodeMessage = (msg: ClientMessage | ServerMessage): Uint8Array => encode(msg);

export const decodeMessage = <T extends ClientMessage | ServerMessage>(
  data: ArrayBuffer | Uint8Array,
): T => decode(data) as T;
