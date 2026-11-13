// ═══════════════════════════════════════════════════════════════════
//  PATIO DE JUEGOS — Ciencias Naturales y Geografía e Historia (Primaria)
//  Bancos propios de nivel Primaria (los de las fichas de Biología y
//  Geografía son de ESO e importan componentes grandes).
//  Mismo formato de pregunta que juegosPatio.js; enunciado extra:
//   · { tipo:'emoji', emoji, texto? } → dibujo grande + texto
// ═══════════════════════════════════════════════════════════════════
import { PERSONAJES_HISTORICOS, anioTexto } from '../personajesHistoricos';

const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const barajar = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const COLORES_OP = ['#ff5d73', '#3a86ff', '#2ec4b6', '#ff9f1c'];

// Pregunta de opciones de texto: correcta + distractores del pool
function preguntaOpc({ instruccion, enunciado, correcta, pool, explicacion, n = 4, fijas = null, etiquetas = {} }) {
    const ops = fijas || barajar([correcta, ...barajar([...new Set(pool)].filter(x => x !== correcta)).slice(0, n - 1)]);
    return {
        instruccion, enunciado, correcta, explicacion, ordenFijo: !!fijas,
        opciones: ops.map((v, i) => ({ v, label: etiquetas[v] || v, color: COLORES_OP[i % 4] })),
    };
}
const emoji = (e, texto) => ({ tipo: 'emoji', emoji: e, texto });
const texto = (t, grande = false) => ({ tipo: 'texto', texto: t, grande });
// Artículo correcto para animales y plantas femeninos («la vaca», no «el vaca»)
const FEMENINOS = new Set(['vaca', 'jirafa', 'oveja', 'ballena', 'gallina', 'tortuga', 'serpiente', 'rana', 'salamandra', 'trucha', 'mariposa', 'hormiga', 'abeja', 'mariquita', 'araña', 'gamba', 'lombriz de tierra', 'estrella de mar', 'palmera', 'margarita', 'amapola', 'águila']);
const elN = (n) => (n === 'águila' ? 'El águila' : FEMENINOS.has(n) ? `La ${n}` : `El ${n}`);

// ── CIENCIAS NATURALES ──────────────────────────────────────────────
const PARTES_CUERPO = [
    ['👁️', 'Ojo', 1], ['👂', 'Oreja', 1], ['👃', 'Nariz', 1], ['👄', 'Boca', 1], ['🦷', 'Diente', 1], ['✋', 'Mano', 1],
    ['🦶', 'Pie', 1], ['🦵', 'Pierna', 1], ['💪', 'Brazo', 1], ['👅', 'Lengua', 1],
    ['🧠', 'Cerebro', 2], ['🫀', 'Corazón', 2], ['🫁', 'Pulmones', 2], ['🦴', 'Hueso', 2],
];
const ZONAS_CUERPO = [
    ['codo', 'Extremidades'], ['rodilla', 'Extremidades'], ['tobillo', 'Extremidades'], ['muñeca', 'Extremidades'], ['dedos', 'Extremidades'], ['talón', 'Extremidades'],
    ['ombligo', 'Tronco'], ['pecho', 'Tronco'], ['espalda', 'Tronco'], ['cintura', 'Tronco'], ['barriga', 'Tronco'],
    ['frente', 'Cabeza'], ['mejilla', 'Cabeza'], ['barbilla', 'Cabeza'], ['cejas', 'Cabeza'], ['nuca', 'Cabeza'],
];
function cuerpo(curso) {
    if (curso >= 2 && Math.random() < 0.5) {
        const [p, z] = rnd(ZONAS_CUERPO);
        return preguntaOpc({ instruccion: '¿En qué parte del cuerpo está?', enunciado: texto(`${p[0].toUpperCase()}${p.slice(1)}`, true), correcta: z, fijas: ['Cabeza', 'Tronco', 'Extremidades'], explicacion: `${p[0].toUpperCase()}${p.slice(1)} → ${z.toLowerCase()}. El cuerpo tiene cabeza, tronco y extremidades.` });
    }
    const pool = PARTES_CUERPO.filter(x => x[2] <= (curso === 1 ? 1 : 2));
    const [e, nombre] = rnd(pool);
    return preguntaOpc({ instruccion: '¿Cómo se llama esta parte del cuerpo?', enunciado: emoji(e), correcta: nombre, pool: pool.map(x => x[1]), explicacion: `Se llama: ${nombre.toLowerCase()}.` });
}

const SENTIDOS = { Vista: ['👁️', 'los ojos'], Oído: ['👂', 'los oídos'], Olfato: ['👃', 'la nariz'], Gusto: ['👅', 'la lengua'], Tacto: ['✋', 'la piel'] };
const SITUACIONES = [
    ['🌸', 'Oler una flor', 'Olfato'], ['🎵', 'Escuchar música', 'Oído'], ['🌈', 'Ver un arcoíris', 'Vista'], ['🍦', 'Notar que el helado está frío', 'Tacto'],
    ['🍋', 'Notar que el limón es ácido', 'Gusto'], ['🔔', 'Oír el timbre', 'Oído'], ['📖', 'Leer un cuento', 'Vista'], ['🍞', 'Oler el pan recién hecho', 'Olfato'],
    ['🧶', 'Notar que la lana es suave', 'Tacto'], ['🍫', 'Notar que el chocolate es dulce', 'Gusto'], ['🐦', 'Escuchar a los pájaros', 'Oído'], ['🔥', 'Notar el calor del fuego', 'Tacto'],
];
const ETQ_SENTIDO = Object.fromEntries(Object.entries(SENTIDOS).map(([s, [e]]) => [s, `${e} ${s}`]));
function sentidos() {
    if (Math.random() < 0.35) {
        const s = rnd(Object.keys(SENTIDOS));
        const org = SENTIDOS[s][1];
        return preguntaOpc({ instruccion: `¿Qué órgano usamos para el sentido del ${s.toLowerCase()}?`, enunciado: emoji(SENTIDOS[s][0]), correcta: org, pool: Object.values(SENTIDOS).map(x => x[1]), explicacion: `El sentido del ${s.toLowerCase()} está en ${org}.` });
    }
    const [e, t, s] = rnd(SITUACIONES);
    return preguntaOpc({ instruccion: '¿Qué sentido usamos?', enunciado: emoji(e, t), correcta: s, pool: Object.keys(SENTIDOS), etiquetas: ETQ_SENTIDO, explicacion: `${t}: usamos el ${s.toLowerCase()} (${SENTIDOS[s][1]}).` });
}

