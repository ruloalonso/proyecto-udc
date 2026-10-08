# Decisiones

Registro breve de decisiones tomadas durante el desarrollo, dos líneas cada una. Las más recientes arriba.

## 2026-10-08 — Director de oleadas (E4-4)

Lógica pura por ticks (`server/src/ai/director.ts`), con todos los números en `game.config.ts`: calma de 20 s, fondo `20 × (1 + 0,25 × minuto)`, empujón × 2,5 los 40 s antes de cada despegue (2:30, 5:00, 7:30, 10:00, simulados hasta H5), valles × 0,15 de 45, 35 y 25 s, oleada final al tope de 150. Escupidores del 10% en el primer despegue al 30% en la final.

## 2026-10-08 — Madrigueras por tandas y rutas de colonos (E4-4)

Las rutas (edificio → plataforma) y las madrigueras que amenazan (a menos de 60 m) son datos de `map.json`; las madrigueras tienen nombre para los avisos. Se abren 2, +1 por despegue y las 6 en la final, primero las que amenazan más rutas: la norte (pegada a la plataforma) la primera; la sur, que no amenaza ninguna, solo en la final. Aviso de 5 s antes de abrir.

## 2026-10-08 — Taponar y reiniciar (E4-4)

Una granada que explota a ≤ 4 m del centro de una madriguera abierta la tapona; a los 10 s se abre otra (la recién taponada solo si no hay otra). El director empieza con el primer soldado y, si no queda nadie, se reinicia y quita los centollos. Con `CRABS`/`SPITTERS` no actúa (pruebas de carga).

## 2026-10-08 — Fuera los centollos de cartón

Con rasos y escupidores de verdad, los muñecos de prueba de H2 sobran: `dummy.enabled` pasa a `false`. El servidor crea el mundo sin ellos; el código se queda (los tests los usan como objetivos fijos).

## 2026-10-08 — IA del escupidor (E4-3)

Va a por el soldado más cercano a 25 m, sin tope de atacantes y siempre soldados. Se acerca hasta 14 m (`spitter.preferredRange`) con línea de visión, se para y escupe cada 2,5 s; solo vuelve a moverse si el objetivo se va a más de 18 m o deja de verlo (si se parase en el borde, andaría y pararía con cada paso del soldado). Velocidad de la spec (3,5 m/s), a afinar jugando.

## 2026-10-08 — Escupitajos (E4-3)

Entidades de bitECS en línea recta hacia donde estaba el objetivo al disparar (sin adelantarse: se esquiva moviéndose), hasta 18 m. Cada tick se mira el tramo recorrido contra soldados (no se atraviesan aunque avancen 0,75 m) y obstáculos; atraviesan a los centollos. Viajan en el snapshot como el resto.

## 2026-10-08 — Escupitajos adelantados en el cliente (E4-3)

Interpolados, se verían ~2 m por detrás y darían antes de llegar al jugador en pantalla. Como su trayectoria es una recta, el cliente los dibuja en el tick en que el servidor verá lo que hace ahora el jugador (dibujado + 2 ticks + ida y vuelta) y los oculta al tocarle o chocar. Medido: el daño llega 73–155 ms después de que desaparezca en pantalla.

## 2026-10-08 — La selección automática la decide el servidor (E3-5)

El servidor sabe al instante qué muere y aplica el retardo exacto (0,25 s desde la muerte); el cliente vería la muerte ~100 ms tarde y el nuevo objetivo llegaría al servidor tras otra ida. El snapshot propio lleva `target`; el cliente mantiene lo elegido a mano hasta que el servidor lo confirma (como mucho 1 s) para que el anillo no parpadee. Sirve también para los bots.

## 2026-10-08 — Qué objetivo se respeta (E3-5)

En la prueba, el objetivo automático se quedaba a la espalda y se dejaba de disparar a los de delante. Uno elegido a mano se respeta hasta que muere; uno automático, mientras se le pueda disparar: si lleva 0,25 s sin poder y hay otro de frente, se cambia. Escape quita el objetivo, y si hay alguno de frente se vuelve a elegir solo.

## 2026-10-08 — bitECS solo para los centollos (E4-2)

Los centollos viven en bitECS 0.4 (`server/src/ecs`), con componentes por columnas; los soldados siguen en un `Map` (pocos y ligados a la predicción). El id de red es el del mundo y una tabla lo traduce al de bitECS, que se recicla.

## 2026-10-08 — Snapshots compactos (E4-2)

