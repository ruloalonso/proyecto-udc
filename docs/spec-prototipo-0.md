# Proyecto UDC — Prototipo 0: "La Retirada"

> Spec del primer jugable. Deriva del documento de diseño (GDD) y se limita a lo que hay que construir ahora.
> Todo lo que no aparece aquí está **fuera de alcance**, aunque esté en el GDD.

---

## 1. Objetivo

Construir una partida multijugador corta, en el navegador, en la que varios soldados humanos defienden la evacuación de una colonia frente a oleadas de centollos.

El prototipo tiene que responder a dos preguntas:

1. **¿Es viable técnicamente?** Servidor autoritativo, 3D en navegador, varios jugadores y cientos de enemigos a la vez, con buena sensación de juego.
2. **¿Es divertido?** El combate tab-target contra centollos, el derribado y el rescate como centro de la partida, y la muerte sin vuelta atrás en partidas cortas que se repiten.

Si la respuesta a la segunda pregunta es no, se itera aquí antes de construir nada más.

**Criterio de éxito:** 4–5 personas juegan tres partidas seguidas y quieren jugar otra.

---

## 2. Alcance

### 2.1 Dentro

- Una zona de superficie: colonia humana con plataforma de lanzaderas.
- Un pelotón de **8 soldados** por partida: hasta 8 jugadores conectados desde el navegador, y bots compañeros en los puestos libres.
- Personaje en 3D (cápsula provisional) con cámara en tercera persona estilo WoW.
- Combate tab-target con selección automática: fuego automático + 3 habilidades.
- Dos tipos de centollo con IA, en oleadas en dientes de sierra.
- Colonos NPC que salen de los edificios que activa el pelotón, caminan hacia la plataforma y pueden morir.
- Derribado, rescate por aliados, muerte sin reaparición, pantalla de propaganda y relevo en un bot o vista de espectador.
- Un sargento NPC solo de voz/texto.
- Pantalla final con el resultado.
- Herramientas de depuración y bots de carga.

### 2.2 Fuera

Naves, espacio, transiciones, mapa galáctico, persistencia, cuentas y login, creación de personaje, envejecimiento, tiempo galáctico, economía, inventario, órdenes de escuadra, cadena de mando, política, psiónicos, chat, sonido elaborado, arte final.

Aplazado (no cancelado; entra en prototipos posteriores):

- **Equipamiento:** el recluta sale con su fusil estándar, sin inventario ni botín. La pérdida de lo que llevas encima al morir, el botín recogible y la captura e intercambio de prisioneros entran cuando haya equipo que perder.
- **Mando jugable:** los 8 soldados son rasos iguales; el sargento es atrezo. Los rangos y el sistema de mando son de otro prototipo.
- **Órdenes desde la vista cenital** (marcar enemigos, dirigir al pelotón): enlaza con el panel de mando del juego grande.
- **Pedir ayuda estando derribado:** sin sonido ni marcadores no comunica nada; entra cuando haya ese canal.
- **Bogavante** (tercer tipo de centollo, el rompemuros): entra cuando el bloqueo de soldados esté probado.

---

## 3. Experiencia de juego

### 3.1 Flujo de una partida

1. **Entrada.** El jugador abre la URL, escribe un apodo y entra en la sala. Se le asigna un nombre de recluta: _"Recluta nº 7.431.902"_. El pelotón es siempre de 8: los puestos que no ocupan humanos los ocupan bots. Quien llega con la partida empezada ocupa un bot en pie; si no queda ninguno, entra como espectador (§3.2) hasta la siguiente partida.
2. **Preparación (30 s).** El pelotón aparece junto a la plataforma. Se puede mover y ver el mapa. El sargento anuncia la misión.
3. **Evacuación (~10 min).** Un edificio se **activa** cuando un soldado se acerca (§4.5) y suelta a sus colonos por grupos hacia la plataforma hasta vaciarse. El pelotón decide qué edificios activa y en qué orden, pero las lanzaderas despegan a su hora con los colonos que hayan llegado: un edificio activado tarde son colonos que no llegan a ninguna nave. Los centollos atacan desde las madrigueras en dientes de sierra, con los picos en los despegues (§4.4).
4. **Última lanzadera.** Despega con los últimos colonos. **No hay sitio para soldados.** Los centollos llegan en una oleada final sin fin.
5. **Final.** Cuando cae el último soldado del pelotón: **cámara lenta de 2–3 s** sobre él, frase final del sargento (la aniquilación narrada como gloria del Estado) y fundido al **noticiario de propaganda** con el resultado. Si el pelotón cae antes de la última lanzadera, la partida termina ahí y los colonos que quedan se pierden. No hay tiempo máximo: la oleada final acaba siempre con todos.

