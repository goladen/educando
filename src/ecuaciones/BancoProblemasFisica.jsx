// ─────────────────────────────────────────────────────────────────────────────
//  Banco de problemas de Física y Química (tarjeta del menú /fisica).
//   📚 Temas: los de PiKT (plantillas con números nuevos, problemasCiencias.js) + los del profe.
//   ➕ Añadir: un problema a mano en un tema existente o nuevo.
//   📄 Desde una ficha: lee un PDF/Word/texto y la IA extrae todos sus ejercicios
//      (automático, o copiando el prompt en cualquier IA y pegando la respuesta). Se revisan y se guardan.
//   🖨️ Generar ficha: problemas de varios temas (PiKT y/o míos) + tests de los simuladores
//      y preguntas de FyQ de la base de PiKT. Vista previa editable y PDF.
//  Los problemas del profe se guardan en problemas_guardados (ver misProblemas.js).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react';
import { PLANTILLAS_CIENCIAS, generarDesdePlantilla } from './problemasCiencias';
import { HojaFicha, MODULOS, normalizar } from './FichaSimulador';
import { generarPdfBloques } from '../utils/pdfBloques';
import { usuarioRegistrado, cargarMisProblemas, guardarEnBanco, borrarProblemaGuardado, aProblemaFicha } from './misProblemas';
import { NIVELES_IA, MAX_TEXTO_IA, promptParaCopiar, promptProblemasFQ, interpretarRespuesta } from '../iaRecursos';
import { BotonCompartirHoja, MisHojasInteractivas } from './CompartirHoja';

const barajar = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const areaDe = (materia) => (String(materia || '').includes('Química') ? 'Química' : 'Física');
const esFQ = (p) => /F[ií]sica|Qu[ií]mica/.test(p.materia);

// Simuladores con test propio (para las preguntas tipo test de la ficha)
const SIMS_TEST = {
    CAIDA_LIBRE: 'Caída libre', PLANO_INCLINADO: 'Plano inclinado', TIRO_PARABOLICO: 'Tiro parabólico', PENDULO: 'Péndulo',
    LEY_OHM: 'Ley de Ohm', GAY_LUSAC: 'Gay-Lussac', ATOMOS: 'Átomos', ECLIPSE: 'Eclipse', SISTEMA_SOLAR: 'Sistema Solar', AJUSTES_REACCION: 'Ajuste de reacciones',
};

const C = {
    fondo: 'linear-gradient(135deg,#0f0f1a,#1a1a3e)', panel: 'rgba(255,255,255,0.06)', borde: 'rgba(255,255,255,0.14)',
    texto: '#e2e8f0', suave: 'rgba(255,255,255,0.6)', acento: '#0891b2',
};
const input = { padding: '9px 11px', borderRadius: 10, border: `1.5px solid ${C.borde}`, background: 'rgba(0,0,0,0.25)', color: 'white', fontSize: '0.92rem', fontFamily: 'inherit', boxSizing: 'border-box' };
const boton = (color = C.acento, lleno = true) => ({ padding: '10px 16px', borderRadius: 11, border: `2px solid ${color}`, background: lleno ? color : 'transparent', color: lleno ? 'white' : color, fontWeight: 800, cursor: 'pointer', fontSize: '0.9rem' });
const mini = { border: `1px solid ${C.borde}`, background: 'rgba(255,255,255,0.08)', color: 'white', borderRadius: 7, padding: '3px 8px', cursor: 'pointer', fontSize: 12 };

function ponerEn(obj, ruta, valor) {
    if (!ruta.length) return valor;
    const [k, ...resto] = ruta;
    const copia = Array.isArray(obj) ? [...obj] : { ...obj };
    copia[k] = ponerEn(obj?.[k], resto, valor);
    return copia;
}

