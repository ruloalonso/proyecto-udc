import { createWorld } from "bitecs";
import type { EntityKind } from "@udc/shared";

/*
 * Componentes de bitECS (E4-2, E4-3). Cada componente es un almacén por columnas indexado por el
 * id de entidad de bitECS (`eid`), que no es el id de red: ese va en `NetId`.
 *
 * Viven aquí los centollos (rasos y escupidores), los escupitajos y los colonos (E6-2); los
 * soldados siguen en un `Map` (son pocos y su estado va ligado a la predicción).
 */

/** Modo de la IA de un centollo (spec §4.3). */
export const CrabMode = {
  /** Sin objetivo: avanza hacia la colonia. */
  Advance: 0,
  /** Persigue a su objetivo. */
  Chase: 1,
  /** Escupidor: parado a distancia, disparando a su objetivo. */
  Hold: 2,
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
      /** Tipo de centollo: raso o escupidor. */
      Enemy: { kind: [] as EntityKind[] },
      /** IA de un centollo. */
      Crab: {
        mode: [] as CrabMode[],
        /** Id de red del soldado objetivo, o `NO_TARGET`. */
        target: [] as number[],
        /** Primer tick en el que puede volver a atacar (morder o escupir). */
        nextAttackTick: [] as number[],
        /** Destino pedido al crowd (para no volver a pedirlo en cada tick). */
        goalX: [] as number[],
        goalZ: [] as number[],
      },
      /** Colono (E6-2): camina hacia su sitio en la plataforma y corre si hay centollos cerca. */
      Colonist: {
        /** Tick hasta el que dura el pánico. */
        panicUntil: [] as number[],
        /** 1 si está corriendo (para no tocar la velocidad del agente en cada tick). */
        running: [] as number[],
        /** Su sitio en la plataforma. */
        goalX: [] as number[],
        goalZ: [] as number[],
      },
      /** Escupitajo: va en línea recta a velocidad constante hasta chocar o agotar su alcance. */
      Spit: {
        /** Dirección (unitaria). */
        dx: [] as number[],
        dz: [] as number[],
        /** Metros recorridos. */
        travelled: [] as number[],
        /** Id de red del escupidor que lo lanzó. */
        src: [] as number[],
      },
    },
  });
}

export type EcsWorld = ReturnType<typeof createEcsWorld>;
