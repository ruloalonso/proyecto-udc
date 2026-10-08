import { GAME_CONFIG, TICK_SECONDS, type MatchMessage, type MatchPhase } from "@udc/shared";

const toTicks = (seconds: number) => Math.round(seconds / TICK_SECONDS);
const { launches } = GAME_CONFIG.director;

/** Ticks de preparación: hasta aquí, sin centollos. */
export const PREP_TICKS = toTicks(GAME_CONFIG.match.prepSeconds);
/** Tick de la partida en que despega la última lanzadera y empieza la oleada final. */
export const FINAL_TICK = toTicks(launches[launches.length - 1]!);
const RESULT_TICKS = toTicks(GAME_CONFIG.match.resultSeconds);

/**
 * Fases de la partida (E6-1, spec §3.1). Lógica pura, por ticks, sin tocar el mundo:
 *
 * - Sin nadie (`waiting`) hasta que aparece el pelotón.
 * - Preparación (`prepSeconds`), evacuación hasta el último despegue y oleada final sin fin.
 * - Resultado en cuanto no queda ningún soldado, en cualquier fase: la partida termina aunque
 *   no haya despegado la última lanzadera. No hay tiempo máximo: la oleada final acaba con todos.
 * - Pasados `resultSeconds` en el resultado, toca empezar otra (provisional hasta E6-5).
 *
 * Cuenta los mismos ticks que el director de oleadas: empiezan a la vez y avanzan juntos.
 */
export class Match {
  private current: MatchPhase = "waiting";
  /** Ticks desde que empezó la preparación. */
  private elapsed = 0;
  /** `elapsed` cuando cayó el pelotón. */
  private endedAt = 0;
  private changed = true;

  get phase(): MatchPhase {
    return this.current;
  }

  /** En juego: preparación, evacuación u oleada final. */
  get isActive(): boolean {
    return this.current !== "waiting" && this.current !== "result";
  }

  /** Fase de juego en el tick `t` de la partida. */
  static phaseAt(t: number): "prep" | "evacuation" | "final" {
    if (t < PREP_TICKS) return "prep";
    return t < FINAL_TICK ? "evacuation" : "final";
  }

  /**
   * Avanza un tick. `soldiers`: soldados que quedan en el pelotón. Empieza con el primero y
   * pasa al resultado cuando no queda ninguno.
   */
  step(soldiers: number): void {
    if (this.current === "waiting") {
      if (soldiers === 0) return;
      this.elapsed = 0;
      this.current = "prep";
      this.changed = true;
    }
    this.elapsed++;
    if (this.current === "result") return;
    if (soldiers === 0) {
      this.current = "result";
      this.endedAt = this.elapsed;
      this.changed = true;
      return;
    }
    this.set(Match.phaseAt(this.elapsed));
  }

  /** Lleva un rato en el resultado: toca empezar otra partida. */
  get restartDue(): boolean {
    return this.current === "result" && this.elapsed - this.endedAt >= RESULT_TICKS;
  }

  /** Vuelve a esperar a un pelotón (al irse todos o para empezar otra). */
  reset(): void {
    this.current = "waiting";
    this.elapsed = 0;
    this.endedAt = 0;
    this.changed = true;
  }

  /** Comandos de administración (E7-3): el siguiente `step` será el tick `t`, como el director. */
  jumpTo(t: number): void {
    if (this.isActive) this.elapsed = Math.max(0, t - 1);
  }

  private set(phase: MatchPhase): void {
    if (phase === this.current) return;
    this.current = phase;
    this.changed = true;
  }

  /** ¿Ha cambiado la fase desde la última llamada? */
  takeChanged(): boolean {
    const changed = this.changed;
    this.changed = false;
    return changed;
  }

  /** Estado para los clientes. `serverTick`: tick actual, para traducir los plazos a su reloj. */
  status(serverTick: number): MatchMessage {
    const at = (t: number) => serverTick + t - this.elapsed;
    switch (this.current) {
      case "waiting":
      case "final":
        return { t: "match", phase: this.current, endsAtTick: null };
      case "prep":
        return { t: "match", phase: "prep", endsAtTick: at(PREP_TICKS) };
      case "evacuation":
        return { t: "match", phase: "evacuation", endsAtTick: at(FINAL_TICK) };
      case "result":
        return {
          t: "match",
          phase: "result",
          endsAtTick: at(this.endedAt + RESULT_TICKS),
          survivedSeconds: Math.round(this.endedAt * TICK_SECONDS),
        };
    }
  }
}
