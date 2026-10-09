// ═══════════════════════════════════════════════════════════════════
//  NARRADOR DEL ESCAPE ROOM
//  Frases fijas grabadas con antelación (scripts/generar-voces-escape.mjs → public/audio/escape/<id>.mp3)
//  y procesadas en el navegador para que suenen tenebrosas (comunes.jsx → audio.narrar).
//  Si se cambia un texto, hay que volver a grabar:  node scripts/generar-voces-escape.mjs --force
//  Los textos sirven también de subtítulos en la pantalla proyectada.
// ═══════════════════════════════════════════════════════════════════

export const NARRACION = {
    bienvenida: 'Entrad… si os atrevéis. La mansión os está esperando.',
    intro: 'Bienvenidos a la mansión del zombi… ¡La puerta se ha cerrado a vuestra espalda! En el sótano… algo está despertando. Recorred las salas, resolved los retos y abrid cada candado. Cada puerta os dará un amuleto. Daos prisa… porque cuando se acabe el tiempo… él vendrá a por vosotros.',
    sala_1: 'La primera puerta cruje en la oscuridad… Responded bien a las preguntas para cargar su energía. Cada fallo… alimenta a los fantasmas.',
    sala_2: 'Otra sala os espera… El aire está helado y algo os observa desde las sombras. Concentraos… y no miréis atrás.',
    sala_3: 'Seguid avanzando… Las velas tiemblan. Cuanto más os acercáis al sótano… más fuerte se oyen sus pasos.',
    ultima_sala: 'Esta es la última sala… Debajo de vuestros pies, el zombi ya se está levantando. ¡No tenéis tiempo que perder!',
    candado: 'La puerta está cerrada con un viejo candado… Juntad las pistas y descubrid el código. Pero cuidado… cada error os roba tiempo.',
    candado_error: 'Código incorrecto… El reloj corre más deprisa.',
    abierta: 'La puerta se abre lentamente… Habéis conseguido un amuleto. Guardadlo bien… lo vais a necesitar.',
    batalla: '¡El zombi ha despertado! ¡Todos juntos… atacad! Cada respuesta correcta es un golpe. Si fallamos… nos morderá.',
    agotado: 'Se acabó el tiempo… El zombi ha despertado antes de lo previsto… y está muy… muy hambriento.',
    golpe_final: '¡Está a punto de caer! ¡Un último golpe!',
    victoria: 'El zombi ha caído… La puerta de la mansión se abre por fin. Habéis sobrevivido… por esta noche. ¡Feliz Halloween!',
    derrota: 'Demasiado tarde… El zombi os ha atrapado. Pero todavía está herido… ¿Os atrevéis a intentarlo otra vez?',
};

export const urlNarracion = (id) => `/audio/escape/${id}.mp3`;

/** Frase de entrada a una sala según su posición. */
export const narracionSala = (idx, total) => (idx === 0 ? 'sala_1' : idx >= total - 1 ? 'ultima_sala' : idx % 2 ? 'sala_2' : 'sala_3');
