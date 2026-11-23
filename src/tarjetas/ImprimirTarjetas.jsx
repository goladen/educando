// 🖨️ Tarjetas de respuesta de PiKT (tipo Plickers) en PDF.
// Cada tarjeta: marcador ArUco 4×4 en el centro, letras A (arriba), B (derecha),
// C (abajo) y D (izquierda) escritas para leerse derechas cuando ese borde queda
// arriba, y el número de tarjeta (y el nombre del alumno, si se quiere) pequeño.
import React, { useMemo, useState } from 'react';
import { bitsTarjeta, MAX_TARJETAS } from './detectorTarjetas.js';
import { nombresGrupoActivo, grupoActivo } from '../utils/gruposDispositivo';

const LS_NOMBRES = 'pikt_tarjetas_nombres';
const leerNombres = () => { try { return JSON.parse(localStorage.getItem(LS_NOMBRES) || '{}') || {}; } catch { return {}; } };

// Tamaños: tarjetas por folio A4 (vertical) → rejilla
const TAMANOS = {
  1: { cols: 1, filas: 1, nombre: '1 por folio · se lee hasta el fondo de un aula grande' },
  2: { cols: 1, filas: 2, nombre: '2 por folio (recomendado) · aula normal' },
  4: { cols: 2, filas: 2, nombre: '4 por folio · grupos pequeños o cerca de la cámara' },
};

/** Tarjeta en SVG (vista previa en pantalla). */
export function TarjetaSVG({ n, nombre = '', size = 160 }) {
  const bits = bitsTarjeta(n);
  if (!bits) return null;
  // Lienzo de 100×100: marcador de 60 (10 por celda) centrado
  const m = 60, o = 20, c = m / 6;
  const letra = (txt, x, y, rot) => (
    <text x={x} y={y} transform={`rotate(${rot} ${x} ${y})`} textAnchor="middle" dominantBaseline="central" fontSize="11" fontWeight="900" fill="#0f172a" fontFamily="system-ui, sans-serif">{txt}</text>
  );
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ background: '#fff', borderRadius: 6, display: 'block' }}>
      <rect x={o} y={o} width={m} height={m} fill="#000" />
      {bits.flatMap((fila, y) => fila.map((b, x) => (b ? <rect key={`${x}-${y}`} x={o + c * (x + 1)} y={o + c * (y + 1)} width={c + 0.05} height={c + 0.05} fill="#fff" /> : null)))}
      {letra('A', 50, 10, 0)}
      {letra('B', 90, 50, 90)}
      {letra('C', 50, 90, 180)}
      {letra('D', 10, 50, -90)}
      <text x="3" y="6" fontSize="5" fontWeight="800" fill="#475569" fontFamily="system-ui, sans-serif">{n}{nombre ? ` · ${nombre.slice(0, 22)}` : ''}</text>
    </svg>
  );
}

