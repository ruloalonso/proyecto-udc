# Proyecto UDC — Documento de diseño

> Documento vivo. Recoge las decisiones tomadas, las ideas en exploración y las preguntas abiertas.
> Nombre en clave: **Proyecto UDC**. Nombre comercial: _pendiente_ (cambiarlo antes de cualquier presentación pública).
> Primer jugable: ver `spec-prototipo-0-la-retirada.md`.

---

## 1. Visión

Un MMORPG persistente y **lento** que se juega en el navegador: entras un rato cada día y el progreso se nota con el paso del tiempo. **Dos facciones jugables** muy distintas compiten por la galaxia mientras se enfrentan a una **amenaza común controlada por IA: el enjambre**.

Cada jugador encarna a **una persona concreta** a lo largo de su vida: de soldado raso que combate, explora y vive aventuras en tercera persona, a veterano que toma decisiones a escala local, continental, planetaria, de sistema o galáctica. La vida es finita: se puede perder en combate o terminar de vieja. Es un **roguelike de vidas**.

**Referencias:**

- _World of Warcraft_: cámara, combate, mazmorras y estructura de zonas.
- _OGame_ y _Hattrick_: ritmo lento y diario, decisiones que maduran con el tiempo, envejecimiento.
- _Helldivers_ y _Starship Troopers_: personajes prescindibles, tono satírico, guerra galáctica dirigida por un director.
- _Star Wars: The Old Republic_: estructura nave / espacio / planeta mediante transiciones.
- _No Man's Sky_: sensación de exploración y planetas procedurales.
- _StarCraft_, _Warhammer 40.000_, _Alien_: inspiración de arquetipos (no de su IP).
- _EVE Online_ y _Albion Online_: economía de jugadores, territorio, pérdida de lo que llevas encima.

### Pilares de diseño

1. **Una vida completa.** Del soldado raso al mando galáctico, con un juego que cambia según la edad.
2. **Juego lento.** Un rato al día; las decisiones se notan con el tiempo.
3. **El riesgo es una decisión.** Cuanto más vale tu vida, más tienes que cuidarla.
4. **Dos facciones radicalmente distintas**: en valores, en mando, en economía y en su relación con la muerte.
5. **Una amenaza común inteligente** que genera contenido y equilibra la guerra entre jugadores.
6. **El mundo cambia de verdad.** Territorio, colonias, planetas degradados o restaurados, infestaciones.
7. **Contenido sistémico.** Los veteranos generan el contenido de los jóvenes.
8. **Viajar por la galaxia se siente épico** aunque técnicamente sean escenas separadas.

---

## 2. Facciones

> Los nombres son provisionales. Regla de IP: los **arquetipos** sí se pueden usar, pero nada de nombres, diseños reconocibles, lore, música ni logos de Blizzard, Games Workshop o Disney (_Alien_).

### 2.1 Facciones jugables

|                           | Humanos                                                           | Psiónicos                                                     |
| ------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------- |
| Arquetipo                 | Humanidad tipo _Alien_ / Warhammer 40k                            | Antigua raza psiónica, creadora (arquetipo tipo "Ingenieros") |
| Lema                      | Todo por la guerra, la fe y el Estado                             | Paz, equidad, ética                                           |
| Sociedad                  | Teocracia ortodoxa y ultrarreligiosa; jerarquía y cadena de mando | Sociedad de iguales; decisiones por convergencia              |
| Identidad del individuo   | Se diluye: ¿qué es una vida? Hay millones                         | Cada mente es valiosa                                         |
| Muerte                    | **Definitiva.** La clonación es herejía, perseguida por ley       | **Transferencia a un clon maduro**; sin clon maduro, muerte   |
| Envejecimiento            | Inevitable                                                        | Reversible: mente sabia en cuerpo joven (con coste)           |
| Relación con los planetas | **Extraer**: rendimiento alto, degradación                        | **Cuidar**: rendimiento creciente, regeneración               |
| Progresión                | Equipo y tecnología                                               | Disciplinas mentales y artefactos                             |
| Estilo                    | Numerosos, prescindibles, accesibles                              | Pocos, preciosos, progresión lenta                            |
| Mando y política          | Cadena de mando (§9.3)                                            | Convergencia (§9.4)                                           |
| Guerra                    | Perpetua, jerárquica, barata en vidas                             | Excepcional, consensuada, quirúrgica, cara en legitimidad     |

### 2.2 Tono

- **Humanos en clave satírica**, como Helldivers y _Starship Troopers_: la glorificación de la muerte por la patria es grotesca y divertida, no una apología.
- **Psiónicos con sombras**, para evitar el "buenos contra malos":
  - **Paternalismo:** "enseñar al resto de especies a cuidar sus planetas" es, desde fuera, imperialismo cultural con buenos modales.
  - **Un secreto en su pasado** _(por decidir)_: ¿construyeron la red de agujeros de gusano para contener al enjambre? ¿Lo crearon ellos?

### 2.3 Relación entre facciones jugables

- Humanos y psiónicos **pueden comunicarse**: diplomacia, comercio, treguas, negociación de prisioneros.
- **Raíz del conflicto:** para la teocracia humana, los psiónicos son una abominación que hace trampas a la muerte mediante la clonación.
- Son **rivales** por territorio y por la red de agujeros de gusano, pero comparten un **enemigo común**: alianzas temporales, treguas y traiciones.

### 2.4 El enjambre (facción NPC)

- Mente colmena biológica, de aspecto crustáceo-insectoide. **No jugable.**
- Los humanos los llaman con desprecio **centollos** ("putos cangrejos", "malditas gambas", "¡muerte a los moluscos!"). Es el nombre que se usa en el juego desde el lado humano.
- **Incomunicable:** no negocia, no comercia, no hace prisioneros. Asimila.
- Individuos totalmente reemplazables; la colmena gasta biomasa, no vidas.
- Ver §3 para su funcionamiento como sistema.
- Posible expansión futura: jugadores como "nodos" de la mente que controlan nidadas (más cerca de un RTS).

**Por definir:** nombres, lore base, estética visual y si hay clases dentro de cada facción.

---

## 3. El enjambre: la amenaza común

### 3.1 Rol en el diseño

- **Fuente constante de contenido PvE:** infestaciones, invasiones, planetas que caen, defensas que hay que montar.
- **Equilibrador de la guerra entre jugadores:** presiona más a la facción que va ganando.
- **Motor político:** obliga a humanos y psiónicos a decidir entre colaborar o aprovechar la debilidad del otro.
- **Enemigo legítimo para los psiónicos:** combate sin dilemas éticos.

### 3.2 Director de guerra galáctica

Servicio de IA (estilo Helldivers) que decide:

- **Dónde** ataca la colmena: sistemas, planetas, rutas.
- **Con qué intensidad**, según el estado de la galaxia y la actividad de los jugadores.
- **Contra quién**, priorizando a la facción dominante.

Funciona en tiempo galáctico (§8) y usa el LOD de simulación (§5.5): las ofensivas son entidades agregadas que se instancian cuando hay jugadores presentes.

### 3.3 Mecánicas del enjambre

- **Infestación** de planetas: estructuras orgánicas que crecen con tiempo galáctico y degradan el planeta si nadie las limpia. Los psiónicos pueden restaurar planetas infestados.
- **Asimilación:** quien cae ante el enjambre sin ser rescatado a tiempo es asimilado (equivale a la muerte; §7).
- Los psiónicos podrían percibir parcialmente la colmena por vía telepática _(por decidir)_.

