// Análisis con IA de un trazo seleccionado con el lazo en la Pizarra temática.
// Envía la región recortada a Gemini (vía /api/gemini) y muestra las posibles
// interpretaciones (texto, ecuación, función, expresión, forma…) con acciones
// para representarlas en el lienzo. Solo disponible para el admin.
import React, { useEffect, useState } from 'react';
import { callGeminiProxy, extractText } from '../geminiProxy';

export const ADMIN_EMAIL_IA = 'goladen@gmail.com';

const MODELOS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

const PROMPT = `Eres un asistente que interpreta trazos manuscritos de una pizarra digital de clase.
Analiza la imagen (trazos a mano sobre fondo blanco) y devuelve TODAS las interpretaciones plausibles,
ordenadas de más a menos probable (máximo 5). Puede ser texto, una ecuación, una función, una expresión
numérica o algebraica, un sistema de ecuaciones, una forma geométrica, un número, un símbolo…

Responde SOLO con JSON válido con esta forma:
{
  "interpretaciones": [
    {
      "tipo": "texto" | "ecuacion" | "funcion" | "expresion" | "sistema" | "forma" | "numero" | "otro",
      "titulo": "frase corta que describe la interpretación",
      "confianza": número entre 0 y 1,
      "contenido": "lo reconocido, escrito con Unicode legible (x², √, π, ≤, ·). Varias líneas separadas por \\n",
      "explicacion": "1-2 frases en español sobre qué significa",
      "funcStr": "SOLO si se puede representar como y=f(x): expresión en x con sintaxis + - * / ^ ( ) y funciones sin cos tan asin acos atan sqrt abs exp ln log, constantes pi y e. Usa * explícito. Ejemplo: 2*x^2 - 3*x + 1. Si no aplica, cadena vacía",
      "resultado": "si es expresión/ecuación/sistema: valor, simplificación o solución (ej: x = 3). Si no aplica, cadena vacía",
      "pasos": ["pasos breves de resolución, solo si hay ecuación/expresión/sistema"],
      "forma": "SOLO si tipo=forma: line | rect | circle | triangle | pentagon | hexagon; si no, cadena vacía"
    }
  ]
}
Para una ecuación en una variable (p.ej. 2x+3=7) incluye también funcStr con lado izquierdo menos lado derecho, para poder representarla.`;

const TIPO_META = {
    texto:     { icon: '🔤', color: '#0ea5e9', label: 'Texto' },
    ecuacion:  { icon: '🟰', color: '#8b5cf6', label: 'Ecuación' },
    funcion:   { icon: '📈', color: '#f97316', label: 'Función' },
    expresion: { icon: '🧮', color: '#10b981', label: 'Expresión' },
    sistema:   { icon: '🔗', color: '#6366f1', label: 'Sistema' },
    forma:     { icon: '🔷', color: '#14b8a6', label: 'Forma' },
    numero:    { icon: '🔢', color: '#eab308', label: 'Número' },
    otro:      { icon: '❔', color: '#64748b', label: 'Otro' },
};

const FORMAS_VALIDAS = ['line', 'rect', 'circle', 'triangle', 'pentagon', 'hexagon'];

