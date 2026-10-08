import {
  BurrowState,
  EntityKind,
  GAME_CONFIG,
  TICK_SECONDS,
  type DirectorMessage,
  type DirectorPhase,
  type GameEvent,
  type MapData,
  type Point,
} from "@udc/shared";
import type { CrabKind } from "./swarm.js";

const cfg = GAME_CONFIG.director;
const toTicks = (seconds: number) => Math.round(seconds / TICK_SECONDS);

const START_TICKS = toTicks(cfg.startDelay);
const LAUNCH_TICKS = cfg.launches.map(toTicks);
const FINAL_TICK = LAUNCH_TICKS[LAUNCH_TICKS.length - 1]!;
const PUSH_TICKS = toTicks(cfg.pushSeconds);
const VALLEY_TICKS = cfg.valleySeconds.map(toTicks);
const WARNING_TICKS = toTicks(cfg.burrowWarning);
const PLUG_REOPEN_TICKS = toTicks(cfg.plugReopen);
/** Ticks en los que empieza cada fase, en orden (para saltar de fase: E7-3). */
const PHASE_STARTS = [
  START_TICKS,
  ...LAUNCH_TICKS.map((launch) => launch - PUSH_TICKS),
  ...LAUNCH_TICKS,
  ...LAUNCH_TICKS.slice(0, -1).map((launch, k) => launch + (VALLEY_TICKS[k] ?? 0)),
]
  .filter((t, i, all) => all.indexOf(t) === i)
  .sort((a, b) => a - b);

/** Un centollo que el director quiere hacer aparecer este tick. */
export interface SpawnRequest {
  /** Índice en `map.burrows`. */
  burrow: number;
  kind: CrabKind;
}

/**
 * Director de oleadas (E4-4, spec §4.4). Lógica pura, por ticks: decide cuántos centollos
 * aparecen, de qué tipo y por qué madriguera, y qué madrigueras se abren. No toca el mundo.
 *
 * - Ritmo de fondo creciente en dientes de sierra: empujón antes de cada despegue, valle de
 *   calma (cada vez más corto) después. Sin factor de jugadores: la carga es para 8.
 * - Madrigueras por tandas: pocas al principio, una más en cada despegue y todas en la oleada
 *   final; se abren las que amenazan más rutas de colonos, con aviso.
 * - Una granada tapona una madriguera; a los pocos segundos se abre otra: nunca bajan.
 * - Escupidores desde el primer despegue, en proporción creciente.
 *
 * Hasta H5 no hay colonos ni lanzaderas: las rutas cuentan todas como activas y los despegues
 * siguen el calendario de la configuración.
 */
export class Director {
  /** Ticks desde que empezó la partida (0: sin empezar). */
  private elapsed = 0;
  private running = false;
  private readonly states: BurrowState[];
  /** Tick (de `elapsed`) en que se abre cada madriguera en aviso. */
  private readonly opensAt = new Map<number, number>();
  /** Huecos que deja cada madriguera taponada, hasta el tick en que se abre otra. */
  private plugGaps: number[] = [];
  /** La última taponada: no se elige para reabrir si hay otra opción. */
  private lastPlugged: number | null = null;
  /** Fracción de centollo acumulada por el ritmo. */
  private owed = 0;
  private launchesDone = 0;
  /** Cuántas rutas amenaza cada madriguera (orden de apertura). */
  private readonly threat: number[];
  private changed = true;

  constructor(
    private readonly map: MapData,
    private readonly random: () => number = Math.random,
  ) {
    this.states = map.burrows.map(() => BurrowState.Closed);
    this.threat = map.burrows.map((b) => map.routes.filter((r) => r.burrows.includes(b.id)).length);
  }

  get isRunning(): boolean {
    return this.running;
  }

  /** Empieza la partida (con el primer soldado). */
  start(): void {
    this.reset();
    this.running = true;
  }

  /** Vuelve al principio, sin empezar (al irse todos). */
  reset(): void {
    this.elapsed = 0;
    this.running = false;
    this.states.fill(BurrowState.Closed);
    this.opensAt.clear();
    this.plugGaps = [];
    this.lastPlugged = null;
    this.owed = 0;
    this.launchesDone = 0;
    this.changed = true;
  }

