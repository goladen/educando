import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import {
  findRaceByCode, joinRace, listenRace, listenPlayers,
  reportCheckpoint, reportLap, reportFinish, fmtMs, sortByTime, sortByScore,
} from './kartingOnlineUtils';
import TrackTest from '../TrackTest';
import { KartingGame } from '../KartingTrack';

const ST = {
  page:   { minHeight:'100vh', background:'linear-gradient(135deg,#0a0f2e,#0f1a3e)', color:'white', fontFamily:"'Segoe UI',sans-serif", display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'28px 18px' },
  card:   { background:'rgba(255,255,255,0.06)', border:'1.5px solid rgba(255,255,255,0.12)', borderRadius:16, padding:'28px 26px', width:'100%', maxWidth:440, textAlign:'center' },
  title:  { fontSize:'1.6rem', fontWeight:900, background:'linear-gradient(90deg,#FF6B00,#FFD700)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', margin:'0 0 6px' },
  input:  { width:'100%', padding:'12px 14px', borderRadius:10, border:'1.5px solid rgba(255,255,255,0.18)', background:'rgba(255,255,255,0.09)', color:'white', fontSize:'1rem', outline:'none', boxSizing:'border-box', textAlign:'center', letterSpacing:3, fontWeight:700 },
  btn:    { padding:'11px 32px', borderRadius:10, border:'none', background:'linear-gradient(90deg,#FF6B00,#e05500)', color:'white', fontWeight:700, cursor:'pointer', fontSize:'0.95rem' },
  btnSm:  { padding:'7px 18px', borderRadius:9, border:'1px solid rgba(255,255,255,0.2)', background:'rgba(255,255,255,0.08)', color:'white', cursor:'pointer', fontSize:'0.82rem', fontWeight:600 },
  err:    { color:'#e74c3c', fontSize:'0.82rem', marginTop:8 },
};

const medal = i => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;

