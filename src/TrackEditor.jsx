import React, { useRef, useEffect, useState, useCallback } from 'react';
import tribuneImg from './kenney_racing-pack/PNG/Objects/tribune_full.png';
import arrowImg   from './kenney_racing-pack/PNG/Objects/arrow_yellow.png';
import tentImg    from './kenney_racing-pack/PNG/Objects/tent_red_large.png';
import { auth, db } from './firebase';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const CS        = 480;
const OUTER_W   = 74;
const ROAD_W    = 46;
const STRIPE    = 18;
const MAX_TENTS = 3;

// Base canvas draw size per type (px at scale=1)
const BASE_SIZE = { tribune: 56, arrow: 32, tent: 40 };

export default function TrackEditor({ onVolver, onProbar, initialPaths=[], initialObjects=[] }) {
  const canvasRef  = useRef(null);
  const pathsRef   = useRef([]);
  // {type, x, y, scale:number, rotation:number(rad)}
  const objectsRef = useRef([]);
  const currentRef = useRef(null);
  const isDrawing  = useRef(false);
  const kerbPat    = useRef(null);
  const imgsRef    = useRef({ tribune:null, arrow:null, tent:null });
  const historyRef    = useRef([]);
  const toastTimer    = useRef(null);
  const panRef        = useRef({x:0, y:0});       // world-coord of viewport top-left
  const isPanRef      = useRef(false);
  const panStartRef   = useRef({x:0, y:0});        // raw screen pos when pan began
  const panAtStartRef = useRef({x:0, y:0});        // panRef snapshot when pan began

  const [tool,      setTool]      = useState('draw');
  const [selIdx,    setSelIdx]    = useState(-1);
  const [pathCount, setPathCount] = useState(0);
  const [closed,    setClosed]    = useState(false);
  const [toast,     setToast]     = useState(null);
  const [, bump]                  = useState(0); // force re-render for side panel
  const [user,        setUser]        = useState(null);
  const [saveModal,   setSaveModal]   = useState(false);
  const [circuitName, setCircuitName] = useState('');
  const [saving,      setSaving]      = useState(false);
  const [saveMsg,     setSaveMsg]     = useState('');

  const refresh = useCallback(() => bump(v => v+1), []);

  // Preload PNGs
  useEffect(() => {
    [['tribune',tribuneImg],['arrow',arrowImg],['tent',tentImg]].forEach(([k,src]) => {
      const img = new Image();
      img.onload = () => { imgsRef.current[k] = img; redrawEditor(); };
      img.src = src;
    });
  }, []); // eslint-disable-line

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  };

  // ── Draw helpers ──────────────────────────────────────────────────────────────
  function drawBg(ctx) {
    // Background — always screen-space (called before ctx.translate)
    ctx.fillStyle = '#3a6428';
    ctx.fillRect(0, 0, CS, CS);
    // Scrolling grid so the user can feel panning
    const G = 60;
    const {x:px, y:py} = panRef.current;
    const ox = ((px % G) + G) % G;
    const oy = ((py % G) + G) % G;
    ctx.strokeStyle = 'rgba(0,0,0,0.09)';
    ctx.lineWidth = 1;
    for (let x = -ox; x <= CS; x += G) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,CS); ctx.stroke(); }
    for (let y = -oy; y <= CS; y += G) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(CS,y); ctx.stroke(); }
  }

  function getKerbPat(ctx) {
    if (kerbPat.current) return kerbPat.current;
    const pc = document.createElement('canvas');
    pc.width = STRIPE; pc.height = STRIPE;
    const px = pc.getContext('2d');
    px.fillStyle = '#CC0000'; px.fillRect(0, 0, STRIPE, STRIPE);
    px.fillStyle = '#FFFFFF'; px.fillRect(0, 0, STRIPE/2, STRIPE);
    kerbPat.current = ctx.createPattern(pc, 'repeat');
    return kerbPat.current;
  }

  function drawStroke(ctx, path) {
    if (path.length < 2) return;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([]);
    // detect closed path (last point duplicates first, tolerance 3px for float drift)
    const isClosed = path.length > 2 &&
      Math.hypot(path[0].x - path[path.length-1].x, path[0].y - path[path.length-1].y) < 3;
    const line = (w, style) => {
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      // skip the duplicated last point when closed — closePath handles the join
      const end = isClosed ? path.length - 1 : path.length;
      for (let i = 1; i < end; i++) ctx.lineTo(path[i].x, path[i].y);
      if (isClosed) ctx.closePath();
      ctx.lineWidth = w; ctx.strokeStyle = style; ctx.stroke();
    };
    line(OUTER_W, getKerbPat(ctx));
    line(ROAD_W,  '#1c1c1c');
    line(1.5,     'rgba(255,255,255,0.22)');
  }

  function drawObjects(ctx) {
    const imgs = imgsRef.current;
    objectsRef.current.forEach((obj, idx) => {
      const half = (BASE_SIZE[obj.type] * obj.scale) / 2;
      ctx.save();
      ctx.translate(obj.x, obj.y);
      ctx.rotate(obj.rotation);
      if (imgs[obj.type]) {
        ctx.drawImage(imgs[obj.type], -half, -half, half*2, half*2);
      } else {
        ctx.fillStyle = obj.type==='tent'?'#e74c3c':obj.type==='arrow'?'#F1C40F':'#3498db';
        ctx.beginPath(); ctx.arc(0, 0, half, 0, Math.PI*2); ctx.fill();
      }
      // Selection ring
      if (idx === selIdx) {
        ctx.strokeStyle = '#FF6B00';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(-half-5, -half-5, (half+5)*2, (half+5)*2);
        ctx.setLineDash([]);
        // Rotation handle (small circle above)
        ctx.fillStyle = '#FF6B00';
        ctx.beginPath(); ctx.arc(0, -(half+12), 5, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#FF6B00'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, -(half+5)); ctx.lineTo(0, -(half+12)); ctx.stroke();
      }
      // Tent dashed zone ring
      if (obj.type === 'tent') {
        ctx.strokeStyle = 'rgba(231,76,60,0.70)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4,4]);
        ctx.beginPath(); ctx.arc(0, 0, half+10, 0, Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    });
  }

  // Merge all saved segments + live stroke into one continuous path for rendering
  function buildMergedPath() {
    const segs = pathsRef.current;
    if (!segs.length) return currentRef.current?.length > 1 ? [...currentRef.current] : [];
    const merged = [...segs[0]];
    for (let i = 1; i < segs.length; i++) {
      const seg = segs[i];
      if (!seg.length) continue;
      const last = merged[merged.length - 1];
      // skip duplicate connection point
      const skip = Math.hypot(seg[0].x - last.x, seg[0].y - last.y) < 2 ? 1 : 0;
      merged.push(...seg.slice(skip));
    }
    if (currentRef.current?.length > 1) {
      const cur = currentRef.current;
      const last = merged[merged.length - 1];
      const skip = Math.hypot(cur[0].x - last.x, cur[0].y - last.y) < 2 ? 1 : 0;
      merged.push(...cur.slice(skip));
    }
    return merged;
  }

  const redrawEditor = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const {x:px, y:py} = panRef.current;
    drawBg(ctx);                          // screen-space background + grid
    ctx.save();
    ctx.translate(-px, -py);             // enter world space
    const merged = buildMergedPath();
    if (merged.length > 1) drawStroke(ctx, merged);
    drawObjects(ctx);
    ctx.restore();
  }, [selIdx]); // eslint-disable-line

  useEffect(() => { drawBg(canvasRef.current.getContext('2d')); }, []);
  // Redraw when selection changes
  useEffect(() => { redrawEditor(); }, [selIdx, redrawEditor]);

  // Track auth state
  useEffect(() => onAuthStateChanged(auth, u => setUser(u)), []);

  // Load initial circuit (from warehouse) and fit viewport
  useEffect(() => {
    if (!initialPaths.length) return;
    pathsRef.current   = initialPaths.map(p => [...p]);
    objectsRef.current = (initialObjects||[]).map(o => ({...o}));
    setPathCount(initialPaths.length);
    // Check if the circuit was saved closed: last point of last segment ≈ first point of first segment
    const first = initialPaths[0][0];
    const lastSeg = initialPaths[initialPaths.length-1];
    const lastPt  = lastSeg[lastSeg.length-1];
    if (initialPaths[0].length >= 2 && Math.hypot(lastPt.x-first.x, lastPt.y-first.y) < 3)
      setClosed(true);
    // Pan to the circuit's bounding box top-left with a small margin
    const allPts = initialPaths.flat();
    if (allPts.length) {
      const minX = Math.min(...allPts.map(p=>p.x));
      const minY = Math.min(...allPts.map(p=>p.y));
      panRef.current = { x: minX - 40, y: minY - 40 };
    }
    redrawEditor();
  }, []); // eslint-disable-line

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function tentCount() { return objectsRef.current.filter(o => o.type==='tent').length; }

  function findObjAt(cx, cy) {
    for (let i = objectsRef.current.length-1; i >= 0; i--) {
      const obj = objectsRef.current[i];
      const half = (BASE_SIZE[obj.type] * obj.scale) / 2 + 8;
      const dx = cx - obj.x, dy = cy - obj.y;
      const cos = Math.cos(-obj.rotation), sin = Math.sin(-obj.rotation);
      const lx = dx*cos - dy*sin, ly = dx*sin + dy*cos;
      if (Math.abs(lx) < half && Math.abs(ly) < half) return i;
    }
    return -1;
  }

  // ── Actions ───────────────────────────────────────────────────────────────────
  const closeCircuit = () => {
    if (!pathsRef.current.length || closed) return;
    const last = pathsRef.current[pathsRef.current.length-1];
    if (last.length < 3) return;
    // Always close back to the very first point of the entire circuit, not the last segment's start
    const circuitStart = { ...pathsRef.current[0][0] };
    pathsRef.current[pathsRef.current.length-1] = [...last, circuitStart];
    setClosed(true); redrawEditor();
  };

  const undoFn = useCallback(() => {
    if (!historyRef.current.length) return;
    const last = historyRef.current.pop();
    if (last.kind === 'path') {
      pathsRef.current.pop(); setPathCount(c => c-1); setClosed(false);
    } else {
      const idx = objectsRef.current.map(o=>o.type).lastIndexOf(last.type);
      if (idx !== -1) objectsRef.current.splice(idx, 1);
    }
    setSelIdx(-1); refresh(); redrawEditor();
  }, [redrawEditor, refresh]);

  const deleteSelected = useCallback(() => {
    if (selIdx < 0 || selIdx >= objectsRef.current.length) return;
    objectsRef.current.splice(selIdx, 1);
    setSelIdx(-1); refresh(); redrawEditor();
  }, [selIdx, redrawEditor, refresh]);

  const changeScale = useCallback((delta) => {
    if (selIdx < 0) return;
    const obj = objectsRef.current[selIdx];
    if (!obj) return;
    obj.scale = Math.max(0.25, Math.min(4.0, +(obj.scale + delta).toFixed(2)));
    refresh(); redrawEditor();
  }, [selIdx, redrawEditor, refresh]);

  const changeRotation = useCallback((delta) => {
    if (selIdx < 0) return;
    const obj = objectsRef.current[selIdx];
    if (!obj) return;
    obj.rotation = (obj.rotation + delta + Math.PI*2) % (Math.PI*2);
    refresh(); redrawEditor();
  }, [selIdx, redrawEditor, refresh]);

  const clear = () => {
    pathsRef.current = []; objectsRef.current = []; currentRef.current = null;
    kerbPat.current = null; historyRef.current = [];
    panRef.current = {x:0, y:0};
    setPathCount(0); setClosed(false); setSelIdx(-1); refresh();
    redrawEditor();
  };

  // ── Keys ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e) => {
      if ((e.ctrlKey||e.metaKey) && e.key==='z') { e.preventDefault(); undoFn(); }
      if (e.key==='Delete'||e.key==='Backspace') { if(selIdx>=0) deleteSelected(); }
      if (e.key==='Escape') setSelIdx(-1);
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [undoFn, deleteSelected, selIdx]);

  // ── Canvas pointer ────────────────────────────────────────────────────────────
  // Screen-space position (ignores pan)
  function rawPos(e) {
    const r = canvasRef.current.getBoundingClientRect();
    const t = e.touches?.[0];
    return {
      x: ((t?.clientX ?? e.clientX) - r.left) * (CS / r.width),
      y: ((t?.clientY ?? e.clientY) - r.top)  * (CS / r.height),
    };
  }
  // World-space position (screen + pan offset)
  function pos(e) {
    const r = rawPos(e);
    return { x: r.x + panRef.current.x, y: r.y + panRef.current.y };
  }

  const onDown = (e) => {
    e.preventDefault();

    // Right-click or pan tool → start panning
    if (e.button === 2 || tool === 'pan') {
      isPanRef.current     = true;
      panStartRef.current  = rawPos(e);
      panAtStartRef.current = { ...panRef.current };
      return;
    }

    const p = pos(e);

    if (tool === 'select') {
      const found = findObjAt(p.x, p.y);
      setSelIdx(found);
      return;
    }

    if (tool === 'draw') {
      setSelIdx(-1);
      isDrawing.current = true;
      if (!closed && pathsRef.current.length > 0) {
        // Auto-connect: start new segment from the end of the last drawn segment
        const lastSeg = pathsRef.current[pathsRef.current.length - 1];
        currentRef.current = [{ ...lastSeg[lastSeg.length - 1] }];
      } else {
        currentRef.current = [p];
      }
      return;
    }

    // Placement tools
    setSelIdx(-1);
    if (tool === 'tent') {
      if (tentCount() >= MAX_TENTS) { showToast(`Máximo ${MAX_TENTS} zonas de pregunta por vuelta`); return; }
      objectsRef.current.push({ type:'tent', x:p.x, y:p.y, scale:1, rotation:0 });
      historyRef.current.push({ kind:'object', type:'tent' });
      showToast('¡Has añadido una zona de pregunta!');
    } else {
      const type = tool; // 'tribune' | 'arrow'
      objectsRef.current.push({ type, x:p.x, y:p.y, scale:1, rotation:0 });
      historyRef.current.push({ kind:'object', type });
    }
    const newIdx = objectsRef.current.length - 1;
    setSelIdx(newIdx);
    refresh(); redrawEditor();
  };

  const onMove = (e) => {
    e.preventDefault();
    // Panning
    if (isPanRef.current) {
      const r = rawPos(e);
      panRef.current = {
        x: panAtStartRef.current.x + (panStartRef.current.x - r.x),
        y: panAtStartRef.current.y + (panStartRef.current.y - r.y),
      };
      redrawEditor();
      return;
    }
    if (tool !== 'draw' || !isDrawing.current) return;
    const p = pos(e), last = currentRef.current[currentRef.current.length-1];
    if (Math.hypot(p.x-last.x, p.y-last.y) < 5) return;
    currentRef.current.push(p); redrawEditor();
  };

  const onUp = () => {
    if (isPanRef.current) { isPanRef.current = false; return; }
    if (tool !== 'draw' || !isDrawing.current) return;
    isDrawing.current = false;
    if (currentRef.current?.length > 1) {
      pathsRef.current.push(currentRef.current);
      historyRef.current.push({ kind:'path' });
      setPathCount(c => c+1);
    }
    currentRef.current = null; redrawEditor();
  };

  // ── Save to Firebase ─────────────────────────────────────────────────────────
  const openSave = () => { if (!pathCount) { showToast('Dibuja primero un circuito'); return; } setSaveModal(true); };

  const doLogin = async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch(e) {}
  };

  const doSave = async () => {
    if (!user || !circuitName.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'circuitos'), {
        userId:    user.uid,
        userName:  user.displayName || user.email || 'Anónimo',
        userPhoto: user.photoURL || null,
        nombre:    circuitName.trim(),
        paths:     pathsRef.current,
        objects:   objectsRef.current,
        createdAt: serverTimestamp(),
        isPublic:  true,
      });
      setSaveMsg('¡Guardado!');
      setTimeout(() => { setSaveModal(false); setSaveMsg(''); setCircuitName(''); }, 1500);
    } catch(e) { setSaveMsg('Error al guardar'); }
    setSaving(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  const selObj   = selIdx >= 0 ? objectsRef.current[selIdx] : null;
  const canProbar = pathCount > 0;
  const cursors  = { select:'default', draw:'crosshair', pan:'grab', tribune:'cell', arrow:'cell', tent:'cell' };

  const TOOLS = [
    { id:'select',  icon:'🖱️', label:'Selec.' },
    { id:'draw',    icon:'✏️', label:'Trazar' },
    { id:'pan',     icon:'🖐️', label:'Mover' },
    { id:'tribune', icon:'🏟️', label:'Tribuna' },
    { id:'arrow',   icon:'⬆️', label:'Flecha' },
    { id:'tent',    icon:'⛺', label:`Zona\n${tentCount()}/${MAX_TENTS}` },
  ];

  const hint = tool==='select'
    ? (selObj ? `${selObj.type} sel.` : 'Clic para seleccionar')
    : tool==='draw'
    ? (closed ? '✅ Cerrado' : pathCount ? 'Continúa trazando o cierra' : 'Arrastra para trazar')
    : tool==='pan'     ? 'Arrastra para mover la vista (clic dcho. también mueve)'
    : tool==='tribune' ? 'Clic = colocar tribuna'
    : tool==='arrow'   ? 'Clic = colocar flecha'
    : `Clic = zona pregunta (${tentCount()}/${MAX_TENTS})`;

  return (
    <div style={S.page}>
      <div style={{ fontSize:'2rem', marginBottom:2 }}>🏗️</div>
      <h2 style={S.title}>Constructor de Circuitos</h2>
      <p style={S.hint}>{hint}</p>

      <div style={S.row}>
        {/* Canvas */}
        <div style={S.wrap}>
          <canvas
            ref={canvasRef} width={CS} height={CS}
            style={{ display:'block', width:'100%', cursor:cursors[tool], touchAction:'none' }}
            onMouseDown={onDown} onMouseMove={onMove}
            onMouseUp={onUp}     onMouseLeave={onUp}
            onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
            onContextMenu={e=>e.preventDefault()}
          />
        </div>

        {/* Side panel */}
        <div style={S.side}>

          {/* Tool buttons */}
          <div style={S.groupLabel}>HERRAMIENTA</div>
          {TOOLS.map(({ id, icon, label }) => (
            <button key={id} onClick={()=>{ setTool(id); if(id!=='select') setSelIdx(-1); }}
              style={toolBtn(tool===id)}>
              <span style={{ fontSize:'1.2rem' }}>{icon}</span>
              <span style={{ fontSize:'0.66rem', lineHeight:1.3, whiteSpace:'pre' }}>{label}</span>
            </button>
          ))}

          <div style={S.divider}/>

          {/* Pan reset */}
          <button onClick={()=>{ panRef.current={x:0,y:0}; redrawEditor(); }}
            style={sideBtn('rgba(255,255,255,0.06)', false)}>
            🏠 Centrar
          </button>

          <div style={S.divider}/>

          {/* Selected object controls */}
          {selObj ? (
            <div style={S.selPanel}>
              <div style={S.groupLabel}>
                {selObj.type==='tribune'?'TRIBUNA':selObj.type==='arrow'?'FLECHA':'ZONA PREG.'}
              </div>
              {/* Scale */}
              <div style={S.ctrlLabel}>Tamaño</div>
              <div style={S.ctrlRow}>
                <button onClick={()=>changeScale(-0.25)} style={microBtn}>−</button>
                <span style={S.ctrlVal}>×{selObj.scale.toFixed(2)}</span>
                <button onClick={()=>changeScale(+0.25)} style={microBtn}>+</button>
              </div>
              {/* Rotation */}
              <div style={S.ctrlLabel}>Rotación</div>
              <div style={S.ctrlRow}>
                <button onClick={()=>changeRotation(-Math.PI/12)} style={microBtn}>↺</button>
                <span style={S.ctrlVal}>{Math.round(selObj.rotation*180/Math.PI)}°</span>
                <button onClick={()=>changeRotation(+Math.PI/12)} style={microBtn}>↻</button>
              </div>
              <button onClick={deleteSelected} style={delBtn}>🗑 Eliminar</button>
            </div>
          ) : (
            <>
              <button onClick={closeCircuit} disabled={!pathCount||closed}
                style={sideBtn(pathCount&&!closed?'#1a6e3c':'#222', !pathCount||closed)}>
                🔁 Cerrar circuito
              </button>
              <button onClick={() => onProbar(pathsRef.current, objectsRef.current)}
                disabled={!canProbar} style={sideBtn(canProbar?'#2d5a8a':'#222', !canProbar)}>
                🚗 Probar
              </button>
              <button onClick={openSave}
                disabled={!canProbar} style={sideBtn(canProbar?'#1a6e3c':'#222', !canProbar)}>
                💾 Guardar
              </button>
            </>
          )}

          <div style={{ flex:1 }}/>

          <button onClick={undoFn} disabled={!historyRef.current.length}
            style={sideBtn(historyRef.current.length?'#5a3a7a':'#222', !historyRef.current.length)}>
            ↩ Deshacer
          </button>
          <button onClick={clear} style={sideBtn('#444', false)}>🗑️ Limpiar</button>
          {/* Probar / Guardar always visible at bottom when object selected */}
          {selObj && (
            <>
              <button onClick={() => onProbar(pathsRef.current, objectsRef.current)}
                disabled={!canProbar} style={sideBtn(canProbar?'#2d5a8a':'#222', !canProbar)}>
                🚗 Probar
              </button>
              <button onClick={openSave}
                disabled={!canProbar} style={sideBtn(canProbar?'#1a6e3c':'#222', !canProbar)}>
                💾 Guardar
              </button>
            </>
          )}
          <button onClick={onVolver} style={sideBtn('rgba(255,255,255,0.08)', false)}>← Volver</button>
        </div>
      </div>

      {toast && <div style={S.toast}>{toast}</div>}

      {saveModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.72)',display:'flex',
          alignItems:'center',justifyContent:'center',zIndex:300,padding:16}}>
          <div style={{background:'linear-gradient(160deg,#1a1a2e,#0f3460)',
            border:'2px solid rgba(255,107,0,0.5)',borderRadius:18,
            padding:'24px 28px',maxWidth:380,width:'100%',color:'white',
            fontFamily:"'Segoe UI',sans-serif",boxShadow:'0 0 50px rgba(0,0,0,0.6)'}}>
            <div style={{fontSize:'1.2rem',fontWeight:900,marginBottom:14,color:'#FFD700'}}>
              💾 Guardar circuito
            </div>
            {!user ? (
              <>
                <p style={{color:'#aaa',marginBottom:16,fontSize:'0.85rem'}}>
                  Inicia sesión para guardar y compartir tu circuito.
                </p>
                <button onClick={doLogin} style={{width:'100%',padding:'11px',borderRadius:11,
                  border:'1px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.12)',
                  color:'white',fontWeight:700,cursor:'pointer',fontSize:'0.9rem'}}>
                  🔑 Iniciar sesión con Google
                </button>
              </>
            ) : (
              <>
                <div style={{color:'#aaa',fontSize:'0.78rem',marginBottom:12}}>
                  👤 {user.displayName || user.email}
                </div>
                <input
                  value={circuitName}
                  onChange={e=>setCircuitName(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&!saving&&doSave()}
                  placeholder="Nombre del circuito..."
                  autoFocus
                  style={{width:'100%',padding:'10px 12px',borderRadius:9,
                    border:'1px solid rgba(255,255,255,0.22)',
                    background:'rgba(255,255,255,0.08)',color:'white',
                    fontSize:'0.92rem',marginBottom:12,boxSizing:'border-box',outline:'none'}}
                />
                {saveMsg ? (
                  <div style={{textAlign:'center',padding:'8px',fontWeight:700,
                    color:saveMsg.includes('Error')?'#e74c3c':'#2ecc71'}}>
                    {saveMsg}
                  </div>
                ) : (
                  <button onClick={doSave} disabled={!circuitName.trim()||saving}
                    style={{width:'100%',padding:'11px',borderRadius:11,border:'none',
                      background:circuitName.trim()&&!saving?'#FF6B00':'#333',
                      color:'white',fontWeight:700,
                      cursor:circuitName.trim()&&!saving?'pointer':'default',fontSize:'0.9rem'}}>
                    {saving ? 'Guardando…' : '💾 Guardar'}
                  </button>
                )}
              </>
            )}
            <button onClick={()=>{setSaveModal(false);setSaveMsg('');}}
              style={{marginTop:10,width:'100%',padding:'8px',borderRadius:9,
                border:'1px solid rgba(255,255,255,0.12)',background:'transparent',
                color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:'0.78rem'}}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight:'100vh',
    background:'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)',
    display:'flex', flexDirection:'column', alignItems:'center',
    padding:'14px 10px', color:'white', fontFamily:"'Segoe UI',sans-serif",
    userSelect:'none',
  },
  title: {
    fontSize:'1.6rem', fontWeight:900, margin:'0 0 2px',
    background:'linear-gradient(90deg,#FF6B00,#FFD700)',
    WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
  },
  hint: { color:'#bbb', marginBottom:6, fontSize:'0.78rem', textAlign:'center', minHeight:16 },
  row:  { display:'flex', gap:8, alignItems:'flex-start', width:'100%', maxWidth: CS+140 },
  wrap: {
    borderRadius:10, overflow:'hidden', flexShrink:0,
    border:'2px solid rgba(255,255,255,0.12)', boxShadow:'0 8px 32px rgba(0,0,0,0.65)',
    width:CS, maxWidth:'calc(100vw - 148px)', aspectRatio:'1/1',
  },
  side: {
    display:'flex', flexDirection:'column', gap:5,
    width:132, flexShrink:0, minHeight:CS,
  },
  groupLabel: {
    fontSize:'0.58rem', color:'rgba(255,255,255,0.38)', letterSpacing:1.4,
    fontWeight:700, paddingLeft:2,
  },
  divider: { height:1, background:'rgba(255,255,255,0.1)', margin:'3px 0' },
  toast: {
    position:'fixed', bottom:20, left:'50%', transform:'translateX(-50%)',
    background:'linear-gradient(135deg,#e74c3c,#c0392b)', color:'white',
    padding:'9px 20px', borderRadius:12, fontWeight:700, zIndex:1000,
    fontSize:'0.86rem', boxShadow:'0 4px 20px rgba(0,0,0,0.5)', pointerEvents:'none',
  },
  selPanel: {
    background:'rgba(255,107,0,0.08)', border:'1px solid rgba(255,107,0,0.35)',
    borderRadius:8, padding:'7px 6px', display:'flex', flexDirection:'column', gap:4,
  },
  ctrlLabel: { fontSize:'0.65rem', color:'rgba(255,255,255,0.45)', marginTop:2 },
  ctrlRow:   { display:'flex', alignItems:'center', gap:3 },
  ctrlVal:   { flex:1, textAlign:'center', fontSize:'0.72rem', fontWeight:700, color:'#FFD700' },
};

