# Decisiones

Registro breve de decisiones tomadas durante el desarrollo, dos líneas cada una. Las más recientes arriba.

## 2026-10-07 — Muñecos de prueba en E3-1

El resultado de H2 es "combate contra muñecos de prueba", pero ninguna historia los crea. Se incluyen en E3-1: objetivos estáticos colocados por el servidor que reaparecen, con valores en `game.config.ts`.

## 2026-10-07 — Flujo con GitHub Issues

Cada historia es una issue y cada hito un milestone; plan revisado antes de codificar, rama propia, PR con "Closes #N" y CI como filtro. Al terminar cada hito, prueba jugando.

## H1 — Soldados sin colisión entre sí

Solo colisionan con el mapa para que la predicción sea exacta (la spec §7.5 pide colisión entre jugadores). Se revisa en E3-1.

## H1 — Sin ECS hasta H3

Con pocos soldados basta un `Map`. bitECS entra en H3 con los centollos.