> Decisión de diseño: **los soldados nunca sobreviven**, sin evacuación heroica excepcional. Es coherente con el prólogo del GDD (§10.1) y con el tono: la primera partida enseña la regla del juego (vas a morir, eres reemplazable, importa a cuánta gente salvas). La puntuación es **del pelotón**: cuántos colonos se salvan entre todos, sin marcador individual. Para que morir no frustre, el noticiario tiene que hacer pesar de verdad los colonos salvados y distinguir con claridad una masacre de una evacuación heroica.

### 3.2 Morir dentro de la partida

- **Sin reaparición ni refuerzos.** Cada soldado muerto es un fusil menos **para siempre**: la sangría del pelotón es la curva de tensión, y el rescate es el centro de la partida.
- Al llegar a 0 de vida, el soldado queda **derribado** durante 30 s. Derribado puede **arrastrarse muy despacio o disparar con fuego lento, nunca las dos cosas a la vez**, y no usa habilidades.
- Un aliado puede **rescatarlo** pulsando F una vez a menos de 2 m: tarda **5 s**, con el rescatador quieto (si se mueve, recibe daño o usa una habilidad, se corta). Mientras tanto, el derribado no puede moverse (aunque se estuviera arrastrando, se detiene). Vuelve con un 40% de vida.
- No se puede **empezar** a rescatar a alguien al que están rematando: primero hay que matar al centollo. Mientras alguien rescata, el centollo que llega ataca al rescatador (presa quieta y expuesta), no al derribado.
- Un centollo raso **remata** a un derribado en **5 s** (no al instante): da tiempo a que un compañero lo mate o a que el propio derribado le dispare.
- Si nadie lo rescata a tiempo, un centollo lo remata o le alcanza una granada aliada, **muere**.
- **Al morir**, tras una pantalla breve de defunción satírica:
  1. Si queda algún **bot en pie** en el pelotón, el jugador pasa a controlarlo y sigue jugando.
  2. Si no, pasa a una **vista cenital fija** sobre el mapa, de espectador: cámara alta mirando al plano, sin seguir a nadie ni colisionar.
  3. Desde la cenital puede **elegir a un compañero vivo** y la cámara le sigue por encima del hombro; puede volver a la cenital.

### 3.3 Controles

| Acción                            | Control                                 |
| --------------------------------- | --------------------------------------- |
| Moverse                           | W A S D                                 |
| Desplazamiento lateral            | Q / E                                   |
| Girar cámara y personaje          | Botón derecho + ratón                   |
| Orbitar cámara                    | Botón izquierdo + ratón                 |
| Zoom                              | Rueda                                   |
| Siguiente objetivo                | Tab (opcional)                          |
| Seleccionar objetivo              | Clic izquierdo sobre la entidad         |
| Habilidades                       | 1, 2, 3                                 |
| Rescatar                          | F (una vez, junto al derribado)         |
| Espectador: seguir a un compañero | Clic sobre él (Esc vuelve a la cenital) |
| Panel de depuración               | F3                                      |

La selección es **automática** (§4.2): Tab y clic sirven para elegir a propósito, no hace falta usarlos continuamente. Derribado, moverse es arrastrarse y estar quieto deja disparar con fuego lento.

---

## 4. Diseño de juego

> Todos los valores viven en `packages/shared/src/config/game.config.ts` y se ajustarán constantemente.

### 4.1 Soldado

| Parámetro        | Valor inicial                                                             |
| ---------------- | ------------------------------------------------------------------------- |
| Vida             | 100                                                                       |
| Velocidad        | 5 m/s (lateral y atrás: 70%)                                              |
| Tiempo derribado | 30 s                                                                      |
| Derribado        | Se arrastra muy despacio o dispara con fuego lento, no las dos cosas      |
| Rescate          | F y 5 s quieto, a ≤ 2 m; el derribado no se mueve; vuelve con 40% de vida |

Sin reaparición (§3.2). La velocidad de arrastre y la cadencia del derribado se fijan en `game.config.ts` al implementarlo.

### 4.2 Habilidades

| #   | Habilidad            | Tipo                         | Efecto                                      | Alcance | Lanzamiento                      | Enfriamiento         |
| --- | -------------------- | ---------------------------- | ------------------------------------------- | ------- | -------------------------------- | -------------------- |
| —   | **Fuego automático** | Automático sobre el objetivo | 10 de daño                                  | 30 m    | —                                | 0,8 s entre disparos |
| 1   | **Disparo apuntado** | Objetivo                     | 35 de daño                                  | 50 m    | 1,5 s (se interrumpe al moverse) | 6 s                  |
| 2   | **Granada**          | Zona en el suelo             | 40 de daño en 4 m de radio, tras 1 s        | 20 m    | Instantánea                      | 12 s                 |
| 3   | **Estimulante**      | Propio                       | +30 de vida y +20% de velocidad durante 5 s | —       | Instantánea                      | 30 s                 |

