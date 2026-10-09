import { GAME_CONFIG, TICK_SECONDS, type ColonyMessage, type MapData } from "@udc/shared";

const { perBuilding, releaseInterval } = GAME_CONFIG.colonists;
const RELEASE_TICKS = Math.max(1, Math.round(releaseInterval / TICK_SECONDS));

/**
 * Edificios de colonos (E6-2, spec §4.5). Lógica pura, por ticks, sin tocar el mundo:
 *
 * - El Alto Mando decide qué edificio se evacua: uno por viaje de lanzadera, en un orden al azar
 *   que se sortea en cada partida. El mundo dice cuándo toca abrir el siguiente (`openNext`).
 * - Abierto, suelta a sus colonos de uno en uno, uno cada `releaseInterval` segundos, hasta
 *   vaciarse: una fila que hay que escoltar hasta la plataforma.
 * - De lejos no se sabe cuántos hay dentro: los clientes solo ven el contador de los abiertos.
 *
 * El director amenaza la ruta del edificio que se está evacuando (§4.4).
 */
export class Colony {
  private readonly remaining: number[];
  /** Tick del próximo colono de cada edificio, o `null` si no está abierto. */
  private readonly nextRelease: (number | null)[];
  /** Orden en que el Alto Mando abre los edificios (índices en `map.routes`). */
  private order: number[] = [];
  /** Cuántos edificios ha abierto ya. */
  private opened = 0;
  private changed = true;

  constructor(
    private readonly map: MapData,
    private readonly random: () => number = Math.random,
  ) {
    this.remaining = map.routes.map(() => perBuilding);
    this.nextRelease = map.routes.map(() => null);
    this.reset();
  }

  /** Vuelve al principio: todos llenos, cerrados y con un orden nuevo (nueva partida). */
  reset(): void {
    this.remaining.fill(perBuilding);
    this.nextRelease.fill(null);
    this.opened = 0;
    // Fisher-Yates.
    this.order = this.map.routes.map((_, i) => i);
    for (let i = this.order.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [this.order[i], this.order[j]] = [this.order[j]!, this.order[i]!];
    }
    this.changed = true;
  }

  isOpen(building: number): boolean {
    return this.nextRelease[building] !== null;
  }

  /** Colonos que quedan dentro de un edificio. */
  remainingIn(building: number): number {
    return this.remaining[building]!;
  }

  /** Edificios abiertos hasta ahora. */
  get openedCount(): number {
    return this.opened;
  }

  /** El edificio que se está evacuando (el último que ha abierto el Alto Mando), o `null`. */
  get evacuating(): number | null {
    return this.opened > 0 ? this.order[this.opened - 1]! : null;
  }

  /** El Alto Mando abre el siguiente edificio. Devuelve cuál, o `null` si no queda ninguno. */
  openNext(tick: number): number | null {
    const building = this.order[this.opened];
    if (building === undefined) return null;
    this.opened++;
    this.nextRelease[building] = tick;
    this.changed = true;
    return building;
  }

  /** Abre todos los que quedan a la vez (prueba de carga). */
  openAll(tick: number): void {
    while (this.openNext(tick) !== null);
  }

  /** Edificios de los que sale un colono este tick. */
  releases(tick: number): number[] {
    const out: number[] = [];
    this.nextRelease.forEach((at, i) => {
      if (at === null || tick < at || this.remaining[i]! === 0) return;
      this.remaining[i]!--;
      this.nextRelease[i] = tick + RELEASE_TICKS;
      this.changed = true;
      out.push(i);
    });
    return out;
  }

  /** Ruta del edificio que se está evacuando (la que amenaza el director). */
  activeRoutes(): string[] {
    const building = this.evacuating;
    return building === null ? [] : [this.map.routes[building]!.id];
  }

  /** ¿Ha cambiado lo que ven los clientes desde la última llamada? */
  takeChanged(): boolean {
    const changed = this.changed;
    this.changed = false;
    return changed;
  }

  /** Estado para los clientes: sin abrir, `null`; abierto, los que quedan dentro. */
  status(): ColonyMessage {
    return {
      t: "colony",
      buildings: this.remaining.map((n, i) => (this.isOpen(i) ? n : null)),
      evacuating: this.evacuating,
    };
  }
}
