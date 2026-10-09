# Proyecto UDC (Universo de Centollos)

MMO de ciencia ficción en el navegador. Ahora mismo se construye el **Prototipo 0: "La Retirada"**: una partida multijugador corta en la que soldados humanos defienden la evacuación de una colonia frente a oleadas de centollos (el enjambre).

## Documentos de referencia

- `docs/spec-prototipo-0.md`: **qué se construye ahora**. Épicas, historias con criterios de aceptación, hitos, requisitos y valores de diseño. Es la fuente de verdad para el trabajo diario.
- `docs/decisiones.md`: registro breve de las decisiones tomadas durante el desarrollo.
- `docs/gdd.md`: diseño del juego completo. Sirve de contexto y de visión, pero **todo lo que no está en la spec está fuera de alcance**, aunque aparezca en el GDD.

Si una decisión de implementación contradice la spec, o la spec no la cubre, pregunta antes de improvisar. Si se toma una decisión nueva, se actualiza el documento correspondiente en el mismo cambio.

## Comandos

```bash
pnpm install                 # Node 22+, pnpm 9
pnpm dev                     # servidor (ws://localhost:8080, con comandos de admin) + cliente (http://localhost:5173)
pnpm typecheck
pnpm lint
pnpm test                    # Vitest
pnpm format                  # Prettier
pnpm bots -- 7 30            # 7 bots headless durante 30 s (con 8 no queda sitio para entrar)
pnpm tune -- 40 4 0.1 1      # simula una partida con 8 bots para afinar el director (base, empujón, crecimiento, semilla)
pnpm loadtest                # prueba de carga: 8 bots + 150 centollos + 200 colonos, 10 min, NFR-01 y NFR-03 (-- 60 para 1 min; BUILDINGS=closed sin colonos)

# Red simulada (por sentido; ida y vuelta = el doble). SIM_LOSS: pérdida 0–1, simulada
# como retransmisión TCP de SIM_RTO_MS (200 por defecto) que retrasa lo que viene detrás.
SIM_LATENCY_MS=75 SIM_JITTER_MS=20 pnpm --filter @udc/server dev
SIM_LATENCY_MS=75 SIM_JITTER_MS=20 SIM_LOSS=0.02 pnpm --filter @udc/server dev

# Centollos de prueba (sin director, para carga): mantiene N vivos saliendo de las madrigueras.
# Sin estas variables manda el director de oleadas (E4-4), que empieza con el primer soldado.
CRABS=150 pnpm --filter @udc/server dev
CRABS=105 SPITTERS=45 pnpm --filter @udc/server dev   # con escupidores (E4-3)
```

## Estructura

```
packages/
  shared/   Configuración, mapa, simulación determinista, protocolo y cerebro de los bots. Lo importan todos.
  server/   Servidor autoritativo (Node + ws).
  client/   Babylon.js + HUD en HTML/CSS (Vite).
  bots/     Clientes headless para pruebas de red y carga.
```

Los paquetes se consumen como código fuente TypeScript (sin paso de build): `exports` apunta a `src/index.ts`.

## Reglas de arquitectura (no romper)

1. **El servidor es la autoridad.** El cliente solo envía intenciones (entradas, objetivo, habilidad). Daño, colisiones, enfriamientos y resultados se calculan en el servidor.
2. **La simulación que usa la predicción vive en `shared/src/sim` y es determinista.** Cliente y servidor ejecutan exactamente la misma función con las mismas entradas. Nada de `Math.random()`, tiempos de reloj ni estado externo dentro de esas funciones. Si se añade algo al movimiento (por ejemplo, colisión entre soldados), hay que comprobar que la predicción sigue sin correcciones.
3. **Todos los valores de diseño están en `packages/shared/src/config/game.config.ts`.** Nada de números mágicos de gameplay en el código.
4. **Tick fijo a 20 Hz** en el servidor. El cliente genera una entrada por tick.
5. **Red:** MessagePack; posiciones cuantizadas a centímetros y orientación a milirradianes; los snapshots solo incluyen entidades que cambian. Los tipos de mensaje están en `shared/src/protocol/messages.ts`.
6. **Convención de rotación:** en la simulación, `yaw = 0` mira hacia +Z y adelante es `(sin yaw, cos yaw)`. Babylon es levógiro: `mesh.rotation.y = yaw` para soldados y `rotation.y = -rot` para las cajas del mapa (ver el comentario en `shared/src/sim/collision.ts`).
7. **Mundo plano:** la simulación es 2D (x, z). La altura es solo visual.

