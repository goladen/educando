import React, { useState, useEffect, useMemo, useCallback } from 'react';
import SimuladorOAOA from './MatesOAOA';
import { db } from './firebase';
import { guardarRegistroLocal } from './utils/registrosLocales';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';

// ── Modal Enviar al profesor: recopilatorio de TODAS las actividades ─────────
function ModalEnviarProfeOAOA({ resumen, onClose }) {
  const [codigo,   setCodigo]   = useState('');
  const [nombre,   setNombre]   = useState('');
  const [curso,    setCurso]    = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado,  setEnviado]  = useState(false);
  const [error,    setError]    = useState('');

  const { bloques, monstruo, retos, restas, geoplano, estimaciones, precios, estrategias } = resumen;

  const media = (arr) => arr.length > 0 ? Math.round(arr.reduce((a, e) => a + e.nota, 0) / arr.length) : 0;
  const estNotaMedia = media(estimaciones);
  const preNotaMedia = media(precios);
  const estBuenas = estimaciones.filter(e => e.nota >= 70).length;
  const preBuenas = precios.filter(p => p.nota >= 70).length;
  const preTotales = precios.filter(p => p.acertoCompra).length;

  const totalAciertos = bloques.aciertosSumas + bloques.aciertosRestas
    + monstruo.combinaciones.length + retos.superados + restas.resueltas + geoplano.correctas
    + estBuenas + preBuenas + preTotales;
  const totalIntentos = bloques.intentosSumas + bloques.intentosRestas
    + monstruo.combinaciones.length + retos.superados + restas.intentos + geoplano.intentos
    + estimaciones.length + precios.length * 2;

  const enviar = async () => {
    const code = codigo.trim().toUpperCase();
    if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
    if (!code)          { setError('Escribe el código del profesor.'); return; }
    if (totalIntentos === 0 && estrategias.length === 0 && estimaciones.length === 0) {
      setError('Todavía no has jugado a ninguna actividad.'); return;
    }
    setEnviando(true); setError('');
    try {
      const snap = await getDoc(doc(db, 'codigos_profesor', code));
      if (!snap.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
      await addDoc(collection(db, 'informes_juegos'), {
        tipo: 'OAOA',
        modalidad: 'Individual',
        fecha: new Date(),
        codigoProfesor: code,
        jugadores: [{
          nombre: nombre.trim(),
          curso:  curso.trim(),
          aciertos: totalAciertos,
          intentos: totalIntentos,
          porcentaje: Math.round((totalAciertos / Math.max(1, totalIntentos)) * 100),
          // Compatibilidad con la tarjeta de informes existente
          sumas:  { aciertos: bloques.aciertosSumas,  intentos: bloques.intentosSumas  },
          restas: { aciertos: bloques.aciertosRestas, intentos: bloques.intentosRestas },
          // Recopilatorio del Método OAOA completo
          oaoa: {
            monstruo:   { combinaciones: monstruo.combinaciones, total: monstruo.combinaciones.length },
            retos:      { superados: retos.superados },
            restasReg:  { resueltas: restas.resueltas, intentos: restas.intentos },
            geoplano:   { correctas: geoplano.correctas, intentos: geoplano.intentos },
            estimacion: { realizadas: estimaciones.length, notaMedia: estNotaMedia, detalle: estimaciones },
            precios: { realizadas: precios.length, notaMedia: preNotaMedia, totalesAcertados: preTotales, detalle: precios },
            estrategias,
          },
        }],
      });
      guardarRegistroLocal('OAOA', {
        titulo: 'Método OAOA', aciertos: totalAciertos, intentos: totalIntentos,
        nombre: nombre.trim(), curso: curso.trim(), via: 'profesor',
      });
      setEnviado(true);
    } catch (e) { setError('Error al enviar: ' + e.message); }
    setEnviando(false);
  };

  const inp = {
    padding: '9px 12px', borderRadius: 9,
    border: '1.5px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.08)', color: 'white',
    fontSize: '0.9rem', outline: 'none', width: '100%',
    boxSizing: 'border-box', fontFamily: 'inherit',
  };

  const Fila = ({ icon, label, valor, color }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 9px', background: 'rgba(255,255,255,0.06)', borderRadius: 9 }}>
      <span style={{ fontSize: '0.95rem' }}>{icon}</span>
      <span style={{ flex: 1, fontSize: '0.78rem', color: '#bbb', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: '0.85rem', fontWeight: 900, color: color || 'white' }}>{valor}</span>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10050, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 12 }}>
      <div style={{ background: '#1e272e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, width: '100%', maxWidth: 400, maxHeight: '90vh', overflowY: 'auto', padding: '24px 26px', boxShadow: '0 30px 80px rgba(0,0,0,0.7)', color: 'white', fontFamily: "'Segoe UI', sans-serif", boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f1c40f' }}>📤 Enviar al profesor</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
        </div>

        {enviado ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: 10 }}>✅</div>
            <div style={{ color: '#2ecc71', fontWeight: 700, fontSize: '1.1rem' }}>¡Informe enviado!</div>
            <div style={{ marginTop: 8, color: '#aaa', fontSize: '0.88rem' }}>
              Recopilatorio de {totalAciertos} logros en {estrategias.length > 0 ? 'las actividades y tus estrategias escritas' : 'las actividades'}.
            </div>
            <button onClick={onClose} style={{ marginTop: 16, padding: '9px 22px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: 'white', fontFamily: 'inherit' }}>Cerrar</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: '0.72rem', color: '#7f8c8d', fontWeight: 900, letterSpacing: '0.05em' }}>RECOPILATORIO DE LA SESIÓN</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <Fila icon="🧮" label="Bloques D y U (sumas)"  valor={`${bloques.aciertosSumas}/${bloques.intentosSumas}`}   color="#FFB347" />
              <Fila icon="🧮" label="Bloques D y U (restas)"  valor={`${bloques.aciertosRestas}/${bloques.intentosRestas}`} color="#F48FB1" />
              <Fila icon="👾" label="Descomposiciones"        valor={monstruo.combinaciones.length} color="#A5B4FC" />
              <Fila icon="🎯" label="Retos de regletas"       valor={retos.superados} color="#7DD3FC" />
              <Fila icon="➖" label="Restas con regletas"     valor={`${restas.resueltas}/${restas.intentos}`} color="#6EE7B7" />
              <Fila icon="📐" label="Figuras del geoplano"    valor={`${geoplano.correctas}/${geoplano.intentos}`} color="#6EE7B7" />
              <Fila icon="📏" label="Estimar tamaños (nota media)" valor={estimaciones.length > 0 ? `${estNotaMedia}/100` : '—'} color="#F9A8D4" />
              <Fila icon="🛒" label="Estimar precios (nota media)" valor={precios.length > 0 ? `${preNotaMedia}/100` : '—'} color="#F9A8D4" />
              <Fila icon="🧮" label="Totales de compra acertados"  valor={precios.length > 0 ? `${preTotales}/${precios.length}` : '—'} color="#A5B4FC" />
              <Fila icon="💡" label="Estrategias escritas"    valor={estrategias.length} color="#FCD34D" />
            </div>

            {estrategias.length > 0 && (
              <div style={{ background: 'rgba(252,211,77,0.1)', border: '1px solid rgba(252,211,77,0.25)', borderRadius: 10, padding: '8px 10px', maxHeight: 110, overflowY: 'auto' }}>
                {estrategias.map((e, i) => (
                  <div key={`est-prev-${i}`} style={{ fontSize: '0.75rem', color: '#ddd', marginBottom: 4 }}>
                    <b style={{ color: '#FCD34D' }}>{e.expr}</b> — {e.texto}
                  </div>
                ))}
              </div>
            )}

            <div>
              <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>Nombre y apellido</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre completo" style={inp} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>Curso</label>
              <input value={curso} onChange={e => setCurso(e.target.value)} placeholder="Ej: 3º Primaria A" style={inp} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>Código del profesor</label>
              <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Ej: PROF01" maxLength={10}
                style={{ ...inp, letterSpacing: 2, fontWeight: 700 }} />
            </div>
            {error && <div style={{ color: '#e74c3c', fontSize: '0.8rem' }}>⚠ {error}</div>}
            <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer', color: 'white', fontFamily: 'inherit' }}>Cancelar</button>
              <button onClick={enviar} disabled={enviando} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: enviando ? '#555' : 'linear-gradient(135deg,#3498db,#2980b9)', color: 'white', fontWeight: 700, cursor: enviando ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                {enviando ? 'Enviando…' : '📤 Enviar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const CERO_BLOQUES = { aciertosSumas: 0, intentosSumas: 0, aciertosRestas: 0, intentosRestas: 0 };

// ── Siluetas de los objetos de estimación ───────────────────────────────────
// El viewBox de cada una son sus medidas reales (×10), así el dibujo conserva
// las proporciones de verdad al escalarlo.
const SILUETAS = {
  puerta: { vb: '0 0 8 20', draw: (
    <>
      <rect x="0.3" y="0.3" width="7.4" height="19.4" rx="0.5" fill="#B45309" />
      <rect x="1.3" y="1.5" width="5.4" height="7.2" rx="0.3" fill="#FFF" opacity="0.28" />
      <rect x="1.3" y="11.3" width="5.4" height="7.2" rx="0.3" fill="#FFF" opacity="0.28" />
      <circle cx="6.4" cy="10" r="0.5" fill="#FDE68A" />
    </>
  )},
  coche: { vb: '0 0 42 15', draw: (
    <>
      <path d="M1 12.5 L1 9.6 Q1 8.8 1.9 8.6 L9 7.3 Q13 3.2 20 3.2 L27 3.3 Q31 3.6 33.6 7.6 L40 8.8 Q41 9 41 9.9 L41 12.5 Z" fill="#2563EB" />
      <path d="M11.6 7.1 Q14.6 4.7 19.4 4.7 L19.4 7.1 Z" fill="#BFDBFE" />
      <path d="M21 4.8 L26.6 4.9 Q29.9 5.2 31.7 7.1 L21 7.1 Z" fill="#BFDBFE" />
      <circle cx="9.5" cy="12.5" r="2.5" fill="#1F2937" /><circle cx="9.5" cy="12.5" r="1" fill="#9CA3AF" />
      <circle cx="32" cy="12.5" r="2.5" fill="#1F2937" /><circle cx="32" cy="12.5" r="1" fill="#9CA3AF" />
    </>
  )},
  persona: { vb: '0 0 5 17', draw: (
    <>
      <circle cx="2.5" cy="2" r="1.8" fill="#C2410C" />
      <rect x="1.1" y="4.2" width="2.8" height="6.4" rx="1.2" fill="#0F766E" />
      <rect x="0" y="4.7" width="1.15" height="5" rx="0.55" fill="#0F766E" />
      <rect x="3.85" y="4.7" width="1.15" height="5" rx="0.55" fill="#0F766E" />
      <rect x="1.25" y="10.2" width="1.15" height="6.8" rx="0.5" fill="#1E3A8A" />
      <rect x="2.6" y="10.2" width="1.15" height="6.8" rx="0.5" fill="#1E3A8A" />
    </>
  )},
  jirafa: { vb: '0 0 25 55', draw: (
    <>
      <rect x="9" y="41" width="2.3" height="14" fill="#B45309" />
      <rect x="12.4" y="41" width="2.3" height="14" fill="#B45309" />
      <rect x="15.8" y="41" width="2.3" height="14" fill="#92400E" />
      <rect x="19.2" y="41" width="2.3" height="14" fill="#92400E" />
      <rect x="7.5" y="30" width="14" height="12.5" rx="4" fill="#D97706" />
      <rect x="14.3" y="7" width="5" height="25" rx="2.2" fill="#D97706" />
      <ellipse cx="18.6" cy="5.4" rx="3.6" ry="2.8" fill="#D97706" />
      <rect x="16.4" y="1.4" width="0.9" height="2.8" rx="0.4" fill="#92400E" />
      <rect x="19.3" y="1.4" width="0.9" height="2.8" rx="0.4" fill="#92400E" />
      <circle cx="20.3" cy="4.8" r="0.5" fill="#1F2937" />
      <circle cx="11" cy="33.5" r="1.9" fill="#92400E" /><circle cx="16.5" cy="36.5" r="1.7" fill="#92400E" />
      <circle cx="19.5" cy="32.5" r="1.4" fill="#92400E" /><circle cx="16" cy="13" r="1.2" fill="#92400E" />
      <circle cx="17" cy="21" r="1.2" fill="#92400E" />
    </>
  )},
  autobus: { vb: '0 0 120 32', draw: (
    <>
      <rect x="1" y="2" width="118" height="25.5" rx="4" fill="#DC2626" />
      <rect x="6" y="6" width="20" height="10" rx="1.5" fill="#BFDBFE" />
      <rect x="30" y="6" width="20" height="10" rx="1.5" fill="#BFDBFE" />
      <rect x="54" y="6" width="20" height="10" rx="1.5" fill="#BFDBFE" />
      <rect x="78" y="6" width="20" height="10" rx="1.5" fill="#BFDBFE" />
      <rect x="102" y="6" width="12" height="10" rx="1.5" fill="#BFDBFE" />
      <circle cx="26" cy="27" r="4.8" fill="#1F2937" /><circle cx="26" cy="27" r="1.9" fill="#9CA3AF" />
      <circle cx="96" cy="27" r="4.8" fill="#1F2937" /><circle cx="96" cy="27" r="1.9" fill="#9CA3AF" />
    </>
  )},
  lapiz: { vb: '0 0 170 8', draw: (
    <>
      <rect x="0" y="0.6" width="13" height="6.8" rx="1.2" fill="#F472B6" />
      <rect x="13" y="0.6" width="6" height="6.8" fill="#9CA3AF" />
      <rect x="19" y="0.6" width="119" height="6.8" fill="#F59E0B" />
      <polygon points="138,0.6 163,4 138,7.4" fill="#FCD9A0" />
      <polygon points="163,4 170,4 163,4" fill="#374151" />
      <polygon points="160,2.2 170,4 160,5.8" fill="#374151" />
    </>
  )},
  platano: { vb: '0 0 200 40', draw: (
    <>
      <path d="M10 6 Q16 28 62 34 Q142 39 188 15 Q194 11 190 7 Q185 4 181 8 Q140 28 68 24 Q28 20 20 5 Q17 1 13 2 Q8 3 10 6 Z" fill="#FACC15" />
      <path d="M181 8 Q186 5 190 7 L193 11 Q189 8 184 10 Z" fill="#65A30D" />
      <path d="M20 5 Q17 1 13 2 L11 5 Q15 3 18 7 Z" fill="#A16207" />
    </>
  )},
  movil: { vb: '0 0 70 150', draw: (
    <>
      <rect x="2" y="2" width="66" height="146" rx="10" fill="#1F2937" />
      <rect x="6.5" y="11" width="57" height="120" rx="3" fill="#7DD3FC" />
      <rect x="28" y="5.5" width="14" height="2.2" rx="1.1" fill="#4B5563" />
      <circle cx="35" cy="139.5" r="4.5" fill="#4B5563" />
    </>
  )},
  libro: { vb: '0 0 170 240', draw: (
    <>
      <rect x="4" y="4" width="162" height="232" rx="6" fill="#B91C1C" />
      <rect x="4" y="4" width="20" height="232" rx="3" fill="#7F1D1D" />
      <rect x="40" y="44" width="100" height="11" rx="5" fill="#FEF3C7" />
      <rect x="40" y="68" width="72" height="8" rx="4" fill="#FCA5A5" />
      <rect x="40" y="186" width="52" height="8" rx="4" fill="#FCA5A5" />
      <rect x="160" y="10" width="6" height="220" rx="3" fill="#FEF3C7" />
    </>
  )},
  guitarra: { vb: '0 0 37 100', draw: (
    <>
      <rect x="14" y="2.5" width="9" height="44" rx="1.5" fill="#78350F" />
      <rect x="13" y="0" width="11" height="7" rx="2" fill="#451A03" />
      <ellipse cx="18.5" cy="59" rx="12.5" ry="11" fill="#D97706" />
      <ellipse cx="18.5" cy="84" rx="16" ry="15.5" fill="#D97706" />
      <circle cx="18.5" cy="65" r="4.6" fill="#451A03" />
      <rect x="12" y="78" width="13" height="2.6" rx="1" fill="#451A03" />
    </>
  )},
  arbol: { vb: '0 0 60 100', draw: (
    <>
      <rect x="25" y="56" width="10" height="44" rx="1.5" fill="#78350F" />
      <circle cx="30" cy="27" r="25" fill="#16A34A" />
      <circle cx="14" cy="46" r="14" fill="#15803D" />
      <circle cx="46" cy="46" r="14" fill="#15803D" />
      <circle cx="30" cy="48" r="16" fill="#22C55E" />
    </>
  )},
  casa: { vb: '0 0 90 70', draw: (
    <>
      <polygon points="45,2 88,31 2,31" fill="#B91C1C" />
      <rect x="9" y="31" width="72" height="39" fill="#FCD9A0" />
      <rect x="38" y="47" width="16" height="23" rx="1" fill="#78350F" />
      <rect x="17" y="38" width="14" height="14" rx="1" fill="#7DD3FC" />
      <rect x="59" y="38" width="14" height="14" rx="1" fill="#7DD3FC" />
      <rect x="64" y="10" width="8" height="14" fill="#991B1B" />
    </>
  )},
  elefante: { vb: '0 0 60 30', draw: (
    <>
      <rect x="16" y="20" width="6.5" height="10" rx="1" fill="#6B7280" />
      <rect x="26" y="20" width="6.5" height="10" rx="1" fill="#6B7280" />
      <rect x="38" y="20" width="6.5" height="10" rx="1" fill="#9CA3AF" />
      <rect x="46" y="20" width="6.5" height="10" rx="1" fill="#9CA3AF" />
      <ellipse cx="32" cy="13" rx="21" ry="10" fill="#9CA3AF" />
      <circle cx="12" cy="12" r="9" fill="#9CA3AF" />
      <ellipse cx="16" cy="9.5" rx="6" ry="7.5" fill="#6B7280" />
      <path d="M5.5 15 Q1.5 21 3 28 Q4 30 6 29 Q4.5 22 8.5 18 Z" fill="#9CA3AF" />
      <circle cx="8.5" cy="9.5" r="0.9" fill="#1F2937" />
    </>
  )},
  caballo: { vb: '0 0 22 16', draw: (
    <>
      <rect x="4.6" y="9.5" width="1.9" height="6.5" rx="0.7" fill="#78350F" />
      <rect x="8.4" y="9.5" width="1.9" height="6.5" rx="0.7" fill="#78350F" />
      <rect x="12.6" y="9.5" width="1.9" height="6.5" rx="0.7" fill="#92400E" />
      <rect x="15.8" y="9.5" width="1.9" height="6.5" rx="0.7" fill="#92400E" />
      <ellipse cx="11" cy="7.5" rx="8" ry="4" fill="#92400E" />
      <path d="M15.5 5.5 Q17.5 2 19.6 0.9 Q21.2 0.4 21 2.2 L20.4 5.8 Q20 7.4 17.6 7.8 Z" fill="#92400E" />
      <path d="M17 2.6 Q19 1.4 20.4 1.2" stroke="#451A03" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <path d="M3.2 5.2 Q0.4 7.4 1.6 11.4" stroke="#451A03" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx="19.6" cy="3.4" r="0.5" fill="#1F2937" />
    </>
  )},
  balon: { vb: '0 0 22 22', draw: (
    <>
      <circle cx="11" cy="11" r="10.4" fill="#FFFFFF" stroke="#1F2937" strokeWidth="0.7" />
      <polygon points="11,6.2 14.6,8.8 13.2,13.1 8.8,13.1 7.4,8.8" fill="#1F2937" />
      <polygon points="11,0.9 14.3,3.2 11,5.2 7.7,3.2" fill="#1F2937" />
      <polygon points="1.2,9.4 5.6,8.1 6.4,12 3.1,14.3" fill="#1F2937" />
      <polygon points="20.8,9.4 18.9,14.3 15.6,12 16.4,8.1" fill="#1F2937" />
      <polygon points="7.6,20.4 8.9,15.9 13.1,15.9 14.4,20.4" fill="#1F2937" />
    </>
  )},
  sandia: { vb: '0 0 30 22', draw: (
    <>
      <ellipse cx="15" cy="11" rx="14.5" ry="10.5" fill="#16A34A" />
      <path d="M4 5.4 Q8 11 4 16.6" stroke="#064E3B" strokeWidth="1.3" fill="none" />
      <path d="M11.5 1.3 Q15.5 11 11.5 20.7" stroke="#064E3B" strokeWidth="1.3" fill="none" />
      <path d="M20.5 1.5 Q24.5 11 20.5 20.5" stroke="#064E3B" strokeWidth="1.3" fill="none" />
      <path d="M27 5.6 Q29 11 27 16.4" stroke="#064E3B" strokeWidth="1.3" fill="none" />
    </>
  )},
  camion: { vb: '0 0 80 35', draw: (
    <>
      <rect x="1.5" y="3" width="44" height="25" rx="2" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="0.8" />
      <path d="M45.5 11 L58 11 Q62.5 11 64.5 15 L70 21 Q70.5 21.6 70.5 22.6 L70.5 28 L45.5 28 Z" fill="#E11D48" />
      <rect x="58.5" y="13.5" width="8" height="6" rx="1" fill="#BFDBFE" />
      <circle cx="14" cy="29" r="5.8" fill="#1F2937" /><circle cx="14" cy="29" r="2.3" fill="#9CA3AF" />
      <circle cx="34" cy="29" r="5.8" fill="#1F2937" /><circle cx="34" cy="29" r="2.3" fill="#9CA3AF" />
      <circle cx="61" cy="29" r="5.8" fill="#1F2937" /><circle cx="61" cy="29" r="2.3" fill="#9CA3AF" />
    </>
  )},
  // ── Artículos de compra (modo precios) ──────────────────────────────────
  pan: { vb: '0 0 100 42', draw: (
    <>
      <path d="M5 29 Q2 17 13 12 L80 3 Q97 1 98 12 Q99 24 87 28 L20 40 Q7 41 5 29 Z" fill="#D97706" />
      <path d="M22 24 L31 14" stroke="#92400E" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M39 21 L48 11" stroke="#92400E" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M56 18 L65 8" stroke="#92400E" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M73 15 L82 6" stroke="#92400E" strokeWidth="3.4" strokeLinecap="round" />
    </>
  )},
  agua: { vb: '0 0 40 100', draw: (
    <>
      <rect x="14.5" y="1" width="11" height="9" rx="2" fill="#1D4ED8" />
      <path d="M16 10 L24 10 L24 21 Q34 26 34 40 L34 91 Q34 97 27.5 97 L12.5 97 Q6 97 6 91 L6 40 Q6 26 16 21 Z" fill="#BAE6FD" stroke="#7DD3FC" strokeWidth="1.2" />
      <rect x="6" y="50" width="28" height="20" fill="#0EA5E9" />
      <rect x="10" y="56" width="20" height="3" rx="1.5" fill="#FFF" opacity="0.8" />
      <rect x="10" y="62" width="13" height="3" rx="1.5" fill="#FFF" opacity="0.6" />
    </>
  )},
  boli: { vb: '0 0 16 100', draw: (
    <>
      <rect x="4.5" y="0" width="7" height="9" rx="3" fill="#1F2937" />
      <rect x="2" y="9" width="12" height="63" rx="2" fill="#2563EB" />
      <rect x="12" y="17" width="3" height="19" rx="1.5" fill="#1F2937" />
      <polygon points="2,72 14,72 9.6,92 6.4,92" fill="#1E40AF" />
      <rect x="7.4" y="92" width="1.8" height="8" fill="#1F2937" />
    </>
  )},
  huevos: { vb: '0 0 100 56', draw: (
    <>
      <ellipse cx="20" cy="22" rx="12.5" ry="15" fill="#FDE68A" />
      <ellipse cx="50" cy="20" rx="12.5" ry="15" fill="#FEF3C7" />
      <ellipse cx="80" cy="22" rx="12.5" ry="15" fill="#FDE68A" />
      <path d="M2 30 Q2 24 8 24 L92 24 Q98 24 98 30 L98 48 Q98 54 92 54 L8 54 Q2 54 2 48 Z" fill="#D1D5DB" stroke="#9CA3AF" strokeWidth="1.2" />
      <path d="M2 34 L98 34" stroke="#9CA3AF" strokeWidth="1.2" />
    </>
  )},
  bocadillo: { vb: '0 0 100 50', draw: (
    <>
      <path d="M5 35 Q2 21 15 16 L83 5 Q98 4 98 16 Q98 27 85 31 L19 46 Q7 47 5 35 Z" fill="#F59E0B" />
      <path d="M13 32 L88 19" stroke="#DC2626" strokeWidth="6.5" strokeLinecap="round" />
      <path d="M15 37 L86 24" stroke="#65A30D" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M14 27 L87 14" stroke="#FDE68A" strokeWidth="3.5" strokeLinecap="round" opacity="0.9" />
    </>
  )},
  entrada: { vb: '0 0 100 50', draw: (
    <>
      <path d="M2 6 Q2 2 6 2 L94 2 Q98 2 98 6 L98 18 Q91 18 91 25 Q91 32 98 32 L98 44 Q98 48 94 48 L6 48 Q2 48 2 44 L2 32 Q9 32 9 25 Q9 18 2 18 Z" fill="#7C3AED" />
      <circle cx="26" cy="25" r="11.5" fill="#FFFFFF" opacity="0.9" />
      <polygon points="22,18.5 33.5,25 22,31.5" fill="#7C3AED" />
      <rect x="48" y="15" width="38" height="5" rx="2.5" fill="#FFFFFF" opacity="0.75" />
      <rect x="48" y="27" width="26" height="5" rx="2.5" fill="#FFFFFF" opacity="0.5" />
    </>
  )},
  camiseta: { vb: '0 0 100 90', draw: (
    <>
      <path d="M34 4 L42 4 Q50 13 58 4 L66 4 L94 18 L86 35 L74 30 L74 85 Q74 88 71 88 L29 88 Q26 88 26 85 L26 30 L14 35 L6 18 Z" fill="#0EA5E9" />
      <path d="M42 4 Q50 15 58 4" fill="none" stroke="#0369A1" strokeWidth="2.8" />
      <rect x="40" y="44" width="20" height="20" rx="3" fill="#FFFFFF" opacity="0.55" />
    </>
  )},
  leche: { vb: '0 0 50 90', draw: (
    <>
      <polygon points="8,15 25,4 42,15 42,86 8,86" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="1.2" />
      <polygon points="8,15 25,4 42,15 25,22" fill="#E2E8F0" />
      <rect x="20.5" y="0" width="9" height="6" rx="2" fill="#1D4ED8" />
      <rect x="8" y="38" width="34" height="26" fill="#2563EB" />
      <rect x="13" y="45" width="24" height="4" rx="2" fill="#FFFFFF" />
      <rect x="13" y="53" width="15" height="4" rx="2" fill="#FFFFFF" opacity="0.7" />
    </>
  )},
  galletas: { vb: '0 0 80 56', draw: (
    <>
      <path d="M6 9 L2 2 L10 4 L15 0 L21 4 L27 0 L33 4 L39 0 L45 4 L51 0 L57 4 L63 0 L69 4 L74 2 L74 9 Z" fill="#92400E" />
      <rect x="6" y="8" width="68" height="44" rx="4" fill="#B45309" />
      <circle cx="26" cy="30" r="10" fill="#F59E0B" />
      <circle cx="49" cy="30" r="10" fill="#F59E0B" />
      <circle cx="23" cy="27" r="1.7" fill="#78350F" /><circle cx="29" cy="33" r="1.7" fill="#78350F" />
      <circle cx="46" cy="33" r="1.7" fill="#78350F" /><circle cx="52" cy="27" r="1.7" fill="#78350F" />
    </>
  )},
  helado: { vb: '0 0 46 90', draw: (
    <>
      <circle cx="23" cy="20" r="14" fill="#F9A8D4" />
      <circle cx="13" cy="29" r="10" fill="#FBCFE8" />
      <circle cx="33" cy="29" r="10" fill="#F472B6" />
      <polygon points="6,37 40,37 23,88" fill="#D97706" />
      <path d="M11 45 L33 58 M15 55 L29 46" stroke="#92400E" strokeWidth="1.5" />
    </>
  )},
  manzana: { vb: '0 0 60 64', draw: (
    <>
      <path d="M30 16 Q33 7 41 4" stroke="#78350F" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M32 13 Q44 4 53 10 Q45 19 34 16 Z" fill="#16A34A" />
      <path d="M30 17 Q14 13 6 27 Q0 43 13 57 Q22 64 30 56 Q38 64 47 57 Q60 43 54 27 Q46 13 30 17 Z" fill="#DC2626" />
      <ellipse cx="17" cy="31" rx="4.5" ry="8" fill="#FCA5A5" opacity="0.5" transform="rotate(-22 17 31)" />
    </>
  )},
  cuaderno: { vb: '0 0 70 90', draw: (
    <>
      <rect x="9" y="4" width="57" height="82" rx="3" fill="#0EA5E9" />
      <rect x="18" y="22" width="38" height="5" rx="2.5" fill="#FFFFFF" opacity="0.85" />
      <rect x="18" y="35" width="27" height="4" rx="2" fill="#FFFFFF" opacity="0.55" />
      <rect x="18" y="46" width="32" height="4" rx="2" fill="#FFFFFF" opacity="0.4" />
      {[0, 1, 2, 3, 4, 5, 6].map(i => (
        <ellipse key={`esp-${i}`} cx="9" cy={12 + i * 11} rx="7" ry="3.4" fill="none" stroke="#94A3B8" strokeWidth="2.4" />
      ))}
    </>
  )},
  calcetines: { vb: '0 0 80 70', draw: (
    <>
      <path d="M6 4 L22 4 L22 40 Q22 50 32 50 L40 50 Q47 50 47 58 Q47 66 40 66 L26 66 Q6 66 6 46 Z" fill="#F472B6" />
      <path d="M34 4 L50 4 L50 40 Q50 50 60 50 L68 50 Q75 50 75 58 Q75 66 68 66 L54 66 Q34 66 34 46 Z" fill="#DB2777" />
      <rect x="6" y="4" width="16" height="7" fill="#BE185D" />
      <rect x="34" y="4" width="16" height="7" fill="#9D174D" />
    </>
  )},
  cepillo: { vb: '0 0 100 20', draw: (
    <>
      <rect x="2" y="9" width="72" height="6" rx="3" fill="#0EA5E9" />
      <rect x="69" y="7.5" width="29" height="9" rx="4.5" fill="#0284C7" />
      {[0, 1, 2, 3, 4, 5].map(i => (
        <rect key={`cer-${i}`} x={72 + i * 4.3} y="1" width="3" height="7" rx="1.2" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="0.4" />
      ))}
    </>
  )},
  champu: { vb: '0 0 44 90', draw: (
    <>
      <rect x="16" y="1" width="12" height="8" rx="2" fill="#6D28D9" />
      <path d="M14 9 L30 9 Q38 14 38 26 L38 82 Q38 88 32 88 L12 88 Q6 88 6 82 L6 26 Q6 14 14 9 Z" fill="#A78BFA" />
      <rect x="6" y="40" width="32" height="26" fill="#FFFFFF" opacity="0.9" />
      <rect x="11" y="47" width="22" height="4" rx="2" fill="#6D28D9" />
      <rect x="11" y="55" width="14" height="3" rx="1.5" fill="#A78BFA" />
    </>
  )},
  mochila: { vb: '0 0 70 90', draw: (
    <>
      <path d="M20 32 Q20 11 35 11 Q50 11 50 32" fill="none" stroke="#991B1B" strokeWidth="4.5" />
      <rect x="7" y="26" width="56" height="60" rx="11" fill="#DC2626" />
      <path d="M7 34 Q35 22 63 34 L63 52 Q35 42 7 52 Z" fill="#B91C1C" />
      <rect x="30" y="46" width="10" height="7" rx="2" fill="#FDE68A" />
      <rect x="20" y="60" width="30" height="18" rx="4" fill="#F87171" />
      <rect x="31" y="66" width="8" height="4" rx="2" fill="#FEE2E2" />
    </>
  )},
  barca: { vb: '0 0 35 12', draw: (
    <>
      <rect x="16.3" y="0.5" width="1.3" height="6" fill="#78350F" />
      <path d="M18.2 1 L26 5.6 L18.2 5.6 Z" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="0.3" />
      <path d="M15.4 1.6 L9.5 5.6 L15.4 5.6 Z" fill="#EF4444" />
      <path d="M1 6.2 L34 6.2 L29.4 11.4 Q29 12 28.2 12 L6.8 12 Q6 12 5.6 11.4 Z" fill="#1D4ED8" />
    </>
  )}
};

// Estimación de tamaños: la referencia siempre se dibuja a EST_REF_PX píxeles
const EST_REF_PX = 70;
const EST_MIN_PX = 15;
const EST_MAX_PX = 260;

// Estimación de precios: el deslizador recorre 0,20 € – 40 € en escala
// logarítmica, para que los artículos baratos y los caros se ajusten igual de bien.
const precioATexto = p => p.toFixed(2).replace('.', ',') + ' €';

const barajar = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Pregunta de compra: cuántos artículos (2-9) y las cuatro opciones redondeadas.
const generarCompra = (precio) => {
  // Se prefiere una cantidad cuyo total NO sea un número redondo de euros: si
  // sale exacto, la palabra "aprox." sobra y el ejercicio pierde la gracia.
  const conDecimal = [], redondos = [];
  for (let n = 2; n <= 9; n++) {
    const t = n * precio;
    if (Math.round(t) < 3) continue;
    (Math.abs(t - Math.round(t)) > 0.005 ? conDecimal : redondos).push(n);
  }
  const lista = conDecimal.length ? conDecimal : (redondos.length ? redondos : [9]);
  const n = lista[Math.floor(Math.random() * lista.length)];
  const correcta = Math.max(3, Math.round(n * precio));

  // Se sortea cuántos distractores van por debajo (0-3) ANTES de elegirlos: si
  // no, la correcta acaba casi siempre en la misma posición al ordenarlas.
  const objetivoBajos = Math.floor(Math.random() * 4);
  const vals = [correcta];
  const add = v => {
    const x = Math.round(v);
    if (x >= 1 && !vals.includes(x)) { vals.push(x); return true; }
    return false;
  };
  let bajos = 0;
  barajar([0.4, 0.5, 0.6, 0.75]).forEach(m => { if (bajos < objetivoBajos && add(correcta * m)) bajos++; });
  for (let d = 1; bajos < objetivoBajos && correcta - d >= 1; d++) if (add(correcta - d)) bajos++;
  barajar([1.25, 1.5, 2, 2.5, 3]).forEach(m => { if (vals.length < 4) add(correcta * m); });
  let extra = correcta + 2;
  while (vals.length < 4) { add(extra); extra++; }

  return { n, correcta, opciones: barajar(vals.slice(0, 4)) };
};

// Nota 0-100 comparando el tamaño elegido con el correcto.
// Escala logarítmica: la mitad (÷2) y el doble (×2) dan 0 por igual.
const notaEstimacion = (elegido, correcto) => {
  if (!correcto || elegido <= 0) return 0;
  const desvio = Math.abs(Math.log2(elegido / correcto)); // 0 = exacto, 1 = mitad o doble
  return Math.max(0, Math.round(100 * (1 - desvio)));
};

export default function MetodoOAOA({ onExit }) {
  const RODS = [
    { v: 1, c: '#FFFFFF', border: '#CBD5E1', t: '#1E293B', name: 'Blanca' },
    { v: 2, c: '#EF4444', border: '#DC2626', t: '#FFFFFF', name: 'Roja' },
    { v: 3, c: '#86EFAC', border: '#4ADE80', t: '#064E3B', name: 'Verde C.' },
    { v: 4, c: '#F472B6', border: '#EC4899', t: '#831843', name: 'Rosa' },
    { v: 5, c: '#FACC15', border: '#EAB308', t: '#713F12', name: 'Amarilla' },
    { v: 6, c: '#16A34A', border: '#15803D', t: '#FFFFFF', name: 'Verde O.' },
    { v: 7, c: '#1F2937', border: '#111827', t: '#F9FAFB', name: 'Negra' },
    { v: 8, c: '#92400E', border: '#78350F', t: '#FFFFFF', name: 'Marrón' },
    { v: 9, c: '#2563EB', border: '#1D4ED8', t: '#FFFFFF', name: 'Azul' },
    { v: 10, c: '#EA580C', border: '#C2410C', t: '#FFFFFF', name: 'Naranja' }
  ];

  const playAudio = (type) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      if (type === 'eat') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'success') {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.07);
          gain.gain.setValueAtTime(0.15, now + i * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.07);
          osc.stop(now + i * 0.07 + 0.25);
        });
      } else if (type === 'wrong') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(130, now);
        osc.frequency.setValueAtTime(95, now + 0.08);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    } catch (e) {}
  };

  const distSq = (p1, p2) => (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;

  // ── Geometría del geoplano (coordenadas enteras, 1 unidad = 1 separación) ──
  // Área por la fórmula del zapatero (exacta en una retícula de puntos)
  const polyArea = (pegs) => {
    let s = 0;
    for (let i = 0; i < pegs.length; i++) {
      const p = pegs[i], q = pegs[(i + 1) % pegs.length];
      s += p.x * q.y - q.x * p.y;
    }
    return Math.abs(s) / 2;
  };

  const polyPerimeter = (pegs) => {
    let s = 0;
    for (let i = 0; i < pegs.length; i++) {
      const p = pegs[i], q = pegs[(i + 1) % pegs.length];
      s += Math.hypot(q.x - p.x, q.y - p.y);
    }
    return s;
  };

  // Todos los lados horizontales o verticales (perímetro en unidades enteras)
  const isRectilinear = (pegs) => pegs.every((p, i) => {
    const q = pegs[(i + 1) % pegs.length];
    return (p.x === q.x) !== (p.y === q.y);
  });

  const orient = (a, b, c) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  const onSeg  = (a, b, c) => // c colineal con ab, ¿está dentro del segmento?
    Math.min(a.x, b.x) <= c.x && c.x <= Math.max(a.x, b.x) &&
    Math.min(a.y, b.y) <= c.y && c.y <= Math.max(a.y, b.y);

  const segsCruzan = (a, b, c, d) => {
    const o1 = orient(a, b, c), o2 = orient(a, b, d);
    const o3 = orient(c, d, a), o4 = orient(c, d, b);
    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && onSeg(a, b, c)) return true;
    if (o2 === 0 && onSeg(a, b, d)) return true;
    if (o3 === 0 && onSeg(c, d, a)) return true;
    if (o4 === 0 && onSeg(c, d, b)) return true;
    return false;
  };

  // Polígono simple: sin lados que se crucen ni vértices repetidos.
  // Sin esto un "lazo" daría áreas y perímetros falsos.
  const isSimplePolygon = (pegs) => {
    const n = pegs.length;
    if (n < 3) return false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (pegs[i].x === pegs[j].x && pegs[i].y === pegs[j].y) return false;
      }
    }
    for (let i = 0; i < n; i++) {
      const a = pegs[i], b = pegs[(i + 1) % n];
      for (let j = i + 1; j < n; j++) {
        // Los lados contiguos comparten un vértice: no se comprueban
        if (j === i || (j + 1) % n === i || j === (i + 1) % n) continue;
        const c = pegs[j], d = pegs[(j + 1) % n];
        if (segsCruzan(a, b, c, d)) return false;
      }
    }
    return true;
  };

  const validateShape = (pegs, ch) => {
    if (!ch) return false;
    const { type: shapeType, req: targetCount, valor } = ch;
    const n = pegs.length;
    if (targetCount && n !== targetCount) return false;
    if (ch.minVertices && n < ch.minVertices) return false;

    if (shapeType === 'perimeter') {
      if (!isSimplePolygon(pegs)) return false;
      if (!isRectilinear(pegs)) return false;   // si no, el perímetro no sería entero
      return polyPerimeter(pegs) === valor;
    }

    if (shapeType === 'area') {
      if (!isSimplePolygon(pegs)) return false;
      return polyArea(pegs) === valor;
    }

    if (shapeType === 'triangle') {
      if (n !== 3) return false;
      const area = Math.abs(
        pegs[0].x * (pegs[1].y - pegs[2].y) +
        pegs[1].x * (pegs[2].y - pegs[0].y) +
        pegs[2].x * (pegs[0].y - pegs[1].y)
      );
      return area > 0;
    }

    if (n === 4) {
      const d1 = distSq(pegs[0], pegs[1]);
      const d2 = distSq(pegs[1], pegs[2]);
      const d3 = distSq(pegs[2], pegs[3]);
      const d4 = distSq(pegs[3], pegs[0]);
      const diag1 = distSq(pegs[0], pegs[2]);
      const diag2 = distSq(pegs[1], pegs[3]);

      const isParallelogram = d1 > 0 && d2 > 0 && d1 === d3 && d2 === d4;
      const isRect = isParallelogram && diag1 === diag2;
      const isSquare = isRect && d1 === d2;

      if (shapeType === 'square') return isSquare;
      if (shapeType === 'rectangle') return isRect && !isSquare;
      // Cuadrilátero cualquiera: se exige que NO sea cuadrado ni rectángulo
      if (shapeType === 'quadrilateral') return isSimplePolygon(pegs) && !isRect;
    }

    if (shapeType === 'polygon') return n === targetCount && isSimplePolygon(pegs);
    return false;
  };

  const [view, setView] = useState('menu');
  const [metrics, setMetrics] = useState({
    sandboxInteractions: 0,
    challengesSolved: 0,
    subtractionsSolved: 0,
    subtractionsTried: 0,
    geoplanoShapes: 0,
    geoplanoTried: 0,
    combinationsDiscovered: [],
    estimaciones: [],  // { objeto, nota }
    precios: []        // { articulo, nota, acertoCompra }
  });

  // Estrategias escritas en "Caminos Flexibles": { expr, texto }
  const [estrategias, setEstrategias] = useState([]);
  // Resultados del juego de Bloques D y U (los reporta SimuladorOAOA).
  // "base" acumula las visitas anteriores, "actual" es la partida en curso:
  // al salir de la vista el componente se desmonta y sus contadores vuelven a 0.
  const [bloquesBase,   setBloquesBase]   = useState(CERO_BLOQUES);
  const [bloquesActual, setBloquesActual] = useState(CERO_BLOQUES);
  const [mostrarEnvio, setMostrarEnvio] = useState(false);
  const recibirBloques = useCallback(stats => setBloquesActual(stats), []);
  const abrirEnvio     = useCallback(() => setMostrarEnvio(true), []);

  useEffect(() => {
    if (view === 'bloques') return;
    if (bloquesActual.intentosSumas === 0 && bloquesActual.intentosRestas === 0) return;
    setBloquesBase(b => ({
      aciertosSumas:  b.aciertosSumas  + bloquesActual.aciertosSumas,
      intentosSumas:  b.intentosSumas  + bloquesActual.intentosSumas,
      aciertosRestas: b.aciertosRestas + bloquesActual.aciertosRestas,
      intentosRestas: b.intentosRestas + bloquesActual.intentosRestas,
    }));
    setBloquesActual(CERO_BLOQUES);
  }, [view, bloquesActual]);

  const bloquesStats = {
    aciertosSumas:  bloquesBase.aciertosSumas  + bloquesActual.aciertosSumas,
    intentosSumas:  bloquesBase.intentosSumas  + bloquesActual.intentosSumas,
    aciertosRestas: bloquesBase.aciertosRestas + bloquesActual.aciertosRestas,
    intentosRestas: bloquesBase.intentosRestas + bloquesActual.intentosRestas,
  };

  const [sandboxMode, setSandboxMode] = useState('free');
  const [board, setBoard] = useState([]);
  const [sandboxChallengeIdx, setSandboxChallengeIdx] = useState(0);
  const [subtractionIdx, setSubtractionIdx] = useState(0);
  const [userDiffRod, setUserDiffRod] = useState(null);
  const [subtractionSolved, setSubtractionSolved] = useState(false);

  const [factoryIdx, setFactoryIdx] = useState(0);
  const [factoryOp, setFactoryOp] = useState('suma'); // 'suma' | 'multi'
  const [factoryHistory, setFactoryHistory] = useState([]);
  const [monsterEating, setMonsterEating] = useState(false);

  const [estModo, setEstModo] = useState('tamano'); // 'tamano' | 'precio'
  const [estIdx,  setEstIdx]  = useState(0);
  const [estTam,  setEstTam]  = useState(EST_REF_PX);
  const [estNota, setEstNota] = useState(null); // null mientras no se ha comprobado

  // Modo precios: fase 1 estimar el precio, fase 2 el total de varios artículos
  const [preIdx,     setPreIdx]     = useState(0);
  const [preT,       setPreT]       = useState(null);  // índice en escalaPrecios (null = sin tocar)
  const [preNota,    setPreNota]    = useState(null);
  const [preCompra,  setPreCompra]  = useState(null); // { n, correcta, opciones }
  const [preElegida, setPreElegida] = useState(null);

  const [pathsIdx, setPathsIdx] = useState(0);
  const [pathsTexto, setPathsTexto] = useState('');
  const [pathsGuardado, setPathsGuardado] = useState(false);

  const [geoPegs, setGeoPegs] = useState([]);
  const [geoClosed, setGeoClosed] = useState(false);
  const [geoChallengeIdx, setGeoChallengeIdx] = useState(0);

  const sandboxChallenges = useMemo(() => [
    { title: 'Consigue 8 con exactamente 3 regletas', check: (b) => b.reduce((a, r) => a + r.v, 0) === 8 && b.length === 3 },
    { title: 'Consigue 10 usando 2 regletas iguales', check: (b) => b.reduce((a, r) => a + r.v, 0) === 10 && b.length === 2 && b[0].v === b[1].v },
    { title: 'Consigue 7 usando sólo 2 regletas', check: (b) => b.reduce((a, r) => a + r.v, 0) === 7 && b.length === 2 },
    { title: 'Consigue 5 usando 3 regletas', check: (b) => b.reduce((a, r) => a + r.v, 0) === 5 && b.length === 3 },
    { title: 'Consigue 9 usando una regleta Amarilla (5)', check: (b) => b.reduce((a, r) => a + r.v, 0) === 9 && b.some(r => r.v === 5) },
    { title: 'Consigue 6 usando 2 regletas iguales', check: (b) => b.reduce((a, r) => a + r.v, 0) === 6 && b.length === 2 && b[0].v === b[1].v },
    { title: 'Consigue 10 usando 3 regletas distintas', check: (b) => b.reduce((a, r) => a + r.v, 0) === 10 && b.length === 3 && new Set(b.map(r => r.v)).size === 3 },
    { title: 'Consigue 4 usando 2 regletas iguales', check: (b) => b.reduce((a, r) => a + r.v, 0) === 4 && b.length === 2 && b[0].v === b[1].v },
    { title: 'Consigue 8 usando una regleta Roja (2)', check: (b) => b.reduce((a, r) => a + r.v, 0) === 8 && b.some(r => r.v === 2) },
    { title: 'Consigue 10 usando exactamente 4 regletas', check: (b) => b.reduce((a, r) => a + r.v, 0) === 10 && b.length === 4 },
    { title: 'Consigue 6 con exactamente 3 regletas', check: (b) => b.reduce((a, r) => a + r.v, 0) === 6 && b.length === 3 },
    { title: 'Consigue 9 usando sólo 2 regletas', check: (b) => b.reduce((a, r) => a + r.v, 0) === 9 && b.length === 2 },
    { title: 'Consigue 7 usando una regleta Verde Clara (3)', check: (b) => b.reduce((a, r) => a + r.v, 0) === 7 && b.some(r => r.v === 3) },
    { title: 'Consigue 8 usando 4 regletas iguales (2+2+2+2)', check: (b) => b.reduce((a, r) => a + r.v, 0) === 8 && b.length === 4 && b.every(r => r.v === 2) },
    { title: 'Consigue 10 usando una regleta Naranja (10) sola', check: (b) => b.reduce((a, r) => a + r.v, 0) === 10 && b.length === 1 && b[0].v === 10 }
  ], []);

  const subtractionProblems = useMemo(() => [
    { minuend: 8, subtrahend: 5 },
    { minuend: 9, subtrahend: 4 },
    { minuend: 7, subtrahend: 3 },
    { minuend: 10, subtrahend: 6 },
    { minuend: 6, subtrahend: 2 },
    { minuend: 8, subtrahend: 3 },
    { minuend: 10, subtrahend: 3 },
    { minuend: 5, subtrahend: 1 },
    { minuend: 7, subtrahend: 5 },
    { minuend: 9, subtrahend: 7 },
    { minuend: 10, subtrahend: 4 },
    { minuend: 6, subtrahend: 4 },
    { minuend: 8, subtrahend: 6 },
    { minuend: 7, subtrahend: 2 },
    { minuend: 10, subtrahend: 8 }
  ], []);

  const geoGroups = useMemo(() => ({
    figuras: [
      { title: 'Triángulo (3 puntos)', req: 3, type: 'triangle', desc: 'Figura cerrada de 3 lados' },
      { title: 'Cuadrado perfecto', req: 4, type: 'square', desc: '4 lados iguales con ángulos rectos' },
      { title: 'Rectángulo', req: 4, type: 'rectangle', desc: 'Ángulos rectos, base y altura distintas' },
      { title: 'Cuadrilátero cualquiera', req: 4, type: 'quadrilateral', desc: '4 vértices, pero que NO sea cuadrado ni rectángulo' },
      { title: 'Pentágono (5 puntos)', req: 5, type: 'polygon', desc: 'Polígono de 5 vértices' },
      { title: 'Hexágono (6 puntos)', req: 6, type: 'polygon', desc: 'Polígono de 6 vértices' },
      { title: 'Figura en forma de L', req: 6, type: 'polygon', desc: 'Polígono de 6 vértices' },
      { title: 'Casita clásica', req: 5, type: 'polygon', desc: 'Base cuadrada + techo triangular' },
      { title: 'Cuadrado inclinado', req: 4, type: 'square', desc: 'Cuadrado rotado sobre sus vértices' },
      { title: 'Octógono u 8 vértices', req: 8, type: 'polygon', desc: 'Polígono de 8 vértices' }
    ],
    // Perímetro: todos los lados deben ser horizontales o verticales
    perimetro: [
      { title: 'Perímetro de 4 u',  type: 'perimeter', valor: 4,  desc: 'La figura más pequeña: un cuadrado de 1×1' },
      { title: 'Perímetro de 6 u',  type: 'perimeter', valor: 6,  desc: 'Prueba con un rectángulo de 1×2' },
      { title: 'Perímetro de 8 u',  type: 'perimeter', valor: 8,  desc: '¿Cuadrado de 2×2 o rectángulo de 1×3?' },
      { title: 'Perímetro de 10 u', type: 'perimeter', valor: 10, desc: 'Rectángulo de 2×3, por ejemplo' },
      { title: 'Perímetro de 12 u', type: 'perimeter', valor: 12, desc: 'Cuadrado de 3×3 o rectángulo de 2×4' },
      { title: 'Perímetro de 14 u', type: 'perimeter', valor: 14, desc: 'Rectángulo de 3×4' },
      { title: 'Perímetro de 16 u', type: 'perimeter', valor: 16, desc: 'El cuadrado más grande del geoplano' },
      { title: 'Perímetro de 12 u en forma de L', type: 'perimeter', valor: 12, minVertices: 6, desc: 'Mismo perímetro, pero con 6 vértices o más' },
      { title: 'Perímetro de 18 u', type: 'perimeter', valor: 18, desc: 'Haz una muesca en el cuadrado grande' },
      { title: 'Perímetro de 20 u', type: 'perimeter', valor: 20, desc: 'Una muesca arriba y otra en un lateral: el perímetro crece aunque el área baje' }
    ],
    // Área: vale cualquier figura, también con lados inclinados
    area: [
      { title: 'Área de 1 u²',  type: 'area', valor: 1,   desc: 'Un solo cuadradito' },
      { title: 'Área de 2 u²',  type: 'area', valor: 2,   desc: 'Dos cuadraditos' },
      { title: 'Área de 3 u²',  type: 'area', valor: 3,   desc: 'Rectángulo de 1×3' },
      { title: 'Área de 4 u²',  type: 'area', valor: 4,   desc: 'Cuadrado de 2×2 o rectángulo de 1×4' },
      { title: 'Área de 6 u²',  type: 'area', valor: 6,   desc: 'Rectángulo de 2×3' },
      { title: 'Área de 8 u²',  type: 'area', valor: 8,   desc: 'Rectángulo de 2×4' },
      { title: 'Área de 9 u²',  type: 'area', valor: 9,   desc: 'Cuadrado de 3×3' },
      { title: 'Área de 12 u²', type: 'area', valor: 12,  desc: 'Rectángulo de 3×4' },
      { title: 'Área de 16 u²', type: 'area', valor: 16,  desc: 'Todo el geoplano' },
      { title: 'Área de 2 u² con un triángulo', type: 'area', valor: 2, req: 3, desc: 'Un triángulo también puede medir 2 u²' }
    ]
  }), []);

  const [geoGrupo, setGeoGrupo] = useState('figuras');
  const geoChallenges = geoGroups[geoGrupo];

  // Niveles de multiplicación: números con varias descomposiciones en factores 1-10
  const factoryMultiLevels = useMemo(() => [
    { target: 6,  name: 'Monstruo del 6' },
    { target: 8,  name: 'Monstruo del 8' },
    { target: 10, name: 'Monstruo del 10' },
    { target: 12, name: 'Monstruo del 12' },
    { target: 16, name: 'Monstruo del 16' },
    { target: 18, name: 'Monstruo del 18' },
    { target: 20, name: 'Monstruo del 20' },
    { target: 24, name: 'Monstruo del 24' },
    { target: 30, name: 'Monstruo del 30' },
    { target: 36, name: 'Monstruo del 36' }
  ], []);

  const factoryLevels = useMemo(() => [
    { target: 4, name: 'Monstruo del 4' },
    { target: 5, name: 'Monstruo del 5' },
    { target: 6, name: 'Monstruo del 6' },
    { target: 7, name: 'Monstruo del 7' },
    { target: 8, name: 'Monstruo del 8' },
    { target: 9, name: 'Monstruo del 9' },
    { target: 10, name: 'Monstruo del 10' },
    { target: 11, name: 'Monstruo del 11' },
    { target: 12, name: 'Monstruo del 12' },
    { target: 15, name: 'Monstruo del 15' },
    { target: 20, name: 'Monstruo del 20' }
  ], []);

  // ── Estimación de tamaños ───────────────────────────────────────────────────
  // El objeto de referencia se dibuja siempre a EST_REF_PX; el alumno estira el
  // segundo hasta que le parece proporcionado. Todas las parejas mantienen el
  // tamaño correcto dentro del recorrido del deslizador (EST_MIN..EST_MAX).
  // largo/alto son las medidas reales en ambos ejes (misma unidad): mantienen la
  // proporción de la silueta. "dim" dice cuál de las dos es la que se mide.
  const estimacionRetos = useMemo(() => {
    const O = {
      puerta:   { sil: 'puerta',   nombre: 'Puerta',   art: 'una', largo: 0.8, alto: 2,   dim: 'alto',  unidad: 'm'  },
      coche:    { sil: 'coche',    nombre: 'Coche',    art: 'un',  largo: 4.2, alto: 1.5, dim: 'largo', unidad: 'm'  },
      persona:  { sil: 'persona',  nombre: 'Persona',  art: 'una', largo: 0.5, alto: 1.7, dim: 'alto',  unidad: 'm'  },
      jirafa:   { sil: 'jirafa',   nombre: 'Jirafa',   art: 'una', largo: 2.5, alto: 5.5, dim: 'alto',  unidad: 'm'  },
      autobus:  { sil: 'autobus',  nombre: 'Autobús',  art: 'un',  largo: 12,  alto: 3.2, dim: 'largo', unidad: 'm'  },
      lapiz:    { sil: 'lapiz',    nombre: 'Lápiz',    art: 'un',  largo: 17,  alto: 0.8, dim: 'largo', unidad: 'cm' },
      platano:  { sil: 'platano',  nombre: 'Plátano',  art: 'un',  largo: 20,  alto: 4,   dim: 'largo', unidad: 'cm' },
      movil:    { sil: 'movil',    nombre: 'Móvil',    art: 'un',  largo: 7,   alto: 15,  dim: 'alto',  unidad: 'cm' },
      libro:    { sil: 'libro',    nombre: 'Libro',    art: 'un',  largo: 17,  alto: 24,  dim: 'alto',  unidad: 'cm' },
      guitarra: { sil: 'guitarra', nombre: 'Guitarra', art: 'una', largo: 0.37, alto: 1,  dim: 'alto',  unidad: 'm'  },
      arbol:    { sil: 'arbol',    nombre: 'Árbol',    art: 'un',  largo: 6,   alto: 10,  dim: 'alto',  unidad: 'm'  },
      casa:     { sil: 'casa',     nombre: 'Casa',     art: 'una', largo: 9,   alto: 7,   dim: 'alto',  unidad: 'm'  },
      elefante: { sil: 'elefante', nombre: 'Elefante', art: 'un',  largo: 6,   alto: 3,   dim: 'alto',  unidad: 'm'  },
      caballo:  { sil: 'caballo',  nombre: 'Caballo',  art: 'un',  largo: 2.2, alto: 1.6, dim: 'alto',  unidad: 'm'  },
      balon:    { sil: 'balon',    nombre: 'Balón',    art: 'un',  largo: 22,  alto: 22,  dim: 'alto',  unidad: 'cm', dimTexto: 'de diámetro' },
      sandia:   { sil: 'sandia',   nombre: 'Sandía',   art: 'una', largo: 30,  alto: 22,  dim: 'largo', unidad: 'cm' },
      camion:   { sil: 'camion',   nombre: 'Camión',   art: 'un',  largo: 8,   alto: 3.5, dim: 'largo', unidad: 'm'  },
      barca:    { sil: 'barca',    nombre: 'Barca',    art: 'una', largo: 3.5, alto: 1.2, dim: 'largo', unidad: 'm'  }
    };
    // medida = el valor del eje que se mide, derivado de largo/alto
    const prep = o => ({ ...o, medida: o.dim === 'alto' ? o.alto : o.largo });
    return [
      { ref: prep(O.puerta),   obj: prep(O.coche)    },
      { ref: prep(O.persona),  obj: prep(O.jirafa)   },
      { ref: prep(O.autobus),  obj: prep(O.coche)    },
      { ref: prep(O.lapiz),    obj: prep(O.platano)  },
      { ref: prep(O.movil),    obj: prep(O.libro)    },
      { ref: prep(O.guitarra), obj: prep(O.persona)  },
      { ref: prep(O.arbol),    obj: prep(O.casa)     },
      { ref: prep(O.elefante), obj: prep(O.caballo)  },
      { ref: prep(O.balon),    obj: prep(O.sandia)   },
      { ref: prep(O.camion),   obj: prep(O.barca)    }
    ];
  }, []);

  // Precio medio orientativo de cada artículo (no comparativo: se estima solo).
  // Todos llevan céntimos a propósito: con precios redondos el total de varios
  // artículos sale exacto y la estimación pierde sentido.
  const preciosArticulos = useMemo(() => [
    { sil: 'pan',        nombre: 'Barra de pan',            tienda: 'la panadería',        art: 'una', plural: 'barras de pan',     precio: 1.15 },
    { sil: 'agua',       nombre: 'Botella de agua de 1,5 L', tienda: 'el supermercado',    art: 'una', plural: 'botellas',          precio: 0.65 },
    { sil: 'leche',      nombre: 'Brik de leche de 1 L',    tienda: 'el supermercado',     art: 'un',  plural: 'briks de leche',    precio: 1.05 },
    { sil: 'boli',       nombre: 'Bolígrafo azul',          tienda: 'la papelería',        art: 'un',  plural: 'bolígrafos',        precio: 1.25 },
    { sil: 'bocadillo',  nombre: 'Café con leche',          tienda: 'la cafetería',        art: 'un',  plural: 'cafés con leche',   precio: 1.65 },
    { sil: 'galletas',   nombre: 'Paquete de galletas de 300 g', tienda: 'el supermercado', art: 'un', plural: 'paquetes',          precio: 1.75 },
    { sil: 'platano',    nombre: 'Kilo de plátanos',        tienda: 'la frutería',         art: 'un',  plural: 'kilos de plátanos', precio: 1.85 },
    { sil: 'helado',     nombre: 'Helado de cucurucho',     tienda: 'la heladería',        art: 'un',  plural: 'helados',           precio: 2.25 },
    { sil: 'manzana',    nombre: 'Kilo de manzanas',        tienda: 'la frutería',         art: 'un',  plural: 'kilos de manzanas', precio: 2.35 },
    { sil: 'cuaderno',   nombre: 'Cuaderno de espiral',     tienda: 'la papelería',        art: 'un',  plural: 'cuadernos',         precio: 2.45 },
    { sil: 'huevos',     nombre: 'Docena de huevos',        tienda: 'el supermercado',     art: 'una', plural: 'docenas de huevos', precio: 2.65 },
    { sil: 'calcetines', nombre: 'Par de calcetines',       tienda: 'la tienda de ropa',   art: 'un',  plural: 'pares de calcetines', precio: 2.95 },
    { sil: 'cepillo',    nombre: 'Cepillo de dientes',      tienda: 'la farmacia',         art: 'un',  plural: 'cepillos',          precio: 3.15 },
    { sil: 'champu',     nombre: 'Bote de champú de 400 ml', tienda: 'la droguería',       art: 'un',  plural: 'botes de champú',   precio: 3.45 },
    { sil: 'bocadillo',  nombre: 'Bocadillo de jamón',      tienda: 'la cafetería',        art: 'un',  plural: 'bocadillos',        precio: 4.25 },
    { sil: 'entrada',    nombre: 'Entrada de cine',         tienda: 'el cine',             art: 'una', plural: 'entradas',          precio: 8.50 },
    { sil: 'libro',      nombre: 'Libro de bolsillo',       tienda: 'la librería',         art: 'un',  plural: 'libros',            precio: 10.95 },
    { sil: 'camiseta',   nombre: 'Camiseta de algodón',     tienda: 'la tienda de ropa',   art: 'una', plural: 'camisetas',         precio: 12.95 },
    { sil: 'mochila',    nombre: 'Mochila escolar',         tienda: 'la papelería',        art: 'una', plural: 'mochilas',          precio: 15.50 },
    { sil: 'balon',      nombre: 'Balón de fútbol',         tienda: 'la tienda de deportes', art: 'un', plural: 'balones',          precio: 19.95 }
  ], []);

  // Escalón de precios del deslizador: fino donde los precios son bajos y más
  // grueso arriba, pero SIEMPRE incluyendo los precios reales (si no, hay
  // artículos que no se pueden clavar y la nota nunca llega a 100).
  const escalaPrecios = useMemo(() => {
    const s = new Set();
    const add = p => s.add(Math.round(p * 100) / 100);
    for (let p = 0.20; p <= 5.001;  p += 0.05) add(p);
    for (let p = 5.25; p <= 20.001; p += 0.25) add(p);
    for (let p = 20.5; p <= 40.001; p += 0.50) add(p);
    preciosArticulos.forEach(a => add(a.precio));
    return [...s].sort((a, b) => a - b);
  }, [preciosArticulos]);

  const pathsProblems = useMemo(() => [
    { expr: '7 + 6 = ?', name: 'Leo', avatar: '👦', strat: 'Pensé en dobles: 6 + 6 son 12, así que 7 + 6 es 13 porque es uno más.' },
    { expr: '5 + 4 = ?', name: 'Sofía', avatar: '👧', strat: 'Pensé 5 + 5 = 10, y como 4 es uno menos, el resultado es 9.' },
    { expr: '8 + 5 = ?', name: 'Mateo', avatar: '🧑', strat: 'Paso por el 10: a 8 le faltan 2 para el 10, y luego sumo los 3 restantes: 13.' },
    { expr: '9 + 4 = ?', name: 'Emma', avatar: '👩', strat: 'El 9 roba 1 al 4 para convertirse en 10. Quedan 10 + 3 = 13.' },
    { expr: '6 + 7 = ?', name: 'Lucas', avatar: '👦', strat: 'Sé que 7 + 7 son 14, por lo tanto 6 + 7 es 13 (uno menos).' }
  ], []);

  const currentSum = useMemo(() => board.reduce((acc, r) => acc + r.v, 0), [board]);
  const currentProduct = useMemo(() => board.reduce((acc, r) => acc * r.v, 1), [board]);

  const esMulti = factoryOp === 'multi';
  const nivelesFactory = esMulti ? factoryMultiLevels : factoryLevels;
  const currentFactoryTarget = nivelesFactory[factoryIdx].target;
  // En multiplicación el tablero vacío vale 1 (elemento neutro): no cuenta como lleno
  const currentFactoryValor = esMulti ? currentProduct : currentSum;
  const isMonsterFull = board.length > 0 && currentFactoryValor === currentFactoryTarget;
  const isMonsterOverfed = board.length > 0 && !isMonsterFull && (
    esMulti
      ? (currentProduct > currentFactoryTarget || currentFactoryTarget % currentProduct !== 0)
      : currentSum > currentFactoryTarget
  );
  // El 1 solo puede usarse una vez como factor (1 × 1 × … no descompone nada)
  const unoYaUsado = esMulti && board.some(r => r.v === 1);

  // Cuántas descomposiciones en factores existen: multiconjuntos de factores 2-10
  // cuyo producto es el objetivo, y cada una vale también con un 1 delante.
  const totalFactorizaciones = useMemo(() => {
    const rec = (resto, min) => {
      if (resto === 1) return 1;
      let total = 0;
      for (let f = min; f <= 10; f++) if (resto % f === 0) total += rec(resto / f, f);
      return total;
    };
    return rec(currentFactoryTarget, 2) * 2;
  }, [currentFactoryTarget]);

  const addToBoard = (rod) => {
    if (esMulti && rod.v === 1 && unoYaUsado) {
      playAudio('wrong');
      return;
    }
    playAudio('eat');
    setMonsterEating(true);
    setTimeout(() => setMonsterEating(false), 200);
    setBoard(prev => [...prev, rod]);
    setMetrics(prev => ({ ...prev, sandboxInteractions: prev.sandboxInteractions + 1 }));
  };

  const removeFromBoard = (index) => {
    setBoard(prev => {
      const copy = [...prev];
      copy.splice(index, 1);
      return copy;
    });
  };

  useEffect(() => {
    if (view === 'factory') {
      if (isMonsterFull) {
        playAudio('success');
        const comboStr = board.map(r => r.v).sort((a,b)=>a-b).join(esMulti ? ' × ' : ' + ');
        if (!factoryHistory.includes(comboStr)) {
          setFactoryHistory(prev => [...prev, comboStr]);
          setMetrics(prev => ({
            ...prev,
            combinationsDiscovered: [...new Set([...prev.combinationsDiscovered, `${currentFactoryTarget} = ${comboStr}`])]
          }));
        }
        const timer = setTimeout(() => {
          setBoard([]);
        }, 1100);
        return () => clearTimeout(timer);
      } else if (isMonsterOverfed) {
        playAudio('wrong');
      }
    }
  }, [currentFactoryValor, currentFactoryTarget, isMonsterFull, isMonsterOverfed, view, board, factoryHistory, esMulti]);

  const handleSelectDiffRod = (rod) => {
    setUserDiffRod(rod);
    const sub = subtractionProblems[subtractionIdx];
    if (sub.subtrahend + rod.v === sub.minuend) {
      setSubtractionSolved(true);
      playAudio('success');
      setMetrics(p => ({ ...p, subtractionsSolved: p.subtractionsSolved + 1, subtractionsTried: p.subtractionsTried + 1 }));
    } else {
      setSubtractionSolved(false);
      playAudio('wrong');
      setMetrics(p => ({ ...p, subtractionsTried: p.subtractionsTried + 1 }));
    }
  };

  const handlePegClick = (x, y) => {
    if (geoClosed) return;
    const existingIndex = geoPegs.findIndex(p => p.x === x && p.y === y);

    if (existingIndex === 0 && geoPegs.length >= 3) {
      setGeoClosed(true);
      const currentChallenge = geoChallenges[geoChallengeIdx];
      const isValid = validateShape(geoPegs, currentChallenge);

      if (isValid) {
        playAudio('success');
        setMetrics(prev => ({ ...prev, geoplanoShapes: prev.geoplanoShapes + 1, geoplanoTried: prev.geoplanoTried + 1 }));
      } else {
        playAudio('wrong');
        setMetrics(prev => ({ ...prev, geoplanoTried: prev.geoplanoTried + 1 }));
      }
      return;
    }

    if (existingIndex === -1) {
      playAudio('eat');
      setGeoPegs([...geoPegs, { x, y }]);
    }
  };

  // Explica POR QUÉ no vale la figura, en vez de un "no cumple" genérico
  const motivoFalloGeo = (pegs, ch) => {
    if (!ch) return 'No cumple las condiciones. ¡Prueba de nuevo!';
    const n = pegs.length;
    if (!isSimplePolygon(pegs)) return 'Los lados se cruzan: haz una figura sin lazos.';
    if (ch.req && n !== ch.req) return `Necesitas ${ch.req} vértices y has puesto ${n}.`;
    if (ch.minVertices && n < ch.minVertices) return `Necesitas al menos ${ch.minVertices} vértices y has puesto ${n}.`;

    if (ch.type === 'perimeter') {
      if (!isRectilinear(pegs)) return 'Todos los lados deben ser horizontales o verticales.';
      return `Tu figura mide ${polyPerimeter(pegs)} u de perímetro y hacen falta ${ch.valor} u.`;
    }
    if (ch.type === 'area') {
      return `Tu figura mide ${polyArea(pegs)} u² y hacen falta ${ch.valor} u².`;
    }
    if (ch.type === 'quadrilateral') {
      return 'Eso es un cuadrado o un rectángulo: haz un cuadrilátero distinto (rombo, trapecio…).';
    }
    if (ch.type === 'square')    return 'No es un cuadrado: los 4 lados deben ser iguales y los ángulos rectos.';
    if (ch.type === 'rectangle') return 'No es un rectángulo (o es un cuadrado): base y altura deben ser distintas.';
    return 'No cumple las condiciones. ¡Prueba de nuevo!';
  };

  const clearGeoplano = () => {
    setGeoPegs([]);
    setGeoClosed(false);
  };

  // ── Estimación: tamaño correcto del objeto según la escala de la referencia ──
  const estReto = estimacionRetos[estIdx];
  const estTamCorrecto = Math.round((estReto.obj.medida / estReto.ref.medida) * EST_REF_PX);

  // Escala de la escena: se calcula UNA vez por reto con el objeto al máximo del
  // deslizador, no con el tamaño actual. Así no cambia mientras el alumno
  // arrastra (si encogiera justo al pasarse, delataría la respuesta).
  const estFit = useMemo(() => {
    const dims = (o, medidaPx) => {
      const e = medidaPx / o.medida;
      return { w: o.largo * e, h: o.alto * e };
    };
    const r = dims(estReto.ref, EST_REF_PX);
    const a = dims(estReto.obj, EST_MAX_PX);
    const ancho = r.w + a.w + 70;              // + acotaciones y separación
    const alto  = Math.max(r.h, a.h) + 34;     // + etiquetas
    return Math.min(1, 336 / ancho, (EST_MAX_PX + 46) / alto);
  }, [estReto]);

  const comprobarEstimacion = () => {
    if (estNota !== null) return;
    const nota = notaEstimacion(estTam, estTamCorrecto);
    setEstNota(nota);
    playAudio(nota >= 50 ? 'success' : 'wrong');
    setMetrics(p => ({
      ...p,
      estimaciones: [...p.estimaciones, { objeto: estReto.obj.nombre, nota }]
    }));
  };

  // Dibuja un objeto a escala con su acotación (vertical si se mide el alto,
  // horizontal si se mide el largo) y su etiqueta.
  const formaEst = (o, medidaPx, colorCota) => {
    const escala = medidaPx / o.medida;
    const w = Math.max(4, Math.round(o.largo * escala));
    const h = Math.max(3, Math.round(o.alto * escala));
    const esAlto = o.dim === 'alto';
    const cota = { position: 'absolute', backgroundColor: colorCota };
    return (
      <div style={{
        position: 'relative', width: `${w}px`, height: `${h}px`,
        marginLeft: esAlto ? '16px' : 0, marginBottom: esAlto ? 0 : '16px'
      }}>
        <svg width={w} height={h} viewBox={SILUETAS[o.sil].vb} preserveAspectRatio="none" style={{ display: 'block' }}>
          {SILUETAS[o.sil].draw}
        </svg>
        {esAlto ? (
          <>
            <span style={{ ...cota, left: '-12px', top: 0, width: '2px', height: `${h}px` }} />
            <span style={{ ...cota, left: '-16px', top: 0, width: '10px', height: '2px' }} />
            <span style={{ ...cota, left: '-16px', bottom: 0, width: '10px', height: '2px' }} />
          </>
        ) : (
          <>
            <span style={{ ...cota, bottom: '-12px', left: 0, height: '2px', width: `${w}px` }} />
            <span style={{ ...cota, bottom: '-16px', left: 0, width: '2px', height: '10px' }} />
            <span style={{ ...cota, bottom: '-16px', right: 0, width: '2px', height: '10px' }} />
          </>
        )}
      </div>
    );
  };

  const etiquetaEst = (o, valorTexto, color, fontFix) => (
    <div style={{ marginTop: '5px', textAlign: 'center', fontSize: `${(0.72 * fontFix).toFixed(2)}rem`, fontWeight: '900', color: '#0F172A', whiteSpace: 'nowrap' }}>
      {o.nombre}
      <div style={{ color, fontWeight: '800' }}>
        {valorTexto} {o.unidad} {o.dimTexto || (o.dim === 'alto' ? 'de alto' : 'de largo')}
      </div>
    </div>
  );

  const siguienteEstimacion = () => {
    setEstIdx(prev => (prev + 1) % estimacionRetos.length);
    setEstTam(EST_REF_PX);
    setEstNota(null);
  };

  // ── Modo precios ────────────────────────────────────────────────────────────
  const preArt = preciosArticulos[preIdx];
  // Arranca a mitad de camino (~2,50 €) para no dar pistas hacia arriba ni abajo
  const preIni = useMemo(() => {
    let mejor = 0;
    escalaPrecios.forEach((v, i) => {
      if (Math.abs(v - 2.5) < Math.abs(escalaPrecios[mejor] - 2.5)) mejor = i;
    });
    return mejor;
  }, [escalaPrecios]);
  const preIdxSlider = preT === null ? preIni : Math.min(preT, escalaPrecios.length - 1);
  const prePrecio = escalaPrecios[preIdxSlider];

  const comprobarPrecio = () => {
    if (preNota !== null) return;
    const nota = notaEstimacion(prePrecio, preArt.precio);
    setPreNota(nota);
    setPreCompra(generarCompra(preArt.precio));
    playAudio(nota >= 50 ? 'success' : 'wrong');
  };

  const elegirCompra = (valor) => {
    if (preElegida !== null || !preCompra) return;
    setPreElegida(valor);
    const acierto = valor === preCompra.correcta;
    playAudio(acierto ? 'success' : 'wrong');
    setMetrics(p => ({
      ...p,
      precios: [...p.precios, { articulo: preArt.nombre, nota: preNota, acertoCompra: acierto }]
    }));
  };

  const siguientePrecio = () => {
    setPreIdx(prev => (prev + 1) % preciosArticulos.length);
    setPreT(null);
    setPreNota(null);
    setPreCompra(null);
    setPreElegida(null);
  };

  // Dibuja un artículo a una altura fija (aquí no se compara, solo se reconoce)
  const renderArticulo = (sil, alturaPx = 86) => {
    const [, , vw, vh] = SILUETAS[sil].vb.split(' ').map(Number);
    const h = alturaPx;
    const w = Math.min(150, Math.round((vw / vh) * h));
    const hFinal = Math.round((vh / vw) * w);
    return (
      <svg width={w} height={hFinal} viewBox={SILUETAS[sil].vb} preserveAspectRatio="none" style={{ display: 'block' }}>
        {SILUETAS[sil].draw}
      </svg>
    );
  };

  // Guarda por escrito la estrategia del problema actual (una por expresión)
  const guardarEstrategia = () => {
    const texto = pathsTexto.trim();
    if (!texto) return;
    const expr = pathsProblems[pathsIdx].expr;
    setEstrategias(prev => {
      const otras = prev.filter(e => e.expr !== expr);
      return [...otras, { expr, texto }];
    });
    playAudio('success');
    setPathsGuardado(true);
    setTimeout(() => setPathsGuardado(false), 2000);
  };

  // Al cambiar de problema, recuperar lo que el alumno ya hubiera escrito
  const irAProblema = (idx) => {
    const nuevo = (idx + pathsProblems.length) % pathsProblems.length;
    setPathsIdx(nuevo);
    const guardada = estrategias.find(e => e.expr === pathsProblems[nuevo].expr);
    setPathsTexto(guardada ? guardada.texto : '');
    setPathsGuardado(false);
  };

  const resumenEnvio = {
    bloques:  bloquesStats,
    monstruo: { combinaciones: metrics.combinationsDiscovered },
    retos:    { superados: metrics.challengesSolved },
    restas:   { resueltas: metrics.subtractionsSolved, intentos: metrics.subtractionsTried },
    geoplano: { correctas: metrics.geoplanoShapes, intentos: metrics.geoplanoTried },
    estimaciones: metrics.estimaciones,
    precios: metrics.precios,
    estrategias,
  };

  const renderRodButton = (rod, onClick, compact = false, customStyle = {}, keyId = '') => {
    if (!rod) return null;
    const unitWidth = compact ? 18 : 22;
    return (
      <button
        key={`rod-btn-${keyId || rod.v}`}
        onClick={onClick}
        style={{
          backgroundColor: rod.c,
          color: rod.t,
          width: `${Math.max(rod.v * unitWidth, 26)}px`,
          height: compact ? '32px' : '38px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '8px',
          border: `1.5px solid ${rod.border || 'rgba(0,0,0,0.15)'}`,
          cursor: 'pointer',
          margin: '2px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.4)',
          fontWeight: '900',
          fontSize: compact ? '0.85rem' : '1rem',
          userSelect: 'none',
          flexShrink: 0,
          touchAction: 'manipulation',
          ...customStyle
        }}
      >
        {rod.v}
      </button>
    );
  };

  const renderTopBar = (title) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 12px',
      backgroundColor: '#FFFFFF',
      borderBottom: '2px solid #E2E8F0',
      boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
      flexShrink: 0,
      zIndex: 10
    }}>
      <button
        onClick={() => { setView('menu'); setBoard([]); setUserDiffRod(null); }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '6px 10px',
          borderRadius: '10px',
          backgroundColor: '#F1F5F9',
          color: '#334155',
          border: '1.5px solid #CBD5E1',
          fontWeight: '800',
          fontSize: '0.85rem',
          cursor: 'pointer'
        }}
      >
        <span>◀</span> Menú
      </button>
      <h2 style={{ margin: 0, fontSize: '1rem', color: '#0F172A', fontWeight: '900', textAlign: 'center', flex: 1, padding: '0 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {title}
      </h2>
      <button
        onClick={() => setMostrarEnvio(true)}
        title="Enviar al profesor"
        style={{
          padding: '6px 10px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
          color: '#FFFFFF',
          border: 'none',
          fontWeight: '800',
          fontSize: '0.85rem',
          cursor: 'pointer',
          flexShrink: 0
        }}
      >
        📤
      </button>
    </div>
  );

  const renderPalette = (onSelect = addToBoard, atenuada = () => false) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      overflowX: 'auto',
      gap: '4px',
      padding: '6px 10px',
      backgroundColor: '#FFFFFF',
      borderTop: '2px solid #E2E8F0',
      boxShadow: '0 -2px 8px rgba(0,0,0,0.04)',
      flexShrink: 0,
      WebkitOverflowScrolling: 'touch'
    }}>
      <span style={{ fontSize: '0.75rem', fontWeight: '900', color: '#64748B', marginRight: '4px', flexShrink: 0 }}>
        REGLETAS:
      </span>
      {RODS.map(rod => (
        <span key={`palette-rod-${rod.v}`} style={{ flexShrink: 0 }}>
          {renderRodButton(rod, () => onSelect(rod), true,
            atenuada(rod) ? { opacity: 0.3, cursor: 'not-allowed' } : {})}
        </span>
      ))}
    </div>
  );

  const mouthOpen = board.length > 0 && currentFactoryValor < currentFactoryTarget;
  const digestionPercentage = Math.min(100, Math.round((board.length === 0 ? 0 : currentFactoryValor / currentFactoryTarget) * 100));

  return (
    <div style={{
      width: '100%',
      height: '100%',
      minHeight: '100dvh',
      margin: 0,
      padding: 0,
      backgroundColor: '#F8FAFC',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      userSelect: 'none',
      boxSizing: 'border-box'
    }}>
      {view === 'menu' && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: '16px 12px',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}>
          {onExit && (
            <button
              onClick={onExit}
              style={{
                alignSelf: 'flex-start',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '10px',
                backgroundColor: '#F1F5F9',
                color: '#334155',
                border: '1.5px solid #CBD5E1',
                fontWeight: '800',
                fontSize: '0.85rem',
                cursor: 'pointer',
                marginBottom: '4px'
              }}
            >
              <span>◀</span> Volver
            </button>
          )}

          <div style={{ textAlign: 'center', marginBottom: '16px', marginTop: '4px' }}>
            <div style={{
              display: 'inline-block',
              backgroundColor: '#EEF2FF',
              color: '#4F46E5',
              fontWeight: '900',
              padding: '4px 10px',
              borderRadius: '16px',
              fontSize: '0.75rem',
              marginBottom: '6px',
              border: '1.5px solid #C7D2FE'
            }}>
              MATEMÁTICAS ACTIVAS
            </div>
            <h1 style={{ fontSize: '1.8rem', margin: 0, color: '#0F172A', fontWeight: '900' }}>Método OAOA</h1>
            <p style={{ margin: '4px 0 0 0', color: '#64748B', fontSize: '0.9rem', fontWeight: '600' }}>
              Manipulación y cálculo razonado
            </p>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            width: '100%',
            maxWidth: '480px',
            paddingBottom: '16px'
          }}>
            {[
              { id: 'bloques', icon: '🧮', title: 'Bloques D y U', desc: 'Sumas y restas con decenas y unidades + contrarreloj', bg: 'linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)' },
              { id: 'factory', icon: '👾', title: 'Monstruo Arcade', desc: '¡Alimenta al monstruo con descomposiciones exactas!', bg: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)' },
              { id: 'sandbox', icon: '🧱', title: 'Regletas y Restas', desc: 'Retos de longitud y resta por comparación directa', bg: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)' },
              { id: 'geoplano', icon: '📐', title: 'Geoplano Activo', desc: 'Construye polígonos y valida sus propiedades', bg: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' },
              { id: 'estimacion', icon: '📏', title: 'Estimaciones', desc: 'Calcula a ojo tamaños de objetos y precios de la compra', bg: 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)' },
              { id: 'paths', icon: '💡', title: 'Caminos Flexibles', desc: 'Escribe cómo lo has pensado tú', bg: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' },
              { id: 'enviar', icon: '📤', title: 'Enviar al profesor', desc: 'Manda el recopilatorio de todo lo que has hecho', bg: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)' }
            ].map(card => (
              <div
                key={card.id}
                onClick={() => {
                  if (card.id === 'enviar') { setMostrarEnvio(true); return; }
                  setView(card.id); setBoard([]); setUserDiffRod(null); setSubtractionSolved(false); clearGeoplano();
                  if (card.id === 'paths') irAProblema(pathsIdx);
                  if (card.id === 'estimacion') { setEstTam(EST_REF_PX); setEstNota(null); }
                }}
                style={{
                  background: card.bg,
                  color: '#FFFFFF',
                  padding: '12px 14px',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  border: '2px solid rgba(255,255,255,0.15)',
                  touchAction: 'manipulation'
                }}
              >
                <div style={{ fontSize: '2rem', flexShrink: 0 }}>{card.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ margin: '0 0 2px 0', fontSize: '1.05rem', fontWeight: '900' }}>{card.title}</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.95, lineHeight: '1.3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'bloques' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {renderTopBar('Bloques de Decenas y Unidades')}
          <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <SimuladorOAOA embebido onProgreso={recibirBloques} onEnviar={abrirEnvio} />
          </div>
        </div>
      )}

      {view === 'factory' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {renderTopBar('Monstruo Comenúmeros')}

          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '8px 10px',
            overflowY: 'auto',
            gap: '8px',
            WebkitOverflowScrolling: 'touch'
          }}>
            {/* Suma (descomponer sumando) o multiplicación (descomponer en factores) */}
            <div style={{ display: 'flex', gap: '6px', width: '100%', maxWidth: '360px' }}>
              {[
                { id: 'suma',  label: '➕ Sumar' },
                { id: 'multi', label: '✖️ Multiplicar' }
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => { setFactoryOp(m.id); setFactoryIdx(0); setBoard([]); setFactoryHistory([]); }}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: '10px',
                    border: 'none',
                    fontWeight: '900',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    backgroundColor: factoryOp === m.id ? '#4F46E5' : '#FFFFFF',
                    color: factoryOp === m.id ? '#FFFFFF' : '#475569',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%', maxWidth: '360px', justifyContent: 'space-between' }}>
              <button
                onClick={() => { setFactoryIdx(prev => (prev - 1 + nivelesFactory.length) % nivelesFactory.length); setBoard([]); setFactoryHistory([]); }}
                style={{ padding: '4px 10px', borderRadius: '8px', border: '1.5px solid #CBD5E1', backgroundColor: '#FFF', fontWeight: '900', fontSize: '0.9rem', cursor: 'pointer' }}
              >
                ◀
              </button>
              <span style={{ fontWeight: '900', color: '#1E293B', fontSize: '0.9rem', textAlign: 'center' }}>
                Nivel {factoryIdx + 1}/{nivelesFactory.length}: {nivelesFactory[factoryIdx].name}
              </span>
              <button
                onClick={() => { setFactoryIdx(prev => (prev + 1) % nivelesFactory.length); setBoard([]); setFactoryHistory([]); }}
                style={{ padding: '4px 10px', borderRadius: '8px', border: '1.5px solid #CBD5E1', backgroundColor: '#FFF', fontWeight: '900', fontSize: '0.9rem', cursor: 'pointer' }}
              >
                ▶
              </button>
            </div>

            {esMulti && (
              <div style={{ width: '100%', maxWidth: '360px', fontSize: '0.75rem', fontWeight: '700', color: '#64748B', textAlign: 'center', lineHeight: 1.35 }}>
                Busca los factores cuyo producto sea {currentFactoryTarget}. El <b>1</b> solo puede usarse <b>una vez</b>.
              </div>
            )}

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: 'linear-gradient(180deg, #1E1B4B 0%, #312E81 100%)',
              padding: '10px 14px',
              borderRadius: '18px',
              boxShadow: '0 8px 20px rgba(30, 27, 75, 0.3)',
              border: '3px solid #6366F1',
              maxWidth: '360px',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                width: '100%',
                marginBottom: '6px',
                fontFamily: 'monospace'
              }}>
                <div style={{
                  backgroundColor: '#0F172A',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1.5px solid #38BDF8',
                  color: '#38BDF8',
                  fontSize: '0.75rem',
                  fontWeight: '900'
                }}>
                  OBJ: <span style={{ fontSize: '1rem', color: '#FDE047' }}>{currentFactoryTarget}</span>
                </div>
                <div style={{
                  backgroundColor: '#0F172A',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: `1.5px solid ${isMonsterOverfed ? '#EF4444' : '#4ADE80'}`,
                  color: isMonsterOverfed ? '#EF4444' : '#4ADE80',
                  fontSize: '0.75rem',
                  fontWeight: '900'
                }}>
                  {esMulti ? 'PRODUCTO' : 'LLEVAS'}: <span style={{ fontSize: '1rem' }}>{board.length === 0 ? 0 : currentFactoryValor}</span>
                </div>
              </div>

              <div style={{ width: '120px', height: '110px', position: 'relative' }}>
                <svg viewBox="0 0 200 200" width="100%" height="100%">
                  <polygon points="45,55 20,20 60,35" fill="#F59E0B" stroke="#B45309" strokeWidth="4" />
                  <polygon points="155,55 180,20 140,35" fill="#F59E0B" stroke="#B45309" strokeWidth="4" />

                  <rect
                    x="30" y="40" width="140" height="140" rx="40"
                    fill={isMonsterOverfed ? "#EF4444" : isMonsterFull ? "#10B981" : "#8B5CF6"}
                    stroke="#4C1D95" strokeWidth="6"
                  />

                  <circle cx="75" cy="80" r="18" fill="#FFFFFF" stroke="#1E1B4B" strokeWidth="4" />
                  <circle
                    cx={isMonsterFull ? "75" : mouthOpen ? "78" : "75"}
                    cy={isMonsterFull ? "80" : mouthOpen ? "84" : "80"}
                    r="8"
                    fill="#1E1B4B"
                  />
                  <circle cx="72" cy="76" r="3" fill="#FFFFFF" />

                  <circle cx="125" cy="80" r="18" fill="#FFFFFF" stroke="#1E1B4B" strokeWidth="4" />
                  <circle
                    cx={isMonsterFull ? "125" : mouthOpen ? "122" : "125"}
                    cy={isMonsterFull ? "80" : mouthOpen ? "84" : "80"}
                    r="8"
                    fill="#1E1B4B"
                  />
                  <circle cx="122" cy="76" r="3" fill="#FFFFFF" />

                  {isMonsterFull && (
                    <g>
                      <circle cx="50" cy="115" r="9" fill="#F472B6" opacity="0.9" />
                      <circle cx="150" cy="115" r="9" fill="#F472B6" opacity="0.9" />
                      <path d="M 65 125 Q 100 160 135 125" fill="none" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
                    </g>
                  )}

                  {isMonsterOverfed && (
                    <path d="M 65 140 Q 100 115 135 140" fill="none" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
                  )}

                  {!isMonsterFull && !isMonsterOverfed && (mouthOpen || monsterEating) && (
                    <g>
                      <ellipse cx="100" cy="132" rx="36" ry="24" fill="#1E1B4B" stroke="#4C1D95" strokeWidth="4" />
                      <polygon points="76,112 84,124 92,112" fill="#FFFFFF" />
                      <polygon points="92,112 100,124 108,112" fill="#FFFFFF" />
                      <polygon points="108,112 116,124 124,112" fill="#FFFFFF" />
                      <polygon points="84,152 92,140 100,152" fill="#FFFFFF" />
                      <polygon points="100,152 108,140 116,152" fill="#FFFFFF" />
                    </g>
                  )}

                  {!isMonsterFull && !isMonsterOverfed && !mouthOpen && !monsterEating && (
                    <path d="M 75 130 Q 100 145 125 130" fill="none" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
                  )}
                </svg>
              </div>

              <div style={{ width: '100%', marginTop: '6px' }}>
                <div style={{
                  width: '100%',
                  height: '10px',
                  backgroundColor: '#0F172A',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  border: '1.5px solid #4338CA'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(digestionPercentage, 100)}%`,
                    backgroundColor: isMonsterOverfed ? '#EF4444' : isMonsterFull ? '#10B981' : '#F59E0B',
                    borderRadius: '4px'
                  }} />
                </div>
              </div>
            </div>

            <div style={{
              width: '100%',
              maxWidth: '360px',
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              border: '2px dashed #CBD5E1',
              padding: '6px 8px',
              minHeight: '48px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              boxSizing: 'border-box'
            }}>
              {board.length === 0 ? (
                <span style={{ color: '#94A3B8', fontSize: '0.8rem', fontWeight: '700' }}>
                  Toca regletas abajo para alimentar
                </span>
              ) : (
                board.map((rod, idx) => (
                  <span key={`fed-rod-${idx}`}>
                    {renderRodButton(rod, () => removeFromBoard(idx), true, {}, `fed-${idx}`)}
                  </span>
                ))
              )}
            </div>

            {esMulti && isMonsterOverfed && (
              <div style={{ width: '100%', maxWidth: '360px', fontSize: '0.78rem', fontWeight: '800', color: '#DC2626', textAlign: 'center' }}>
                {currentProduct > currentFactoryTarget
                  ? `${currentProduct} se pasa de ${currentFactoryTarget}. Quita un factor.`
                  : `${currentFactoryTarget} no se puede dividir entre ${currentProduct}. Prueba otro factor.`}
              </div>
            )}

            <div style={{
              width: '100%',
              maxWidth: '360px',
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              padding: '8px 12px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              border: '1.5px solid #E2E8F0',
              boxSizing: 'border-box'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '900', color: '#475569', marginBottom: '4px' }}>
                {esMulti
                  ? `⭐ DESCOMPOSICIONES DE ${currentFactoryTarget} (${factoryHistory.length}/${totalFactorizaciones}):`
                  : `⭐ COMBINACIONES DESCUBIERTAS (${currentFactoryTarget}):`}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {factoryHistory.length === 0 ? (
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: '600' }}>
                    {esMulti ? '¡Encuéntralas todas!' : '¡Descubre combinaciones exactas!'}
                  </span>
                ) : (
                  factoryHistory.map((comb, i) => (
                    <span key={`comb-${i}`} style={{
                      backgroundColor: '#ECFDF5',
                      color: '#065F46',
                      border: '1px solid #A7F3D0',
                      padding: '2px 6px',
                      borderRadius: '8px',
                      fontWeight: '900',
                      fontSize: '0.75rem'
                    }}>
                      {comb}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          {renderPalette(addToBoard, rod => esMulti && rod.v === 1 && unoYaUsado)}
        </div>
      )}

      {view === 'sandbox' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {renderTopBar('Regletas y Restas')}

          <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', padding: '6px 8px', backgroundColor: '#F1F5F9', flexShrink: 0 }}>
            {[
              { id: 'free', label: '🧱 Libre' },
              { id: 'challenge', label: '🎯 Retos' },
              { id: 'subtraction', label: '➖ Resta' }
            ].map(m => (
              <button
                key={m.id}
                onClick={() => { setSandboxMode(m.id); setBoard([]); setUserDiffRod(null); setSubtractionSolved(false); }}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: '900',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  flex: 1,
                  maxWidth: '120px',
                  backgroundColor: sandboxMode === m.id ? '#0284C7' : '#FFFFFF',
                  color: sandboxMode === m.id ? '#FFFFFF' : '#475569',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 10px', overflowY: 'auto', gap: '8px', WebkitOverflowScrolling: 'touch' }}>
            {sandboxMode === 'free' && (
              <>
                <div style={{
                  flex: 1,
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  border: '2px dashed #CBD5E1',
                  padding: '8px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignContent: 'flex-start',
                  gap: '4px'
                }}>
                  {board.length === 0 ? (
                    <span style={{ color: '#94A3B8', margin: 'auto', fontWeight: '700', fontSize: '0.9rem', textAlign: 'center' }}>
                      Pulsa sobre las regletas inferiores para colocarlas. Toca una para quitarla.
                    </span>
                  ) : (
                    board.map((rod, idx) => (
                      <span key={`sb-${idx}`}>
                        {renderRodButton(rod, () => removeFromBoard(idx), true)}
                      </span>
                    ))
                  )}
                </div>
                <div style={{ textAlign: 'center', fontSize: '1.2rem', fontWeight: '900', color: '#0F172A' }}>
                  Total: <span style={{ color: '#0284C7' }}>{currentSum}</span>
                </div>
              </>
            )}

            {sandboxMode === 'challenge' && (
              <>
                <div style={{
                  backgroundColor: '#FFFFFF',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  textAlign: 'center',
                  border: '1.5px solid #E2E8F0'
                }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '900', color: '#0284C7' }}>RETO {sandboxChallengeIdx + 1}/{sandboxChallenges.length}</span>
                  <div style={{ fontSize: '0.95rem', fontWeight: '900', color: '#1E293B', marginTop: '2px' }}>
                    {sandboxChallenges[sandboxChallengeIdx].title}
                  </div>
                </div>

                <div style={{
                  flex: 1,
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  border: '2px dashed #CBD5E1',
                  padding: '8px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignContent: 'flex-start',
                  gap: '4px'
                }}>
                  {board.map((rod, idx) => (
                    <span key={`chal-${idx}`}>
                      {renderRodButton(rod, () => removeFromBoard(idx), true)}
                    </span>
                  ))}
                </div>

                <div style={{ textAlign: 'center' }}>
                  {sandboxChallenges[sandboxChallengeIdx].check(board) ? (
                    <div style={{ color: '#059669', fontWeight: '900', fontSize: '1rem' }}>
                      🎉 ¡Reto superado!
                      <button
                        onClick={() => {
                          setBoard([]);
                          setMetrics(p => ({ ...p, challengesSolved: p.challengesSolved + 1 }));
                          setSandboxChallengeIdx((sandboxChallengeIdx + 1) % sandboxChallenges.length);
                        }}
                        style={{ marginLeft: '8px', padding: '4px 10px', borderRadius: '8px', border: 'none', backgroundColor: '#059669', color: '#FFF', fontWeight: '900', cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        Siguiente ▶
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontWeight: '800', color: '#64748B', fontSize: '0.9rem' }}>
                      Suma: {currentSum} ({board.length} regletas)
                    </span>
                  )}
                </div>
              </>
            )}

            {sandboxMode === 'subtraction' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  backgroundColor: '#FFFFFF',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  textAlign: 'center',
                  width: '100%',
                  maxWidth: '360px',
                  border: '1.5px solid #E2E8F0',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: '900', color: '#0F172A' }}>
                    ¿Cuánto le falta a {subtractionProblems[subtractionIdx].subtrahend} para llegar a {subtractionProblems[subtractionIdx].minuend}?
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                    {subtractionProblems[subtractionIdx].minuend} - {subtractionProblems[subtractionIdx].subtrahend} = ?
                  </div>
                </div>

                <div style={{
                  backgroundColor: '#FFFFFF',
                  padding: '12px',
                  borderRadius: '14px',
                  width: '100%',
                  maxWidth: '360px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  border: '1.5px solid #E2E8F0',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '60px', fontSize: '0.75rem', fontWeight: '800', color: '#475569', flexShrink: 0 }}>Total ({subtractionProblems[subtractionIdx].minuend}):</span>
                    {renderRodButton(RODS.find(r => r.v === subtractionProblems[subtractionIdx].minuend), () => {}, true)}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '60px', fontSize: '0.75rem', fontWeight: '800', color: '#475569', flexShrink: 0 }}>Tengo ({subtractionProblems[subtractionIdx].subtrahend}):</span>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {renderRodButton(RODS.find(r => r.v === subtractionProblems[subtractionIdx].subtrahend), () => {}, true)}
                      {userDiffRod ? (
                        renderRodButton(userDiffRod, () => setUserDiffRod(null), true, { border: '2px solid #0284C7' })
                      ) : (
                        <div style={{
                          height: '32px',
                          width: `${(subtractionProblems[subtractionIdx].minuend - subtractionProblems[subtractionIdx].subtrahend) * 18}px`,
                          border: '2px dashed #EF4444',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.7rem',
                          color: '#EF4444',
                          fontWeight: '900'
                        }}>
                          ¿?
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {userDiffRod && (
                  <div style={{ textAlign: 'center' }}>
                    {subtractionSolved ? (
                      <div style={{ color: '#059669', fontWeight: '900', fontSize: '0.95rem' }}>
                        🎉 ¡Exacto! {subtractionProblems[subtractionIdx].subtrahend} + {userDiffRod.v} = {subtractionProblems[subtractionIdx].minuend}
                        <button
                          onClick={() => {
                            setUserDiffRod(null);
                            setSubtractionSolved(false);
                            setSubtractionIdx((subtractionIdx + 1) % subtractionProblems.length);
                          }}
                          style={{ display: 'block', margin: '6px auto 0', padding: '6px 12px', borderRadius: '8px', border: 'none', backgroundColor: '#0284C7', color: '#FFF', fontWeight: '900', cursor: 'pointer', fontSize: '0.85rem' }}
                        >
                          Siguiente Resta ▶
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: '#DC2626', fontWeight: '800', fontSize: '0.85rem' }}>
                        No encaja exacto. ¡Prueba otra regleta!
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {renderPalette(sandboxMode === 'subtraction' ? handleSelectDiffRod : addToBoard)}
        </div>
      )}

      {view === 'geoplano' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {renderTopBar('Geoplano Activo')}

          {/* Serie de retos: figuras, perímetros o áreas */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', padding: '6px 8px', backgroundColor: '#F1F5F9', flexShrink: 0 }}>
            {[
              { id: 'figuras',   label: '📐 Figuras' },
              { id: 'perimetro', label: '📏 Perímetro' },
              { id: 'area',      label: '🟩 Área' }
            ].map(g => (
              <button
                key={g.id}
                onClick={() => { setGeoGrupo(g.id); setGeoChallengeIdx(0); clearGeoplano(); }}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: '900',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  flex: 1,
                  maxWidth: '120px',
                  backgroundColor: geoGrupo === g.id ? '#059669' : '#FFFFFF',
                  color: geoGrupo === g.id ? '#FFFFFF' : '#475569',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
              >
                {g.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 10px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{
              backgroundColor: '#FFFFFF',
              padding: '8px 12px',
              borderRadius: '12px',
              textAlign: 'center',
              width: '100%',
              maxWidth: '320px',
              marginBottom: '8px',
              border: '1.5px solid #E2E8F0',
              boxSizing: 'border-box'
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '900', color: '#059669' }}>RETO {geoChallengeIdx + 1}/{geoChallenges.length}</span>
              <div style={{ fontSize: '0.95rem', fontWeight: '900', color: '#1E293B' }}>{geoChallenges[geoChallengeIdx].title}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '1px' }}>{geoChallenges[geoChallengeIdx].desc}</div>
            </div>

            <div style={{
              backgroundColor: '#FFFFFF',
              padding: '10px',
              borderRadius: '18px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              border: '2px solid #E2E8F0',
              touchAction: 'none'
            }}>
              <svg width="220" height="220" viewBox="0 0 220 220">
                {[0, 1, 2, 3, 4].map(i => (
                  <g key={`grid-${i}`}>
                    <line x1={22 + i * 44} y1="22" x2={22 + i * 44} y2="198" stroke="#F1F5F9" strokeWidth="2" />
                    <line x1="22" y1={22 + i * 44} x2="198" y2={22 + i * 44} stroke="#F1F5F9" strokeWidth="2" />
                  </g>
                ))}

                {geoClosed && geoPegs.length >= 3 && (
                  <polygon
                    points={geoPegs.map(p => `${22 + p.x * 44},${22 + p.y * 44}`).join(' ')}
                    fill={validateShape(geoPegs, geoChallenges[geoChallengeIdx]) ? "rgba(16, 185, 129, 0.45)" : "rgba(239, 68, 68, 0.35)"}
                    stroke={validateShape(geoPegs, geoChallenges[geoChallengeIdx]) ? "#10B981" : "#EF4444"}
                    strokeWidth="4"
                  />
                )}

                {!geoClosed && geoPegs.length > 1 && (
                  <polyline
                    points={geoPegs.map(p => `${22 + p.x * 44},${22 + p.y * 44}`).join(' ')}
                    fill="none"
                    stroke="#0EA5E9"
                    strokeWidth="4"
                    strokeDasharray="4,4"
                  />
                )}

                {[0, 1, 2, 3, 4].map(x => (
                  [0, 1, 2, 3, 4].map(y => {
                    const isSelected = geoPegs.some(p => p.x === x && p.y === y);
                    const isFirst = geoPegs.length > 0 && geoPegs[0].x === x && geoPegs[0].y === y;
                    return (
                      <g key={`peg-${x}-${y}`} onClick={() => handlePegClick(x, y)} style={{ cursor: 'pointer' }}>
                        <circle
                          cx={22 + x * 44}
                          cy={22 + y * 44}
                          r={isSelected ? "10" : "6"}
                          fill={isFirst && !geoClosed ? "#F43F5E" : isSelected ? "#0284C7" : "#CBD5E1"}
                        />
                        <circle cx={22 + x * 44} cy={22 + y * 44} r="2.5" fill="#FFFFFF" />
                      </g>
                    );
                  })
                ))}
              </svg>
            </div>

            {/* Medidas en vivo de la figura que se está construyendo */}
            {geoPegs.length >= 3 && (geoGrupo === 'perimetro' || geoGrupo === 'area') && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                {geoGrupo === 'perimetro' ? (
                  <div style={{ backgroundColor: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '10px', padding: '5px 12px', fontSize: '0.85rem', fontWeight: '900', color: '#1E293B' }}>
                    📏 Perímetro:{' '}
                    <span style={{ color: isRectilinear(geoPegs) ? '#059669' : '#DC2626' }}>
                      {isRectilinear(geoPegs) ? `${polyPerimeter(geoPegs)} u` : 'lados inclinados'}
                    </span>
                  </div>
                ) : (
                  <div style={{ backgroundColor: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '10px', padding: '5px 12px', fontSize: '0.85rem', fontWeight: '900', color: '#1E293B' }}>
                    🟩 Área: <span style={{ color: '#059669' }}>{polyArea(geoPegs)} u²</span>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              {geoPegs.length >= 3 && !geoClosed && (
                <button
                  onClick={() => handlePegClick(geoPegs[0].x, geoPegs[0].y)}
                  style={{ padding: '6px 14px', borderRadius: '10px', border: 'none', backgroundColor: '#10B981', color: '#FFF', fontWeight: '900', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  🔒 Cerrar
                </button>
              )}
              <button
                onClick={clearGeoplano}
                style={{ padding: '6px 14px', borderRadius: '10px', border: '1.5px solid #CBD5E1', backgroundColor: '#FFF', color: '#475569', fontWeight: '900', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                🧹 Limpiar
              </button>
            </div>

            {geoClosed && (
              <div style={{ marginTop: '8px', textAlign: 'center' }}>
                {validateShape(geoPegs, geoChallenges[geoChallengeIdx]) ? (
                  <div style={{ color: '#059669', fontWeight: '900', fontSize: '0.95rem' }}>
                    🎉 ¡Figura correcta!
                    <button
                      onClick={() => {
                        clearGeoplano();
                        setGeoChallengeIdx((geoChallengeIdx + 1) % geoChallenges.length);
                      }}
                      style={{ display: 'block', margin: '6px auto 0', padding: '6px 14px', borderRadius: '8px', border: 'none', backgroundColor: '#059669', color: '#FFF', fontWeight: '900', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      Siguiente Reto ▶
                    </button>
                  </div>
                ) : (
                  <div style={{ color: '#DC2626', fontWeight: '800', fontSize: '0.85rem' }}>
                    ⚠️ {motivoFalloGeo(geoPegs, geoChallenges[geoChallengeIdx])}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'estimacion' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {renderTopBar(estModo === 'precio' ? 'Estimar precios' : 'Estimar tamaños')}

          {/* Qué se estima: tamaños (comparando) o precios (por sí solos) */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', padding: '6px 8px', backgroundColor: '#F1F5F9', flexShrink: 0 }}>
            {[
              { id: 'tamano', label: '📏 Tamaños' },
              { id: 'precio', label: '🛒 Precios' }
            ].map(m => (
              <button
                key={m.id}
                onClick={() => setEstModo(m.id)}
                style={{
                  padding: '6px 10px', borderRadius: '8px', border: 'none',
                  fontWeight: '900', fontSize: '0.8rem', cursor: 'pointer',
                  flex: 1, maxWidth: '140px',
                  backgroundColor: estModo === m.id ? '#DB2777' : '#FFFFFF',
                  color: estModo === m.id ? '#FFFFFF' : '#475569',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          {estModo === 'precio' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 10px', overflowY: 'auto', gap: '8px', WebkitOverflowScrolling: 'touch' }}>
              <div style={{
                backgroundColor: '#FFFFFF', padding: '8px 12px', borderRadius: '12px',
                textAlign: 'center', width: '100%', maxWidth: '360px',
                border: '1.5px solid #E2E8F0', boxSizing: 'border-box'
              }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '900', color: '#DB2777' }}>
                  ARTÍCULO {preIdx + 1}/{preciosArticulos.length}
                </span>
                <div style={{ fontSize: '0.95rem', fontWeight: '900', color: '#1E293B' }}>
                  ¿Cuánto cuesta {preArt.art} {preArt.nombre.toLowerCase()} en {preArt.tienda}?
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '1px' }}>
                  Piensa en el precio medio
                </div>
              </div>

              {/* Artículo */}
              <div style={{
                width: '100%', maxWidth: '360px', boxSizing: 'border-box',
                backgroundColor: '#F8FAFC', borderRadius: '16px',
                border: '1.5px solid #E2E8F0', padding: '12px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px'
              }}>
                {renderArticulo(preArt.sil)}
                <div style={{ fontSize: '0.82rem', fontWeight: '900', color: '#0F172A', textAlign: 'center' }}>
                  {preArt.nombre}
                  <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748B' }}>
                    🏪 en {preArt.tienda}
                  </div>
                </div>
              </div>

              {/* FASE 1: estimar el precio */}
              {preNota === null ? (
                <>
                  <div style={{
                    fontSize: '2rem', fontWeight: '900', color: '#DB2777',
                    fontVariantNumeric: 'tabular-nums', lineHeight: 1.1
                  }}>
                    {precioATexto(prePrecio)}
                  </div>
                  <div style={{ width: '100%', maxWidth: '360px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#94A3B8' }}>0,20 €</span>
                    <input
                      type="range" min={0} max={escalaPrecios.length - 1} step={1} value={preIdxSlider}
                      onChange={e => setPreT(Number(e.target.value))}
                      style={{ flex: 1, accentColor: '#DB2777', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#94A3B8' }}>40 €</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      onClick={() => setPreT(Math.max(0, preIdxSlider - 1))}
                      style={{ padding: '5px 14px', borderRadius: '10px', border: '1.5px solid #CBD5E1', backgroundColor: '#FFF', fontWeight: '900', fontSize: '1rem', cursor: 'pointer' }}
                    >
                      ➖
                    </button>
                    <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#94A3B8' }}>ajuste fino</span>
                    <button
                      onClick={() => setPreT(Math.min(escalaPrecios.length - 1, preIdxSlider + 1))}
                      style={{ padding: '5px 14px', borderRadius: '10px', border: '1.5px solid #CBD5E1', backgroundColor: '#FFF', fontWeight: '900', fontSize: '1rem', cursor: 'pointer' }}
                    >
                      ➕
                    </button>
                  </div>
                  <button
                    onClick={comprobarPrecio}
                    style={{
                      padding: '10px 26px', borderRadius: '14px', border: 'none',
                      background: 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)',
                      color: '#FFF', fontWeight: '900', fontSize: '0.95rem', cursor: 'pointer'
                    }}
                  >
                    ✅ Comprobar
                  </button>
                </>
              ) : (
                <>
                  {/* Resultado de la fase 1 */}
                  <div style={{
                    width: '100%', maxWidth: '360px', boxSizing: 'border-box', textAlign: 'center',
                    backgroundColor: '#FFFFFF', borderRadius: '14px', padding: '10px 14px',
                    border: `2px solid ${preNota >= 70 ? '#10B981' : preNota >= 40 ? '#F59E0B' : '#EF4444'}`
                  }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: '900', color: '#64748B' }}>TU NOTA</div>
                    <div style={{ fontSize: '2rem', fontWeight: '900', lineHeight: 1, color: preNota >= 70 ? '#059669' : preNota >= 40 ? '#D97706' : '#DC2626' }}>
                      {preNota}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#334155', marginTop: '5px' }}>
                      Dijiste <b>{precioATexto(prePrecio)}</b> y {preArt.art} {preArt.nombre.toLowerCase()} cuesta{' '}
                      <b style={{ color: '#059669' }}>{precioATexto(preArt.precio)}</b>.
                    </div>
                  </div>

                  {/* FASE 2: cuánto costarían varios */}
                  {preCompra && (
                    <div style={{
                      width: '100%', maxWidth: '360px', boxSizing: 'border-box',
                      backgroundColor: '#FFFFFF', borderRadius: '14px', padding: '10px 14px',
                      border: '2px solid #C7D2FE'
                    }}>
                      <div style={{ fontSize: '0.92rem', fontWeight: '900', color: '#1E293B', textAlign: 'center' }}>
                        Y si compras <span style={{ color: '#4F46E5' }}>{preCompra.n}</span> {preArt.plural}, ¿cuánto sería?
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B', textAlign: 'center', marginTop: '1px' }}>
                        Elige el resultado más aproximado
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px', marginTop: '9px' }}>
                        {preCompra.opciones.map(v => {
                          const elegida  = preElegida === v;
                          const esBuena  = v === preCompra.correcta;
                          const resuelto = preElegida !== null;
                          const fondo = !resuelto ? '#EEF2FF'
                            : esBuena ? '#DCFCE7'
                            : elegida ? '#FEE2E2' : '#F1F5F9';
                          const borde = !resuelto ? '#C7D2FE'
                            : esBuena ? '#16A34A'
                            : elegida ? '#DC2626' : '#E2E8F0';
                          return (
                            <button
                              key={`compra-${v}`}
                              onClick={() => elegirCompra(v)}
                              disabled={resuelto}
                              style={{
                                padding: '10px 6px', borderRadius: '12px',
                                border: `2px solid ${borde}`, backgroundColor: fondo,
                                fontWeight: '900', fontSize: '1rem', color: '#1E293B',
                                cursor: resuelto ? 'default' : 'pointer'
                              }}
                            >
                              aprox. {v} €
                              {resuelto && esBuena  && <span style={{ marginLeft: 4 }}>✅</span>}
                              {resuelto && !esBuena && elegida && <span style={{ marginLeft: 4 }}>❌</span>}
                            </button>
                          );
                        })}
                      </div>
                      {preElegida !== null && (
                        <div style={{ fontSize: '0.78rem', color: '#334155', textAlign: 'center', marginTop: '9px' }}>
                          {preCompra.n} × {precioATexto(preArt.precio)} ={' '}
                          <b>{precioATexto(preCompra.n * preArt.precio)}</b>, o sea unos{' '}
                          <b style={{ color: '#4F46E5' }}>{preCompra.correcta} €</b>.
                        </div>
                      )}
                    </div>
                  )}

                  {preElegida !== null && (
                    <button
                      onClick={siguientePrecio}
                      style={{ padding: '8px 18px', borderRadius: '12px', border: 'none', backgroundColor: '#DB2777', color: '#FFF', fontWeight: '900', fontSize: '0.9rem', cursor: 'pointer' }}
                    >
                      Siguiente artículo ▶
                    </button>
                  )}
                </>
              )}

              {metrics.precios.length > 0 && (
                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94A3B8', textAlign: 'center' }}>
                  {metrics.precios.length} precios · nota media{' '}
                  {Math.round(metrics.precios.reduce((a, p) => a + p.nota, 0) / metrics.precios.length)}
                  {' · '}{metrics.precios.filter(p => p.acertoCompra).length} totales acertados
                </div>
              )}
            </div>
          )}

          {estModo === 'tamano' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 10px', overflowY: 'auto', gap: '8px', WebkitOverflowScrolling: 'touch' }}>
            <div style={{
              backgroundColor: '#FFFFFF', padding: '8px 12px', borderRadius: '12px',
              textAlign: 'center', width: '100%', maxWidth: '360px',
              border: '1.5px solid #E2E8F0', boxSizing: 'border-box'
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '900', color: '#DB2777' }}>
                RETO {estIdx + 1}/{estimacionRetos.length}
              </span>
              <div style={{ fontSize: '0.95rem', fontWeight: '900', color: '#1E293B' }}>
                ¿Cuánto mide <span style={{ color: '#DB2777' }}>{estReto.obj.dimTexto || (estReto.obj.dim === 'alto' ? 'de alto' : 'de largo')}</span> {estReto.obj.art} {estReto.obj.nombre.toLowerCase()}?
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '1px' }}>
                Compáralo con {estReto.ref.art} {estReto.ref.nombre.toLowerCase()} de {estReto.ref.medida.toString().replace('.', ',')} {estReto.ref.unidad} {estReto.ref.dimTexto || (estReto.ref.dim === 'alto' ? 'de alto' : 'de largo')}
              </div>
            </div>

            {/* Escena: ambos objetos apoyados en la misma línea de suelo.
                Si la pareja no cabe, se reduce el conjunto entero (la comparación
                es relativa, así que encogerlos a la vez no altera el reto). */}
            <div style={{
              width: '100%', maxWidth: '360px', boxSizing: 'border-box',
              backgroundColor: '#F8FAFC', borderRadius: '16px',
              border: '1.5px solid #E2E8F0', borderBottom: '4px solid #94A3B8',
              padding: '10px', height: `${EST_MAX_PX + 66}px`,
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              overflow: 'hidden'
            }}>
              <div style={{
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '18px',
                transform: `scale(${estFit})`, transformOrigin: 'bottom center'
              }}>
                {/* Referencia */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {formaEst(estReto.ref, EST_REF_PX, '#0284C7')}
                  {etiquetaEst(estReto.ref, estReto.ref.medida.toString().replace('.', ','), '#0284C7', 1 / estFit)}
                </div>

                {/* Objeto a estimar, con la sombra del tamaño correcto al corregir */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                    {estNota !== null && (
                      <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', opacity: 0.3, pointerEvents: 'none' }}>
                        {formaEst(estReto.obj, estTamCorrecto, 'transparent')}
                      </div>
                    )}
                    {formaEst(estReto.obj, estTam, estNota === null ? '#DB2777' : '#059669')}
                  </div>
                  {etiquetaEst(
                    estReto.obj,
                    estNota === null ? '¿?' : estReto.obj.medida.toString().replace('.', ','),
                    estNota === null ? '#DB2777' : '#059669',
                    1 / estFit
                  )}
                </div>
              </div>
            </div>

            {/* Control de tamaño */}
            <div style={{ width: '100%', maxWidth: '360px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setEstTam(t => Math.max(EST_MIN_PX, t - 3))}
                disabled={estNota !== null}
                style={{ padding: '6px 12px', borderRadius: '10px', border: '1.5px solid #CBD5E1', backgroundColor: '#FFF', fontWeight: '900', fontSize: '1rem', cursor: estNota !== null ? 'default' : 'pointer' }}
              >
                ➖
              </button>
              <input
                type="range"
                min={EST_MIN_PX}
                max={EST_MAX_PX}
                value={estTam}
                disabled={estNota !== null}
                onChange={e => setEstTam(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#DB2777', cursor: estNota !== null ? 'default' : 'pointer' }}
              />
              <button
                onClick={() => setEstTam(t => Math.min(EST_MAX_PX, t + 3))}
                disabled={estNota !== null}
                style={{ padding: '6px 12px', borderRadius: '10px', border: '1.5px solid #CBD5E1', backgroundColor: '#FFF', fontWeight: '900', fontSize: '1rem', cursor: estNota !== null ? 'default' : 'pointer' }}
              >
                ➕
              </button>
            </div>

            {estNota === null ? (
              <button
                onClick={comprobarEstimacion}
                style={{
                  padding: '10px 26px', borderRadius: '14px', border: 'none',
                  background: 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)',
                  color: '#FFF', fontWeight: '900', fontSize: '0.95rem', cursor: 'pointer'
                }}
              >
                ✅ Comprobar
              </button>
            ) : (
              <div style={{ textAlign: 'center', width: '100%', maxWidth: '360px' }}>
                <div style={{
                  backgroundColor: '#FFFFFF', border: `2px solid ${estNota >= 70 ? '#10B981' : estNota >= 40 ? '#F59E0B' : '#EF4444'}`,
                  borderRadius: '16px', padding: '10px 14px'
                }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: '900', color: '#64748B' }}>TU NOTA</div>
                  <div style={{ fontSize: '2.4rem', fontWeight: '900', lineHeight: 1, color: estNota >= 70 ? '#059669' : estNota >= 40 ? '#D97706' : '#DC2626' }}>
                    {estNota}
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#475569', marginTop: '4px' }}>
                    {estNota === 100 ? '🎯 ¡Clavado!'
                      : estNota >= 70 ? '🌟 ¡Muy buena estimación!'
                      : estNota >= 40 ? '👍 Te has acercado'
                      : '💪 Fíjate en la sombra: ese era el tamaño'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '6px' }}>
                    {estReto.obj.art === 'una' ? 'Una' : 'Un'} {estReto.obj.nombre.toLowerCase()} mide{' '}
                    <b>{estReto.obj.medida.toString().replace('.', ',')} {estReto.obj.unidad} {estReto.obj.dimTexto || (estReto.obj.dim === 'alto' ? 'de alto' : 'de largo')}</b>, o sea{' '}
                    <b>{(estReto.obj.medida / estReto.ref.medida).toFixed(1).replace('.', ',')} veces</b> {estReto.ref.art} {estReto.ref.nombre.toLowerCase()}.
                    {' '}Tú lo hiciste <b>{Math.round((estTam / estTamCorrecto) * 100)}%</b> del tamaño correcto.
                  </div>
                </div>
                <button
                  onClick={siguienteEstimacion}
                  style={{ marginTop: '8px', padding: '8px 18px', borderRadius: '12px', border: 'none', backgroundColor: '#DB2777', color: '#FFF', fontWeight: '900', fontSize: '0.9rem', cursor: 'pointer' }}
                >
                  Siguiente ▶
                </button>
              </div>
            )}

            {metrics.estimaciones.length > 0 && (
              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94A3B8' }}>
                {metrics.estimaciones.length} estimaciones · nota media{' '}
                {Math.round(metrics.estimaciones.reduce((a, e) => a + e.nota, 0) / metrics.estimaciones.length)}
              </div>
            )}
          </div>
          )}
        </div>
      )}

      {view === 'paths' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {renderTopBar('Caminos Flexibles')}

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ fontSize: '2.2rem', fontWeight: '900', color: '#0F172A', margin: '8px 0' }}>
              {pathsProblems[pathsIdx].expr}
            </div>

            <div style={{
              backgroundColor: '#FFFFFF',
              padding: '14px 16px',
              borderRadius: '16px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
              border: '1.5px solid #E2E8F0',
              maxWidth: '360px',
              width: '100%',
              marginBottom: '14px',
              boxSizing: 'border-box'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '1.6rem' }}>{pathsProblems[pathsIdx].avatar}</span>
                <span style={{ fontWeight: '900', color: '#0284C7', fontSize: '0.95rem' }}>
                  Estrategia de {pathsProblems[pathsIdx].name}:
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', lineHeight: '1.4', fontWeight: '600' }}>
                "{pathsProblems[pathsIdx].strat}"
              </p>
            </div>

            {/* Escribe tu propia estrategia */}
            <div style={{
              backgroundColor: '#FFFFFF',
              padding: '12px 14px',
              borderRadius: '16px',
              border: '2px solid #FDE68A',
              maxWidth: '360px',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span style={{ fontSize: '1.2rem' }}>✍️</span>
                <span style={{ fontWeight: '900', color: '#B45309', fontSize: '0.9rem' }}>¿Cómo lo piensas tú?</span>
              </div>
              <textarea
                value={pathsTexto}
                onChange={e => { setPathsTexto(e.target.value); setPathsGuardado(false); }}
                placeholder="Escribe con tus palabras cómo has resuelto esta operación…"
                rows={4}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '9px 11px',
                  borderRadius: '12px',
                  border: '1.5px solid #E2E8F0',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                  color: '#1E293B',
                  lineHeight: '1.4',
                  resize: 'vertical',
                  outline: 'none',
                  userSelect: 'text'
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                <button
                  onClick={guardarEstrategia}
                  disabled={!pathsTexto.trim()}
                  style={{
                    flex: 1,
                    padding: '9px 14px',
                    borderRadius: '12px',
                    border: 'none',
                    backgroundColor: pathsGuardado ? '#10B981' : pathsTexto.trim() ? '#F59E0B' : '#CBD5E1',
                    color: '#FFF',
                    fontWeight: '900',
                    fontSize: '0.9rem',
                    cursor: pathsTexto.trim() ? 'pointer' : 'default'
                  }}
                >
                  {pathsGuardado ? '¡Guardada! 🎉' : '💾 Guardar mi estrategia'}
                </button>
              </div>
              <div style={{ marginTop: '6px', fontSize: '0.72rem', color: '#94A3B8', fontWeight: '600' }}>
                Guardadas: {estrategias.length}/{pathsProblems.length} · se envían al profesor desde el menú
              </div>
            </div>

            {/* Navegación entre problemas */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
              <button
                onClick={() => irAProblema(pathsIdx - 1)}
                style={{ padding: '6px 14px', borderRadius: '10px', border: '1.5px solid #CBD5E1', backgroundColor: '#FFF', fontWeight: '900', fontSize: '0.9rem', cursor: 'pointer' }}
              >
                ◀
              </button>
              <span style={{ fontWeight: '900', color: '#475569', fontSize: '0.85rem' }}>
                {pathsIdx + 1}/{pathsProblems.length}
              </span>
              <button
                onClick={() => irAProblema(pathsIdx + 1)}
                style={{ padding: '6px 14px', borderRadius: '10px', border: '1.5px solid #CBD5E1', backgroundColor: '#FFF', fontWeight: '900', fontSize: '0.9rem', cursor: 'pointer' }}
              >
                ▶
              </button>
            </div>

            <button
              onClick={() => setMostrarEnvio(true)}
              style={{
                marginTop: '14px',
                padding: '10px 20px',
                borderRadius: '14px',
                border: 'none',
                background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
                color: '#FFF',
                fontWeight: '900',
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              📤 Enviar al profesor
            </button>
          </div>
        </div>
      )}

      {mostrarEnvio && (
        <ModalEnviarProfeOAOA resumen={resumenEnvio} onClose={() => setMostrarEnvio(false)} />
      )}
    </div>
  );
}