// ─────────────────────────────────────────────────────────────────────────────
// Filtro de nombres: impide que los alumnos usen insultos o palabras
// malsonantes como nombre (salas en vivo, rankings, envíos al profesor…).
//
//   validarNombre(nombre)  → { ok: true } | { ok: false, mensaje }
//   nombreSeguro(nombre, respaldo) → el nombre si es válido; si no, `respaldo`
//
// Antes de comparar, el texto se normaliza para que no sea fácil saltárselo:
// minúsculas, sin tildes, números/símbolos → letras (p0ll4 → polla),
// letras repetidas juntas (putaaa → puta) y letras separadas unidas
// (p u t a, p.u.t.a → puta).
// ─────────────────────────────────────────────────────────────────────────────

export const MENSAJE_NOMBRE_NO_PERMITIDO = 'Ese nombre no está permitido. Escribe tu nombre de verdad, por favor.';

// Palabras prohibidas como PALABRA COMPLETA (no se buscan dentro de otras,
// para no bloquear p. ej. «calculo», «disputa» o «Zorrilla»).
const PALABRAS = [
    // Español
    'puta', 'putas', 'puto', 'putos', 'putita', 'putito', 'puton', 'putero', 'putera',
    'hdp', 'hdlgp', 'hpta', 'ptm',
    'cabron', 'cabrona', 'cabrones', 'cabronas', 'cabronazo',
    'gilipollas', 'gilipolla', 'gilipoyas', 'jilipollas',
    'polla', 'pollas', 'pollon', 'pollita',
    'coño', 'coños', 'conyo', 'coñazo',
    'joder', 'jodete', 'jodido', 'jodida',
    'follar', 'follo', 'follada', 'follador', 'folladora',
    'mamada', 'mamadas', 'mamon', 'mamona', 'mamones',
    'maricon', 'maricona', 'maricones', 'marica', 'maricas', 'mariconazo',
    'bollera', 'tortillera',
    'zorra', 'zorras', 'zorron', 'perra', 'perras', 'guarra', 'guarras', 'furcia', 'ramera', 'prostituta', 'prostituto',
    'idiota', 'idiotas', 'imbecil', 'imbeciles', 'estupido', 'estupida', 'estupidos',
    'subnormal', 'subnormales', 'retrasado', 'retrasada', 'mongolo', 'mongola', 'mongolito',
    'tonto', 'tonta', 'tontos', 'tontolaba', 'tontolculo', 'gilipichis',
    'capullo', 'capulla', 'capullos',
    'mierda', 'mierdas', 'cagon', 'cagona', 'mierdoso',
    'chocho', 'chumino', 'cipote', 'pene', 'penes', 'vagina', 'teta', 'tetas', 'tetona', 'culo', 'culos', 'culon', 'pedo', 'pedos',
    'pajillero', 'pajillera', 'pajero', 'pajera', 'paja', 'pajas',
    'cachondo', 'cachonda', 'sexo', 'sexy', 'porno', 'xxx',
    'chupamela', 'chupapollas', 'comepollas', 'soplapollas', 'mamahuevos', 'lameculos', 'tragasables',
    'pendejo', 'pendeja', 'verga', 'vergas', 'pinche', 'malparido', 'malparida', 'gonorrea', 'culero', 'culiao', 'carajo', 'hostia', 'hostias',
    'violador', 'violar', 'nazi', 'nazis', 'hitler', 'negrata', 'sudaca', 'panchito',
    'tumadre', 'tuputamadre', 'putamadre',
    // Catalán / gallego
    'collons', 'merda', 'fillputa', 'carallo',
    // Inglés
    'fuck', 'fucker', 'fucking', 'fucked', 'shit', 'bitch', 'bitches', 'asshole', 'pussy', 'cunt',
    'nigger', 'nigga', 'fag', 'faggot', 'whore', 'slut', 'bastard', 'motherfucker', 'retard', 'porn', 'sex', 'penis', 'boobs',
];

