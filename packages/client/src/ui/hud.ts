import { debugLines, type DebugInfo } from "./debugPanel.js";

/** HUD mínimo del H1: nombre de recluta y panel de depuración (E7-1). */
export class Hud {
  private readonly root = document.getElementById("hud") as HTMLElement;
  private readonly debug = document.getElementById("debug") as HTMLElement;
  private readonly castbar = document.getElementById("castbar") as HTMLElement;
  private readonly castFill = this.castbar.querySelector(".hud__castbar-fill") as HTMLElement;
  private readonly castLabel = this.castbar.querySelector(".hud__castbar-label") as HTMLElement;
  private cast: { start: number; duration: number } | null = null;
  private castHideAt = 0;
  private lastDebugUpdate = 0;

  constructor(recruitName: string) {
    (document.getElementById("recruit") as HTMLElement).textContent = recruitName;
    this.root.hidden = false;
  }

  /** Empieza la barra de lanzamiento (disparo apuntado). */
  startCast(label: string, durationMs: number): void {
    this.cast = { start: performance.now(), duration: durationMs };
    this.castLabel.textContent = label;
    this.castbar.classList.remove("hud__castbar--failed");
    this.castbar.hidden = false;
  }

  /** Termina la barra: llena si se completó, en rojo un momento si se interrumpió. */
  endCast(ok: boolean): void {
    this.cast = null;
    if (ok) {
      this.castFill.style.width = "100%";
    } else {
      this.castLabel.textContent = "Interrumpido";
      this.castbar.classList.add("hud__castbar--failed");
    }
    this.castHideAt = performance.now() + 300;
  }

  /** Llamar cada frame. */
  update(): void {
    const now = performance.now();
    if (this.cast) {
      const t = Math.min(1, (now - this.cast.start) / this.cast.duration);
      this.castFill.style.width = `${t * 100}%`;
    } else if (!this.castbar.hidden && now >= this.castHideAt) {
      this.castbar.hidden = true;
    }
  }

  /** ¿Está abierto el panel de depuración (F3)? */
  get debugVisible(): boolean {
    return !this.debug.hidden;
  }

  toggleDebug(): void {
    this.debug.hidden = !this.debug.hidden;
  }

  updateDebug(info: DebugInfo): void {
    const now = performance.now();
    if (this.debug.hidden || now - this.lastDebugUpdate < 250) return;
    this.lastDebugUpdate = now;
    this.debug.replaceChildren(
      ...debugLines(info).map(({ text, bad }) => {
        const span = document.createElement("span");
        span.textContent = `${text}\n`;
        if (bad) span.className = "hud__debug-bad";
        return span;
      }),
    );
  }
}