---

## 4. Estructura del mundo

El mundo se organiza en **tres capas independientes** unidas por transiciones animadas que ocultan la carga. **No es seamless**, y es una decisión deliberada (ver §13).

### 4.1 Mapa galáctico

- Funciona más como interfaz que como mundo navegable: se elige sistema y ruta.
- Capa estratégica: control de sistemas, avance del enjambre, salud de los planetas, rutas comerciales y frentes de guerra.

### 4.2 Espacio de sistema

- El jugador vuela su nave entre planetas, estaciones, cinturones de asteroides, etc.
- Combate entre naves, minería, piratería y encuentros entre facciones.
- Vuelo **arcade**, no simulación, para que sea tolerante a la latencia.

### 4.3 Superficie planetaria

- Aquí está el núcleo WoW: personaje a pie, cámara en tercera persona, misiones, mazmorras y PvP.
- Cada planeta tiene una o varias **zonas planas** (no esféricas), como continentes de WoW.

### 4.4 Tipos de planeta (modelo híbrido)

- **Planetas mundo** hechos a mano: capitales de facción, zonas de historia y mazmorras. Son pocos y densos.
- **Planetas de exploración** procedurales: generados a partir de una semilla (bioma, recursos, fauna, ruinas), con zonas planas de tamaño acotado. Sirven para recursos, descubrimiento y colonización, y son objetivo de la infestación del enjambre.
- Cada planeta tiene un estado de **salud** que cambia con la explotación, el cuidado y la infestación (§5.4).

### 4.5 Transiciones

Despegue → órbita → salto → llegada → aterrizaje, mediante animaciones cortas que ocultan la carga de escena.

### 4.6 Punto de partida: galaxia diseñada

- **Una galaxia diseñada a mano** como mundo inicial (no procedural en su estructura).
- **Cada facción jugable tiene un planeta natal** en su propio sistema.
- Los sistemas natales son **equidistantes** del núcleo y del frente del enjambre. Lo que cuenta es la distancia de viaje (saltos y tiempo por la red de agujeros de gusano), no la distancia euclídea.
- **Las civilizaciones ya son espaciales.** No hay árbol tecnológico para "aprender a viajar".

### 4.7 Geografía propuesta

```
                 [Origen del enjambre]   ← opción A: tercer vértice
                   /                \
          frente humano          frente psiónico
                 /     [Núcleo]       \
       [Natal humano] — frontera — [Natal psiónico]

   + periferia exterior: sistemas de exploración procedurales
     (opción B: el enjambre llega desde aquí)
```

- **Sistemas natales:** zonas de inicio, capital y planetas mundo hechos a mano. Territorio seguro.
- **Frontera humanos–psiónicos:** sistemas disputados, con guerra territorial, comercio y diplomacia.
- **Núcleo galáctico:** agujero negro supermasivo. Región de dilatación temporal extrema (§8) y contenido endgame, con un puerto franco neutral en su periferia.
- **Periferia:** sistemas de exploración procedurales, colonización e infestación. Se puede ampliar sin rediseñar el mapa.
- **Origen del enjambre** _(por decidir)_:
  - **Opción A:** tercer vértice del mapa, foco de infestación conocido que se expande hacia ambas facciones.
  - **Opción B:** llega desde fuera de la galaxia o desde la periferia. Conecta con el misterio de la red de agujeros de gusano.
- Tamaño inicial orientativo: unas pocas decenas de sistemas, de los cuales solo algunos están hechos a mano.

### 4.8 Progresión sin árbol tecnológico

- La tecnología es de la **civilización**, no del jugador. Lo que progresa es el **personaje**: su nave, sus licencias, su rango, su experiencia.
- Primeras horas: zona de inicio en el planeta natal (estilo WoW). La primera nave llega pronto.
- Opcional: cada facción viaja con un "sabor" distinto (humanos con tecnología de saltos, psiónicos herederos de la red antigua) sobre la misma red.

### 4.9 Viaje intergaláctico

- **Fuera del alcance inicial.** Reservado como **expansión futura** o misterio de lore.

---

## 5. Gameplay

### 5.1 Base

- **Combate a pie:** tab-target estilo WoW, con objetivo seleccionado, habilidades, cooldowns y casteos. Es muy tolerante a la latencia. Contra enjambres, la selección es automática (el más cercano de frente) y hay que encarar al objetivo para dispararle. Se descartó un shooter de puntería real: con mucha gente y PvP exige compensación de retardo, y el juego premia decidir y colocarse, no los reflejos.
- **Cámara:** tercera persona libre estilo WoW, con colisión con el terreno.
- **Economía:** crafting interdependiente (nadie es autosuficiente), recursos que se agotan y se regeneran.
- **Social:** gremios con objetivos colectivos y eventos de servidor donde todos contribuyen.

### 5.2 Ritmo de juego

- Pensado para **sesiones diarias cortas**, al estilo OGame y Hattrick: entrar, decidir, ver cómo avanzan las cosas.
- Las fases de oficial, comandante y anciano (§6) encajan de forma natural con sesiones cortas.
- La fase de soldado necesita contenido de **15–20 minutos**: misiones cortas, patrullas, operaciones con hora fija.
- **Lección de OGame:** el saqueo de jugadores poco conectados expulsa a mucha gente. Las salvaguardas (estado reforzado, criosueño, retirada automática) no deben relajarse.

### 5.3 Construcción en planetas _(propuesta)_

- **Sí, pero acotada:** construcción **modular sobre parcelas o rejilla**, sin edición libre del terreno tipo voxel.
- **Planetas mundo:** solo infraestructura de facción decidida por el mando (defensas, fábricas, puertos), en emplazamientos predefinidos.
- **Planetas de exploración:** colonias, puestos mineros y bases de jugadores y gremios. Persistencia como semilla + diffs (§11.5).
- Humanos con módulos prefabricados; psiónicos con pocas estructuras muy caras.
- El enjambre construye estructuras orgánicas de infestación (§3.3).

### 5.4 Economía asimétrica: extraer frente a cuidar

- **Humanos:** explotación intensiva. Rendimiento **alto e inmediato**, pero el planeta **se degrada** con el tiempo.
- **Psiónicos:** cuidado del planeta. Rendimiento **bajo al principio que crece a largo plazo** a medida que el planeta se regenera. Pueden restaurar planetas dañados o infestados.
- El humano tiene prisa; el psiónico invierte a meses vista. Encaja con el ritmo lento y la vida de 4 meses.

### 5.5 Órbitas y control estratégico _(propuesta)_

**Idea central:** la órbita es el cuello de botella entre un planeta y la galaxia. Quien controla la órbita controla lo que entra y sale.

**Espacio orbital jugable.** Cada planeta tiene una sub-zona orbital dentro de la capa de espacio de sistema.

**Elementos en órbita:**

- **Estaciones:** comercio (aduana y mercado), astilleros, plataformas de defensa, sensores, cápsulas de criosueño, cámaras de clonación (psiónicos).
- **Flotas:** naves de jugadores más naves NPC bajo mando de jugadores.
- **Puntos de salto** del sistema: el otro gran cuello de botella. Bloquear el agujero de gusano aísla un sistema entero.

**Modelo híbrido: jugable cuando hay jugadores, simulado cuando no.**

- Con jugadores presentes, el combate es real en la zona orbital.
- Sin jugadores, la resolución es automática con un simulador determinista (ver _LOD de simulación_ abajo).

