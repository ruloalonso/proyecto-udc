import type { DeathCause, MatchReport, SoldierReport } from "@udc/shared";
import type { FallenSummary } from "./summary.js";

/**
 * Parte de la partida para el noticiario (E6-4). Lógica pura: el mundo le cuenta lo que pasa y
 * aquí se apunta. Por soldado, sus enemigos abatidos y sus rescates; los soldados salen en el
 * orden en que cayeron, sin clasificar a nadie (la puntuación es del pelotón, spec §3.1).
 */
export class Tally {
  private readonly soldiers = new Map<number, SoldierReport>();
  private readonly fallen: SoldierReport[] = [];
  private crabs = 0;
  /** Para el resumen de los registros (E7-8), no para el noticiario. */
  private downs = 0;
  private readonly deaths = new Map<number, { seconds: number; cause: DeathCause }>();

  /** Un soldado nuevo en el pelotón. */
  enlist(id: number, name: string): void {
    this.soldiers.set(id, { id, name, kills: 0, rescues: 0 });
  }

  /** Muere un centollo; `by`, quien dio el golpe final (puede no ser un soldado: la nave). */
  crabKilled(by: number): void {
    this.crabs++;
    const s = this.soldiers.get(by);
    if (s) s.kills++;
  }

  /** `by` ha rescatado a un compañero. */
  rescued(by: number): void {
    const s = this.soldiers.get(by);
    if (s) s.rescues++;
  }

  /** Cae derribado un soldado (para el resumen de los registros). */
  downed(): void {
    this.downs++;
  }

  /**
   * Muere un soldado; `nick`, el apodo del jugador que lo controlaba (`null` si era un bot);
   * `seconds` y `cause`, cuándo y de qué (para el resumen de los registros).
   */
  fell(id: number, nick: string | null, seconds = 0, cause: DeathCause = "time"): void {
    const s = this.soldiers.get(id);
    if (!s) return;
    if (nick) s.nick = nick;
    this.fallen.push(s);
    this.deaths.set(id, { seconds, cause });
  }

  /** Partida nueva. */
  reset(): void {
    this.soldiers.clear();
    this.fallen.length = 0;
    this.crabs = 0;
    this.downs = 0;
    this.deaths.clear();
  }

  report(): MatchReport {
    return { crabsKilled: this.crabs, soldiers: this.fallen.map((s) => ({ ...s })) };
  }

  /** Lo del recuento que va al resumen de los registros (E7-8). */
  summary(): { crabsKilled: number; downs: number; fallen: FallenSummary[] } {
    return {
      crabsKilled: this.crabs,
      downs: this.downs,
      fallen: this.fallen.map(({ name, nick, kills, rescues, id }) => ({
        name,
        ...(nick ? { nick } : {}),
        kills,
        rescues,
        ...(this.deaths.get(id) ?? { seconds: 0, cause: "time" as const }),
      })),
    };
  }
}
