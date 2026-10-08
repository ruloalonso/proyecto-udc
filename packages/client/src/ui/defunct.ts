import type { DeathCause } from "@udc/shared";

/** La causa, en el tono del certificado. */
export const CAUSE_TEXT: Record<DeathCause, string> = {
  time: "desangrado mientras esperaba un rescate que no llegó",
  finish: "rematado por un centollo con mejores modales que usted",
  grenade: "metralla aliada, debidamente documentada",
};

/**
 * Pantalla de defunción (E5-4): un certificado satírico breve antes del relevo. Si no queda
 * ningún bot en pie, se queda en espectador hasta que empiece otro pelotón.
 */
export class DefunctOverlay {
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly body: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "defunct";
    this.root.hidden = true;
    this.title = document.createElement("div");
    this.title.className = "defunct__title";
    this.body = document.createElement("div");
    this.body.className = "defunct__body";
    this.root.append(this.title, this.body);
    parent.append(this.root);
  }

  /** Certificado de defunción de `name`. */
  show(name: string, cause: DeathCause): void {
    this.title.textContent = "Certificado de defunción";
    this.body.textContent =
      `${name}: ${CAUSE_TEXT[cause]}. Su sacrificio no será olvidado (hasta el próximo parte). ` +
      "El Estado le asigna otro cuerpo; no se encariñe.";
    this.root.classList.remove("defunct--spectator");
    this.root.hidden = false;
  }

  /** Sin relevos: espectador hasta el próximo pelotón. */
  showSpectator(): void {
    this.title.textContent = "Sin cuerpos de repuesto";
    this.body.textContent =
      "No queda ningún recluta en pie al que relevar. Observe y aprenda: el próximo pelotón será usted.";
    this.root.classList.add("defunct--spectator");
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  /** ¿Está de espectador (esperando a un pelotón nuevo)? */
  get isSpectator(): boolean {
    return !this.root.hidden && this.root.classList.contains("defunct--spectator");
  }
}
