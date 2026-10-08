import {
  GAME_CONFIG,
  segmentCircleHit,
  segmentCrossesBox,
  TICK_SECONDS,
  type MapData,
  type Point,
} from "@udc/shared";

const { spit } = GAME_CONFIG.spitter;
/** Metros que avanza un escupitajo por tick. */
const STEP = spit.speed * TICK_SECONDS;
/** Distancia entre centros a la que un escupitajo toca al soldado propio. */
const HIT = GAME_CONFIG.soldier.radius + spit.radius;

/**
 * Escupitajo en el cliente (E4-3). Las demás entidades se dibujan en el pasado, interpolando; un
 * escupitajo se vería ~2 m por detrás de donde está y daría antes de llegar al jugador en
 * pantalla. Como va en línea recta y a velocidad constante, se dibuja adelantado al tick en que
 * el servidor procesará lo que el jugador hace ahora, que es cuando decide si le da.
 *
 * Se deja de dibujar en cuanto toca al jugador, choca con un obstáculo o agota su alcance; el
 * servidor confirma después (el daño, o que desaparece).
 */
export class SpitTrack {
  private readonly dx: number;
  private readonly dz: number;
  private last: Point;
  private gone = false;

  constructor(
    /** Posición en el primer snapshot que lo trae. */
    private readonly origin: Point,
    yaw: number,
    /** Tick de ese snapshot. */
    private readonly originTick: number,
  ) {
    // Adelante = (sin yaw, cos yaw).
    this.dx = Math.sin(yaw);
    this.dz = Math.cos(yaw);
    this.last = { ...origin };
  }

  /**
   * Dónde dibujarlo en el tick `tick` (con decimales), o `null` si ya ha chocado (y desde
   * entonces, siempre `null`). `self`: el soldado propio, tal como se dibuja ahora.
   */
  update(tick: number, self: Point | null, map: MapData): Point | null {
    if (this.gone) return null;
    const travel = Math.max(0, (tick - this.originTick) * STEP);
    if (travel >= spit.range) return this.vanish();
    const next = { x: this.origin.x + this.dx * travel, z: this.origin.z + this.dz * travel };
    // Solo el tramo nuevo: lo que ya pasó de largo no puede darle.
    if (self && segmentCircleHit(this.last, next, self, HIT) !== null) return this.vanish();
    if (map.obstacles.some((box) => segmentCrossesBox(this.last, next, box))) return this.vanish();
    this.last = next;
    return next;
  }

  private vanish(): null {
    this.gone = true;
    return null;
  }
}
