import { GAME_CONFIG, TICK_SECONDS, type MatchMessage, type MatchPhase } from "@udc/shared";

const toTicks = (seconds: number) => Math.round(seconds / TICK_SECONDS);
/** Ticks de la partida en que despega cada lanzadera (E6-3). */
export const LAUNCH_TICKS = GAME_CONFIG.shuttles.launches.map(toTicks);

/** Ticks de preparación: hasta aquí, sin centollos. */
export const PREP_TICKS = toTicks(GAME_CONFIG.match.prepSeconds);
/** Tick de la partida en que despega la última lanzadera y empieza la oleada final. */
export const FINAL_TICK = LAUNCH_TICKS[LAUNCH_TICKS.length - 1]!;
const RESULT_TICKS = toTicks(GAME_CONFIG.match.resultSeconds);

/**
 * Fases de la partida (E6-1, spec §3.1). Lógica pura, por ticks, sin tocar el mundo:
 *
 * - Sin nadie (`waiting`) hasta que aparece el pelotón.
 * - Preparación (`prepSeconds`), evacuación hasta el último despegue y oleada final sin fin.
 * - Resultado en cuanto no queda ningún soldado, en cualquier fase: la partida termina aunque
 *   no haya despegado la última lanzadera. No hay tiempo máximo: la oleada final acaba con todos.
 * - Pasados `resultSeconds` en el resultado, toca empezar otra (provisional hasta E6-5).
 * - Lanzaderas (E6-3): despegan a su hora (`shuttles.launches`) mientras haya partida; el mundo
 *   embarca a los colonos y aquí se cuentan los que se salvan.
 *
 * Cuenta los mismos ticks que el director de oleadas: empiezan a la vez y avanzan juntos.
 */
export class Match {
  private current: MatchPhase = "waiting";
  /** Ticks desde que empezó la preparación. */
  private elapsed = 0;
  /** `elapsed` cuando cayó el pelotón. */
  private endedAt = 0;
  /** Lanzaderas que han despegado. */
  private launched = 0;
  /** Lanzadera que despega este tick (desde 1), o 0. */
  private launchingNow = 0;
  /** Colonos a salvo en esta partida. */
  private savedCount = 0;
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
    this.launchingNow = 0;
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
    const launch = LAUNCH_TICKS.indexOf(this.elapsed);
    if (launch >= 0) {
      this.launched = launch + 1;
      this.launchingNow = this.launched;
      this.changed = true;
    }
  }

  /** Lanzadera que despega en este tick (desde 1), o 0 si no despega ninguna. */
  get launching(): number {
    return this.launchingNow;
  }

  /** Lanzaderas que han despegado ya. */
  get launches(): number {
    return this.launched;
  }

  /** Colonos a salvo en esta partida. */
  get saved(): number {
    return this.savedCount;
  }

  /** Han embarcado `n` colonos en la lanzadera que despega. */
  addSaved(n: number): void {
    if (n === 0) return;
    this.savedCount += n;
    this.changed = true;
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
    this.launched = 0;
    this.launchingNow = 0;
    this.savedCount = 0;
    this.changed = true;
  }

  /**
   * Comandos de administración (E7-3): el siguiente `step` será el tick `t`, como el director.
   * Las lanzaderas que se salta se dan por despegadas, vacías; la del tick `t`, si la hay,
   * despega de verdad.
   */
  jumpTo(t: number): void {
    if (!this.isActive) return;
    this.elapsed = Math.max(0, t - 1);
    this.launched = LAUNCH_TICKS.filter((launch) => launch < t).length;
    this.changed = true;
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
    const next = this.isActive ? LAUNCH_TICKS.find((launch) => launch > this.elapsed) : undefined;
    const common = {
      t: "match" as const,
      launches: this.launched,
      nextLaunchTick: next === undefined ? null : at(next),
      saved: this.savedCount,
    };
    switch (this.current) {
      case "waiting":
      case "final":
        return { ...common, phase: this.current, endsAtTick: null };
      case "prep":
        return { ...common, phase: "prep", endsAtTick: at(PREP_TICKS) };
      case "evacuation":
        return { ...common, phase: "evacuation", endsAtTick: at(FINAL_TICK) };
      case "result":
        return {
          ...common,
          phase: "result",
          endsAtTick: at(this.endedAt + RESULT_TICKS),
          survivedSeconds: Math.round(this.endedAt * TICK_SECONDS),
        };
    }
  }
}