- **Enfriamiento global** de 1 s entre habilidades 1–3.
- Ataques que requieren **línea de visión** contra obstáculos del mapa.
- El fuego automático se activa al tener un objetivo hostil vivo dentro de alcance, delante del soldado (±20°) y con línea de visión. El disparo apuntado también exige estar de cara. El ángulo del cono se calibra con el enjambre en H3. El cono del propio soldado se dibuja en el suelo, con el alcance del fuego automático y el del disparo apuntado (prueba de H3).
- **Selección automática:** si el soldado no tiene objetivo o el suyo muere, tras un breve retardo (~0,25 s, para que no se sienta robótico) se selecciona solo el hostil **más cercano dentro del cono y del alcance, con línea de visión**. Un objetivo elegido a mano (clic o Tab) se respeta hasta que muere. Uno elegido por la selección automática se respeta mientras se le pueda disparar; si lleva ese mismo retardo sin poder (se ha salido del cono o del alcance, o está tapado) y hay otro de frente, se cambia. Seleccionar con clic o Tab cambia el objetivo al momento; cuando ese muere, vuelve la selección automática. La decide el servidor.
- **Fuego amigo:** la granada daña también a los soldados, quien la lanza incluido; a un derribado lo mata. El fuego automático y el disparo apuntado atraviesan a los aliados sin dañarlos.
- **La granada tapona madrigueras:** si explota sobre una, deja de producir centollos y el director abre otra (§4.4). Granada para el grupo que tienes encima o para cerrar un frente.

### 4.3 Centollos

| Tipo              | Vida | Velocidad | Ataque                                                                             | Comportamiento                                                                             |
| ----------------- | ---- | --------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Centollo raso** | 30   | 6 m/s     | Cuerpo a cuerpo, 8 de daño cada 1 s, a ≤ 1,5 m                                     | En masa. Prioriza colonos; muerde al soldado que le tapa el paso. Remata derribados en 5 s |
| **Escupidor**     | 60   | 3,5 m/s   | Proyectil, 15 de daño cada 2,5 s, a ≤ 18 m (viaja a 15 m/s; esquivable moviéndose) | Se detiene a ~14 m con línea de visión y dispara. Prioriza soldados                        |

**Carácter del enjambre:** depredadores hambrientos, no estrategas. Prefieren la presa fácil (colonos indefensos) al soldado acorazado, pero no planean flanqueos: van hacia lo que quieren por el camino más corto. Si un soldado les tapa el paso, se paran a morderlo para abrirse camino, así que una línea de soldados frena de verdad. El desbordamiento por los flancos sale de la presión de la masa (los de atrás empujan y rebosan hacia los huecos), no de una táctica.

**Estados de IA:** aparecer → avanzar hacia la colonia → seleccionar objetivo (el más cercano según prioridad) → perseguir → atacar → (raso) rematar derribado.

**Tope de 3 atacantes cuerpo a cuerpo** por objetivo: no caben más alrededor y el resto busca otro objetivo. Los escupidores no tienen tope.

### 4.4 Director de oleadas

- **Carga fija**, calibrada para un pelotón de 8 (siempre son 8, con bots; §3.1). No se escala por número de jugadores: sin reaparición, la misma presión sobre un pelotón que mengua es la curva de tensión.
- **Dientes de sierra:** la intensidad sube de fondo, pero a empujones: empujón fuerte → valle de calma → empujón mayor → valle más corto. En los valles se rescata, se cura y se recoloca la línea.
- Los **picos coinciden con los despegues de lanzaderas**: el momento más duro es cuando una nave está embarcando.
- Ritmo de fondo: `centollos_por_minuto = base × (1 + crecimiento × minuto)`. Valores actuales (afinados con bots, ver `docs/decisiones.md`): base 40, crecimiento 0,1 y empujón × 4. Duraciones de empujones y valles y centollos por pico, en `game.config.ts`; se afinan jugando.
- **Escupidores:** las primeras oleadas son **solo rasos**. El primer escupidor entra con el **primer despegue** (~2,5 min) y a partir de ahí su proporción sube hasta el 30% del final. El momento de entrada es una perilla de `game.config.ts`.
- **Madrigueras por tandas:** 6 en los bordes del mapa, pero no se usan todas a la vez. Pocas al principio (1–2 frentes), más según sube la intensidad y las 6 en la oleada final. Se activan las que amenazan las **rutas de los colonos** activas hacia la plataforma (el enjambre brota donde puede cortarle el paso a su comida).
- **Aviso** unos segundos antes de abrir una madriguera nueva (temblor, sonido o grito del sargento), para dar tiempo a recolocarse.
- **Taponar:** una granada que explota sobre una madriguera la tapona. ~**10 s** después se abre otra, elegida entre las que amenazan las rutas de los colonos (no al azar), con aviso. El número de madrigueras activas **nunca baja**: el enjambre no se puede secar ni la misión ganar; taponar compra unos segundos de calma en un frente, no terreno.
- Tope de centollos vivos simultáneos: **150**.
- **Oleada final:** sin piedad, aparición continua al tope desde las 6 madrigueras hasta que no quede ningún soldado vivo.

