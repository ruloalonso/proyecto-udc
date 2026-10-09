import { GAME_CONFIG, type ShuttleMessage } from "@udc/shared";
import { clock } from "./match.js";

/**
 * Texto del panel de la lanzadera (#72): la posada con los de a bordo, o cuánto le falta a la que
 * viene. Tras la última, nada.
 */
export function shuttleText(
  s: Pick<ShuttleMessage, "docked" | "trip" | "aboard">,
  arrivesIn: number | null,
): string | null {
  if (s.trip === null) return null;
  if (s.docked) return `Lanzadera ${s.trip} · ${s.aboard} a bordo`;
  return arrivesIn === null ? null : `Lanzadera ${s.trip} en camino · ${clock(arrivesIn)}`;
}

/** Aviso al destruir una lanzadera. */
export function destroyedText(n: number, aboard: number): string {
  return aboard === 0
    ? `¡Han destruido la lanzadera ${n}! El comandante solicita otra.`
    : `¡Han destruido la lanzadera ${n} con ${aboard} colonos a bordo! El comandante solicita otra.`;
}

/** Panel de la lanzadera bajo el letrero de fase: texto y barra de vida (solo posada). */
export class ShuttleHud {
  private readonly root: HTMLElement;
  private readonly text: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly fill: HTMLElement;

  constructor(after: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "shuttle-hud";
    this.root.hidden = true;
    this.text = document.createElement("div");
    this.text.className = "shuttle-hud__text";
    this.bar = document.createElement("div");
    this.bar.className = "shuttle-hud__bar";
    this.fill = document.createElement("div");
    this.fill.className = "shuttle-hud__fill";
    this.bar.append(this.fill);
    this.root.append(this.text, this.bar);
    after.after(this.root);
  }

  /** `shown`: hay partida en juego. `arrivesIn`: segundos hasta que se posa la que viene. */
  update(s: ShuttleMessage | null, shown: boolean, arrivesIn: number | null): void {
    const text = s && shown ? shuttleText(s, arrivesIn) : null;
    this.root.hidden = text === null;
    if (text === null || !s) return;
    if (this.text.textContent !== text) this.text.textContent = text;
    this.bar.hidden = !s.docked;
    const fraction = Math.max(0, s.hp / GAME_CONFIG.shuttles.health);
    this.fill.style.width = `${fraction * 100}%`;
    this.root.classList.toggle("shuttle-hud--danger", s.docked && fraction < 0.35);
  }
}
