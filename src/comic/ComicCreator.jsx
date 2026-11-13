import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AvatarSVG from '../components/avatar/AvatarSVG';
import AvatarEditor from '../components/avatar/AvatarEditor';
import { getAvatarLocal, avatarAleatorio } from '../utils/avatarLocal';
import { guardarRegistroLocal } from '../utils/registrosLocales';
import ComicPagina, { DISPOSICIONES, calcularPagina, numVinetas, svgAPng, FUENTE_ONOMATOPEYA } from './ComicPagina';
import { FONDOS, OBJETOS, PERSONAJES_PRESET, MOODS_COMIC } from './recursosComic';
import PersonajeCuerpo, { POSES } from './PersonajeCuerpo';
import { nid, vinetaVacia, clave, normalizarComic, vistaPagina, decodificarPlantilla, comicDesdePlantilla } from './modeloComic';
import { ModalEnviarProfe, ModalMisComics, ModalPlantilla, totalVinetas } from './ComicModales';

// Creador de cómics: páginas de viñetas, fondos, personajes (avatares de busto
// o de cuerpo entero con poses), objetos, bocadillos y onomatopeyas.
//   · Libre: se guarda en el dispositivo (localStorage), PNG, imprimir, enviar al profe.
//   · Plantilla: /comic?plantilla=… abre una copia con bocadillos para completar.
//   · Aula (prop `aula`, Control de Aula): sin almacén local; individual o colaborativo
//     (solo se editan las viñetas de `aula.editables`, el resto llega en `aula.externo`).

const CLAVE = 'pikt_comics';
const CLAVE_ACTUAL = 'pikt_comic_actual';
const MAX_COMICS = 40;

function comicVacio() {
    return { id: nid(), titulo: 'Mi cómic', autor: '', mostrarTitulo: true, paginas: [{ disposicion: 'p4', vinetas: [0, 1, 2, 3].map(vinetaVacia) }], modificado: Date.now() };
}

function comicEjemplo() {
    const [a, b] = [PERSONAJES_PRESET[0], PERSONAJES_PRESET[1]];
    const pj = (cfg, fx, mood, s = 300, flip = false) => ({ id: nid(), tipo: 'personaje', cfg, mood, fx, fy: 0.78, s, rot: 0, flip });
    const cu = (cfg, fx, mood, pose, flip = false, s = 400, fy = 0.52) => ({ id: nid(), tipo: 'personaje', cfg, mood, fx, fy, s, rot: 0, flip, cuerpo: true, pose });
    const bo = (texto, fx, fy, estilo, cola, w = 230) => ({ id: nid(), tipo: 'bocadillo', estilo, texto, fx, fy, w, fs: 28, cola });
    return {
        id: nid(), titulo: 'La pregunta difícil', autor: '', mostrarTitulo: true, modificado: Date.now(),
        paginas: [{
            disposicion: 'p4',
            vinetas: [
                { fondo: 'aula', color: '#ffffff', els: [pj(a, 0.3, 'neutral'), pj(b, 0.75, 'neutral', 300, true), bo('¿Sabes cuánto es 7 × 8?', 0.33, 0.2, 'dialogo', { dx: -20, dy: 120 })] },
                { fondo: 'aula', color: '#ffffff', els: [pj(b, 0.55, 'surprised', 340), bo('Mmm… a ver…', 0.5, 0.2, 'pensamiento', { dx: 10, dy: 120 }, 200)] },
                { fondo: 'accion', color: '#ffffff', els: [cu(b, 0.62, 'happy', 'senala'), { id: nid(), tipo: 'objeto', obj: 'bombilla', fx: 0.86, fy: 0.22, s: 110, rot: 12, flip: false }, bo('¡56!', 0.22, 0.22, 'grito', { dx: 90, dy: 60 }, 120)] },
                { fondo: 'patio', color: '#ffffff', els: [cu(a, 0.27, 'happy', 'celebra', false, 320, 0.62), cu(b, 0.73, 'happy', 'saluda', true, 320, 0.62), { id: nid(), tipo: 'texto', texto: '¡BIEN!', fx: 0.5, fy: 0.15, fs: 56, color: '#ffd32a', rot: -8, estallido: true, colorEstallido: '#ff5e57' }] },
            ],
        }],
    };
}

function leerComics() {
    try {
        const l = JSON.parse(localStorage.getItem(CLAVE) || '[]');
        return Array.isArray(l) ? l.map(normalizarComic).filter(Boolean) : [];
    } catch { return []; }
}
function escribirComics(lista) {
    try { localStorage.setItem(CLAVE, JSON.stringify(lista.slice(0, MAX_COMICS))); return true; } catch { return false; }
}

const ONOMATOPEYAS = ['¡POW!', '¡BOOM!', '¡ZAS!', '¡CRASH!', '¡PLAF!', '¡WOW!', '¡JA, JA!', '¡GRRR!', '¡OH, NO!', '¡RING!', '¡ÑAM!', 'ZZZ…', '¡BIEN!', '¡CLIC!', '¡SPLASH!', '¡BUM!'];
const COLORES_TEXTO = ['#ffd32a', '#ff5e57', '#0fbcf9', '#05c46b', '#ffffff', '#f368e0', '#ff9f1a', '#1a1a1a'];
const COLORES_VINETA = ['#ffffff', '#fffbe6', '#ffeaa7', '#fab1a0', '#ff7675', '#a29bfe', '#74b9ff', '#81ecec', '#55efc4', '#dfe6e9', '#2d3436', '#000000'];
const ESTILOS_BOCADILLO = [
    { id: 'dialogo', label: 'Diálogo', emoji: '💬', texto: '¡Hola!' },
    { id: 'pensamiento', label: 'Pensamiento', emoji: '💭', texto: 'Estoy pensando…' },
    { id: 'grito', label: 'Grito', emoji: '🗯️', texto: '¡CUIDADO!' },
    { id: 'susurro', label: 'Susurro', emoji: '🤫', texto: 'Psss… un secreto' },
    { id: 'cartela', label: 'Narrador', emoji: '📜', texto: 'Mientras tanto…' },
];
const PESTANAS = [
    { id: 'vinetas', label: 'Viñetas', emoji: '🔲' },
    { id: 'personajes', label: 'Personajes', emoji: '🧑' },
    { id: 'objetos', label: 'Objetos', emoji: '🎁' },
    { id: 'bocadillos', label: 'Bocadillos', emoji: '💬' },
    { id: 'efectos', label: 'Efectos', emoji: '💥' },
];