**Bloqueos:**

- El comercio planeta ↔ galaxia se modela como **flujo de mercancías** (capacidad por tiempo galáctico).
- Un bloqueo reduce ese flujo en proporción a la fuerza del bloqueo frente a la de escoltas y defensas.
- **Romper bloqueos** es contenido para contrabandistas, mercenarios e independientes (§9.7).
- Efectos en cadena: escasez, subida de precios y presión política dentro de la facción bloqueada.

**Superioridad orbital → ventaja en tierra.** Controlar la órbita da apoyo en la superficie: bombardeo, suministros, desembarcos y sensores.

**Ataques mientras el defensor está offline.** Las estructuras atacadas entran en **estado reforzado** y su combate decisivo se programa en una ventana elegida por el defensor (inspirado en EVE).

**Objetivos de alto valor:** las **cámaras de clonación psiónicas** son objetivos militares prioritarios para los humanos, con carga ideológica: aniquilar la abominación.

**LOD de simulación (técnico).**

- Sin jugadores cerca, una flota es **una sola entidad agregada** con estadísticas (potencia, blindaje, composición).
- El combate agregado se resuelve con un modelo tipo **leyes de Lanchester**: la fuerza efectiva crece con el cuadrado del número de unidades en combate a distancia.
- Cuando un jugador entra en la zona, la flota se **instancia** en naves individuales con el estado actual. Al salir todos, se vuelve a agregar.
- Todo en tiempo galáctico, con la evaluación perezosa de §8.8.
- Las ofensivas del enjambre (§3.2) usan el mismo mecanismo.

### 5.6 Desconexión y seguridad del personaje _(propuesta)_

**Principio:** el personaje **no desaparece** al desconectarse. Sigue existiendo en el mundo persistente (y envejece, salvo en criosueño; §6.4). Si el lugar no es seguro, entra en **retirada automática**.

| Situación al desconectar                                | Qué ocurre                                                                                |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| En zona segura, propiedad propia o atracado en estación | Desconexión inmediata; el personaje se queda ahí (opcionalmente en criosueño)             |
| En zona insegura, **fuera de combate**                  | Temporizador visible (~30–60 s, vulnerable) → retirada automática                         |
| **En combate** (agresión reciente)                      | IA defensiva hasta que acabe el bloqueo de combate (~X min). Después, retirada automática |
| Desconexión accidental (caída de red)                   | Mismas reglas, con periodo de gracia para reconectar                                      |

**Retirada automática:**

- **En el espacio:** si tiene nave, se dirige al **punto seguro más cercano**.
- **En superficie:** se dirige a su nave o al punto de evacuación más cercano. Si no lo hay, busca refugio.
- Durante el viaje es una entidad agregada (§5.5). Si alguien la intercepta, se instancia y combate bajo control de la IA.

**Reglas anti-abuso:**

- Destino = **punto seguro más cercano**, nunca uno elegido por el jugador.
- La retirada **no atraviesa bloqueos** ni zonas de guerra activa.
- Alt+F4 en combate no salva a nadie.
- La IA defensiva es prudente, nunca mejor que un jugador activo.

**Consecuencias:**

- **Con plan de escape:** si la retirada es interceptada, las pérdidas están acotadas (daño a la nave, parte de la carga).
- **Sin plan de escape** (atrapado sin nave o con la salida bloqueada): el personaje queda expuesto a ser **derribado, y después muerto o capturado** (§7).
- El jugador recibe un informe al reconectar.

**Separado de esto:** los ataques a propiedades se rigen por el estado reforzado (§5.5).

### 5.7 Capa estratégica

Conforme el personaje envejece (§6), el juego pasa de la acción a la **decisión**. No es un segundo juego, sino **una segunda vista sobre la misma simulación**: mapa galáctico, flotas agregadas, bloqueos, economía, salud planetaria y política.

- **Mando de NPCs:** órdenes directas a escuadrones, naves y guarniciones. Capa táctica tipo RTS, como guiño a StarCraft.
- **Mando de jugadores:** no por órdenes, sino por **operaciones** (humanos) o **iniciativas** (psiónicos) que aparecen como misiones con recompensa para otros jugadores (§9). **Los veteranos generan el contenido de los jóvenes.**
- **Roles de retaguardia** para todos los veteranos: mando militar, gobernador de planeta o colonia, magnate comercial, instructor de reclutas, jefe de espionaje, diplomático, político...
- **Técnicamente es una aplicación web** (paneles, mapas, flujos de decisión): mucho más barata que la acción 3D.

### 5.8 Por definir

Combate de naves en detalle, curva de nivel de la fase de soldado, PvP abierto o por zonas, naves grandes multijugador.

---

## 6. Ciclo vital: edad y envejecimiento

### 6.1 Principio

Cada personaje tiene un **arco vital completo**. Envejece con el tiempo galáctico, y su papel cambia: de la acción en el frente a la decisión en la retaguardia. Si nadie lo mata, acaba **muriendo de viejo**: toda vida termina.

### 6.2 Duración y fases

**Una vida completa dura unos 4 meses reales**: aproximadamente **1 año de edad cada 2 días reales**.

| Fase       | Edad   | Duración real | Juego dominante                               |
| ---------- | ------ | ------------- | --------------------------------------------- |
| Soldado    | 18–30  | ~3,5 semanas  | Acción: combate, exploración, misiones        |
| Oficial    | 30–45  | ~1 mes        | Mixto: liderar escuadras en el frente         |
| Comandante | 45–60  | ~1 mes        | Táctica y estrategia regional, política       |
| Anciano    | 60–75+ | ~1 mes        | Gran estrategia, gobierno, negocios, mentoría |

Es el techo natural. La mayoría de soldados morirán antes, en combate. Llegar a viejo es un logro.

### 6.3 Atributos

- **Físicos** (fuerza, reflejos, resistencia): suben en la juventud, alcanzan su pico y declinan.
- **Mentales** (sabiduría, mando, estrategia, negocio): crecen con la edad, **pero sobre todo con la experiencia**. La edad abre la puerta; la sabiduría hay que ganarla. La vida que has llevado define en qué tipo de anciano te conviertes.
- Un veterano puede seguir yendo al frente, con peores estadísticas de combate, pero su presencia **sube la moral** de quienes le rodean. Y su muerte, si cae, la hunde.

### 6.4 Pausar o ralentizar el envejecimiento

- **Criosueño:** desconectarse en una cápsula de una estación **detiene el envejecimiento**, con un coste. Evita que el jugador ocasional vea envejecer a su personaje sin jugarlo.
- **Anclaje relativista** (§8.5): estar cerca de un objeto extremo ralentiza el envejecimiento de verdad. Un líder anciano puede "conservarse" para un momento crítico, a cambio de no estar disponible.

### 6.5 Psiónicos: rejuvenecer

- Un psiónico puede transferir su mente a un **clon joven**: sabiduría de anciano en un cuerpo en plena forma.
- Es la gran asimetría con los humanos y la raíz ideológica de la guerra.
- **Coste** para que la élite psiónica no sea invencible _(por decidir)_: desgaste mental en cada transferencia (pérdida parcial de lo aprendido) o un número limitado de saltos antes de que la mente se degrade.

---

## 7. Muerte, captura y clones _(propuesta)_

### 7.1 Principio: roguelike de vidas

