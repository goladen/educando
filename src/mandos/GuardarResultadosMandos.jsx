// 📤 Guardar los resultados de una partida con mandos micro:bit en los informes del profesor
// (colección informes_juegos, como el resto de juegos: se ven en «Informes» con el código del profesor).
// Un solo informe con todos los mandos: el profe pone su código (se rellena solo si ha iniciado sesión),
// el curso o grupo, y puede corregir los nombres de los mandos antes de guardar (se recuerdan en
// pikt_mandos_nombres, compartido por todos los juegos de mandos). Los mandos virtuales (id > 900)
// no se guardan salvo que se marquen.
//
// jugadores: [{ id, nombre, aciertos, intentos, fallos?, puntos?, extra? }]
import React, { useEffect, useMemo, useState } from 'react';
import { collection, addDoc, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';

const LS_NOMBRES = 'pikt_mandos_nombres';
const LS_CODIGO = 'pikt_codigo_profe_mandos';
const leer = (k, def) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? def; } catch { return def; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
const esVirtual = (id) => Number(id) > 900;
// Firestore no admite undefined ni funciones: solo números, textos, booleanos y listas/objetos de eso
const limpio = (v) => JSON.parse(JSON.stringify(v ?? null));

/** Botón «📤 Guardar resultados» + ventana. Pásale `estilo` para que encaje con el juego. */
export default function GuardarResultadosMandos({ tipo, juego, jugadores, recursoTitulo = '', hoja = '', config = null, estilo, texto = '📤 Guardar resultados (código del profesor)' }) {
  const [abierto, setAbierto] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const hay = (jugadores || []).length > 0;
  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        disabled={!hay}
        title={hay ? 'Guarda los resultados de todos los mandos en tus informes' : 'No hay jugadores'}
        style={{ padding: '12px 20px', borderRadius: 14, border: 'none', background: guardado ? '#15803d' : 'linear-gradient(135deg,#f1c40f,#e67e22)', color: '#fff', fontWeight: 800, fontSize: '0.95rem', cursor: hay ? 'pointer' : 'not-allowed', fontFamily: 'inherit', ...estilo }}
      >
        {guardado ? '✅ Resultados guardados' : texto}
      </button>
      {abierto && (
        <Ventana
          tipo={tipo} juego={juego} jugadores={jugadores} recursoTitulo={recursoTitulo} hoja={hoja} config={config}
          onGuardado={() => setGuardado(true)} yaGuardado={guardado} onClose={() => setAbierto(false)}
        />
      )}
    </>
  );
}

