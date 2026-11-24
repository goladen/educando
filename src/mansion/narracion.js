// ═══════════════════════════════════════════════════════════════════
//  NARRADOR DE LA MANSIÓN PITAGÓRICA (frases de escape room)
//  Grabadas con antelación:  node scripts/generar-voces-mansion.mjs  → public/audio/mansion/<id>.mp3
//  Si se cambia un texto, volver a grabar esa frase:  node scripts/generar-voces-mansion.mjs --solo=<id> --force
//  En el juego suenan con el efecto tenebroso de utils/audioTenebroso.js (narrar) y salen como subtítulo.
// ═══════════════════════════════════════════════════════════════════

export const FRASES = {
    intro_mansion: 'Bienvenidos a la mansión… La puerta se ha cerrado a vuestra espalda. Responded bien para abrir las puertas, buscad las cifras del candado… y que no os vean los fantasmas.',
    intro_piramide: 'Habéis entrado en la tumba del faraón… Las momias vigilan sus pasillos desde hace miles de años. Encontrad las cifras escondidas… o quedaréis atrapados para siempre.',
    intro_nave: 'Alerta… Nave abandonada. Los drones de seguridad siguen activos. Recuperad los chips con el código… y abrid la compuerta de salida.',
    intro_dual: 'Os habéis separado… Cada uno despierta en un rincón distinto. Compartid las pistas… porque solo saldréis si escapáis juntos.',
    puerta_1: 'La puerta cruje… y se abre lentamente.',
    puerta_2: 'Bien hecho… pero algo os observa desde la oscuridad.',
    puerta_3: 'Otra puerta abierta… Seguid adelante, si os atrevéis.',
    fallo_1: 'Respuesta equivocada… La casa se enfada.',
    fallo_2: 'Error… Las sombras se acercan.',
    pista: 'Una pista… Guardad bien esa cifra.',
    pistas_todas: 'Ya tenéis todas las cifras… Corred hacia el candado.',
    candado: 'Un viejo candado bloquea la salida… Introducid el código.',
    candado_error: 'Ese no es el código… Pensad bien.',
    candado_abierto: 'El candado cede… ¡La salida está abierta!',
    visto_1: '¡Os han visto!',
    visto_2: 'Cuidado… No entréis en su luz.',
    trampa: 'Una trampa… Usad la linterna para descubrirlas.',
    ultima_vida: 'Os queda una sola vida… Andad con mucho cuidado.',
    esperar: 'Falta vuestro compañero… Nadie sale de aquí solo.',
    nivel: 'Habéis escapado… pero la aventura no ha terminado.',
    victoria: 'Lo habéis conseguido… Sois libres. Por ahora.',
    derrota: 'Demasiado tarde… Os habéis quedado atrapados para siempre.',
};

export const urlFrase = (id) => `/audio/mansion/${id}.mp3`;

/** Frase para un suceso del juego (algunas tienen variantes). */
export function fraseDe(evento, extra = {}) {
    const al = (...ids) => ids[Math.floor(Math.random() * ids.length)];
    switch (evento) {
        case 'inicio': return extra.dual && extra.idx === 0 ? 'intro_dual' : `intro_${extra.id}`;
        case 'puerta': return al('puerta_1', 'puerta_2', 'puerta_3');
        case 'fallo': return al('fallo_1', 'fallo_2');
        case 'visto': return al('visto_1', 'visto_2');
        default: return FRASES[evento] ? evento : null;
    }
}
