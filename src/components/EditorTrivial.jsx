import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import {
    collection, doc, addDoc, setDoc, getDocs, updateDoc, deleteDoc,
    query, where, serverTimestamp, orderBy
} from 'firebase/firestore';
import { traducirLote, IDIOMAS } from '../i18n/translateGemini';

// Idiomas ofrecidos para traducir un recurso (sin el original español).
const IDIOMAS_TRAD = Object.entries(IDIOMAS).filter(([c]) => c !== 'es');

// Campos de una pregunta que el juego MUESTRA traducidos (coherente con Trivial.jsx):
// enunciado siempre; en SELECCIÓN las opciones; en RELLENAR los fragmentos de la
// frase (NO la respuesta escrita ni los bloques de ORDENAR, que son la solución).
function camposTraducibles(p) {
    const tipo = p.tipo || 'SELECCION';
    const campos = []; // [claveCampo, textoOriginal]
    if (p.q && p.q.trim()) campos.push(['q', p.q]);
    if (tipo === 'SELECCION') {
        if (p.a && p.a.trim()) campos.push(['a', p.a]);
        (p.w || []).forEach((w, i) => { if (w && w.trim()) campos.push([`w${i}`, w]); });
    } else if (tipo === 'RELLENAR') {
        if (p.bloques?.[0]?.trim()) campos.push(['b0', p.bloques[0]]);
        if (p.bloques?.[2]?.trim()) campos.push(['b2', p.bloques[2]]);
    }
    return campos;
}

const CAT_HEX = { geo: '#3498db', esp: '#e84393', his: '#f1c40f', art: '#9b59b6', cie: '#2ecc71', dep: '#e67e22' };

const EMOJI_GRUPOS = [
    { label: 'Geografía', emojis: ['🌍','🌎','🌏','🗺️','🏔️','⛰️','🌋','🏝️','🌊','🏜️','❄️','☀️','🌙','⭐','🌈','🌪️','🗼','🏛️','🗽','🌐','⛩️','🏯','🗿','🌴','🌵','🐚'] },
    { label: 'Ciencias',  emojis: ['🔬','🧬','🧪','⚗️','🔭','💡','⚡','🧲','🔋','🌡️','🦠','🧫','💻','🤖','🛸','🧩','🔮','🧿','🩺','💊','⚛️','🧮','📡','🌌'] },
    { label: 'Historia',  emojis: ['📜','⚔️','🛡️','👑','🏺','🗡️','🪖','⚓','🚢','🪙','💰','🔑','🕌','⛪','🏰','⛵','🧭','🪬','📯','🏇'] },
    { label: 'Arte',      emojis: ['🎨','🖌️','✏️','📝','🎭','🎬','🎵','🎶','🎸','🎹','🎺','🎻','🥁','🎤','📷','📸','🎪','🖼️','🎼','🎧','📻','📺','🎞️'] },
    { label: 'Deportes',  emojis: ['⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱','🏊','🚴','⛷️','🏋️','🥊','🏆','🥇','🎿','🏄','🤸','🏌️','🎯','🏹','🛹','🥋','🏇'] },
    { label: 'Naturaleza',emojis: ['🌿','🌸','🌺','🌻','🍀','🌱','🍁','🍃','🦁','🐯','🐘','🦒','🐬','🦅','🦋','🐝','🦊','🐺','🦋','🐙','🦈','🐲','🌾','🍄'] },
    { label: 'Varios',    emojis: ['📚','🎓','💎','🌟','💫','✨','🎲','🎮','🧠','🔑','🎁','🏅','🥚','🧸','🎠','🎡','🎢','🛕','🔔','🕯️','🪄','💈','🧿'] },
];

const cleanPrev = s => s ? String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim() : '';
const CAT_IDS = ['geo', 'esp', 'his', 'art', 'cie', 'dep'];
const CAT_DEFAULTS = {
    geo: { nombre: 'Geografía',    emoji: '🌍', desc: '' },
    esp: { nombre: 'Espectáculos', emoji: '🎬', desc: '' },
    his: { nombre: 'Historia',     emoji: '📜', desc: '' },
    art: { nombre: 'Arte y Lit.',  emoji: '🎨', desc: '' },
    cie: { nombre: 'Ciencias',     emoji: '🔬', desc: '' },
    dep: { nombre: 'Deportes',     emoji: '⚽', desc: '' },
};

function buildCats(stored) {
    const out = {};
    for (const id of CAT_IDS) {
        out[id] = { imagen: '', ...CAT_DEFAULTS[id], ...(stored?.[id] || {}) };
    }
    return out;
}

function genCode(len = 8) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
}

