import { createWorld } from "bitecs";

/*
 * Componentes de bitECS (E4-2). Cada componente es un almacén por columnas indexado por el id
 * de entidad de bitECS (`eid`), que no es el id de red: ese va en `NetId`.
 *
 * De momento solo los centollos viven aquí; los soldados siguen en un `Map` (son pocos y su
 * estado va ligado a la predicción). Escupidores, proyectiles y colonos entrarán igual.
 */

/** Modo de la IA del centollo raso (spec §4.3). */
export const CrabMode = {
  /** Sin objetivo: avanza hacia la colonia. */
  Advance: 0,
  /** Persigue a su objetivo. */
  Chase: 1,
} as const;
export type CrabMode = (typeof CrabMode)[keyof typeof CrabMode];

/** Sin objetivo (los ids de red empiezan en 1). */
export const NO_TARGET = 0;

export function createEcsWorld() {
  return createWorld({
    components: {
      /** Id de red de la entidad (el que ven los clientes). */
      NetId: { id: [] as number[] },
      /** Posición en el plano y orientación (yaw = 0 mira hacia +Z). */
      Position: { x: [] as number[], z: [] as number[], yaw: [] as number[] },
      Health: { hp: [] as number[] },
      /** Índice del agente en el `Crowd` de DetourCrowd. */
      Agent: { index: [] as number[] },
      /** IA del centollo raso. */
      Crab: {
        mode: [] as CrabMode[],
        /** Id de red del soldado objetivo, o `NO_TARGET`. */
        target: [] as number[],
        /** Primer tick en el que puede volver a morder. */
        nextBiteTick: [] as number[],
        /** Destino pedido al crowd (para no volver a pedirlo en cada tick). */
        goalX: [] as number[],
        goalZ: [] as number[],
      },
    },
  });
}

export type EcsWorld = ReturnType<typeof createEcsWorld>;
