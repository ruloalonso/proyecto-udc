import { GAME_CONFIG, TICK_SECONDS, type ShuttleMessage } from "@udc/shared";
import { LAUNCH_TICKS } from "./match.js";

const cfg = GAME_CONFIG.shuttles;
const toTicks = (seconds: number) => Math.round(seconds / TICK_SECONDS);
/** Tras despegar, la siguiente se posa a los tantos ticks. */
const RETURN_TICKS = toTicks(cfg.landDelay + cfg.landSeconds);
/** Tras una destrucción, la de reemplazo se posa a los tantos ticks. */
const REPLACEMENT_TICKS = toTicks(cfg.replacementSeconds);
const TRIPS = LAUNCH_TICKS.length;

/**
 * Lanzadera de la plataforma (E6-3, #72). Lógica pura, por ticks de la partida:
 *
 * - Cada viaje (`n`, desde 1) despega a su hora (`shuttles.launches`) con los colonos que han
 *   embarcado al llegar; la siguiente se posa poco después.
 * - Posada, tiene vida y se le puede hacer daño. A 0, la destruyen: los de a bordo se pierden,
 *   el viaje también, y el comandante pide otra que tarda `replacementSeconds` en llegar. La de
 *   reemplazo sirve al viaje siguiente y despega a la hora de ese viaje.
 * - Tras la última, no viene ninguna más.
 */
export class Shuttle {
  /** Viaje de la nave posada o de la que viene; `null` si ya no queda ninguna. */
  private tripNow: number | null = 1;
  private dockedNow = true;
  /** Tick de la partida en que se posa la que viene. */
  private arrivesAt: number | null = null;
  private hpNow: number = cfg.health;
  private aboardNow = 0;
  private landed = false;
  private changed = true;

  reset(): void {
    this.tripNow = 1;
    this.dockedNow = true;
    this.arrivesAt = null;
    this.hpNow = cfg.health;
    this.aboardNow = 0;
    this.landed = false;
    this.changed = true;
  }

  get docked(): boolean {
    return this.dockedNow;
  }

  get trip(): number | null {
    return this.tripNow;
  }

  get hp(): number {
    return this.hpNow;
  }

  get aboard(): number {
    return this.aboardNow;
  }

  /** Se ha posado una nave en este tick. */
  get landedNow(): boolean {
    return this.landed;
  }

  /** Avanza al tick `t` de la partida: se posa la que toca. */
  step(t: number): void {
    this.landed = false;
    if (this.dockedNow || this.arrivesAt === null || t < this.arrivesAt) return;
    this.dockedNow = true;
    this.arrivesAt = null;
    this.hpNow = cfg.health;
    this.aboardNow = 0;
    this.landed = true;
    this.changed = true;
  }

  /** Suben `n` colonos (llegan a la plataforma con la nave posada). */
  board(n: number): void {
    if (n === 0 || !this.dockedNow) return;
    this.aboardNow += n;
    this.changed = true;
  }

  /**
   * Toca despegar el viaje `n` en el tick `t`. Devuelve los colonos que lleva a salvo, o `null`
   * si no hay nave para ese viaje (la destruyeron y la de reemplazo es para el siguiente).
   */
  depart(n: number, t: number): number | null {
    if (!this.dockedNow || this.tripNow !== n) return null;
    const saved = this.aboardNow;
    this.leave(t + RETURN_TICKS);
    return saved;
  }

  /**
   * Daño a la nave posada en el tick `t`. Devuelve los colonos que mueren si la destruye, o `null`
   * si aguanta (o no hay nave posada).
   */
  damage(amount: number, t: number): number | null {
    if (!this.dockedNow) return null;
    this.hpNow = Math.max(0, this.hpNow - amount);
    this.changed = true;
    if (this.hpNow > 0) return null;
    const lost = this.aboardNow;
    this.leave(t + REPLACEMENT_TICKS);
    return lost;
  }

  /** La nave se va (despega o explota): la que viene es del viaje siguiente, si queda alguno. */
  private leave(nextAt: number): void {
    const next = this.tripNow !== null && this.tripNow < TRIPS ? this.tripNow + 1 : null;
    this.tripNow = next;
    this.dockedNow = false;
    this.aboardNow = 0;
    this.arrivesAt = next === null ? null : nextAt;
    this.changed = true;
  }

  /**
   * Comandos de administración (E7-3): al saltar al tick `t`, posada la nave del viaje que toca
   * (los saltados se dan por despegados, vacíos), con la vida entera.
   */
  jumpTo(t: number): void {
    const trip = LAUNCH_TICKS.filter((launch) => launch < t).length + 1;
    this.tripNow = trip <= TRIPS ? trip : null;
    this.dockedNow = this.tripNow !== null;
    this.arrivesAt = null;
    this.hpNow = cfg.health;
    this.aboardNow = 0;
    this.changed = true;
  }

  takeChanged(): boolean {
    const changed = this.changed;
    this.changed = false;
    return changed;
  }

  /** Estado para los clientes. `elapsed`: tick de la partida; `serverTick`: el del servidor. */
  status(id: number, serverTick: number, elapsed: number): ShuttleMessage {
    return {
      t: "shuttle",
      id,
      docked: this.dockedNow,
      trip: this.tripNow,
      hp: this.hpNow,
      aboard: this.aboardNow,
      arrivesAtTick: this.arrivesAt === null ? null : serverTick + this.arrivesAt - elapsed,
    };
  }
}