Las entidades nuevas viajan completas (`added`); después, movimientos como diferencias enteras en un array plano (`moved: [id, dx, dz, dyaw, …]`) y la vida aparte (`hp`). Sirve porque WebSocket va sobre TCP. 150 centollos corriendo: ~18 KB/s por cliente (antes se estimaban ~90).

## 2026-10-08 — Soldados y centollos chocan (E4-2)

Cada soldado está en el crowd como un agente quieto que se recoloca en cada tick, y tras cada paso se empuja fuera a los centollos que se le meten (DetourCrowd solo separa a medias). Al soldado lo empuja el servidor, fuera de `shared/sim`: con 75 ± 20 ms, correcciones de hasta ~11 cm al avanzar contra ellos.

## 2026-10-08 — IA del centollo raso (E4-2)

Sin objetivo, avanza hacia la plataforma; ve a los soldados a 25 m (`crab.aggroRange`) y va a por el más cercano que tenga hueco (como mucho 3 por soldado). Muerde al llegar y luego cada segundo. Mira hacia donde va y, parado, a su objetivo. Los que no tienen hueco siguen hacia la colonia. Colonos y remate, en H5 y H4.

## 2026-10-08 — Reaparición provisional y modo de prueba (E4-2)

Hasta el derribado (H4), a 0 de vida el soldado reaparece al momento en la plataforma con la vida llena y un aviso. Hasta el director (E4-4), `CRABS=N` mantiene N centollos vivos saliendo por turnos de las madrigueras. Los muñecos siguen (`dummy.enabled`).

## 2026-10-08 — Tiempo de tick con 150 centollos (E4-2)

Aislado, 1,4 ms de media y 2,6 de máximo. En vivo en el portátil, con 8 bots y el navegador en la misma máquina, 3,2 ms de media y picos de 10–15 ms; no son del recolector (pausas ≤ 3 ms), sino de competencia de CPU. La prueba formal (E7-5) debe medir sin bots en la misma máquina, o el tiempo de CPU del proceso.

## 2026-10-08 — Navmesh: geometría de cajas y poda (E4-1)

Se genera en el servidor con recast-navigation: un suelo del tamaño del mapa y cada obstáculo como una caja. Recast deja islas caminables dentro de los edificios (bajo el tejado cabe un agente) y encima de ellos; se desactiva todo lo que no está conectado con la plataforma. Así vale para cualquier mapa.

## 2026-10-08 — Parámetros de la navmesh (E4-1)

Margen de 0,5 m respecto a los obstáculos (≥ radio de cualquier agente) y celdas de 0,25 m, en `game.config.ts`; el resto de parámetros de Recast son técnicos y van comentados en `navmesh.ts`. Tarda ~0,3 s al arrancar. En la prueba previa, DetourCrowd con 150 agentes costó ~0,9 ms por tick.

## 2026-10-08 — H4 sigue siendo un hito aparte

Se cierra sin fusionar el PR #33, que metía E5 en H3: sin reaparición, el derribado y la muerte necesitan el relevo en bots y el espectador. H4 queda como "Derribado, rescate, muerte y relevo" (E5-1 a E5-6). En H3, a 0 de vida el soldado reaparece al momento en la plataforma, de forma provisional.

## 2026-10-08 — Rematado es muerte; sin captura

Un derribado que no se rescata a tiempo, o al que remata un centollo, muere ("asimilado" en el GDD). La captura del GDD (prisioneros) no entra en este prototipo. Viene del PR #33.

## 2026-10-08 — Alcance de H3

Las partes de H3 que dependen de H5 se completan allí: priorizar colonos (E6-2), saltar fase (E7-3) y ligar la oleada final a las fases (E6-1). Hasta entonces, la oleada final se lanza con un comando. bitECS, instancing y snapshots compactos van dentro de E4-2. Los muñecos de prueba se mantienen, con una opción para quitarlos. Viene del PR #33.

## 2026-10-08 — Rutas y despegues simulados en H3

El director ata picos y madrigueras a despegues y rutas de colonos, que llegan en H5. En H3, las rutas (con las madrigueras que amenaza cada una) son datos de `map.json`, todas activas, y el calendario de despegues va en `game.config.ts`. En H5 se enganchan a los edificios activados y a las lanzaderas.

## 2026-10-08 — Clímax de la última muerte (E6-4)

Cuando cae el último soldado: cámara lenta de 2–3 s sobre él, frase final del sargento y fundido al noticiario. Reutiliza piezas existentes (cámara y mensajes del sargento).

## 2026-10-08 — Edificios activados por el pelotón (E6-2)

