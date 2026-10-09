import { DIRECTOR_PHASE_NAMES, GAME_CONFIG, type DirectorPhase } from "@udc/shared";

/** Lo que el panel muestra del director de oleadas (E4-4). */
export interface DirectorInfo {
  phase: DirectorPhase;
  /** Lanzaderas que han despegado. */
  launches: number;
  /** Segundos hasta el próximo despegue, o `null` si no quedan (o no ha empezado). */
  nextLaunchIn: number | null;
  /** Madrigueras abiertas y en total. */
  open: number;
  total: number;
}

/** "empujón · lanzadera 2 en 0:42 · madrigueras 3/6" (para afinar los números jugando). */
export function directorText(d: DirectorInfo | null): string {
  if (!d) return "sin datos";
  const parts = [DIRECTOR_PHASE_NAMES[d.phase]];
  if (d.nextLaunchIn !== null) {
    const s = Math.max(0, Math.ceil(d.nextLaunchIn));
    parts.push(
      `lanzadera ${d.launches + 1} en ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`,
    );
  }
  parts.push(`madrigueras ${d.open}/${d.total}`);
  return parts.join(" · ");
}

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
  crabs: number;
  spitters: number;
  colonists: number;
  director: DirectorInfo | null;
  /** Ayuda de los comandos de administración, si el servidor los acepta (E7-3). */
  adminHelp: string | null;
  invulnerable: boolean;
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
        `${plural(info.crabs, "raso", "rasos")}, ` +
        `${plural(info.spitters, "escupidor", "escupidores")}, ` +
        `${plural(info.colonists, "colono", "colonos")}, ` +
        plural(info.dummies, "muñeco", "muñecos"),
    ),
    line(`Director     ${directorText(info.director)}`),
    line(`Pendientes   ${info.pending} entradas sin confirmar`),
    line(`Corrección   ${(info.correction * 100).toFixed(1)} cm`),
    line(
      `Red          ↓ ${info.downKBps.toFixed(2)} KB/s · ↑ ${info.upKBps.toFixed(2)} KB/s`,
      info.downKBps > budget.downKBps,
    ),
    line(`Vida         ${info.hp}${info.invulnerable ? " (invulnerable)" : ""}`),
    line(`Posición     ${info.x.toFixed(1)}, ${info.z.toFixed(1)}`),
    ...(info.adminHelp ? [line(`Admin        ${info.adminHelp}`)] : []),
  ];
}