  /** Fase en el tick `t` de la partida. */
  phaseAt(t: number): DirectorPhase {
    if (t < START_TICKS) return "calm";
    if (t >= FINAL_TICK) return "final";
    for (let k = 0; k < LAUNCH_TICKS.length - 1; k++) {
      const launch = LAUNCH_TICKS[k]!;
      if (t >= launch && t < launch + (VALLEY_TICKS[k] ?? 0)) return "valley";
    }
    if (LAUNCH_TICKS.some((launch) => t >= launch - PUSH_TICKS && t < launch)) return "push";
    return "background";
  }

  /** Centollos por minuto en el tick `t` (fuera de la oleada final). */
  rateAt(t: number): number {
    const phase = this.phaseAt(t);
    if (phase === "calm") return 0;
    const minute = (t * TICK_SECONDS) / 60;
    const background = cfg.baseRate * (1 + cfg.growthPerMinute * minute);
    if (phase === "push") return background * cfg.pushFactor;
    if (phase === "valley") return background * cfg.valleyFactor;
    return background;
  }

  /** Proporción de escupidores en el tick `t`. */
  spitterRatioAt(t: number): number {
    const first = LAUNCH_TICKS[0]!;
    if (t < first) return 0;
    if (t >= FINAL_TICK) return cfg.spitterRatioTo;
    const progress = (t - first) / (FINAL_TICK - first);
    return cfg.spitterRatioFrom + (cfg.spitterRatioTo - cfg.spitterRatioFrom) * progress;
  }

  /** Madrigueras que tienen que estar abiertas en el tick `t` (sin contar las taponadas). */
  burrowsWantedAt(t: number): number {
    if (t < START_TICKS) return 0;
    if (t >= FINAL_TICK) return this.states.length;
    const launched = LAUNCH_TICKS.filter((launch) => t >= launch).length;
    return Math.min(this.states.length, cfg.initialBurrows + launched);
  }

  /**
   * Avanza un tick. `alive`: centollos vivos ahora. Devuelve los centollos que hay que hacer
   * aparecer y los eventos (avisos, aperturas, despegues).
   */
  step(alive: number): { spawns: SpawnRequest[]; events: GameEvent[] } {
    const events: GameEvent[] = [];
    if (!this.running) return { spawns: [], events };
    const t = ++this.elapsed;
    if (this.phaseAt(t) !== this.phaseAt(t - 1)) this.changed = true;

    const launchIndex = LAUNCH_TICKS.indexOf(t);
    if (launchIndex >= 0) {
      this.launchesDone = launchIndex + 1;
      this.changed = true;
      events.push({ k: "launch", n: this.launchesDone });
      if (t === FINAL_TICK) events.push({ k: "finalWave" });
    }

    this.updateBurrows(t, events);
    return { spawns: this.spawns(t, alive), events };
  }

  /** Abre las madrigueras en aviso que ya tocan y avisa de las que hacen falta. */
  private updateBurrows(t: number, events: GameEvent[]): void {
    for (const [burrow, at] of this.opensAt) {
      if (t < at) continue;
      this.opensAt.delete(burrow);
      this.setState(burrow, BurrowState.Open, events);
    }

    // Se mira `WARNING_TICKS` por delante: el aviso empieza a tiempo para abrir justo cuando toca.
    const ahead = t + WARNING_TICKS;
    this.plugGaps = this.plugGaps.filter((until) => until > ahead);
    const wanted = this.burrowsWantedAt(ahead) - this.plugGaps.length;
    let pending = this.count(BurrowState.Open) + this.count(BurrowState.Warning);
    while (pending < wanted) {
      const next = this.pickBurrow();
      if (next === null) break;
      this.opensAt.set(next, t + WARNING_TICKS);
      this.setState(next, BurrowState.Warning, events);
      pending++;
    }
  }

  /**
   * Siguiente madriguera que se abre: entre las cerradas o taponadas, la que amenaza más rutas
   * (al azar si empatan). La última taponada, solo si no hay otra.
   */
  private pickBurrow(): number | null {
    const candidates = this.states
      .map((state, i) => ({ state, i }))
      .filter(({ state }) => state === BurrowState.Closed || state === BurrowState.Plugged)
      .map(({ i }) => i);
    const others = candidates.filter((i) => i !== this.lastPlugged);
    const pool = others.length > 0 ? others : candidates;
    if (pool.length === 0) return null;
    const best = Math.max(...pool.map((i) => this.threat[i]!));
    const top = pool.filter((i) => this.threat[i] === best);
    return top[Math.floor(this.random() * top.length)]!;
  }