// [emoji, nombre, grupo, alimentación|null, nacimiento|null]
const ANIMALES = [
    ['🐄', 'vaca', 'Mamífero', 'Herbívoro', 'Vivíparo'], ['🦁', 'león', 'Mamífero', 'Carnívoro', 'Vivíparo'], ['🐴', 'caballo', 'Mamífero', 'Herbívoro', 'Vivíparo'],
    ['🐰', 'conejo', 'Mamífero', 'Herbívoro', 'Vivíparo'], ['🐻', 'oso', 'Mamífero', 'Omnívoro', 'Vivíparo'], ['🐬', 'delfín', 'Mamífero', 'Carnívoro', 'Vivíparo'],
    ['🦒', 'jirafa', 'Mamífero', 'Herbívoro', 'Vivíparo'], ['🐘', 'elefante', 'Mamífero', 'Herbívoro', 'Vivíparo'], ['🐷', 'cerdo', 'Mamífero', 'Omnívoro', 'Vivíparo'],
    ['🐺', 'lobo', 'Mamífero', 'Carnívoro', 'Vivíparo'], ['🐯', 'tigre', 'Mamífero', 'Carnívoro', 'Vivíparo'], ['🐑', 'oveja', 'Mamífero', 'Herbívoro', 'Vivíparo'],
    ['🐋', 'ballena', 'Mamífero', 'Carnívoro', 'Vivíparo'], ['🦇', 'murciélago', 'Mamífero', null, 'Vivíparo'], ['🐒', 'mono', 'Mamífero', 'Omnívoro', 'Vivíparo'],
    ['🦅', 'águila', 'Ave', 'Carnívoro', 'Ovíparo'], ['🐧', 'pingüino', 'Ave', 'Carnívoro', 'Ovíparo'], ['🐔', 'gallina', 'Ave', 'Omnívoro', 'Ovíparo'],
    ['🦜', 'loro', 'Ave', 'Herbívoro', 'Ovíparo'], ['🦉', 'búho', 'Ave', 'Carnívoro', 'Ovíparo'], ['🦆', 'pato', 'Ave', 'Omnívoro', 'Ovíparo'],
    ['🐊', 'cocodrilo', 'Reptil', 'Carnívoro', 'Ovíparo'], ['🐢', 'tortuga', 'Reptil', null, 'Ovíparo'], ['🐍', 'serpiente', 'Reptil', 'Carnívoro', null],
    ['🦎', 'lagarto', 'Reptil', 'Carnívoro', 'Ovíparo'], ['🐸', 'rana', 'Anfibio', 'Carnívoro', 'Ovíparo'], ['🦎', 'salamandra', 'Anfibio', 'Carnívoro', null],
    ['🐟', 'trucha', 'Pez', 'Carnívoro', 'Ovíparo'], ['🦈', 'tiburón', 'Pez', 'Carnívoro', null], ['🐠', 'pez payaso', 'Pez', 'Omnívoro', 'Ovíparo'],
    ['🦋', 'mariposa', 'Insecto', 'Herbívoro', 'Ovíparo'], ['🐜', 'hormiga', 'Insecto', 'Omnívoro', 'Ovíparo'], ['🐝', 'abeja', 'Insecto', 'Herbívoro', 'Ovíparo'],
    ['🦗', 'saltamontes', 'Insecto', 'Herbívoro', 'Ovíparo'], ['🐞', 'mariquita', 'Insecto', 'Carnívoro', 'Ovíparo'], ['🕷️', 'araña', 'Arácnido', 'Carnívoro', 'Ovíparo'],
    ['🦂', 'escorpión', 'Arácnido', 'Carnívoro', null], ['🦀', 'cangrejo', 'Crustáceo', 'Omnívoro', 'Ovíparo'], ['🦐', 'gamba', 'Crustáceo', 'Omnívoro', 'Ovíparo'],
    ['🐌', 'caracol', 'Molusco', 'Herbívoro', 'Ovíparo'], ['🐙', 'pulpo', 'Molusco', 'Carnívoro', 'Ovíparo'], ['🪱', 'lombriz de tierra', 'Anélido', null, 'Ovíparo'],
    ['⭐', 'estrella de mar', 'Equinodermo', 'Carnívoro', 'Ovíparo'],
];
const VERTEBRADOS = ['Mamífero', 'Ave', 'Reptil', 'Anfibio', 'Pez'];
const INVERTEBRADOS = ['Insecto', 'Arácnido', 'Crustáceo', 'Molusco', 'Anélido', 'Equinodermo'];
const CUBIERTA = { Mamífero: 'Pelo', Ave: 'Plumas', Reptil: 'Escamas', Pez: 'Escamas', Anfibio: 'Piel desnuda' };
const ETQ_NAC = { Vivíparo: '🤰 Vivíparo (nace del vientre de su madre)', Ovíparo: '🥚 Ovíparo (nace de un huevo)' };
const ETQ_ALIM = { Herbívoro: '🌿 Herbívoro', Carnívoro: '🥩 Carnívoro', Omnívoro: '🍽️ Omnívoro' };

function animales(curso) {
    const tipos = curso === 1 ? ['alim', 'nac'] : curso === 2 ? ['alim', 'nac', 'vert'] : curso <= 4 ? ['grupoV', 'grupoV', 'vert', 'cubierta', 'nac'] : ['grupoV', 'grupoI', 'grupoI', 'vert'];
    const t = rnd(tipos);
    if (t === 'alim') {
        const [e, n, , a] = rnd(ANIMALES.filter(x => x[3] && VERTEBRADOS.includes(x[2])));
        return preguntaOpc({ instruccion: '¿Qué come este animal?', enunciado: emoji(e, n), correcta: a, fijas: ['Herbívoro', 'Carnívoro', 'Omnívoro'], etiquetas: ETQ_ALIM, explicacion: `${elN(n)} es ${a.toLowerCase()}: ${a === 'Herbívoro' ? 'come plantas' : a === 'Carnívoro' ? 'come otros animales' : 'come plantas y animales'}.` });
    }
    if (t === 'nac') {
        const [e, n, , , v] = rnd(ANIMALES.filter(x => x[4] && (curso <= 2 ? VERTEBRADOS.includes(x[2]) : true)));
        return preguntaOpc({ instruccion: '¿Cómo nace?', enunciado: emoji(e, n), correcta: v, fijas: ['Vivíparo', 'Ovíparo'], etiquetas: ETQ_NAC, explicacion: `${elN(n)} es ${v.toLowerCase()}.` });
    }
    if (t === 'vert') {
        const [e, n, g] = rnd(ANIMALES);
        const c = VERTEBRADOS.includes(g) ? 'Vertebrado' : 'Invertebrado';
        return preguntaOpc({ instruccion: '¿Tiene esqueleto con columna vertebral?', enunciado: emoji(e, n), correcta: c, fijas: ['Vertebrado', 'Invertebrado'], etiquetas: { Vertebrado: '🦴 Vertebrado', Invertebrado: '🐛 Invertebrado' }, explicacion: `${elN(n)} es ${c.toLowerCase()} (${g.toLowerCase()}).` });
    }
    if (t === 'cubierta') {
        const [e, n, g] = rnd(ANIMALES.filter(x => CUBIERTA[x[2]] && !['ballena', 'delfín'].includes(x[1])));
        return preguntaOpc({ instruccion: '¿Qué cubre su cuerpo?', enunciado: emoji(e, n), correcta: CUBIERTA[g], fijas: ['Pelo', 'Plumas', 'Escamas', 'Piel desnuda'], explicacion: `${elN(n)} es ${g === 'Ave' ? 'un ave' : `un ${g.toLowerCase()}`}: su cuerpo está cubierto de ${CUBIERTA[g].toLowerCase()}.` });
    }
    const grupos = t === 'grupoV' ? VERTEBRADOS : INVERTEBRADOS;
    const [e, n, g] = rnd(ANIMALES.filter(x => grupos.includes(x[2])));
    return preguntaOpc({ instruccion: '¿A qué grupo pertenece?', enunciado: emoji(e, n), correcta: g, pool: grupos, explicacion: `${elN(n)} es ${g === 'Ave' ? 'un ave' : `un ${g.toLowerCase()}`}.` });
}

