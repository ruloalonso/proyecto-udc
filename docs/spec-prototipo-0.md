# Proyecto UDC — Prototipo 0: "La Retirada"

> Spec del primer jugable. Deriva del documento de diseño (GDD) y se limita a lo que hay que construir ahora.
> Todo lo que no aparece aquí está **fuera de alcance**, aunque esté en el GDD.

---

## 1. Objetivo

Construir una partida multijugador corta, en el navegador, en la que varios soldados humanos defienden la evacuación de una colonia frente a oleadas de centollos.

El prototipo tiene que responder a dos preguntas:

1. **¿Es viable técnicamente?** Servidor autoritativo, 3D en navegador, varios jugadores y cientos de enemigos a la vez, con buena sensación de juego.
2. **¿Es divertido?** El combate tab-target contra centollos, el derribado y el rescate, y la muerte barata con reinicio rápido.

Si la respuesta a la segunda pregunta es no, se itera aquí antes de construir nada más.

**Criterio de éxito:** 4–5 personas juegan tres partidas seguidas y quieren jugar otra.

---

## 2. Alcance

### 2.1 Dentro

- Una zona de superficie: colonia humana con plataforma de lanzaderas.
- Hasta **8 jugadores** por partida, conectados desde el navegador.
- Personaje en 3D (cápsula provisional) con cámara en tercera persona estilo WoW.
- Combate tab-target: fuego automático + 3 habilidades.
- Dos tipos de centollo con IA, en oleadas crecientes.
- Colonos NPC que caminan hacia la plataforma y pueden morir.
- Derribado, rescate por aliados, muerte, pantalla de propaganda y reinicio como nuevo recluta.
- Pantalla final con el resultado.
- Herramientas de depuración y bots de carga.

### 2.2 Fuera

Naves, espacio, transiciones, mapa galáctico, persistencia, cuentas y login, creación de personaje, envejecimiento, tiempo galáctico, economía, inventario, órdenes de escuadra, cadena de mando, política, psiónicos, chat, sonido elaborado, arte final.

---

## 3. Experiencia de juego

### 3.1 Flujo de una partida

1. **Entrada.** El jugador abre la URL, escribe un apodo y entra en la sala. Se le asigna un nombre de recluta: _"Recluta nº 7.431.902"_.
2. **Preparación (30 s).** Los jugadores aparecen junto a la plataforma. Pueden moverse y ver el mapa. Un altavoz anuncia la misión.
3. **Evacuación (~10 min).** Los colonos salen de los edificios hacia la plataforma por oleadas. Cada pocos minutos despega una lanzadera con los colonos que hayan llegado. Los centollos atacan desde los bordes del mapa con intensidad creciente.
4. **Última lanzadera.** Despega con los últimos colonos. **No hay sitio para soldados.** Los centollos llegan en una oleada final sin fin.
5. **Final.** Cuando muere el último soldado, o pasado un tiempo máximo, aparece el **noticiario de propaganda** con el resultado: colonos salvados, centollos abatidos, soldados caídos ("su sacrificio no será olvidado").

> Decisión de diseño: los soldados no sobreviven. Es coherente con el prólogo del GDD (§10.1) y con el tono. La puntuación es **cuántos colonos se salvan**. _(Abierto a cambiarlo tras las pruebas.)_

### 3.2 Morir dentro de la partida

- Al llegar a 0 de vida, el soldado queda **derribado** durante 30 s.
- Un aliado puede **rescatarlo** manteniendo la interacción 3 s a menos de 2 m. Vuelve con un 40% de vida.
- Si nadie lo rescata o un centollo lo remata, **muere**.
- Pantalla breve de defunción satírica y **reaparece como un nuevo recluta** (nuevo número) en el punto de refuerzos, tras un tiempo de espera que crece con cada muerte.
- Durante la oleada final no hay refuerzos.

### 3.3 Controles

| Acción                   | Control                         |
| ------------------------ | ------------------------------- |
| Moverse                  | W A S D                         |
| Desplazamiento lateral   | Q / E                           |
| Girar cámara y personaje | Botón derecho + ratón           |
| Orbitar cámara           | Botón izquierdo + ratón         |
| Zoom                     | Rueda                           |
| Siguiente objetivo       | Tab                             |
| Seleccionar objetivo     | Clic izquierdo sobre la entidad |
| Habilidades              | 1, 2, 3                         |
| Rescatar                 | F (mantener)                    |
| Panel de depuración      | F3                              |

---

