import React, { useState, useEffect, useCallback, useRef } from 'react';
import { auth, db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  createRace, startRace, finishRace, listenRace, listenPlayers,
  saveRaceReport, fmtMs, sortByTime, sortByScore,
} from './kartingOnlineUtils';

const ST = {
  page:  { minHeight:'100vh', background:'linear-gradient(135deg,#0a0f2e,#0f1a3e,#0a0f2e)', color:'white', fontFamily:"'Segoe UI',sans-serif", display:'flex', flexDirection:'column', alignItems:'center', padding:'28px 18px', overflowY:'auto' },
  title: { fontSize:'1.7rem', fontWeight:900, background:'linear-gradient(90deg,#FF6B00,#FFD700)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', margin:'0 0 4px' },
  card:  { background:'rgba(255,255,255,0.05)', border:'1.5px solid rgba(255,255,255,0.10)', borderRadius:14, padding:'16px 18px', width:'100%', maxWidth:740, marginBottom:14 },
  btn:   (col='#FF6B00') => ({ padding:'10px 22px', borderRadius:10, border:'none', background:`linear-gradient(90deg,${col},${col}cc)`, color:'white', fontWeight:700, cursor:'pointer', fontSize:'0.9rem' }),
  btnSm: { padding:'7px 16px', borderRadius:9, border:'1px solid rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.08)', color:'white', cursor:'pointer', fontSize:'0.82rem', fontWeight:600 },
  label: { color:'rgba(255,255,255,0.55)', fontSize:'0.75rem', fontWeight:700, letterSpacing:1.5, marginBottom:6, display:'block' },
  input: { width:'100%', padding:'9px 13px', borderRadius:9, border:'1px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.08)', color:'white', fontSize:'0.9rem', outline:'none', boxSizing:'border-box' },
  tag:   (active,col='#FF6B00') => ({ padding:'5px 13px', borderRadius:20, border:`1.5px solid ${active?col:'rgba(255,255,255,0.18)'}`, background:active?`${col}28`:'transparent', color:active?col:'rgba(255,255,255,0.45)', cursor:'pointer', fontSize:'0.78rem', fontWeight:active?700:400 }),
};

// ── Medals helper ─────────────────────────────────────────────────────────────
const medal = i => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;

