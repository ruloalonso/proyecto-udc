import type { MatchPhase } from "@udc/shared";

/** "2:05" a partir de segundos (redondeando hacia arriba, nunca negativo). */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Lo que el letrero necesita saber de la partida. */
export interface PhaseInfo {
  phase: MatchPhase;
  /** Segundos hasta el final de la fase, o `null` si no tiene fin. */
  left: number | null;
  /** Próxima lanzadera (número y segundos hasta el despegue), si se sabe. */
  nextLaunch: { n: number; in: number } | null;
}

/**
 * Letrero de la fase (E6-1): cuenta atrás de la preparación, del próximo despegue y la oleada
 * final. Sin partida o con el resultado en pantalla, nada.
 */
export function phaseText({ phase, left, nextLaunch }: PhaseInfo): string | null {
  switch (phase) {
    case "prep":
      return `Despliegue. Los centollos llegan en ${clock(left ?? 0)}`;
    case "evacuation":
      return nextLaunch
        ? `Evacuación · lanzadera ${nextLaunch.n} en ${clock(nextLaunch.in)}`
        : "Evacuación";
    case "final":
      return "Oleada final · No quedan lanzaderas";
    case "waiting":
    case "result":
      return null;
  }
}

/**
 * Pantalla de resultado provisional (E6-1): el pelotón ha caído. El noticiario de E6-4 la
 * sustituirá; hasta el botón de E6-5, la siguiente partida empieza sola.
 */
export class ResultOverlay {
  private readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly next: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "result";
    this.root.hidden = true;
    const title = document.createElement("div");
    title.className = "result__title";
    title.textContent = "El pelotón ha caído";
    this.body = document.createElement("div");
    this.body.className = "result__body";
    this.next = document.createElement("div");
    this.next.className = "result__next";
    this.root.append(title, this.body, this.next);
    parent.append(this.root);
  }

  /** `survived`: segundos que resistió el pelotón. */
  show(survived: number): void {
    this.body.textContent =
      `Resistieron ${clock(survived)}. La colonia agradece su sacrificio; ` +
      "el Estado, su puntualidad. Los formularios de condolencia ya están impresos.";
    this.root.hidden = false;
  }

  /** Segundos hasta la siguiente partida. */
  update(left: number): void {
    const text = `Nuevo pelotón en ${Math.max(0, Math.ceil(left))} s.`;
    if (this.next.textContent !== text) this.next.textContent = text;
  }

  hide(): void {
    this.root.hidden = true;
  }

  get isShown(): boolean {
    return !this.root.hidden;
  }
}
