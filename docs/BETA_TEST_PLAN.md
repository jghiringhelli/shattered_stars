# Plan de pruebas de la beta

Documento de trabajo (en español) para probar todo lo que se pueda antes de abrir la beta a más gente.
Build bajo prueba: **https://jghiringhelli.github.io/shattered_stars/** (esquina inferior derecha: `v0.2.0-beta.1 BETA · e04ff80`).
Sin online todavía: el relay no está desplegado, así que esa parte queda en la tarea T17.

## Cómo lo vamos a hacer

1. Haces **una tarea por vez**, en orden. Cada una dice cuánto tarda, qué hacer, qué debería pasar y qué anotar.
2. Al terminar me escribes: `T05 ok` o `T05 falla: <qué pasó>` (si puedes, usa **SEND FEEDBACK** y adjunta el archivo).
3. Yo corrijo lo que falle (test primero) y lo marco aquí. Las correcciones se publican juntas al final de cada ronda, no una a una.
4. Mientras tú pruebas, yo corro la **Parte B** (pruebas automatizadas) y te cuento los resultados.

Estados: `[ ]` pendiente · `[x]` hecha y sin problemas · `[!]` con fallos (ver Registro).

## Preparación (2 min, una sola vez)

- Navegador de escritorio actual (Chrome o Edge recomendado), ventana de 1280×720 o mayor, teclado. Gamepad opcional.
- Abre la URL de arriba. Si ves una versión distinta a `e04ff80`, recarga con Ctrl+F5.
- Ten a mano un bloc de notas. Anota hora aproximada, modo, nave y qué hiciste justo antes de cada problema.
- Teclas por defecto: **← →** giran, **↑ ↓** acelerador, **Q / E** giro cerrado, el disparo principal es automático, **Espacio** disparo secundario, **Tab** cambia de arma, **R** marca objetivo, **Z** tecla de maniobra, **G** cambia de puesto en naves grandes, **C** camuflaje, **V / B** poderes de héroe (campaña), **Esc o P** pausa, **F1 o ?** ayuda de teclas.

---

## Parte A — Tareas tuyas

### Ronda 1 — Humo (≈ 35 min): ¿arranca y se entiende?

**[ ] T01 · Primera impresión (5 min)**
- Abre la URL en una ventana normal. Espera a que el menú esté listo.
- Mira: etiqueta de versión, panel de bienvenida, **TESTER INFO** (lo reabre), **CREDITS** (no debe nombrar otros juegos).
- Recorre el menú con teclado (↑ ↓, Enter) y con ratón.
- Debe pasar: carga sin pantalla negra, sin textos cortados ni en inglés/español mezclado de forma rara, el menú responde a ambos.
- Anota: tiempo hasta ver el menú, cualquier texto raro, cualquier botón que no haga nada.

**[ ] T02 · Flight School (10 min)**
- Pulsa **F** en el menú (o START en el recuadro de Flight School). Completa todas las lecciones.
- En Settings › Controls reasigna una tecla y úsala en una lección.
- Debe pasar: cada lección detecta tu entrada, los textos muestran las teclas que tienes asignadas, el roll y el Snap Turn se enseñan con los gestos correctos (doble toque ← ←; Z).
- Anota: lección donde te atascas, prompts confusos, gestos que no detecta.

**[ ] T03 · Una batalla rápida de Skirmish (15 min)**
- SKIRMISH › elige una facción y nave (o un quick build) › Normal › juega una batalla completa.
- Durante la batalla: pausa con Esc, abre Settings desde la pausa y reanuda. Abre F1.
- Al final: mira el panel de resultados (estadísticas, REMATCH, MAIN MENU). Prueba R para revancha.
- Debe pasar: la batalla se entiende sola, el HUD se lee, la pausa congela de verdad, los resultados coinciden con lo que viviste.
- Anota: cuánto duró, si ganaste, qué no entendiste del HUD.

### Ronda 2 — Pilotaje (≈ 40 min): lo más importante del juego

**[ ] T04 · Gestos de maniobra (15 min)**
Hazlo en Skirmish, una nave cada vez (usa SQUAD para elegirla):
- Con **Free Confederation · Sparrow** (tiene roll): doble toque ← ← y → → hacen barrel roll. Alternar ← → rápido **no** debe hacer roll, solo girar. Prueba ↑↑ (boost).
- Con **Synthetic Collective · Stalker** (tiene Hook Loop): mantén **Z** y pulsa ← o →.
- Con **Free Confederation · Raven** (tiene Knife Roll): toca **Z**, vuelve a pulsar **Z** y manténla, y pulsa ← o →.
- Con cualquier nave: toca **Z** una vez (Snap Turn, tarda un poco en ejecutarse) o ↓↓ (Snap Turn sin espera).
- Debe pasar: cada gesto produce su maniobra; si la nave no tiene ese truco, aparece un aviso claro (por ejemplo "NOT ON DIAL") y no ocurre nada raro.
- Anota: gestos que se confunden entre sí, gestos que se disparan sin querer, retrasos que molestan.

