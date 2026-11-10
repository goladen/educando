// Herramienta del profesor «Ficha en papel ↔ hoja interactiva» con la IA del propio profesor.
//   1) Crear: copiar prompt → adjuntar el PDF/foto de la ficha en Gemini/ChatGPT/Claude → pegar la respuesta
//      → recurso Omni (abre el editor para revisar y guardar).
//   2) Ficha en papel: imprimir la hoja (con hueco «Nº / código») o el solucionario.
//   3) Corregir: copiar prompt con la clave de respuestas → adjuntar fotos/vídeo de los exámenes
//      → pegar la respuesta → tabla por examen (bien / mal / parcial / en blanco / sin corregir), editable.
import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import MathText from './MathText';
import FotoAOmni from './FotoAOmni';
import {
  promptHojaAOmni, interpretarOmni, promptCorreccion, interpretarCorreccion, claveRespuestas, cuenta,
  NIVELES_PAPEL, IDIOMAS_PAPEL,
} from '../utils/omniPapel';
import { imprimirOmni } from '../utils/pdfOmni';

const OmninteractiveApp = lazy(() => import('../OmninteractiveApp'));

const TIPO_TXT = {
  fill: 'Huecos', choice: 'Elegir', wordbank: 'Banco de palabras', construct: 'Construir frases', match: 'Unir',
  order: 'Ordenar', truefalse: 'V / F', multichoice: 'Test', error: 'Buscar el error', short: 'Respuesta corta', open: 'Abierta',
  expr: 'Expresión', matrix: 'Matriz',
};
const ESTADO = {
  bien:          { txt: 'Bien',          icon: '✓', color: '#047857', bg: '#DCFCE7' },
  parcial:       { txt: 'Parcial',       icon: '½', color: '#B45309', bg: '#FEF3C7' },
  mal:           { txt: 'Mal',           icon: '✗', color: '#B91C1C', bg: '#FEE2E2' },
  blanco:        { txt: 'En blanco',     icon: '○', color: '#475569', bg: '#F1F5F9' },
  no_corregible: { txt: 'Sin corregir',  icon: '?', color: '#7C3AED', bg: '#EDE9FE' },
};
const ORDEN_ESTADOS = ['bien', 'parcial', 'mal', 'blanco', 'no_corregible'];

async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); return true; } catch {
    window.prompt('Copia este prompt (Ctrl+C):', texto);
    return false;
  }
}

const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

