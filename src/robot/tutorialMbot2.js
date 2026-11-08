// 🤖 Recorridos guiados del editor por bloques para el mBot2 (pestaña «🤖 mBot2», con TutorialMandoPikt):
//   〰️ Seguir la línea del mapa que viene con el robot (sensor de 4 sondas, control todo/nada y proporcional)
//   🚜 Tractor de siembra (avanzar y girar exactos, bucles, surcos en zigzag, sensor de seguridad, volver)
// Cada paso: { titulo, texto[], bloques: [[bloque, para qué sirve]], comprobar(codigo) → '' o aviso, pista,
// solucion (programa completo hasta ese paso, estado de Blockly) }. Los bloques están en BlocklyEditor.jsx
// (mbot2_straight, mbot2_turn, mbot2_motores, mbot2_line_offset, mbot2_line_state, mbot2_ultrasonic).

export const COLOR_MBOT2 = '#0ea5e9';

/* ── Ayudas para escribir las soluciones ── */
const val = (x) => (typeof x === 'number' ? { shadow: { type: 'math_number', fields: { NUM: x } } } : { block: x });
const cadena = (bloques) => bloques.reduceRight((sig, b) => (sig ? { ...b, next: { block: sig } } : b), null);
const siempre = (cuerpo) => ({ type: 'cyberpi_forever', inputs: { DO: { block: cadena(cuerpo) } } });
const repetir = (n, cuerpo) => ({ type: 'controls_repeat_ext', inputs: { TIMES: val(n), DO: { block: cadena(cuerpo) } } });
const si = (cond, haz, sino) => ({
  type: 'controls_if',
  ...(sino ? { extraState: { hasElse: true } } : {}),
  inputs: { IF0: { block: cond }, DO0: { block: cadena(haz) }, ...(sino ? { ELSE: { block: cadena(sino) } } : {}) },
});
const cmp = (a, op, b) => ({ type: 'logic_compare', fields: { OP: op }, inputs: { A: { block: a }, B: val(b) } });
const op = (o, a, b) => ({ type: 'math_arithmetic', fields: { OP: o }, inputs: { A: val(a), B: val(b) } });
const mientras = (cond, cuerpo) => ({ type: 'controls_whileUntil', fields: { MODE: 'WHILE' }, inputs: { BOOL: { block: cond }, DO: { block: cadena(cuerpo) } } });
const leer = (v) => ({ type: 'variables_get', fields: { VAR: { id: v.id } } });
const fijar = (v, x) => ({ type: 'variables_set', fields: { VAR: { id: v.id } }, inputs: { VALUE: val(x) } });
const sumar = (v, n) => ({ type: 'math_change', fields: { VAR: { id: v.id } }, inputs: { DELTA: val(n) } });
const avanzar = (cm) => ({ type: 'mbot2_straight', inputs: { CM: val(cm) } });
const girar = (g) => ({ type: 'mbot2_turn', inputs: { DEG: val(g) } });
const motores = (l, r) => ({ type: 'mbot2_motores', inputs: { L: val(l), R: val(r) } });
const mostrar = (v) => ({ type: 'cyberpi_show_value', inputs: { NUM: { block: v } } });
const tono = (f, s) => ({ type: 'cyberpi_play_tone', fields: { FREQ: f, SEC: s } });
const led = (c) => ({ type: 'cyberpi_led', fields: { COLOR: c } });
const esperar = (s) => ({ type: 'cyberpi_wait', fields: { SEC: s } });
const PARAR = { type: 'mbot2_stop' };
const DESVIO = { type: 'mbot2_line_offset' };
const SONDAS = { type: 'mbot2_line_state' };
const DISTANCIA = { type: 'mbot2_ultrasonic' };
const estado = (bloques, vars = []) => ({
  blocks: { languageVersion: 0, blocks: [{ ...cadena(bloques), x: 30, y: 30 }] },
  ...(vars.length ? { variables: vars.map((v) => ({ id: v.id, name: v.name })) } : {}),
});

const tiene = (re, aviso) => (codigo) => (re.test(codigo) ? '' : aviso);
const todo = (...c) => (codigo) => c.map((f) => f(codigo)).find(Boolean) || '';

