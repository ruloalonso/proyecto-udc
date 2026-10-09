# Proyecto UDC

MMO de ciencia ficción en el navegador. Este repositorio contiene el **Prototipo 0: "La Retirada"**: soldados humanos defendiendo la evacuación de una colonia frente a oleadas de centollos.

Documentos de referencia: `docs/gdd.md` (diseño del juego) y `docs/spec-prototipo-0.md` (qué se construye ahora).

## Estado actual: H3 completado, llegan los centollos

Varios navegadores se conectan al mismo servidor, se mueven por la colonia y combaten contra centollos rasos y escupidores. El pelotón es siempre de 8: los puestos que no ocupan jugadores los ocupan **bots del servidor**, con el mismo cerebro que los bots headless; quien entra releva a un bot (se queda con su soldado) y quien se va deja un bot en su lugar. Los bots llevan «(bot)» detrás del nombre.

- Servidor autoritativo a 20 ticks/s; predicción del movimiento propio y reconciliación; interpolación de los demás (~100 ms en el pasado).
- Snapshots compactos: las entidades nuevas viajan completas y después solo las diferencias (centímetros y milirradianes) en arrays planos.
- Mapa de `map.json` con Babylon.js (WebGPU si está disponible, WebGL2 si no) y cámara estilo WoW que no atraviesa obstáculos.
- Selección automática de objetivo (el hostil más cercano de frente, la decide el servidor); Tab y clic para elegir a mano. Los muñecos de prueba de H2 siguen en el código, desactivados (`dummy.enabled`).
- Fuego automático (solo a lo que el soldado tiene delante, ±20°; el cono se ve en el suelo, con el alcance del fuego automático y el del disparo apuntado) y línea de visión contra los obstáculos.
- Habilidades: disparo apuntado, granada con retícula y estimulante, con enfriamientos. Fuego amigo solo con la granada: daña también a los soldados, quien la lanza incluido (en rojo, con aviso).
- HUD de combate: vida, marco del objetivo, barra de habilidades, avisos y números de daño.
- Navmesh generada a partir de `map.json` al arrancar el servidor.
- Centollos rasos (bitECS y DetourCrowd): avanzan hacia la colonia, van a por el soldado más cercano a 25 m, como mucho 3 por soldado, y muerden. Escupidores: se paran a 14 m con línea de visión y escupen proyectiles que se esquivan moviéndose (el cliente los dibuja adelantados para que la esquiva cuadre). Soldados y centollos no se atraviesan. A 0 de vida, el soldado cae **derribado** 30 s: se arrastra o dispara con fuego lento (nunca las dos cosas), sin habilidades; los centollos lo ignoran y los aliados lo ven tumbado, marcado y en la lista de «Aliados derribados» con flecha y cuenta atrás. Muere si se le acaban los 30 s, si un raso pegado a él lo remata (5 s; matar al raso a tiempo lo salva) o si le alcanza una granada aliada; los aliados ven «¡REMATANDO!». Un aliado lo **rescata** pulsando F a su lado y quedándose quieto 5 s (el derribado no puede moverse mientras tanto); se levanta con 40 de vida. **Sin reaparición:** tras un certificado de defunción de 3 s, el jugador releva a un bot en pie del pelotón; si no queda ninguno, pasa a **espectador**: vista cenital del mapa entero, clic sobre un compañero para seguirle y Esc para volver.
- **Fases de la partida:** al entrar el primer jugador, preparación de 30 s sin centollos; evacuación hasta el último despegue (10:00) y oleada final sin fin. Un letrero arriba lleva la cuenta atrás del despliegue y del próximo despegue. Cuando cae el último soldado (aunque no haya despegado la última lanzadera; no hay tiempo máximo), pantalla de resultado y, a los 15 s, otra partida con todos los conectados (provisional hasta el noticiario y el botón de volver a jugar). Quien entra durante el resultado es espectador.
- **Colonos:** 4 edificios con 50 colonos cada uno. Se activan cuando un soldado pasa a 12 m (desde la evacuación) y sueltan grupos de 10–20 cada 15 s; un rótulo sobre la puerta dice «¿Colonos?» hasta activarlo y luego cuántos quedan. Caminan a la plataforma y esperan allí; con centollos cerca, corren. Los rasos van a por ellos antes que a por los soldados, pero muerden al soldado que les tapa el paso. 50 de vida: una granada aliada los deja malheridos (la granada hiere a todo el mundo).
- Director de oleadas: empieza con la partida y se para al acabar. Abre las madrigueras que amenazan las rutas de los edificios activados. Ritmo de fondo creciente con empujones antes de cada despegue (simulados: 2:30, 5:00, 7:30 y 10:00) y valles cada vez más cortos; madrigueras que se abren por tandas, con aviso, según las rutas de colonos de `map.json`; una granada las tapona y a los 10 s se abre otra; escupidores desde el primer despegue; oleada final al tope de 150. El panel F3 muestra la fase y la cuenta atrás.
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
| F                       | Rescatar al aliado derribado que tienes al lado (una vez; 5 s quieto)     |
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

