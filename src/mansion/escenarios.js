// Escenarios de La Mansión Pitagórica (versión three.js).
//
// Cada mapa es una cuadrícula (1 carácter = 1 celda de 3 m):
//   #  pared            .  suelo           S  salida del jugador
//   D  puerta con pregunta (entre dos paredes)
//   L  puerta del CANDADO (se abre con el código de las pistas)
//   E  salida del nivel (detrás del candado)
//   1-9 pista con la cifra n.º n del código del candado
//   T  trampa escondida (solo se ve al iluminarla con la linterna)
// `inicio2` = celda [columna, fila] donde empieza el 2.º jugador en el modo dual (otra zona, sin enemigos).
// Los enemigos patrullan por `rutas` (lista de celdas [columna, fila]).
// Para añadir un escenario basta con otro objeto aquí (y comprobarlo con
// node scripts/validar-mapas-mansion.mjs: puertas entre paredes, todo alcanzable).

export const ESCENARIOS = {
    mansion: {
        id: 'mansion',
        nombre: 'Mansión encantada',
        emoji: '🏚️',
        descripcion: 'Fantasmas y luces malditas en la vieja mansión.',
        enemigo: 'fantasma',
        nombreEnemigo: 'fantasma',
        trampa: 'luz',
        nombreTrampa: 'luz maldita',
        peligros: 'Cuidado con los fantasmas y las luces malditas',
        pista: 'libro',
        paredes: 'papel', suelo: 'madera', techo: 'techoMadera', puerta: 'puertaMadera',
        colorNiebla: 0x120822, niebla: 0.075,
        cielo: 0x1d1236, tierra: 0x0a0612, luzAmbiente: 0.55,
        colorLinterna: 0xffe3b0, colorJugador: 0xffb070,
        colorAcento: '#a855f7', colorDeco: 0xffaa44,
        deco: 'vela',
        velocidadEnemigo: 2.1,
        inicio2: [15, 7],
        mapa: [
            '#################',
            '#S....#.....#..1#',
            '#.....D..T..D...#',
            '#.....#.....#...#',
            '###D#####D###D###',
            '#.....#.....#...#',
            '#.T...D.....D.T.#',
            '#.....#.....#...#',
            '##D######D#######',
            '#.....#2....#...#',
            '#..3..D...T.L.E.#',
            '#.....#.....#...#',
            '#################',
        ],
        rutas: [
            [[7, 5], [11, 5], [11, 7], [7, 7]],
            [[1, 9], [5, 9], [5, 11], [1, 11]],
            [[13, 1], [15, 3], [13, 3]],
        ],
    },

    piramide: {
        id: 'piramide',
        nombre: 'Pirámide egipcia',
        emoji: '🏺',
        descripcion: 'Momias y fuego escondido entre jeroglíficos.',
        enemigo: 'momia',
        nombreEnemigo: 'momia',
        trampa: 'fuego',
        nombreTrampa: 'trampa de fuego',
        peligros: 'Cuidado con las momias y las trampas de fuego',
        pista: 'escarabajo',
        paredes: 'arenisca', suelo: 'losas', techo: 'techoPiedra', puerta: 'puertaPiedra',
        colorNiebla: 0x1c1206, niebla: 0.07,
        cielo: 0x3a2a14, tierra: 0x120a04, luzAmbiente: 0.6,
        colorLinterna: 0xfff0c8, colorJugador: 0xff9a40,
        colorAcento: '#f59e0b', colorDeco: 0xff7a1a,
        deco: 'antorcha',
        velocidadEnemigo: 2.3,
        inicio2: [15, 4],
        mapa: [
            '#################',
            '#######E#########',
            '#######.#########',
            '#######L#########',
            '#.....#...#.....#',
            '#..1..D...D..T..#',
            '#.....#.T.#.....#',
            '###D#########D###',
            '#...#.......#...#',
            '#.T.D...2...D...#',
            '#...#.......#.3.#',
            '###D####D####D###',
            '#.....#...#.....#',
            '#..T..D.S.D..T..#',
            '#################',
        ],
        rutas: [
            [[5, 8], [11, 8], [11, 10], [5, 10]],
            [[1, 4], [5, 4], [5, 6], [1, 6]],
            [[13, 8], [15, 10], [13, 10]],
        ],
    },

    nave: {
        id: 'nave',
        nombre: 'Nave espacial',
        emoji: '🚀',
        descripcion: 'Drones de vigilancia y láseres invisibles.',
        enemigo: 'dron',
        nombreEnemigo: 'dron',
        trampa: 'laser',
        nombreTrampa: 'láser',
        peligros: 'Cuidado con los drones y los láseres',
        pista: 'chip',
        paredes: 'paneles', suelo: 'rejilla', techo: 'techoMetal', puerta: 'puertaMetal',
        colorNiebla: 0x020a16, niebla: 0.065,
        cielo: 0x1a3550, tierra: 0x05080c, luzAmbiente: 0.6,
        colorLinterna: 0xd8f0ff, colorJugador: 0x6fc8ff,
        colorAcento: '#38bdf8', colorDeco: 0x38e0ff,
        deco: 'tira',
        velocidadEnemigo: 2.5,
        inicio2: [17, 7],
        mapa: [
            '###################',
            '#S......D.....#..1#',
            '#.......#..T..D...#',
            '#.......#.....#...#',
            '####D######D#######',
            '#.....#.....#.....#',
            '#..2..D..T..D..T..#',
            '#.....#.....#.....#',
            '#######D#####D#####',
            '#.T...........#...#',
            '#.............L.E.#',
            '#...3.........#...#',
            '###################',
        ],
        rutas: [
            [[7, 5], [11, 5], [11, 7], [7, 7]],
            [[1, 9], [13, 9], [13, 11], [1, 11]],
            [[9, 1], [13, 1], [13, 3], [9, 3]],
        ],
    },
};

export const ORDEN_ESCENARIOS = ['mansion', 'piramide', 'nave'];
