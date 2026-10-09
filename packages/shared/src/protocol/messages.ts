import { decode, encode } from "@msgpack/msgpack";
import type { MoveInput, MoveState } from "../sim/movement.js";

export const EntityKind = {
  Soldier: 1,
  /** Muñeco de prueba de H2. */
  Dummy: 2,
  /** Centollo raso (E4-2). */
  Crab: 3,
  /** Escupidor (E4-3). */
  Spitter: 4,
  /** Escupitajo de un escupidor: proyectil, no se selecciona. */
  Spit: 5,
  /** Colono (E6-2): camina hacia la plataforma; no se selecciona. */
  Colonist: 6,
} as const;
export type EntityKind = (typeof EntityKind)[keyof typeof EntityKind];

/** Entidades a las que un soldado puede seleccionar y disparar. */
export function isHostile(kind: EntityKind): boolean {
  return kind === EntityKind.Dummy || kind === EntityKind.Crab || kind === EntityKind.Spitter;
}

/**
 * Estado completo de una entidad que el cliente ve por primera vez.
 * Posiciones en centímetros y orientación en milirradianes (enteros, ocupan menos).
 */
export interface NetEntity {
  id: number;
  kind: EntityKind;
  x: number;
  z: number;
  yaw: number;
  name: string;
  /** Vida actual, en las entidades que pueden recibir daño. */
  hp?: number;
  /** Soldado controlado por el servidor (E5-6). Si cambia, llega un evento `control`. */
  bot?: true;
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
export type DamageSource = "auto" | "aimed" | "grenade" | "bite" | "spit";

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

/** Un soldado cae derribado a 0 de vida (E5-1): `ticks` hasta que muera si nadie lo rescata. */
export interface DownedEvent {
  k: "downed";
  src: number;
  ticks: number;
}

/** Un raso empieza a rematar a un soldado derribado (E5-3): muere en `ticks` si no se corta. */
export interface FinishEvent {
  k: "finish";
  /** El raso que remata. */
  src: number;
  /** El derribado. */
  dst: number;
  ticks: number;
}

/** Se corta el remate de un derribado (el raso murió o se apartó). */
export interface FinishStopEvent {
  k: "finishStop";
  dst: number;
}

/** Empieza un rescate (E5-2): `src` rescata a `dst` en `ticks` si nadie lo corta. */
export interface RescueEvent {
  k: "rescue";
  src: number;
  dst: number;
  ticks: number;
}

/** Por qué se corta un rescate. */
export type RescueStopReason = "moved" | "damaged" | "ability" | "range" | "died";

/** Se corta un rescate. */
export interface RescueStopEvent {
  k: "rescueStop";
  src: number;
  dst: number;
  reason: RescueStopReason;
}

/** Rescate completado: `dst` se levanta. */
export interface RescuedEvent {
  k: "rescued";
  src: number;
  dst: number;
}

/** Un soldado pasa a ser bot (se fue su jugador) o a manos de un jugador (relevo) (E5-6). */
export interface ControlEvent {
  k: "control";
  src: number;
  bot: boolean;
}

/** Por qué muere un soldado (E5-3). */
export type DeathCause = "time" | "finish" | "grenade";

/** Muere un soldado derribado: se acabó su tiempo, lo remataron o le alcanzó una granada. */
export interface DeathEvent {
  k: "death";
  src: number;
  cause: DeathCause;
}

/** Estado de una madriguera (E4-4). */
export const BurrowState = {
  Closed: 0,
  /** Va a abrirse en unos segundos (aviso). */
  Warning: 1,
  Open: 2,
  /** Taponada con una granada. */
  Plugged: 3,
} as const;
export type BurrowState = (typeof BurrowState)[keyof typeof BurrowState];

/** Fase del director de oleadas (spec §4.4). */
export type DirectorPhase = "calm" | "background" | "push" | "valley" | "final";

/** Nombre de cada fase para mostrarla (panel F3, avisos de administración). */
export const DIRECTOR_PHASE_NAMES: Record<DirectorPhase, string> = {
  calm: "calma",
  background: "fondo",
  push: "empujón",
  valley: "valle",
  final: "oleada final",
};

/** Una madriguera cambia de estado (índice en `map.burrows`). */
export interface BurrowEvent {
  k: "burrow";
  burrow: number;
  state: BurrowState;
}

/** Despega la lanzadera `n` (desde 1) con `boarded` colonos (E6-3). */
export interface LaunchEvent {
  k: "launch";
  n: number;
  boarded: number;
}

/** Empieza la oleada final. */
export interface FinalWaveEvent {
  k: "finalWave";
}

/** Un soldado activa un edificio de colonos (E6-2). `building`: índice en `map.routes`. */
export interface ActivateEvent {
  k: "activate";
  src: number;
  building: number;
  /** Colonos que tiene dentro. */
  colonists: number;
}

export type GameEvent =
  | DamageEvent
  | CastEvent
  | CastEndEvent
  | GrenadeEvent
  | ExplosionEvent
  | StimEvent
  | DownedEvent
  | FinishEvent
  | FinishStopEvent
  | DeathEvent
  | RescueEvent
  | RescueStopEvent
  | RescuedEvent
  | ControlEvent
  | BurrowEvent
  | LaunchEvent
  | FinalWaveEvent
  | ActivateEvent;

/** Quién causa un evento (los del director no tienen autor). */
export const eventSource = (event: GameEvent): number | null => ("src" in event ? event.src : null);

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
  /** Empezar a rescatar a este aliado derribado (E5-2): se manda una vez, al pulsar F. */
  revive?: number;
}