// ── Ranking row ───────────────────────────────────────────────────────────────
function PlayerRow({ p, pos, laps, tab, startTime }) {
  const elapsed = startTime ? Math.max(0, Date.now() - startTime) : 0;
  const isFin = p.status === 'FINISHED';

  let timeStr = '--';
  if (isFin && p.finishTime != null) {
    timeStr = fmtMs(p.finishTime);
  } else if (p.status === 'RACING') {
    timeStr = fmtMs(elapsed);
  }

  const lapStr = isFin ? `✅ ${laps}/${laps}` : `🏎️ ${(p.lapsCompleted || 0) + 1}/${laps}`;

  return (
    <tr style={{ background: pos % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
      <td style={{ padding:'8px 10px', fontSize:'1.05rem', width:36 }}>{medal(pos)}</td>
      <td style={{ padding:'8px 6px', fontWeight:600, fontSize:'0.9rem' }}>{p.nombre}</td>
      <td style={{ padding:'8px 6px', color:'rgba(255,255,255,0.5)', fontSize:'0.8rem', whiteSpace:'nowrap' }}>{lapStr}</td>
      {tab === 'time' ? (
        <>
          <td style={{ padding:'8px 10px', textAlign:'right', fontVariantNumeric:'tabular-nums', color: isFin ? '#FFD700' : '#aaa', fontWeight: isFin ? 700 : 400, fontSize:'0.88rem', whiteSpace:'nowrap' }}>{timeStr}</td>
          <td style={{ padding:'8px 6px', textAlign:'right', fontSize:'0.78rem', color:'rgba(255,255,255,0.35)', whiteSpace:'nowrap' }}>
            {isFin ? <span style={{color:'#2ecc71',fontWeight:700}}>🏁 Meta</span> : p.status === 'LOBBY' ? 'Lobby' : 'Corriendo'}
          </td>
        </>
      ) : (
        <>
          <td style={{ padding:'8px 10px', textAlign:'right', color:'#2ecc71', fontWeight:700, fontSize:'0.9rem' }}>✅ {p.aciertos || 0}</td>
          <td style={{ padding:'8px 6px', textAlign:'right', color:'#e74c3c', fontWeight:700, fontSize:'0.9rem' }}>❌ {p.fallos || 0}</td>
        </>
      )}
    </tr>
  );
}

// ── Tabla de ranking ──────────────────────────────────────────────────────────
function RankTable({ players, laps, tab, startTime }) {
  const sorted = tab === 'time' ? sortByTime(players) : sortByScore(players);
  if (!sorted.length) return <p style={{ color:'rgba(255,255,255,0.3)', textAlign:'center', margin:'24px 0' }}>Sin jugadores aún.</p>;

  return (
    <table style={{ width:'100%', borderCollapse:'collapse' }}>
      <thead>
        <tr style={{ color:'rgba(255,255,255,0.3)', fontSize:'0.7rem', letterSpacing:1 }}>
          <th style={{padding:'4px 10px',textAlign:'left',fontWeight:400}}>#</th>
          <th style={{padding:'4px 6px',textAlign:'left',fontWeight:400}}>Nombre</th>
          <th style={{padding:'4px 6px',textAlign:'left',fontWeight:400}}>Vuelta</th>
          {tab === 'time'
            ? <><th style={{padding:'4px 10px',textAlign:'right',fontWeight:400}}>Tiempo</th><th style={{padding:'4px 6px',textAlign:'right',fontWeight:400}}>Estado</th></>
            : <><th style={{padding:'4px 10px',textAlign:'right',fontWeight:400}}>Aciertos</th><th style={{padding:'4px 6px',textAlign:'right',fontWeight:400}}>Fallos</th></>
          }
        </tr>
      </thead>
      <tbody>
        {sorted.map((p, i) => <PlayerRow key={p.id} p={p} pos={i} laps={laps} tab={tab} startTime={startTime} />)}
      </tbody>
    </table>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function KartingCreateRace({ onVolver }) {
  const [fase,        setFase]        = useState('SETUP'); // SETUP | LOBBY | RACING | FINISHED
  const [raceId,      setRaceId]      = useState(null);
  const [raceCode,    setRaceCode]    = useState(null);
  const [raceDoc,     setRaceDoc]     = useState(null);
  const [players,     setPlayers]     = useState([]);
  const [tab,         setTab]         = useState('time');

  // Setup fields
  const [circuits,    setCircuits]    = useState([]);
  const [recursos,    setRecursos]    = useState([]);
  const [cargando,    setCargando]    = useState(true);
  const [circuitType, setCircuitType] = useState('PRESET_1'); // PRESET_1 | PRESET_2 | CUSTOM
  const [circuitSel,  setCircuitSel]  = useState(null);
  const [recursoSel,  setRecursoSel]  = useState(null);
  const [laps,        setLaps]        = useState(2);
  const [busqCirc,    setBusqCirc]    = useState('');
  const [busqRec,     setBusqRec]     = useState('');
  const [creating,    setCreating]    = useState(false);
  const [localCircuitNombre, setLocalCircuitNombre] = useState('');
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [copied,      setCopied]      = useState(false);
  const [ticker,      setTicker]      = useState(0); // for live timer refresh

  const unsubRace    = useRef(null);
  const unsubPlayers = useRef(null);

  // ── Cargar circuitos y recursos ─────────────────────────────────────────────
  useEffect(() => {
    const user = auth.currentUser;
    (async () => {
      try {
        const col = collection(db, 'resources');
        const queries = [
          getDocs(query(col, where('tipoJuego','==','CAZABURBUJAS'), where('isPrivate','==',false))),
          getDocs(query(col, where('tipoJuego','==','KARTINGED'),   where('isPrivate','==',false))),
        ];
        // If logged in, also include professor's own private resources
        if (user) {
          queries.push(getDocs(query(col, where('tipoJuego','==','CAZABURBUJAS'), where('userId','==',user.uid))));
          queries.push(getDocs(query(col, where('tipoJuego','==','KARTINGED'),   where('userId','==',user.uid))));
        }
        const results = await Promise.all(queries);
        const seen = new Set();
        const all = results.flatMap(s => s.docs)
          .filter(d => { if(seen.has(d.id)) return false; seen.add(d.id); return true; })
          .map(d => ({id:d.id,...d.data()}));
        setRecursos(all);

        const cs = await getDocs(query(collection(db,'circuitos'), where('isPublic','==',true)));
        setCircuits(cs.docs.map(d => ({id:d.id,...d.data()})));
      } catch(e) { console.error(e); }
      setCargando(false);
    })();
  }, []);

  // ── Live ticker for elapsed timer ──────────────────────────────────────────
  useEffect(() => {
    if (fase !== 'RACING') return;
    const id = setInterval(() => setTicker(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [fase]);

  // ── Cleanup listeners ─────────────────────────────────────────────────────
  useEffect(() => () => {
    unsubRace.current?.();
    unsubPlayers.current?.();
  }, []);

  // ── Crear partida ──────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (circuitType === 'CUSTOM' && !circuitSel) return;
    setCreating(true);
    try {
      const presetNames = { PRESET_1: 'Circuito 1 – Asfalto', PRESET_2: 'Circuito 2 – Tierra' };
      const resolvedNombre = circuitType === 'CUSTOM' ? circuitSel.nombre : presetNames[circuitType];
      setLocalCircuitNombre(resolvedNombre);
      const { raceId: id, code } = await createRace({
        circuitType,
        circuitId:    circuitType === 'CUSTOM' ? circuitSel.id    : null,
        circuitNombre: resolvedNombre,
        circuitData:  circuitType === 'CUSTOM' ? { paths: circuitSel.paths, objects: circuitSel.objects || [] } : null,
        recursoId:    recursoSel?.id || null,
        recursoNombre: recursoSel?.titulo || '',
        hojasSel:     [],
        laps,
      });
      setRaceId(id);
      setRaceCode(code);
      setFase('LOBBY');

      unsubRace.current = listenRace(id, d => {
        setRaceDoc(d);
        if (d.status === 'RACING'  && fase !== 'RACING')   setFase('RACING');
        if (d.status === 'FINISHED' && fase !== 'FINISHED') setFase('FINISHED');
      });
      unsubPlayers.current = listenPlayers(id, setPlayers);
    } catch(e) { alert('Error: ' + e.message); }
    setCreating(false);
  };

  // ── Iniciar carrera ────────────────────────────────────────────────────────
  const handleStart = async () => {
    await startRace(raceId);
    setFase('RACING');
  };

  // ── Terminar carrera ───────────────────────────────────────────────────────
  const handleFinish = async () => {
    if (!window.confirm('¿Terminar la carrera ahora? Los alumnos que no hayan terminado quedarán sin tiempo.')) return;
    await finishRace(raceId);
    setFase('FINISHED');
  };

  // ── Guardar informe ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!raceDoc) return;
    setSaving(true);
    try {
      await saveRaceReport(raceDoc, players);
      setSaved(true);
    } catch(e) { alert('Error al guardar: ' + e.message); }
    setSaving(false);
  };

  // ── Copiar código ─────────────────────────────────────────────────────────
  const copyCode = () => {
    navigator.clipboard.writeText(raceCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Filtros ────────────────────────────────────────────────────────────────
  const filtCircuits = circuits.filter(c =>
    !busqCirc || c.nombre?.toLowerCase().includes(busqCirc.toLowerCase())
  );
  const filtRecursos = recursos.filter(r =>
    !busqRec || r.titulo?.toLowerCase().includes(busqRec.toLowerCase())
  );
  const lobbyPlayers = players.filter(p => p.status === 'LOBBY' || p.status === 'RACING' || p.status === 'FINISHED');

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER: SETUP
  // ────────────────────────────────────────────────────────────────────────────
  if (fase === 'SETUP') return (
    <div style={ST.page}>
      <button onClick={onVolver} style={{...ST.btnSm, alignSelf:'flex-start', marginBottom:20}}>← Volver</button>
      <div style={{fontSize:'2.4rem', marginBottom:4}}>🌐</div>
      <h1 style={ST.title}>Crear Carrera Online</h1>
      <p style={{color:'rgba(255,255,255,0.45)', fontSize:'0.82rem', marginBottom:22, textAlign:'center'}}>
        Configura la partida. Los alumnos se unirán con el código que recibirás.
      </p>

      {/* Circuito */}
      <div style={ST.card}>
        <span style={ST.label}>🏁 CIRCUITO *</span>
        {/* Circuit type tabs */}
        <div style={{display:'flex', gap:8, marginBottom:14, flexWrap:'wrap'}}>
          {[
            { key:'PRESET_1', label:'🏎️ Circuito 1 – Asfalto' },
            { key:'PRESET_2', label:'🌍 Circuito 2 – Tierra' },
            { key:'CUSTOM',   label:'📦 Guardado' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => { setCircuitType(key); setCircuitSel(null); }} style={{
              ...ST.tag(circuitType === key),
              padding:'7px 16px', fontSize:'0.82rem',
            }}>{label}</button>
          ))}
        </div>

        {circuitType === 'PRESET_1' && (
          <div style={{display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:10, background:'rgba(255,107,0,0.12)', border:'1.5px solid rgba(255,107,0,0.35)'}}>
            <span style={{fontSize:'1.6rem'}}>🏎️</span>
            <div>
              <div style={{fontWeight:700, fontSize:'0.92rem'}}>Circuito 1 – Asfalto</div>
              <div style={{color:'rgba(255,255,255,0.4)', fontSize:'0.72rem', marginTop:2}}>Circuito predefinido de asfalto (14×10)</div>
            </div>
          </div>
        )}

        {circuitType === 'PRESET_2' && (
          <div style={{display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:10, background:'rgba(46,204,113,0.10)', border:'1.5px solid rgba(46,204,113,0.30)'}}>
            <span style={{fontSize:'1.6rem'}}>🌍</span>
            <div>
              <div style={{fontWeight:700, fontSize:'0.92rem'}}>Circuito 2 – Tierra</div>
              <div style={{color:'rgba(255,255,255,0.4)', fontSize:'0.72rem', marginTop:2}}>Circuito predefinido de tierra (18×14)</div>
            </div>
          </div>
        )}

        {circuitType === 'CUSTOM' && (
          <>
            <input style={{...ST.input, marginBottom:10}} placeholder="Buscar circuito…" value={busqCirc} onChange={e=>setBusqCirc(e.target.value)} />
            {cargando ? <p style={{color:'#aaa',fontSize:'0.8rem'}}>Cargando…</p> : (
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:8, maxHeight:220, overflowY:'auto'}}>
                {filtCircuits.map(c => (
                  <div key={c.id} onClick={() => setCircuitSel(c)} style={{
                    padding:'10px 13px', borderRadius:10, cursor:'pointer',
                    border:`1.5px solid ${circuitSel?.id===c.id?'#FF6B00':'rgba(255,255,255,0.13)'}`,
                    background: circuitSel?.id===c.id?'rgba(255,107,0,0.15)':'rgba(255,255,255,0.04)',
                  }}>
                    <div style={{fontWeight:700, fontSize:'0.88rem'}}>{c.nombre}</div>
                    <div style={{color:'rgba(255,255,255,0.4)', fontSize:'0.7rem', marginTop:2}}>
                      {c.userName || 'Anónimo'} · {c.paths?.length||0} tramo(s)
                    </div>
                  </div>
                ))}
                {!filtCircuits.length && <p style={{color:'#aaa',fontSize:'0.8rem'}}>Sin resultados.</p>}
              </div>
            )}
            {circuitSel && <div style={{marginTop:8,color:'#FF6B00',fontSize:'0.8rem',fontWeight:700}}>✓ {circuitSel.nombre} seleccionado</div>}
          </>
        )}
      </div>

      {/* Recurso (opcional) */}
      <div style={ST.card}>
        <span style={ST.label}>📚 RECURSO DE PREGUNTAS (opcional)</span>
        <input style={{...ST.input, marginBottom:10}} placeholder="Buscar recurso…" value={busqRec} onChange={e=>setBusqRec(e.target.value)} />
        {cargando ? <p style={{color:'#aaa',fontSize:'0.8rem'}}>Cargando…</p> : (
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:8, maxHeight:220, overflowY:'auto'}}>
            <div onClick={() => setRecursoSel(null)} style={{
              padding:'10px 13px', borderRadius:10, cursor:'pointer',
              border:`1.5px solid ${!recursoSel?'#aaa':'rgba(255,255,255,0.13)'}`,
              background: !recursoSel?'rgba(255,255,255,0.08)':'rgba(255,255,255,0.04)',
            }}>
              <div style={{fontWeight:700,fontSize:'0.88rem',color:'rgba(255,255,255,0.5)'}}>🚗 Sin preguntas</div>
              <div style={{color:'rgba(255,255,255,0.3)',fontSize:'0.7rem',marginTop:2}}>Solo conducir</div>
            </div>
            {filtRecursos.map(r => (
              <div key={r.id} onClick={() => setRecursoSel(r)} style={{
                padding:'10px 13px', borderRadius:10, cursor:'pointer',
                border:`1.5px solid ${recursoSel?.id===r.id?'#FF6B00':'rgba(255,255,255,0.13)'}`,
                background: recursoSel?.id===r.id?'rgba(255,107,0,0.15)':'rgba(255,255,255,0.04)',
              }}>
                <div style={{fontWeight:700,fontSize:'0.88rem'}}>{r.titulo}</div>
                <div style={{color:'rgba(255,255,255,0.4)',fontSize:'0.7rem',marginTop:2}}>
                  {r.temas||'–'} · {r.hojas?.length||1} hoja(s)
                </div>
              </div>
            ))}
          </div>
        )}
        {recursoSel && <div style={{marginTop:8,color:'#FF6B00',fontSize:'0.8rem',fontWeight:700}}>✓ {recursoSel.titulo}</div>}
      </div>

      {/* Vueltas */}
      <div style={ST.card}>
        <span style={ST.label}>🔁 NÚMERO DE VUELTAS</span>
        <div style={{display:'flex', gap:10}}>
          {[1,2,3,4,5].map(n => (
            <button key={n} onClick={() => setLaps(n)} style={{
              width:44, height:44, borderRadius:10, border:`2px solid ${laps===n?'#FF6B00':'rgba(255,255,255,0.2)'}`,
              background: laps===n?'rgba(255,107,0,0.3)':'rgba(255,255,255,0.06)',
              color:'white', fontWeight:800, fontSize:'1rem', cursor:'pointer',
            }}>{n}</button>
          ))}
        </div>
      </div>

      {/* Crear */}
      <button onClick={handleCreate} disabled={(circuitType==='CUSTOM' && !circuitSel) || creating} style={{
        ...ST.btn(), opacity: ((circuitType==='CUSTOM' && !circuitSel)||creating) ? 0.5 : 1,
        padding:'12px 36px', fontSize:'1rem', marginTop:4,
      }}>
        {creating ? 'Creando…' : '🚀 Crear Partida'}
      </button>
    </div>
  );

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER: LOBBY
  // ────────────────────────────────────────────────────────────────────────────
  if (fase === 'LOBBY') {
    const joinUrl = `${window.location.origin}?kartingOnline=${raceCode}`;
    return (
      <div style={ST.page}>
        <button onClick={onVolver} style={{...ST.btnSm, alignSelf:'flex-start', marginBottom:20}}>✕ Cancelar</button>
        <div style={{fontSize:'2.2rem', marginBottom:4}}>🏁</div>
        <h1 style={ST.title}>Sala de espera</h1>

        {/* Código */}
        <div style={{...ST.card, textAlign:'center', background:'rgba(255,107,0,0.10)', borderColor:'rgba(255,107,0,0.35)'}}>
          <div style={{color:'rgba(255,255,255,0.5)', fontSize:'0.72rem', letterSpacing:2, marginBottom:6}}>CÓDIGO DE ACCESO</div>
          <div style={{fontSize:'3.2rem', fontWeight:900, letterSpacing:10, color:'#FFD700', fontFamily:'monospace'}}>
            {raceCode}
          </div>
          <button onClick={copyCode} style={{...ST.btnSm, marginTop:10}}>
            {copied ? '✓ Copiado' : '📋 Copiar enlace'}
          </button>
          <div style={{marginTop:8, color:'rgba(255,255,255,0.3)', fontSize:'0.7rem', wordBreak:'break-all'}}>{joinUrl}</div>
        </div>

        {/* Config resumen */}
        <div style={{...ST.card, display:'flex', gap:16, flexWrap:'wrap'}}>
          <span style={{color:'rgba(255,255,255,0.5)', fontSize:'0.8rem'}}>🏁 {raceDoc?.circuitNombre || localCircuitNombre}</span>
          <span style={{color:'rgba(255,255,255,0.5)', fontSize:'0.8rem'}}>📚 {raceDoc?.recursoNombre || 'Sin preguntas'}</span>
          <span style={{color:'rgba(255,255,255,0.5)', fontSize:'0.8rem'}}>🔁 {laps} vuelta{laps!==1?'s':''}</span>
        </div>

        {/* Jugadores */}
        <div style={ST.card}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
            <span style={ST.label}>JUGADORES ({lobbyPlayers.length})</span>
            <span style={{fontSize:'0.7rem', color:'rgba(255,255,255,0.3)'}}>Se actualiza en tiempo real</span>
          </div>
          {lobbyPlayers.length === 0
            ? <p style={{color:'rgba(255,255,255,0.25)', textAlign:'center', margin:'16px 0', fontSize:'0.85rem'}}>Esperando que se unan alumnos…</p>
            : lobbyPlayers.map(p => (
              <div key={p.id} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                <div style={{width:9, height:9, borderRadius:'50%', background:'#2ecc71', flexShrink:0}}/>
                <span style={{fontWeight:600}}>{p.nombre}</span>
              </div>
            ))
          }
        </div>

        <button onClick={handleStart} disabled={lobbyPlayers.length === 0} style={{
          ...ST.btn(), opacity: lobbyPlayers.length===0 ? 0.45 : 1,
          padding:'13px 42px', fontSize:'1.05rem',
        }}>
          ▶ Empezar Carrera
        </button>
        {lobbyPlayers.length === 0 && <p style={{color:'rgba(255,255,255,0.3)', fontSize:'0.78rem', marginTop:6}}>Espera a que se una al menos un alumno</p>}
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER: RACING  (+ FINISHED)
  // ────────────────────────────────────────────────────────────────────────────
  const isFinished = fase === 'FINISHED';
  const startTime  = raceDoc?.startTime || null;
  const elapsed    = startTime ? Math.max(0, Date.now() - startTime) : 0;
  const finished   = players.filter(p => p.status === 'FINISHED').length;

  return (
    <div style={ST.page}>
      {/* Header */}
      <div style={{display:'flex', alignItems:'center', gap:14, marginBottom:18, width:'100%', maxWidth:740}}>
        <div style={{flex:1}}>
          <h1 style={{...ST.title, fontSize:'1.4rem'}}>
            {isFinished ? '🏁 Carrera terminada' : '🏎️ Carrera en curso'}
          </h1>
          <span style={{color:'rgba(255,255,255,0.35)', fontSize:'0.75rem'}}>
            Código: <strong style={{color:'#FFD700', letterSpacing:2}}>{raceCode}</strong>
            &nbsp;·&nbsp;{players.length} jugadores&nbsp;·&nbsp;{raceDoc?.circuitNombre}
          </span>
        </div>
        {!isFinished && (
          <div style={{textAlign:'right'}}>
            <div style={{fontVariantNumeric:'tabular-nums', fontSize:'1.5rem', fontWeight:700, color:'#FF6B00'}}>{fmtMs(elapsed)}</div>
            <div style={{color:'rgba(255,255,255,0.35)', fontSize:'0.7rem'}}>{finished}/{players.length} meta</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{display:'flex', gap:8, marginBottom:16, width:'100%', maxWidth:740}}>
        <button style={ST.tag(tab==='time')} onClick={() => setTab('time')}>⏱ Por tiempo</button>
        <button style={ST.tag(tab==='score','#2ecc71')} onClick={() => setTab('score')}>✅ Por aciertos</button>
        {!isFinished && (
          <button onClick={handleFinish} style={{...ST.btnSm, marginLeft:'auto', borderColor:'rgba(231,76,60,0.4)', color:'#e74c3c'}}>
            🏁 Terminar partida
          </button>
        )}
      </div>

      {/* Ranking table */}
      <div style={{...ST.card, padding:'10px 4px'}}>
        <RankTable players={players} laps={raceDoc?.laps || laps} tab={tab} startTime={startTime} />
      </div>

      {/* Final actions */}
      {isFinished && (
        <div style={{display:'flex', gap:10, marginTop:8}}>
          {!saved
            ? <button onClick={handleSave} disabled={saving} style={ST.btn()}>
                {saving ? 'Guardando…' : '💾 Guardar informe'}
              </button>
            : <span style={{color:'#2ecc71', fontWeight:700, padding:'10px 0'}}>✓ Informe guardado</span>
          }
          <button onClick={onVolver} style={ST.btnSm}>← Salir</button>
        </div>
      )}
    </div>
  );
}
