import rawMap from "./map.json";

export type ObstacleKind = "building" | "wall" | "crate";

/** Caja orientada sobre el plano XZ. `rot` en radianes alrededor del eje Y. */
export interface Obstacle {
  id: string;
  kind: ObstacleKind;
  x: number;
  z: number;
  /** Ancho (eje X local). */
  w: number;
  /** Profundidad (eje Z local). */
  d: number;
  /** Altura (solo visual). */
  h: number;
  rot: number;
}

export interface Point {
  x: number;
  z: number;
}

/** Madriguera de centollos en el borde del mapa. `id` es su nombre (para los avisos). */
export interface Burrow extends Point {
  id: string;
}

/**
 * Ruta de colonos de un edificio a la plataforma, con las madrigueras que la amenazan (las que
 * están cerca: el enjambre brota donde puede cortar el paso a su comida, spec §4.4).
 * Hasta H5 no hay colonos: el director usa las rutas como si estuvieran todas activas.
 */
export interface ColonistRoute {
  id: string;
  /** Id del edificio (obstáculo) del que salen los colonos. */
  building: string;
  /** Ids de las madrigueras que la amenazan. */
  burrows: string[];
}

export interface MapData {
  name: string;
  size: number;
  obstacles: Obstacle[];
  landingPad: Point & { radius: number };
  spawn: Point & { radius: number };
  burrows: Burrow[];
  routes: ColonistRoute[];
  /** Muñecos de prueba de H2 (objetivos hostiles estáticos). */
  dummies: Point[];
}

export const MAP: MapData = rawMap as MapData;
