# Proyecto UDC

MMO de ciencia ficción en el navegador. Este repositorio contiene el **Prototipo 0: "La Retirada"**: soldados humanos defendiendo la evacuación de una colonia frente a oleadas de centollos.

Documentos de referencia: `docs/gdd.md` (diseño del juego) y `docs/spec-prototipo-0.md` (qué se construye ahora).

## Estado actual: H2, disparar

Varios navegadores se conectan al mismo servidor, se mueven por la colonia y combaten contra muñecos de prueba.

- Servidor autoritativo a 20 ticks/s; predicción del movimiento propio y reconciliación; interpolación de los demás (~100 ms en el pasado).
- Snapshots con solo lo que cambia, posiciones cuantizadas al centímetro.
- Mapa de `map.json` con Babylon.js (WebGPU si está disponible, WebGL2 si no) y cámara estilo WoW que no atraviesa obstáculos.
- Selección de objetivo con Tab y clic; muñecos de prueba con vida que reaparecen.
- Fuego automático (solo a lo que el soldado tiene delante, ±20°) y línea de visión contra los obstáculos.
- Habilidades: disparo apuntado, granada con retícula y estimulante, con enfriamientos.
- HUD de combate: vida, marco del objetivo, barra de habilidades, avisos y números de daño.
- Panel de depuración (F3), red simulada con latencia y pérdida, y bots headless.

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

| Control                 | Acción                                                                    |
| ----------------------- | ------------------------------------------------------------------------- |
| W / S                   | Avanzar / retroceder                                                      |
| A / D                   | Girar (laterales si mantienes el botón derecho)                           |
| Q / E                   | Desplazamiento lateral                                                    |
| Botón derecho + ratón   | Girar al personaje                                                        |
| Botón izquierdo + ratón | Orbitar la cámara                                                         |
| Ambos botones           | Correr hacia delante                                                      |
| Rueda                   | Zoom                                                                      |
| Tab                     | Siguiente objetivo hostil (cercano y a la vista)                          |
| Clic izquierdo          | Seleccionar objetivo                                                      |
| Esc                     | Quitar el objetivo                                                        |
| 1                       | Disparo apuntado (hay que estar quieto)                                   |
| 2                       | Granada: clic en el suelo para lanzarla; Esc o clic derecho para cancelar |
| 3                       | Estimulante                                                               |
| F3                      | Panel de depuración                                                       |

## Herramientas

**Red simulada** (por sentido; la de ida y vuelta es el doble):

```bash
SIM_LATENCY_MS=75 SIM_JITTER_MS=20 pnpm --filter @udc/server dev
SIM_LATENCY_MS=75 SIM_JITTER_MS=20 SIM_LOSS=0.02 pnpm --filter @udc/server dev
```

`SIM_LOSS` es la fracción de mensajes que se pierden (0–1). Como WebSocket va sobre TCP, un mensaje perdido no desaparece: se retransmite a los `SIM_RTO_MS` (200 por defecto) y los que vienen detrás esperan. Cada conexión y cada sentido tienen su propia cola.

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
- **Muñecos de prueba**: ninguna historia los pide, pero H2 necesitaba objetivos antes de que lleguen los centollos (ver `docs/decisiones.md`).
- **Bots adelantados** de E7-4: hacían falta para probar el multijugador sin abrir ocho navegadores.
- **El cliente pesa ~6 MB** porque importa Babylon entero. Se optimizará con importaciones por módulo más adelante.

## Verificado

- 148 tests (simulación compartida, servidor, navmesh y cliente).
- 8 bots simultáneos: tick medio 0,2–0,5 ms y ~3 KB/s de bajada por cliente (NFR-01 y NFR-03 con mucho margen); el noveno es rechazado.
- Predicción con 75 ± 20 ms por sentido y 2 % de pérdida: 0 cm de corrección andando, girando y con el estimulante.
- Dos navegadores headless combatiendo: disparos, granada, estimulante y su aura se ven en los dos.
- Prueba jugando de H2 en solitario. Pendiente: con varias personas en red.

## Siguiente: H3, llegan los centollos

Selección automática de objetivo, fuego amigo de la granada, navmesh, centollo raso y escupidor con IA (los soldados les cierran el paso), director de oleadas en dientes de sierra con tope de 150 y madrigueras que se taponan con la granada, comandos de administración, bots que combaten y prueba de carga (8 bots y 150 centollos durante 10 minutos). Entra bitECS.

Después, H4: derribado, rescate y muerte sin reaparición; al morir se releva a un bot compañero del pelotón o se pasa a espectador.
