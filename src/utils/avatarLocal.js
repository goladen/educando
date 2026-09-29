// Avatar del jugador guardado en el dispositivo (localStorage).
// El avatar es una configuración pequeña (tipo, colores, pelo, ojos...) que
// AvatarSVG dibuja por capas; así se puede copiar a salas, rankings o informes.

export const AVATAR_KEY = 'pikt_avatar';
export const AVATAR_EVENTO = 'pikt-avatar-cambio';

const PIELES_HUMANAS = ['#ffe0c7', '#f9c9a0', '#e8a878', '#c68652', '#8d5524', '#5c3317'];

// ─── Catálogo de opciones ────────────────────────────────────────────────────
// En 'base', `piel` es el color que se aplica al elegir ese personaje.
export const AVATAR_OPCIONES = {
    base: [
        { id: 'persona',   label: 'Persona',   piel: '#f9c9a0' },
        { id: 'gato',      label: 'Gato',      piel: '#ff8c42' },
        { id: 'zorro',     label: 'Zorro',     piel: '#ff7a2f' },
        { id: 'oso',       label: 'Oso',       piel: '#a0522d' },
        { id: 'panda',     label: 'Panda',     piel: '#f5f5f5' },
        { id: 'conejo',    label: 'Conejo',    piel: '#ffe4ec' },
        { id: 'rana',      label: 'Rana',      piel: '#8fd694' },
        { id: 'pinguino',  label: 'Pingüino',  piel: '#34495e' },
        { id: 'dragon',    label: 'Dragón',    piel: '#6ab04c' },
        { id: 'unicornio', label: 'Unicornio', piel: '#fdfdfd' },
        { id: 'robot',     label: 'Robot',     piel: '#b2bec3' },
        { id: 'alien',     label: 'Alien',     piel: '#a3e635' },
    ],
    piel: [...PIELES_HUMANAS, '#ff8c42', '#a0522d', '#f5f5f5', '#8fd694', '#34495e', '#6ab04c',
        '#b2bec3', '#a3e635', '#6ec6ff', '#c9b6ff', '#ff9ec4', '#ffd166'],
    pelo: [
        { id: 'corto',   label: 'Corto' },
        { id: 'lateral', label: 'Flequillo' },
        { id: 'largo',   label: 'Largo' },
        { id: 'coletas', label: 'Coletas' },
        { id: 'moño',    label: 'Moño' },
        { id: 'afro',    label: 'Afro' },
        { id: 'pinchos', label: 'Pinchos' },
        { id: 'cresta',  label: 'Cresta' },
        { id: 'rapado',  label: 'Rapado' },
        { id: 'ninguno', label: 'Sin pelo' },
    ],
    colorPelo: ['#1b1b1b', '#4a2c17', '#8b4513', '#d2a15b', '#f7e08b', '#e74c3c', '#ff7f50', '#e84393', '#8e44ad', '#3498db', '#1abc9c', '#ecf0f1'],
    ojos: [
        { id: 'normales',   label: 'Normales' },
        { id: 'brillantes', label: 'Brillantes' },
        { id: 'felices',    label: 'Felices' },
        { id: 'guiño',      label: 'Guiño' },
        { id: 'dormidos',   label: 'Dormidos' },
        { id: 'estrellas',  label: 'Estrellas' },
        { id: 'corazon',    label: 'Corazones' },
    ],
    colorOjos: ['#6b4423', '#3b7dd8', '#2e9e5b', '#7f8c8d', '#8e44ad', '#e67e22', '#e84393', '#1b1b1b'],
    boca: [
        { id: 'sonrisa',  label: 'Sonrisa' },
        { id: 'dientes',  label: 'Dientes' },
        { id: 'risa',     label: 'Risa' },
        { id: 'lengua',   label: 'Lengua' },
        { id: 'gatuna',   label: 'Gatuna' },
        { id: 'colmillo', label: 'Colmillo' },
        { id: 'sorpresa', label: 'Sorpresa' },
        { id: 'seria',    label: 'Seria' },
    ],
    ropaTipo: [
        { id: 'camiseta', label: 'Camiseta' },
        { id: 'sudadera', label: 'Sudadera' },
        { id: 'camisa',   label: 'Camisa' },
        { id: 'rayas',    label: 'Rayas' },
        { id: 'heroe',    label: 'Superhéroe' },
        { id: 'traje',    label: 'Traje' },
    ],
    ropa: ['#e74c3c', '#e67e22', '#f1c40f', '#27ae60', '#16a085', '#2980b9', '#6c5ce7', '#e84393', '#2d3436', '#ecf0f1', '#8d6e63', '#00cec9'],
    accesorio: [
        { id: 'ninguno',     label: 'Nada' },
        { id: 'gafas',       label: 'Gafas' },
        { id: 'gafasSol',    label: 'Gafas de sol' },
        { id: 'gorra',       label: 'Gorra' },
        { id: 'gorroLana',   label: 'Gorro de lana' },
        { id: 'corona',      label: 'Corona' },
        { id: 'mago',        label: 'Mago' },
        { id: 'auriculares', label: 'Gamer' },
        { id: 'pirata',      label: 'Pirata' },
        { id: 'vikingo',     label: 'Vikingo' },
        { id: 'astronauta',  label: 'Astronauta' },
        { id: 'lazo',        label: 'Lazo' },
        { id: 'flor',        label: 'Flor' },
        { id: 'pajarita',    label: 'Pajarita' },
    ],
    fondo: ['#1e3a8a', '#0f766e', '#7c3aed', '#be123c', '#ea580c', '#ca8a04', '#15803d', '#0284c7', '#334155', '#db2777', '#38bdf8', '#facc15'],
    patron: [
        { id: 'liso',      label: 'Liso' },
        { id: 'rayos',     label: 'Rayos' },
        { id: 'puntos',    label: 'Puntos' },
        { id: 'estrellas', label: 'Estrellas' },
        { id: 'burbujas',  label: 'Burbujas' },
    ],
};

