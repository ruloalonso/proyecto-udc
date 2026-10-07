# Proyecto UOS

MMO de ciencia ficción en el navegador. Este repositorio contiene el **Prototipo 0: "La Retirada"**: soldados humanos defendiendo la evacuación de una colonia frente a oleadas de centollos.

Documentos de referencia: `docs/gdd.md` (diseño del juego) y `docs/spec-prototipo-0.md` (qué se construye ahora).

## Estado actual: H1, cápsulas en red

Varios navegadores se conectan al mismo servidor y se ven moverse por el mapa de la colonia.

- Servidor autoritativo a 20 ticks/s.
- Predicción del movimiento propio y reconciliación con el servidor.
- Interpolación de los demás jugadores (~100 ms en el pasado).
- Snapshots con solo las entidades que cambian, posiciones cuantizadas al centímetro.
- Mapa de `map.json` renderizado con Babylon.js (WebGPU si está disponible, WebGL2 si no).
- Controles al estilo WoW (versión básica) y panel de depuración.
- Bots headless para pruebas.

## Requisitos

- Node 22 o superior.
- pnpm 9 (`corepack enable` o `npm i -g pnpm@9`).

## Arrancar

```bash
pnpm install
pnpm dev
```

Abre `http://localhost:5173` en varias pestañas o navegadores. El servidor escucha en `ws://localhost:8080`.

Para probar desde otro equipo de la red local, abre `http://<tu-ip>:5173`: el cliente se conecta al servidor en la misma IP.

## Controles

| Control | Acción |
|---|---|
| W / S | Avanzar / retroceder |
| A / D | Girar (laterales si mantienes el botón derecho) |
| Q / E | Desplazamiento lateral |
| Botón derecho + ratón | Girar al personaje |
| Botón izquierdo + ratón | Orbitar la cámara |
| Ambos botones | Correr hacia delante |
| Rueda | Zoom |
| F3 | Panel de depuración |

## Herramientas

**Latencia simulada** (por sentido; la de ida y vuelta es el doble):

```bash
SIM_LATENCY_MS=75 SIM_JITTER_MS=20 pnpm --filter @uos/server dev
```

**Bots** (número de bots y, opcionalmente, segundos de duración):

```bash
pnpm bots -- 7
pnpm bots -- 8 30
```

**Calidad:**

```bash
pnpm typecheck
pnpm lint
pnpm test
```

## Estructura

```
packages/
  shared/   Configuración, mapa, simulación de movimiento y protocolo (lo usan todos)
  server/   Servidor autoritativo (ws)
  client/   Cliente Babylon.js + HUD en HTML/CSS
  bots/     Clientes headless para pruebas
```

Todos los valores de diseño están en `packages/shared/src/config/game.config.ts`.

## Desviaciones conscientes respecto a la spec

- **Sin ECS todavía.** Con un puñado de soldados, un `Map` basta. bitECS entra en H3, cuando lleguen los 150 centollos.
- **Los soldados no chocan entre sí**, solo con el mapa. Así la predicción del cliente coincide exactamente con el servidor. Se revisará en H2.
- **Bots adelantados** de E7-4: hacían falta para probar el multijugador sin abrir ocho navegadores.
- **El cliente pesa ~6 MB** porque importa Babylon entero. Se optimizará con importaciones por módulo más adelante.

## Verificado

- 15 tests de la simulación compartida (movimiento, colisiones, cuantización).
- 8 bots simultáneos: tick medio ~0,5 ms, ~4,7 KB/s de bajada por cliente; el noveno es rechazado.
- Predicción con 150 ms de latencia simulada de ida y vuelta: 0 cm de corrección media (la simulación del cliente y la del servidor coinciden).
- Dos navegadores headless se ven entre sí en el mapa.

## Siguiente: H2, disparar

Cámara estilo WoW completa (colisión con obstáculos), selección de objetivo con Tab y clic, fuego automático y las tres habilidades, línea de visión y HUD de combate.