export interface InputMessage extends PlayerInput {
  t: "input";
}

/** Selección de objetivo (`null` para quitarlo). El servidor la valida. */
export interface TargetMessage {
  t: "target";
  id: number | null;
}

/** Comandos de administración (E7-3), solo si el servidor arrancó con `--admin`. */
export type AdminCommand = "invulnerable" | "killAll" | "nextPhase" | "nextPush" | "finalWave";

export interface AdminMessage {
  t: "admin";
  cmd: AdminCommand;
}

export interface PingMessage {
  t: "ping";
  time: number;
}

export type ClientMessage = JoinMessage | InputMessage | TargetMessage | AdminMessage | PingMessage;

// ---- Servidor → cliente ----

export interface WelcomeMessage {
  t: "welcome";
  playerId: number;
  recruitName: string;
  tick: number;
  spawn: { x: number; z: number; yaw: number };
  /** El servidor acepta comandos de administración (solo en desarrollo). */
  admin: boolean;
}

/** Estado propio exacto (metros y radianes, sin cuantizar). */
export interface OwnState extends MoveState {
  hp: number;
  /** Objetivo que tiene el servidor (elegido a mano o por la selección automática). */
  target: number | null;
  /** Invulnerable por un comando de administración (se omite si no). */
  invulnerable?: true;
  /** Derribado: ticks que le quedan hasta morir (se omite si no está derribado). */
  downedTicks?: number;
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
  /** Entidades que este cliente ve por primera vez, con su estado completo. */
  added: NetEntity[];
  /**
   * Entidades conocidas que se han movido o girado, en un array plano
   * `[id, dx, dz, dyaw, id, dx, …]`: diferencias en centímetros y milirradianes respecto
   * a lo último que se le envió a este cliente (ver `snapshotDelta.ts`).
   */
  moved: number[];
  /** Cambios de vida de entidades conocidas: `[id, hp, id, hp, …]`. */
  hp: number[];
  /** Ids de entidades eliminadas. */
  removed: number[];
}

/** Eventos de un tick (solo se envía si hay alguno). */
export interface EventsMessage {
  t: "events";
  tick: number;
  events: GameEvent[];
}

/** Rendimiento del servidor en el último segundo, para el panel de depuración (E7-1). */
export interface StatsMessage {
  t: "stats";
  /** Tiempo medio de tick, en ms. */
  tickMs: number;
  /** Tick más lento, en ms. */
  tickMaxMs: number;
}

/**
 * Estado del director de oleadas (E4-4): se envía cuando cambia y al entrar, para que quien llega
 * tarde sepa qué madrigueras están abiertas.
 */
export interface DirectorMessage {
  t: "director";
  phase: DirectorPhase;
  /** Estado de cada madriguera, en el orden de `map.burrows`. */
  burrows: BurrowState[];
}

/**
 * Fases de la partida (E6-1, spec §3.1): sin nadie, preparación, evacuación, oleada final y
 * resultado (ha caído todo el pelotón).
 */
export type MatchPhase = "waiting" | "prep" | "evacuation" | "final" | "result";

/** Fase de la partida: se envía al entrar y cuando cambia. */
export interface MatchMessage {
  t: "match";
  phase: MatchPhase;
  /**
   * Tick del servidor en que acaba la fase (preparación, evacuación) o en que empieza la
   * siguiente partida (resultado). `null` si no tiene fin (oleada final, sin nadie).
   */
  endsAtTick: number | null;
  /** Lanzaderas que han despegado (E6-3). */
  launches: number;
  /** Tick del servidor del próximo despegue, o `null` si ya no quedan (o no hay partida). */
  nextLaunchTick: number | null;
  /** Colonos a salvo: los que han embarcado en las lanzaderas de esta partida. */
  saved: number;
  /** Resultado: segundos que resistió el pelotón desde el principio de la preparación. */
  survivedSeconds?: number;
}

/**
 * Edificios de colonos (E6-2), en el orden de `map.routes`: `null` si no se ha activado (de lejos
 * no se sabe cuántos hay dentro, spec §4.5); si no, los colonos que quedan dentro. Se envía al
 * entrar y cuando cambia.
 */
export interface ColonyMessage {
  t: "colony";
  buildings: (number | null)[];
}

/**
 * Relevo (E5-4): el jugador pasa a controlar este soldado (un bot del pelotón, tras su
 * defunción; o uno nuevo si empieza otro pelotón). La predicción arranca desde `state`.
 */
export interface ReliefMessage {
  t: "relief";
  playerId: number;
  recruitName: string;
  state: { x: number; z: number; yaw: number };
  hp: number;
}

/** Sin bots en pie que relevar: el jugador pasa a ser espectador (E5-4, E5-5). */
export interface SpectateMessage {
  t: "spectate";
}

/** Respuesta a un comando de administración: un texto para el HUD. */
export interface AdminResultMessage {
  t: "adminResult";
  text: string;
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
  | WelcomeMessage
  | SnapshotMessage
  | EventsMessage
  | StatsMessage
  | DirectorMessage
  | MatchMessage
  | ColonyMessage
  | ReliefMessage
  | SpectateMessage
  | AdminResultMessage
  | PongMessage
  | RejectedMessage;

export const encodeMessage = (msg: ClientMessage | ServerMessage): Uint8Array => encode(msg);

export const decodeMessage = <T extends ClientMessage | ServerMessage>(
  data: ArrayBuffer | Uint8Array,
): T => decode(data) as T;
