// «✨ Crear con IA» del Editor Omni: el profe copia un prompt, lo usa en su IA (Gemini, ChatGPT, Claude…)
// y pega la respuesta. Tres modos:
//   tema    → recurso nuevo sobre un tema (nº de ejercicios × nº de apartados)
//   ficha   → convertir una foto / PDF / Word de ejercicios
//   lectura → comprensión lectora con el texto incrustado (recurso.lectura)
import { useState } from 'react';
import { promptTemaOmni, promptHojaAOmni, promptLecturaOmni, interpretarOmni, NIVELES_PAPEL, IDIOMAS_PAPEL } from '../utils/omniPapel';

const TIPOS_ELEGIBLES = [
  ['fill', 'Huecos'], ['wordbank', 'Banco de palabras'], ['choice', 'Elegir en la frase'], ['multichoice', 'Test'],
  ['truefalse', 'Verdadero / falso'], ['match', 'Unir'], ['order', 'Ordenar'], ['error', 'Buscar el error'],
  ['construct', 'Construir frases'], ['short', 'Respuesta corta'], ['open', 'Abierta'], ['crossword', 'Crucigrama'], ['wordsearch', 'Sopa de letras'],
];
const MODOS = [
  ['tema', '💡 Sobre un tema', 'La IA inventa los ejercicios'],
  ['ficha', '📄 Desde una ficha', 'Foto, PDF o Word de ejercicios'],
  ['lectura', '📖 Comprensión lectora', 'A partir de un texto'],
];

