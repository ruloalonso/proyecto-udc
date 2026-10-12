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
  const x = rawStripPosition(bearing, yaw, half);
  return { x: Math.max(-1, Math.min(1, x)), outside: Math.abs(x) > 1 };
}

/** Como `stripPosition`, sin pegar al borde: de −2 a 2 (justo detrás). */
const rawStripPosition = (bearing: number, yaw: number, half = COMPASS_HALF_SPAN): number =>
  Math.atan2(Math.sin(bearing - yaw), Math.cos(bearing - yaw)) / half;

/** Hueco mínimo entre dos marcas de la tira, en píxeles. */
const MARK_GAP = 6;

/**
 * Reparte las marcas por la tira sin que se pisen. `raw` es su posición sin pegar al borde y
 * `width`, su ancho; devuelve el borde izquierdo de cada una, en píxeles, en el mismo orden.
 * Cada una va donde le toca y, si pisa a la anterior, se aparta hacia la derecha; las que se
 * salen por la derecha empujan a las demás hacia dentro. En un borde, la que queda más por
 * detrás va pegada a él, y las demás, a su lado hacia dentro. Si no caben todas, se pisan.
 */
export function spreadMarks(
  marks: readonly { raw: number; width: number }[],
  stripWidth: number,
  gap = MARK_GAP,
): number[] {
  const order = marks.map((_, i) => i).sort((a, b) => marks[a]!.raw - marks[b]!.raw);
  // Donde le toca a cada una: en el centro, centrada; hacia los bordes, alineada hacia dentro.
  const left = marks.map(
    (m) => ((1 + Math.max(-1, Math.min(1, m.raw))) / 2) * (stripWidth - m.width),
  );
  for (let k = 1; k < order.length; k++) {
    const prev = order[k - 1]!;
    const i = order[k]!;
    left[i] = Math.max(left[i]!, left[prev]! + marks[prev]!.width + gap);
  }
  for (let k = order.length - 1; k >= 0; k--) {
    const i = order[k]!;
    const next = order[k + 1];
    const limit =
      next === undefined ? stripWidth - marks[i]!.width : left[next]! - gap - marks[i]!.width;
    left[i] = Math.max(0, Math.min(left[i]!, limit));
  }
  return left;
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
    const placed: { el: HTMLElement; raw: number }[] = [];
    for (const mark of marks) {
      seen.add(mark.key);
      let el = this.marks.get(mark.key);
      if (!el) {
        el = document.createElement("div");
        this.root.append(el);
        this.marks.set(mark.key, el);
      }
      const bearing = bearingOf(from, mark.at);
      const p = stripPosition(bearing, yaw);
      const side = p.outside ? (p.x < 0 ? "‹ " : "") : "";
      const after = p.outside && p.x > 0 ? " ›" : "";
      const text = `${side}${mark.label}${after}`;
      if (el.textContent !== text) el.textContent = text;
      el.className = `compass__mark compass__mark--${mark.kind}${p.outside ? " compass__mark--outside" : ""}`;
      placed.push({ el, raw: rawStripPosition(bearing, yaw) });
    }
    // Sin pisarse: dos detrás por el mismo lado irían al mismo borde.
    const lefts = spreadMarks(
      placed.map((m) => ({ raw: m.raw, width: m.el.offsetWidth })),
      this.root.clientWidth,
    );
    placed.forEach(({ el }, i) => {
      el.style.left = `${lefts[i]}px`;
    });
    for (const [key, el] of this.marks) {
      if (seen.has(key)) continue;
      el.remove();
      this.marks.delete(key);
    }
  }
}
