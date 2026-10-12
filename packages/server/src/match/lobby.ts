import type { LobbyPlace } from "@udc/shared";

/** Un jugador conectado, para la sala de espera (E6-9). */
export interface Seat {
  place: LobbyPlace;
  ready: boolean;
  /** Orden de llegada: el anfitrión es quien entró primero. */
  order: number;
}

/** El anfitrión (E6-9): quien entró primero de los que siguen conectados. */
export function hostOf<T extends Seat>(seats: readonly T[]): T | null {
  let host: T | null = null;
  for (const s of seats) if (!host || s.order < host.order) host = s;
  return host;
}

/**
 * ¿Puede el anfitrión empezar? (E6-9) Sin nadie jugando ni mirando una partida, y con todos en
 * la sala y listos: quien sigue leyendo el noticiario cuenta como no listo (decidido así).
 */
export function canStart(seats: readonly Seat[]): boolean {
  return seats.length > 0 && seats.every((s) => s.place === "lobby" && s.ready);
}