const PARTES_PLANTA = [
    ['Raíz', 'Sujeta la planta al suelo y absorbe el agua y las sales minerales.'],
    ['Tallo', 'Sostiene la planta y lleva la savia de las raíces a las hojas.'],
    ['Hojas', 'Fabrican el alimento de la planta con la luz del Sol (fotosíntesis).'],
    ['Flor', 'Es la parte de la planta que sirve para reproducirse.'],
    ['Fruto', 'Protege las semillas.'],
    ['Semilla', 'Si la plantamos, de ella nace una planta nueva.'],
];
const TIPOS_PLANTA = [
    ['🌲', 'pino', 'Árbol'], ['🫒', 'olivo', 'Árbol'], ['🌳', 'roble', 'Árbol'], ['🍎', 'manzano', 'Árbol'], ['🌴', 'palmera', 'Árbol'],
    ['🌹', 'rosal', 'Arbusto'], ['🌿', 'romero', 'Arbusto'], ['🪴', 'boj', 'Arbusto'],
    ['🌾', 'trigo', 'Hierba'], ['🌼', 'margarita', 'Hierba'], ['🌺', 'amapola', 'Hierba'], ['🟩', 'césped', 'Hierba'],
];
const DEF_TIPO = { Árbol: 'tallo leñoso y grueso (tronco) y ramas a cierta altura', Arbusto: 'tallo leñoso con ramas desde el suelo', Hierba: 'tallo fino, verde y flexible' };
function plantas(curso) {
    if (curso <= 4 && Math.random() < 0.4) {
        const [e, n, t] = rnd(TIPOS_PLANTA);
        return preguntaOpc({ instruccion: '¿Qué tipo de planta es?', enunciado: emoji(e, n), correcta: t, fijas: ['Árbol', 'Arbusto', 'Hierba'], explicacion: `${elN(n)} es ${t === 'Hierba' ? 'una hierba' : `un ${t.toLowerCase()}`}: ${DEF_TIPO[t]}.` });
    }
    if (curso >= 4 && Math.random() < 0.3) {
        const q = rnd([
            ['¿Qué gas toman las plantas del aire para hacer la fotosíntesis?', 'Dióxido de carbono', ['Oxígeno', 'Nitrógeno', 'Vapor de agua']],
            ['¿Qué gas expulsan las plantas al hacer la fotosíntesis?', 'Oxígeno', ['Dióxido de carbono', 'Nitrógeno', 'Humo']],
            ['¿Qué necesitan las hojas para fabricar el alimento?', 'Luz del Sol', ['Oscuridad', 'Música', 'Viento']],
            ['¿Cómo se llama el líquido que circula por el tallo?', 'Savia', ['Sangre', 'Néctar', 'Resina']],
            ['¿Qué sustancia verde de las hojas capta la luz?', 'Clorofila', ['Savia', 'Polen', 'Almidón']],
        ]);
        return preguntaOpc({ instruccion: 'Las plantas', enunciado: texto(q[0]), correcta: q[1], pool: q[2], explicacion: `La respuesta es: ${q[1]}.` });
    }
    const [parte, funcion] = rnd(PARTES_PLANTA);
    return preguntaOpc({ instruccion: '¿Qué parte de la planta es?', enunciado: emoji('🌱', funcion), correcta: parte, pool: PARTES_PLANTA.map(p => p[0]), explicacion: `${parte}: ${funcion}` });
}

const SERES = [
    ['🌻', 'girasol', true], ['🪨', 'piedra', false], ['🐟', 'pez', true], ['💧', 'agua', false], ['🌳', 'árbol', true], ['🚗', 'coche', false],
    ['🍄', 'seta', true], ['☀️', 'Sol', false], ['🐛', 'oruga', true], ['🧸', 'osito de peluche', false], ['🌵', 'cactus', true], ['🔥', 'fuego', false],
    ['🐦', 'pájaro', true], ['🏠', 'casa', false], ['👧', 'niña', true], ['🤖', 'robot', false], ['🐌', 'caracol', true], ['☁️', 'nube', false],
];
const FUNCIONES_VITALES = [
    ['Una vaca come hierba', 'Nutrición'], ['Respiramos el aire', 'Nutrición'], ['Una planta absorbe agua por la raíz', 'Nutrición'],
    ['Un gato huye al ver un perro', 'Relación'], ['Un girasol gira hacia el Sol', 'Relación'], ['Retiramos la mano del fuego', 'Relación'],
    ['Una gallina pone huevos', 'Reproducción'], ['De una semilla nace una planta', 'Reproducción'], ['Una gata tiene gatitos', 'Reproducción'],
];
function seresVivos(curso) {
    if (curso >= 3 && Math.random() < 0.6) {
        const [t, f] = rnd(FUNCIONES_VITALES);
        return preguntaOpc({ instruccion: '¿Qué función vital es?', enunciado: texto(t, true), correcta: f, fijas: ['Nutrición', 'Relación', 'Reproducción'], explicacion: `${t}: es una función de ${f.toLowerCase()}. Los seres vivos nacen, se nutren, se relacionan, se reproducen y mueren.` });
    }
    const [e, n, vivo] = rnd(SERES);
    return preguntaOpc({ instruccion: '¿Es un ser vivo?', enunciado: emoji(e, n), correcta: vivo ? 'Ser vivo' : 'Ser inerte', fijas: ['Ser vivo', 'Ser inerte'], etiquetas: { 'Ser vivo': '🌱 Ser vivo', 'Ser inerte': '🪨 No es un ser vivo' }, explicacion: vivo ? `«${n}» nace, se alimenta, crece, se reproduce y muere: es un ser vivo.` : `«${n}» no nace, no se alimenta ni se reproduce: no es un ser vivo.` });
}