**Bots headless** (número de bots y, opcionalmente, segundos de duración). Combaten con el comportamiento básico de `shared/src/bot/brain.ts`: encaran al hostil más cercano (la selección automática hace el resto), mantienen la distancia, esquivan escupitajos de lado y usan estimulante, granada y disparo apuntado; sin enemigos patrullan cerca de la plataforma. Cada 5 s informan de tráfico, latencia, vida, daño, muertes y habilidades (`g/a/e`: granadas, apuntados, estimulantes): Para el servidor son jugadores: relevan a los bots del servidor.

```bash
pnpm bots -- 7
pnpm bots -- 7 30   # con 8 se llena el pelotón y no queda sitio para entrar
```

**Prueba de carga** (E7-5): 8 bots que combaten contra 105 rasos y 45 escupidores durante 10 minutos (o los segundos que se indiquen), con los 4 edificios de colonos activados al empezar la evacuación (`BUILDINGS=closed pnpm loadtest` para medir sin colonos), en un servidor propio sin red simulada. Al acabar resume el tick (de CPU y de reloj: media, percentiles, máximo) y la bajada por cliente, y dice si se cumplen NFR-01 (p99 del tick de CPU < 10 ms) y NFR-03 (< 50 KB/s); si no, termina con error.

```bash
pnpm loadtest
pnpm loadtest -- 60
```

**Afinar el director** sin jugar: una partida completa acelerada con 8 soldados que juegan con el cerebro de los bots; dice cuándo mueren y cuántos quedan en pie cada minuto (sin reaparición). Argumentos opcionales: base, empujón, crecimiento y semilla.

```bash
pnpm tune
pnpm tune -- 40 4 0.1 2
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
  shared/   Configuración, mapa, simulación de movimiento, protocolo y cerebro de los bots (lo usan todos)
  server/   Servidor autoritativo (ws)
  client/   Cliente Babylon.js + HUD en HTML/CSS
  bots/     Clientes headless para pruebas
```

Todos los valores de diseño están en `packages/shared/src/config/game.config.ts`.

## Desviaciones conscientes respecto a la spec

- **bitECS solo para los centollos.** Los soldados siguen en un `Map`: son pocos y su estado va ligado a la predicción.
- **Muñecos de prueba**: ninguna historia los pide, pero H2 necesitaba objetivos antes de que lleguen los centollos (ver `docs/decisiones.md`).
- **El cerebro de los bots vive en `shared`** (no es simulación determinista): lo usan los bots headless y lo usarán los compañeros del servidor (E5-6).
- **El cliente pesa ~6 MB** porque importa Babylon entero. Se optimizará con importaciones por módulo más adelante.

## Verificado