export async function generarPdf({ desde, hasta, porFolio, nombres, conNombres, devolver = false }) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const W = 210, H = 297;
  const { cols, filas } = TAMANOS[porFolio];
  const cw = W / cols, ch = H / filas;
  const porPagina = cols * filas;
  const lista = [];
  for (let n = desde; n <= hasta; n++) lista.push(n);

  lista.forEach((n, i) => {
    if (i > 0 && i % porPagina === 0) pdf.addPage();
    const k = i % porPagina;
    const x0 = (k % cols) * cw, y0 = Math.floor(k / cols) * ch;
    const lado = Math.min(cw, ch);
    // Marcador: ~62 % del lado; el resto, margen blanco (necesario para leerlo) y letras
    const m = lado * 0.62;
    const mx = x0 + (cw - m) / 2, my = y0 + (ch - m) / 2;
    const c = m / 6;
    const bits = bitsTarjeta(n);

    // Tarjeta CUADRADA (se recorta por la línea): igual en las cuatro posiciones,
    // así girarla para B o D no se siente «de lado» y el código queda en el centro.
    const sx = x0 + (cw - lado) / 2 + 2, sy = y0 + (ch - lado) / 2 + 2, sl = lado - 4;
    pdf.setDrawColor(190);
    pdf.setLineWidth(0.25);
    pdf.setLineDashPattern([2, 2], 0);
    pdf.rect(sx, sy, sl, sl, 'S');
    pdf.setLineDashPattern([], 0);

    pdf.setFillColor(0, 0, 0);
    pdf.rect(mx, my, m, m, 'F');
    pdf.setFillColor(255, 255, 255);
    bits.forEach((fila, y) => fila.forEach((b, x) => { if (b) pdf.rect(mx + c * (x + 1), my + c * (y + 1), c, c, 'F'); }));

    // Letras: jsPDF gira en sentido antihorario con `angle`
    const fs = Math.max(18, lado * 0.16); // puntos
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(fs);
    pdf.setTextColor(30, 41, 59);
    const alto = fs * 0.3528 * 0.72; // altura de mayúscula en mm
    const hueco = (lado - m) / 4 - alto / 2;
    const cx = x0 + cw / 2, cy = y0 + ch / 2;
    const ancho = (t) => pdf.getTextWidth(t);
    // A arriba (derecha)
    pdf.text('A', cx - ancho('A') / 2, my - hueco);
    // B a la derecha, girada 90° en sentido horario (las patas hacia el marcador)
    pdf.text('B', mx + m + hueco, cy - ancho('B') / 2, { angle: -90 });
    // C abajo, boca abajo
    pdf.text('C', cx + ancho('C') / 2, my + m + hueco, { angle: 180 });
    // D a la izquierda, girada 90° en sentido antihorario
    pdf.text('D', mx - hueco, cy + ancho('D') / 2, { angle: 90 });

    // Número (y nombre) pequeño en la esquina
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(Math.max(9, lado * 0.05));
    pdf.setTextColor(71, 85, 105);
    const nombre = conNombres ? String(nombres[n] || '').trim() : '';
    pdf.text(`${n}${nombre ? ` · ${nombre.slice(0, 30)}` : ''}`, sx + 4, sy + 7);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(148, 163, 184);
    pdf.text('PiKT · pikt.es', sx + sl - 4, sy + sl - 3, { align: 'right' });
  });
  if (devolver) return pdf;
  pdf.save(`tarjetas-pikt-${desde}-${hasta}.pdf`);
  return null;
}