function toolBtn(active) {
  return {
    display:'flex', flexDirection:'column', alignItems:'center', gap:2,
    padding:'6px 4px', borderRadius:8, cursor:'pointer',
    border:`2px solid ${active?'#FF6B00':'rgba(255,255,255,0.14)'}`,
    background:active?'rgba(255,107,0,0.22)':'rgba(255,255,255,0.05)',
    color:active?'#FF6B00':'rgba(255,255,255,0.7)',
    fontWeight:700, transition:'all .12s',
    boxShadow:active?'0 0 10px rgba(255,107,0,0.25)':'none',
  };
}

function sideBtn(bg, disabled) {
  return {
    padding:'8px 5px', borderRadius:8, cursor:disabled?'default':'pointer',
    border:'1px solid rgba(255,255,255,0.12)',
    background:bg, color:disabled?'#555':'white',
    fontSize:'0.76rem', fontWeight:700, textAlign:'center',
    opacity:disabled?0.45:1, transition:'opacity .12s',
  };
}

const microBtn = {
  width:22, height:22, borderRadius:5, border:'1px solid rgba(255,255,255,0.25)',
  background:'rgba(255,255,255,0.1)', color:'white', cursor:'pointer',
  fontSize:'0.9rem', fontWeight:900, padding:0, lineHeight:'22px',
};

const delBtn = {
  padding:'6px 4px', borderRadius:7, cursor:'pointer',
  border:'1px solid rgba(231,76,60,0.4)',
  background:'rgba(231,76,60,0.2)', color:'#ff7875',
  fontSize:'0.74rem', fontWeight:700, textAlign:'center', marginTop:2,
};