**[ ] T05 · Regla de identidad de nave (10 min)**
- Cada nave solo debería poder hacer **uno** de: barrel roll, Hook Loop o Knife Roll (el boost y el Snap Turn aparecen aparte).
- Mira en la pantalla de selección y en la Enciclopedia la línea "SPECIALS" de 3–4 naves distintas y comprueba que coincide con lo que haces en vuelo.
- Settings › Gameplay › **Ship Specials**: cambia a "Full card" y comprueba que una nave con varias opciones ahora puede usarlas todas; vuelve a "Ship identity".
- Debe pasar: lo que dice la ficha de la nave es lo que puede hacer; el ajuste cambia el comportamiento.
- Anota: ¿se entiende por qué una nave no hace algo? ¿Hay alguna nave que sientas coja sin su otro truco?

**[ ] T06 · Estrés y acciones (5 min)**
- En Skirmish, haz varias maniobras rojas seguidas hasta quedar estresado. Intenta un roll y un boost.
- Debe pasar: con estrés te niega las acciones y las maniobras rojas, con aviso en pantalla; las barras de recarga (ROLL, BOOST) se entienden.
- Anota: si el aviso es claro o confuso.

**[ ] T07 · Armas y escuadrón (10 min)**
- En Skirmish con una nave con ordenanza: **Espacio** dispara el secundario, **Tab** cambia de arma. Prueba bombas o minas si tu nave las tiene.
- **R** marca el objetivo del escuadrón; mira si tus alas lo siguen.
- Debe pasar: el HUD muestra qué arma está activa y qué munición queda; la marca visible en el objetivo.
- Anota: si el secundario se siente demasiado fuerte o débil, si la marca se nota.

### Ronda 3 — Modos (≈ 85 min)

**[ ] T08 · Dogfight y Ace Duel (15 min)**
- DOGFIGHT: un duelo al mejor de tres. ACE DUEL: un enfrentamiento de pilotos con nombre (prueba también el duelo de interceptores).
- Debe pasar: la revancha funciona, las habilidades de los ases se entienden, el resultado es justo.
- Anota: emparejamientos que sientas injustos, cuánto duran los duelos.

**[ ] T09 · Skirmish: variantes (15 min)**
- Prueba equipos 2v2, refuerzos (la ventana de reemplazo), un escenario (Satellite Array, Chance Engagement, Salvage o Scramble) y dificultades Easy y Hard.
- Debe pasar: cada variante arranca y termina; el selector de reemplazos se entiende.
- Anota: lo que no se explica bien, partidas que se alargan o se acaban demasiado rápido.

**[ ] T10 · Survival (20 min)**
- Una partida completa: elige un inicial, juega un nodo, escoge recompensa, visita una tienda, enfréntate a un élite o jefe.
- Cierra la pestaña a mitad y vuelve a abrir: **CONTINUE**.
- Debe pasar: la partida se retoma donde estaba; los precios y reliquias son legibles; el jefe criatura (Cinder Wyrm, Deepmaw o Choir-Hive) se entiende.
- Anota: ritmo de los nodos, precios raros, dificultad (¿llegaste lejos?).

**[ ] T11 · Epic Format y Boss Raid (15 min)**
- EPIC FORMAT: una batalla de refuerzos con flota grande. BOSS RAID: derribar una nave capital.
- Con una nave grande: **G** cambia de puesto, **1–4** dan órdenes de comandante.
- Debe pasar: Esc vuelve atrás en la pantalla de setup de Boss Raid; el radar es legible; el jefe es justo.
- Anota: caídas de FPS (y en qué momento), arcos de disparo confusos.

**[ ] T12 · Campaña (20 min)**
- CAMPAIGN › cualquier facción › juega la primera misión. Usa **V** y **B** (poderes de héroe).
- Fíjate en: el briefing, los diálogos **después** de ganar y el debrief; guarda, cierra y vuelve a abrir.
- Si puedes llegar a la Coalición (Actos IV–V, el interruptor FREE ORDER de la pestaña Chronicle quita los bloqueos), prueba el panel **COALITION LEAD** para cambiar de héroe. Si no puedes llegar, avísame y te preparo un guardado.
- Debe pasar: la historia se entiende, los diálogos suenan en su momento, el guardado se retoma.
- Anota: misiones demasiado difíciles o fáciles, retratos que falten, música que no encaja.

### Ronda 4 — Interfaz y entorno (≈ 70 min)