> **Hasta H5** no hay colonos ni lanzaderas. En H3 las rutas (edificio → plataforma), con las madrigueras que amenaza cada una, van como datos en `map.json` y cuentan todas como activas; el calendario de despegues va en `game.config.ts`. Desde E6-2 cuentan las rutas de los edificios activados (todas mientras no haya ninguno); desde E6-3, los despegues son los de las lanzaderas de verdad (`shuttles.launches`).

### 4.5 Colonos y lanzaderas

- **200 colonos** en total, repartidos entre **4 edificios** (~50 en cada uno si es a partes iguales), cada uno con un número finito.
- Un edificio se **activa** cuando un soldado se acerca a menos de cierta distancia (`game.config.ts`). Es por **proximidad pura, sin botón**, y funciona como interruptor: el soldado no necesita quedarse. Se acepta el riesgo de activarlo sin querer al pasar cerca; si molesta jugando, se añade aviso o botón.
- Activado, suelta colonos en grupos de 10–20 hasta **vaciarse**; no se cierra por tiempo. Activar un edificio enciende su ruta hacia la plataforma y, con ella, las madrigueras que la amenazan (§4.4).
- **Información:** de lejos no se sabe cuántos colonos hay dentro; al acercarse o activarlo se ve cuántos quedan (contador sobre el edificio).
- Caminan por la navmesh hasta la plataforma a 3 m/s. Vida 50 (más que el daño de una granada, que hiere a todo el mundo: una granada aliada los deja malheridos, no los mata). No se defienden ni planifican rutas. **Tienen miedo:** con centollos cerca entran en pánico y corren más rápido.
- **4 lanzaderas** a intervalos de ~2,5 min, a su hora, pase lo que pase. Cada una embarca a los colonos que haya en la plataforma al despegar. La última, al final de la evacuación.
- Colonos que llegan tarde esperan a la siguiente; después de la última, quedan abandonados.

### 4.6 Mapa

- Superficie plana de **~200 × 200 m** (y = 0).
- Plataforma de lanzaderas en el centro-norte; 4 edificios de colonos repartidos; obstáculos (cajas, muros, contenedores) para dar cobertura y bloquear la línea de visión; 6 madrigueras en los bordes.
- Definido en un archivo de datos (`map.json`): obstáculos como cajas orientadas, puntos de interés y madrigueras. La navmesh se genera a partir de esos datos.

### 4.7 Bots compañeros

- Los puestos del pelotón que no ocupan humanos los ocupan **soldados controlados por el servidor**: la misma entidad soldado, con la entrada generada por el servidor en cada tick en lugar de llegar por la red. Cuando un humano releva a un bot, su conexión pasa a controlar esa entidad.
- Tienen que ser **buenos compañeros**: al principio jugarán pocas personas y la experiencia de 1 humano + 7 bots tiene que ser buena.
- Por fases: en **H3**, los bots headless de E7-4 tienen un comportamiento básico (se mueven, van a por el más cercano, disparan, no se suicidan), suficiente para la prueba de carga. En **H4**, ese comportamiento pasa a los soldados del servidor (E5-6). Los buenos compañeros (colocarse, cubrir flancos, priorizar escupidores, rescatar) llegan con el combate afinado.

### 4.8 Sargento

- NPC **solo de voz/texto**, sin mecánica. Estilo _La chaqueta metálica_, pero satírico: firme y duro, con órdenes absurdas o imposibles dichas con toda la seriedad, y narrando el desastre como una gloria del Estado.
- Habla en: inicio de partida, muerte de un recluta, despegue de lanzadera, primer escupidor, aviso de madriguera, oleada final, última muerte y resultado.
- Ejemplos del registro: _"El alto mando, en su infinita sabiduría, ha decidido que sois perfectamente prescindibles. ¡Sentíos honrados!"_; _"Defender esa posición es matemáticamente imposible, así que es vuestro deber sagrado hacerlo igualmente."_
- Los textos los escribe Raúl; el código deja el sistema de mensajes y textos provisionales (en `client/src/texts/sargento.json`, con su nombre: provisionalmente, Sargento Recio).

---

## 5. Requisitos funcionales