function Ventana({ tipo, juego, jugadores, recursoTitulo, hoja, config, onGuardado, yaGuardado, onClose }) {
  const [codigo, setCodigo] = useState(() => leer(LS_CODIGO, ''));
  const [curso, setCurso] = useState('');
  const [nombres, setNombres] = useState(() => Object.fromEntries(jugadores.map((j) => [j.id, j.nombre || ''])));
  const [incluir, setIncluir] = useState(() => Object.fromEntries(jugadores.map((j) => [j.id, !esVirtual(j.id)])));
  const [estado, setEstado] = useState({ enviando: false, error: '', hecho: false });

  // Profe con sesión iniciada: su código se busca solo
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || codigo) return;
    getDocs(query(collection(db, 'codigos_profesor'), where('uid', '==', uid)))
      .then((s) => { if (!s.empty) setCodigo((c) => c || s.docs[0].id); })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filas = useMemo(() => jugadores.map((j) => {
    const intentos = j.intentos ?? (j.aciertos || 0) + (j.fallos || 0);
    return { ...j, intentos, porcentaje: intentos > 0 ? Math.round(((j.aciertos || 0) / intentos) * 100) : 0 };
  }), [jugadores]);
  const elegidos = filas.filter((j) => incluir[j.id]);

  const guardar = async () => {
    const code = codigo.trim().toUpperCase();
    if (!code) { setEstado({ enviando: false, error: 'Escribe el código del profesor.', hecho: false }); return; }
    if (!elegidos.length) { setEstado({ enviando: false, error: 'Marca al menos un jugador.', hecho: false }); return; }
    if (elegidos.some((j) => !String(nombres[j.id] || '').trim())) { setEstado({ enviando: false, error: 'Falta el nombre de algún jugador.', hecho: false }); return; }
    setEstado({ enviando: true, error: '', hecho: false });
    try {
      const snap = await getDoc(doc(db, 'codigos_profesor', code));
      if (!snap.exists()) { setEstado({ enviando: false, error: 'Código no encontrado.', hecho: false }); return; }
      const jugs = elegidos.map((j) => ({
        nombre: String(nombres[j.id]).trim().slice(0, 60),
        curso: curso.trim().slice(0, 40),
        mando: Number(j.id),
        aciertos: j.aciertos || 0,
        intentos: j.intentos,
        fallos: j.fallos ?? Math.max(0, j.intentos - (j.aciertos || 0)),
        porcentaje: j.porcentaje,
        precision: j.porcentaje,
        ...(j.puntos != null ? { puntos: j.puntos } : {}),
        ...(j.extra ? limpio(j.extra) : {}),
      }));
      await addDoc(collection(db, 'informes_juegos'), {
        tipo,
        juego: juego || '',
        modalidad: 'Mandos micro:bit',
        fecha: new Date(),
        codigoProfesor: code,
        ...(recursoTitulo ? { recursoTitulo: String(recursoTitulo).slice(0, 120) } : {}),
        ...(hoja ? { hoja: String(hoja).slice(0, 80) } : {}),
        ...(config ? { config: limpio(config) } : {}),
        numJugadores: jugs.length,
        jugadores: jugs,
      });
      escribir(LS_CODIGO, code);
      // Los nombres corregidos se recuerdan para todos los juegos de mandos
      const guardados = leer(LS_NOMBRES, {}) || {};
      elegidos.forEach((j) => { const n = String(nombres[j.id]).trim(); if (n && !esVirtual(j.id)) guardados[j.id] = n; });
      escribir(LS_NOMBRES, guardados);
      setEstado({ enviando: false, error: '', hecho: true });
      onGuardado?.();
    } catch (e) {
      setEstado({ enviando: false, error: 'No se ha podido guardar: ' + (e?.message || e), hecho: false });
    }
  };

  const inp = { padding: '8px 10px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 12 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#1e272e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 18, width: '100%', maxWidth: 560, maxHeight: '92vh', overflow: 'auto', padding: '20px 22px', color: 'white', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f1c40f' }}>📤 Guardar resultados · {juego}</h3>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
        </div>
        {estado.hecho ? (
          <div style={{ textAlign: 'center', padding: '18px 0' }}>
            <div style={{ fontSize: '3rem' }}>✅</div>
            <div style={{ color: '#2ecc71', fontWeight: 700 }}>¡Guardado en los informes!</div>
            <div style={{ color: '#aaa', fontSize: '0.88rem', marginTop: 8 }}>{elegidos.length} jugadores · código {codigo.trim().toUpperCase()}</div>
            <button onClick={onClose} style={{ marginTop: 16, padding: '9px 22px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: 'white' }}>Cerrar</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {yaGuardado && <div style={{ background: 'rgba(250,204,21,.12)', border: '1px solid rgba(250,204,21,.4)', color: '#fde68a', borderRadius: 10, padding: '7px 10px', fontSize: '0.82rem' }}>Esta partida ya está guardada: si la guardas otra vez saldrá repetida en los informes.</div>}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <label style={{ flex: '1 1 160px', fontSize: '0.78rem', color: '#aaa', fontWeight: 600 }}>Código del profesor
                <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="Ej: PROF01" maxLength={12} style={{ ...inp, letterSpacing: 2, fontWeight: 700, marginTop: 4 }} />
              </label>
              <label style={{ flex: '1 1 160px', fontSize: '0.78rem', color: '#aaa', fontWeight: 600 }}>Curso o grupo (opcional)
                <input value={curso} onChange={(e) => setCurso(e.target.value)} placeholder="Ej: 2º ESO B" style={{ ...inp, marginTop: 4 }} />
              </label>
            </div>
            {(recursoTitulo || hoja) && <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>📚 {recursoTitulo}{hoja ? ` · 📄 ${hoja}` : ''}</div>}
            <div style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600 }}>Jugadores (puedes corregir los nombres)</div>
            <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: 6, maxHeight: 300, overflow: 'auto' }}>
              {filas.map((j) => (
                <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', borderBottom: '1px solid rgba(255,255,255,0.06)', opacity: incluir[j.id] ? 1 : 0.45 }}>
                  <input type="checkbox" checked={!!incluir[j.id]} onChange={(e) => setIncluir((x) => ({ ...x, [j.id]: e.target.checked }))} title="Guardar este jugador" />
                  <span style={{ width: 42, fontSize: '0.75rem', color: '#94a3b8' }}>{esVirtual(j.id) ? `V${j.id - 900}` : `#${j.id}`}</span>
                  <input value={nombres[j.id] || ''} onChange={(e) => setNombres((x) => ({ ...x, [j.id]: e.target.value }))} placeholder="Nombre" style={{ ...inp, padding: '5px 8px', flex: 1, width: 'auto' }} />
                  <span style={{ fontSize: '0.8rem', color: '#86efac', whiteSpace: 'nowrap' }}>✓ {j.aciertos || 0}/{j.intentos}</span>
                  {j.puntos != null && <span style={{ fontSize: '0.8rem', color: '#fde68a', whiteSpace: 'nowrap' }}>{j.puntos} pts</span>}
                </div>
              ))}
            </div>
            {estado.error && <div style={{ color: '#f87171', fontSize: '0.82rem' }}>⚠ {estado.error}</div>}
            <div style={{ display: 'flex', gap: 9 }}>
              <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer', color: 'white' }}>Cancelar</button>
              <button onClick={guardar} disabled={estado.enviando} style={{ flex: 2, padding: 10, borderRadius: 10, border: 'none', background: estado.enviando ? '#555' : 'linear-gradient(135deg,#3498db,#2980b9)', color: 'white', fontWeight: 700, cursor: estado.enviando ? 'default' : 'pointer' }}>
                {estado.enviando ? 'Guardando…' : `📤 Guardar ${elegidos.length} jugador${elegidos.length === 1 ? '' : 'es'}`}
              </button>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Se guarda un informe con todos los jugadores; lo verás en <b>Informes</b> con tu código.</div>
          </div>
        )}
      </div>
    </div>
  );
}