const APARATOS_ORG = [
    ['estómago', 'Digestivo'], ['intestino delgado', 'Digestivo'], ['hígado', 'Digestivo'], ['esófago', 'Digestivo'],
    ['pulmones', 'Respiratorio'], ['tráquea', 'Respiratorio'], ['bronquios', 'Respiratorio'],
    ['corazón', 'Circulatorio'], ['venas', 'Circulatorio'], ['arterias', 'Circulatorio'],
    ['riñones', 'Excretor'], ['vejiga', 'Excretor'],
    ['cerebro', 'Nervioso'], ['médula espinal', 'Nervioso'], ['nervios', 'Nervioso'],
    ['huesos', 'Locomotor'], ['músculos', 'Locomotor'], ['articulaciones', 'Locomotor'],
];
const APARATOS_FUN = [
    ['Transforma los alimentos en nutrientes', 'Digestivo'], ['Toma el oxígeno del aire y expulsa el dióxido de carbono', 'Respiratorio'],
    ['Lleva la sangre por todo el cuerpo', 'Circulatorio'], ['Limpia la sangre y elimina los desechos en la orina', 'Excretor'],
    ['Recibe la información de los sentidos y da órdenes al cuerpo', 'Nervioso'], ['Permite el movimiento con huesos y músculos', 'Locomotor'],
    ['Permite tener descendientes', 'Reproductor'],
];
const NOMBRES_AP = ['Digestivo', 'Respiratorio', 'Circulatorio', 'Excretor', 'Nervioso', 'Locomotor', 'Reproductor'];
function aparatos() {
    if (Math.random() < 0.5) {
        const [f, a] = rnd(APARATOS_FUN);
        return preguntaOpc({ instruccion: '¿Qué aparato o sistema es?', enunciado: texto(f), correcta: a, pool: NOMBRES_AP, explicacion: `${f}: aparato ${a.toLowerCase()}.` });
    }
    const [o, a] = rnd(APARATOS_ORG);
    return preguntaOpc({ instruccion: '¿A qué aparato o sistema pertenece?', enunciado: texto(`${o[0].toUpperCase()}${o.slice(1)}`, true), correcta: a, pool: NOMBRES_AP.filter(x => x !== 'Reproductor'), explicacion: `${o[0].toUpperCase()}${o.slice(1)} → ${['Nervioso', 'Locomotor'].includes(a) ? 'sistema' : 'aparato'} ${a.toLowerCase()}.` });
}

// ── GEOGRAFÍA E HISTORIA ────────────────────────────────────────────
const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const ESTACIONES = [
    ['¿En qué estación hace más calor?', 'Verano'], ['¿En qué estación hace más frío?', 'Invierno'],
    ['¿En qué estación se caen las hojas de muchos árboles?', 'Otoño'], ['¿En qué estación florecen muchas plantas?', 'Primavera'],
    ['¿En qué estación es la Navidad en España?', 'Invierno'], ['¿En qué estación empiezan las vacaciones largas de verano?', 'Verano'],
];
function tiempo() {
    const t = rnd(['dia', 'mes', 'estacion', 'cuantos']);
    if (t === 'dia') {
        const i = Math.floor(Math.random() * 7), desp = Math.random() < 0.6;
        const c = DIAS[(i + (desp ? 1 : 6)) % 7];
        return preguntaOpc({ instruccion: 'Los días de la semana', enunciado: texto(`¿Qué día va ${desp ? 'después' : 'antes'} del ${DIAS[i]}?`), correcta: c, pool: DIAS.filter(d => d !== DIAS[i]), explicacion: `${DIAS.join(', ')}.` });
    }
    if (t === 'mes') {
        const i = Math.floor(Math.random() * 12), desp = Math.random() < 0.6;
        const c = MESES[(i + (desp ? 1 : 11)) % 12];
        return preguntaOpc({ instruccion: 'Los meses del año', enunciado: texto(`¿Qué mes va ${desp ? 'después' : 'antes'} de ${MESES[i]}?`), correcta: c, pool: MESES.filter(m => m !== MESES[i]), explicacion: `El orden es: ${MESES.slice(Math.max(0, i - 1), i + 2).join(', ')}…` });
    }
    if (t === 'estacion') {
        const [p, c] = rnd(ESTACIONES);
        return preguntaOpc({ instruccion: 'Las estaciones', enunciado: texto(p), correcta: c, fijas: ['Primavera', 'Verano', 'Otoño', 'Invierno'], etiquetas: { Primavera: '🌷 Primavera', Verano: '☀️ Verano', Otoño: '🍂 Otoño', Invierno: '❄️ Invierno' }, explicacion: `${c}.` });
    }
    const [p, c, pool] = rnd([
        ['¿Cuántos días tiene una semana?', '7', ['5', '6', '10']], ['¿Cuántos meses tiene un año?', '12', ['10', '11', '7']],
        ['¿Cuántas estaciones tiene el año?', '4', ['2', '3', '5']], ['¿Cuántas horas tiene un día?', '24', ['12', '20', '60']],
        ['¿Cuántos minutos tiene una hora?', '60', ['24', '100', '30']], ['¿Cuántos días tiene el mes de febrero (si no es bisiesto)?', '28', ['30', '31', '29']],
    ]);
    return preguntaOpc({ instruccion: 'Medimos el tiempo', enunciado: texto(p, true), correcta: c, pool, explicacion: `La respuesta es ${c}.` });
}

const RELIEVE = [
    ['⛰️', 'Montaña', 'Gran elevación del terreno.', 1], ['🏞️', 'Río', 'Corriente de agua que desemboca en el mar, en un lago o en otro río.', 1],
    ['🌊', 'Lago', 'Gran masa de agua rodeada de tierra.', 1], ['🏝️', 'Isla', 'Porción de tierra rodeada de agua por todas partes.', 1],
    ['🏖️', 'Playa', 'Orilla del mar cubierta de arena.', 1], ['🏕️', 'Valle', 'Terreno llano entre montañas.', 1],
    ['🗺️', 'Península', 'Tierra rodeada de agua por todas partes menos por una.', 3], ['🪨', 'Cabo', 'Parte de tierra que entra en el mar.', 3],
    ['🌊', 'Golfo', 'Parte del mar que entra en la tierra.', 3], ['🌾', 'Llanura', 'Terreno extenso y llano, a poca altura.', 3],
    ['🏜️', 'Meseta', 'Llanura elevada sobre el nivel del mar.', 3], ['🧗', 'Acantilado', 'Costa alta y cortada casi en vertical.', 3],
    ['🏔️', 'Cordillera', 'Conjunto de montañas unidas.', 3],
];
function relieve(curso) {
    const pool = RELIEVE.filter(r => r[3] <= (curso <= 2 ? 1 : 3));
    const [e, n, d] = rnd(pool);
    return preguntaOpc({ instruccion: '¿Qué es?', enunciado: emoji(e, d), correcta: n, pool: pool.map(r => r[1]), explicacion: `${n}: ${d}` });
}