const CSS = `
.cmx-root{position:fixed;inset:0;z-index:9999;background:#eef1f6;display:flex;flex-direction:column;font-family:'Segoe UI',system-ui,sans-serif;color:#2d3436}
.cmx-root.incrustado{position:absolute;z-index:1}
.cmx-top{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#2d3436;color:white;flex-wrap:wrap}
.cmx-btn{border:none;border-radius:10px;padding:8px 12px;font-weight:700;font-size:0.85rem;cursor:pointer;background:rgba(255,255,255,0.12);color:white;display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
.cmx-btn:disabled{opacity:0.4;cursor:default}
.cmx-btn.prim{background:linear-gradient(135deg,#f1c40f,#e67e22)}
.cmx-btn.azul{background:#0984e3}
.cmx-btn.verde{background:#27ae60}
.cmx-menu{position:absolute;top:100%;right:0;margin-top:6px;background:white;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.25);padding:6px;z-index:20;min-width:230px}
.cmx-menu button{display:block;width:100%;text-align:left;border:none;background:none;padding:9px 12px;border-radius:8px;cursor:pointer;font-weight:600;font-size:0.88rem;color:#2d3436}
.cmx-menu button:hover{background:#f1f2f6}
.cmx-main{flex:1;display:flex;min-height:0}
.cmx-izq{flex:1;min-width:0;display:flex;flex-direction:column}
.cmx-paginas{display:flex;gap:6px;align-items:center;padding:8px 14px 0;flex-wrap:wrap}
.cmx-pag{border:2px solid #dfe4ea;background:white;border-radius:9px;padding:5px 11px;font-weight:700;font-size:0.8rem;cursor:pointer;color:#576574}
.cmx-pag.on{border-color:#0984e3;color:#0984e3;background:#e8f3ff}
.cmx-lienzo{flex:1;min-height:0;padding:12px 14px 14px;display:flex;align-items:center;justify-content:center;overflow:hidden}
.cmx-lienzo>div{width:100%;height:100%;filter:drop-shadow(0 6px 18px rgba(0,0,0,0.18))}
.cmx-lado{width:370px;flex-shrink:0;background:white;border-left:1px solid #dfe4ea;display:flex;flex-direction:column;min-height:0}
.cmx-tabs{display:flex;border-bottom:1px solid #dfe4ea}
.cmx-tab{flex:1;border:none;background:none;padding:9px 2px;cursor:pointer;font-size:0.72rem;font-weight:700;color:#636e72;border-bottom:3px solid transparent}
.cmx-tab.on{color:#0984e3;border-bottom-color:#0984e3}
.cmx-tab span{display:block;font-size:1.25rem}
.cmx-scroll{flex:1;overflow-y:auto;padding:12px 14px 30px}
.cmx-h{font-size:0.72rem;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;color:#8395a7;margin:14px 0 7px}
.cmx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:7px}
.cmx-item{border:2px solid #dfe4ea;border-radius:10px;background:#f8f9fb;cursor:pointer;padding:4px;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:0.68rem;font-weight:600;color:#576574}
.cmx-item:hover{border-color:#74b9ff}
.cmx-item.on{border-color:#0984e3;background:#e8f3ff}
.cmx-chip{border:2px solid #dfe4ea;border-radius:9px;background:white;padding:6px 9px;cursor:pointer;font-weight:700;font-size:0.8rem;color:#2d3436}
.cmx-chip.on{border-color:#0984e3;background:#e8f3ff;color:#0984e3}
.cmx-chip:disabled{opacity:0.4;cursor:default}
.cmx-props{background:#f1f7ff;border:2px solid #cfe3ff;border-radius:14px;padding:10px 12px;margin-bottom:6px}
.cmx-fila{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.cmx-in{width:100%;box-sizing:border-box;border:2px solid #dfe4ea;border-radius:9px;padding:8px 10px;font-size:0.95rem;font-family:inherit}
.cmx-sw{width:26px;height:26px;border-radius:50%;cursor:pointer;border:2px solid #dfe4ea}
.cmx-sw.on{outline:3px solid #0984e3;outline-offset:1px}
.cmx-consigna{background:#fff8e1;border-bottom:2px solid #ffe08a;padding:8px 14px;font-size:0.9rem;color:#6d4c00;display:flex;gap:8px;align-items:flex-start}
.cmx-root,.cmx-main,.cmx-izq,.cmx-lado,.cmx-tabs,.cmx-tab,.cmx-scroll{min-width:0}
.cmx-root{overflow:hidden}
@media (max-width: 860px){
 .cmx-main{flex-direction:column}
 .cmx-izq{flex:none;height:54vh}
 .cmx-lienzo{padding:8px}
 .cmx-lado{width:auto;flex:1;min-height:0;border-left:none;border-top:1px solid #dfe4ea}
 .cmx-top{gap:5px;padding:6px 8px}
 .cmx-top .cmx-txt,.cmx-top .cmx-nombre{display:none}
 .cmx-btn{padding:7px 9px}
 .cmx-tab{font-size:0.62rem}
}
`;

function Deslizador({ label, value, min, max, step = 1, onChange, onEmpezar, sufijo = '' }) {
    return (
        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#576574', marginTop: 8 }}>
            {label}: <span style={{ color: '#0984e3' }}>{Math.round(value)}{sufijo}</span>
            <input type="range" min={min} max={max} step={step} value={value} onPointerDown={onEmpezar} onKeyDown={onEmpezar}
                onChange={(e) => onChange(Number(e.target.value))} style={{ width: '100%', accentColor: '#0984e3' }} />
        </label>
    );
}

const MiniFondo = ({ f }) => {
    const F = f.dibujo;
    return <svg viewBox="0 0 400 300" width="100%" style={{ display: 'block', borderRadius: 6, background: '#fff', aspectRatio: '4 / 3' }} preserveAspectRatio="xMidYMid slice"><F u={'mf' + f.id} /></svg>;
};

const MiniDisposicion = ({ d }) => {
    const pag = calcularPagina({ disposicion: d.id, mostrarTitulo: false });
    return <svg viewBox={`0 0 ${pag.W} ${pag.H}`} style={{ width: '100%', height: 46, display: 'block' }}>
        {pag.paneles.map((p, i) => <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} fill="#dfe6e9" stroke="#2d3436" strokeWidth="22" />)}
    </svg>;
};

const MiniCuerpo = ({ cfg, pose = 'pie' }) => (
    <svg viewBox="-12 -4 124 216" width="44" height="78" style={{ display: 'block' }}><PersonajeCuerpo cfg={cfg} pose={pose} /></svg>
);

