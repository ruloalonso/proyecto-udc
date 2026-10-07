# Proyecto UDC (Universo de Centollos)

MMO de ciencia ficción en el navegador. Ahora mismo se construye el **Prototipo 0: "La Retirada"**: una partida multijugador corta en la que soldados humanos defienden la evacuación de una colonia frente a oleadas de centollos (el enjambre).

## Documentos de referencia

- `docs/spec-prototipo-0.md`: **qué se construye ahora**. Épicas, historias con criterios de aceptación, hitos, requisitos y valores de diseño. Es la fuente de verdad para el trabajo diario.
- `docs/gdd.md`: diseño del juego completo. Sirve de contexto y de visión, pero **todo lo que no está en la spec está fuera de alcance**, aunque aparezca en el GDD.

Si una decisión de implementación contradice la spec, o la spec no la cubre, pregunta antes de improvisar. Si se toma una decisión nueva, se actualiza el documento correspondiente en el mismo cambio.

## Comandos

```bash
pnpm install                 # Node 22+, pnpm 9
pnpm dev                     # servidor (ws://localhost:8080) + cliente (http://localhost:5173)
pnpm typecheck
pnpm lint
pnpm test                    # Vitest
pnpm format                  # Prettier
pnpm bots -- 8 30            # 8 bots headless durante 30 s

# Latencia simulada (por sentido; ida y vuelta = el doble)
SIM_LATENCY_MS=75 SIM_JITTER_MS=20 pnpm --filter @udc/server dev
```

## Estructura

```
packages/
  shared/   Configuración, mapa, simulación determinista y protocolo. Lo importan todos.
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
- Commits pequeños y descriptivos, en español. Una rama por historia (`h2/e3-1-fuego-automatico`).

## Definición de terminado

Una historia está terminada cuando:

1. Cumple sus criterios de aceptación de la spec.
2. `pnpm typecheck`, `pnpm lint` y `pnpm test` pasan.
3. Si toca la red o la simulación: se ha probado con latencia simulada (75 ± 20 ms) y la corrección de predicción del panel de depuración (F3) sigue en ~0 cm.
4. Si afecta al rendimiento (más entidades, más mensajes): se ha medido con bots el tiempo de tick del servidor y la bajada por cliente frente a NFR-01 y NFR-03.
5. README y documentos actualizados si cambia algo que describen.

## Estado actual

- **H1 completado:** cápsulas en red, predicción y reconciliación, interpolación, mapa, controles básicos, panel de depuración, bots.
- **Siguiente: H2, disparar** (E2-3, E2-4, E3, E7-1, E7-2 de la spec).

## Desviaciones conscientes y deuda conocida

- Sin ECS todavía: un `Map` basta con pocos soldados. **bitECS entra en H3** con los centollos.
- Los soldados no colisionan entre sí (solo con el mapa) para que la predicción sea exacta. **Revisar al empezar H2.**
- El cliente importa Babylon entero (~6 MB). Pasar a importaciones por módulo más adelante.

## Qué no hacer

- No añadir funcionalidades fuera de la spec (naves, persistencia, política, psiónicos...) aunque estén en el GDD.
- No mover lógica de gameplay al cliente.
- No usar `localStorage` ni estado del navegador para nada que afecte a la partida.
- No subir `node_modules` ni artefactos de build.