## Convenciones

- TypeScript estricto. Identificadores en inglés; **comentarios, documentación y textos visibles en español**.
- Tono de los textos del juego: propaganda militar satírica (estilo _Starship Troopers_ / Helldivers). A los enemigos, desde el lado humano, se les llama "centollos".
- Tests junto al código (`*.test.ts`). Toda lógica nueva de `shared` lleva tests.
- Commits pequeños y descriptivos, en español.

## Definición de terminado

Una historia está terminada cuando:

1. Cumple sus criterios de aceptación de la spec.
2. `pnpm typecheck`, `pnpm lint` y `pnpm test` pasan.
3. Si toca la red o la simulación: se ha probado con latencia simulada (75 ± 20 ms) y la corrección de predicción del panel de depuración (F3) sigue en ~0 cm.
4. Si afecta al rendimiento (más entidades, más mensajes): se ha medido con bots el tiempo de tick del servidor y la bajada por cliente frente a NFR-01 y NFR-03.
5. README y documentos actualizados si cambia algo que describen.

## Flujo de trabajo

- Cada historia de la spec es una **issue** de GitHub y cada hito, un **milestone** (`H2 — Disparar`). Título de la issue: `E3-1 Fuego automático`.
- Para trabajar una issue:
  1. Claude propone un plan (en la conversación o como comentario en la issue) y el usuario lo revisa antes de escribir código.
  2. Rama propia: `h2/e3-1-fuego-automatico`.
  3. PR con `Closes #N` en la descripción. La CI (typecheck, lint, test) es el filtro: no se fusiona en rojo.
  4. El usuario da el visto bueno (y prueba los cambios visuales); entonces Claude fusiona (squash) y borra la rama.
- Al cerrar todas las issues de un hito, **prueba jugando** antes de empezar el siguiente.
- Cada decisión tomada por el camino se apunta en `docs/decisiones.md` (dos líneas, en el mismo cambio).

## Estado actual

- **H1 completado:** cápsulas en red, predicción y reconciliación, interpolación, mapa, controles básicos, panel de depuración, bots.
- **H2 completado:** cámara con colisión, selección con Tab y clic, muñecos de prueba, fuego automático (solo hacia delante, ±20°), línea de visión, habilidades 1–3, HUD de combate, panel F3 con el tick del servidor y red simulada con pérdida. Probado jugando en solitario y, con H3, en red local con dos personas.
- **H3 completado:** navmesh, centollo raso y escupidor (bitECS + DetourCrowd; soldados y centollos chocan), selección automática de objetivo, fuego amigo de la granada, director de oleadas en dientes de sierra (madrigueras por tandas y taponables; con H5, las rutas son las de los edificios activados y los despegues, los de las lanzaderas), comandos de administración (con F3 abierto: I/K/N/O/P), bots que combaten y prueba de carga (`pnpm loadtest`). Director afinado con bots (`pnpm tune`). **Probado jugando** en red local, dos personas: divertido; de ahí el cono de disparo en el suelo y el disparo apuntado a 50 m.
- **H4 hecho, vivir y morir** (E5): derribado, rescate, muerte **sin reaparición**, defunción y relevo en bots compañeros controlados por el servidor y espectador (§3.2, §4.7). **Falta la prueba jugando de H4.**
- **En curso: H5, es un juego** (E6), en este orden: E6-1 fases (hecho), E6-2 colonos (hecho), E6-3 lanzaderas (hecho), E6-6 sargento (hecho; textos en `client/src/texts/sargento.json`), E6-4 noticiario, E6-5 nueva partida.
- **Añadida a H5:** E2-5 nombres de los jugadores (hecho): el apodo sobre los soldados de los demás jugadores, no sobre los bots.

## Desviaciones conscientes y deuda conocida

- bitECS solo para los centollos (`server/src/ecs`); los soldados siguen en un `Map`. El id de red no es el de bitECS.
- Los soldados chocan con los centollos solo en el servidor (fuera de `shared/sim`): al avanzar contra ellos hay correcciones de predicción de hasta ~11 cm, aceptadas en §7.5.
- El cliente importa Babylon entero (~6 MB). Pasar a importaciones por módulo más adelante.

## Qué no hacer

- No añadir funcionalidades fuera de la spec (naves, persistencia, política, psiónicos...) aunque estén en el GDD.
- No mover lógica de gameplay al cliente.
- No usar `localStorage` ni estado del navegador para nada que afecte a la partida.
- No subir `node_modules` ni artefactos de build.