const ORIENTACION = [
    ['¿Por dónde sale el Sol?', 'Este'], ['¿Por dónde se pone el Sol?', 'Oeste'], ['¿Qué punto cardinal es el contrario del Norte?', 'Sur'],
    ['¿Qué punto cardinal es el contrario del Este?', 'Oeste'], ['La aguja de la brújula siempre señala el…', 'Norte'],
    ['Si miras al Norte, a tu derecha está el…', 'Este'], ['Si miras al Norte, a tu izquierda está el…', 'Oeste'], ['Si miras al Norte, a tu espalda está el…', 'Sur'],
];
const REPRESENTACION = [
    ['Instrumento con una aguja que sirve para orientarse', 'Brújula'], ['Representación de la Tierra en forma de esfera', 'Globo terráqueo'],
    ['Dibujo de la Tierra o de una parte de ella sobre una superficie plana', 'Mapa'], ['Dibujo de un lugar pequeño (una casa, el colegio) visto desde arriba', 'Plano'],
];
function orientacion() {
    if (Math.random() < 0.3) {
        const [d, c] = rnd(REPRESENTACION);
        return preguntaOpc({ instruccion: '¿Qué es?', enunciado: texto(d), correcta: c, fijas: barajar(REPRESENTACION.map(r => r[1])), explicacion: `${c}: ${d.toLowerCase()}.` });
    }
    const [p, c] = rnd(ORIENTACION);
    return preguntaOpc({ instruccion: 'Los puntos cardinales 🧭', enunciado: texto(p), correcta: c, fijas: ['Norte', 'Sur', 'Este', 'Oeste'], etiquetas: { Norte: '⬆️ Norte', Sur: '⬇️ Sur', Este: '➡️ Este', Oeste: '⬅️ Oeste' }, explicacion: `${c}. El Sol sale por el Este y se pone por el Oeste.` });
}

const PAISES = [
    ['🇪🇸', 'España', 'Europa'], ['🇫🇷', 'Francia', 'Europa'], ['🇮🇹', 'Italia', 'Europa'], ['🇩🇪', 'Alemania', 'Europa'], ['🇵🇹', 'Portugal', 'Europa'],
    ['🇪🇬', 'Egipto', 'África'], ['🇲🇦', 'Marruecos', 'África'], ['🇰🇪', 'Kenia', 'África'], ['🇳🇬', 'Nigeria', 'África'],
    ['🇧🇷', 'Brasil', 'América'], ['🇲🇽', 'México', 'América'], ['🇦🇷', 'Argentina', 'América'], ['🇨🇦', 'Canadá', 'América'], ['🇺🇸', 'Estados Unidos', 'América'],
    ['🇨🇳', 'China', 'Asia'], ['🇯🇵', 'Japón', 'Asia'], ['🇮🇳', 'India', 'Asia'],
    ['🇦🇺', 'Australia', 'Oceanía'], ['🇳🇿', 'Nueva Zelanda', 'Oceanía'],
];
const MUNDO = [
    ['¿Cuál es el océano más grande?', 'Pacífico', ['Atlántico', 'Índico', 'Glacial Ártico']],
    ['¿Qué océano está entre Europa y América?', 'Atlántico', ['Pacífico', 'Índico', 'Glacial Ártico']],
    ['¿Cómo se llama el continente helado del Polo Sur?', 'Antártida', ['Oceanía', 'Groenlandia', 'Ártico']],
    ['¿Cómo se llama nuestro planeta?', 'Tierra', ['Marte', 'Luna', 'Sol']],
    ['¿En qué continente está el desierto del Sáhara?', 'África', ['Asia', 'América', 'Oceanía']],
];
const ESPANA = [
    ['¿Cuál es la montaña más alta de España?', 'Teide', ['Mulhacén', 'Aneto', 'Moncayo']],
    ['¿Qué cordillera separa España de Francia?', 'Pirineos', ['Sistema Central', 'Cordillera Cantábrica', 'Sierra Morena']],
    ['¿Qué mar baña el este de España?', 'Mediterráneo', ['Cantábrico', 'Rojo', 'Caribe']],
    ['¿Qué mar baña el norte de España?', 'Cantábrico', ['Mediterráneo', 'Báltico', 'Negro']],
    ['¿Cuál es el río más largo de la península ibérica?', 'Tajo', ['Ebro', 'Duero', 'Guadalquivir']],
    ['¿Qué río pasa por Sevilla?', 'Guadalquivir', ['Tajo', 'Ebro', 'Miño']],
    ['¿Qué río pasa por Zaragoza?', 'Ebro', ['Duero', 'Guadiana', 'Júcar']],
    ['¿Cuál es la capital de España?', 'Madrid', ['Barcelona', 'Sevilla', 'Valencia']],
    ['¿En qué océano están las islas Canarias?', 'Atlántico', ['Pacífico', 'Índico', 'Mediterráneo']],
    ['¿Cómo se llama la gran llanura elevada del centro de la península?', 'Meseta Central', ['Valle del Ebro', 'Pirineos', 'Delta del Ebro']],
];
function mundo(curso) {
    if (curso >= 5 && Math.random() < 0.55) {
        const [p, c, pool] = rnd(ESPANA);
        return preguntaOpc({ instruccion: 'Geografía de España 🇪🇸', enunciado: texto(p), correcta: c, pool, explicacion: `${c}.` });
    }
    if (Math.random() < 0.6) {
        const [e, n, c] = rnd(PAISES);
        return preguntaOpc({ instruccion: '¿En qué continente está?', enunciado: emoji(e, n), correcta: c, pool: ['Europa', 'África', 'América', 'Asia', 'Oceanía'], explicacion: `${n} está en ${c}.` });
    }
    const [p, c, pool] = rnd(MUNDO);
    return preguntaOpc({ instruccion: 'El planeta Tierra 🌍', enunciado: texto(p), correcta: c, pool, explicacion: `${c}.` });
}

