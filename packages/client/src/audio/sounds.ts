import { GAME_CONFIG, MAP, BurrowState, type GameEvent, type Point } from "@udc/shared";

/**
 * Sonido básico (E6-7, spec §2.2): seis efectos de Kenney (CC0, `public/sounds/LICENCIA.md`)
 * disparados por eventos que ya llegan del servidor. Lo que ocurre lejos se oye más bajo; sin
 * música ni sonido posicional complejo.
 */

export type SoundId =
  | "shot"
  | "allyShot"
  | "aimedShot"
  | "hurt"
  | "explosion"
  | "shuttleExplosion"
  | "burrow"
  | "liftoff"
  | "allyDown";

interface SoundDef {
  file: string;
  /** Volumen propio (0–1), antes del general. */
  volume: number;
  /** Separación mínima entre dos seguidos, en ms (el fuego automático con 150 centollos). */
  minGapMs: number;
  /** Lo más bajo que se oye por lejos que ocurra (avisos que interesan en todo el mapa). */
  minGain: number;
}

export const SOUNDS: Record<SoundId, SoundDef> = {
  shot: { file: "shot.ogg", volume: 0.25, minGapMs: 80, minGain: 0 },
  // Los de los aliados, más bajos y con un tope conjunto: 7 disparando no son un estruendo.
  allyShot: { file: "shot.ogg", volume: 0.12, minGapMs: 120, minGain: 0 },
  aimedShot: { file: "aimed-shot.ogg", volume: 0.6, minGapMs: 0, minGain: 0 },
  hurt: { file: "hurt.ogg", volume: 0.6, minGapMs: 250, minGain: 0 },
  explosion: { file: "explosion.ogg", volume: 0.8, minGapMs: 60, minGain: 0 },
  shuttleExplosion: { file: "shuttle-explosion.ogg", volume: 1, minGapMs: 0, minGain: 0.5 },
  burrow: { file: "burrow.ogg", volume: 0.7, minGapMs: 1000, minGain: 0.35 },
  liftoff: { file: "liftoff.ogg", volume: 0.7, minGapMs: 0, minGain: 0.4 },
  allyDown: { file: "ally-down.ogg", volume: 0.5, minGapMs: 300, minGain: 0 },
};

/** Un sonido que toca, y dónde ocurre si es de un sitio (para atenuarlo con la distancia). */
export interface SoundCue {
  id: SoundId;
  at?: Point;
}

/**
 * Los sonidos de un evento. `me`: el soldado propio; `whereIs`: dónde se dibuja ahora una
 * entidad (para los disparos de los aliados, que suenan desde el que dispara).
 */
export function soundsFor(
  event: GameEvent,
  me: number,
  whereIs: (id: number) => Point | undefined = () => undefined,
): SoundCue[] {
  switch (event.k) {
    case "damage": {
      const cues: SoundCue[] = [];
      if (event.by === "auto" || event.by === "aimed") {
        const aimed = event.by === "aimed";
        if (event.src === me) cues.push({ id: aimed ? "aimedShot" : "shot" });
        else {
          // Los de los aliados, desde donde disparan (si no se les ve, no suenan).
          const at = whereIs(event.src);
          if (at) cues.push({ id: aimed ? "aimedShot" : "allyShot", at });
        }
      }
      if (event.dst === me && event.amount > 0) cues.push({ id: "hurt" });
      return cues;
    }
    case "explosion": {
      const big = (event.radius ?? 0) > GAME_CONFIG.abilities.grenade.radius;
      return [{ id: big ? "shuttleExplosion" : "explosion", at: { x: event.x, z: event.z } }];
    }
    case "burrow": {
      const burrow = MAP.burrows[event.burrow];
      if (event.state !== BurrowState.Warning || !burrow) return [];
      return [{ id: "burrow", at: { x: burrow.x, z: burrow.z } }];
    }
    case "launch": {
      const { x, z } = MAP.landingPad;
      return [{ id: "liftoff", at: { x, z } }];
    }
    case "downed":
      return event.src === me ? [] : [{ id: "allyDown" }];
    default:
      return [];
  }
}

/** Ganancia por la distancia: entera hasta `near`, nada a `far` (o `minGain`, si es un aviso). */
export function distanceGain(distance: number, minGain = 0): number {
  const { near, far } = GAME_CONFIG.audio;
  const t = (distance - near) / (far - near);
  return Math.max(minGain, Math.min(1, 1 - t));
}

/** Tope por sonido: no suena otra vez hasta pasados sus `minGapMs`. */
export class SoundGate {
  private readonly last = new Map<SoundId, number>();

  allow(id: SoundId, now: number): boolean {
    const previous = this.last.get(id);
    if (previous !== undefined && now - previous < SOUNDS[id].minGapMs) return false;
    this.last.set(id, now);
    return true;
  }
}