Un edificio se activa por proximidad, sin botón ni quedarse, y suelta colonos por grupos hasta vaciarse. Las lanzaderas despegan a su hora, así que activar tarde cuesta colonos: ese reloj impide acomodarse. De lejos no se sabe cuántos hay dentro. Los colonos entran en pánico y corren con centollos cerca. Activarlo sin querer se acepta de momento.

## 2026-10-08 — Quien llega tarde ocupa un bot

Con la partida empezada, un jugador nuevo ocupa un bot en pie del pelotón. Si no queda ninguno, entra como espectador hasta la siguiente partida.

## 2026-10-08 — Bots compañeros: soldados del servidor (E5-6)

Los compañeros son soldados cuya entrada genera el servidor en cada tick. Al relevar, la conexión del humano pasa a esa entidad. Los bots headless de E7-4 se quedan para las pruebas de red y carga, con el comportamiento básico que luego heredan los del servidor.

## 2026-10-08 — Sin reaparición: escuadrón suicida de 8 (E5-4, E5-5)

Cada soldado muerto es un fusil menos para siempre: la sangría del pelotón es la tensión y el rescate, el centro. Al morir se releva a un bot en pie o, si no queda ninguno, se pasa a una vista cenital fija desde la que se puede seguir a un compañero. Órdenes desde la cenital, aplazadas.

## 2026-10-08 — Madrigueras taponables con la granada (E4-4)

Una granada sobre una madriguera la tapona. ~10 s después se abre otra que amenace las rutas de los colonos, con aviso. Las madrigueras activas nunca bajan: taponar compra calma en un frente, no terreno. Granada para el grupo de encima o para cerrar un frente.

## 2026-10-08 — Los escupidores llegan con el primer despegue (E4-3)

Las primeras oleadas son solo de rasos, para aprender la unidad básica. El primer escupidor entra con el primer despegue (~2,5 min, un pico del director) y la proporción sube hasta el 30%. El momento es una perilla de `game.config.ts`.

## 2026-10-08 — Sin equipamiento

El recluta sale con su fusil estándar: sin inventario, botín ni pérdida de objetos al morir. Perder lo que llevas encima, el botín y la captura e intercambio de prisioneros se aplazan (no se cancelan) hasta que haya equipo que perder.

## 2026-10-08 — Rescate de 5 s y remate de 3 s (E5-2, E5-3)

Matar es más fácil que salvar, pero el remate deja una ventana para matar al centollo. No se empieza a rescatar a quien están rematando, y mientras alguien rescata los centollos le atacan a él. Tope de 3 atacantes cuerpo a cuerpo por objetivo (los escupidores no tienen tope); va en E4-2.

## 2026-10-08 — Derribado con algo de agencia (E5-1)

Derribado, se arrastra muy despacio o dispara con fuego lento, nunca las dos cosas, y sin habilidades. Para el rescate tiene que estar quieto. Pedir ayuda se aplaza hasta que haya sonido o marcadores. La granada aliada mata al derribado: castiga lanzarla a bulto.

## 2026-10-08 — Puntuación colectiva (E6-4)

La puntuación es del pelotón: colonos salvados en común, sin marcador individual ni de héroes. Así rescatar tiene sentido: un fusil más en pie salva más colonos.

## 2026-10-08 — Ocho rasos y un sargento de atrezo (E6-6)

Todos los soldados son rasos iguales; el mando jugable es de otro prototipo. Un sargento NPC solo de voz/texto, satírico (La chaqueta metálica), narra el desastre como gloria del Estado. Los textos los escribe Raúl; el código deja el sistema y textos provisionales.

## 2026-10-08 — Madrigueras por tandas (E4-4)

El director empieza con 1–2 frentes, abre más según sube la intensidad y usa las 6 en la oleada final. Elige las que amenazan las rutas de los colonos y avisa unos segundos antes de abrir una nueva.

## 2026-10-08 — Director en dientes de sierra (E4-4)

Empujón, valle de calma, empujón mayor, valle más corto: en los valles se rescata y se recoloca la línea. Los picos coinciden con los despegues. La oleada final aparece al tope sin parar. Los números, en `game.config.ts`, se afinan jugando.

## 2026-10-08 — Pelotón siempre de 8, con bots

La misión es para 8 y la carga de centollos es fija: se quita el factor de jugadores de §4.4. Los puestos libres los ocupan bots, que tienen que ser buenos compañeros (1 humano + 7 bots). Por fases: básicos en H3 y H4, buenos compañeros con el combate afinado.

## 2026-10-08 — Sin bogavante en este prototipo

Con raso y escupidor basta para saber si el combate es divertido. Aplazado: será el rompemuros, que castiga quedarse quieto en formación, y entra cuando el bloqueo de soldados esté probado.

