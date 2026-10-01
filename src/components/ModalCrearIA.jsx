import React, { useEffect, useRef, useState } from 'react';
import { JUEGOS_IA, IDIOMAS_IA, NIVELES_IA, MAX_TEXTO_IA, promptParaCopiar, interpretarRespuesta, normalizarParams } from '../iaRecursos';
import { estadoUsoIA, generarRecursoIA, textoDeArchivo } from '../iaGenerador';

// Modal «Crear con IA»: formulario común + dos vías
//   ⚡ automática (NVIDIA → Gemini, 1 vez/semana por usuario; admin sin límite)
//   📋 copiar el prompt para otra IA y pegar la respuesta (sin límite)
export default function ModalCrearIA({ tipo, onGenerado, onClose }) {
    const juego = JUEGOS_IA[tipo];
    const [tema, setTema] = useState('');
    const [observaciones, setObservaciones] = useState('');
    const [nivel, setNivel] = useState(NIVELES_IA[2]);
    const [idioma, setIdioma] = useState('Español');
    const [n, setN] = useState(juego.def);
    const [texto, setTexto] = useState('');
    const [verTexto, setVerTexto] = useState(false);
    const [leyendoArchivo, setLeyendoArchivo] = useState(false);

    const [uso, setUso] = useState(null); // { disponible, proximo, ilimitado } | { error }
    const [generando, setGenerando] = useState(false);
    const [progreso, setProgreso] = useState('');
    const [error, setError] = useState('');

    const [modoPegar, setModoPegar] = useState(false);
    const [copiado, setCopiado] = useState(false);
    const [respuestaPegada, setRespuestaPegada] = useState('');
    const fileRef = useRef(null);

    useEffect(() => {
        estadoUsoIA().then(setUso).catch(e => setUso({ error: e.message }));
    }, []);

    const params = { tema, observaciones, nivel, idioma, n, texto };
    const faltaTema = !tema.trim() && !texto.trim();

    const terminar = (hojas, validas) => {
        if (validas < n) alert(`Se han obtenido ${validas} ${juego.unidad} válidas de ${n}. Puedes completar el resto en el editor.`);
        if (tipo === 'RULETA' && !hojas[0].frasesOcultas?.[0]) alert('Recuerda rellenar la Frase Oculta en el editor.');
        onGenerado(hojas, { tema: tema.trim() || hojas[0].nombreHoja });
    };

    const generarAuto = async () => {
        if (faltaTema) { setError('Escribe una temática o añade un texto de referencia.'); return; }
        setGenerando(true);
        setError('');
        try {
            const { hojas, validas } = await generarRecursoIA(tipo, params, setProgreso);
            terminar(hojas, validas);
        } catch (e) {
            if (e.limite) setUso({ disponible: false, proximo: e.proximo });
            setError(e.message);
        }
        setGenerando(false);
        setProgreso('');
    };

    const copiarPrompt = async () => {
        if (faltaTema) { setError('Escribe una temática o añade un texto de referencia.'); return; }
        setError('');
        const prompt = promptParaCopiar(tipo, params);
        try {
            await navigator.clipboard.writeText(prompt);
        } catch {
            // Sin permiso de portapapeles: se muestra para copiarlo a mano
            window.prompt('Copia este prompt (Ctrl+C):', prompt);
        }
        setCopiado(true);
        setModoPegar(true);
        setTimeout(() => setCopiado(false), 2500);
    };

    const cargarPegada = () => {
        setError('');
        try {
            const { hojas, validas } = interpretarRespuesta(tipo, respuestaPegada, normalizarParams(tipo, params));
            if (!validas) throw new Error(`No se ha encontrado ningún elemento válido en la respuesta.`);
            terminar(hojas, validas);
        } catch (e) {
            setError(`No se pudo leer la respuesta: ${e.message}`);
        }
    };

    const subirArchivo = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setLeyendoArchivo(true);
        setError('');
        try {
            const t = await textoDeArchivo(file);
            if (!t) throw new Error('El documento no tiene texto legible (¿es un PDF escaneado?).');
            setTexto(t.slice(0, MAX_TEXTO_IA));
            setVerTexto(true);
            if (t.length > MAX_TEXTO_IA) alert(`El documento es largo: se usarán los primeros ${MAX_TEXTO_IA.toLocaleString()} caracteres.`);
        } catch (err) {
            setError(err.message);
        }
        setLeyendoArchivo(false);
    };

    const fecha = (iso) => new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

    let estadoTxt = 'Comprobando disponibilidad…';
    let autoDisponible = false;
    if (uso?.error) estadoTxt = `No se pudo comprobar: ${uso.error}`;
    else if (uso?.ilimitado) { estadoTxt = 'Sin límite (administrador)'; autoDisponible = true; }
    else if (uso?.disponible) { estadoTxt = '1 uso por semana · disponible'; autoDisponible = true; }
    else if (uso) estadoTxt = `Ya la has usado esta semana. Próximo uso: ${fecha(uso.proximo)}`;

    return (
        <div style={s.overlay} onClick={() => !generando && onClose()}>
            <div style={s.modal} onClick={e => e.stopPropagation()}>
                <button onClick={onClose} disabled={generando} style={s.cerrar} aria-label="Cerrar">✕</button>
                <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>🤖 Crear {juego.label} con IA</h2>
                <p style={{ margin: '0 0 14px', color: '#666', fontSize: 13 }}>Describe lo que necesitas. Después podrás revisar y editar todo antes de guardar.</p>

                <label style={s.label}>Temática</label>
                <input value={tema} onChange={e => setTema(e.target.value)} style={s.input} disabled={generando}
                    placeholder="Ej: El sistema solar, la Revolución francesa, los animales vertebrados…" />

                <label style={s.label}>Observaciones <span style={s.opc}>(opcional)</span></label>
                <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} style={{ ...s.input, minHeight: 54, resize: 'vertical' }}
                    disabled={generando} placeholder="Ej: centrarse en los planetas interiores, incluir vocabulario del tema 4, evitar fechas…" />

                <div style={s.fila}>
                    <div style={{ flex: '1 1 180px' }}>
                        <label style={s.label}>Edad / nivel</label>
                        <select value={nivel} onChange={e => setNivel(e.target.value)} style={s.input} disabled={generando}>
                            {NIVELES_IA.map(v => <option key={v}>{v}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: '1 1 120px' }}>
                        <label style={s.label}>Idioma</label>
                        <select value={idioma} onChange={e => setIdioma(e.target.value)} style={s.input} disabled={generando}>
                            {IDIOMAS_IA.map(v => <option key={v}>{v}</option>)}
                        </select>
                    </div>
                </div>

                <label style={s.label}>Número de {juego.unidad}: <b>{n}</b></label>
                <input type="range" min={juego.min} max={juego.max} value={n} onChange={e => setN(Number(e.target.value))}
                    style={{ width: '100%' }} disabled={generando} />

                {/* Texto / documento de referencia */}
                <div style={s.caja}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 'bold', fontSize: 13, flex: 1 }}>📄 Texto o documento de referencia <span style={s.opc}>(opcional)</span></span>
                        <button onClick={() => setVerTexto(v => !v)} style={s.btnSec} disabled={generando}>{verTexto ? 'Ocultar' : 'Pegar texto'}</button>
                        <button onClick={() => fileRef.current?.click()} style={s.btnSec} disabled={generando || leyendoArchivo}>
                            {leyendoArchivo ? 'Leyendo…' : 'Subir .pdf / .docx / .txt'}
                        </button>
                        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" onChange={subirArchivo} style={{ display: 'none' }} />
                    </div>
                    {verTexto && (
                        <>
                            <textarea value={texto} onChange={e => setTexto(e.target.value.slice(0, MAX_TEXTO_IA))} disabled={generando}
                                style={{ ...s.input, minHeight: 110, marginTop: 8, resize: 'vertical', fontSize: 13 }}
                                placeholder="Pega aquí el texto: las preguntas saldrán de su contenido." />
                            <div style={{ fontSize: 11, color: '#888', textAlign: 'right' }}>
                                {texto.length.toLocaleString()} / {MAX_TEXTO_IA.toLocaleString()} caracteres
                                {texto && <button onClick={() => setTexto('')} style={s.link} disabled={generando}>Borrar</button>}
                            </div>
                        </>
                    )}
                    {!verTexto && texto && <div style={{ fontSize: 12, color: '#2e7d32', marginTop: 6 }}>✓ Texto cargado ({texto.length.toLocaleString()} caracteres)</div>}
                </div>

                {error && <div style={s.error}>{error}</div>}

                {/* Las dos vías */}
                <div style={s.fila}>
                    <div style={{ ...s.opcion, borderColor: '#76b900' }}>
                        <div style={{ fontWeight: 'bold' }}>⚡ Generar automáticamente</div>
                        <div style={{ fontSize: 12, color: autoDisponible ? '#4a7c00' : '#a15c00', margin: '4px 0 10px', minHeight: 30 }}>{estadoTxt}</div>
                        <button onClick={generarAuto} disabled={!autoDisponible || generando}
                            style={{ ...s.btn, background: autoDisponible ? '#76b900' : '#bbb', width: '100%' }}>
                            {generando ? (progreso || 'Generando…') : 'Generar'}
                        </button>
                        {generando && <div style={{ fontSize: 11, color: '#666', marginTop: 6 }}>Puede tardar de 15 s a 2 min.</div>}
                    </div>

                    <div style={{ ...s.opcion, borderColor: '#673AB7' }}>
                        <div style={{ fontWeight: 'bold' }}>📋 Usar mi propia IA</div>
                        <div style={{ fontSize: 12, color: '#555', margin: '4px 0 10px', minHeight: 30 }}>Copia el prompt, pégalo en ChatGPT, Gemini, Claude… y pega aquí su respuesta. Sin límite.</div>
                        <button onClick={copiarPrompt} disabled={generando} style={{ ...s.btn, background: '#673AB7', width: '100%' }}>
                            {copiado ? '✓ Prompt copiado' : 'Copiar prompt'}
                        </button>
                    </div>
                </div>

                {modoPegar && (
                    <div style={{ ...s.caja, borderColor: '#673AB7', marginTop: 12 }}>
                        <label style={{ ...s.label, marginTop: 0 }}>Pega aquí la respuesta de tu IA</label>
                        <textarea value={respuestaPegada} onChange={e => setRespuestaPegada(e.target.value)}
                            style={{ ...s.input, minHeight: 110, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
                            placeholder='[{"pregunta": "...", ...}]' />
                        <button onClick={cargarPegada} disabled={!respuestaPegada.trim()}
                            style={{ ...s.btn, background: respuestaPegada.trim() ? '#673AB7' : '#bbb', width: '100%', marginTop: 8 }}>
                            Cargar en el editor
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

const s = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: 12 },
    modal: { background: 'white', borderRadius: 14, padding: '22px 20px', width: '100%', maxWidth: 620, maxHeight: '92vh', overflowY: 'auto', position: 'relative', boxSizing: 'border-box' },
    cerrar: { position: 'absolute', top: 10, right: 12, border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: '#666' },
    label: { display: 'block', fontSize: 12, fontWeight: 'bold', color: '#555', margin: '10px 0 4px' },
    opc: { fontWeight: 'normal', color: '#999' },
    input: { width: '100%', padding: 9, borderRadius: 8, border: '1px solid #ccc', boxSizing: 'border-box', fontSize: 14, fontFamily: 'inherit' },
    fila: { display: 'flex', gap: 12, flexWrap: 'wrap' },
    caja: { marginTop: 14, padding: 12, border: '1px dashed #bbb', borderRadius: 10, background: '#fafafa' },
    opcion: { flex: '1 1 220px', marginTop: 14, padding: 12, border: '2px solid', borderRadius: 10 },
    btn: { padding: '10px 14px', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 14 },
    btnSec: { padding: '6px 10px', background: 'white', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
    link: { marginLeft: 8, border: 'none', background: 'none', color: '#c0392b', cursor: 'pointer', fontSize: 11, textDecoration: 'underline' },
    error: { marginTop: 12, padding: 10, background: '#fdecea', color: '#c0392b', borderRadius: 8, fontSize: 13, whiteSpace: 'pre-line', wordBreak: 'break-word' },
};
