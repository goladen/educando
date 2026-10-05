// ═══════════════════════════════════════════════════════════════════
//  BANCO DE ORTOGRAFÍA — Lengua (Pikt)
//  · ACENTUACION: palabras separadas en sílabas + posición de la tónica
//    contando desde el final (1 aguda · 2 llana · 3 esdrújula · 4 sobresdrújula).
//    Sufijo «*» = la tilde se debe a un hiato (día, país…).
//  · LETRAS: palabras con hueco entre corchetes ([b] = letra correcta;
//    [] = no lleva nada, p. ej. la h muda).
// ═══════════════════════════════════════════════════════════════════

export const ACENTUACION = [
    // Agudas
    'can-ción|1', 'ca-fé|1', 'so-fá|1', 'ma-má|1', 'a-vión|1', 'ca-mión|1', 'ra-tón|1', 'lá-piz|2',
    're-loj|1', 'pa-red|1', 'a-zul|1', 'co-mer|1', 'can-tar|1', 'ver-dad|1', 'ciu-dad|1', 'fe-liz|1',
    'es-pa-ñol|1', 'a-de-más|1', 'tam-bién|1', 'jar-dín|1', 'com-pás|1', 'bal-cón|1', 'co-ra-zón|1',
    'li-món|1', 'al-ba-ñil|1', 'pa-pel|1', 'ha-blar|1', 'sa-lud|1', 've-loz|1', 'dor-mir|1',
    'a-quí|1', 'ja-más|1', 'sal-món|1', 'des-pués|1', 'can-tó|1', 'co-mió|1', 'es-tor-nu-dar|1',
    // Llanas
    'me-sa|2', 'ca-sa|2', 'li-bro|2', 'ár-bol|2', 'fá-cil|2', 'di-fí-cil|2', 'cés-ped|2', 'án-gel|2',
    'a-zú-car|2', 'cár-cel|2', 'ú-til|2', 'mó-vil|2', 'lá-piz|2', 'dó-cil|2', 'trá-fi-co|3',
    've-ra-no|2', 'ven-ta-na|2', 'mon-ta-ña|2', 'es-cue-la|2', 'cuen-to|2', 'jo-ven|2', 'e-xa-men|2',
    'ca-mi-nan|2', 'lu-nes|2', 'cri-sis|2', 'tó-rax|2', 'bí-ceps|2', 'fór-ceps|2', 'có-mic|2',
    'ré-cord|2', 'dé-bil|2', 'ca-rác-ter|2', 'a-ma-ri-llo|2', 'gri-fo|2', 'pe-lo-ta|2', 'flo-res|2',
    // Esdrújulas
    'mú-si-ca|3', 'pá-ja-ro|3', 'lá-gri-ma|3', 'brú-ju-la|3', 'cá-ma-ra|3', 'mé-di-co|3', 'pí-ca-ro|3',
    'te-lé-fo-no|3', 'nú-me-ro|3', 'sí-la-ba|3', 'es-drú-ju-la|3', 'pe-lí-cu-la|3', 'mur-cié-la-go|3',
    'ma-te-má-ti-cas|3', 'plá-ta-no|3', 'rá-pi-do|3', 'sá-ba-do|3', 'miér-co-les|3', 'pú-bli-co|3',
    'cás-ca-ra|3', 'lám-pa-ra|3', 'ár-bi-tro|3', 're-lám-pa-go|3', 'tí-mi-do|3', 'mé-to-do|3',
    'án-ge-les|3', 'jó-ve-nes|3', 'e-xá-me-nes|3', 'ór-de-nes|3', 'pá-gi-na|3',
    // Sobresdrújulas
    'dí-ga-se-lo|4', 'cuén-ta-me-lo|4', 'rá-pi-da-men-te|4', 'có-me-te-lo|4', 'trái-ga-me-lo|4',
    'en-tré-ga-se-lo|4', 'dí-me-lo|3', 'ex-plí-ca-se-lo|4', 'fá-cil-men-te|4', 'ú-ni-ca-men-te|4',
    // Hiatos (tilde por hiato)
    'dí-a|2*', 'pa-ís|1*', 'ma-íz|1*', 'o-í-do|2*', 'frí-o|2*', 'rí-o|2*', 'tí-o|2*', 'ba-úl|1*',
    're-ír|1*', 'pú-a|2*', 'grú-a|2*', 'Ra-úl|1*', 'po-e-sí-a|2*', 'ca-í-da|2*', 'bú-ho|2*',
    'pa-ra-guas|2', 'cua-der-no|2', 'a-gua|2', 'ra-dio|2', 'pia-no|2',
].map(s => {
    const [silabas, pos] = s.split('|');
    const sil = silabas.split('-').filter(Boolean);
    const hiato = pos.endsWith('*');
    return { sil, pos: parseInt(pos, 10), hiato, palabra: sil.join('') };
}).filter((w, i, arr) => w.sil.length >= w.pos && arr.findIndex(o => o.palabra === w.palabra) === i);