const CCAA = [
    ['Andalucía', 'Sevilla'], ['Aragón', 'Zaragoza'], ['Asturias', 'Oviedo'], ['Islas Baleares', 'Palma'], ['Cantabria', 'Santander'],
    ['Castilla-La Mancha', 'Toledo'], ['Castilla y León', 'Valladolid'], ['Cataluña', 'Barcelona'], ['Comunidad Valenciana', 'Valencia'],
    ['Extremadura', 'Mérida'], ['Galicia', 'Santiago de Compostela'], ['Comunidad de Madrid', 'Madrid'], ['Región de Murcia', 'Murcia'],
    ['Navarra', 'Pamplona'], ['País Vasco', 'Vitoria-Gasteiz'], ['La Rioja', 'Logroño'],
];
const PROVINCIAS = [
    ['Almería', 'Andalucía'], ['Cádiz', 'Andalucía'], ['Córdoba', 'Andalucía'], ['Granada', 'Andalucía'], ['Huelva', 'Andalucía'], ['Jaén', 'Andalucía'], ['Málaga', 'Andalucía'],
    ['Huesca', 'Aragón'], ['Teruel', 'Aragón'], ['Albacete', 'Castilla-La Mancha'], ['Ciudad Real', 'Castilla-La Mancha'], ['Cuenca', 'Castilla-La Mancha'], ['Guadalajara', 'Castilla-La Mancha'],
    ['Ávila', 'Castilla y León'], ['Burgos', 'Castilla y León'], ['León', 'Castilla y León'], ['Palencia', 'Castilla y León'], ['Salamanca', 'Castilla y León'], ['Segovia', 'Castilla y León'], ['Soria', 'Castilla y León'], ['Zamora', 'Castilla y León'],
    ['Girona', 'Cataluña'], ['Lleida', 'Cataluña'], ['Tarragona', 'Cataluña'], ['Alicante', 'Comunidad Valenciana'], ['Castellón', 'Comunidad Valenciana'],
    ['Badajoz', 'Extremadura'], ['Cáceres', 'Extremadura'], ['A Coruña', 'Galicia'], ['Lugo', 'Galicia'], ['Ourense', 'Galicia'], ['Pontevedra', 'Galicia'],
    ['Álava', 'País Vasco'], ['Gipuzkoa', 'País Vasco'], ['Bizkaia', 'País Vasco'], ['Las Palmas', 'Canarias'], ['Santa Cruz de Tenerife', 'Canarias'],
];
const NOMBRES_CCAA = [...CCAA.map(c => c[0]), 'Canarias'];
function comunidades(curso) {
    if (curso >= 6 && Math.random() < 0.5) {
        const [p, c] = rnd(PROVINCIAS);
        return preguntaOpc({ instruccion: '¿En qué comunidad autónoma está la provincia?', enunciado: texto(p, true), correcta: c, pool: NOMBRES_CCAA, explicacion: `La provincia de ${p} está en ${c}.` });
    }
    const [c, cap] = rnd(CCAA);
    return preguntaOpc({ instruccion: '¿Cuál es la capital de la comunidad autónoma?', enunciado: texto(c, true), correcta: cap, pool: CCAA.map(x => x[1]), explicacion: `La capital de ${c} es ${cap}.` });
}

const EDADES = ['Prehistoria', 'Edad Antigua', 'Edad Media', 'Edad Moderna', 'Edad Contemporánea'];
const HECHOS = [
    ['Los seres humanos aún no conocían la escritura', 'Prehistoria'], ['Se pintaron las cuevas de Altamira', 'Prehistoria'],
    ['Las personas eran nómadas y vivían de la caza y la recolección', 'Prehistoria'], ['Empezaron la agricultura y la ganadería (Neolítico)', 'Prehistoria'],
    ['Comienza con la invención de la escritura', 'Edad Antigua'], ['Los egipcios construyeron las pirámides', 'Edad Antigua'],
    ['Los romanos construyeron acueductos y calzadas', 'Edad Antigua'], ['Los griegos celebraron los primeros Juegos Olímpicos', 'Edad Antigua'],
    ['Comienza con la caída del Imperio romano de Occidente (año 476)', 'Edad Media'], ['Se construyeron castillos y catedrales', 'Edad Media'],
    ['Había caballeros, señores feudales y campesinos', 'Edad Media'],
    ['Comienza con la llegada de Colón a América (1492)', 'Edad Moderna'], ['Magallanes y Elcano dieron la primera vuelta al mundo', 'Edad Moderna'],
    ['Cervantes escribió el Quijote', 'Edad Moderna'],
    ['Comienza con la Revolución francesa (1789)', 'Edad Contemporánea'], ['Se inventaron el teléfono y el avión', 'Edad Contemporánea'],
    ['Una persona pisó la Luna por primera vez', 'Edad Contemporánea'], ['Es la edad en la que vivimos ahora', 'Edad Contemporánea'],
];
// Solo personajes conocidos en Primaria, con su edad fijada a mano
// (se dejan fuera los que vivieron justo en un cambio de edad: Reyes Católicos, Colón, Leonardo, Goya…)
const EDAD_CONOCIDOS = {
    'Edad Antigua': ['julio-cesar', 'alejandro-magno', 'cleopatra', 'augusto', 'tutankamon', 'ramses-ii', 'arquimedes', 'pitagoras', 'aristoteles'],
    'Edad Media': ['carlomagno', 'gengis-kan', 'juana-de-arco'],
    'Edad Moderna': ['carlos-v', 'felipe-ii', 'miguelangel', 'velazquez', 'cervantes', 'shakespeare', 'galileo', 'newton', 'copernico', 'mozart'],
    'Edad Contemporánea': ['napoleon', 'lincoln', 'gandhi', 'mandela', 'bolivar', 'picasso', 'vangogh', 'dali', 'frida', 'beethoven', 'lorca', 'gaudi', 'einstein', 'curie', 'darwin', 'edison', 'fleming', 'cajal'],
};
const PERSONAJES_EDAD = Object.entries(EDAD_CONOCIDOS).flatMap(([edad, ids]) => ids.map(id => [PERSONAJES_HISTORICOS.find(p => p.id === id), edad])).filter(([p]) => p);
function historia(curso) {
    const t = rnd(curso >= 5 && PERSONAJES_EDAD.length ? ['hecho', 'orden', 'personaje', 'personaje'] : ['hecho', 'hecho', 'orden']);
    if (t === 'orden') {
        const i = 1 + Math.floor(Math.random() * 3), desp = Math.random() < 0.5;
        const c = EDADES[desp ? i + 1 : i - 1];
        return preguntaOpc({ instruccion: 'Las edades de la historia', enunciado: texto(`¿Qué etapa va ${desp ? 'después' : 'antes'} de la ${EDADES[i]}?`), correcta: c, pool: EDADES.filter(e => e !== EDADES[i]), explicacion: EDADES.join(' → ') });
    }
    if (t === 'personaje') {
        const [p, e] = rnd(PERSONAJES_EDAD);
        return preguntaOpc({ instruccion: '¿En qué edad de la historia vivió?', enunciado: texto(`${p.nombre}\n(${p.campo}, nació en ${anioTexto(p.nac)})`, true), correcta: e, fijas: EDADES.slice(1), explicacion: `${p.nombre} vivió en la ${e}.` });
    }
    const [h, e] = rnd(HECHOS);
    return preguntaOpc({ instruccion: '¿En qué etapa de la historia ocurrió?', enunciado: texto(h), correcta: e, fijas: EDADES, explicacion: `${h}: ${e}.` });
}

