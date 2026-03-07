import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, RotateCcw, Play, RefreshCw, Trophy, PaintBucket, Star, ArrowRight } from 'lucide-react';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// --- CATEGORÍAS SINTÁCTICAS Y SUS COLORES ---
const CATEGORIAS = {
    "Sujeto":                    { color: "#3498db", label: "Sujeto",           emoji: "👤", puntos: 15 },
    "Verbo":                     { color: "#e74c3c", label: "Verbo",             emoji: "⚡", puntos: 15 },
    "Complemento Directo":       { color: "#2ecc71", label: "C. Directo",        emoji: "🎯", puntos: 10 },
    "Complemento Indirecto":     { color: "#f39c12", label: "C. Indirecto",      emoji: "📬", puntos: 10 },
    "Complemento Circunstancial":{ color: "#9b59b6", label: "C. Circunstancial", emoji: "🌍", puntos: 10 },
    "Atributo":                  { color: "#1abc9c", label: "Atributo",          emoji: "✨", puntos: 10 },
};

export default function SintaxisGame({ onExit, usuario }) {
    const [gameState, setGameState] = useState('START'); // START, LOADING, PLAYING, RESULT
    const [sentenceData, setSentenceData] = useState(null);
    const [userAnswers, setUserAnswers] = useState([]); // Array de arrays: [[cat1, cat2], [cat1], ...]
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [score, setScore] = useState(0);
    const [results, setResults] = useState([]); // {correct: bool, esperadas: [], dadas: [], puntos: number}
    const [errorMsg, setErrorMsg] = useState('');
    const [animScore, setAnimScore] = useState(null); // Para animación de puntos

    const generarFraseConIA = async () => {
        setGameState('LOADING');
        setErrorMsg('');
        setResults([]);

        const prompt = `
            Genera una frase en español de nivel secundaria (ESO) para análisis sintáctico.
            Debe tener sujeto, verbo principal y al menos dos complementos variados.
            Algunas palabras pueden tener DOS funciones sintácticas simultáneas (ej. pronombres átonos como "le", "lo", "se").
            
            Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta:
            {
                "frase": "María le regaló un libro a su amigo ayer",
                "tokens": [
                    {"text": "María", "funcion": ["Sujeto"]},
                    {"text": "le", "funcion": ["Complemento Indirecto"]},
                    {"text": "regaló", "funcion": ["Verbo"]},
                    {"text": "un", "funcion": ["Complemento Directo"]},
                    {"text": "libro", "funcion": ["Complemento Directo"]},
                    {"text": "a", "funcion": ["Complemento Indirecto"]},
                    {"text": "su", "funcion": ["Complemento Indirecto"]},
                    {"text": "amigo", "funcion": ["Complemento Indirecto"]},
                    {"text": "ayer", "funcion": ["Complemento Circunstancial"]}
                ]
            }
            
            REGLAS:
            - "funcion" es SIEMPRE un array, aunque tenga un solo elemento.
            - Las ÚNICAS funciones permitidas son: "Sujeto", "Verbo", "Complemento Directo", "Complemento Indirecto", "Complemento Circunstancial", "Atributo".
            - Si una palabra tiene dos funciones reales, usa array con dos elementos.
            - No uses markdown, devuelve solo el JSON crudo.
        `;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7 }
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || "Error en la API");

            let textoIA = data.candidates[0].content.parts[0].text;
            textoIA = textoIA.replace(/```json/g, '').replace(/```/g, '').trim();
            const jsonData = JSON.parse(textoIA);

            // Normalizar: aseguramos que funcion sea siempre array
            jsonData.tokens = jsonData.tokens.map(t => ({
                ...t,
                funcion: Array.isArray(t.funcion) ? t.funcion : [t.funcion]
            }));

            setSentenceData(jsonData);
            setUserAnswers(new Array(jsonData.tokens.length).fill(null).map(() => []));
            setGameState('PLAYING');
            setSelectedCategory("Sujeto");

        } catch (error) {
            console.error(error);
            setErrorMsg("Vaya, la IA tuvo un lapsus. Inténtalo de nuevo.");
            setGameState('START');
        }
    };

    const handleWordClick = (index) => {
        if (gameState !== 'PLAYING' || !selectedCategory) return;
        const newAnswers = userAnswers.map(a => [...a]);
        const current = newAnswers[index];

        if (current.includes(selectedCategory)) {
            // Quitar si ya estaba
            newAnswers[index] = current.filter(c => c !== selectedCategory);
        } else if (current.length < 2) {
            // Añadir (máx 2 funciones por palabra)
            newAnswers[index] = [...current, selectedCategory];
        }
        setUserAnswers(newAnswers);
    };

    const comprobarRespuestas = () => {
        let puntosGanados = 0;
        const nuevosResultados = sentenceData.tokens.map((token, i) => {
            const esperadas = token.funcion; // ya es array
            const dadas = userAnswers[i];
            const correct = esperadas.length === dadas.length &&
                esperadas.every(f => dadas.includes(f));

            const puntosPalabra = correct
                ? esperadas.reduce((acc, f) => acc + (CATEGORIAS[f]?.puntos || 10), 0)
                : 0;

            puntosGanados += puntosPalabra;

            return { correct, esperadas, dadas, puntos: puntosPalabra };
        });

        setScore(prev => prev + puntosGanados);
        setAnimScore(puntosGanados);
        setTimeout(() => setAnimScore(null), 2000);
        setResults(nuevosResultados);
        setGameState('RESULT');
    };

    // Calcular fondo para un token según sus respuestas del usuario
    const getTokenBackground = (index) => {
        const ans = userAnswers[index] || [];
        if (ans.length === 0) return 'transparent';
        if (ans.length === 1) return CATEGORIAS[ans[0]]?.color || 'transparent';
        const c1 = CATEGORIAS[ans[0]]?.color || '#ccc';
        const c2 = CATEGORIAS[ans[1]]?.color || '#ccc';
        return `linear-gradient(135deg, ${c1} 50%, ${c2} 50%)`;
    };

    // Calcular fondo para resultado (lo que era correcto)
    const getCorrectBackground = (esperadas) => {
        if (esperadas.length === 1) return CATEGORIAS[esperadas[0]]?.color || '#ccc';
        const c1 = CATEGORIAS[esperadas[0]]?.color || '#ccc';
        const c2 = CATEGORIAS[esperadas[1]]?.color || '#ccc';
        return `linear-gradient(135deg, ${c1} 50%, ${c2} 50%)`;
    };

    return (
        <div style={styles.container}>
            {/* CABECERA */}
            <div style={styles.header}>
                <button onClick={() => window.location.href = 'https://www.pikt.es'} style={styles.btnVolver}>
                    <RotateCcw size={16} /> Salir
                </button>
                <div style={styles.titulo}>Análisis Sintáctico</div>
                <div style={styles.scoreBoard}>
                    <Trophy size={18} color="#f1c40f" />
                    <span>{score} pts</span>
                    {animScore !== null && (
                        <span style={styles.animPuntos}>+{animScore}</span>
                    )}
                </div>
            </div>

            {/* PANTALLA INICIO */}
            {gameState === 'START' && (
                <div style={styles.centerBox}>
                    <div style={styles.startCard}>
                        <div style={{ fontSize: '4rem', marginBottom: 10 }}>🪄</div>
                        <h1 style={styles.startTitle}>Análisis Sintáctico</h1>
                        <p style={styles.startDesc}>
                            La IA generará una frase. Colorea cada palabra según su función sintáctica.
                            Algunas palabras pueden tener <strong>dos funciones</strong> a la vez.
                        </p>
                        {errorMsg && <p style={styles.errorMsg}>{errorMsg}</p>}
                        <div style={styles.legendGrid}>
                            {Object.entries(CATEGORIAS).map(([k, v]) => (
                                <div key={k} style={{ ...styles.legendItem, borderLeft: `4px solid ${v.color}` }}>
                                    <span>{v.emoji}</span>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#333' }}>{v.label}</span>
                                    <span style={{ fontSize: '0.75rem', color: '#888' }}>{v.puntos} pts</span>
                                </div>
                            ))}
                        </div>
                        <button onClick={generarFraseConIA} style={styles.btnPrimary}>
                            <Play size={20} /> Empezar a Analizar
                        </button>
                    </div>
                </div>
            )}

            {/* PANTALLA CARGANDO */}
            {gameState === 'LOADING' && (
                <div style={styles.centerBox}>
                    <RefreshCw size={50} color="#3498db" style={{ animation: 'spin 1.5s linear infinite', marginBottom: 20 }} />
                    <h2 style={{ color: '#555' }}>La IA está escribiendo una frase...</h2>
                </div>
            )}

            {/* PANTALLA JUEGO */}
            {gameState === 'PLAYING' && sentenceData && (
                <div style={styles.gameArea}>

                    {/* PALETA */}
                    <div style={styles.paletteBox}>
                        <h3 style={styles.paletteTitle}><PaintBucket size={16} /> Elige el rotulador</h3>
                        <div style={styles.paletteGrid}>
                            {Object.entries(CATEGORIAS).map(([catKey, cat]) => {
                                const isSelected = selectedCategory === catKey;
                                return (
                                    <button
                                        key={catKey}
                                        onClick={() => setSelectedCategory(catKey)}
                                        style={{
                                            ...styles.paletteBtn,
                                            background: isSelected ? cat.color : '#f0f0f0',
                                            color: isSelected ? 'white' : '#555',
                                            border: `2px solid ${cat.color}`,
                                            transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                                            boxShadow: isSelected ? `0 4px 12px ${cat.color}66` : 'none',
                                        }}
                                    >
                                        {cat.emoji} {cat.label}
                                    </button>
                                );
                            })}
                        </div>
                        <p style={styles.hint}>💡 Pulsa la misma palabra con el mismo color para borrarlo. Máximo 2 funciones por palabra.</p>
                    </div>

                    {/* FRASE */}
                    <div style={styles.sentenceBox}>
                        {sentenceData.tokens.map((token, i) => {
                            const ans = userAnswers[i] || [];
                            return (
                                <div
                                    key={i}
                                    onClick={() => handleWordClick(i)}
                                    style={{
                                        ...styles.wordToken,
                                        background: getTokenBackground(i),
                                        color: ans.length > 0 ? 'white' : '#333',
                                        border: ans.length > 0 ? '2px solid transparent' : '2px dashed #ccc',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <span style={{ fontSize: '1.3rem', fontWeight: 'bold', textShadow: ans.length > 0 ? '0 1px 3px rgba(0,0,0,0.3)' : 'none' }}>
                                        {token.text}
                                    </span>
                                    {ans.length > 0 && (
                                        <div style={styles.tokenTags}>
                                            {ans.map(a => (
                                                <span key={a} style={{ ...styles.tokenTag, background: 'rgba(255,255,255,0.25)' }}>
                                                    {CATEGORIAS[a]?.emoji}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ textAlign: 'center', marginTop: 30 }}>
                        <button onClick={comprobarRespuestas} style={styles.btnSuccess}>
                            <CheckCircle size={20} /> Comprobar Solución
                        </button>
                    </div>
                </div>
            )}

            {/* PANTALLA RESULTADO */}
            {gameState === 'RESULT' && sentenceData && (
                <div style={styles.gameArea}>

                    {/* FRASE CON CORRECCIÓN VISUAL */}
                    <div style={styles.sentenceBox}>
                        {sentenceData.tokens.map((token, i) => {
                            const r = results[i];
                            if (!r) return null;
                            return (
                                <div key={i} style={{
                                    ...styles.wordToken,
                                    background: getCorrectBackground(r.esperadas),
                                    color: 'white',
                                    border: r.correct ? '3px solid #27ae60' : '3px solid #c0392b',
                                    cursor: 'default',
                                    opacity: r.correct ? 1 : 0.85,
                                }}>
                                    <span style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>{token.text}</span>
                                    <div style={styles.tokenTags}>
                                        {r.correct
                                            ? <CheckCircle size={14} color="#27ae60" style={{ background: 'white', borderRadius: '50%' }} />
                                            : <XCircle size={14} color="#c0392b" style={{ background: 'white', borderRadius: '50%' }} />
                                        }
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* DESGLOSE DE RESULTADOS */}
                    <div style={styles.desgloseBox}>
                        <h3 style={styles.desgloseTitle}>📋 Desglose de resultados</h3>
                        <div style={styles.desgloseList}>
                            {results.map((r, i) => {
                                const token = sentenceData.tokens[i];
                                return (
                                    <div key={i} style={{
                                        ...styles.desgloseItem,
                                        borderLeft: `4px solid ${r.correct ? '#27ae60' : '#e74c3c'}`,
                                        background: r.correct ? '#f0fdf4' : '#fef2f2',
                                    }}>
                                        {/* Palabra */}
                                        <div style={styles.desgloseWord}>
                                            <span style={{
                                                background: getCorrectBackground(r.esperadas),
                                                color: 'white',
                                                padding: '3px 10px',
                                                borderRadius: 6,
                                                fontWeight: 'bold',
                                                fontSize: '1rem',
                                            }}>
                                                {token.text}
                                            </span>
                                        </div>

                                        {/* Mensaje */}
                                        <div style={styles.desgloseMsg}>
                                            {r.correct ? (
                                                <span style={{ color: '#27ae60', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 5 }}>
                                                    <CheckCircle size={15} />
                                                    {r.esperadas.map(f => `${CATEGORIAS[f]?.emoji} ${CATEGORIAS[f]?.label}`).join(' + ')}
                                                </span>
                                            ) : (
                                                <span style={{ color: '#c0392b', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 'bold' }}>
                                                        <XCircle size={15} />
                                                        {r.dadas.length > 0
                                                            ? `Dijiste: ${r.dadas.map(f => `${CATEGORIAS[f]?.emoji} ${CATEGORIAS[f]?.label}`).join(' + ')}`
                                                            : 'Sin respuesta'}
                                                    </span>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#555', fontSize: '0.85rem' }}>
                                                        <ArrowRight size={13} />
                                                        Era: {r.esperadas.map(f => `${CATEGORIAS[f]?.emoji} ${CATEGORIAS[f]?.label}`).join(' + ')}
                                                    </span>
                                                </span>
                                            )}
                                        </div>

                                        {/* Puntos */}
                                        <div style={{
                                            ...styles.desglosePoints,
                                            color: r.correct ? '#27ae60' : '#c0392b',
                                        }}>
                                            {r.correct ? `+${r.puntos}` : '0'} pts
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* TOTAL */}
                        <div style={styles.totalBox}>
                            <span>Total esta ronda:</span>
                            <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#f1c40f' }}>
                                +{results.reduce((acc, r) => acc + r.puntos, 0)} pts
                            </span>
                            <span style={{ color: '#aaa', fontSize: '0.85rem' }}>Acumulado: {score} pts</span>
                        </div>
                    </div>

                    <div style={{ textAlign: 'center', marginTop: 20 }}>
                        <button onClick={generarFraseConIA} style={styles.btnPrimary}>
                            <RefreshCw size={20} /> Siguiente Frase
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin { 100% { transform: rotate(360deg); } }
                @keyframes popUp { 0% { opacity:0; transform: translateY(0) scale(0.8); } 50% { opacity:1; transform: translateY(-30px) scale(1.2); } 100% { opacity:0; transform: translateY(-60px) scale(1); } }
            `}</style>
        </div>
    );
}

const styles = {
    container: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%)',
        fontFamily: "'Segoe UI', Tahoma, sans-serif",
        padding: '0 0 40px 0',
    },
    header: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 20px',
        background: 'white',
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
        position: 'sticky', top: 0, zIndex: 100,
    },
    titulo: {
        fontWeight: 'bold', fontSize: '1.1rem', color: '#2c3e50', letterSpacing: '0.5px',
    },
    btnVolver: {
        padding: '8px 14px', background: '#f5f5f5', border: '1px solid #ddd',
        borderRadius: 20, cursor: 'pointer', display: 'flex', alignItems: 'center',
        gap: 5, fontWeight: 'bold', color: '#555', fontSize: '0.85rem',
    },
    scoreBoard: {
        background: '#2c3e50', padding: '8px 16px', borderRadius: 20,
        fontWeight: 'bold', fontSize: '1rem', display: 'flex', alignItems: 'center',
        gap: 8, color: 'white', position: 'relative',
    },
    animPuntos: {
        position: 'absolute', top: '-10px', right: '-5px',
        color: '#f1c40f', fontWeight: 'bold', fontSize: '1.2rem',
        animation: 'popUp 2s ease-out forwards', pointerEvents: 'none',
    },

    centerBox: {
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '80vh', padding: 20,
    },
    startCard: {
        background: 'white', borderRadius: 24, padding: '40px 30px',
        maxWidth: 560, width: '100%', textAlign: 'center',
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
    },
    startTitle: { fontSize: '2rem', color: '#2c3e50', marginBottom: 10, fontWeight: '800' },
    startDesc: { color: '#666', lineHeight: 1.6, marginBottom: 24, fontSize: '0.95rem' },
    errorMsg: { color: '#e74c3c', fontWeight: 'bold', marginBottom: 16, padding: '10px', background: '#ffeaea', borderRadius: 8 },
    legendGrid: {
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 28, textAlign: 'left',
    },
    legendItem: {
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
        background: '#f8f9fa', borderRadius: 8,
    },

    gameArea: {
        maxWidth: 860, margin: '24px auto', background: 'white',
        padding: '24px 20px', borderRadius: 20,
        boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
    },

    paletteBox: { background: '#f8f9fa', padding: '16px 20px', borderRadius: 14, marginBottom: 24 },
    paletteTitle: { margin: '0 0 12px 0', color: '#333', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem', fontWeight: 'bold' },
    paletteGrid: { display: 'flex', flexWrap: 'wrap', gap: 8 },
    paletteBtn: {
        padding: '8px 14px', borderRadius: 30, fontWeight: 'bold', cursor: 'pointer',
        transition: 'all 0.15s ease', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 5,
    },
    hint: { margin: '12px 0 0 0', color: '#888', fontSize: '0.8rem', fontStyle: 'italic' },

    sentenceBox: {
        display: 'flex', flexWrap: 'wrap', gap: 10,
        justifyContent: 'center', padding: '16px 0',
    },
    wordToken: {
        padding: '12px 16px', borderRadius: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        transition: 'all 0.2s ease', minWidth: 55,
        userSelect: 'none',
    },
    tokenTags: { display: 'flex', gap: 4, marginTop: 4 },
    tokenTag: { borderRadius: 10, padding: '1px 6px', fontSize: '0.75rem' },

    // Desglose
    desgloseBox: {
        marginTop: 28, background: '#f8f9fa', borderRadius: 16, padding: '20px',
    },
    desgloseTitle: { margin: '0 0 16px 0', color: '#2c3e50', fontSize: '1rem', fontWeight: 'bold' },
    desgloseList: { display: 'flex', flexDirection: 'column', gap: 8 },
    desgloseItem: {
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'white', borderRadius: 10, padding: '10px 14px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    },
    desgloseWord: { minWidth: 70 },
    desgloseMsg: { flex: 1, fontSize: '0.9rem' },
    desglosePoints: { fontWeight: 'bold', fontSize: '1rem', minWidth: 50, textAlign: 'right' },
    totalBox: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 16, padding: '14px 18px',
        background: '#2c3e50', borderRadius: 12, color: 'white',
        fontWeight: 'bold', fontSize: '1rem',
    },

    btnPrimary: {
        padding: '14px 28px', background: '#3498db', color: 'white', border: 'none',
        borderRadius: 30, fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 10, margin: '0 auto',
        boxShadow: '0 4px 14px rgba(52,152,219,0.4)',
    },
    btnSuccess: {
        padding: '14px 28px', background: '#27ae60', color: 'white', border: 'none',
        borderRadius: 30, fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 10, margin: '0 auto',
        boxShadow: '0 4px 14px rgba(39,174,96,0.4)',
    },
};
