// 🎮 «Crea tu mando Pikt» en el editor por bloques (BlocklyEditor.jsx, placa micro:bit): bloques para
// que los alumnos programen paso a paso una micro:bit que funcione como mando de los juegos de Pikt,
// y los recorridos guiados (TutorialMandoPikt.jsx).
//
// El mando habla el mismo protocolo que los mandos oficiales (mandosMicrobit.js), así que la antena y
// los juegos no notan la diferencia:  P:<nº>:<valor>:<seq>  →  la antena contesta  A:<nº>:<seq>
//   valor = A-D (respuestas), N<n> (números), MA / MB / MX (avanzar / girar / acción en la Pista de robots)
// y el juego avisa del resultado con  F:<nº>:1 (acierto) / F:<nº>:0 (fallo).
// Lo difícil (número de envío, reintentos hasta que la antena confirma) va escondido en los bloques.
import { GRUPO_POR_DEFECTO } from './mandosMicrobit.js';

export const COLOR_MANDO = '#f59e0b';

const PY_AYUDA = `_PIKT = {'id': 1, 'seq': random.randint(0, 99), 'res': ''}
def _pikt_mirar(m):
    if m == 'F:%d:1' % _PIKT['id']:
        _PIKT['res'] = '1'
    elif m == 'F:%d:0' % _PIKT['id']:
        _PIKT['res'] = '0'
def _pikt_enviar(v):
    _PIKT['seq'] = (_PIKT['seq'] + 1) % 100
    msg = 'P:%d:%s:%d' % (_PIKT['id'], v, _PIKT['seq'])
    ack = 'A:%d:%d' % (_PIKT['id'], _PIKT['seq'])
    for i in range(6):
        radio.send(msg)
        t = running_time()
        while running_time() - t < 120:
            m = radio.receive()
            if m == ack:
                return True
            _pikt_mirar(m)
        sleep(random.randint(0, 60))
    return False
def _pikt_es(v):
    m = radio.receive()
    while m:
        _pikt_mirar(m)
        m = radio.receive()
    if _PIKT['res'] == v:
        _PIKT['res'] = ''
        return True
    return False`;

/** Bloques JSON (se añaden con Blockly.defineBlocksWithJsonArray). */
export const BLOQUES_MANDO_PIKT = [
  {
    type: 'pikt_preparar',
    message0: '🎮 preparar mando Pikt nº %1 en el canal %2',
    args0: [
      { type: 'field_number', name: 'ID', value: 1, min: 1, max: 99, precision: 1 },
      { type: 'field_number', name: 'CANAL', value: GRUPO_POR_DEFECTO, min: 0, max: 255, precision: 1 },
    ],
    previousStatement: null, nextStatement: null, colour: COLOR_MANDO,
    tooltip: 'Enciende la radio en el canal de la antena (sale en la antena al encenderse, p. ej. «C7») y le da a tu mando su número. Cada mando de la clase necesita un número distinto.',
  },
  {
    type: 'pikt_cuando',
    message0: 'cuando %1 %2 %3',
    args0: [
      { type: 'field_dropdown', name: 'QUE', options: [['se pulse el botón A', 'a'], ['se pulse el botón B', 'b'], ['se agite el mando', 'shake']] },
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'DO' },
    ],
    previousStatement: null, nextStatement: null, colour: COLOR_MANDO,
    tooltip: 'Hace lo de dentro una vez cada vez que pulsas (o agitas). Ponlo dentro de «por siempre».',
  },
  {
    type: 'pikt_enviar',
    message0: '📡 enviar al juego %1',
    args0: [{ type: 'input_value', name: 'V' }],
    previousStatement: null, nextStatement: null, colour: COLOR_MANDO,
    tooltip: 'Manda la respuesta a la antena y espera a que la confirme (lo reintenta varias veces si se pierde).',
  },
  {
    type: 'pikt_letra',
    message0: 'letra nº %1',
    args0: [{ type: 'input_value', name: 'N', check: 'Number' }],
    output: 'String', colour: COLOR_MANDO,
    tooltip: '0 → A, 1 → B, 2 → C, 3 → D. Con 4 vuelve a la A (el resto de dividir entre 4).',
  },
  {
    type: 'pikt_numero',
    message0: 'respuesta número %1',
    args0: [{ type: 'input_value', name: 'N', check: 'Number' }],
    output: 'String', colour: COLOR_MANDO,
    tooltip: 'Para los juegos en los que se contesta con un número (Mates con mandos…).',
  },
  {
    type: 'pikt_orden',
    message0: 'orden %1',
    args0: [{ type: 'field_dropdown', name: 'O', options: [['⬆️ avanzar', 'MA'], ['↻ girar', 'MB'], ['✏️ acción', 'MX']] }],
    output: 'String', colour: COLOR_MANDO,
    tooltip: 'Órdenes para mover el robot de la Pista de robots.',
  },
  {
    type: 'pikt_resultado',
    message0: 'el juego dice %1',
    args0: [{ type: 'field_dropdown', name: 'R', options: [['✅ acierto', '1'], ['❌ fallo', '0']] }],
    output: 'Boolean', colour: COLOR_MANDO,
    tooltip: 'Verdadero cuando el juego avisa a este mando de que ha acertado (o fallado) la última respuesta.',
  },
  {
    type: 'pikt_mostrar',
    message0: 'mostrar %1',
    args0: [{ type: 'input_value', name: 'V' }],
    previousStatement: null, nextStatement: null, colour: COLOR_MANDO,
    tooltip: 'Enseña una letra o un número en la pantalla (sin desplazarlo si cabe).',
  },
];