// Trozos tan claros que se buscan DENTRO de todo el nombre unido
// (detecta «Pedrohijoputa», «hijo de puta», «gili pollas»…).
const SUBCADENAS = [
    'hijoputa', 'hijodeputa', 'hijaputa', 'hijadeputa', 'filldeputa', 'fillputa',
    'putamadre', 'tumadre', 'gilipoll', 'chupapoll', 'comepoll', 'soplapoll', 'mamapoll',
    'maricon', 'cabron', 'subnormal', 'pajiller', 'mierda',
    'fuck', 'nigger', 'nigga', 'motherf', 'asshole',
];

// Palabras legítimas que, tras normalizar, coincidirían con alguna prohibida
// (se comprueban sobre la palabra original sin tildes, antes de juntar letras).
const EXCEPCIONES = new Set([
    'pola', 'polo', 'cono', 'conos', 'pajares', 'cabrero', 'cabrera',
]);

const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '€': 'e', '!': 'i', '|': 'i' };

// Minúsculas, sin tildes (conservando la ñ) y símbolos «leet» → letras.
function basico(texto) {
    return String(texto || '')
        .toLowerCase()
        .replace(/ñ/g, '\u0001')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\u0001/g, 'ñ')
        .replace(/[0134578@$€!|]/g, c => LEET[c] || c);
}

// Junta letras repetidas: «putaaaa» → «puta», «polla» → «pola».
const unaLetra = s => s.replace(/(.)\1+/g, '$1');

// Variantes de la ñ que se usan para esquivar el filtro.
const sinEnye = s => s.replace(/ny|nh|ni(?=[aeiou])/g, 'ñ');

const SET_PALABRAS = new Set(PALABRAS.map(p => unaLetra(basico(p))));
const LISTA_SUB = SUBCADENAS.map(p => unaLetra(basico(p)));

function palabraProhibida(palabra) {
    if (!palabra || EXCEPCIONES.has(palabra)) return false;
    const variantes = [palabra, sinEnye(palabra)];
    for (const v of variantes) {
        const u = unaLetra(v);
        if (SET_PALABRAS.has(u)) return true;
        // Plurales / femeninos sencillos: «cabronas», «putes»…
        if (u.length > 4 && (SET_PALABRAS.has(u.replace(/e?s$/, '')) || SET_PALABRAS.has(u.replace(/s$/, '')))) return true;
    }
    return false;
}

/** Devuelve true si el nombre contiene algo no permitido. */
export function nombreInapropiado(nombre) {
    const b = basico(nombre);
    if (!b.trim()) return false;

    // 1) Palabra a palabra
    const palabras = b.split(/[^a-zñ]+/).filter(Boolean);
    if (palabras.some(palabraProhibida)) return true;

    // 2) Letras sueltas separadas por espacios o puntos: «p u t a», «p.u.t.a»
    let grupo = '';
    const grupos = [];
    for (const p of palabras) {
        if (p.length === 1) grupo += p;
        else { if (grupo.length > 1) grupos.push(grupo); grupo = ''; }
    }
    if (grupo.length > 1) grupos.push(grupo);
    if (grupos.some(palabraProhibida)) return true;

    // 3) Trozos claros dentro del nombre entero unido
    const unido = unaLetra(sinEnye(palabras.join('')));
    if (LISTA_SUB.some(s => unido.includes(s))) return true;

    return false;
}

/** Valida un nombre de alumno. */
export function validarNombre(nombre) {
    const limpio = String(nombre || '').trim();
    if (!limpio) return { ok: false, mensaje: 'Escribe tu nombre.' };
    if (nombreInapropiado(limpio)) return { ok: false, mensaje: MENSAJE_NOMBRE_NO_PERMITIDO };
    return { ok: true };
}

/**
 * Para usar dentro de los juegos como red de seguridad: si el nombre que llega
 * no es válido (por ejemplo, desde una entrada que aún no valida), lo sustituye.
 */
export function nombreSeguro(nombre, respaldo = 'Jugador') {
    const limpio = String(nombre || '').trim();
    if (!limpio || nombreInapropiado(limpio)) return respaldo;
    return limpio;
}
