/**
 * Recorridos de la vitrina (E7-9): cómo se mueve un modelo para ver cómo anda. Funciones puras
 * del tiempo: dónde está y hacia dónde mira a los `t` segundos, a `speed` m/s. Rumbo como la
 * simulación: yaw = 0 mira hacia +Z y delante es (sin yaw, cos yaw).
 */

export const MOVEMENTS = ["quieto", "linea", "circulo", "girar", "arranca"] as const;
export type Movement = (typeof MOVEMENTS)[number];

export const MOVEMENT_NAMES: Record<Movement, string> = {
  quieto: "Quieto",
  linea: "En línea (ida y vuelta)",
  circulo: "En círculo",
  girar: "Girando sin moverse",
  arranca: "Arranca y para",
};

export interface PathPose {
  x: number;
  z: number;
  yaw: number;
}

/** Largo del tramo en línea, en metros. */
export const LINE_LENGTH = 8;
/** Radio del círculo, en metros. */
export const CIRCLE_RADIUS = 3;
/** Radianes por segundo al girar sin moverse. */
export const TURN_RATE = Math.PI / 2;
/** Segundos andando y parado en «arranca y para». */
export const GO_SECONDS = 1.5;

export function poseAt(movement: Movement, t: number, speed: number): PathPose {
  switch (movement) {
    case "quieto":
      return { x: 0, z: 0, yaw: 0 };
    case "girar":
      return { x: 0, z: 0, yaw: t * TURN_RATE };
    case "circulo": {
      // En el sentido de las agujas del reloj visto desde arriba, mirando hacia donde va.
      const a = (t * speed) / CIRCLE_RADIUS;
      return {
        x: CIRCLE_RADIUS * Math.sin(a),
        z: CIRCLE_RADIUS * Math.cos(a) - CIRCLE_RADIUS,
        yaw: a + Math.PI / 2,
      };
    }
    case "linea": {
      // Ida hacia +Z y vuelta, dando media vuelta en cada extremo.
      const leg = LINE_LENGTH / speed;
      const k = Math.floor(t / leg);
      const along = (t - k * leg) * speed;
      const forward = k % 2 === 0;
      return {
        x: 0,
        z: (forward ? along : LINE_LENGTH - along) - LINE_LENGTH / 2,
        yaw: forward ? 0 : Math.PI,
      };
    }
    case "arranca": {
      // Anda GO_SECONDS, para GO_SECONDS; cada arrancada, en sentido contrario.
      const cycle = 2 * GO_SECONDS;
      const k = Math.floor(t / cycle);
      const inCycle = t - k * cycle;
      const along = Math.min(inCycle, GO_SECONDS) * speed;
      const forward = k % 2 === 0;
      const span = GO_SECONDS * speed;
      return {
        x: 0,
        z: (forward ? along : span - along) - span / 2,
        yaw: forward ? 0 : Math.PI,
      };
    }
  }
}