- Cada personaje es **una persona concreta**, no un regimiento ni un linaje. **No hay meta-progresión de cuenta** más allá de lo que aprende el propio jugador.
- El valor de una vida **crece con lo que acumula**: rango, edad, experiencia, posesiones. Un soldado raso es barato; un general es valioso. Cuanto más vale tu vida, más tienes que cuidarla.
- Como la muerte lo borra todo, **las primeras horas de cada vida deben ser rápidas y divertidas**: volver a ser útil no puede costar una semana.

### 7.2 Qué pasa al morir

|                                            | Humanos                                             | Psiónicos                                                              |
| ------------------------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------- |
| Lo que llevas encima (nave, carga, equipo) | Queda en el lugar; es de quien lo recoja            | Igual                                                                  |
| Lo almacenado en lugar seguro              | **Pasa al Estado** (alimenta el esfuerzo de guerra) | Sigue siendo tuyo si la mente pasa a un clon                           |
| Nivel, rango, experiencia                  | Se pierden                                          | Se conservan si hay **clon maduro** (menos el desgaste, §6.5)          |
| Continuidad                                | Nuevo personaje desde cero                          | Transferencia a un clon maduro                                         |
| Sin clon maduro                            | —                                                   | **Muerte definitiva**. Los clones embrionarios o infantiles no cuentan |

- Quien mata puede obtener una **recompensa**, además del botín.
- Los psiónicos gestionan clones en distintas fases de maduración (en tiempo galáctico): planificación pura.
- Para los psiónicos, la muerte sin clon es más dura que cualquier muerte humana: "pocos y preciosos".
- _(Por decidir)_: qué le queda a un psiónico que muere sin clon maduro.

### 7.3 Gloria _(propuesta)_

- Morir **cumpliendo un objetivo** (operación activa, defensa de una posición, cubrir una retirada) aporta gloria y ventajas a quienes le rodean o a su unidad.
- Morir de forma estúpida o lejos de cualquier operación no aporta nada. Si toda muerte se premiara, la gente se suicidaría para farmear.

### 7.4 Derribado, no muerto

- Al perder un combate, el personaje queda **derribado** (incapacitado), no muerto.
- **Aliados:** pueden rescatarlo y reanimarlo durante una ventana de tiempo.
- **Enemigos jugadores:** deciden **rematar** o **capturar**.
- **Enjambre:** si nadie lo rescata a tiempo, lo **asimila**.
- **NPCs de facción** (patrullas): también capturan. Resuelve el caso del personaje atrapado offline (§5.6).

### 7.5 Captura

1. **Contención:** el captor necesita un objeto o medio de contención.
2. **Transporte:** el prisionero hay que llevarlo a una instalación. El transporte es interceptable, y el rescate es contenido.
3. **Cautiverio:** con **duración máxima garantizada**, en tiempo galáctico. Y el personaje envejece mientras tanto.

- **Psiónicos:** la captura es **peor que la muerte**. Vivo, no puede transferirse al clon.
- **Experiencia del prisionero** _(por decidir)_: ¿puede el jugador jugar otro personaje mientras tanto? Opcional a futuro: gameplay de prisión (fugas, trabajos).

### 7.6 Interrogatorio

- **La información la extrae el sistema, no la persona real.** El personaje "sabe" datos según su rango: bases, flotas, operaciones. Al jugador real nunca se le pide confesar nada.
- Mecánica de progreso con el tiempo, con resistencia según rango o habilidades.
- **Representación abstracta**, no gráfica. Condiciona la clasificación por edad.
- Sabor por facción: los psiónicos leen mentes; los humanos interrogan.

### 7.7 Negociación e intercambio

Solo entre humanos y psiónicos. El enjambre no negocia.

- **Rescate económico**, pagado por el jugador, su gremio o su facción.
- **Intercambio de prisioneros:** da valor a capturar en lugar de matar.
- **Concesiones políticas:** treguas, levantar embargos, ceder sistemas. Solo puede ofrecerlas quien tenga autoridad para ello (§9).
- **Cazarrecompensas y mercenarios** pueden capturar y vender prisioneros.
- Sistema de ofertas asíncrono, con plazos en tiempo galáctico y un **desenlace por defecto** si no hay acuerdo.

### 7.8 Muerte o captura de un mando

- **Humanos:** se abre una **vacante** que se cubre por ascenso (§9.3). Si cae el líder supremo, crisis de sucesión.
- **Psiónicos:** si cae un custodio temporal, la convergencia decide; si tenía clon maduro, puede volver.
- Golpe de moral para quienes dependían de él.

### 7.9 Salvaguardas

- **Inmunidad temporal** tras ser liberado.
- **Anti-colusión:** capturar y liberar debe costar más de lo que rinde entre cuentas vinculadas.
- **Asesinato de mandos:** posible pero muy difícil y caro.
- **Evasión del Estado:** los humanos intentarán transferir sus bienes a amigos o gremios antes de misiones arriesgadas _(por decidir: aceptarlo como emergente o limitarlo)_.

---

## 8. Tiempo y relatividad

### 8.1 Objetivo

- El mundo **sigue vivo cuando el jugador no está conectado**: producción, construcción, envejecimiento, maduración de clones, salud planetaria, guerras, infestaciones...
- El tiempo **no transcurre igual en todas partes**: dilatación temporal gravitatoria y por velocidad, con una aproximación lo más fiel posible a la física real.

### 8.2 La física real

**Dilatación gravitatoria** (Schwarzschild, observador estático a distancia _r_ de una masa _M_):

```
α = dτ/dT = √(1 − 2GM / (r·c²)) = √(1 − r_s / r)
```

- `T`: tiempo de referencia lejos de toda masa ("tiempo galáctico").
- `τ`: tiempo propio local.
- `r_s = 2GM/c²`: radio de Schwarzschild.

**Dilatación por velocidad** (relatividad especial):

```
γ = 1 / √(1 − v²/c²)
```

**Combinada**, para una órbita circular alrededor de un cuerpo esférico sin rotación:

```
α = √(1 − 3GM / (r·c²))
```

**Valores reales en superficie** (respecto a espacio profundo):

| Lugar                                                 | α            | Retraso acumulado      |
| ----------------------------------------------------- | ------------ | ---------------------- |
| Tierra                                                | 0,9999999993 | ~0,02 s/año            |
| Júpiter                                               | 0,99999998   | ~0,6 s/año             |
| Sol                                                   | 0,999998     | ~67 s/año              |
| Enana blanca                                          | 0,9999       | ~54 min/año            |
| Estrella de neutrones                                 | 0,81         | ~70 días/año           |
| Agujero negro, órbita estable más interna             | 0,71         | ~3,5 meses/año         |
| Agujero negro en rotación (Kerr), cerca del horizonte | → 0          | arbitrariamente grande |

| Velocidad | γ       |
| --------- | ------- |
| 0,01c     | 1,00005 |
| 0,5c      | 1,15    |
| 0,9c      | 2,29    |
| 0,99c     | 7,09    |
| 0,999c    | 22,4    |

**Conclusión:** en planetas y estrellas normales la diferencia es **imperceptible**. Para que tenga efecto jugable con física real, hacen falta **objetos extremos**. Nota: α ≤ 1 siempre; **el espacio profundo es el lugar donde el tiempo corre más rápido**.

### 8.3 El problema de diseño

En un MMO, todos los jugadores conectados comparten el reloj de pared. **No se puede hacer que el tiempo de un jugador conectado corra más lento que el de otro.** Hay que decidir dónde se aproxima.

### 8.4 Modelo

