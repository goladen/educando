import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, RefreshCw, CheckCircle, Activity, Edit3, List, Send, Search, AlertTriangle } from 'lucide-react';
import Confetti from 'react-confetti';
import { db } from './firebase';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, getDoc, doc } from 'firebase/firestore';
import { FUNCIONES_DB } from './BibliotecaFunciones';

const auth = getAuth();

// ─── RENDER LATEX ─────────────────────────────────────────────────────────────
function renderLatex(str) {
    if (!str) return str;
    const nodes = []; let i = 0, key = 0;
    while (i < str.length) {
        if (str[i] === '\\' && str.slice(i,i+5) === '\\frac') {
            i += 5;
            if (str[i] !== '{') { nodes.push(str[i++]); continue; }
            let depth=1, j=i+1, num='';
            while (j < str.length && depth > 0) { if(str[j]==='{')depth++; else if(str[j]==='}')depth--; if(depth>0)num+=str[j]; j++; }
            i = j;
            if (str[i] !== '{') { nodes.push(str[i++]); continue; }
            depth=1; j=i+1; let den='';
            while (j < str.length && depth > 0) { if(str[j]==='{')depth++; else if(str[j]==='}')depth--; if(depth>0)den+=str[j]; j++; }
            i = j;
            nodes.push(<span key={key++} style={{display:'inline-flex',flexDirection:'column',alignItems:'center',verticalAlign:'middle',margin:'0 2px',lineHeight:1.1}}><span style={{borderBottom:'1.5px solid currentColor',padding:'0 3px',fontSize:'0.82em'}}>{renderLatex(num)}</span><span style={{padding:'0 3px',fontSize:'0.82em'}}>{renderLatex(den)}</span></span>);
        } else if (str[i] === '^') {
            i++;
            if (str[i] === '{') {
                let depth=1, j=i+1, exp='';
                while (j<str.length&&depth>0){if(str[j]==='{')depth++;else if(str[j]==='}')depth--;if(depth>0)exp+=str[j];j++;}
                i=j; nodes.push(<sup key={key++} style={{ fontSize:'0.6em', position:'relative', top:'-0.5em', lineHeight:0}}>{renderLatex(exp)}</sup>);
            } else { nodes.push(<sup key={key++} style={{ fontSize:'0.6em', position:'relative', top:'-0.5em', lineHeight:0 }}>{str[i++]}</sup>); }
        } else if (str[i] === '_') {
            i++;
            if (str[i] === '{') {
                let depth=1, j=i+1, sub='';
                while (j<str.length&&depth>0){if(str[j]==='{')depth++;else if(str[j]==='}')depth--;if(depth>0)sub+=str[j];j++;}
                i=j; nodes.push(<sup key={key++} style={{ fontSize:'0.6em', position:'relative', top:'-0.5em', lineHeight:0 }}>{renderLatex(exp)}</sup>);
            } else { nodes.push(<sup key={key++} style={{ fontSize:'0.6em', position:'relative', top:'-0.5em', lineHeight:0 }}>{str[i++]}</sup>); }
        } else if (str[i] === '\\' && str.slice(i,i+5) === '\\sqrt') {
            i += 5;
            if (str[i]==='{') {
                let depth=1,j=i+1,inner='';
                while(j<str.length&&depth>0){if(str[j]==='{')depth++;else if(str[j]==='}')depth--;if(depth>0)inner+=str[j];j++;}
                i=j; nodes.push(<span key={key++}>√{renderLatex(inner)}</span>);
            }
        } else if (str[i]==='\\') { i++; }
        else { nodes.push(str[i++]); }
    }
    const merged=[]; let buf='';
    nodes.forEach(n => { if(typeof n==='string')buf+=n; else { if(buf){merged.push(buf);buf='';} merged.push(n); }});
    if(buf) merged.push(buf);
    return merged.length===1&&typeof merged[0]==='string' ? merged[0] : merged;
}

// ─── PARSERS PARA RESALTADO ───────────────────────────────────────────────────
function parseIntervals(str) {
    if (!str || str.trim() === '∅' || str.trim() === '') return [];
    return str.split(/\s*[U∪]\s*/).map(part => {
        part = part.trim();
        const nums = part.replace(/[()[\]∞]/g,'').split(',').map(s => {
            s = s.trim();
            if (s === '' || s === '+') return Infinity;
            if (s === '-') return -Infinity;
            const v = parseFloat(s);
            return isNaN(v) ? (s.startsWith('-') ? -Infinity : Infinity) : v;
        });
        // handle -∞ and ∞ written as part of the original string
        const a = part.includes('-∞') ? -Infinity : nums[0];
        const b = (part.slice(part.indexOf(',')+1) || '').includes('∞') && !part.slice(part.indexOf(',')+1).includes('-∞') ? Infinity : nums[1];
        return { a, b };
    }).filter(iv => iv.a !== undefined && iv.b !== undefined);
}
function parsePoints(str) {
    if (!str) return [];
    const matches = [...str.matchAll(/\(([^)]+)\)/g)];
    return matches.map(m => {
        const parts = m[1].split(',').map(s => parseFloat(s.trim()));
        return { x: parts[0], y: parts[1] };
    }).filter(p => !isNaN(p.x) && !isNaN(p.y));
}
function parseExtrema(str) {
    if (!str || str.trim() === 'No tiene') return [];
    const result = [];
    for (const m of str.matchAll(/M[áa]x\(([^)]+)\)/gi)) {
        const p = m[1].split(',').map(s => parseFloat(s.trim()));
        if (!isNaN(p[0]) && !isNaN(p[1])) result.push({ x:p[0], y:p[1], type:'max' });
    }
    for (const m of str.matchAll(/M[íi]n\(([^)]+)\)/gi)) {
        const p = m[1].split(',').map(s => parseFloat(s.trim()));
        if (!isNaN(p[0]) && !isNaN(p[1])) result.push({ x:p[0], y:p[1], type:'min' });
    }
    return result;
}
function parseMonotonia(str) {
    const cm = str.match(/C:\s*(.+?)(?:\s+D:|$)/);
    const dm = str.match(/D:\s*(.+?)$/);
    return {
        crece:   cm ? parseIntervals(cm[1].trim()) : [],
        decrece: dm ? parseIntervals(dm[1].trim()) : [],
    };
}
function parsePeriod(str) {
    if (!str) return null;
    str = str.trim();
    // "2π", "π/2", "π", "3.14", "2"
    const mFrac = str.match(/^([\d.]+)?\s*π\s*\/\s*([\d.]+)$/);
    if (mFrac) return (mFrac[1] ? parseFloat(mFrac[1]) : 1) * Math.PI / parseFloat(mFrac[2]);
    const mPi = str.match(/^([\d.]+)?\s*π$/);
    if (mPi) return (mPi[1] ? parseFloat(mPi[1]) : 1) * Math.PI;
    const v = parseFloat(str);
    return isNaN(v) ? null : v;
}

