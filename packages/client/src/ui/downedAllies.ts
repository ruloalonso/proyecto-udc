import type { Point } from "@udc/shared";

/** Dónde está un aliado respecto a lo que mira el jugador. */
export interface Bearing {
  /** Radianes respecto a la dirección de la cámara: 0 delante, positivo a la derecha. */
  angle: number;
  distance: number;
}

/**
 * Dirección y distancia de un aliado derribado (E5-1) para la flecha del HUD. `viewer.yaw` es
 * hacia dónde mira la cámara, en la convención de la simulación (0 = +Z, adelante = (sin, cos)).
 */
export function bearingTo(viewer: Point & { yaw: number }, ally: Point): Bearing {
  const dx = ally.x - viewer.x;
  const dz = ally.z - viewer.z;
  const toAlly = Math.atan2(dx, dz);
  let angle = toAlly - viewer.yaw;
  angle = Math.atan2(Math.sin(angle), Math.cos(angle));
  return { angle, distance: Math.hypot(dx, dz) };
}

export interface DownedAllyView {
  name: string;
  bearing: Bearing;
  /** Segundos que le quedan, o `null` si no se sabe (se llegó con él ya derribado). */
  secondsLeft: number | null;
}

/**
 * "Aliados derribados" (E5-1, FR-13): una fila por aliado con una flecha hacia él, la distancia
 * y lo que le queda. Solo dibuja: los datos los da main.
 */
export class DownedAlliesPanel {
  private readonly root: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "downed-allies";
    this.root.hidden = true;
    parent.append(this.root);
  }

  update(allies: readonly DownedAllyView[]): void {
    this.root.hidden = allies.length === 0;
    if (allies.length === 0) return;
    const rows = allies.map((a) => {
      const row = document.createElement("div");
      row.className = "downed-allies__row";
      const arrow = document.createElement("span");
      arrow.className = "downed-allies__arrow";
      arrow.textContent = "▲";
      arrow.style.transform = `rotate(${a.bearing.angle}rad)`;
      const text = document.createElement("span");
      const left = a.secondsLeft === null ? "" : ` · ${Math.max(0, Math.ceil(a.secondsLeft))} s`;
      text.textContent = `${a.name} · ${Math.round(a.bearing.distance)} m${left}`;
      row.append(arrow, text);
      return row;
    });
    const title = document.createElement("div");
    title.className = "downed-allies__title";
    title.textContent = "Aliados derribados";
    this.root.replaceChildren(title, ...rows);
  }
}

/**
 * Pantalla de derribado propio: el mundo en gris y un texto con la cuenta atrás.
 */
export class DownedOverlay {
  private readonly root: HTMLElement;
  private readonly countdown: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "downed-overlay";
    this.root.hidden = true;
    const text = document.createElement("div");
    text.className = "downed-overlay__text";
    text.textContent =
      "Derribado. Arrástrese o dispare, recluta. Pero no las dos cosas: el Estado no paga horas extra.";
    this.countdown = document.createElement("div");
    this.countdown.className = "downed-overlay__countdown";
    this.root.append(text, this.countdown);
    parent.append(this.root);
  }

  /** `secondsLeft`: lo que le queda, o `null` si está en pie. */
  update(secondsLeft: number | null): void {
    this.root.hidden = secondsLeft === null;
    document.body.classList.toggle("is-downed", secondsLeft !== null);
    if (secondsLeft === null) return;
    const text = `${Math.max(0, Math.ceil(secondsLeft))} s`;
    if (this.countdown.textContent !== text) this.countdown.textContent = text;
  }
}