// ─────────────────────────────────────────────────────────────
export default function PapelInteractivo({ usuario, onBack, onOpenEditorOmni }) {
  const [pestana, setPestana] = useState('crear');
  const [misHojas, setMisHojas] = useState(null);
  const [errorHojas, setErrorHojas] = useState('');
  const [seleccion, setSeleccion] = useState(null);   // recurso Omni elegido para imprimir / corregir

  useEffect(() => {
    if (!usuario?.uid) { setMisHojas([]); return; }
    getDocs(query(collection(db, 'resources'), where('profesorUid', '==', usuario.uid)))
      .then(snap => {
        const l = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(r => r.tipoJuego === 'OMNINTERACTIVE')
          .sort((a, b) => (b.fechaCreacion?.seconds || 0) - (a.fechaCreacion?.seconds || 0));
        setMisHojas(l);
      })
      .catch(e => { setErrorHojas(e.message); setMisHojas([]); });
  }, [usuario?.uid]);

  return (
    <div style={{ padding: '20px 16px', maxWidth: 980, margin: '0 auto' }}>
      <button onClick={onBack} style={s.volver}>← Volver a herramientas</button>
      <h2 style={{ margin: '0 0 4px', color: '#4C1D95' }}>📄 Ficha en papel ↔ hoja interactiva</h2>
      <p style={{ margin: '0 0 16px', color: '#64748B', fontSize: 14 }}>
        Con tu propia IA (Gemini, ChatGPT, Claude…): convierte una ficha en una hoja interactiva con corrección al instante,
        imprímela para hacerla en papel y corrige después los exámenes a partir de fotos o de un vídeo.
      </p>

      <div style={s.tabs}>
        {[['crear', '1 · Crear hoja interactiva'], ['papel', '2 · Ficha en papel'], ['corregir', '3 · Corregir exámenes']].map(([id, t]) => (
          <button key={id} onClick={() => setPestana(id)} style={{ ...s.tab, ...(pestana === id ? s.tabOn : {}) }}>{t}</button>
        ))}
      </div>

      {pestana === 'crear' && <PasoCrear onOpenEditorOmni={onOpenEditorOmni} />}
      {pestana !== 'crear' && (
        <SelectorHoja hojas={misHojas} error={errorHojas} seleccion={seleccion} onSelect={setSeleccion} />
      )}
      {pestana === 'papel' && seleccion && <PasoPapel recurso={seleccion} onOpenEditorOmni={onOpenEditorOmni} />}
      {pestana === 'corregir' && seleccion && <PasoCorregir recurso={seleccion} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 1) Crear
// ─────────────────────────────────────────────────────────────
function PasoCrear({ onOpenEditorOmni }) {
  const [config, setConfig] = useState({ idioma: 'Español', nivel: '1 ESO', asignatura: '', extra: '' });
  const [copiado, setCopiado] = useState(false);
  const [pegada, setPegada] = useState('');
  const [error, setError] = useState('');
  const [recurso, setRecurso] = useState(null);
  const [probando, setProbando] = useState(false);
  const [auto, setAuto] = useState(false);
  const set = (k) => (e) => setConfig(c => ({ ...c, [k]: e.target.value }));

  const copiarPrompt = async () => {
    await copiar(promptHojaAOmni(config));
    setCopiado(true); setTimeout(() => setCopiado(false), 2500);
  };
  const cargar = () => {
    setError('');
    try { setRecurso(interpretarOmni(pegada, config)); } catch (e) { setError('No se pudo leer la respuesta: ' + e.message); }
  };

  if (probando && recurso) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'white' }}>
      <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Cargando…</div>}>
        <OmninteractiveApp recursoDirecto={recurso} onBack={() => setProbando(false)} />
      </Suspense>
    </div>
  );

  if (recurso) {
    const exs = recurso.ejercicios;
    const nPreg = exs.reduce((t, e) => t + e.items.length, 0);
    const nAbiertas = exs.filter(e => e.tipo === 'open').reduce((t, e) => t + e.items.length, 0);
    return (
      <div style={s.card}>
        <div style={s.ok}>✓ {exs.length} ejercicios · {nPreg} preguntas{nAbiertas ? ` (${nAbiertas} abiertas, no se autocorrigen)` : ''}</div>
        <h3 style={{ margin: '12px 0 2px' }}><MathText text={recurso.titulo} /></h3>
        <div style={{ fontSize: 13, color: '#64748B', marginBottom: 10 }}>{[recurso.asignatura, recurso.nivel, recurso.tema].filter(Boolean).join(' · ')}</div>
        <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
          {exs.map((ex, i) => (
            <div key={ex.id} style={{ display: 'flex', gap: 10, padding: '8px 12px', borderTop: i ? '1px solid #F1F5F9' : 'none', alignItems: 'center', fontSize: 13 }}>
              <b style={{ color: '#6D28D9', minWidth: 20 }}>{i + 1}</b>
              <span style={{ flex: 1, minWidth: 0 }}><MathText text={ex.titulo} /></span>
              <span style={s.chip}>{TIPO_TXT[ex.tipo] || ex.tipo}</span>
              <span style={{ color: '#94A3B8', fontSize: 12 }}>{ex.items.length}</span>
            </div>
          ))}
        </div>
        <div style={s.fila}>
          <button onClick={() => onOpenEditorOmni?.(recurso)} style={{ ...s.btn, background: '#6D28D9', flex: '2 1 220px' }}>✏️ Revisar y guardar</button>
          <button onClick={() => setProbando(true)} style={{ ...s.btnSec, flex: '1 1 140px' }}>▶ Probar como alumno</button>
          <button onClick={() => imprimirOmni(recurso)} style={{ ...s.btnSec, flex: '1 1 120px' }}>🖨️ Ficha PDF</button>
          <button onClick={() => imprimirOmni(recurso, { soluciones: true })} style={{ ...s.btnSec, flex: '1 1 120px' }}>✔ Soluciones</button>
        </div>
        <p style={s.nota}>Revisa las respuestas que ha puesto la IA antes de guardar: en el editor puedes cambiar cualquier pregunta, tipo o solución.
          Una vez guardada, la tendrás en «2 · Ficha en papel» y «3 · Corregir exámenes».</p>
        <button onClick={() => { setRecurso(null); setPegada(''); }} style={s.link}>← Convertir otra ficha</button>
      </div>
    );
  }

  return (
    <div style={s.card}>
      <Paso n="1" t="Datos de la ficha">
        <div style={s.fila}>
          <Campo label="Idioma"><select style={s.input} value={config.idioma} onChange={set('idioma')}>{IDIOMAS_PAPEL.map(v => <option key={v}>{v}</option>)}</select></Campo>
          <Campo label="Nivel"><select style={s.input} value={config.nivel} onChange={set('nivel')}>{NIVELES_PAPEL.map(v => <option key={v}>{v}</option>)}</select></Campo>
          <Campo label="Asignatura"><input style={s.input} value={config.asignatura} onChange={set('asignatura')} placeholder="Matemáticas, Inglés…" /></Campo>
        </div>
        <Campo label="Indicaciones para la IA (opcional)">
          <textarea style={{ ...s.input, minHeight: 50, resize: 'vertical' }} value={config.extra} onChange={set('extra')}
            placeholder="Ej: ignora el ejercicio 4; en los problemas pide solo el resultado final; acepta las respuestas sin unidades…" />
        </Campo>
      </Paso>

      <Paso n="2" t="Copia el prompt y llévalo a tu IA">
        <button onClick={copiarPrompt} style={{ ...s.btn, background: '#673AB7' }}>{copiado ? '✓ Prompt copiado' : '📋 Copiar prompt'}</button>
        <ol style={s.ol}>
          <li>Abre <b>Gemini</b>, ChatGPT o Claude (Gemini funciona muy bien con PDF y fotos).</li>
          <li>Adjunta la ficha: <b>PDF, foto(s), Word…</b> Si son varias páginas, adjúntalas todas a la vez.</li>
          <li>Pega el prompt y envíalo. Copia la respuesta completa (el JSON).</li>
        </ol>
      </Paso>

      <Paso n="3" t="Pega aquí la respuesta de tu IA">
        <textarea value={pegada} onChange={e => setPegada(e.target.value)} placeholder='{"titulo": "...", "ejercicios": [...]}'
          style={{ ...s.input, minHeight: 130, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }} />
        {error && <div style={s.error}>{error}</div>}
        <button onClick={cargar} disabled={!pegada.trim()} style={{ ...s.btn, background: pegada.trim() ? '#6D28D9' : '#BBB', width: '100%', marginTop: 8 }}>
          Crear hoja interactiva
        </button>
      </Paso>

      <div style={{ marginTop: 14, fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>
        ¿Prefieres que lo haga PIKT a partir de una foto? <button onClick={() => setAuto(true)} style={s.link}>⚡ Extracción automática con Gemini</button>
      </div>
      {auto && (
        <FotoAOmni onClose={() => setAuto(false)}
          onResourceExtracted={r => { setAuto(false); onOpenEditorOmni?.({ ...r, ordenFijo: true, origenPapel: true }); }} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Selector de una de mis hojas Omni
// ─────────────────────────────────────────────────────────────
function SelectorHoja({ hojas, error, seleccion, onSelect }) {
  const [filtro, setFiltro] = useState('');
  if (hojas === null) return <div style={s.card}>Cargando tus hojas interactivas…</div>;
  if (error) return <div style={{ ...s.card, ...s.error }}>No se pudieron cargar tus hojas: {error}</div>;
  if (!hojas.length) return <div style={s.card}>Aún no tienes hojas interactivas guardadas. Créala en «1 · Crear hoja interactiva» y guárdala desde el editor.</div>;
  const f = filtro.trim().toLowerCase();
  const lista = hojas.filter(h => !f || `${h.titulo} ${h.asignatura} ${h.tema}`.toLowerCase().includes(f));
  return (
    <div style={s.card}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <b style={{ flex: 1, fontSize: 14 }}>Elige la hoja</b>
        {hojas.length > 6 && <input style={{ ...s.input, maxWidth: 240 }} value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Buscar…" />}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
        {lista.map(h => {
          const on = seleccion?.id === h.id;
          const n = (h.ejercicios || []).reduce((t, e) => t + (e.items?.length || 0), 0);
          return (
            <button key={h.id} onClick={() => onSelect(h)} style={{ ...s.hoja, ...(on ? s.hojaOn : {}) }}>
              <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <b>{h.titulo || '(sin título)'}</b>
                <span style={{ display: 'block', fontSize: 12, color: '#64748B' }}>{[h.asignatura, h.nivel, `${(h.ejercicios || []).length} ejercicios · ${n} preguntas`].filter(Boolean).join(' · ')}</span>
              </span>
              {on && <span style={{ color: '#6D28D9', fontWeight: 700 }}>✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 2) Ficha en papel
// ─────────────────────────────────────────────────────────────
function PasoPapel({ recurso, onOpenEditorOmni }) {
  const [numero, setNumero] = useState(true);
  return (
    <div style={s.card}>
      <h3 style={{ margin: '0 0 6px' }}>{recurso.titulo}</h3>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748B' }}>
        Se abre la ficha lista para imprimir o «Guardar como PDF». Para corregir con la IA sin datos personales, los alumnos escriben solo un número o código en lugar del nombre.
      </p>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={numero} onChange={e => setNumero(e.target.checked)} /> Recuadro «Nº / código» en la cabecera (en vez del nombre)
      </label>
      <div style={s.fila}>
        <button onClick={() => imprimirOmni(recurso, { numeroExamen: numero })} style={{ ...s.btn, background: '#4C1D95', flex: '1 1 180px' }}>🖨️ Ficha para los alumnos</button>
        <button onClick={() => imprimirOmni(recurso, { soluciones: true })} style={{ ...s.btnSec, flex: '1 1 160px' }}>✔ Solucionario</button>
        <button onClick={() => onOpenEditorOmni?.(recurso)} style={{ ...s.btnSec, flex: '1 1 120px' }}>✏️ Editar hoja</button>
      </div>
      {recurso.accessCode && (
        <p style={s.nota}>Versión interactiva: los alumnos la encuentran en Omninteractive; código de acceso del recurso <b>{recurso.accessCode}</b>.</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 3) Corregir exámenes en papel
// ─────────────────────────────────────────────────────────────
function PasoCorregir({ recurso }) {
  const clave = useMemo(() => claveRespuestas(recurso), [recurso]);
  const porRef = useMemo(() => Object.fromEntries(clave.map(f => [f.ref, f])), [clave]);
  const lsKey = `pikt_correccion_${recurso.id}`;
  const [opc, setOpc] = useState({ criterios: '', puntuarAbiertas: true });
  const [copiado, setCopiado] = useState(false);
  const [pegada, setPegada] = useState('');
  const [error, setError] = useState('');
  const [examenes, setExamenes] = useState(() => lsGet(lsKey));
  const [abierto, setAbierto] = useState(null);

  useEffect(() => { setExamenes(lsGet(lsKey)); setPegada(''); setError(''); setAbierto(null); }, [lsKey]);
  const guardar = (l) => { setExamenes(l); lsSet(lsKey, l); };

  const copiarPrompt = async () => {
    await copiar(promptCorreccion(recurso, opc));
    setCopiado(true); setTimeout(() => setCopiado(false), 2500);
  };
  const cargar = () => {
    setError('');
    try {
      const { examenes: nuevos } = interpretarCorreccion(pegada, recurso);
      // Se añaden a los ya corregidos (útil si se corrigen por tandas)
      const previos = examenes || [];
      const base = previos.length;
      guardar([...previos, ...nuevos.map((e, i) => ({ ...e, examen: base ? `${base + i + 1}` : String(e.examen) }))]);
      setPegada('');
    } catch (e) { setError('No se pudo leer la respuesta: ' + e.message); }
  };
  const cambiarEstado = (ei, ref) => {
    const l = examenes.map((ex, i) => {
      if (i !== ei) return ex;
      const items = ex.items.map(it => it.ref !== ref ? it : { ...it, estado: ORDEN_ESTADOS[(ORDEN_ESTADOS.indexOf(it.estado) + 1) % ORDEN_ESTADOS.length], revisado: true });
      return { ...ex, items, ...cuenta(items) };
    });
    guardar(l);
  };
  const renombrar = (ei, marca) => guardar(examenes.map((ex, i) => i === ei ? { ...ex, marca } : ex));
  const borrarTodo = () => { if (window.confirm('¿Borrar todas las correcciones de esta hoja?')) { guardar(null); setAbierto(null); } };

  const exportarCSV = () => {
    const cab = ['Examen', 'Marca', 'Nota /10', 'Bien', 'Parcial', 'Mal', 'En blanco', 'Sin corregir', ...clave.map(f => `${f.ref} ${f.lbl || ''}`.trim())];
    const filas = examenes.map(ex => [ex.examen, ex.marca, ex.nota ?? '', ex.bien, ex.parcial, ex.mal, ex.blanco, ex.noCorr,
      ...ex.items.map(it => ESTADO[it.estado]?.txt || it.estado)]);
    const csv = [cab, ...filas].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `correccion_${(recurso.titulo || 'hoja').replace(/[^\w]+/g, '_')}.csv`;
    a.click();
  };

  const media = examenes?.length ? examenes.filter(e => e.nota != null).reduce((t, e, _, a) => t + e.nota / a.length, 0) : null;
  // Preguntas que más fallan
  const fallos = examenes?.length ? clave.map(f => ({
    ...f, n: examenes.filter(ex => ['mal', 'blanco'].includes(ex.items.find(i => i.ref === f.ref)?.estado)).length,
  })).filter(f => f.n).sort((a, b) => b.n - a.n).slice(0, 5) : [];

  return (
    <div style={s.card}>
      <h3 style={{ margin: '0 0 10px' }}>{recurso.titulo} <span style={{ fontSize: 13, color: '#94A3B8', fontWeight: 400 }}>· {clave.length} preguntas en la clave</span></h3>

      <Paso n="1" t="Opciones de corrección">
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer', marginBottom: 6 }}>
          <input type="checkbox" checked={opc.puntuarAbiertas} onChange={e => setOpc(o => ({ ...o, puntuarAbiertas: e.target.checked }))} />
          Que la IA valore también las preguntas abiertas (si no, quedan «sin corregir» para ti)
        </label>
        <textarea style={{ ...s.input, minHeight: 44, resize: 'vertical' }} value={opc.criterios} onChange={e => setOpc(o => ({ ...o, criterios: e.target.value }))}
          placeholder="Criterios extra (opcional). Ej: las faltas de ortografía cuentan como error; en los problemas, el resultado sin unidades es parcial…" />
      </Paso>

      <Paso n="2" t="Copia el prompt y adjunta los exámenes en tu IA">
        <button onClick={copiarPrompt} style={{ ...s.btn, background: '#673AB7' }}>{copiado ? '✓ Prompt copiado' : '📋 Copiar prompt de corrección'}</button>
        <ol style={s.ol}>
          <li>Haz <b>una foto por página</b> de cada examen, en orden, o graba <b>un vídeo</b> pasando los exámenes uno a uno (2-3 s por página). Gemini es el que mejor lee vídeos.</li>
          <li><b>Tapa o recorta los nombres</b>: identifica cada examen por su número/código.</li>
          <li>Adjunta las fotos o el vídeo, pega el prompt y envíalo. Si hay muchos exámenes, hazlo por tandas (p. ej. de 8 en 8): los resultados se van sumando.</li>
        </ol>
      </Paso>

      <Paso n="3" t="Pega aquí la respuesta de tu IA">
        <textarea value={pegada} onChange={e => setPegada(e.target.value)} placeholder='{"examenes": [...]}'
          style={{ ...s.input, minHeight: 110, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }} />
        {error && <div style={s.error}>{error}</div>}
        <button onClick={cargar} disabled={!pegada.trim()} style={{ ...s.btn, background: pegada.trim() ? '#6D28D9' : '#BBB', width: '100%', marginTop: 8 }}>
          Ver corrección
        </button>
      </Paso>

      {examenes?.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
            <b style={{ flex: 1, fontSize: 15 }}>📊 {examenes.length} exámenes{media != null ? ` · media ${media.toFixed(1)}` : ''}</b>
            <button onClick={exportarCSV} style={s.btnSec}>⬇ Excel (CSV)</button>
            <button onClick={borrarTodo} style={{ ...s.btnSec, color: '#B91C1C' }}>Borrar</button>
          </div>
          <p style={{ ...s.nota, marginTop: 0 }}>Pulsa un examen para ver cada pregunta. Pulsa el estado de una pregunta para cambiarlo (✓ → ½ → ✗ → ○ → ?): la nota se recalcula. La nota no cuenta las preguntas «sin corregir».</p>

          {fallos.length > 0 && (
            <div style={{ ...s.caja, marginBottom: 10 }}>
              <b style={{ fontSize: 13 }}>Preguntas con más fallos:</b>
              {fallos.map(f => <div key={f.ref} style={{ fontSize: 12, color: '#475569' }}>[{f.ref}] {f.lbl} <MathText text={f.pregunta.slice(0, 90)} /> — <b>{f.n}</b> {f.n === 1 ? 'alumno' : 'alumnos'}</div>)}
            </div>
          )}

          {examenes.map((ex, ei) => (
            <div key={ei} style={{ border: '1px solid #E2E8F0', borderRadius: 12, marginBottom: 8, overflow: 'hidden' }}>
              <div onClick={() => setAbierto(abierto === ei ? null : ei)} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', background: '#F8FAFC', cursor: 'pointer', flexWrap: 'wrap' }}>
                <b style={{ minWidth: 90 }}>Examen {ex.examen}{ex.marca ? ` · ${ex.marca}` : ''}</b>
                <span style={{ fontSize: 22, fontWeight: 800, color: ex.nota == null ? '#94A3B8' : ex.nota >= 5 ? '#047857' : '#B91C1C', minWidth: 46 }}>{ex.nota == null ? '—' : ex.nota.toFixed(1).replace('.0', '')}</span>
                <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap', flex: 1 }}>
                  {[['bien', ex.bien], ['parcial', ex.parcial], ['mal', ex.mal], ['blanco', ex.blanco], ['no_corregible', ex.noCorr]].filter(([, n]) => n).map(([e, n]) => (
                    <span key={e} style={{ ...s.chip, background: ESTADO[e].bg, color: ESTADO[e].color }}>{ESTADO[e].icon} {n} {ESTADO[e].txt.toLowerCase()}</span>
                  ))}
                </span>
                <span style={{ color: '#94A3B8' }}>{abierto === ei ? '▲' : '▼'}</span>
              </div>
              {abierto === ei && (
                <div style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: '#64748B' }}>Nº / código del alumno:</span>
                    <input style={{ ...s.input, maxWidth: 160, padding: 6 }} value={ex.marca || ''} onChange={e => renombrar(ei, e.target.value)} placeholder="p. ej. 12" />
                  </div>
                  {ex.resumen && <div style={{ ...s.caja, marginBottom: 8, fontSize: 13 }}>🤖 {ex.resumen}</div>}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={s.tabla}>
                      <thead><tr><th style={s.th}>Ref.</th><th style={s.th}>Pregunta</th><th style={s.th}>Solución</th><th style={s.th}>Alumno</th><th style={s.th}>Estado</th></tr></thead>
                      <tbody>
                        {ex.items.map(it => {
                          const f = porRef[it.ref] || {};
                          const e = ESTADO[it.estado] || ESTADO.no_corregible;
                          return (
                            <tr key={it.ref}>
                              <td style={{ ...s.td, whiteSpace: 'nowrap', color: '#6D28D9', fontWeight: 700 }}>{it.ref}<div style={{ fontWeight: 400, color: '#94A3B8' }}>{f.lbl}</div></td>
                              <td style={s.td}><MathText text={f.pregunta} /></td>
                              <td style={{ ...s.td, color: '#047857' }}><MathText text={f.solucion} /></td>
                              <td style={s.td}>{it.respuesta || <i style={{ color: '#94A3B8' }}>—</i>}{it.comentario && <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{it.comentario}</div>}</td>
                              <td style={s.td}>
                                <button onClick={() => cambiarEstado(ei, it.ref)} title="Cambiar estado" style={{ ...s.estado, background: e.bg, color: e.color }}>
                                  {e.icon} {e.txt}{it.revisado ? ' ✎' : ''}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function Paso({ n, t, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <span style={s.num}>{n}</span><b style={{ fontSize: 14 }}>{t}</b>
      </div>
      <div style={{ paddingLeft: 32 }}>{children}</div>
    </div>
  );
}
function Campo({ label, children }) {
  return <div style={{ flex: '1 1 160px', marginBottom: 8 }}><label style={s.label}>{label}</label>{children}</div>;
}

const s = {
  volver: { marginBottom: 16, padding: '7px 14px', borderRadius: 8, border: '1px solid #dde', background: 'white', cursor: 'pointer', fontSize: '0.85rem', color: '#555' },
  tabs: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 },
  tab: { padding: '9px 14px', borderRadius: 10, border: '1px solid #DDD6FE', background: 'white', color: '#6D28D9', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  tabOn: { background: '#6D28D9', color: 'white', border: '1px solid #6D28D9' },
  card: { background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', padding: '18px 16px', marginBottom: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' },
  fila: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  label: { display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 4 },
  input: { width: '100%', padding: 9, borderRadius: 8, border: '1px solid #CBD5E1', boxSizing: 'border-box', fontSize: 14, fontFamily: 'inherit' },
  btn: { padding: '10px 16px', color: 'white', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontSize: 14 },
  btnSec: { padding: '9px 14px', background: 'white', border: '1px solid #CBD5E1', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#334155' },
  link: { border: 'none', background: 'none', color: '#6D28D9', cursor: 'pointer', fontSize: 12, textDecoration: 'underline', padding: 0 },
  ol: { margin: '10px 0 0', paddingLeft: 18, fontSize: 13, color: '#475569', lineHeight: 1.6 },
  num: { width: 24, height: 24, borderRadius: '50%', background: '#EDE9FE', color: '#6D28D9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flexShrink: 0 },
  error: { marginTop: 8, padding: 10, background: '#FDECEA', color: '#C0392B', borderRadius: 8, fontSize: 13, wordBreak: 'break-word' },
  ok: { padding: '10px 14px', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 10, color: '#15803D', fontWeight: 600, fontSize: 14 },
  nota: { fontSize: 12, color: '#64748B', marginTop: 10, lineHeight: 1.5 },
  chip: { padding: '2px 8px', borderRadius: 10, background: '#EDE9FE', color: '#6D28D9', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' },
  caja: { padding: '8px 12px', background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 8 },
  hoja: { display: 'flex', gap: 8, alignItems: 'center', padding: '9px 12px', borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' },
  hojaOn: { border: '1px solid #6D28D9', background: '#F5F3FF' },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #E2E8F0', fontSize: 11, color: '#64748B', textTransform: 'uppercase' },
  td: { padding: '6px 8px', borderBottom: '1px solid #F1F5F9', verticalAlign: 'top' },
  estado: { border: 'none', borderRadius: 8, padding: '4px 9px', cursor: 'pointer', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' },
};