/** Generadores MicroPython. `P` = pythonGenerator, `Order` = su orden de operadores. */
export function definirGeneradoresMandoPikt(P, Order) {
  const base = (gen) => {
    gen.definitions_['import_microbit'] = 'from microbit import *';
    gen.definitions_['import_radio'] = 'import radio';
    gen.definitions_['import_random'] = 'import random';
    gen.definitions_['pikt_ayuda'] = PY_AYUDA;
  };
  P.forBlock['pikt_preparar'] = function (block, gen) {
    base(gen);
    const id = Math.round(block.getFieldValue('ID'));
    const canal = Math.round(block.getFieldValue('CANAL'));
    return `_PIKT['id'] = ${id}\nradio.config(group=${canal}, length=32, power=7)\nradio.on()\n`;
  };
  P.forBlock['pikt_cuando'] = function (block, gen) {
    gen.definitions_['import_microbit'] = 'from microbit import *';
    const que = block.getFieldValue('QUE');
    const cond = que === 'shake' ? "accelerometer.was_gesture('shake')" : `button_${que}.was_pressed()`;
    const body = gen.statementToCode(block, 'DO') || gen.INDENT + 'pass\n';
    return `if ${cond}:\n${body}`;
  };
  P.forBlock['pikt_enviar'] = function (block, gen) {
    base(gen);
    const v = gen.valueToCode(block, 'V', Order.NONE) || "'A'";
    return `_pikt_enviar(${v})\n`;
  };
  P.forBlock['pikt_letra'] = function (block, gen) {
    const n = gen.valueToCode(block, 'N', Order.NONE) || '0';
    return [`'ABCD'[int(${n}) % 4]`, Order.ATOMIC];
  };
  P.forBlock['pikt_numero'] = function (block, gen) {
    const n = gen.valueToCode(block, 'N', Order.NONE) || '0';
    return [`'N%d' % int(${n})`, Order.ATOMIC];
  };
  P.forBlock['pikt_orden'] = function (block) {
    return [`'${block.getFieldValue('O')}'`, Order.ATOMIC];
  };
  P.forBlock['pikt_resultado'] = function (block, gen) {
    base(gen);
    return [`_pikt_es('${block.getFieldValue('R')}')`, Order.ATOMIC];
  };
  P.forBlock['pikt_mostrar'] = function (block, gen) {
    gen.definitions_['import_microbit'] = 'from microbit import *';
    const v = gen.valueToCode(block, 'V', Order.NONE) || "''";
    return `display.show(${v})\n`;
  };
}

