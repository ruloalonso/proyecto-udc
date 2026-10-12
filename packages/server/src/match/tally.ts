import type { MatchReport, SoldierReport } from "@udc/shared";

/**
 * Parte de la partida para el noticiario (E6-4). Lógica pura: el mundo le cuenta lo que pasa y
 * aquí se apunta. Por soldado, sus enemigos abatidos y sus rescates; los soldados salen en el
 * orden en que cayeron, sin clasificar a nadie (la puntuación es del pelotón, spec §3.1).
 */
export class Tally {
  private readonly soldiers = new Map<number, SoldierReport>();
  private readonly fallen: SoldierReport[] = [];
  private crabs = 0;

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

  /** Cae un soldado; `nick`, el apodo del jugador que lo controlaba (`null` si era un bot). */
  fell(id: number, nick: string | null): void {
    const s = this.soldiers.get(id);
    if (!s) return;
    if (nick) s.nick = nick;
    this.fallen.push(s);
  }

  /** Partida nueva. */
  reset(): void {
    this.soldiers.clear();
    this.fallen.length = 0;
    this.crabs = 0;
  }

  report(): MatchReport {
    return { crabsKilled: this.crabs, soldiers: this.fallen.map((s) => ({ ...s })) };
  }
}