- 311 tests (simulación compartida, protocolo, servidor, navmesh, centollos, escupidores, director, selección automática y cliente).
- **Prueba de carga (E7-5, `pnpm loadtest`, 10 min):** 8 bots contra 150 centollos (149,9 de media). Tick de CPU: media 5,2 ms, p99 8,6 ms, máx 17 ms (0,12% por encima de 10 ms) → **NFR-01 ✓**. Tick de reloj: media 6,1 ms, p99 15,2 ms, máx 53 ms (portátil compartido con los bots y otras aplicaciones). Bajada: 23,7 KB/s por cliente → **NFR-03 ✓**. 56.810 de daño hecho y 689 muertes de bots. El tick subió de ~3 a ~7 ms a mitad de la prueba con la máquina más cargada; un banco aislado de 10 minutos simulados se mantiene plano (1,3 ms) y sin crecer en memoria: no hay fuga.
- Bots que combaten (E7-4), 8 bots con 75 ± 20 ms: contra el director, 3,5 min sin una muerte y nunca más de 5 centollos vivos (los números del director se quedan cortos contra 8). Contra 150 centollos permanentes (`CRABS=105 SPITTERS=45`), en 90 s: ~270 abatidos, 73 muertes, 11 granadas, 6 apuntados y 20 estimulantes; ~23 KB/s por cliente y tick de 3,7 ms de media (9 de máximo).
- Director (E4-4), partida simulada con 8 soldados inmortales: vivos 2 en el valle del minuto 3, 45 en el pico del 5, 15 en el valle del 6, 108 en el pico del 10 y 150 en la oleada final; tick en la final 1,36 ms de media y 2,0 de máximo. En el navegador, calma → fondo (20 s) → empujón (110 s) → despegue y valle (150 s), con avisos.
- Escupidores con 75 ± 20 ms (E4-3): uno solo, quieto, 4 impactos en 10 s; moviéndose, 0. Entre que el escupitajo desaparece al tocarte en pantalla y llega el daño, 73–155 ms (menos que la ida y vuelta).
- 105 rasos + 45 escupidores y 8 bots: ~18 KB/s por cliente; tick aislado 1,45 ms de media y 2,3 de máximo con 26 escupitajos en vuelo.
- Selección automática con 150 centollos y 75 ± 20 ms (E3-5): de cara a la masa y sin tocar Tab ni el ratón, 26 impactos en 20 s (la cadencia permite 25) y sin parpadeos del anillo.
- 150 centollos y 8 bots (E4-2): ~18 KB/s de bajada por cliente (NFR-03 pide < 50). Tick: 1,4 ms de media y 2,6 ms de máximo medido aislado; en vivo en un portátil, con los bots y el navegador en la misma máquina, 3,2 ms de media con picos de 10–15 ms por competencia de CPU (las pausas del recolector no pasan de 3 ms). La prueba formal es E7-5.
- Chocar con centollos con 75 ± 20 ms por sentido: correcciones de hasta ~11 cm al avanzar contra ellos; 0 cm el resto del tiempo.
- 8 bots simultáneos: tick medio 0,2–0,5 ms y ~3 KB/s de bajada por cliente (NFR-01 y NFR-03 con mucho margen); el noveno es rechazado.
- Predicción con 75 ± 20 ms por sentido y 2 % de pérdida: 0 cm de corrección andando, girando y con el estimulante.
- Colonos en un navegador headless con 75 ± 20 ms: el aviso al activar un edificio, los grupos que salen y llegan a la plataforma, y 0 cm de corrección andando entre ellos.
- Prueba de carga con los 4 edificios activados (2 min, portátil cargado): p99 del tick de CPU 14,4 ms con colonos frente a 11,1 ms sin ellos en las mismas condiciones (antes, 9,9) → **NFR-01 ✗ en este portátil, también sin colonos**; bajada 23,9 KB/s → NFR-03 ✓. Aislado, el tick con colonos es de 1,9 ms.
- Fases en un navegador headless con 75 ± 20 ms: cuenta atrás del despliegue, N a la evacuación, P a la oleada final, resultado al caer el pelotón (~1 min después) y nueva partida a los 15 s.
- Dos navegadores headless: uno invulnerable y otro que muere, pasa a espectador y sigue al primero con un clic.
- Dos navegadores headless combatiendo: disparos, granada, estimulante y su aura se ven en los dos.
- Prueba jugando de H2 en solitario. Prueba jugando de H3 en red local (wifi del móvil), dos personas: divertido. Pidieron ver el cono de disparo y más alcance para el disparo apuntado (hecho: 50 m).

## En curso: H5, es un juego

H4 hecho: derribado (E5-1), muerte (E5-3), rescate (E5-2), compañeros bot (E5-6), defunción y relevo (E5-4) y espectador (E5-5). Falta la prueba jugando de H4.
H5, partida completa de principio a fin. Hecho: fases (E6-1) y colonos (E6-2). Faltan lanzaderas, sargento, noticiario y nueva partida.