// ── LOS ROMANOS ─────────────────────────────────────────────────────
// [pregunta, correcta, distractores]
const ROMANOS = [
    ['¿En qué ciudad nació el Imperio romano?', 'Roma', ['Atenas', 'Cartago', 'Alejandría']],
    ['¿Qué nombre dieron los romanos a la península ibérica?', 'Hispania', ['Galia', 'Al-Ándalus', 'Britania']],
    ['¿Qué idioma hablaban los romanos?', 'Latín', ['Griego', 'Árabe', 'Íbero']],
    ['¿De qué lengua vienen el castellano, el catalán y el gallego?', 'Latín', ['Árabe', 'Griego', 'Inglés']],
    ['¿Qué pueblos vivían en la península antes de que llegaran los romanos?', 'Íberos y celtas', ['Árabes y visigodos', 'Aztecas e incas', 'Vikingos y francos']],
    ['¿Qué ciudad celtíbera resistió a los romanos hasta el final?', 'Numancia', ['Toledo', 'Córdoba', 'Cádiz']],
    ['¿Cómo se llama la construcción romana que llevaba el agua a las ciudades?', 'Acueducto', ['Anfiteatro', 'Calzada', 'Muralla']],
    ['¿En qué ciudad está el acueducto romano más famoso de España?', 'Segovia', ['Sevilla', 'Bilbao', 'Valencia']],
    ['¿Cómo se llamaban los caminos de piedra que unían las ciudades romanas?', 'Calzadas', ['Acueductos', 'Termas', 'Foros']],
    ['¿Cómo se llamaban los baños públicos romanos?', 'Termas', ['Foro', 'Circo', 'Teatro']],
    ['¿Cómo se llamaba la plaza principal de una ciudad romana, con templos y mercado?', 'Foro', ['Circo', 'Anfiteatro', 'Termas']],
    ['¿En qué edificio se hacían las carreras de carros?', 'Circo', ['Teatro', 'Termas', 'Foro']],
    ['¿En qué edificio luchaban los gladiadores?', 'Anfiteatro', ['Teatro', 'Termas', 'Acueducto']],
    ['¿Cómo se llama el anfiteatro más famoso de Roma?', 'Coliseo', ['Partenón', 'Alhambra', 'Pirámide de Keops']],
    ['¿En qué ciudad española hay un gran teatro romano que todavía se usa?', 'Mérida', ['Toledo', 'Burgos', 'Oviedo']],
    ['¿Quién fue el primer emperador de Roma?', 'Augusto', ['Julio César', 'Nerón', 'Carlomagno']],
    ['¿Qué emperador romano nació en Hispania, en la ciudad de Itálica?', 'Trajano', ['Nerón', 'Calígula', 'Augusto']],
    ['¿Cómo se llamaban las grandes unidades del ejército romano?', 'Legiones', ['Tribus', 'Gremios', 'Califatos']],
    ['¿Qué religión se convirtió en la oficial del Imperio romano al final?', 'Cristianismo', ['Islam', 'Budismo', 'Hinduismo']],
    ['¿En qué año cayó el Imperio romano de Occidente?', '476', ['1492', '711', '1789']],
];
const VALORES_ROMANOS = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
const aRomano = (n) => VALORES_ROMANOS.reduce((s, [v, r]) => { while (n >= v) { s += r; n -= v; } return s; }, '');
function numeroRomano(curso) {
    const max = curso <= 4 ? 40 : curso === 5 ? 100 : 1000;
    const n = 1 + Math.floor(Math.random() * max);
    const cerca = [n + 1, n - 1, n + 10, n - 10, n + 5, n - 5, n + 50].filter(x => x > 0 && x !== n);
    const ops = barajar([n, ...barajar([...new Set(cerca)]).slice(0, 3)]);
    return {
        instruccion: '¿Qué número es en números romanos?', enunciado: texto(aRomano(n), true), correcta: n,
        opciones: ops.map((v, i) => ({ v, label: String(v), color: COLORES_OP[i] })),
        explicacion: `${aRomano(n)} = ${n}. I=1, V=5, X=10, L=50, C=100, D=500, M=1000.`,
    };
}
function romanos(curso) {
    if (Math.random() < 0.3) return numeroRomano(curso);
    const [p, c, pool] = rnd(ROMANOS);
    return preguntaOpc({ instruccion: 'Los romanos 🏛️', enunciado: texto(p), correcta: c, pool, explicacion: `${c}.` });
}

