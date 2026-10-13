import { MOVEMENTS, type Movement } from "./paths.js";

/**
 * Lo que se está viendo en la vitrina (E7-9), guardado en la dirección de la página: así una
 * vista se puede guardar, pasar y repetir (`vitrina.html?modelo=raso&vista=lado&mov=circulo`).
 */

export const VIEWS = ["tres-cuartos", "frente", "lado", "espalda", "arriba"] as const;
export type View = (typeof VIEWS)[number];

export const VIEW_NAMES: Record<View, string> = {
  "tres-cuartos": "Tres cuartos",
  frente: "Frente",
  lado: "Lado",
  espalda: "Espalda",
  arriba: "Arriba",
};

/** Qué hace el modelo, además de moverse (los que no saben, lo ignoran). */
export const ACTIONS = [
  "ninguna",
  "disparar",
  "apuntado",
  "derribado",
  "rescatando",
  "sentado",
] as const;
export type Action = (typeof ACTIONS)[number];

export const ACTION_NAMES: Record<Action, string> = {
  ninguna: "Nada",
  disparar: "Disparar (automático)",
  apuntado: "Disparo apuntado",
  derribado: "Derribado (con movimiento, se arrastra)",
  rescatando: "Rescatando",
  sentado: "Sentado",
};

export interface VitrinaState {
  /** Id del modelo en el catálogo. */
  model: string;
  view: View;
  movement: Movement;
  action: Action;
  /** Multiplicador del tiempo: 1 es la velocidad del juego. */
  speed: number;
  /** Cuántos a la vez (modo multitud). */
  count: number;
  wireframe: boolean;
  /** Figura humana de referencia y círculo de colisión. */
  reference: boolean;
  /** La cámara sigue al modelo. */
  follow: boolean;
}

export const SPEED_MIN = 0.1;
export const SPEED_MAX = 2;
export const COUNT_MAX = 300;

export const DEFAULT_STATE: VitrinaState = {
  model: "",
  view: "tres-cuartos",
  movement: "quieto",
  action: "ninguna",
  speed: 1,
  count: 1,
  wireframe: false,
  reference: true,
  follow: true,
};

const oneOf = <T extends string>(value: string | null, options: readonly T[], fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function numberOr(value: string | null, fallback: number): number {
  const n = value === null ? Number.NaN : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** De la dirección al estado; lo que falte o no valga, por defecto. `models`: ids válidos. */
export function parseState(search: string, models: readonly string[]): VitrinaState {
  const p = new URLSearchParams(search);
  const d = DEFAULT_STATE;
  return {
    model: oneOf(p.get("modelo"), models, models[0] ?? ""),
    view: oneOf(p.get("vista"), VIEWS, d.view),
    movement: oneOf(p.get("mov"), MOVEMENTS, d.movement),
    action: oneOf(p.get("accion"), ACTIONS, d.action),
    speed: clamp(numberOr(p.get("vel"), d.speed), SPEED_MIN, SPEED_MAX),
    count: Math.round(clamp(numberOr(p.get("n"), d.count), 1, COUNT_MAX)),
    wireframe: p.get("alambre") === "1",
    reference: p.get("referencia") !== "0",
    follow: p.get("seguir") !== "0",
  };
}

/** Del estado a la dirección: solo lo que no está por defecto, para que sea corta. */
export function stateToSearch(s: VitrinaState): string {
  const d = DEFAULT_STATE;
  const p = new URLSearchParams();
  p.set("modelo", s.model);
  if (s.view !== d.view) p.set("vista", s.view);
  if (s.movement !== d.movement) p.set("mov", s.movement);
  if (s.action !== d.action) p.set("accion", s.action);
  if (s.speed !== d.speed) p.set("vel", String(s.speed));
  if (s.count !== d.count) p.set("n", String(s.count));
  if (s.wireframe) p.set("alambre", "1");
  if (!s.reference) p.set("referencia", "0");
  if (!s.follow) p.set("seguir", "0");
  return `?${p.toString()}`;
}