// ── Mini ranking (result screen) ─────────────────────────────────────────────
function FinalRanking({ players, laps, myId }) {
  const [tab, setTab] = useState('time');
  const sorted = tab === 'time' ? sortByTime(players) : sortByScore(players);
  const tagSt = active => ({
    padding:'5px 14px', borderRadius:20, border:`1.5px solid ${active?'#FF6B00':'rgba(255,255,255,0.18)'}`,
    background: active?'rgba(255,107,0,0.2)':'transparent',
    color: active?'#FF6B00':'rgba(255,255,255,0.45)', cursor:'pointer', fontSize:'0.78rem', fontWeight:active?700:400,
  });
  return (
    <div style={{width:'100%', maxWidth:500, marginTop:18}}>
      <div style={{display:'flex', gap:8, justifyContent:'center', marginBottom:12}}>
        <button style={tagSt(tab==='time')}  onClick={() => setTab('time')}>⏱ Por tiempo</button>
        <button style={tagSt(tab==='score')} onClick={() => setTab('score')}>✅ Por aciertos</button>
      </div>
      <div style={{background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.10)', borderRadius:12, overflow:'hidden'}}>
        {sorted.map((p, i) => (
          <div key={p.id} style={{
            display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
            background: p.id === myId ? 'rgba(255,107,0,0.12)' : i%2===0 ? 'rgba(255,255,255,0.02)' : 'transparent',
            borderBottom:'1px solid rgba(255,255,255,0.05)',
            fontWeight: p.id === myId ? 700 : 400,
          }}>
            <span style={{width:28, textAlign:'center', fontSize:'1rem'}}>{medal(i)}</span>
            <span style={{flex:1}}>{p.nombre}{p.id===myId?' (tú)':''}</span>
            {tab === 'time'
              ? <span style={{color:'#FFD700', fontFamily:'monospace', fontSize:'0.88rem'}}>{p.finishTime!=null ? fmtMs(p.finishTime) : '--'}</span>
              : <span style={{color:'#2ecc71', fontWeight:700}}>✅ {p.aciertos||0} <span style={{color:'#e74c3c'}}>❌ {p.fallos||0}</span></span>
            }
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function KartingJoinRace({ initialCode, onVolver }) {
  const [step,       setStep]       = useState('CODE');  // CODE | NAME | LOBBY | COUNTDOWN | RACING | DONE | ENDED
  const [code,       setCode]       = useState(initialCode || '');
  const [nombre,     setNombre]     = useState(() => localStorage.getItem('karting_playerName') || '');
  const [err,        setErr]        = useState('');
  const [loading,    setLoading]    = useState(false);
  const [raceData,   setRaceData]   = useState(null); // race Firestore doc
  const [raceId,     setRaceId]     = useState(null);
  const [playerId,   setPlayerId]   = useState(null);
  const [players,    setPlayers]    = useState([]);
  const [recurso,    setRecurso]    = useState(null);
  const [countdown,  setCountdown]  = useState(null);  // 3|2|1|0 = GO

  const unsubRace    = useRef(null);
  const unsubPlayers = useRef(null);
  const cdTimer      = useRef(null);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => {
    unsubRace.current?.();
    unsubPlayers.current?.();
    clearInterval(cdTimer.current);
  }, []);

  // ── Step 1: Find race ─────────────────────────────────────────────────────
  const handleFindRace = async () => {
    setErr(''); setLoading(true);
    try {
      const race = await findRaceByCode(code);
      if (!race) { setErr('Código no encontrado.'); setLoading(false); return; }
      if (race.status === 'FINISHED') { setErr('Esta partida ya ha terminado.'); setLoading(false); return; }
      setRaceData(race);
      setRaceId(race.id);
      setStep('NAME');
    } catch(e) { setErr(e.message); }
    setLoading(false);
  };

  // ── Step 2: Join with name ────────────────────────────────────────────────
  const handleJoin = async () => {
    if (!nombre.trim()) { setErr('Introduce tu nombre.'); return; }
    setErr(''); setLoading(true);
    try {
      localStorage.setItem('karting_playerName', nombre.trim());
      const pid = await joinRace(raceId, nombre);
      setPlayerId(pid);

      // Fetch resource if needed
      if (raceData.recursoId) {
        try {
          const rSnap = await getDoc(doc(db, 'resources', raceData.recursoId));
          if (rSnap.exists()) setRecurso({ id: rSnap.id, ...rSnap.data() });
        } catch(_) {}
      }

      // Listen to race status changes
      unsubRace.current = listenRace(raceId, rd => {
        setRaceData(rd);
        if (rd.status === 'RACING' && rd.startTime) {
          startCountdown(rd.startTime);
        }
        if (rd.status === 'FINISHED') {
          setStep(prev => prev === 'RACING' ? 'DONE' : 'ENDED');
        }
      });
      unsubPlayers.current = listenPlayers(raceId, setPlayers);

      // If race already started (joined mid-race)
      if (raceData.status === 'RACING' && raceData.startTime) {
        startCountdown(raceData.startTime);
      } else {
        setStep('LOBBY');
      }
    } catch(e) { setErr(e.message); }
    setLoading(false);
  };

  // ── Countdown logic ───────────────────────────────────────────────────────
  const startCountdown = useCallback((startTime) => {
    setStep('COUNTDOWN');
    clearInterval(cdTimer.current);
    cdTimer.current = setInterval(() => {
      const diff = (startTime - Date.now()) / 1000;
      if (diff > 3) {
        setCountdown(3);
      } else if (diff > 2) {
        setCountdown(3);
      } else if (diff > 1) {
        setCountdown(2);
      } else if (diff > 0) {
        setCountdown(1);
      } else if (diff > -1) {
        setCountdown(0); // GO!
      } else {
        clearInterval(cdTimer.current);
        setStep('RACING');
      }
    }, 200);
  }, []);

  // ── Online callbacks for TrackTest ────────────────────────────────────────
  const handleCheckpoint = useCallback(async ({ cpIdx, lap, tMs, ok }) => {
    if (!raceId || !playerId) return;
    try { await reportCheckpoint(raceId, playerId, { cpIdx, lap, tMs, ok }); } catch(_) {}
  }, [raceId, playerId]);

  const handleLapComplete = useCallback(async (lapsCompleted) => {
    if (!raceId || !playerId) return;
    try { await reportLap(raceId, playerId, lapsCompleted); } catch(_) {}
  }, [raceId, playerId]);

  const handleFinish = useCallback(async ({ tiempo, acertadas, falladas }) => {
    if (!raceId || !playerId) return;
    try {
      await reportFinish(raceId, playerId, {
        finishTime: tiempo,
        aciertos: acertadas,
        fallos: falladas,
      });
    } catch(_) {}
    setStep('DONE');
  }, [raceId, playerId]);

  // ── CODE step ─────────────────────────────────────────────────────────────
  if (step === 'CODE') return (
    <div style={ST.page}>
      <button onClick={onVolver} style={{...ST.btnSm, position:'absolute', top:18, left:18}}>← Volver</button>
      <div style={ST.card}>
        <div style={{fontSize:'2.8rem', marginBottom:8}}>🏎️</div>
        <h2 style={ST.title}>Unirse a Carrera</h2>
        <p style={{color:'rgba(255,255,255,0.45)', fontSize:'0.82rem', marginBottom:20}}>
          Introduce el código que te ha dado tu profesor
        </p>
        <input
          style={{...ST.input, fontSize:'1.5rem', letterSpacing:8}}
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6))}
          onKeyDown={e => e.key==='Enter' && code.length>=4 && handleFindRace()}
          placeholder="CÓDIGO"
          maxLength={6}
          autoFocus
        />
        {err && <p style={ST.err}>{err}</p>}
        <button onClick={handleFindRace} disabled={code.length < 4 || loading} style={{...ST.btn, marginTop:16, opacity:code.length<4||loading?0.5:1}}>
          {loading ? 'Buscando…' : 'Continuar →'}
        </button>
      </div>
    </div>
  );

  // ── NAME step ─────────────────────────────────────────────────────────────
  if (step === 'NAME') return (
    <div style={ST.page}>
      <button onClick={() => setStep('CODE')} style={{...ST.btnSm, position:'absolute', top:18, left:18}}>← Atrás</button>
      <div style={ST.card}>
        <div style={{fontSize:'2.2rem', marginBottom:8}}>👤</div>
        <h2 style={ST.title}>¿Cómo te llamas?</h2>
        <div style={{color:'rgba(255,255,255,0.4)', fontSize:'0.8rem', marginBottom:6}}>
          🏁 {raceData?.circuitNombre} · {raceData?.laps} vuelta{raceData?.laps!==1?'s':''}
          {raceData?.recursoNombre && ` · 📚 ${raceData.recursoNombre}`}
        </div>
        <input
          style={{...ST.input, letterSpacing:1, fontSize:'1.1rem', marginTop:12}}
          value={nombre}
          onChange={e => setNombre(e.target.value.slice(0,24))}
          onKeyDown={e => e.key==='Enter' && nombre.trim() && handleJoin()}
          placeholder="Tu nombre"
          maxLength={24}
          autoFocus
        />
        {err && <p style={ST.err}>{err}</p>}
        <button onClick={handleJoin} disabled={!nombre.trim() || loading} style={{...ST.btn, marginTop:16, opacity:!nombre.trim()||loading?0.5:1}}>
          {loading ? 'Uniéndose…' : '🏎️ Unirse a la carrera'}
        </button>
      </div>
    </div>
  );

  // ── LOBBY step ────────────────────────────────────────────────────────────
  if (step === 'LOBBY') return (
    <div style={ST.page}>
      <div style={ST.card}>
        <div style={{fontSize:'2rem', marginBottom:6}}>⏳</div>
        <h2 style={{...ST.title, fontSize:'1.4rem'}}>Sala de espera</h2>
        <p style={{color:'rgba(255,255,255,0.4)', fontSize:'0.82rem', marginBottom:18}}>
          El profesor iniciará la carrera en breve. Prepárate.
        </p>
        <div style={{textAlign:'left', marginBottom:6, color:'rgba(255,255,255,0.5)', fontSize:'0.72rem', fontWeight:700, letterSpacing:1}}>
          JUGADORES ({players.length})
        </div>
        <div style={{maxHeight:200, overflowY:'auto'}}>
          {players.map(p => (
            <div key={p.id} style={{display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
              <div style={{width:8, height:8, borderRadius:'50%', background: p.id===playerId?'#FF6B00':'#2ecc71', flexShrink:0}}/>
              <span style={{fontWeight: p.id===playerId?700:400}}>{p.nombre}{p.id===playerId?' (tú)':''}</span>
            </div>
          ))}
        </div>
        <p style={{color:'rgba(255,255,255,0.25)', fontSize:'0.75rem', marginTop:14}}>
          Código: <strong style={{color:'#FFD700', letterSpacing:2}}>{raceData?.code}</strong>
        </p>
      </div>
    </div>
  );

  // ── COUNTDOWN step ────────────────────────────────────────────────────────
  if (step === 'COUNTDOWN') return (
    <div style={{...ST.page, background:'#0a0f2e'}}>
      <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:20}}>
        <div style={{display:'flex', gap:18}}>
          {[3,2,1].map(n => (
            <div key={n} style={{
              width:64, height:64, borderRadius:'50%',
              background: countdown!=null && countdown>=n ? '#e74c3c' : '#1a1a3e',
              boxShadow: countdown!=null && countdown>=n ? '0 0 30px 8px rgba(231,76,60,0.7)' : 'none',
              border:'3px solid rgba(255,255,255,0.15)',
              transition:'background 0.2s, box-shadow 0.2s',
            }}/>
          ))}
        </div>
        {countdown === 0 && (
          <div style={{fontSize:'4rem', fontWeight:900, color:'#2ecc71', textShadow:'0 0 30px rgba(46,204,113,0.9)', letterSpacing:6}}>
            ¡GO!
          </div>
        )}
        <p style={{color:'rgba(255,255,255,0.4)', fontSize:'0.9rem'}}>¡La carrera está a punto de empezar!</p>
      </div>
    </div>
  );

  // ── RACING step ───────────────────────────────────────────────────────────
  if (step === 'RACING') {
    const startTime = raceData?.startTime;
    const cType = raceData?.circuitType || 'CUSTOM';

    if (cType === 'PRESET_1' || cType === 'PRESET_2') {
      return (
        <KartingGame
          recurso={recurso}
          hojas={[]}
          circuito={cType === 'PRESET_1' ? 1 : 2}
          maxLaps={raceData?.laps || 2}
          onSalir={() => setStep('DONE')}
          onTerminar={handleFinish}
          skipCountdown={true}
          timerBase={startTime}
          onCheckpoint={handleCheckpoint}
          onLapComplete={handleLapComplete}
        />
      );
    }

    return (
      <TrackTest
        paths={raceData?.circuitData?.paths || []}
        objects={raceData?.circuitData?.objects || []}
        recurso={recurso}
        hojas={[]}
        numVueltas={raceData?.laps || 2}
        onVolver={() => setStep('DONE')}
        onTerminar={handleFinish}
        skipCountdown={true}
        timerBase={startTime}
        onCheckpoint={handleCheckpoint}
        onLapComplete={handleLapComplete}
      />
    );
  }

  // ── DONE step (finished racing) ───────────────────────────────────────────
  if (step === 'DONE' || step === 'ENDED') return (
    <div style={{...ST.page, justifyContent:'flex-start', paddingTop:40}}>
      <div style={{fontSize:'3rem', marginBottom:8}}>🏁</div>
      <h2 style={ST.title}>
        {step === 'DONE' ? '¡Has terminado!' : 'Carrera terminada'}
      </h2>
      <p style={{color:'rgba(255,255,255,0.45)', fontSize:'0.85rem', marginBottom:4}}>
        {step === 'DONE' ? '¡Bien hecho! Espera a que termine el resto.' : 'El profesor ha terminado la carrera.'}
      </p>

      <FinalRanking players={players} laps={raceData?.laps||2} myId={playerId} />

      <button onClick={onVolver} style={{...ST.btnSm, marginTop:22}}>← Salir</button>
    </div>
  );

  return null;
}