**[ ] T13 · Pantallas de selección y Enciclopedia (15 min)**
- En SQUAD BUILDER / selección de nave: cambia de pestañas, pasa el cursor por etiquetas, prueba los quick builds, guarda un escuadrón, comparte con un código y reábrelo.
- ENCYCLOPEDIA: busca naves, pilotos, mejoras y criaturas.
- Debe pasar: **ningún nombre de nave termina en "…"**, las pestañas no están sobrecargadas, los retratos nuevos (Kronos, Ilsandre, Blackmaw, Vosk) aparecen en la campaña o la Enciclopedia.
- Anota: textos cortados, pestañas confusas, tooltips que no explican.

**[ ] T14 · Ajustes y accesibilidad (10 min)**
- Settings › Accessibility: cambia la paleta de colores (daltonismo), activa **Reduce Motion**, **Reduce Flashes**, el preset de accesibilidad y **Sharp Scaling**. Settings › Audio: volúmenes. Settings › Controls: reasigna dos teclas.
- Debe pasar: cada ajuste tiene efecto inmediato y se conserva al recargar; la ayuda F1 muestra tus teclas actuales.
- Anota: ajustes que no se guardan o no hacen nada.

**[ ] T15 · Pausa automática y ventana (5 min)**
- En una batalla offline, cambia de pestaña o minimiza: al volver debe estar **en pausa**. Cambia el tamaño de la ventana, pasa a pantalla completa.
- Debe pasar: pausa automática; el juego se reescala bien; no se pierde la batalla.

**[ ] T16 · Guardado, privacidad y feedback (15 min)**
- Abre el juego en una ventana privada: debe avisarte de que no se guarda nada.
- En la ventana normal: Settings › Advanced › **View stats**; **SEND FEEDBACK** (descarga el archivo y abre el formulario de GitHub; no hace falta enviarlo, solo comprobar que abre).
- Lee de nuevo README, PRIVACY y KNOWN_ISSUES: ¿dicen la verdad de lo que ves?
- Anota: cualquier cosa del texto que no coincide con el juego.

**[ ] T17 · Audio (10 min)**
- Antes de pulsar nada, el menú debe estar en silencio (el navegador no deja sonar). Pulsa una tecla: empieza la música.
- Escucha el cambio entre menú, combate y tensión; la música de campaña; los avisos del Broadcast y del motivo de la Marea.
- Anota: cortes, volumen desequilibrado, música que no encaja con la facción.

**[ ] T18 · Rendimiento en tu equipo (10 min)**
- Mide la fluidez en Epic Format y en Survival con muchos enemigos. Anota tu navegador y tarjeta gráfica.
- Si baja de 40 FPS, prueba Settings › Accessibility › **Sharp Scaling** y **Reduce Motion** y anota si cambia algo. El juego también baja la calidad visual solo en batallas grandes.

### Ronda 5 — Opcionales

**[ ] T19 · Gamepad (10 min, si tienes uno)**: menús, vuelo, roll (flick del stick derecho ← →), Snap Turn (flick ↓), LT como tecla de maniobra, y órdenes de comandante en naves capitales.

**[ ] T20 · Otros navegadores (10 min)**: abre el juego en Firefox y/o Safari y repite T01 y T03.

**[ ] T21 · Online (bloqueada)**: depende de desplegar el relay (cuenta en Render). Cuando exista: partida rápida entre dos navegadores, sala con código, revancha desde resultados y reconexión.

---

## Parte B — Tareas mías (automatizadas)

Se ejecutan mientras tú pruebas. Resultado en la columna de estado.

| # | Tarea | Qué comprueba | Estado |
|---|---|---|---|
| B1 | Suite e2e completa en servidor tranquilo | Que nada de lo cambiado en las últimas rondas rompió algo no cubierto por CI | [ ] |
| B2 | Humo contra la web publicada | Arranque, cada pantalla de menú y una batalla de cada modo en el sitio real, con errores de consola | [ ] |
| B3 | Firefox y WebKit | Investigar el fallo no bloqueante del CI (timeout en modo canvas, descarga de navegadores) | [ ] |
| B4 | Pruebas de larga duración | IA contra IA 10 min en cada modo: fugas de memoria, errores, bloqueos | [ ] |
| B5 | Online local con 4 clientes | 2v2, revancha en Dogfight, reconexión y red lenta (netsim) | [ ] |
| B6 | Runner de campaña con bots | Medir la dificultad real de las 86 misiones (hoy solo hay una proxy) | [ ] |
| B7 | Teclado y foco en menús | Orden de foco y que todo sea alcanzable sin ratón | [ ] |
| B8 | Compatibilidad de guardados | Que un guardado v4 de la build anterior sigue cargando | [ ] |
| B9 | Informe de balance | `npm run balance:report` actualiza `docs/balance/latest.md` | [ ] |
| B10 | Cierre de documentos y publicación | Actualizar `ALPHA_CHECKLIST.md`, subir las correcciones a `release` y verificar el despliegue | [ ] |

---

## Registro de resultados

| Tarea | Resultado | Qué pasó | Arreglo |
|---|---|---|---|
| | | | |
