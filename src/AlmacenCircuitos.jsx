import React, { useState, useEffect, useCallback } from 'react';
import { auth, db } from './firebase';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { collection, query, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';

const fmt = (ts) => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' });
};

function CircuitoCard({ c, user, onJugar, onEditar, onDelete }) {
  const esPropio = user?.uid === c.userId;
  return (
    <div style={{
      background:'rgba(255,255,255,0.06)',
      border:'1.5px solid rgba(255,255,255,0.12)',
      borderRadius:14, padding:'14px 16px',
      display:'flex', flexDirection:'column', gap:8,
      transition:'border-color .15s',
    }}
      onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(255,107,0,0.5)'}
      onMouseLeave={e=>e.currentTarget.style.borderColor='rgba(255,255,255,0.12)'}
    >
      {/* Mini preview — just colored dot pattern representing path count */}
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <div style={{width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,#1c1c1c,#333)',
          display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.4rem',flexShrink:0}}>
          🏎️
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:800,fontSize:'0.95rem',whiteSpace:'nowrap',overflow:'hidden',
            textOverflow:'ellipsis'}}>{c.nombre}</div>
          <div style={{color:'#aaa',fontSize:'0.72rem',marginTop:1}}>
            {c.userName || 'Anónimo'} · {fmt(c.createdAt)}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{display:'flex',gap:8,fontSize:'0.72rem',color:'rgba(255,255,255,0.55)'}}>
        <span>✏️ {c.paths?.length || 0} trazo(s)</span>
        <span>⛺ {(c.objects||[]).filter(o=>o.type==='tent').length} zona(s)</span>
        <span>🏟️ {(c.objects||[]).filter(o=>o.type==='tribune').length} tribuna(s)</span>
      </div>

      {/* Actions */}
      <div style={{display:'flex',gap:6,marginTop:2}}>
        <button onClick={()=>onJugar(c.paths,c.objects||[])}
          style={{flex:1,padding:'8px 0',borderRadius:9,border:'none',
            background:'linear-gradient(90deg,#FF6B00,#e05500)',
            color:'white',fontWeight:700,cursor:'pointer',fontSize:'0.82rem'}}>
          🚗 Jugar
        </button>
        {esPropio && (
          <button onClick={()=>onEditar(c.paths,c.objects||[])}
            style={{flex:1,padding:'8px 0',borderRadius:9,
              border:'1px solid rgba(255,215,0,0.4)',
              background:'rgba(255,215,0,0.10)',color:'#FFD700',
              fontWeight:700,cursor:'pointer',fontSize:'0.82rem'}}>
            ✏️ Editar
          </button>
        )}
        {esPropio && (
          <button onClick={()=>onDelete(c.id)}
            style={{padding:'8px 10px',borderRadius:9,
              border:'1px solid rgba(231,76,60,0.35)',
              background:'rgba(231,76,60,0.10)',color:'#e74c3c',
              fontWeight:700,cursor:'pointer',fontSize:'0.82rem'}}>
            🗑
          </button>
        )}
      </div>
    </div>
  );
}

export default function AlmacenCircuitos({ onJugar, onEditar, onVolver }) {
  const [user,      setUser]      = useState(null);
  const [todos,     setTodos]     = useState([]);
  const [cargando,  setCargando]  = useState(true);
  const [tab,       setTab]       = useState('todos');
  const [busqueda,  setBusqueda]  = useState('');

  useEffect(() => onAuthStateChanged(auth, u => setUser(u)), []);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const snap = await getDocs(query(collection(db,'circuitos'), orderBy('createdAt','desc')));
      setTodos(snap.docs.map(d=>({id:d.id,...d.data()})));
    } catch(e) { console.error(e); }
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar este circuito? Esta acción no se puede deshacer.')) return;
    try {
      await deleteDoc(doc(db,'circuitos',id));
      setTodos(prev=>prev.filter(c=>c.id!==id));
    } catch(e) { alert('Error al eliminar'); }
  };

  const login = async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch(e) {}
  };

  const circuitos = todos
    .filter(c => tab==='mios' ? c.userId===user?.uid : true)
    .filter(c => !busqueda.trim() || c.nombre?.toLowerCase().includes(busqueda.toLowerCase()));

  const st = {
    page: { minHeight:'100vh', background:'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)',
      display:'flex', flexDirection:'column', alignItems:'center',
      padding:'28px 20px', color:'white', fontFamily:"'Segoe UI',sans-serif" },
    title: { fontSize:'2rem', fontWeight:900, margin:'0 0 4px',
      background:'linear-gradient(90deg,#FF6B00,#FFD700)',
      WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' },
    tab: (active) => ({
      padding:'8px 20px', borderRadius:20, cursor:'pointer',
      fontWeight:700, fontSize:'0.82rem', transition:'all .15s',
      background: active ? 'rgba(255,107,0,0.30)' : 'rgba(255,255,255,0.08)',
      color:      active ? '#FF6B00' : 'rgba(255,255,255,0.55)',
      border:     active ? '1px solid rgba(255,107,0,0.5)' : '1px solid rgba(255,255,255,0.10)',
    }),
  };

  return (
    <div style={st.page}>
      <button onClick={onVolver} style={{alignSelf:'flex-start',
        background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.18)',
        color:'white',borderRadius:9,padding:'6px 14px',cursor:'pointer',
        fontSize:'0.82rem',marginBottom:14}}>
        ← Volver
      </button>

      <div style={{fontSize:'2.5rem',marginBottom:4}}>🗂️</div>
      <h1 style={st.title}>Almacén de Circuitos</h1>
      <p style={{color:'#aaa',marginBottom:18,fontSize:'0.82rem'}}>
        Circuitos creados por la comunidad
      </p>

      {/* Auth strip */}
      <div style={{marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
        {user ? (
          <div style={{fontSize:'0.82rem',color:'#aaa'}}>
            👤 {user.displayName || user.email}
          </div>
        ) : (
          <button onClick={login} style={{padding:'7px 18px',borderRadius:9,
            border:'1px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.10)',
            color:'white',fontWeight:700,cursor:'pointer',fontSize:'0.8rem'}}>
            🔑 Iniciar sesión para ver tus circuitos
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        <button style={st.tab(tab==='todos')}   onClick={()=>setTab('todos')}>🌍 Todos</button>
        <button style={st.tab(tab==='mios')}    onClick={()=>setTab('mios')}  disabled={!user}>
          ⭐ Mis circuitos
        </button>
      </div>

      {/* Search */}
      <input
        value={busqueda} onChange={e=>setBusqueda(e.target.value)}
        placeholder="Buscar por nombre…"
        style={{width:'100%',maxWidth:560,padding:'9px 14px',borderRadius:10,
          border:'1px solid rgba(255,255,255,0.18)',background:'rgba(255,255,255,0.08)',
          color:'white',fontSize:'0.88rem',marginBottom:20,boxSizing:'border-box',outline:'none'}}
      />

      {/* Grid */}
      {cargando ? (
        <p style={{color:'#aaa'}}>Cargando circuitos…</p>
      ) : circuitos.length === 0 ? (
        <p style={{color:'#aaa',marginTop:30,textAlign:'center'}}>
          {tab==='mios' ? 'Aún no has guardado ningún circuito.' : 'No hay circuitos guardados todavía. ¡Sé el primero!'}
        </p>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',
          gap:14,width:'100%',maxWidth:860}}>
          {circuitos.map(c => (
            <CircuitoCard key={c.id} c={c} user={user}
              onJugar={onJugar} onEditar={onEditar} onDelete={eliminar}
            />
          ))}
        </div>
      )}
    </div>
  );
}