export default function CrearConIAOmni({ recurso, onCargar, onCerrar }) {
  const [modo, setModo] = useState('tema');
  const [cfg, setCfg] = useState({
    idioma: 'English', nivel: recurso?.nivel || '1 ESO', asignatura: recurso?.asignatura || '', tema: '',
    nEjercicios: 5, nApartados: 5, tipos: [], texto: '', extra: '',
    crearTexto: false, temaTexto: '', nivelTexto: 'A2', palabras: 250, generoTexto: '',
  });
  const [copiado, setCopiado] = useState(false);
  const [pegada, setPegada] = useState('');
  const [error, setError] = useState('');
  const [anadir, setAnadir] = useState(false);
  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));
  const tieneEjercicios = (recurso?.ejercicios || []).some(e => (e.items || []).some(it => JSON.stringify(it).length > 40));

  const prompt = modo === 'tema' ? promptTemaOmni(cfg) : modo === 'lectura' ? promptLecturaOmni(cfg) : promptHojaAOmni(cfg);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(prompt); } catch { window.prompt('Copia el prompt (Ctrl+C):', prompt); }
    setCopiado(true); setTimeout(() => setCopiado(false), 2500);
  };
  const cargar = () => {
    setError('');
    try {
      const r = interpretarOmni(pegada, cfg);
      if (modo !== 'ficha') r.ordenFijo = modo === 'lectura';
      onCargar(r, { anadir: anadir && tieneEjercicios });
    } catch (e) { setError('No se pudo leer la respuesta: ' + e.message); }
  };
  const toggleTipo = (t) => set('tipos', cfg.tipos.includes(t) ? cfg.tipos.filter(x => x !== t) : [...cfg.tipos, t]);

  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 3000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4vh 12px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 18, width: '100%', maxWidth: 720, padding: '20px 20px 18px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, flex: 1, color: '#4C1D95' }}>✨ Crear con tu IA</h3>
          <button onClick={onCerrar} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: '#94A3B8' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8, marginBottom: 16 }}>
          {MODOS.map(([id, t, d]) => (
            <button key={id} onClick={() => setModo(id)} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
              border: `2px solid ${modo === id ? '#6D28D9' : '#E2E8F0'}`, background: modo === id ? '#F5F3FF' : 'white' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1E1B4B' }}>{t}</div>
              <div style={{ fontSize: 12, color: '#64748B' }}>{d}</div>
            </button>
          ))}
        </div>

        <Paso n="1" t="Datos">
          <div style={fila}>
            {modo === 'tema' && <Campo label="Tema" ancho="1 1 100%"><input style={inp} value={cfg.tema} onChange={e => set('tema', e.target.value)} placeholder="Present Simple: routines · Las fracciones · La célula…" /></Campo>}
            <Campo label="Nivel"><select style={inp} value={cfg.nivel} onChange={e => set('nivel', e.target.value)}>{NIVELES_PAPEL.map(v => <option key={v}>{v}</option>)}</select></Campo>
            <Campo label="Asignatura"><input style={inp} value={cfg.asignatura} onChange={e => set('asignatura', e.target.value)} placeholder="English, Lengua…" /></Campo>
            <Campo label="Idioma"><select style={inp} value={cfg.idioma} onChange={e => set('idioma', e.target.value)}>{IDIOMAS_PAPEL.map(v => <option key={v}>{v}</option>)}</select></Campo>
            {modo !== 'ficha' && <>
              <Campo label="Nº de ejercicios"><input style={inp} type="number" min="1" max="15" value={cfg.nEjercicios} onChange={e => set('nEjercicios', Math.max(1, Math.min(15, parseInt(e.target.value) || 1)))} /></Campo>
              <Campo label="Apartados por ejercicio"><input style={inp} type="number" min="1" max="20" value={cfg.nApartados} onChange={e => set('nApartados', Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))} /></Campo>
            </>}
          </div>
          {modo === 'lectura' && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[[false, '📋 Tengo el texto'], [true, '✍️ Que la IA escriba el texto']].map(([v, t]) => (
                  <button key={t} onClick={() => set('crearTexto', v)} style={{ padding: '6px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 600,
                    border: `1.5px solid ${cfg.crearTexto === v ? '#6D28D9' : '#E2E8F0'}`, background: cfg.crearTexto === v ? '#F5F3FF' : 'white', color: cfg.crearTexto === v ? '#4C1D95' : '#475569' }}>{t}</button>
                ))}
              </div>
              {cfg.crearTexto ? (
                <div style={fila}>
                  <Campo label="Tema del texto" ancho="1 1 100%"><input style={inp} value={cfg.temaTexto} onChange={e => set('temaTexto', e.target.value)} placeholder="Un viaje a Islandia · La vida de Marie Curie · Un día en el instituto…" /></Campo>
                  <Campo label="Nivel del texto">
                    <select style={inp} value={cfg.nivelTexto} onChange={e => set('nivelTexto', e.target.value)}>
                      {['A1', 'A2', 'B1', 'B2', 'C1', 'Primaria (6-9 años)', 'Primaria (10-12 años)', 'ESO 1º-2º', 'ESO 3º-4º', 'Bachillerato'].map(v => <option key={v}>{v}</option>)}
                    </select>
                  </Campo>
                  <Campo label="Longitud (palabras)">
                    <select style={inp} value={cfg.palabras} onChange={e => set('palabras', parseInt(e.target.value))}>
                      {[100, 150, 200, 250, 300, 400, 500, 700].map(v => <option key={v} value={v}>{v} palabras</option>)}
                    </select>
                  </Campo>
                  <Campo label="Tipo de texto (opcional)">
                    <select style={inp} value={cfg.generoTexto} onChange={e => set('generoTexto', e.target.value)}>
                      {['', 'narrativo (un relato)', 'noticia', 'artículo informativo', 'biografía', 'diálogo', 'correo / carta', 'blog personal', 'texto científico divulgativo'].map(v => <option key={v} value={v}>{v || 'cualquiera'}</option>)}
                    </select>
                  </Campo>
                </div>
              ) : (
                <Campo label="Texto (pégalo aquí, o déjalo vacío y adjúntalo en tu IA como PDF/foto)">
                  <textarea style={{ ...inp, minHeight: 110, resize: 'vertical' }} value={cfg.texto} onChange={e => set('texto', e.target.value)} placeholder="Once upon a time…" />
                </Campo>
              )}
            </div>
          )}
          {modo !== 'ficha' && (
            <div style={{ marginTop: 8 }}>
              <div style={lblS}>Tipos de ejercicio preferidos (opcional)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {TIPOS_ELEGIBLES.map(([t, txt]) => (
                  <button key={t} onClick={() => toggleTipo(t)} style={{ padding: '3px 10px', borderRadius: 14, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    border: `1px solid ${cfg.tipos.includes(t) ? '#6D28D9' : '#E2E8F0'}`, background: cfg.tipos.includes(t) ? '#6D28D9' : 'white', color: cfg.tipos.includes(t) ? 'white' : '#475569' }}>{txt}</button>
                ))}
              </div>
            </div>
          )}
          <Campo label="Indicaciones para la IA (opcional)">
            <input style={inp} value={cfg.extra} onChange={e => set('extra', e.target.value)} placeholder="Ej.: usa nombres españoles; incluye un crucigrama; nivel A1…" />
          </Campo>
        </Paso>

        <Paso n="2" t="Copia el prompt y llévalo a tu IA">
          <button onClick={copiar} style={{ ...btn, background: '#673AB7' }}>{copiado ? '✓ Prompt copiado' : '📋 Copiar prompt'}</button>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 6, lineHeight: 1.5 }}>
            Abre Gemini, ChatGPT o Claude, pega el prompt{modo === 'ficha' ? ' y adjunta la ficha (foto, PDF o Word; todas las páginas a la vez)' : modo === 'lectura' && !cfg.crearTexto && !cfg.texto.trim() ? ' y adjunta el texto' : ''}. Copia la respuesta completa (el JSON).
          </div>
        </Paso>

        <Paso n="3" t="Pega aquí la respuesta">
          <textarea value={pegada} onChange={e => setPegada(e.target.value)} placeholder='{"titulo": "...", "ejercicios": [...]}'
            style={{ ...inp, minHeight: 110, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }} />
          {tieneEjercicios && (
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, marginTop: 6, color: '#334155' }}>
              <input type="checkbox" checked={anadir} onChange={e => setAnadir(e.target.checked)} /> Añadir los ejercicios a los que ya tengo (si no, se sustituyen)
            </label>
          )}
          {error && <div style={{ marginTop: 8, padding: 10, background: '#FDECEA', color: '#C0392B', borderRadius: 8, fontSize: 13 }}>{error}</div>}
          <button onClick={cargar} disabled={!pegada.trim()} style={{ ...btn, width: '100%', marginTop: 8, background: pegada.trim() ? '#6D28D9' : '#BBB' }}>Cargar en el editor</button>
        </Paso>
      </div>
    </div>
  );
}

const Paso = ({ n, t, children }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
      <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#EDE9FE', color: '#6D28D9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>{n}</span>
      <b style={{ color: '#1E293B' }}>{t}</b>
    </div>
    {children}
  </div>
);
const Campo = ({ label, children, ancho = '1 1 150px' }) => (
  <div style={{ flex: ancho, minWidth: 0, marginTop: 6 }}><div style={lblS}>{label}</div>{children}</div>
);
const fila = { display: 'flex', gap: 10, flexWrap: 'wrap' };
const lblS = { fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' };
const inp = { width: '100%', padding: 8, borderRadius: 8, border: '1px solid #CBD5E1', boxSizing: 'border-box', fontSize: 14, fontFamily: 'inherit' };
const btn = { padding: '10px 16px', color: 'white', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontSize: 14 };
