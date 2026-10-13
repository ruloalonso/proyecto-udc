import type { DeathCause } from "@udc/shared";

/**
 * Resumen de una partida para los registros del servidor (E7-8): cuánto aguantó el pelotón, qué
 * salvó y cuándo y de qué cayó cada uno. Para contestar con datos, tras una prueba con
 * jugadores, si el pelotón aguanta lo bastante sin reaparición y si la carga del director vale
 * (spec §11). No viaja a los clientes: el noticiario lleva su propio parte.
 */
export interface MatchSummary {
  /** Segundos que resistió, desde el principio de la preparación. */
  survivedSeconds: number;
  launches: number;
  /** Lanzaderas de la partida. */
  shuttles: number;
  saved: number;
  /** Colonos de la partida. */
  colonists: number;
  crabsKilled: number;
  /** Veces que cayó derribado alguien (un mismo soldado puede caer varias). */
  downs: number;
  /** En el orden en que cayeron. */
  fallen: FallenSummary[];
}

export interface FallenSummary {
  name: string;
  /** Apodo del jugador que lo controlaba al caer; sin él, era un bot. */
  nick?: string;
  kills: number;
  rescues: number;
  /** Segundo de la partida en que murió. */
  seconds: number;
  cause: DeathCause;
}

const CAUSE_TEXT: Record<DeathCause, string> = {
  time: "se le acabó el tiempo",
  grenade: "granada",
  blast: "explosión de la nave",
  alone: "nadie en pie para rescatarle",
};

/** `m:ss`. */
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Las líneas del resumen, para la consola. */
export function summaryLines(s: MatchSummary): string[] {
  const rescues = s.fallen.reduce((sum, f) => sum + f.rescues, 0);
  const causes = new Map<DeathCause, number>();
  for (const f of s.fallen) causes.set(f.cause, (causes.get(f.cause) ?? 0) + 1);
  const humans = s.fallen.filter((f) => f.nick).length;
  return [
    `Parte de la partida: resistió ${clock(s.survivedSeconds)} · ` +
      `${s.launches} de ${s.shuttles} lanzaderas · ${s.saved} de ${s.colonists} colonos a salvo · ` +
      `${s.crabsKilled} centollos abatidos`,
    `  ${plural(s.downs, "derribo", "derribos")} · ${plural(rescues, "rescate", "rescates")} · ` +
      `${plural(s.fallen.length, "muerte", "muertes")} (` +
      [...causes].map(([cause, n]) => `${CAUSE_TEXT[cause]}: ${n}`).join(", ") +
      `) · ${plural(humans, "caído con jugador", "caídos con jugador")}`,
    ...s.fallen.map(
      (f) =>
        `  ${clock(f.seconds).padStart(5)}  ${f.nick ?? `${f.name} (bot)`} · ` +
        `${plural(f.kills, "abatido", "abatidos")} · ${plural(f.rescues, "rescate", "rescates")} · ` +
        CAUSE_TEXT[f.cause],
    ),
    // En una línea, para juntar varias partidas con grep.
    `  JSON ${JSON.stringify(s)}`,
  ];
}
