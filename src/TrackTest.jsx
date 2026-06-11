import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import tribuneImg from './kenney_racing-pack/PNG/Objects/tribune_full.png';
import arrowImg   from './kenney_racing-pack/PNG/Objects/arrow_yellow.png';
import tentImg    from './kenney_racing-pack/PNG/Objects/tent_red_large.png';
import sndOk    from './assets/sonidorespcorrecta.mp3';
import sndFail  from './assets/sonidomonedamal.mp3';
import engineSrc from './assets/Audio/carengine.mp3';
import musicSrc  from './assets/Audio/sonidofondo.mp3';
import startSrc  from './assets/inicio-juego.mp3';

// ── Scale & constants ─────────────────────────────────────────────────────────
const SCALE        = 0.15;
const KERB_HALF    = (74/2)*SCALE;
const ROAD_HALF    = (46/2)*SCALE;  // eslint-disable-line no-unused-vars
const COLL_HALF    = 19*SCALE;
const CP_RADIUS    = COLL_HALF*2.2;
const NUM_CPS      = 4;
const JOY_R        = 62;
const MAX_SPEED    = 0.30;
const ACCEL        = 0.007;
const FRICTION     = 0.965;
const BRAKE_F      = 0.90;
const TURN         = 0.022;
const SLIDE_FACTOR = 0.88;

