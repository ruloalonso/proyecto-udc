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
  /** Presupuestos de los requisitos no funcionales (el panel F3 avisa si se superan). */
  budget: {
    /** NFR-01: tiempo máximo de tick del servidor, en ms. */
    tickMs: 10,
    /** NFR-03: bajada media por cliente, en KB/s. */
    downKBps: 50,
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
    health: 100,
  },
  combat: {
    /** Fuego automático sobre el objetivo (spec §4.2). */
    autoFire: {
      damage: 10,
      /** Alcance en metros. */
      range: 30,
      /** Segundos entre disparos. */
      interval: 0.8,
    },
    /** Semiángulo del cono frontal del soldado: solo se dispara a lo que tiene delante (±20°). */
    facingHalfAngle: (20 * Math.PI) / 180,
  },
  /** Habilidades 1–3 (spec §4.2). Tiempos en segundos y distancias en metros. */
  abilities: {
    /** Enfriamiento global entre las habilidades 1–3. */
    globalCooldown: 1,
    aimedShot: {
      damage: 35,
      range: 50,
      /** Tiempo de lanzamiento; moverse lo interrumpe. */
      castTime: 1.5,
      cooldown: 6,
    },
    grenade: {
      damage: 40,
      /** Radio de la explosión. */
      radius: 4,
      range: 20,
      /** Tiempo de vuelo hasta que explota. */
      fuseTime: 1,
      cooldown: 12,
    },
    stim: {
      heal: 30,
      /** Velocidad extra (0,2 = +20%). */
      speedBonus: 0.2,
      duration: 5,
      cooldown: 30,
    },
  },
  /** Centollo raso (spec §4.3). Tiempos en segundos y distancias en metros. */
  crab: {
    /** Radio de colisión (con los soldados y entre ellos). No más que `navmesh.agentRadius`. */
    radius: 0.5,
    /** Altura (solo visual). */
    height: 0.7,
    health: 30,
    /** Metros por segundo. */
    speed: 6,
    /** Aceleración en m/s²: cuánto tarda en arrancar, frenar y esquivar. */
    acceleration: 30,
    bite: {
      damage: 8,
      interval: 1,
      /** Distancia máxima entre centros para morder. */
      range: 1.5,
    },
    /** Distancia a la que un centollo ve a un soldado y va a por él; más lejos, avanza hacia la colonia. */
    aggroRange: 25,
    /** Atacantes cuerpo a cuerpo como mucho por objetivo: no caben más; el resto busca otro. */
    maxMeleeAttackers: 3,
  },
  /** Escupidor (spec §4.3): se para a distancia y escupe. Tiempos en segundos y distancias en metros. */
  spitter: {
    /** Radio de colisión. No más que `navmesh.agentRadius` (comparte navmesh con el raso). */
    radius: 0.5,
    /** Altura (solo visual). */
    height: 1.1,
    health: 60,
    /** Metros por segundo. */
    speed: 3.5,
    /** Aceleración en m/s². */
    acceleration: 20,
    /** Distancia a la que ve a un soldado y va a por él (prioriza soldados, sin tope de atacantes). */
    aggroRange: 25,
    /**
     * Se acerca hasta esta distancia (con línea de visión), se para y dispara. Solo vuelve a
     * moverse si el objetivo se le va más allá de `spit.range` o deja de verlo.
     */
    preferredRange: 14,
    spit: {
      damage: 15,
      interval: 2.5,
      /** Alcance del disparo y distancia máxima que recorre el escupitajo. */
      range: 18,
      /** Metros por segundo: va en línea recta hacia donde estaba el objetivo; moverse lo esquiva. */
      speed: 15,
      /** Radio del escupitajo (para chocar con los soldados). */
      radius: 0.25,
    },
  },
  dummy: {
    /**
     * Muñecos de prueba de H2 ("centollos de cartón"). Desactivados desde que hay centollos de
     * verdad; el servidor los pone en el mapa solo si está a `true`.
     */
    enabled: false,
    /** Tamaño (para dibujarlos y seleccionarlos con clic). */
    radius: 0.5,
    height: 1.6,
    health: 60,
    /** Segundos hasta que un muñeco abatido vuelve a aparecer. */
    respawnSeconds: 5,
  },
  targeting: {
    /**
     * Selección automática (E3-5): segundos que pasan, tras quedarse sin objetivo, hasta que se
     * elige solo el hostil más cercano de frente. Un poco de espera para que no se sienta robótico.
     */
    autoSelectDelay: 0.25,
    /** Distancia máxima a la que Tab busca objetivos, en metros (el alcance del disparo apuntado). */
    tabRange: 50,
    /** Semiángulo del cono de Tab alrededor de la dirección de la cámara (radianes). */
    tabHalfAngle: Math.PI / 3,
    /** Píxeles que puede moverse el ratón para que un clic izquierdo cuente como selección. */
    clickMaxDragPx: 5,
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
  /**
   * Comportamiento básico de los bots (E7-4). Es el que heredarán los compañeros del servidor
   * (E5-6). Distancias en metros y tiempos en segundos.
   */
  bot: {
    /** Distancia a la que un bot ve a un hostil y se pone a combatirlo. */
    engageRange: 35,
    /** Más cerca que esto retrocede, de cara al enemigo: no se mete en la masa. */
    keepAway: 8,
    /** Más lejos que esto (pero a la vista), se acerca. Entre medias, se queda. */
    approachRange: 24,
    /** Con esta vida o menos, usa el estimulante si está listo. */
    stimHp: 50,
    /** Hostiles que tiene que haber alrededor del punto para lanzar una granada. */
    grenadeCluster: 3,
    /** Margen, además del radio de la explosión, entre ella y el propio bot o un aliado. */
    grenadeSafety: 2,
    /** Sin hostiles a menos de esto, se queda quieto para el disparo apuntado. */
    aimedShotSafeRange: 12,
    /** Con escupidores cerca se mueve de lado para esquivar, cambiando de sentido cada tanto. */
    strafeSwitch: 1.5,
    /** Sin enemigos a la vista, patrulla puntos a esta distancia de la plataforma. */
    patrolRadius: 25,
    /** Si en este tiempo avanza menos de `stuckDistance`, está atascado y cambia de rumbo. */
    stuckSeconds: 1,
    stuckDistance: 0.5,
  },
  /**
   * Director de oleadas (E4-4, spec §4.4). Tiempos en segundos desde que empieza la partida;
   * ritmos en centollos por minuto. Puntos de partida: se afinan jugando.
   */
  director: {
    /** Calma al empezar (preparación) antes del primer centollo. */
    startDelay: 20,
    /** Despegues de lanzadera. Hasta H5 (E6-3) son simulados; el último abre la oleada final. */
    launches: [150, 300, 450, 600],
    /** Ritmo de fondo: `baseRate × (1 + growthPerMinute × minuto)`. Sin factor de jugadores. */
    baseRate: 40,
    growthPerMinute: 0.1,
    /** Empujón: los `pushSeconds` antes de cada despegue, el ritmo se multiplica por `pushFactor`. */
    pushSeconds: 40,
    pushFactor: 4,
    /** Valle de calma tras cada despegue (cada vez más corto); el ritmo × `valleyFactor`. */
    valleySeconds: [45, 35, 25],
    valleyFactor: 0.15,
    /** Tope de centollos vivos a la vez. En la oleada final aparecen sin parar hasta el tope. */
    maxAlive: 150,
    /** Proporción de escupidores: ninguno antes del primer despegue; luego sube hasta la final. */
    spitterRatioFrom: 0.1,
    spitterRatioTo: 0.3,
    /** Madrigueras activas al empezar; se abre una más en cada despegue y todas en la final. */
    initialBurrows: 2,
    /** Aviso antes de abrir una madriguera nueva. */
    burrowWarning: 5,
    /** Radio de una madriguera: una granada que explota dentro la tapona. */
    burrowRadius: 4,
    /** Tras taponar una madriguera, se abre otra a los tantos segundos (con su aviso). */
    plugReopen: 10,
  },
  /** Navmesh de los centollos y los colonos (E4-1), generada a partir de `map.json` en el servidor. */
  navmesh: {
    /** Margen respecto a los obstáculos, en metros. Debe ser ≥ el radio de cualquier agente que la use. */
    agentRadius: 0.5,
    /** Tamaño de celda de Recast, en metros: más pequeño es más preciso y tarda más en generarse. */
    cellSize: 0.25,
  },
  recruit: {
    /** Primer número de recluta. */
    firstNumber: 7_431_902,
  },
} as const;

export const TICK_MS = 1000 / GAME_CONFIG.net.tickRate;
export const TICK_SECONDS = 1 / GAME_CONFIG.net.tickRate;
