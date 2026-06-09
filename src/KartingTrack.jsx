import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import TrackEditor         from './TrackEditor';
import TrackTest           from './TrackTest';
import AlmacenCircuitos    from './AlmacenCircuitos';
import { db } from './firebase';
import { collection, query, where, getDocs, addDoc, doc, getDoc } from 'firebase/firestore';

import tile01    from './kenney_racing-pack/PNG/Tiles/Asphalt road/road_asphalt01.png';
import tile02    from './kenney_racing-pack/PNG/Tiles/Asphalt road/road_asphalt02.png';
import tile03    from './kenney_racing-pack/PNG/Tiles/Asphalt road/road_asphalt03.png';
import tile05    from './kenney_racing-pack/PNG/Tiles/Asphalt road/road_asphalt05.png';
import tile06    from './kenney_racing-pack/PNG/Tiles/Asphalt road/road_asphalt06.png';
import tile07    from './kenney_racing-pack/PNG/Tiles/Asphalt road/road_asphalt07.png';
import dirtTile01 from './kenney_racing-pack/PNG/Tiles/Dirt road/road_dirt01.png';
import dirtTile02 from './kenney_racing-pack/PNG/Tiles/Dirt road/road_dirt02.png';
import dirtTile03 from './kenney_racing-pack/PNG/Tiles/Dirt road/road_dirt03.png';
import dirtTile04 from './kenney_racing-pack/PNG/Tiles/Dirt road/road_dirt04.png';
import dirtTile05 from './kenney_racing-pack/PNG/Tiles/Dirt road/road_dirt05.png';
import dirtTile06 from './kenney_racing-pack/PNG/Tiles/Dirt road/road_dirt06.png';
import dirtTile07 from './kenney_racing-pack/PNG/Tiles/Dirt road/road_dirt07.png';
import lightsImg from './kenney_racing-pack/PNG/Objects/lights.png';
import engineSrc  from './assets/Audio/carengine.mp3';
import musicSrc   from './assets/Audio/sonidofondo.mp3';
import startSrc   from './assets/inicio-juego.mp3';
import sndOk      from './assets/sonidorespcorrecta.mp3';
import sndFail    from './assets/sonidomonedamal.mp3';

// ── Animaciones CSS para toasts ──────────────────────────────────────────────
const CSS_KARTING = `
  @keyframes kt-badge-ok {
    0%   { opacity:0;  transform:translate(-50%,-50%) scale(0.2) rotate(-6deg); }
    16%  { opacity:1;  transform:translate(-50%,-50%) scale(1.35) rotate(3deg); }
    28%  { transform:translate(-50%,-50%) scale(0.93) rotate(-1deg); }
    42%  { opacity:1;  transform:translate(-50%,-60%) scale(1.07) rotate(0deg); }
    68%  { opacity:1;  transform:translate(-50%,-90%) scale(1.0); }
    100% { opacity:0;  transform:translate(-50%,-200%) scale(0.8); }
  }
  @keyframes kt-badge-fail {
    0%   { opacity:0;  transform:translate(-50%,-50%) scale(0.2); }
    12%  { opacity:1;  transform:translate(-58%,-50%) scale(1.25); }
    24%  { transform:translate(-42%,-50%) scale(1.1); }
    36%  { transform:translate(-56%,-50%) scale(1.0); }
    46%  { transform:translate(-44%,-50%) scale(1.0); }
    58%  { opacity:1;  transform:translate(-50%,-50%) scale(1.0); }
    75%  { opacity:1;  transform:translate(-50%,-70%) scale(1.0); }
    100% { opacity:0;  transform:translate(-50%,-180%) scale(0.8); }
  }
  @keyframes kt-part {
    0%   { opacity:0; transform:translateY(0px) scale(0); }
    22%  { opacity:1; transform:translateY(-52px) scale(1.6); }
    70%  { opacity:0.8; transform:translateY(-95px) scale(1.1); }
    100% { opacity:0; transform:translateY(-135px) scale(0.2); }
  }
  @keyframes kt-flash-ok {
    0%   { opacity:0.22; }
    100% { opacity:0; }
  }
  @keyframes kt-flash-fail {
    0%   { opacity:0; }
    8%   { opacity:0.28; }
    100% { opacity:0; }
  }
`;

// ── Constantes del mundo ──────────────────────────────────────────────────────
const TW = 6, COLS = 14, ROWS = 10;
const G = 0, V = 1, H = 2, A = 3, B = 5, C = 6, D = 7;

const TRACK = [
  [G,G,G,G,G,G,G,G,G,G,G,G,G,G],
  [G,A,H,H,H,H,H,H,H,H,H,H,B,G],
  [G,V,G,G,G,G,G,G,G,G,G,G,V,G],
  [G,V,G,G,G,G,G,G,G,G,G,G,V,G],
  [G,V,G,G,G,G,G,A,H,H,H,H,D,G],
  [G,V,G,G,G,G,G,V,G,G,G,G,G,G],
  [G,V,G,G,G,G,G,C,H,H,H,H,B,G],
  [G,V,G,G,G,G,G,G,G,G,G,G,V,G],
  [G,V,G,G,G,G,G,G,G,G,G,G,V,G],
  [G,C,H,H,H,H,H,H,H,H,H,H,D,G],
];

const TILE_ROTATIONS = {
  '4,12': Math.PI/2, '9,12': Math.PI/2,
  '6,7': -Math.PI/2, '9,1': -Math.PI/2,
};
const TILE_SRCS = { 1:tile01, 2:tile02, 3:tile03, 5:tile05, 6:tile06, 7:tile07 };

// ── Circuito 2 – Tierra (18×14) ──────────────────────────────────────────────
const COLS2=18, ROWS2=14;
const TRACK2 = [
  [G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G],
  [G,A,H,H,H,H,H,H,H,H,H,H,H,H,H,H,B,G],
  [G,V,G,G,G,G,G,G,G,G,G,G,G,G,G,G,V,G],
  [G,V,G,G,G,G,G,G,G,G,G,G,G,G,G,G,V,G],
  [G,V,G,G,G,G,G,A,H,H,H,H,H,H,H,H,D,G],
  [G,V,G,G,G,G,G,V,G,G,G,G,G,G,G,G,G,G],
  [G,V,G,G,G,G,G,V,G,G,G,G,G,G,G,G,G,G],
  [G,V,G,G,G,G,G,V,G,G,G,G,G,G,G,G,G,G],
  [G,V,G,G,G,G,G,C,H,H,H,H,H,H,H,H,B,G],
  [G,V,G,G,G,G,G,G,G,G,G,G,G,G,G,G,V,G],
  [G,V,G,G,G,G,G,G,G,G,G,G,G,G,G,G,V,G],
  [G,V,G,G,G,G,G,G,G,G,G,G,G,G,G,G,V,G],
  [G,C,H,H,H,H,H,H,H,H,H,H,H,H,H,H,D,G],
  [G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G],
];
const TILE_ROTATIONS2 = {
  // Todas las curvas se gestionan con overrides road_dirt04 en el bucle
};
const TILE_SRCS2 = { 1:dirtTile01, 2:dirtTile02, 3:dirtTile03, 5:dirtTile05, 6:dirtTile06, 7:dirtTile07 };

const wp2 = (col, row) => [(col+0.5)*TW, (row+0.5)*TW];

// Arc midpoints: guide the AI along the actual road curve at each corner.
// Each corner arc midpoint sits exactly at TW/2 radius (on-road center) from the arc center,
// at the 45° diagonal into the tile — preventing the AI from cutting through off-road interior.
const ARC_D = TW / 2 * Math.SQRT1_2; // ≈ 2.12
const arcWpA = (col,row) => [(col+1)*TW - ARC_D, (row+1)*TW - ARC_D];
const arcWpB = (col,row) => [col*TW     + ARC_D, (row+1)*TW - ARC_D];
const arcWpC = (col,row) => [(col+1)*TW - ARC_D, row*TW     + ARC_D];
const arcWpD = (col,row) => [col*TW     + ARC_D, row*TW     + ARC_D];

const WAYPOINTS2 = [
  wp2(2,1), wp2(5,1), wp2(8,1), wp2(11,1), wp2(14,1), wp2(15,1), arcWpB(16,1),
  wp2(16,2), wp2(16,3), arcWpD(16,4),
  wp2(15,4), wp2(13,4), wp2(11,4), wp2(9,4), wp2(8,4), arcWpA(7,4),
  wp2(7,5), wp2(7,6), wp2(7,7), arcWpC(7,8),
  wp2(8,8), wp2(10,8), wp2(12,8), wp2(14,8), wp2(15,8), arcWpB(16,8),
  wp2(16,9), wp2(16,10), wp2(16,11), arcWpD(16,12),
  wp2(15,12), wp2(12,12), wp2(9,12), wp2(6,12), wp2(3,12), wp2(2,12), arcWpC(1,12),
  wp2(1,11), wp2(1,9), wp2(1,7), wp2(1,5), wp2(1,3), wp2(1,2), arcWpA(1,1),
];
const CHECKPOINT_POS2 = [
  [10.5*TW, 1.5*TW],
  [7.5*TW,  6.5*TW],
  [9.5*TW, 12.5*TW],
];

const wp = (col, row) => [(col+0.5)*TW, (row+0.5)*TW];
const WAYPOINTS = [
  wp(2,1), wp(4,1), wp(7,1), wp(9,1), wp(11,1), arcWpB(12,1),
  wp(12,2), wp(12,3), arcWpD(12,4),
  wp(11,4), wp(9,4), wp(8,4), arcWpA(7,4),
  wp(7,5), arcWpC(7,6),
  wp(8,6), wp(10,6), wp(11,6), arcWpB(12,6),
  wp(12,7), wp(12,8), arcWpD(12,9),
  wp(11,9), wp(8,9), wp(5,9), wp(2,9), arcWpC(1,9),
  wp(1,8), wp(1,6), wp(1,4), wp(1,2), arcWpA(1,1),
];

// ── Carrera ───────────────────────────────────────────────────────────────────
const FINISH_X = 2.5*TW, FINISH_ZMIN = TW*0.7, FINISH_ZMAX = TW*2.3, MAX_LAPS = 3;

