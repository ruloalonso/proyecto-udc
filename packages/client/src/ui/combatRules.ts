import {
  AbilityId,
  EntityKind,
  GAME_CONFIG,
  shotBlocker,
  type MapData,
  type Point,
  type Pose,
  type ShotBlocker,
} from "@udc/shared";

/** Motivos por los que no se puede usar una habilidad o disparar al objetivo. */
export type Blocker = "casting" | "cooldown" | "moving" | "noTarget" | ShotBlocker;

/** Avisos en pantalla, en el tono de la casa. */
export const BLOCKER_TEXT: Record<Blocker, string> = {
  casting: "Ya estás apuntando",
  cooldown: "Aún no está lista, recluta",
  moving: "Quieto para apuntar, recluta",
  noTarget: "Sin objetivo: elige un centollo",
  outOfRange: "Fuera de alcance",
  notFacing: "De cara al enemigo, recluta",
  noLineOfSight: "Sin línea de visión",
};

export interface AbilityContext {
  /** Enfriamientos (propio y global) listos. */
  ready: boolean;
  casting: boolean;
  /** El jugador está pulsando moverse. */
  moving: boolean;
  /** Posición y orientación del soldado (no de la cámara). */
  self: Pose;
  /** Posición del objetivo seleccionado, o `null` sin objetivo. */
  target: Point | null;
  map: MapData;
}

/**
 * ¿Por qué no se puede usar la habilidad ahora? `null` si se puede.
 * Es una previsión del cliente para avisar y atenuar la barra: decide el servidor.
 */
export function abilityBlocker(id: AbilityId, ctx: AbilityContext): Blocker | null {
  if (ctx.casting) return "casting";
  if (!ctx.ready) return "cooldown";
  if (id === AbilityId.AimedShot) {
    if (!ctx.target) return "noTarget";
    if (ctx.moving) return "moving";
    return shotBlocker(ctx.self, ctx.target, GAME_CONFIG.abilities.aimedShot.range, ctx.map);
  }
  return null;
}

export interface SlotCooldown {
  /** Parte del barrido que queda por recorrer (0 = lista, 1 = recién usada). */
  fraction: number;
  /** Segundos que faltan (vacío si no hay enfriamiento propio en curso). */
  label: string;
}

/**
 * Enfriamiento que muestra una casilla: el propio o el global, el que acabe más tarde.
 * Los segundos solo se muestran para el propio (el global es demasiado corto).
 */
export function slotCooldown(
  own: { remaining: number; total: number },
  global: { remaining: number; total: number },
): SlotCooldown {
  if (own.remaining <= 0 && global.remaining <= 0) return { fraction: 0, label: "" };
  if (own.remaining >= global.remaining) {
    return {
      fraction: Math.min(1, own.remaining / own.total),
      label: String(Math.ceil(own.remaining / 1000)),
    };
  }
  return { fraction: Math.min(1, global.remaining / global.total), label: "" };
}

/** Vida máxima de una entidad, para las barras de vida. */
export function maxHealthOf(kind: EntityKind): number {
  switch (kind) {
    case EntityKind.Dummy:
      return GAME_CONFIG.dummy.health;
    case EntityKind.Crab:
      return GAME_CONFIG.crab.health;
    default:
      return GAME_CONFIG.soldier.health;
  }
}
