import React, { useState, useCallback } from 'react';

const API_SEARCH = 'https://api.arasaac.org/v1/pictograms/es/search';
const picImg = id => `https://static.arasaac.org/pictograms/${id}/${id}_2500.png`;

const _cache = new Map();

async function fetchPicId(word) {
  const key = word.toLowerCase().trim();
  if (_cache.has(key)) return _cache.get(key);
  try {
    const r = await fetch(`${API_SEARCH}/${encodeURIComponent(key)}`);
    if (!r.ok) throw new Error();
    const d = await r.json();
    const id = Array.isArray(d) && d.length > 0 ? d[0]._id : null;
    _cache.set(key, id);
    return id;
  } catch {
    _cache.set(key, null);
    return null;
  }
}

function tokenize(text) {
  return text
    .trim()
    .split(/\s+/)
    .map(w => w.replace(/[.,;:!?¿¡"'()\-]/g, '').trim())
    .filter(Boolean);
}

// ─── Tarjeta de un símbolo ────────────────────────────────────────────────────
function PicCard({ word, id, loading, size = 110 }) {
  const [imgError, setImgError] = useState(false);
  const found = id && !imgError;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      background: 'white', borderRadius: 14, padding: '10px 8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
      border: `2px solid ${found ? '#BFDBFE' : loading ? '#FDE68A' : '#E2E8F0'}`,
      minWidth: size, maxWidth: size + 20, transition: 'all 0.2s',
    }}>
      <div style={{
        width: size, height: size,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 10, overflow: 'hidden',
        background: found ? '#F0F9FF' : loading ? '#FFFBEB' : '#F8FAFC',
      }}>
        {loading && (
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            border: '3px solid #FDE68A', borderTopColor: '#F59E0B',
            animation: 'spin 0.8s linear infinite',
          }} />
        )}
        {!loading && found && (
          <img
            src={picImg(id)}
            alt={word}
            onError={() => setImgError(true)}
            style={{ width: size, height: size, objectFit: 'contain' }}
          />
        )}
        {!loading && !found && (
          <span style={{ fontSize: '2rem', color: '#CBD5E1' }}>🔤</span>
        )}
      </div>
      <span style={{
        fontSize: '0.78rem', fontWeight: 700, textAlign: 'center',
        color: found ? '#1E40AF' : '#94A3B8',
        wordBreak: 'break-word', maxWidth: size + 10,
      }}>
        {word}
      </span>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function PictogramTranslator({ onExit }) {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [mostrarTexto, setMostrarTexto] = useState(true);

  const traducir = useCallback(async () => {
    const tokens = tokenize(texto);
    if (tokens.length === 0) return;

    setCargando(true);
    // Mostrar estado de carga inmediato
    setResultados(tokens.map(w => ({ word: w, id: null, loading: true })));

    // Buscar todos en paralelo, actualizar según van llegando
    const promises = tokens.map((w, i) =>
      fetchPicId(w).then(id => {
        setResultados(prev => {
          const next = [...prev];
          next[i] = { word: w, id, loading: false };
          return next;
        });
      })
    );

    await Promise.all(promises);
    setCargando(false);
  }, [texto]);

  const limpiar = () => {
    setTexto('');
    setResultados([]);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) traducir();
  };

  const encontrados = resultados.filter(r => r.id && !r.loading).length;
  const total = resultados.length;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(135deg,#ECFDF5 0%,#F0FDF4 50%,#F8FAFC 100%)',
      overflowY: 'auto', fontFamily: 'system-ui, sans-serif',
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg,#059669,#047857)',
        padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
        boxShadow: '0 4px 20px rgba(5,150,105,0.3)', position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button onClick={onExit} style={{
          background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10,
          padding: '8px 14px', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
        }}>← Volver</button>
        <div>
          <h1 style={{ margin: 0, color: 'white', fontSize: '1.3rem', fontWeight: 800 }}>
            🖼️ Traductor de Pictogramas
          </h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem' }}>
            Powered by ARASAAC
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 20px 60px' }}>

        {/* Input */}
        <div style={{
          background: 'white', borderRadius: 20, padding: 24,
          boxShadow: '0 4px 20px rgba(0,0,0,0.07)', border: '1.5px solid #D1FAE5',
          marginBottom: 20,
        }}>
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Escribe una frase... (Ctrl+Enter para traducir)"
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '14px 16px', fontSize: '1.1rem',
              border: '2px solid #A7F3D0', borderRadius: 14,
              outline: 'none', resize: 'vertical', fontFamily: 'inherit',
              background: '#F0FDF4', transition: 'border-color 0.2s',
            }}
            onFocus={e => e.target.style.borderColor = '#059669'}
            onBlur={e => e.target.style.borderColor = '#A7F3D0'}
          />

          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={traducir}
              disabled={!texto.trim() || cargando}
              style={{
                padding: '12px 28px', fontWeight: 700, fontSize: '1rem',
                background: !texto.trim() || cargando
                  ? '#D1FAE5' : 'linear-gradient(135deg,#059669,#047857)',
                color: !texto.trim() || cargando ? '#6EE7B7' : 'white',
                border: 'none', borderRadius: 12, cursor: !texto.trim() || cargando ? 'default' : 'pointer',
                boxShadow: texto.trim() && !cargando ? '0 4px 12px rgba(5,150,105,0.35)' : 'none',
                transition: 'all 0.2s',
              }}>
              {cargando ? '⏳ Buscando...' : '🔍 Traducir'}
            </button>

            {resultados.length > 0 && (
              <>
                <button onClick={limpiar} style={{
                  padding: '12px 20px', fontWeight: 600, fontSize: '0.9rem',
                  background: 'white', color: '#6B7280', border: '2px solid #E5E7EB',
                  borderRadius: 12, cursor: 'pointer',
                }}>
                  🗑️ Limpiar
                </button>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                  fontSize: '0.85rem', color: '#6B7280', fontWeight: 600, marginLeft: 'auto' }}>
                  <input
                    type="checkbox"
                    checked={mostrarTexto}
                    onChange={e => setMostrarTexto(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: '#059669', cursor: 'pointer' }}
                  />
                  Mostrar texto
                </label>
              </>
            )}
          </div>

          {resultados.length > 0 && !cargando && (
            <p style={{ margin: '10px 0 0', fontSize: '0.8rem', color: '#6B7280' }}>
              {encontrados} de {total} palabras con pictograma
              {encontrados < total && ` · ${total - encontrados} sin resultado`}
            </p>
          )}
        </div>

        {/* Resultados */}
        {resultados.length > 0 && (
          <div style={{
            background: 'white', borderRadius: 20, padding: '24px 16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.07)', border: '1.5px solid #D1FAE5',
          }}>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center',
            }}>
              {resultados.map((r, i) => (
                mostrarTexto
                  ? <PicCard key={i} word={r.word} id={r.id} loading={r.loading} size={110} />
                  : r.id && !r.loading
                    ? <div key={i} style={{
                        width: 110, height: 110, borderRadius: 12, overflow: 'hidden',
                        background: '#F0F9FF', border: '2px solid #BFDBFE',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                      }}>
                        <img src={picImg(r.id)} alt={r.word}
                          style={{ width: 110, height: 110, objectFit: 'contain' }} />
                      </div>
                    : r.loading
                      ? <div key={i} style={{ width: 110, height: 110, borderRadius: 12,
                          background: '#FFFBEB', border: '2px solid #FDE68A',
                          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%',
                            border: '3px solid #FDE68A', borderTopColor: '#F59E0B',
                            animation: 'spin 0.8s linear infinite' }} />
                        </div>
                      : null
              ))}
            </div>
          </div>
        )}

        {/* Estado vacío */}
        {resultados.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '50px 20px',
            color: '#94A3B8', fontSize: '1rem',
          }}>
            <div style={{ fontSize: '4rem', marginBottom: 12 }}>🖼️</div>
            <p style={{ margin: 0, fontWeight: 600 }}>Escribe una frase y pulsa Traducir</p>
            <p style={{ margin: '8px 0 0', fontSize: '0.85rem' }}>
              Cada palabra se convierte en un pictograma ARASAAC
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