export default function BancoProblemasFisica({ onVolver }) {
    const registrado = usuarioRegistrado();
    const [tab, setTab] = useState('temas');
    const [mios, setMios] = useState(registrado ? null : []);
    const [aviso, setAviso] = useState('');
    const [temaInicial, setTemaInicial] = useState(null); // al pulsar «Añadir aquí»

    const recargar = async () => {
        if (!usuarioRegistrado()) { setMios([]); return []; }
        try { const l = await cargarMisProblemas(); setMios(l); return l; } catch (e) { console.error(e); setMios([]); setAviso('No se pudieron cargar tus problemas.'); return []; }
    };
    useEffect(() => { recargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Temas: los de PiKT (plantillas de Física y Química) + los del profe
    const temas = useMemo(() => {
        const m = new Map();
        PLANTILLAS_CIENCIAS.filter(esFQ).forEach(p => {
            const t = m.get(p.tema) || { tema: p.tema, area: areaDe(p.materia), plantillas: [], mios: [] };
            t.plantillas.push(p); m.set(p.tema, t);
        });
        (mios || []).forEach(g => {
            const nombre = g.tema || 'Sin tema';
            const t = m.get(nombre) || { tema: nombre, area: g.area || areaDe(g.materia), plantillas: [], mios: [] };
            t.mios.push(g); m.set(nombre, t);
        });
        return [...m.values()].sort((a, b) => a.area.localeCompare(b.area) || a.tema.localeCompare(b.tema, 'es'));
    }, [mios]);

    const pestañas = [['temas', '📚 Temas'], ['anadir', '➕ Añadir problema'], ['ficha', '📄 Desde una ficha (IA)'], ['generar', '🖨️ Generar ficha PDF'], ['hojas', '🔗 Hojas compartidas']];
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto', background: C.fondo, color: C.texto, fontFamily: 'system-ui, Segoe UI, sans-serif' }}>
            <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px 60px' }}>
                <button onClick={onVolver} style={{ ...mini, fontSize: 14, padding: '8px 16px', fontWeight: 700 }}>← Volver</button>
                <div style={{ textAlign: 'center', margin: '18px 0 20px' }}>
                    <div style={{ fontSize: 52 }}>📚</div>
                    <h1 style={{ margin: '4px 0', fontSize: '1.9rem', color: 'white' }}>Banco de problemas de Física y Química</h1>
                    <p style={{ margin: 0, color: C.suave }}>Problemas por temas: los de PiKT (con números nuevos cada vez) y los tuyos. Crea fichas PDF mezclando temas y tests.</p>
                </div>
                {!registrado && <div style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid #f59e0b', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: '0.9rem' }}>Puedes generar fichas con los problemas de PiKT. Para <b>añadir problemas a tu banco</b> inicia sesión.</div>}
                {aviso && <div style={{ background: 'rgba(8,145,178,0.18)', border: `1px solid ${C.acento}`, borderRadius: 12, padding: '8px 14px', marginBottom: 12, fontSize: '0.9rem', display: 'flex', gap: 8 }}><span style={{ flex: 1 }}>{aviso}</span><button style={mini} onClick={() => setAviso('')}>✕</button></div>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                    {pestañas.map(([k, l]) => (
                        <button key={k} onClick={() => setTab(k)} style={{ ...boton(tab === k ? C.acento : 'rgba(255,255,255,0.35)', tab === k), padding: '9px 14px' }}>{l}</button>
                    ))}
                </div>

                {tab === 'temas' && <PestanaTemas temas={temas} mios={mios} registrado={registrado}
                    onAnadir={(t) => { setTemaInicial(t); setTab('anadir'); }}
                    onBorrar={async (g) => { if (!window.confirm('¿Borrar este problema de tu banco?')) return; try { await borrarProblemaGuardado(g.id); setMios(l => (l || []).filter(x => x.id !== g.id)); } catch (e) { console.error(e); setAviso('No se pudo borrar.'); } }} />}
                {tab === 'anadir' && <PestanaAnadir key={temaInicial?.tema || 'nuevo'} temas={temas} registrado={registrado} inicial={temaInicial}
                    onGuardar={async (items) => { const n = await guardarEnBanco(items, mios || [], 'banco'); await recargar(); setAviso(n ? `💾 Guardado en tu banco (${items[0].tema}).` : 'Ese problema ya estaba en tu banco.'); return n; }} />}
                {tab === 'ficha' && <PestanaDesdeFicha temas={temas} registrado={registrado}
                    onGuardar={async (items) => { const n = await guardarEnBanco(items, mios || [], 'ficha'); await recargar(); setAviso(`💾 ${n} problema${n === 1 ? '' : 's'} guardado${n === 1 ? '' : 's'} en tu banco.${n < items.length ? ` (${items.length - n} ya estaban)` : ''}`); return n; }} />}
                {tab === 'generar' && <PestanaGenerar temas={temas} />}
                {tab === 'hojas' && <MisHojasInteractivas />}
            </div>
        </div>
    );
}

// ─── 📚 Temas ────────────────────────────────────────────────────────────────
function PestanaTemas({ temas, mios, registrado, onAnadir, onBorrar }) {
    const [abierto, setAbierto] = useState(null);
    const [buscar, setBuscar] = useState('');
    const [ejemplo, setEjemplo] = useState(null);
    const lista = temas.filter(t => !buscar || norm(t.tema).includes(norm(buscar)) || t.mios.some(g => norm(g.enunciado).includes(norm(buscar))));
    return (
        <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="🔍 Buscar tema o problema" style={{ ...input, flex: 1, minWidth: 200 }} />
                {registrado && <button onClick={() => onAnadir(null)} style={boton('#16a34a')}>➕ Tema nuevo</button>}
            </div>
            {mios === null && <div style={{ color: C.suave, marginBottom: 10 }}>Cargando tus problemas…</div>}
            <div style={{ display: 'grid', gap: 8 }}>
                {lista.map(t => (
                    <div key={t.tema} style={{ background: C.panel, border: `1px solid ${C.borde}`, borderRadius: 12 }}>
                        <div onClick={() => { setAbierto(abierto === t.tema ? null : t.tema); setEjemplo(null); }} style={{ padding: '11px 14px', display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 20 }}>{t.area === 'Química' ? '🧪' : '⚛️'}</span>
                            <b style={{ flex: 1, minWidth: 160 }}>{t.tema}</b>
                            {t.plantillas.length > 0 && <span style={{ fontSize: '0.78rem', background: 'rgba(8,145,178,0.25)', padding: '3px 9px', borderRadius: 99 }}>🎲 {t.plantillas.length} de PiKT</span>}
                            <span style={{ fontSize: '0.78rem', background: t.mios.length ? 'rgba(22,163,74,0.3)' : 'rgba(255,255,255,0.08)', padding: '3px 9px', borderRadius: 99 }}>📝 {t.mios.length} tuyos</span>
                            <span style={{ color: C.suave }}>{abierto === t.tema ? '▾' : '▸'}</span>
                        </div>
                        {abierto === t.tema && (
                            <div style={{ padding: '0 14px 12px', fontSize: '0.9rem' }}>
                                {t.plantillas.length > 0 && (
                                    <div style={{ marginBottom: 8 }}>
                                        <button style={mini} onClick={() => setEjemplo(generarDesdePlantilla(t.plantillas[Math.floor(Math.random() * t.plantillas.length)]))}>🎲 Ver un ejemplo de PiKT</button>
                                        {ejemplo && <div style={{ marginTop: 6, background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: '8px 10px' }}>{ejemplo.ast?.[0]?.v}</div>}
                                    </div>
                                )}
                                {t.mios.map(g => (
                                    <div key={g.id} style={{ display: 'flex', gap: 8, padding: '7px 0', borderTop: `1px solid ${C.borde}` }}>
                                        <div style={{ flex: 1 }}>
                                            <div>{g.enunciado}</div>
                                            {g.solucion && <div style={{ color: '#86efac', fontSize: '0.82rem' }}>✔ {g.solucion}</div>}
                                        </div>
                                        <button style={{ ...mini, alignSelf: 'flex-start' }} onClick={() => onBorrar(g)} title="Borrar">🗑</button>
                                    </div>
                                ))}
                                {registrado && <button style={{ ...boton('#16a34a', false), marginTop: 8, padding: '6px 12px' }} onClick={() => onAnadir(t)}>➕ Añadir un problema a este tema</button>}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── ➕ Añadir a mano ─────────────────────────────────────────────────────────
function PestanaAnadir({ temas, registrado, inicial, onGuardar }) {
    const [tema, setTema] = useState(inicial?.tema || '');
    const [nuevo, setNuevo] = useState(!inicial);
    const [materia, setMateria] = useState(inicial?.area || 'Física');
    const [enunciado, setEnunciado] = useState('');
    const [solucion, setSolucion] = useState('');
    const [pasos, setPasos] = useState('');
    const [guardando, setGuardando] = useState(false);
    if (!registrado) return <div style={{ color: C.suave }}>Inicia sesión para añadir problemas a tu banco.</div>;
    const guardar = async () => {
        if (!tema.trim() || enunciado.trim().length < 10) { alert('Escribe el tema y un enunciado completo.'); return; }
        setGuardando(true);
        try {
            const n = await onGuardar([{ tema: tema.trim(), materia, enunciado, solucion, pasos: pasos.split('\n').map(s => s.trim()).filter(Boolean) }]);
            if (n) { setEnunciado(''); setSolucion(''); setPasos(''); setNuevo(false); }
        } catch (e) { alert(e.message || 'No se pudo guardar.'); }
        setGuardando(false);
    };
    const lab = { display: 'block', fontSize: '0.8rem', color: C.suave, fontWeight: 700, margin: '10px 0 4px' };
    return (
        <div style={{ background: C.panel, border: `1px solid ${C.borde}`, borderRadius: 14, padding: 16 }}>
            <label style={lab}>Tema</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {nuevo
                    ? <input value={tema} onChange={e => setTema(e.target.value)} placeholder="Nombre del tema nuevo (p. ej. Energía mecánica)" style={{ ...input, flex: 1, minWidth: 220 }} />
                    : <select value={tema} onChange={e => { setTema(e.target.value); const t = temas.find(x => x.tema === e.target.value); if (t) setMateria(t.area); }} style={{ ...input, flex: 1, minWidth: 220 }}>
                        <option value="">Elige un tema…</option>
                        {temas.map(t => <option key={t.tema} value={t.tema} style={{ color: '#111' }}>{t.area === 'Química' ? '🧪' : '⚛️'} {t.tema}</option>)}
                    </select>}
                <button style={mini} onClick={() => { setNuevo(!nuevo); setTema(''); }}>{nuevo ? 'Elegir uno existente' : '➕ Tema nuevo'}</button>
                <select value={materia} onChange={e => setMateria(e.target.value)} style={input}>
                    <option style={{ color: '#111' }}>Física</option><option style={{ color: '#111' }}>Química</option>
                </select>
            </div>
            <label style={lab}>Enunciado</label>
            <textarea value={enunciado} onChange={e => setEnunciado(e.target.value)} rows={4} placeholder="Un coche parte del reposo y acelera a 2 m/s². ¿Qué velocidad tiene a los 5 s?" style={{ ...input, width: '100%', resize: 'vertical' }} />
            <label style={lab}>Solución (resultado con unidades)</label>
            <input value={solucion} onChange={e => setSolucion(e.target.value)} placeholder="v = 10 m/s" style={{ ...input, width: '100%' }} />
            <label style={lab}>Pasos de la resolución (opcional, uno por línea)</label>
            <textarea value={pasos} onChange={e => setPasos(e.target.value)} rows={3} placeholder={'Datos: v₀ = 0, a = 2 m/s², t = 5 s\nv = v₀ + a·t\nv = 0 + 2·5 = 10 m/s'} style={{ ...input, width: '100%', resize: 'vertical' }} />
            <div style={{ marginTop: 12 }}><button disabled={guardando} onClick={guardar} style={boton('#16a34a')}>{guardando ? 'Guardando…' : '💾 Guardar en mi banco'}</button></div>
        </div>
    );
}

// ─── 📄 Desde una ficha con IA ────────────────────────────────────────────────
function PestanaDesdeFicha({ temas, registrado, onGuardar }) {
    const [modo, setModo] = useState('ficha'); // 'ficha' | 'nuevos'
    const [texto, setTexto] = useState('');
    const [nombreArchivo, setNombreArchivo] = useState('');
    const [leyendo, setLeyendo] = useState(false);
    const [nivel, setNivel] = useState(NIVELES_IA[4]);
    const [temaNuevos, setTemaNuevos] = useState('');
    const [nNuevos, setNNuevos] = useState(6);
    const [respuesta, setRespuesta] = useState('');
    const [progreso, setProgreso] = useState('');
    const [resultado, setResultado] = useState(null); // [{ ...problema, ok }]
    const [copiado, setCopiado] = useState(false);
    const fileRef = useRef(null);
    const listaTemas = temas.map(t => t.tema);
    const params = () => ({
        texto: modo === 'ficha' ? texto : '', n: modo === 'ficha' ? 1 : nNuevos, tema: modo === 'nuevos' ? temaNuevos : '',
        nivel, idioma: 'Español', observaciones: `Temas que ya existen en el banco: ${listaTemas.join(', ')}`.slice(0, 1000),
    });

    const subir = async (e) => {
        const file = e.target.files?.[0]; e.target.value = '';
        if (!file) return;
        setLeyendo(true); setNombreArchivo(file.name);
        try {
            const { textoDeArchivo } = await import('../iaGenerador');
            const t = await textoDeArchivo(file);
            if (!t) throw new Error('No se pudo leer texto (¿PDF escaneado o foto?). Usa «Copiar prompt» y adjunta la ficha en la IA.');
            setTexto(t.slice(0, MAX_TEXTO_IA));
            if (t.length > MAX_TEXTO_IA) alert(`La ficha es larga: se usarán los primeros ${MAX_TEXTO_IA.toLocaleString()} caracteres.`);
        } catch (err) { alert(err.message); }
        setLeyendo(false);
    };

    const prompt = () => (modo === 'ficha' && !texto.trim()
        ? `Eres un profesor experto. Respondes ÚNICAMENTE con JSON válido.\n\n${promptProblemasFQ(params(), { adjunto: true })}`
        : promptParaCopiar('PROBLEMAS_FQ', params()));

    const copiar = async () => {
        try { await navigator.clipboard.writeText(prompt()); setCopiado(true); setTimeout(() => setCopiado(false), 2500); }
        catch { window.prompt('Copia el prompt:', prompt()); }
    };
    const leerRespuesta = (txt) => {
        try {
            const r = interpretarRespuesta('PROBLEMAS_FQ', txt, { n: 1 });
            if (!r.problemas.length) throw new Error('No encuentro problemas en la respuesta. Comprueba que has pegado el JSON completo.');
            setResultado(r.problemas.map(p => ({ ...p, ok: true })));
        } catch (e) { alert(e.message); }
    };
    const automatico = async () => {
        if (modo === 'ficha' && !texto.trim()) { alert('Sube la ficha o pega su texto (o usa «Copiar prompt» y adjunta la ficha en la IA).'); return; }
        setProgreso('Pidiendo a la IA…');
        try {
            const { generarRecursoIA } = await import('../iaGenerador');
            const r = await generarRecursoIA('PROBLEMAS_FQ', params(), setProgreso);
            setResultado((r.problemas || []).map(p => ({ ...p, ok: true })));
            setProgreso('');
        } catch (e) {
            setProgreso('');
            alert(e.limite ? 'Ya has usado la generación automática esta semana. Usa «Copiar prompt» en cualquier IA (sin límite).' : (e.message || 'La IA no respondió.'));
        }
    };
    const cambiar = (i, campo, v) => setResultado(r => r.map((p, k) => (k === i ? { ...p, [campo]: v } : p)));
    const marcadas = (resultado || []).filter(p => p.ok);
    const guardar = async () => {
        if (!registrado) { alert('Inicia sesión para guardar en tu banco.'); return; }
        try { await onGuardar(marcadas); setResultado(null); setRespuesta(''); } catch (e) { alert(e.message || 'No se pudo guardar.'); }
    };

    const lab = { display: 'block', fontSize: '0.8rem', color: C.suave, fontWeight: 700, margin: '12px 0 4px' };
    if (resultado) {
        return (
            <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                    <b style={{ flex: 1 }}>Revisa los {resultado.length} problemas antes de guardarlos</b>
                    <button style={mini} onClick={() => setResultado(null)}>← Volver</button>
                    <button onClick={guardar} disabled={!marcadas.length} style={boton('#16a34a')}>💾 Guardar {marcadas.length} en mi banco</button>
                </div>
                <datalist id="temas-banco-fq">{listaTemas.map(t => <option key={t} value={t} />)}</datalist>
                {resultado.map((p, i) => (
                    <div key={i} style={{ background: p.ok ? C.panel : 'rgba(255,255,255,0.02)', opacity: p.ok ? 1 : 0.55, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 12, marginBottom: 8 }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
                            <input type="checkbox" checked={p.ok} onChange={e => cambiar(i, 'ok', e.target.checked)} />
                            <b>{i + 1}.</b>
                            <input list="temas-banco-fq" value={p.tema} onChange={e => cambiar(i, 'tema', e.target.value)} style={{ ...input, padding: '5px 8px', minWidth: 180 }} title="Tema (elige uno o escribe uno nuevo)" />
                            <select value={p.materia} onChange={e => cambiar(i, 'materia', e.target.value)} style={{ ...input, padding: '5px 8px' }}>
                                <option style={{ color: '#111' }}>Física</option><option style={{ color: '#111' }}>Química</option>
                            </select>
                            {!listaTemas.includes(p.tema) && <span style={{ fontSize: '0.75rem', color: '#fcd34d' }}>tema nuevo</span>}
                        </div>
                        <textarea value={p.enunciado} onChange={e => cambiar(i, 'enunciado', e.target.value)} rows={3} style={{ ...input, width: '100%', resize: 'vertical' }} />
                        <input value={p.solucion} onChange={e => cambiar(i, 'solucion', e.target.value)} placeholder="Solución" style={{ ...input, width: '100%', marginTop: 6, color: '#86efac' }} />
                        <textarea value={(p.pasos || []).join('\n')} onChange={e => cambiar(i, 'pasos', e.target.value.split('\n'))} rows={Math.min(5, (p.pasos || []).length + 1)} placeholder="Pasos (uno por línea)" style={{ ...input, width: '100%', marginTop: 6, fontSize: '0.82rem', resize: 'vertical' }} />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div style={{ background: C.panel, border: `1px solid ${C.borde}`, borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                <button onClick={() => setModo('ficha')} style={{ ...boton('#7c3aed', modo === 'ficha'), padding: '7px 12px' }}>📄 Extraer los ejercicios de una ficha</button>
                <button onClick={() => setModo('nuevos')} style={{ ...boton('#7c3aed', modo === 'nuevos'), padding: '7px 12px' }}>✨ Crear problemas nuevos de un tema</button>
            </div>
            {modo === 'ficha' ? (
                <>
                    <label style={lab}>Ficha (PDF, Word o texto)</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button onClick={() => fileRef.current?.click()} disabled={leyendo} style={boton('#7c3aed', false)}>{leyendo ? 'Leyendo…' : '📎 Subir .pdf / .docx / .txt'}</button>
                        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" onChange={subir} style={{ display: 'none' }} />
                        {nombreArchivo && <span style={{ fontSize: '0.85rem', color: C.suave }}>{nombreArchivo}</span>}
                    </div>
                    <textarea value={texto} onChange={e => setTexto(e.target.value.slice(0, MAX_TEXTO_IA))} rows={6} placeholder="…o pega aquí el texto de la ficha. Si es un PDF escaneado o una foto, déjalo vacío: copia el prompt y adjunta la ficha en la IA."
                        style={{ ...input, width: '100%', marginTop: 8, resize: 'vertical', fontSize: '0.85rem' }} />
                    <div style={{ fontSize: '0.75rem', color: C.suave, textAlign: 'right' }}>{texto.length.toLocaleString()} / {MAX_TEXTO_IA.toLocaleString()}</div>
                </>
            ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                    <input list="temas-banco-fq2" value={temaNuevos} onChange={e => setTemaNuevos(e.target.value)} placeholder="Tema (p. ej. Energía cinética y potencial)" style={{ ...input, flex: 1, minWidth: 220 }} />
                    <datalist id="temas-banco-fq2">{listaTemas.map(t => <option key={t} value={t} />)}</datalist>
                    <input type="number" min={1} max={30} value={nNuevos} onChange={e => setNNuevos(Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 1)))} style={{ ...input, width: 80 }} title="Cuántos" />
                </div>
            )}
            <label style={lab}>Nivel</label>
            <select value={nivel} onChange={e => setNivel(e.target.value)} style={input}>
                {NIVELES_IA.map(n => <option key={n} style={{ color: '#111' }}>{n}</option>)}
            </select>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                <div style={{ flex: '1 1 260px', background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 12 }}>
                    <b>📋 Con cualquier IA (sin límite)</b>
                    <ol style={{ margin: '6px 0', paddingLeft: 20, fontSize: '0.85rem', color: C.suave, lineHeight: 1.5 }}>
                        <li>Copia el prompt y pégalo en ChatGPT, Gemini, Claude…{modo === 'ficha' && !texto.trim() && <b style={{ color: '#fcd34d' }}> Adjunta allí tu ficha.</b>}</li>
                        <li>Copia lo que responda y pégalo abajo.</li>
                    </ol>
                    <button onClick={copiar} style={{ ...boton('#7c3aed'), width: '100%' }}>{copiado ? '✅ Copiado' : '📋 Copiar prompt'}</button>
                    <textarea value={respuesta} onChange={e => setRespuesta(e.target.value)} rows={4} placeholder="Pega aquí la respuesta de la IA" style={{ ...input, width: '100%', marginTop: 8, fontSize: '0.8rem' }} />
                    <button onClick={() => leerRespuesta(respuesta)} disabled={!respuesta.trim()} style={{ ...boton('#16a34a'), width: '100%', marginTop: 6, opacity: respuesta.trim() ? 1 : 0.5 }}>Leer la respuesta</button>
                </div>
                <div style={{ flex: '1 1 220px', background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 12 }}>
                    <b>⚡ Automático con la IA de PiKT</b>
                    <p style={{ fontSize: '0.85rem', color: C.suave, margin: '6px 0 10px' }}>Una vez por semana por usuario. Necesita el texto de la ficha (no lee fotos).</p>
                    <button onClick={automatico} disabled={!!progreso || !registrado} style={{ ...boton(C.acento), width: '100%', opacity: progreso || !registrado ? 0.6 : 1 }}>{progreso || (registrado ? '⚡ Extraer ahora' : 'Inicia sesión')}</button>
                </div>
            </div>
        </div>
    );
}

// ─── 🖨️ Generar ficha PDF ────────────────────────────────────────────────────
function PestanaGenerar({ temas }) {
    const [titulo, setTitulo] = useState('Problemas de Física y Química');
    const [cuantos, setCuantos] = useState({}); // tema → nº de problemas
    const [usarPikt, setUsarPikt] = useState(true);
    const [usarMios, setUsarMios] = useState(true);
    const [simsTest, setSimsTest] = useState([]);
    const [nTestSim, setNTestSim] = useState(6);
    const [etapaPikt, setEtapaPikt] = useState('eso');
    const [nTestPikt, setNTestPikt] = useState(0);
    const [soluciones, setSoluciones] = useState(true);
    const [grafica, setGrafica] = useState(true);
    const [borrador, setBorrador] = useState(null);
    const [datos, setDatos] = useState(null);
    const [estado, setEstado] = useState('');
    const hoja = useRef(null);
    const ventana = useRef(null);
    const totalProb = Object.values(cuantos).reduce((a, b) => a + b, 0);

    const problemasDeTema = (t, k) => {
        const plant = usarPikt ? t.plantillas : [];
        const propios = usarMios ? barajar(t.mios) : [];
        const out = [];
        let bolsa = [];
        while (out.length < k) {
            const quedanMios = propios.length > 0;
            if (quedanMios && (!plant.length || Math.random() < 0.5)) { out.push(aProblemaFicha(propios.pop())); continue; }
            if (!plant.length) break; // solo míos y ya no quedan
            if (!bolsa.length) bolsa = barajar(plant);
            out.push(generarDesdePlantilla(bolsa.pop()));
        }
        return out;
    };

    const preparar = async () => {
        setEstado('Preparando…');
        try {
            let faltan = 0;
            const problemas = temas.filter(t => cuantos[t.tema] > 0).flatMap(t => {
                const ps = problemasDeTema(t, cuantos[t.tema]);
                faltan += cuantos[t.tema] - ps.length;
                return ps;
            });
            let test = [];
            if (simsTest.length && nTestSim > 0) {
                const mods = await Promise.all(simsTest.map(k => MODULOS[k]?.().catch(() => ({})) || {}));
                const todas = mods.flatMap(m => (m?.PREGUNTAS_SIM || []).map(normalizar)).filter(q => q.texto && q.opciones.length);
                test = barajar(todas).slice(0, nTestSim);
            }
            if (nTestPikt > 0) {
                const { cargarPreguntasPikt } = await import('../bancoPreguntas/recursosPikt');
                const ps = (await cargarPreguntasPikt()).filter(p => p.etapa === etapaPikt && (p.materia === 'fyq' || p.materia === 'ciencias'));
                test = test.concat(barajar(ps).slice(0, nTestPikt).map(p => {
                    const opciones = barajar([p.respuesta, ...p.incorrectas]);
                    return { texto: p.pregunta, opciones, correcta: opciones.indexOf(p.respuesta), explicacion: '' };
                }));
            }
            if (!problemas.length && !test.length) { setEstado('Elige al menos un tema con problemas o algún test.'); return; }
            setEstado(faltan > 0 ? `Algunos temas no tienen tantos problemas: faltan ${faltan}.` : '');
            setBorrador({ titulo, problemas, test });
        } catch (e) { console.error(e); setEstado('No se pudo preparar la ficha.'); }
    };

    const generar = (descargar) => {
        ventana.current = descargar ? null : window.open('', '_blank');
        setEstado('Generando el PDF…');
        setDatos({ ...borrador, descargar });
    };
    useEffect(() => {
        if (!datos) return undefined;
        let vivo = true;
        const t = setTimeout(async () => {
            try {
                const { pdf, archivo } = await generarPdfBloques(hoja.current, datos.titulo || 'Problemas de Física y Química');
                if (!vivo) return;
                if (datos.descargar || !ventana.current) pdf.save(archivo);
                else ventana.current.location.href = URL.createObjectURL(pdf.output('blob'));
                setEstado('✅ Listo');
            } catch (e) { console.error(e); ventana.current?.close(); setEstado('No se pudo generar el PDF'); }
            if (vivo) setDatos(null);
        }, 200);
        return () => { vivo = false; clearTimeout(t); };
    }, [datos]);

    const ed = borrador && {
        poner: (ruta, v) => setBorrador(b => ponerEn(b, ruta, v)),
        quitar: (lista, i) => setBorrador(b => ({ ...b, [lista]: b[lista].filter((_, k) => k !== i) })),
        regenerar: (lista, i) => setBorrador(b => {
            const pl = PLANTILLAS_CIENCIAS.find(p => p.id === b.problemas[i]?.plantilla);
            return pl ? ponerEn(b, ['problemas', i], generarDesdePlantilla(pl)) : b;
        }),
        anadirParrafo: () => {},
    };
    const hojaProps = (b) => ({ titulo: b.titulo, url: '', ficha: null, captura: null, teoria: false, actividades: false, test: b.test, ejercicios: [], problemas: b.problemas, soluciones, grafica, cabecera: 'BANCO DE PROBLEMAS', area: 'Física' });
    const hojaPdf = datos && (
        <div style={{ position: 'fixed', left: -10000, top: 0 }} aria-hidden="true"><HojaFicha ref={hoja} {...hojaProps(datos)} /></div>
    );

    if (borrador) {
        return (
            <div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                    <button style={{ ...mini, padding: '7px 12px', fontSize: 13 }} onClick={() => { setBorrador(null); setEstado(''); }}>← Opciones</button>
                    <b style={{ flex: 1 }}>✏️ Vista previa: haz clic en los textos con fondo azul para editarlos</b>
                    <BotonCompartirHoja origen="Banco de problemas" contenido={() => ({ titulo: borrador.titulo, area: 'Física', test: borrador.test, ejercicios: [], problemas: borrador.problemas })} estilo={{ padding: '10px 14px' }} />
                    <button disabled={!!datos} onClick={() => generar(false)} style={boton('#0f766e')}>👁️ Generar PDF</button>
                    <button disabled={!!datos} onClick={() => generar(true)} style={boton('#5eead4', false)}>⬇️ Descargar</button>
                </div>
                {estado && <div style={{ marginBottom: 8, color: estado.startsWith('No') ? '#fca5a5' : '#5eead4', fontWeight: 700 }}>{estado}</div>}
                <div style={{ overflowX: 'auto' }}>
                    <div style={{ width: 760, margin: '0 auto', background: 'white', padding: '18px 14px', borderRadius: 6 }}>
                        <HojaFicha {...hojaProps(borrador)} ed={ed} />
                    </div>
                </div>
                {hojaPdf}
            </div>
        );
    }

    const seccion = { background: C.panel, border: `1px solid ${C.borde}`, borderRadius: 14, padding: 14, marginBottom: 12 };
    const tit = { fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', color: C.suave, marginBottom: 8 };
    const paso = (t, d) => setCuantos(c => ({ ...c, [t]: Math.max(0, Math.min(20, (c[t] || 0) + d)) }));
    return (
        <div>
            <div style={seccion}>
                <div style={tit}>Título de la ficha</div>
                <input value={titulo} onChange={e => setTitulo(e.target.value)} style={{ ...input, width: '100%' }} />
            </div>
            <div style={seccion}>
                <div style={tit}>Problemas por tema ({totalProb})</div>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 10, fontSize: '0.9rem' }}>
                    <label><input type="checkbox" checked={usarPikt} onChange={e => setUsarPikt(e.target.checked)} /> 🎲 De PiKT (números nuevos cada vez)</label>
                    <label><input type="checkbox" checked={usarMios} onChange={e => setUsarMios(e.target.checked)} /> 📝 De mi banco</label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 6 }}>
                    {temas.map(t => {
                        const disp = (usarPikt ? t.plantillas.length : 0) + (usarMios ? t.mios.length : 0);
                        const n = cuantos[t.tema] || 0;
                        return (
                            <div key={t.tema} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 10, background: n ? 'rgba(8,145,178,0.25)' : 'rgba(0,0,0,0.2)', opacity: disp ? 1 : 0.4 }}>
                                <span>{t.area === 'Química' ? '🧪' : '⚛️'}</span>
                                <span style={{ flex: 1, fontSize: '0.86rem' }}>{t.tema} <span style={{ color: C.suave, fontSize: '0.72rem' }}>{t.plantillas.length ? '🎲' : ''}{t.mios.length ? ` 📝${t.mios.length}` : ''}</span></span>
                                <button style={mini} disabled={!disp} onClick={() => paso(t.tema, -1)}>−</button>
                                <b style={{ width: 18, textAlign: 'center' }}>{n}</b>
                                <button style={mini} disabled={!disp} onClick={() => paso(t.tema, 1)}>+</button>
                            </div>
                        );
                    })}
                </div>
            </div>
            <div style={seccion}>
                <div style={tit}>Test</div>
                <div style={{ fontSize: '0.85rem', color: C.suave, marginBottom: 6 }}>Preguntas de los tests de los simuladores:</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {Object.entries(SIMS_TEST).map(([k, l]) => {
                        const on = simsTest.includes(k);
                        return <button key={k} onClick={() => setSimsTest(s => (on ? s.filter(x => x !== k) : [...s, k]))} style={{ ...boton('#8e44ad', on), padding: '5px 10px', fontSize: '0.8rem' }}>{l}</button>;
                    })}
                </div>
                {simsTest.length > 0 && <label style={{ fontSize: '0.88rem' }}>Cuántas: <input type="number" min={0} max={40} value={nTestSim} onChange={e => setNTestSim(Math.max(0, Math.min(40, parseInt(e.target.value, 10) || 0)))} style={{ ...input, width: 70, padding: '5px 8px' }} /></label>}
                <div style={{ fontSize: '0.85rem', color: C.suave, margin: '12px 0 6px' }}>Preguntas de Ciencias / Física y Química de la base de PiKT:</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.88rem' }}>
                    <select value={etapaPikt} onChange={e => setEtapaPikt(e.target.value)} style={{ ...input, padding: '5px 8px' }}>
                        <option value="pri" style={{ color: '#111' }}>Primaria</option><option value="eso" style={{ color: '#111' }}>ESO</option><option value="bach" style={{ color: '#111' }}>Bachillerato</option>
                    </select>
                    Cuántas: <input type="number" min={0} max={40} value={nTestPikt} onChange={e => setNTestPikt(Math.max(0, Math.min(40, parseInt(e.target.value, 10) || 0)))} style={{ ...input, width: 70, padding: '5px 8px' }} />
                </div>
            </div>
            <div style={{ ...seccion, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.9rem' }}>
                <label><input type="checkbox" checked={soluciones} onChange={e => setSoluciones(e.target.checked)} /> Hoja de soluciones (con pasos)</label>
                {soluciones && <label><input type="checkbox" checked={grafica} onChange={e => setGrafica(e.target.checked)} /> Solución gráfica de los problemas de PiKT</label>}
            </div>
            {estado && <div style={{ marginBottom: 8, color: '#fcd34d', fontWeight: 700 }}>{estado}</div>}
            <button onClick={preparar} style={{ ...boton('#2563eb'), width: '100%', padding: 14, fontSize: '1rem' }}>✏️ Previsualizar y editar la ficha</button>
        </div>
    );
}