export const CLASES_ACENTO = {
    1: { id: 1, label: 'Aguda', color: '#e74c3c', regla: 'Las agudas llevan tilde si terminan en vocal, -n o -s.' },
    2: { id: 2, label: 'Llana', color: '#2980b9', regla: 'Las llanas llevan tilde si NO terminan en vocal, -n ni -s.' },
    3: { id: 3, label: 'Esdrújula', color: '#27ae60', regla: 'Las esdrújulas llevan tilde siempre.' },
    4: { id: 4, label: 'Sobresdrújula', color: '#8e44ad', regla: 'Las sobresdrújulas llevan tilde siempre.' },
};

const TILDADAS = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' };
const ACENTUAR = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' };
export const quitarTildes = (s) => s.replace(/[áéíóú]/g, c => TILDADAS[c]);
export const llevaTilde = (s) => /[áéíóú]/.test(s);

// Pone tilde en la vocal tónica de una sílaba (vocal abierta; si son dos cerradas, la segunda).
function acentuarSilaba(sil) {
    const idx = [...sil].map((c, i) => ({ c, i })).filter(o => 'aeiou'.includes(o.c.toLowerCase()));
    if (!idx.length) return sil;
    const abierta = idx.find(o => 'aeo'.includes(o.c.toLowerCase()));
    const elegida = abierta || idx[idx.length - 1];
    return sil.slice(0, elegida.i) + (ACENTUAR[elegida.c] || elegida.c) + sil.slice(elegida.i + 1);
}

// Devuelve la forma «contraria» (con tilde si no la lleva y viceversa).
export function formaContraria(w) {
    if (llevaTilde(w.palabra)) return quitarTildes(w.palabra);
    const sil = [...w.sil];
    const k = sil.length - w.pos;
    sil[k] = acentuarSilaba(sil[k]);
    return sil.join('');
}

export function explicarTilde(w) {
    const clase = CLASES_ACENTO[w.pos];
    const fin = quitarTildes(w.palabra).slice(-1).toLowerCase();
    const terminaVNS = 'aeiouns'.includes(fin);
    const lleva = llevaTilde(w.palabra);
    if (w.hiato && lleva) return `«${w.palabra}» lleva tilde porque la vocal cerrada tónica forma hiato con la vocal de al lado.`;
    if (w.pos >= 3) return `«${w.palabra}» es ${clase.label.toLowerCase()}: ${clase.regla.toLowerCase()}`;
    const termina = terminaVNS ? (fin === 'n' || fin === 's' ? `-${fin}` : 'vocal') : `«-${fin}»`;
    return `«${w.palabra}» es ${clase.label.toLowerCase()} y termina en ${termina} → ${lleva ? 'lleva tilde' : 'no lleva tilde'}. ${clase.regla}`;
}