export default function EditorTrivial({ recurso, usuario, onClose, onSaved }) {
    const esNuevo   = !recurso?.id;
    const esCreador = esNuevo || recurso?.creadorUid === usuario?.uid;

    // ── Metadata ──────────────────────────────────────────────────────────────
    const [titulo,           setTitulo]           = useState(recurso?.titulo        || '');
    const [descripcion,      setDescripcion]      = useState(recurso?.descripcion   || '');
    const [publica,          setPublica]          = useState(recurso?.publica       ?? true);
    const [recursoId,        setRecursoId]        = useState(recurso?.id            || null);
    const [codigosCategoria, setCodigosCategoria] = useState(recurso?.codigosCategoria || null);
    const [colaboradores,    setColaboradores]    = useState(recurso?.colaboradores  || []);
    const [codigoJuego,      setCodigoJuego]      = useState(recurso?.codigoJuego   || null);
    const [codigoEnvio,      setCodigoEnvio]      = useState(recurso?.codigoEnvio   || null);

    // ── Category customisation ─────────────────────────────────────────────────
    const [categorias, setCategorias] = useState(() => buildCats(recurso?.categorias));

    // ── Questions ─────────────────────────────────────────────────────────────
    const [tabActiva,         setTabActiva]         = useState('geo');
    const [preguntas,         setPreguntas]         = useState({ geo:[], esp:[], his:[], art:[], cie:[], dep:[] });
    const [preguntasCargadas, setPreguntasCargadas] = useState({});
    const [cargandoPreguntas, setCargandoPreguntas] = useState(false);

    // ── Pending questions (Question Sender submissions) ────────────────────────
    const [pendientes,        setPendientes]        = useState({ geo:[], esp:[], his:[], art:[], cie:[], dep:[] });
    const [pendientesCargados,setPendientesCargados]= useState(false);

    // ── Submission code generation ─────────────────────────────────────────────
    const [generandoCodigo, setGenerandoCodigo] = useState(false);

    // ── Category config panel ──────────────────────────────────────────────────
    const [catConfigAbierto, setCatConfigAbierto] = useState(false);
    const [guardandoCat,     setGuardandoCat]     = useState(false);
    const [savedCat,         setSavedCat]         = useState(false);
    const [emojiPickerAbierto, setEmojiPickerAbierto] = useState(false);
    const emojiPickerRef = useRef(null);

    // ── Question preview ───────────────────────────────────────────────────────
    const [previewPregunta,  setPreviewPregunta]  = useState(null);
    const [previewRevelado,  setPreviewRevelado]  = useState(false);
    const [previewOrden,     setPreviewOrden]     = useState({ available: [], slots: [] });
    const [previewInput,     setPreviewInput]     = useState('');
    const [previewHablando,  setPreviewHablando]  = useState(false);

    // ── Add-question form ──────────────────────────────────────────────────────
    const [formAbierto,        setFormAbierto]      = useState(false);
    const [formTipo,           setFormTipo]         = useState('SELECCION');
    const [formQ,              setFormQ]            = useState('');
    const [formA,              setFormA]            = useState('');
    const [formW,              setFormW]            = useState(['', '', '']);
    const [formBloques,        setFormBloques]      = useState(['', '']);
    const [formAlternativas,   setFormAlternativas] = useState([]);
    const [formLectura,        setFormLectura]      = useState('');
    const [formLecturaIdioma,  setFormLecturaIdioma]= useState('es-ES');
    const [formDificultad,     setFormDificultad]   = useState('normal'); // 'normal' | 'dificil'
    const [guardandoPregunta,  setGuardandoPregunta]= useState(false);
    const [errorForm,          setErrorForm]        = useState('');

    // ── Edit-question form ─────────────────────────────────────────────────────
    const [editandoPregId,  setEditandoPregId]  = useState(null);
    const [editForm,        setEditForm]        = useState(null);
    const [guardandoEdicion,setGuardandoEdicion]= useState(false);

    // ── Collaboration ──────────────────────────────────────────────────────────
    const [panelColab,    setPanelColab]    = useState(false);
    const [emailNuevo,    setEmailNuevo]    = useState('');
    const [agregandoColab,setAgregandoColab]= useState(false);
    const [errorColab,    setErrorColab]    = useState('');

    // ── Import modal ──────────────────────────────────────────────────────────
    const [importModal,    setImportModal]    = useState(false);
    const [importStep,     setImportStep]     = useState(1);
    const [importTipo,     setImportTipo]     = useState('');
    const [importRecursos, setImportRecursos] = useState([]);
    const [importRecurso,  setImportRecurso]  = useState(null);
    const [importHojaIdx,  setImportHojaIdx]  = useState(-1);
    const [importPregs,    setImportPregs]    = useState([]);
    const [importSel,      setImportSel]      = useState(new Set());
    const [importCat,      setImportCat]      = useState('geo');
    const [importCargando, setImportCargando] = useState(false);
    const [importGuardando,setImportGuardando]= useState(false);
    const [importError,    setImportError]    = useState('');

    // ── Save ───────────────────────────────────────────────────────────────────
    const [guardando,    setGuardando]    = useState(false);
    const [errorGuardar, setErrorGuardar] = useState('');
    const [copiado,      setCopiado]      = useState('');

    // ── Traducción del recurso ─────────────────────────────────────────────────
    const [tradPanel,     setTradPanel]     = useState(false);
    const [tradIdioma,    setTradIdioma]    = useState('en');
    const [traduciendo,   setTraduciendo]   = useState(false);
    const [tradProgreso,  setTradProgreso]  = useState('');
    const [tradError,     setTradError]     = useState('');
    const [tradGuardando, setTradGuardando] = useState(false);
    const [tradGuardado,  setTradGuardado]  = useState(false);
    const [idiomasTrad,   setIdiomasTrad]   = useState(recurso?.idiomasTraducidos || []);
    // Borrador de revisión: { [pregId]: { q, a, w:[...], b0, b2 } } (solo campos aplicables)
    const [tradBorrador,  setTradBorrador]  = useState({});

    // ── Responsive ───────────────────────────────────────────────────────────────
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);

    // ── Effects ────────────────────────────────────────────────────────────────
    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        if (!emojiPickerAbierto) return;
        const handler = (e) => { if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) setEmojiPickerAbierto(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [emojiPickerAbierto]);

    useEffect(() => {
        if (recursoId) cargarTodasLasPreguntas();
    }, [recursoId]);

    useEffect(() => {
        if (recursoId && !preguntasCargadas[tabActiva]) cargarPreguntas(tabActiva);
        // Clear question form when switching tabs
        setFormAbierto(false);
        setFormTipo('SELECCION'); setFormQ(''); setFormA(''); setFormW(['', '', '']); setFormBloques(['', '']); setFormAlternativas([]);
        setFormLectura(''); setFormLecturaIdioma('es-ES'); setFormDificultad('normal'); setErrorForm('');
    }, [recursoId, tabActiva]);

    useEffect(() => {
        if (recursoId && !pendientesCargados) cargarPendientes();
    }, [recursoId]);

    // ── Loaders ────────────────────────────────────────────────────────────────
    const cargarTodasLasPreguntas = async () => {
        setCargandoPreguntas(true);
        try {
            const snap = await getDocs(
                query(collection(db, 'trivial_recursos', recursoId, 'preguntas'), orderBy('fechaCreacion', 'asc'))
            );
            const por_cat = { geo: [], esp: [], his: [], art: [], cie: [], dep: [] };
            for (const d of snap.docs) {
                const data = { id: d.id, ...d.data() };
                if (por_cat[data.categoria]) por_cat[data.categoria].push(data);
            }
            const cargadas = {};
            for (const cat of CAT_IDS) {
                por_cat[cat].sort((a, b) => (a.orden ?? a.fechaCreacion?.seconds ?? 0) - (b.orden ?? b.fechaCreacion?.seconds ?? 0));
                cargadas[cat] = true;
            }
            setPreguntas(por_cat);
            setPreguntasCargadas(cargadas);
        } catch (e) { console.error(e); }
        setCargandoPreguntas(false);
    };

    const cargarPreguntas = async (cat) => {
        setCargandoPreguntas(true);
        try {
            const snap = await getDocs(
                query(collection(db, 'trivial_recursos', recursoId, 'preguntas'),
                    where('categoria', '==', cat), orderBy('fechaCreacion', 'asc'))
            );
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Sort by explicit orden if present, else preserve load order
            docs.sort((a, b) => {
                const oa = a.orden ?? a.fechaCreacion?.seconds ?? 0;
                const ob = b.orden ?? b.fechaCreacion?.seconds ?? 0;
                return oa - ob;
            });
            setPreguntas(prev => ({ ...prev, [cat]: docs }));
            setPreguntasCargadas(prev => ({ ...prev, [cat]: true }));
        } catch (e) { console.error(e); }
        setCargandoPreguntas(false);
    };

    const cargarPendientes = async () => {
        if (!recursoId) return;
        try {
            const snap = await getDocs(
                query(collection(db, 'trivial_recursos', recursoId, 'preguntas_pendientes'),
                    orderBy('fechaCreacion', 'asc'))
            );
            const todas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const por_cat = { geo:[], esp:[], his:[], art:[], cie:[], dep:[] };
            for (const p of todas) { if (por_cat[p.categoria]) por_cat[p.categoria].push(p); }
            setPendientes(por_cat);
            setPendientesCargados(true);
        } catch (e) { console.error(e); }
    };

    // ── Import helpers ─────────────────────────────────────────────────────────
    const abrirImport = () => {
        setImportStep(1); setImportTipo(''); setImportRecursos([]); setImportRecurso(null);
        setImportHojaIdx(-1); setImportPregs([]); setImportSel(new Set());
        setImportCat(tabActiva); setImportError(''); setImportModal(true);
    };

    const cargarRecursosImport = async (tipoJuego) => {
        setImportCargando(true); setImportError('');
        try {
            const snap = await getDocs(
                query(collection(db, 'resources'),
                    where('profesorUid', '==', usuario.uid),
                    where('tipoJuego', '==', tipoJuego))
            );
            setImportRecursos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { setImportError('Error al cargar recursos.'); }
        setImportCargando(false);
    };

    const calcImportPregs = (recurso, hojaIdx) => {
        const hojas = recurso?.hojas || [];
        const srcs = hojaIdx === -1 ? hojas.map((h, i) => ({ h, i })) : [{ h: hojas[hojaIdx], i: hojaIdx }];
        return srcs.flatMap(({ h, i }) =>
            (h?.preguntas || []).map((q, qi) => ({ hoja: h.nombreHoja || `Hoja ${i + 1}`, hojaIdx: i, qi, q }))
        );
    };

    const isImportable = (tipo, q) => {
        if (tipo === 'PASAPALABRA') return !!(q.pregunta && q.respuesta);
        if (tipo === 'CAZABURBUJAS') return !!(q.pregunta && (q.correcta || q.respuesta) && q.incorrectas?.length);
        if (tipo === 'APAREJADOS') return !!(q.terminoA && q.terminoB);
        return false;
    };

    const confirmarImport = async () => {
        if (!recursoId || importSel.size === 0) return;
        setImportGuardando(true); setImportError('');
        try {
            const base = {
                categoria: importCat, creadorUid: usuario.uid, autorUid: usuario.uid,
                autorNombre: usuario.displayName || usuario.email, fechaCreacion: serverTimestamp(),
            };
            const nuevas = [];
            for (const idx of importSel) {
                const item = importPregs[idx]; if (!item) continue;
                const q = item.q; let datos;
                if (importTipo === 'PASAPALABRA') {
                    datos = { ...base, tipo: 'CORTA', q: q.pregunta, a: q.respuesta };
                } else if (importTipo === 'CAZABURBUJAS') {
                    const correcta = q.correcta || q.respuesta || '';
                    const incs = [...(q.incorrectas || [])].slice(0, 3);
                    while (incs.length < 3) incs.push('');
                    datos = { ...base, tipo: 'SELECCION', q: q.pregunta, a: correcta, w: incs };
                } else if (importTipo === 'APAREJADOS') {
                    datos = { ...base, tipo: 'CORTA', q: q.terminoA, a: q.terminoB };
                }
                if (datos) {
                    const ref = await addDoc(collection(db, 'trivial_recursos', recursoId, 'preguntas'), datos);
                    nuevas.push({ id: ref.id, ...datos });
                }
            }
            setPreguntas(prev => ({ ...prev, [importCat]: [...prev[importCat], ...nuevas] }));
            setImportModal(false);
        } catch (e) { setImportError('Error al importar.'); }
        setImportGuardando(false);
    };

    // ── Category helpers ───────────────────────────────────────────────────────
    const updateCat = (field, value) => {
        setCategorias(prev => ({ ...prev, [tabActiva]: { ...prev[tabActiva], [field]: value } }));
    };

    const guardarCategoria = async () => {
        if (!recursoId) return;
        setGuardandoCat(true);
        try {
            await updateDoc(doc(db, 'trivial_recursos', recursoId), { categorias, fechaModificacion: serverTimestamp() });
            if (codigoEnvio) {
                await updateDoc(doc(db, 'trivial_envio_codigos', codigoEnvio), { categorias });
            }
            setSavedCat(true);
            setTimeout(() => setSavedCat(false), 1800);
        } catch (e) { console.error(e); }
        setGuardandoCat(false);
    };

    // ── Submission code ────────────────────────────────────────────────────────
    const generarCodigoEnvio = async () => {
        if (!recursoId) return;
        setGenerandoCodigo(true);
        const code = genCode(8);
        try {
            await Promise.all([
                updateDoc(doc(db, 'trivial_recursos', recursoId), { codigoEnvio: code }),
                setDoc(doc(db, 'trivial_envio_codigos', code), {
                    recursoId,
                    titulo: titulo.trim(),
                    categorias,
                    creadorNombre: usuario.displayName || usuario.email,
                }),
            ]);
            setCodigoEnvio(code);
        } catch (e) { console.error(e); }
        setGenerandoCodigo(false);
    };

    // ── Save resource ──────────────────────────────────────────────────────────
    const guardarRecurso = async () => {
        if (!titulo.trim()) { setErrorGuardar('El título es obligatorio.'); return; }

        // If question form is open, handle it before saving resource
        if (formAbierto) {
            const completa = formQ.trim() && formA.trim() && formW.every(w => w.trim());
            const parcial  = formQ.trim() || formA.trim() || formW.some(w => w.trim());
            if (completa) {
                await agregarPregunta(); // saves question and closes form
            } else if (parcial) {
                setErrorGuardar('Completa o cancela la pregunta antes de guardar.');
                return;
            }
        }

        setGuardando(true);
        setErrorGuardar('');
        try {
            if (esNuevo) {
                const codigos = {};
                for (const cat of CAT_IDS) codigos[cat] = genCode(8);
                const codigoJ = genCode(6);
                const data = {
                    titulo: titulo.trim(), descripcion: descripcion.trim(), publica,
                    categorias,
                    creadorUid: usuario.uid, creadorEmail: usuario.email,
                    creadorNombre: usuario.displayName || usuario.email,
                    codigosCategoria: codigos, codigoJuego: codigoJ,
                    colaboradores: [], colaboradoresUids: [],
                    tipoJuego: 'TRIVIAL',
                    fechaCreacion: serverTimestamp(), fechaModificacion: serverTimestamp(),
                };
                const ref = await addDoc(collection(db, 'trivial_recursos'), data);
                await Promise.all(Object.entries(codigos).map(([cat, code]) =>
                    setDoc(doc(db, 'trivial_inv_codigos', code), { recursoId: ref.id, categoria: cat, titulo: titulo.trim() })
                ));
                setRecursoId(ref.id);
                setCodigosCategoria(codigos);
                setCodigoJuego(codigoJ);
                if (onSaved) onSaved({ id: ref.id, ...data, codigosCategoria: codigos });
            } else {
                await updateDoc(doc(db, 'trivial_recursos', recursoId), {
                    titulo: titulo.trim(), descripcion: descripcion.trim(), publica,
                    categorias, fechaModificacion: serverTimestamp(),
                });
                if (codigoEnvio) {
                    await updateDoc(doc(db, 'trivial_envio_codigos', codigoEnvio), { titulo: titulo.trim(), categorias });
                }
                if (onSaved) onSaved({ id: recursoId, titulo: titulo.trim(), descripcion: descripcion.trim(), publica });
            }
        } catch (e) { console.error(e); setErrorGuardar('Error al guardar. Inténtalo de nuevo.'); }
        setGuardando(false);
    };

    // ── Questions CRUD ─────────────────────────────────────────────────────────
    const agregarPregunta = async () => {
        setErrorForm('');
        if (!recursoId) { setErrorGuardar('Guarda el recurso primero (botón "Crear" arriba).'); return; }

        const lecturaData = formLectura.trim() ? { lectura: formLectura.trim(), lecturaIdioma: formLecturaIdioma } : {};
        let data = { categoria: tabActiva, tipo: formTipo, dificultad: formDificultad, autorUid: usuario.uid, autorNombre: usuario.displayName || usuario.email, fechaCreacion: serverTimestamp(), orden: Date.now(), ...lecturaData };

        if (formTipo === 'SELECCION') {
            if (!formQ.trim()) { setErrorForm('Escribe la pregunta.'); return; }
            if (!formA.trim()) { setErrorForm('Escribe la respuesta correcta.'); return; }
            if (formW.some(w => !w.trim())) { setErrorForm('Completa las tres respuestas incorrectas.'); return; }
            data = { ...data, q: formQ.trim(), a: formA.trim(), w: formW.map(s => s.trim()) };
        } else if (formTipo === 'CORTA') {
            if (!formQ.trim()) { setErrorForm('Escribe la pregunta.'); return; }
            if (!formA.trim()) { setErrorForm('Escribe la respuesta.'); return; }
            const alts = formAlternativas.map(s => s.trim()).filter(Boolean);
            data = { ...data, q: formQ.trim(), a: formA.trim() };
            if (alts.length) data = { ...data, alternativas: alts };
        } else if (formTipo === 'RELLENAR') {
            if (!formBloques[0].trim()) { setErrorForm('Escribe el texto antes del hueco.'); return; }
            if (!formBloques[1].trim()) { setErrorForm('Escribe la respuesta correcta.'); return; }
            const alts = formAlternativas.map(s => s.trim()).filter(Boolean);
            data = { ...data, bloques: [formBloques[0].trim(), formBloques[1].trim(), formBloques[2]?.trim() || ''] };
            if (alts.length) data = { ...data, alternativas: alts };
        } else if (formTipo === 'ORDENAR') {
            const items = formBloques.filter(b => b.trim());
            if (items.length < 2) { setErrorForm('Añade al menos 2 elementos para ordenar.'); return; }
            data = { ...data, q: formQ.trim(), bloques: items };
        }

        setGuardandoPregunta(true);
        try {
            const ref = await addDoc(collection(db, 'trivial_recursos', recursoId, 'preguntas'), data);
            setPreguntas(prev => ({ ...prev, [tabActiva]: [...prev[tabActiva], { id: ref.id, ...data }] }));
            setFormQ(''); setFormA(''); setFormW(['', '', '']); setFormBloques(['', '']); setFormAlternativas([]);
            setFormLectura(''); setFormLecturaIdioma('es-ES'); setFormDificultad('normal'); setFormAbierto(false);
        } catch (e) { console.error(e); setErrorForm('Error al guardar la pregunta.'); }
        setGuardandoPregunta(false);
    };

    const eliminarPregunta = async (pregId, autorUid) => {
        if (!esCreador && autorUid !== usuario?.uid) return;
        if (!window.confirm('¿Eliminar esta pregunta?')) return;
        try {
            await deleteDoc(doc(db, 'trivial_recursos', recursoId, 'preguntas', pregId));
            setPreguntas(prev => ({ ...prev, [tabActiva]: prev[tabActiva].filter(p => p.id !== pregId) }));
        } catch (e) { console.error(e); }
    };

    const moverPregunta = async (idx, dir) => {
        const lista = [...pregsCat];
        const otroIdx = idx + dir;
        if (otroIdx < 0 || otroIdx >= lista.length) return;
        const a = lista[idx];
        const b = lista[otroIdx];
        const ordenA = a.orden ?? idx * 1000;
        const ordenB = b.orden ?? otroIdx * 1000;
        try {
            await Promise.all([
                updateDoc(doc(db, 'trivial_recursos', recursoId, 'preguntas', a.id), { orden: ordenB }),
                updateDoc(doc(db, 'trivial_recursos', recursoId, 'preguntas', b.id), { orden: ordenA }),
            ]);
            const nueva = [...lista];
            nueva[idx]      = { ...a, orden: ordenB };
            nueva[otroIdx]  = { ...b, orden: ordenA };
            nueva.sort((x, y) => (x.orden ?? 0) - (y.orden ?? 0));
            setPreguntas(prev => ({ ...prev, [tabActiva]: nueva }));
        } catch (e) { console.error(e); }
    };

    const abrirEdicion = (p) => {
        setEditandoPregId(p.id);
        const bloques = [...(p.bloques || ['', ''])];
        while (bloques.length < 3) bloques.push('');
        setEditForm({ tipo: p.tipo || 'SELECCION', q: p.q || '', a: p.a || '', w: [...(p.w || ['', '', ''])], bloques, alternativas: [...(p.alternativas || [])], autorNombre: p.autorNombre || '', lectura: p.lectura || '', lecturaIdioma: p.lecturaIdioma || 'es-ES', dificultad: p.dificultad || 'normal' });
    };

    const guardarEdicion = async () => {
        setGuardandoEdicion(true);
        try {
            const lecturaUpd = editForm.lectura.trim()
                ? { lectura: editForm.lectura.trim(), lecturaIdioma: editForm.lecturaIdioma }
                : { lectura: '', lecturaIdioma: editForm.lecturaIdioma };
            let upd = { tipo: editForm.tipo, dificultad: editForm.dificultad || 'normal', autorNombre: editForm.autorNombre.trim(), ...lecturaUpd };
            if (editForm.tipo === 'SELECCION') {
                upd = { ...upd, q: editForm.q.trim(), a: editForm.a.trim(), w: editForm.w.map(s => s.trim()) };
            } else if (editForm.tipo === 'CORTA') {
                const alts = (editForm.alternativas || []).map(s => s.trim()).filter(Boolean);
                upd = { ...upd, q: editForm.q.trim(), a: editForm.a.trim(), alternativas: alts };
            } else if (editForm.tipo === 'RELLENAR') {
                const b = (editForm.bloques || ['', '', '']).map(s => s.trim());
                while (b.length < 3) b.push('');
                const alts = (editForm.alternativas || []).map(s => s.trim()).filter(Boolean);
                upd = { ...upd, bloques: b, alternativas: alts };
            } else if (editForm.tipo === 'ORDENAR') {
                upd = { ...upd, q: editForm.q.trim(), bloques: editForm.bloques.filter(s => s.trim()) };
            }
            await updateDoc(doc(db, 'trivial_recursos', recursoId, 'preguntas', editandoPregId), upd);
            setPreguntas(prev => ({
                ...prev,
                [tabActiva]: prev[tabActiva].map(p => p.id === editandoPregId ? { ...p, ...upd } : p)
            }));
            setEditandoPregId(null);
            setEditForm(null);
        } catch (e) { console.error(e); }
        setGuardandoEdicion(false);
    };

    const cancelarEdicion = () => { setEditandoPregId(null); setEditForm(null); };

    const abrirPreview = (p) => {
        const tipo = p.tipo || 'SELECCION';
        let shuffledAnswers = [];
        let shuffledOrden = [];
        if (tipo === 'SELECCION' && p.a && p.w) {
            shuffledAnswers = [p.a, ...(p.w || [])].sort(() => Math.random() - 0.5);
        }
        if (tipo === 'ORDENAR' && p.bloques) {
            shuffledOrden = [...p.bloques].sort(() => Math.random() - 0.5);
        }
        setPreviewPregunta({ ...p, shuffledAnswers });
        setPreviewOrden(tipo === 'ORDENAR' ? { available: shuffledOrden, slots: [] } : { available: [], slots: [] });
        setPreviewInput('');
        setPreviewRevelado(false);
        setPreviewHablando(false);
        if (p.lectura && window.speechSynthesis) {
            const utt = new SpeechSynthesisUtterance(p.lectura);
            utt.lang = p.lecturaIdioma || 'es-ES';
            utt.onstart = () => setPreviewHablando(true);
            utt.onend   = () => setPreviewHablando(false);
            utt.onerror = () => setPreviewHablando(false);
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utt);
        }
    };

    const cerrarPreview = () => {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        setPreviewPregunta(null);
        setPreviewHablando(false);
    };

    const cambiarCategoriaPregunta = async (pregId, nuevaCat) => {
        if (!nuevaCat || nuevaCat === tabActiva) return;
        const pregData = preguntas[tabActiva].find(p => p.id === pregId);
        if (!pregData) return;
        try {
            await updateDoc(doc(db, 'trivial_recursos', recursoId, 'preguntas', pregId), { categoria: nuevaCat });
            setPreguntas(prev => {
                const upd = { ...prev, [tabActiva]: prev[tabActiva].filter(p => p.id !== pregId) };
                if (preguntasCargadas[nuevaCat]) upd[nuevaCat] = [...prev[nuevaCat], { ...pregData, categoria: nuevaCat }];
                return upd;
            });
        } catch (e) { console.error(e); }
    };

    // ── Pending questions actions ──────────────────────────────────────────────
    const aceptarPendiente = async (pend) => {
        try {
            const autorNombre = pend.enviadoPor.nombre + (pend.enviadoPor.curso ? ` (${pend.enviadoPor.curso})` : '');
            const tipo = pend.tipo || 'SELECCION';
            const lecturaData = pend.lectura ? { lectura: pend.lectura, lecturaIdioma: pend.lecturaIdioma || 'es-ES' } : {};
            const base = { tipo, categoria: pend.categoria, dificultad: pend.dificultad || 'normal', autorUid: 'externo', autorNombre, fechaCreacion: serverTimestamp(), orden: Date.now(), ...lecturaData };
            let data = base;
            if (tipo === 'SELECCION') data = { ...base, q: pend.q, a: pend.a, w: pend.w };
            else if (tipo === 'CORTA') data = { ...base, q: pend.q, a: pend.a, ...(pend.alternativas?.length ? { alternativas: pend.alternativas } : {}) };
            else if (tipo === 'RELLENAR') { const alts = pend.alternativas?.length ? { alternativas: pend.alternativas } : {}; data = { ...base, bloques: pend.bloques, ...alts }; }
            else if (tipo === 'ORDENAR') data = { ...base, q: pend.q, bloques: pend.bloques };
            const ref = await addDoc(collection(db, 'trivial_recursos', recursoId, 'preguntas'), data);
            await deleteDoc(doc(db, 'trivial_recursos', recursoId, 'preguntas_pendientes', pend.id));
            const cat = pend.categoria;
            setPreguntas(prev => ({
                ...prev,
                [cat]: preguntasCargadas[cat] ? [...prev[cat], { id: ref.id, ...data }] : prev[cat]
            }));
            setPendientes(prev => ({ ...prev, [cat]: prev[cat].filter(p => p.id !== pend.id) }));
        } catch (e) { console.error(e); }
    };

    const rechazarPendiente = async (pend) => {
        if (!window.confirm('¿Rechazar y eliminar esta pregunta?')) return;
        try {
            await deleteDoc(doc(db, 'trivial_recursos', recursoId, 'preguntas_pendientes', pend.id));
            setPendientes(prev => ({ ...prev, [pend.categoria]: prev[pend.categoria].filter(p => p.id !== pend.id) }));
        } catch (e) { console.error(e); }
    };

    const cambiarCategoriaPendiente = (pend, nuevaCat) => {
        const fromCat = pend.categoria;
        if (!nuevaCat || nuevaCat === fromCat) return;
        // Mover en el estado local para que aparezca bajo la pestaña correcta
        setPendientes(prev => ({
            ...prev,
            [fromCat]: (prev[fromCat] || []).filter(p => p.id !== pend.id),
            [nuevaCat]: [...(prev[nuevaCat] || []), { ...pend, categoria: nuevaCat }],
        }));
        // Persistir por si el profesor recarga antes de aceptar
        updateDoc(doc(db, 'trivial_recursos', recursoId, 'preguntas_pendientes', pend.id), { categoria: nuevaCat }).catch(e => console.error(e));
    };

    const cambiarDificultadPendiente = (pend, nuevaDif) => {
        setPendientes(prev => ({
            ...prev,
            [pend.categoria]: (prev[pend.categoria] || []).map(p => p.id === pend.id ? { ...p, dificultad: nuevaDif } : p),
        }));
        updateDoc(doc(db, 'trivial_recursos', recursoId, 'preguntas_pendientes', pend.id), { dificultad: nuevaDif }).catch(e => console.error(e));
    };

    // ── Collaboration ──────────────────────────────────────────────────────────
    const agregarColaboradorPorEmail = async () => {
        if (!emailNuevo.trim()) return;
        setAgregandoColab(true); setErrorColab('');
        try {
            const snap = await getDocs(query(collection(db, 'users'), where('email', '==', emailNuevo.trim().toLowerCase())));
            if (snap.empty) { setErrorColab('No se encontró ningún usuario con ese email.'); setAgregandoColab(false); return; }
            const uid = snap.docs[0].id; const ud = snap.docs[0].data();
            if (colaboradores.find(c => c.uid === uid)) { setErrorColab('Ya es colaborador.'); setAgregandoColab(false); return; }
            const nuevos = [...colaboradores, { uid, email: ud.email, nombre: ud.displayName || ud.email }];
            await updateDoc(doc(db, 'trivial_recursos', recursoId), { colaboradores: nuevos });
            setColaboradores(nuevos); setEmailNuevo('');
        } catch (e) { console.error(e); setErrorColab('Error al agregar colaborador.'); }
        setAgregandoColab(false);
    };

    const quitarColaborador = async (uid) => {
        const nuevos = colaboradores.filter(c => c.uid !== uid);
        await updateDoc(doc(db, 'trivial_recursos', recursoId), { colaboradores: nuevos });
        setColaboradores(nuevos);
    };

    const copiar = (texto, key) => {
        navigator.clipboard.writeText(texto).then(() => { setCopiado(key); setTimeout(() => setCopiado(''), 2000); });
    };

    // ── Traducción del recurso ─────────────────────────────────────────────────
    const todasLasPreguntas = () => CAT_IDS.flatMap(cat => preguntas[cat] || []);

    // Construye el borrador de revisión a partir de lo ya guardado en Firebase.
    const borradorDesdeGuardado = (lang) => {
        const b = {};
        for (const p of todasLasPreguntas()) {
            const guardado = p.traducciones?.[lang];
            if (guardado) b[p.id] = { ...guardado };
        }
        return b;
    };

    const abrirTradPanel = () => {
        if (!recursoId) { setErrorGuardar('Guarda el recurso primero (botón "Crear" arriba).'); return; }
        setTradError(''); setTradGuardado(false);
        setTradBorrador(borradorDesdeGuardado(tradIdioma));
        setTradPanel(true);
    };

    const cambiarTradIdioma = (lang) => {
        setTradIdioma(lang);
        setTradError(''); setTradGuardado(false);
        setTradBorrador(borradorDesdeGuardado(lang));
    };

    // Traduce con IA todas las preguntas al idioma elegido → rellena el borrador.
    const traducirTodas = async () => {
        setTraduciendo(true); setTradError(''); setTradGuardado(false);
        try {
            const pregs = todasLasPreguntas();
            // 1) Reunir todos los textos únicos a traducir.
            const unicos = [...new Set(pregs.flatMap(p => camposTraducibles(p).map(([, txt]) => txt)))];
            if (!unicos.length) { setTradError('No hay preguntas que traducir.'); setTraduciendo(false); return; }

            // 2) Traducir en lotes de 40.
            const mapa = new Map();
            const LOTE = 40;
            for (let i = 0; i < unicos.length; i += LOTE) {
                const chunk = unicos.slice(i, i + LOTE);
                setTradProgreso(`Traduciendo ${Math.min(i + LOTE, unicos.length)}/${unicos.length}…`);
                const trad = await traducirLote(chunk, tradIdioma);
                chunk.forEach((orig, j) => mapa.set(orig, trad[j]));
            }
            setTradProgreso('');

            // 3) Volcar por pregunta y campo en el borrador (respetando ediciones previas).
            setTradBorrador(prev => {
                const b = { ...prev };
                for (const p of pregs) {
                    const entry = { ...(b[p.id] || {}) };
                    for (const [campo, orig] of camposTraducibles(p)) {
                        const tr = mapa.get(orig);
                        if (tr == null) continue;
                        if (campo.startsWith('w')) {
                            const idx = Number(campo.slice(1));
                            entry.w = entry.w || [];
                            entry.w[idx] = tr;
                        } else {
                            entry[campo] = tr;
                        }
                    }
                    b[p.id] = entry;
                }
                return b;
            });
        } catch (e) {
            console.error(e);
            setTradError('No se pudo traducir (¿proxy /api/gemini caído?). Inténtalo de nuevo.');
            setTradProgreso('');
        }
        setTraduciendo(false);
    };

    const editarTrad = (pregId, campo, valor) => {
        setTradBorrador(prev => {
            const entry = { ...(prev[pregId] || {}) };
            if (campo.startsWith('w')) {
                const idx = Number(campo.slice(1));
                entry.w = [...(entry.w || [])];
                entry.w[idx] = valor;
            } else {
                entry[campo] = valor;
            }
            return { ...prev, [pregId]: entry };
        });
    };

    // Guarda traducciones[lang] en cada pregunta + marca idiomas disponibles en el recurso.
    const guardarTraducciones = async () => {
        if (!recursoId) return;
        setTradGuardando(true); setTradError('');
        try {
            const pregs = todasLasPreguntas();
            const ops = [];
            for (const p of pregs) {
                const entry = tradBorrador[p.id];
                if (!entry) continue;
                // Guardar solo campos con contenido, limpiando w vacíos.
                const limpio = {};
                if (entry.q?.trim()) limpio.q = entry.q.trim();
                if (entry.a?.trim()) limpio.a = entry.a.trim();
                if (Array.isArray(entry.w) && entry.w.some(x => x?.trim())) limpio.w = entry.w.map(x => (x || '').trim());
                if (entry.b0?.trim()) limpio.b0 = entry.b0.trim();
                if (entry.b2?.trim()) limpio.b2 = entry.b2.trim();
                if (!Object.keys(limpio).length) continue;
                ops.push(
                    updateDoc(doc(db, 'trivial_recursos', recursoId, 'preguntas', p.id), { [`traducciones.${tradIdioma}`]: limpio })
                );
            }
            await Promise.all(ops);
            // Registrar el idioma como disponible en el recurso.
            const nuevosIdiomas = Array.from(new Set([...idiomasTrad, tradIdioma]));
            await updateDoc(doc(db, 'trivial_recursos', recursoId), {
                idiomasTraducidos: nuevosIdiomas,
                fechaModificacion: serverTimestamp(),
            });
            setIdiomasTrad(nuevosIdiomas);
            // Reflejar en el estado local para no perder lo guardado al reabrir.
            setPreguntas(prev => {
                const next = { ...prev };
                for (const cat of CAT_IDS) {
                    next[cat] = (prev[cat] || []).map(p => {
                        const entry = tradBorrador[p.id];
                        if (!entry) return p;
                        const limpio = {};
                        if (entry.q?.trim()) limpio.q = entry.q.trim();
                        if (entry.a?.trim()) limpio.a = entry.a.trim();
                        if (Array.isArray(entry.w) && entry.w.some(x => x?.trim())) limpio.w = entry.w.map(x => (x || '').trim());
                        if (entry.b0?.trim()) limpio.b0 = entry.b0.trim();
                        if (entry.b2?.trim()) limpio.b2 = entry.b2.trim();
                        if (!Object.keys(limpio).length) return p;
                        return { ...p, traducciones: { ...(p.traducciones || {}), [tradIdioma]: limpio } };
                    });
                }
                return next;
            });
            setTradGuardado(true);
            setTimeout(() => setTradGuardado(false), 2500);
        } catch (e) {
            console.error(e);
            setTradError('Error al guardar las traducciones.');
        }
        setTradGuardando(false);
    };

    // ── Derived ────────────────────────────────────────────────────────────────
    const catData       = categorias[tabActiva];
    const catHex        = CAT_HEX[tabActiva];
    const pregsCat      = preguntas[tabActiva];
    const pendientesCat = pendientes[tabActiva] || [];
    const todasPendientes = CAT_IDS.flatMap(id => pendientes[id] || []);
    const totalPreguntas = Object.values(preguntas).reduce((s, arr) => s + arr.length, 0);
    const totalPendientes = Object.values(pendientes).reduce((s, arr) => s + arr.length, 0);

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div style={{ position: 'fixed', inset: 0, background: '#0f172a', zIndex: 2000, display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI', sans-serif" }}>

        {/* ── IMPORT MODAL ── */}
        {importModal && (() => {
            const TIPOS = [
                { id: 'PASAPALABRA', label: 'Pasapalabra', icon: '📝', desc: 'Pregunta + respuesta  →  Respuesta corta' },
                { id: 'CAZABURBUJAS', label: 'Caza Burbujas', icon: '🫧', desc: 'Pregunta + opciones  →  Selección múltiple' },
                { id: 'APAREJADOS', label: 'Aparejados', icon: '🔗', desc: 'Término A + B  →  Respuesta corta' },
            ];
            const selPregs = importPregs.filter((_, i) => importSel.has(i));
            const allSel = importPregs.length > 0 && importPregs.every((_, i) => importSel.has(i));

            const toggleAll = () => {
                if (allSel) setImportSel(new Set());
                else setImportSel(new Set(importPregs.map((_, i) => i)));
            };

            return (
                <div style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                    onClick={e => { if (e.target === e.currentTarget) setImportModal(false); }}>
                    <div style={{ background: '#1e293b', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.8)', overflow: 'hidden' }}>
                        {/* Header */}
                        <div style={{ background: '#0f172a', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #334155', flexShrink: 0 }}>
                            {importStep > 1 && (
                                <button onClick={() => { setImportStep(s => s - 1); setImportError(''); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem', padding: '2px 6px', lineHeight: 1 }}>←</button>
                            )}
                            <span style={{ fontSize: '1.2rem' }}>📥</span>
                            <div style={{ flex: 1 }}>
                                <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.95rem' }}>
                                    {importStep === 1 ? 'Importar preguntas' : importStep === 2 ? `${TIPOS.find(t => t.id === importTipo)?.icon} ${TIPOS.find(t => t.id === importTipo)?.label}` : importRecurso?.titulo || 'Seleccionar preguntas'}
                                </div>
                                <div style={{ color: '#64748b', fontSize: '0.72rem' }}>
                                    {importStep === 1 ? 'Elige el tipo de recurso fuente' : importStep === 2 ? 'Elige el recurso' : 'Marca las preguntas a importar'}
                                </div>
                            </div>
                            {/* Step dots */}
                            <div style={{ display: 'flex', gap: 5 }}>
                                {[1, 2, 3].map(s => (
                                    <div key={s} style={{ width: 8, height: 8, borderRadius: '50%', background: s === importStep ? '#38bdf8' : s < importStep ? '#4ade80' : '#334155' }} />
                                ))}
                            </div>
                            <button onClick={() => setImportModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.2rem', padding: '2px 6px', lineHeight: 1, marginLeft: 4 }}>✕</button>
                        </div>

                        {/* Body */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                            {importError && <div style={{ background: '#7f1d1d', color: '#fca5a5', borderRadius: 8, padding: '8px 14px', fontSize: '0.82rem', marginBottom: 14 }}>⚠ {importError}</div>}

                            {/* ── Step 1: choose source type ── */}
                            {importStep === 1 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {TIPOS.map(t => (
                                        <button key={t.id} onClick={async () => {
                                            setImportTipo(t.id); setImportRecursos([]); setImportStep(2);
                                            await cargarRecursosImport(t.id);
                                        }} style={{ background: '#0f172a', border: '2px solid #334155', borderRadius: 14, padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, textAlign: 'left', transition: '0.15s' }}
                                            onMouseEnter={e => e.currentTarget.style.borderColor = '#38bdf8'}
                                            onMouseLeave={e => e.currentTarget.style.borderColor = '#334155'}>
                                            <span style={{ fontSize: '2rem' }}>{t.icon}</span>
                                            <div>
                                                <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1rem' }}>{t.label}</div>
                                                <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: 3 }}>{t.desc}</div>
                                            </div>
                                            <span style={{ marginLeft: 'auto', color: '#475569' }}>›</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* ── Step 2: choose resource ── */}
                            {importStep === 2 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {importCargando && <div style={{ color: '#64748b', textAlign: 'center', padding: 24 }}>Cargando recursos…</div>}
                                    {!importCargando && importRecursos.length === 0 && (
                                        <div style={{ background: '#0f172a', borderRadius: 12, padding: '28px 20px', textAlign: 'center', border: '2px dashed #334155' }}>
                                            <div style={{ fontSize: '2rem', marginBottom: 8 }}>📭</div>
                                            <div style={{ color: '#64748b', fontSize: '0.9rem' }}>No tienes recursos de este tipo.</div>
                                        </div>
                                    )}
                                    {importRecursos.map(r => (
                                        <button key={r.id} onClick={() => {
                                            setImportRecurso(r);
                                            setImportHojaIdx(-1);
                                            const pregs = calcImportPregs(r, -1).filter(item => isImportable(importTipo, item.q));
                                            setImportPregs(pregs);
                                            setImportSel(new Set(pregs.map((_, i) => i)));
                                            setImportStep(3);
                                        }} style={{ background: '#0f172a', border: '2px solid #334155', borderRadius: 12, padding: '14px 18px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14, transition: '0.15s' }}
                                            onMouseEnter={e => e.currentTarget.style.borderColor = '#38bdf8'}
                                            onMouseLeave={e => e.currentTarget.style.borderColor = '#334155'}>
                                            <span style={{ fontSize: '1.5rem' }}>{TIPOS.find(t => t.id === importTipo)?.icon}</span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.titulo}</div>
                                                <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 2 }}>
                                                    {r.hojas?.length || 0} hoja{r.hojas?.length !== 1 ? 's' : ''} · {(r.hojas || []).reduce((s, h) => s + (h.preguntas?.length || 0), 0)} preguntas
                                                </div>
                                            </div>
                                            <span style={{ color: '#475569' }}>›</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* ── Step 3: hoja + question selection ── */}
                            {importStep === 3 && importRecurso && (() => {
                                const hojas = importRecurso.hojas || [];
                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                        {/* Hoja selector */}
                                        {hojas.length > 1 && (
                                            <div>
                                                <div style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Hoja</div>
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                    <button onClick={() => {
                                                        setImportHojaIdx(-1);
                                                        const pregs = calcImportPregs(importRecurso, -1).filter(item => isImportable(importTipo, item.q));
                                                        setImportPregs(pregs); setImportSel(new Set(pregs.map((_, i) => i)));
                                                    }} style={{ background: importHojaIdx === -1 ? '#1d4ed8' : '#0f172a', border: `1px solid ${importHojaIdx === -1 ? '#3b82f6' : '#334155'}`, color: importHojaIdx === -1 ? 'white' : '#94a3b8', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: importHojaIdx === -1 ? 700 : 400 }}>Todas</button>
                                                    {hojas.map((h, hi) => (
                                                        <button key={hi} onClick={() => {
                                                            setImportHojaIdx(hi);
                                                            const pregs = calcImportPregs(importRecurso, hi).filter(item => isImportable(importTipo, item.q));
                                                            setImportPregs(pregs); setImportSel(new Set(pregs.map((_, i) => i)));
                                                        }} style={{ background: importHojaIdx === hi ? '#1d4ed8' : '#0f172a', border: `1px solid ${importHojaIdx === hi ? '#3b82f6' : '#334155'}`, color: importHojaIdx === hi ? 'white' : '#94a3b8', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: importHojaIdx === hi ? 700 : 400 }}>
                                                            {h.nombreHoja || `Hoja ${hi + 1}`}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Select all toggle + count */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                                            <button onClick={toggleAll} style={{ background: allSel ? '#14532d' : '#0f172a', border: `1px solid ${allSel ? '#4ade80' : '#475569'}`, color: allSel ? '#4ade80' : '#94a3b8', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                                                {allSel ? '✓ Todas seleccionadas' : 'Seleccionar todas'}
                                            </button>
                                            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{importSel.size} / {importPregs.length} seleccionadas</span>
                                        </div>

                                        {/* Question list */}
                                        {importPregs.length === 0 && (
                                            <div style={{ background: '#0f172a', borderRadius: 10, padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                                                No hay preguntas importables en esta selección.
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
                                            {importPregs.map((item, i) => {
                                                const sel = importSel.has(i);
                                                const q = item.q;
                                                let preview;
                                                if (importTipo === 'PASAPALABRA') preview = <><span style={{ color: '#f1f5f9' }}>{q.pregunta}</span><span style={{ color: '#4ade80', marginLeft: 8 }}>→ {q.respuesta}</span></>;
                                                else if (importTipo === 'CAZABURBUJAS') preview = <><span style={{ color: '#f1f5f9' }}>{q.pregunta}</span><span style={{ color: '#4ade80', marginLeft: 8 }}>✓ {q.correcta || q.respuesta}</span></>;
                                                else if (importTipo === 'APAREJADOS') preview = <><span style={{ color: '#f1f5f9' }}>{q.terminoA}</span><span style={{ color: '#38bdf8', margin: '0 6px' }}>↔</span><span style={{ color: '#4ade80' }}>{q.terminoB}</span></>;
                                                return (
                                                    <button key={i} onClick={() => {
                                                        setImportSel(prev => {
                                                            const next = new Set(prev);
                                                            if (next.has(i)) next.delete(i); else next.add(i);
                                                            return next;
                                                        });
                                                    }} style={{ background: sel ? '#0d2b1b' : '#0f172a', border: `1px solid ${sel ? '#4ade80' : '#334155'}`, borderRadius: 9, padding: '10px 14px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 10, transition: '0.1s' }}>
                                                        <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: 1 }}>{sel ? '☑' : '☐'}</span>
                                                        <div style={{ fontSize: '0.83rem', lineHeight: 1.4, flex: 1, minWidth: 0 }}>
                                                            {hojas.length > 1 && importHojaIdx === -1 && (
                                                                <div style={{ color: '#475569', fontSize: '0.7rem', marginBottom: 2 }}>{item.hoja}</div>
                                                            )}
                                                            {preview}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Destination category */}
                                        <div>
                                            <div style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Categoría destino</div>
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                {CAT_IDS.map(id => (
                                                    <button key={id} onClick={() => setImportCat(id)} style={{ background: importCat === id ? CAT_HEX[id] + '30' : '#0f172a', border: `2px solid ${importCat === id ? CAT_HEX[id] : '#334155'}`, color: importCat === id ? CAT_HEX[id] : '#64748b', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: importCat === id ? 700 : 400, display: 'flex', alignItems: 'center', gap: 5 }}>
                                                        <span>{categorias[id].emoji}</span>
                                                        <span>{categorias[id].nombre}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Footer */}
                        {importStep === 3 && (
                            <div style={{ borderTop: '1px solid #334155', padding: '14px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end', background: '#0f172a', flexShrink: 0 }}>
                                <button onClick={() => setImportModal(false)} style={{ background: '#334155', border: 'none', color: '#94a3b8', padding: '10px 18px', borderRadius: 9, cursor: 'pointer', fontSize: '0.88rem' }}>Cancelar</button>
                                <button onClick={confirmarImport} disabled={importGuardando || importSel.size === 0} style={{ background: importSel.size === 0 ? '#334155' : '#1d4ed8', border: 'none', color: 'white', padding: '10px 22px', borderRadius: 9, cursor: importSel.size === 0 || importGuardando ? 'default' : 'pointer', fontWeight: 700, fontSize: '0.88rem', opacity: importGuardando ? 0.6 : 1 }}>
                                    {importGuardando ? 'Importando…' : `📥 Importar ${importSel.size} pregunta${importSel.size !== 1 ? 's' : ''}`}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            );
        })()}

        {/* ── MODAL PREVIEW ── */}
        {previewPregunta && (() => {
            const p    = previewPregunta;
            const tipo = p.tipo || 'SELECCION';
            const hex  = CAT_HEX[tabActiva];
            const elegidos    = previewOrden.slots || [];
            const disponibles = previewOrden.available || [];
            const ordenCompleto = elegidos.length === (p.bloques?.length || 0);
            return (
                <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
                    onClick={e => { if (e.target === e.currentTarget) cerrarPreview(); }}>
                    <div style={{ background: '#1e293b', borderRadius: 20, padding: 32, maxWidth: 520, width: '100%', borderTop: `8px solid ${hex}`, boxShadow: '0 24px 80px rgba(0,0,0,0.7)', position: 'relative' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ color: hex, fontWeight: 800, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: 2 }}>
                                    {categorias[tabActiva]?.emoji} {categorias[tabActiva]?.nombre}
                                </div>
                                {p.lectura && (
                                    <button onClick={() => {
                                        if (!window.speechSynthesis) return;
                                        const utt = new SpeechSynthesisUtterance(p.lectura);
                                        utt.lang = p.lecturaIdioma || 'es-ES';
                                        utt.onstart = () => setPreviewHablando(true);
                                        utt.onend   = () => setPreviewHablando(false);
                                        utt.onerror = () => setPreviewHablando(false);
                                        window.speechSynthesis.cancel();
                                        window.speechSynthesis.speak(utt);
                                    }} style={{ background: previewHablando ? '#1d4ed820' : 'transparent', border: `1px solid ${previewHablando ? '#38bdf8' : '#334155'}`, borderRadius: 20, padding: '3px 10px', cursor: 'pointer', color: previewHablando ? '#38bdf8' : '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>
                                        {previewHablando ? '🔊 Escuchando…' : '🔊 Escuchar'}
                                    </button>
                                )}
                            </div>
                            <button onClick={cerrarPreview} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>✕</button>
                        </div>

                        {/* Barra de tiempo decorativa */}
                        <div style={{ height: 5, background: '#334155', borderRadius: 4, marginBottom: 20 }}>
                            <div style={{ height: '100%', width: '60%', background: hex, borderRadius: 4 }} />
                        </div>

                        {/* Contenido por tipo */}
                        {tipo === 'SELECCION' && (<>
                            <h2 style={{ color: 'white', fontSize: '1.4rem', margin: '0 0 24px', lineHeight: 1.4 }}>{p.q}</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {p.shuffledAnswers.map((ans, i) => {
                                    const esCor = ans === p.a;
                                    const bg = previewRevelado ? (esCor ? '#166534' : '#2a0d0d') : '#0f172a';
                                    const border = previewRevelado ? (esCor ? '#4ade80' : '#ef444450') : '#334155';
                                    return (
                                        <div key={i} style={{ background: bg, border: `2px solid ${border}`, borderRadius: 12, padding: '14px 18px', color: previewRevelado ? (esCor ? '#4ade80' : '#64748b') : 'white', fontSize: '1rem', fontWeight: 600, transition: '0.2s', display: 'flex', alignItems: 'center', gap: 10 }}>
                                            {previewRevelado && <span>{esCor ? '✓' : '✗'}</span>}
                                            {ans}
                                        </div>
                                    );
                                })}
                            </div>
                        </>)}

                        {tipo === 'CORTA' && (<>
                            <h2 style={{ color: 'white', fontSize: '1.4rem', margin: '0 0 20px', lineHeight: 1.4 }}>{p.q}</h2>
                            {!previewRevelado
                                ? <input value={previewInput} onChange={e => setPreviewInput(e.target.value)} placeholder="Escribe tu respuesta…" style={{ width: '100%', boxSizing: 'border-box', background: '#0f172a', border: '2px solid #475569', borderRadius: 10, color: 'white', padding: '14px 16px', fontSize: '1rem', fontFamily: 'inherit', outline: 'none' }} />
                                : <div style={{ background: '#0d2b1b', border: '2px solid #4ade80', borderRadius: 10, padding: '14px 18px', color: '#4ade80', fontSize: '1.1rem', fontWeight: 700 }}>✓ {p.a}</div>
                            }
                            {!previewRevelado && previewInput.trim() && (() => {
                                const alts = p.alternativas || [];
                                const ok = cleanPrev(previewInput) === cleanPrev(p.a) || alts.some(a => cleanPrev(previewInput) === cleanPrev(a));
                                return <div style={{ marginTop: 10, color: ok ? '#4ade80' : '#f87171', fontSize: '0.85rem', fontWeight: 700 }}>{ok ? '✓ Correcto' : '✗ Incorrecto'}</div>;
                            })()}
                        </>)}

                        {tipo === 'RELLENAR' && (<>
                            <div style={{ color: 'white', fontSize: '1.3rem', margin: '0 0 20px', lineHeight: 1.6 }}>
                                <span>{p.bloques?.[0]} </span>
                                <span style={{ borderBottom: `3px solid ${hex}`, padding: '0 12px', color: previewRevelado ? '#4ade80' : hex, fontWeight: 700 }}>
                                    {previewRevelado ? p.bloques?.[1] : '___'}
                                </span>
                                {p.bloques?.[2] && <span> {p.bloques[2]}</span>}
                            </div>
                            {!previewRevelado && (
                                <input value={previewInput} onChange={e => setPreviewInput(e.target.value)} placeholder="Completa el hueco…" style={{ width: '100%', boxSizing: 'border-box', background: '#0f172a', border: `2px solid ${hex}`, borderRadius: 10, color: hex, padding: '14px 16px', fontSize: '1rem', fontFamily: 'inherit', outline: 'none' }} />
                            )}
                            {!previewRevelado && previewInput.trim() && (() => {
                                const alts = p.alternativas || [];
                                const ok = cleanPrev(previewInput) === cleanPrev(p.bloques?.[1]) || alts.some(a => cleanPrev(previewInput) === cleanPrev(a));
                                return <div style={{ marginTop: 10, color: ok ? '#4ade80' : '#f87171', fontSize: '0.85rem', fontWeight: 700 }}>{ok ? '✓ Correcto' : '✗ Incorrecto'}</div>;
                            })()}
                        </>)}

                        {tipo === 'ORDENAR' && (<>
                            {p.q && <h2 style={{ color: 'white', fontSize: '1.1rem', margin: '0 0 16px', lineHeight: 1.4 }}>{p.q}</h2>}
                            <div style={{ minHeight: 44, background: '#0f172a', borderRadius: 10, padding: '8px 10px', marginBottom: 10, border: '2px dashed #334155', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {elegidos.length === 0 && <span style={{ color: '#475569', fontSize: '0.85rem', alignSelf: 'center' }}>Toca los elementos en el orden correcto</span>}
                                {elegidos.map((s, i) => (
                                    <button key={i} onClick={() => setPreviewOrden(prev => ({ slots: prev.slots.filter(t => t !== s), available: [...prev.available, s] }))}
                                        style={{ background: previewRevelado ? (p.bloques?.[i] === s ? '#166534' : '#7f1d1d') : '#1d4ed8', border: 'none', color: 'white', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600 }}>
                                        {i + 1}. {s}
                                    </button>
                                ))}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                                {disponibles.map((s, i) => (
                                    <button key={i} onClick={() => setPreviewOrden(prev => ({ available: prev.available.filter(t => t !== s), slots: [...prev.slots, s] }))}
                                        style={{ background: '#334155', border: '1px solid #475569', color: '#e2e8f0', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: '0.95rem' }}>
                                        {s}
                                    </button>
                                ))}
                            </div>
                            {previewRevelado && <div style={{ color: '#4ade80', fontSize: '0.85rem', fontWeight: 700, marginBottom: 8 }}>Orden correcto: {p.bloques?.join(' → ')}</div>}
                        </>)}

                        {/* Botón revelar / cerrar */}
                        <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
                            {!previewRevelado && (
                                <button onClick={() => setPreviewRevelado(true)}
                                    style={{ flex: 1, background: hex, border: 'none', color: 'white', padding: '13px', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: '0.95rem' }}>
                                    Ver respuesta correcta
                                </button>
                            )}
                            <button onClick={cerrarPreview}
                                style={{ flex: previewRevelado ? 1 : 0, background: '#334155', border: 'none', color: '#94a3b8', padding: '13px 20px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem' }}>
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            );
        })()}

        {/* ── CATEGORY CONFIG MODAL ── */}
        {esCreador && recursoId && catConfigAbierto && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 3500, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                onClick={e => { if (e.target === e.currentTarget) { setCatConfigAbierto(false); setEmojiPickerAbierto(false); } }}>
                <div style={{ background: '#1e293b', borderRadius: 20, width: '100%', maxWidth: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.8)', overflow: 'hidden', borderTop: `6px solid ${catHex}` }}>
                    {/* Header */}
                    <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #334155', flexShrink: 0 }}>
                        <span style={{ fontSize: '1.2rem' }}>⚙</span>
                        <div style={{ flex: 1, color: '#f1f5f9', fontWeight: 700, fontSize: '0.95rem' }}>Configurar {catData.emoji} {catData.nombre}</div>
                        <button onClick={() => { setCatConfigAbierto(false); setEmojiPickerAbierto(false); }} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.2rem', padding: '2px 6px', lineHeight: 1 }}>✕</button>
                    </div>
                    {/* Body (scrollable) */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <div style={{ flex: '0 0 64px', position: 'relative' }} ref={emojiPickerRef}>
                                <div style={labelStyle}>Emoji</div>
                                <button
                                    onClick={() => setEmojiPickerAbierto(p => !p)}
                                    style={{ width: '100%', background: '#0f172a', border: `1px solid ${catHex}60`, borderRadius: 8, color: '#f1f5f9', padding: '7px 4px', fontSize: '1.5rem', textAlign: 'center', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >{catData.emoji}</button>
                                {emojiPickerAbierto && (
                                    <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: '#1e293b', border: '1px solid #334155', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.6)', width: 320, maxHeight: 300, overflowY: 'auto', padding: 14 }}>
                                        {EMOJI_GRUPOS.map(grupo => (
                                            <div key={grupo.label} style={{ marginBottom: 12 }}>
                                                <div style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{grupo.label}</div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                    {grupo.emojis.map(em => (
                                                        <button key={em} onClick={() => { updateCat('emoji', em); setEmojiPickerAbierto(false); }}
                                                            style={{ background: catData.emoji === em ? `${catHex}30` : 'transparent', border: catData.emoji === em ? `1px solid ${catHex}` : '1px solid transparent', borderRadius: 7, padding: '5px 6px', fontSize: '1.3rem', cursor: 'pointer', lineHeight: 1, transition: '0.1s' }}
                                                            onMouseEnter={e => e.currentTarget.style.background = '#334155'}
                                                            onMouseLeave={e => e.currentTarget.style.background = catData.emoji === em ? `${catHex}30` : 'transparent'}
                                                        >{em}</button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={labelStyle}>Nombre</div>
                                <input value={catData.nombre} onChange={e => updateCat('nombre', e.target.value)} placeholder="Ej: Historia de España" style={{ width: '100%', background: '#0f172a', border: `1px solid ${catHex}60`, borderRadius: 8, color: '#f1f5f9', padding: '9px 13px', fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                        </div>
                        <div>
                            <div style={labelStyle}>Descripción</div>
                            <textarea value={catData.desc} onChange={e => updateCat('desc', e.target.value)} placeholder="Describe el contenido de esta categoría…" rows={2} style={{ width: '100%', boxSizing: 'border-box', background: '#0f172a', border: `1px solid ${catHex}60`, borderRadius: 8, color: '#f1f5f9', padding: '9px 13px', fontSize: '0.88rem', resize: 'vertical', fontFamily: 'inherit', outline: 'none' }} />
                        </div>
                        <div>
                            <div style={labelStyle}>Imagen de portada</div>
                            <ImageSearchPanel currentUrl={catData.imagen} onSelect={url => updateCat('imagen', url)} accentColor={catHex} />
                        </div>
                    </div>
                    {/* Footer */}
                    <div style={{ borderTop: '1px solid #334155', padding: '14px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end', background: '#0f172a', flexShrink: 0 }}>
                        <button onClick={() => { setCatConfigAbierto(false); setEmojiPickerAbierto(false); }} style={{ background: '#334155', border: 'none', color: '#94a3b8', padding: '9px 18px', borderRadius: 9, cursor: 'pointer', fontSize: '0.88rem' }}>Cerrar</button>
                        <button onClick={guardarCategoria} disabled={guardandoCat} style={{ background: savedCat ? '#166534' : catHex, border: 'none', color: 'white', padding: '9px 22px', borderRadius: 9, cursor: guardandoCat ? 'default' : 'pointer', fontWeight: 700, fontSize: '0.88rem', opacity: guardandoCat ? 0.7 : 1, transition: 'background 0.3s' }}>
                            {guardandoCat ? 'Guardando…' : savedCat ? '✓ Guardado' : '✓ Guardar categoría'}
                        </button>
                    </div>
                </div>
            </div>
        )}

            {/* ─── TRANSLATE MODAL ─── */}
            {tradPanel && (() => {
                const pregs = todasLasPreguntas();
                const totalTraducidas = pregs.filter(p => tradBorrador[p.id] && Object.keys(tradBorrador[p.id]).length).length;
                return (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                        onClick={e => { if (e.target === e.currentTarget && !traduciendo && !tradGuardando) setTradPanel(false); }}>
                        <div style={{ background: '#1e293b', borderRadius: 20, width: '100%', maxWidth: 720, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.8)', overflow: 'hidden' }}>
                            {/* Header */}
                            <div style={{ background: '#0f172a', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #334155', flexShrink: 0 }}>
                                <span style={{ fontSize: '1.2rem' }}>🌐</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.95rem' }}>Traducir preguntas</div>
                                    <div style={{ color: '#64748b', fontSize: '0.72rem' }}>Traduce con IA y revisa antes de guardar</div>
                                </div>
                                <button onClick={() => !traduciendo && !tradGuardando && setTradPanel(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.2rem', padding: '2px 6px', lineHeight: 1 }}>✕</button>
                            </div>

                            {/* Language tabs */}
                            <div style={{ display: 'flex', gap: 6, padding: '12px 20px', borderBottom: '1px solid #334155', flexShrink: 0, flexWrap: 'wrap' }}>
                                {IDIOMAS_TRAD.map(([cod, info]) => {
                                    const activo = cod === tradIdioma;
                                    const yaGuardado = idiomasTrad.includes(cod);
                                    return (
                                        <button key={cod} onClick={() => cambiarTradIdioma(cod)} disabled={traduciendo}
                                            style={{ background: activo ? '#a855f7' : '#0f172a', border: `1px solid ${activo ? '#a855f7' : '#334155'}`, color: activo ? 'white' : '#94a3b8', padding: '6px 14px', borderRadius: 20, cursor: traduciendo ? 'default' : 'pointer', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {info.bandera} {info.etiqueta}{yaGuardado && <span title="Guardado" style={{ color: activo ? 'white' : '#4ade80' }}>✓</span>}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderBottom: '1px solid #334155', flexShrink: 0 }}>
                                <button onClick={traducirTodas} disabled={traduciendo || tradGuardando}
                                    style={{ background: '#7c3aed', border: 'none', color: 'white', padding: '9px 16px', borderRadius: 8, cursor: traduciendo ? 'default' : 'pointer', fontSize: '0.85rem', fontWeight: 700, opacity: traduciendo ? 0.7 : 1 }}>
                                    {traduciendo ? (tradProgreso || 'Traduciendo…') : `✨ Traducir ${pregs.length} preguntas con IA`}
                                </button>
                                <span style={{ color: '#64748b', fontSize: '0.78rem', marginLeft: 'auto' }}>{totalTraducidas}/{pregs.length} con traducción</span>
                            </div>

                            {tradError && <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '8px 20px', fontSize: '0.82rem', flexShrink: 0 }}>⚠ {tradError}</div>}

                            {/* Review list */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                                {pregs.length === 0 && <div style={{ color: '#64748b', textAlign: 'center', padding: 30 }}>Este recurso aún no tiene preguntas.</div>}
                                {pregs.map(p => {
                                    const campos = camposTraducibles(p);
                                    if (!campos.length) return null;
                                    const entry = tradBorrador[p.id] || {};
                                    const hex = CAT_HEX[p.categoria] || '#64748b';
                                    return (
                                        <div key={p.id} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: '12px 14px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                <span style={{ background: hex + '22', color: hex, border: `1px solid ${hex}55`, borderRadius: 6, padding: '1px 8px', fontSize: '0.7rem', fontWeight: 700 }}>{categorias[p.categoria]?.nombre || p.categoria}</span>
                                                <span style={{ color: '#475569', fontSize: '0.7rem' }}>{p.tipo || 'SELECCION'}</span>
                                            </div>
                                            {campos.map(([campo, orig]) => {
                                                const val = campo.startsWith('w') ? (entry.w?.[Number(campo.slice(1))] ?? '') : (entry[campo] ?? '');
                                                const etiqueta = campo === 'q' ? 'Enunciado' : campo === 'a' ? 'Respuesta' : campo.startsWith('w') ? `Opción ${Number(campo.slice(1)) + 1}` : campo === 'b0' ? 'Texto antes' : 'Texto después';
                                                return (
                                                    <div key={campo} style={{ marginBottom: 8 }}>
                                                        <div style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{etiqueta}</div>
                                                        <div style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: 4, lineHeight: 1.3 }}>{orig}</div>
                                                        <input value={val} onChange={e => editarTrad(p.id, campo, e.target.value)}
                                                            placeholder="(sin traducir)"
                                                            style={{ width: '100%', boxSizing: 'border-box', background: '#1e293b', border: `1px solid ${val ? '#a855f7' : '#334155'}`, borderRadius: 8, color: '#e2e8f0', padding: '8px 10px', fontSize: '0.86rem', outline: 'none' }} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Footer */}
                            <div style={{ padding: '14px 20px', borderTop: '1px solid #334155', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                                {tradGuardado && <span style={{ color: '#4ade80', fontSize: '0.85rem', fontWeight: 700 }}>✓ Guardado</span>}
                                <button onClick={guardarTraducciones} disabled={tradGuardando || traduciendo || totalTraducidas === 0}
                                    style={{ marginLeft: 'auto', background: '#16a34a', border: 'none', color: 'white', padding: '10px 22px', borderRadius: 8, cursor: (tradGuardando || totalTraducidas === 0) ? 'default' : 'pointer', fontSize: '0.9rem', fontWeight: 700, opacity: (tradGuardando || totalTraducidas === 0) ? 0.6 : 1 }}>
                                    {tradGuardando ? 'Guardando…' : '💾 Guardar traducción'}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ─── HEADER ─── */}
            <div style={{ background: '#1e293b', borderBottom: '1px solid #334155', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.3rem', padding: '2px 8px', lineHeight: 1, borderRadius: 6 }}>←</button>
                <span style={{ fontSize: '1.4rem' }}>🎯</span>
                <input
                    value={titulo} onChange={e => setTitulo(e.target.value)}
                    placeholder="Título del Trivial…" disabled={!esCreador}
                    style={{ flex: 1, background: 'transparent', border: 'none', color: '#f1f5f9', fontSize: '1.1rem', fontWeight: 700, outline: 'none', minWidth: 0 }}
                />
                {totalPreguntas > 0 && <span style={{ color: '#64748b', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{totalPreguntas} preguntas</span>}
                {totalPendientes > 0 && (
                    <span style={{ background: '#f59e0b', color: '#0f172a', borderRadius: 10, padding: '2px 10px', fontSize: '0.78rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
                        🕐 {totalPendientes} pendiente{totalPendientes !== 1 ? 's' : ''}
                    </span>
                )}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {esCreador && (
                        <button onClick={() => setPublica(p => !p)} style={{ background: publica ? '#0f4c2a' : '#3b1f0a', border: `1px solid ${publica ? '#2ecc71' : '#e67e22'}`, color: publica ? '#2ecc71' : '#e67e22', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                            {publica ? '🌐 Pública' : '🔒 Privada'}
                        </button>
                    )}
                    <button onClick={() => setPanelColab(p => !p)} style={{ background: panelColab ? '#1e3a8a' : '#1e293b', border: '1px solid #3b82f6', color: '#60a5fa', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                        👥 Colaborar
                    </button>
                    {esCreador && (
                        <button onClick={abrirTradPanel} style={{ background: '#1e293b', border: '1px solid #a855f7', color: '#c084fc', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                            🌐 Traducir
                        </button>
                    )}
                    {esCreador && (
                        <button onClick={guardarRecurso} disabled={guardando} style={{ background: '#1d4ed8', border: 'none', color: 'white', padding: '8px 18px', borderRadius: 8, cursor: guardando ? 'default' : 'pointer', fontSize: '0.9rem', fontWeight: 700, opacity: guardando ? 0.7 : 1 }}>
                            {guardando ? '…' : esNuevo ? '✓ Crear' : '✓ Guardar'}
                        </button>
                    )}
                </div>
            </div>

            {errorGuardar && <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '8px 20px', fontSize: '0.85rem', flexShrink: 0 }}>⚠ {errorGuardar}</div>}

            {/* ─── CATEGORY TABS ─── */}
            <div style={{ display: 'flex', background: '#1e293b', borderBottom: '1px solid #334155', flexShrink: 0, overflowX: 'auto' }}>
                {CAT_IDS.map(id => {
                    const c      = categorias[id];
                    const count  = preguntas[id]?.length ?? 0;
                    const pend   = pendientes[id]?.length ?? 0;
                    const active = id === tabActiva;
                    const hex    = CAT_HEX[id];
                    return (
                        <button key={id} onClick={() => setTabActiva(id)} style={{ flex: 1, minWidth: 88, padding: '10px 6px', border: 'none', borderBottom: active ? `3px solid ${hex}` : '3px solid transparent', background: active ? hex + '18' : 'transparent', color: active ? hex : '#64748b', cursor: 'pointer', fontSize: '0.78rem', fontWeight: active ? 700 : 500, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, transition: 'all 0.15s' }}>
                            <span style={{ fontSize: '1.15rem' }}>{c.emoji}</span>
                            <span style={{ maxWidth: 84, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</span>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <span style={{ background: active ? hex : '#334155', color: active ? 'white' : '#94a3b8', borderRadius: 10, padding: '1px 7px', fontSize: '0.72rem' }}>{count}</span>
                                {pend > 0 && <span style={{ background: '#f59e0b', color: '#0f172a', borderRadius: 10, padding: '1px 6px', fontSize: '0.66rem', fontWeight: 800 }}>{pend}</span>}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* ─── MAIN AREA ─── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', overflow: isMobile ? 'auto' : 'hidden' }}>

                {/* ── Questions column ── */}
                <div style={{ flex: 1, overflowY: isMobile ? 'visible' : 'auto', padding: isMobile ? 14 : 20, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>

                    {esNuevo && !recursoId && (
                        <div style={{ background: '#1e3a8a22', border: '1px solid #3b82f660', borderRadius: 12, padding: '14px 18px', color: '#93c5fd', fontSize: '0.9rem' }}>
                            Pon un título y pulsa <strong>✓ Crear</strong> para empezar a añadir preguntas.
                        </div>
                    )}

                    {/* ── PENDING QUESTIONS (todas las categorías) ── */}
                    {esCreador && todasPendientes.length > 0 && (
                        <div style={{ background: '#1c1a07', border: '1.5px solid #f59e0b60', borderRadius: 14, overflow: 'hidden' }}>
                            <div style={{ background: '#f59e0b18', borderBottom: '1px solid #f59e0b30', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: '1rem' }}>🕐</span>
                                <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.88rem' }}>
                                    Pendientes de revisión — {todasPendientes.length} pregunta{todasPendientes.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 18px' }}>
                                {todasPendientes.map(pend => (
                                    <div key={pend.id} style={{ background: '#0f172a', borderRadius: 10, padding: '13px 16px', border: '1px solid #f59e0b30' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginBottom: 5 }}>
                                                    ✉ <strong style={{ color: '#f59e0b' }}>{pend.enviadoPor?.nombre}</strong>
                                                    {pend.enviadoPor?.curso && <span> · {pend.enviadoPor.curso}</span>}
                                                </div>
                                                {(() => {
                                                    const tipo = pend.tipo || 'SELECCION';
                                                    const tipoBadge = { SELECCION: '🔘 Selección', CORTA: '✏️ Corta', RELLENAR: '🔲 Rellenar', ORDENAR: '🔀 Ordenar' }[tipo] || tipo;
                                                    return (<>
                                                        <div style={{ color: '#f59e0b', fontSize: '0.7rem', fontWeight: 700, marginBottom: 4 }}>{tipoBadge}</div>
                                                        <div style={{ color: '#f1f5f9', fontSize: '0.92rem', fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>{pend.q}</div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                            {tipo === 'SELECCION' && (<>
                                                                <span style={{ color: '#4ade80', fontSize: '0.82rem' }}>✓ {pend.a}</span>
                                                                {pend.w?.map((w, i) => <span key={i} style={{ color: '#64748b', fontSize: '0.82rem' }}>✗ {w}</span>)}
                                                            </>)}
                                                            {tipo === 'CORTA' && <span style={{ color: '#4ade80', fontSize: '0.82rem' }}>✓ {pend.a}</span>}
                                                            {tipo === 'RELLENAR' && (<>
                                                                {pend.bloques?.[0] && <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>📝 {pend.bloques[0]} <span style={{ color: '#4ade80', background: '#0d2b1b', borderRadius: 3, padding: '0 5px' }}>{pend.bloques[1]}</span>{pend.bloques[2] ? ' ' + pend.bloques[2] : ''}</span>}
                                                                {pend.alternativas?.length > 0 && <span style={{ color: '#64748b', fontSize: '0.78rem' }}>alt: {pend.alternativas.join(', ')}</span>}
                                                            </>)}
                                                            {tipo === 'ORDENAR' && pend.bloques?.map((b, i) => (
                                                                <span key={i} style={{ color: '#94a3b8', fontSize: '0.82rem' }}>{i + 1}. {b}</span>
                                                            ))}
                                                        </div>
                                                    </>);
                                                })()}
                                            </div>
                                            <div style={{ flexShrink: 0, textAlign: 'right' }}>
                                                <div style={{ color: '#64748b', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Categoría</div>
                                                <select
                                                    value={pend.categoria}
                                                    onChange={e => cambiarCategoriaPendiente(pend, e.target.value)}
                                                    title="Cambiar la categoría de esta pregunta"
                                                    style={{ background: '#0f172a', border: `1px solid ${CAT_HEX[pend.categoria] || '#334155'}`, color: CAT_HEX[pend.categoria] || '#f1f5f9', borderRadius: 7, padding: '4px 6px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', outline: 'none', maxWidth: 130 }}
                                                >
                                                    {CAT_IDS.map(id => (
                                                        <option key={id} value={id}>{categorias[id].emoji} {categorias[id].nombre}</option>
                                                    ))}
                                                </select>
                                                <div style={{ marginTop: 6 }}>
                                                    <button
                                                        onClick={() => cambiarDificultadPendiente(pend, pend.dificultad === 'dificil' ? 'normal' : 'dificil')}
                                                        title="Cambiar dificultad"
                                                        style={{ background: pend.dificultad === 'dificil' ? '#7c2d12' : '#0f172a', border: `1px solid ${pend.dificultad === 'dificil' ? '#f97316' : '#334155'}`, color: pend.dificultad === 'dificil' ? '#fdba74' : '#94a3b8', borderRadius: 7, padding: '4px 8px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                                                    >
                                                        {pend.dificultad === 'dificil' ? '🔥 Difícil' : '🟢 Normal'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                            <button
                                                onClick={() => rechazarPendiente(pend)}
                                                style={{ background: '#7f1d1d30', border: '1px solid #ef444430', color: '#f87171', padding: '6px 14px', borderRadius: 7, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
                                            >
                                                ✕ Rechazar
                                            </button>
                                            <button
                                                onClick={() => aceptarPendiente(pend)}
                                                style={{ background: '#14532d', border: '1px solid #4ade8060', color: '#4ade80', padding: '6px 18px', borderRadius: 7, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}
                                            >
                                                ✓ Aceptar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── CATEGORY CONFIG TRIGGER ── */}
                    {esCreador && recursoId && (
                        <button onClick={() => setCatConfigAbierto(true)} style={{ background: '#1e293b', borderRadius: 14, border: `1px solid ${catHex}50`, width: '100%', padding: '12px 18px', color: catHex, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.88rem', fontWeight: 700, textAlign: 'left' }}>
                            <span style={{ fontSize: '1rem' }}>⚙</span>
                            Configurar categoría · {catData.emoji} {catData.nombre}
                            <span style={{ marginLeft: 'auto', color: '#475569' }}>›</span>
                        </button>
                    )}

                    {/* ── Add question form ── */}
                    {recursoId && (
                        <div style={{ background: '#1e293b', borderRadius: 14, border: `1px solid ${catHex}50` }}>
                            <button onClick={() => { setFormAbierto(p => !p); setErrorForm(''); }} style={{ width: '100%', padding: '13px 18px', background: 'none', border: 'none', color: catHex, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.92rem', fontWeight: 700, borderRadius: formAbierto ? '14px 14px 0 0' : 14 }}>
                                <span style={{ fontSize: '1.1rem', transition: 'transform 0.2s', transform: formAbierto ? 'rotate(45deg)' : 'none', display: 'inline-block' }}>＋</span>
                                Añadir pregunta de {catData.nombre}
                            </button>
                            {formAbierto && (
                                <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: `1px solid ${catHex}30` }}>
                                    {/* Tipo de pregunta */}
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <span style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Tipo:</span>
                                        <select value={formTipo} onChange={e => { setFormTipo(e.target.value); setFormBloques(['', '']); setFormAlternativas([]); }} style={{ background: '#0f172a', border: `1px solid ${catHex}60`, borderRadius: 8, color: '#f1f5f9', padding: '7px 10px', fontSize: '0.84rem', fontFamily: 'inherit', outline: 'none', cursor: 'pointer', flex: 1 }}>
                                            <option value="SELECCION">🔘 Selección múltiple</option>
                                            <option value="CORTA">✏️ Respuesta corta</option>
                                            <option value="RELLENAR">📝 Rellenar el hueco</option>
                                            <option value="ORDENAR">🔢 Ordenar elementos</option>
                                        </select>
                                    </div>

                                    {/* Dificultad */}
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <span style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Dificultad:</span>
                                        {['normal', 'dificil'].map(niv => (
                                            <button key={niv} type="button" onClick={() => setFormDificultad(niv)}
                                                style={{ flex: 1, background: formDificultad === niv ? (niv === 'dificil' ? '#7c2d12' : '#14532d') : '#0f172a', border: `1px solid ${formDificultad === niv ? (niv === 'dificil' ? '#f97316' : '#22c55e') : '#334155'}`, color: formDificultad === niv ? (niv === 'dificil' ? '#fdba74' : '#86efac') : '#94a3b8', borderRadius: 8, padding: '7px 10px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
                                                {niv === 'dificil' ? '🔥 Difícil' : '🟢 Normal'}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Campos comunes: pregunta principal */}
                                    {(formTipo === 'SELECCION' || formTipo === 'CORTA' || formTipo === 'ORDENAR') && (
                                        <textarea value={formQ} onChange={e => setFormQ(e.target.value)} placeholder={formTipo === 'ORDENAR' ? 'Instrucción (opcional): ej. "Ordena de mayor a menor…"' : '¿Cuál es la pregunta?'} rows={2} style={{ width: '100%', boxSizing: 'border-box', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', padding: '10px 13px', fontSize: '0.9rem', resize: 'vertical', fontFamily: 'inherit', outline: 'none' }} />
                                    )}

                                    {/* SELECCION: correcta + 3 incorrectas */}
                                    {formTipo === 'SELECCION' && (<>
                                        <input value={formA} onChange={e => setFormA(e.target.value)} placeholder="✓ Respuesta correcta" style={{ width: '100%', boxSizing: 'border-box', background: '#0d2b1b', border: '2px solid #2ecc71', borderRadius: 8, color: '#4ade80', padding: '9px 13px', fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none' }} />
                                        {formW.map((w, i) => (
                                            <input key={i} value={w} onChange={e => { const nw = [...formW]; nw[i] = e.target.value; setFormW(nw); }} placeholder={`✗ Respuesta incorrecta ${i + 1}`} style={{ width: '100%', boxSizing: 'border-box', background: '#2a0d0d', border: '2px solid #e74c3c', borderRadius: 8, color: '#fca5a5', padding: '9px 13px', fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none' }} />
                                        ))}
                                    </>)}

                                    {/* CORTA: respuesta principal + alternativas válidas */}
                                    {formTipo === 'CORTA' && (<>
                                        <input value={formA} onChange={e => setFormA(e.target.value)} placeholder="✓ Respuesta (se compara ignorando acentos y mayúsculas)" style={{ width: '100%', boxSizing: 'border-box', background: '#0d2b1b', border: '2px solid #2ecc71', borderRadius: 8, color: '#4ade80', padding: '9px 13px', fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none' }} />
                                        <div style={{ color: '#64748b', fontSize: '0.76rem', marginTop: 4 }}>Otras respuestas válidas (opcional — también se dan por correctas):</div>
                                        {formAlternativas.map((alt, i) => (
                                            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                <input value={alt} onChange={e => setFormAlternativas(prev => { const n = [...prev]; n[i] = e.target.value; return n; })} placeholder={`Respuesta válida ${i + 1}`} style={{ flex: 1, background: '#0d2b1b', border: '1px solid #2ecc7160', borderRadius: 7, color: '#4ade80', padding: '7px 11px', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none' }} />
                                                <button onClick={() => setFormAlternativas(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem', padding: '0 4px' }}>✕</button>
                                            </div>
                                        ))}
                                        <button onClick={() => setFormAlternativas(prev => [...prev, ''])} style={{ background: '#0f172a', border: '1px dashed #2ecc7140', color: '#4ade80', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', fontSize: '0.78rem', alignSelf: 'flex-start' }}>+ Añadir respuesta válida</button>
                                    </>)}

                                    {/* RELLENAR: texto + hueco + respuesta */}
                                    {formTipo === 'RELLENAR' && (<>
                                        <div style={{ color: '#64748b', fontSize: '0.78rem' }}>El jugador verá el texto antes y después del hueco, y debe escribir la respuesta.</div>
                                        <input value={formBloques[0]} onChange={e => setFormBloques(b => [e.target.value, b[1] || '', b[2] || ''])} placeholder="Texto antes del hueco: ej. «La capital de Francia es»" style={{ width: '100%', boxSizing: 'border-box', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', padding: '9px 13px', fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none' }} />
                                        <input value={formBloques[1] || ''} onChange={e => setFormBloques(b => [b[0] || '', e.target.value, b[2] || ''])} placeholder="✓ Respuesta correcta: ej. «París»" style={{ width: '100%', boxSizing: 'border-box', background: '#0d2b1b', border: '2px solid #2ecc71', borderRadius: 8, color: '#4ade80', padding: '9px 13px', fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none' }} />
                                        <input value={formBloques[2] || ''} onChange={e => setFormBloques(b => [b[0] || '', b[1] || '', e.target.value])} placeholder="Texto después del hueco (opcional): ej. «, ciudad de la luz»" style={{ width: '100%', boxSizing: 'border-box', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', padding: '9px 13px', fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none' }} />
                                        {/* Alternativas */}
                                        <div style={{ color: '#64748b', fontSize: '0.76rem', marginTop: 4 }}>Respuestas alternativas válidas (opcional — se ignoran acentos y mayúsculas):</div>
                                        {formAlternativas.map((alt, i) => (
                                            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                <input value={alt} onChange={e => setFormAlternativas(prev => { const n = [...prev]; n[i] = e.target.value; return n; })} placeholder={`Alternativa ${i + 1}`} style={{ flex: 1, background: '#0d2b1b', border: '1px solid #2ecc7160', borderRadius: 7, color: '#4ade80', padding: '7px 11px', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none' }} />
                                                <button onClick={() => setFormAlternativas(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem', padding: '0 4px' }}>✕</button>
                                            </div>
                                        ))}
                                        <button onClick={() => setFormAlternativas(prev => [...prev, ''])} style={{ background: '#0f172a', border: '1px dashed #2ecc7140', color: '#4ade80', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', fontSize: '0.78rem', alignSelf: 'flex-start' }}>+ Añadir alternativa</button>
                                    </>)}

                                    {/* ORDENAR: lista dinámica de ítems */}
                                    {formTipo === 'ORDENAR' && (<>
                                        <div style={{ color: '#64748b', fontSize: '0.78rem' }}>Añade los elementos en el orden correcto. Los alumnos los recibirán mezclados.</div>
                                        {formBloques.map((b, i) => (
                                            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 700, minWidth: 18 }}>{i + 1}.</span>
                                                <input value={b} onChange={e => setFormBloques(prev => { const n = [...prev]; n[i] = e.target.value; return n; })} placeholder={`Elemento ${i + 1}`} style={{ flex: 1, background: '#0f172a', border: '1px solid #475569', borderRadius: 8, color: '#f1f5f9', padding: '8px 12px', fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none' }} />
                                                {formBloques.length > 2 && <button onClick={() => setFormBloques(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem', padding: '0 4px' }}>✕</button>}
                                            </div>
                                        ))}
                                        <button onClick={() => setFormBloques(prev => [...prev, ''])} style={{ background: '#0f172a', border: '1px dashed #475569', color: '#64748b', borderRadius: 8, padding: '7px', cursor: 'pointer', fontSize: '0.82rem' }}>+ Añadir elemento</button>
                                    </>)}

                                    {/* TTS */}
                                    <div style={{ background: '#0a1628', borderRadius: 10, padding: '10px 14px', border: '1px solid #1e3a5f' }}>
                                        <div style={{ color: '#38bdf8', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>🔊 Texto para leer en voz alta (opcional)</div>
                                        <textarea value={formLectura} onChange={e => setFormLectura(e.target.value)} placeholder="Si rellenas este campo, el navegador leerá este texto al alumno al mostrar la pregunta." rows={2} style={{ width: '100%', boxSizing: 'border-box', background: '#0f172a', border: '1px solid #1e3a5f', borderRadius: 7, color: '#f1f5f9', padding: '8px 12px', fontSize: '0.85rem', resize: 'vertical', fontFamily: 'inherit', outline: 'none', marginBottom: 8 }} />
                                        <select value={formLecturaIdioma} onChange={e => setFormLecturaIdioma(e.target.value)} style={{ background: '#0f172a', border: '1px solid #1e3a5f', borderRadius: 7, color: '#94a3b8', padding: '6px 10px', fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
                                            <option value="es-ES">🇪🇸 Español</option>
                                            <option value="fr-FR">🇫🇷 Francés</option>
                                            <option value="en-US">🇬🇧 Inglés</option>
                                            <option value="ca-ES">🏴 Catalán</option>
                                        </select>
                                    </div>

                                    {errorForm && <div style={{ color: '#fca5a5', fontSize: '0.82rem' }}>⚠ {errorForm}</div>}
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                        <button onClick={() => { setFormAbierto(false); setFormQ(''); setFormA(''); setFormW(['', '', '']); setFormBloques(['', '']); setFormAlternativas([]); setFormDificultad('normal'); setErrorForm(''); }} style={{ background: '#334155', border: 'none', color: '#94a3b8', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem' }}>Cancelar</button>
                                        <button onClick={agregarPregunta} disabled={guardandoPregunta} style={{ background: catHex, border: 'none', color: 'white', padding: '8px 22px', borderRadius: 8, cursor: guardandoPregunta ? 'default' : 'pointer', fontWeight: 700, fontSize: '0.88rem', opacity: guardandoPregunta ? 0.6 : 1 }}>
                                            {guardandoPregunta ? 'Guardando…' : '✓ Añadir pregunta'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Import button ── */}
                    {recursoId && (
                        <button onClick={abrirImport} style={{ background: '#0f172a', border: `1px dashed ${catHex}60`, borderRadius: 14, padding: '12px 18px', cursor: 'pointer', color: catHex, fontWeight: 600, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left' }}>
                            <span style={{ fontSize: '1.1rem' }}>📥</span>
                            Importar preguntas de otro recurso
                        </button>
                    )}

                    {cargandoPreguntas && <p style={{ color: '#64748b', textAlign: 'center', padding: 20 }}>Cargando preguntas…</p>}

                    {!cargandoPreguntas && recursoId && pregsCat.length === 0 && pendientesCat.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '36px 20px', background: '#1e293b', borderRadius: 14, border: '2px dashed #334155' }}>
                            <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>{catData.emoji}</div>
                            <p style={{ color: '#64748b', margin: 0, fontSize: '0.95rem' }}>No hay preguntas de {catData.nombre} todavía.</p>
                        </div>
                    )}

                    {/* ── Accepted question cards ── */}
                    {pregsCat.map((p, idx) => {
                        const puedeEliminar = esCreador || p.autorUid === usuario?.uid;
                        const editando      = esCreador && editandoPregId === p.id;
                        const tipo          = p.tipo || 'SELECCION';
                        const tipoLabel     = { SELECCION: '🔘', CORTA: '✏️', RELLENAR: '📝', ORDENAR: '🔢' }[tipo] || '🔘';
                        return (
                            <div key={p.id} style={{ background: '#1e293b', borderRadius: 12, padding: '14px 18px', border: `1px solid ${editando ? catHex + '80' : catHex + '28'}` }}>
                                {editando ? (
                                    /* ── EDIT MODE ── */
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <span style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>Editando #{idx + 1}</span>
                                            <select value={editForm.tipo} onChange={e => setEditForm(f => ({ ...f, tipo: e.target.value, bloques: f.bloques?.length ? f.bloques : ['', ''] }))} style={{ marginLeft: 'auto', background: '#0f172a', border: `1px solid ${catHex}60`, borderRadius: 7, color: '#f1f5f9', padding: '5px 8px', fontSize: '0.8rem', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
                                                <option value="SELECCION">🔘 Selección múltiple</option>
                                                <option value="CORTA">✏️ Respuesta corta</option>
                                                <option value="RELLENAR">📝 Rellenar el hueco</option>
                                                <option value="ORDENAR">🔢 Ordenar elementos</option>
                                            </select>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <span style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>Dificultad:</span>
                                            {['normal', 'dificil'].map(niv => (
                                                <button key={niv} type="button" onClick={() => setEditForm(f => ({ ...f, dificultad: niv }))}
                                                    style={{ background: (editForm.dificultad || 'normal') === niv ? (niv === 'dificil' ? '#7c2d12' : '#14532d') : '#0f172a', border: `1px solid ${(editForm.dificultad || 'normal') === niv ? (niv === 'dificil' ? '#f97316' : '#22c55e') : '#334155'}`, color: (editForm.dificultad || 'normal') === niv ? (niv === 'dificil' ? '#fdba74' : '#86efac') : '#94a3b8', borderRadius: 7, padding: '5px 10px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                                                    {niv === 'dificil' ? '🔥 Difícil' : '🟢 Normal'}
                                                </button>
                                            ))}
                                        </div>
                                        {(editForm.tipo === 'SELECCION' || editForm.tipo === 'CORTA' || editForm.tipo === 'ORDENAR') && (
                                            <textarea value={editForm.q} onChange={e => setEditForm(f => ({ ...f, q: e.target.value }))} placeholder="Pregunta…" rows={2} style={{ width: '100%', boxSizing: 'border-box', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', padding: '9px 13px', fontSize: '0.9rem', resize: 'vertical', fontFamily: 'inherit', outline: 'none' }} />
                                        )}
                                        {editForm.tipo === 'SELECCION' && (<>
                                            <input value={editForm.a} onChange={e => setEditForm(f => ({ ...f, a: e.target.value }))} placeholder="✓ Respuesta correcta" style={{ background: '#0d2b1b', border: '2px solid #2ecc71', borderRadius: 8, color: '#4ade80', padding: '9px 13px', fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none' }} />
                                            {(editForm.w || ['', '', '']).map((w, i) => (
                                                <input key={i} value={w} onChange={e => { const nw = [...(editForm.w || ['','',''])]; nw[i] = e.target.value; setEditForm(f => ({ ...f, w: nw })); }} placeholder={`✗ Incorrecta ${i + 1}`} style={{ background: '#2a0d0d', border: '2px solid #e74c3c', borderRadius: 8, color: '#fca5a5', padding: '9px 13px', fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none' }} />
                                            ))}
                                        </>)}
                                        {editForm.tipo === 'CORTA' && (<>
                                            <input value={editForm.a} onChange={e => setEditForm(f => ({ ...f, a: e.target.value }))} placeholder="✓ Respuesta" style={{ background: '#0d2b1b', border: '2px solid #2ecc71', borderRadius: 8, color: '#4ade80', padding: '9px 13px', fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none' }} />
                                            <div style={{ color: '#64748b', fontSize: '0.76rem' }}>Otras respuestas válidas (opcional):</div>
                                            {(editForm.alternativas || []).map((alt, i) => (
                                                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                    <input value={alt} onChange={e => setEditForm(f => { const n=[...(f.alternativas||[])]; n[i]=e.target.value; return {...f,alternativas:n}; })} placeholder={`Respuesta válida ${i+1}`} style={{ flex:1, background:'#0d2b1b', border:'1px solid #2ecc7160', borderRadius:7, color:'#4ade80', padding:'7px 11px', fontSize:'0.85rem', fontFamily:'inherit', outline:'none' }} />
                                                    <button onClick={() => setEditForm(f => ({...f, alternativas: (f.alternativas||[]).filter((_,j)=>j!==i)}))} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:'1rem', padding:'0 4px' }}>✕</button>
                                                </div>
                                            ))}
                                            <button onClick={() => setEditForm(f => ({...f, alternativas: [...(f.alternativas||[]), '']}))} style={{ background:'#0f172a', border:'1px dashed #2ecc7140', color:'#4ade80', borderRadius:7, padding:'6px 10px', cursor:'pointer', fontSize:'0.78rem', alignSelf:'flex-start' }}>+ Añadir respuesta válida</button>
                                        </>)}
                                        {editForm.tipo === 'RELLENAR' && (<>
                                            <input value={editForm.bloques?.[0] || ''} onChange={e => setEditForm(f => { const b = [...(f.bloques||['','',''])]; b[0]=e.target.value; return {...f,bloques:b}; })} placeholder="Texto antes del hueco" style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', padding: '9px 13px', fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none' }} />
                                            <input value={editForm.bloques?.[1] || ''} onChange={e => setEditForm(f => { const b = [...(f.bloques||['','',''])]; b[1]=e.target.value; return {...f,bloques:b}; })} placeholder="✓ Respuesta correcta" style={{ background: '#0d2b1b', border: '2px solid #2ecc71', borderRadius: 8, color: '#4ade80', padding: '9px 13px', fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none' }} />
                                            <input value={editForm.bloques?.[2] || ''} onChange={e => setEditForm(f => { const b = [...(f.bloques||['','',''])]; b[2]=e.target.value; return {...f,bloques:b}; })} placeholder="Texto después del hueco (opcional)" style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', padding: '9px 13px', fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none' }} />
                                            <div style={{ color: '#64748b', fontSize: '0.76rem' }}>Alternativas válidas (opcional):</div>
                                            {(editForm.alternativas || []).map((alt, i) => (
                                                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                    <input value={alt} onChange={e => setEditForm(f => { const n=[...(f.alternativas||[])]; n[i]=e.target.value; return {...f,alternativas:n}; })} placeholder={`Alternativa ${i+1}`} style={{ flex:1, background:'#0d2b1b', border:'1px solid #2ecc7160', borderRadius:7, color:'#4ade80', padding:'7px 11px', fontSize:'0.85rem', fontFamily:'inherit', outline:'none' }} />
                                                    <button onClick={() => setEditForm(f => ({...f, alternativas: (f.alternativas||[]).filter((_,j)=>j!==i)}))} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:'1rem', padding:'0 4px' }}>✕</button>
                                                </div>
                                            ))}
                                            <button onClick={() => setEditForm(f => ({...f, alternativas: [...(f.alternativas||[]), '']}))} style={{ background:'#0f172a', border:'1px dashed #2ecc7140', color:'#4ade80', borderRadius:7, padding:'6px 10px', cursor:'pointer', fontSize:'0.78rem', alignSelf:'flex-start' }}>+ Añadir alternativa</button>
                                        </>)}
                                        {editForm.tipo === 'ORDENAR' && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                {(editForm.bloques || []).map((b, i) => (
                                                    <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                        <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 700, minWidth: 18 }}>{i + 1}.</span>
                                                        <input value={b} onChange={e => setEditForm(f => { const n=[...f.bloques]; n[i]=e.target.value; return {...f,bloques:n}; })} style={{ flex: 1, background: '#0f172a', border: '1px solid #475569', borderRadius: 7, color: '#f1f5f9', padding: '7px 10px', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none' }} />
                                                        {(editForm.bloques||[]).length > 2 && <button onClick={() => setEditForm(f => ({...f, bloques: f.bloques.filter((_,j)=>j!==i)}))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem' }}>✕</button>}
                                                    </div>
                                                ))}
                                                <button onClick={() => setEditForm(f => ({...f, bloques: [...(f.bloques||[]), '']}))} style={{ background: '#0f172a', border: '1px dashed #475569', color: '#64748b', borderRadius: 7, padding: '6px', cursor: 'pointer', fontSize: '0.78rem' }}>+ Añadir elemento</button>
                                            </div>
                                        )}
                                        {/* TTS */}
                                        <div style={{ background: '#0f172a', borderRadius: 10, padding: '10px 14px', border: '1px solid #1e3a5f' }}>
                                            <div style={{ color: '#38bdf8', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>🔊 Texto para leer en voz alta (opcional)</div>
                                            <textarea value={editForm.lectura} onChange={e => setEditForm(f => ({ ...f, lectura: e.target.value }))} placeholder="Si rellenas este campo, el navegador leerá este texto al alumno al mostrar la pregunta." rows={2} style={{ width: '100%', boxSizing: 'border-box', background: '#0a1628', border: '1px solid #1e3a5f', borderRadius: 7, color: '#f1f5f9', padding: '8px 12px', fontSize: '0.85rem', resize: 'vertical', fontFamily: 'inherit', outline: 'none', marginBottom: 8 }} />
                                            <select value={editForm.lecturaIdioma} onChange={e => setEditForm(f => ({ ...f, lecturaIdioma: e.target.value }))} style={{ background: '#0a1628', border: '1px solid #1e3a5f', borderRadius: 7, color: '#94a3b8', padding: '6px 10px', fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
                                                <option value="es-ES">🇪🇸 Español</option>
                                                <option value="fr-FR">🇫🇷 Francés</option>
                                                <option value="en-US">🇬🇧 Inglés</option>
                                                <option value="ca-ES">🏴 Catalán</option>
                                            </select>
                                        </div>
                                        <div>
                                            <div style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Creado por</div>
                                            <input value={editForm.autorNombre} onChange={e => setEditForm(f => ({ ...f, autorNombre: e.target.value }))} placeholder="Nombre del autor…" style={{ width: '100%', boxSizing: 'border-box', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#94a3b8', padding: '8px 13px', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none' }} />
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                            <button onClick={cancelarEdicion} style={{ background: '#334155', border: 'none', color: '#94a3b8', padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem' }}>Cancelar</button>
                                            <button onClick={guardarEdicion} disabled={guardandoEdicion} style={{ background: catHex, border: 'none', color: 'white', padding: '7px 22px', borderRadius: 8, cursor: guardandoEdicion ? 'default' : 'pointer', fontWeight: 700, fontSize: '0.88rem', opacity: guardandoEdicion ? 0.6 : 1 }}>
                                                {guardandoEdicion ? 'Guardando…' : '✓ Guardar'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* ── VIEW MODE ── */
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ color: '#475569', fontSize: '0.72rem', marginBottom: 6, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                                <span>{tipoLabel}</span>
                                                <span>#{idx + 1} · {p.autorNombre}</span>
                                                {p.dificultad === 'dificil' && <span style={{ color: '#fdba74', fontSize: '0.68rem', background: '#7c2d12', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>🔥 DIFÍCIL</span>}
                                                {p.lectura && <span style={{ color: '#38bdf8', fontSize: '0.68rem', background: '#0c2a4a', borderRadius: 4, padding: '1px 5px' }}>🔊 {({ 'es-ES': 'ES', 'fr-FR': 'FR', 'en-US': 'EN', 'ca-ES': 'CA' }[p.lecturaIdioma] || 'ES')}</span>}
                                            </div>
                                            {/* Pregunta */}
                                            {tipo !== 'RELLENAR' && p.q && (
                                                <div style={{ color: '#f1f5f9', fontSize: '0.92rem', fontWeight: 600, marginBottom: 8, lineHeight: 1.45 }}>{p.q}</div>
                                            )}
                                            {/* Respuestas según tipo */}
                                            {tipo === 'SELECCION' && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2ecc71', flexShrink: 0 }} />
                                                        <span style={{ color: '#4ade80', fontSize: '0.85rem' }}>{p.a}</span>
                                                    </div>
                                                    {p.w?.map((wr, wi) => (
                                                        <div key={wi} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#e74c3c', flexShrink: 0 }} />
                                                            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{wr}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {tipo === 'CORTA' && (
                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2ecc71', flexShrink: 0 }} />
                                                    <span style={{ color: '#4ade80', fontSize: '0.85rem' }}>{p.a}</span>
                                                </div>
                                            )}
                                            {tipo === 'RELLENAR' && (
                                                <div style={{ color: '#f1f5f9', fontSize: '0.9rem', lineHeight: 1.5 }}>
                                                    <span>{p.bloques?.[0]} </span>
                                                    <span style={{ background: '#0d2b1b', border: '1px solid #2ecc71', color: '#4ade80', borderRadius: 5, padding: '1px 8px', fontWeight: 700 }}>{p.bloques?.[1]}</span>
                                                    {p.bloques?.[2] && <span> {p.bloques[2]}</span>}
                                                    {p.alternativas?.length > 0 && <span style={{ color: '#64748b', fontSize: '0.78rem' }}> · alt: {p.alternativas.join(', ')}</span>}
                                                </div>
                                            )}
                                            {tipo === 'ORDENAR' && (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
                                                    {p.bloques?.map((b, bi) => (
                                                        <span key={bi} style={{ background: '#1e3a5f', border: '1px solid #3b82f640', color: '#93c5fd', borderRadius: 6, padding: '3px 9px', fontSize: '0.82rem' }}>{bi + 1}. {b}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
                                            {/* Reorder */}
                                            {esCreador && (<>
                                                <button onClick={() => moverPregunta(idx, -1)} disabled={idx === 0} style={{ background: '#0f172a', border: '1px solid #334155', color: idx === 0 ? '#334155' : '#94a3b8', padding: '4px 7px', borderRadius: 6, cursor: idx === 0 ? 'default' : 'pointer', fontSize: '0.75rem', lineHeight: 1 }}>↑</button>
                                                <button onClick={() => moverPregunta(idx, 1)} disabled={idx === pregsCat.length - 1} style={{ background: '#0f172a', border: '1px solid #334155', color: idx === pregsCat.length - 1 ? '#334155' : '#94a3b8', padding: '4px 7px', borderRadius: 6, cursor: idx === pregsCat.length - 1 ? 'default' : 'pointer', fontSize: '0.75rem', lineHeight: 1 }}>↓</button>
                                            </>)}
                                            <button onClick={() => abrirPreview(p)} title="Previsualizar" style={{ background: '#1a1f2e', border: '1px solid #334155', color: '#94a3b8', padding: '5px 9px', borderRadius: 7, cursor: 'pointer', fontSize: '0.8rem' }}>👁</button>
                                            {esCreador && (
                                                <button onClick={() => abrirEdicion(p)} style={{ background: '#1e3a5f', border: '1px solid #3b82f660', color: '#60a5fa', padding: '5px 9px', borderRadius: 7, cursor: 'pointer', fontSize: '0.8rem' }}>✏️</button>
                                            )}
                                            {esCreador && (
                                                <select value="" onChange={e => cambiarCategoriaPregunta(p.id, e.target.value)} title="Mover a otra categoría" style={{ background: '#0f172a', border: '1px solid #334155', color: '#94a3b8', borderRadius: 7, padding: '5px 7px', fontSize: '0.75rem', cursor: 'pointer', outline: 'none', maxWidth: 110 }}>
                                                    <option value="">Mover a…</option>
                                                    {CAT_IDS.filter(id => id !== tabActiva).map(id => (
                                                        <option key={id} value={id}>{categorias[id].emoji} {categorias[id].nombre}</option>
                                                    ))}
                                                </select>
                                            )}
                                            {puedeEliminar && (
                                                <button onClick={() => eliminarPregunta(p.id, p.autorUid)} style={{ background: '#7f1d1d30', border: '1px solid #ef444430', color: '#f87171', padding: '5px 9px', borderRadius: 7, cursor: 'pointer', fontSize: '0.8rem' }}>🗑</button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* ── COLLABORATION PANEL ── */}
                {panelColab && (
                    <div style={{ width: isMobile ? '100%' : 300, background: '#1e293b', borderLeft: isMobile ? 'none' : '1px solid #334155', borderTop: isMobile ? '1px solid #334155' : 'none', overflowY: isMobile ? 'visible' : 'auto', padding: 18, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 20, boxSizing: 'border-box' }}>

                        {/* ── RECEIVE QUESTIONS (Question Sender) ── */}
                        {esCreador && recursoId && (
                            <div>
                                <div style={labelStyle}>📬 Recibir preguntas</div>
                                {!codigoEnvio ? (
                                    <>
                                        <p style={{ color: '#475569', fontSize: '0.75rem', margin: '0 0 10px', lineHeight: 1.5 }}>
                                            Genera un enlace para que alumnos o colaboradores envíen preguntas. Tú las revisas antes de añadirlas al Trivial.
                                        </p>
                                        <button
                                            onClick={generarCodigoEnvio}
                                            disabled={generandoCodigo}
                                            style={{ background: '#0a2a18', border: '1px solid #2ecc71', color: '#2ecc71', padding: '9px 14px', borderRadius: 8, cursor: generandoCodigo ? 'default' : 'pointer', fontWeight: 600, fontSize: '0.82rem', width: '100%', opacity: generandoCodigo ? 0.6 : 1 }}
                                        >
                                            {generandoCodigo ? '…' : '⚡ Activar recepción de preguntas'}
                                        </button>
                                    </>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <div style={codeBox}>
                                            <span style={{ color: '#f59e0b', fontWeight: 900, fontSize: '1.1rem', letterSpacing: 3 }}>{codigoEnvio}</span>
                                            <CopyBtn texto={codigoEnvio} id="envio" copiado={copiado} copiar={copiar} />
                                        </div>
                                        <button
                                            onClick={() => copiar(`${window.location.origin}${window.location.pathname}?trivial_envio=${codigoEnvio}`, 'link_envio')}
                                            style={{ background: copiado === 'link_envio' ? '#0a2a18' : '#0f172a', border: '1px solid #f59e0b40', color: copiado === 'link_envio' ? '#4ade80' : '#f59e0b', padding: '8px 12px', borderRadius: 7, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, textAlign: 'left', transition: '0.2s' }}
                                        >
                                            {copiado === 'link_envio' ? '✓ ¡Enlace copiado!' : '🔗 Copiar enlace directo'}
                                        </button>
                                        {totalPendientes > 0 && (
                                            <div style={{ background: '#f59e0b18', border: '1px solid #f59e0b40', borderRadius: 8, padding: '8px 12px', color: '#f59e0b', fontSize: '0.82rem', fontWeight: 600 }}>
                                                🕐 {totalPendientes} pregunta{totalPendientes !== 1 ? 's' : ''} pendiente{totalPendientes !== 1 ? 's' : ''} de revisión
                                            </div>
                                        )}
                                        <p style={{ color: '#475569', fontSize: '0.73rem', margin: 0, lineHeight: 1.5 }}>
                                            Comparte el código o el enlace. Las preguntas enviadas aparecerán en cada categoría con el cartel «PENDIENTE» para que las revises.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Game code ── */}
                        {codigoJuego && (
                            <div>
                                <div style={labelStyle}>Código para alumnos</div>
                                <div style={codeBox}>
                                    <span style={{ color: '#38bdf8', fontWeight: 900, fontSize: '1.25rem', letterSpacing: 4 }}>{codigoJuego}</span>
                                    <CopyBtn texto={codigoJuego} id="juego" copiado={copiado} copiar={copiar} />
                                </div>
                                <p style={{ color: '#475569', fontSize: '0.75rem', margin: '6px 0 0' }}>Los alumnos usan este código en el buscador del juego.</p>
                            </div>
                        )}

                        {/* ── Direct play link ── */}
                        {recursoId && (
                            <div>
                                <div style={labelStyle}>Enlace directo para jugar</div>
                                <button
                                    onClick={() => copiar(`${window.location.origin}${window.location.pathname}?trivial=${recursoId}`, 'link_jugar')}
                                    style={{ width: '100%', background: copiado === 'link_jugar' ? '#0a2a18' : '#0f172a', border: '1px solid #38bdf840', color: copiado === 'link_jugar' ? '#4ade80' : '#38bdf8', padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, textAlign: 'left', transition: '0.2s' }}
                                >
                                    {copiado === 'link_jugar' ? '✓ ¡Enlace copiado!' : '🔗 Copiar enlace del Trivial'}
                                </button>
                                <p style={{ color: '#475569', fontSize: '0.73rem', margin: '6px 0 0', lineHeight: 1.5 }}>
                                    Quien abra este enlace entra directamente a este Trivial con las preguntas cargadas, sin necesidad de registrarse.
                                </p>
                            </div>
                        )}

                        {/* ── Invitation codes ── */}
                        {codigosCategoria && (
                            <div>
                                <div style={labelStyle}>Códigos de invitación por categoría</div>
                                <p style={{ color: '#475569', fontSize: '0.75rem', margin: '0 0 10px' }}>Comparte el código de una categoría para que otro profesor añada preguntas en ella.</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                    {CAT_IDS.map(id => (
                                        <div key={id} style={{ background: '#0f172a', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span>{categorias[id].emoji}</span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ color: CAT_HEX[id], fontSize: '0.73rem', fontWeight: 600 }}>{categorias[id].nombre}</div>
                                                <div style={{ color: '#64748b', fontSize: '0.78rem', fontFamily: 'monospace', letterSpacing: 1 }}>{codigosCategoria[id]}</div>
                                            </div>
                                            <CopyBtn texto={codigosCategoria[id]} id={id} copiado={copiado} copiar={copiar} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── Email sharing ── */}
                        {esCreador && recursoId && (
                            <div>
                                <div style={labelStyle}>Compartir con profesor</div>
                                <p style={{ color: '#475569', fontSize: '0.75rem', margin: '0 0 10px' }}>El profesor añadido podrá añadir y borrar sus propias preguntas.</p>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <input value={emailNuevo} onChange={e => { setEmailNuevo(e.target.value); setErrorColab(''); }} onKeyDown={e => e.key === 'Enter' && agregarColaboradorPorEmail()} placeholder="email@profesor.com" style={{ flex: 1, background: '#0f172a', border: '1px solid #334155', borderRadius: 7, color: '#f1f5f9', padding: '8px 10px', fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none' }} />
                                    <button onClick={agregarColaboradorPorEmail} disabled={agregandoColab} style={{ background: '#1d4ed8', border: 'none', color: 'white', padding: '8px 12px', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>{agregandoColab ? '…' : 'Añadir'}</button>
                                </div>
                                {errorColab && <div style={{ color: '#fca5a5', fontSize: '0.78rem', marginTop: 6 }}>⚠ {errorColab}</div>}
                                {colaboradores.length > 0 && (
                                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {colaboradores.map(c => (
                                            <div key={c.uid} style={{ background: '#0f172a', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ color: '#e2e8f0', fontSize: '0.83rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</div>
                                                    <div style={{ color: '#64748b', fontSize: '0.73rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>
                                                </div>
                                                <button onClick={() => quitarColaborador(c.uid)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.9rem', padding: 2 }}>✕</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {!esCreador && (
                            <div style={{ color: '#64748b', fontSize: '0.83rem', background: '#0f172a', borderRadius: 8, padding: 12, lineHeight: 1.5 }}>
                                Eres colaborador de este recurso. Puedes añadir preguntas y eliminar las tuyas propias.
                            </div>
                        )}

                        {/* ── Stats ── */}
                        {recursoId && (
                            <div>
                                <div style={labelStyle}>Preguntas por categoría</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {CAT_IDS.map(id => {
                                        const n   = preguntas[id]?.length ?? 0;
                                        const pct = Math.min(100, (n / 20) * 100);
                                        return (
                                            <div key={id}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                                    <span style={{ color: CAT_HEX[id], fontSize: '0.76rem' }}>{categorias[id].emoji} {categorias[id].nombre}</span>
                                                    <span style={{ color: '#64748b', fontSize: '0.76rem' }}>{n}</span>
                                                </div>
                                                <div style={{ height: 4, background: '#334155', borderRadius: 2 }}>
                                                    <div style={{ height: 4, background: CAT_HEX[id], borderRadius: 2, width: `${pct}%`, transition: 'width 0.4s' }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Image search ──────────────────────────────────────────────────────────────
function ImageSearchPanel({ currentUrl, onSelect, accentColor }) {
    const [abierto,    setAbierto]    = useState(false);
    const [query,      setQuery]      = useState('');
    const [buscando,   setBuscando]   = useState(false);
    const [resultados, setResultados] = useState([]);

    const buscar = async () => {
        if (!query.trim()) return;
        setBuscando(true);
        try {
            const res  = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(query)}&gsrlimit=24&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json&origin=*`);
            const data = await res.json();
            const pages = data.query?.pages || {};
            const urls  = Object.values(pages)
                .map(p => { const info = p.imageinfo?.[0]; return info?.thumburl || info?.url; })
                .filter(u => u && /\.(jpe?g|png|gif|webp|svg)(\?|$)/i.test(u));
            setResultados(urls);
        } catch { /* ignore */ }
        setBuscando(false);
    };

    return (
        <div>
            {currentUrl && (
                <div style={{ position: 'relative', marginBottom: 8 }}>
                    <img src={currentUrl} alt="portada" style={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                    <button onClick={() => onSelect('')} style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(15,23,42,0.85)', border: '1px solid #475569', color: '#f87171', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: '0.75rem' }}>✕ Quitar</button>
                </div>
            )}
            <button onClick={() => setAbierto(p => !p)} style={{ background: abierto ? accentColor + '20' : '#0f172a', border: `1px dashed ${accentColor}80`, color: accentColor, borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: '0.83rem', fontWeight: 600, width: '100%', textAlign: 'left' }}>
                🔍 {abierto ? 'Cerrar buscador' : currentUrl ? 'Cambiar imagen' : 'Añadir imagen'}
            </button>
            {abierto && (
                <div style={{ marginTop: 8, background: '#0a111e', borderRadius: 10, padding: 12, border: '1px solid #1e293b' }}>
                    <p style={{ margin: '0 0 8px', fontSize: '0.73rem', color: '#64748b' }}>Wikimedia Commons — imágenes libres de derechos</p>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                        <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscar()} placeholder="Ej: mapa Europa, célula vegetal…" style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: 7, color: '#f1f5f9', padding: '8px 10px', fontSize: '0.83rem', fontFamily: 'inherit', outline: 'none' }} />
                        <button onClick={buscar} disabled={buscando} style={{ background: accentColor, border: 'none', color: 'white', borderRadius: 7, padding: '0 14px', cursor: buscando ? 'default' : 'pointer', fontWeight: 700, fontSize: '0.83rem', opacity: buscando ? 0.6 : 1 }}>{buscando ? '…' : 'Buscar'}</button>
                    </div>
                    <input placeholder="O pega una URL directamente…" style={{ width: '100%', boxSizing: 'border-box', background: '#1e293b', border: '1px solid #334155', borderRadius: 7, color: '#94a3b8', padding: '7px 10px', fontSize: '0.78rem', fontFamily: 'inherit', outline: 'none', marginBottom: resultados.length ? 8 : 0 }}
                        onBlur={e => { if (e.target.value.startsWith('http')) { onSelect(e.target.value); setAbierto(false); } }}
                        onKeyDown={e => { if (e.key === 'Enter' && e.target.value.startsWith('http')) { onSelect(e.target.value); setAbierto(false); } }}
                    />
                    {resultados.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                            {resultados.map((url, i) => (
                                <img key={i} src={url} alt="resultado"
                                    onClick={() => { onSelect(url); setAbierto(false); setResultados([]); setQuery(''); }}
                                    onError={e => { e.target.style.display = 'none'; }}
                                    style={{ width: '100%', height: 70, objectFit: 'cover', borderRadius: 6, cursor: 'pointer', border: '2px solid transparent', transition: '0.15s' }}
                                    onMouseEnter={e => { e.target.style.borderColor = accentColor; }}
                                    onMouseLeave={e => { e.target.style.borderColor = 'transparent'; }}
                                />
                            ))}
                        </div>
                    )}
                    {resultados.length === 0 && !buscando && query && <p style={{ textAlign: 'center', color: '#475569', fontSize: '0.8rem', margin: 0 }}>Sin resultados. Prueba otro término.</p>}
                </div>
            )}
        </div>
    );
}

function CopyBtn({ texto, id, copiado, copiar }) {
    const done = copiado === id;
    return (
        <button onClick={() => copiar(texto, id)} style={{ background: done ? '#166534' : '#334155', border: 'none', color: done ? '#4ade80' : '#94a3b8', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem', flexShrink: 0, transition: 'background 0.2s' }}>
            {done ? '✓' : 'Copiar'}
        </button>
    );
}

const labelStyle = { color: '#94a3b8', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 };
const codeBox    = { background: '#0f172a', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
