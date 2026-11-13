// Importar preguntas a un editor de recursos desde:
//   · la base de PiKT (bancoPreguntas/recursosPikt: etapa, materia, tema, curso)
//   · recursos públicos de otros profesores
//   · mis recursos
// Filtros: palabras clave (en pregunta, respuesta, título, temas y hoja), etapa, materia, curso y autor.
// Se elige la hoja de destino (o una nueva) y las preguntas se convierten al formato del editor.
import { useEffect, useMemo, useState } from 'react';
import { db, auth } from '../firebase';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { revisarPregunta, JUEGOS_DE_TIPO } from '../utils/encajeTexto';

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const barajar = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// Tipos de recurso de los que se pueden sacar preguntas
const TIPOS_ORIGEN = ['CAZABURBUJAS', 'PIKATRON', 'THINKHOOT', 'RULETA', 'JEOPARDY', 'PASAPALABRA', 'APAREJADOS', 'OLYMPICLIVE'];
// Editores en los que tiene sentido importar (preguntas con respuesta)
export const DESTINOS = ['CAZABURBUJAS', 'PIKATRON', 'THINKHOOT', 'RULETA', 'PASAPALABRA', 'APAREJADOS', 'JEOPARDY'];
const ETAPAS = [['', 'Todas'], ['Primaria', 'Primaria'], ['Secundaria', 'ESO'], ['Bachillerato', 'Bachillerato']];
// Palabras con las que se reconoce cada materia en los recursos de los profes (no tienen campo materia)
const SINONIMOS = {
    matematicas: ['matemat', 'mates', 'calculo', 'algebra', 'geometr', 'fraccion', 'ecuacion'],
    geografia: ['geograf', 'paises', 'capitales', 'rios', 'mapa'],
    historia: ['histori', 'edad media', 'romanos', 'prehistoria'],
    ciencias: ['ciencias', 'naturales', 'medio'],
    biologia: ['biolog', 'celula', 'cuerpo humano', 'animales', 'plantas'],
    fyq: ['fisica', 'quimica', 'atomo', 'energia', 'fuerza'],
    ingles: ['ingles', 'english', 'verbs', 'vocabulary', 'grammar'],
    frances: ['frances', 'francais'],
    arte: ['arte', 'literatura', 'pintura', 'lengua'],
    espectaculos: ['cine', 'musica', 'television', 'peliculas'],
    deportes: ['deporte', 'futbol', 'educacion fisica'],
};

/** Pregunta cruda de cualquier recurso → { pregunta, respuesta, incorrectas, letra? } */
export function aComun(q) {
    if (!q || typeof q !== 'object') return null;
    const tipo = String(q.tipo || '').toUpperCase();
    if (tipo === 'PRESENTATION' || tipo === 'DIBUJO' || tipo === 'ORDENAR') return null;
    let pregunta = String(q.pregunta ?? q.q ?? q.enunciado ?? q.terminoA ?? '').trim();
    let respuesta = String(q.respuesta || q.correcta || q.a || q.terminoB || '').trim();
    if (Array.isArray(q.bloques) && q.bloques.length >= 3 && (tipo === 'RELLENAR' || q.bloques[1])) {
        const [a, h, d] = q.bloques.map(x => String(x ?? '').trim());
        if (tipo === 'RELLENAR' || !pregunta) { pregunta = `${a} ___ ${d}`.trim(); respuesta = h || respuesta; }
    }
    if (!pregunta || !respuesta) return null;
    const mal = [...new Set((q.incorrectas || q.mal || q.w || []).map(x => String(x ?? '').trim()).filter(x => x && norm(x) !== norm(respuesta)))].slice(0, 3);
    return { pregunta, respuesta, incorrectas: mal, letra: q.letra };
}