export default function ImprimirTarjetas({ onClose, numInicial }) {
  const nombresGuardados = useMemo(leerNombres, []);
  const grupo = grupoActivo();
  const alumnosGrupo = nombresGrupoActivo();
  const [desde, setDesde] = useState(1);
  const [hasta, setHasta] = useState(() => Math.min(MAX_TARJETAS, numInicial || alumnosGrupo.length || 30));
  const [porFolio, setPorFolio] = useState(2);
  const [conNombres, setConNombres] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState('');

  // Nombres: los asignados en el juego; si no hay, los del grupo en uso (tarjeta 1 = 1.er alumno)
  const nombres = useMemo(() => {
    const r = { ...nombresGuardados };
    alumnosGrupo.forEach((a, i) => { if (!r[i + 1]) r[i + 1] = a; });
    return r;
  }, [nombresGuardados, alumnosGrupo]);
  const hayNombres = Object.values(nombres).some(Boolean);

  const d = Math.max(1, Math.min(MAX_TARJETAS, desde));
  const h = Math.max(d, Math.min(MAX_TARJETAS, hasta));
  const folios = Math.ceil((h - d + 1) / porFolio);

  const descargar = async () => {
    setError('');
    setGenerando(true);
    try { await generarPdf({ desde: d, hasta: h, porFolio, nombres, conNombres }); } catch (e) { setError('No se pudo crear el PDF: ' + (e?.message || e)); }
    setGenerando(false);
  };

  return (
    <div style={st.fondo} onClick={onClose}>
      <div style={st.ventana} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ margin: 0, flex: 1, fontSize: 20 }}>🖨️ Tarjetas de respuesta</h2>
          {onClose && <button onClick={onClose} style={st.cerrar} aria-label="Cerrar">✕</button>}
        </div>
        <p style={st.ayuda}>
          Cada alumno tiene <b>su</b> tarjeta (siempre la misma: el número dice quién es). Para responder la levanta con la
          letra elegida <b>arriba</b>. Se imprimen una vez y sirven para todo el curso; si las plastificas, mejor.
          Imprime en blanco y negro y <b>recórtalas por la línea discontinua</b>: son cuadradas, así se sujetan igual en las cuatro posiciones. Que no se doblen y que los dedos no tapen el cuadro negro (cogedlas por el borde, junto a la letra de abajo).
        </p>

        <div style={st.previa}>
          {[d, Math.min(h, d + 1), Math.min(h, d + 2)].filter((n, i, a) => a.indexOf(n) === i).map((n) => (
            <div key={n} style={{ textAlign: 'center' }}>
              <TarjetaSVG n={n} nombre={conNombres ? nombres[n] : ''} size={130} />
            </div>
          ))}
        </div>

        <div style={st.fila}>
          <label style={st.label}>Desde la tarjeta
            <input type="number" min={1} max={MAX_TARJETAS} value={desde} onChange={(e) => setDesde(Number(e.target.value) || 1)} style={st.input} />
          </label>
          <label style={st.label}>hasta la
            <input type="number" min={1} max={MAX_TARJETAS} value={hasta} onChange={(e) => setHasta(Number(e.target.value) || 1)} style={st.input} />
          </label>
          <span style={st.ayuda}>Máximo {MAX_TARJETAS} tarjetas distintas.</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '10px 0' }}>
          {Object.entries(TAMANOS).map(([k, t]) => (
            <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 14 }}>
              <input type="radio" name="porFolio" checked={porFolio === Number(k)} onChange={() => setPorFolio(Number(k))} /> {t.nombre}
            </label>
          ))}
        </div>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: hayNombres ? 'pointer' : 'not-allowed', fontSize: 14, opacity: hayNombres ? 1 : 0.5 }}>
          <input type="checkbox" disabled={!hayNombres} checked={conNombres && hayNombres} onChange={(e) => setConNombres(e.target.checked)} />
          Escribir el nombre del alumno en su tarjeta
          {grupo && <span style={{ color: '#64748b' }}>(grupo «{grupo.nombre}»)</span>}
        </label>
        {!hayNombres && <p style={{ ...st.ayuda, marginTop: 4 }}>Para poner nombres, elige un grupo en «Mis grupos en este dispositivo» o escríbelos en la sala del juego.</p>}

        {error && <p style={{ color: '#dc2626', fontWeight: 700 }}>{error}</p>}
        <button onClick={descargar} disabled={generando} style={st.boton}>
          {generando ? 'Creando PDF…' : `📄 Descargar PDF (${h - d + 1} tarjetas · ${folios} ${folios === 1 ? 'folio' : 'folios'})`}
        </button>
      </div>
    </div>
  );
}

const st = {
  fondo: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.75)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  ventana: { background: '#fff', color: '#0f172a', borderRadius: 18, padding: 22, width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif' },
  cerrar: { border: 'none', background: '#f1f5f9', borderRadius: 10, width: 36, height: 36, fontSize: 16, cursor: 'pointer' },
  ayuda: { color: '#475569', fontSize: 13.5, lineHeight: 1.5, margin: '10px 0' },
  previa: { display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', background: '#e2e8f0', borderRadius: 12, padding: 12, margin: '6px 0 12px' },
  fila: { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#475569', fontWeight: 600 },
  input: { width: 90, padding: '7px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 15 },
  boton: { marginTop: 14, width: '100%', padding: '14px 18px', borderRadius: 12, border: 'none', background: '#6D28D9', color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer' },
};
