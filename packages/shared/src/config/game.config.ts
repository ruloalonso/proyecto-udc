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
  camera: {
    /** Altura del punto al que mira la cámara (cabeza del soldado), en metros. */
    targetHeight: 1.6,
    /** Radianes por píxel de ratón al girar u orbitar. */
    mouseSensitivity: 0.005,
    /** Inclinación inicial y límites (radianes desde la vertical). */
    pitch: 1.15,
    minPitch: 0.35,
    maxPitch: 1.5,
    /** Distancia inicial y límites del zoom, en metros. */
    distance: 9,
    minDistance: 3,
    maxDistance: 25,
    /** Metros de zoom por unidad de rueda del ratón. */
    zoomPerWheelUnit: 0.01,
    /** Fracción del desfase de cámara que se conserva por tick al moverse (vuelta a la espalda). */
    recenterFactor: 0.85,
    /** Separación entre la cámara y el obstáculo que la tapa, en metros. */
    collisionMargin: 0.3,
    /** Distancia mínima a la que la colisión puede acercar la cámara, en metros. */
    collisionMinDistance: 0.5,
    /** Rapidez (1/s) con la que la cámara vuelve a alejarse tras dejar atrás un obstáculo. */
    easeOutRate: 6,
  },
  recruit: {
    /** Primer número de recluta. */
    firstNumber: 7_431_902,
  },
} as const;

export const TICK_MS = 1000 / GAME_CONFIG.net.tickRate;
export const TICK_SECONDS = 1 / GAME_CONFIG.net.tickRate;