## 4. Diseño de juego

> Todos los valores viven en `packages/shared/src/config/game.config.ts` y se ajustarán constantemente.

### 4.1 Soldado

| Parámetro        | Valor inicial                                     |
| ---------------- | ------------------------------------------------- |
| Vida             | 100                                               |
| Velocidad        | 5 m/s (lateral y atrás: 70%)                      |
| Tiempo derribado | 30 s                                              |
| Rescate          | 3 s canalizado, a ≤ 2 m; vuelve con 40% de vida   |
| Reaparición      | 10 s + 5 s por cada muerte anterior en la partida |

### 4.2 Habilidades

| #   | Habilidad            | Tipo                         | Efecto                                      | Alcance | Lanzamiento                      | Enfriamiento         |
| --- | -------------------- | ---------------------------- | ------------------------------------------- | ------- | -------------------------------- | -------------------- |
| —   | **Fuego automático** | Automático sobre el objetivo | 10 de daño                                  | 30 m    | —                                | 0,8 s entre disparos |
| 1   | **Disparo apuntado** | Objetivo                     | 35 de daño                                  | 35 m    | 1,5 s (se interrumpe al moverse) | 6 s                  |
| 2   | **Granada**          | Zona en el suelo             | 40 de daño en 4 m de radio, tras 1 s        | 20 m    | Instantánea                      | 12 s                 |
| 3   | **Estimulante**      | Propio                       | +30 de vida y +20% de velocidad durante 5 s | —       | Instantánea                      | 30 s                 |

- **Enfriamiento global** de 1 s entre habilidades 1–3.
- Ataques que requieren **línea de visión** contra obstáculos del mapa.
- El fuego automático se activa al tener un objetivo hostil vivo dentro de alcance y con línea de visión.

### 4.3 Centollos

| Tipo              | Vida | Velocidad | Ataque                                                                             | Comportamiento                                               |
| ----------------- | ---- | --------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Centollo raso** | 30   | 6 m/s     | Cuerpo a cuerpo, 8 de daño cada 1 s, a ≤ 1,5 m                                     | En masa. Prioriza colonos, luego soldados. Remata derribados |
| **Escupidor**     | 60   | 3,5 m/s   | Proyectil, 15 de daño cada 2,5 s, a ≤ 18 m (viaja a 15 m/s; esquivable moviéndose) | Se detiene a distancia y dispara. Prioriza soldados          |

**Estados de IA:** aparecer → avanzar hacia la colonia → seleccionar objetivo (el más cercano según prioridad) → perseguir → atacar → (raso) rematar derribado.

### 4.4 Director de oleadas

- **Madrigueras** en los bordes del mapa como puntos de aparición.
- Intensidad creciente con el tiempo, escalada por número de jugadores vivos.
- Fórmula inicial: `centollos_por_minuto = base × (1 + 0,25 × minuto) × (0,5 + 0,15 × jugadores)`, con `base = 20`.
- Proporción de escupidores: 10% al principio, 30% al final.
- Tope de centollos vivos simultáneos: **150**.
- **Oleada final:** aparición continua al tope hasta que no quede ningún soldado vivo.

### 4.5 Colonos y lanzaderas

- **200 colonos** en total, en grupos de 10–20 que salen de 4 edificios.
- Caminan por la navmesh hasta la plataforma a 3 m/s. Vida 20. No se defienden.
- **4 lanzaderas** a intervalos de ~2,5 min. Cada una embarca a los colonos que haya en la plataforma al despegar. La última, al final de la evacuación.
- Colonos que llegan tarde esperan a la siguiente; después de la última, quedan abandonados.

### 4.6 Mapa

- Superficie plana de **~200 × 200 m** (y = 0).
- Plataforma de lanzaderas en el centro-norte; 4 edificios de colonos repartidos; obstáculos (cajas, muros, contenedores) para dar cobertura y bloquear la línea de visión; 6 madrigueras en los bordes.
- Definido en un archivo de datos (`map.json`): obstáculos como cajas orientadas, puntos de interés y madrigueras. La navmesh se genera a partir de esos datos.

---

## 5. Requisitos funcionales

