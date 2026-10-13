import type { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator.js";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import type { Scene } from "@babylonjs/core/scene.js";
import {
  buildMarine,
  MARINE_PALETTE,
  type ArmRest,
  type Marine,
  type MarineMaterials,
} from "./marine.js";
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
const MUZZLE = { x: 0.12, y: 1.35, z: 0.97 };
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

  /**
   * Ha disparado (retroceso y se encara el arma) o empieza a apuntar sin disparar (`aim`,
   * durante `hold` segundos: el disparo apuntado).
   */
  fire(kind: "auto" | "aimed" | "aim", hold?: number): void {
    this.animator.fire(kind, hold);
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
    // El arma, donde diga la postura (respecto al torso); los brazos la siguen.
    const rest = this.marine.rest;
    const w = pose.weapon;
    this.weaponAt.copyFrom(rest.weapon).subtractInPlace(rest.torso);
    this.weaponAt.addInPlaceFromFloats(w.x, w.y, w.z);
    joints.weapon.position.copyFrom(this.weaponAt);
    joints.weapon.rotation.x = w.pitch;
    Matrix.RotationXToRef(w.pitch, this.weaponTurn);
    this.reach(rest.armR, joints.shoulderR, joints.elbowR);
    this.reach(rest.armL, joints.shoulderL, joints.elbowL);
  }

  private readonly weaponAt = new Vector3();
  private readonly weaponTurn = new Matrix();

  /**
   * IK de dos segmentos de un brazo, en coordenadas del torso: la mano, a su sitio en el arma
   * (donde estaba en la postura de partida, movida con el arma); el codo, doblado hacia donde
   * estaba. El hombro y el codo giran lo justo para llevar brazo y antebrazo hasta ahí.
   */
  private reach(arm: ArmRest, shoulder: TransformNode, elbow: TransformNode): void {
    const rest = this.marine.rest;
    const s = arm.shoulder.subtract(rest.torso);
    const e0 = arm.elbow.subtract(rest.torso);
    const h0 = arm.hand.subtract(rest.torso);
    // La mano, en el arma: su sitio de partida respecto al pivote, girado y movido con ella.
    const grip = Vector3.TransformCoordinates(arm.hand.subtract(rest.weapon), this.weaponTurn);
    const hand = grip.addInPlace(this.weaponAt);
    const upper = Vector3.Distance(e0, s);
    const lower = Vector3.Distance(h0, e0);
    const toHand = hand.subtract(s);
    const raw = toHand.length();
    const d = Math.min(Math.max(raw, Math.abs(upper - lower) + 1e-4), upper + lower - 1e-4);
    const u = toHand.scale(1 / Math.max(raw, 1e-6));
    const cosA = Math.min(
      1,
      Math.max(-1, (upper * upper + d * d - lower * lower) / (2 * upper * d)),
    );
    const sinA = Math.sqrt(1 - cosA * cosA);
    // Hacia dónde se dobla: hacia el codo de partida, quitándole la parte a lo largo de u.
    const pole = e0.subtract(s);
    const bend = pole.subtract(u.scale(Vector3.Dot(pole, u)));
    if (bend.lengthSquared() < 1e-8) bend.set(0, -1, 0);
    bend.normalize();
    const e = s.add(u.scale(upper * cosA)).addInPlace(bend.scale(upper * sinA));
    // Hombro: del brazo de partida al nuevo. Codo: del antebrazo de partida al nuevo, visto
    // desde el hombro ya girado.
    const qs = shoulder.rotationQuaternion ?? (shoulder.rotationQuaternion = new Quaternion());
    Quaternion.FromUnitVectorsToRef(e0.subtract(s).normalize(), e.subtract(s).normalize(), qs);
    const forearm = hand.subtract(e).normalize();
    const local = forearm.rotateByQuaternionToRef(Quaternion.Inverse(qs), new Vector3());
    const qe = elbow.rotationQuaternion ?? (elbow.rotationQuaternion = new Quaternion());
    Quaternion.FromUnitVectorsToRef(h0.subtract(e0).normalize(), local.normalize(), qe);
  }
}