/** Categoría de la caja de herramientas de micro:bit. */
export const CATEGORIA_MANDO_PIKT = {
  kind: 'category', name: '🎮 Mando Pikt', colour: COLOR_MANDO,
  contents: [
    { kind: 'block', type: 'pikt_preparar' },
    { kind: 'block', type: 'pikt_cuando' },
    { kind: 'block', type: 'pikt_enviar' },
    { kind: 'block', type: 'pikt_letra', inputs: { N: { shadow: { type: 'math_number', fields: { NUM: 0 } } } } },
    { kind: 'block', type: 'pikt_numero', inputs: { N: { shadow: { type: 'math_number', fields: { NUM: 0 } } } } },
    { kind: 'block', type: 'pikt_orden' },
    { kind: 'block', type: 'pikt_resultado' },
    { kind: 'block', type: 'pikt_mostrar' },
  ],
};

/* ───────── Recorridos guiados ─────────
   Cada paso: { titulo, texto (lista de frases), comprobar(codigo) → '' si está bien o el aviso,
   pista, solucion (estado del workspace: el programa completo hasta ese paso) }. */

const num = (n) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
const cadena = (bloques) => bloques.reduceRight((sig, b) => (sig ? { ...b, next: { block: sig } } : b), null);
const VAR = { id: 'pikt_var', name: 'opcion' };
const VARN = { id: 'pikt_varn', name: 'numero' };
const leer = (v) => ({ block: { type: 'variables_get', fields: { VAR: { id: v.id } } } });
const fijar = (v, n) => ({ type: 'variables_set', fields: { VAR: { id: v.id } }, inputs: { VALUE: { block: { type: 'math_number', fields: { NUM: n } } } } });
const sumar = (v, n) => ({ type: 'math_change', fields: { VAR: { id: v.id } }, inputs: { DELTA: { shadow: { type: 'math_number', fields: { NUM: n } } } } });
const cuando = (que, cuerpo) => ({ type: 'pikt_cuando', fields: { QUE: que }, inputs: { DO: { block: cadena(cuerpo) } } });
const mostrar = (valor) => ({ type: 'pikt_mostrar', inputs: { V: { block: valor } } });
const icono = (img) => ({ type: 'microbit_show_leds', fields: { IMG: img } });
const enviar = (valor) => ({ type: 'pikt_enviar', inputs: { V: { block: valor } } });
const letra = (v) => ({ type: 'pikt_letra', inputs: { N: { ...num(0), ...leer(v) } } });
const numero = (v) => ({ type: 'pikt_numero', inputs: { N: { ...num(0), ...leer(v) } } });
const orden = (o) => ({ type: 'pikt_orden', fields: { O: o } });
const siEs = (r, cuerpo) => ({ type: 'controls_if', inputs: { IF0: { block: { type: 'pikt_resultado', fields: { R: r } } }, DO0: { block: cadena(cuerpo) } } });
const preparar = { type: 'pikt_preparar', fields: { ID: 1, CANAL: GRUPO_POR_DEFECTO } };
const estado = (inicio, siempre, vars = []) => ({
  blocks: {
    languageVersion: 0,
    blocks: [
      { type: 'microbit_on_start', x: 30, y: 30, inputs: { DO: { block: cadena(inicio) } } },
      ...(siempre.length ? [{ type: 'microbit_forever', x: 30, y: 60 + inicio.length * 48, inputs: { DO: { block: cadena(siempre) } } }] : []),
    ],
  },
  ...(vars.length ? { variables: vars } : {}),
});

const tiene = (re, aviso) => (codigo) => (re.test(codigo) ? '' : aviso);
const todo = (...comprobaciones) => (codigo) => comprobaciones.map((c) => c(codigo)).find(Boolean) || '';

