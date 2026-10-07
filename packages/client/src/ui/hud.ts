export interface DebugInfo {
  fps: number;
  engine: string;
  rtt: number;
  serverTick: number;
  remotes: number;
  pending: number;
  correction: number;
  downKbps: number;
  x: number;
  z: number;
}

/** HUD mínimo del H1: nombre de recluta y panel de depuración (E7-1). */
export class Hud {
  private readonly root = document.getElementById("hud") as HTMLElement;
  private readonly debug = document.getElementById("debug") as HTMLElement;
  private lastDebugUpdate = 0;

  constructor(recruitName: string) {
    (document.getElementById("recruit") as HTMLElement).textContent = recruitName;
    this.root.hidden = false;
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
      `Otros        ${info.remotes} soldados`,
      `Pendientes   ${info.pending} entradas sin confirmar`,
      `Corrección   ${(info.correction * 100).toFixed(1)} cm`,
      `Bajada       ${info.downKbps.toFixed(2)} KB/s`,
      `Posición     ${info.x.toFixed(1)}, ${info.z.toFixed(1)}`,
    ].join("\n");
  }
}