| ID    | Requisito                                                                                                                  |
| ----- | -------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | Un jugador entra en una partida abriendo una URL y escribiendo un apodo                                                    |
| FR-02 | El pelotón es siempre de 8: hasta 8 jugadores y bots en los puestos libres; quien llega tarde ocupa un bot en pie (§3.1)   |
| FR-03 | Cada cliente ve a los demás jugadores, centollos, colonos y proyectiles en tiempo real                                     |
| FR-04 | El movimiento propio responde de inmediato (predicción en cliente) y el servidor tiene la última palabra                   |
| FR-05 | El objetivo se selecciona solo (§4.2) y el jugador puede cambiarlo con Tab o clic; usa las habilidades de §4.2             |
| FR-06 | El servidor resuelve todo el combate: alcance, línea de visión, daño, enfriamientos                                        |
| FR-07 | Los centollos se mueven por la navmesh, evitan chocar entre sí, no atraviesan a los soldados y siguen §4.3                 |
| FR-08 | El director genera oleadas según §4.4                                                                                      |
| FR-09 | Los colonos y las lanzaderas siguen §4.5                                                                                   |
| FR-10 | Derribado, rescate, muerte sin reaparición, relevo en un bot y espectador según §3.2                                       |
| FR-11 | La partida sigue las fases de §3.1 y termina con la pantalla de resultado                                                  |
| FR-12 | Al terminar, los jugadores pueden empezar una nueva partida sin recargar                                                   |
| FR-13 | El HUD muestra vida, objetivo, barra de habilidades con enfriamientos, aliados derribados, temporizador y colonos salvados |
| FR-14 | Números de daño flotantes y señal visual al recibir daño                                                                   |
| FR-15 | Los bots compañeros completan el pelotón según §4.7                                                                        |
| FR-16 | El sargento comenta la partida según §4.8                                                                                  |

---

## 6. Requisitos no funcionales

| ID     | Requisito                                                                                                             |
| ------ | --------------------------------------------------------------------------------------------------------------------- |
| NFR-01 | Servidor a **20 ticks/s**; cada tick, con 8 jugadores y 150 centollos, por debajo de **10 ms**                        |
| NFR-02 | Cliente a **60 fps** en un portátil de gama media con GPU integrada, con 150 centollos en pantalla (arte provisional) |
| NFR-03 | Ancho de banda de bajada por cliente **< 50 KB/s** de media                                                           |
| NFR-04 | El juego se siente bien hasta **150 ms** de latencia de ida y vuelta                                                  |
| NFR-05 | Funciona en las últimas versiones de Chrome, Firefox y Safari; WebGPU si está disponible, WebGL2 si no                |
| NFR-06 | Todos los valores de diseño en un único archivo de configuración compartido                                           |
| NFR-07 | Arranque en local con un solo comando (`pnpm dev`)                                                                    |

NFR-01 se comprueba con `pnpm loadtest` (E7-5) como **p99 del tiempo de CPU del tick**: el tiempo de reloj, en una máquina compartida con los bots, incluye esperas que no son del servidor (ver `docs/decisiones.md`).

---

## 7. Arquitectura

### 7.1 Monorepo

```
udc/
├── packages/
│   ├── shared/          # Tipos, protocolo, configuración, lógica común
│   │   └── src/
│   │       ├── config/game.config.ts
│   │       ├── protocol/          # Definición de mensajes
│   │       ├── sim/               # Movimiento y colisiones (compartido para predicción)
│   │       └── map/map.json
│   ├── server/          # Simulación autoritativa
│   │   └── src/
│   │       ├── net/               # WebSocket, sesiones
│   │       ├── ecs/               # Componentes y sistemas (bitECS)
│   │       ├── ai/                # Navmesh, centollos, director
│   │       └── match/             # Fases, colonos, lanzaderas
│   ├── client/          # Babylon.js + HUD
│   │   └── src/
│   │       ├── net/               # Conexión, interpolación, predicción
│   │       ├── render/            # Escena, cámara, instancias
│   │       ├── input/
│   │       └── ui/                # HUD en HTML/CSS
│   └── bots/            # Clientes headless para pruebas de carga
├── pnpm-workspace.yaml
└── package.json
```

### 7.2 Stack

| Pieza         | Elección                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------- |
| Lenguaje      | TypeScript estricto en todo el monorepo                                                             |
| Gestor        | pnpm workspaces                                                                                     |
| Servidor      | Node LTS, `ws` (uWebSockets.js si hace falta rendimiento), ejecución en desarrollo con `tsx`        |
| ECS           | bitECS                                                                                              |
| Navegación    | recast-navigation-js (Recast/Detour en WASM), con **DetourCrowd** para la evitación entre centollos |
| Serialización | MessagePack (`@msgpack/msgpack`)                                                                    |
| Cliente       | Vite + Babylon.js (WebGPU con fallback a WebGL2)                                                    |
| HUD           | HTML/CSS sobre el canvas, sin framework al principio                                                |
| Tests         | Vitest                                                                                              |

### 7.3 Modelo de red

- **Servidor autoritativo** a 20 Hz.
- **Cliente → servidor:** intenciones. Entrada de movimiento por tick con número de secuencia; selección de objetivo; uso de habilidad; rescate.
- **Servidor → cliente:** **snapshot** por tick con el estado de las entidades (posición cuantizada, orientación, vida, estado) y una lista de **eventos** (daño, derribo, muerte, habilidad lanzada, fase de partida, lanzadera, aviso de madriguera, mensaje del sargento).
- **Movimiento propio:** predicción en cliente con la misma función de movimiento que el servidor (`shared/sim`) y reconciliación con la última entrada confirmada. Al relevar a un bot, la predicción arranca desde el estado de esa entidad.
- **Resto de entidades:** interpolación con un búfer de ~100 ms.
- **Optimización inicial:** enviar solo entidades que hayan cambiado (delta respecto al último snapshot confirmado). En una zona de 200 m no hace falta AOI todavía.

