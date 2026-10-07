# Decisiones

Registro breve de decisiones tomadas durante el desarrollo, dos líneas cada una. Las más recientes arriba.

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

Se dispara también en movimiento y sin mirar al objetivo (pregunta abierta de §11, se decide jugando). El enfriamiento es del arma: cambiar de objetivo no permite disparar antes.

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
