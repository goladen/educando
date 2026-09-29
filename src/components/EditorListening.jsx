import React, { useState, useMemo } from 'react';
import { db, auth } from '../firebase';
import { collection, doc, setDoc, getDocs, query, where } from 'firebase/firestore';
import {
    Save, X, Settings, Plus, Trash2, RefreshCw, CheckCircle, Headphones,
    Copy, Wand2, Mic, AlertCircle, ExternalLink, Shuffle
} from 'lucide-react';
import PublicarModal from './PublicarModal';
import {
    TIPO_LISTENING_RECURSO, IDIOMAS_CREAR, NIVELES_MCER, VELOCIDADES_VOZ, TIPOS_TEXTO,
    getIdiomaCrear, nuevoId, contarPalabras, minutosEstimados, construirPrompt,
    importarRespuestaIA, tokenizar, localizarHuecos, ocurrenciaEn, distractoresAuto, firmaAudio,
} from '../listeningCrear';

// ──────────────────────────────────────────────────────────
// Editor de Listening propio (tipoJuego LISTENING_RECURSO)
// props: datos, setDatos, onClose, usuario — mismo contrato que EditorLineaTiempo
// ──────────────────────────────────────────────────────────

const generarCodigo = () =>
    Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');

export const recursoListeningVacio = (usuario, perfil) => ({
    id: null, titulo: '', temas: '',
    profesorNombre: perfil?.nombre || usuario?.displayName || '',
    pais: perfil?.pais || '', region: perfil?.region || '', poblacion: perfil?.poblacion || '',
    tipo: TIPO_LISTENING_RECURSO, tipoJuego: TIPO_LISTENING_RECURSO,
    idioma: 'en', nivel: 'B1', texto: '', dialogo: false,
    voz: 'en-GB-SoniaNeural', voz2: 'en-GB-RyanNeural', velocidad: '-10%',
    huecos: [], preguntas: [], ordenPartes: 'preguntas',
    isPrivate: false,
});

const PESTANAS = [
    { id: 'IA',        label: '🤖 Crear con IA' },
    { id: 'TEXTO',     label: '📝 Texto y audio' },
    { id: 'HUECOS',    label: '🕳️ Huecos' },
    { id: 'PREGUNTAS', label: '❓ Preguntas' },
];