### 7.4 Mensajes (borrador)

| Dirección | Mensaje    | Contenido                                                                                   |
| --------- | ---------- | ------------------------------------------------------------------------------------------- |
| C → S     | `join`     | apodo                                                                                       |
| C → S     | `input`    | seq, dirección de movimiento, orientación y, si se usa, habilidad (id, objetivo o posición) |
| C → S     | `target`   | id de entidad (o nulo)                                                                      |
| C → S     | `revive`   | id del aliado (inicio / cancelación)                                                        |
| C → S     | `ping`     | marca de tiempo                                                                             |
| S → C     | `welcome`  | id del jugador, nombre de recluta, configuración, mapa                                      |
| S → C     | `snapshot` | tick, última entrada confirmada, entidades cambiadas, entidades eliminadas                  |
| S → C     | `events`   | lista de eventos del tick                                                                   |
| S → C     | `match`    | fase, temporizador, colonos salvados, lanzaderas                                            |
| S → C     | `pong`     | marca de tiempo                                                                             |

### 7.5 Simulación

- **Mundo plano**: posiciones en 2D (x, z); la altura es cosmética.
- **Colisiones de jugadores:** círculo contra cajas orientadas del mapa. Los soldados no colisionan entre sí, como en WoW: con latencia, el cliente no puede predecir ese choque de forma exacta (ver `docs/decisiones.md`).
- **Soldados y centollos chocan:** los centollos no atraviesan a los soldados ni al revés. Los centollos solo los simula el servidor, así que el cliente no predice este choque: al avanzar contra un centollo habrá pequeñas correcciones. Medirlas en H3 con latencia simulada; si molestan, el choque solo frena a los centollos.
- **Línea de visión:** segmento contra las cajas del mapa.
- **Centollos y colonos:** agentes de DetourCrowd sobre la navmesh.
- **Proyectiles del escupidor:** entidades simples con velocidad constante, colisión contra jugadores y obstáculos.

---

## 8. Épicas e historias

> Formato: **historia** — criterios de aceptación.

### E0. Base del proyecto

- **E0-1 Monorepo** — `pnpm install` y `pnpm dev` arrancan servidor y cliente; TypeScript estricto; lint y formato configurados.
- **E0-2 CI** — En cada push: compilación, lint y tests.
- **E0-3 Configuración compartida** — `game.config.ts` importable desde servidor y cliente; cambiar un valor no requiere tocar código.

### E1. Red y mundo

- **E1-1 Conexión** — Un cliente se conecta, envía `join` y recibe `welcome`.
- **E1-2 Bucle del servidor** — Tick fijo a 20 Hz con medición del tiempo de cada tick.
- **E1-3 Snapshots** — El servidor envía las entidades cambiadas; el cliente mantiene el estado del mundo.
- **E1-4 Interpolación** — Las entidades remotas se mueven con suavidad con un búfer de ~100 ms.
- **E1-5 Predicción y reconciliación** — El movimiento propio es inmediato; con 150 ms de latencia simulada no hay saltos visibles en condiciones normales.
- **E1-6 Multijugador básico** — Tres navegadores conectados se ven moverse entre sí.

### E2. Cliente 3D

- **E2-1 Escena** — El mapa de `map.json` se renderiza con suelo, obstáculos, edificios, plataforma y madrigueras.
- **E2-2 Entidades** — Jugadores, centollos y colonos como cápsulas o primitivas de colores distintos, con **instancing** para centollos.
- **E2-3 Cámara estilo WoW** — Controles de §3.3; la cámara no atraviesa obstáculos.
- **E2-4 Selección** — Tab cicla objetivos hostiles cercanos en el campo de visión; clic selecciona; el objetivo se resalta.
- **E2-5 Nombres de los jugadores** — Sobre cada soldado que controla un jugador se ve el apodo con el que entró; sobre los bots, nada. El apodo acompaña al jugador al relevar a un bot. Se ve a través de las paredes, a tamaño constante, y no sobre el propio personaje. (Añadida en H5, oct 2026.)

### E3. Combate

- **E3-1 Fuego automático** — Con objetivo válido, el servidor aplica daño según §4.2; el cliente lo muestra.
- **E3-2 Habilidades** — Disparo apuntado, granada y estimulante según §4.2, con enfriamientos y enfriamiento global. Taponar madrigueras con la granada se hace con el director (E4-4).
- **E3-3 Línea de visión** — Sin visión no se puede disparar ni lanzar habilidades de objetivo.
- **E3-4 HUD de combate** — Vida, marco del objetivo, barra de habilidades con enfriamientos, números de daño.
- **E3-5 Selección automática** — Según §4.2: sin objetivo o al morir el actual, se selecciona el hostil más cercano dentro del cono; respeta el objetivo elegido a mano y el automático mientras se le pueda disparar; clic y Tab lo cambian al momento; retardo en `game.config.ts`. Contra 150 centollos no hace falta pulsar Tab para seguir disparando.
- **E3-6 Fuego amigo de la granada** — La explosión daña a los soldados según §4.2 (a un derribado lo mata, cuando exista en H4); el fuego automático y el disparo apuntado no dañan aliados.