const fmt = (ms) => {
  const m=Math.floor(ms/60000), s=Math.floor((ms%60000)/1000), cs=Math.floor((ms%1000)/10);
  return `${m}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
};
const shuffle = (arr) => {
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
};
const buildOpciones = (q) => {
  if(q.opcionesFijas?.length) return shuffle(q.opcionesFijas);
  return shuffle([q.correcta??q.respuesta??q.a??'',...(q.incorrectas||[])]);
};

// ── Car ───────────────────────────────────────────────────────────────────────
function buildCar(scene) {
  const g=new THREE.Group();
  const mat  =new THREE.MeshLambertMaterial({color:0xe74c3c});
  const dark =new THREE.MeshLambertMaterial({color:0xc0392b});
  const wheel=new THREE.MeshLambertMaterial({color:0x1a1a1a});
  const glass=new THREE.MeshLambertMaterial({color:0x85c1e9,transparent:true,opacity:0.75});
  const body =new THREE.Mesh(new THREE.BoxGeometry(1.3,0.32,2.4),mat);
  body.position.y=0.16; body.castShadow=true; g.add(body);
  const cabin=new THREE.Mesh(new THREE.BoxGeometry(1.05,0.3,1.4),dark);
  cabin.position.set(0,0.51,-0.12); cabin.castShadow=true; g.add(cabin);
  const ws=new THREE.Mesh(new THREE.BoxGeometry(0.95,0.26,0.05),glass);
  ws.position.set(0,0.56,0.58); ws.rotation.x=0.45; g.add(ws);
  const wGeo=new THREE.CylinderGeometry(0.24,0.24,0.15,12);
  [[0.74,0.18,0.82],[-0.74,0.18,0.82],[0.74,0.18,-0.82],[-0.74,0.18,-0.82]].forEach(([x,y,z])=>{
    const w=new THREE.Mesh(wGeo,wheel); w.position.set(x,y,z); w.rotation.z=Math.PI/2; w.castShadow=true; g.add(w);
  });
  scene.add(g);
  return g;
}

// ── Road ribbon ───────────────────────────────────────────────────────────────
function computeNormals(pts3d) {
  const n=pts3d.length;
  // Detect closed path: last point ≈ first point
  const isClosed=n>3&&Math.hypot(pts3d[0].x-pts3d[n-1].x,pts3d[0].z-pts3d[n-1].z)<COLL_HALF;
  return pts3d.map((_,i)=>{
    let dx,dz;
    if(isClosed&&(i===0||i===n-1)){
      // Both junction vertices share the same wrap-around tangent
      // so ribbon normals match and the seam closes without a wedge gap
      dx=pts3d[1].x-pts3d[n-2].x; dz=pts3d[1].z-pts3d[n-2].z;
    } else if(i===0){
      dx=pts3d[1].x-pts3d[0].x;      dz=pts3d[1].z-pts3d[0].z;
    } else if(i===n-1){
      dx=pts3d[n-1].x-pts3d[n-2].x;  dz=pts3d[n-1].z-pts3d[n-2].z;
    } else {
      dx=pts3d[i+1].x-pts3d[i-1].x;  dz=pts3d[i+1].z-pts3d[i-1].z;
    }
    const l=Math.hypot(dx,dz)||1;
    return {x:-dz/l,z:dx/l};
  });
}

function buildRibbonMesh(pts3d,normals,halfW,material){
  const n=pts3d.length;
  const verts=new Float32Array(n*2*3),uvs=new Float32Array(n*2*2),idx=[];
  let cum=0;
  for(let i=0;i<n;i++){
    if(i>0) cum+=Math.hypot(pts3d[i].x-pts3d[i-1].x,pts3d[i].z-pts3d[i-1].z);
    const {x,z}=pts3d[i],{x:nx,z:nz}=normals[i],u=cum/(halfW*2);
    verts[i*6]=x+nx*halfW; verts[i*6+1]=0; verts[i*6+2]=z+nz*halfW;
    verts[i*6+3]=x-nx*halfW; verts[i*6+4]=0; verts[i*6+5]=z-nz*halfW;
    uvs[i*4]=u; uvs[i*4+1]=0; uvs[i*4+2]=u; uvs[i*4+3]=1;
  }
  for(let i=0;i<n-1;i++){const a=i*2,b=i*2+1,c=(i+1)*2,d=(i+1)*2+1;idx.push(a,c,b,b,c,d);}
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(verts,3));
  geo.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
  geo.setIndex(idx); geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,material); mesh.receiveShadow=true;
  return mesh;
}

function createKerbTex(){
  const c=document.createElement('canvas'); c.width=32; c.height=32;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#CC0000'; ctx.fillRect(0,0,32,32);
  ctx.fillStyle='#FFFFFF'; ctx.fillRect(0,0,16,16); ctx.fillRect(16,16,16,16);
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.SRGBColorSpace;
  return t;
}

function buildRoad(scene,pts3d,normals){
  const k=buildRibbonMesh(pts3d,normals,KERB_HALF,new THREE.MeshLambertMaterial({map:createKerbTex(),side:THREE.DoubleSide}));
  const a=buildRibbonMesh(pts3d,normals,(46/2)*SCALE,new THREE.MeshLambertMaterial({color:0x1c1c1c,side:THREE.DoubleSide}));
  const l=buildRibbonMesh(pts3d,normals,0.12,new THREE.MeshLambertMaterial({color:0xffffff,transparent:true,opacity:0.22,side:THREE.DoubleSide}));
  k.position.y=0.005; a.position.y=0.010; l.position.y=0.015;
  scene.add(k,a,l);
}

function buildIsOnRoad(pts3d){
  return(px,pz)=>{
    for(let i=0;i<pts3d.length-1;i++){
      const{x:ax,z:az}=pts3d[i],{x:bx,z:bz}=pts3d[i+1];
      const abx=bx-ax,abz=bz-az,len2=abx*abx+abz*abz;
      if(len2<0.0001) continue;
      const t=Math.max(0,Math.min(1,((px-ax)*abx+(pz-az)*abz)/len2));
      if(Math.hypot(px-ax-t*abx,pz-az-t*abz)<=COLL_HALF) return true;
    }
    return false;
  };
}

// ── Joystick ──────────────────────────────────────────────────────────────────
function Joystick({joyRef}){
  const baseRef=useRef(null);
  const[knob,setKnob]=useState({x:0,y:0});
  const drag=useRef(false);
  const fc=(cx,cy)=>{
    if(!baseRef.current) return;
    const r=baseRef.current.getBoundingClientRect();
    const dx=cx-(r.left+r.width/2),dy=cy-(r.top+r.height/2);
    const cl=Math.min(Math.hypot(dx,dy),JOY_R),ang=Math.atan2(dy,dx);
    const x=Math.cos(ang)*cl,y=Math.sin(ang)*cl;
    setKnob({x,y}); joyRef.current={x:x/JOY_R,y:y/JOY_R,active:true};
  };
  const rel=()=>{drag.current=false;setKnob({x:0,y:0});joyRef.current={x:0,y:0,active:false};};
  return(
    <div ref={baseRef}
      onTouchStart={e=>{e.preventDefault();drag.current=true;fc(e.targetTouches[0].clientX,e.targetTouches[0].clientY);}}
      onTouchMove={e=>{e.preventDefault();if(drag.current)fc(e.targetTouches[0].clientX,e.targetTouches[0].clientY);}}
      onTouchEnd={e=>{e.preventDefault();rel();}}
      onMouseDown={e=>{drag.current=true;fc(e.clientX,e.clientY);
        const mv=me=>{if(drag.current)fc(me.clientX,me.clientY);};
        const up=()=>{rel();document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);};
        document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);}}
      style={{position:'absolute',bottom:32,right:32,width:JOY_R*2,height:JOY_R*2,borderRadius:'50%',
        background:'rgba(255,255,255,0.10)',border:'2px solid rgba(255,255,255,0.28)',
        backdropFilter:'blur(6px)',touchAction:'none',userSelect:'none',cursor:'grab',
        display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}}>
      <div style={{position:'absolute',width:'100%',height:1,background:'rgba(255,255,255,0.12)'}}/>
      <div style={{position:'absolute',width:1,height:'100%',background:'rgba(255,255,255,0.12)'}}/>
      <div style={{width:46,height:46,borderRadius:'50%',background:'rgba(255,255,255,0.50)',
        border:'2px solid rgba(255,255,255,0.85)',boxShadow:'0 2px 14px rgba(0,0,0,0.35)',
        transform:`translate(${knob.x}px,${knob.y}px)`,
        transition:knob.x===0&&knob.y===0?'transform 0.13s ease-out':'none',pointerEvents:'none'}}/>
    </div>
  );
}

// ── Question modal ────────────────────────────────────────────────────────────
function ModalPregunta({datos,cpTotal,onRespuesta}){
  const[elegida,setElegida]=useState(null);
  const{opciones,correcta,cpIdx,texto}=datos;
  const resp=(op)=>{
    if(elegida!==null) return;
    setElegida(op);
    const ok=op===correcta;
    try{const s=new Audio(ok?sndOk:sndFail);s.volume=0.85;s.play().catch(()=>{});}catch(e){}
    setTimeout(()=>onRespuesta(ok),1200);
  };
  const col=(op)=>{
    if(elegida===null) return'rgba(255,255,255,0.1)';
    if(op===correcta)  return'#27ae60';
    if(op===elegida)   return'#c0392b';
    return'rgba(255,255,255,0.05)';
  };
  return(
    <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.80)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:12}}>
      <div style={{background:'linear-gradient(160deg,#1a1a2e,#0f3460)',
        border:'2px solid rgba(255,107,0,0.5)',borderRadius:18,padding:'20px 24px',
        maxWidth:480,width:'100%',maxHeight:'88vh',overflowY:'auto',
        color:'white',fontFamily:"'Segoe UI',sans-serif",boxShadow:'0 0 60px rgba(255,107,0,0.3)'}}>
        <div style={{fontSize:'0.78rem',color:'#FF6B00',fontWeight:700,letterSpacing:2,marginBottom:10}}>
          ⛺ CHECKPOINT {cpIdx+1} / {cpTotal}
        </div>
        <div style={{fontSize:'1.08rem',fontWeight:600,lineHeight:1.5,marginBottom:16}}>{texto}</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9}}>
          {opciones.map((op,i)=>(
            <button key={i} onClick={()=>resp(op)} style={{padding:'11px 10px',borderRadius:11,
              border:'1px solid rgba(255,255,255,0.15)',background:col(op),color:'white',
              fontSize:'0.88rem',cursor:elegida===null?'pointer':'default',
              fontWeight:op===correcta&&elegida!==null?700:400,
              transition:'background 0.2s',textAlign:'left'}}>
              {['A','B','C','D'][i]}. {op}
            </button>
          ))}
        </div>
        {elegida!==null&&(
          <div style={{marginTop:14,textAlign:'center',fontSize:'1.25rem',fontWeight:900,
            color:elegida===correcta?'#2ecc71':'#e74c3c'}}>
            {elegida===correcta?'✅ ¡Correcto!':`❌ Correcta: ${correcta}`}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function TrackTest({
  paths, objects=[], recurso, hojas=[], numVueltas=2, onVolver, onTerminar,
  // Online mode props
  skipCountdown=false, timerBase=null,
  onCheckpoint=null,   // ({cpIdx, lap, tMs, ok}) => void
  onLapComplete=null,  // (lapsCompleted) => void
}) {
  const mountRef          = useRef(null);
  const keysRef           = useRef({});
  const joyRef            = useRef({x:0,y:0,active:false});
  const qActRef           = useRef(false);
  const aciertasRef       = useRef(0);
  const falladasRef       = useRef(0);
  const onTerminarRef     = useRef(onTerminar);
  const onCheckpointRef   = useRef(onCheckpoint);
  const onLapCompleteRef  = useRef(onLapComplete);
  const pendingCpRef      = useRef(null); // {cpIdx, lap, tMs} — filled by anim loop, ok added in handleAnswer
  useEffect(()=>{ onTerminarRef.current=onTerminar; },[onTerminar]);
  useEffect(()=>{ onCheckpointRef.current=onCheckpoint; },[onCheckpoint]);
  useEffect(()=>{ onLapCompleteRef.current=onLapComplete; },[onLapComplete]);

  const [phase,      setPhase]      = useState('countdown');
  const [countdown,  setCountdown]  = useState(3);
  const [currentMs,  setCurrentMs]  = useState(0);
  const [currentLap, setCurrentLap] = useState(1);
  const [aciertos,   setAciertos]   = useState(0);
  const [falladas,   setFalladas]   = useState(0);
  const [activeQ,    setActiveQ]    = useState(null);
  const [cpCount,    setCpCount]    = useState(NUM_CPS);
  const [resultado,  setResultado]  = useState(null);
  const [zoneToast,  setZoneToast]  = useState(null); // {idx} when tent crossed with no recurso

  // call onTerminar after result is set (stable path out of animation loop)
  useEffect(()=>{
    if(resultado) onTerminarRef.current?.(resultado);
  },[resultado]);

  // Question pool
  const buildPool = ()=>{
    if(!recurso) return[];
    const all=recurso.hojas||[];
    let pool=[];
    if(all.length>0){
      // Filter to selected hojas; fall back to ALL hojas if filter returns nothing
      const sel=all.filter(h=>!hojas.length||hojas.includes(h.nombreHoja||'General'));
      (sel.length ? sel : all).forEach(h=>pool.push(...(h.preguntas||[])));
    }
    if(!pool.length) pool.push(...(recurso.preguntas||[]));
    return shuffle(pool);
  };

  const handleAnswer=(ok)=>{
    if(ok){aciertasRef.current++;setAciertos(v=>v+1);}
    else  {falladasRef.current++;setFalladas(v=>v+1);}
    if(pendingCpRef.current){
      onCheckpointRef.current?.({...pendingCpRef.current, ok});
      pendingCpRef.current=null;
    }
    qActRef.current=false;
    setActiveQ(null);
  };

  useEffect(()=>{
    const mount=mountRef.current;
    if(!mount) return;

    // Merge all drawn segments into one continuous path
    // (circuit can be multi-segment when drawn after panning)
    const mergePaths=(segs)=>{
      if(!segs?.length) return [];
      const out=[...segs[0]];
      for(let i=1;i<segs.length;i++){
        const seg=segs[i]; if(!seg.length) continue;
        const last=out[out.length-1];
        const skip=Math.hypot(seg[0].x-last.x,seg[0].y-last.y)<3?1:0;
        out.push(...seg.slice(skip));
      }
      return out;
    };

    const rawPath=mergePaths(paths);
    if(rawPath.length<2) return;

    const pts3d  = rawPath.map(p=>({x:p.x*SCALE,z:p.y*SCALE}));
    const normals = computeNormals(pts3d);
    const isOnRoad = buildIsOnRoad(pts3d);

    let totalLen=0;
    for(let i=1;i<pts3d.length;i++)
      totalLen+=Math.hypot(pts3d[i].x-pts3d[i-1].x,pts3d[i].z-pts3d[i-1].z);
    const FINISH_R = Math.max(COLL_HALF,totalLen*0.05);
    const MIN_AWAY = totalLen*0.2;

    // Three.js
    const renderer=new THREE.WebGLRenderer({antialias:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.setSize(mount.clientWidth,mount.clientHeight);
    renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFShadowMap;
    mount.appendChild(renderer.domElement);

    const scene=new THREE.Scene();
    scene.background=new THREE.Color(0x87ceeb);
    scene.fog=new THREE.FogExp2(0x87ceeb,0.016);
    const camera=new THREE.PerspectiveCamera(70,mount.clientWidth/mount.clientHeight,0.1,300);

    scene.add(new THREE.AmbientLight(0xffffff,0.55));
    const sun=new THREE.DirectionalLight(0xfff5e0,1.0);
    sun.position.set(30,50,20); sun.castShadow=true;
    sun.shadow.camera.left=sun.shadow.camera.bottom=-120;
    sun.shadow.camera.right=sun.shadow.camera.top=120;
    sun.shadow.camera.far=300; scene.add(sun);

    let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
    pts3d.forEach(p=>{minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);});
    const gw=Math.max(maxX-minX,maxZ-minZ)+50;
    const gnd=new THREE.Mesh(new THREE.PlaneGeometry(gw,gw),new THREE.MeshLambertMaterial({color:0x3a6428}));
    gnd.rotation.x=-Math.PI/2; gnd.position.set((minX+maxX)/2,-0.01,(minZ+maxZ)/2);
    gnd.receiveShadow=true; scene.add(gnd);

    buildRoad(scene,pts3d,normals);

    // Ground-flat objects from user-placed objects
    const loader=new THREE.TextureLoader();
    const texCache={};
    const getTex=(src)=>{
      if(!texCache[src]){const t=loader.load(src);t.colorSpace=THREE.SRGBColorSpace;texCache[src]=t;}
      return texCache[src];
    };

    // Builds a flat-on-ground plane at world (x,z), worldSz = base size in 3-D units,
    // objScale and objRotation come from the editor object data
    const flatObj=(src,x,z,worldSz,objRotation,objScale)=>{
      const group=new THREE.Group();
      group.position.set(x,0.08,z);
      group.rotation.y=objRotation||0;
      const sz=worldSz*(objScale||1);
      const mesh=new THREE.Mesh(
        new THREE.PlaneGeometry(sz,sz),
        new THREE.MeshLambertMaterial({map:getTex(src),transparent:true,alphaTest:0.05,side:THREE.DoubleSide})
      );
      mesh.rotation.x=-Math.PI/2;
      group.add(mesh);
      scene.add(group);
    };

    // Convert canvas {x,y} → world {x,z}
    const toWorld=(obj)=>({x:obj.x*SCALE, z:obj.y*SCALE});

    // Tribune(s) — only user-placed, no fallback
    objects.filter(o=>o.type==='tribune').forEach(o=>{
      const w=toWorld(o);
      flatObj(tribuneImg, w.x, w.z, 16, o.rotation, o.scale);
    });

    // Arrows — only user-placed
    objects.filter(o=>o.type==='arrow').forEach(o=>{
      const w=toWorld(o);
      flatObj(arrowImg, w.x, w.z, 5, o.rotation, o.scale);
    });

    // Tent checkpoints (from user placement)
    const tentObjs=objects.filter(o=>o.type==='tent');
    const cpWorldPos=tentObjs.map(o=>toWorld(o)); // [{x,z}]
    setCpCount(cpWorldPos.length);
    cpWorldPos.forEach((cp,i)=>{
      flatObj(tentImg, cp.x, cp.z, 8, tentObjs[i].rotation, tentObjs[i].scale);
      // Floating number badge sprite above the tent
      const nc=document.createElement('canvas'); nc.width=64; nc.height=64;
      const nx2=nc.getContext('2d');
      nx2.fillStyle='rgba(255,107,0,0.92)'; nx2.beginPath(); nx2.arc(32,32,28,0,Math.PI*2); nx2.fill();
      nx2.fillStyle='white'; nx2.font='bold 32px Arial'; nx2.textAlign='center'; nx2.textBaseline='middle';
      nx2.fillText(i+1,32,32);
      const ns=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(nc),transparent:true}));
      ns.position.set(cp.x,3.5,cp.z); ns.scale.set(2.5,2.5,1); scene.add(ns);
    });

    // Car
    const car=buildCar(scene);
    car.scale.set(0.70,0.70,0.70);
    const dx0=pts3d[1].x-pts3d[0].x,dz0=pts3d[1].z-pts3d[0].z,l0=Math.hypot(dx0,dz0)||1;
    car.position.set(pts3d[0].x,0,pts3d[0].z);
    car.rotation.y=Math.atan2(-dx0/l0,-dz0/l0);
    camera.position.set(car.position.x+Math.sin(car.rotation.y)*12,car.position.y+5.5,car.position.z+Math.cos(car.rotation.y)*12);
    const camTgt=new THREE.Vector3().copy(car.position);

    // Question pool
    const qPool=buildPool();
    let qIdx=0;
    const pickQ=()=>{
      if(!qPool.length) return null;
      const q=qPool[qIdx%qPool.length]; qIdx++;
      return{...q,opciones:buildOpciones(q),texto:q.pregunta||q.texto||String(q.a||''),correcta:q.correcta??q.respuesta??q.a??''};
    };

    // Race state
    const effectiveTimerBase = timerBase || Date.now();
    let speed=0,phaseLocal=skipCountdown?'racing':'countdown',timerStart=skipCountdown?effectiveTimerBase:0,lastTU=0;
    const cdStart=Date.now();
    let lapCount=0,lapAway=false,raceEnded=false;
    const answered=new Set();

    // ── Audio (same as KartingTrack) ──────────────────────────────────────
    const audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    const engineEl=new Audio(engineSrc); engineEl.loop=true;
    const engSrc2=audioCtx.createMediaElementSource(engineEl);
    const engGain=audioCtx.createGain(); engGain.gain.value=0.55;
    engSrc2.connect(engGain); engGain.connect(audioCtx.destination);
    engineEl.play().catch(()=>{});
    const musicEl=new Audio(musicSrc); musicEl.loop=true; musicEl.volume=0.28;
    const startEl=new Audio(startSrc); startEl.volume=0.85;
    window.addEventListener('keydown',()=>{ if(audioCtx.state==='suspended') audioCtx.resume(); },{once:true});
    let startPlayed=false, goPlayed=false;

    const onKD=(e)=>{keysRef.current[e.key]=true;e.preventDefault();};
    const onKU=(e)=>{keysRef.current[e.key]=false;};
    window.addEventListener('keydown',onKD); window.addEventListener('keyup',onKU);
    const onRz=()=>{camera.aspect=mount.clientWidth/mount.clientHeight;camera.updateProjectionMatrix();renderer.setSize(mount.clientWidth,mount.clientHeight);};
    window.addEventListener('resize',onRz);

    let animId;
    const animate=()=>{
      animId=requestAnimationFrame(animate);
      const k=keysRef.current,joy=joyRef.current,now=Date.now();

      if(phaseLocal==='countdown'){
        const el=(now-cdStart)/1000;
        if(el<1){ setCountdown(3); if(!startPlayed){startPlayed=true;startEl.play().catch(()=>{});} }
        else if(el<2) setCountdown(2);
        else if(el<3) setCountdown(1);
        else if(el<4){ setCountdown(0); if(!goPlayed){goPlayed=true;musicEl.play().catch(()=>{});} }
        else{phaseLocal='racing';timerStart=now;setPhase('racing');}
        speed=0;
      }
      if(phaseLocal==='racing'&&skipCountdown&&!goPlayed){
        goPlayed=true; musicEl.play().catch(()=>{});
        setPhase('racing');
      }

      if(phaseLocal==='racing'&&!qActRef.current){
        const gas=k['ArrowUp']||k['w']||k['W'], brk=k['ArrowDown']||k['s']||k['S'];
        const lft=k['ArrowLeft']||k['a']||k['A'], rgt=k['ArrowRight']||k['d']||k['D'];
        const jGas=joy.active&&joy.y<-0.15, jBrk=joy.active&&joy.y>0.15;

        if(gas||jGas)      speed=Math.min(speed+ACCEL*(jGas?Math.min(-joy.y,1):1),MAX_SPEED);
        else if(brk||jBrk) speed=speed>0.005?speed*BRAKE_F:Math.max(speed-ACCEL*0.6,-MAX_SPEED*0.4);
        else               speed*=FRICTION;
        if(Math.abs(speed)<0.0005) speed=0;

        if(speed!==0){
          const dir=speed>0?1:-1;
          const jL=joy.active&&joy.x<-0.12,jR=joy.active&&joy.x>0.12,sm=joy.active?Math.min(Math.abs(joy.x),1):1;
          if(lft||jL) car.rotation.y+=TURN*dir*(jL?sm:1);
          if(rgt||jR) car.rotation.y-=TURN*dir*(jR?sm:1);
        }

        const dx=-Math.sin(car.rotation.y)*speed,dz=-Math.cos(car.rotation.y)*speed;
        const nx=car.position.x+dx,nz=car.position.z+dz;
        if     (isOnRoad(nx,nz))              {car.position.x=nx;car.position.z=nz;}
        else if(isOnRoad(nx,car.position.z))  {car.position.x=nx;speed*=SLIDE_FACTOR;}
        else if(isOnRoad(car.position.x,nz))  {car.position.z=nz;speed*=SLIDE_FACTOR;}
        else                                   {speed=0;}

        if(speed!==0) car.children.slice(3).forEach(w=>{w.rotation.x+=speed*3;});
        const targetRate=0.5+(Math.abs(speed)/MAX_SPEED)*1.7;
        engineEl.playbackRate+=(targetRate-engineEl.playbackRate)*0.07;

        // Lap detection
        const dist=Math.hypot(car.position.x-pts3d[0].x,car.position.z-pts3d[0].z);
        if(!lapAway&&dist>MIN_AWAY) lapAway=true;
        if(lapAway&&dist<FINISH_R&&!raceEnded){
          lapAway=false; lapCount++;
          answered.clear();
          onLapCompleteRef.current?.(lapCount);
          if(lapCount>=numVueltas){
            raceEnded=true; phaseLocal='finished'; setPhase('finished');
            setResultado({
              posicion:1, tiempo:now-timerStart, tiempoFormateado:fmt(now-timerStart),
              acertadas:aciertasRef.current, falladas:falladasRef.current, penaltySecs:0,
            });
          } else {
            setCurrentLap(lapCount+1);
          }
        }

        // Checkpoints (user-placed tents)
        cpWorldPos.forEach((cp,cpI)=>{
          if(answered.has(cpI)) return;
          if(Math.hypot(car.position.x-cp.x,car.position.z-cp.z)<CP_RADIUS){
            answered.add(cpI);
            const tMs=now-timerStart;
            const q=pickQ();
            if(q){
              pendingCpRef.current={cpIdx:cpI,lap:lapCount,tMs};
              speed=0;qActRef.current=true;setActiveQ({...q,cpIdx:cpI});
            } else {
              // no question — report immediately as null
              onCheckpointRef.current?.({cpIdx:cpI,lap:lapCount,tMs,ok:null});
              setZoneToast({idx:cpI});setTimeout(()=>setZoneToast(null),1800);
            }
          }
        });

        if(now-lastTU>100){setCurrentMs(now-timerStart);lastTU=now;}
      }

      // Camera
      const bX=Math.sin(car.rotation.y)*11,bZ=Math.cos(car.rotation.y)*11;
      camera.position.x+=(car.position.x+bX-camera.position.x)*0.08;
      camera.position.y+=(car.position.y+5.2-camera.position.y)*0.08;
      camera.position.z+=(car.position.z+bZ-camera.position.z)*0.08;
      camTgt.x+=(car.position.x-Math.sin(car.rotation.y)*2.5-camTgt.x)*0.10;
      camTgt.y+=(car.position.y+0.8-camTgt.y)*0.10;
      camTgt.z+=(car.position.z-Math.cos(car.rotation.y)*2.5-camTgt.z)*0.10;
      camera.lookAt(camTgt);
      renderer.render(scene,camera);
    };
    animate();

    return()=>{
      cancelAnimationFrame(animId);
      engineEl.pause(); musicEl.pause(); startEl.pause(); audioCtx.close().catch(()=>{});
      window.removeEventListener('keydown',onKD); window.removeEventListener('keyup',onKU);
      window.removeEventListener('resize',onRz);
      renderer.dispose();
      if(mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  },[]); // eslint-disable-line

  const hud={background:'rgba(0,0,0,0.55)',color:'#fff',fontFamily:'Arial,sans-serif',
    borderRadius:10,border:'1px solid rgba(255,255,255,0.2)',backdropFilter:'blur(4px)'};
  const hudBtn={...hud,border:'1px solid rgba(255,255,255,0.25)',padding:'7px 13px',borderRadius:8,cursor:'pointer',fontSize:12};

  return(
    <div style={{width:'100vw',height:'100vh',position:'relative',background:'#87ceeb',overflow:'hidden'}}>
      <div ref={mountRef} style={{width:'100%',height:'100%'}}/>

      {phase==='countdown'&&!skipCountdown&&(
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
          {countdown===0&&<div style={{fontSize:42,fontWeight:'bold',color:'#2ecc71',textShadow:'0 0 20px rgba(46,204,113,0.9)',letterSpacing:4}}>¡GO!</div>}
        </div>
      )}

      {phase==='racing'&&(
        <>
          <div style={{position:'absolute',top:12,left:12,...hud,padding:'8px 14px',minWidth:140}}>
            <div style={{fontSize:11,opacity:0.7,marginBottom:3}}>VUELTA {currentLap} / {numVueltas}</div>
            <div style={{fontSize:18,fontWeight:'bold',fontVariantNumeric:'tabular-nums'}}>{fmt(currentMs)}</div>
          </div>
          {recurso&&(
            <div style={{position:'absolute',top:12,right:12,...hud,padding:'8px 14px',textAlign:'center',minWidth:90}}>
              <div style={{fontSize:11,opacity:0.7,marginBottom:4}}>RESPUESTAS</div>
              <div style={{display:'flex',gap:10,justifyContent:'center',alignItems:'center'}}>
                <span style={{color:'#2ecc71',fontWeight:800,fontSize:15}}>✅ {aciertos}</span>
                <span style={{color:'#e74c3c',fontWeight:800,fontSize:15}}>❌ {falladas}</span>
              </div>
            </div>
          )}
        </>
      )}

      {activeQ&&<ModalPregunta datos={activeQ} cpTotal={cpCount} onRespuesta={handleAnswer}/>}
      {zoneToast&&(
        <div style={{position:'absolute',top:'42%',left:'50%',transform:'translate(-50%,-50%)',
          background:'rgba(255,107,0,0.88)',color:'white',borderRadius:14,padding:'14px 28px',
          fontFamily:"'Segoe UI',sans-serif",fontWeight:700,fontSize:'1.05rem',
          boxShadow:'0 4px 24px rgba(0,0,0,0.4)',zIndex:90,textAlign:'center',pointerEvents:'none'}}>
          ⛺ Zona de pregunta {zoneToast.idx+1}
          {!recurso&&<div style={{fontSize:'0.72rem',fontWeight:400,marginTop:4,opacity:0.85}}>Añade un recurso para ver preguntas</div>}
        </div>
      )}
      {phase==='racing'&&<Joystick joyRef={joyRef}/>}

      <div style={{position:'absolute',bottom:14,left:14,zIndex:50}}>
        <button onClick={onVolver} style={hudBtn}>← Volver al editor</button>
      </div>
    </div>
  );
}
