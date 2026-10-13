import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import type { Scene } from "@babylonjs/core/scene.js";
import type { Point } from "@udc/shared";

/** Margen entre la flecha y cada borde de la pantalla, en píxeles. */
export interface EdgeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Abajo, más: la barra de habilidades y la vida (E5-8: las flechas la tapaban). */
const EDGE_INSETS: EdgeInsets = { top: 48, right: 48, bottom: 160, left: 48 };

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
  margin: number | EdgeInsets = EDGE_INSETS,
): { x: number; y: number; angle: number } | null {
  const m =
    typeof margin === "number"
      ? { top: margin, right: margin, bottom: margin, left: margin }
      : margin;
  const minX = m.left;
  const maxX = width - m.right;
  const minY = m.top;
  const maxY = height - m.bottom;
  const inside = x >= minX && x <= maxX && y >= minY && y <= maxY;
  if (!behind && inside) return null;
  // La dirección, desde el centro de la pantalla.
  const cx = width / 2;
  const cy = height / 2;
  let dx = x - cx;
  let dy = y - cy;
  if (behind) {
    dx = -dx;
    dy = -dy;
  }
  if (dx === 0 && dy === 0) dy = 1;
  // Hasta el borde (menos su margen) en esa dirección.
  const scaleX = dx > 0 ? (maxX - cx) / dx : dx < 0 ? (minX - cx) / dx : Infinity;
  const scaleY = dy > 0 ? (maxY - cy) / dy : dy < 0 ? (minY - cy) / dy : Infinity;
  const scale = Math.min(scaleX, scaleY);
  return { x: cx + dx * scale, y: cy + dy * scale, angle: Math.atan2(dx, -dy) };
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Reparte etiquetas que se pisan (E5-8: dos derribados detrás caen en el mismo sitio del borde):
 * de arriba abajo, la que se superpone a una ya colocada sube encima de ella. Devuelve cuánto
 * subir cada una (en píxeles, 0 o negativo), en el orden de `boxes`.
 */
export function separateBoxes(boxes: readonly Box[], gap = 2): number[] {
  const order = boxes.map((_, i) => i).sort((a, b) => boxes[b]!.y - boxes[a]!.y);
  const placed: Box[] = [];
  const shifts = boxes.map(() => 0);
  for (const i of order) {
    const box = { ...boxes[i]! };
    for (
      let hit = placed.find((p) => overlaps(p, box));
      hit;
      hit = placed.find((p) => overlaps(p, box))
    ) {
      box.y = hit.y - box.h - gap;
    }
    placed.push(box);
    shifts[i] = box.y - boxes[i]!.y;
  }
  return shifts;
}

/**
 * Flecha en el borde de la pantalla hacia algo que no se ve, con su nombre y la distancia: el
 * edificio que se evacua (E6-2; a la vista ya lo marca la columna de luz) y, en rojo
 * (`variant: "downed"`), cada aliado derribado (E5-8; a la vista, el rombo sobre él).
 */
export class ObjectiveMarker {
  private readonly root: HTMLElement;
  private readonly arrow: HTMLElement;
  private readonly label: HTMLElement;
  private readonly world = new Vector3();
  private readonly projected = new Vector3();
  private readonly inView = new Vector3();
  /** Dónde ha quedado (centro), si se ve; para repartirlas si se pisan. */
  private at: { x: number; y: number } | null = null;

  constructor(
    private readonly scene: Scene,
    private readonly overlay: HTMLElement,
    variant?: "downed",
  ) {
    this.root = document.createElement("div");
    this.root.className = variant ? `objective objective--${variant}` : "objective";
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
    this.at = null;
    if (!marker) return;
    const distance = Math.round(Math.hypot(target.x - from.x, target.z - from.z));
    const text = `${target.name} · ${distance} m`;
    if (this.label.textContent !== text) this.label.textContent = text;
    // Que la etiqueta entera quede dentro de la pantalla (pegada a un lado se salía).
    const half = this.root.offsetWidth / 2;
    const x = Math.min(Math.max(marker.x, half + 4), this.overlay.clientWidth - half - 4);
    this.at = { x, y: marker.y };
    this.place(0);
    this.arrow.style.transform = `rotate(${marker.angle}rad)`;
  }

  /** Su caja en pantalla, si se ve. */
  box(): Box | null {
    if (!this.at) return null;
    const w = this.root.offsetWidth;
    const h = this.root.offsetHeight;
    return { x: this.at.x - w / 2, y: this.at.y - h / 2, w, h };
  }

  /** La mueve en vertical respecto a donde la dejó `update` (para que no se pise con otra). */
  place(dy: number): void {
    if (!this.at) return;
    const { x, y } = this.at;
    this.root.style.transform = `translate(${x}px, ${y + dy}px) translate(-50%, -50%)`;
  }

  /** Lo quita de la pantalla para siempre. */
  dispose(): void {
    this.root.remove();
  }
}
