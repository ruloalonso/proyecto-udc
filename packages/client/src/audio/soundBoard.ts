import { GAME_CONFIG, type Point } from "@udc/shared";
import { distanceGain, SoundGate, SOUNDS, type SoundId } from "./sounds.js";

/** Preferencias de sonido en el navegador: no afectan a la partida. */
const STORAGE_KEY = "udc.sound";

/**
 * Reproductor de los efectos (E6-7) con la Web Audio API: volumen general y silencio, que
 * recuerda el navegador. Hasta `start()` (tras un gesto del jugador: el navegador no deja sonar
 * antes) no suena nada; si el navegador no puede decodificar un archivo, ese sonido se calla.
 */
export class SoundBoard {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly buffers = new Map<SoundId, AudioBuffer>();
  private readonly gate = new SoundGate();
  private volumeLevel: number = GAME_CONFIG.audio.volume;
  private mutedState = false;

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as {
        volume?: number;
        muted?: boolean;
      } | null;
      if (typeof saved?.volume === "number") this.volumeLevel = clamp01(saved.volume);
      if (typeof saved?.muted === "boolean") this.mutedState = saved.muted;
    } catch {
      // Sin almacenamiento (ventana privada, bloqueado): los valores de serie.
    }
  }

  /** Arranca el audio. Llamarlo desde un gesto del jugador (al alistarse). */
  start(): void {
    if (this.ctx) return;
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.applyVolume();
      void this.load(this.ctx);
    } catch {
      this.ctx = null;
    }
  }

  private async load(ctx: AudioContext): Promise<void> {
    await Promise.all(
      (Object.keys(SOUNDS) as SoundId[]).map(async (id) => {
        try {
          const response = await fetch(`${import.meta.env.BASE_URL}sounds/${SOUNDS[id].file}`);
          this.buffers.set(id, await ctx.decodeAudioData(await response.arrayBuffer()));
        } catch {
          // Ese sonido no suena; el resto sí.
        }
      }),
    );
  }

  /**
   * Suena `id`. Con `at` y `listener` (dónde mira la cámara), más bajo cuanto más lejos.
   */
  play(id: SoundId, at?: Point, listener?: Point): void {
    const ctx = this.ctx;
    const buffer = this.buffers.get(id);
    if (!ctx || !this.master || !buffer || this.mutedState) return;
    const def = SOUNDS[id];
    const gain =
      def.volume *
      (at && listener
        ? distanceGain(Math.hypot(at.x - listener.x, at.z - listener.z), def.minGain)
        : 1);
    if (gain <= 0.01 || !this.gate.allow(id, performance.now())) return;
    if (ctx.state === "suspended") void ctx.resume();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const node = ctx.createGain();
    node.gain.value = gain;
    source.connect(node).connect(this.master);
    source.start();
  }

  get volume(): number {
    return this.volumeLevel;
  }

  get muted(): boolean {
    return this.mutedState;
  }

  setVolume(volume: number): void {
    this.volumeLevel = clamp01(volume);
    this.applyVolume();
    this.save();
  }

  /** Silencia o vuelve a dar sonido (tecla M). Devuelve si queda silenciado. */
  toggleMute(): boolean {
    this.mutedState = !this.mutedState;
    this.applyVolume();
    this.save();
    return this.mutedState;
  }

  private applyVolume(): void {
    if (this.master) this.master.gain.value = this.mutedState ? 0 : this.volumeLevel;
  }

  private save(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ volume: this.volumeLevel, muted: this.mutedState }),
      );
    } catch {
      // Sin almacenamiento: no se recuerda, sin más.
    }
  }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