1. **Tiempo galáctico `T`**, autoritativo y compartido, con **calendario comprimido: 1 año galáctico ≈ 2 días reales**. Una construcción de "3 meses" tarda ~1,5 días reales; un viaje de "una semana", algo más de una hora.
2. **Cada región tiene un factor `α`**, calculado con las fórmulas reales.
3. **Los procesos del mundo** avanzan `Δτ = α·ΔT` según su región.
4. **Personajes desconectados:** su tiempo propio avanza según el `α` del lugar donde se quedaron (salvo criosueño).
5. **Personajes conectados:** viven el reloj del calendario común. Primera concesión.
6. **Ciclo día-noche de los planetas:** va a una **escala jugable** (unas pocas horas reales por día local), separada del calendario. Segunda concesión: un día de 24 h galácticas duraría 4 minutos reales.
7. **Zonas jugables:** α ≈ 1, así que la primera concesión es invisible. **Regiones extremas:** lugares de **anclaje**, no de juego activo prolongado.

### 8.5 Mecánica derivada: anclaje temporal

Desconectarse con la nave en órbita de un objeto extremo es **viajar al futuro**:

- En la órbita estable más interna de un agujero negro de Schwarzschild, el personaje vive el 71% del tiempo que pasa fuera; mucho menos cerca de un Kerr.
- Usos: **envejecer más despacio** (conservar a un líder anciano), esperar a que acaben construcciones o guerras, conservar mercancías perecederas, acortar la espera subjetiva de la maduración de un clon...
- Coste y riesgo: fuerzas de marea, radiación, combustible y el peligro de llegar y salir.
- Las posesiones en espacio normal siguen su curso: la galaxia avanza sin ti.

### 8.6 Viaje interestelar

- Cualquier viaje más rápido que la luz es **científicamente incorrecto**. La opción más defendible son los **agujeros de gusano**, compatibles con la relatividad general aunque requieren materia exótica hipotética. Lore: red de agujeros de gusano estables, naturales o creados por una civilización antigua.
- Viaje interplanetario a velocidades sublumínicas: γ ≈ 1, irrelevante.
- **Viaje relativista opcional** entre estrellas cercanas: dura años galácticos y menos tiempo propio. Solo viable como acción offline larga.

### 8.7 Otros elementos con física real

- **Órbitas keplerianas deterministas** calculadas a partir de `T`, sin coste de servidor. Las rutas óptimas cambian con el tiempo.
- **Estaciones** según la inclinación del eje de cada planeta.

### 8.8 Implementación

- **Evaluación perezosa:** cada entidad guarda `last_T` y `α`, y al consultarla se calcula `Δτ = α·(T_actual − last_T)` en forma cerrada.
- **Cola de eventos** ordenada por `T`: ataques, finalización de obras, llegadas de flotas, clones listos, fin de cautiverios, muertes por vejez, cambios de fase vital.
- **Integración por tramos** cuando una entidad cambia de región o entra y sale de criosueño.
- Se guarda `T` como fuente de verdad, más el tiempo propio `τ` (y por tanto la edad) por personaje y entidad.

---

## 9. Mando, rangos y política

### 9.1 Principios

- Cada facción jugable tiene un **sistema de mando y gobierno propio**: **cadena de mando teocrática** (humanos) y **convergencia** entre iguales (psiónicos).
- El enjambre no tiene política: tiene voluntad.
- La política es **opcional**. Un jugador puede ignorarla y jugar igual de bien.
- Los cargos dan **poder real**: operaciones militares, comercio, diplomacia y presupuesto.
- Ningún sistema es "el bueno" mecánicamente: cada uno tiene ventajas y debilidades jugables.

> **Nombres in-game:** ideologías y religiones ficticias inspiradas en modelos reales, sin etiquetas ni símbolos reales. Evita atraer comunidades extremistas reales, simplifica la moderación y evita problemas legales y de clasificación por edad.

### 9.2 Comparativa

|                           | Humanos — Cadena de mando                                         | Psiónicos — Convergencia                                                      |
| ------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Inspiración               | Teocracia militarista / Warhammer 40k, Starship Troopers (sátira) | Democracia directa / consejo psiónico                                         |
| Rango ↔ poder             | Fusionados: el rango _es_ el cargo                                | Separados: no hay rangos de mando; la experiencia da influencia, no autoridad |
| Cómo se accede            | Méritos + nombramiento desde arriba + vacante                     | Cualquiera propone; los iguales apoyan                                        |
| Cúspide                   | Líder supremo                                                     | Ninguna (custodio temporal en emergencias)                                    |
| Cómo se pierde            | Destitución, herejía, golpe, **muerte**                           | Fin del mandato del custodio, retirada de apoyos                              |
| Cómo se manda a jugadores | Operaciones con gloria y méritos                                  | Iniciativas ejecutadas por voluntarios                                        |
| Economía                  | Extractiva, requisas de guerra, diezmo                            | Sostenible, impuestos decididos en convergencia                               |
| Ventaja                   | Decisiones inmediatas, movilización                               | Legitimidad, estabilidad, menos abuso                                         |
| Debilidad                 | Golpes de estado, dependencia del mando                           | Lentitud, populismo, compra de apoyos                                         |

### 9.3 Humanos: cadena de mando

| Escalón            | Ámbito                   | Manda sobre            |
| ------------------ | ------------------------ | ---------------------- |
| Soldado            | —                        | Nadie                  |
| Cabo / sargento    | Escuadra                 | Unos pocos soldados    |
| Teniente / capitán | Local (base, colonia)    | Pelotón, compañía      |
| Coronel            | Regional / continental   | Regimiento             |
| General            | Planetario               | Ejército de un planeta |
| Almirante          | Sistema                  | Flota de sistema       |
| Mariscal           | Sector (varios sistemas) | Mando de sector        |
| Líder supremo      | Galáctico                | Todo                   |

- **Ascenso:** méritos (gloria, experiencia, operaciones cumplidas) + **nombramiento** por el superior entre los candidatos que cumplen requisitos + **vacante**.
- **La muerte es el motor de los ascensos:** cuando cae un oficial, alguien sube. La guerra devora oficiales y fabrica otros nuevos.
- **Mando de jugadores:** el superior lanza **operaciones**. Cumplirlas da gloria y méritos; ignorarlas no da nada. Solo la **deserción** de una operación activa se castiga (consejo de guerra).
- **Puestos vacíos:** los ocupan oficiales NPC. La pirámide siempre está completa y los jugadores compiten por desplazarlos.
- Detalle de la carrera, las especialidades y las órdenes en §10.

### 9.4 Psiónicos: convergencia

- **Cualquiera puede proponer una iniciativa:** defender un sistema, restaurar un planeta, abrir una ruta, establecer contacto, construir.
- Las iniciativas necesitan **apoyos**. Si superan un umbral en una ventana de tiempo galáctico, se adoptan. **Un psiónico, un voto.**
- **Nadie da órdenes:** las iniciativas adoptadas las ejecutan **voluntarios**, que obtienen reconocimiento.
- La experiencia y la sabiduría dan **influencia**: proponer iniciativas de mayor alcance y más peso en el debate. El voto vale lo mismo.
- **Custodio temporal:** en emergencias, la convergencia puede elegir a un custodio con poderes acotados y fecha de caducidad (como el dictador de la antigua Roma).

### 9.5 Doctrina de guerra psiónica

No quieren guerras, pero saben que a veces la mejor defensa es un buen ataque.