### E4. Centollos

- **E4-1 Navmesh** — Generada a partir de `map.json` al arrancar el servidor.
- **E4-2 Centollo raso** — Comportamiento y valores de §4.3: prefiere colonos, no atraviesa a los soldados y muerde al que le tapa el paso; con muchos, desborda por los flancos; como mucho 3 atacantes cuerpo a cuerpo por objetivo. 150 agentes simultáneos sin superar NFR-01.
- **E4-3 Escupidor** — Comportamiento, proyectil esquivable y valores de §4.3. No aparece hasta el primer despegue (§4.4).
- **E4-4 Director** — Según §4.4: carga fija para 8, dientes de sierra con los picos en los despegues, madrigueras por tandas según las rutas de los colonos y con aviso, escupidores desde el primer despegue, taponado con la granada (nunca bajan las madrigueras activas), tope de 150 y oleada final. Hasta H5, rutas y despegues simulados por configuración.

### E5. Vida y muerte

- **E5-1 Derribado** — A 0 de vida el soldado queda derribado 30 s: se arrastra muy despacio o dispara con fuego lento, nunca las dos cosas a la vez, y no usa habilidades (§3.2). Los aliados lo ven marcado en el HUD con su dirección.
- **E5-2 Rescate** — Según §3.2: F una vez a ≤ 2 m y 5 s con el rescatador quieto; se corta si el rescatador se mueve, recibe daño o usa una habilidad; el derribado queda inmóvil. No se puede empezar mientras rematan al derribado, y los centollos que llegan atacan al rescatador.
- **E5-3 Muerte** — Por tiempo, por remate de un centollo raso (5 s; matarlo antes lo salva) o por la granada de un aliado.
- **E5-4 Defunción y relevo** — Pantalla satírica breve; el jugador pasa a controlar un bot en pie del pelotón y, si no queda ninguno, a la vista de espectador (E5-5). Sin reaparición.
- **E5-5 Espectador** — Vista cenital fija sobre el mapa; elegir a un compañero vivo para seguirle por encima del hombro y volver a la cenital (§3.2, §3.3).
- **E5-6 Compañeros bot** — El servidor completa el pelotón hasta 8 con soldados controlados por el servidor (§4.7), con el comportamiento básico de E7-4. Un humano que muere o que llega tarde releva a un bot en pie, y la predicción sigue sin correcciones tras el relevo.

### E6. Partida

- **E6-1 Fases** — Preparación, evacuación, oleada final y resultado, según §3.1. La partida termina cuando cae el último soldado, aunque no haya despegado la última lanzadera. Sin tiempo máximo.
- **E6-2 Colonos** — Según §4.5: los edificios se activan por proximidad y sueltan grupos hasta vaciarse, con contador al acercarse; los colonos caminan a la plataforma, entran en pánico con centollos cerca y pueden morir. Activar un edificio enciende su ruta para el director.
- **E6-3 Lanzaderas** — Despegan a intervalos y embarcan a los colonos presentes; se ven despegar.
- **E6-4 Noticiario de resultado** — Puntuación del pelotón, sin marcador individual: colonos salvados en común, centollos abatidos y soldados caídos, en tono de propaganda. Distingue con claridad una masacre de una evacuación heroica. Antes, el clímax de la última muerte: cámara lenta de 2–3 s y frase final del sargento (§3.1).
- **E6-5 Nueva partida** — Botón para volver a jugar sin recargar.
- **E6-6 Sargento** — Sistema de mensajes del sargento (§4.8) en los momentos de la partida, con textos provisionales que se sustituyen sin tocar código.

### E7. Herramientas

- **E7-1 Panel de depuración (F3)** — FPS, latencia, tiempo de tick del servidor, entidades, ancho de banda.
- **E7-2 Latencia simulada** — Parámetro para añadir retardo y pérdida de paquetes en desarrollo.
- **E7-3 Comandos de administración** — Lanzar oleada, invulnerabilidad, saltar fase, matar todos los centollos.
- **E7-4 Bots** — Clientes headless que se conectan, se mueven, seleccionan objetivos y disparan, con un comportamiento básico (van a por el más cercano, no se suicidan); se pueden lanzar N a la vez. Son para pruebas de red y carga; los compañeros de pelotón son E5-6.
- **E7-5 Prueba de carga** — 8 bots + 150 centollos durante 10 minutos cumpliendo NFR-01 y NFR-03.

