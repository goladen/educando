import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import {
    collection, doc, addDoc, setDoc, getDocs, updateDoc, deleteDoc,
    query, where, serverTimestamp, orderBy
} from 'firebase/firestore';

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

    // ── Save ───────────────────────────────────────────────────────────────────
    const [guardando,    setGuardando]    = useState(false);
    const [errorGuardar, setErrorGuardar] = useState('');
    const [copiado,      setCopiado]      = useState('');

    // ── Effects ────────────────────────────────────────────────────────────────
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
        setFormLectura(''); setFormLecturaIdioma('es-ES'); setErrorForm('');
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
        let data = { categoria: tabActiva, tipo: formTipo, autorUid: usuario.uid, autorNombre: usuario.displayName || usuario.email, fechaCreacion: serverTimestamp(), orden: Date.now(), ...lecturaData };

        if (formTipo === 'SELECCION') {
            if (!formQ.trim()) { setErrorForm('Escribe la pregunta.'); return; }
            if (!formA.trim()) { setErrorForm('Escribe la respuesta correcta.'); return; }
            if (formW.some(w => !w.trim())) { setErrorForm('Completa las tres respuestas incorrectas.'); return; }
            data = { ...data, q: formQ.trim(), a: formA.trim(), w: formW.map(s => s.trim()) };
        } else if (formTipo === 'CORTA') {
            if (!formQ.trim()) { setErrorForm('Escribe la pregunta.'); return; }
            if (!formA.trim()) { setErrorForm('Escribe la respuesta.'); return; }
            data = { ...data, q: formQ.trim(), a: formA.trim() };
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
            setFormLectura(''); setFormLecturaIdioma('es-ES'); setFormAbierto(false);
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
        setEditForm({ tipo: p.tipo || 'SELECCION', q: p.q || '', a: p.a || '', w: [...(p.w || ['', '', ''])], bloques, alternativas: [...(p.alternativas || [])], autorNombre: p.autorNombre || '', lectura: p.lectura || '', lecturaIdioma: p.lecturaIdioma || 'es-ES' });
    };

    const guardarEdicion = async () => {
        setGuardandoEdicion(true);
        try {
            const lecturaUpd = editForm.lectura.trim()
                ? { lectura: editForm.lectura.trim(), lecturaIdioma: editForm.lecturaIdioma }
                : { lectura: '', lecturaIdioma: editForm.lecturaIdioma };
            let upd = { tipo: editForm.tipo, autorNombre: editForm.autorNombre.trim(), ...lecturaUpd };
            if (editForm.tipo === 'SELECCION') {
                upd = { ...upd, q: editForm.q.trim(), a: editForm.a.trim(), w: editForm.w.map(s => s.trim()) };
            } else if (editForm.tipo === 'CORTA') {
                upd = { ...upd, q: editForm.q.trim(), a: editForm.a.trim() };
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
            const base = { tipo, categoria: pend.categoria, autorUid: 'externo', autorNombre, fechaCreacion: serverTimestamp(), orden: Date.now(), ...lecturaData };
            let data = base;
            if (tipo === 'SELECCION') data = { ...base, q: pend.q, a: pend.a, w: pend.w };
            else if (tipo === 'CORTA') data = { ...base, q: pend.q, a: pend.a };
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

    // ── Derived ────────────────────────────────────────────────────────────────
    const catData       = categorias[tabActiva];
    const catHex        = CAT_HEX[tabActiva];
    const pregsCat      = preguntas[tabActiva];
    const pendientesCat = pendientes[tabActiva] || [];
    const totalPreguntas = Object.values(preguntas).reduce((s, arr) => s + arr.length, 0);
    const totalPendientes = Object.values(pendientes).reduce((s, arr) => s + arr.length, 0);

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div style={{ position: 'fixed', inset: 0, background: '#0f172a', zIndex: 2000, display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI', sans-serif" }}>

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
                            {!previewRevelado && previewInput.trim() && (
                                <div style={{ marginTop: 10, color: cleanPrev(previewInput) === cleanPrev(p.a) ? '#4ade80' : '#f87171', fontSize: '0.85rem', fontWeight: 700 }}>
                                    {cleanPrev(previewInput) === cleanPrev(p.a) ? '✓ Correcto' : '✗ Incorrecto'}
                                </div>
                            )}
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
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                {/* ── Questions column ── */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

                    {esNuevo && !recursoId && (
                        <div style={{ background: '#1e3a8a22', border: '1px solid #3b82f660', borderRadius: 12, padding: '14px 18px', color: '#93c5fd', fontSize: '0.9rem' }}>
                            Pon un título y pulsa <strong>✓ Crear</strong> para empezar a añadir preguntas.
                        </div>
                    )}

                    {/* ── PENDING QUESTIONS for this category ── */}
                    {esCreador && pendientesCat.length > 0 && (
                        <div style={{ background: '#1c1a07', border: '1.5px solid #f59e0b60', borderRadius: 14, overflow: 'hidden' }}>
                            <div style={{ background: '#f59e0b18', borderBottom: '1px solid #f59e0b30', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: '1rem' }}>🕐</span>
                                <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.88rem' }}>
                                    Pendientes de revisión — {pendientesCat.length} pregunta{pendientesCat.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 18px' }}>
                                {pendientesCat.map(pend => (
                                    <div key={pend.id} style={{ background: '#0f172a', borderRadius: 10, padding: '13px 16px', border: '1px solid #f59e0b30' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
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

                    {/* ── CATEGORY CONFIG PANEL ── */}
                    {esCreador && recursoId && (
                        <div style={{ background: '#1e293b', borderRadius: 14, border: `1px solid ${catHex}50`, overflow: 'hidden' }}>
                            <button onClick={() => setCatConfigAbierto(p => !p)} style={{ width: '100%', padding: '12px 18px', background: 'none', border: 'none', color: catHex, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.88rem', fontWeight: 700 }}>
                                <span style={{ fontSize: '0.8rem', transition: 'transform 0.2s', transform: catConfigAbierto ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>▶</span>
                                ⚙ Configurar categoría · {catData.emoji} {catData.nombre}
                            </button>
                            {catConfigAbierto && (
                                <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        <div style={{ flex: '0 0 64px', position: 'relative' }} ref={emojiPickerRef}>
                                            <div style={labelStyle}>Emoji</div>
                                            <button
                                                onClick={() => setEmojiPickerAbierto(p => !p)}
                                                style={{ width: '100%', background: '#0f172a', border: `1px solid ${catHex}60`, borderRadius: 8, color: '#f1f5f9', padding: '7px 4px', fontSize: '1.5rem', textAlign: 'center', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            >{catData.emoji}</button>
                                            {emojiPickerAbierto && (
                                                <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: '#1e293b', border: '1px solid #334155', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.6)', width: 320, maxHeight: 380, overflowY: 'auto', padding: 14 }}>
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
                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <button onClick={guardarCategoria} disabled={guardandoCat} style={{ background: savedCat ? '#166534' : catHex, border: 'none', color: 'white', padding: '8px 22px', borderRadius: 8, cursor: guardandoCat ? 'default' : 'pointer', fontWeight: 700, fontSize: '0.88rem', opacity: guardandoCat ? 0.7 : 1, transition: 'background 0.3s' }}>
                                            {guardandoCat ? 'Guardando…' : savedCat ? '✓ Guardado' : '✓ Guardar categoría'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
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
                                        <select value={formTipo} onChange={e => { setFormTipo(e.target.value); setFormBloques(['', '']); }} style={{ background: '#0f172a', border: `1px solid ${catHex}60`, borderRadius: 8, color: '#f1f5f9', padding: '7px 10px', fontSize: '0.84rem', fontFamily: 'inherit', outline: 'none', cursor: 'pointer', flex: 1 }}>
                                            <option value="SELECCION">🔘 Selección múltiple</option>
                                            <option value="CORTA">✏️ Respuesta corta</option>
                                            <option value="RELLENAR">📝 Rellenar el hueco</option>
                                            <option value="ORDENAR">🔢 Ordenar elementos</option>
                                        </select>
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

                                    {/* CORTA: solo respuesta */}
                                    {formTipo === 'CORTA' && (
                                        <input value={formA} onChange={e => setFormA(e.target.value)} placeholder="✓ Respuesta (se compara ignorando acentos y mayúsculas)" style={{ width: '100%', boxSizing: 'border-box', background: '#0d2b1b', border: '2px solid #2ecc71', borderRadius: 8, color: '#4ade80', padding: '9px 13px', fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none' }} />
                                    )}

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
                                        <button onClick={() => { setFormAbierto(false); setFormQ(''); setFormA(''); setFormW(['', '', '']); setFormBloques(['', '']); setFormAlternativas([]); setErrorForm(''); }} style={{ background: '#334155', border: 'none', color: '#94a3b8', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem' }}>Cancelar</button>
                                        <button onClick={agregarPregunta} disabled={guardandoPregunta} style={{ background: catHex, border: 'none', color: 'white', padding: '8px 22px', borderRadius: 8, cursor: guardandoPregunta ? 'default' : 'pointer', fontWeight: 700, fontSize: '0.88rem', opacity: guardandoPregunta ? 0.6 : 1 }}>
                                            {guardandoPregunta ? 'Guardando…' : '✓ Añadir pregunta'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
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
                                        {(editForm.tipo === 'SELECCION' || editForm.tipo === 'CORTA' || editForm.tipo === 'ORDENAR') && (
                                            <textarea value={editForm.q} onChange={e => setEditForm(f => ({ ...f, q: e.target.value }))} placeholder="Pregunta…" rows={2} style={{ width: '100%', boxSizing: 'border-box', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', padding: '9px 13px', fontSize: '0.9rem', resize: 'vertical', fontFamily: 'inherit', outline: 'none' }} />
                                        )}
                                        {editForm.tipo === 'SELECCION' && (<>
                                            <input value={editForm.a} onChange={e => setEditForm(f => ({ ...f, a: e.target.value }))} placeholder="✓ Respuesta correcta" style={{ background: '#0d2b1b', border: '2px solid #2ecc71', borderRadius: 8, color: '#4ade80', padding: '9px 13px', fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none' }} />
                                            {(editForm.w || ['', '', '']).map((w, i) => (
                                                <input key={i} value={w} onChange={e => { const nw = [...(editForm.w || ['','',''])]; nw[i] = e.target.value; setEditForm(f => ({ ...f, w: nw })); }} placeholder={`✗ Incorrecta ${i + 1}`} style={{ background: '#2a0d0d', border: '2px solid #e74c3c', borderRadius: 8, color: '#fca5a5', padding: '9px 13px', fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none' }} />
                                            ))}
                                        </>)}
                                        {editForm.tipo === 'CORTA' && (
                                            <input value={editForm.a} onChange={e => setEditForm(f => ({ ...f, a: e.target.value }))} placeholder="✓ Respuesta" style={{ background: '#0d2b1b', border: '2px solid #2ecc71', borderRadius: 8, color: '#4ade80', padding: '9px 13px', fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none' }} />
                                        )}
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
                    <div style={{ width: 300, background: '#1e293b', borderLeft: '1px solid #334155', overflowY: 'auto', padding: 18, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>

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
