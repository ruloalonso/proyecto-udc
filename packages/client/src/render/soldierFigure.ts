import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import type { Scene } from "@babylonjs/core/scene.js";
import { buildMarine, MARINE_PALETTE, type Marine, type MarineMaterials } from "./marine.js";
import {
  JOINTS,
  localVelocity,
  MarineAnimator,
  type JointName,
  type MarineState,
} from "./marineAnim.js";

/**
 * Un soldado en pantalla (E8-1): el marine, su animación y el nodo que lo tumba al quedar
 * derribado. Saca la velocidad de cómo se mueve su nodo raíz (lo coloca quien lo usa: la
 * predicción, la interpolación, la vitrina), así que no hace falta pasarle nada más. Lo usan la
 * escena del juego, la bodega y la vitrina.
 */

/** Alto del marine hasta la cresta del casco, en metros (solo visual). */
export const MARINE_HEIGHT = 2.15;
/** Boca del fusil, en coordenadas del marine (delante, +Z). */
const MUZZLE = { x: 0.12, y: 1.41, z: 1.08 };
/** Tumbado boca abajo, el pecho apoya a esta altura. */
const DOWNED_Y = 0.3;
/** Suavizado de la velocidad: la interpolación de red da pasitos irregulares (segundos). */
const VELOCITY_TAU = 0.1;

/** Dónde está la boca del fusil de un soldado colocado en `root` (para las trazadoras). */
export function muzzleOf(root: TransformNode): { x: number; y: number; z: number } {
  const yaw = root.rotation.y;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return {
    x: root.position.x + MUZZLE.x * c + MUZZLE.z * s,
    y: MUZZLE.y,
    z: root.position.z - MUZZLE.x * s + MUZZLE.z * c,
  };
}

export class SoldierFigure {
  readonly marine: Marine;
  private readonly pose: TransformNode;
  private readonly animator = new MarineAnimator();
  private readonly pelvisY: number;
  private readonly state: MarineState = { downed: false, rescuing: false, seated: false };
  private last: { x: number; z: number } | null = null;
  private vx = 0;
  private vz = 0;

  constructor(
    scene: Scene,
    materials: MarineMaterials,
    readonly root: TransformNode,
    shadows?: ShadowGenerator,
  ) {
    // El marine cuelga de `pose`, que se tumba al quedar derribado.
    this.pose = new TransformNode(`${root.name}-pose`, scene);
    this.pose.parent = root;
    this.marine = buildMarine(scene, MARINE_PALETTE, materials, shadows, `${root.name}-marine`);
    this.marine.root.parent = this.pose;
    this.pelvisY = this.marine.joints.pelvis.position.y;
  }

  /** Tumbado boca abajo, a lo largo de hacia donde mira (E5-1); se arrastra si se mueve. */
  setDowned(on: boolean): void {
    this.state.downed = on;
    this.pose.rotation.x = on ? Math.PI / 2 : 0;
    this.pose.position.y = on ? DOWNED_Y : 0;
  }

  /** Rescatando a un compañero (E5-2): rodilla en tierra. */
  setRescuing(on: boolean): void {
    this.state.rescuing = on;
  }

  /** Sentado (en el banco de la bodega). */
  setSeated(on: boolean): void {
    this.state.seated = on;
  }

  /** Ha disparado: retroceso. */
  fire(kind: "auto" | "aimed"): void {
    this.animator.fire(kind);
  }

  /** Cada frame, con el nodo raíz ya colocado. */
  update(dt: number): void {
    const { x, z } = this.root.position;
    if (this.last && dt > 0) {
      const k = Math.min(1, dt / VELOCITY_TAU);
      this.vx += ((x - this.last.x) / dt - this.vx) * k;
      this.vz += ((z - this.last.z) / dt - this.vz) * k;
    }
    this.last = { x, z };
    const { forward, side } = localVelocity(this.vx, this.vz, this.root.rotation.y);
    const pose = this.animator.update(dt, forward, side, this.state);
    const joints = this.marine.joints;
    for (const name of JOINTS) {
      const r = pose.joints[name as JointName];
      joints[name].rotation.set(r.x, r.y, r.z);
    }
    joints.pelvis.position.y = this.pelvisY + pose.lift;
  }
}
