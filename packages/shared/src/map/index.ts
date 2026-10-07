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

export interface MapData {
  name: string;
  size: number;
  obstacles: Obstacle[];
  landingPad: Point & { radius: number };
  spawn: Point & { radius: number };
  burrows: Point[];
}

export const MAP: MapData = rawMap as MapData;
