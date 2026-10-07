export interface DebugInfo {
  fps: number;
  engine: string;
  rtt: number;
  serverTick: number;
  remotes: number;
  pending: number;
  correction: number;
  downKbps: number;
  hp: number;
  x: number;
  z: number;
}

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

  toggleDebug(): void {
    this.debug.hidden = !this.debug.hidden;
  }

  updateDebug(info: DebugInfo): void {
    const now = performance.now();
    if (this.debug.hidden || now - this.lastDebugUpdate < 250) return;
    this.lastDebugUpdate = now;
    this.debug.textContent = [
      `FPS          ${info.fps.toFixed(0)} (${info.engine})`,
      `Latencia     ${info.rtt.toFixed(0)} ms ida y vuelta`,
      `Tick         ${info.serverTick}`,
      `Remotas      ${info.remotes} entidades`,
      `Pendientes   ${info.pending} entradas sin confirmar`,
      `Corrección   ${(info.correction * 100).toFixed(1)} cm`,
      `Bajada       ${info.downKbps.toFixed(2)} KB/s`,
      `Vida         ${info.hp}`,
      `Posición     ${info.x.toFixed(1)}, ${info.z.toFixed(1)}`,
    ].join("\n");
  }
}
