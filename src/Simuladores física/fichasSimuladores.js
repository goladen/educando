// ─────────────────────────────────────────────────────────────────────────────
//  Contenido de la FICHA PDF de cada simulador de Física y Química
//  (la genera src/ecuaciones/FichaSimulador.jsx).
//  Por simulador: área, objetivo, teoría, fórmulas clave, actividades guiadas
//  CON EL SIMULADOR (con su solución) y, en los de química, un generador de
//  ejercicios propios. Los valores esperados están calculados con g = 9,81 m/s²,
//  la misma que usan los simuladores.
//  Escalada y Lluvia no tienen ficha (no se pidió).
// ─────────────────────────────────────────────────────────────────────────────

const R = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const barajar = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻' };
const sup = (s) => String(s).split('').map((c) => SUP[c] || c).join('');

// ─── Ejercicios propios de química ──────────────────────────────────────────
const ELEMENTOS = [
    ['H', 'hidrógeno', 1, 1], ['He', 'helio', 2, 4], ['Li', 'litio', 3, 7], ['Be', 'berilio', 4, 9], ['B', 'boro', 5, 11],
    ['C', 'carbono', 6, 12], ['N', 'nitrógeno', 7, 14], ['O', 'oxígeno', 8, 16], ['F', 'flúor', 9, 19], ['Ne', 'neón', 10, 20],
    ['Na', 'sodio', 11, 23], ['Mg', 'magnesio', 12, 24], ['Al', 'aluminio', 13, 27], ['Si', 'silicio', 14, 28], ['P', 'fósforo', 15, 31],
    ['S', 'azufre', 16, 32], ['Cl', 'cloro', 17, 35], ['K', 'potasio', 19, 39], ['Ca', 'calcio', 20, 40], ['Fe', 'hierro', 26, 56],
    ['Cu', 'cobre', 29, 64], ['Zn', 'zinc', 30, 65], ['Ag', 'plata', 47, 108], ['Au', 'oro', 79, 197],
];
// Iones habituales (carga)
const CARGAS = { Li: 1, Na: 1, K: 1, Mg: 2, Ca: 2, Al: 3, Fe: 3, Cu: 2, Zn: 2, Ag: 1, F: -1, Cl: -1, O: -2, S: -2, N: -3 };
// Isótopos conocidos además del más abundante
const ISOTOPOS = { H: [2, 3], C: [13, 14], O: [18], Cl: [37], U: [] };

function ejerciciosAtomos(n) {
    const out = [];
    for (const [sim, nombre, Z, A0] of barajar(ELEMENTOS)) {
        if (out.length >= n) break;
        const r = Math.random();
        let A = A0, carga = 0;
        if (r < 0.35 && CARGAS[sim]) carga = CARGAS[sim];
        else if (r < 0.5 && ISOTOPOS[sim]?.length) A = ISOTOPOS[sim][R(0, ISOTOPOS[sim].length - 1)];
        const ion = carga ? sup(`${Math.abs(carga) > 1 ? Math.abs(carga) : ''}${carga > 0 ? '+' : '-'}`) : '';
        const e = Z - carga;
        out.push({
            enunciado: `${sup(A)}${sim}${ion} (${nombre}${carga ? `, ion ${carga > 0 ? 'positivo' : 'negativo'}` : ''}): protones ____ · neutrones ____ · electrones ____`,
            solucion: `${Z} protones · ${A - Z} neutrones · ${e} electrones${carga ? ` (${carga > 0 ? `ha perdido ${carga}` : `ha ganado ${-carga}`} e⁻)` : ''}`,
            alto: 24,
        });
    }
    return out;
}