## 2026-10-08 — Los soldados nunca sobreviven

Sin evacuación heroica excepcional: la primera partida enseña que vas a morir, eres reemplazable e importa a cuánta gente salvas. A cambio, el noticiario tiene que distinguir con claridad una masacre de una evacuación heroica.

## 2026-10-07 — Tab-target y no shooter

Se valoró un shooter en tercera persona (Gears, Helldivers) y un disparo direccional sin objetivo. Se mantiene el tab-target: el objetivo es un MMO con mucha gente, PvE y algo de PvP, la puntería real exige compensación de retardo y el juego (vidas que envejecen, capa estratégica) premia decidir y colocarse, no los reflejos. Mundo plano.

## 2026-10-07 — El cono de ±20° se queda

Obliga a encarar al objetivo y moverse, y da algo de "mano" al tab-target. El ángulo es una perilla de `game.config.ts` que se calibra con el enjambre en H3 (si contra 150 centollos se pasa la pelea girando, se abre).

## 2026-10-07 — Selección automática (E3-5)

Con tantos enemigos, jugar era pulsar Tab sin parar. Sin objetivo o al morir el actual, se selecciona solo el más cercano dentro del cono, tras ~0,25 s; el actual se respeta hasta que muere; clic y Tab mandan al momento. El más cercano porque es el que amenaza y se entiende por qué lo eligió; lo listo (ir a por el escupidor del fondo) lo decide el jugador con el clic.

## 2026-10-07 — Fuego amigo solo en la granada (E3-6)

La granada daña a los aliados: castiga lanzarla a bulto. El fuego automático los atraviesa sin dañarlos; como dispara solo, con soldados hombro con hombro sería frustración constante.

## 2026-10-07 — Los soldados bloquean a los centollos

Los centollos no atraviesan a los soldados: una posición se puede defender y el mapa importa. Sustituye a "sin colisión con los soldados (como los centollos)" de los muñecos de E2-4. Entre soldados sigue sin haber colisión. El cliente no predice el choque con centollos; medir las correcciones en H3.

## 2026-10-07 — Carácter del enjambre (E4-2)

Depredadores hambrientos: prefieren colonos indefensos, no planean flanqueos y, si un soldado les tapa el paso, se paran a morderlo. El desbordamiento por los flancos sale de la presión de la masa, no de una táctica. Es barato (cada uno va a por lo más cercano según prioridad) y hace que el muro frene pero no sea eterno.

## 2026-10-07 — Disparar solo hacia delante (prueba de H2)

En la prueba, disparar a lo que se tiene a la espalda se veía mal. El fuego automático y el disparo apuntado exigen que el objetivo esté en el cono frontal del soldado (±20°, `combat.facingHalfAngle`; se probaron ±90° y ±60° y eran demasiado anchos: hay que encarar al objetivo); si no, el anillo se pone gris. Es el cono del cuerpo, no el de la cámara: orbitar con el botón izquierdo no impide disparar. Tab sigue usando el de la cámara.

## 2026-10-07 — Respuestas de la prueba de H2

Fuego automático, sí (no disparo manual repetido). Disparar en movimiento, sí, sin penalización. Los números de combate valen de momento. Falta probar con varios jugadores en red.

## 2026-10-07 — Pérdida de paquetes simulada como en TCP (E7-2)

WebSocket va sobre TCP, así que un paquete perdido se retransmite y bloquea lo que viene detrás; no se tiran mensajes (rompería los deltas). `SIM_LOSS` añade `SIM_RTO_MS` al mensaje perdido, y cada conexión y sentido tiene su cola (antes había una sola para todo el servidor).

## 2026-10-07 — Tiempo de tick en el panel F3 (E7-1)

El servidor manda cada segundo un mensaje `stats` con la media y el máximo del tick. El panel pinta en rojo lo que supera NFR-01 y NFR-03 (presupuestos en `game.config.ts`).

## 2026-10-07 — HUD de combate (E3-4)

Arriba, el recluta, el marco del objetivo (con el motivo si no se le puede disparar) y los avisos; abajo, el lanzamiento, la vida y la barra de habilidades. Las casillas se atenúan si no se pueden usar por algo que no sea el enfriamiento (eso ya lo muestra el barrido).

## 2026-10-07 — Avisos al usar habilidades (E3-4)

Como en WoW, pulsar algo que no se puede usar muestra el motivo ("Fuera de alcance", "Quieto para apuntar, recluta"...). Es una previsión del cliente: decide el servidor. Además, el cliente ya no manda el disparo apuntado si se está moviendo.

