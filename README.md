# Proyecto UDC

MMO de ciencia ficción en el navegador. Este repositorio contiene el **Prototipo 0: "La Retirada"**: soldados humanos defendiendo la evacuación de una colonia frente a oleadas de centollos.

Documentos de referencia: `docs/gdd.md` (diseño del juego) y `docs/spec-prototipo-0.md` (qué se construye ahora).

## Estado actual: H3 en curso, llegan los centollos

Varios navegadores se conectan al mismo servidor, se mueven por la colonia y combaten contra centollos rasos y escupidores.

- Servidor autoritativo a 20 ticks/s; predicción del movimiento propio y reconciliación; interpolación de los demás (~100 ms en el pasado).
- Snapshots compactos: las entidades nuevas viajan completas y después solo las diferencias (centímetros y milirradianes) en arrays planos.
- Mapa de `map.json` con Babylon.js (WebGPU si está disponible, WebGL2 si no) y cámara estilo WoW que no atraviesa obstáculos.
- Selección automática de objetivo (el hostil más cercano de frente, la decide el servidor); Tab y clic para elegir a mano. Los muñecos de prueba de H2 siguen en el código, desactivados (`dummy.enabled`).
- Fuego automático (solo a lo que el soldado tiene delante, ±20°) y línea de visión contra los obstáculos.
- Habilidades: disparo apuntado, granada con retícula y estimulante, con enfriamientos.
- HUD de combate: vida, marco del objetivo, barra de habilidades, avisos y números de daño.
- Navmesh generada a partir de `map.json` al arrancar el servidor.
- Centollos rasos (bitECS y DetourCrowd): avanzan hacia la colonia, van a por el soldado más cercano a 25 m, como mucho 3 por soldado, y muerden. Escupidores: se paran a 14 m con línea de visión y escupen proyectiles que se esquivan moviéndose (el cliente los dibuja adelantados para que la esquiva cuadre). Soldados y centollos no se atraviesan. A 0 de vida, el soldado reaparece en la plataforma (provisional hasta H4).
- Director de oleadas: empieza con el primer soldado y se reinicia al irse todos. Calma de 20 s, ritmo de fondo creciente con empujones antes de cada despegue (simulados: 2:30, 5:00, 7:30 y 10:00) y valles cada vez más cortos; madrigueras que se abren por tandas, con aviso, según las rutas de colonos de `map.json`; una granada las tapona y a los 10 s se abre otra; escupidores desde el primer despegue; oleada final al tope de 150. El panel F3 muestra la fase y la cuenta atrás.
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
| Tab                     | Siguiente objetivo hostil (opcional: el objetivo se elige solo)           |
| Clic izquierdo          | Seleccionar objetivo                                                      |
| Esc                     | Quitar el objetivo (si hay otro de frente, se elige solo)                 |
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

**Centollos de prueba**: el servidor mantiene ese número de centollos vivos, saliendo por turnos de las madrigueras, y el director de oleadas no actúa. Sirve para pruebas de carga.

```bash
CRABS=150 pnpm --filter @udc/server dev
CRABS=105 SPITTERS=45 pnpm --filter @udc/server dev   # la mezcla del final (30% de escupidores)
```

**Comandos de administración** (solo en desarrollo: `pnpm dev` arranca el servidor con `--admin`; `pnpm start`, no). Funcionan con el panel F3 abierto, que los lista:

| Tecla | Comando                                                        |
| ----- | -------------------------------------------------------------- |
| I     | Invulnerable (activa / desactiva)                              |
| K     | Matar todos los centollos                                      |
| N     | Saltar a la siguiente fase del director                        |
| O     | Lanzar oleada: saltar al próximo empujón (o a la oleada final) |
| P     | Saltar a la oleada final                                       |

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

- **bitECS solo para los centollos.** Los soldados siguen en un `Map`: son pocos y su estado va ligado a la predicción.
- **Muñecos de prueba**: ninguna historia los pide, pero H2 necesitaba objetivos antes de que lleguen los centollos (ver `docs/decisiones.md`).
- **Bots adelantados** de E7-4: hacían falta para probar el multijugador sin abrir ocho navegadores.
- **El cliente pesa ~6 MB** porque importa Babylon entero. Se optimizará con importaciones por módulo más adelante.

## Verificado

- 249 tests (simulación compartida, protocolo, servidor, navmesh, centollos, escupidores, director, selección automática y cliente).
- Director (E4-4), partida simulada con 8 soldados inmortales: vivos 2 en el valle del minuto 3, 45 en el pico del 5, 15 en el valle del 6, 108 en el pico del 10 y 150 en la oleada final; tick en la final 1,36 ms de media y 2,0 de máximo. En el navegador, calma → fondo (20 s) → empujón (110 s) → despegue y valle (150 s), con avisos.
- Escupidores con 75 ± 20 ms (E4-3): uno solo, quieto, 4 impactos en 10 s; moviéndose, 0. Entre que el escupitajo desaparece al tocarte en pantalla y llega el daño, 73–155 ms (menos que la ida y vuelta).
- 105 rasos + 45 escupidores y 8 bots: ~18 KB/s por cliente; tick aislado 1,45 ms de media y 2,3 de máximo con 26 escupitajos en vuelo.
- Selección automática con 150 centollos y 75 ± 20 ms (E3-5): de cara a la masa y sin tocar Tab ni el ratón, 26 impactos en 20 s (la cadencia permite 25) y sin parpadeos del anillo.
- 150 centollos y 8 bots (E4-2): ~18 KB/s de bajada por cliente (NFR-03 pide < 50). Tick: 1,4 ms de media y 2,6 ms de máximo medido aislado; en vivo en un portátil, con los bots y el navegador en la misma máquina, 3,2 ms de media con picos de 10–15 ms por competencia de CPU (las pausas del recolector no pasan de 3 ms). La prueba formal es E7-5.
- Chocar con centollos con 75 ± 20 ms por sentido: correcciones de hasta ~11 cm al avanzar contra ellos; 0 cm el resto del tiempo.
- 8 bots simultáneos: tick medio 0,2–0,5 ms y ~3 KB/s de bajada por cliente (NFR-01 y NFR-03 con mucho margen); el noveno es rechazado.
- Predicción con 75 ± 20 ms por sentido y 2 % de pérdida: 0 cm de corrección andando, girando y con el estimulante.
- Dos navegadores headless combatiendo: disparos, granada, estimulante y su aura se ven en los dos.
- Prueba jugando de H2 en solitario. Pendiente: con varias personas en red.

## Siguiente: H3, llegan los centollos

Hecho: navmesh (E4-1), centollo raso (E4-2), selección automática (E3-5), escupidor (E4-3), director de oleadas (E4-4) y comandos de administración (E7-3). Falta: fuego amigo de la granada, bots que combaten y prueba de carga (8 bots y 150 centollos durante 10 minutos).

Después, H4: derribado, rescate y muerte sin reaparición; al morir se releva a un bot compañero del pelotón o se pasa a espectador.