const LEWIS = [
    ['H₂', 'hidrógeno', '1 enlace simple (H—H). 0 pares solitarios.'],
    ['Cl₂', 'cloro', '1 enlace simple (Cl—Cl). 3 pares solitarios en cada Cl.'],
    ['O₂', 'oxígeno', '1 enlace doble (O=O). 2 pares solitarios en cada O.'],
    ['N₂', 'nitrógeno', '1 enlace triple (N≡N). 1 par solitario en cada N.'],
    ['HCl', 'cloruro de hidrógeno', '1 enlace simple (H—Cl). 3 pares solitarios en el Cl.'],
    ['H₂O', 'agua', '2 enlaces simples (H—O—H). 2 pares solitarios en el O (forma angular).'],
    ['NH₃', 'amoniaco', '3 enlaces simples N—H. 1 par solitario en el N (pirámide).'],
    ['CH₄', 'metano', '4 enlaces simples C—H. 0 pares solitarios (tetraedro).'],
    ['CO₂', 'dióxido de carbono', '2 enlaces dobles (O=C=O). 2 pares solitarios en cada O (lineal).'],
    ['C₂H₄', 'eteno', '1 enlace doble C=C y 4 simples C—H. 0 pares solitarios.'],
    ['C₂H₂', 'etino', '1 enlace triple C≡C y 2 simples C—H. 0 pares solitarios.'],
    ['HCN', 'cianuro de hidrógeno', '1 enlace simple H—C y 1 triple C≡N. 1 par solitario en el N.'],
    ['H₂S', 'sulfuro de hidrógeno', '2 enlaces simples H—S. 2 pares solitarios en el S.'],
    ['CCl₄', 'tetracloruro de carbono', '4 enlaces simples C—Cl. 3 pares solitarios en cada Cl.'],
    ['PH₃', 'fosfina', '3 enlaces simples P—H. 1 par solitario en el P.'],
    ['CH₂O', 'metanal', '2 enlaces simples C—H y 1 doble C=O. 2 pares solitarios en el O.'],
];
const ejerciciosLewis = (n) => barajar(LEWIS).slice(0, n).map(([f, nombre, sol]) => ({
    enunciado: `Dibuja la estructura de Lewis del ${f} (${nombre}). ¿Cuántos enlaces simples, dobles y triples tiene? ¿Cuántos pares de electrones no enlazantes?`,
    solucion: sol, alto: 110,
}));

const ejerciciosAjuste = (n, modulo) => barajar(modulo?.REACCIONES || []).slice(0, n).map((r) => {
    const huecos = [...r.reactants.map((x) => `___ ${x}`).join(' + '), ' → ', r.products.map((x) => `___ ${x}`).join(' + ')].join('');
    const k = r.coefficients;
    const nr = r.reactants.length;
    const con = (lista, off) => lista.map((x, i) => `${k[off + i] === 1 ? '' : k[off + i] + ' '}${x}`).join(' + ');
    return {
        enunciado: `${r.name}: ${huecos}`,
        solucion: `${con(r.reactants, 0)} → ${con(r.products, nr)}`,
        alto: 34,
    };
});