export default function EditorListening({ datos, setDatos, onClose, usuario }) {
    const [pestana, setPestana] = useState(datos.texto ? 'TEXTO' : 'IA');
    const [guardando, setGuardando] = useState(false);
    const [guardadoOk, setGuardadoOk] = useState(false);
    const [modalPublicar, setModalPublicar] = useState(null);
    const [mostrandoConfig, setMostrandoConfig] = useState(false);

    const set = (campos) => setDatos(prev => ({ ...prev, ...campos }));

    const guardar = async (extraDatos = {}) => {
        if (!datos.titulo?.trim()) return alert('Introduce un título para el listening.');
        if (!datos.texto?.trim()) return alert('El listening no tiene texto.');
        if (!(datos.huecos?.length) && !(datos.preguntas?.length)) return alert('Añade al menos un hueco o una pregunta.');
        const audioAlDia = datos.audioUrl && datos.audioFirma === firmaAudio(datos);
        if (!audioAlDia && !window.confirm(datos.audioUrl
            ? 'El texto o la voz han cambiado desde que se grabó el audio. ¿Guardar igualmente? (Puedes regrabarlo en «Texto y audio».)'
            : 'Aún no has generado el audio: los alumnos oirán la voz de su dispositivo. ¿Guardar igualmente?')) return;

        const datosEfectivos = { ...datos, ...extraDatos };
        setGuardando(true);
        try {
            let docId = datos.id;
            let code = datos.accessCode;
            if (!code) {
                let intento = generarCodigo();
                const snap = await getDocs(query(collection(db, 'resources'), where('accessCode', '==', intento)));
                if (!snap.empty) intento = generarCodigo() + Math.floor(Math.random() * 9);
                code = intento;
            }
            if (!docId) docId = `listening_${Date.now()}`;
            const payload = {
                ...datosEfectivos,
                id: docId,
                tipo: TIPO_LISTENING_RECURSO,
                tipoJuego: TIPO_LISTENING_RECURSO,
                accessCode: code,
                profesorUid: usuario?.uid || datos.profesorUid || '',
                numHuecos: datos.huecos?.length || 0,
                numPreguntas: datos.preguntas?.length || 0,
                playCount: datos.playCount || 0,
                creadoEn: datosEfectivos.creadoEn || Date.now(),
                fechaCreacion: datosEfectivos.fechaCreacion || new Date(),
                actualizadoEn: Date.now(),
            };
            await setDoc(doc(collection(db, 'resources'), docId), payload);
            setDatos({ ...payload });
            setGuardadoOk(true);
            setTimeout(() => setGuardadoOk(false), 3000);
        } catch (e) {
            console.error(e);
            alert('Error al guardar: ' + e.message);
        }
        setGuardando(false);
    };

    return (
        <div style={st.overlay}>
            <div style={st.container}>
                {/* ── HEADER ── */}
                <div style={st.header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                        <Headphones size={22} />
                        <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }} className="btn-text">Editor Listening</span>
                        <input placeholder="Título del listening..." value={datos.titulo || ''}
                            onChange={e => set({ titulo: e.target.value })} style={st.titleInput} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                        {guardadoOk && <span style={{ color: '#e9d7ff', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={14} /> Guardado</span>}
                        {datos.accessCode && <span style={st.codigo} title="Código para los alumnos">🔑 {datos.accessCode}</span>}
                        <button onClick={() => setMostrandoConfig(true)} style={st.iconBtn} title="Configuración"><Settings size={20} /></button>
                        <button onClick={() => datos.isFinished ? guardar() : setModalPublicar('guardar')} disabled={guardando} style={st.saveBtn}>
                            {guardando ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
                            {guardando ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button onClick={() => !datos.isFinished ? setModalPublicar('cerrar') : onClose()} style={st.iconBtn}><X size={22} /></button>
                    </div>
                </div>

                {/* ── PESTAÑAS ── */}
                <div style={st.tabsBar}>
                    {PESTANAS.map(p => {
                        const n = p.id === 'HUECOS' ? datos.huecos?.length : p.id === 'PREGUNTAS' ? datos.preguntas?.length : null;
                        return (
                            <button key={p.id} onClick={() => setPestana(p.id)} style={{
                                ...st.tab,
                                background: pestana === p.id ? 'white' : 'transparent',
                                color: pestana === p.id ? '#6c3483' : '#555',
                                borderBottom: pestana === p.id ? '3px solid #8E44AD' : '3px solid transparent',
                            }}>
                                {p.label}{n != null && <span style={{ fontSize: '0.72rem', color: '#999', marginLeft: 4 }}>({n})</span>}
                            </button>
                        );
                    })}
                </div>

                <div style={st.body}>
                    {pestana === 'IA' && <PanelIA datos={datos} set={set} onImportado={() => setPestana('TEXTO')} />}
                    {pestana === 'TEXTO' && <PanelTexto datos={datos} set={set} />}
                    {pestana === 'HUECOS' && <PanelHuecos datos={datos} set={set} />}
                    {pestana === 'PREGUNTAS' && <PanelPreguntas datos={datos} set={set} />}
                </div>

                {modalPublicar && (
                    <PublicarModal
                        modo={modalPublicar}
                        onGuardarPublicar={async () => { await guardar({ isFinished: true }); setModalPublicar(null); if (modalPublicar === 'cerrar') onClose(); }}
                        onGuardarSolo={async () => { await guardar(); setModalPublicar(null); if (modalPublicar === 'cerrar') onClose(); }}
                        onSalirSinGuardar={() => { setModalPublicar(null); onClose(); }}
                        onCancelar={() => setModalPublicar(null)}
                    />
                )}
                {mostrandoConfig && <ConfigModal datos={datos} set={set} onClose={() => setMostrandoConfig(false)} />}
            </div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

// ──────────────────────────────────────────────────────────
// 1. CREAR CON IA — prompt para copiar + pegar la respuesta
// ──────────────────────────────────────────────────────────
function PanelIA({ datos, set, onImportado }) {
    const [cfg, setCfg] = useState({
        idioma: datos.idioma || 'en', nivel: datos.nivel || 'B1', minutos: 2, tema: '',
        tipoTexto: 'narracion', numHuecos: 8, numPreguntas: 5, publico: '',
    });
    const [copiado, setCopiado] = useState(false);
    const [pegado, setPegado] = useState('');
    const [error, setError] = useState('');
    const [avisos, setAvisos] = useState([]);

    const prompt = useMemo(() => construirPrompt(cfg), [cfg]);
    const c = (k, v) => setCfg(p => ({ ...p, [k]: v }));

    const copiar = async () => {
        try { await navigator.clipboard.writeText(prompt); }
        catch {
            const ta = document.createElement('textarea');
            ta.value = prompt; document.body.appendChild(ta); ta.select();
            document.execCommand('copy'); ta.remove();
        }
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2500);
    };

    const importar = () => {
        setError(''); setAvisos([]);
        let res;
        try { res = importarRespuestaIA(pegado); }
        catch (e) { setError(e.message); return; }
        if (datos.texto?.trim() && !window.confirm('Esto sustituirá el texto, los huecos y las preguntas actuales. ¿Continuar?')) return;
        const { campos } = res;
        const idioma = campos.idioma || cfg.idioma;
        const idi = getIdiomaCrear(idioma);
        const vozValida = (v) => idi.voces.some(x => x.id === v);
        set({
            ...campos,
            titulo: datos.titulo?.trim() ? datos.titulo : campos.titulo,
            idioma,
            nivel: campos.nivel || cfg.nivel,
            voz: vozValida(datos.voz) ? datos.voz : idi.voces[0].id,
            voz2: vozValida(datos.voz2) ? datos.voz2 : (idi.voces[1] || idi.voces[0]).id,
        });
        setAvisos(res.avisos);
        setPegado('');
        if (!res.avisos.length) onImportado();
    };

    return (
        <div>
            <div style={st.pasos}>
                <b>¿Cómo funciona?</b> 1) Ajusta las opciones · 2) Copia el prompt y pégalo en tu IA (Gemini, ChatGPT, Claude…) · 3) Copia su respuesta completa y pégala abajo. Después podrás editarlo todo y generar el audio.
            </div>

            <div style={st.card}>
                <div style={st.cardTitle}>1 · Opciones del texto</div>
                <div style={st.grid}>
                    <Campo label="Idioma">
                        <select value={cfg.idioma} onChange={e => c('idioma', e.target.value)} style={st.input}>
                            {Object.entries(IDIOMAS_CREAR).map(([id, i]) => <option key={id} value={id}>{i.flag} {i.label}</option>)}
                        </select>
                    </Campo>
                    <Campo label="Nivel (MCER)">
                        <select value={cfg.nivel} onChange={e => c('nivel', e.target.value)} style={st.input}>
                            {NIVELES_MCER.map(n => <option key={n}>{n}</option>)}
                        </select>
                    </Campo>
                    <Campo label={`Duración: ${cfg.minutos} min`}>
                        <input type="range" min={0.5} max={5} step={0.5} value={cfg.minutos} onChange={e => c('minutos', parseFloat(e.target.value))} style={{ width: '100%' }} />
                    </Campo>
                    <Campo label="Tipo de texto">
                        <select value={cfg.tipoTexto} onChange={e => c('tipoTexto', e.target.value)} style={st.input}>
                            {TIPOS_TEXTO.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                        </select>
                    </Campo>
                    <Campo label="Nº de huecos">
                        <input type="number" min={0} max={25} value={cfg.numHuecos} onChange={e => c('numHuecos', Math.max(0, Math.min(25, parseInt(e.target.value, 10) || 0)))} style={st.input} />
                    </Campo>
                    <Campo label="Nº de preguntas">
                        <input type="number" min={0} max={20} value={cfg.numPreguntas} onChange={e => c('numPreguntas', Math.max(0, Math.min(20, parseInt(e.target.value, 10) || 0)))} style={st.input} />
                    </Campo>
                </div>
                <Campo label="Tema (opcional)">
                    <input value={cfg.tema} onChange={e => c('tema', e.target.value)} placeholder="Ej: un viaje en tren, reciclaje, una receta..." style={st.input} />
                </Campo>
                <Campo label="Alumnado / indicaciones extra (opcional)">
                    <input value={cfg.publico} onChange={e => c('publico', e.target.value)} placeholder="Ej: 2º ESO, repasar el past simple" style={st.input} />
                </Campo>
            </div>

            <div style={st.card}>
                <div style={{ ...st.cardTitle, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ flex: 1 }}>2 · Prompt para tu IA</span>
                    <button onClick={copiar} style={{ ...st.btnMorado, background: copiado ? '#27ae60' : '#8E44AD' }}>
                        {copiado ? <><CheckCircle size={15} /> ¡Copiado!</> : <><Copy size={15} /> Copiar prompt</>}
                    </button>
                    <a href="https://gemini.google.com/app" target="_blank" rel="noreferrer" style={st.enlaceIA}>Gemini <ExternalLink size={12} /></a>
                    <a href="https://chatgpt.com/" target="_blank" rel="noreferrer" style={st.enlaceIA}>ChatGPT <ExternalLink size={12} /></a>
                </div>
                <textarea readOnly value={prompt} onFocus={e => e.target.select()} style={{ ...st.input, minHeight: 150, fontFamily: 'ui-monospace, monospace', fontSize: '0.74rem', background: '#faf7fc', resize: 'vertical' }} />
            </div>

            <div style={st.card}>
                <div style={st.cardTitle}>3 · Pega aquí la respuesta de la IA</div>
                <textarea value={pegado} onChange={e => setPegado(e.target.value)} placeholder='{ "titulo": "...", "texto": "...", "huecos": [...], "preguntas": [...] }'
                    style={{ ...st.input, minHeight: 130, fontFamily: 'ui-monospace, monospace', fontSize: '0.78rem', resize: 'vertical' }} />
                {error && <div style={st.error}><AlertCircle size={15} /> {error}</div>}
                {avisos.length > 0 && (
                    <div style={st.avisos}>
                        <b>Importado, con avisos:</b>
                        <ul style={{ margin: '4px 0 6px', paddingLeft: 18 }}>{avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>
                        <button onClick={onImportado} style={st.btnMorado}>Revisar el texto →</button>
                    </div>
                )}
                <button onClick={importar} disabled={!pegado.trim()} style={{ ...st.btnMorado, marginTop: 10, opacity: pegado.trim() ? 1 : 0.5, padding: '10px 18px' }}>
                    <Wand2 size={16} /> Crear el listening
                </button>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────
// 2. TEXTO Y AUDIO
// ──────────────────────────────────────────────────────────
function PanelTexto({ datos, set }) {
    const [grabando, setGrabando] = useState(false);
    const [error, setError] = useState('');
    const idi = getIdiomaCrear(datos.idioma);
    const palabras = contarPalabras(datos.texto);
    const mins = minutosEstimados(datos.texto, datos.nivel);
    const audioAlDia = datos.audioUrl && datos.audioFirma === firmaAudio(datos);

    const cambiarIdioma = (id) => {
        const nuevo = getIdiomaCrear(id);
        set({ idioma: id, voz: nuevo.voces[0].id, voz2: (nuevo.voces[1] || nuevo.voces[0]).id });
    };

    const grabar = async () => {
        setError('');
        const user = auth.currentUser;
        if (!user) { setError('Inicia sesión para generar el audio.'); return; }
        setGrabando(true);
        try {
            const token = await user.getIdToken();
            const r = await fetch('/api/listening-tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    texto: datos.texto, voz: datos.voz, voz2: datos.dialogo ? datos.voz2 : null,
                    dialogo: !!datos.dialogo, rate: datos.velocidad, anterior: datos.audioPublicId || null,
                }),
            });
            const res = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(res.error || `Error ${r.status}`);
            set({ audioUrl: res.url, audioPublicId: res.publicId, audioDuracion: res.duracion || null, audioFirma: firmaAudio(datos) });
        } catch (e) {
            setError(e.message);
        }
        setGrabando(false);
    };

    return (
        <div>
            <div style={st.card}>
                <div style={st.grid}>
                    <Campo label="Idioma">
                        <select value={datos.idioma} onChange={e => cambiarIdioma(e.target.value)} style={st.input}>
                            {Object.entries(IDIOMAS_CREAR).map(([id, i]) => <option key={id} value={id}>{i.flag} {i.label}</option>)}
                        </select>
                    </Campo>
                    <Campo label="Nivel">
                        <select value={datos.nivel} onChange={e => set({ nivel: e.target.value })} style={st.input}>
                            {NIVELES_MCER.map(n => <option key={n}>{n}</option>)}
                        </select>
                    </Campo>
                </div>
                <Campo label={`Texto · ${palabras} palabras · ≈ ${mins < 1 ? Math.round(mins * 60) + ' s' : mins.toFixed(1) + ' min'} de audio`}>
                    <textarea value={datos.texto || ''} onChange={e => set({ texto: e.target.value })}
                        placeholder={datos.dialogo ? 'Anna: Hello, Tom!\nTom: Hi Anna, how are you?' : 'Escribe o pega aquí el texto del listening...'}
                        style={{ ...st.input, minHeight: 220, resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit' }} />
                </Campo>
                <label style={st.check}>
                    <input type="checkbox" checked={!!datos.dialogo} onChange={e => set({ dialogo: e.target.checked })} />
                    Es un diálogo: cada línea empieza por <code>Nombre:</code> y cada personaje tiene su voz
                </label>
            </div>

            <div style={st.card}>
                <div style={st.cardTitle}>🎙️ Audio</div>
                <div style={st.grid}>
                    <Campo label={datos.dialogo ? 'Voz del 1er personaje' : 'Voz'}>
                        <select value={datos.voz} onChange={e => set({ voz: e.target.value })} style={st.input}>
                            {idi.voces.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                        </select>
                    </Campo>
                    {datos.dialogo && (
                        <Campo label="Voz del 2º personaje">
                            <select value={datos.voz2} onChange={e => set({ voz2: e.target.value })} style={st.input}>
                                {idi.voces.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                            </select>
                        </Campo>
                    )}
                    <Campo label="Velocidad">
                        <select value={datos.velocidad} onChange={e => set({ velocidad: e.target.value })} style={st.input}>
                            {VELOCIDADES_VOZ.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                        </select>
                    </Campo>
                </div>

                {datos.audioUrl && (
                    <div style={{ margin: '6px 0 10px' }}>
                        <audio key={datos.audioUrl} src={datos.audioUrl} controls style={{ width: '100%' }} />
                        {!audioAlDia && (
                            <div style={st.avisos}><AlertCircle size={14} style={{ verticalAlign: -2 }} /> Has cambiado el texto o la voz desde que se grabó: vuelve a generar el audio.</div>
                        )}
                    </div>
                )}
                <button onClick={grabar} disabled={grabando || !datos.texto?.trim()} style={{ ...st.btnMorado, padding: '10px 18px', opacity: grabando || !datos.texto?.trim() ? 0.6 : 1 }}>
                    {grabando ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Grabando… (puede tardar unos segundos)</>
                        : <><Mic size={16} /> {datos.audioUrl ? 'Volver a generar el audio' : 'Generar audio'}</>}
                </button>
                {error && <div style={st.error}><AlertCircle size={15} /> {error}</div>}
                <p style={st.nota}>El audio se genera con voces neuronales y se guarda en la nube. Si no lo generas, el alumno oirá la voz de su dispositivo.</p>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────
// 3. HUECOS — clic en las palabras del texto
// ──────────────────────────────────────────────────────────
function PanelHuecos({ datos, set }) {
    const tokens = useMemo(() => tokenizar(datos.texto), [datos.texto]);
    const posiciones = useMemo(() => localizarHuecos(tokens, datos.huecos), [tokens, datos.huecos]);
    const huecoEnPos = useMemo(() => {
        const m = {};
        Object.entries(posiciones).forEach(([id, p]) => { if (p != null) m[p] = id; });
        return m;
    }, [posiciones]);
    const huecos = datos.huecos || [];
    // Orden de aparición en el texto (los perdidos, al final)
    const ordenados = [...huecos].sort((a, b) => (posiciones[a.id] ?? 1e9) - (posiciones[b.id] ?? 1e9));
    const numeroDe = {};
    ordenados.filter(h => posiciones[h.id] != null).forEach((h, i) => { numeroDe[h.id] = i + 1; });

    const toggle = (i) => {
        const id = huecoEnPos[i];
        if (id) { set({ huecos: huecos.filter(h => h.id !== id) }); return; }
        const palabra = tokens[i].t;
        set({ huecos: [...huecos, { id: nuevoId(), palabra, ocurrencia: ocurrenciaEn(tokens, i), distractores: distractoresAuto(datos.texto, palabra) }] });
    };
    const actualizar = (id, campos) => set({ huecos: huecos.map(h => h.id === id ? { ...h, ...campos } : h) });

    if (!datos.texto?.trim()) return <Vacio texto="Primero escribe o importa el texto." />;

    return (
        <div>
            <div style={st.pasos}>Haz clic en una palabra para convertirla en hueco (o para quitarlo). En opción múltiple el alumno elige entre la palabra correcta y sus distractores.</div>
            <div style={{ ...st.card, lineHeight: 2, fontSize: '1rem', whiteSpace: 'pre-line' }}>
                {tokens.map((tk, i) => {
                    if (!tk.palabra) return <span key={i}>{tk.t}</span>;
                    const id = huecoEnPos[i];
                    return (
                        <span key={i} onClick={() => toggle(i)} title={id ? 'Quitar hueco' : 'Convertir en hueco'}
                            style={id ? st.palabraHueco : st.palabra}
                            onMouseEnter={e => { if (!id) e.currentTarget.style.background = '#f3e8fb'; }}
                            onMouseLeave={e => { if (!id) e.currentTarget.style.background = 'transparent'; }}>
                            {id && <sup style={{ fontSize: '0.62rem', marginRight: 2 }}>{numeroDe[id]}</sup>}{tk.t}
                        </span>
                    );
                })}
            </div>

            {ordenados.length === 0 && <Vacio texto="Aún no hay huecos." />}
            {ordenados.map(h => {
                const perdido = posiciones[h.id] == null;
                return (
                    <div key={h.id} style={{ ...st.fila, borderColor: perdido ? '#f5b7b1' : '#e2e8f0' }}>
                        <span style={st.num}>{perdido ? '⚠️' : numeroDe[h.id]}</span>
                        <b style={{ minWidth: 90 }}>{h.palabra}</b>
                        {perdido
                            ? <span style={{ flex: 1, color: '#c0392b', fontSize: '0.8rem' }}>Esta palabra ya no está en el texto.</span>
                            : <input value={(h.distractores || []).join(', ')} placeholder="distractores, separados, por comas"
                                onChange={e => actualizar(h.id, { distractores: e.target.value.split(',').map(x => x.trimStart()).slice(0, 5) })}
                                onBlur={e => actualizar(h.id, { distractores: e.target.value.split(',').map(x => x.trim()).filter(Boolean).slice(0, 5) })}
                                style={{ ...st.input, flex: 1 }} />}
                        {!perdido && <button title="Distractores automáticos" onClick={() => actualizar(h.id, { distractores: distractoresAuto(datos.texto, h.palabra) })} style={st.iconMini}><Shuffle size={14} /></button>}
                        <button title="Quitar" onClick={() => set({ huecos: huecos.filter(x => x.id !== h.id) })} style={{ ...st.iconMini, color: '#e74c3c', background: '#fdecea' }}><Trash2 size={14} /></button>
                    </div>
                );
            })}
        </div>
    );
}

// ──────────────────────────────────────────────────────────
// 4. PREGUNTAS de comprensión
// ──────────────────────────────────────────────────────────
function PanelPreguntas({ datos, set }) {
    const preguntas = datos.preguntas || [];
    const actualizar = (id, campos) => set({ preguntas: preguntas.map(p => p.id === id ? { ...p, ...campos } : p) });
    const anadir = () => set({ preguntas: [...preguntas, { id: nuevoId(), enunciado: '', opciones: ['', '', ''], correcta: 0 }] });
    const mover = (i, d) => {
        const a = [...preguntas]; const j = i + d;
        if (j < 0 || j >= a.length) return;
        [a[i], a[j]] = [a[j], a[i]];
        set({ preguntas: a });
    };

    return (
        <div>
            <div style={{ ...st.card, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <b style={{ fontSize: '0.88rem', color: '#2c3e50' }}>Orden de la actividad:</b>
                {[['preguntas', '1º preguntas (solo audio) · 2º huecos'], ['huecos', '1º huecos · 2º preguntas']].map(([id, lbl]) => (
                    <button key={id} onClick={() => set({ ordenPartes: id })} style={{ ...st.chip, ...(datos.ordenPartes === id ? st.chipOn : {}) }}>{lbl}</button>
                ))}
                <p style={{ ...st.nota, width: '100%', margin: 0 }}>Con «preguntas primero» el alumno responde sin ver el texto; después completa los huecos con la transcripción.</p>
            </div>

            {preguntas.length === 0 && <Vacio texto="Aún no hay preguntas." />}
            {preguntas.map((p, i) => (
                <div key={p.id} style={st.card}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={st.num}>{i + 1}</span>
                        <textarea value={p.enunciado} onChange={e => actualizar(p.id, { enunciado: e.target.value })} placeholder="Enunciado de la pregunta"
                            rows={2} style={{ ...st.input, flex: 1, resize: 'vertical', fontFamily: 'inherit' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <button onClick={() => mover(i, -1)} style={st.iconMini} title="Subir">▲</button>
                            <button onClick={() => mover(i, 1)} style={st.iconMini} title="Bajar">▼</button>
                        </div>
                        <button onClick={() => set({ preguntas: preguntas.filter(x => x.id !== p.id) })} style={{ ...st.iconMini, color: '#e74c3c', background: '#fdecea' }} title="Borrar pregunta"><Trash2 size={14} /></button>
                    </div>
                    <div style={{ marginTop: 8, paddingLeft: 34 }}>
                        {p.opciones.map((o, k) => (
                            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <input type="radio" checked={p.correcta === k} onChange={() => actualizar(p.id, { correcta: k })} title="Respuesta correcta" />
                                <input value={o} onChange={e => actualizar(p.id, { opciones: p.opciones.map((x, j) => j === k ? e.target.value : x) })}
                                    placeholder={`Opción ${String.fromCharCode(65 + k)}`}
                                    style={{ ...st.input, flex: 1, borderColor: p.correcta === k ? '#27ae60' : '#cbd5e1', background: p.correcta === k ? '#eafaf1' : 'white' }} />
                                {p.opciones.length > 2 && (
                                    <button onClick={() => actualizar(p.id, {
                                        opciones: p.opciones.filter((_, j) => j !== k),
                                        correcta: p.correcta === k ? 0 : p.correcta > k ? p.correcta - 1 : p.correcta,
                                    })} style={st.iconMini} title="Quitar opción"><X size={13} /></button>
                                )}
                            </div>
                        ))}
                        {p.opciones.length < 5 && (
                            <button onClick={() => actualizar(p.id, { opciones: [...p.opciones, ''] })} style={st.linkBtn}><Plus size={13} /> opción</button>
                        )}
                    </div>
                </div>
            ))}
            <button onClick={anadir} style={st.addBtn}><Plus size={18} /> Añadir pregunta</button>
        </div>
    );
}

// ──────────────────────────────────────────────────────────
// CONFIGURACIÓN (búsqueda y estado)
// ──────────────────────────────────────────────────────────
function ConfigModal({ datos, set, onClose }) {
    return (
        <div style={st.modalOverlay}>
            <div style={st.modal}>
                <div style={st.modalHeader}>
                    <h3 style={{ margin: 0, color: '#2c3e50' }}>⚙️ Configuración</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
                </div>
                <div style={{ padding: '14px 18px', overflowY: 'auto' }}>
                    <p style={{ fontSize: '0.75rem', color: '#999', marginTop: 0 }}>Estos datos ayudan a encontrar el listening en el buscador.</p>
                    <Campo label="Temas (separados por comas)"><input value={datos.temas || ''} onChange={e => set({ temas: e.target.value })} style={st.input} /></Campo>
                    <div style={st.grid}>
                        <Campo label="Nombre del profesor"><input value={datos.profesorNombre || ''} onChange={e => set({ profesorNombre: e.target.value })} style={st.input} /></Campo>
                        <Campo label="Ciclo">
                            <select value={datos.ciclo || 'Secundaria'} onChange={e => set({ ciclo: e.target.value })} style={st.input}>
                                <option>Primaria</option><option>Secundaria</option><option>Bachillerato</option><option>Otros</option>
                            </select>
                        </Campo>
                    </div>
                    <label style={st.check}><input type="checkbox" checked={!!datos.isFinished} onChange={() => set({ isFinished: !datos.isFinished })} /> Terminado (visible para los alumnos en el buscador)</label>
                    <label style={st.check}><input type="checkbox" checked={!datos.isPrivate} onChange={() => set({ isPrivate: !datos.isPrivate })} /> Público (otros profesores pueden verlo y copiarlo)</label>
                </div>
                <button onClick={onClose} style={{ margin: 14, padding: 11, background: '#8E44AD', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>Aceptar</button>
            </div>
        </div>
    );
}

// ── Sub-componentes UI ──────────────────────────────────────
const Campo = ({ label, children }) => (
    <div style={{ marginBottom: 10, minWidth: 0 }}>
        <label style={st.label}>{label}</label>
        {children}
    </div>
);
const Vacio = ({ texto }) => <div style={{ textAlign: 'center', color: '#94a3b8', padding: '26px 0' }}>{texto}</div>;

const st = {
    overlay: { position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    container: { width: '100%', height: '100%', maxWidth: 920, background: '#f5f2f8', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Segoe UI', sans-serif" },
    header: { background: 'linear-gradient(135deg,#8E44AD,#6c3483)', color: 'white', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    titleInput: { flex: 1, minWidth: 80, background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '7px 12px', color: 'white', fontSize: '0.95rem', outline: 'none' },
    codigo: { background: 'rgba(255,255,255,0.18)', borderRadius: 8, padding: '6px 10px', fontWeight: 800, letterSpacing: 1, fontSize: '0.82rem' },
    iconBtn: { background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 8, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
    saveBtn: { background: '#27ae60', border: 'none', color: 'white', borderRadius: 8, padding: '8px 16px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' },
    tabsBar: { display: 'flex', gap: 2, padding: '0 10px', background: '#ebe3f1', overflowX: 'auto', flexShrink: 0 },
    tab: { border: 'none', padding: '11px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap', fontFamily: 'inherit' },
    body: { flex: 1, overflowY: 'auto', padding: '16px 16px 60px' },
    pasos: { background: '#f3e8fb', border: '1px solid #dcc3ec', color: '#5b2c6f', borderRadius: 12, padding: '10px 14px', fontSize: '0.84rem', marginBottom: 14, lineHeight: 1.5 },
    card: { background: 'white', border: '1.5px solid #e6dcee', borderRadius: 14, padding: '14px 16px', marginBottom: 14 },
    cardTitle: { fontWeight: 800, color: '#6c3483', fontSize: '0.95rem', marginBottom: 10 },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0 12px' },
    label: { display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#64748b', marginBottom: 4 },
    input: { width: '100%', boxSizing: 'border-box', padding: '8px 11px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.88rem', outline: 'none', background: 'white' },
    check: { display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', color: '#444', margin: '6px 0', cursor: 'pointer' },
    btnMorado: { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#8E44AD', color: 'white', border: 'none', borderRadius: 9, padding: '8px 14px', fontWeight: 700, cursor: 'pointer', fontSize: '0.84rem', fontFamily: 'inherit' },
    enlaceIA: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: '#6c3483', fontWeight: 700, textDecoration: 'none', background: '#f3e8fb', padding: '6px 10px', borderRadius: 8 },
    error: { display: 'flex', alignItems: 'center', gap: 6, color: '#c0392b', background: '#fdecea', borderRadius: 8, padding: '8px 12px', fontSize: '0.82rem', marginTop: 8 },
    avisos: { background: '#fef5e7', border: '1px solid #f8c471', color: '#7e5109', borderRadius: 8, padding: '8px 12px', fontSize: '0.8rem', marginTop: 8 },
    nota: { fontSize: '0.75rem', color: '#94a3b8', margin: '10px 0 0' },
    palabra: { cursor: 'pointer', borderRadius: 4, padding: '1px 1px', transition: 'background 0.15s' },
    palabraHueco: { cursor: 'pointer', borderRadius: 5, padding: '1px 6px', background: '#8E44AD', color: 'white', fontWeight: 700 },
    fila: { display: 'flex', alignItems: 'center', gap: 8, background: 'white', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '8px 10px', marginBottom: 8, flexWrap: 'wrap' },
    num: { background: '#f3e8fb', color: '#6c3483', fontWeight: 800, borderRadius: 20, minWidth: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', flexShrink: 0 },
    iconMini: { background: '#f1f5f9', border: 'none', borderRadius: 7, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#555', fontSize: '0.7rem', flexShrink: 0 },
    linkBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#8E44AD', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', padding: 0 },
    addBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: 13, background: 'white', color: '#8E44AD', border: '2px dashed #8E44AD', borderRadius: 12, cursor: 'pointer', fontWeight: 800, fontSize: '0.95rem' },
    chip: { border: '1.5px solid #dcc3ec', background: 'white', color: '#6c3483', borderRadius: 20, padding: '6px 12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'inherit' },
    chipOn: { background: '#8E44AD', color: 'white', borderColor: '#8E44AD' },
    modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 },
    modal: { background: 'white', borderRadius: 16, width: '100%', maxWidth: 460, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px', borderBottom: '1px solid #eee' },
};