1. **Más difícil de aprobar:** una guerra ofensiva exige **mayoría reforzada** (p. ej. dos tercios) y una **justificación declarada** (amenaza, protección de un planeta, frenar al enjambre, liberar prisioneros...).
2. **Objetivo y caducidad:** se declaran **objetivos concretos**, y la guerra **termina sola** al cumplirlos o al expirar el plazo. Prorrogarla exige votar de nuevo. Estilo quirúrgico: golpear fuerte, lograr el objetivo, retirarse.
3. **Coste moral (disonancia):** si la guerra resulta injustificada (agresión sin amenaza, daño desproporcionado, arrasar un planeta), la facción pierde cohesión, las iniciativas cuestan más y puede haber desgaste psiónico colectivo.

### 9.6 Qué se puede decidir desde el mando

- **Operaciones:** objetivos de guerra (contra la otra facción o el enjambre), sistemas que atacar o defender, recompensas.
- **Comercio global:** aranceles, embargos, puertos francos.
- **Presupuesto:** uso del tesoro de la facción.
- **Diplomacia:** treguas, alianzas temporales contra el enjambre, intercambio de prisioneros (§7.7).
- **Leyes locales:** reglas de PvP, fiscalidad, trato a prisioneros, explotación o protección de planetas.
- **Nunca:** tocar objetos o cuentas de otros jugadores, expulsarlos del juego ni bloquear el contenido básico.

### 9.7 Salvaguardas y caminos no políticos

**Salvaguardas:**

- **Inactividad:** un cargo sin conexión durante X tiempo queda vacante (el criosueño cuenta como inactividad).
- **Multicuentas y compra de apoyos:** requisitos de antigüedad y actividad.
- **Abuso de poder:** límites duros y techos de gasto.
- **Husos horarios:** ventanas de decisión largas.
- **Golpes de estado humanos:** permitidos, con reglas claras (coste, apoyo mínimo, riesgo).

**Caminos no políticos:** independiente/apátrida, mercenario, comerciante, cazarrecompensas, explorador, pirata... La política les afecta **indirectamente**: las guerras generan contratos, los embargos crean contrabando y los impuestos cambian rutas.

---

## 10. La vida de un humano: del reclutamiento al alto mando

### 10.1 Primera sesión

**Prólogo: la primera muerte (~10 min).**

- El jugador empieza **dentro de una batalla**, como un soldado sin nombre en un planeta que cae ante el enjambre.
- Un sargento NPC enseña lo básico: movimiento, combate tab-target, estado derribado y rescate.
- Orden final: cubrir la retirada de las lanzaderas. **El soldado muere sin posibilidad de sobrevivir.**
- **Noticiario de propaganda** satírico: el sacrificio del soldado nº 7.431.902 "no será olvidado".
- Enseña en diez minutos el combate, el rescate, la muerte y el tono. El jugador acepta que morir forma parte del juego antes de crear su personaje.

**Oficina de reclutamiento (creación de personaje).**

- Formulario de alistamiento: nombre, aspecto, mundo y distrito de origen.
- **Trasfondo** con una pequeña ventaja inicial: hijo de minero, seminarista, huérfano de guerra, delincuente indultado a cambio de servir...
- Edad: 18 años.
- Casilla final no desmarcable: "Acepto que mi vida pertenece a la Fe y al Estado".

**Campamento de instrucción (planeta natal).**

- Zona de inicio estilo WoW con un sargento instructor NPC satírico.
- Misiones cortas: patrullas, plagas del perímetro, escolta de convoyes hasta una mina.
- La mina muestra la **extracción humana**: paisaje devastado, motivo de orgullo.
- Otros jugadores con galones lanzan operaciones de escuadra: la cadena de mando existe y la ocupan jugadores.
- Cierre en el **barracón**: desconexión segura y aviso de que el tiempo sigue corriendo.

### 10.2 Primeros días

- **Parte del día** al conectar: estado de la guerra galáctica, órdenes del superior y resumen de lo ocurrido offline. Dos minutos para saber cómo va todo (estilo Hattrick).
- **Día 2–3:** primera operación fuera del planeta en un **transporte de tropas** NPC. Primeras transiciones y primer vistazo al mapa galáctico.
- **Día 4–5 (~20 años):** **licencia de piloto** y primera nave. Se abren la libertad, la frontera, el PvP y la muerte de verdad.
- **Primera semana (~21–22 años):** se abren caminos (carrera militar, comercio, deserción e independencia).
- Al morir: **notificación de defunción** satírica; los bienes almacenados han sido "donados voluntariamente al esfuerzo de guerra".

### 10.3 Volver a empezar tras morir

- Sin prólogo ni campamento. La oficina ofrece **"Ya conozco el procedimiento"**: creación rápida y asignación directa a una operación activa.
- Objetivo: volver a jugar en **~10 minutos**. Se pierde un personaje, no el aprendizaje del jugador.

### 10.4 Carrera militar

**Especialidades** (se eligen hacia los 20–21 años):

| Especialidad | Rol                                                                    |
| ------------ | ---------------------------------------------------------------------- |
| Infantería   | Combate en tierra                                                      |
| Flota        | Pilotos y tripulaciones                                                |
| Inteligencia | Exploración, espionaje, interrogatorios                                |
| Logística    | Suministros, ingeniería, construcción de bases                         |
| Capellanía   | Comisario-sacerdote: moral de la tropa, castigo de la cobardía (§10.6) |

**Etapas:**

| Etapa                                               | Edad   | Qué se hace                                                                                                                                                   | Riesgo                                              |
| --------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **Soldado raso**                                    | 18–22  | Operaciones de 15–20 min; equipo estándar de intendencia; acumular méritos y experiencia                                                                      | Altísimo y barato: la mayoría muere aquí            |
| **Suboficial** (cabo, sargento)                     | 22–30  | Dirigir una escuadra en combate (§10.5); evaluación por resultados; academia de oficiales hacia los 28–30 con recomendación del superior                      | Alto                                                |
| **Oficial** (teniente, capitán)                     | 30–45  | **Diseñar operaciones** desde un panel (objetivo, recompensa, plazo, recursos); logística y refuerzos; **padrinazgo** de protegidos; declive físico desde ~35 | Medio; bajar al frente da moral pero es una apuesta |
| **Jefe** (coronel, general)                         | 45–60  | Capa estratégica: reparto de fuerzas, respuesta al enjambre, apoyo de flota, **cuotas de extracción** (producir hoy degrada mañana)                           | Bajo; bajar al frente es un acontecimiento          |
| **Alto mando** (almirante, mariscal, líder supremo) | 60–75+ | Gran estrategia, diplomacia con los psiónicos, conspiraciones, golpes, purgas; **nombrar sucesor** entre los protegidos                                       | Bajo en combate, alto en política                   |

**Claves del arco:**

- **Embudo realista:** la mayoría muere como soldado, pocos llegan a oficial, poquísimos a general. Los puestos NPC garantizan hueco para quien progresa bien.
- **Cada etapa enseña la siguiente:** combatir, dirigir, diseñar operaciones, gestionar recursos.
- **El riesgo se invierte:** de joven, arriesgar es barato y necesario; de mayor, caro y opcional.
- **El único legado** en un juego sin meta-progresión: a quién dejas en tu lugar.
- **Padrinazgo:** recomendar subordinados crea redes de protegidos leales, clanes dentro de la jerarquía.

### 10.5 Suboficiales: órdenes de escuadra