// ── Letras dudosas ──────────────────────────────────────────────────
export const GRUPOS_LETRAS = [
    {
        id: 'bv', label: 'b / v', opciones: ['b', 'v'], color: '#2980b9',
        regla: 'Se escriben con b: -bir (salvo hervir, servir, vivir), -aba del pretérito imperfecto, bl/br, bu-/bus-/bur-, tras m. Con v: tras n, d y b; -ava, -avo, -eve, -ivo; el pretérito de estar, andar y tener (estuve, anduve, tuve).',
        palabras: ['[b]arco', '[v]aca', 'hier[b]a', '[v]olar', 'tu[v]e', 'escri[b]ir', 'ha[b]ía', 'canta[b]a', 'am[b]ulancia', 'en[v]idia',
            'o[b]jeto', 'nue[v]e', 'ner[v]io', '[b]urbuja', 'su[b]ir', 'vi[v]ir', 'ser[v]ir', 'nue[v]o', 'octa[v]o', 'acti[v]o',
            'esta[b]a', 'andu[v]e', '[b]lanco', 'ha[b]lar', 'po[b]re', 'ad[v]erbio', '[v]eintiuno', 'cla[v]o', 'tam[b]ién', 'in[v]ierno',
            'nie[v]e', 'pue[b]lo', 'a[b]uelo', 'ca[b]eza', 'jo[v]en', 'lle[v]ar', 'resol[v]er', '[b]uscar', 'gra[v]e', 'ár[b]ol'],
    },
    {
        id: 'gj', label: 'g / j', opciones: ['g', 'j'], color: '#16a085',
        regla: 'Con g: -gen, -gía, -gio, -gente, geo-, legi-, -ger/-gir (salvo tejer y crujir). Con j: -aje, -eje, -jero/-jera, -jería, y las formas de verbos sin g ni j en el infinitivo (dije, traje, conduje).',
        palabras: ['ima[g]en', 'ori[g]en', 'via[j]e', 'gara[j]e', 'ener[g]ía', 'ma[g]ia', 'cole[g]io', '[g]eografía', 'reco[g]er', 'eli[g]ir',
            'te[j]er', 'cru[j]ir', 'di[j]e', 'tra[j]e', 'condu[j]e', 'conse[j]ero', 'relo[j]ería', 'mensa[j]e', 'paisa[j]e', 'a[g]ente',
            '[g]ente', 'le[g]ítimo', 'ur[g]ente', 'ca[j]ero', 'e[j]e', 'tar[j]eta', '[j]irafa', '[g]igante', 've[g]etal', 'o[j]era',
            'pá[g]ina', 'ló[g]ico', 'beren[j]ena', 'cerra[j]ero', 'a[g]itar', 'fin[g]ir', 'a[j]eno', 'ma[j]estad', 'su[g]erir', 'prote[g]er'],
    },
    {
        id: 'h', label: 'h / sin h', opciones: ['h', '—'], color: '#8e44ad',
        regla: 'Llevan h las palabras que empiezan por hie-, hue-, hui-, hum-, hidr-, hiper-, hipo-, hosp-, herm-, horm-, y todas las formas de haber, hacer, hablar, hallar y habitar. Ojo con los parónimos: hola/ola, hecho/echo, haya/aya.',
        palabras: ['[h]ielo', '[h]ueso', '[h]uevo', '[h]umo', '[h]idratar', '[h]ospital', '[h]ermano', '[h]ormiga', '[h]abía', '[h]acer',
            '[h]ablar', '[h]allar', '[h]abitación', '[]ojo', '[]oreja', '[]ermita', '[]uno', '[]orden', '[]idea',
            '[]umbral', '[]oso', 'a[h]ora', 'al[h]aja', 'za[h]orí', 've[h]ículo', 'co[h]ete', 'pro[h]ibir', 'ba[h]ía', '[h]uir',
            '[h]ipopótamo', '[h]élice', '[h]ilo', '[]ombligo', '[h]ombro', '[h]oy', '[]ayer', '[h]istoria', '[]isla', '[h]uerto'],
    },
    {
        id: 'lly', label: 'll / y', opciones: ['ll', 'y'], color: '#d35400',
        regla: 'Con ll: -illo, -illa, y los verbos en -llir y -llar. Con y: al final de palabra tras vocal (rey, hoy), el plural de palabras en -y (reyes), yer-, yu-, las formas de verbos sin ll ni y en el infinitivo (cayó, leyendo, oyó).',
        palabras: ['ca[ll]e', 'bombi[ll]a', 'ani[ll]o', 'pasi[ll]o', 'rodi[ll]a', 'ca[ll]ar', 'bri[ll]ar', 'engu[ll]ir', 're[y]',
            'ho[y]', 'mu[y]', 're[y]es', 'le[y]es', '[y]erno', '[y]ugo', 'le[y]endo', 'o[y]ó', 'hu[y]ó',
            'pla[y]a', 'ensa[y]o', '[ll]uvia', '[ll]ave', '[ll]orar', 'ga[ll]ina', 'senci[ll]o', 'ardi[ll]a',
            'a[y]udar', 'jo[y]a', 'pro[y]ecto', 'subra[y]ar', 'cuchi[ll]o', 'mura[ll]a', 'ba[ll]ena', 'cepi[ll]o'],
    },
    {
        id: 'ccc', label: 'c / cc', opciones: ['c', 'cc'], color: '#c0392b',
        regla: 'Se escribe -cc- cuando en la familia aparece -ct- (acción → acto, dirección → director). Si en la familia hay -t- sola o nada, va una sola c (canción → cantar, educación → educar).',
        palabras: ['a[cc]ión', 'dire[cc]ión', 'corre[cc]ión', 'le[cc]ión', 'atra[cc]ión', 'cole[cc]ión', 'proye[cc]ión', 'reda[cc]ión', 'ele[cc]ión', 'infe[cc]ión',
            'can[c]ión', 'educa[c]ión', 'nata[c]ión', 'informa[c]ión', 'aten[c]ión', 'posi[c]ión', 'emo[c]ión', 'situa[c]ión', 'na[c]ión', 'esta[c]ión',
            'sele[cc]ión', 'constru[cc]ión', 'di[cc]ionario', 'fi[cc]ión', 'instru[cc]ión', 'tra[cc]ión', 'perfe[cc]ión', 'condi[c]ión', 'rela[c]ión', 'invita[c]ión'],
    },
    {
        id: 'cz', label: 'c / z', opciones: ['c', 'z'], color: '#7f8c8d',
        regla: 'Delante de e, i se escribe c (cena, cine); delante de a, o, u, z (zapato, zorro, zumo). En el plural, la z final se convierte en c: lápiz → lápices, pez → peces.',
        palabras: ['[c]ena', '[c]ine', '[z]apato', '[z]orro', '[z]umo', 'lápi[c]es', 'pe[c]es', 'lu[c]es', 'lápi[z]', 'pe[z]',
            'vo[z]', 'vo[c]es', 'cru[c]es', 'cru[z]', 'ca[z]ar', 'ca[c]é', 'empe[c]é', 'empe[z]ar', '[c]erezas', 'feli[c]es',
            'ra[z]ón', 'cora[z]ón', '[c]iudad', 'ta[z]a', 've[c]es', '[c]epillo', 'pere[z]a', 'tro[z]os', 'dul[c]e', 'pla[z]a'],
    },
    {
        id: 'mn', label: 'm / n', opciones: ['m', 'n'], color: '#27ae60',
        regla: 'Antes de p y b se escribe siempre m (campo, hombre). Antes de v se escribe siempre n (enviar, invierno).',
        palabras: ['ca[m]po', 'ho[m]bre', 'ta[m]bién', 'si[m]pático', 'e[n]viar', 'i[n]vierno', 'co[n]vertir', 'ca[m]biar', 'li[m]pio', 'e[n]vase',
            'tro[m]peta', 'so[m]bra', 'ho[m]bro', 'e[m]pezar', 'co[n]vencer', 'i[n]vitar', 'tie[m]po', 'u[m]bral', 'a[m]bos', 'e[n]vidia',
            'ca[m]panario', 'sie[m]pre', 'te[m]prano', 'i[m]portante', 'co[n]vivir', 'a[m]bulancia', 'ta[m]bor', 'i[n]vento', 'e[m]barazo', 'co[m]pás'],
    },
    {
        id: 'rrr', label: 'r / rr', opciones: ['r', 'rr'], color: '#e67e22',
        regla: 'El sonido fuerte entre vocales se escribe rr (perro, carro). Al principio de palabra y detrás de l, n, s se escribe r aunque suene fuerte (ratón, alrededor, honra, Israel).',
        palabras: ['pe[rr]ito', 'ca[rr]eta', '[r]atón', '[r]osa', 'al[r]ededor', 'hon[r]a', 'en[r]edo', 'tie[rr]a',
            'gue[rr]a', 'co[rr]er', 'ce[rr]ar', 'ca[r]a', 'ma[r]ido', 'ba[rr]io', 'a[rr]iba', 'ho[r]a', 'to[r]re'],
    },
].map(g => ({
    ...g,
    palabras: g.palabras
        .filter(p => /\[[^\]]*\]/.test(p))
        .map(p => {
            const m = p.match(/^(.*?)\[([^\]]*)\](.*)$/);
            const [, antes, letra, despues] = m;
            // Solo vale si el hueco es una de las opciones del grupo (o vacío en h).
            const letraOk = letra === '' ? '—' : letra;
            return g.opciones.includes(letraOk)
                ? { antes, letra: letraOk, despues: despues.replace(/[[\]]/g, ''), palabra: antes + letra + despues.replace(/[[\]]/g, '') }
                : null;
        })
        .filter(Boolean),
}));
