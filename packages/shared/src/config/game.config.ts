/**
 * Valores de diseño y técnicos del Prototipo 0.
 * Todo lo ajustable vive aquí (NFR-06).
 */
export const GAME_CONFIG = {
  net: {
    /** Ticks de simulación por segundo en el servidor. */
    tickRate: 20,
    /** Retardo de interpolación de entidades remotas, en ticks. */
    interpolationDelayTicks: 2,
    /** Entradas máximas que el servidor procesa por jugador y tick. */
    maxInputsPerTick: 3,
    /** Entradas máximas en cola por jugador antes de descartar las más antiguas. */
    maxQueuedInputs: 10,
    /** Precisión de las posiciones enviadas (1 unidad = 1 cm). */
    positionScale: 100,
    /** Precisión de la orientación enviada (milirradianes). */
    yawScale: 1000,
  },
  match: {
    maxPlayers: 8,
  },
  soldier: {
    radius: 0.4,
    height: 1.8,
    /** Metros por segundo hacia delante. */
    speed: 5,
    /** Multiplicador al moverse hacia atrás o en lateral. */
    backwardAndStrafeFactor: 0.7,
    /** Radianes por segundo al girar con teclado. */
    turnSpeed: Math.PI,
  },
  recruit: {
    /** Primer número de recluta. */
    firstNumber: 7_431_902,
  },
} as const;

export const TICK_MS = 1000 / GAME_CONFIG.net.tickRate;
export const TICK_SECONDS = 1 / GAME_CONFIG.net.tickRate;