const pasoEjecutar = (extra) => ({
  titulo: '¡A probarlo en el robot!',
  texto: [
    'Conecta el CyberPi del mBot2 por USB con «🔗 Conectar Placa» (Chrome o Edge en el ordenador).',
    'Pon el robot en el suelo, con espacio, y pulsa «▶ Ejecutar en el robot».',
    'Para pararlo: pulsa el botón de reinicio del CyberPi o desconéctalo.',
    ...extra,
  ],
  comprobar: () => '',
  final: true,
});

/* ═════════ 〰️ Seguir la línea ═════════ */
const V_DES = { id: 'mb_desvio', name: 'desvio' };
const PROPORCIONAL = [fijar(V_DES, DESVIO), motores(op('ADD', 40, op('MULTIPLY', leer(V_DES), 0.3)), op('MINUS', 40, op('MULTIPLY', leer(V_DES), 0.3)))];
const L5 = si(cmp(SONDAS, 'EQ', 0), [PARAR, tono(300, 0.2)], PROPORCIONAL);

const LINEA = {
  id: 'linea',
  emoji: '〰️',
  titulo: 'Seguir la línea del mapa',
  desc: 'Con el mapa que viene en la caja del mBot2: del «todo o nada» al control proporcional, y que pare si se sale o hay algo delante.',
  pasos: [
    {
      titulo: '¿Qué ve el sensor de línea?',
      texto: [
        'Extiende el mapa de la caja del mBot2 en el suelo: tiene un circuito con una línea negra sobre fondo blanco.',
        'Debajo del robot, delante, está el sensor de línea: 4 sondas que encienden una luz y miden cuánta vuelve (el negro refleja poca luz y el blanco mucha).',
        'Arrastra «por siempre» y dentro «mostrar valor» con «desvío de la línea».',
        'Ejecútalo y mueve el robot con la mano encima de la línea: ¿qué número sale con la línea a la izquierda? ¿Y a la derecha? ¿Y centrada?',
      ],
      bloques: [
        ['por siempre', 'repite lo de dentro sin parar: el robot mira el sensor muchas veces por segundo.'],
        ['mostrar valor', 'enseña un número en la pantalla del CyberPi.'],
        ['desvío de la línea', 'de −100 (la línea está muy a la izquierda) a 100 (muy a la derecha); 0 = centrada.'],
      ],
      comprobar: todo(
        tiene(/while True:/, 'Falta el bloque «por siempre».'),
        tiene(/show_label\(str\(_pikt_desvio\(\)\)/, 'Falta «mostrar valor» con «desvío de la línea» dentro.'),
      ),
      pista: '«por siempre» está en Básico; «mostrar valor» en Pantalla; «desvío de la línea» en mBot2 · Sensores. Encaja el redondo en el hueco de «mostrar valor».',
      solucion: estado([siempre([mostrar(DESVIO)])]),
    },
    {
      titulo: 'Todo o nada: gira hacia la línea',
      texto: [
        'Idea: si la línea se va a la izquierda, gira a la izquierda; si se va a la derecha, gira a la derecha.',
        'Dentro de «por siempre» pon un «si … si no» (Lógica; con la rueda dentada del bloque «si» añades el «si no»).',
        'Condición: «desvío de la línea < 0».',
        'Si es verdad, la línea está a la izquierda: «motor izquierdo 15 derecho 45» (la rueda derecha va más rápida y el robot tuerce a la izquierda).',
        'Si no, «motor izquierdo 45 derecho 15».',
        'Pruébalo: ¿sigue la línea? ¿Cómo se mueve? Fíjate en que siempre va dando bandazos.',
      ],
      bloques: [
        ['si … si no', 'elige entre dos caminos según una condición.'],
        ['< (comparar)', 'en Lógica: compara dos números y da verdadero o falso.'],
        ['motor izquierdo … derecho … (%)', 'la potencia de cada rueda, de −100 a 100. Si una va más rápida que la otra, el robot gira hacia el lado de la lenta.'],
      ],
      comprobar: todo(
        tiene(/if _pikt_desvio\(\) [<>]=? -?\d+:/, 'Falta el «si» que compara «desvío de la línea» con 0.'),
        tiene(/else:/, 'Falta el «si no» (rueda dentada del bloque «si»).'),
        tiene(/drive_power\(int\(.*\n[\s\S]*drive_power\(int\(/, 'Faltan los dos «motor izquierdo … derecho …» (uno en cada caso).'),
      ),
      pista: 'Si el robot se va hacia fuera en vez de hacia la línea, has cambiado los lados: intercambia los números de los dos «motor…».',
      solucion: estado([siempre([si(cmp(DESVIO, 'LT', 0), [motores(15, 45)], [motores(45, 15)])])]),
    },
    {
      titulo: 'Más suave: control proporcional',
      texto: [
        'Los bandazos vienen de girar siempre igual de fuerte. Mejor: girar MÁS cuanto más lejos está la línea.',
        'Crea una variable «desvio» y, dentro de «por siempre», «fijar desvio a (desvío de la línea)».',
        'Quita el «si» y pon un solo «motor izquierdo (40 + desvio × 0,3) derecho (40 − desvio × 0,3)», con los bloques de Matemáticas.',
        'Piensa: si desvio = 0 las dos ruedas van a 40 (recto). Si desvio = −50 (línea a la izquierda): izquierda 40 − 15 = 25 y derecha 40 + 15 = 55 → gira a la izquierda.',
        'El 40 es la velocidad base y el 0,3 la «ganancia» (k): cuánto corrige por cada punto de desvío. Así funcionan los pilotos automáticos.',
      ],
      bloques: [
        ['fijar variable a', 'guarda el desvío para usarlo dos veces sin volver a medir.'],
        ['+ − ×', 'en Matemáticas: calcula la potencia de cada rueda a partir del desvío.'],
      ],
      comprobar: todo(
        tiene(/(\w+) = _pikt_desvio\(\)/, 'Falta «fijar desvio a (desvío de la línea)».'),
        tiene(/\* ?0?\.\d+|\* ?\d+\.\d+/, 'Falta multiplicar el desvío por la ganancia (por ejemplo × 0,3).'),
        tiene(/drive_power\(int\([^\n]*\+[^\n]*-int\([^\n]*-/, 'El motor izquierdo tiene que ser «40 + desvio × 0,3» y el derecho «40 − desvio × 0,3».'),
      ),
      pista: 'Si al girar se va hacia fuera, cambia el + y el − entre las dos ruedas.',
      solucion: estado([siempre(PROPORCIONAL)], [V_DES]),
    },
    {
      titulo: 'Experimenta: velocidad y ganancia',
      texto: [
        'Cambia el 40 (velocidad base) y el 0,3 (ganancia) y apunta qué pasa en una tabla.',
        'Prueba con ganancia 0,1: ¿se sale en las curvas? Y con 0,8: ¿hace eses? Busca la más grande que no haga eses.',
        'Sube la velocidad base a 60: ¿necesitas más o menos ganancia para no salirte?',
        'Cronometra una vuelta al circuito con cada combinación. ¿Cuál es la más rápida sin salirse?',
      ],
      bloques: [['números', 'son los «mandos» del control: velocidad base y ganancia.']],
      comprobar: () => '',
      pista: 'Es lo que hacen los ingenieros al ajustar un controlador: cambiar un número cada vez y medir.',
    },
    {
      titulo: '¿Se ha salido? Que pare',
      texto: [
        '«sondas que ven la línea» da un número del 0 al 15: es como un número binario de 4 cifras, una por sonda (1 = ve negro).',
        '0 = ninguna sonda ve la línea: el robot se ha salido. 15 = las cuatro: un cruce o la meta.',
        'Pon un «si … si no»: si «sondas que ven la línea = 0», «parar motores» y un tono; si no, lo del paso anterior (fijar desvio y los motores).',
      ],
      bloques: [
        ['sondas que ven la línea', 'el estado de las 4 sondas en un número (0-15).'],
        ['parar motores', 'pone las dos ruedas a 0.'],
        ['tono', 'un pitido de aviso (frecuencia en Hz y duración en segundos).'],
      ],
      comprobar: todo(
        tiene(/if _pikt_sondas\(\) == 0:/, 'Falta «si sondas que ven la línea = 0».'),
        tiene(/drive_power\(0, 0\)/, 'Falta «parar motores» cuando se sale.'),
        tiene(/_pikt_desvio\(\)/, 'En el «si no» tiene que seguir el control proporcional.'),
      ),
      pista: 'Mete los dos bloques del paso anterior dentro del «si no».',
      solucion: estado([siempre([L5])], [V_DES]),
    },
    {
      titulo: 'Seguridad: ¡algo en la pista!',
      texto: [
        'Los vehículos autónomos frenan si hay algo delante. El sensor de ultrasonidos (los «ojos» del mBot2) mide la distancia con un eco, como los murciélagos.',
        'Envuelve todo lo de dentro de «por siempre» en otro «si … si no»: si «distancia ultrasonidos < 10», «parar motores» y «LED rojo»; si no, lo de antes.',
        'Pon la mano delante del robot mientras sigue la línea: ¿para? ¿Y sigue al quitarla?',
      ],
      bloques: [
        ['distancia ultrasonidos (cm)', 'a cuántos centímetros está lo que tiene delante (hasta unos 3 m).'],
        ['encender LED color', 'avisa con la luz del CyberPi.'],
      ],
      comprobar: todo(
        tiene(/if _pikt_distancia\(\) <=? \d+:/, 'Falta «si distancia ultrasonidos < 10».'),
        tiene(/led\.on\('red'\)/, 'Falta encender el LED en rojo al parar.'),
        tiene(/_pikt_sondas\(\)/, 'Dentro del «si no» tiene que seguir lo del paso anterior.'),
      ),
      pista: 'El orden importa: primero se mira el obstáculo (lo más urgente) y luego la línea.',
      solucion: estado([siempre([si(cmp(DISTANCIA, 'LT', 10), [PARAR, led('red')], [led('green'), L5])])], [V_DES]),
    },
    pasoEjecutar(['Reto: ¿cuántas vueltas da al circuito en un minuto? ¿Y con tu mejor ajuste del paso 4?']),
  ],
};

/* ═════════ 🚜 Tractor de siembra ═════════ */
const V_LARGO = { id: 'mb_largo', name: 'largo' };
const V_SURCOS = { id: 'mb_surcos', name: 'surcos' };
const V_HECHOS = { id: 'mb_hechos', name: 'sembrados' };
const SURCO = [avanzar(100), girar(90), avanzar(30), girar(90), avanzar(100), girar(-90), avanzar(30), girar(-90)];
const SURCO_V = (seguridad) => [
  ...(seguridad ? [mientras(cmp(DISTANCIA, 'LT', 25), [led('red'), tono(220, 0.1), esperar(0.5)]), led('green')] : []),
  avanzar(leer(V_LARGO)), girar(90), avanzar(30), girar(90),
  ...(seguridad ? [mientras(cmp(DISTANCIA, 'LT', 25), [led('red'), tono(220, 0.1), esperar(0.5)]), led('green')] : []),
  avanzar(leer(V_LARGO)), girar(-90), avanzar(30), girar(-90),
];
const INICIO_CAMPO = [fijar(V_LARGO, 100), fijar(V_SURCOS, 3)];
const SEMBRAR = [sumar(V_HECHOS, 1), mostrar(leer(V_HECHOS)), tono(880, 0.2)];
const VOLVER = [girar(-90), avanzar(op('MULTIPLY', leer(V_SURCOS), 60)), girar(90), tono(1320, 0.5)];

const TRACTOR = {
  id: 'tractor',
  emoji: '🚜',
  titulo: 'Tractor de siembra',
  desc: 'Programa un tractor autónomo: distancias y giros exactos, bucles para los surcos, un sensor de seguridad y la vuelta a casa.',
  pasos: [
    {
      titulo: 'Avanzar y girar con precisión',
      texto: [
        'Un tractor autónomo no se mueve «un rato»: avanza metros exactos. El mBot2 lo hace con los encoders, que cuentan las vueltas de las ruedas.',
        'Pon «mBot2 avanzar 30 cm» y debajo «mBot2 girar 90 grados».',
        'Ejecútalo y mide con una regla: ¿ha avanzado 30 cm? ¿Ha girado un ángulo recto?',
        'Los grados positivos giran a la derecha y los negativos a la izquierda. Para girar usa el giroscopio del CyberPi.',
      ],
      bloques: [
        ['mBot2 avanzar … cm', 'avanza esa distancia y espera a llegar (negativo = marcha atrás).'],
        ['mBot2 girar … grados', 'gira sobre sí mismo ese ángulo: +90 = derecha, −90 = izquierda, 180 = media vuelta.'],
      ],
      comprobar: todo(
        tiene(/mbot2\.straight\(/, 'Falta «mBot2 avanzar … cm».'),
        tiene(/mbot2\.turn\(/, 'Falta «mBot2 girar … grados».'),
      ),
      pista: 'Los dos están en mBot2 · Motores. Encájalos uno debajo del otro.',
      solucion: estado([avanzar(30), girar(90)]),
    },
    {
      titulo: 'Un cuadrado con un bucle',
      texto: [
        'Dibuja en el suelo un cuadrado de 50 cm de lado: avanzar 50 y girar 90… cuatro veces.',
        'En vez de poner 8 bloques, usa «repetir 4 veces» (Bucles) con «avanzar 50» y «girar 90» dentro.',
        '¿Vuelve exactamente al sitio de salida? 4 giros de 90° son 360°: una vuelta completa.',
        'Reto: ¿cómo harías un triángulo? (Pista: el robot gira el ángulo EXTERIOR, 360 ÷ 3).',
      ],
      bloques: [['repetir … veces', 'hace lo de dentro las veces que digas: los bucles ahorran bloques y errores.']],
      comprobar: todo(
        tiene(/for \w+ in range\(4\):/, 'Falta «repetir 4 veces».'),
        tiene(/for \w+ in range\(4\):\n\s+mbot2\.straight\([\s\S]*mbot2\.turn\(90\)/, 'Dentro del bucle van «avanzar» y «girar 90».'),
      ),
      pista: 'Si el cuadrado no cierra, es que los giros no son perfectos: los robots de verdad corrigen con sensores (lo verás en «Mapas, rutas y tractor»).',
      solucion: estado([repetir(4, [avanzar(50), girar(90)])]),
    },
    {
      titulo: 'Un surco de ida y vuelta',
      texto: [
        'Los tractores siembran en surcos rectos: van hasta el final del campo, se desplazan el ancho de la sembradora y vuelven en paralelo. Es un recorrido en zigzag.',
        'Con nuestro robot (30 cm de ancho): avanzar 100, girar 90, avanzar 30, girar 90 (ya mira hacia atrás), avanzar 100…',
        '…y para preparar el siguiente: girar −90, avanzar 30, girar −90. Ya está mirando al frente otra vez, 60 cm más a la derecha.',
        'Dibuja el recorrido en un papel antes de ejecutarlo: ¿dónde acaba el robot?',
      ],
      bloques: [['girar −90', 'los grados negativos giran a la izquierda: así el zigzag va una vez a cada lado.']],
      comprobar: todo(
        tiene(/mbot2\.turn\(90\)/, 'Falta girar 90 (a la derecha) al final del surco de ida.'),
        tiene(/mbot2\.turn\(-90\)/, 'Falta girar −90 (a la izquierda) al final del surco de vuelta.'),
        tiene(/(mbot2\.straight\([^)]*\)[\s\S]*){4}/, 'Faltan avances: dos surcos largos y dos desplazamientos de 30 cm.'),
      ),
      pista: 'Orden: avanzar 100 · girar 90 · avanzar 30 · girar 90 · avanzar 100 · girar −90 · avanzar 30 · girar −90.',
      solucion: estado(SURCO),
    },
    {
      titulo: 'Todo el campo con variables',
      texto: [
        'Crea dos variables: «largo» (lo que mide el campo, 100 cm) y «surcos» (cuántas parejas de surcos, 3).',
        'Al principio: «fijar largo a 100» y «fijar surcos a 3».',
        'Después, «repetir (surcos) veces» con el surco de ida y vuelta dentro, usando «largo» en vez del 100.',
        'Ahora puedes cambiar el tamaño del campo cambiando solo dos números. ¿Cuánto mide de ancho el campo con 3 parejas de surcos? (3 × 60 = 180 cm).',
      ],
      bloques: [
        ['variables', 'guardan un número con nombre: el programa sirve para cualquier campo.'],
        ['repetir (surcos) veces', 'en el hueco del número cabe una variable.'],
      ],
      comprobar: todo(
        tiene(/(\w+) = 100\b/, 'Falta «fijar largo a 100».'),
        tiene(/for \w+ in range\((int\()?[a-z_]\w*\)?\):/, 'El «repetir» tiene que usar la variable «surcos».'),
        tiene(/mbot2\.straight\([a-z_]\w*\)/, 'Usa la variable «largo» en los avances de los surcos.'),
      ),
      pista: 'Las variables se crean en la categoría Variables → «Crear variable». Arrastra «largo» al hueco de «avanzar … cm».',
      solucion: estado([...INICIO_CAMPO, repetir(leer(V_SURCOS), SURCO_V(false))], [V_LARGO, V_SURCOS]),
    },
    {
      titulo: 'Sembrar y contar',
      texto: [
        'Cada vez que termina una pareja de surcos, el tractor «siembra»: un pitido y en la pantalla cuántas lleva.',
        'Crea la variable «sembrados». Al principio «fijar sembrados a 0».',
        'Al final de lo de dentro del «repetir»: «cambiar sembrados en 1», «mostrar valor (sembrados)» y un tono.',
      ],
      bloques: [
        ['cambiar … en 1', 'suma 1 a la variable: es un contador.'],
        ['mostrar valor', 'enseña el contador en la pantalla.'],
      ],
      comprobar: todo(
        tiene(/(\w+) = \1 \+ 1/, 'Falta «cambiar sembrados en 1».'),
        tiene(/show_label\(str\(\w+\)/, 'Falta «mostrar valor (sembrados)».'),
        tiene(/play_tone\(/, 'Falta el pitido de siembra.'),
      ),
      pista: '«cambiar … en 1» está en Variables.',
      solucion: estado([...INICIO_CAMPO, fijar(V_HECHOS, 0), repetir(leer(V_SURCOS), [...SURCO_V(false), ...SEMBRAR])], [V_LARGO, V_SURCOS, V_HECHOS]),
    },
    {
      titulo: '¡Un árbol en el surco!',
      texto: [
        'Un tractor autónomo no puede atropellar a nadie: antes de cada surco mira si hay algo delante.',
        'Antes de cada «avanzar (largo)», pon «mientras distancia ultrasonidos < 25» con «LED rojo», un tono grave y «esperar 0,5 s» dentro.',
        'Después del «mientras», «LED verde»: el camino está libre.',
        'Pruébalo poniendo la mano (o una caja) delante: el tractor espera a que se aparte. (En «Mapas, rutas y tractor» verás uno que además lo rodea).',
      ],
      bloques: [
        ['mientras …', 'repite lo de dentro MIENTRAS la condición sea verdad: aquí, esperar hasta que el camino esté libre.'],
        ['distancia ultrasonidos', 'el eco del sensor: a cuántos centímetros está el obstáculo.'],
      ],
      comprobar: todo(
        tiene(/while _pikt_distancia\(\) <=? \d+:/, 'Falta «mientras distancia ultrasonidos < 25».'),
        tiene(/led\.on\('red'\)/, 'Dentro del «mientras», enciende el LED en rojo.'),
        tiene(/led\.on\('green'\)/, 'Después del «mientras», LED verde.'),
      ),
      pista: '«mientras» está en Bucles (el bloque «repetir mientras»).',
      solucion: estado([...INICIO_CAMPO, fijar(V_HECHOS, 0), repetir(leer(V_SURCOS), [...SURCO_V(true), ...SEMBRAR])], [V_LARGO, V_SURCOS, V_HECHOS]),
    },
    {
      titulo: 'Volver a casa',
      texto: [
        'Al acabar, el tractor está en la misma fila de la salida pero (surcos × 60) cm a la derecha, mirando al frente.',
        'Después del «repetir»: «girar −90» (mira hacia la salida), «avanzar (surcos × 60)», «girar 90» (vuelve a mirar al frente) y una melodía de fin.',
        'Si cambias «surcos» a 5, ¿sigue volviendo bien? Así se ve la ventaja de calcular con variables.',
      ],
      bloques: [['× (multiplicar)', 'calcula la distancia de vuelta a partir del número de surcos.']],
      comprobar: todo(
        tiene(/mbot2\.straight\([a-z_]\w* \* 60\)|mbot2\.straight\(60 \* [a-z_]\w*\)/, 'Falta «avanzar (surcos × 60)» después del bucle.'),
        tiene(/mbot2\.turn\(-90\)\n(?!\s)/, 'Después del bucle (fuera de él) tiene que girar −90 para mirar hacia la salida.'),
      ),
      pista: 'Ojo: estos bloques van DEBAJO del «repetir», no dentro.',
      solucion: estado([...INICIO_CAMPO, fijar(V_HECHOS, 0), repetir(leer(V_SURCOS), [...SURCO_V(true), ...SEMBRAR]), ...VOLVER], [V_LARGO, V_SURCOS, V_HECHOS]),
    },
    pasoEjecutar([
      'Marca el campo en el suelo con cinta de carrocero (100 × 180 cm) y una «casa» en la salida.',
      'Siguiente nivel: en «Programación y robótica» → «🚜 Mapas, rutas y tractor», el tractor recorre cualquier campo que dibujes y rodea los obstáculos solo.',
    ]),
  ],
};

export const RECORRIDOS_MBOT2 = [LINEA, TRACTOR];