/** Al formato del editor de destino. */
export function aDestino(c, tipoJuego, pool, extra = {}) {
    const t = String(tipoJuego || '').toUpperCase();
    if (t === 'PASAPALABRA') {
        const primera = String(c.respuesta).trim()[0]?.toUpperCase() || '';
        const sinTilde = primera === 'Ñ' ? 'Ñ' : primera.normalize('NFD').replace(/[̀-ͯ]/g, '');
        const letra = String(c.letra || '').toUpperCase() || (/^[A-ZÑ]$/.test(sinTilde) ? sinTilde : 'A');
        return { letra, pregunta: c.pregunta, respuesta: c.respuesta, correcta: '', incorrectas: ['', '', ''] };
    }
    if (t === 'APAREJADOS') return { terminoA: c.pregunta, terminoB: c.respuesta, pregunta: '', respuesta: '', correcta: '', incorrectas: ['', '', ''] };
    // Opción múltiple: si faltan respuestas incorrectas se toman de otras preguntas importadas
    const inc = [...c.incorrectas];
    if (inc.length < 3) {
        for (const r of barajar(pool)) { if (inc.length >= 3) break; if (norm(r) !== norm(c.respuesta) && !inc.some(x => norm(x) === norm(r))) inc.push(r); }
    }
    if (t === 'JEOPARDY') return { pregunta: c.pregunta, correcta: c.respuesta, incorrectas: inc, tipo: inc.length ? 'MULTIPLE' : 'SIMPLE' };
    while (inc.length < 3) inc.push('');
    const base = { tipo: 'MULTIPLE', pregunta: c.pregunta, respuesta: c.respuesta, correcta: c.respuesta, incorrectas: inc.slice(0, 3) };
    if (t === 'THINKHOOT') return { ...base, tiempo: 20, puntosMax: 100, puntosMin: 10, bloques: [], numBloques: 4 };
    return { ...base, ...extra };
}