// ── LA EDAD MEDIA ───────────────────────────────────────────────────
const MEDIEVAL = [
    ['¿Qué pueblo germánico se instaló en Hispania después de los romanos?', 'Visigodos', ['Vikingos', 'Fenicios', 'Aztecas']],
    ['¿Cuál fue la capital del reino visigodo?', 'Toledo', ['Madrid', 'Barcelona', 'Córdoba']],
    ['¿En qué año llegaron los musulmanes a la península ibérica?', '711', ['476', '1492', '1212']],
    ['¿Cómo llamaron los musulmanes al territorio que gobernaban en la península?', 'Al-Ándalus', ['Hispania', 'Castilla', 'Aragón']],
    ['¿Qué ciudad fue la capital del Califato de Córdoba?', 'Córdoba', ['Toledo', 'Sevilla', 'León']],
    ['¿Qué famoso palacio musulmán está en Granada?', 'La Alhambra', ['El Escorial', 'El Coliseo', 'La Sagrada Familia']],
    ['¿Qué gran monumento musulmán está en Córdoba?', 'La Mezquita', ['El Acueducto', 'La Alhambra', 'El Escorial']],
    ['¿Qué rey cristiano venció a los musulmanes en la batalla de Covadonga?', 'Don Pelayo', ['Boabdil', 'Alfonso X', 'Carlos V']],
    ['¿Cómo se llamaba el Cid Campeador?', 'Rodrigo Díaz de Vivar', ['Alfonso X el Sabio', 'Don Pelayo', 'Boabdil']],
    ['¿Quién fue el último rey musulmán de Granada?', 'Boabdil', ['Abderramán III', 'Don Pelayo', 'Almanzor']],
    ['¿Qué rey de Castilla, llamado «el Sabio», impulsó el castellano?', 'Alfonso X', ['Don Pelayo', 'Felipe II', 'Carlomagno']],
    ['¿En qué año terminó la Reconquista con la toma de Granada?', '1492', ['711', '1212', '1789']],
    ['¿Quiénes conquistaron Granada en 1492?', 'Los Reyes Católicos', ['Carlos V y Felipe II', 'Los visigodos', 'Los romanos']],
    ['¿Cómo se llamaban las tierras que un rey daba a un señor feudal?', 'Feudo', ['Califato', 'Provincia', 'Colonia']],
    ['¿Cómo se llamaban las asociaciones de artesanos de un mismo oficio?', 'Gremios', ['Legiones', 'Feudos', 'Califatos']],
    ['¿Qué edificio con murallas, torres y foso servía para defenderse?', 'Castillo', ['Monasterio', 'Acueducto', 'Mezquita']],
    ['¿Dónde vivían y rezaban los monjes?', 'Monasterio', ['Castillo', 'Foro', 'Gremio']],
    ['¿Qué estilo tiene muros gruesos, arcos de medio punto y pocas ventanas?', 'Románico', ['Gótico', 'Barroco', 'Moderno']],
    ['¿Qué estilo tiene arcos apuntados, grandes vidrieras y edificios muy altos?', 'Gótico', ['Románico', 'Barroco', 'Moderno']],
    ['¿Qué enfermedad mató a muchísimas personas en Europa en el siglo XIV?', 'La peste negra', ['La gripe', 'El sarampión', 'La varicela']],
    ['¿Qué camino de peregrinación medieval llega hasta Galicia?', 'El Camino de Santiago', ['La Ruta de la Seda', 'La Vía Láctea', 'El Camino Real']],
];
const ESTAMENTOS = [
    ['Rezaban, cuidaban la cultura y vivían en iglesias y monasterios', 'Clero'],
    ['Guerreaban, tenían tierras y vivían en castillos', 'Nobleza'],
    ['Era el grupo más numeroso y trabajaba la tierra', 'Campesinos'],
    ['Los obispos, los abades y los monjes pertenecían a este grupo', 'Clero'],
    ['Los caballeros, los condes y los duques pertenecían a este grupo', 'Nobleza'],
    ['Pagaban impuestos al señor y le entregaban parte de la cosecha', 'Campesinos'],
];
function edadMedia() {
    if (Math.random() < 0.25) {
        const [d, c] = rnd(ESTAMENTOS);
        return preguntaOpc({ instruccion: 'La sociedad medieval: ¿qué grupo es?', enunciado: texto(d), correcta: c, fijas: ['Nobleza', 'Clero', 'Campesinos'], etiquetas: { Nobleza: '⚔️ Nobleza', Clero: '⛪ Clero', Campesinos: '🌾 Campesinos' }, explicacion: `${c}. La sociedad medieval se dividía en nobleza, clero y campesinos.` });
    }
    const [p, c, pool] = rnd(MEDIEVAL);
    return preguntaOpc({ instruccion: 'La Edad Media 🏰', enunciado: texto(p), correcta: c, pool, explicacion: `${c}.` });
}

export const JUEGOS_CIENCIAS = [
    // Ciencias Naturales
    { id: 'cuerpo', materia: 'naturales', nombre: 'Partes del cuerpo', emoji: '🧍', color: '#ff5d73', desc: 'Nombra las partes del cuerpo: cabeza, tronco y extremidades.', cursos: [1, 2, 3], gen: cuerpo },
    { id: 'sentidos', materia: 'naturales', nombre: 'Los cinco sentidos', emoji: '👃', color: '#ff9f1c', desc: 'Vista, oído, olfato, gusto y tacto.', cursos: [1, 2, 3], gen: sentidos },
    { id: 'seres', materia: 'naturales', nombre: 'Seres vivos', emoji: '🌱', color: '#16a34a', desc: '¿Ser vivo o inerte? Nutrición, relación y reproducción.', cursos: [1, 2, 3, 4], gen: seresVivos },
    { id: 'animales', materia: 'naturales', nombre: 'Tipos de animales', emoji: '🐾', color: '#8e5cff', desc: 'Qué comen, cómo nacen, vertebrados e invertebrados y sus grupos.', cursos: [1, 2, 3, 4, 5, 6], gen: animales },
    { id: 'plantas', materia: 'naturales', nombre: 'Las plantas', emoji: '🌻', color: '#2ec4b6', desc: 'Partes de la planta, árboles, arbustos y hierbas, fotosíntesis.', cursos: [2, 3, 4, 5, 6], gen: plantas },
    { id: 'aparatos', materia: 'naturales', nombre: 'Aparatos del cuerpo', emoji: '🫀', color: '#e11d48', desc: 'Digestivo, respiratorio, circulatorio, excretor, nervioso y locomotor.', cursos: [4, 5, 6], gen: aparatos },
    // Geografía e Historia
    { id: 'tiempo', materia: 'sociales', nombre: 'El paso del tiempo', emoji: '📅', color: '#3a86ff', desc: 'Días de la semana, meses y estaciones del año.', cursos: [1, 2], gen: tiempo },
    { id: 'relieve', materia: 'sociales', nombre: 'El paisaje', emoji: '⛰️', color: '#16a34a', desc: 'Montaña, río, isla, valle, península, golfo…', cursos: [1, 2, 3, 4], gen: relieve },
    { id: 'orientacion', materia: 'sociales', nombre: 'Nos orientamos', emoji: '🧭', color: '#ff9f1c', desc: 'Puntos cardinales, brújula, mapas y planos.', cursos: [2, 3, 4], gen: orientacion },
    { id: 'mundo', materia: 'sociales', nombre: 'El mundo y España', emoji: '🌍', color: '#2ec4b6', desc: 'Continentes, océanos, ríos, montañas y mares de España.', cursos: [3, 4, 5, 6], gen: mundo },
    { id: 'ccaa', materia: 'sociales', nombre: 'Comunidades autónomas', emoji: '🗺️', color: '#8e5cff', desc: 'Capitales de las comunidades y provincias de España.', cursos: [4, 5, 6], gen: comunidades },
    { id: 'historia', materia: 'sociales', nombre: 'Edades de la historia', emoji: '🏰', color: '#b45309', desc: 'De la Prehistoria a la Edad Contemporánea, con personajes.', cursos: [3, 4, 5, 6], gen: historia },
    { id: 'romanos', materia: 'sociales', nombre: 'Los romanos', emoji: '🏛️', color: '#c2410c', desc: 'Hispania romana, acueductos, calzadas, gladiadores y números romanos.', cursos: [4, 5, 6], gen: romanos },
    { id: 'medieval', materia: 'sociales', nombre: 'La Edad Media', emoji: '⚔️', color: '#4338ca', desc: 'Visigodos, al-Ándalus, la Reconquista, castillos, nobles, clero y campesinos.', cursos: [4, 5, 6], gen: edadMedia },
];