// ─── PLOTTER ──────────────────────────────────────────────────────────────────
function FunctionPlotter({ fn, range = 7, highlights = [], caracteristicas = {} }) {
    const canvasRef = useRef(null);
    const CS = 400, SCALE = CS/(range*2), OX = CS/2, OY = CS/2;
    const cx_ = mx => OX + mx * SCALE;
    const cy_ = my => OY - my * SCALE;
    useEffect(() => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0,0,CS,CS);
        ctx.fillStyle='#f8f9ff'; ctx.fillRect(0,0,CS,CS);

        // ── Grid ──
        ctx.strokeStyle='#dde1f5'; ctx.lineWidth=1;
        for (let v=-range; v<=range; v++) {
            ctx.beginPath(); ctx.moveTo(cx_(v),0); ctx.lineTo(cx_(v),CS); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0,cy_(v)); ctx.lineTo(CS,cy_(v)); ctx.stroke();
        }

        // ── HIGHLIGHTS ──
        const BAR = 18; // brush width
        const has = k => highlights.includes(k);

        // Dominio — eje X azul
        if (has('dominio')) {
            const ivs = parseIntervals(caracteristicas.dominio?.correcta || '');
            ctx.save(); ctx.globalAlpha = 0.38; ctx.fillStyle = '#2980b9';
            for (const {a,b} of ivs) {
                const x1 = a === -Infinity ? 0 : Math.max(0, cx_(a));
                const x2 = b === Infinity  ? CS : Math.min(CS, cx_(b));
                ctx.beginPath();
                ctx.roundRect ? ctx.roundRect(x1, OY-BAR/2, x2-x1, BAR, BAR/2)
                              : ctx.rect(x1, OY-BAR/2, x2-x1, BAR);
                ctx.fill();
            }
            ctx.restore();
        }

        // Recorrido — eje Y rosa
        if (has('recorrido')) {
            const ivs = parseIntervals(caracteristicas.recorrido?.correcta || '');
            ctx.save(); ctx.globalAlpha = 0.38; ctx.fillStyle = '#e91e8c';
            for (const {a,b} of ivs) {
                const y1 = b === Infinity  ? 0  : Math.max(0, cy_(b));
                const y2 = a === -Infinity ? CS : Math.min(CS, cy_(a));
                ctx.beginPath();
                ctx.roundRect ? ctx.roundRect(OX-BAR/2, y1, BAR, y2-y1, BAR/2)
                              : ctx.rect(OX-BAR/2, y1, BAR, y2-y1);
                ctx.fill();
            }
            ctx.restore();
        }

        // Monotonía — eje X azul (crece) y naranja (decrece)
        if (has('monotonia')) {
            const {crece, decrece} = parseMonotonia(caracteristicas.monotonia?.correcta || '');
            ctx.save(); ctx.globalAlpha = 0.42;
            for (const {a,b} of crece) {
                ctx.fillStyle = '#2980b9';
                const x1 = a === -Infinity ? 0 : Math.max(0, cx_(a));
                const x2 = b === Infinity  ? CS : Math.min(CS, cx_(b));
                ctx.fillRect(x1, OY-BAR/2, x2-x1, BAR);
            }
            for (const {a,b} of decrece) {
                ctx.fillStyle = '#e67e22';
                const x1 = a === -Infinity ? 0 : Math.max(0, cx_(a));
                const x2 = b === Infinity  ? CS : Math.min(CS, cx_(b));
                ctx.fillRect(x1, OY-BAR/2, x2-x1, BAR);
            }
            ctx.restore();
        }

        // Simetría — par (eje Y) / impar (giro 180°)
        if (has('simetria')) {
            const sim = (caracteristicas.simetria?.correcta || '').toLowerCase();
            ctx.save();
            if (sim === 'par') {
                // shade both halves in violet
                ctx.globalAlpha = 0.09; ctx.fillStyle = '#8e44ad';
                ctx.fillRect(0, 0, OX, CS);
                ctx.fillRect(OX, 0, CS - OX, CS);
                // dashed fold line on Y axis
                ctx.globalAlpha = 0.65; ctx.strokeStyle = '#8e44ad'; ctx.lineWidth = 3;
                ctx.setLineDash([8, 5]);
                ctx.beginPath(); ctx.moveTo(OX, 6); ctx.lineTo(OX, CS - 6); ctx.stroke();
                ctx.setLineDash([]);
                // arrow label
                ctx.globalAlpha = 0.9; ctx.fillStyle = '#8e44ad';
                ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
                ctx.fillText('◄ eje Y ►', OX, 6);
            } else if (sim === 'impar') {
                // shade Q1+Q3 in coral
                ctx.globalAlpha = 0.10; ctx.fillStyle = '#e74c3c';
                ctx.fillRect(OX, 0, CS - OX, OY);   // Q1
                ctx.fillRect(0, OY, OX, CS - OY);   // Q3
                // diagonal axis of rotation
                ctx.globalAlpha = 0.5; ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 2;
                ctx.setLineDash([6, 4]);
                ctx.beginPath(); ctx.moveTo(OX - CS * 0.42, OY + CS * 0.42); ctx.lineTo(OX + CS * 0.42, OY - CS * 0.42); ctx.stroke();
                ctx.setLineDash([]);
                // circle at origin
                ctx.globalAlpha = 0.9;
                ctx.beginPath(); ctx.arc(OX, OY, 6, 0, Math.PI * 2);
                ctx.fillStyle = '#e74c3c'; ctx.fill();
                // label
                ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                ctx.fillText('↺ 180°', OX + 9, 6);
            }
            ctx.restore();
        }

        // Periódica — rectángulo base=T, altura=recorrido
        if (has('periodica')) {
            const perStr = caracteristicas.periodica?.correcta || '';
            const tMatch = perStr.match(/T=([^,\s]+)/i);
            if (tMatch) {
                const T = parsePeriod(tMatch[1]);
                if (T && T > 0) {
                    const recIvs = parseIntervals(caracteristicas.recorrido?.correcta || '');
                    let yMin = -range, yMax = range;
                    if (recIvs.length > 0) {
                        const allA = recIvs.map(iv => iv.a).filter(v => isFinite(v));
                        const allB = recIvs.map(iv => iv.b).filter(v => isFinite(v));
                        if (allA.length) yMin = Math.min(...allA);
                        if (allB.length) yMax = Math.max(...allB);
                    }
                    const rx1 = cx_(0), rx2 = Math.min(CS, cx_(T));
                    const ry1 = Math.max(0, cy_(yMax)), ry2 = Math.min(CS, cy_(yMin));
                    ctx.save();
                    ctx.globalAlpha = 0.18; ctx.fillStyle = '#1abc9c';
                    ctx.fillRect(rx1, ry1, rx2 - rx1, ry2 - ry1);
                    ctx.globalAlpha = 0.75; ctx.strokeStyle = '#16a085'; ctx.lineWidth = 2.5;
                    ctx.setLineDash([6, 4]);
                    ctx.strokeRect(rx1, ry1, rx2 - rx1, ry2 - ry1);
                    ctx.setLineDash([]);
                    // period label below x axis
                    ctx.globalAlpha = 0.95; ctx.fillStyle = '#16a085';
                    ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
                    ctx.fillText('T', (rx1 + rx2) / 2, Math.min(CS - 16, ry2 + 4));
                    // arrow markers at x=0 and x=T on the bottom
                    const arrowY = Math.min(CS - 4, ry2 + 14);
                    ctx.lineWidth = 1.5; ctx.globalAlpha = 0.8;
                    ctx.beginPath(); ctx.moveTo(rx1, arrowY); ctx.lineTo(rx2, arrowY); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(rx1, arrowY - 4); ctx.lineTo(rx1, arrowY + 4); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(rx2, arrowY - 4); ctx.lineTo(rx2, arrowY + 4); ctx.stroke();
                    ctx.restore();
                }
            }
        }

        // ── Axes ──
        ctx.strokeStyle='#2c3e50'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(0,OY); ctx.lineTo(CS,OY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(OX,0); ctx.lineTo(OX,CS); ctx.stroke();
        ctx.fillStyle='#2c3e50';
        ctx.beginPath(); ctx.moveTo(CS,OY); ctx.lineTo(CS-10,OY-5); ctx.lineTo(CS-10,OY+5); ctx.fill();
        ctx.beginPath(); ctx.moveTo(OX,0); ctx.lineTo(OX-5,10); ctx.lineTo(OX+5,10); ctx.fill();
        ctx.fillStyle='#7f8c8d'; ctx.font='11px Arial'; ctx.textAlign='center';
        for (let v=-range+1; v<=range-1; v++) {
            if(v===0) continue;
            ctx.fillText(v, cx_(v), OY+14);
            ctx.textAlign='right'; ctx.fillText(v, OX-4, cy_(v)+4); ctx.textAlign='center';
        }

        // ── Curve ──
        ctx.strokeStyle='#e74c3c'; ctx.lineWidth=2.5; ctx.beginPath();
        let prevY=null;
        for (let px=0; px<=CS; px++) {
            const mx=(px-OX)/SCALE, my=fn(mx);
            if(my===null||isNaN(my)||!isFinite(my)){ctx.stroke();ctx.beginPath();prevY=null;continue;}
            const py=cy_(my);
            if(prevY!==null&&Math.abs(py-prevY)>CS/2){ctx.stroke();ctx.beginPath();ctx.moveTo(px,py);}
            else{if(prevY===null)ctx.moveTo(px,py);else ctx.lineTo(px,py);}
            prevY=py;
        }
        ctx.stroke();

        // ── POINT HIGHLIGHTS (on top of curve) ──

        // Cortes — puntos amarillos
        if (has('cortes')) {
            const pts = parsePoints(caracteristicas.cortes?.correcta || '');
            ctx.save();
            for (const {x,y} of pts) {
                const px=cx_(x), py=cy_(y);
                if(px<0||px>CS||py<0||py>CS) continue;
                ctx.beginPath(); ctx.arc(px,py,9,0,Math.PI*2);
                ctx.globalAlpha=0.85; ctx.fillStyle='#f1c40f'; ctx.fill();
                ctx.globalAlpha=1; ctx.strokeStyle='#e67e22'; ctx.lineWidth=2; ctx.stroke();
                ctx.fillStyle='#7d4c00'; ctx.font='bold 9px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
                ctx.globalAlpha=1; ctx.fillText('✕',px,py);
            }
            ctx.restore();
        }

        // Extremos — verde (máx) y rojo (mín)
        if (has('extremos')) {
            const pts = parseExtrema(caracteristicas.extremos?.correcta || '');
            ctx.save();
            for (const {x,y,type} of pts) {
                const px=cx_(x), py=cy_(y);
                if(px<-10||px>CS+10||py<-10||py>CS+10) continue;
                ctx.beginPath(); ctx.arc(px,py,10,0,Math.PI*2);
                ctx.globalAlpha=0.88;
                ctx.fillStyle = type==='max' ? '#2ecc71' : '#e74c3c'; ctx.fill();
                ctx.globalAlpha=1;
                ctx.strokeStyle = type==='max' ? '#27ae60' : '#c0392b'; ctx.lineWidth=2.5; ctx.stroke();
                ctx.fillStyle='white'; ctx.font='bold 10px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
                ctx.fillText(type==='max'?'▲':'▼',px,py);
            }
            ctx.restore();
        }

    }, [fn, range, highlights, caracteristicas]);
    return <canvas ref={canvasRef} width={CS} height={CS} style={{borderRadius:8,border:'2px solid #bdc3c7',boxShadow:'0 4px 10px rgba(0,0,0,0.1)',background:'white',maxWidth:'100%'}}/>;
}