function parsearRespuesta(txt) {
    let s = (txt || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    const i = s.indexOf('{'), j = s.lastIndexOf('}');
    if (i >= 0 && j > i) s = s.slice(i, j + 1);
    const obj = JSON.parse(s);
    const lista = Array.isArray(obj) ? obj : (obj.interpretaciones || []);
    return lista.filter(it => it && (it.contenido || it.funcStr)).map(it => ({
        tipo: TIPO_META[it.tipo] ? it.tipo : 'otro',
        titulo: String(it.titulo || ''),
        confianza: Number(it.confianza) || 0,
        contenido: String(it.contenido || ''),
        explicacion: String(it.explicacion || ''),
        funcStr: String(it.funcStr || '').trim(),
        resultado: String(it.resultado || '').trim(),
        pasos: Array.isArray(it.pasos) ? it.pasos.map(String).filter(Boolean) : [],
        forma: FORMAS_VALIDAS.includes(it.forma) ? it.forma : '',
    }));
}

/**
 * Props:
 *  - imagenDataURL: PNG de la región seleccionada
 *  - onClose()
 *  - onAccion(accion, interpretacion) — se puede llamar varias veces (el panel no se cierra); accion: 'sustituir' | 'insertar' | 'resultado' | 'pasos' | 'grafica' | 'forma'
 */
export default function PizarraAnalisisIA({ imagenDataURL, onClose, onAccion }) {
    const [estado, setEstado] = useState('cargando'); // cargando | ok | error
    const [error, setError] = useState('');
    const [items, setItems] = useState([]);
    const [intento, setIntento] = useState(0);

    useEffect(() => {
        let cancelado = false;
        (async () => {
            setEstado('cargando'); setError('');
            const base64 = (imagenDataURL || '').split(',')[1] || '';
            let ultimoError = null;
            for (const model of MODELOS) {
                try {
                    const data = await callGeminiProxy({
                        model,
                        contents: [{ parts: [
                            { text: PROMPT },
                            { inline_data: { mime_type: 'image/png', data: base64 } },
                        ] }],
                        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
                    });
                    const lista = parsearRespuesta(extractText(data));
                    if (!lista.length) throw new Error('La IA no reconoció nada en la selección.');
                    if (!cancelado) { setItems(lista); setEstado('ok'); }
                    return;
                } catch (err) { ultimoError = err; }
            }
            if (!cancelado) { setError(ultimoError?.message || 'Error desconocido'); setEstado('error'); }
        })();
        return () => { cancelado = true; };
    }, [imagenDataURL, intento]);

    // Acciones ya aplicadas (clave `${indice}-${accion}`) para marcarlas con ✓
    const [hechos, setHechos] = useState({});
    const accion = (k, tipo, it) => {
        onAccion(tipo, it);
        setHechos(h => ({ ...h, [`${k}-${tipo}`]: (h[`${k}-${tipo}`] || 0) + 1 }));
    };

    const Btn = ({ k, tipo, it, children, bg = '#334155' }) => {
        const n = hechos[`${k}-${tipo}`];
        return (
            <button onClick={() => accion(k, tipo, it)}
                style={{ padding: '5px 11px', background: bg, color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 'bold', fontSize: '0.78rem', outline: n ? '2px solid #22c55e' : 'none', outlineOffset: 1 }}>
                {children}{n ? ` ✓${n > 1 ? `×${n}` : ''}` : ''}
            </button>
        );
    };

    // Panel lateral sin fondo bloqueante: se ve el lienzo mientras se inserta y solo se cierra con ✕
    return (
        <div style={{ position: 'fixed', top: 70, right: 16, zIndex: 10000, width: 'min(460px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 90px)', display: 'flex' }}>
            <div
                style={{ background: 'white', borderRadius: 14, width: '100%', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.35)', overflow: 'hidden', border: '1px solid #c7d2fe' }}>
                <div style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: 'white', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 800, fontSize: '1rem', flex: 1 }}>🤖 Analizar trazo con IA</span>
                    <button onClick={onClose} title="Cerrar" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '2px 9px', fontWeight: 'bold' }}>✕</button>
                </div>

                <div style={{ padding: 12, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 6 }}>
                        <img src={imagenDataURL} alt="Selección" style={{ maxWidth: '100%', maxHeight: 140, objectFit: 'contain' }} />
                    </div>

                    {estado === 'cargando' && (
                        <div style={{ textAlign: 'center', padding: 20, color: '#4f46e5', fontWeight: 'bold' }}>⏳ Analizando el trazo…</div>
                    )}
                    {estado === 'error' && (
                        <div style={{ textAlign: 'center', padding: 12 }}>
                            <p style={{ color: '#dc2626', fontFamily: 'monospace', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>⚠ {error}</p>
                            <button onClick={() => setIntento(n => n + 1)} style={{ padding: '5px 11px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 'bold', fontSize: '0.78rem' }}>🔄 Reintentar</button>
                        </div>
                    )}
                    {estado === 'ok' && items.map((it, k) => {
                        const meta = TIPO_META[it.tipo];
                        return (
                            <div key={k} style={{ border: `2px solid ${meta.color}33`, borderLeft: `5px solid ${meta.color}`, borderRadius: 10, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span style={{ background: meta.color, color: 'white', borderRadius: 999, padding: '1px 9px', fontSize: '0.72rem', fontWeight: 'bold' }}>{meta.icon} {meta.label}</span>
                                    <span style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '0.88rem', flex: 1 }}>{it.titulo}</span>
                                    {it.confianza > 0 && <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{Math.round(it.confianza * 100)}%</span>}
                                </div>
                                {it.contenido && (
                                    <div style={{ fontSize: '1.15rem', fontFamily: 'Cambria, "Times New Roman", serif', color: '#0f172a', whiteSpace: 'pre-wrap', background: '#f8fafc', borderRadius: 6, padding: '4px 8px' }}>{it.contenido}</div>
                                )}
                                {it.explicacion && <div style={{ fontSize: '0.8rem', color: '#475569' }}>{it.explicacion}</div>}
                                {it.resultado && <div style={{ fontSize: '0.9rem', color: '#047857', fontWeight: 'bold' }}>➜ {it.resultado}</div>}
                                {it.pasos.length > 0 && (
                                    <ol style={{ margin: 0, paddingLeft: 20, fontSize: '0.78rem', color: '#334155' }}>
                                        {it.pasos.map((p, i) => <li key={i}>{p}</li>)}
                                    </ol>
                                )}
                                {it.funcStr && <div style={{ fontSize: '0.75rem', color: '#9a3412', fontFamily: 'monospace' }}>f(x) = {it.funcStr}</div>}
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {it.contenido && <Btn bg="#0ea5e9" k={k} tipo="sustituir" it={it}>✨ Sustituir trazo por texto</Btn>}
                                    {it.contenido && <Btn bg="#64748b" k={k} tipo="insertar" it={it}>➕ Insertar debajo</Btn>}
                                    {it.resultado && <Btn bg="#10b981" k={k} tipo="resultado" it={it}>🎯 Insertar resultado</Btn>}
                                    {it.pasos.length > 0 && <Btn bg="#6366f1" k={k} tipo="pasos" it={it}>📝 Insertar pasos</Btn>}
                                    {it.funcStr && <Btn bg="#f97316" k={k} tipo="grafica" it={it}>📈 Representar gráfica</Btn>}
                                    {it.forma && <Btn bg="#14b8a6" k={k} tipo="forma" it={it}>🔷 Sustituir por forma limpia</Btn>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
