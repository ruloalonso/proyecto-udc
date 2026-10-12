import type { MatchPhase } from "@udc/shared";

/** "2:05" a partir de segundos (redondeando hacia arriba, nunca negativo). */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** «ningún colono», «1 colono», «37 colonos». */
export function colonistsText(n: number): string {
  if (n === 0) return "ningún colono";
  return n === 1 ? "1 colono" : `${n} colonos`;
}

/** Aviso al despegar una lanzadera (E6-3). */
export function launchText(n: number, boarded: number): string {
  if (boarded === 0) return `La lanzadera ${n} despega vacía. El Estado anota el despilfarro.`;
  return `Despega la lanzadera ${n} con ${colonistsText(boarded)}. Los que no caben, a defender.`;
}

/** Lo que el letrero necesita saber de la partida. */
export interface PhaseInfo {
  phase: MatchPhase;
  /** Segundos hasta el final de la fase, o `null` si no tiene fin. */
  left: number | null;
  /** Próxima lanzadera (número y segundos hasta el despegue), si se sabe. */
  nextLaunch: { n: number; in: number } | null;
  /** Colonos a salvo (E6-3). */
  saved: number;
}

/**
 * Letrero de la fase (E6-1): cuenta atrás de la preparación, del próximo despegue y la oleada
 * final, con los colonos a salvo (E6-3, FR-13). Sin partida o con el resultado en pantalla, nada.
 */
export function phaseText({ phase, left, nextLaunch, saved }: PhaseInfo): string | null {
  switch (phase) {
    case "prep":
      return `Despliegue. Los centollos llegan en ${clock(left ?? 0)}`;
    case "evacuation":
      return nextLaunch
        ? `Evacuación · lanzadera ${nextLaunch.n} en ${clock(nextLaunch.in)} · ${saved} a salvo`
        : `Evacuación · ${saved} a salvo`;
    case "final":
      return `Oleada final · No quedan lanzaderas · ${saved} a salvo`;
    case "waiting":
    case "result":
      return null;
  }
}
