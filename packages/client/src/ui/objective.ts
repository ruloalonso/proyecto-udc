import { Matrix, Vector3, type Scene } from "@babylonjs/core";
import type { Point } from "@udc/shared";

/** Margen entre la flecha y el borde de la pantalla, en píxeles. */
const EDGE_MARGIN = 48;

/**
 * Dónde poner la flecha que señala un objetivo fuera de la vista (E6-2): en el borde de la
 * pantalla, en la dirección del objetivo, o `null` si se ve (delante de la cámara y dentro de la
 * pantalla). `x`, `y`: el objetivo proyectado; `behind`: está detrás de la cámara (la proyección
 * sale reflejada y hay que darle la vuelta). Ángulo en radianes, 0 hacia arriba, horario.
 */
export function edgeMarker(
  x: number,
  y: number,
  behind: boolean,
  width: number,
  height: number,
  margin = EDGE_MARGIN,
): { x: number; y: number; angle: number } | null {
  const inside = x >= margin && x <= width - margin && y >= margin && y <= height - margin;
  if (!behind && inside) return null;
  const cx = width / 2;
  const cy = height / 2;
  let dx = x - cx;
  let dy = y - cy;
  if (behind) {
    dx = -dx;
    dy = -dy;
  }
  if (dx === 0 && dy === 0) dy = 1;
  // Hasta el borde (menos el margen) en esa dirección.
  const halfW = cx - margin;
  const halfH = cy - margin;
  const scale = Math.min(halfW / Math.abs(dx || 1e-9), halfH / Math.abs(dy || 1e-9));
  return { x: cx + dx * scale, y: cy + dy * scale, angle: Math.atan2(dx, -dy) };
}

/**
 * Señal del edificio que se evacua (E6-2): una flecha en el borde de la pantalla con su nombre y
 * la distancia, solo cuando no se ve (la columna de luz ya lo marca cuando está a la vista).
 */
export class ObjectiveMarker {
  private readonly root: HTMLElement;
  private readonly arrow: HTMLElement;
  private readonly label: HTMLElement;
  private readonly world = new Vector3();
  private readonly projected = new Vector3();
  private readonly inView = new Vector3();

  constructor(
    private readonly scene: Scene,
    private readonly overlay: HTMLElement,
  ) {
    this.root = document.createElement("div");
    this.root.className = "objective";
    this.root.hidden = true;
    this.arrow = document.createElement("div");
    this.arrow.className = "objective__arrow";
    this.arrow.textContent = "▲";
    this.label = document.createElement("div");
    this.label.className = "objective__label";
    this.root.append(this.arrow, this.label);
    overlay.append(this.root);
  }

  /** `target`: el objetivo (o `null` si no hay); `from`: dónde está el jugador, para la distancia. */
  update(target: (Point & { name: string; y: number }) | null, from: Point): void {
    const camera = this.scene.activeCamera;
    if (!target || !camera) {
      this.root.hidden = true;
      return;
    }
    const engine = this.scene.getEngine();
    const width = engine.getRenderWidth();
    const height = engine.getRenderHeight();
    this.world.set(target.x, target.y, target.z);
    Vector3.ProjectToRef(
      this.world,
      Matrix.IdentityReadOnly,
      this.scene.getTransformMatrix(),
      camera.viewport.toGlobal(width, height),
      this.projected,
    );
    Vector3.TransformCoordinatesToRef(this.world, camera.getViewMatrix(), this.inView);
    // El canvas puede dibujarse a otra resolución que la de la página.
    const scaleX = this.overlay.clientWidth / width;
    const scaleY = this.overlay.clientHeight / height;
    const marker = edgeMarker(
      this.projected.x * scaleX,
      this.projected.y * scaleY,
      this.inView.z < 0,
      this.overlay.clientWidth,
      this.overlay.clientHeight,
    );
    this.root.hidden = marker === null;
    if (!marker) return;
    const distance = Math.round(Math.hypot(target.x - from.x, target.z - from.z));
    const text = `${target.name} · ${distance} m`;
    if (this.label.textContent !== text) this.label.textContent = text;
    this.root.style.transform = `translate(${marker.x}px, ${marker.y}px) translate(-50%, -50%)`;
    this.arrow.style.transform = `rotate(${marker.angle}rad)`;
  }
}