### E8. Arte provisional

- **E8-1 Soldado** — Modelo low-poly animado (Quaternius/Kenney + Mixamo): reposo, correr, disparar, derribado.
- **E8-2 Centollos** — Modelos low-poly con **patas animadas proceduralmente** (IK con búsqueda de apoyo en el suelo).
- **E8-3 Entorno** — Edificios, plataforma, lanzadera y madrigueras low-poly.
- **E8-4 Efectos** — Disparos, explosión de granada, impactos, proyectil del escupidor.

---

## 9. Hitos

| Hito                          | Épicas                     | Resultado visible                                                       |
| ----------------------------- | -------------------------- | ----------------------------------------------------------------------- |
| **H1 — Cápsulas en red**      | E0, E1, E2-1, E2-2         | Varios navegadores se ven moverse por el mapa                           |
| **H2 — Disparar**             | E2-3, E2-4, E3, E7-1, E7-2 | Combate contra muñecos de prueba con buena sensación                    |
| **H3 — Llegan los centollos** | E3-5, E3-6, E4, E7-3–E7-5  | Oleadas que atacan y se pueden combatir; prueba de carga superada       |
| **H4 — Vivir y morir**        | E5                         | Derribado, rescate, muerte y relevo, con el pelotón completado con bots |
| **H5 — Es un juego**          | E6, E2-5                   | Partida completa de principio a fin                                     |
| **H6 — Que no sean cápsulas** | E8                         | Arte provisional                                                        |

En H3 todavía no hay derribado: de forma provisional, a 0 de vida el soldado reaparece al momento en la plataforma (además del comando de invulnerabilidad). Se quita en H4.

**Primera prueba con jugadores reales: al terminar H5**, con cápsulas. Si no es divertido con cápsulas, el arte no lo arreglará.

---

## 10. Riesgos

| Riesgo                                                                   | Mitigación                                                                                                    |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Rendimiento de 150 agentes de DetourCrowd en Node                        | Medir en H3; si no llega, reducir el tope o simplificar la evitación                                          |
| Sensación del movimiento con latencia                                    | Predicción y reconciliación desde H1; probar siempre con latencia simulada                                    |
| Rendimiento del cliente con muchos enemigos                              | Instancing desde el principio; LOD y simplificación de animaciones                                            |
| Combate tab-target poco emocionante contra enjambres                     | Iterar números en configuración; la granada y el remate de derribados dan tensión; probar pronto              |
| Que el final "todos mueren" frustre                                      | El noticiario hace pesar los colonos salvados y distingue masacre de evacuación heroica; medir en las pruebas |
| Sin reaparición, el pelotón cae antes de que la evacuación tenga sentido | Medir jugando; ajustar el director, el rescate y el derribado en configuración                                |
| Bots compañeros que estorban (1 humano + 7 bots tiene que ser buena)     | Por fases: básicos en H3 y H4, buenos compañeros con el combate afinado; probar en solitario con bots         |
| Correcciones de predicción al chocar con centollos                       | Medir en H3 con latencia simulada; si molestan, el choque solo frena a los centollos                          |
| Alcance que crece                                                        | Todo lo que no está en §2.1 espera al siguiente prototipo                                                     |

---

## 11. Preguntas abiertas

- [x] ¿Los soldados nunca sobreviven, o puede haber una evacuación heroica excepcional? _Nunca sobreviven; el noticiario hace pesar los colonos salvados (oct 2026)._
- [x] ¿Hay un tercer tipo de centollo (uno grande y lento, tipo "bogavante") en este prototipo o en el siguiente? _No en este. Aplazado: será el rompemuros, que castiga quedarse quieto en formación; entra cuando el bloqueo de soldados esté probado (oct 2026)._
- [x] ¿Fuego automático o disparo manual repetido? _Fuego automático (prueba de H2)._
- [x] ¿Se puede disparar en movimiento con penalización, o solo parado? _En movimiento y sin penalización, pero solo hacia delante (prueba de H2)._
- [x] ¿Fuego amigo con la granada? _Sí, solo la granada; los disparos atraviesan a los aliados (oct 2026)._
- [x] ¿Tab-target o shooter de puntería en tercera persona? _Tab-target con cono y selección automática (ver `docs/decisiones.md`)._
- [x] ¿Cómo se hacen los bots compañeros? _Soldados controlados por el servidor (§4.7); los headless de E7-4 quedan para la carga (oct 2026)._
- [x] ¿Qué hace quien entra con la partida empezada? _Ocupa un bot en pie; si no queda ninguno, espectador hasta la siguiente (oct 2026)._
- [ ] Sin reaparición, ¿aguanta el pelotón lo bastante para que la evacuación tenga sentido? Se confirma jugando.
- [ ] Números del director (empujones, valles, centollos por pico) y ángulo del cono contra el enjambre: se afinan jugando en H3.
- [ ] Alojamiento para las pruebas con jugadores reales (un VPS sencillo basta).
