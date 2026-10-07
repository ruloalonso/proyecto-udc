import { GAME_CONFIG } from "@udc/shared";

export interface DebugInfo {
  fps: number;
  engine: string;
  rtt: number;
  serverTick: number;
  /** Tiempo de tick del servidor en el último segundo (media y máximo), si ya ha llegado. */
  tickMs: number | null;
  tickMaxMs: number | null;
  /** Soldados en la partida, incluido el propio. */
  soldiers: number;
  dummies: number;
  pending: number;
  correction: number;
  downKBps: number;
  upKBps: number;
  hp: number;
  x: number;
  z: number;
}

export interface DebugLine {
  text: string;
  /** Supera un presupuesto de los requisitos no funcionales (se pinta en rojo). */
  bad: boolean;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Líneas del panel de depuración (E7-1). */
export function debugLines(info: DebugInfo): DebugLine[] {
  const { budget } = GAME_CONFIG;
  const server =
    info.tickMs === null || info.tickMaxMs === null
      ? { text: "Servidor     esperando datos…", bad: false }
      : {
          text: `Servidor     ${info.tickMs.toFixed(2)} ms/tick (máx ${info.tickMaxMs.toFixed(2)})`,
          bad: info.tickMaxMs > budget.tickMs,
        };
  const line = (text: string, bad = false): DebugLine => ({ text, bad });
  return [
    line(`FPS          ${info.fps.toFixed(0)} (${info.engine})`),
    line(`Latencia     ${info.rtt.toFixed(0)} ms ida y vuelta`),
    line(`Tick         ${info.serverTick}`),
    server,
    line(
      `Entidades    ${plural(info.soldiers, "soldado", "soldados")}, ` +
        plural(info.dummies, "muñeco", "muñecos"),
    ),
    line(`Pendientes   ${info.pending} entradas sin confirmar`),
    line(`Corrección   ${(info.correction * 100).toFixed(1)} cm`),
    line(
      `Red          ↓ ${info.downKBps.toFixed(2)} KB/s · ↑ ${info.upKBps.toFixed(2)} KB/s`,
      info.downKBps > budget.downKBps,
    ),
    line(`Vida         ${info.hp}`),
    line(`Posición     ${info.x.toFixed(1)}, ${info.z.toFixed(1)}`),
  ];
}
