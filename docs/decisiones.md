# Decisiones

Registro breve de decisiones tomadas durante el desarrollo, dos líneas cada una. Las más recientes arriba.

## 2026-10-07 — H4 se integra en H3

En cuanto los centollos hacen daño, a 0 de vida tiene que pasar lo de verdad: derribado, rescate por aliados o remate y muerte. E5 entra en el milestone H3, justo después del centollo raso; H4 desaparece como hito aparte (§9 de la spec).

## 2026-10-07 — Rematado es muerte; sin captura

Un derribado que no se rescata a tiempo, o al que remata un centollo, muere ("asimilado" en el GDD). La captura del GDD (prisioneros) no entra en este prototipo.

## 2026-10-07 — Alcance de H3

Las partes de H3 que dependen de H5 se completan allí: priorizar colonos (E6-2), saltar fase (E7-3) y ligar la oleada final a las fases (E6-1); hasta entonces, la oleada final se lanza con un comando. bitECS, instancing y snapshots compactos van dentro de E4-2. Los muñecos de prueba se mantienen, con una opción para quitarlos.

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
