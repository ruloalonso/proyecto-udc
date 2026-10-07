import { decode, encode } from "@msgpack/msgpack";
import type { MoveInput, MoveState } from "../sim/movement.js";

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
  /** Vida actual, en las entidades que pueden recibir daño. */
  hp?: number;
}

/** Habilidades 1–3 de la barra (spec §4.2). */
export const AbilityId = {
  AimedShot: 1,
  Grenade: 2,
  Stim: 3,
} as const;
export type AbilityId = (typeof AbilityId)[keyof typeof AbilityId];

/** Uso de una habilidad: con objetivo (disparo apuntado) o punto del suelo (granada). */
export interface AbilityUse {
  id: AbilityId;
  target?: number;
  x?: number;
  z?: number;
}

/** Con qué se ha hecho un daño (para dibujarlo). */
export type DamageSource = "auto" | "aimed" | "grenade";

/** Daño aplicado por el servidor. */
export interface DamageEvent {
  k: "damage";
  /** Quién causa el daño. */
  src: number;
  /** Quién lo recibe. */
  dst: number;
  amount: number;
  by: DamageSource;
}

/** Empieza un lanzamiento (disparo apuntado). */
export interface CastEvent {
  k: "cast";
  src: number;
  ability: AbilityId;
  target: number;
  /** Duración en ticks. */
  ticks: number;
}

/** Termina un lanzamiento: completado (`ok`) o interrumpido. */
export interface CastEndEvent {
  k: "castEnd";
  src: number;
  ok: boolean;
}

/** Granada lanzada desde (fromX, fromZ); explota en (x, z) dentro de `ticks`. */
export interface GrenadeEvent {
  k: "grenade";
  src: number;
  fromX: number;
  fromZ: number;
  x: number;
  z: number;
  ticks: number;
}

export interface ExplosionEvent {
  k: "explosion";
  src: number;
  x: number;
  z: number;
}

/** Estimulante: velocidad extra durante `ticks`. */
export interface StimEvent {
  k: "stim";
  src: number;
  ticks: number;
}

export type GameEvent =
  DamageEvent | CastEvent | CastEndEvent | GrenadeEvent | ExplosionEvent | StimEvent;

// ---- Cliente → servidor ----

export interface JoinMessage {
  t: "join";
  nick: string;
}

/**
 * Entrada de un tick. El uso de habilidad viaja aquí, en orden con el movimiento,
 * para que el servidor lo aplique en la misma entrada en que lo predice el cliente
 * (el estimulante cambia la velocidad).
 */
export interface PlayerInput extends MoveInput {
  ability?: AbilityUse;
}

export interface InputMessage extends PlayerInput {
  t: "input";
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

/** Estado propio exacto (metros y radianes, sin cuantizar). */
export interface OwnState extends MoveState {
  hp: number;
  /** Ticks que faltan para poder usar cada habilidad: [global, 1, 2, 3]. */
  cd: [number, number, number, number];
}

export interface SnapshotMessage {
  t: "snapshot";
  tick: number;
  /** Última entrada del jugador procesada por el servidor. */
  ack: number;
  /** Estado autoritativo exacto del propio jugador. */
  you: OwnState | null;
  /** Entidades nuevas o que han cambiado desde el último snapshot enviado a este cliente. */
  changed: NetEntity[];
  /** Ids de entidades eliminadas. */
  removed: number[];
}

/** Eventos de un tick (solo se envía si hay alguno). */
export interface EventsMessage {
  t: "events";
  tick: number;
  events: GameEvent[];
}

export interface PongMessage {
  t: "pong";
  time: number;
}

export interface RejectedMessage {
  t: "rejected";
  reason: string;
}

export type ServerMessage =
  WelcomeMessage | SnapshotMessage | EventsMessage | PongMessage | RejectedMessage;

export const encodeMessage = (msg: ClientMessage | ServerMessage): Uint8Array => encode(msg);

export const decodeMessage = <T extends ClientMessage | ServerMessage>(
  data: ArrayBuffer | Uint8Array,
): T => decode(data) as T;