## 2026-10-07 — Señal de daño recibido y panel F3 (E3-4)

El destello rojo salta cuando baja la vida propia del snapshot; en H2 nada daña a los soldados, así que se verá en H3. El panel de depuración pasa a estar oculto por defecto (F3 lo muestra), como dice §3.3.

## 2026-10-07 — Las habilidades viajan en la entrada (E3-2)

El uso de habilidad va dentro del mensaje `input`, no en un mensaje `ability` aparte (§7.4). El servidor lo aplica en la misma entrada en que lo predice el cliente: el estimulante cambia la velocidad y la predicción sigue exacta.

## 2026-10-07 — Disparo apuntado (E3-2)

Usa el objetivo actual. Moverse (W, S, Q, E) lo interrumpe; girar no. Necesita alcance y visión al empezar y al terminar, y el fuego automático se detiene mientras se apunta. Su enfriamiento empieza al completarlo; si se interrumpe, solo cuenta el global.

## 2026-10-07 — Granada (E3-2)

Retícula en el suelo y clic, como en WoW; más allá de 20 m cae a 20 m en esa dirección. El segundo de la spec es el vuelo. Se lanza por encima de los muros, pero la explosión no atraviesa obstáculos (cobertura). Fuego amigo aplazado hasta que los soldados reciban daño.

## 2026-10-07 — Estimulante y vida del soldado (E3-2)

La velocidad extra se cuenta en entradas dentro del estado de movimiento compartido. Los soldados tienen 100 de vida desde ya (en el snapshot propio); la curación no pasa del máximo.

## 2026-10-07 — Línea de visión (E3-3)

Segmento entre centros contra las cajas del mapa; rozar un borde o una esquina no tapa. El mundo es plano, así que todo obstáculo tapa, también los contenedores bajos. Sin visión no se dispara ni se gasta el enfriamiento, y el objetivo se conserva (como en WoW).

## 2026-10-07 — Tab y anillo con línea de visión (E3-3)

Tab descarta los objetivos tapados desde la posición del soldado; el clic sigue permitiendo seleccionarlos. El anillo se pone gris si no se le puede disparar (lo calcula el cliente con la misma función; solo es un aviso).

## 2026-10-07 — Soldados sin colisión entre sí (E3-1)

Con latencia, el otro soldado se dibuja ~250 ms por detrás de donde está en el servidor respecto a la predicción propia (>1 m a 5 m/s): el choque no se puede predecir de forma exacta. Como en WoW, no colisionan; se actualiza §7.5 de la spec.

## 2026-10-07 — Fuego automático (E3-1)

Se dispara también en movimiento (confirmado en la prueba de H2). El enfriamiento es del arma: cambiar de objetivo no permite disparar antes. Solo se dispara hacia delante: ver "Disparar solo hacia delante".

## 2026-10-07 — Muñecos con vida (E3-1)

60 de vida (como el escupidor) y reaparición a los 5 s en el mismo sitio, como entidad nueva. Así el objetivo se quita solo al morir, igual que pasará con los centollos.

## 2026-10-07 — Eventos y números de daño (E3-1)

Los eventos de otros se muestran en el tick interpolado (cuadran con lo que se ve) y los propios al llegar. Las entidades eliminadas se quitan al dibujar ese tick, no al llegar el snapshot. Cada jugador solo ve los números de su propio daño; se hacen en E3-1 y no en E3-4.

## 2026-10-07 — Selección de objetivo (E2-4)

Solo se seleccionan entidades hostiles; Escape quita el objetivo (sin él, el fuego automático no pararía). El objetivo se marca con un anillo en el suelo, no con contorno, porque es más barato y sirve con instancing.

## 2026-10-07 — Muñecos de prueba en E2-4

El resultado de H2 es "combate contra muñecos de prueba", pero ninguna historia los crea. Se crean en E2-4, la primera que necesita objetivos hostiles: estáticos, posiciones en `map.json`, sin colisión con los soldados (como los centollos). Vida y reaparición, en E3-1.

## 2026-10-07 — Fusión de PR

El usuario da el visto bueno (y prueba los cambios visuales); entonces Claude fusiona con squash y borra la rama.

## 2026-10-07 — Flujo con GitHub Issues

Cada historia es una issue y cada hito un milestone; plan revisado antes de codificar, rama propia, PR con "Closes #N" y CI como filtro. Al terminar cada hito, prueba jugando.

## H1 — Sin ECS hasta H3

Con pocos soldados basta un `Map`. bitECS entra en H3 con los centollos.
