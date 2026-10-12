import { GAME_CONFIG } from "@udc/shared";

const CFG = GAME_CONFIG.match.climax;
const SLOW_MS = CFG.seconds * 1000;
const FADE_FROM_MS = (CFG.seconds - CFG.fadeSeconds) * 1000;

export interface ClimaxFocus {
  x: number;
  z: number;
  yaw: number;
}

/**
 * Clímax de la última muerte (E6-4, spec §3.1), solo en el cliente: el mundo se dibuja a cámara
 * lenta (el reloj con el que se interpola avanza más despacio y se va quedando atrás) mientras la
 * cámara gira despacio alrededor del último soldado. Antes de acabar empieza el fundido al
 * noticiario; al acabar, el reloj vuelve de golpe al presente, ya tapado.
 */
export class Climax {
  private startedAt: number | null = null;
  focus: ClimaxFocus = { x: 0, z: 0, yaw: 0 };

  /** Empieza en `now` (milisegundos) sobre el último soldado. */
  begin(now: number, focus: ClimaxFocus): void {
    this.startedAt = now;
    this.focus = focus;
  }

  /** Partida nueva (o se entra con el resultado ya en pantalla). */
  stop(): void {
    this.startedAt = null;
  }

  private elapsed(now: number): number | null {
    return this.startedAt === null ? null : now - this.startedAt;
  }

  /** En cámara lenta: la cámara mira al último soldado. */
  isSlow(now: number): boolean {
    const t = this.elapsed(now);
    return t !== null && t < SLOW_MS;
  }

  /** Ya toca el noticiario: sin clímax, al momento; con él, al empezar el fundido. */
  newsreelDue(now: number): boolean {
    const t = this.elapsed(now);
    return t === null || t >= FADE_FROM_MS;
  }

  /** Reloj con el que se dibuja el mundo (milisegundos): más lento durante la cámara lenta. */
  clock(now: number): number {
    const t = this.elapsed(now);
    if (t === null || t >= SLOW_MS) return now;
    return this.startedAt! + t * CFG.timeScale;
  }

  /** Hacia dónde mira la cámara: gira despacio alrededor del soldado. */
  cameraYaw(now: number): number {
    const t = Math.min(this.elapsed(now) ?? 0, SLOW_MS);
    return this.focus.yaw + (CFG.orbit * t) / SLOW_MS;
  }
}
