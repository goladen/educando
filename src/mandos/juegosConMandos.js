// Todos los juegos que se juegan con los mandos micro:bit: dónde están, en qué modo va el mando,
// cuántos juegan y cómo. Lo usa la guía del panel de mandos (GuiaJuegosMandos.jsx).
// Si se añade un juego con mandos, añadirlo aquí y en public/guia-pikt-es.html (#microbit).

export const OPCIONES_COMUNES = [
    { t: '🎮 Botón «Mandos micro:bit»', d: 'En los juegos que no son «de mandos» aparece abajo a la izquierda. Al pulsarlo se activan los mandos en ese juego (se recuerda la próxima vez) y se abre el panel ⚙.' },
    { t: '⏸ Conectar antes de empezar', d: 'El botón ya sale en el menú de cada juego (también en Trivial, Pikatron y Six Seven) para conectar la antena y elegir quién juega antes de la partida. Si un juego empieza solo (enlace o tarjeta con recurso, p. ej. Bunker o Burbujas) y la antena está conectada o los mandos ya estaban activados en ese juego, la partida espera con el panel abierto hasta pulsar «▶ Empezar».' },
    { t: '👤 Quién juega', d: 'Cada jugador (pala, nave, mira, equipo…) lo lleva un mando. Si no eliges ninguno, lo coge el primer mando que se mueva. Se cambia en el desplegable o con ⏭ (pasa al siguiente mando).' },
    { t: '🔄 Relevos', d: 'Como en el Ovni: al acabar cada partida (o nivel, o palabra) juega el siguiente mando y sale el cartel «Le toca a…». Así toda la clase va pasando por turnos aunque el juego sea de un jugador.' },
    { t: '👥 Juegan a la vez', d: 'En Burbujas, Ahorcado y Six Seven el profe elige de 1 a 4 jugadores a la vez (1 = relevos). En Pong, Money Board y Trivial depende del modo o de los equipos o jugadores.' },
    { t: '🏆 Marcador de la sesión', d: 'Partidas, puntos, mejor partida y aciertos de cada mando. Se mantiene aunque cambies de pantalla dentro del juego; se borra con «🗑 Borrar marcador».' },
    { t: '📤 Guardar resultados', d: 'Al final (o en el panel ⚙) se guarda un informe con todos los mandos usando el código del profesor: con sesión iniciada se rellena solo. Se pueden corregir los nombres y los mandos virtuales no se marcan. Sale en Informes.' },
    { t: '✏️ Nombres', d: 'Los nombres de los mandos («Mando 3» → «Lucía») son los mismos en todos los juegos.' },
    { t: '↕ Invertir delante/detrás', d: 'Si al inclinar el mando hacia delante el juego va hacia atrás, marca esta casilla en el panel ⚙.' },
    { t: '🧪 Mandos virtuales', d: 'Los mandos 901-903 del panel de mandos sirven para probar los juegos sin placas.' },
];

