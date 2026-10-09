import {
  distanceToBox,
  GAME_CONFIG,
  TICK_SECONDS,
  type ColonyMessage,
  type MapData,
  type Obstacle,
  type Point,
} from "@udc/shared";

const { perBuilding, activationRange, group } = GAME_CONFIG.colonists;
const GROUP_TICKS = Math.round(group.interval / TICK_SECONDS);

/** Un soldado que puede activar edificios. */
export interface Activator extends Point {
  id: number;
}

/** Un grupo de colonos que sale de un edificio este tick. */
export interface Release {
  /** Índice en `map.routes`. */
  building: number;
  count: number;
}

/**
 * Edificios de colonos (E6-2, spec §4.5). Lógica pura, por ticks, sin tocar el mundo:
 *
 * - Un edificio se activa cuando un soldado se le acerca a `activationRange` metros: por
 *   proximidad pura, sin botón, y para siempre (el soldado no tiene que quedarse).
 * - Activado, suelta un grupo de `group.min`–`group.max` colonos al momento y otro cada
 *   `group.interval` segundos, hasta vaciarse. No se cierra por tiempo.
 * - De lejos no se sabe cuántos hay dentro: los clientes solo ven el contador de los activados.
 *
 * Las rutas de los edificios activados son las que amenaza el director (§4.4).
 */
export class Colony {
  /** Edificio de cada ruta (los mapas de los tests pueden no tenerlo: no se activa nunca). */
  private readonly buildings: (Obstacle | undefined)[];
  private readonly remaining: number[];
  /** Tick del próximo grupo de cada edificio, o `null` si no está activado. */
  private readonly nextRelease: (number | null)[];
  private changed = true;

  constructor(
    private readonly map: MapData,
    private readonly random: () => number = Math.random,
  ) {
    this.buildings = map.routes.map((r) => map.obstacles.find((o) => o.id === r.building));
    this.remaining = map.routes.map(() => perBuilding);
    this.nextRelease = map.routes.map(() => null);
  }

  /** Vuelve al principio: todos llenos y sin activar (nueva partida). */
  reset(): void {
    this.remaining.fill(perBuilding);
    this.nextRelease.fill(null);
    this.changed = true;
  }

  isActive(building: number): boolean {
    return this.nextRelease[building] !== null;
  }

  /** Colonos que quedan dentro de un edificio. */
  remainingIn(building: number): number {
    return this.remaining[building]!;
  }

  /**
   * Activa los edificios sin activar a los que se acerca algún soldado. Devuelve los activados
   * este tick y quién lo hizo.
   */
  activate(tick: number, soldiers: readonly Activator[]): { building: number; by: number }[] {
    const activated: { building: number; by: number }[] = [];
    this.buildings.forEach((box, i) => {
      if (!box || this.isActive(i)) return;
      const by = soldiers.find((s) => distanceToBox(s.x, s.z, box) <= activationRange);
      if (!by) return;
      this.nextRelease[i] = tick;
      this.changed = true;
      activated.push({ building: i, by: by.id });
    });
    return activated;
  }

  /** Activa todos los edificios a la vez (prueba de carga). */
  activateAll(tick: number): number[] {
    const activated: number[] = [];
    this.buildings.forEach((_, i) => {
      if (this.isActive(i)) return;
      this.nextRelease[i] = tick;
      this.changed = true;
      activated.push(i);
    });
    return activated;
  }

  /** Grupos de colonos que salen este tick. */
  releases(tick: number): Release[] {
    const out: Release[] = [];
    this.nextRelease.forEach((at, i) => {
      if (at === null || tick < at || this.remaining[i]! === 0) return;
      const size = group.min + Math.floor(this.random() * (group.max - group.min + 1));
      const count = Math.min(size, this.remaining[i]!);
      this.remaining[i]! -= count;
      this.nextRelease[i] = tick + GROUP_TICKS;
      this.changed = true;
      out.push({ building: i, count });
    });
    return out;
  }

  /** Ids de las rutas de los edificios activados (las que enciende el director). */
  activeRoutes(): string[] {
    return this.map.routes.filter((_, i) => this.isActive(i)).map((r) => r.id);
  }

  /** ¿Ha cambiado lo que ven los clientes desde la última llamada? */
  takeChanged(): boolean {
    const changed = this.changed;
    this.changed = false;
    return changed;
  }

  /** Estado para los clientes: sin activar, `null`; activado, los que quedan dentro. */
  status(): ColonyMessage {
    return {
      t: "colony",
      buildings: this.remaining.map((n, i) => (this.isActive(i) ? n : null)),
    };
  }
}
