import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator.js";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import type { Scene } from "@babylonjs/core/scene.js";
import { GAME_CONFIG } from "@udc/shared";
import { CrabKit, type CrabKind } from "../render/crabRig.js";
import {
  buildMarine,
  MARINE_PALETTE,
  marineTriangles,
  type MarineMaterials,
} from "../render/marine.js";

/**
 * Catálogo de la vitrina (E7-9): los modelos que se pueden ver, construidos con las mismas
 * funciones que el juego. Para añadir uno, una entrada más aquí.
 */

/** Lo que comparten todos los modelos de la escena de la vitrina. */
export interface VitrinaContext {
  scene: Scene;
  shadows: ShadowGenerator;
  crabs: CrabKit;
  marines: MarineMaterials;
}

export interface CatalogEntry {
  id: string;
  name: string;
  /** Grupo en la lista (Centollos, Soldados…). */
  group: string;
  /** Velocidad real en el juego, en m/s, para los recorridos. */
  speed: number;
  /** Radio de colisión (de la configuración): el círculo amarillo del suelo. */
  radius: number;
  /** Alto aproximado, para encuadrar la cámara. */
  height: number;
  /** Triángulos de un ejemplar. */
  triangles(ctx: VitrinaContext): number;
  /** Un ejemplar nuevo, con el id `id` (único en la escena). */
  spawn(ctx: VitrinaContext, id: number): TransformNode;
  /** Quita el ejemplar. */
  remove(ctx: VitrinaContext, id: number, node: TransformNode): void;
}

function crab(id: string, name: string, kind: CrabKind): CatalogEntry {
  const cfg = kind === "raso" ? GAME_CONFIG.crab : GAME_CONFIG.spitter;
  return {
    id,
    name,
    group: "Centollos",
    speed: cfg.speed,
    radius: cfg.radius,
    height: cfg.height,
    triangles: (ctx) => ctx.crabs.triangles(kind),
    spawn: (ctx, n) => ctx.crabs.spawn(n, kind),
    remove: (ctx, n, node) => {
      ctx.crabs.remove(n);
      node.dispose();
    },
  };
}

function marine(id: string, name: string): CatalogEntry {
  const cfg = GAME_CONFIG.soldier;
  let triangles = 0;
  return {
    id,
    name,
    group: "Soldados",
    speed: cfg.speed,
    radius: cfg.radius,
    height: 2.05,
    triangles: () => triangles,
    spawn: (ctx, n) => {
      const m = buildMarine(ctx.scene, MARINE_PALETTE, ctx.marines, ctx.shadows, `${id}-${n}`);
      triangles = marineTriangles(m);
      return m.root;
    },
    remove: (_ctx, _n, node) => node.dispose(),
  };
}

export const CATALOG: readonly CatalogEntry[] = [
  crab("raso", "Centollo raso", "raso"),
  crab("escupidor", "Escupidor", "spitter"),
  marine("marine", "Marine"),
];