// modo: letras | numero | abecedario | mover | futbol | volante | instrumentos
export const JUEGOS_CON_MANDOS = [
    // ── Juegos hechos para los mandos ──
    { grupo: 'de mandos', emoji: '🏆', nombre: 'Quiz con mandos', donde: 'Programación y robótica → 🎮 Mandos micro:bit', modos: ['letras', 'numero'], jugadores: 'Toda la clase a la vez',
        como: 'Pregunta en la pizarra con cuenta atrás; cada alumno responde A-D o marca el número. Puntúa acertar y la rapidez. Tablas, sumas, preguntas propias o cualquier recurso (eligiendo la hoja).' },
    { grupo: 'de mandos', emoji: '🧮', nombre: 'Mates con mandos', donde: 'Math World o /matesmandos', modos: ['letras', 'numero'], jugadores: 'Toda la clase a la vez',
        como: 'Como el Quiz pero con los ejercicios de las fichas de Math World (cálculo, fracciones, ecuaciones, geometría…).' },
    { grupo: 'de mandos', emoji: '🤖', nombre: 'Pista de robots', donde: 'Panel de mandos', modos: ['mover'], jugadores: 'Toda la clase a la vez',
        como: 'A avanza y B gira. ⭐ Estrellas o ❓ Preguntas: llegar el primero a la casilla de la respuesta correcta (+3); pisar una incorrecta resta y aturde 2 s.' },
    { grupo: 'de mandos', emoji: '✏️', nombre: 'Copia el dibujo', donde: 'Panel de mandos', modos: ['mover'], jugadores: 'Toda la clase a la vez',
        como: 'Geometría de tortuga: cada uno repasa la figura en su tablero (A avanza, B gira, A+B sube o baja el lápiz).' },
    { grupo: 'de mandos', emoji: '⚽', nombre: 'Fútbol 3D con mandos', donde: 'Panel de mandos o Fútbol Quizz', modos: ['volante'], jugadores: 'Por equipos',
        como: 'Inclinar = correr, A/B = pase a izquierda/derecha, logo o agitar = chutar. Si un rival alcanza al del balón, duelo de pregunta: el primero que acierta se queda el balón. Se puede elegir recurso y hoja.' },
    { grupo: 'de mandos', emoji: '🦑', nombre: 'Luz roja · Luz verde', donde: 'Tarjeta Luz roja · Luz verde → «Jugar con mandos»', modos: ['letras'], jugadores: 'Toda la clase a la vez',
        como: 'Primero se responde (A elige, B o agitar envía); con la luz verde, los que acertaron avanzan agitando. Moverse con la roja elimina.' },
    { grupo: 'de mandos', emoji: '🎃', nombre: 'Escape room de Halloween', donde: '/escaperoom → modo «Con mandos»', modos: ['letras', 'numero', 'abecedario'], jugadores: 'Toda la clase a la vez',
        como: 'En las salas se responde A-D; en el candado cada uno escribe el código carácter a carácter y el primero que lo completa abre la puerta.' },
    { grupo: 'de mandos', emoji: '🪢', nombre: 'Tirón de cuerda', donde: 'Geografía, Biología, Fracciones, Lengua, Potencias, Sistemas, Sintaxis…', modos: ['letras'], jugadores: '2 equipos',
        como: 'Cada equipo vota con los mandos y gana la letra más votada. Se puede mezclar: un equipo con mandos y otro en la pantalla.' },
    { grupo: 'de mandos', emoji: '🛸', nombre: 'Ovni Abducción', donde: '/ovni → «🎮 Mandos micro:bit»', modos: ['volante'], jugadores: '1 o 2 (pantalla dividida) + turnos',
        como: 'El mando es el volante: inclinado, el ovni avanza; A o agitar abduce. Se elige quién pilota cada nave y con 🔄 Turnos cambia el piloto en cada ronda.' },
    { grupo: 'de mandos', emoji: '👾', nombre: 'Invasión Pi', donde: '/invasores', modos: ['letras', 'numero', 'volante'], jugadores: '1 a 4 (zonas)',
        como: 'Arcade retro: según la variante se dispara a la respuesta con A-D o con el número, o se mueve la nave inclinando y se dispara con A o agitando.' },
    { grupo: 'de mandos', emoji: '🛰️', nombre: 'Laboratorio de mates', donde: '/labmicrobit', modos: ['instrumentos'], jugadores: 'Grupos',
        como: 'Las placas son instrumentos: GPS de clase por sonido, distancia, inclinómetro, brújula, sensores, caída libre y ⏱️ cronómetro (A inicia, B para y envía; estadística de la clase).' },
    { grupo: 'de mandos', emoji: '🚗', nombre: 'Conducir el mBot2', donde: 'Programación y robótica → Conducir', modos: ['volante'], jugadores: '1',
        como: 'El mando es el volante del robot (simulador o mBot2 real): inclinar = acelerar y girar, B = freno, A = bocina.' },

    // ── Juegos de siempre con el botón 🎮 (relevos) ──
    { grupo: 'relevos', emoji: '🏓', nombre: 'Pong (Arkade)', donde: 'Tarjeta Arkade', modos: ['volante'], jugadores: '1 contra la CPU o 2 (una pala cada uno) + relevos',
        como: 'Inclinar delante/atrás sube y baja la pala; A o agitar saca. Al acabar, agitar empieza otra partida.' },
    { grupo: 'relevos', emoji: '🧱', nombre: 'Tetris, Arkanoid y Bomberman (Arkade)', donde: 'Tarjeta Arkade', modos: ['volante'], jugadores: '1 + relevos',
        como: 'Tetris: inclinar a los lados mueve, atrás o B baja rápido, A o agitar gira. Arkanoid: inclinar mueve la pala, A lanza. Bomberman: inclinar anda, A pone bomba. Agitar empieza otra partida.' },
    { grupo: 'relevos', emoji: '🏃', nombre: 'Pikatron 2 (plataformas)', donde: 'Tarjeta Pikatron 2', modos: ['volante'], jugadores: '1 + relevos por nivel',
        como: 'Inclinar a los lados = andar; A, agitar o inclinar delante = saltar. En las pantallas de inicio y final, agitar sigue.' },
    { grupo: 'relevos', emoji: '⚡', nombre: 'Pikatron', donde: 'Tarjeta Pikatron', modos: ['volante'], jugadores: '1 + relevos',
        como: 'A, B, agitar o inclinar delante = saltar. En la pantalla de nivel, agitar empieza.' },
    { grupo: 'relevos', emoji: '🎯', nombre: 'Bunker', donde: 'Tarjeta Bunker', modos: ['volante'], jugadores: '1 + relevos',
        como: 'Inclinar a los lados gira, delante/atrás avanza o retrocede; A o agitar dispara a la respuesta correcta, B recarga. Al acabar, agitar repite.' },
    { grupo: 'relevos', emoji: '🔵', nombre: 'Burbujas', donde: 'Tarjeta Burbujas', modos: ['volante'], jugadores: '1 (relevos) o 2-4 a la vez',
        como: 'Cada mando lleva una mira: inclinar la mueve y A o agitar explota la burbuja. A la vez: el primero que explota la correcta gana (+100, −50 al fallar).' },
    { grupo: 'relevos', emoji: '🪢', nombre: 'Ahorcado', donde: 'Tarjeta Ahorcado', modos: ['abecedario'], jugadores: '1 (relevos por palabra) o 2-4 por turnos',
        como: 'A letra anterior, B siguiente, agitar dice la letra. Por turnos: si aciertas sigues, si fallas le toca al siguiente. +10 por letra, +30 a quien completa la palabra.' },
    { grupo: 'relevos', emoji: '6️⃣', nombre: 'Six Seven · Speed Run', donde: 'Tarjeta Six Seven o /sixseven', modos: ['letras'], jugadores: '1 (relevos) o carrera de 2-4',
        como: 'Las 4 opciones son A-D. Carrera: el primero que acierta se lleva los puntos de rapidez; quien falla queda fuera de esa pregunta.' },
    { grupo: 'relevos', emoji: '💰', nombre: 'Money Board', donde: 'Tarjeta Money Board', modos: ['letras'], jugadores: 'Un mando por equipo (hasta 4)',
        como: 'El profe elige la casilla; en las preguntas de opciones responde el equipo del turno con A-D y, si falla o se acaba el tiempo, los demás pueden rebotar.' },
    { grupo: 'relevos', emoji: '🎲', nombre: 'Trivial', donde: 'Tarjeta Trivial', modos: ['letras'], jugadores: 'Un mando por jugador (hasta 4)',
        como: 'Solo cuenta el mando del turno: cualquier letra tira el dado, la letra del destino elige casilla (sale la lista), A-D responde y, tras fallar, cualquier letra sigue.' },
];

export const NOMBRE_MODO = {
    letras: '🔤 Letras', numero: '🔢 Número', abecedario: '🔡 Abecedario', mover: '🤖 Mover',
    futbol: '⚽ Fútbol', volante: '🛸 Volante', instrumentos: '🛰️ Instrumentos',
};