**Cómo se dan las órdenes** (igual para NPCs y jugadores):

- **Planificación previa (1–2 min):** asignar roles (fusilero, artillero pesado, médico, comunicaciones), revisar equipo y marcar puntos clave.
- **Marcas contextuales:** señalar un enemigo para concentrar fuego; señalar el suelo para avanzar o mantener posición.
- **Rueda de órdenes:** avanzar, mantener, flanquear, cubrirse, replegarse, reagruparse, rescatar a un compañero.
- **Subgrupos** (equipo A / equipo B) en escuadras grandes.
- El personaje **grita la orden** con una frase de voz y al subordinado le aparece como objetivo con marcador. Sin texto ni voz real: funciona entre idiomas.
- **Puntos de mando:** cada orden consume un recurso que se regenera según el atributo de mando. Evita el spam y convierte dirigir en una habilidad.

**NPCs:** obediencia total, pero la **calidad de ejecución** depende de su entrenamiento, su moral y el atributo de mando del sargento. Con la moral hundida pueden dudar o retroceder.

**Jugadores: incentivos, no imposición.** Nunca se le quita el control de su personaje a un jugador.

1. **Cohesión:** si varios miembros siguen la misma orden, la escuadra gana bonificaciones (daño en fuego concentrado, resistencia al mantener posición, rescates más rápidos). Obedecer es la forma más eficaz de jugar.
2. **Méritos:** el sistema registra el cumplimiento de cada orden en la **hoja de servicios**. El desobediente asciende más despacio.
3. **Partes disciplinarios** (número limitado por misión): los revisa el superior con el registro de cumplimiento como prueba. Consecuencias solo de carrera (méritos, degradación, traslado); nunca bloquean el juego.
4. **Deserción:** solo la detecta el sistema (abandonar el área de una operación activa sin estar derribado ni tener orden de repliegue). Consejo de guerra automático.

**Contrapesos frente al sargento malo:**

- **Al sargento le evalúan los resultados** (bajas, objetivos, supervivencia), no la obediencia. Si da órdenes suicidas, paga él.
- **Los soldados eligen escuadra** antes de cada operación (o el sistema los asigna). Los buenos sargentos atraen jugadores: **mercado de reputación**.
- **Evaluación hacia arriba** tras la misión, con protección contra represalias directas.

### 10.6 Capellanía

- Comisario-sacerdote: sube la moral, castiga la cobardía.
- **Con NPCs:** mano libre, incluida la ejecución de cobardes.
- **Con jugadores:** solo puede actuar contra quien el **sistema** haya marcado como desertor en ese momento, y le cuesta algo (reputación, recursos, enfriamiento largo). Evita que un jugador mate a otros de su facción a su antojo.

---

## 11. Arquitectura técnica

### 11.1 Principios

- **Servidor autoritativo.** El cliente envía intenciones y el servidor simula y difunde los cambios.
- **El servidor simula en 2D.** Posiciones (x, z) sobre navmesh en cada zona; la altura es mayormente cosmética.
- **Una escena = una zona de servidor.**

### 11.2 Cliente

- **Motor:** Babylon.js con WebGPU (preferido). Alternativa: PlayCanvas.
- **Lenguaje:** TypeScript, con código y tipos compartidos con el servidor.
- **UI y capa estratégica** (inventario, chat, mapa galáctico, paneles de mando): framework web (Vue/Angular).
- **Streaming de assets** por escena, con caché en IndexedDB / Cache API.
- **Estilo visual:** low-poly estilizado.

### 11.3 Red

- WebSockets con mensajes binarios. WebTransport, más adelante.
- Tick del servidor entre 10 y 20 Hz, con interpolación en el cliente.
- Delta compression y cuantización de posiciones.

### 11.4 Servidor de juego

| Opción                           | Pros                                                | Contras                                  |
| -------------------------------- | --------------------------------------------------- | ---------------------------------------- |
| Propio en Node/TS + ECS (bitECS) | Terreno conocido, comparte código con el cliente    | Monohilo; escalar por zonas; todo a mano |
| SpacetimeDB                      | Unifica BD y servidor; pensado para MMOs (BitCraft) | Lógica en Rust/C#; tecnología joven      |
| Nakama                           | Maduro; cuentas, chat, gremios                      | Menos orientado a simulación de mundo    |

**Plan:** prototipo en Node/TS, sin perder de vista SpacetimeDB.

### 11.5 Persistencia

- **Postgres** para el estado durable: personajes (con edad y τ), clones, inventarios, territorio, planetas, prisioneros, operaciones e iniciativas.
- **Redis** para sesiones y pub/sub entre zonas.
- Estado vivo en memoria, volcado por lotes y en eventos críticos (comercio, loot raro, muertes, capturas, transferencias).
- Planetas procedurales como **semilla + diffs**.

### 11.6 Infraestructura

- Kubernetes.
- Servicios: login/cuentas, gateway, servidores de zona, servicio de galaxia (estado estratégico), **servicio de mando** (operaciones, iniciativas, votaciones) y **director de guerra** (§3.2).

---

## 12. Retos técnicos clave

- **Interest management (AOI):** rejilla espacial.
- **Precisión float32:** floating origin en el espacio de sistema.
- **Traspaso entre zonas** durante las transiciones.
- **Física de naves en red:** simple y arcade.
- **Tamaño de descarga y memoria** en navegador.
- **Director de guerra:** IA que genere ofensivas interesantes, no solo numerosas.
- **Coherencia temporal:** edades, clones, criosueño y anclaje calculados correctamente por tramos.
- **Load testing desde el día uno:** bots headless.

---

## 13. Decisiones tomadas

| Decisión                                                                                          | Motivo                                                                       |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Navegador                                                                                         | Perfil de desarrollo web; cero instalación                                   |
| 3D con cámara en tercera persona estilo WoW                                                       | Visión espacial e inmersión (asumiendo más coste de arte)                    |
| Sin seamless espacio ↔ planeta; tres capas con transiciones (modelo SWTOR)                        | Precisión, LOD, escalado de servidor y contenido                             |
| Planetas híbridos (a mano + procedurales)                                                         | Densidad de contenido + exploración                                          |
| Combate tab-target                                                                                | Tolerante a la latencia                                                      |
| Facciones originales inspiradas en arquetipos                                                     | Evitar problemas de IP                                                       |
| Dos facciones jugables (humanos, psiónicos) + enjambre NPC                                        | El enjambre no encaja como jugable; como NPC genera contenido y equilibra    |
| Galaxia diseñada con sistemas natales equidistantes; civilizaciones ya espaciales                 | Equilibrio y mundo inicial controlado                                        |
| Al desconectar, el personaje permanece en el mundo                                                | Coherencia con el mundo persistente                                          |
| **Juego lento, sesiones diarias cortas** (OGame, Hattrick)                                        | Gusto del diseñador; progreso que se nota con el tiempo                      |
| **Roguelike de vidas: personajes concretos, sin meta-progresión de cuenta**                       | La identidad humana se diluye; el valor de una vida crece con lo que acumula |
| **Humanos: muerte definitiva; lo almacenado pasa al Estado**                                      | "¿Qué es una vida? Hay millones"                                             |
| **Psiónicos: transferencia solo a clon maduro; sin él, muerte**                                   | Pocos y preciosos; planificación de clones                                   |
| **Derribado antes que muerto**                                                                    | Rescate, captura y negociación                                               |
| **Envejecimiento con fases vitales; vida de ~4 meses reales**                                     | Arco de soldado a mando; tiempo para que las decisiones maduren              |
| **Calendario comprimido: 1 año ≈ 2 días reales**; día-noche planetario a escala jugable           | Ritmo de juego lento sin romper la jugabilidad en superficie                 |
| **Tono satírico para los humanos** (Helldivers, Starship Troopers)                                | Glorificación de la guerra sin apología                                      |
| **Humanos: cadena de mando; psiónicos: convergencia**                                             | Dos formas distintas de jugar la parte estratégica                           |
| **Psiónicos pueden iniciar guerras**, con mayoría reforzada, objetivos, caducidad y coste moral   | Pragmáticos con principios                                                   |
| **Economía asimétrica: extraer frente a cuidar**                                                  | Asimetría de ritmo y valores                                                 |
| **Prólogo humano con muerte obligatoria**                                                         | Enseña combate, rescate, muerte y tono antes de crear personaje              |
| **Reinicio rápido tras morir ("Ya conozco el procedimiento")**                                    | Que el roguelike no expulse: ~10 min para volver a jugar                     |
| **Carrera militar en cinco etapas con especialidades**                                            | El tipo de juego cambia con la edad y el rango                               |
| **Órdenes por marcas contextuales, rueda y puntos de mando**                                      | Sin texto ni voz; dirigir como habilidad                                     |
| **Obediencia de jugadores por incentivos, no por imposición**                                     | Nunca quitar el control al jugador                                           |
| **Capellán: poder limitado sobre jugadores (solo desertores marcados por el sistema, con coste)** | Mantener el sabor sin abrir la puerta al abuso                               |

