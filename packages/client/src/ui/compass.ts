import type { Point } from "@udc/shared";

/**
 * Brújula (E2-7): una tira arriba con los puntos cardinales que gira con la cámara, para saber
 * dónde está el «norte» del que hablan los avisos, con marcas del edificio que se evacua y de las
 * madrigueras. El norte es +Z (la madriguera «norte»); el este, +X. Rumbos en la convención de la
 * simulación: 0 hacia +Z, positivo hacia +X (a la derecha mirando al norte).
 */

/** Media tira: lo que se ve a cada lado de hacia dónde mira la cámara. */
export const COMPASS_HALF_SPAN = Math.PI / 2;

/** Puntos cardinales, en español. */
export const CARDINALS: readonly { label: string; bearing: number }[] = [
  { label: "N", bearing: 0 },
  { label: "NE", bearing: Math.PI / 4 },
  { label: "E", bearing: Math.PI / 2 },
  { label: "SE", bearing: (3 * Math.PI) / 4 },
  { label: "S", bearing: Math.PI },
  { label: "SO", bearing: (-3 * Math.PI) / 4 },
  { label: "O", bearing: -Math.PI / 2 },
  { label: "NO", bearing: -Math.PI / 4 },
];

/** Rumbo de `from` a `to`. */
export const bearingOf = (from: Point, to: Point): number =>
  Math.atan2(to.x - from.x, to.z - from.z);

/**
 * Dónde cae un rumbo en la tira mirando hacia `yaw`: `x` de −1 (borde izquierdo) a 1 (derecho);
 * fuera de la tira (`outside`), pegado al borde por el que hay que girar.
 */
export function stripPosition(
  bearing: number,
  yaw: number,
  half = COMPASS_HALF_SPAN,
): { x: number; outside: boolean } {
  const delta = Math.atan2(Math.sin(bearing - yaw), Math.cos(bearing - yaw));
  const x = delta / half;
  return { x: Math.max(-1, Math.min(1, x)), outside: Math.abs(x) > 1 };
}

/** Una marca de la brújula. */
export interface CompassMark {
  key: string;
  label: string;
  at: Point;
  kind: "building" | "warning" | "open";
}

/**
 * Coloca un elemento en la tira: en el centro, centrado; hacia los bordes, cada vez más alineado
 * hacia dentro, para que no se corte («cio 4»).
 */
function place(el: HTMLElement, x: number): void {
  el.style.left = `${50 + x * 50}%`;
  el.style.transform = `translateX(${-50 * (1 + x)}%)`;
}

/** Rayitas cada tantos grados (los cardinales, cada 45°, llevan letra). */
const TICK_STEP = Math.PI / 12;

/** La tira en el HUD. */
export class Compass {
  private readonly root: HTMLElement;
  private readonly ticks: { el: HTMLElement; bearing: number }[] = [];
  private readonly marks = new Map<string, HTMLElement>();

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "compass";
    const center = document.createElement("div");
    center.className = "compass__center";
    this.root.append(center);
    for (let i = 0; i < 24; i++) {
      const bearing = i * TICK_STEP;
      const cardinal = CARDINALS.find(
        (c) =>
          Math.abs(Math.atan2(Math.sin(c.bearing - bearing), Math.cos(c.bearing - bearing))) < 1e-6,
      );
      const el = document.createElement("div");
      el.className = cardinal ? "compass__tick compass__tick--cardinal" : "compass__tick";
      el.textContent = cardinal ? cardinal.label : "";
      this.root.append(el);
      this.ticks.push({ el, bearing });
    }
    parent.prepend(this.root);
  }

  /** `yaw`: hacia dónde mira la cámara; `from`: dónde está (para el rumbo de las marcas). */
  update(yaw: number, from: Point, marks: readonly CompassMark[]): void {
    for (const t of this.ticks) {
      const p = stripPosition(t.bearing, yaw);
      t.el.hidden = p.outside;
      if (!p.outside) place(t.el, p.x);
    }
    const seen = new Set<string>();
    for (const mark of marks) {
      seen.add(mark.key);
      let el = this.marks.get(mark.key);
      if (!el) {
        el = document.createElement("div");
        this.root.append(el);
        this.marks.set(mark.key, el);
      }
      const p = stripPosition(bearingOf(from, mark.at), yaw);
      const side = p.outside ? (p.x < 0 ? "‹ " : "") : "";
      const after = p.outside && p.x > 0 ? " ›" : "";
      const text = `${side}${mark.label}${after}`;
      if (el.textContent !== text) el.textContent = text;
      el.className = `compass__mark compass__mark--${mark.kind}${p.outside ? " compass__mark--outside" : ""}`;
      place(el, p.x);
    }
    for (const [key, el] of this.marks) {
      if (seen.has(key)) continue;
      el.remove();
      this.marks.delete(key);
    }
  }
}
