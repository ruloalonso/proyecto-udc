# Decisiones

Registro breve de decisiones tomadas durante el desarrollo, dos líneas cada una. Las más recientes arriba.

## 2026-10-13 — Se oyen los disparos de los aliados (E6-7)

Jugando, solo se oían los propios, y el combate de los compañeros parecía mudo. Ahora suenan los de los aliados desde donde están, atenuados por la distancia, a la mitad de volumen y con un tope conjunto de uno cada 120 ms (con 7 disparando no es un estruendo); los apuntados, enteros.

## 2026-10-13 — Disparo apuntado con más poder (E3-2)

Jugando, casi no merecía la pena: 35 de daño en 1,5 s quietos, sin fuego automático (que hace 12,5 por segundo), daban +16 cada 6 s, y quieto era imposible usarlo con el enjambre encima. Ahora 60 de daño (mata de un tiro a un raso o a un escupidor) en 1 s y se puede mover mientras apunta: +47 cada 6 s. Los bots, mientras apuntan, combaten de cara a su objetivo esquivando de lado.

## 2026-10-13 — Ajustes tras jugar (E4-2, E4-3)

Escondido en una esquina, la partida no acababa: sin nada a 25 m, los centollos iban a la plataforma y la oleada final no tiene tiempo máximo. Ahora, sin colonos que oler, rasos y escupidores van hacia el soldado en pie más cercano esté donde esté (con el mismo replanificado cada 8 m que el olfato); a la colonia, solo si no queda nadie en pie.

## 2026-10-12 — Sala de espera en la nave (E6-9, E7-7)

Tras jugar en solitario: la partida empieza en una sala, no al entrar. La sala es la bodega de la nave de transporte, con los reclutas que esperan; el anfitrión (quien entró primero; si se va, el siguiente) empieza cuando están todos listos, y quien sigue leyendo el noticiario cuenta como «no listo» (bloquea, decidido así). Al empezar, la nave aterriza, el pelotón sale por la rampa y la nave se queda como primera lanzadera. Quien llega con la partida en marcha elige encarnar un bot o mirar. El servidor solo simula durante una partida (en reposo sin ella). Implementado (12 oct 2026): cada conexión está en la sala, en la partida o en el noticiario; la sala es un modo del cliente (la bodega, escena 3D aparte) y la partida no se desmonta: al volver a la nave se limpia el mundo y el servidor lo manda de nuevo desde cero. En el resultado, pasado el clímax, la partida se cierra y el bucle de ticks se para. Los bots headless se marcan listos y empiezan solos, o se unen encarnando un bot si ya hay partida (la prueba de carga depende de ello). Despliegue: los primeros 5 s de la preparación (`match.deploy`) el servidor anula movimientos y habilidades y el cliente manda lo mismo (corrección de predicción 0 cm al empezar a moverse); la nave baja desde 14 m, no desde los 60 de las lanzaderas, porque desde la plataforma no se veía. La bodega muestra siempre el pelotón de 8: los bots, de pie y sin cartel (en fila se amontonaban), y en la lista una sola línea («6 bots del Alto Mando, listos»); los jugadores que pasan de 8, «En reserva».

## 2026-10-12 — Lo que faltaba en el HUD (E2-6, E2-7, E2-8, E5-8, E6-8)