// ─── MODAL ENVIAR AL PROFESOR (estilo Funciones2) ─────────────────────────────
function ModalEnviarProfe({ datos, onClose }) {
    const [nombre,   setNombre]   = useState('');
    const [curso,    setCurso]    = useState('');
    const [codigo,   setCodigo]   = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado,  setEnviado]  = useState(false);
    const [error,    setError]    = useState('');
    const inp = { padding:'9px 12px', borderRadius:9, border:'1.5px solid #e0e4f0', fontSize:'0.9rem', outline:'none', width:'100%', boxSizing:'border-box', fontFamily:'inherit' };
    const enviar = async () => {
        const code = codigo.trim().toUpperCase();
        if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
        if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const snap = await getDoc(doc(db, 'codigos_profesor', code));
            if (!snap.exists()) { setError('Código de profesor no encontrado.'); setEnviando(false); return; }
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'FUNCIONES_ANALISIS',
                modalidad: 'Individual',
                fecha: new Date(),
                codigoProfesor: code,
                jugadores: [{ nombre: nombre.trim(), curso: curso.trim(), porcentaje: datos.porcentaje, tipoEjercicio: datos.tipoFuncion, idFuncion: datos.idFuncion, puntos: datos.porcentaje }],
            });
            setEnviado(true);
        } catch(e) { setError('Error al enviar: ' + e.message); }
        setEnviando(false);
    };
    return (
        <div style={{position:'fixed',inset:0,zIndex:3000,background:'rgba(8,12,24,0.85)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,backdropFilter:'blur(4px)'}}>
            <div style={{background:'white',borderRadius:20,width:'100%',maxWidth:380,boxShadow:'0 30px 80px rgba(0,0,0,0.5)',padding:'26px 28px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
                    <h3 style={{margin:0,color:'#2c3e50',fontSize:'1.1rem'}}>📤 Enviar resultados al profesor</h3>
                    <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'#95a5a6',fontSize:'1.2rem'}}>✕</button>
                </div>
                {enviado ? (
                    <div style={{textAlign:'center',padding:'20px 0'}}>
                        <CheckCircle size={48} color="#27ae60" style={{marginBottom:10}}/>
                        <div style={{color:'#27ae60',fontWeight:700,fontSize:'1.05rem'}}>¡Informe enviado!</div>
                        <div style={{marginTop:8,fontSize:'1.6rem',fontWeight:900,color:datos.porcentaje===100?'#27ae60':datos.porcentaje>=50?'#e67e22':'#e74c3c'}}>{datos.porcentaje}%</div>
                        <div style={{color:'#7f8c8d',fontSize:'0.82rem',marginTop:4}}>Función #{datos.idFuncion} · {datos.tipoFuncion}</div>
                        <button onClick={onClose} style={{marginTop:12,padding:'9px 22px',borderRadius:10,border:'none',background:'#f0f0f0',cursor:'pointer',fontFamily:'inherit'}}>Cerrar</button>
                    </div>
                ) : (
                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                        <div><label style={{fontSize:'0.78rem',color:'#7f8c8d',fontWeight:600,display:'block',marginBottom:4}}>Nombre y apellido</label>
                            <input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Tu nombre completo" style={inp} onFocus={e=>e.target.style.borderColor='#3498db'} onBlur={e=>e.target.style.borderColor='#e0e4f0'}/></div>
                        <div><label style={{fontSize:'0.78rem',color:'#7f8c8d',fontWeight:600,display:'block',marginBottom:4}}>Curso</label>
                            <input value={curso} onChange={e=>setCurso(e.target.value)} placeholder="Ej: 3º ESO A" style={inp} onFocus={e=>e.target.style.borderColor='#3498db'} onBlur={e=>e.target.style.borderColor='#e0e4f0'}/></div>
                        <div style={{background:'#f8f9fa',borderRadius:10,padding:'9px 12px',fontSize:'0.82rem',color:'#555'}}>
                            Función <strong>#{datos.idFuncion}</strong> ({datos.tipoFuncion}) — <strong>{datos.porcentaje}%</strong>
                        </div>
                        <div><label style={{fontSize:'0.78rem',color:'#7f8c8d',fontWeight:600,display:'block',marginBottom:4}}>Código del profesor</label>
                            <input value={codigo} onChange={e=>setCodigo(e.target.value.toUpperCase())} placeholder="Ej: PROF01" maxLength={10} style={{...inp,letterSpacing:2,fontWeight:700}} onFocus={e=>e.target.style.borderColor='#3498db'} onBlur={e=>e.target.style.borderColor='#e0e4f0'}/></div>
                        {error && <div style={{color:'#e74c3c',fontSize:'0.8rem'}}>⚠ {error}</div>}
                        <div style={{display:'flex',gap:9,marginTop:4}}>
                            <button onClick={onClose} style={{flex:1,padding:'10px',borderRadius:10,border:'1px solid #ddd',background:'white',cursor:'pointer',fontFamily:'inherit',color:'#555'}}>Cancelar</button>
                            <button onClick={enviar} disabled={enviando} style={{flex:2,padding:'10px',borderRadius:10,border:'none',background:enviando?'#95a5a6':'linear-gradient(135deg,#3498db,#2980b9)',color:'white',fontWeight:700,cursor:enviando?'default':'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:7,opacity:enviando?.7:1}}>
                                <Send size={15}/>{enviando?'Enviando…':'Enviar'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── MODAL ENVIAR A REVISIÓN (requiere login Google) ─────────────────────────
function ModalRevision({ idFuncion, tipoFuncion, onClose }) {
    const [usuario,   setUsuario]   = useState(null);
    const [mensaje,   setMensaje]   = useState('');
    const [enviando,  setEnviando]  = useState(false);
    const [enviado,   setEnviado]   = useState(false);
    const [error,     setError]     = useState('');
    const [loadingAuth, setLoadingAuth] = useState(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, u => setUsuario(u));
        return () => unsub();
    }, []);

    const loginGoogle = async () => {
        setLoadingAuth(true); setError('');
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch(e) { setError('Error al iniciar sesión: ' + e.message); }
        setLoadingAuth(false);
    };

    const enviarRevision = async () => {
        if (!mensaje.trim()) { setError('Escribe un mensaje describiendo el problema.'); return; }
        setEnviando(true); setError('');
        try {
            await addDoc(collection(db, 'revisiones_funciones'), {
                idFuncion,
                tipoFuncion,
                mensaje: mensaje.trim(),
                usuario: { email: usuario.email, nombre: usuario.displayName, uid: usuario.uid },
                destinatario: 'goladen@gmail.com',
                fecha: new Date(),
                estado: 'pendiente',
            });
            setEnviado(true);
        } catch(e) { setError('Error al enviar: ' + e.message); }
        setEnviando(false);
    };

    const inp = { padding:'9px 12px', borderRadius:9, border:'1.5px solid #e0e4f0', fontSize:'0.9rem', outline:'none', width:'100%', boxSizing:'border-box', fontFamily:'inherit' };

    return (
        <div style={{position:'fixed',inset:0,zIndex:3000,background:'rgba(8,12,24,0.85)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,backdropFilter:'blur(4px)'}}>
            <div style={{background:'white',borderRadius:20,width:'100%',maxWidth:400,boxShadow:'0 30px 80px rgba(0,0,0,0.5)',padding:'26px 28px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
                    <h3 style={{margin:0,color:'#2c3e50',fontSize:'1.1rem'}}>🔍 Enviar a revisión</h3>
                    <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'#95a5a6',fontSize:'1.2rem'}}>✕</button>
                </div>

                {enviado ? (
                    <div style={{textAlign:'center',padding:'20px 0'}}>
                        <CheckCircle size={48} color="#27ae60" style={{marginBottom:10}}/>
                        <div style={{color:'#27ae60',fontWeight:700,fontSize:'1.05rem'}}>¡Revisión enviada!</div>
                        <div style={{color:'#7f8c8d',fontSize:'0.82rem',marginTop:6}}>Función #{idFuncion} marcada para revisión</div>
                        <button onClick={onClose} style={{marginTop:14,padding:'9px 22px',borderRadius:10,border:'none',background:'#f0f0f0',cursor:'pointer',fontFamily:'inherit'}}>Cerrar</button>
                    </div>
                ) : !usuario ? (
                    <div style={{textAlign:'center'}}>
                        <div style={{background:'#fff8e1',borderRadius:12,padding:'14px',marginBottom:18,fontSize:'0.85rem',color:'#7d5a00',border:'1px solid #ffe082'}}>
                            <AlertTriangle size={16} style={{verticalAlign:'middle',marginRight:6}}/>
                            Para enviar una revisión necesitas identificarte con Google.
                        </div>
                        <div style={{color:'#7f8c8d',fontSize:'0.82rem',marginBottom:16}}>Función <strong>#{idFuncion}</strong> · {tipoFuncion}</div>
                        <button onClick={loginGoogle} disabled={loadingAuth} style={{width:'100%',padding:'12px',borderRadius:12,border:'1.5px solid #ddd',background:loadingAuth?'#f5f5f5':'white',cursor:loadingAuth?'default':'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:10,fontSize:'0.95rem',fontWeight:600}}>
                            <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                            {loadingAuth ? 'Iniciando…' : 'Continuar con Google'}
                        </button>
                        {error && <div style={{color:'#e74c3c',fontSize:'0.8rem',marginTop:10}}>⚠ {error}</div>}
                        <button onClick={onClose} style={{marginTop:10,width:'100%',padding:'9px',borderRadius:10,border:'1px solid #ddd',background:'white',cursor:'pointer',fontFamily:'inherit',color:'#555'}}>Cancelar</button>
                    </div>
                ) : (
                    <div style={{display:'flex',flexDirection:'column',gap:12}}>
                        <div style={{display:'flex',alignItems:'center',gap:10,background:'#f0f9f4',borderRadius:10,padding:'10px 12px'}}>
                            {usuario.photoURL && <img src={usuario.photoURL} alt="" style={{width:30,height:30,borderRadius:'50%'}}/>}
                            <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:'0.85rem',fontWeight:600,color:'#2c3e50',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{usuario.displayName}</div>
                                <div style={{fontSize:'0.72rem',color:'#7f8c8d',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{usuario.email}</div>
                            </div>
                        </div>
                        <div style={{background:'#f8f9fa',borderRadius:10,padding:'9px 12px',fontSize:'0.82rem',color:'#555'}}>
                            Función <strong>#{idFuncion}</strong> · {tipoFuncion}
                        </div>
                        <div>
                            <label style={{fontSize:'0.78rem',color:'#7f8c8d',fontWeight:600,display:'block',marginBottom:4}}>¿Qué crees que está mal?</label>
                            <textarea value={mensaje} onChange={e=>setMensaje(e.target.value)} placeholder="Ej: El dominio debería ser... / El extremo indicado no es correcto porque..."
                                rows={4} style={{...inp,resize:'vertical',lineHeight:1.5}}
                                onFocus={e=>e.target.style.borderColor='#e67e22'} onBlur={e=>e.target.style.borderColor='#e0e4f0'}/>
                        </div>
                        {error && <div style={{color:'#e74c3c',fontSize:'0.8rem'}}>⚠ {error}</div>}
                        <div style={{display:'flex',gap:9}}>
                            <button onClick={onClose} style={{flex:1,padding:'10px',borderRadius:10,border:'1px solid #ddd',background:'white',cursor:'pointer',fontFamily:'inherit',color:'#555'}}>Cancelar</button>
                            <button onClick={enviarRevision} disabled={enviando} style={{flex:2,padding:'10px',borderRadius:10,border:'none',background:enviando?'#95a5a6':'linear-gradient(135deg,#e67e22,#d35400)',color:'white',fontWeight:700,cursor:enviando?'default':'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:7,opacity:enviando?.7:1}}>
                                <AlertTriangle size={15}/>{enviando?'Enviando…':'Enviar revisión'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── SELECTOR DE TIPO ─────────────────────────────────────────────────────────
function SelectorTipo({ onStart, onBack }) {
    const tipos = ['Todas', ...new Set(FUNCIONES_DB.map(f => f.tipo))];
    const [tipoSel, setTipoSel] = useState('Todas');
    const [modo, setModo] = useState('opciones');
    const btnT = (t) => ({ padding:'9px 16px', borderRadius:20, border:`2px solid ${tipoSel===t?'#3498db':'#bdc3c7'}`, background:tipoSel===t?'#3498db':'white', color:tipoSel===t?'white':'#2c3e50', cursor:'pointer', fontWeight:tipoSel===t?700:400, fontFamily:'inherit', fontSize:'0.88rem' });
    const btnM = (m) => ({ padding:'12px 20px', borderRadius:12, border:`2px solid ${modo===m?'#27ae60':'#bdc3c7'}`, background:modo===m?'#27ae60':'white', color:modo===m?'white':'#2c3e50', cursor:'pointer', fontWeight:700, fontFamily:'inherit', display:'flex', alignItems:'center', gap:8 });
    return (
        <div style={{background:'white',borderRadius:20,padding:'32px 28px',maxWidth:560,width:'100%',boxShadow:'0 8px 30px rgba(0,0,0,0.08)',textAlign:'center'}}>
            <h2 style={{color:'#2c3e50',marginBottom:22}}>📐 Características desde gráfica</h2>
            <div style={{marginBottom:20}}>
                <p style={{color:'#7f8c8d',marginBottom:10,fontSize:'0.88rem'}}>Tipo de función:</p>
                <div style={{display:'flex',flexWrap:'wrap',gap:7,justifyContent:'center'}}>
                    {tipos.map(t => <button key={t} style={btnT(t)} onClick={() => setTipoSel(t)}>{t}</button>)}
                </div>
            </div>
            <div style={{marginBottom:24}}>
                <p style={{color:'#7f8c8d',marginBottom:10,fontSize:'0.88rem'}}>Modo:</p>
                <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                    <button style={btnM('opciones')} onClick={() => setModo('opciones')}><List size={17}/> Elegir opciones</button>
                    <button style={btnM('escritura')} onClick={() => setModo('escritura')}><Edit3 size={17}/> Escribir respuesta</button>
                </div>
            </div>
            <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                {onBack && <button onClick={onBack} style={{padding:'11px 18px',borderRadius:10,border:'2px solid #bdc3c7',background:'white',cursor:'pointer',fontFamily:'inherit'}}>← Volver</button>}
                <button onClick={() => onStart(tipoSel, modo==='escritura')} style={{padding:'11px 26px',borderRadius:10,border:'none',background:'#3498db',color:'white',cursor:'pointer',fontWeight:700,fontSize:'1rem',fontFamily:'inherit'}}>
                    Empezar →
                </button>
            </div>
        </div>
    );
}

// ─── HELPERS DE EVALUACIÓN ────────────────────────────────────────────────────
const norm = s => String(s||'').replace(/\s+/g,'').toLowerCase();

// Extrae números de un string
const extractNumbers = s => (s.match(/-?\d+\.?\d*/g)||[]).map(Number);

// Comparación con tolerancia ±0.3 para modo escritura
const compareConTolerance = (userStr, correctStr) => {
    const u = norm(userStr), c = norm(correctStr);
    if (u === c) return true;
    // Comparar estructura no-numérica + números con tolerancia
    const uNums = extractNumbers(u);
    const cNums = extractNumbers(c);
    if (uNums.length === 0 && cNums.length === 0) return false;
    if (uNums.length !== cNums.length) return false;
    // Check non-numeric parts match
    const uTemplate = u.replace(/-?\d+\.?\d*/g, '#');
    const cTemplate = c.replace(/-?\d+\.?\d*/g, '#');
    if (uTemplate !== cTemplate) return false;
    // Check all numbers within tolerance
    return uNums.every((n, i) => Math.abs(n - cNums[i]) <= 0.3);
};

const extractCrece = s => { const m=s.match(/C:\s*(.+?)(?:\s+D:|$)/); return m?m[1].trim():''; };
const extractDecrece = s => { const m=s.match(/D:\s*(.+?)$/); return m?m[1].trim():''; };
const extractMax = s => { const parts=s.split(/(?=M[íi]n)/); const seg=parts[0]; const m=seg.match(/M[áa]x[^M]*/); return m?m[0].trim():'No tiene'; };
const extractMin = s => { const m=s.match(/M[íi]n[^M]*/g); return m?m.join(' ').trim():'No tiene'; };

// ─── EJERCICIO ────────────────────────────────────────────────────────────────
function AnalisisFuncion({ modoEscritura, tipoSeleccionado, idInicial, onVolver }) {
    const dbFiltrada = tipoSeleccionado === 'Todas' ? FUNCIONES_DB : FUNCIONES_DB.filter(f => f.tipo === tipoSeleccionado);
    const [lista] = useState(() => {
        if (idInicial) {
            const fn = FUNCIONES_DB.find(f => f.id === idInicial);
            const resto = [...dbFiltrada.filter(f=>f.id!==idInicial)].sort(()=>Math.random()-0.5);
            return fn ? [fn, ...resto] : [...dbFiltrada].sort(()=>Math.random()-0.5);
        }
        return [...dbFiltrada].sort(()=>Math.random()-0.5);
    });
    const [idx,setIdx]             = useState(0);
    const [resp,setRespRaw]        = useState({});
    const [evaluado,setEvaluado]   = useState(false);
    const [nota,setNota]           = useState(0);
    const [activeInput,setActive]  = useState(null);
    const [mostrarEnvio,setMostrarEnvio]   = useState(false);
    const [mostrarRevision,setMostrarRevision] = useState(false);
    const [highlights, setHighlights] = useState([]);
    const inputRefs = useRef({});
    // Shuffle options once per function (stable across re-renders)
    const shuffledOptsRef = useRef({});
    if (!lista.length) return <div style={{color:'#2c3e50',textAlign:'center',padding:50}}>No hay funciones de este tipo.</div>;
    const fnData = lista[idx];
    const keys   = Object.keys(fnData.caracteristicas);
    const setR   = (k,v) => !evaluado && setRespRaw(p=>({...p,[k]:v}));

    const getUserAnswer = (k) => {
        if (k==='simetria') return norm(resp.simetria||'');
        if (k==='periodica') {
            if (!resp.periodica_es) return 'no';
            return norm('si,t='+(resp.periodica_periodo||''));
        }
        if (k==='monotonia') return norm('c:'+(resp.monotonia_crece||'')+'d:'+(resp.monotonia_decrece||''));
        if (k==='extremos') {
            const mx=norm(resp.extremos_max||'')||'notiene';
            const mn=norm(resp.extremos_min||'')||'notiene';
            return mx+'|'+mn;
        }
        return norm(resp[k]||'');
    };
    const getRealAnswer = (k) => {
        const c=fnData.caracteristicas[k].correcta;
        if (k==='periodica') {
            if (norm(c)==='no') return 'no';
            const m=c.match(/T=(.+)/i);
            return norm('si,t='+(m?m[1]:''));
        }
        if (k==='monotonia') return norm('c:'+extractCrece(c)+'d:'+extractDecrece(c));
        if (k==='extremos') return norm(extractMax(c))+'|'+norm(extractMin(c));
        return norm(c);
    };
    const isAnswerCorrect = (k) => {
        // continua uses radio buttons in both modes
        if (k==='continua') return norm(resp.continua||'') === norm(fnData.caracteristicas.continua.correcta);
        if (!modoEscritura) return norm(resp[k]||'') === norm(fnData.caracteristicas[k].correcta);
        const userAns = getUserAnswer(k);
        const realAns = getRealAnswer(k);
        if (userAns === realAns) return true;
        return compareConTolerance(userAns, realAns);
    };

    const comprobar = () => {
        let ok=0;
        keys.forEach(k => { if (isAnswerCorrect(k)) ok++; });
        setNota(Math.round(ok/keys.length*100));
        setEvaluado(true);
    };
    const siguiente = () => { setRespRaw({}); setEvaluado(false); setActive(null); shuffledOptsRef.current={}; setHighlights([]); setIdx(p=>(p+1)%lista.length); };

    const insertSymbol = (sym) => {
        const targetKey = activeInput || keys.find(k=>!['simetria','periodica'].includes(k)) || keys[0];
        const input = inputRefs.current[targetKey];
        if (!input) return;
        const s=input.selectionStart||0, e=input.selectionEnd||0;
        const cur=resp[targetKey]||'';
        setRespRaw(p=>({...p,[targetKey]:cur.slice(0,s)+sym+cur.slice(e)}));
        setTimeout(()=>{input.focus();input.setSelectionRange(s+sym.length,s+sym.length);},0);
    };

    const renderCampo = (k) => {
        const data = fnData.caracteristicas[k];
        const isOk = evaluado && isAnswerCorrect(k);
        const bdr = evaluado ? (isOk?'#2ecc71':'#e74c3c') : '#bdc3c7';
        const inpSt = {width:'100%',boxSizing:'border-box',padding:'7px 10px',borderRadius:6,border:`2px solid ${bdr}`,outline:'none',fontFamily:'monospace',fontSize:'0.88rem',marginBottom:2};

        if (k==='simetria' && modoEscritura) {
            return (<div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:4}}>
                {['Par','Impar','Sin simetría'].map(op => {
                    const sel=resp.simetria===op, correct=evaluado&&op===data.correcta, wrong=evaluado&&sel&&op!==data.correcta;
                    return (<label key={op} style={{display:'flex',alignItems:'center',gap:5,cursor:evaluado?'default':'pointer',padding:'6px 12px',borderRadius:20,border:`2px solid ${correct?'#2ecc71':wrong?'#e74c3c':sel?'#3498db':'#ddd'}`,background:correct?'#eafaf1':wrong?'#fdecea':sel?'#eaf4fd':'white',fontWeight:sel||correct?600:400,fontSize:'0.88rem'}}>
                        <input type="radio" name={`simetria_${idx}`} value={op} checked={sel} onChange={()=>setR('simetria',op)} disabled={evaluado} style={{accentColor:'#3498db'}}/>{op}</label>);
                })}
                {evaluado&&!isOk&&<div style={{fontSize:'0.78rem',color:'#e74c3c',width:'100%'}}>Correcto: {data.correcta}</div>}
            </div>);
        }
        if (k==='periodica' && modoEscritura) {
            const esPer=!!resp.periodica_es;
            return (<div style={{marginTop:4}}>
                <div style={{display:'flex',gap:14,marginBottom:8,flexWrap:'wrap'}}>
                    {[{v:false,l:'No periódica'},{v:true,l:'Periódica'}].map(({v,l}) => {
                        const sel=esPer===v;
                        return (<label key={l} style={{display:'flex',alignItems:'center',gap:6,cursor:evaluado?'default':'pointer',padding:'6px 12px',borderRadius:20,border:`2px solid ${sel?'#3498db':'#ddd'}`,background:sel?'#eaf4fd':'white',fontWeight:sel?600:400,fontSize:'0.88rem'}}>
                            <input type="radio" name={`periodica_${idx}`} checked={sel} onChange={()=>setR('periodica_es',v)} disabled={evaluado} style={{accentColor:'#3498db'}}/>{l}</label>);
                    })}
                </div>
                {esPer && (<div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontStyle:'italic',color:'#555',fontSize:'0.9rem'}}>T =</span>
                    <input ref={el=>inputRefs.current['periodica_periodo']=el} onFocus={()=>setActive('periodica_periodo')}
                        type="text" value={resp.periodica_periodo||''} onChange={e=>setR('periodica_periodo',e.target.value)}
                        disabled={evaluado} placeholder="ej: 2π" style={{...inpSt,width:100,marginBottom:0,border:`2px solid ${bdr}`}}/>
                </div>)}
                {evaluado&&!isOk&&<div style={{fontSize:'0.78rem',color:'#e74c3c',marginTop:4}}>Correcto: {data.correcta}</div>}
            </div>);
        }
        if (k==='monotonia' && modoEscritura) {
            return (<div style={{display:'flex',flexDirection:'column',gap:6,marginTop:4}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <span style={{fontWeight:700,color:'#27ae60',minWidth:68,fontSize:'0.82rem',flexShrink:0}}>📈 Crece:</span>
                    <input ref={el=>inputRefs.current['monotonia_crece']=el} onFocus={()=>setActive('monotonia_crece')}
                        type="text" value={resp.monotonia_crece||''} onChange={e=>setR('monotonia_crece',e.target.value)}
                        disabled={evaluado} placeholder="(-∞, 0)" style={{...inpSt,flex:1,marginBottom:0,border:`2px solid ${bdr}`}}/>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <span style={{fontWeight:700,color:'#e74c3c',minWidth:68,fontSize:'0.82rem',flexShrink:0}}>📉 Decrece:</span>
                    <input ref={el=>inputRefs.current['monotonia_decrece']=el} onFocus={()=>setActive('monotonia_decrece')}
                        type="text" value={resp.monotonia_decrece||''} onChange={e=>setR('monotonia_decrece',e.target.value)}
                        disabled={evaluado} placeholder="(0, ∞)" style={{...inpSt,flex:1,marginBottom:0,border:`2px solid ${bdr}`}}/>
                </div>
                {evaluado&&!isOk&&<div style={{fontSize:'0.78rem',color:'#e74c3c'}}>Crece: {extractCrece(data.correcta)} / Decrece: {extractDecrece(data.correcta)}</div>}
            </div>);
        }
        if (k==='extremos' && modoEscritura) {
            return (<div style={{display:'flex',flexDirection:'column',gap:6,marginTop:4}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <span style={{fontWeight:700,color:'#8e44ad',minWidth:74,fontSize:'0.82rem',flexShrink:0}}>🔺 Máximos:</span>
                    <input ref={el=>inputRefs.current['extremos_max']=el} onFocus={()=>setActive('extremos_max')}
                        type="text" value={resp.extremos_max||''} onChange={e=>setR('extremos_max',e.target.value)}
                        disabled={evaluado} placeholder="vacío = no tiene" style={{...inpSt,flex:1,marginBottom:0,border:`2px solid ${bdr}`}}/>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <span style={{fontWeight:700,color:'#d35400',minWidth:74,fontSize:'0.82rem',flexShrink:0}}>🔻 Mínimos:</span>
                    <input ref={el=>inputRefs.current['extremos_min']=el} onFocus={()=>setActive('extremos_min')}
                        type="text" value={resp.extremos_min||''} onChange={e=>setR('extremos_min',e.target.value)}
                        disabled={evaluado} placeholder="vacío = no tiene" style={{...inpSt,flex:1,marginBottom:0,border:`2px solid ${bdr}`}}/>
                </div>
                {evaluado&&!isOk&&<div style={{fontSize:'0.78rem',color:'#e74c3c'}}>Máx: {extractMax(data.correcta)} / Mín: {extractMin(data.correcta)}</div>}
            </div>);
        }
        if (k==='continua') {
            // Binary choice — same rendering in both modes
            return (<div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:4}}>
                {['Sí','No'].map(op => {
                    const sel=resp.continua===op, correct=evaluado&&op===data.correcta, wrong=evaluado&&sel&&op!==data.correcta;
                    return (<label key={op} style={{display:'flex',alignItems:'center',gap:5,cursor:evaluado?'default':'pointer',padding:'6px 18px',borderRadius:20,border:`2px solid ${correct?'#2ecc71':wrong?'#e74c3c':sel?'#3498db':'#ddd'}`,background:correct?'#eafaf1':wrong?'#fdecea':sel?'#eaf4fd':'white',fontWeight:sel||correct?600:400,fontSize:'0.88rem'}}>
                        <input type="radio" name={`continua_${idx}`} value={op} checked={sel} onChange={()=>setR('continua',op)} disabled={evaluado} style={{accentColor:'#3498db'}}/>{op}
                    </label>);
                })}
                {evaluado&&!isOk&&<div style={{fontSize:'0.78rem',color:'#e74c3c',width:'100%'}}>Correcto: {data.correcta}</div>}
            </div>);
        }
        if (modoEscritura) {
            return (<div>
                <input ref={el=>inputRefs.current[k]=el} onFocus={()=>setActive(k)}
                    type="text" value={resp[k]||''} onChange={e=>setR(k,e.target.value)}
                    disabled={evaluado} placeholder="Ej: (-∞, 2] U [4, ∞)"
                    style={{...inpSt,border:`2px solid ${bdr}`}}/>
                {evaluado&&!isOk&&<div style={{fontSize:'0.78rem',color:'#e74c3c'}}>Correcto: {data.correcta}</div>}
            </div>);
        }
        // Deduplicate + barajar una vez por función (estable mientras se responde)
        if (!shuffledOptsRef.current[k]) {
            const pool = [data.correcta, ...data.incorrectas.filter(o => o !== data.correcta)];
            shuffledOptsRef.current[k] = pool.sort(() => Math.random() - 0.5);
        }
        const opciones = shuffledOptsRef.current[k];
        const seleccionoAlgo = resp[k] !== undefined;
        const acerto = evaluado && norm(resp[k]||'') === norm(data.correcta);

        
        return (<div style={{display:'flex',flexDirection:'column',gap:6}}>
            {opciones.map((op,i)=>{
                const sel=resp[k]===op, isC=evaluado&&op===data.correcta, isW=evaluado&&sel&&op!==data.correcta;
                let bg=sel?'#3498db':'#f8f9fa',col=sel?'white':'#2c3e50',border=sel?'#2980b9':'#dcdde1';
                if(evaluado){if(isC){bg='#2ecc71';col='white';border='#27ae60';}else if(isW){bg='#e74c3c';col='white';border='#c0392b';}}
                return (<button key={i} onClick={()=>!evaluado&&setRespRaw(p=>({...p,[k]:op}))} disabled={evaluado}
                    style={{padding:'7px 11px',borderRadius:8,border:`2px solid ${border}`,background:bg,color:col,cursor:evaluado?'default':'pointer',textAlign:'left',fontSize:'0.84rem',fontFamily:'monospace',transition:'all 0.15s'}}>{op}</button>);
            })}
                        {evaluado && !acerto && <div style={{fontSize:'0.78rem',color:'#e74c3c',marginTop:2}}>✗ {seleccionoAlgo ? 'Incorrecto.' : 'Sin respuesta.'} Correcto: <strong>{data.correcta}</strong></div>}

        </div>);
    };

    const keyLabel = {dominio:'Dominio',recorrido:'Recorrido (Im)',simetria:'Simetría',periodica:'Periodicidad',cortes:'Cortes con ejes',monotonia:'Monotonía',extremos:'Extremos relativos',continua:'Continuidad'};
    const keyIcon  = {dominio:'🎯',recorrido:'📊',simetria:'🔄',periodica:'🔁',cortes:'✂️',monotonia:'📈',extremos:'🏔️',continua:'〰️'};

    return (
        <div style={{width:'100%',maxWidth:1050,margin:'0 auto',display:'flex',gap:20,flexWrap:'wrap',justifyContent:'center'}}>
            {nota===100 && <Confetti recycle={false}/>}

            {/* Columna gráfica */}
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
                <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',justifyContent:'center'}}>
                    <span style={{background:'#2c3e50',color:'white',padding:'3px 10px',borderRadius:20,fontSize:'0.72rem',fontWeight:700,letterSpacing:0.5}}>#{fnData.id}</span>
                    <span style={{background:'#34495e',color:'white',padding:'4px 12px',borderRadius:20,fontSize:'0.78rem',fontWeight:'bold'}}>{fnData.tipo}</span>
                    <div style={{background:'#2c3e50',color:'white',padding:'10px 20px',borderRadius:8,fontSize:'1.15rem',fontFamily:'monospace',fontWeight:'bold',display:'flex',alignItems:'center',flexWrap:'wrap'}}>
                        {renderLatex(fnData.latex)}
                    </div>
                </div>
                <FunctionPlotter fn={fnData.fn} range={fnData.range} highlights={highlights} caracteristicas={fnData.caracteristicas}/>
                {modoEscritura && !evaluado && (
                    <div style={{background:'white',padding:'10px 14px',borderRadius:10,border:'1.5px solid #dde',display:'flex',flexWrap:'wrap',gap:8,justifyContent:'center'}}>
                        {['∞','-∞','U','∅','π','±','(',')','[',']'].map(s=>(
                            <button key={s} onMouseDown={e=>{e.preventDefault();insertSymbol(s);}}
                                style={{padding:'5px 10px',borderRadius:6,border:'1.5px solid #bdc3c7',cursor:'pointer',background:'#f8f9fa',fontWeight:'bold',fontSize:'1rem',minWidth:36}}>{s}</button>
                        ))}
                    </div>
                )}
                {/* Botones post-evaluación */}
                {evaluado && (() => {
                    const HIGHLIGHT_KEYS = [
                        { k:'dominio',   label:'Dominio',   color:'#2980b9' },
                        { k:'recorrido', label:'Recorrido', color:'#e91e8c' },
                        { k:'monotonia', label:'Monotonía', color:'#e67e22' },
                        { k:'cortes',    label:'Cortes',    color:'#f39c12' },
                        { k:'extremos',  label:'Extremos',  color:'#27ae60' },
                        { k:'simetria',  label:'Simetría',  color:'#8e44ad',
                          hidden: ['sin simetría','sin simetria'].includes((fnData.caracteristicas.simetria?.correcta||'').toLowerCase()) },
                        { k:'periodica', label:'Periódica', color:'#16a085',
                          hidden: !(fnData.caracteristicas.periodica?.correcta||'').match(/T=/i) },
                    ].filter(h => fnData.caracteristicas[h.k] && !h.hidden);
                    const toggle = (k) => setHighlights(prev => prev.includes(k) ? prev.filter(x=>x!==k) : [...prev, k]);
                    return (
                        <div style={{display:'flex',flexDirection:'column',gap:8,width:'100%',maxWidth:380,alignItems:'center'}}>
                            <div style={{fontSize:'0.75rem',color:'#95a5a6',fontWeight:600,letterSpacing:0.5}}>RESALTAR EN GRÁFICA</div>
                            <div style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'center'}}>
                                {HIGHLIGHT_KEYS.map(({k,label,color})=>{
                                    const active = highlights.includes(k);
                                    return (
                                        <button key={k} onClick={()=>toggle(k)}
                                            style={{padding:'7px 13px',borderRadius:20,border:`2px solid ${color}`,
                                                background: active ? color : 'white',
                                                color: active ? 'white' : color,
                                                fontWeight:700,cursor:'pointer',fontFamily:'inherit',fontSize:'0.8rem',
                                                transition:'all 0.15s',opacity: active ? 1 : 0.75}}>
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                            <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'center',marginTop:2}}>
                                <button onClick={()=>setMostrarEnvio(true)}
                                    style={{padding:'9px 16px',borderRadius:10,border:'none',background:'linear-gradient(135deg,#3498db,#2980b9)',color:'white',fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:7,fontSize:'0.85rem'}}>
                                    <Send size={14}/> Enviar al Profe
                                </button>
                                <button onClick={()=>setMostrarRevision(true)}
                                    style={{padding:'9px 16px',borderRadius:10,border:'1.5px solid #e67e22',background:'white',color:'#e67e22',fontWeight:700,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:7,fontSize:'0.85rem'}}>
                                    <AlertTriangle size={14}/> Revisar función
                                </button>
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* Columna preguntas */}
            <div style={{flex:1,minWidth:310,background:'white',padding:'18px 16px',borderRadius:14,boxShadow:'0 4px 15px rgba(0,0,0,0.06)',display:'flex',flexDirection:'column',gap:12}}>
            {keys.map(k=>{
                    const fieldOk = evaluado && isAnswerCorrect(k);
                    const fieldFail = evaluado && !isAnswerCorrect(k);
                    return (
                    <div key={k} style={{background: fieldFail?'#fff5f5': fieldOk?'#f0faf4':'#f8f9fa', padding:'11px 13px',borderRadius:10,border:`2px solid ${fieldFail?'#e74c3c':fieldOk?'#2ecc71':'#eee'}`}}>    
                        
                        <div style={{fontWeight:700,color:'#34495e',marginBottom:8,fontSize:'0.88rem',display:'flex',alignItems:'center',gap:5}}>
                            <span>{keyIcon[k]||'•'}</span><span>{keyLabel[k]||k}</span>
                        </div>
                        {renderCampo(k)}
                    </div>
                    );
                    })}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:6,paddingTop:12,borderTop:'2px dashed #eee'}}>
                    <button onClick={onVolver} style={{padding:'9px 18px',borderRadius:8,border:'none',background:'#95a5a6',color:'white',cursor:'pointer',fontWeight:'bold',fontFamily:'inherit',display:'flex',alignItems:'center',gap:5}}>
                        <ArrowLeft size={15}/> Cambiar
                    </button>
                    {!evaluado ? (
                        <button onClick={comprobar} style={{padding:'10px 24px',borderRadius:8,border:'none',background:'#27ae60',color:'white',cursor:'pointer',fontWeight:'bold',fontSize:'1rem',fontFamily:'inherit',display:'flex',alignItems:'center',gap:6}}>
                            <CheckCircle size={17}/> Comprobar
                        </button>
                    ) : (
                        <div style={{display:'flex',alignItems:'center',gap:14}}>
                            <div style={{fontSize:'1.4rem',fontWeight:'bold',color:nota>=70?'#27ae60':nota>=40?'#e67e22':'#e74c3c'}}>{nota}%</div>
                            <button onClick={siguiente} style={{padding:'10px 22px',borderRadius:8,border:'none',background:'#3498db',color:'white',cursor:'pointer',fontWeight:'bold',fontSize:'0.95rem',fontFamily:'inherit',display:'flex',alignItems:'center',gap:6}}>
                                Siguiente <RefreshCw size={16}/>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {mostrarEnvio && <ModalEnviarProfe datos={{porcentaje:nota, tipoFuncion:fnData.tipo, idFuncion:fnData.id}} onClose={()=>setMostrarEnvio(false)}/>}
            {mostrarRevision && <ModalRevision idFuncion={fnData.id} tipoFuncion={fnData.tipo} onClose={()=>setMostrarRevision(false)}/>}
        </div>
    );
}

// ─── PANTALLA PRINCIPAL ───────────────────────────────────────────────────────
export default function Funciones({ onExit }) {
    const [seccion,   setSeccion]   = useState(null);
    const [modoEsc,   setModoEsc]   = useState(false);
    const [tipo,      setTipo]      = useState('Todas');
    const [buscarId,  setBuscarId]  = useState('');
    const [idInicial, setIdInicial] = useState(null);
    const [errBusca,  setErrBusca]  = useState('');

    const buscarPorId = () => {
        const n = parseInt(buscarId.trim());
        if (isNaN(n)) { setErrBusca('Escribe un número válido'); return; }
        const fn = FUNCIONES_DB.find(f => f.id === n);
        if (!fn) { setErrBusca(`No existe la función #${n}`); return; }
        setErrBusca('');
        setIdInicial(n);
        setTipo('Todas');
        setSeccion('CARACTERISTICAS');
    };

    if (seccion === 'SELECTOR_TIPO') return (
        <div style={{minHeight:'100vh',background:'#f0f3fb',display:'flex',justifyContent:'center',alignItems:'center',padding:20}}>
            <SelectorTipo onStart={(t,esE)=>{setTipo(t);setModoEsc(esE);setIdInicial(null);setSeccion('CARACTERISTICAS');}} onBack={()=>setSeccion(null)}/>
        </div>
    );
    if (seccion === 'CARACTERISTICAS') return (
        <div style={{minHeight:'100vh',background:'#f0f3fb',padding:'20px 12px'}}>
            <AnalisisFuncion modoEscritura={modoEsc} tipoSeleccionado={tipo} idInicial={idInicial} onVolver={()=>{setSeccion('SELECTOR_TIPO');setIdInicial(null);}}/>
        </div>
    );

    return (
        <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#1a1a2e,#16213e)',display:'flex',justifyContent:'center',alignItems:'center',padding:20,fontFamily:"'Segoe UI',sans-serif"}}>
            <div style={{background:'rgba(255,255,255,0.05)',borderRadius:24,padding:'40px 32px',maxWidth:500,width:'100%',textAlign:'center',border:'1px solid rgba(255,255,255,0.1)'}}>
                <div style={{fontSize:'3rem',marginBottom:8}}>📐</div>
                <h1 style={{color:'white',fontSize:'1.8rem',margin:'0 0 10px',fontWeight:800}}>Análisis de Funciones</h1>
                <p style={{color:'rgba(255,255,255,0.6)',marginBottom:28,lineHeight:1.6}}>
                    Analiza dominio, recorrido, simetría, monotonía y extremos de <strong style={{color:'white'}}>{FUNCIONES_DB.length} funciones</strong> desde su gráfica.
                </p>

                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                    {/* Botón principal */}
                    <button onClick={()=>setSeccion('SELECTOR_TIPO')}
                        style={{padding:'16px 24px',borderRadius:14,border:'none',background:'#3498db',color:'white',fontWeight:700,fontSize:'1rem',cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
                        <Activity size={20}/> Características desde gráfica
                    </button>

                    {/* Buscar por ID */}
                    <div style={{background:'rgba(255,255,255,0.07)',borderRadius:14,padding:'14px 16px',border:'1px solid rgba(255,255,255,0.12)'}}>
                        <div style={{color:'rgba(255,255,255,0.7)',fontSize:'0.82rem',marginBottom:8,textAlign:'left',fontWeight:600}}>
                            <Search size={13} style={{verticalAlign:'middle',marginRight:5}}/>Buscar función por identificador
                        </div>
                        <div style={{display:'flex',gap:8}}>
                            <input value={buscarId} onChange={e=>{setBuscarId(e.target.value);setErrBusca('');}}
                                onKeyDown={e=>e.key==='Enter'&&buscarPorId()}
                                placeholder="Nº (1–100)" type="number" min="1" max="100"
                                style={{flex:1,padding:'9px 12px',borderRadius:10,border:`1.5px solid ${errBusca?'#e74c3c':'rgba(255,255,255,0.2)'}`,background:'rgba(255,255,255,0.1)',color:'white',outline:'none',fontFamily:'inherit',fontSize:'0.9rem'}}/>
                            <button onClick={()=>{setModoEsc(false);buscarPorId();}}
                                style={{padding:'9px 14px',borderRadius:10,border:'none',background:'rgba(52,152,219,0.6)',color:'white',cursor:'pointer',fontFamily:'inherit',fontSize:'0.82rem',fontWeight:600}}>
                                Opciones
                            </button>
                            <button onClick={()=>{setModoEsc(true);buscarPorId();}}
                                style={{padding:'9px 14px',borderRadius:10,border:'none',background:'rgba(39,174,96,0.6)',color:'white',cursor:'pointer',fontFamily:'inherit',fontSize:'0.82rem',fontWeight:600}}>
                                Escribir
                            </button>
                        </div>
                        {errBusca && <div style={{color:'#e74c3c',fontSize:'0.78rem',marginTop:6}}>{errBusca}</div>}
                    </div>

                    {onExit && <button onClick={onExit} style={{padding:'11px',borderRadius:14,border:'1.5px solid rgba(255,255,255,0.2)',background:'transparent',color:'rgba(255,255,255,0.6)',cursor:'pointer',fontFamily:'inherit'}}>← Volver</button>}
                </div>
            </div>
        </div>
    );
}