// Une la estructura que llega de fuera (colaborativo) con las viñetas propias del alumno.
function mezclarColab(externo, local, editables) {
    if (!externo) return local;
    const ext = normalizarComic(externo);
    return {
        ...ext, id: local?.id || ext.id,
        paginas: ext.paginas.map((p, pi) => ({
            ...p,
            vinetas: p.vinetas.map((v, vi) => (editables?.has(clave(pi, vi)) && local?.paginas?.[pi]?.vinetas?.[vi] ? local.paginas[pi].vinetas[vi] : v)),
        })),
    };
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function ComicCreator({ onExit, aula = null }) {
    const enAula = !!aula;
    const colab = !!aula?.editables;
    const soloLectura = !!aula?.soloLectura;

    const [comic, setComic] = useState(() => {
        if (aula) return normalizarComic(colab ? mezclarColab(aula.externo, null, null) : aula.inicial) || comicVacio();
        const lista = leerComics();
        let actual = null;
        try { actual = localStorage.getItem(CLAVE_ACTUAL); } catch { /* nada */ }
        return lista.find((c) => c.id === actual) || lista[0] || normalizarComic(comicEjemplo());
    });
    const [lista, setLista] = useState(() => (aula ? [] : leerComics()));
    const primeraEditable = () => {
        if (!colab) return { pag: 0, panel: 0 };
        const k = [...aula.editables][0];
        if (!k) return { pag: 0, panel: null };
        const [p, v] = k.split('-').map(Number);
        return { pag: p, panel: v };
    };
    const [sel, setSel] = useState(() => ({ ...primeraEditable(), el: null }));
    const [pestana, setPestana] = useState(colab ? 'personajes' : 'vinetas');
    const [modal, setModal] = useState(null); // 'mis' | 'enviar' | 'plantilla'
    const [menuDescarga, setMenuDescarga] = useState(false);
    const [editarAvatar, setEditarAvatar] = useState(null); // { pag, panel, el } | 'nuevo'
    const [cuerpoEntero, setCuerpoEntero] = useState(false);
    const [aviso, setAviso] = useState('');
    const [exportando, setExportando] = useState(false);
    const [, setVersionHist] = useState(0);
    const svgRef = useRef(null);
    const exportRefs = useRef([]);
    const textoRef = useRef(null);
    const hist = useRef({ atras: [], adelante: [], ultimaClave: null, ultimaHora: 0 });
    const comicRef = useRef(comic);
    comicRef.current = comic;

    const mostrarAviso = (t) => { setAviso(t); setTimeout(() => setAviso(''), 2800); };

    // ─── Plantilla por enlace (/comic?plantilla=…) ───
    useEffect(() => {
        if (aula) return;
        let txt = null;
        try { txt = new URLSearchParams(window.location.search).get('plantilla'); } catch { /* nada */ }
        if (!txt) return;
        decodificarPlantilla(txt).then((pl) => {
            if (!pl?.comic) throw new Error('vacía');
            const c = comicDesdePlantilla(pl);
            setComic(c);
            setSel({ pag: 0, panel: 0, el: null });
            hist.current = { atras: [], adelante: [], ultimaClave: null, ultimaHora: 0 };
            setPestana('bocadillos');
            mostrarAviso('🎓 Plantilla abierta: completa los bocadillos vacíos');
        }).catch(() => mostrarAviso('⚠ El enlace de la plantilla no es válido o está incompleto'))
            .finally(() => { try { window.history.replaceState({}, '', window.location.pathname); } catch { /* nada */ } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ─── Guardado: dispositivo (libre) o aviso al aula ───
    const onCambioAula = useRef(aula?.onCambio);
    onCambioAula.current = aula?.onCambio;
    const primeraVez = useRef(true);
    const cambioExterno = useRef(false); // la mezcla con los compañeros no se vuelve a enviar
    useEffect(() => {
        if (primeraVez.current) { primeraVez.current = false; if (enAula) return; }
        if (cambioExterno.current) { cambioExterno.current = false; return; }
        if (enAula) { if (!soloLectura) onCambioAula.current?.(comic); return; }
        const t = setTimeout(() => {
            const actualizado = { ...comic, modificado: Date.now() };
            const nueva = [actualizado, ...leerComics().filter((c) => c.id !== comic.id)];
            if (!escribirComics(nueva)) mostrarAviso('⚠ No se pudo guardar en este dispositivo');
            try { localStorage.setItem(CLAVE_ACTUAL, comic.id); } catch { /* nada */ }
            setLista(nueva.slice(0, MAX_COMICS));
        }, 700);
        return () => clearTimeout(t);
    }, [comic, enAula, soloLectura]);

    // Colaborativo: llegan las viñetas de los compañeros.
    useEffect(() => {
        if (!colab || !aula.externo) return;
        cambioExterno.current = true;
        setComic((c) => normalizarComic(mezclarColab(aula.externo, c, aula.editables)) || c);
    }, [colab, aula?.externo, aula?.editables]);

    // ─── Historial ───
    const guardarHist = useCallback((claveH = null) => {
        const h = hist.current;
        const ahora = Date.now();
        if (claveH && claveH === h.ultimaClave && ahora - h.ultimaHora < 1200) { h.ultimaHora = ahora; return; }
        h.atras.push(comicRef.current);
        if (h.atras.length > 60) h.atras.shift();
        h.adelante = [];
        h.ultimaClave = claveH;
        h.ultimaHora = ahora;
        setVersionHist((v) => v + 1);
    }, []);
    const cambiar = useCallback((fn, claveH) => { guardarHist(claveH); setComic((c) => fn(c)); }, [guardarHist]);
    const deshacer = () => {
        const h = hist.current;
        if (!h.atras.length) return;
        h.adelante.push(comicRef.current);
        setComic(h.atras.pop());
        h.ultimaClave = null;
        setVersionHist((v) => v + 1);
    };
    const rehacer = () => {
        const h = hist.current;
        if (!h.adelante.length) return;
        h.atras.push(comicRef.current);
        setComic(h.adelante.pop());
        h.ultimaClave = null;
        setVersionHist((v) => v + 1);
    };
    const reiniciarHist = () => { hist.current = { atras: [], adelante: [], ultimaClave: null, ultimaHora: 0 }; setVersionHist((v) => v + 1); };

    // ─── Estado derivado ───
    const pag = Math.min(sel.pag, comic.paginas.length - 1);
    const pagina = comic.paginas[pag];
    const vista = useMemo(() => vistaPagina(comic, pag), [comic, pag]);
    const nV = numVinetas(pagina.disposicion);
    const geo = useMemo(() => calcularPagina(vista), [vista]);
    const esEditable = useCallback((p, v) => !soloLectura && (!colab || aula.editables.has(clave(p, v))), [soloLectura, colab, aula?.editables]);
    const panelSel = sel.panel != null && sel.panel < nV && esEditable(pag, sel.panel) ? sel.panel : null;
    const vinetaSel = panelSel != null ? pagina.vinetas[panelSel] || vinetaVacia() : null;
    const elSel = vinetaSel && sel.el ? vinetaSel.els.find((e) => e.id === sel.el) : null;
    const editableEnPagina = useCallback((i) => esEditable(pag, i), [esEditable, pag]);
    const etiquetasPagina = useMemo(() => {
        if (!aula?.etiquetas) return null;
        const out = {};
        for (let i = 0; i < nV; i++) { const t = aula.etiquetas[clave(pag, i)]; if (t) out[i] = t; }
        return out;
    }, [aula?.etiquetas, pag, nV]);

    // Modificadores (siempre sobre la página actual).
    const conPagina = (c, p, fn) => ({ ...c, paginas: c.paginas.map((x, i) => (i === p ? fn(x) : x)) });
    const conVineta = (c, p, v, fn) => conPagina(c, p, (x) => {
        const vinetas = [...x.vinetas];
        while (vinetas.length <= v) vinetas.push(vinetaVacia());
        vinetas[v] = fn(vinetas[v]);
        return { ...x, vinetas };
    });
    const cambiarVineta = (v, patch, claveH) => cambiar((c) => conVineta(c, pag, v, (x) => ({ ...x, ...patch })), claveH);
    const cambiarEl = (p, v, id, patch, claveH) => cambiar((c) => conVineta(c, p, v, (x) => ({ ...x, els: x.els.map((e) => (e.id === id ? { ...e, ...patch } : e)) })), claveH);
    const pagRef = useRef(pag);
    pagRef.current = pag;
    const cambiarElSinHist = useCallback((v, id, patch) => setComic((c) => {
        const p = pagRef.current;
        return { ...c, paginas: c.paginas.map((x, i) => (i !== p ? x : { ...x, vinetas: x.vinetas.map((vv, j) => (j !== v ? vv : { ...vv, els: vv.els.map((e) => (e.id === id ? { ...e, ...patch } : e)) })) })) };
    }), []);

    const onSeleccionar = useCallback((panel, el) => {
        setSel((s) => (panel == null ? { ...s, el: null } : { ...s, panel, el }));
    }, []);
    const onDoble = useCallback((v, el) => {
        if (el.tipo === 'bocadillo' || el.tipo === 'texto') setTimeout(() => { textoRef.current?.focus(); textoRef.current?.select(); }, 30);
        if (el.tipo === 'personaje' && !el.fijo) setEditarAvatar({ pag: pagRef.current, panel: v, el: el.id });
    }, []);
    const onInicioCambio = useCallback(() => guardarHist(), [guardarHist]);

    // Viñeta donde se añaden cosas.
    const panelDestino = () => {
        if (panelSel != null) return panelSel;
        for (let i = 0; i < nV; i++) if (esEditable(pag, i)) return i;
        return null;
    };
    const anadir = (el) => {
        const v = panelDestino();
        if (v == null) { mostrarAviso(colab ? '⚠ En esta página no tienes viñetas: cambia de página' : '⚠ Elige una viñeta'); return; }
        const nuevo = { id: nid(), rot: 0, flip: false, ...el };
        cambiar((c) => conVineta(c, pag, v, (x) => ({ ...x, els: [...x.els, nuevo] })));
        setSel({ pag, panel: v, el: nuevo.id });
    };
    const variacion = () => (Math.random() - 0.5) * 0.2;
    const dimPanel = () => geo.paneles[panelDestino() ?? 0] || { w: 400, h: 400 };

    const anadirPersonaje = (cfg, conCuerpo = cuerpoEntero, pose = 'pie') => {
        const { w, h } = dimPanel();
        if (conCuerpo) {
            const s = Math.round(Math.min(h * 0.9, w * 1.5));
            anadir({ tipo: 'personaje', cfg, mood: 'neutral', cuerpo: true, pose, s, fx: 0.5 + variacion(), fy: Math.min(0.62, 1 - (s / 2 + h * 0.03) / h) });
        } else {
            const s = Math.round(Math.min(h * 0.72, w * 0.6));
            anadir({ tipo: 'personaje', cfg, mood: 'neutral', s, fx: 0.5 + variacion(), fy: 1 - (s * 0.42) / h });
        }
    };
    const anadirObjeto = (obj) => anadir({ tipo: 'objeto', obj, s: Math.round(dimPanel().h * 0.3), fx: 0.5 + variacion(), fy: 0.55 + variacion() });
    const anadirBocadillo = (estilo, texto) => {
        const { w: pw, h: ph } = dimPanel();
        const w = Math.round(Math.max(120, Math.min(pw * 0.55, 320)));
        anadir({ tipo: 'bocadillo', estilo, texto, w, fs: 28, fx: estilo === 'cartela' ? 0.3 : 0.5 + variacion(), fy: estilo === 'cartela' ? 0.1 : 0.2, cola: estilo === 'cartela' ? null : { dx: 30, dy: Math.round(ph * 0.3) } });
        setTimeout(() => { textoRef.current?.focus(); textoRef.current?.select(); }, 50);
    };
    const anadirTexto = (texto) => anadir({ tipo: 'texto', texto, fs: Math.round(Math.min(110, dimPanel().h * 0.2)), color: COLORES_TEXTO[Math.floor(Math.random() * 4)], estallido: true, colorEstallido: '#ffffff', fx: 0.5, fy: 0.3, rot: Math.round((Math.random() - 0.5) * 20) });

    const borrarSel = () => {
        if (!elSel || elSel.fijo) return;
        cambiar((c) => conVineta(c, pag, panelSel, (x) => ({ ...x, els: x.els.filter((e) => e.id !== elSel.id) })));
        setSel({ pag, panel: panelSel, el: null });
    };
    const duplicarSel = () => {
        if (!elSel) return;
        const { fijo, pista, completar, ...resto } = elSel; // eslint-disable-line no-unused-vars
        const copia = { ...resto, id: nid(), fx: elSel.fx + 0.06, fy: elSel.fy + 0.04 };
        if (elSel.pista && !elSel.texto) copia.texto = '';
        cambiar((c) => conVineta(c, pag, panelSel, (x) => ({ ...x, els: [...x.els, copia] })));
        setSel({ pag, panel: panelSel, el: copia.id });
    };
    const moverCapa = (dir) => {
        if (!elSel) return;
        cambiar((c) => conVineta(c, pag, panelSel, (x) => {
            const otros = x.els.filter((e) => e.id !== elSel.id);
            return { ...x, els: dir > 0 ? [...otros, elSel] : [elSel, ...otros] };
        }));
    };
    const vaciarVineta = () => {
        if (panelSel == null) return;
        cambiar((c) => conVineta(c, pag, panelSel, (x) => ({ ...x, els: x.els.filter((e) => e.fijo) })));
        setSel({ pag, panel: panelSel, el: null });
    };
    const cambiarDisposicion = (id) => {
        const n = numVinetas(id);
        cambiar((c) => conPagina(c, pag, (x) => {
            const vinetas = [...x.vinetas];
            while (vinetas.length < n) vinetas.push(vinetaVacia());
            return { ...x, disposicion: id, vinetas };
        }));
        setSel((s) => ({ ...s, panel: Math.min(s.panel ?? 0, n - 1), el: null }));
    };

    // ─── Páginas ───
    const irPagina = (p) => {
        let panel = 0;
        if (colab) {
            const k = [...aula.editables].find((x) => x.startsWith(`${p}-`));
            panel = k ? Number(k.split('-')[1]) : null;
        }
        setSel({ pag: p, panel, el: null });
    };
    const nuevaPagina = () => {
        const disp = pagina.disposicion;
        cambiar((c) => ({ ...c, paginas: [...c.paginas, { disposicion: disp, vinetas: Array.from({ length: numVinetas(disp) }, vinetaVacia) }] }));
        setSel({ pag: comic.paginas.length, panel: 0, el: null });
    };
    const duplicarPagina = () => {
        const copia = JSON.parse(JSON.stringify(pagina));
        copia.vinetas.forEach((v) => v.els.forEach((e) => { e.id = nid(); }));
        cambiar((c) => ({ ...c, paginas: [...c.paginas.slice(0, pag + 1), copia, ...c.paginas.slice(pag + 1)] }));
        setSel({ pag: pag + 1, panel: 0, el: null });
    };
    const borrarPagina = () => {
        if (comic.paginas.length < 2) return;
        if (!window.confirm(`¿Borrar la página ${pag + 1}?`)) return;
        cambiar((c) => ({ ...c, paginas: c.paginas.filter((_, i) => i !== pag) }));
        setSel({ pag: Math.max(0, pag - 1), panel: 0, el: null });
    };
    const moverPagina = (dir) => {
        const destino = pag + dir;
        if (destino < 0 || destino >= comic.paginas.length) return;
        cambiar((c) => {
            const ps = [...c.paginas];
            [ps[pag], ps[destino]] = [ps[destino], ps[pag]];
            return { ...c, paginas: ps };
        });
        setSel((s) => ({ ...s, pag: destino, el: null }));
    };

    // ─── Teclado ───
    useEffect(() => {
        const k = (e) => {
            const t = e.target;
            const escribiendo = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
            if (escribiendo || soloLectura) return;
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) rehacer(); else deshacer(); }
            else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); rehacer(); }
            else if ((e.key === 'Delete' || e.key === 'Backspace') && elSel) { e.preventDefault(); borrarSel(); }
            else if (e.key === 'Escape') setSel((s) => ({ ...s, el: null }));
        };
        window.addEventListener('keydown', k);
        return () => window.removeEventListener('keydown', k);
    });

    // ─── Exportar ───
    const nombreArchivo = () => (comic.titulo || 'comic').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'comic';
    const nTotal = totalVinetas(comic, numVinetas);
    const registrar = (via, nombre = comic.autor, curso = '') => {
        guardarRegistroLocal('COMIC', { titulo: comic.titulo || 'Mi cómic', aciertos: nTotal, intentos: nTotal, porcentaje: 100, nombre, curso, via });
    };
    const esperarPintado = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 30))));

    // PNG de todas las páginas (se pintan en un contenedor oculto sin capa de selección).
    const pngsPaginas = async (escala) => {
        setExportando(true);
        await esperarPintado();
        try {
            const out = [];
            for (let i = 0; i < comic.paginas.length; i++) out.push(await svgAPng(exportRefs.current[i], escala));
            return out;
        } finally { setExportando(false); }
    };
    const bajar = (blob, nombre) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = nombre;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
    };
    const unirVertical = async (blobs) => {
        const imgs = await Promise.all(blobs.map((b) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(b); })));
        const w = Math.max(...imgs.map((i) => i.width));
        const sep = 30;
        const h = imgs.reduce((s, i) => s + i.height, 0) + sep * (imgs.length - 1);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#dfe6e9'; ctx.fillRect(0, 0, w, h);
        let y = 0;
        imgs.forEach((im) => { ctx.drawImage(im, 0, y); y += im.height + sep; URL.revokeObjectURL(im.src); });
        return new Promise((res) => c.toBlob(res, 'image/png'));
    };
    const descargar = async (todas) => {
        setMenuDescarga(false);
        try {
            const pngs = await pngsPaginas(2);
            if (!todas || pngs.length === 1) bajar(pngs[pag] || pngs[0], `${nombreArchivo()}${pngs.length > 1 ? `-pag${pag + 1}` : ''}.png`);
            else bajar(await unirVertical(pngs), `${nombreArchivo()}.png`);
            registrar('local');
            mostrarAviso('🖼️ Imagen descargada');
        } catch (e) { mostrarAviso('⚠ ' + (e.message || 'No se pudo descargar')); }
    };
    const imprimir = async () => {
        setMenuDescarga(false);
        const w = window.open('', '_blank');
        if (!w) { mostrarAviso('⚠ Permite las ventanas emergentes para imprimir'); return; }
        w.document.write('<p style="font-family:sans-serif">Preparando el cómic…</p>');
        try {
            const pngs = await pngsPaginas(2.2);
            const urls = await Promise.all(pngs.map((b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); })));
            w.document.open();
            w.document.write(`<!doctype html><html><head><title>${(comic.titulo || 'Cómic').replace(/</g, '')}</title><style>@page{margin:10mm}body{margin:0}div{page-break-after:always;display:flex;justify-content:center;align-items:flex-start;height:100vh}div:last-child{page-break-after:auto}img{max-width:100%;max-height:100%}</style></head><body>${urls.map((u) => `<div><img src="${u}"></div>`).join('')}<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script></body></html>`);
            w.document.close();
        } catch (e) { w.close(); mostrarAviso('⚠ ' + e.message); }
    };

    // ─── Archivo (modo libre) ───
    const abrirComic = (c) => { setComic(normalizarComic(c)); setSel({ pag: 0, panel: 0, el: null }); reiniciarHist(); setModal(null); };
    const nuevoComic = () => { abrirComic(comicVacio()); mostrarAviso('📄 Cómic nuevo. El anterior queda en «Mis cómics»'); };
    const borrarComic = (id) => {
        const nueva = leerComics().filter((c) => c.id !== id);
        escribirComics(nueva);
        setLista(nueva);
        if (id === comic.id) abrirComic(nueva[0] || comicVacio());
    };
    const duplicarComic = (c) => abrirComic({ ...JSON.parse(JSON.stringify(c)), id: nid(), titulo: `${c.titulo || 'Cómic'} (copia)` });

    // ─── Panel de propiedades ───
    const props = () => {
        if (!elSel) return null;
        const e = elSel;
        const set = (patch, claveH) => cambiarEl(pag, panelSel, e.id, patch, claveH);
        const titulo = { personaje: '🧑 Personaje', objeto: '🎁 Objeto', bocadillo: '💬 Bocadillo', texto: '💥 Efecto' }[e.tipo];
        const cabecera = (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <b style={{ fontSize: '0.9rem' }}>{titulo} <span style={{ color: '#8395a7', fontWeight: 500 }}>· viñeta {panelSel + 1}</span></b>
                <button onClick={() => setSel((s) => ({ ...s, el: null }))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#8395a7', fontSize: '1rem' }} title="Cerrar">✕</button>
            </div>
        );
        const editorTexto = e.tipo === 'bocadillo' && (
            <textarea ref={textoRef} className="cmx-in" rows={3} value={e.texto} onChange={(ev) => set({ texto: ev.target.value }, 'txt' + e.id)}
                placeholder={e.pista ? `Pista: ${e.pista}` : 'Escribe aquí lo que dice…'}
                style={{ resize: 'vertical', fontFamily: "'Comic Sans MS', 'Comic Neue', cursive", fontWeight: 700, borderColor: e.pista && !e.texto ? '#e17055' : undefined }} />
        );

        if (e.fijo) {
            return (
                <div className="cmx-props" style={{ background: '#fff4ef', borderColor: '#fab1a0' }}>
                    {cabecera}
                    {e.tipo === 'bocadillo' && e.completar ? <>
                        <div style={{ fontSize: '0.8rem', color: '#d35400', fontWeight: 700, marginBottom: 6 }}>✏ Escribe tú este bocadillo</div>
                        {editorTexto}
                    </> : <div style={{ fontSize: '0.82rem', color: '#8395a7' }}>🔒 Esto lo ha puesto tu profe: no se puede mover ni borrar.</div>}
                </div>
            );
        }

        const comun = (
            <div className="cmx-fila" style={{ marginTop: 10 }}>
                <button className="cmx-chip" onClick={duplicarSel}>⧉ Duplicar</button>
                <button className="cmx-chip" onClick={() => moverCapa(1)} title="Delante de todo">⬆ Delante</button>
                <button className="cmx-chip" onClick={() => moverCapa(-1)} title="Detrás de todo">⬇ Detrás</button>
                <button className="cmx-chip" onClick={borrarSel} style={{ color: '#e74c3c', borderColor: '#fab1a0' }}>🗑 Quitar</button>
            </div>
        );
        const giro = e.tipo !== 'bocadillo' && (
            <Deslizador label="Girar" value={e.rot || 0} min={-180} max={180} sufijo="°" onEmpezar={() => guardarHist('rot' + e.id)} onChange={(v) => cambiarElSinHist(panelSel, e.id, { rot: v })} />
        );
        let cuerpo = null;
        if (e.tipo === 'personaje') {
            const { h } = geo.paneles[panelSel] || { h: 400 };
            cuerpo = <>
                <div className="cmx-fila">
                    <button className={`cmx-chip ${!e.cuerpo ? 'on' : ''}`} onClick={() => !e.cuerpo || set({ cuerpo: false, s: Math.round(e.s * 0.72), fy: Math.min(0.85, e.fy + 0.2) })}>🙂 Busto</button>
                    <button className={`cmx-chip ${e.cuerpo ? 'on' : ''}`} onClick={() => e.cuerpo || set({ cuerpo: true, pose: e.pose || 'pie', s: Math.round(Math.min(h * 0.9, e.s * 1.4)), fy: Math.max(0.45, e.fy - 0.2) })}>🧍 Cuerpo entero</button>
                </div>
                {e.cuerpo && <>
                    <div className="cmx-h">Pose</div>
                    <div className="cmx-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(62px,1fr))' }}>
                        {POSES.map((p) => <button key={p.id} className={`cmx-item ${(e.pose || 'pie') === p.id ? 'on' : ''}`} onClick={() => set({ pose: p.id })}><MiniCuerpo cfg={e.cfg} pose={p.id} />{p.label}</button>)}
                    </div>
                </>}
                <div className="cmx-h">Expresión</div>
                <div className="cmx-fila">
                    {MOODS_COMIC.map((m) => <button key={m.id} className={`cmx-chip ${(e.mood || 'neutral') === m.id ? 'on' : ''}`} onClick={() => set({ mood: m.id })} title={m.label}>{m.emoji} {m.label}</button>)}
                </div>
                <div className="cmx-fila" style={{ marginTop: 8 }}>
                    <button className="cmx-chip" onClick={() => set({ flip: !e.flip })}>↔ Voltear</button>
                    <button className="cmx-chip" onClick={() => setEditarAvatar({ pag, panel: panelSel, el: e.id })}>✏️ Cambiar aspecto</button>
                </div>
                <Deslizador label="Tamaño" value={e.s} min={40} max={1200} onEmpezar={() => guardarHist('s' + e.id)} onChange={(v) => cambiarElSinHist(panelSel, e.id, { s: v })} />
                {giro}
            </>;
        } else if (e.tipo === 'objeto') {
            cuerpo = <>
                <div className="cmx-fila"><button className="cmx-chip" onClick={() => set({ flip: !e.flip })}>↔ Voltear</button></div>
                <Deslizador label="Tamaño" value={e.s} min={30} max={900} onEmpezar={() => guardarHist('s' + e.id)} onChange={(v) => cambiarElSinHist(panelSel, e.id, { s: v })} />
                {giro}
            </>;
        } else if (e.tipo === 'bocadillo') {
            cuerpo = <>
                {editorTexto}
                <div className="cmx-fila" style={{ marginTop: 8 }}>
                    {ESTILOS_BOCADILLO.map((b) => <button key={b.id} className={`cmx-chip ${e.estilo === b.id ? 'on' : ''}`} onClick={() => set({ estilo: b.id, cola: b.id === 'cartela' ? null : (e.cola || { dx: 30, dy: 120 }) })}>{b.emoji} {b.label}</button>)}
                </div>
                {e.estilo !== 'cartela' && (
                    <div className="cmx-fila" style={{ marginTop: 8 }}>
                        <button className="cmx-chip" onClick={() => set({ cola: e.cola ? null : { dx: 30, dy: 120 } })}>{e.cola ? '✂ Quitar la cola' : '➕ Poner cola'}</button>
                        {e.cola && <span style={{ fontSize: '0.74rem', color: '#8395a7' }}>Arrastra el punto <b style={{ color: '#e17055' }}>●</b> hasta quien habla</span>}
                    </div>
                )}
                <Deslizador label="Letra" value={e.fs} min={14} max={80} onEmpezar={() => guardarHist('fs' + e.id)} onChange={(v) => cambiarElSinHist(panelSel, e.id, { fs: v })} />
                <Deslizador label="Ancho" value={e.w} min={60} max={900} onEmpezar={() => guardarHist('w' + e.id)} onChange={(v) => cambiarElSinHist(panelSel, e.id, { w: v })} />
                {!enAula && !e.pista && (
                    <label style={{ display: 'flex', gap: 7, alignItems: 'flex-start', marginTop: 10, fontSize: '0.8rem', cursor: 'pointer', background: e.completar ? '#fff1eb' : '#f8f9fb', border: `2px solid ${e.completar ? '#fab1a0' : '#dfe4ea'}`, borderRadius: 9, padding: '7px 9px' }}>
                        <input type="checkbox" checked={!!e.completar} onChange={(ev) => set({ completar: ev.target.checked })} style={{ marginTop: 2 }} />
                        <span><b>✏ Lo escribe el alumno</b> (para plantillas): le llega vacío y tu texto queda como pista.</span>
                    </label>
                )}
            </>;
        } else if (e.tipo === 'texto') {
            cuerpo = <>
                <input ref={textoRef} className="cmx-in" value={e.texto} onChange={(ev) => set({ texto: ev.target.value }, 'txt' + e.id)} style={{ fontFamily: FUENTE_ONOMATOPEYA, fontSize: '1.2rem' }} />
                <div className="cmx-h">Color de las letras</div>
                <div className="cmx-fila">{COLORES_TEXTO.map((c) => <span key={c} className={`cmx-sw ${e.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => set({ color: c })} />)}</div>
                <div className="cmx-fila" style={{ marginTop: 10 }}>
                    <button className={`cmx-chip ${e.estallido ? 'on' : ''}`} onClick={() => set({ estallido: !e.estallido })}>💥 Estallido detrás</button>
                </div>
                {e.estallido && <div className="cmx-fila" style={{ marginTop: 8 }}>{['#ffffff', ...COLORES_TEXTO.slice(0, 7)].map((c) => <span key={c} className={`cmx-sw ${e.colorEstallido === c ? 'on' : ''}`} style={{ background: c }} onClick={() => set({ colorEstallido: c })} />)}</div>}
                <Deslizador label="Tamaño" value={e.fs} min={16} max={320} onEmpezar={() => guardarHist('fs' + e.id)} onChange={(v) => cambiarElSinHist(panelSel, e.id, { fs: v })} />
                {giro}
            </>;
        }
        return <div className="cmx-props">{cabecera}{cuerpo}{comun}</div>;
    };

    const vDestino = panelDestino();
    const destino = <div style={{ fontSize: '0.76rem', color: '#8395a7', marginTop: 2 }}>
        {vDestino == null ? <b style={{ color: '#e17055' }}>En esta página no tienes viñetas.</b> : <>Se añade a la <b style={{ color: '#0984e3' }}>viñeta {vDestino + 1}</b>{comic.paginas.length > 1 ? ` de la página ${pag + 1}` : ''}. Toca otra viñeta para cambiar.</>}
    </div>;
    const miAvatar = getAvatarLocal();

    const contenidoPestana = () => {
        switch (pestana) {
            case 'vinetas': return <>
                {!colab && <>
                    <div className="cmx-h" style={{ marginTop: 0 }}>Título</div>
                    <input className="cmx-in" value={comic.titulo} onChange={(e) => cambiar((c) => ({ ...c, titulo: e.target.value }), 'titulo')} placeholder="Título del cómic" />
                    <input className="cmx-in" value={comic.autor} onChange={(e) => cambiar((c) => ({ ...c, autor: e.target.value }), 'autor')} placeholder="Autor o autora" style={{ marginTop: 6 }} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', marginTop: 6, cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!comic.mostrarTitulo} onChange={(e) => cambiar((c) => ({ ...c, mostrarTitulo: e.target.checked }))} /> Mostrar el título en la primera página
                    </label>
                    <div className="cmx-h">Distribución de la página {pag + 1}</div>
                    <div className="cmx-grid">
                        {DISPOSICIONES.map((d) => <button key={d.id} className={`cmx-item ${pagina.disposicion === d.id ? 'on' : ''}`} onClick={() => cambiarDisposicion(d.id)}><MiniDisposicion d={d} />{d.label}</button>)}
                    </div>
                </>}
                {panelSel != null && <>
                    <div className="cmx-h">Fondo de la viñeta {panelSel + 1}</div>
                    <div className="cmx-grid">
                        {FONDOS.map((f) => <button key={f.id} className={`cmx-item ${vinetaSel.fondo === f.id ? 'on' : ''}`} onClick={() => cambiarVineta(panelSel, { fondo: f.id })}>
                            {f.id === 'liso' ? <div style={{ width: '100%', aspectRatio: '4 / 3', borderRadius: 6, background: vinetaSel.color || '#fff', border: '1px solid #dfe4ea' }} /> : <MiniFondo f={f} />}{f.label}
                        </button>)}
                    </div>
                    {vinetaSel.fondo === 'liso' && <>
                        <div className="cmx-h">Color</div>
                        <div className="cmx-fila">{COLORES_VINETA.map((c) => <span key={c} className={`cmx-sw ${vinetaSel.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => cambiarVineta(panelSel, { color: c })} />)}</div>
                    </>}
                    <div className="cmx-fila" style={{ marginTop: 12 }}>
                        {!colab && <button className="cmx-chip" onClick={() => cambiar((c) => conPagina(c, pag, (x) => ({ ...x, vinetas: x.vinetas.map((v) => ({ ...v, fondo: vinetaSel.fondo, color: vinetaSel.color })) })))}>Usar este fondo en toda la página</button>}
                        <button className="cmx-chip" onClick={vaciarVineta} style={{ color: '#e74c3c' }}>Vaciar viñeta</button>
                    </div>
                </>}
                {panelSel == null && <p style={{ fontSize: '0.82rem', color: '#8395a7' }}>Toca una viñeta para cambiarle el fondo.</p>}
            </>;
            case 'personajes': {
                const mini = (cfg) => (cuerpoEntero ? <MiniCuerpo cfg={cfg} /> : <AvatarSVG config={cfg} size={58} />);
                return <>
                    {destino}
                    <div className="cmx-fila" style={{ marginTop: 10 }}>
                        <button className={`cmx-chip ${!cuerpoEntero ? 'on' : ''}`} onClick={() => setCuerpoEntero(false)}>🙂 Busto</button>
                        <button className={`cmx-chip ${cuerpoEntero ? 'on' : ''}`} onClick={() => setCuerpoEntero(true)}>🧍 Cuerpo entero</button>
                    </div>
                    <div className="cmx-h">Elige un personaje</div>
                    <div className="cmx-grid">
                        {miAvatar && <button className="cmx-item" onClick={() => anadirPersonaje(miAvatar)}>{mini(miAvatar)}Mi avatar</button>}
                        {PERSONAJES_PRESET.map((cfg, i) => <button key={i} className="cmx-item" onClick={() => anadirPersonaje(cfg)}>{mini(cfg)}</button>)}
                        <button className="cmx-item" onClick={() => anadirPersonaje(avatarAleatorio())}><div style={{ fontSize: 34, lineHeight: cuerpoEntero ? '78px' : '58px' }}>🎲</div>Al azar</button>
                        <button className="cmx-item" onClick={() => setEditarAvatar('nuevo')}><div style={{ fontSize: 34, lineHeight: cuerpoEntero ? '78px' : '58px' }}>✏️</div>Crear</button>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: '#8395a7', marginTop: 12 }}>Al seleccionar un personaje puedes cambiar su expresión, su pose (cuerpo entero) o pasarlo de busto a cuerpo entero. Tócalo dos veces para cambiar su aspecto.</p>
                </>;
            }
            case 'objetos': return <>
                {destino}
                <div className="cmx-h">Objetos</div>
                <div className="cmx-grid">
                    {OBJETOS.map((o) => { const O = o.dibujo; return <button key={o.id} className="cmx-item" onClick={() => anadirObjeto(o.id)}><svg viewBox="0 0 100 100" width="52" height="52"><O /></svg>{o.label}</button>; })}
                </div>
            </>;
            case 'bocadillos': return <>
                {destino}
                <div className="cmx-h">Tipo de bocadillo</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {ESTILOS_BOCADILLO.map((b) => <button key={b.id} className="cmx-chip" style={{ textAlign: 'left', padding: '10px 12px', fontSize: '0.92rem' }} onClick={() => anadirBocadillo(b.id, b.texto)}>{b.emoji} {b.label} <span style={{ color: '#8395a7', fontWeight: 500 }}>— «{b.texto}»</span></button>)}
                </div>
                <p style={{ fontSize: '0.78rem', color: '#8395a7', marginTop: 12 }}>Arrastra el bocadillo para moverlo y el punto naranja para dirigir la cola hacia quien habla. El asa azul cambia el ancho.</p>
            </>;
            case 'efectos': return <>
                {destino}
                <div className="cmx-h">Onomatopeyas</div>
                <div className="cmx-fila">
                    {ONOMATOPEYAS.map((t) => <button key={t} className="cmx-chip" style={{ fontFamily: FUENTE_ONOMATOPEYA, fontWeight: 400, fontSize: '1rem' }} onClick={() => anadirTexto(t)}>{t}</button>)}
                    <button className="cmx-chip" onClick={() => { anadirTexto('¡TEXTO!'); setTimeout(() => { textoRef.current?.focus(); textoRef.current?.select(); }, 60); }}>✏️ Escribir el mío</button>
                </div>
            </>;
            default: return null;
        }
    };

    const guardarAvatarEditado = (cfg) => {
        if (editarAvatar === 'nuevo') anadirPersonaje(cfg);
        else if (editarAvatar) cambiarEl(editarAvatar.pag, editarAvatar.panel, editarAvatar.el, { cfg });
        setEditarAvatar(null);
    };
    const avatarInicial = editarAvatar && editarAvatar !== 'nuevo'
        ? comic.paginas[editarAvatar.pag]?.vinetas[editarAvatar.panel]?.els.find((e) => e.id === editarAvatar.el)?.cfg
        : (miAvatar || PERSONAJES_PRESET[0]);

    const consigna = aula?.consigna || comic.plantilla?.consigna;
    const nPaginas = comic.paginas.length;
    const misPaginas = colab ? new Set([...aula.editables].map((k) => Number(k.split('-')[0]))) : null;

    return (
        <div className={`cmx-root${aula?.incrustado ? ' incrustado' : ''}`}>
            <style>{CSS}</style>
            <div className="cmx-top">
                {onExit && <button className="cmx-btn" onClick={onExit}>← <span className="cmx-txt">Volver</span></button>}
                <b className="cmx-nombre" style={{ fontSize: '1.05rem', marginRight: 6 }}>💬 {enAula ? (aula.titulo || 'Cómic') : 'Creador de cómics'}</b>
                {!soloLectura && <>
                    <button className="cmx-btn" onClick={deshacer} disabled={!hist.current.atras.length} title="Deshacer (Ctrl+Z)">↶</button>
                    <button className="cmx-btn" onClick={rehacer} disabled={!hist.current.adelante.length} title="Rehacer (Ctrl+Y)">↷</button>
                </>}
                <div style={{ flex: 1 }} />
                {!enAula && <>
                    <button className="cmx-btn" onClick={nuevoComic}>📄 <span className="cmx-txt">Nuevo</span></button>
                    <button className="cmx-btn" onClick={() => setModal('mis')}>📚 <span className="cmx-txt">Mis cómics</span></button>
                    {!comic.plantilla && <button className="cmx-btn" onClick={() => { setSel((s) => ({ ...s, el: null })); setModal('plantilla'); }} title="Crear un enlace para que tus alumnos completen este cómic">🎓 <span className="cmx-txt">Plantilla</span></button>}
                </>}
                <div style={{ position: 'relative' }}>
                    <button className="cmx-btn azul" onClick={() => setMenuDescarga((v) => !v)}>🖼️ <span className="cmx-txt">Descargar</span> ▾</button>
                    {menuDescarga && <div className="cmx-menu" onPointerLeave={() => setMenuDescarga(false)}>
                        <button onClick={() => descargar(false)}>🖼️ Esta página (PNG)</button>
                        {nPaginas > 1 && <button onClick={() => descargar(true)}>📜 Todas las páginas (un PNG)</button>}
                        <button onClick={imprimir}>🖨️ Imprimir{nPaginas > 1 ? ' todas las páginas' : ''}</button>
                    </div>}
                </div>
                {!enAula && <button className="cmx-btn prim" onClick={() => { setSel((s) => ({ ...s, el: null })); setModal('enviar'); }}>📤 <span className="cmx-txt">Enviar al profe</span></button>}
                {enAula && aula.onEntregar && !soloLectura && <button className="cmx-btn verde" onClick={aula.onEntregar}>✅ <span className="cmx-txt">{aula.textoEntregar || 'Entregar'}</span></button>}
            </div>
            {consigna && <div className="cmx-consigna"><span>🎓</span><span><b>{comic.plantilla?.titulo && !aula ? `${comic.plantilla.titulo}: ` : ''}</b>{consigna}</span></div>}
            {aula?.aviso && <div className="cmx-consigna" style={{ background: '#e8f3ff', borderColor: '#b6d7ff', color: '#0b4f8a' }}><span>ℹ️</span><span>{aula.aviso}</span></div>}
            <div className="cmx-main">
                <div className="cmx-izq">
                    {(nPaginas > 1 || (!colab && !soloLectura)) && (
                        <div className="cmx-paginas">
                            {comic.paginas.map((_, i) => <button key={i} className={`cmx-pag ${i === pag ? 'on' : ''}`} onClick={() => irPagina(i)}>
                                Pág. {i + 1}{misPaginas?.has(i) ? ' ✏' : ''}
                            </button>)}
                            {!colab && !soloLectura && <>
                                <button className="cmx-pag" onClick={nuevaPagina} title="Añadir una página">➕ Página</button>
                                {nPaginas > 1 && <>
                                    <button className="cmx-pag" onClick={() => moverPagina(-1)} disabled={pag === 0} title="Mover a la izquierda">◀</button>
                                    <button className="cmx-pag" onClick={() => moverPagina(1)} disabled={pag === nPaginas - 1} title="Mover a la derecha">▶</button>
                                </>}
                                <button className="cmx-pag" onClick={duplicarPagina} title="Duplicar la página">⧉</button>
                                {nPaginas > 1 && <button className="cmx-pag" onClick={borrarPagina} title="Borrar la página" style={{ color: '#e74c3c' }}>🗑</button>}
                            </>}
                        </div>
                    )}
                    <div className="cmx-lienzo" onPointerDown={() => setSel((s) => ({ ...s, el: null }))}>
                        <div>
                            <ComicPagina comic={vista} seleccion={panelSel != null ? { panel: panelSel, el: sel.el } : null} editable={!soloLectura} svgRef={svgRef}
                                onSeleccionar={onSeleccionar} onCambiarEl={cambiarElSinHist} onInicioCambio={onInicioCambio} onDoble={onDoble}
                                idPrefijo={`cmx${pag}`} vinetaEditable={colab ? editableEnPagina : undefined} etiquetas={etiquetasPagina} marcas={!enAula && !comic.plantilla} />
                        </div>
                    </div>
                </div>
                {!soloLectura && (
                    <div className="cmx-lado">
                        <div className="cmx-tabs">
                            {PESTANAS.map((p) => <button key={p.id} className={`cmx-tab ${pestana === p.id ? 'on' : ''}`} onClick={() => setPestana(p.id)}><span>{p.emoji}</span>{p.label}</button>)}
                        </div>
                        <div className="cmx-scroll">
                            {props()}
                            {contenidoPestana()}
                        </div>
                    </div>
                )}
            </div>

            {/* Páginas para exportar (sin selección), solo mientras se exporta */}
            {exportando && <div style={{ position: 'fixed', left: -100000, top: 0, width: 1000 }} aria-hidden="true">
                {comic.paginas.map((_, i) => {
                    const v = vistaPagina(comic, i);
                    const g = calcularPagina(v);
                    return <div key={i} style={{ width: 1000, height: g.H }}><ComicPagina comic={v} idPrefijo={`exp${i}`} svgRef={{ get current() { return exportRefs.current[i]; }, set current(n) { exportRefs.current[i] = n; } }} /></div>;
                })}
            </div>}

            {aviso && <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: '#2d3436', color: 'white', padding: '10px 18px', borderRadius: 12, fontWeight: 700, zIndex: 10002, boxShadow: '0 6px 20px rgba(0,0,0,0.3)', maxWidth: '90vw', textAlign: 'center' }}>{aviso}</div>}
            {modal === 'mis' && <ModalMisComics lista={lista} actualId={comic.id} onAbrir={abrirComic} onBorrar={borrarComic} onDuplicar={duplicarComic} onClose={() => setModal(null)} />}
            {modal === 'enviar' && <ModalEnviarProfe comic={comic} nVinetas={nTotal} onClose={() => setModal(null)} onEnviado={(nombre, curso) => registrar('profe', nombre, curso)} />}
            {modal === 'plantilla' && <ModalPlantilla comic={comic} onClose={() => setModal(null)} />}
            {editarAvatar && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10001, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 12 }}>
                    <div style={{ background: '#1e272e', color: 'white', borderRadius: 18, width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', padding: '16px 18px' }}>
                        <AvatarEditor inicial={avatarInicial} onGuardar={guardarAvatarEditado} onCancelar={() => setEditarAvatar(null)} />
                    </div>
                </div>
            )}
        </div>
    );
}