export default function ImportarPreguntas({ tipoJuego, hojas = [], maxHojas = 99, maxPorHoja = Infinity, onImportar, onClose, extraPregunta }) {
    const [fuente, setFuente] = useState('pikt');
    const [texto, setTexto] = useState('');
    const [etapa, setEtapa] = useState('');
    const [materia, setMateria] = useState('');
    const [curso, setCurso] = useState('');
    const [autor, setAutor] = useState('');
    const [soloCaben, setSoloCaben] = useState(false);
    const [datos, setDatos] = useState({ pikt: null, profes: null, mias: null });
    const [etiquetas, setEtiquetas] = useState(null);
    const [error, setError] = useState('');
    const [sel, setSel] = useState(new Set());
    const [destino, setDestino] = useState(hojas.length ? 0 : 'nueva');
    const [nombreNueva, setNombreNueva] = useState('');
    const uid = auth.currentUser?.uid;

    // Carga perezosa de cada fuente
    useEffect(() => {
        if (datos[fuente]) return;
        let vivo = true;
        setError('');
        (async () => {
            try {
                let lista = [];
                if (fuente === 'pikt') {
                    const m = await import('../bancoPreguntas/recursosPikt');
                    const { ETAPAS: E, MATERIAS: M } = m.ETIQUETAS_PIKT;
                    if (vivo) setEtiquetas({ E, M });
                    const ps = await m.cargarPreguntasPikt();
                    lista = ps.map((p, i) => ({
                        id: 'k' + i, q: p, origen: 'PiKT',
                        ciclo: [E[p.etapa]?.ciclo], materia: p.materia, curso: p.curso || '',
                        donde: [M[p.materia]?.label, E[p.etapa]?.label + (p.curso ? ` · ${p.curso}.º` : ''), p.tema].filter(Boolean).join(' · '),
                    }));
                } else {
                    if (fuente === 'mias' && !uid) throw new Error('Inicia sesión para ver tus recursos.');
                    const q = fuente === 'mias'
                        ? query(collection(db, 'resources'), where('profesorUid', '==', uid))
                        : query(collection(db, 'resources'), where('tipoJuego', 'in', TIPOS_ORIGEN), limit(500));
                    const snap = await getDocs(q);
                    snap.docs.forEach(d => {
                        const r = { id: d.id, ...d.data() };
                        if (!TIPOS_ORIGEN.includes(r.tipoJuego)) return;
                        if (fuente === 'profes' && (r.isPrivate === true || !(r.isFinished === true || r.config?.isFinished === true))) return;
                        const ciclo = Array.isArray(r.ciclo) ? r.ciclo : r.ciclo ? [r.ciclo] : Array.isArray(r.config?.ciclo) ? r.config.ciclo : [r.config?.ciclo].filter(Boolean);
                        (r.hojas || []).forEach((h, hi) => (h.preguntas || []).forEach((p, pi) => {
                            lista.push({
                                id: `${r.id}-${hi}-${pi}`, q: p, origen: fuente === 'mias' ? 'Mío' : (r.profesorNombre || 'Profesor'),
                                ciclo, materia: '', curso: '', autor: r.profesorNombre || '',
                                contexto: `${r.titulo || ''} ${r.temas || ''} ${h.nombreHoja || ''}`,
                                donde: [r.titulo, h.nombreHoja, r.profesorNombre && fuente !== 'mias' ? `de ${r.profesorNombre}` : ''].filter(Boolean).join(' · '),
                            });
                        }));
                    });
                }
                // Solo las que se pueden convertir
                lista = lista.map(x => ({ ...x, c: aComun(x.q) })).filter(x => x.c);
                lista.forEach(x => { x.buscable = norm(`${x.c.pregunta} ${x.c.respuesta} ${x.donde} ${x.contexto || ''}`); });
                if (vivo) setDatos(d => ({ ...d, [fuente]: lista }));
            } catch (e) {
                if (vivo) { setError(e.message || 'No se pudieron cargar las preguntas.'); setDatos(d => ({ ...d, [fuente]: [] })); }
            }
        })();
        return () => { vivo = false; };
    }, [fuente, datos, uid]);

    const lista = datos[fuente];
    const juegoPrincipal = (JUEGOS_DE_TIPO[String(tipoJuego || '').toUpperCase()] || [])[0];
    const filtradas = useMemo(() => {
        if (!lista) return [];
        const palabras = norm(texto).split(/\s+/).filter(Boolean);
        const sin = SINONIMOS[materia] || [];
        return lista.filter(x => {
            if (palabras.length && !palabras.every(p => x.buscable.includes(p))) return false;
            if (etapa && !(x.ciclo || []).some(c => norm(c) === norm(etapa))) return false;
            if (materia) {
                if (fuente === 'pikt') { if (x.materia !== materia) return false; }
                else if (!sin.some(s => x.buscable.includes(s))) return false;
            }
            if (curso && String(x.curso) !== curso) return false;
            if (autor && !norm(x.autor).includes(norm(autor))) return false;
            if (soloCaben && juegoPrincipal && !revisarPregunta(aDestino(x.c, tipoJuego, []), juegoPrincipal).ok) return false;
            return true;
        });
    }, [lista, texto, etapa, materia, curso, autor, soloCaben, fuente, tipoJuego, juegoPrincipal]);

    const visibles = filtradas.slice(0, 300);
    const todasVisiblesSel = visibles.length > 0 && visibles.every(x => sel.has(x.id));
    const alternar = (id) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const alternarVisibles = () => setSel(s => { const n = new Set(s); visibles.forEach(x => (todasVisiblesSel ? n.delete(x.id) : n.add(x.id))); return n; });

    // Las seleccionadas pueden venir de varias fuentes
    const seleccionadas = useMemo(() => Object.values(datos).flat().filter(x => x && sel.has(x.id)), [datos, sel]);
    const hueco = destino === 'nueva' ? maxPorHoja : Math.max(0, maxPorHoja - (hojas[destino]?.preguntas || []).filter(p => p && (p.pregunta || p.terminoA)).length);

    const importar = () => {
        if (!seleccionadas.length) return;
        const pool = seleccionadas.map(x => x.c.respuesta);
        let convertidas = seleccionadas.map(x => aDestino(x.c, tipoJuego, pool, extraPregunta));
        let aviso = '';
        if (convertidas.length > hueco) { aviso = `Solo caben ${hueco} en esa ${maxPorHoja < 99 ? 'categoría' : 'hoja'}: se importan las primeras.`; convertidas = convertidas.slice(0, hueco); }
        if (!convertidas.length) { alert('En esa hoja ya no caben más preguntas. Elige otra o crea una nueva.'); return; }
        onImportar(destino, nombreNueva.trim(), convertidas);
        alert(`✅ ${convertidas.length} pregunta${convertidas.length > 1 ? 's' : ''} importada${convertidas.length > 1 ? 's' : ''}.${aviso ? '\n' + aviso : ''}\nRevísalas en el editor antes de guardar.`);
        onClose();
    };

    const chip = (on) => ({ padding: '6px 12px', borderRadius: 99, border: `2px solid ${on ? '#2563eb' : '#cbd5e1'}`, background: on ? '#2563eb' : '#fff', color: on ? '#fff' : '#334155', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer' });
    const campo = { padding: '7px 10px', borderRadius: 9, border: '1.5px solid #cbd5e1', fontSize: '0.88rem', fontFamily: 'inherit', background: '#fff' };
    const materias = etiquetas?.M ? Object.entries(etiquetas.M) : Object.keys(SINONIMOS).map(k => [k, { label: k }]);
    const puedeNueva = hojas.length < maxHojas;

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10060, background: 'rgba(15,23,42,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, fontFamily: 'system-ui, sans-serif' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#f8fafc', borderRadius: 18, width: '100%', maxWidth: 980, maxHeight: '94vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 70px rgba(0,0,0,0.45)', color: '#0f172a' }}>
                <div style={{ padding: '14px 18px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>📥 Importar preguntas</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Busca por tema o palabras, etapa y materia. Marca las que quieras y elige a qué hoja van.</div>
                    </div>
                    <button onClick={onClose} style={{ border: 'none', background: '#e2e8f0', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', fontWeight: 700 }}>✕</button>
                </div>

                <div style={{ padding: '10px 18px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button style={chip(fuente === 'pikt')} onClick={() => setFuente('pikt')}>π Base de PiKT</button>
                        <button style={chip(fuente === 'profes')} onClick={() => setFuente('profes')}>👩‍🏫 Otros profesores</button>
                        <button style={chip(fuente === 'mias')} onClick={() => setFuente('mias')}>📁 Mis recursos</button>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="🔍 Tema o palabras clave (p. ej. «present perfect», «capitales», «células»)" style={{ ...campo, flex: '1 1 260px' }} />
                        <select value={etapa} onChange={e => setEtapa(e.target.value)} style={campo} title="Edad / etapa">
                            {ETAPAS.map(([v, l]) => <option key={v} value={v}>{v ? l : 'Todas las etapas'}</option>)}
                        </select>
                        <select value={materia} onChange={e => setMateria(e.target.value)} style={campo}>
                            <option value="">Todas las materias</option>
                            {materias.map(([k, m]) => <option key={k} value={k}>{m.emoji ? m.emoji + ' ' : ''}{m.label}</option>)}
                        </select>
                        {fuente === 'pikt' && (
                            <select value={curso} onChange={e => setCurso(e.target.value)} style={campo} title="Curso (solo donde la base lo indica, p. ej. Inglés ESO)">
                                <option value="">Cualquier curso</option>
                                {[1, 2, 3, 4].map(c => <option key={c} value={String(c)}>{c}.º</option>)}
                            </select>
                        )}
                        {fuente === 'profes' && <input value={autor} onChange={e => setAutor(e.target.value)} placeholder="Autor" style={{ ...campo, width: 130 }} />}
                        {juegoPrincipal && <label style={{ fontSize: '0.8rem', color: '#475569', display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={soloCaben} onChange={e => setSoloCaben(e.target.checked)} /> Solo las que caben bien en el juego</label>}
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '6px 18px', minHeight: 200 }}>
                    {error && <div style={{ color: '#b91c1c', padding: 10 }}>⚠ {error}</div>}
                    {!lista ? <div style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>Cargando preguntas…</div> : (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: '0.82rem', color: '#475569', position: 'sticky', top: 0, background: '#f8fafc' }}>
                                <label style={{ display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={todasVisiblesSel} onChange={alternarVisibles} /> Marcar las que se ven</label>
                                <span style={{ marginLeft: 'auto' }}>{filtradas.length} encontradas{filtradas.length > 300 ? ' (se muestran 300: afina la búsqueda)' : ''}</span>
                            </div>
                            {!filtradas.length && <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>No hay preguntas con esos filtros.</div>}
                            {visibles.map(x => (
                                <label key={x.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', marginBottom: 4, borderRadius: 10, background: sel.has(x.id) ? '#dbeafe' : '#fff', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={sel.has(x.id)} onChange={() => alternar(x.id)} style={{ marginTop: 3 }} />
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{x.c.pregunta}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#15803d' }}>✔ {x.c.respuesta}{x.c.incorrectas.length ? <span style={{ color: '#94a3b8' }}> · ✘ {x.c.incorrectas.join(' · ')}</span> : null}</div>
                                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{x.origen === 'PiKT' ? 'π PiKT · ' : ''}{x.donde}</div>
                                    </div>
                                </label>
                            ))}
                        </>
                    )}
                </div>

                <div style={{ padding: '12px 18px', background: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <b style={{ fontSize: '0.9rem' }}>{seleccionadas.length} marcadas</b>
                    <span style={{ fontSize: '0.85rem', color: '#475569' }}>→ Importar a</span>
                    <select value={destino} onChange={e => setDestino(e.target.value === 'nueva' ? 'nueva' : Number(e.target.value))} style={campo}>
                        {hojas.map((h, i) => <option key={i} value={i}>{h.nombreHoja || `Hoja ${i + 1}`} ({(h.preguntas || []).filter(Boolean).length})</option>)}
                        {puedeNueva && <option value="nueva">➕ Hoja nueva</option>}
                    </select>
                    {destino === 'nueva' && <input value={nombreNueva} onChange={e => setNombreNueva(e.target.value)} placeholder="Nombre de la hoja nueva" style={{ ...campo, width: 190 }} />}
                    <span style={{ flex: 1 }} />
                    <button onClick={() => setSel(new Set())} disabled={!sel.size} style={{ ...campo, cursor: 'pointer' }}>Desmarcar</button>
                    <button onClick={importar} disabled={!seleccionadas.length}
                        style={{ padding: '10px 18px', borderRadius: 11, border: 'none', background: seleccionadas.length ? '#16a34a' : '#94a3b8', color: '#fff', fontWeight: 800, cursor: seleccionadas.length ? 'pointer' : 'default' }}>
                        📥 Importar {seleccionadas.length || ''}
                    </button>
                </div>
            </div>
        </div>
    );
}

/** Botón flotante para montarlo sobre cualquier editor. */
export function BotonImportarPreguntas({ estilo, zIndex = 7000, ...props }) {
    const [abierto, setAbierto] = useState(false);
    if (!DESTINOS.includes(String(props.tipoJuego || '').toUpperCase())) return null;
    return (
        <>
            <button onClick={() => setAbierto(true)} title="Importar preguntas de PiKT, de otros profesores o de tus recursos"
                style={{ position: 'fixed', left: 16, bottom: 66, zIndex, border: 'none', borderRadius: 99, padding: '11px 16px', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem', color: '#fff', background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 6px 20px rgba(0,0,0,0.3)', fontFamily: 'system-ui, sans-serif', ...estilo }}>
                📥 Importar preguntas
            </button>
            {abierto && <ImportarPreguntas {...props} onClose={() => setAbierto(false)} />}
        </>
    );
}
