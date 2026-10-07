import { type AbstractMesh, type ArcRotateCamera, Ray, type Scene, Vector3 } from "@babylonjs/core";
import { GAME_CONFIG } from "@udc/shared";
import { smoothCameraDistance } from "./cameraDistance.js";

const CFG = GAME_CONFIG.camera;

/**
 * Cámara en tercera persona que no atraviesa obstáculos (E2-3).
 * Lanza un rayo desde la cabeza del soldado hacia la posición deseada de la
 * cámara y, si choca con un obstáculo, la acerca hasta justo delante de él.
 */
export class FollowCamera {
  private distance: number = CFG.distance;
  private readonly ray = new Ray(Vector3.Zero(), Vector3.Forward(), 1);
  private readonly target = new Vector3();
  private readonly blockers: Set<AbstractMesh>;

  constructor(
    private readonly scene: Scene,
    private readonly camera: ArcRotateCamera,
    blockers: Iterable<AbstractMesh>,
  ) {
    this.blockers = new Set(blockers);
  }

  /**
   * @param yaw orientación de la cámara en la convención de la simulación (0 = +Z).
   * @param pitch radianes desde la vertical.
   */
  update(
    x: number,
    z: number,
    yaw: number,
    pitch: number,
    desiredDistance: number,
    dt: number,
  ): void {
    // Detrás del personaje: en dirección opuesta a (sin yaw, cos yaw).
    const alpha = Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
    this.target.set(x, CFG.targetHeight, z);

    // Mismo reparto que ArcRotateCamera: x = cos α sin β, y = cos β, z = sin α sin β.
    this.ray.origin.copyFrom(this.target);
    this.ray.direction.set(
      Math.cos(alpha) * Math.sin(pitch),
      Math.cos(pitch),
      Math.sin(alpha) * Math.sin(pitch),
    );
    this.ray.length = desiredDistance + CFG.collisionMargin;
    const hit = this.scene.pickWithRay(this.ray, (m) => this.blockers.has(m));
    const blocked = hit?.hit
      ? Math.max(CFG.collisionMinDistance, hit.distance - CFG.collisionMargin)
      : null;

    this.distance = smoothCameraDistance(
      this.distance,
      desiredDistance,
      blocked,
      dt,
      CFG.easeOutRate,
    );

    this.camera.target.copyFrom(this.target);
    this.camera.alpha = alpha;
    this.camera.beta = pitch;
    this.camera.radius = this.distance;
  }
}