| ID    | Requisito                                                                                                                  |
| ----- | -------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | Un jugador entra en una partida abriendo una URL y escribiendo un apodo                                                    |
| FR-02 | La partida admite hasta 8 jugadores; los que lleguen con la partida empezada entran como refuerzo                          |
| FR-03 | Cada cliente ve a los demás jugadores, centollos, colonos y proyectiles en tiempo real                                     |
| FR-04 | El movimiento propio responde de inmediato (predicción en cliente) y el servidor tiene la última palabra                   |
| FR-05 | El jugador puede seleccionar objetivos con Tab o clic y usar las habilidades de §4.2                                       |
| FR-06 | El servidor resuelve todo el combate: alcance, línea de visión, daño, enfriamientos                                        |
| FR-07 | Los centollos se mueven por la navmesh, evitan chocar entre sí y siguen los estados de §4.3                                |
| FR-08 | El director genera oleadas según §4.4                                                                                      |
| FR-09 | Los colonos y las lanzaderas siguen §4.5                                                                                   |
| FR-10 | Derribado, rescate, muerte y reaparición según §3.2                                                                        |
| FR-11 | La partida sigue las fases de §3.1 y termina con la pantalla de resultado                                                  |
| FR-12 | Al terminar, los jugadores pueden empezar una nueva partida sin recargar                                                   |
| FR-13 | El HUD muestra vida, objetivo, barra de habilidades con enfriamientos, aliados derribados, temporizador y colonos salvados |
| FR-14 | Números de daño flotantes y señal visual al recibir daño                                                                   |

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
- **Servidor → cliente:** **snapshot** por tick con el estado de las entidades (posición cuantizada, orientación, vida, estado) y una lista de **eventos** (daño, derribo, muerte, habilidad lanzada, fase de partida, lanzadera).
- **Movimiento propio:** predicción en cliente con la misma función de movimiento que el servidor (`shared/sim`) y reconciliación con la última entrada confirmada.
- **Resto de entidades:** interpolación con un búfer de ~100 ms.
- **Optimización inicial:** enviar solo entidades que hayan cambiado (delta respecto al último snapshot confirmado). En una zona de 200 m no hace falta AOI todavía.

### 7.4 Mensajes (borrador)

| Dirección | Mensaje    | Contenido                                                                  |
| --------- | ---------- | -------------------------------------------------------------------------- |
| C → S     | `join`     | apodo                                                                      |
| C → S     | `input`    | seq, dirección de movimiento, orientación                                  |
| C → S     | `target`   | id de entidad (o nulo)                                                     |
| C → S     | `ability`  | id de habilidad, id de objetivo o posición                                 |
| C → S     | `revive`   | id del aliado (inicio / cancelación)                                       |
| C → S     | `ping`     | marca de tiempo                                                            |
| S → C     | `welcome`  | id del jugador, nombre de recluta, configuración, mapa                     |
| S → C     | `snapshot` | tick, última entrada confirmada, entidades cambiadas, entidades eliminadas |
| S → C     | `events`   | lista de eventos del tick                                                  |
| S → C     | `match`    | fase, temporizador, colonos salvados, lanzaderas                           |
| S → C     | `pong`     | marca de tiempo                                                            |

### 7.5 Simulación

- **Mundo plano**: posiciones en 2D (x, z); la altura es cosmética.
- **Colisiones de jugadores:** círculo contra cajas orientadas del mapa. Los soldados no colisionan entre sí, como en WoW: con latencia, el cliente no puede predecir ese choque de forma exacta (ver `docs/decisiones.md`).
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

### E3. Combate

- **E3-1 Fuego automático** — Con objetivo válido, el servidor aplica daño según §4.2; el cliente lo muestra.
- **E3-2 Habilidades** — Disparo apuntado, granada y estimulante según §4.2, con enfriamientos y enfriamiento global.
- **E3-3 Línea de visión** — Sin visión no se puede disparar ni lanzar habilidades de objetivo.
- **E3-4 HUD de combate** — Vida, marco del objetivo, barra de habilidades con enfriamientos, números de daño.

### E4. Centollos

- **E4-1 Navmesh** — Generada a partir de `map.json` al arrancar el servidor.
- **E4-2 Centollo raso** — Comportamiento y valores de §4.3; 150 agentes simultáneos sin superar NFR-01.
- **E4-3 Escupidor** — Comportamiento, proyectil esquivable y valores de §4.3.
- **E4-4 Director** — Oleadas según §4.4, tope de 150, oleada final.

### E5. Vida y muerte