---

## 14. Riesgos

- **Alcance.** Es un proyecto de años.
- **Arte y animación.** El mayor cuello de botella, sobre todo los psiónicos y el enjambre. Recursos: Quaternius, Kenney, Mixamo, generación 3D con IA (Meshy, Tripo) + retoque.
- **Retención con muerte roguelike.** Si volver a ser útil tras morir cuesta demasiado, la gente abandonará.
- **Desequilibrio de población** entre dos facciones. Los psiónicos pacíficos pueden atraer a otro perfil (constructores, estrategas), lo que ayuda, pero harán falta incentivos.
- **Psiónicos en un juego de guerra:** necesitan un **pacifismo armado** jugable (defensas formidables, tecnología, poderes) y combate legítimo contra el enjambre.
- **Fase de soldado en sesiones cortas:** el contenido estilo WoW tiende a pedir sesiones largas.
- **Mantener la motivación.** Hay que poder enseñar y jugar algo pronto.

---

## 15. Roadmap

### Prototipo 0 — "La Retirada"

- Primer jugable: humanos contra centollos en una partida multijugador corta. Spec en `spec-prototipo-0-la-retirada.md`.
- Cubre buena parte de los hitos 0 y 2, y valida el combate antes de seguir.

### Hito 0 — Columna vertebral técnica

- Servidor autoritativo con zonas y AOI.
- 500 bots moviéndose en una zona sin degradación.

### Hito 1 — Vertical slice

- 1 sistema estelar con una estación.
- 1 planeta hecho a mano (zona pequeña) + 1 planeta procedural.
- Nave que vuela, despega y aterriza con transiciones.
- Varios jugadores viéndose en las tres escenas.

### Hito 2 — Primer bucle de juego

- Recoger recurso → craftear → comerciar con otro jugador.
- Combate básico tab-target contra NPCs del enjambre.
- Estado derribado, rescate y muerte con pérdida de lo que llevas encima.
- Prólogo y oficina de reclutamiento.

### Hito 3 — Persistencia, tiempo y vida

- El mundo sobrevive a los reinicios. Login y personajes.
- Tiempo galáctico, edad, fases vitales y criosueño.

### Hito 4 — Mando

- Cadena de mando humana con operaciones; órdenes de escuadra (marcas, rueda, puntos de mando, cohesión).
- Capa estratégica básica (mapa galáctico, mando de NPCs).

### Hito 5+ — Crecer

- Facción psiónica (clones, convergencia), director de guerra, combate de naves, captura y negociación, economía asimétrica, mazmorras...

---

## 16. Preguntas abiertas

**Mundo y lore**

- [ ] Nombre comercial del juego y nombres de las facciones (en clave: Proyecto UDC; enjambre = "centollos" para los humanos).
- [ ] Lore base.
- [ ] El secreto del pasado psiónico.
- [ ] Origen del enjambre: tercer vértice (opción A) o desde fuera (opción B).
- [ ] ¿Pueden los psiónicos percibir o comunicarse parcialmente con el enjambre?
- [ ] Lore de los agujeros de gusano y si existe viaje relativista.
- [ ] Número de sistemas iniciales y cuántos hechos a mano.

**Gameplay**

- [ ] ¿Clases dentro de cada facción?
- [ ] Curva de nivel de la fase de soldado (rápida, para que morir no expulse).
- [ ] Diseño del combate de naves.
- [ ] Reglas de PvP.
- [ ] Cuándo obtiene el jugador su primera nave.
- [ ] ¿Las flotas NPC se fabrican con recursos de los jugadores? Límites por facción.
- [ ] Duración del estado reforzado y ventanas de vulnerabilidad.
- [ ] Alcance de la construcción en planetas mundo frente a planetas de exploración.
- [ ] Duración del temporizador de desconexión y del bloqueo de combate.
- [ ] Contenido de soldado para sesiones de 15–20 minutos.

**Vida, muerte y captura**

- [ ] ¿Un personaje puede morir definitivamente estando offline?
- [ ] Qué le queda a un psiónico que muere sin clon maduro.
- [ ] Coste de la transferencia psiónica (desgaste, límite de saltos).
- [ ] Tiempo de maduración y coste de un clon.
- [ ] Coste y límites del criosueño.
- [ ] ¿Puede el jugador jugar otro personaje mientras el suyo está preso?
- [ ] Duración de la ventana de rescate de un derribado y del cautiverio máximo.
- [ ] Desenlace por defecto si no hay acuerdo en una negociación.
- [ ] Evasión del Estado: ¿se permite pasar bienes a otros antes de morir?
- [ ] Mecánica de gloria: confirmar y concretar.

**Mando y política**

- [ ] Nombres de las ideologías y religiones in-game.
- [ ] Número de puestos por escalón en la cadena de mando humana.
- [ ] Tamaño de escuadra y composición NPC/jugadores.
- [ ] Valores de cohesión, coste de las órdenes y regeneración de puntos de mando.
- [ ] Límite de partes disciplinarios y quién los revisa cuando el superior es NPC.
- [ ] Panel de diseño de operaciones de la etapa de oficial.
- [ ] ¿Las especialidades se pueden cambiar a lo largo de la carrera?
- [ ] Recorrido de un jugador psiónico (equivalente a §10).
- [ ] Umbrales de apoyo de las iniciativas psiónicas y de la guerra ofensiva.
- [ ] Mecánica de disonancia: qué la provoca y cuánto dura.
- [ ] ¿Se puede cambiar de facción o solo hacerse independiente?
- [ ] Incentivos para la facción menos poblada.

**Tiempo**

- [ ] Duración del día local en los planetas (horas reales).
- [ ] Qué envejece y qué caduca además de los personajes: objetos, construcciones.

**Técnico y negocio**

- [ ] Servidor: Node/TS propio vs SpacetimeDB (decidir tras el prototipo).
- [ ] Monetización (si la hay).
