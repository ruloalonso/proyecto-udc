/**
 * Lo que dice la flecha roja hacia un derribado (E5-8), antes de la distancia: su nombre y los
 * segundos que le quedan, o que le están rescatando.
 */
export function downedMarkerName(
  name: string,
  secondsLeft: number | null,
  rescuing: boolean,
): string {
  if (rescuing) return `${name} · rescatando`;
  return secondsLeft === null ? name : `${name} · ${Math.max(0, Math.ceil(secondsLeft))} s`;
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