Tras jugar en solitario: un panel del pelotón a la izquierda (vida, derribados con su cuenta atrás, muertos tachados) que sustituye a la lista «Aliados derribados»; flechas rojas en el borde de la pantalla hacia los derribados, como la del edificio; una brújula con marcas del edificio y las madrigueras (se hablaba del «norte» sin saber dónde estaba); el número en el cartel de cada edificio; y el apodo con el número de cuerpo al relevar («Rulo #2»). Las marcas de la brújula se reparten en horizontal sin pisarse (en vertical no caben, con los cardinales arriba): dos detrás por el mismo lado van una junto a otra, la más por detrás pegada al borde.

## 2026-10-12 — El NAS aguanta (E7-6, Parte D)

`docker compose run --rm loadtest` en el NAS (J1800) suspendía NFR-01 (p99 de CPU de 19 ms; de reloj, 78 ms), pero con los 8 bots en los mismos 2 núcleos. Midiendo solo el servidor, con los clientes fuera: 1 jugador y 7 bots del servidor, tick medio de 1,5–6,7 ms y máximos por debajo de 40 ms; 8 bots desde el Mac, 2–6,8 ms y algún pico de 35–45 ms (cada tick tiene 50 ms). Vale para la prueba con jugadores. En el resultado, pasado el clímax, se retiran los centollos: con la pestaña abierta en el noticiario la partida espera (E6-5) y seguían costando ~2,8 ms por tick. La bajada por cliente de los registros se divide ahora entre las conexiones (con 1 vivo y 7 espectadores salía 8 veces más).

## 2026-10-12 — Despliegue en Docker (E7-6, #90)

Para jugar con gente de fuera, en el NAS del usuario (QNAP TS-251, Celeron J1800, 4 GB) con `docker compose`: el servidor sirve también el cliente compilado y el WebSocket por el mismo puerto (`/ws`), así basta un puerto y funciona detrás de un túnel con HTTPS. Sin abrir puertos: túnel de Cloudflare (o Tailscale Funnel, ya instalado en el NAS). Contenedor sin privilegios, de solo lectura, sin carpetas del NAS y con límites; servidor sin administración y con topes de mensaje y conexiones. Sin redes propias: en el QNAP, crear una desde compose falla («AddNATrule … dnsmasq add fail»), así que el juego va en la red puente de serie, el túnel comparte la del juego y la prueba de carga va sin red. Los archivos de los recursos compartidos del QNAP llevan ACL, que Docker copia a la imagen: el usuario `node` no podía leer el código aunque los permisos normales lo dejaran, así que se copia como suyo (`COPY --chown=node:node`). El servidor sigue con tsx (sin paso de build). Falta medir el NAS (Parte D).

## 2026-10-12 — Sonido básico (E6-7, #88)

Ocho archivos OGG de los packs CC0 de Kenney (Sci-Fi, Impact e Interface Sounds; 408 KB, licencia en `client/public/sounds/LICENCIA.md`), con la Web Audio API y disparados por eventos que ya llegan: solo el disparo propio (los de los demás serían un estruendo), con un tope por sonido. Lo de lejos se oye más bajo según dónde mira la cámara (entero hasta 15 m, nada a 110), salvo los avisos (madriguera, despegue, nave), que nunca se apagan del todo. El audio arranca al alistarse (el navegador exige un gesto). Volumen y silencio se guardan en el navegador: no afectan a la partida.

## 2026-10-12 — Compañeros que rescatan y escoltan (E5-7, #86)

Un coordinador del pelotón (`shared/src/bot/squad.ts`) reparte órdenes cada 0,5 s y cada bot las cumple con su cerebro y el camino de la navmesh. Rescate: margen = lo que le queda al derribado − (camino / velocidad + 5 s); va el bot que llega antes al de menor margen positivo, sin distinguir jugadores de bots. Medido con `pnpm tune` (ahora con los bots del servidor): plantarse junto al derribado con centollos cerca derribaba también al rescatador (el pelotón caía en cadena), así que con peligro espera combatiendo hasta que se despeja o el margen baja de 3 s; repartidos por la ruta, los escoltas morían solos, así que escoltan en grupo; que el derribado se arrastrara hacia sus compañeros empeoraba y se descartó.

## 2026-10-12 — Crecimiento del director a 0,05 (E5-7)

Con el crecimiento a 0,1, el último empujón (90 s a × 3, #83) llenaba el mapa y el pelotón se derrumbaba de golpe con o sin rescates (8:22, 29 de 30 partidas antes de la oleada final). Con 0,05 (30 partidas, con E5-7): cae a las 10:11, solo 9 de 30 antes de la final y de esas solo 3 en menos de 2 min; 159 colonos a salvo (eran 100). Apenas cambia el principio (minuto 3: 46 centollos/min en lugar de 52). A confirmar jugando.

## 2026-10-12 — Volver a filas (E6-5)

El noticiario lleva el botón «Volver a filas» (o Intro) y ya no hay cuenta atrás: la partida nueva empieza cuando lo han pulsado todos los conectados, sin límite de tiempo (decidido así; alguien conectado y ausente la bloquea hasta que pulse o se desconecte). Quien se va deja de contar. El servidor manda `rematchStatus` (cuántos listos de cuántos) y los bots headless pulsan solos al ver el resultado. Se quita `match.resultSeconds`.

_Sustituida por «Sala de espera en la nave» (12 oct 2026): del noticiario se vuelve a la sala cuando cada uno quiere, y la partida la empieza el anfitrión._

## 2026-10-12 — Presión mientras sale la fila (E4-4, #80)

Jugando, el viaje 2 fue muy fácil: la fila sale justo tras aterrizar la nave, en el valle de calma, y el empujón (40 s antes del despegue) solo pillaba su final. Medido con `pnpm tune` (5 semillas): más centollos solos no van a por la fila, acaban en la nave y en los soldados. Se queda la combinación C: empujón de 90 s a × 3, valles de 20/15/10 s y rasos que, sin presa a la vista, huelen al colono más cercano (replanifican cada 8 m). En el viaje 2, de 24 a 33 centollos de media y ya mueren colonos por el camino; el pelotón cae a la misma hora (~8:30, con bots que no rescatan). Aislado, el tick no cambia (media ~0,97 ms; p99 de 3,7 a 4,1 ms). `pnpm loadtest` de 10 min: p99 del tick de CPU 8,10 ms y 23,9 KB/s ✓. A confirmar jugando.

## 2026-10-12 — Parte de bajas por enemigos abatidos (E6-4)

Pedido tras probarlo: el parte del noticiario se ordena de más a menos enemigos abatidos (a igualdad, por orden de caída). Se ordena solo al pintarlo: el servidor lo sigue mandando en orden de caída, que el clímax usa para saber quién cayó el último. La puntuación sigue siendo los colonos a salvo.

## 2026-10-12 — Sin nadie en pie, fin de la partida (E5-3, #79)

Tras probar jugando: con todo el pelotón derribado (jugadores y bots) nadie puede rescatar, y esperar 30 s a que se desangren no aporta nada. Mueren todos a la vez, del primero que cayó al último (el clímax es sobre el último), con la causa `alone` en el certificado, y la partida pasa al resultado.

## 2026-10-12 — Edificio evacuado y carteles en la fachada (E6-2, #78)

Tras probar jugando: un edificio vacío deja de marcarse (columna, resaltado y flecha) y su cartel dice «Evacuado»; el director sigue amenazando su ruta hasta que abre el siguiente. Los rótulos flotaban delante de la puerta y se veían mal; encima del tejado se salían de la pantalla con la cámara normal, así que pasan a ser carteles en lo alto de la fachada de la puerta, la que da a la plataforma.

## 2026-10-12 — Noticiario y parte de bajas (E6-4)

Pedido al plantear E6-4: el noticiario lleva, además de las cifras del pelotón, un parte por soldado con sus enemigos abatidos (quien da el golpe final) y sus rescates. Es un parte de bajas en el orden en que cayeron, no una clasificación: la puntuación sigue siendo los colonos a salvo. Veredicto por la fracción salvada (masacre < 25 %, heroica ≥ 60 %, `match.verdict`); textos en `client/src/texts/noticiario.json`. El resultado dura 20 s (eran 15) hasta E6-5.

_Sustituida en parte por «Parte de bajas por enemigos abatidos» (12 oct 2026): el orden._

## 2026-10-12 — Clímax de la última muerte, implementado (E6-4)

Solo en el cliente: el reloj con el que se dibuja el mundo interpolado va a 0,35× durante 2,5 s (`match.climax`) y la cámara gira alrededor del último soldado; como muere derribado y su entidad desaparece, deja un cuerpo en el suelo. El fundido al noticiario empieza antes de acabar y, ya tapado, el reloj vuelve al presente. La historia de las entidades remotas se guarda lo justo para ese retraso. Quien entra con el resultado en pantalla va directo al noticiario.

## 2026-10-12 — Colonos caídos en el suelo (E6-2, #74)

Un colono muerto deja su cuerpo tumbado 20 s donde cayó y luego se hunde; los que embarcan no dejan cuerpo. Es solo visual: el servidor avisa con el evento `colonistKilled` y el cliente pinta el cuerpo (como mucho 120, en `colonists.corpse`).

## 2026-10-09 — Naves que embarcan al llegar y se pueden destruir (E6-3, #72)

Los colonos embarcan según llegan (se acabó el amontonarse en la plataforma). A cambio la nave tiene 800 de vida: la atacan los rasos a menos de 22 m de la plataforma (hasta 12), los escupidores si les queda más cerca que un soldado y las granadas propias; solo en la evacuación y la oleada final. Destruida, explota (150 en 15 m, mata a los derribados) con los de a bordo; el viaje se pierde y la de reemplazo llega a los 45 s y despega a la hora del siguiente. El Alto Mando abre un edificio por nave que aterriza, cuando se vacía el anterior: nunca dos filas.

## 2026-10-09 — Sin remate en el suelo (E5-3, #70)

Jugando, rodeado de centollos, el derribado moría rematado casi al instante. Ahora un derribado deja de ser objetivo de rasos y escupidores; solo muere por tiempo (30 s) o por una granada. Se quitan el temporizador del remate, sus eventos, la causa de muerte y el «¡REMATANDO!».

## 2026-10-09 — Evacuación por orden del Alto Mando (E6-2, #68)

Los soldados ya no abren edificios: el Alto Mando abre uno por viaje de lanzadera (al empezar la evacuación y al despegar cada una de las tres primeras), en orden al azar, y sus colonos salen de uno en uno cada 2 s (`colonists.releaseInterval`). Da un objetivo claro (escoltar una fila por una ruta) y encaja con el director, que amenaza esa ruta. Se avisa con texto (aviso y `evacuate` del sargento) y a la vista: columna de luz, rótulo resaltado y flecha en el borde.

_Sustituida en parte por «Naves que embarcan al llegar y se pueden destruir» (12 oct 2026): el edificio no se abre al despegar, sino uno por nave que aterriza, cuando se ha vaciado el anterior._

## 2026-10-09 — Sargento Recio (E6-6)

Solo en el cliente: todos sus momentos ya llegan como eventos o mensajes. Textos en `client/src/texts/sargento.json` (nombre y frases con huecos), provisionales hasta que los escriba Raúl; la frase se elige con el tick del servidor, así todos leen la misma. Panel propio con cola (se descartan antes las muertes que la oleada final); los avisos genéricos se mantienen.

## 2026-10-09 — Apodos sobre los jugadores (E2-5)

Historia nueva, pedida para distinguir a los compañeros humanos de los bots: sobre cada soldado de un jugador, su apodo (no el número de recluta, que cambia con cada relevo); sobre los bots, nada. Viaja al aparecer la entidad y en el evento `control`. Etiqueta HTML proyectada, de tamaño constante y visible a través de las paredes; no sobre el propio personaje.

## 2026-10-09 — Lanzaderas (E6-3)

Los despegues los cuenta la partida (`Match`), no el director: funcionan también en el modo de prueba con `CRABS`. El calendario pasa a `shuttles.launches`. Al despegar embarcan los colonos que están en la plataforma, sin límite de plazas; el mensaje `match` lleva despegues, próximo despegue y colonos a salvo, y el evento `launch`, los que suben.

_Sustituida en parte por «Naves que embarcan al llegar y se pueden destruir» (12 oct 2026): los colonos embarcan según llegan, no al despegar._

## 2026-10-09 — Tras la última lanzadera, nadie más sale

Con el último despegue los edificios dejan de activarse y de soltar colonos: los que quedan dentro o en el mapa están abandonados. La lanzadera solo se ve (no choca); los colonos esperan en un anillo de 4 m del centro hasta casi el borde. Animación: sube en 5 s, la siguiente baja a los 15 s y tarda 5 s.

_Sustituida en parte por «Naves que embarcan al llegar y se pueden destruir» (12 oct 2026): la nave ya no solo se ve, tiene casco y se la puede destruir (sigue sin cortar el paso). Siguen vigentes que nadie sale tras el último despegue, el anillo de espera y la animación._

## 2026-10-09 — Colonos (E6-2)

Cuatro edificios de 50 colonos. Un soldado en pie a 12 m del edificio lo activa (solo en la evacuación y la oleada final); suelta un grupo de 10–20 al momento y otro cada 15 s por su puerta (`exit` en `map.json`). Caminan a 3 m/s a un sitio al azar de la plataforma y, con un centollo a 8 m, corren a 5 m/s durante 3 s. Los bots no van a activar edificios: patrullan cerca de la plataforma.

_Sustituida en parte por «Evacuación por orden del Alto Mando» (12 oct 2026): la activación a 12 m y los grupos de 10–20 cada 15 s. Siguen vigentes los edificios, la velocidad y el pánico._

## 2026-10-09 — Vida 50 y la granada hiere a todo el mundo

Los colonos tienen 50 de vida y no 20: la granada (40) hiere a todo el mundo y los deja malheridos sin matarlos. Un raso necesita 7 mordiscos. Los bots no tiran granadas con colonos cerca del grupo.

## 2026-10-09 — Los rasos prefieren colonos

Primero el colono más cercano a 25 m con hueco (tope de 3); si no hay, soldados como antes. Persiguiendo a un colono, muerden al soldado que tienen al alcance: una línea de soldados frena. Los escupidores siguen yendo a por soldados. El director abre las madrigueras que amenazan las rutas de los edificios activados (todas si no hay ninguno).

_Sustituida en parte por «Evacuación por orden del Alto Mando» (12 oct 2026): el director amenaza la ruta del edificio que se evacua._

## 2026-10-09 — Colonos baratos

Comparten crowd y mundo bitECS con los centollos, pero sin la evitación de obstáculos de Detour, y salen del crowd al llegar a la plataforma. Los soldados los atraviesan (corrección de predicción en 0 cm). `pnpm loadtest` activa los 4 edificios (`BUILDINGS=closed` para medir sin ellos): con colonos no cumplía NFR-01 (p99 de 11,2 ms con la máquina descargada).

## 2026-10-09 — Evitación de calidad media y snapshots sin asignaciones

Perfilado: la recolección de basura no era el problema (0,3 %); el 38 % del tick es DetourCrowd. La evitación pasa de la de serie (7, 2, 5) a la «media» de Detour (5, 2, 2, `navmesh.avoidance`): un 30 % menos de crowd. Los snapshots reutilizan la caché de envíos y leen el enjambre una vez por tick para todos los clientes. Aislado, el tick con colonos baja de 1,42 a 1,08 ms (sin ellos, de 1,12 a 0,82). 10 min con colonos: p99 de CPU 9,66 ms ✓.

## 2026-10-09 — CPU del hilo en la prueba de carga

El tiempo de CPU del proceso suma lo que hacen otros hilos a la vez (marcado concurrente del recolector), que no retrasa el tick. `pnpm loadtest` muestra también el del hilo del tick (`process.threadCpuUsage`), de momento solo informativo: NFR-01 se sigue juzgando con el del proceso.

## 2026-10-08 — Fases de la partida (E6-1)

Preparación de 30 s (`match.prepSeconds`, sustituye a la calma de 20 s del director), evacuación hasta el último despegue, oleada final y resultado en cuanto cae el último soldado. Los despegues se siguen contando desde el principio de la preparación. **Sin tiempo máximo** (se quita de la spec): la oleada final acaba siempre con todos. Durante el resultado, quien entra es espectador.

_Sustituida en parte por «Sala de espera en la nave» (12 oct 2026): la preparación empieza cuando el anfitrión arranca desde la sala, y quien entra durante el resultado va a la sala._

## 2026-10-08 — Nueva partida automática hasta E6-5

A los 15 s del resultado (`match.resultSeconds`; 20 desde E6-4) empieza sola otra partida con todos los conectados: el primero con 7 bots, los demás relevan a uno. Sustituye al pelotón nuevo de E5-4. Si se va el último jugador con soldado pero queda alguien conectado (espectador), su soldado pasa a bot y la partida sigue.

_Sustituida en parte por «Volver a filas» (12 oct 2026): ya no empieza sola. Sigue vigente cómo se forma el pelotón nuevo y qué pasa si se va el último jugador._

## 2026-10-08 — Espectador (E5-5)

Vista cenital fija que encuadra el mapa entero (sin niebla); clic sobre un compañero vivo para seguirle por encima del hombro, Esc para volver. Si el seguido muere, vuelve a la cenital. Sin soldado se oculta el HUD de combate. Quien llega sin bots en pie que relevar entra directamente como espectador (`welcome` con `playerId` −1).

## 2026-10-08 — Defunción y relevo (E5-4)

Sin reaparición: al morir, el soldado desaparece. Un jugador ve 3 s de certificado de defunción (`soldier.defunctSeconds`) y releva a un bot en pie del pelotón (mensaje `relief`: se queda con su soldado y la predicción arranca de su estado); si no queda ninguno, pasa a espectador (`spectate`). El servidor sigue mandando el mundo a quien no tiene soldado. Si cae todo el pelotón, empieza otra partida (ver «Fases de la partida»).

## 2026-10-08 — Sin reaparición, el pelotón se derrumba de golpe

Con `pnpm tune` (8 bots, que aún no rescatan): nadie muere hasta el minuto 5–7 y luego cae casi entero en un minuto; según la semilla, cae antes del último despegue (8:39) o ya en la oleada final (10:09). Responde a medias a la pregunta abierta de §11: hay que reajustar el director (o que los bots rescaten) para que la sangría sea gradual.

_Nota (12 oct 2026): se midió antes de quitar el remate y de las naves destruibles; hay que volver a medir con los bots que rescatan (E5-7)._

## 2026-10-08 — Compañeros bot, implementados (E5-6)

El primer jugador llega con 7 bots del servidor (`squadBots`): misma entidad soldado, con la entrada que genera `BotBrain` en cada tick. Los siguientes relevan a un bot en pie (se quedan con su soldado: posición, vida, enfriamientos; la cola de entradas empieza de cero) y quien se va deja un bot. Al irse el último, se quitan todos (el director se reinicia solo). Los bots headless cuentan como jugadores. Evento `control` y marca `bot` en las entidades nuevas; el cliente añade "(bot)" al nombre. Con 7 bots y 150 centollos, el tick no cambia (~3,5 ms en el portátil).

## 2026-10-08 — Rescate (E5-2)

F se pulsa una vez (no se mantiene) junto a un derribado a ≤ 2 m; el rescate dura 5 s mientras el rescatador no se mueva, no reciba daño ni use habilidades, y no dispara (manos ocupadas). El derribado queda inmóvil (marca `pinned` en la simulación compartida, la pone el servidor), aunque se estuviera arrastrando. No empieza si lo están rematando; mientras dura, los centollos van a por el rescatador. Viaja en la entrada (`revive`), no en un mensaje aparte.

_Sustituida en parte por «Sin remate en el suelo» (12 oct 2026): «No empieza si lo están rematando»._

## 2026-10-08 — Remate de 5 s

Tras la prueba de E5-3, el remate pasa de 3 a 5 s: lo mismo que el rescate (se pierde la asimetría de la spec; el rescatador sigue expuesto mientras rescata).

_Sustituida por «Sin remate en el suelo» (12 oct 2026)._

## 2026-10-08 — Muerte y remate (E5-3)

El derribado muere a los 30 s, por remate o por granada aliada. Los rasos vuelven a elegir derribados (el más cercano, esté en pie o no: presa fácil; cuentan para el tope de 3) y, pegados a uno, lo rematan en 5 s (`soldier.downed.finishSeconds`; eran 3); si el raso muere o se aparta, el remate se corta y vuelve a empezar. Los escupidores no rematan. Provisional hasta E5-4: tras morir, a la plataforma; el aviso lo da la muerte.

_Sustituida por «Sin remate en el suelo» (12 oct 2026) y, lo provisional tras morir, por «Defunción y relevo (E5-4)»._

## 2026-10-08 — Derribado (E5-1)

30 s; se arrastra a 0,8 m/s en cualquier dirección o dispara con fuego lento (intervalo × 3: un disparo cada 2,4 s; tras la primera prueba, × 2 parecía rápido), nunca las dos cosas; sin habilidades. "Arrastrándose" mira la última entrada recibida, no solo las del tick: con el jitter hay ticks sin entradas y en ellos disparaba aunque se mantuviera pulsado moverse. El arrastre va en la simulación compartida (marca `downed` en el estado de movimiento, la pone el servidor): la predicción sigue en 0 cm. Valores en `soldier.downed`.

## 2026-10-08 — Derribado: centollos, daño y red (E5-1)

Hasta E5-3, el derribado no recibe más daño y los centollos no lo eligen como objetivo (su cuerpo sigue cortando el paso; los escupitajos le pasan por encima). Los soldados llevan su vida en el snapshot: con 0, los aliados lo ven tumbado, con un rombo rojo encima y en la lista "Aliados derribados" (flecha respecto a la cámara, distancia y cuenta atrás desde el evento `downed`). Provisional: a los 30 s vuelve a la plataforma.

_Sustituida en parte por «Defunción y relevo (E5-4)» (12 oct 2026): lo provisional de volver a la plataforma a los 30 s._

## 2026-10-08 — Prueba jugando de H3

En red local (wifi del móvil), dos personas, con el director afinado: es divertido. Se echó de menos ver dónde se puede disparar y que el disparo apuntado sirviera para objetivos lejanos. Para jugar desde otro Mac con macOS Sequoia, el navegador necesita el permiso de "Red local" (si no, "address unreachable" aunque el ping funcione).

## 2026-10-08 — Cono de disparo en el suelo (prueba de H3)

El soldado propio lleva dibujado su cono de ±20° (el del cuerpo, no el de la cámara) hasta el alcance del fuego automático, con un arco discontinuo al del disparo apuntado. Tenue y por encima de todo (grupo de dibujo 1, para verse también sobre la plataforma); amarillo cuando el objetivo está dentro y se le puede disparar.

## 2026-10-08 — Disparo apuntado a 50 m (prueba de H3)

De 35 a 50 m (y Tab de 40 a 50, para poder seleccionar lo que alcanza): con 35 apenas superaba al fuego automático. Su papel es quitar escupidores antes de que se planten a 14 m. Sigue pidiendo estar quieto 1,5 s, de cara y con visión, con 6 s de enfriamiento.

## 2026-10-08 — Director afinado con bots

Con 20 × (1 + 0,25 × minuto) y empujón × 2,5, 8 bots no morían hasta la oleada final. Simulando partidas con `pnpm tune` (8 soldados con `BotBrain`), se pasa a base 40, crecimiento 0,1 y empujón × 4: los dos primeros empujones se notan sin matar (picos de 40 y 80), la presión llega en los minutos 5–9 y la final arrasa. Con 0,25 de crecimiento el fondo pesaba más que los empujones al final. Las muertes llegan el minuto siguiente a cada empujón (los centollos tardan 10–17 s en llegar). A comprobar jugando; en H4, sin reaparición, habrá que reajustar.

## 2026-10-08 — Prueba de carga y criterio de NFR-01 (E7-5)

`pnpm loadtest` arranca un servidor propio (105 rasos + 45 escupidores, sin red simulada, `LOAD_REPORT`) y 8 bots, y resume el informe. NFR-01 ("cada tick por debajo de 10 ms") se da por cumplido con el p99 del tiempo de CPU del tick: en un portátil con los bots al lado, el reloj incluye esperas de la máquina (picos de 10–30 ms aislados que no son trabajo del servidor). Se muestran los dos. Primera prueba de 10 min: p99 de CPU 8,6 ms y 23,7 KB/s; margen justo en un portátil cargado, sin fuga (banco aislado plano).

## 2026-10-08 — Cerebro de los bots en shared (E7-4)

`BotBrain` es lógica pura por tick (`shared/src/bot/brain.ts`, valores en `game.config.ts` → `bot`) para que lo usen los bots headless y los compañeros del servidor (E5-6) sin que el servidor dependa del paquete de bots. No es simulación determinista: el azar entra por parámetro para poder probarlo.

## 2026-10-08 — Comportamiento básico de los bots (E7-4)

Encara al hostil más cercano a 35 m (la selección automática del servidor elige y dispara), retrocede de cara si lo tiene a menos de 8 m y se acerca si está a más de 24; con escupidores cerca se mueve de lado. Estimulante con 50 de vida; granada a grupos de 3 lejos de sí y de aliados; disparo apuntado a escupidores si no hay nada a 12 m. Gira como un jugador con teclado. Sin enemigos, patrulla cerca de la plataforma.

## 2026-10-08 — Los números del director se quedan cortos contra 8 (E7-4)

Con 8 bots, los 3,5 primeros minutos no muere nadie y nunca hay más de 5 centollos vivos. Es para afinar jugando (`baseRate`, `pushFactor`), pero apunta a que la carga tiene que subir bastante para un pelotón de 8.

## 2026-10-08 — Fuego amigo de la granada, implementado (E3-6)

La explosión daña a todos los soldados en el radio y sin obstáculo en medio, también a quien la lanza, con el mismo daño que a los centollos (40). Quien la lanza ve en rojo el daño a soldados y un aviso. La invulnerabilidad de administración protege; que mate a un derribado llega con H4.

## 2026-10-08 — Comandos de administración (E7-3)

Solo en desarrollo: el servidor los acepta si arranca con `--admin` (lo pone `pnpm dev`, no `pnpm start`) y la bienvenida lo dice al cliente. Teclas con el panel F3 abierto, para no pulsarlas jugando: I invulnerable, K matar centollos, N siguiente fase, O próximo empujón ("lanzar oleada"), P oleada final. La F no, que es Rescatar.

## 2026-10-08 — Saltos del director (E7-3)

"Saltar fase" y "lanzar oleada" mueven el reloj del director: las madrigueras que tocan se abren con su aviso normal, el despegue en el que se aterriza se anuncia y el ritmo acumulado vuelve a cero. Matar centollos no detiene al director: en la oleada final se rellenan al momento.

## 2026-10-08 — Director de oleadas (E4-4)

Lógica pura por ticks (`server/src/ai/director.ts`), con todos los números en `game.config.ts`: calma de 20 s, fondo `base × (1 + crecimiento × minuto)`, empujón los 40 s antes de cada despegue (2:30, 5:00, 7:30, 10:00, simulados hasta H5), valles × 0,15 de 45, 35 y 25 s, oleada final al tope de 150. Escupidores del 10% en el primer despegue al 30% en la final.

_Sustituida en parte por «Fases de la partida (E6-1)» (12 oct 2026): la calma de 20 s pasa a ser la preparación de 30 s; y por «Lanzaderas (E6-3)»: los despegues ya no son simulados._

## 2026-10-08 — Madrigueras por tandas y rutas de colonos (E4-4)

Las rutas (edificio → plataforma) y las madrigueras que amenazan (a menos de 60 m) son datos de `map.json`; las madrigueras tienen nombre para los avisos. Se abren 2, +1 por despegue y las 6 en la final, primero las que amenazan más rutas: la norte (pegada a la plataforma) la primera; la sur, que no amenaza ninguna, solo en la final. Aviso de 5 s antes de abrir.

## 2026-10-08 — Taponar y reiniciar (E4-4)

Una granada que explota a ≤ 4 m del centro de una madriguera abierta la tapona; a los 10 s se abre otra (la recién taponada solo si no hay otra). El director empieza con el primer soldado y, si no queda nadie, se reinicia y quita los centollos. Con `CRABS`/`SPITTERS` no actúa (pruebas de carga).

_Sustituida en parte por «Fases de la partida (E6-1)» (12 oct 2026): el director empieza y se para con la partida._

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

_Sustituida en parte por «Los rasos prefieren colonos» y «Sin remate en el suelo» (12 oct 2026): la nota final sobre colonos y remate._

## 2026-10-08 — Reaparición provisional y modo de prueba (E4-2)

Hasta el derribado (H4), a 0 de vida el soldado reaparece al momento en la plataforma con la vida llena y un aviso. Hasta el director (E4-4), `CRABS=N` mantiene N centollos vivos saliendo por turnos de las madrigueras. Los muñecos siguen (`dummy.enabled`).

_Sustituida en parte por «Defunción y relevo (E5-4)» (12 oct 2026): la reaparición. El modo de prueba con `CRABS` sigue._

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

_Sustituida en parte por «Sin remate en el suelo» (12 oct 2026): ya no hay remate. Sigue vigente que no hay captura._

## 2026-10-08 — Alcance de H3

Las partes de H3 que dependen de H5 se completan allí: priorizar colonos (E6-2), saltar fase (E7-3) y ligar la oleada final a las fases (E6-1). Hasta entonces, la oleada final se lanza con un comando. bitECS, instancing y snapshots compactos van dentro de E4-2. Los muñecos de prueba se mantienen, con una opción para quitarlos. Viene del PR #33.

## 2026-10-08 — Rutas y despegues simulados en H3

El director ata picos y madrigueras a despegues y rutas de colonos, que llegan en H5. En H3, las rutas (con las madrigueras que amenaza cada una) son datos de `map.json`, todas activas, y el calendario de despegues va en `game.config.ts`. En H5 se enganchan a los edificios activados y a las lanzaderas.

_Sustituida por «Evacuación por orden del Alto Mando» y «Lanzaderas (E6-3)» (12 oct 2026)._

## 2026-10-08 — Clímax de la última muerte (E6-4)

Cuando cae el último soldado: cámara lenta de 2–3 s sobre él, frase final del sargento y fundido al noticiario. Reutiliza piezas existentes (cámara y mensajes del sargento).

## 2026-10-08 — Edificios activados por el pelotón (E6-2)

Un edificio se activa por proximidad, sin botón ni quedarse, y suelta colonos por grupos hasta vaciarse. Las lanzaderas despegan a su hora, así que activar tarde cuesta colonos: ese reloj impide acomodarse. De lejos no se sabe cuántos hay dentro. Los colonos entran en pánico y corren con centollos cerca. Activarlo sin querer se acepta de momento.

_Sustituida por «Evacuación por orden del Alto Mando» (12 oct 2026)._

## 2026-10-08 — Quien llega tarde ocupa un bot

Con la partida empezada, un jugador nuevo ocupa un bot en pie del pelotón. Si no queda ninguno, entra como espectador hasta la siguiente partida.

_Sustituida en parte por «Sala de espera en la nave» (12 oct 2026): ahora elige entre encarnar un bot o mirar como espectador._

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

_Sustituida por «Sin remate en el suelo» (12 oct 2026). Siguen vigentes los 5 s de rescate y que los centollos atacan al rescatador._

## 2026-10-08 — Derribado con algo de agencia (E5-1)

Derribado, se arrastra muy despacio o dispara con fuego lento, nunca las dos cosas, y sin habilidades. Para el rescate tiene que estar quieto. Pedir ayuda se aplaza hasta que haya sonido o marcadores. La granada aliada mata al derribado: castiga lanzarla a bulto.

## 2026-10-08 — Puntuación colectiva (E6-4)

La puntuación es del pelotón: colonos salvados en común, sin marcador individual ni de héroes. Así rescatar tiene sentido: un fusil más en pie salva más colonos.

_Matizada por «Noticiario y parte de bajas» y «Parte de bajas por enemigos abatidos» (12 oct 2026): hay un parte por soldado, ordenado por abatidos; la puntuación sigue siendo de todos._

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

_Sustituida en parte por «Fuego amigo de la granada, implementado (E3-6)» (12 oct 2026)._

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

_Sustituida por «Fuera los centollos de cartón» (12 oct 2026)._

## 2026-10-07 — Eventos y números de daño (E3-1)

Los eventos de otros se muestran en el tick interpolado (cuadran con lo que se ve) y los propios al llegar. Las entidades eliminadas se quitan al dibujar ese tick, no al llegar el snapshot. Cada jugador solo ve los números de su propio daño; se hacen en E3-1 y no en E3-4.

## 2026-10-07 — Selección de objetivo (E2-4)

Solo se seleccionan entidades hostiles; Escape quita el objetivo (sin él, el fuego automático no pararía). El objetivo se marca con un anillo en el suelo, no con contorno, porque es más barato y sirve con instancing.

## 2026-10-07 — Muñecos de prueba en E2-4

El resultado de H2 es "combate contra muñecos de prueba", pero ninguna historia los crea. Se crean en E2-4, la primera que necesita objetivos hostiles: estáticos, posiciones en `map.json`, sin colisión con los soldados (como los centollos). Vida y reaparición, en E3-1.

_Sustituida por «Fuera los centollos de cartón» (12 oct 2026)._

## 2026-10-07 — Fusión de PR

El usuario da el visto bueno (y prueba los cambios visuales); entonces Claude fusiona con squash y borra la rama.

## 2026-10-07 — Flujo con GitHub Issues

Cada historia es una issue y cada hito un milestone; plan revisado antes de codificar, rama propia, PR con "Closes #N" y CI como filtro. Al terminar cada hito, prueba jugando.

## H1 — Sin ECS hasta H3

Con pocos soldados basta un `Map`. bitECS entra en H3 con los centollos.