  /** Centollos que aparecen este tick, repartidos al azar entre las madrigueras abiertas. */
  private spawns(t: number, alive: number): SpawnRequest[] {
    const open = this.states.flatMap((state, i) => (state === BurrowState.Open ? [i] : []));
    if (open.length === 0) return [];
    const room = Math.max(0, cfg.maxAlive - alive);

    let count: number;
    if (this.phaseAt(t) === "final") {
      // Oleada final: hasta el tope, como mucho uno por madriguera y tick.
      count = Math.min(room, open.length);
      this.owed = 0;
    } else {
      this.owed += (this.rateAt(t) / 60) * TICK_SECONDS;
      count = Math.min(room, Math.floor(this.owed));
      this.owed -= count;
      // Con el tope lleno no se acumula deuda: al morir uno no salen todos de golpe.
      if (room === 0) this.owed = Math.min(this.owed, 1);
    }

    const ratio = this.spitterRatioAt(t);
    const spawns: SpawnRequest[] = [];
    for (let i = 0; i < count; i++) {
      spawns.push({
        burrow: open[Math.floor(this.random() * open.length)]!,
        kind: this.random() < ratio ? EntityKind.Spitter : EntityKind.Crab,
      });
    }
    return spawns;
  }

  /** Tick de la partida en que empieza la siguiente fase, o `null` si ya está en la final. */
  nextPhaseTick(): number | null {
    return PHASE_STARTS.find((t) => t > this.elapsed) ?? null;
  }

  /** Tick del próximo empujón, o el de la oleada final si ya no quedan. */
  nextPushTick(): number {
    return (
      LAUNCH_TICKS.map((launch) => launch - PUSH_TICKS).find((t) => t > this.elapsed) ?? FINAL_TICK
    );
  }

  /** Tick en que empieza la oleada final. */
  get finalTick(): number {
    return FINAL_TICK;
  }

  /**
   * Comandos de administración (E7-3): el siguiente `step` será el tick `t` de la partida.
   * Las madrigueras que tocan se abren con su aviso normal; el despegue en el que se aterriza
   * se anuncia; el ritmo acumulado se pone a cero.
   */
  jumpTo(t: number): void {
    if (!this.running) this.start();
    this.elapsed = Math.max(0, t - 1);
    this.launchesDone = LAUNCH_TICKS.filter((launch) => launch < t).length;
    this.owed = 0;
    this.changed = true;
  }

  /** Madriguera abierta a menos de su radio de `p`, o `null`. */
  burrowAt(p: Point): number | null {
    for (let i = 0; i < this.states.length; i++) {
      if (this.states[i] !== BurrowState.Open) continue;
      const b = this.map.burrows[i]!;
      if (Math.hypot(b.x - p.x, b.z - p.z) <= cfg.burrowRadius) return i;
    }
    return null;
  }

  /**
   * Tapona una madriguera abierta (una granada ha explotado dentro). A los `plugReopen`
   * segundos se abre otra, con su aviso. Devuelve los eventos.
   */
  plug(burrow: number): GameEvent[] {
    if (this.states[burrow] !== BurrowState.Open) return [];
    const events: GameEvent[] = [];
    this.setState(burrow, BurrowState.Plugged, events);
    this.lastPlugged = burrow;
    this.plugGaps.push(this.elapsed + PLUG_REOPEN_TICKS);
    return events;
  }

  private count(state: BurrowState): number {
    return this.states.filter((s) => s === state).length;
  }

  private setState(burrow: number, state: BurrowState, events: GameEvent[]): void {
    this.states[burrow] = state;
    this.changed = true;
    events.push({ k: "burrow", burrow, state });
  }

  /** ¿Ha cambiado el estado que ven los clientes desde la última llamada? */
  takeChanged(): boolean {
    const changed = this.changed;
    this.changed = false;
    return changed;
  }

  /**
   * Estado para los clientes. `serverTick`: tick actual del servidor, para traducir el próximo
   * despegue a su reloj.
   */
  status(serverTick: number): DirectorMessage {
    const next = LAUNCH_TICKS.find((launch) => launch > this.elapsed);
    return {
      t: "director",
      phase: this.running ? this.phaseAt(this.elapsed) : "calm",
      burrows: [...this.states],
      launches: this.launchesDone,
      nextLaunchTick: this.running && next !== undefined ? serverTick + next - this.elapsed : null,
    };
  }
}
