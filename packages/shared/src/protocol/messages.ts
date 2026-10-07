import { decode, encode } from "@msgpack/msgpack";

export const EntityKind = {
  Soldier: 1,
} as const;
export type EntityKind = (typeof EntityKind)[keyof typeof EntityKind];

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

export interface PingMessage {
  t: "ping";
  time: number;
}

export type ClientMessage = JoinMessage | InputMessage | PingMessage;

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
