import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import type { Scene } from "@babylonjs/core/scene.js";
import { GAME_CONFIG } from "@udc/shared";
import { CrabKit, type CrabKind } from "../render/crabRig.js";
import { marineTriangles, type MarineMaterials } from "../render/marine.js";
import { MARINE_HEIGHT, SoldierFigure } from "../render/soldierFigure.js";
import type { Action } from "./state.js";

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
  /**
   * Cada frame, con el ejemplar ya colocado, para lo que se anima por su cuenta: `action`, qué
   * hace, y `t`, el tiempo de la vitrina en segundos.
   */
  update?(id: number, dt: number, action: Action, t: number): void;
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

/** Cada cuánto dispara el marine de la vitrina (como en el juego). */
const FIRE_EVERY = {
  disparar: GAME_CONFIG.combat.autoFire.interval,
  apuntado: GAME_CONFIG.abilities.aimedShot.cooldown / 4,
};

function marine(id: string, name: string): CatalogEntry {
  const cfg = GAME_CONFIG.soldier;
  const figures = new Map<number, { figure: SoldierFigure; nextShot: number }>();
  let triangles = 0;
  return {
    id,
    name,
    group: "Soldados",
    speed: cfg.speed,
    radius: cfg.radius,
    height: MARINE_HEIGHT,
    triangles: () => triangles,
    spawn: (ctx, n) => {
      const root = new TransformNode(`${id}-${n}`, ctx.scene);
      const figure = new SoldierFigure(ctx.scene, ctx.marines, root, ctx.shadows);
      triangles = marineTriangles(figure.marine);
      figures.set(n, { figure, nextShot: 0 });
      return root;
    },
    remove: (_ctx, n, node) => {
      figures.delete(n);
      node.dispose();
    },
    update: (n, dt, action, t) => {
      const entry = figures.get(n);
      if (!entry) return;
      const { figure } = entry;
      figure.setDowned(action === "derribado");
      figure.setRescuing(action === "rescatando");
      figure.setSeated(action === "sentado");
      if ((action === "disparar" || action === "apuntado") && t >= entry.nextShot) {
        figure.fire(action === "apuntado" ? "aimed" : "auto");
        entry.nextShot = t + FIRE_EVERY[action];
      }
      figure.update(dt);
    },
  };
}

export const CATALOG: readonly CatalogEntry[] = [
  crab("raso", "Centollo raso", "raso"),
  crab("escupidor", "Escupidor", "spitter"),
  marine("marine", "Marine"),
];
