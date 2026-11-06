// ═══════════════════════════════════════════════════════════════════
//  NARRADOR DEL ESCAPE ROOM
//  Frases fijas grabadas con antelación (scripts/generar-voces-escape.mjs → public/audio/escape/<id>.mp3)
//  y procesadas en el navegador para que suenen tenebrosas (comunes.jsx → audio.narrar).
//  Si se cambia un texto, hay que volver a grabar:  node scripts/generar-voces-escape.mjs --force
//  En inglés (NARRACION_EN → public/audio/escape/en/):  node scripts/generar-voces-escape.mjs --idioma=en --force
//  Los textos sirven también de subtítulos en la pantalla proyectada.
// ═══════════════════════════════════════════════════════════════════


import { esIngles } from './i18n.js';

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

export const NARRACION_EN = {
    bienvenida: 'Come in… if you dare. The mansion is waiting for you.',
    intro: 'Welcome to the zombie’s mansion… The door has slammed shut behind you! Down in the cellar… something is waking up. Go through the rooms, solve the challenges and open every lock. Each door will give you an amulet. Hurry… because when time runs out… he will come for you.',
    sala_1: 'The first door creaks in the darkness… Answer the questions correctly to charge its energy. Every mistake… feeds the ghosts.',
    sala_2: 'Another room awaits… The air is freezing, and something is watching you from the shadows. Concentrate… and don’t look back.',
    sala_3: 'Keep going… The candles are trembling. The closer you get to the cellar… the louder his footsteps sound.',
    ultima_sala: 'This is the last room… Beneath your feet, the zombie is already rising. There is no time to lose!',
    candado: 'The door is locked with an old padlock… Put the clues together and find the code. But be careful… every mistake steals your time.',
    candado_error: 'Wrong code… The clock is ticking faster.',
    abierta: 'The door slowly opens… You have won an amulet. Keep it safe… you are going to need it.',
    batalla: 'The zombie has woken up! All together… attack! Every right answer is a blow. If we fail… he will bite us.',
    agotado: 'Time is up… The zombie has woken up earlier than expected… and he is very… very hungry.',
    golpe_final: 'He is about to fall! One last blow!',
    victoria: 'The zombie has fallen… The mansion door finally opens. You have survived… for tonight. Happy Halloween!',
    derrota: 'Too late… The zombie has caught you. But he is still wounded… Do you dare to try again?',
};

/** Texto (subtítulo) y audio de una frase en el idioma del escape room. */
export const textoNarracion = (id) => (esIngles() ? NARRACION_EN[id] : NARRACION[id]);
export const urlNarracion = (id) => (esIngles() ? `/audio/escape/en/${id}.mp3` : `/audio/escape/${id}.mp3`);

/** Frase de entrada a una sala según su posición. */
export const narracionSala = (idx, total) => (idx === 0 ? 'sala_1' : idx >= total - 1 ? 'ultima_sala' : idx % 2 ? 'sala_2' : 'sala_3');