// Campos de color: aceptan cualquier hex (no solo los de la paleta).
const CAMPOS_COLOR = ['piel', 'colorPelo', 'colorOjos', 'ropa', 'fondo'];

export const AVATAR_DEFECTO = {
    v: 2, base: 'persona', piel: '#f9c9a0', pelo: 'corto', colorPelo: '#4a2c17', colorOjos: '#6b4423',
    ojos: 'normales', boca: 'sonrisa', ropaTipo: 'sudadera', ropa: '#2980b9', accesorio: 'ninguno',
    fondo: '#1e3a8a', patron: 'rayos',
};

const ids = (lista) => lista.map((o) => (typeof o === 'string' ? o : o.id));
const azar = (lista) => lista[Math.floor(Math.random() * lista.length)];
const esHex = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

// Rellena huecos y descarta valores desconocidos (p. ej. de versiones antiguas).
export function normalizarAvatar(cfg) {
    const out = { ...AVATAR_DEFECTO };
    if (!cfg || typeof cfg !== 'object') return out;
    for (const campo of Object.keys(AVATAR_OPCIONES)) {
        const v = cfg[campo];
        if (CAMPOS_COLOR.includes(campo) ? esHex(v) : ids(AVATAR_OPCIONES[campo]).includes(v)) out[campo] = v;
    }
    return out;
}

export function avatarAleatorio() {
    const out = { v: 2 };
    for (const campo of Object.keys(AVATAR_OPCIONES)) out[campo] = azar(ids(AVATAR_OPCIONES[campo]));
    const base = AVATAR_OPCIONES.base.find((b) => b.id === out.base);
    out.piel = out.base === 'persona' ? azar(PIELES_HUMANAS) : (Math.random() < 0.7 ? base.piel : azar(AVATAR_OPCIONES.piel));
    if (out.pelo === 'ninguno' && Math.random() < 0.7) out.pelo = 'corto';
    // Los complementos quedan mejor si no salen siempre.
    if (Math.random() < 0.35) out.accesorio = 'ninguno';
    return out;
}

export function getAvatarLocal() {
    try {
        const raw = localStorage.getItem(AVATAR_KEY);
        return raw ? normalizarAvatar(JSON.parse(raw)) : null;
    } catch {
        return null;
    }
}

export function guardarAvatarLocal(cfg) {
    const limpio = normalizarAvatar(cfg);
    try { localStorage.setItem(AVATAR_KEY, JSON.stringify(limpio)); } catch { /* nada */ }
    try { window.dispatchEvent(new CustomEvent(AVATAR_EVENTO, { detail: limpio })); } catch { /* nada */ }
    return limpio;
}

export function borrarAvatarLocal() {
    try { localStorage.removeItem(AVATAR_KEY); } catch { /* nada */ }
    try { window.dispatchEvent(new CustomEvent(AVATAR_EVENTO, { detail: null })); } catch { /* nada */ }
}