// ── 3 Checkpoints por vuelta ──────────────────────────────────────────────────
const CHECKPOINT_POS = [
  [6.5*TW, 1.5*TW],
  [12.5*TW, 7.5*TW],
  [6.5*TW, 9.5*TW],
];
const CP_RADIUS = 4.2;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (ms) => {
  const m = Math.floor(ms/60000), s = Math.floor((ms%60000)/1000), cs = Math.floor((ms%1000)/10);
  return `${m}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
};
const shuffle = (arr) => { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
const buildOpciones = (q) => {
  if (q.opcionesFijas?.length) return shuffle(q.opcionesFijas);
  return shuffle([q.correcta ?? q.respuesta ?? q.a ?? '', ...(q.incorrectas || [])]);
};
const getTexto    = (q) => q.pregunta || q.q || q.enunciado || '';
const getRespuesta = (q) => q.correcta ?? q.respuesta ?? q.a ?? '';

// ── Road detection ────────────────────────────────────────────────────────────
const ROAD_HALF = TW*0.36, ARC_RADIUS = TW/2;
function buildIsOnRoad(track, rows, cols) {
  return (px, pz) => {
    const col = Math.floor(px/TW), row = Math.floor(pz/TW);
    if (row<0||row>=rows||col<0||col>=cols) return false;
    const tile = track[row]?.[col];
    if (!tile) return false;
    if (tile===V) return Math.abs(px-(col*TW+TW/2)) < ROAD_HALF;
    if (tile===H) return Math.abs(pz-(row*TW+TW/2)) < ROAD_HALF;
    let arcX, arcZ;
    if(tile===A){arcX=(col+1)*TW; arcZ=(row+1)*TW;}
    else if(tile===B){arcX=col*TW; arcZ=(row+1)*TW;}
    else if(tile===C){arcX=(col+1)*TW; arcZ=row*TW;}
    else if(tile===D){arcX=col*TW; arcZ=row*TW;}
    else return true;
    return Math.abs(Math.hypot(px-arcX,pz-arcZ)-ARC_RADIUS) < ROAD_HALF;
  };
}

// ── Construcción del coche ────────────────────────────────────────────────────
function buildCar(scene, mainColor=0xe74c3c, darkColor=0xc0392b) {
  const group = new THREE.Group();
  const mat   = new THREE.MeshLambertMaterial({color:mainColor});
  const dark  = new THREE.MeshLambertMaterial({color:darkColor});
  const wheel = new THREE.MeshLambertMaterial({color:0x1a1a1a});
  const glass = new THREE.MeshLambertMaterial({color:0x85c1e9,transparent:true,opacity:0.75});
  const body  = new THREE.Mesh(new THREE.BoxGeometry(1.3,0.32,2.4),mat);
  body.position.y=0.16; body.castShadow=true; group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.05,0.3,1.4),dark);
  cabin.position.set(0,0.51,-0.12); cabin.castShadow=true; group.add(cabin);
  const ws = new THREE.Mesh(new THREE.BoxGeometry(0.95,0.26,0.05),glass);
  ws.position.set(0,0.56,0.58); ws.rotation.x=0.45; group.add(ws);
  const wGeo = new THREE.CylinderGeometry(0.24,0.24,0.15,12);
  [[0.74,0.18,0.82],[-0.74,0.18,0.82],[0.74,0.18,-0.82],[-0.74,0.18,-0.82]].forEach(([x,y,z])=>{
    const w=new THREE.Mesh(wGeo,wheel); w.position.set(x,y,z); w.rotation.z=Math.PI/2; w.castShadow=true; group.add(w);
  });
  scene.add(group);
  return group;
}

// ════════════════════════════════════════════════════════════════════════════
// PANTALLA PREVIA – selección de recurso con multi-hoja (estilo Duelo Piratas)
// ════════════════════════════════════════════════════════════════════════════
function PantallaPrevia({ onIniciar, onConstruir, onAlmacen }) {
  const [circuito,     setCircuito]     = useState(1);
  const [recursos,     setRecursos]     = useState([]);
  const [cargando,     setCargando]     = useState(true);
  const [recursoSel,   setRecursoSel]   = useState(null);
  const [hojasChecked, setHojasChecked] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [s1, s2] = await Promise.all([
          getDocs(query(collection(db,'resources'), where('tipoJuego','==','CAZABURBUJAS'), where('isPrivate','==',false))),
          getDocs(query(collection(db,'resources'), where('tipoJuego','==','KARTINGED'),   where('isPrivate','==',false))),
        ]);
        setRecursos([...s1.docs,...s2.docs].map(d=>({id:d.id,...d.data()})));
      } catch(e) { console.error(e); }
      setCargando(false);
    })();
  }, []);

  const seleccionar = (r) => {
    setRecursoSel(r);
    const hojas = r.hojas || [];
    setHojasChecked(hojas.length > 1 ? hojas.map((_,i)=>i) : []);
  };

  const hojas        = recursoSel?.hojas || [];
  const tieneHojas   = hojas.length > 1;
  const todasActivas = tieneHojas && hojasChecked.length === hojas.length;

  const toggleHoja = (i) => setHojasChecked(prev =>
    prev.includes(i) ? prev.filter(x=>x!==i) : [...prev, i]
  );

  const pregsCount = tieneHojas
    ? hojasChecked.reduce((acc,i) => acc + (hojas[i]?.preguntas?.length || 0), 0)
    : (recursoSel?.hojas?.[0]?.preguntas?.length || recursoSel?.preguntas?.length || 0);

  const iniciar = () => {
    if (!recursoSel) return;
    let selectedNames;
    if (!tieneHojas) {
      selectedNames = ['General'];
    } else {
      selectedNames = hojasChecked.map(i => hojas[i]?.nombreHoja).filter(Boolean);
      if (!selectedNames.length) return;
    }
    onIniciar(recursoSel, selectedNames, circuito);
  };

  const st = {
    page:  { minHeight:'100vh', background:'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)', display:'flex', flexDirection:'column', alignItems:'center', padding:'30px 20px', color:'white', fontFamily:"'Segoe UI',sans-serif" },
    title: { fontSize:'2.2rem', fontWeight:900, margin:'0 0 6px', background:'linear-gradient(90deg,#FF6B00,#FFD700)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' },
    grid:  { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:16, width:'100%', maxWidth:860 },
    card:  (sel) => ({ background: sel?'rgba(255,107,0,0.25)':'rgba(255,255,255,0.07)', border:`2px solid ${sel?'#FF6B00':'rgba(255,255,255,0.12)'}`, borderRadius:14, padding:'16px 18px', cursor:'pointer', transition:'all .2s' }),
  };

  return (
    <div style={st.page}>
      <div style={{fontSize:'3rem',marginBottom:8}}>🏎️</div>
      <h1 style={st.title}>Karting Educativo</h1>
      <p style={{color:'#aaa',marginBottom:18}}>Elige un circuito y un recurso para la carrera</p>

      {/* Selector de circuito */}
      <div style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap',justifyContent:'center'}}>
        {[
          { n:1, label:'Circuito 1', sub:'Asfalto', icon:'🏎️', grad:'linear-gradient(135deg,#3a3a3a,#555)' },
          { n:2, label:'Circuito 2', sub:'Tierra',  icon:'🚙', grad:'linear-gradient(135deg,#7a5c28,#a07830)' },
        ].map(({n,label,sub,icon,grad})=>{
          const sel = circuito===n;
          return (
            <button key={n} onClick={()=>setCircuito(n)} style={{
              padding:'14px 28px', borderRadius:14, cursor:'pointer',
              border:`2px solid ${sel?'#FF6B00':'rgba(255,255,255,0.18)'}`,
              background: sel ? 'rgba(255,107,0,0.18)' : 'rgba(255,255,255,0.05)',
              color:'white', textAlign:'center', transition:'all 0.2s',
              boxShadow: sel ? '0 0 18px rgba(255,107,0,0.35)' : 'none',
            }}>
              <div style={{fontSize:'1.5rem',marginBottom:3}}>{icon}</div>
              <div style={{fontWeight:800,fontSize:'0.95rem'}}>{label}</div>
              <div style={{
                fontSize:'0.72rem', fontWeight:700, letterSpacing:1,
                padding:'2px 8px', borderRadius:6, marginTop:5,
                background: sel ? grad : 'rgba(255,255,255,0.1)',
                color: sel ? 'white' : 'rgba(255,255,255,0.6)',
                display:'inline-block',
              }}>{sub}</div>
            </button>
          );
        })}
      </div>

      {/* Botones de circuito propio */}
      <div style={{display:'flex',gap:10,marginBottom:24,flexWrap:'wrap',justifyContent:'center'}}>
        <button onClick={onConstruir} style={{
          padding:'10px 24px', borderRadius:12, cursor:'pointer',
          border:'1px solid rgba(255,215,0,0.35)',
          background:'rgba(255,215,0,0.08)', color:'#FFD700',
          fontSize:'0.85rem', fontWeight:700, letterSpacing:0.5,
          transition:'background .15s',
        }}>
          ✏️ Construir circuito
        </button>
        <button onClick={onAlmacen} style={{
          padding:'10px 24px', borderRadius:12, cursor:'pointer',
          border:'1px solid rgba(100,180,255,0.35)',
          background:'rgba(100,180,255,0.08)', color:'#64b4ff',
          fontSize:'0.85rem', fontWeight:700, letterSpacing:0.5,
          transition:'background .15s',
        }}>
          🗂️ Almacén de circuitos
        </button>
      </div>

      {cargando ? <p style={{color:'#aaa'}}>Cargando recursos...</p> : (
        <>
          <div style={st.grid}>
            {recursos.map(r=>(
              <div key={r.id} style={st.card(recursoSel?.id===r.id)} onClick={()=>seleccionar(r)}>
                <div style={{fontWeight:700,fontSize:'1rem',marginBottom:4}}>🚗 {r.titulo}</div>
                <div style={{color:'#aaa',fontSize:'0.78rem'}}>{r.temas||'Sin tema'} · {r.ciclo||''}</div>
                <div style={{color:'#aaa',fontSize:'0.78rem'}}>{r.hojas?.length||1} hoja(s)</div>
              </div>
            ))}
            {!recursos.length && <p style={{color:'#aaa'}}>No hay recursos disponibles.</p>}
          </div>

          {recursoSel && (
            <div style={{marginTop:28,width:'100%',maxWidth:860}}>
              {/* Selector multi-hoja */}
              {tieneHojas && (
                <div style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.14)',borderRadius:14,padding:'14px 16px',marginBottom:14}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                    <div style={{color:'#FFD700',fontSize:'0.88rem',fontWeight:700}}>📋 Hojas a incluir en la carrera</div>
                    <button
                      onClick={() => setHojasChecked(todasActivas ? [] : hojas.map((_,i)=>i))}
                      style={{background:'rgba(255,215,0,0.15)',border:'1px solid rgba(255,215,0,0.35)',color:'#FFD700',borderRadius:6,padding:'3px 12px',cursor:'pointer',fontSize:'0.75rem',fontWeight:700}}>
                      {todasActivas ? 'Ninguna' : 'Todas'}
                    </button>
                  </div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                    {hojas.map((h,i) => {
                      const nombre = h.nombreHoja || `Hoja ${i+1}`;
                      const count  = h.preguntas?.length || 0;
                      const activa = hojasChecked.includes(i);
                      return (
                        <button key={i} onClick={() => toggleHoja(i)} style={{
                          padding:'7px 14px', borderRadius:9, cursor:'pointer',
                          border:  activa ? '2px solid #FF6B00' : '2px solid rgba(255,255,255,0.18)',
                          background: activa ? 'rgba(255,107,0,0.2)' : 'rgba(255,255,255,0.05)',
                          color:   activa ? '#FF6B00' : 'rgba(255,255,255,0.55)',
                          fontSize:'0.82rem', fontWeight:700, transition:'all 0.15s',
                        }}>
                          {nombre} <span style={{opacity:0.6,fontWeight:400}}>({count})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Info recurso */}
              <div style={{background:'rgba(255,107,0,0.1)',border:'2px solid rgba(255,107,0,0.3)',borderRadius:14,padding:'12px 20px',marginBottom:14,textAlign:'center'}}>
                <div style={{color:'#FFD700',fontWeight:800,marginBottom:4}}>{recursoSel.titulo}</div>
                <div style={{color:'#aaa',fontSize:'0.82rem'}}>
                  {pregsCount} pregunta{pregsCount!==1?'s':''}
                  {tieneHojas && hojasChecked.length > 0 && hojasChecked.length < hojas.length &&
                    <span> · {hojasChecked.length}/{hojas.length} hojas seleccionadas</span>}
                </div>
              </div>

              {tieneHojas && hojasChecked.length === 0 ? (
                <p style={{color:'#ff5252',textAlign:'center',fontSize:'0.9rem'}}>⚠️ Selecciona al menos una hoja</p>
              ) : (
                <div style={{display:'flex',justifyContent:'center'}}>
                  <button onClick={iniciar} style={{
                    padding:'14px 40px', borderRadius:14, border:'none', cursor:'pointer',
                    fontWeight:800, fontSize:'1.1rem', color:'white',
                    background:'linear-gradient(135deg,#FF6B00,#CC4400)',
                    boxShadow:'0 4px 20px rgba(255,107,0,0.4)',
                  }}>
                    🏁 ¡Empezar carrera!
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MODAL ENVIAR AL PROFESOR
// ════════════════════════════════════════════════════════════════════════════
function ModalEnviarProfe({ resultado, recurso, hojas, onClose }) {
  const [nombre,   setNombre]   = useState('');
  const [curso,    setCurso]    = useState('');
  const [codigo,   setCodigo]   = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado,  setEnviado]  = useState(false);
  const [error,    setError]    = useState('');

  const enviar = async () => {
    if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
    const code = codigo.trim().toUpperCase();
    if (!code) { setError('Escribe el código del profesor.'); return; }
    setEnviando(true); setError('');
    try {
      const codigoDoc = await getDoc(doc(db, 'codigos_profesor', code));
      if (!codigoDoc.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
      const acertadas = resultado.acertadas ?? 0;
      const falladas  = resultado.falladas  ?? 0;
      const total     = acertadas + falladas;
      const pct       = total > 0 ? Math.round(acertadas / total * 100) : 0;
      await addDoc(collection(db, 'informes_juegos'), {
        tipo: 'KARTINGED_TRACK', modalidad: 'Individual', fecha: new Date(),
        recursoId: recurso.id, recursoTitulo: recurso.titulo,
        hojas: hojas.join(', '), codigoProfesor: code,
        jugadores: [{ nombre: nombre.trim(), curso: curso.trim(),
          hojas: hojas.join(', '),
          tiempo: resultado.tiempo, tiempoFormateado: resultado.tiempoFormateado,
          posicion: resultado.posicion,
          intentos: total, aciertos: acertadas, fallos: falladas, porcentaje: pct }],
      });
      setEnviado(true);
    } catch (e) { setError('Error: ' + e.message); }
    setEnviando(false);
  };

  const st = {
    overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:10000, display:'flex', justifyContent:'center', alignItems:'center', padding:16 },
    box:  { background:'#1e272e', border:'1px solid rgba(255,255,255,0.15)', borderRadius:20, width:'100%', maxWidth:380, padding:'24px 26px', color:'white', fontFamily:"'Segoe UI',sans-serif" },
    inp:  { padding:'9px 12px', borderRadius:9, border:'1.5px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.08)', color:'white', fontSize:'0.9rem', outline:'none', width:'100%', boxSizing:'border-box' },
  };

  return (
    <div style={st.overlay}>
      <div style={st.box}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
          <h3 style={{margin:0,color:'#f1c40f',fontSize:'1.05rem'}}>📤 Enviar al profesor</h3>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#aaa',cursor:'pointer',fontSize:'1.2rem'}}>✕</button>
        </div>
        {enviado ? (
          <div style={{textAlign:'center',padding:'16px 0'}}>
            <div style={{fontSize:'2.8rem'}}>✅</div>
            <div style={{color:'#2ecc71',fontWeight:700,marginTop:8}}>¡Informe enviado!</div>
            <div style={{color:'#aaa',fontSize:'0.85rem',marginTop:6}}>
              {resultado.tiempoFormateado} · {resultado.acertadas ?? 0} aciertos · {resultado.falladas ?? 0} fallos
            </div>
            <button onClick={onClose} style={{marginTop:14,padding:'9px 22px',borderRadius:10,border:'none',background:'rgba(255,255,255,0.1)',cursor:'pointer',color:'white'}}>Cerrar</button>
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {[
              ['Nombre y apellido', nombre, setNombre, 'Tu nombre completo', false],
              ['Curso', curso, setCurso, 'Ej: 3º ESO A', false],
              ['Código del profesor', codigo, v=>setCodigo(v.toUpperCase()), 'Ej: PROF01', true],
            ].map(([label,val,setter,ph,mono],i) => (
              <div key={i}>
                <label style={{fontSize:'0.76rem',color:'#aaa',fontWeight:600,display:'block',marginBottom:4}}>{label}</label>
                <input value={val} onChange={e=>setter(e.target.value)} placeholder={ph}
                  style={{...st.inp, letterSpacing:mono?2:0, fontWeight:mono?700:400}}/>
              </div>
            ))}
            {/* Resumen */}
            <div style={{background:'rgba(255,255,255,0.05)',borderRadius:8,padding:'8px 12px',fontSize:'0.8rem',color:'#aaa',lineHeight:1.7}}>
              <div>📚 {recurso.titulo}</div>
              <div>📋 {hojas.join(', ')}</div>
              <div>⏱ {resultado.tiempoFormateado} · 🏆 {resultado.posicion}° · ✅ {resultado.acertadas ?? 0} / ❌ {resultado.falladas ?? 0}</div>
            </div>
            {error && <div style={{color:'#e74c3c',fontSize:'0.8rem'}}>⚠ {error}</div>}
            <div style={{display:'flex',gap:9,marginTop:2}}>
              <button onClick={onClose} style={{flex:1,padding:'10px',borderRadius:10,border:'1px solid rgba(255,255,255,0.2)',background:'transparent',cursor:'pointer',color:'white'}}>Cancelar</button>
              <button onClick={enviar} disabled={enviando} style={{flex:2,padding:'10px',borderRadius:10,border:'none',background:enviando?'#555':'linear-gradient(135deg,#3498db,#2980b9)',color:'white',fontWeight:700,cursor:enviando?'default':'pointer'}}>
                {enviando ? 'Enviando…' : '📤 Enviar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MODAL DE PREGUNTA en checkpoint
// ════════════════════════════════════════════════════════════════════════════
function ModalPregunta({ datos, onRespuesta }) {
  const [elegida,   setElegida]   = useState(null);
  const [resultado, setResultado] = useState(null);
  const { opciones, correcta, cpIdx, texto } = datos;

  const responder = (op) => {
    if (elegida !== null) return;
    const ok = op === correcta;
    setElegida(op);
    setResultado(ok ? 'ok' : 'fail');
    try { const s=new Audio(ok?sndOk:sndFail); s.volume=0.85; s.play().catch(()=>{}); } catch(e){}
    setTimeout(() => onRespuesta(ok), 1200);
  };

  const colorBtn = (op) => {
    if (elegida === null) return 'rgba(255,255,255,0.1)';
    if (op === correcta)  return '#27ae60';
    if (op === elegida)   return '#c0392b';
    return 'rgba(255,255,255,0.05)';
  };

  return (
    <div style={{
      position:'absolute', inset:0, background:'rgba(0,0,0,0.80)',
      display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:100, padding:12,
    }}>
      <div style={{
        background:'linear-gradient(160deg,#1a1a2e,#0f3460)',
        border:'2px solid rgba(255,107,0,0.5)', borderRadius:18,
        padding:'20px 24px', maxWidth:480, width:'100%',
        maxHeight:'88vh', overflowY:'auto',
        color:'white', fontFamily:"'Segoe UI',sans-serif",
        boxShadow:'0 0 60px rgba(255,107,0,0.3)',
      }}>
        <div style={{fontSize:'0.78rem',color:'#FF6B00',fontWeight:700,letterSpacing:2,marginBottom:10}}>
          🏁 CHECKPOINT {cpIdx+1} / 3
        </div>
        <div style={{fontSize:'1.08rem',fontWeight:600,lineHeight:1.5,marginBottom:16}}>
          {texto}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9}}>
          {opciones.map((op,i) => (
            <button key={i} onClick={()=>responder(op)} style={{
              padding:'11px 10px', borderRadius:11,
              border:'1px solid rgba(255,255,255,0.15)',
              background: colorBtn(op), color:'white', fontSize:'0.88rem',
              cursor: elegida===null ? 'pointer' : 'default',
              fontWeight: op===correcta&&elegida!==null ? 700 : 400,
              transition:'background 0.2s', textAlign:'left',
            }}>
              {['A','B','C','D'][i]}. {op}
            </button>
          ))}
        </div>
        {resultado && (
          <div style={{marginTop:14,textAlign:'center',fontSize:'1.25rem',fontWeight:900,
            color: resultado==='ok' ? '#2ecc71' : '#e74c3c'}}>
            {resultado==='ok' ? '✅ ¡Correcto!' : `❌ Correcta: ${correcta}`}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CONFIG PREVIA AL TEST DEL CIRCUITO LIBRE
// ════════════════════════════════════════════════════════════════════════════
function TrackTestSetup({ onIniciar, onVolver }) {
  const [recursos,     setRecursos]     = useState([]);
  const [cargando,     setCargando]     = useState(true);
  const [recursoSel,   setRecursoSel]   = useState(null);
  const [hojasChecked, setHojasChecked] = useState([]);
  const [numVueltas,   setNumVueltas]   = useState(2);

  useEffect(() => {
    (async () => {
      try {
        const [s1, s2] = await Promise.all([
          getDocs(query(collection(db,'resources'), where('tipoJuego','==','CAZABURBUJAS'), where('isPrivate','==',false))),
          getDocs(query(collection(db,'resources'), where('tipoJuego','==','KARTINGED'),   where('isPrivate','==',false))),
        ]);
        setRecursos([...s1.docs,...s2.docs].map(d=>({id:d.id,...d.data()})));
      } catch(e) { console.error(e); }
      setCargando(false);
    })();
  }, []);

  const seleccionar = (r) => {
    setRecursoSel(r);
    const hs = r.hojas || [];
    setHojasChecked(hs.length > 1 ? hs.map((_,i)=>i) : []);
  };

  const hojas      = recursoSel?.hojas || [];
  const tieneHojas = hojas.length > 1;
  const toggleHoja = (i) => setHojasChecked(prev => prev.includes(i) ? prev.filter(x=>x!==i) : [...prev, i]);

  const pregsCount = tieneHojas
    ? hojasChecked.reduce((acc,i) => acc + (hojas[i]?.preguntas?.length || 0), 0)
    : (recursoSel?.hojas?.[0]?.preguntas?.length || recursoSel?.preguntas?.length || 0);

  const iniciar = (sinRecurso = false) => {
    if (sinRecurso) { onIniciar(null, [], numVueltas); return; }
    if (!recursoSel) return;
    const sel = !tieneHojas ? ['General'] : hojasChecked.map(i=>hojas[i]?.nombreHoja).filter(Boolean);
    if (!sel.length) return;
    onIniciar(recursoSel, sel, numVueltas);
  };

  const st = {
    page:  { minHeight:'100vh', background:'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)', display:'flex', flexDirection:'column', alignItems:'center', padding:'30px 20px', color:'white', fontFamily:"'Segoe UI',sans-serif" },
    title: { fontSize:'2rem', fontWeight:900, margin:'0 0 6px', background:'linear-gradient(90deg,#FF6B00,#FFD700)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' },
    grid:  { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:12, width:'100%', maxWidth:800 },
    card:  (sel) => ({ background:sel?'rgba(255,107,0,0.22)':'rgba(255,255,255,0.07)', border:`2px solid ${sel?'#FF6B00':'rgba(255,255,255,0.12)'}`, borderRadius:12, padding:'14px 16px', cursor:'pointer', transition:'all .2s' }),
  };

  return (
    <div style={st.page}>
      <div style={{fontSize:'2.4rem',marginBottom:4}}>🏗️</div>
      <h2 style={st.title}>Configurar Prueba</h2>

      {/* Vueltas */}
      <div style={{marginBottom:18,textAlign:'center'}}>
        <div style={{color:'#FFD700',fontWeight:700,fontSize:'0.9rem',marginBottom:8}}>🔁 Número de vueltas</div>
        <div style={{display:'flex',gap:10,justifyContent:'center'}}>
          {[1,2,3,4,5].map(n=>(
            <button key={n} onClick={()=>setNumVueltas(n)} style={{
              width:44,height:44,borderRadius:10,border:`2px solid ${numVueltas===n?'#FF6B00':'rgba(255,255,255,0.2)'}`,
              background:numVueltas===n?'rgba(255,107,0,0.3)':'rgba(255,255,255,0.06)',
              color:'white',fontWeight:800,fontSize:'1rem',cursor:'pointer',transition:'all .15s',
            }}>{n}</button>
          ))}
        </div>
      </div>

      {/* Solo conducir */}
      <button onClick={()=>iniciar(true)} style={{
        marginBottom:20,padding:'10px 28px',borderRadius:12,cursor:'pointer',
        border:'1px solid rgba(255,255,255,0.22)',background:'rgba(255,255,255,0.08)',
        color:'white',fontSize:'0.88rem',fontWeight:700,
      }}>🚗 Solo conducir (sin preguntas)</button>

      {/* Recursos */}
      <p style={{color:'#aaa',fontSize:'0.82rem',marginBottom:12}}>O elige un recurso con preguntas:</p>
      {cargando ? <p style={{color:'#aaa'}}>Cargando recursos...</p> : (
        <>
          <div style={st.grid}>
            {recursos.map(r=>(
              <div key={r.id} style={st.card(recursoSel?.id===r.id)} onClick={()=>seleccionar(r)}>
                <div style={{fontWeight:700,fontSize:'0.95rem',marginBottom:3}}>🚗 {r.titulo}</div>
                <div style={{color:'#aaa',fontSize:'0.75rem'}}>{r.temas||'Sin tema'} · {r.hojas?.length||1} hoja(s)</div>
              </div>
            ))}
            {!recursos.length && <p style={{color:'#aaa'}}>No hay recursos disponibles.</p>}
          </div>

          {recursoSel && (
            <div style={{marginTop:20,width:'100%',maxWidth:800}}>
              {tieneHojas && (
                <div style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.14)',borderRadius:12,padding:'12px 14px',marginBottom:12}}>
                  <div style={{color:'#FFD700',fontSize:'0.84rem',fontWeight:700,marginBottom:8}}>📋 Hojas</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                    {hojas.map((h,i)=>{
                      const nombre=h.nombreHoja||`Hoja ${i+1}`, count=h.preguntas?.length||0, activa=hojasChecked.includes(i);
                      return(
                        <button key={i} onClick={()=>toggleHoja(i)} style={{
                          padding:'6px 12px',borderRadius:8,cursor:'pointer',
                          border:activa?'2px solid #FF6B00':'2px solid rgba(255,255,255,0.18)',
                          background:activa?'rgba(255,107,0,0.2)':'rgba(255,255,255,0.05)',
                          color:activa?'#FF6B00':'rgba(255,255,255,0.55)',
                          fontSize:'0.8rem',fontWeight:700,transition:'all .15s',
                        }}>{nombre} <span style={{opacity:.6,fontWeight:400}}>({count})</span></button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div style={{background:'rgba(255,107,0,0.1)',border:'2px solid rgba(255,107,0,0.3)',borderRadius:12,padding:'10px 16px',marginBottom:12,textAlign:'center'}}>
                <div style={{color:'#FFD700',fontWeight:800,marginBottom:2}}>{recursoSel.titulo}</div>
                <div style={{color:'#aaa',fontSize:'0.8rem'}}>{pregsCount} pregunta{pregsCount!==1?'s':''} · máx. 4 por vuelta</div>
              </div>
              {tieneHojas&&hojasChecked.length===0
                ? <p style={{color:'#ff5252',textAlign:'center',fontSize:'0.88rem'}}>⚠️ Selecciona al menos una hoja</p>
                : (
                  <div style={{textAlign:'center'}}>
                    <button onClick={()=>iniciar(false)} style={{
                      padding:'12px 36px',borderRadius:12,border:'none',cursor:'pointer',
                      fontWeight:800,fontSize:'1rem',color:'white',
                      background:'linear-gradient(135deg,#FF6B00,#CC4400)',
                      boxShadow:'0 4px 20px rgba(255,107,0,0.4)',
                    }}>🏁 ¡Probar circuito!</button>
                  </div>
                )
              }
            </div>
          )}
        </>
      )}

      <button onClick={onVolver} style={{marginTop:20,padding:'9px 20px',borderRadius:10,
        border:'1px solid rgba(255,255,255,0.18)',background:'rgba(255,255,255,0.07)',
        color:'white',cursor:'pointer',fontSize:'0.85rem'}}>← Volver al editor</button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PANTALLA DE RESULTADOS
// ════════════════════════════════════════════════════════════════════════════
function PantallaResultados({ resultado, recurso, hojas, onReintentar, onSalir }) {
  const [modalProfe, setModalProfe] = useState(false);
  const st = {
    page: { minHeight:'100vh', background:'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)', display:'flex', flexDirection:'column', alignItems:'center', padding:'40px 20px', color:'white', fontFamily:"'Segoe UI',sans-serif" },
    box:  { background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:20, padding:'24px 28px', width:'100%', maxWidth:440, marginBottom:22 },
    row:  { display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid rgba(255,255,255,0.08)', fontSize:'1rem' },
    btn:  (bg) => ({ padding:'12px 24px', borderRadius:12, border:'none', cursor:'pointer', fontWeight:700, fontSize:'0.95rem', color:'white', background:bg }),
  };
  return (
    <div style={st.page}>
      <div style={{fontSize:'3rem',marginBottom:8}}>🏁</div>
      <h1 style={{fontSize:'2rem',fontWeight:900,margin:'0 0 22px',color:'#FFD700'}}>¡Carrera terminada!</h1>
      <div style={st.box}>
        <div style={st.row}><span>🏆 Posición</span><b>{resultado.posicion}°</b></div>
        <div style={st.row}><span>⏱ Tiempo total</span><b>{resultado.tiempoFormateado}</b></div>
        <div style={st.row}><span>✅ Aciertos</span><b style={{color:'#2ecc71'}}>{resultado.acertadas}</b></div>
        <div style={st.row}><span>❌ Fallos</span><b style={{color:'#e74c3c'}}>{resultado.falladas}</b></div>
        <div style={st.row}><span>⏳ Penalización</span><b style={{color:'#e67e22'}}>{resultado.penaltySecs>0?`+${resultado.penaltySecs}s`:'—'}</b></div>
        {recurso && <>
          <div style={st.row}><span>📚 Recurso</span><b style={{fontSize:'0.88rem',maxWidth:200,textAlign:'right'}}>{recurso.titulo}</b></div>
          <div style={{...st.row,borderBottom:'none',flexWrap:'wrap',gap:4,alignItems:'flex-start'}}>
            <span>📋 Hojas</span>
            <b style={{fontSize:'0.85rem',maxWidth:220,textAlign:'right'}}>{hojas.join(', ')}</b>
          </div>
        </>}
      </div>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',justifyContent:'center'}}>
        {recurso && <button style={st.btn('linear-gradient(135deg,#27ae60,#1e8449)')} onClick={()=>setModalProfe(true)}>📤 Enviar al profesor</button>}
        <button style={st.btn('linear-gradient(135deg,#FF6B00,#CC4400)')} onClick={onReintentar}>🔄 Volver a jugar</button>
        <button style={st.btn('rgba(255,255,255,0.1)')} onClick={onSalir}>🏠 Salir</button>
      </div>
      {modalProfe && recurso && <ModalEnviarProfe resultado={resultado} recurso={recurso} hojas={hojas} onClose={()=>setModalProfe(false)}/>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// JOYSTICK VIRTUAL
// ════════════════════════════════════════════════════════════════════════════
const JOY_R = 62;

function Joystick({ joyRef }) {
  const baseRef  = useRef(null);
  const [knob, setKnob] = useState({ x:0, y:0 });
  const dragging = useRef(false);

  const fromCenter = (cx, cy) => {
    if (!baseRef.current) return;
    const rect  = baseRef.current.getBoundingClientRect();
    const dx    = cx - (rect.left + rect.width  / 2);
    const dy    = cy - (rect.top  + rect.height / 2);
    const dist  = Math.hypot(dx, dy);
    const cl    = Math.min(dist, JOY_R);
    const angle = Math.atan2(dy, dx);
    const x = Math.cos(angle) * cl;
    const y = Math.sin(angle) * cl;
    setKnob({ x, y });
    joyRef.current = { x: x/JOY_R, y: y/JOY_R, active: true };
  };

  const release = () => {
    dragging.current = false;
    setKnob({ x:0, y:0 });
    joyRef.current = { x:0, y:0, active: false };
  };

  const onTouchStart = (e) => { e.preventDefault(); dragging.current=true; fromCenter(e.targetTouches[0].clientX, e.targetTouches[0].clientY); };
  const onTouchMove  = (e) => { e.preventDefault(); if(dragging.current) fromCenter(e.targetTouches[0].clientX, e.targetTouches[0].clientY); };
  const onTouchEnd   = (e) => { e.preventDefault(); release(); };

  const onMouseDown = (e) => {
    dragging.current = true;
    fromCenter(e.clientX, e.clientY);
    const move = (me) => { if(dragging.current) fromCenter(me.clientX, me.clientY); };
    const up   = ()   => { release(); document.removeEventListener('mousemove',move); document.removeEventListener('mouseup',up); };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup',   up);
  };

  const isCenter = knob.x===0 && knob.y===0;
  return (
    <div ref={baseRef}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      style={{
        position:'absolute', bottom:32, right:32,   /* ← derecha */
        width:JOY_R*2, height:JOY_R*2, borderRadius:'50%',
        background:'rgba(255,255,255,0.10)',
        border:'2px solid rgba(255,255,255,0.28)',
        backdropFilter:'blur(6px)', touchAction:'none',
        userSelect:'none', cursor:'grab',
        display:'flex', alignItems:'center', justifyContent:'center',
        zIndex:50,
      }}>
      <div style={{position:'absolute',width:'100%',height:1,background:'rgba(255,255,255,0.12)'}}/>
      <div style={{position:'absolute',width:1,height:'100%',background:'rgba(255,255,255,0.12)'}}/>
      <div style={{
        width:46, height:46, borderRadius:'50%',
        background:'rgba(255,255,255,0.50)',
        border:'2px solid rgba(255,255,255,0.85)',
        boxShadow:'0 2px 14px rgba(0,0,0,0.35)',
        transform:`translate(${knob.x}px,${knob.y}px)`,
        transition: isCenter ? 'transform 0.13s ease-out' : 'none',
        pointerEvents:'none',
      }}/>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// JUEGO 3D
// ════════════════════════════════════════════════════════════════════════════
// ── Toast flotante de acierto / fallo ────────────────────────────────────────
const BURST_ANGLES = [0,45,90,135,180,225,270,315];

function FloatingToast({ type, seconds }) {
  const isOk  = type === 'ok';
  const emoji = isOk ? '⭐' : '✖';

  return (
    <>
      {/* Flash de pantalla */}
      <div style={{
        position:'absolute', inset:0, pointerEvents:'none', zIndex:195,
        background: isOk ? 'rgba(46,204,113,1)' : 'rgba(231,76,60,1)',
        animation:`${isOk?'kt-flash-ok':'kt-flash-fail'} 0.7s ease-out forwards`,
      }}/>

      {/* Centro de la explosión: 50% / 45% */}
      <div style={{position:'absolute', left:'50%', top:'45%', zIndex:210, pointerEvents:'none'}}>

        {/* Partículas radiales */}
        {BURST_ANGLES.map((angle, i) => (
          <div key={i} style={{
            position:'absolute', left:0, top:0,
            transform:`rotate(${angle}deg)`,
            width:0, height:0,
          }}>
            <span style={{
              position:'absolute',
              left:-14, top:-14,
              width:28, height:28,
              fontSize:isOk?'20px':'17px',
              lineHeight:'28px',
              textAlign:'center',
              display:'block',
              opacity:0,
              animation:`kt-part 1.25s ${i*0.06}s cubic-bezier(0.15,0.8,0.35,1) both`,
              filter: isOk
                ? 'drop-shadow(0 0 6px rgba(255,220,0,0.9))'
                : 'drop-shadow(0 0 6px rgba(255,50,50,0.9))',
            }}>{emoji}</span>
          </div>
        ))}

        {/* Badge principal */}
        <div style={{
          position:'absolute',
          opacity:0,
          animation:`${isOk?'kt-badge-ok':'kt-badge-fail'} 2.5s ease-out forwards`,
          background: isOk
            ? 'linear-gradient(135deg,#ffe44d 0%,#ff9500 55%,#ff5e00 100%)'
            : 'linear-gradient(135deg,#ff4444 0%,#cc0000 55%,#7a0000 100%)',
          borderRadius:22,
          padding:'12px 30px',
          textAlign:'center',
          whiteSpace:'nowrap',
          boxShadow: isOk
            ? '0 0 55px rgba(255,180,0,0.95), 0 0 110px rgba(255,107,0,0.5), 0 10px 36px rgba(0,0,0,0.7)'
            : '0 0 55px rgba(231,60,60,0.95), 0 0 110px rgba(180,0,0,0.5), 0 10px 36px rgba(0,0,0,0.7)',
          border: isOk
            ? '2px solid rgba(255,255,200,0.55)'
            : '2px solid rgba(255,130,130,0.45)',
        }}>
          <div style={{
            fontSize:'0.6rem', fontWeight:800,
            color:'rgba(255,255,255,0.88)', letterSpacing:3,
            marginBottom:4, textTransform:'uppercase',
          }}>
            {isOk ? '¡Acierto! Bonus' : 'Error · Penalización'}
          </div>
          <div style={{
            fontSize:'3.4rem', fontWeight:900, color:'white',
            lineHeight:1, letterSpacing:-1,
            textShadow:'0 3px 14px rgba(0,0,0,0.55)',
          }}>
            {isOk ? `−${seconds}s` : `+${seconds}s`}
          </div>
          <div style={{fontSize:'1.5rem', marginTop:5, letterSpacing:4}}>
            {isOk ? '⭐⭐⭐' : '💥💥'}
          </div>
        </div>

      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
function KartingGame({ recurso, hojas, circuito=1, onTerminar, onSalir }) {
  const isC2 = circuito === 2;
  const cfg = {
    track:    isC2 ? TRACK2        : TRACK,
    cols:     isC2 ? COLS2         : COLS,
    rows:     isC2 ? ROWS2         : ROWS,
    tileSrcs: isC2 ? TILE_SRCS2    : TILE_SRCS,
    tileRots: isC2 ? TILE_ROTATIONS2 : TILE_ROTATIONS,
    waypoints:isC2 ? WAYPOINTS2    : WAYPOINTS,
    cpPos:    isC2 ? CHECKPOINT_POS2 : CHECKPOINT_POS,
    groundClr:isC2 ? 0x8B7355      : 0x4a7c3f,
    startWp:  isC2 ? 2             : 3,
  };

  const mountRef    = useRef(null);
  const keysRef     = useRef({});
  const joystickRef = useRef({ x:0, y:0, active:false });

  const [phase,       setPhase]       = useState('countdown');
  const [countdown,   setCountdown]   = useState(3);
  const [playerLap,   setPlayerLap]   = useState(1);
  const [lapTimes,    setLapTimes]    = useState([]);
  const [currentMs,   setCurrentMs]   = useState(0);
  const [playerPos,   setPlayerPos]   = useState(1);
  const [aciertos,    setAciertos]    = useState(0);
  const [falladas,    setFalladas]    = useState(0);
  const [isFullscreen,setIsFullscreen]= useState(false);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [toasts,      setToasts]      = useState([]);
  const toastIdRef = useRef(0);

  const questionActiveRef = useRef(false);
  const answeredCpsRef    = useRef(new Set());
  const cpMeshRef         = useRef([]);
  const penaltyRef        = useRef(0);
  const aciertasRef       = useRef(0);
  const falladasRef       = useRef(0);
  const pauseStartRef     = useRef(0);
  const totalPausedRef    = useRef(0);
  const questionPoolRef   = useRef([]);
  const qIdxRef           = useRef(0);

  // ── Fullscreen ───────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(()=>{});
    } else {
      document.exitFullscreen?.();
    }
  };

  // ── Pool de preguntas ────────────────────────────────────────────────────
  useEffect(() => {
    let pool = [];
    if (!hojas || hojas.includes('General') || !recurso.hojas?.length) {
      pool = recurso.hojas?.flatMap(h => h.preguntas || []) || recurso.preguntas || [];
    } else {
      pool = hojas.flatMap(nombre => {
        const h = recurso.hojas?.find(hh => hh.nombreHoja === nombre);
        return h?.preguntas || [];
      });
    }
    questionPoolRef.current = shuffle(pool);
    qIdxRef.current = 0;
  }, [recurso, hojas]);

  const pickQuestion = () => {
    const pool = questionPoolRef.current;
    if (!pool.length) return null;
    if (qIdxRef.current >= pool.length) {
      questionPoolRef.current = shuffle(pool);
      qIdxRef.current = 0;
    }
    const q = pool[qIdxRef.current++];
    return { texto: getTexto(q), opciones: buildOpciones(q), correcta: getRespuesta(q) };
  };

  const addToast = (type, seconds) => {
    const id = toastIdRef.current++;
    setToasts(prev => [...prev, { id, type, seconds }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2700);
  };

  const handleAnswer = (isCorrect) => {
    totalPausedRef.current += Date.now() - pauseStartRef.current;
    if (isCorrect) {
      aciertasRef.current++;
      setAciertos(a => a+1);
      penaltyRef.current -= 3000;          // bonus: ganas 3 segundos
      addToast('ok', 3);
    } else {
      falladasRef.current++;
      setFalladas(f => f+1);
      penaltyRef.current += 5000;          // penalización: pierdes 5 segundos
      addToast('fail', 5);
    }
    questionActiveRef.current = false;
    setActiveQuestion(null);
  };

  // ── Three.js loop ────────────────────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.016);
    const camera = new THREE.PerspectiveCamera(70, mount.clientWidth/mount.clientHeight, 0.1, 300);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xfff5e0, 1.0);
    sun.position.set(30,50,20); sun.castShadow=true;
    sun.shadow.camera.left=sun.shadow.camera.bottom=-90;
    sun.shadow.camera.right=sun.shadow.camera.top=90;
    sun.shadow.camera.far=250;
    scene.add(sun);

    const isCarOnRoad = buildIsOnRoad(cfg.track, cfg.rows, cfg.cols);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(cfg.cols*TW+20, cfg.rows*TW+20),
      new THREE.MeshLambertMaterial({color:cfg.groundClr})
    );
    ground.rotation.x=-Math.PI/2;
    ground.position.set(cfg.cols*TW/2,-0.01,cfg.rows*TW/2);
    ground.receiveShadow=true;
    scene.add(ground);

    const loader = new THREE.TextureLoader();
    const tileGeo = new THREE.PlaneGeometry(TW,TW);
    const textures = {};
    Object.entries(cfg.tileSrcs).forEach(([k,src])=>{
      const tex=loader.load(src); tex.colorSpace=THREE.SRGBColorSpace; textures[+k]=tex;
    });
    // Circuito 2: road_dirt01 es la recta (horizontal en la imagen).
    // V-tiles: rotar 90° → vertical. H-tiles: rotar 180° → sigue horizontal.
    let dirt04Tex = null, dirt04CcwTex = null, dirt04PlainTex = null, dirt04_180Tex = null;
    if (isC2) {
      const orig = textures[V];
      const vTex = orig.clone();
      vTex.rotation = Math.PI / 2; vTex.center.set(0.5, 0.5);
      textures[V] = vTex;
      const hTex = orig.clone();
      hTex.rotation = Math.PI; hTex.center.set(0.5, 0.5);
      textures[H] = hTex;
      // road_dirt04 horario (−PI/2) para curvas 4 y 8
      dirt04Tex = loader.load(dirtTile04);
      dirt04Tex.colorSpace = THREE.SRGBColorSpace;
      dirt04Tex.rotation = -Math.PI / 2;
      dirt04Tex.center.set(0.5, 0.5);
      // road_dirt04 antihorario (+PI/2) para curva 1
      dirt04CcwTex = loader.load(dirtTile04);
      dirt04CcwTex.colorSpace = THREE.SRGBColorSpace;
      dirt04CcwTex.rotation = Math.PI / 2;
      dirt04CcwTex.center.set(0.5, 0.5);
      // road_dirt04 sin girar para curvas 2 y 6
      dirt04PlainTex = loader.load(dirtTile04);
      dirt04PlainTex.colorSpace = THREE.SRGBColorSpace;
      // road_dirt04 girado 180° para curvas 5 y 7
      dirt04_180Tex = loader.load(dirtTile04);
      dirt04_180Tex.colorSpace = THREE.SRGBColorSpace;
      dirt04_180Tex.rotation = Math.PI;
      dirt04_180Tex.center.set(0.5, 0.5);
    }
    for(let r=0;r<cfg.rows;r++) for(let c=0;c<cfg.cols;c++) {
      const t=cfg.track[r][c]; if(t===G) continue;
      const mesh=new THREE.Mesh(tileGeo,new THREE.MeshLambertMaterial({map:textures[t]}));
      mesh.rotation.x=-Math.PI/2;
      mesh.position.set(c*TW+TW/2,0,r*TW+TW/2);
      const rot=cfg.tileRots[`${r},${c}`];
      if(rot) mesh.rotation.z=-rot;
      if(isC2 && (t===A||t===B||t===C||t===D)) mesh.rotation.z += Math.PI/2;
      // Overrides road_dirt04 por posición
      if(isC2) {
        let ovTex = null;
        if(r===1  && c===1 )  ovTex = dirt04CcwTex;   // curva 1 antihorario
        if(r===4  && c===7 )  ovTex = dirt04CcwTex;   // curva 3 antihorario
        if(r===1  && c===16)  ovTex = dirt04PlainTex;  // curva 2 sin girar
        if(r===4  && c===16)  ovTex = dirt04Tex;       // curva 4 horario
        if(r===8  && c===7 )  ovTex = dirt04_180Tex;  // curva 5 180°
        if(r===8  && c===16)  ovTex = dirt04PlainTex;  // curva 6 sin girar
        if(r===12 && c===1 )  ovTex = dirt04_180Tex;  // curva 7 180°
        if(r===12 && c===16)  ovTex = dirt04Tex;       // curva 8 horario
        if(ovTex) { mesh.material.map = ovTex; mesh.material.needsUpdate = true; mesh.rotation.z = 0; }
      }
      mesh.receiveShadow=true;
      scene.add(mesh);
    }

    // Línea de meta
    const finCanvas=document.createElement('canvas'); finCanvas.width=128; finCanvas.height=64;
    const fCtx=finCanvas.getContext('2d');
    for(let col=0;col<8;col++) for(let row=0;row<4;row++) {
      fCtx.fillStyle=(col+row)%2===0?'#111':'#fff';
      fCtx.fillRect(col*16,row*16,16,16);
    }
    const finLine=new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF*2,1.4),
      new THREE.MeshLambertMaterial({map:new THREE.CanvasTexture(finCanvas)}));
    finLine.rotation.x=-Math.PI/2; finLine.position.set(FINISH_X,0.02,1.5*TW); scene.add(finLine);

    const poleGeo=new THREE.CylinderGeometry(0.12,0.12,5,8);
    const poleMat=new THREE.MeshLambertMaterial({color:0x888888});
    [-3.2,3.2].forEach(oz=>{
      const p=new THREE.Mesh(poleGeo,poleMat); p.position.set(FINISH_X,2.5,1.5*TW+oz); scene.add(p);
    });
    const lightsTex=loader.load(lightsImg); lightsTex.colorSpace=THREE.SRGBColorSpace;
    const lightsSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:lightsTex,transparent:true}));
    lightsSprite.position.set(FINISH_X,5.5,1.5*TW); lightsSprite.scale.set(3.5,5,1); scene.add(lightsSprite);

    // Checkpoints
    cpMeshRef.current = [];
    cfg.cpPos.forEach(([cpx, cpz], i) => {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12,0.15,3.5,8),
        new THREE.MeshLambertMaterial({color:0x555555})
      );
      post.position.set(cpx,1.75,cpz); scene.add(post);
      const sphereMat = new THREE.MeshLambertMaterial({color:0xFF6B00, emissive:0xFF3300, emissiveIntensity:0.4});
      const sphere    = new THREE.Mesh(new THREE.SphereGeometry(0.7,14,14), sphereMat);
      sphere.position.set(cpx,3.8,cpz); scene.add(sphere);
      cpMeshRef.current[i] = sphereMat;
      const nc=document.createElement('canvas'); nc.width=64; nc.height=64;
      const nctx=nc.getContext('2d');
      nctx.fillStyle='rgba(0,0,0,0)'; nctx.fillRect(0,0,64,64);
      nctx.fillStyle='#fff'; nctx.font='bold 44px Arial';
      nctx.textAlign='center'; nctx.textBaseline='middle';
      nctx.fillText(i+1,32,32);
      const numSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(nc),transparent:true}));
      numSprite.position.set(cpx,3.85,cpz); numSprite.scale.set(1.4,1.4,1); scene.add(numSprite);
    });

    // Coches
    const car=buildCar(scene,0xe74c3c,0xc0392b);
    car.position.set(4.5*TW,0,1.5*TW); car.rotation.y=-Math.PI/2;
    car.scale.set(0.70,0.70,0.70);
    const ai=buildCar(scene,0x2980b9,0x1a5276);
    ai.position.set(3.5*TW,0,1.5*TW); ai.rotation.y=-Math.PI/2;
    ai.scale.set(0.70,0.70,0.70);

    let speed=0;
    const MAX_SPEED=0.30, ACCEL=0.007, FRICTION=0.965, BRAKE_F=0.90, TURN=0.022, SLIDE_FACTOR=0.88;
    let aiSpeed=0, aiWpIdx=cfg.startWp, aiStuckFrames=0, aiReverseFrames=0;
    const AI_MAX=0.20, AI_ACCEL=0.006, AI_TURN=0.10, AI_STUCK_LIMIT=45;

    let phaseLocal='countdown', countdownStart=Date.now();
    let playerLapLocal=0, aiLapLocal=0, lapStart=0;
    let lapTimesLocal=[], prevCarX=car.position.x, prevAiX=ai.position.x;
    let lastTimerUpdate=0, playerWpIdx=cfg.startWp, goPlayed=false, startPlayed=false;

    // Audio
    const audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    const engineEl = new Audio(engineSrc); engineEl.loop=true;
    const engSrc2  = audioCtx.createMediaElementSource(engineEl);
    const engGain  = audioCtx.createGain(); engGain.gain.value=0.55;
    engSrc2.connect(engGain); engGain.connect(audioCtx.destination);
    engineEl.play().catch(()=>{});
    const musicEl = new Audio(musicSrc); musicEl.loop=true; musicEl.volume=0.28;
    const startEl = new Audio(startSrc); startEl.volume=0.85;
    window.addEventListener('keydown', ()=>{ if(audioCtx.state==='suspended') audioCtx.resume(); }, {once:true});

    const onKeyDown=(e)=>{ keysRef.current[e.key]=true; e.preventDefault(); };
    const onKeyUp  =(e)=>{ keysRef.current[e.key]=false; };
    window.addEventListener('keydown',onKeyDown);
    window.addEventListener('keyup',onKeyUp);
    const onResize=()=>{ camera.aspect=mount.clientWidth/mount.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(mount.clientWidth,mount.clientHeight); };
    window.addEventListener('resize',onResize);

    // Cámara inicial — detrás del coche (igual en ambos circuitos)
    camera.position.set(
      car.position.x + Math.sin(car.rotation.y)*12,
      car.position.y + 5.5,
      car.position.z + Math.cos(car.rotation.y)*12
    );
    const camTarget = new THREE.Vector3().copy(car.position);

    let animId;
    const animate=()=>{
      animId=requestAnimationFrame(animate);
      const k=keysRef.current;
      const now=Date.now();

      // Cuenta atrás
      if (phaseLocal==='countdown') {
        const elapsed=(now-countdownStart)/1000;
        if (elapsed<1) { setCountdown(3); if(!startPlayed){startPlayed=true; startEl.play().catch(()=>{});} }
        else if (elapsed<2) setCountdown(2);
        else if (elapsed<3) setCountdown(1);
        else if (elapsed<4) { setCountdown(0); if(!goPlayed){goPlayed=true; musicEl.play().catch(()=>{});} }
        else { phaseLocal='racing'; lapStart=now; setPhase('racing'); setPlayerLap(1); }
        speed=0; aiSpeed=0;
      }

      const questionActive=questionActiveRef.current;

      // Jugador
      if (phaseLocal!=='countdown' && !questionActive) {
        const joy=joystickRef.current;
        const gasKey   = k['ArrowUp']  ||k['w']||k['W'];
        const brakeKey = k['ArrowDown']||k['s']||k['S'];
        const leftKey  = k['ArrowLeft']||k['a']||k['A'];
        const rightKey = k['ArrowRight']||k['d']||k['D'];
        const joyGas   = joy.active && joy.y < -0.15;
        const joyBrake = joy.active && joy.y >  0.15;

        if (gasKey || joyGas) {
          const power = joyGas ? Math.min(-joy.y, 1) : 1;
          speed = Math.min(speed + ACCEL*power, MAX_SPEED);
        } else if (brakeKey || joyBrake) {
          if (speed > 0.005) speed *= BRAKE_F;
          else speed = Math.max(speed - ACCEL*0.6, -MAX_SPEED*0.40);
        } else {
          speed *= FRICTION;
        }
        if (Math.abs(speed)<0.0005) speed=0;

        if (speed!==0) {
          const dir=speed>0?1:-1;
          const joyL = joy.active && joy.x < -0.12;
          const joyR = joy.active && joy.x >  0.12;
          const steerMag = joy.active ? Math.min(Math.abs(joy.x),1) : 1;
          if (leftKey  || joyL) car.rotation.y += TURN*dir*(joyL ? steerMag : 1);
          if (rightKey || joyR) car.rotation.y -= TURN*dir*(joyR ? steerMag : 1);
        }

        const dx=-Math.sin(car.rotation.y)*speed, dz=-Math.cos(car.rotation.y)*speed;
        const nx=car.position.x+dx, nz=car.position.z+dz;
        if      (isCarOnRoad(nx,nz))             { car.position.x=nx; car.position.z=nz; }
        else if (isCarOnRoad(nx,car.position.z)) { car.position.x=nx; speed*=SLIDE_FACTOR; }
        else if (isCarOnRoad(car.position.x,nz)) { car.position.z=nz; speed*=SLIDE_FACTOR; }
        else                                     { speed=0; }

        if (speed!==0) car.children.slice(3).forEach(w=>{ w.rotation.x+=speed*3; });
        const targetRate=0.5+(Math.abs(speed)/MAX_SPEED)*1.7;
        engineEl.playbackRate+=(targetRate-engineEl.playbackRate)*0.07;

        const [pwX,pwZ]=cfg.waypoints[playerWpIdx];
        if (Math.hypot(car.position.x-pwX,car.position.z-pwZ)<TW*0.9)
          playerWpIdx=(playerWpIdx+1)%cfg.waypoints.length;

        // Checkpoints
        if (phaseLocal==='racing') {
          cfg.cpPos.forEach(([cpx,cpz],i)=>{
            const key=`${playerLapLocal}-${i}`;
            if (answeredCpsRef.current.has(key)) return;
            if (Math.hypot(car.position.x-cpx,car.position.z-cpz)<CP_RADIUS) {
              answeredCpsRef.current.add(key);
              const q=pickQuestion();
              if (q) {
                speed=0;
                questionActiveRef.current=true;
                pauseStartRef.current=now;
                setActiveQuestion({...q, cpIdx:i});
                if (cpMeshRef.current[i]) cpMeshRef.current[i].color.set(0xffff00);
              }
            }
          });
        }
      }

      // IA
      if (phaseLocal!=='countdown' && !questionActive) {
        const nextWpIdx=(aiWpIdx+1)%cfg.waypoints.length;
        const [wpX,wpZ]=cfg.waypoints[aiWpIdx];
        const [nwpX,nwpZ]=cfg.waypoints[nextWpIdx];
        const dxAi=wpX-ai.position.x, dzAi=wpZ-ai.position.z;
        const distToWp=Math.hypot(dxAi,dzAi);
        if (distToWp<TW*0.9) aiWpIdx=nextWpIdx;
        // look-ahead: blend toward next waypoint as AI approaches current one
        const blend=Math.max(0,1-distToWp/(TW*2.5));
        const tgX=wpX+(nwpX-wpX)*blend, tgZ=wpZ+(nwpZ-wpZ)*blend;

        if (aiReverseFrames>0) {
          // stuck recovery: reverse briefly
          aiReverseFrames--;
          aiSpeed=-0.07;
          ai.rotation.y+=0.04;
        } else {
          // proportional steering: smooth at small angles, capped for big turns
          const targetAngle=Math.atan2(-(tgX-ai.position.x),-(tgZ-ai.position.z));
          let angleDiff=targetAngle-ai.rotation.y;
          while(angleDiff>Math.PI)  angleDiff-=2*Math.PI;
          while(angleDiff<-Math.PI) angleDiff+=2*Math.PI;
          ai.rotation.y+=Math.sign(angleDiff)*Math.min(Math.abs(angleDiff)*0.55,AI_TURN);

          const curveFactor=1-Math.min(Math.abs(angleDiff)/Math.PI,1)*0.80;

          // player avoidance: if player is close and ahead, steer away and slow down
          const pDx=car.position.x-ai.position.x, pDz=car.position.z-ai.position.z;
          const pDist=Math.hypot(pDx,pDz);
          let avoidFactor=1;
          if (pDist<3.5) {
            const forwardDot=-Math.sin(ai.rotation.y)*pDx-Math.cos(ai.rotation.y)*pDz;
            if (forwardDot>0) {
              const sideDot=Math.cos(ai.rotation.y)*pDx-Math.sin(ai.rotation.y)*pDz;
              ai.rotation.y+=sideDot>0?-0.03:0.03;
              avoidFactor=0.65;
            }
          }
          aiSpeed=Math.min(aiSpeed+AI_ACCEL,AI_MAX*curveFactor*avoidFactor);
          if(aiSpeed<0.002) aiSpeed=0;
        }

        const aiDx=-Math.sin(ai.rotation.y)*aiSpeed, aiDz=-Math.cos(ai.rotation.y)*aiSpeed;
        const aiNx=ai.position.x+aiDx, aiNz=ai.position.z+aiDz;
        if (isCarOnRoad(aiNx,aiNz)) {
          ai.position.x=aiNx; ai.position.z=aiNz;
        } else {
          // Sweep steering angles (±PI/8 steps) to find one that is on-road
          // AND moves closer to the look-ahead target — like a player would steer.
          const tgtDistNow=Math.hypot(tgX-ai.position.x, tgZ-ai.position.z);
          const sweepSpd=Math.max(Math.abs(aiSpeed), 0.08);
          let moved=false;
          for (let s=1; s<=8 && !moved; s++) {
            for (const sign of [-1,1]) {
              const ta=ai.rotation.y + sign*s*(Math.PI/8);
              const tx=ai.position.x - Math.sin(ta)*sweepSpd;
              const tz=ai.position.z - Math.cos(ta)*sweepSpd;
              if (isCarOnRoad(tx,tz) && Math.hypot(tgX-tx,tgZ-tz)<tgtDistNow) {
                ai.rotation.y=ta;
                ai.position.x=tx; ai.position.z=tz;
                aiSpeed=Math.max(aiSpeed*0.75, 0.05);
                moved=true; break;
              }
            }
          }
          if (!moved) aiSpeed*=0.25;
        }

        // stuck detection → trigger reverse recovery (inspired by AICarAvoidanceBehaviour)
        if (aiReverseFrames===0) {
          if (Math.abs(aiSpeed)<0.015) { if(++aiStuckFrames>=AI_STUCK_LIMIT){ aiStuckFrames=0; aiReverseFrames=25; aiSpeed=0; } }
          else aiStuckFrames=0;
        }
        if(aiSpeed!==0) ai.children.slice(3).forEach(w=>{ w.rotation.x+=aiSpeed*3; });
      }

      // Colisión entre coches
      {
        const d=Math.hypot(car.position.x-ai.position.x,car.position.z-ai.position.z);
        if(d<1.6&&d>0.01){
          const ov=(1.6-d)/2;
          const nx2=(car.position.x-ai.position.x)/d, nz2=(car.position.z-ai.position.z)/d;
          car.position.x+=nx2*ov; car.position.z+=nz2*ov;
          ai.position.x -=nx2*ov; ai.position.z -=nz2*ov;
          speed*=0.40; aiSpeed*=0.40;
        }
      }

      // Vueltas
      if (phaseLocal==='racing' && !questionActive) {
        const cz=car.position.z;
        if (prevCarX<FINISH_X&&car.position.x>=FINISH_X&&cz>=FINISH_ZMIN&&cz<=FINISH_ZMAX) {
          playerLapLocal++;
          const lt=now-lapStart-totalPausedRef.current+penaltyRef.current;
          lapTimesLocal=[...lapTimesLocal,lt];
          setLapTimes([...lapTimesLocal]);
          lapStart=now; totalPausedRef.current=0; setCurrentMs(0);
          cpMeshRef.current.forEach(m=>{ if(m) m.color.set(0xFF6B00); });
          if (playerLapLocal>=MAX_LAPS) {
            phaseLocal='finished';
            const totalMs=lapTimesLocal.reduce((a,b)=>a+b,0);
            onTerminar({
              posicion: aiLapLocal>=MAX_LAPS?2:1,
              tiempo: totalMs,
              tiempoFormateado: fmt(totalMs),
              acertadas: aciertasRef.current,
              falladas:  falladasRef.current,
              penaltySecs: Math.floor(penaltyRef.current/1000),
            });
          } else {
            setPlayerLap(playerLapLocal+1);
          }
        }
        prevCarX=car.position.x;
        if (prevAiX<FINISH_X&&ai.position.x>=FINISH_X&&ai.position.z>=FINISH_ZMIN&&ai.position.z<=FINISH_ZMAX)
          aiLapLocal++;
        prevAiX=ai.position.x;
        const pp=playerLapLocal*cfg.waypoints.length+playerWpIdx;
        const ap=aiLapLocal*cfg.waypoints.length+aiWpIdx;
        setPlayerPos(pp>=ap?1:2);
        if (now-lastTimerUpdate>100) { setCurrentMs(now-lapStart-totalPausedRef.current+penaltyRef.current); lastTimerUpdate=now; }
      }

      // Cámara — sigue al jugador en ambos circuitos
      {
        const bX=Math.sin(car.rotation.y)*11, bZ=Math.cos(car.rotation.y)*11;
        camera.position.x+=(car.position.x+bX-camera.position.x)*0.08;
        camera.position.y+=(car.position.y+5.2-camera.position.y)*0.08;
        camera.position.z+=(car.position.z+bZ-camera.position.z)*0.08;
        camTarget.x+=(car.position.x-Math.sin(car.rotation.y)*2.5-camTarget.x)*0.10;
        camTarget.y+=(car.position.y+0.8-camTarget.y)*0.10;
        camTarget.z+=(car.position.z-Math.cos(car.rotation.y)*2.5-camTarget.z)*0.10;
        camera.lookAt(camTarget);
      }
      renderer.render(scene,camera);
    };
    animate();

    return ()=>{
      cancelAnimationFrame(animId);
      engineEl.pause(); musicEl.pause(); startEl.pause(); audioCtx.close();
      window.removeEventListener('keydown',onKeyDown);
      window.removeEventListener('keyup',onKeyUp);
      window.removeEventListener('resize',onResize);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []); // eslint-disable-line

  // ── HUD styles ───────────────────────────────────────────────────────────
  const hud = {
    background:'rgba(0,0,0,0.55)', color:'#fff', fontFamily:'Arial,sans-serif',
    borderRadius:10, border:'1px solid rgba(255,255,255,0.2)', backdropFilter:'blur(4px)',
  };
  const hudBtn = {
    ...hud, border:'1px solid rgba(255,255,255,0.25)',
    padding:'7px 13px', borderRadius:8, cursor:'pointer', fontSize:12,
  };

  return (
    <div style={{width:'100vw',height:'100vh',position:'relative',background:'#87ceeb',overflow:'hidden'}}>
      <style>{CSS_KARTING}</style>
      {/* Three.js canvas */}
      <div ref={mountRef} style={{width:'100%',height:'100%'}} />

      {/* Modal de pregunta */}
      {activeQuestion && (
        <ModalPregunta
          datos={activeQuestion}
          onRespuesta={(ok)=>{
            if (cpMeshRef.current[activeQuestion.cpIdx])
              cpMeshRef.current[activeQuestion.cpIdx].color.set(ok?0x27ae60:0xe74c3c);
            handleAnswer(ok);
          }}
        />
      )}

      {/* Semáforo */}
      {phase==='countdown' && (
        <div style={{position:'absolute',top:'38%',left:'50%',transform:'translate(-50%,-50%)',
          display:'flex',flexDirection:'column',alignItems:'center',gap:12,...hud,padding:'22px 36px'}}>
          <div style={{display:'flex',gap:14}}>
            {[3,2,1].map(n=>(
              <div key={n} style={{width:44,height:44,borderRadius:'50%',
                background:countdown>=n?'#e74c3c':'#333',
                boxShadow:countdown>=n?'0 0 22px 6px rgba(231,76,60,0.7)':'none',
                border:'3px solid #555',transition:'background 0.2s'}}/>
            ))}
          </div>
          {countdown===0&&(
            <div style={{fontSize:42,fontWeight:'bold',color:'#2ecc71',textShadow:'0 0 20px rgba(46,204,113,0.9)',letterSpacing:4}}>¡GO!</div>
          )}
        </div>
      )}

      {/* HUD carrera */}
      {phase!=='countdown' && (
        <>
          {/* Vuelta + tiempo — izquierda */}
          <div style={{position:'absolute',top:12,left:12,...hud,padding:'8px 14px',minWidth:130}}>
            <div style={{fontSize:11,opacity:0.7,marginBottom:3}}>VUELTA {playerLap} / {MAX_LAPS}</div>
            <div style={{fontSize:18,fontWeight:'bold',fontVariantNumeric:'tabular-nums'}}>{fmt(currentMs)}</div>
            {lapTimes.length>0 && (
              <div style={{marginTop:4,fontSize:11,opacity:0.85}}>
                {lapTimes.map((t,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',gap:10}}>
                    <span style={{opacity:0.6}}>V{i+1}</span>
                    <span style={{fontVariantNumeric:'tabular-nums'}}>{fmt(t)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Posición — centro */}
          <div style={{position:'absolute',top:12,left:'50%',transform:'translateX(-50%)',...hud,padding:'6px 18px',textAlign:'center'}}>
            <div style={{fontSize:11,opacity:0.7,letterSpacing:2}}>POSICIÓN</div>
            <div style={{fontSize:28,fontWeight:'bold',lineHeight:1,color:playerPos===1?'#f1c40f':'#ecf0f1'}}>{playerPos===1?'1°':'2°'}</div>
          </div>

          {/* Aciertos / Fallos — arriba derecha */}
          <div style={{position:'absolute',top:12,right:12,...hud,padding:'8px 14px',textAlign:'center',minWidth:90}}>
            <div style={{fontSize:11,opacity:0.7,marginBottom:4}}>RESPUESTAS</div>
            <div style={{display:'flex',gap:10,justifyContent:'center',alignItems:'center'}}>
              <span style={{color:'#2ecc71',fontWeight:800,fontSize:15}}>✅ {aciertos}</span>
              <span style={{color:'#e74c3c',fontWeight:800,fontSize:15}}>❌ {falladas}</span>
            </div>
          </div>
        </>
      )}

      {/* Toasts flotantes */}
      {toasts.map(t => <FloatingToast key={t.id} type={t.type} seconds={t.seconds} />)}

      {/* Joystick — abajo derecha */}
      {!activeQuestion && phase!=='countdown' && (
        <Joystick joyRef={joystickRef} />
      )}

      {/* Botones — abajo izquierda */}
      <div style={{position:'absolute',bottom:14,left:14,display:'flex',gap:8,zIndex:50}}>
        <button onClick={onSalir} style={hudBtn}>← Volver</button>
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          style={{...hudBtn, fontSize:16, padding:'7px 11px'}}>
          {isFullscreen ? '⤡' : '⤢'}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// WRAPPER PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════
export default function KartingTrack({ alTerminar } = {}) {
  const [fase,         setFase]        = useState('PREVIO');
  const [recurso,      setRecurso]     = useState(null);
  const [hojas,        setHojas]       = useState(['General']);
  const [circuito,     setCircuito]    = useState(1);
  const [resultado,    setResultado]   = useState(null);
  const [customPaths,  setCustomPaths]  = useState(null);
  const [customObjects,setCustomObjects]= useState([]);
  const [testConfig,   setTestConfig]   = useState(null); // {recurso, hojas, numVueltas}
  const [testResultado,setTestResultado]= useState(null);
  const [loadedCircuit,setLoadedCircuit]= useState(null); // {paths, objects} from warehouse
  const [editorSource, setEditorSource] = useState('PREVIO'); // where "Volver" goes from editor

  const salir = () => { if (alTerminar) alTerminar(); else window.history.back(); };

  if (fase==='EDITOR')
    return <TrackEditor
      onVolver={() => { setLoadedCircuit(null); setFase(editorSource); }}
      onProbar={(p, objs) => { setCustomPaths(p); setCustomObjects(objs); setFase('TESTING_SETUP'); }}
      initialPaths={loadedCircuit?.paths  || []}
      initialObjects={loadedCircuit?.objects || []}
    />;

  if (fase==='ALMACEN')
    return <AlmacenCircuitos
      onJugar={(paths,objects)=>{ setCustomPaths(paths); setCustomObjects(objects); setFase('TESTING_SETUP'); }}
      onEditar={(paths,objects)=>{ setLoadedCircuit({paths,objects}); setEditorSource('ALMACEN'); setFase('EDITOR'); }}
      onVolver={()=>setFase('PREVIO')}
    />;

  if (fase==='TESTING_SETUP')
    return <TrackTestSetup
      onIniciar={(r,h,n) => { setTestConfig({recurso:r,hojas:h,numVueltas:n}); setFase('TESTING'); }}
      onVolver={() => setFase('EDITOR')}
    />;

  if (fase==='TESTING' && customPaths)
    return <TrackTest
      paths={customPaths}
      objects={customObjects}
      recurso={testConfig?.recurso ?? null}
      hojas={testConfig?.hojas ?? []}
      numVueltas={testConfig?.numVueltas ?? 2}
      onVolver={() => setFase('TESTING_SETUP')}
      onTerminar={(res) => { setTestResultado(res); setFase('TESTING_RESULT'); }}
    />;

  if (fase==='TESTING_RESULT' && testResultado)
    return <PantallaResultados
      resultado={testResultado}
      recurso={testConfig?.recurso ?? null}
      hojas={testConfig?.hojas ?? []}
      onReintentar={() => { setTestResultado(null); setFase('TESTING'); }}
      onSalir={() => setFase('EDITOR')}
    />;

  if (fase==='PREVIO')
    return <PantallaPrevia
      onIniciar={(r,h,c)=>{ setRecurso(r); setHojas(h); setCircuito(c); setFase('JUGANDO'); }}
      onConstruir={() => { setLoadedCircuit(null); setEditorSource('PREVIO'); setFase('EDITOR'); }}
      onAlmacen={() => setFase('ALMACEN')}
    />;

  if (fase==='RESULTADO' && resultado)
    return <PantallaResultados resultado={resultado} recurso={recurso} hojas={hojas}
      onReintentar={()=>{ setResultado(null); setFase('PREVIO'); }}
      onSalir={salir} />;

  return (
    <KartingGame
      recurso={recurso}
      hojas={hojas}
      circuito={circuito}
      onTerminar={(res)=>{ setResultado(res); setFase('RESULTADO'); }}
      onSalir={salir}
    />
  );
}