const pasoPreparar = (queMuestra) => ({
  titulo: 'Enciende la radio de tu mando',
  texto: [
    'Arrastra «al iniciar» (categoría Básico): lo de dentro se hace una sola vez, al encender la placa.',
    'Dentro, pon «🎮 preparar mando Pikt» (categoría 🎮 Mando Pikt).',
    'Escribe el número de tu mando (pregúntale al profe cuál te toca: no puede haber dos iguales) y el canal de la antena (la antena lo enseña al encenderse, por ejemplo «C7»).',
    queMuestra,
  ],
  comprobar: todo(
    tiene(/radio\.config\(group=\d+/, 'Falta el bloque «🎮 preparar mando Pikt» dentro de «al iniciar».'),
    tiene(/display\.(show|scroll)\(/, 'Falta enseñar algo en la pantalla al encender.'),
  ),
  pista: 'Para enseñar el número de tu mando, «mostrar» con un número dentro (categoría Matemáticas).',
});

const pasoResultado = (inicio, siempre, vars) => ({
  titulo: '¿He acertado? (opcional)',
  texto: [
    'El juego avisa a cada mando de si su respuesta era buena.',
    'Dentro de «por siempre» pon un «si» (categoría Lógica) con «el juego dice ✅ acierto» y dentro una cara feliz.',
    'Haz otro «si» con «el juego dice ❌ fallo» y una cara triste. Si quieres, añade música.',
  ],
  comprobar: todo(
    tiene(/_pikt_es\('1'\)/, 'Falta el «si el juego dice ✅ acierto».'),
    tiene(/_pikt_es\('0'\)/, 'Falta el «si el juego dice ❌ fallo».'),
  ),
  pista: 'Después de la cara, una pausa de 1000 ms y vuelve a mostrar lo que tenías (la letra o el número).',
  solucion: estado(inicio, siempre, vars),
});

const pasoGuardar = (juegos) => ({
  titulo: '¡Guárdalo y a jugar!',
  texto: [
    'Conecta la micro:bit por USB con «🔗 Conectar Placa» y pulsa «📥 Guardar en placa»: así el programa arranca solo al encenderla.',
    'Desenchúfala y ponle las pilas.',
    `El profe conecta la antena y abre ${juegos}. Tu mando aparece con su número en cuanto lo usas.`,
    '¿No aparece? Revisa que el canal sea el de la antena y que nadie más tenga tu número.',
  ],
  comprobar: () => '',
  final: true,
});

// Programas completos de cada recorrido (el último paso de bloques); los pasos intermedios son cortes.
const L_INICIO = [preparar, fijar(VAR, 0), mostrar(letra(VAR))];
const L_A = cuando('a', [sumar(VAR, 1), mostrar(letra(VAR))]);
const L_B = cuando('b', [enviar(letra(VAR)), icono('YES'), { type: 'microbit_pause', fields: { MS: 400 } }, mostrar(letra(VAR))]);
const L_RES = [siEs('1', [icono('HAPPY'), { type: 'microbit_pause', fields: { MS: 1000 } }, mostrar(letra(VAR))]), siEs('0', [icono('SAD'), { type: 'microbit_pause', fields: { MS: 1000 } }, mostrar(letra(VAR))])];

const N_INICIO = [preparar, fijar(VARN, 0), mostrar({ type: 'variables_get', fields: { VAR: { id: VARN.id } } })];
const verN = () => mostrar({ type: 'variables_get', fields: { VAR: { id: VARN.id } } });
const N_AB = [cuando('a', [sumar(VARN, -1), verN()]), cuando('b', [sumar(VARN, 1), verN()])];
const N_ENV = cuando('shake', [enviar(numero(VARN)), icono('YES'), { type: 'microbit_pause', fields: { MS: 400 } }, verN()]);
const N_RES = [siEs('1', [icono('HAPPY'), { type: 'microbit_pause', fields: { MS: 1000 } }, verN()]), siEs('0', [icono('SAD'), { type: 'microbit_pause', fields: { MS: 1000 } }, verN()])];

const R_INICIO = [preparar, { type: 'microbit_show_leds', fields: { IMG: 'ARROW_N' } }];
const R_A = cuando('a', [enviar(orden('MA'))]);
const R_B = cuando('b', [enviar(orden('MB'))]);
const R_X = cuando('shake', [enviar(orden('MX')), icono('YES'), { type: 'microbit_pause', fields: { MS: 300 } }, { type: 'microbit_show_leds', fields: { IMG: 'ARROW_N' } }]);

export const RECORRIDOS_MANDO = [
  {
    id: 'letras',
    emoji: '🅰️',
    titulo: 'Mando de respuestas A-B-C-D',
    desc: 'Para el Quiz con mandos y los juegos de preguntas de opción múltiple.',
    pasos: [
      { ...pasoPreparar('Para ver que funciona, añade debajo un «mostrar» con el número de tu mando.'), solucion: estado([preparar, mostrar({ type: 'math_number', fields: { NUM: 1 } })], []) },
      {
        titulo: 'Una variable para la letra',
        texto: [
          'El mando tiene que recordar qué letra has elegido. Para eso sirve una variable.',
          'En la categoría Variables, crea una variable llamada «opcion».',
          'En «al iniciar», pon «fijar opcion a 0» (cámbiale el número del final por 0).',
          'Cambia el «mostrar» para que enseñe «letra nº opcion»: la opción 0 es la A, la 1 la B, la 2 la C y la 3 la D.',
        ],
        comprobar: todo(
          tiene(/\b\w+ = 0\b/, 'Falta «fijar opcion a 0» en «al iniciar».'),
          tiene(/display\.show\('ABCD'\[/, 'Falta «mostrar» con «letra nº opcion» dentro.'),
        ),
        pista: '«letra nº» está en 🎮 Mando Pikt; la variable «opcion» la encuentras en Variables una vez creada. Encájala en el hueco de «letra nº».',
        solucion: estado(L_INICIO, [], [VAR]),
      },
      {
        titulo: 'El botón A cambia de letra',
        texto: [
          'Arrastra «por siempre» (Básico): lo de dentro se repite sin parar mientras el mando está encendido.',
          'Dentro, pon «cuando se pulse el botón A».',
          'Dentro de ese bloque: «cambiar opcion en 1» (Variables) y otra vez «mostrar letra nº opcion».',
          'Piensa: ¿qué letra sale cuando opcion vale 4? ¿Y 5? El bloque usa el resto de dividir entre 4, así que da la vuelta: A, B, C, D, A, B…',
        ],
        comprobar: todo(
          tiene(/while True:/, 'Falta el bloque «por siempre».'),
          tiene(/button_a\.was_pressed\(\)/, 'Falta «cuando se pulse el botón A» dentro de «por siempre».'),
          tiene(/(\w+) = \1 \+ 1/, 'Falta «cambiar opcion en 1» dentro del botón A.'),
        ),
        pista: 'Si la conectas y pulsas «▶ Ejecutar Código», al pulsar A tiene que ir cambiando la letra de la pantalla.',
        solucion: estado(L_INICIO, [L_A], [VAR]),
      },
      {
        titulo: 'El botón B envía la respuesta',
        texto: [
          'Dentro de «por siempre», añade «cuando se pulse el botón B».',
          'Dentro: «📡 enviar al juego» con «letra nº opcion» en el hueco.',
          'Después, un ✓ en la pantalla para saber que se ha enviado, una pausa corta y otra vez la letra.',
        ],
        comprobar: todo(
          tiene(/button_b\.was_pressed\(\)/, 'Falta «cuando se pulse el botón B».'),
          tiene(/_pikt_enviar\('ABCD'\[/, 'Falta «📡 enviar al juego» con «letra nº opcion».'),
        ),
        pista: 'El bloque «📡 enviar al juego» manda la letra a la antena y espera a que le diga «recibido». Si no contesta, lo intenta otra vez.',
        solucion: estado(L_INICIO, [L_A, L_B], [VAR]),
      },
      pasoResultado(L_INICIO, [L_A, L_B, ...L_RES], [VAR]),
      pasoGuardar('el Quiz con mandos (Programación y robótica → 🎮 Mandos micro:bit)'),
    ],
  },
  {
    id: 'numeros',
    emoji: '🔢',
    titulo: 'Mando de números',
    desc: 'Para Mates con mandos y los juegos en los que se contesta con un número.',
    pasos: [
      { ...pasoPreparar('Para ver que funciona, añade debajo un «mostrar» con el número de tu mando.'), solucion: estado([preparar, mostrar({ type: 'math_number', fields: { NUM: 1 } })], []) },
      {
        titulo: 'Una variable para el número',
        texto: [
          'En Variables, crea una variable llamada «numero».',
          'En «al iniciar», «fijar numero a 0» y «mostrar numero».',
        ],
        comprobar: todo(
          tiene(/\b\w+ = 0\b/, 'Falta «fijar numero a 0».'),
          tiene(/display\.show\((?!'ABCD')\w+\)/, 'Falta «mostrar numero».'),
        ),
        pista: 'La variable «numero» aparece en Variables cuando la creas; encájala en el hueco de «mostrar».',
        solucion: estado(N_INICIO, [], [VARN]),
      },
      {
        titulo: 'A resta, B suma',
        texto: [
          'Arrastra «por siempre» y dentro dos bloques: «cuando se pulse el botón A» y «cuando se pulse el botón B».',
          'Con A: «cambiar numero en -1». Con B: «cambiar numero en 1». Después de cada uno, «mostrar numero».',
          'Reto: ¿cuántas pulsaciones necesitas para llegar a 12? ¿Y a -3?',
        ],
        comprobar: todo(
          tiene(/button_a\.was_pressed\(\)/, 'Falta el botón A.'),
          tiene(/button_b\.was_pressed\(\)/, 'Falta el botón B.'),
          tiene(/(\w+) = \1 \+ -1|(\w+) = \2 - 1/, 'Falta «cambiar numero en -1» con el botón A.'),
          tiene(/(\w+) = \1 \+ 1\b/, 'Falta «cambiar numero en 1» con el botón B.'),
        ),
        pista: 'El número del bloque «cambiar … en» puede ser negativo: así resta.',
        solucion: estado(N_INICIO, N_AB, [VARN]),
      },
      {
        titulo: 'Agitar envía el número',
        texto: [
          'Dentro de «por siempre», añade «cuando se agite el mando».',
          'Dentro: «📡 enviar al juego» con «respuesta número numero».',
          'Pon un ✓, una pausa corta y otra vez el número.',
        ],
        comprobar: todo(
          tiene(/was_gesture\('shake'\)/, 'Falta «cuando se agite el mando».'),
          tiene(/_pikt_enviar\('N%d'/, 'Falta «📡 enviar al juego» con «respuesta número numero».'),
        ),
        pista: '«respuesta número» le pone delante una N para que el juego sepa que es un número.',
        solucion: estado(N_INICIO, [...N_AB, N_ENV], [VARN]),
      },
      pasoResultado(N_INICIO, [...N_AB, N_ENV, ...N_RES], [VARN]),
      pasoGuardar('Mates con mandos (Math World → 🧮 Mates con mandos)'),
    ],
  },
  {
    id: 'robots',
    emoji: '🤖',
    titulo: 'Mando para la Pista de robots',
    desc: 'Mueve tu robot por la pista: A avanza, B gira, agitar hace la acción.',
    pasos: [
      { ...pasoPreparar('Añade debajo «encender matriz LED» con una flecha, para saber que el mando está listo.'), solucion: estado(R_INICIO, []) },
      {
        titulo: 'A avanza, B gira',
        texto: [
          'Arrastra «por siempre» y dentro «cuando se pulse el botón A» y «cuando se pulse el botón B».',
          'Con A: «📡 enviar al juego» con «orden ⬆️ avanzar».',
          'Con B: «📡 enviar al juego» con «orden ↻ girar».',
        ],
        comprobar: todo(
          tiene(/_pikt_enviar\('MA'\)/, 'Falta enviar «orden avanzar» con el botón A.'),
          tiene(/_pikt_enviar\('MB'\)/, 'Falta enviar «orden girar» con el botón B.'),
        ),
        pista: 'Cada pulsación es un paso o un giro de 90°: ¿cuántos giros hacen falta para dar la vuelta completa?',
        solucion: estado(R_INICIO, [R_A, R_B]),
      },
      {
        titulo: 'Agitar: acción',
        texto: [
          'Añade «cuando se agite el mando» con «📡 enviar al juego» y «orden ✏️ acción».',
          'Pon un ✓ para saber que se ha enviado y vuelve a la flecha.',
        ],
        comprobar: tiene(/_pikt_enviar\('MX'\)/, 'Falta enviar «orden acción» al agitar.'),
        pista: '«cuando se agite el mando» está en el mismo bloque que los botones: cambia el desplegable.',
        solucion: estado(R_INICIO, [R_A, R_B, R_X]),
      },
      pasoGuardar('la Pista de robots (Programación y robótica → 🎮 Mandos micro:bit)'),
    ],
  },
];
