// Herramienta del profesor «Documentos personalizados» (combinar correspondencia):
// texto con campos {{Columna}} (insertados con botones) + tabla → un documento por fila,
// descargables juntos o por separado (ZIP) en PDF o en texto.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  RE_CAMPO, generarDocs, camposDesconocidos, filaVacia, tablaDeTexto, tablaDeArchivo, descargarPdf, descargarTxt,
} from '../utils/combinarDocs';
import EnviarCorreosDocs from './EnviarCorreosDocs';

const LS = 'pikt_docs_personalizados';
const COLORES = ['#6D28D9', '#0E7490', '#B45309', '#047857', '#BE185D', '#1D4ED8', '#C2410C', '#0F766E'];
const colorCol = (i) => COLORES[i % COLORES.length];

const EJEMPLO = {
  titulo: 'Informe de {{Nombre}}',
  plantilla: `Estimada familia de {{Nombre}}:

Les informamos de que {{Nombre}}, del grupo {{Curso}}, ha obtenido una calificación de {{Nota}} en la evaluación de Matemáticas.

Observaciones: {{Observaciones}}

Quedamos a su disposición para cualquier consulta.

Un saludo,
El tutor`,
  columnas: ['Nombre', 'Curso', 'Nota', 'Observaciones', 'Correo'],
  filas: [
    ['Lucía Martín', '2.º ESO A', '8,5', 'Trabaja con constancia y participa en clase.', 'familia.lucia@example.com'],
    ['Hugo Pérez', '2.º ESO A', '6', 'Debe repasar las fracciones y los porcentajes.', 'familia.hugo@example.com'],
    ['Aya Benali', '2.º ESO B', '9', 'Excelente actitud y muy buenos resultados.', 'familia.aya@example.com; tutor.aya@example.com'],
  ],
};

const leer = () => { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch { return null; } };
const vacioInicial = () => ({ titulo: '', plantilla: '', columnas: ['Nombre', 'Curso', ''], filas: [['', '', ''], ['', '', ''], ['', '', '']] });

