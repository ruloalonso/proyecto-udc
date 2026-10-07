# Decisiones

Registro breve de decisiones tomadas durante el desarrollo, dos líneas cada una. Las más recientes arriba.

## 2026-10-07 — Selección de objetivo (E2-4)

Solo se seleccionan entidades hostiles; Escape quita el objetivo (sin él, el fuego automático no pararía). El objetivo se marca con un anillo en el suelo, no con contorno, porque es más barato y sirve con instancing.

## 2026-10-07 — Tab sin línea de visión hasta E3-3

Tab elige por alcance y cono de cámara, sin mirar obstáculos. Cuando exista la línea de visión (E3-3), Tab descartará los objetivos tapados. El clic ya respeta los obstáculos.

## 2026-10-07 — Muñecos de prueba en E2-4

El resultado de H2 es "combate contra muñecos de prueba", pero ninguna historia los crea. Se crean en E2-4, la primera que necesita objetivos hostiles: estáticos, posiciones en `map.json`, sin colisión con los soldados (como los centollos). Vida y reaparición, en E3-1.

## 2026-10-07 — Fusión de PR

El usuario da el visto bueno (y prueba los cambios visuales); entonces Claude fusiona con squash y borra la rama.

## 2026-10-07 — Flujo con GitHub Issues

Cada historia es una issue y cada hito un milestone; plan revisado antes de codificar, rama propia, PR con "Closes #N" y CI como filtro. Al terminar cada hito, prueba jugando.

## H1 — Soldados sin colisión entre sí

Solo colisionan con el mapa para que la predicción sea exacta (la spec §7.5 pide colisión entre jugadores). Se revisa en E3-1.

## H1 — Sin ECS hasta H3

Con pocos soldados basta un `Map`. bitECS entra en H3 con los centollos.