- **E5-1 Derribado** — A 0 de vida el soldado queda derribado 30 s, sin poder actuar; los aliados lo ven marcado en el HUD con su dirección.
- **E5-2 Rescate** — Canalización de 3 s según §3.2; se cancela si alguien se mueve o el rescatador recibe daño.
- **E5-3 Muerte** — Por tiempo o remate de un centollo raso.
- **E5-4 Defunción y reaparición** — Pantalla satírica breve; reaparición como nuevo recluta con el retraso de §4.1; sin refuerzos en la oleada final.

### E6. Partida

- **E6-1 Fases** — Preparación, evacuación, oleada final y resultado, según §3.1.
- **E6-2 Colonos** — Salen por grupos, caminan a la plataforma y pueden morir, según §4.5.
- **E6-3 Lanzaderas** — Despegan a intervalos y embarcan a los colonos presentes; se ven despegar.
- **E6-4 Noticiario de resultado** — Colonos salvados, centollos abatidos, soldados caídos, en tono de propaganda.
- **E6-5 Nueva partida** — Botón para volver a jugar sin recargar.

### E7. Herramientas

- **E7-1 Panel de depuración (F3)** — FPS, latencia, tiempo de tick del servidor, entidades, ancho de banda.
- **E7-2 Latencia simulada** — Parámetro para añadir retardo y pérdida de paquetes en desarrollo.
- **E7-3 Comandos de administración** — Lanzar oleada, invulnerabilidad, saltar fase, matar todos los centollos.
- **E7-4 Bots** — Clientes headless que se conectan, se mueven, seleccionan objetivos y disparan; se pueden lanzar N a la vez.
- **E7-5 Prueba de carga** — 8 bots + 150 centollos durante 10 minutos cumpliendo NFR-01 y NFR-03.

### E8. Arte provisional

- **E8-1 Soldado** — Modelo low-poly animado (Quaternius/Kenney + Mixamo): reposo, correr, disparar, derribado.
- **E8-2 Centollos** — Modelos low-poly con **patas animadas proceduralmente** (IK con búsqueda de apoyo en el suelo).
- **E8-3 Entorno** — Edificios, plataforma, lanzadera y madrigueras low-poly.
- **E8-4 Efectos** — Disparos, explosión de granada, impactos, proyectil del escupidor.

---

## 9. Hitos

| Hito                          | Épicas                     | Resultado visible                                                 |
| ----------------------------- | -------------------------- | ----------------------------------------------------------------- |
| **H1 — Cápsulas en red**      | E0, E1, E2-1, E2-2         | Varios navegadores se ven moverse por el mapa                     |
| **H2 — Disparar**             | E2-3, E2-4, E3, E7-1, E7-2 | Combate contra muñecos de prueba con buena sensación              |
| **H3 — Llegan los centollos** | E4, E7-3, E7-4, E7-5       | Oleadas que atacan y se pueden combatir; prueba de carga superada |
| **H4 — Vivir y morir**        | E5                         | Derribado, rescate, muerte y reaparición                          |
| **H5 — Es un juego**          | E6                         | Partida completa de principio a fin                               |
| **H6 — Que no sean cápsulas** | E8                         | Arte provisional                                                  |

**Primera prueba con jugadores reales: al terminar H5**, con cápsulas. Si no es divertido con cápsulas, el arte no lo arreglará.

---

## 10. Riesgos

| Riesgo                                               | Mitigación                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Rendimiento de 150 agentes de DetourCrowd en Node    | Medir en H3; si no llega, reducir el tope o simplificar la evitación                             |
| Sensación del movimiento con latencia                | Predicción y reconciliación desde H1; probar siempre con latencia simulada                       |
| Rendimiento del cliente con muchos enemigos          | Instancing desde el principio; LOD y simplificación de animaciones                               |
| Combate tab-target poco emocionante contra enjambres | Iterar números en configuración; la granada y el remate de derribados dan tensión; probar pronto |
| Que el final "todos mueren" frustre                  | Medir en las pruebas; está marcado como abierto                                                  |
| Alcance que crece                                    | Todo lo que no está en §2.1 espera al siguiente prototipo                                        |

---

## 11. Preguntas abiertas

- [ ] ¿Los soldados nunca sobreviven, o puede haber una evacuación heroica excepcional?
- [ ] ¿Hay un tercer tipo de centollo (uno grande y lento, tipo "bogavante") en este prototipo o en el siguiente?
- [ ] ¿Fuego automático o disparo manual repetido? Validar en H2.
- [ ] ¿Se puede disparar en movimiento con penalización, o solo parado?
- [ ] ¿Fuego amigo con la granada?
- [ ] Alojamiento para las pruebas con jugadores reales (un VPS sencillo basta).