export default function DocumentosPersonalizados({ onBack }) {
  const inicial = useMemo(() => leer() || vacioInicial(), []);
  const [titulo, setTitulo] = useState(inicial.titulo);
  const [plantilla, setPlantilla] = useState(inicial.plantilla);
  const [columnas, setColumnas] = useState(inicial.columnas);
  const [filas, setFilas] = useState(inicial.filas);
  const [foco, setFoco] = useState('plantilla');     // dónde insertan los botones
  const [verDoc, setVerDoc] = useState(0);
  const [pegar, setPegar] = useState(null);           // { texto, cabecera } | null
  const [opc, setOpc] = useState({ tam: 12, alinear: 'left', nombre: 'documentos' });
  const [ocupado, setOcupado] = useState('');
  const [aviso, setAviso] = useState('');
  const refTexto = useRef(null);
  const refTitulo = useRef(null);
  const refArchivo = useRef(null);

  // Borrador automático en este navegador
  useEffect(() => {
    const t = setTimeout(() => { try { localStorage.setItem(LS, JSON.stringify({ titulo, plantilla, columnas, filas })); } catch { /* sin almacenamiento */ } }, 400);
    return () => clearTimeout(t);
  }, [titulo, plantilla, columnas, filas]);

  const nombresCol = columnas.map((c, i) => c.trim() || `Columna ${i + 1}`);
  const docs = useMemo(() => generarDocs({ plantilla, titulo, columnas: nombresCol, filas }), [plantilla, titulo, columnas, filas]); // eslint-disable-line react-hooks/exhaustive-deps
  const desconocidos = useMemo(() => camposDesconocidos([plantilla, titulo], nombresCol), [plantilla, titulo, columnas]); // eslint-disable-line react-hooks/exhaustive-deps
  const doc = docs[Math.min(verDoc, docs.length - 1)];
  const conVacios = docs.filter(d => d.vacios.length).length;

  // ── Plantilla ────────────────────────────────────────────
  const insertar = (i) => {
    const marca = `{{${nombresCol[i]}}}`;
    const enTitulo = foco === 'titulo';
    const el = enTitulo ? refTitulo.current : refTexto.current;
    const valor = enTitulo ? titulo : plantilla;
    const ini = el?.selectionStart ?? valor.length, fin = el?.selectionEnd ?? valor.length;
    const nuevo = valor.slice(0, ini) + marca + valor.slice(fin);
    (enTitulo ? setTitulo : setPlantilla)(nuevo);
    requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(ini + marca.length, ini + marca.length); } });
  };

  // ── Tabla ────────────────────────────────────────────────
  const ancho = columnas.length;
  const ajustar = (f, n) => { const a = [...(f || [])]; while (a.length < n) a.push(''); return a.slice(0, n); };

  const renombrarCol = (i, nombre) => {
    const viejo = nombresCol[i];
    setColumnas(cs => cs.map((c, j) => j === i ? nombre : c));
    // Los campos {{viejo}} de la plantilla pasan a {{nuevo}}
    const nuevo = nombre.trim() || `Columna ${i + 1}`;
    const cambia = (t) => t.replace(RE_CAMPO, (todo, n) => n.trim().toLowerCase() === viejo.toLowerCase() ? `{{${nuevo}}}` : todo);
    if (nuevo !== viejo) { setPlantilla(cambia); setTitulo(cambia); }
  };
  const addCol = () => { setColumnas(cs => [...cs, '']); setFilas(fs => fs.map(f => [...ajustar(f, ancho), ''])); };
  const delCol = (i) => {
    if (columnas.length <= 1) return;
    setColumnas(cs => cs.filter((_, j) => j !== i));
    setFilas(fs => fs.map(f => ajustar(f, ancho).filter((_, j) => j !== i)));
  };
  const addFila = () => setFilas(fs => [...fs, Array(ancho).fill('')]);
  const delFila = (r) => setFilas(fs => fs.length > 1 ? fs.filter((_, j) => j !== r) : [Array(ancho).fill('')]);
  const setCelda = (r, c, v) => setFilas(fs => fs.map((f, j) => j === r ? ajustar(f, ancho).map((x, k) => k === c ? v : x) : f));

  // Pegar un bloque de Excel en una celda: se reparte desde esa celda (añadiendo filas y columnas)
  const pegarEnCelda = (r, c, e) => {
    const txt = e.clipboardData.getData('text');
    if (!/[\t\n]/.test(txt.replace(/\n$/, ''))) return;     // texto normal: pegado normal
    e.preventDefault();
    const bloque = tablaDeTexto(txt);
    const necesita = Math.max(ancho, c + Math.max(...bloque.map(b => b.length)));
    if (necesita > ancho) setColumnas(cs => [...cs, ...Array(necesita - ancho).fill('')]);
    setFilas(fs => {
      const out = fs.map(f => ajustar(f, necesita));
      bloque.forEach((b, k) => {
        while (out.length <= r + k) out.push(Array(necesita).fill(''));
        b.forEach((v, m) => { out[r + k][c + m] = v; });
      });
      return out;
    });
  };

  const cargarTabla = (datos, cabecera) => {
    if (!datos.length) { setAviso('No se ha encontrado ninguna fila.'); return; }
    const n = Math.max(...datos.map(f => f.length));
    const cols = cabecera ? ajustar(datos[0], n).map((c, i) => c || `Columna ${i + 1}`) : (n <= ancho ? ajustar(columnas, n) : [...columnas, ...Array(n - ancho).fill('')]);
    const cuerpo = (cabecera ? datos.slice(1) : datos).map(f => ajustar(f, cols.length));
    setColumnas(cols);
    setFilas(cuerpo.length ? cuerpo : [Array(cols.length).fill('')]);
    setVerDoc(0);
    setAviso(`✓ ${cuerpo.length} filas cargadas.${cabecera ? ' Los títulos de las columnas se han tomado de la primera fila.' : ''}`);
  };

  const importar = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try {
      const datos = await tablaDeArchivo(f);
      // ¿La primera fila son títulos? Si coincide con campos de la plantilla o no tiene números, lo suponemos
      const primera = datos[0] || [];
      const campos = new Set([...`${plantilla} ${titulo}`.matchAll(RE_CAMPO)].map(m => m[1].trim().toLowerCase()));
      const esCabecera = primera.some(v => campos.has(v.toLowerCase())) || (datos.length > 1 && !primera.some(v => /\d/.test(v)));
      cargarTabla(datos, esCabecera);
    } catch (err) { setAviso('No se pudo leer el archivo: ' + err.message); }
  };

  const vaciar = () => {
    if (!window.confirm('¿Vaciar la tabla? (La plantilla se conserva)')) return;
    setFilas([Array(ancho).fill('')]); setVerDoc(0);
  };
  const empezarDeCero = () => {
    if (!window.confirm('¿Borrar la plantilla y la tabla y empezar de cero?')) return;
    const v = vacioInicial(); setTitulo(v.titulo); setPlantilla(v.plantilla); setColumnas(v.columnas); setFilas(v.filas); setVerDoc(0);
  };
  const cargarEjemplo = () => {
    if ((plantilla.trim() || filas.some(f => !filaVacia(f))) && !window.confirm('Se sustituirá lo que tienes por un ejemplo. ¿Continuar?')) return;
    setTitulo(EJEMPLO.titulo); setPlantilla(EJEMPLO.plantilla); setColumnas(EJEMPLO.columnas); setFilas(EJEMPLO.filas.map(f => [...f])); setVerDoc(0);
  };

  // ── Descargas ────────────────────────────────────────────
  const descargar = async (formato, separados) => {
    if (!docs.length) return;
    setOcupado(`${formato}${separados ? 's' : ''}`);
    try {
      if (formato === 'pdf') await descargarPdf(docs, { separados, ...opc });
      else await descargarTxt(docs, { separados, nombre: opc.nombre });
    } catch (e) { alert('No se pudo generar: ' + e.message); }
    setOcupado('');
  };
  const copiarActual = async () => {
    if (!doc) return;
    const t = (doc.titulo ? doc.titulo + '\n\n' : '') + doc.texto;
    try { await navigator.clipboard.writeText(t); setAviso('✓ Documento copiado al portapapeles.'); } catch { window.prompt('Copia el texto:', t); }
  };

  // Vista previa con los valores resaltados
  const previa = (texto, fila) => {
    const idx = Object.fromEntries(nombresCol.map((c, i) => [c.trim().toLowerCase(), i]));
    const out = []; let last = 0;
    for (const m of String(texto).matchAll(RE_CAMPO)) {
      out.push(texto.slice(last, m.index));
      const i = idx[m[1].trim().toLowerCase()];
      if (i === undefined) out.push(<span key={m.index} style={st.desconocido}>{m[0]}</span>);
      else {
        const v = String(fila?.[i] ?? '');
        out.push(v.trim()
          ? <mark key={m.index} style={{ ...st.valor, background: colorCol(i) + '1F', color: colorCol(i) }}>{v}</mark>
          : <mark key={m.index} style={st.hueco} title={`Vacío: ${nombresCol[i]}`}>[{nombresCol[i]}]</mark>);
      }
      last = m.index + m[0].length;
    }
    out.push(texto.slice(last));
    return out;
  };
  const filaDoc = doc ? filas[doc.n - 1] : null;

  return (
    <div style={{ padding: '20px 16px', maxWidth: 1100, margin: '0 auto' }}>
      <button onClick={onBack} style={st.volver}>← Volver a herramientas</button>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h2 style={{ margin: '0 0 4px', color: '#4C1D95' }}>✉️ Documentos personalizados</h2>
          <p style={{ margin: 0, color: '#64748B', fontSize: 14 }}>
            Escribe el texto una vez, inserta los campos con los botones y rellena la tabla: se crea un documento por cada fila.
          </p>
        </div>
        <button onClick={cargarEjemplo} style={st.btnSec}>💡 Ver un ejemplo</button>
        <button onClick={empezarDeCero} style={{ ...st.btnSec, color: '#94A3B8' }}>Empezar de cero</button>
      </div>

      {/* ── 1. Texto ── */}
      <section style={st.card}>
        <h3 style={st.h3}><span style={st.num}>1</span> Texto del documento</h3>
        <div style={st.botonera}>
          <span style={{ fontSize: 12, color: '#64748B' }}>Insertar campo{foco === 'titulo' ? ' en el título' : ''}:</span>
          {nombresCol.map((c, i) => (
            <button key={i} onMouseDown={e => e.preventDefault()} onClick={() => insertar(i)}
              style={{ ...st.campo, border: `1.5px solid ${colorCol(i)}`, color: colorCol(i), background: colorCol(i) + '12' }}>
              ＋ {c}
            </button>
          ))}
          <button onClick={addCol} style={{ ...st.campo, border: '1px dashed #CBD5E1', color: '#64748B', background: 'white' }}>＋ nueva columna</button>
        </div>
        <label style={st.label}>Título / nombre del archivo <span style={st.opc}>(opcional, también admite campos)</span></label>
        <input ref={refTitulo} value={titulo} onChange={e => setTitulo(e.target.value)} onFocus={() => setFoco('titulo')}
          style={st.input} placeholder="Ej: Informe de {{Nombre}}" />
        <label style={st.label}>Texto</label>
        <textarea ref={refTexto} value={plantilla} onChange={e => setPlantilla(e.target.value)} onFocus={() => setFoco('plantilla')}
          style={{ ...st.input, minHeight: 200, resize: 'vertical', lineHeight: 1.55 }}
          placeholder={'Escribe aquí tu texto y pulsa los botones de arriba para insertar los datos de la tabla.\n\nEj: Querida familia de {{Nombre}}: …'} />
        {desconocidos.length > 0 && (
          <div style={st.alerta}>⚠️ Estos campos no son ninguna columna de la tabla y se quedarán tal cual: {desconocidos.map(c => `{{${c}}}`).join(', ')}</div>
        )}
      </section>

      {/* ── 2. Tabla ── */}
      <section style={st.card}>
        <h3 style={st.h3}><span style={st.num}>2</span> Datos <span style={{ fontWeight: 400, fontSize: 13, color: '#64748B' }}>· cada fila es un documento</span></h3>
        <div style={st.botonera}>
          <button onClick={addFila} style={st.btnSec}>＋ Fila</button>
          <button onClick={addCol} style={st.btnSec}>＋ Columna</button>
          <button onClick={() => setPegar({ texto: '', cabecera: true })} style={st.btnSec}>📋 Pegar desde Excel / Sheets</button>
          <button onClick={() => refArchivo.current?.click()} style={st.btnSec}>📂 Importar Excel o CSV</button>
          <input ref={refArchivo} type="file" accept=".xlsx,.xls,.ods,.csv,.tsv,.txt" onChange={importar} style={{ display: 'none' }} />
          <button onClick={vaciar} style={{ ...st.btnSec, color: '#B91C1C' }}>Vaciar</button>
        </div>
        <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 8px' }}>
          Truco: copia celdas de Excel o Google Sheets y pégalas en cualquier casilla; se reparten solas. La primera fila son los nombres de los campos.
        </p>
        {aviso && <div style={{ ...st.alerta, background: '#F0FDF4', border: '1px solid #86EFAC', color: '#166534' }} onClick={() => setAviso('')}>{aviso}</div>}
        <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: 10 }}>
          <table style={st.tabla}>
            <thead>
              <tr>
                <th style={{ ...st.th, width: 34 }}>#</th>
                {columnas.map((c, i) => (
                  <th key={i} style={{ ...st.th, borderTop: `3px solid ${colorCol(i)}` }}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input value={c} onChange={e => renombrarCol(i, e.target.value)} placeholder={`Columna ${i + 1}`}
                        style={{ ...st.celda, fontWeight: 700, color: colorCol(i) }} />
                      {columnas.length > 1 && <button onClick={() => delCol(i)} title="Borrar columna" style={st.x}>✕</button>}
                    </div>
                  </th>
                ))}
                <th style={{ ...st.th, width: 34 }} />
              </tr>
            </thead>
            <tbody>
              {filas.map((f, r) => (
                <tr key={r} style={{ background: filaVacia(f) ? '#FAFAFA' : 'white' }}>
                  <td style={{ ...st.td, textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>{r + 1}</td>
                  {columnas.map((_, c) => (
                    <td key={c} style={st.td}>
                      <input value={f?.[c] ?? ''} onChange={e => setCelda(r, c, e.target.value)} onPaste={e => pegarEnCelda(r, c, e)}
                        onKeyDown={e => { if (e.key === 'Enter' && r === filas.length - 1) addFila(); }}
                        style={st.celda} />
                    </td>
                  ))}
                  <td style={st.td}><button onClick={() => delFila(r)} title="Borrar fila" style={st.x}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={addFila} style={{ ...st.btnSec, marginTop: 8, width: '100%', border: '1px dashed #CBD5E1' }}>＋ Añadir fila</button>
      </section>

      {/* ── 3. Resultado ── */}
      <section style={st.card}>
        <h3 style={st.h3}><span style={st.num}>3</span> {docs.length} {docs.length === 1 ? 'documento' : 'documentos'}</h3>
        {!docs.length ? (
          <p style={{ color: '#94A3B8', fontSize: 14 }}>Rellena al menos una fila de la tabla para ver los documentos.</p>
        ) : (
          <>
            {conVacios > 0 && <div style={st.alerta}>⚠️ {conVacios} {conVacios === 1 ? 'documento tiene' : 'documentos tienen'} campos vacíos (marcados en rojo en la vista previa).</div>}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
              <button onClick={() => setVerDoc(v => Math.max(0, v - 1))} disabled={verDoc === 0} style={st.btnSec}>‹</button>
              <select value={Math.min(verDoc, docs.length - 1)} onChange={e => setVerDoc(Number(e.target.value))} style={{ ...st.input, width: 'auto', flex: '1 1 200px' }}>
                {docs.map((d, i) => <option key={i} value={i}>{i + 1}. {d.nombre}{d.vacios.length ? ' ⚠️' : ''}</option>)}
              </select>
              <button onClick={() => setVerDoc(v => Math.min(docs.length - 1, v + 1))} disabled={verDoc >= docs.length - 1} style={st.btnSec}>›</button>
              <button onClick={copiarActual} style={st.btnSec}>Copiar este</button>
            </div>
            <div style={st.hoja}>
              {titulo.trim() && <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 12 }}>{previa(titulo, filaDoc)}</div>}
              <div style={{ whiteSpace: 'pre-wrap', textAlign: opc.alinear === 'justify' ? 'justify' : opc.alinear, fontSize: opc.tam + 2 }}>
                {plantilla.trim() ? previa(plantilla, filaDoc) : <i style={{ color: '#94A3B8' }}>(texto vacío)</i>}
              </div>
            </div>

            <div style={{ ...st.botonera, marginTop: 14 }}>
              <label style={st.mini}>Letra PDF
                <select value={opc.tam} onChange={e => setOpc(o => ({ ...o, tam: Number(e.target.value) }))} style={st.sel}>
                  {[10, 11, 12, 13, 14, 16].map(n => <option key={n} value={n}>{n} pt</option>)}
                </select>
              </label>
              <label style={st.mini}>Alineación
                <select value={opc.alinear} onChange={e => setOpc(o => ({ ...o, alinear: e.target.value }))} style={st.sel}>
                  <option value="left">Izquierda</option><option value="justify">Justificado</option><option value="center">Centrado</option>
                </select>
              </label>
              <label style={st.mini}>Nombre del archivo
                <input value={opc.nombre} onChange={e => setOpc(o => ({ ...o, nombre: e.target.value }))} style={{ ...st.sel, width: 150 }} />
              </label>
            </div>
            <div style={st.descargas}>
              <div style={st.grupo}>
                <b>📄 PDF</b>
                <button onClick={() => descargar('pdf', false)} disabled={!!ocupado} style={{ ...st.btn, background: '#B91C1C' }}>{ocupado === 'pdf' ? 'Generando…' : `Todos juntos (1 PDF, ${docs.length} págs.)`}</button>
                <button onClick={() => descargar('pdf', true)} disabled={!!ocupado} style={{ ...st.btn, background: '#7F1D1D' }}>{ocupado === 'pdfs' ? 'Generando…' : `Por separado (${docs.length} PDF en ZIP)`}</button>
              </div>
              <div style={st.grupo}>
                <b>📝 Texto</b>
                <button onClick={() => descargar('txt', false)} disabled={!!ocupado} style={{ ...st.btn, background: '#334155' }}>{ocupado === 'txt' ? 'Generando…' : 'Todos juntos (1 .txt)'}</button>
                <button onClick={() => descargar('txt', true)} disabled={!!ocupado} style={{ ...st.btn, background: '#0F172A' }}>{ocupado === 'txts' ? 'Generando…' : `Por separado (${docs.length} .txt en ZIP)`}</button>
              </div>
            </div>
            <EnviarCorreosDocs docs={docs} filas={filas} columnas={nombresCol} />
            <p style={{ fontSize: 11, color: '#94A3B8', margin: '8px 0 0' }}>El trabajo se guarda solo en este navegador. Los archivos se crean en tu equipo: los datos no se envían a ningún servidor.</p>
          </>
        )}
      </section>

      {/* Modal pegar */}
      {pegar && (
        <div style={st.overlay} onClick={() => setPegar(null)}>
          <div style={st.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 6px' }}>📋 Pegar tabla</h3>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: '#64748B' }}>Selecciona las celdas en Excel, Google Sheets o Calc, cópialas (Ctrl+C) y pégalas aquí (Ctrl+V). También vale texto separado por comas o punto y coma.</p>
            <textarea autoFocus value={pegar.texto} onChange={e => setPegar(p => ({ ...p, texto: e.target.value }))}
              style={{ ...st.input, minHeight: 180, fontFamily: 'monospace', fontSize: 12 }} placeholder={'Nombre\tCurso\tNota\nLucía\t2.º A\t8,5'} />
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, margin: '8px 0 12px', cursor: 'pointer' }}>
              <input type="checkbox" checked={pegar.cabecera} onChange={e => setPegar(p => ({ ...p, cabecera: e.target.checked }))} />
              La primera fila son los nombres de los campos
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setPegar(null)} style={st.btnSec}>Cancelar</button>
              <button onClick={() => { cargarTabla(tablaDeTexto(pegar.texto), pegar.cabecera); setPegar(null); }} disabled={!pegar.texto.trim()}
                style={{ ...st.btn, background: pegar.texto.trim() ? '#6D28D9' : '#BBB' }}>Cargar en la tabla</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const st = {
  volver: { marginBottom: 16, padding: '7px 14px', borderRadius: 8, border: '1px solid #dde', background: 'white', cursor: 'pointer', fontSize: '0.85rem', color: '#555' },
  card: { background: 'white', borderRadius: 14, border: '1px solid #E2E8F0', padding: '16px', marginBottom: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' },
  h3: { margin: '0 0 12px', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  num: { width: 24, height: 24, borderRadius: '50%', background: '#EDE9FE', color: '#6D28D9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 },
  botonera: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 },
  campo: { padding: '5px 11px', borderRadius: 20, cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' },
  label: { display: 'block', fontSize: 12, fontWeight: 700, color: '#555', margin: '8px 0 4px' },
  opc: { fontWeight: 400, color: '#94A3B8' },
  input: { width: '100%', padding: 10, borderRadius: 8, border: '1px solid #CBD5E1', boxSizing: 'border-box', fontSize: 14, fontFamily: 'inherit' },
  alerta: { marginTop: 8, marginBottom: 8, padding: '8px 12px', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, fontSize: 13, color: '#92400E', cursor: 'default' },
  btn: { padding: '9px 14px', color: 'white', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontSize: 13 },
  btnSec: { padding: '7px 12px', background: 'white', border: '1px solid #CBD5E1', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#334155' },
  tabla: { borderCollapse: 'collapse', width: '100%', minWidth: 480 },
  th: { background: '#F8FAFC', padding: 4, borderBottom: '1px solid #E2E8F0', textAlign: 'left' },
  td: { padding: 2, borderBottom: '1px solid #F1F5F9' },
  celda: { width: '100%', minWidth: 110, padding: '7px 8px', border: '1px solid transparent', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: 'transparent', boxSizing: 'border-box', outlineColor: '#6D28D9' },
  x: { border: 'none', background: 'none', color: '#CBD5E1', cursor: 'pointer', fontSize: 13, padding: '2px 6px' },
  hoja: { border: '1px solid #E2E8F0', borderRadius: 8, padding: '28px 32px', background: '#FFFFFF', boxShadow: 'inset 0 0 0 6px #F8FAFC', maxHeight: 420, overflowY: 'auto', fontFamily: 'Helvetica, Arial, sans-serif', color: '#111' },
  valor: { borderRadius: 4, padding: '0 2px', fontWeight: 600 },
  hueco: { background: '#FEE2E2', color: '#B91C1C', borderRadius: 4, padding: '0 3px', fontWeight: 600 },
  desconocido: { background: '#FEF3C7', color: '#92400E', borderRadius: 4, padding: '0 2px' },
  mini: { display: 'flex', flexDirection: 'column', fontSize: 11, color: '#64748B', fontWeight: 600, gap: 2 },
  sel: { padding: '6px 8px', borderRadius: 7, border: '1px solid #CBD5E1', fontSize: 13, fontFamily: 'inherit' },
  descargas: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  grupo: { flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 6, padding: 12, border: '1px solid #E2E8F0', borderRadius: 10, background: '#FAFAFA' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 12 },
  modal: { background: 'white', borderRadius: 14, padding: 20, width: '100%', maxWidth: 560, boxSizing: 'border-box' },
};
