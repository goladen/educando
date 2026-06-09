import React, { useState } from 'react';
import { saveScore, getLastName, fmtScore } from './ranking';

/**
 * Props:
 *   gameKey   – ranking key ('TETRIS', 'ARKANOID', 'BUSCAMINAS_Fácil', …)
 *   score     – number
 *   accentColor – CSS color string
 *   onDone    – callback when dismissed (saved or skipped)
 */
export default function SaveForm({ gameKey, score, accentColor = '#00f5ff', onDone }) {
    const [name, setName]     = useState(getLastName);
    const [result, setResult] = useState(null);   // null | 'saving' | { monthly, allTime }
    const isBusca = gameKey.startsWith('BUSCAMINAS');

    async function handleSave() {
        if (result === 'saving') return;
        setResult('saving');
        try {
            const r = await saveScore(gameKey, score, name);
            setResult(r);
        } catch {
            setResult({ monthly: null, allTime: null });
        }
    }

    return (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
            {result === null ? (
                <>
                    <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.72rem', margin: '0 0 8px', letterSpacing: 1 }}>
                        ¿GUARDAS TU {isBusca ? 'TIEMPO' : 'PUNTUACIÓN'}?
                    </p>
                    <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSave()}
                        placeholder="Tu nombre"
                        maxLength={16}
                        autoFocus
                        style={{
                            background: 'rgba(255,255,255,0.09)',
                            border: `1px solid ${accentColor}66`,
                            color: 'white', borderRadius: 7,
                            padding: '6px 10px', fontSize: '0.85rem',
                            textAlign: 'center', width: 148,
                            outline: 'none', marginBottom: 8,
                            display: 'block', margin: '0 auto 8px',
                        }}
                    />
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                        <button onClick={handleSave} style={{
                            background: accentColor, color: '#000', border: 'none',
                            borderRadius: 7, padding: '7px 18px', cursor: 'pointer',
                            fontWeight: 700, fontSize: '0.82rem', opacity: 1,
                        }}>Guardar 💾</button>
                        <button onClick={onDone} style={{
                            background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)',
                            border: '1px solid rgba(255,255,255,0.15)', borderRadius: 7,
                            padding: '7px 14px', cursor: 'pointer', fontSize: '0.82rem',
                        }}>Saltar</button>
                    </div>
                </>
            ) : result === 'saving' ? (
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', margin: 0 }}>Guardando…</p>
            ) : (
                <>
                    <p style={{ color: accentColor, fontSize: '0.8rem', fontWeight: 700, margin: '0 0 6px' }}>✓ ¡Guardado!</p>
                    {result.monthly && (
                        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', margin: '0 0 3px' }}>
                            🗓️ Este mes: <strong style={{ color: accentColor }}>#{result.monthly}</strong>
                        </p>
                    )}
                    {result.allTime && (
                        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', margin: '0 0 3px' }}>
                            🏆 Top 10: <strong style={{ color: '#ffd700' }}>#{result.allTime}</strong>
                        </p>
                    )}
                    {!result.monthly && !result.allTime && (
                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem', margin: '0 0 3px' }}>
                            Guardado — fuera del top 10
                        </p>
                    )}
                    <button onClick={onDone} style={{
                        marginTop: 10, background: 'rgba(255,255,255,0.07)',
                        color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontSize: '0.8rem',
                    }}>OK</button>
                </>
            )}
        </div>
    );
}
