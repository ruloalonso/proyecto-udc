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
  /** Alguien le está rescatando (E5-2). */
  rescuing: boolean;
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
      if (a.rescuing) {
        const rescuing = document.createElement("span");
        rescuing.className = "downed-allies__rescuing";
        rescuing.textContent = "rescatando";
        row.append(rescuing);
      }
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
const DOWNED_TEXT =
  "Derribado. Arrástrese o dispare, recluta. Pero no las dos cosas: el Estado no paga horas extra.";
const RESCUED_TEXT = "Le están rescatando. Quieto, recluta: no estropee el trámite.";

export class DownedOverlay {
  private readonly root: HTMLElement;
  private readonly text: HTMLElement;
  private readonly countdown: HTMLElement;
  private readonly rescueBar: HTMLElement;
  private readonly rescueFill: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "downed-overlay";
    this.root.hidden = true;
    this.text = document.createElement("div");
    this.text.className = "downed-overlay__text";
    this.text.textContent = DOWNED_TEXT;
    this.countdown = document.createElement("div");
    this.countdown.className = "downed-overlay__countdown";
    // Barra del rescate (E5-2): se llena hasta levantarse.
    this.rescueBar = document.createElement("div");
    this.rescueBar.className = "downed-overlay__bar";
    this.rescueBar.hidden = true;
    this.rescueFill = document.createElement("div");
    this.rescueFill.className = "downed-overlay__bar-fill";
    this.rescueBar.append(this.rescueFill);
    this.root.append(this.text, this.countdown, this.rescueBar);
    parent.append(this.root);
  }

  /**
   * `secondsLeft`: lo que le queda, o `null` si está en pie. `rescued`: parte del rescate ya hecha
   * (0..1, E5-2), o `null` si nadie le rescata.
   */
  update(secondsLeft: number | null, rescued: number | null = null): void {
    this.root.hidden = secondsLeft === null;
    document.body.classList.toggle("is-downed", secondsLeft !== null);
    if (secondsLeft === null) return;
    const text = `${Math.max(0, Math.ceil(secondsLeft))} s`;
    if (this.countdown.textContent !== text) this.countdown.textContent = text;
    const message = rescued !== null ? RESCUED_TEXT : DOWNED_TEXT;
    if (this.text.textContent !== message) this.text.textContent = message;
    this.root.classList.toggle("downed-overlay--rescued", rescued !== null);
    this.rescueBar.hidden = rescued === null;
    if (rescued !== null) this.rescueFill.style.width = `${Math.min(1, rescued) * 100}%`;
  }
}

/** "Pulsa F para rescatar a …" junto a un aliado derribado (E5-2). */
export class RescueHint {
  private readonly root: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "rescue-hint";
    this.root.hidden = true;
    parent.append(this.root);
  }

  /** Nombre del aliado al que se puede rescatar, o `null` para ocultarlo. */
  update(name: string | null): void {
    this.root.hidden = name === null;
    if (name === null) return;
    const text = `Pulsa F para rescatar a ${name}`;
    if (this.root.textContent !== text) this.root.textContent = text;
  }
}