// ─── Fichas ─────────────────────────────────────────────────────────────────
export const FICHAS_SIM = {
    CAIDA_LIBRE: {
        area: 'Física', objetivo: 'Comprender el movimiento de caída libre (MRUA) y comprobar que el tiempo de caída no depende de la masa.',
        teoria: [
            'Un cuerpo en caída libre solo está sometido a su peso. Sin rozamiento con el aire, todos los cuerpos caen con la misma aceleración, g ≈ 9,81 m/s², sea cual sea su masa.',
            'Su velocidad aumenta de forma uniforme (movimiento rectilíneo uniformemente acelerado) y la distancia recorrida crece con el cuadrado del tiempo: en el doble de tiempo recorre el cuádruple.',
            'Mientras cae, la energía potencial se transforma en energía cinética.',
        ],
        formulas: ['v = g·t', 'h = ½·g·t²', 't = √(2h/g)', 'v = √(2·g·h)', 'm·g·h = ½·m·v²'],
        actividades: [
            { t: 'Pon la altura en 20 m y pulsa ▶. Anota el tiempo de caída: t = ______ s y la velocidad final: v = ______ m/s. Comprueba el tiempo con t = √(2h/g).', s: 't ≈ 2,02 s; v ≈ 19,81 m/s.' },
            { t: 'Repite con 80 m (el cuádruple de altura): t = ______ s. ¿Cuántas veces mayor es el tiempo? ______', s: 't ≈ 4,04 s: el doble, porque t es proporcional a √h.' },
            { t: 'Deja la altura en 50 m y cambia la masa de 10 kg a 100 kg. ¿Cambia el tiempo de caída? ______ ¿Por qué?', s: 'No: 3,19 s en los dos casos. Sin aire, la aceleración (g) no depende de la masa.' },
            { t: 'Completa la tabla con el simulador.  h (m): 5 · 20 · 45 · 125  →  t (s): ___ · ___ · ___ · ___  →  v (m/s): ___ · ___ · ___ · ___', s: 't: 1,01 · 2,02 · 3,03 · 5,05 s;  v: 9,90 · 19,81 · 29,71 · 49,52 m/s.' },
            { t: 'Con 10 kg y 50 m, ¿qué energía cinética tiene el objeto al llegar al suelo? (Ec = Ep = m·g·h) Ec = ______ J', s: 'Ec = 10·9,81·50 = 4905 J.' },
        ],
    },
    PLANO_INCLINADO: {
        area: 'Física', objetivo: 'Descomponer el peso en un plano inclinado y relacionar el ángulo con la aceleración.',
        teoria: [
            'En un plano inclinado sin rozamiento, el peso se descompone en dos fuerzas: una paralela a la rampa, m·g·sen θ, que acelera el cuerpo, y otra perpendicular, m·g·cos θ, que queda compensada por la fuerza normal.',
            'La aceleración, a = g·sen θ, no depende de la masa: un camión y un coche de juguete bajan igual de rápido si no hay rozamiento. Cuanto mayor es el ángulo, mayor es la aceleración.',
        ],
        formulas: ['Pₓ = m·g·sen θ', 'N = m·g·cos θ', 'a = g·sen θ', 'L = ½·a·t²  →  t = √(2L/a)', 'v = a·t = √(2·a·L)'],
        actividades: [
            { t: 'Ángulo 30° y longitud 10 m. Anota la aceleración a = ______ m/s² y el tiempo de bajada t = ______ s. Comprueba a = g·sen 30°.', s: 'a = 9,81·0,5 = 4,905 m/s²; t = √(2·10/4,905) ≈ 2,02 s.' },
            { t: 'Con 30° y 10 m, cambia la masa de 10 kg a 50 kg. ¿Cambian la aceleración y el tiempo? ¿Y la fuerza paralela a la rampa?', s: 'a y t no cambian. La fuerza paralela se multiplica por 5: de 49,05 N a 245,25 N.' },
            { t: 'Completa la aceleración para cada ángulo.  θ: 15° · 30° · 45° · 60° · 80°  →  a (m/s²): ___ · ___ · ___ · ___ · ___', s: '2,54 · 4,91 · 6,94 · 8,50 · 9,66 m/s².' },
            { t: '¿Con qué ángulo la aceleración es justo la mitad de g? θ = ______ (compruébalo en el simulador)', s: '30°, porque sen 30° = 1/2.' },
            { t: '¿Qué ocurre con 0°? ¿Y qué pasaría con 90°?', s: 'Con 0° no se mueve (a = 0). Con 90° sería una caída libre (a = g).' },
        ],
    },
    TIRO_PARABOLICO: {
        area: 'Física', objetivo: 'Entender el tiro parabólico como la suma de un movimiento horizontal uniforme y uno vertical acelerado.',
        teoria: [
            'Un proyectil combina dos movimientos independientes: en horizontal, un MRU con vₓ = v₀·cos α constante; en vertical, un MRUA frenado por la gravedad. La trayectoria es una parábola.',
            'En el punto más alto la velocidad vertical es cero. Lanzando desde el suelo, el alcance máximo se consigue con 45° y dos ángulos complementarios (30° y 60°, 15° y 75°…) llegan igual de lejos.',
        ],
        formulas: ['vₓ = v₀·cos α', 'v_y = v₀·sen α − g·t', 'x = v₀·cos α·t', 'y = h₀ + v₀·sen α·t − ½·g·t²', 'R = v₀²·sen(2α)/g  (h₀ = 0)', 'h_máx = v₀²·sen²α/(2g)'],
        actividades: [
            { t: 'h₀ = 0, v₀ = 20 m/s y α = 45°. Anota el alcance R = ______ m, la altura máxima ______ m y el tiempo de vuelo ______ s.', s: 'R ≈ 40,77 m; h_máx ≈ 10,19 m; t ≈ 2,88 s.' },
            { t: 'Con 20 m/s prueba 30° y 60°: R(30°) = ______ m, R(60°) = ______ m. ¿Qué observas?', s: 'Los dos ≈ 35,31 m: los ángulos complementarios dan el mismo alcance.' },
            { t: 'Con 45°, duplica la velocidad de 20 a 40 m/s. ¿Cuántas veces mayor es el alcance?', s: '4 veces (≈ 163,1 m): el alcance es proporcional a v₀².' },
            { t: 'Lanza horizontalmente (α = 0°) desde h₀ = 45 m a 10 m/s. Tiempo de caída ______ s; distancia horizontal ______ m.', s: 't = √(2·45/9,81) ≈ 3,03 s; x = 10·3,03 ≈ 30,3 m.' },
            { t: 'En el punto más alto de la trayectoria, ¿cuánto vale v_y? ¿Y vₓ?', s: 'v_y = 0; vₓ = v₀·cos α, la misma de todo el vuelo.' },
        ],
    },
    PENDULO: {
        area: 'Física', objetivo: 'Estudiar el periodo del péndulo y la conservación de la energía mecánica.',
        teoria: [
            'Un péndulo oscila intercambiando energía potencial (máxima en los extremos, donde se para un instante) y energía cinética (máxima en el punto más bajo). Sin rozamiento, la energía mecánica total se conserva.',
            'Para ángulos pequeños, el periodo (tiempo de una oscilación completa) solo depende de la longitud del hilo y de g: no depende de la masa ni de la amplitud.',
        ],
        formulas: ['T = 2π·√(L/g)', 'h = L·(1 − cos θ)', 'Ep = m·g·h', 'Ec = ½·m·v²', 'v_máx = √(2·g·L·(1 − cos θ))'],
        actividades: [
            { t: 'L = 2 m y ángulo 20°. Cuenta 10 oscilaciones, mide el tiempo y divide entre 10: T = ______ s. Compáralo con T = 2π√(L/g).', s: 'T = 2π·√(2/9,81) ≈ 2,84 s.' },
            { t: 'Cambia la masa de 2 kg a 20 kg. ¿Cambia el periodo? ______', s: 'No: el periodo no depende de la masa.' },
            { t: 'Completa.  L: 1 m · 2 m · 4 m  →  T: ______ · ______ · ______ s. ¿Qué pasa con T al cuadruplicar L?', s: '2,01 · 2,84 · 4,01 s: al cuadruplicar la longitud, el periodo se duplica.' },
            { t: 'L = 2 m, θ = 45° y m = 2 kg: altura inicial h = ______ m, Ep = ______ J, velocidad en el punto más bajo v = ______ m/s.', s: 'h = 2·(1 − cos 45°) ≈ 0,59 m; Ep ≈ 11,49 J; v ≈ 3,39 m/s.' },
            { t: '¿Dónde es máxima la energía cinética? ¿Y la potencial? ¿Qué le pasa a su suma?', s: 'Ec máxima en el punto más bajo; Ep máxima en los extremos; la suma (energía mecánica) es constante.' },
        ],
    },
    LEY_OHM: {
        area: 'Física', objetivo: 'Relacionar tensión, intensidad y resistencia en un circuito (ley de Ohm) y calcular la potencia.',
        teoria: [
            'La intensidad de corriente que circula por un conductor es directamente proporcional a la tensión (voltaje) aplicada e inversamente proporcional a su resistencia: es la ley de Ohm.',
            'La potencia eléctrica es la energía que consume un aparato cada segundo. En una bombilla, a más potencia, más brillo.',
        ],
        formulas: ['I = V / R', 'V = I·R', 'R = V / I', 'P = V·I = I²·R = V²/R', 'E = P·t'],
        actividades: [
            { t: 'Pon V = 12 V y R = 10 Ω. Intensidad I = ______ A; potencia P = ______ W.', s: 'I = 12/10 = 1,2 A; P = 12·1,2 = 14,4 W.' },
            { t: 'Deja R = 10 Ω y completa.  V: 6 · 12 · 18 · 24 V  →  I: ___ · ___ · ___ · ___ A. ¿Qué relación hay entre V e I?', s: '0,6 · 1,2 · 1,8 · 2,4 A: son directamente proporcionales.' },
            { t: 'Deja V = 12 V y completa.  R: 10 · 20 · 40 · 80 Ω  →  I: ___ · ___ · ___ · ___ A.', s: '1,2 · 0,6 · 0,3 · 0,15 A: al duplicar R, I se reduce a la mitad (inversamente proporcionales).' },
            { t: 'Busca en el simulador una combinación que dé exactamente I = 0,5 A: V = ______ V, R = ______ Ω.', s: 'Cualquiera con V/R = 0,5; por ejemplo 12 V y 24 Ω o 10 V y 20 Ω.' },
            { t: '¿Qué bombilla brilla más: 24 V con 100 Ω o 12 V con 10 Ω? Calcula las dos potencias.', s: '24²/100 = 5,76 W y 12²/10 = 14,4 W: brilla más la segunda.' },
        ],
    },
    COLISIONES: {
        area: 'Física', objetivo: 'Aplicar la conservación de la cantidad de movimiento y de la energía en los choques.',
        teoria: [
            'En cualquier choque se conserva la cantidad de movimiento total (p = m·v). En un choque elástico además se conserva la energía cinética; en uno inelástico se pierde parte de ella (deformación, calor, sonido).',
            'En este experimento, un bloque pequeño de 1 kg está entre una pared y un bloque grande de 100ⁿ⁻¹ kg, y todos los choques son elásticos. ¡El número total de choques reproduce las cifras del número π!',
        ],
        formulas: ['p = m·v', 'm₁·v₁ + m₂·v₂ = m₁·v₁′ + m₂·v₂′', 'Ec = ½·m·v²', 'Elástico: se conserva también la Ec', 'Quedan unidos: v′ = (m₁·v₁ + m₂·v₂)/(m₁ + m₂)'],
        actividades: [
            { t: 'Elige 1 cifra (los dos bloques de 1 kg) e inicia. ¿Cuántos choques hay en total? ______', s: '3 choques.' },
            { t: 'Repite con 2, 3 y 4 cifras y anota los choques: ______ · ______ · ______. ¿A qué número famoso se parecen?', s: '31 · 314 · 3141: son las primeras cifras de π.' },
            { t: '¿Cuál es la masa del bloque grande con 3 cifras? ______ kg', s: '100² = 10 000 kg.' },
            { t: 'Un carrito de 2 kg a 3 m/s choca con otro de 1 kg parado y quedan unidos. ¿A qué velocidad se mueven juntos?', s: 'v′ = 2·3/(2 + 1) = 2 m/s.' },
            { t: 'En el choque anterior, ¿se conserva la energía cinética? Calcúlala antes y después.', s: 'Antes 9 J y después 6 J: no se conserva (choque inelástico).' },
        ],
    },
    GAY_LUSAC: {
        area: 'Química', objetivo: 'Comprobar la ley de Gay-Lussac: a volumen constante, la presión de un gas es proporcional a su temperatura absoluta.',
        teoria: [
            'Si el volumen de un gas no cambia, su presión es directamente proporcional a su temperatura absoluta. Al calentarlo, las partículas se mueven más deprisa y chocan con más fuerza y más a menudo contra las paredes.',
            'En las leyes de los gases la temperatura siempre se expresa en kelvin: T(K) = T(°C) + 273. A 0 K (−273 °C) las partículas apenas se moverían.',
        ],
        formulas: ['P₁/T₁ = P₂/T₂  (V constante)', 'T(K) = T(°C) + 273', 'Boyle: P₁·V₁ = P₂·V₂  (T constante)', 'Charles: V₁/T₁ = V₂/T₂  (P constante)', 'P·V = n·R·T'],
        actividades: [
            { t: 'Pon la temperatura a 0 °C y anota la presión: P = ______. Súbela a 100 °C: P = ______. ¿Cuánto vale el cociente P(100 °C)/P(0 °C)?', s: 'La presión aumenta y el cociente vale 373/273 ≈ 1,37.' },
            { t: 'Pasa a kelvin: 0 °C = ______ K · 27 °C = ______ K · 100 °C = ______ K', s: '273 K · 300 K · 373 K.' },
            { t: 'Elige tres temperaturas en el simulador y calcula P/T (con T en kelvin). ¿Qué observas?', s: 'El cociente P/T es siempre el mismo: la presión es proporcional a la temperatura absoluta.' },
            { t: 'Si la temperatura absoluta de un gas se duplica a volumen constante, su presión ______', s: 'se duplica.' },
            { t: '¿Por qué no se debe acercar un aerosol al fuego?', s: 'Al calentarse, aumenta la presión del gas encerrado (volumen constante) y el envase puede explotar.' },
        ],
    },
    ATOMOS: {
        area: 'Química', objetivo: 'Conocer las partículas del átomo y calcular protones, neutrones y electrones de átomos, isótopos e iones.',
        teoria: [
            'Los átomos tienen un núcleo con protones (carga +) y neutrones (sin carga), rodeado de electrones (carga −). El número atómico Z es el número de protones e identifica al elemento; el número másico A es la suma de protones y neutrones.',
            'Un átomo neutro tiene tantos electrones como protones. Si pierde electrones se convierte en un ion positivo (catión) y si los gana, en un ion negativo (anión). Los isótopos son átomos del mismo elemento con distinto número de neutrones.',
        ],
        formulas: ['Z = nº de protones', 'A = Z + N  (N = neutrones)', 'N = A − Z', 'Átomo neutro: e⁻ = Z', 'Ion: e⁻ = Z − carga'],
        actividades: [
            { t: 'Selecciona el carbono en la tabla periódica. Protones ______ · neutrones ______ · electrones ______', s: '6 · 6 · 6 (carbono-12).' },
            { t: 'Selecciona el oxígeno. ¿Cuántos electrones tiene en cada capa? ______', s: '2 en la primera y 6 en la segunda.' },
            { t: 'Compara el sodio (Na) y el cloro (Cl): ¿cuál tiende a perder un electrón y cuál a ganarlo? ¿Qué iones forman?', s: 'El Na pierde 1 e⁻ (Na⁺) y el Cl gana 1 e⁻ (Cl⁻).' },
            { t: 'Busca dos elementos de la misma columna (grupo) y compara los electrones de su última capa.', s: 'Tienen los mismos electrones en la última capa; por eso se comportan de forma parecida.' },
        ],
        ejercicios: { titulo: 'Completa las partículas de cada átomo o ion', gen: ejerciciosAtomos, defecto: 8 },
    },
    ENLACE_MOLECULAS: {
        area: 'Química', objetivo: 'Representar moléculas con enlaces covalentes mediante estructuras de Lewis.',
        teoria: [
            'Los átomos no metálicos se unen compartiendo electrones (enlace covalente) para completar su última capa con 8 electrones: es la regla del octeto (el hidrógeno se completa con 2).',
            'Un par de electrones compartido forma un enlace simple; dos pares, un enlace doble; y tres, uno triple. Los pares que no se comparten se llaman pares solitarios o no enlazantes.',
        ],
        formulas: ['Regla del octeto: 8 e⁻ en la última capa (H: 2)', 'Enlace simple: 1 par compartido (—)', 'Enlace doble: 2 pares (=)', 'Enlace triple: 3 pares (≡)', 'Enlaces que forma: H 1 · O 2 · N 3 · C 4 · Cl 1'],
        actividades: [
            { t: 'Construye en la pizarra la molécula de H₂O. ¿Cuántos enlaces forma el oxígeno? ¿Cuántos pares solitarios le quedan?', s: '2 enlaces simples y 2 pares solitarios.' },
            { t: 'Construye el CO₂. ¿Qué tipo de enlaces hay entre el carbono y los oxígenos?', s: 'Dos enlaces dobles: O=C=O.' },
            { t: 'Construye la molécula de N₂. ¿Por qué necesita un enlace triple?', s: 'Cada N tiene 5 e⁻ de valencia y le faltan 3: comparten 3 pares.' },
            { t: 'Construye CH₄ y NH₃. ¿Cuántos pares solitarios tiene el átomo central en cada una?', s: 'CH₄: ninguno. NH₃: uno (en el N).' },
        ],
        ejercicios: { titulo: 'Estructuras de Lewis', gen: ejerciciosLewis, defecto: 6 },
    },
    AJUSTES_REACCION: {
        area: 'Química', objetivo: 'Ajustar ecuaciones químicas aplicando la ley de conservación de la masa.',
        teoria: [
            'En una reacción química los átomos no se crean ni se destruyen: solo se reorganizan (ley de conservación de la masa de Lavoisier). Por eso la ecuación química debe tener el mismo número de átomos de cada elemento en los reactivos y en los productos.',
            'Para ajustarla se escriben coeficientes delante de las fórmulas. Nunca se cambian los subíndices, porque se cambiaría la sustancia.',
        ],
        formulas: ['Masa de los reactivos = masa de los productos', 'Coeficiente = nº de moléculas (o de moles)', 'Nunca se cambian los subíndices', 'Orden útil: metales → no metales → H → O'],
        actividades: [
            { t: 'Elige la síntesis del agua y ajústala en la pizarra. Cuenta los átomos de H y de O a cada lado.', s: '2 H₂ + O₂ → 2 H₂O: 4 átomos de H y 2 de O a cada lado.' },
            { t: 'Ajusta la combustión del metano. ¿Cuántas moléculas de O₂ hacen falta por cada molécula de CH₄?', s: 'CH₄ + 2 O₂ → CO₂ + 2 H₂O: dos.' },
            { t: 'Comprueba la conservación de la masa: 2 H₂ (4 g) + O₂ (32 g) → 2 H₂O (______ g)', s: '36 g.' },
        ],
        ejercicios: { titulo: 'Ajusta las siguientes reacciones', gen: ejerciciosAjuste, defecto: 8 },
    },
    ECLIPSE: {
        area: 'Física', objetivo: 'Explicar los eclipses de Sol y de Luna y las fases lunares con el modelo Sol–Tierra–Luna.',
        teoria: [
            'Un eclipse de Sol ocurre cuando la Luna se interpone entre el Sol y la Tierra (siempre en luna nueva) y su sombra llega a la Tierra. Un eclipse de Luna ocurre cuando la Tierra se interpone entre el Sol y la Luna (luna llena).',
            'No hay eclipses todos los meses porque la órbita de la Luna está inclinada unos 5° respecto a la de la Tierra. Casualmente, el Sol es unas 400 veces mayor que la Luna y está unas 400 veces más lejos: por eso se ven del mismo tamaño.',
        ],
        formulas: ['Semejanza: D_Sol/d_Sol ≈ D_Luna/d_Luna', 'c = 300 000 km/s', 't = d / c', 'Umbra → eclipse total · penumbra → parcial', 'Luna en el apogeo → eclipse anular'],
        actividades: [
            { t: 'Coloca la Luna para que haya un eclipse de Sol. ¿En qué fase lunar está? ______', s: 'Luna nueva.' },
            { t: '¿Qué diferencia hay entre la umbra y la penumbra? ¿Qué ve un observador en cada una?', s: 'En la umbra el Sol queda totalmente tapado (eclipse total); en la penumbra, solo en parte (parcial).' },
            { t: '¿Por qué no hay un eclipse de Sol en cada luna nueva?', s: 'Porque la órbita lunar está inclinada unos 5°: casi siempre la Luna pasa por encima o por debajo de la línea Sol–Tierra.' },
            { t: '¿Cuánto tarda la luz reflejada por la Luna (384 000 km) en llegar a la Tierra?', s: 't = 384 000 / 300 000 = 1,28 s.' },
        ],
    },
    SISTEMA_SOLAR: {
        area: 'Física', objetivo: 'Relacionar la gravitación universal con el movimiento de los planetas y con el peso.',
        teoria: [
            'Los planetas giran alrededor del Sol atraídos por la fuerza gravitatoria, que es proporcional a las masas e inversamente proporcional al cuadrado de la distancia (ley de la gravitación de Newton).',
            'Cuanto más lejos está un planeta, más despacio orbita y más tarda en dar una vuelta (3.ª ley de Kepler). El peso de un cuerpo depende de la gravedad del lugar, pero su masa es siempre la misma.',
        ],
        formulas: ['F = G·m₁·m₂/d²', 'P = m·g', 'F = m·a  (2.ª ley de Newton)', 'Kepler: T² = r³  (T en años, r en UA)', 'v_orbital = √(G·M/r)'],
        actividades: [
            { t: 'Observa las órbitas: ¿qué planeta tarda más en dar una vuelta al Sol? ¿Por qué?', s: 'Neptuno: es el más lejano y la gravedad del Sol allí es más débil.' },
            { t: 'Calcula tu peso en la Tierra (9,8 m/s²), en Marte (3,7 m/s²) y en Júpiter (24,8 m/s²) con tu masa: ______ N · ______ N · ______ N', s: 'P = m·g en cada caso; la masa no cambia.' },
            { t: 'Si la distancia entre dos cuerpos se duplica, la fuerza gravitatoria entre ellos ______', s: 'se divide entre 4.' },
            { t: 'Marte está a 1,52 UA del Sol. Con T² = r³, ¿cuánto dura su año? T = ______ años', s: 'T = √(1,52³) ≈ 1,87 años.' },
        ],
    },
};
export const SIN_FICHA = ['CAIDA_ESCALADA', 'LLUVIA'];
