import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dices, Trophy, Clock, RotateCcw, Play, AlertCircle, Send, CheckCircle, Share2 } from 'lucide-react';
import Confetti from 'react-confetti';
import { db } from './firebase';
import { guardarRegistroLocal } from './utils/registrosLocales';
import { collection, addDoc, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
// ─── Constantes ───────────────────────────────────────────────────────────────
const TOTAL    = 63;
const OCAS     = new Set([5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59]);
const PUENTE_A = 6, PUENTE_B = 12;
const CARCEL   = 19;
const CAVERNA  = 31;
const MUERTE   = 42;
const META     = TOTAL;

const COLORES_J = ['#e74c3c','#3498db','#2ecc71','#f39c12'];
const NOMBRES_F = ['🔴','🔵','🟢','🟡'];

// ─── Posiciones en espiral 8×8 ───────────────────────────────────────────────
// Casilla 0 = esquina inferior-izquierda. Recorre en espiral clockwise hacia el centro.
const SQUARE_POS = (() => {
    const pos = [];
    let top = 0, bottom = 7, left = 0, right = 7;
    while (pos.length < 64) {
        for (let c = left;  c <= right  && pos.length < 64; c++) pos.push({ col: c, row: bottom });
        bottom--;
        for (let r = bottom; r >= top   && pos.length < 64; r--) pos.push({ col: right, row: r });
        right--;
        if (top > bottom || left > right) break;
        for (let c = right; c >= left   && pos.length < 64; c--) pos.push({ col: c, row: top });
        top++;
        for (let r = top;   r <= bottom && pos.length < 64; r++) pos.push({ col: left, row: r });
        left++;
    }
    return pos;
})();

// ─── Matemáticas ──────────────────────────────────────────────────────────────
const gcd = (a, b) => b === 0 ? Math.abs(a) : gcd(b, a % b);
const simplify = (n, d) => {
    if (d === 0) return { n, d: 1, str: `${n}` };
    const g = gcd(Math.abs(n), Math.abs(d));
    let sn = n / g, sd = d / g;
    if (sd < 0) { sn = -sn; sd = -sd; }
    return { n: sn, d: sd, str: sd === 1 ? `${sn}` : `${sn}/${sd}` };
};
const fracStr = (n, d) => simplify(n, d).str;

const genBase = (modo) => {
    if (modo === 'NATURALES')  return { n: Math.floor(Math.random()*9)+2, d: 1 };
    if (modo === 'ENTEROS')    return { n: (Math.floor(Math.random()*9)+2)*(Math.random()>.5?1:-1), d: 1 };
    if (modo === 'DECIMALES')  return { n: Math.round((Math.random()*4+1)*10), d: 10 };
    if (modo === 'FRACCIONES') { const d=[2,3,4,5,6][Math.floor(Math.random()*5)]; return { n:Math.floor(Math.random()*(d-1))+1, d }; }
    return { n: 1, d: 1 };
};
const baseStr = (base, modo) => {
    if (modo === 'DECIMALES')  return (base.n/base.d).toFixed(1);
    if (modo === 'FRACCIONES') return fracStr(base.n, base.d);
    return `${base.n}`;
};

const OPS_POOLS = {
    NATURALES:  [{op:'+',val:3},{op:'+',val:5},{op:'-',val:2},{op:'×',val:2},{op:'+',val:4},{op:'-',val:3},{op:'×',val:3},{op:'+',val:7},{op:'-',val:1},{op:'×',val:4},{op:'+',val:6},{op:'-',val:4},{op:'×',val:5},{op:'+',val:2},{op:'-',val:5},{op:'+',val:8},{op:'×',val:2},{op:'-',val:6},{op:'+',val:10},{op:'×',val:3}],
    ENTEROS:    [{op:'+',val:-3},{op:'-',val:4},{op:'×',val:-2},{op:'+',val:5},{op:'-',val:-3},{op:'×',val:3},{op:'+',val:-6},{op:'-',val:-2},{op:'×',val:-3},{op:'+',val:4},{op:'-',val:7},{op:'×',val:-1},{op:'+',val:-5},{op:'-',val:-4},{op:'×',val:2},{op:'+',val:8},{op:'-',val:3},{op:'×',val:-4},{op:'+',val:-2},{op:'×',val:5}],
    DECIMALES:  [{op:'+',val:1.5},{op:'-',val:0.5},{op:'×',val:2},{op:'+',val:2.5},{op:'-',val:1.2},{op:'×',val:3},{op:'+',val:0.8},{op:'-',val:0.4},{op:'×',val:4},{op:'+',val:3.2},{op:'-',val:1.5},{op:'+',val:0.3},{op:'×',val:2.5},{op:'-',val:2.1},{op:'+',val:4.4},{op:'×',val:0.5},{op:'+',val:1.1},{op:'-',val:0.7},{op:'×',val:1.5},{op:'+',val:2.2}],
    FRACCIONES: [{op:'+',n:1,d:2},{op:'-',n:1,d:3},{op:'×',n:1,d:2},{op:'+',n:2,d:3},{op:'-',n:1,d:4},{op:'×',n:2,d:3},{op:'+',n:3,d:4},{op:'-',n:1,d:2},{op:'×',n:3,d:2},{op:'+',n:1,d:5},{op:'-',n:2,d:5},{op:'+',n:1,d:6},{op:'×',n:3,d:4},{op:'-',n:1,d:6},{op:'+',n:5,d:6},{op:'×',n:1,d:3},{op:'-',n:3,d:4},{op:'+',n:2,d:5},{op:'×',n:4,d:3},{op:'-',n:1,d:5}],
};
const getOp = (i, modo) => OPS_POOLS[modo][(i-1+20)%20];
const opLabel = (op, modo) => modo==='FRACCIONES' ? `${op.op} ${fracStr(op.n,op.d)}` : `${op.op} ${op.val<0?`(${op.val})`:op.val}`;
const resolverOp = (base, op, modo) => {
    if (modo === 'FRACCIONES') {
        const [n1,d1]=[base.n,base.d],[n2,d2]=[op.n,op.d];
        let rn,rd;
        if(op.op==='+'){rn=n1*d2+n2*d1;rd=d1*d2;}
        if(op.op==='-'){rn=n1*d2-n2*d1;rd=d1*d2;}
        if(op.op==='×'){rn=n1*n2;rd=d1*d2;}
        const s=simplify(rn,rd);
        return {question:`${fracStr(n1,d1)} ${op.op} ${fracStr(n2,d2)}`, answer:s.str, answerFrac:s};
    }
    if (modo === 'DECIMALES') {
        const bv=base.n/base.d,ov=op.val;
        const res=op.op==='+'?bv+ov:op.op==='-'?bv-ov:bv*ov;
        return {question:`${bv.toFixed(1)} ${op.op} ${ov}`, answer:parseFloat(res.toFixed(2)).toString()};
    }
    const bv=base.n,ov=op.val;
    const res=op.op==='+'?bv+ov:op.op==='-'?bv-ov:bv*ov;
    return {question:`${bv} ${op.op} ${ov<0?`(${ov})`:ov}`, answer:res.toString()};
};

// ─── Apariencia de casillas ───────────────────────────────────────────────────
const NRM = ['#fff0f3','#f0fff4','#f0f4ff','#fffbf0','#f5f0ff','#f0fffe','#fff7f0','#f9fff0','#eef3ff','#f0fffa','#fff5f0','#ffeef8'];
const squareMeta = (i) => {
    if (i===0)     return {bg:'linear-gradient(135deg,#2c3e50,#1a252f)',icon:'🏁',sp:true,dk:true};
    if (i===META)  return {bg:'linear-gradient(135deg,#f1c40f,#e67e22)',icon:'🏆',sp:true,dk:false};
    if (OCAS.has(i)) return {bg:'linear-gradient(135deg,#fffde7,#ffe57f)',icon:'🦆',sp:true,dk:false};
    if (i===PUENTE_A||i===PUENTE_B) return {bg:'linear-gradient(135deg,#e3f2fd,#81d4fa)',icon:'🌉',sp:true,dk:false};
    if (i===CARCEL)  return {bg:'linear-gradient(135deg,#263238,#37474f)',icon:'⛓️',sp:true,dk:true};
    if (i===CAVERNA) return {bg:'linear-gradient(135deg,#311b92,#6a1b9a)',icon:'💀',sp:true,dk:true};
    if (i===MUERTE)  return {bg:'linear-gradient(135deg,#7f0000,#b71c1c)',icon:'☠️',sp:true,dk:true};
    return {bg:NRM[i%NRM.length],icon:null,sp:false,dk:false};
};

// ─── Sonidos Web Audio ─────────────────────────────────────────────────────────
const useSounds = () => {
    const ref = useRef(null);
    const ctx = () => { if (!ref.current) ref.current=new(window.AudioContext||window.webkitAudioContext)(); return ref.current; };
    const tone = (fr,ty,vol,t0,dur) => {
        const c=ctx(),o=c.createOscillator(),g=c.createGain();
        o.connect(g);g.connect(c.destination);
        o.type=ty;o.frequency.value=fr;
        g.gain.setValueAtTime(vol,c.currentTime+t0);
        g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+t0+dur);
        o.start(c.currentTime+t0);o.stop(c.currentTime+t0+dur+0.01);
    };
    return {
        dice: ()=>[0,.07,.14,.21,.28,.35].forEach(t=>tone(150+Math.random()*300,'square',.07,t,.06)),
        step: (k)=>{ const f=[330,350,370,392,415,440]; tone(f[k%6],'sine',.12,0,.08); },
        correct: ()=>[523,659,784,1047].forEach((f,i)=>tone(f,'sine',.25,i*.1,.28)),
        wrong: ()=>{ const c=ctx(),o=c.createOscillator(),g=c.createGain(); o.connect(g);g.connect(c.destination); o.type='sawtooth'; o.frequency.setValueAtTime(280,c.currentTime); o.frequency.linearRampToValueAtTime(90,c.currentTime+.55); g.gain.setValueAtTime(.2,c.currentTime); g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.55); o.start(c.currentTime);o.stop(c.currentTime+.56); },
        special: ()=>[784,880,988,1047].forEach((f,i)=>tone(f,'triangle',.2,i*.08,.2)),
    };
};

// ─── Dado SVG ─────────────────────────────────────────────────────────────────
const DOTS={1:[[50,50]],2:[[27,27],[73,73]],3:[[27,27],[50,50],[73,73]],4:[[27,27],[73,27],[27,73],[73,73]],5:[[27,27],[73,27],[50,50],[27,73],[73,73]],6:[[27,22],[73,22],[27,50],[73,50],[27,78],[73,78]]};
const DadoSVG=({valor,color='#2c3e50',size=74})=>(
    <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs>
            <filter id="ds"><feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.3"/></filter>
            <linearGradient id="dg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="white"/><stop offset="100%" stopColor="#f0f0f0"/></linearGradient>
        </defs>
        <rect x="6" y="6" width="88" height="88" rx="18" fill="url(#dg)" stroke={color} strokeWidth="4" filter="url(#ds)"/>
        {(DOTS[valor]||[]).map(([cx,cy],k)=><circle key={k} cx={cx} cy={cy} r="9" fill={color}/>)}
    </svg>
);

// ─── Tablero en espiral ────────────────────────────────────────────────────────
// ─── Pre-cálculo de muros (lados entre casillas NO consecutivas en el camino) ──
// Para cada casilla i, calcula qué lados (top/right/bottom/left) son "muro"
// (el vecino en esa dirección no es i-1 ni i+1) o "camino" (sí es consecutivo)
const POS_LOOKUP = (() => {
    const m = {};
    SQUARE_POS.forEach(({col,row},i) => { m[`${col},${row}`] = i; });
    return m;
})();
const getCellBorders = (i) => {
    const {col,row} = SQUARE_POS[i];
    const dirs = { top:[col,row-1], right:[col+1,row], bottom:[col,row+1], left:[col-1,row] };
    const res = {};
    for (const [dir,[nc,nr]] of Object.entries(dirs)) {
        const key = `${nc},${nr}`;
        const neighbor = POS_LOOKUP[key];
        if (neighbor === undefined) {
            // Borde exterior del tablero → muro
            res[dir] = 'wall';
        } else if (neighbor === i-1 || neighbor === i+1) {
            res[dir] = 'path';
        } else {
            res[dir] = 'wall';
        }
    }
    return res;
};
// Estilos de borde por lado según tipo
const WALL  = '4px solid #000';
const PATH  = '1px solid rgba(255,255,255,0.18)';
const PATH_SP='1px solid rgba(255,255,255,0.5)';
const borderStyle = (borders, isSpecial, isMeta) => {
    if (isMeta) return {border:'2.5px solid #f1c40f'};
    const b = (dir) => borders[dir]==='path' ? (isSpecial?PATH_SP:PATH) : WALL;
    return {
        borderTop:    b('top'),
        borderRight:  b('right'),
        borderBottom: b('bottom'),
        borderLeft:   b('left'),
    };
};

const Tablero=({jugadores,modo,visualPos,animJid,tick})=>{
    const getPos=j=>(visualPos&&visualPos[j.id]!==undefined)?visualPos[j.id]:j.posicion;
    return(
        <div style={{position:'relative',width:'100%',paddingBottom:'100%'}}>
            <style>{`
                @keyframes hop{0%{transform:scale(1.1) translateY(0)}45%{transform:scale(1.45) translateY(-38%)}100%{transform:scale(1.25) translateY(0)}}
                .hopping{animation:hop 0.32s ease}
            `}</style>
            <div style={{
                position:'absolute',inset:0,
                display:'grid',gridTemplateColumns:'repeat(8,1fr)',gridTemplateRows:'repeat(8,1fr)',
                gap:0,background:'#000',
                borderRadius:16,padding:0,
                boxShadow:'inset 0 2px 16px rgba(0,0,0,0.5),0 8px 32px rgba(0,0,0,0.4)',
                overflow:'hidden',
                border:'4px solid #000',
            }}>
                {SQUARE_POS.map((gp,i)=>{
                    const m=squareMeta(i);
                    const op=(!m.sp&&i>0)?getOp(i,modo):null;
                    const lbl=op?opLabel(op,modo):null;
                    const fichas=jugadores.filter(j=>getPos(j)===i);
                    const borders=getCellBorders(i);
                    const bs=borderStyle(borders,m.sp,i===META);
                    return(
                        <div key={i} style={{
                            gridColumn:gp.col+1,gridRow:gp.row+1,
                            background:m.bg,
                            ...bs,
                            display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                            position:'relative',overflow:'visible',
                            boxShadow:m.sp?'inset 0 1px 0 rgba(255,255,255,0.2)':'none',
                            minHeight:0,
                        }}>
                            {/* Número */}
                            <div style={{position:'absolute',top:1,left:2,fontSize:'clamp(0.42rem,1.1vw,0.62rem)',fontWeight:800,lineHeight:1,color:m.dk?'rgba(255,255,255,0.65)':'rgba(0,0,0,0.38)'}}>{i}</div>
                            {/* Icono o etiqueta */}
                            {m.icon?(
                                <span style={{fontSize:'clamp(0.85rem,2.4vw,1.4rem)',lineHeight:1,filter:'drop-shadow(0 1px 2px rgba(0,0,0,0.4))'}}>{m.icon}</span>
                            ):lbl?(
                                <div style={{fontSize:'clamp(0.47rem,1.3vw,0.74rem)',fontWeight:900,color:'#8b0000',textAlign:'center',lineHeight:1.05,background:'rgba(255,255,255,0.6)',borderRadius:4,padding:'1px 3px',fontFamily:'Georgia,serif'}}>{lbl}</div>
                            ):null}
                            {/* Fichas */}
                            {fichas.length>0&&(
                                <div style={{position:'absolute',bottom:2,display:'flex',gap:1,flexWrap:'wrap',justifyContent:'center',width:'88%',zIndex:5}}>
                                    {fichas.map(j=>{
                                        const isHop=j.id===animJid;
                                        const sz=fichas.length===1?'clamp(15px,3.3vw,22px)':'clamp(11px,2.4vw,17px)';
                                        return(
                                            <div key={j.id}
                                                className={isHop?'hopping':''}
                                                style={{
                                                    width:sz,height:sz,borderRadius:'50%',
                                                    background:`radial-gradient(circle at 35% 30%,${COLORES_J[j.id]}ff,${COLORES_J[j.id]}99)`,
                                                    border:'2px solid white',
                                                    boxShadow:`0 2px 8px ${COLORES_J[j.id]}aa,0 0 0 1.5px ${COLORES_J[j.id]}`,
                                                    display:'flex',alignItems:'center',justifyContent:'center',
                                                    fontSize:'clamp(0.42rem,1vw,0.62rem)',color:'white',fontWeight:900,flexShrink:0,
                                                }}>{j.id+1}</div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ─── Modal pregunta ────────────────────────────────────────────────────────────
const ModalPregunta=({modal,modo,onChange,onSubmit})=>{
    const pct=(modal.timeLeft/modal.totalTime)*100,urg=modal.timeLeft<=10;
    return(
        <div style={{position:'fixed',inset:0,zIndex:2000,background:'rgba(8,12,24,0.9)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,backdropFilter:'blur(5px)'}}>
            <div style={{background:'white',borderRadius:24,width:'100%',maxWidth:400,boxShadow:'0 30px 80px rgba(0,0,0,0.6)',overflow:'hidden',animation:'pop 0.22s cubic-bezier(0.175,0.885,0.32,1.275)'}}>
                <style>{`@keyframes pop{from{transform:scale(0.78);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
                <div style={{height:7,background:'#ecf0f1'}}>
                    <div style={{height:'100%',width:`${pct}%`,background:urg?'#e74c3c':'linear-gradient(90deg,#2ecc71,#27ae60)',transition:'width 1s linear,background 0.4s',borderRadius:4}}/>
                </div>
                <div style={{padding:'20px 24px 24px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <div style={{width:12,height:12,borderRadius:'50%',background:COLORES_J[modal.jugadorId]}}/>
                            <span style={{fontWeight:800,color:'#2c3e50',fontSize:'0.88rem'}}>{modal.jugadorNombre}</span>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:5,color:urg?'#e74c3c':'#7f8c8d',fontWeight:800,fontSize:'1.2rem',transition:'color 0.3s'}}>
                            <Clock size={16}/>{modal.timeLeft}s
                        </div>
                    </div>
                    <div style={{background:'linear-gradient(135deg,#1a2a4a,#2c3e6a)',borderRadius:16,padding:'16px 12px',textAlign:'center',marginBottom:16,boxShadow:'0 4px 16px rgba(26,42,74,0.3)'}}>
                        <div style={{color:'rgba(255,255,255,0.5)',fontSize:'0.7rem',marginBottom:7,letterSpacing:1}}>{modal.esPendiente?'🔁 SEGUNDA OPORTUNIDAD':'¡RESUELVE PARA AVANZAR!'}</div>
                        <div style={{fontSize:'clamp(1.45rem,5vw,2.2rem)',fontWeight:900,color:'white',fontFamily:'Georgia,serif'}}>{modal.question} = <span style={{color:'#f1c40f'}}>?</span></div>
                    </div>
                    {modal.errorMsg?(
                        <div style={{background:modal.errorMsg.startsWith('✅')?'#e8f5e9':'#fdecea',border:`2px solid ${modal.errorMsg.startsWith('✅')?'#4caf50':'#e74c3c'}`,borderRadius:12,padding:'12px 14px',color:modal.errorMsg.startsWith('✅')?'#2e7d32':'#c0392b',fontWeight:700,textAlign:'center',fontSize:'0.88rem',lineHeight:1.4}}>
                            <AlertCircle size={14} style={{verticalAlign:'middle',marginRight:5}}/>{modal.errorMsg}
                        </div>
                    ):(
                        <form onSubmit={onSubmit} style={{display:'flex',gap:9}}>
                            <input autoFocus value={modal.userAnswer} onChange={e=>onChange(e.target.value)}
                                placeholder={modo==='FRACCIONES'?'Ej: 3/4':modo==='DECIMALES'?'Ej: 3.5':'Respuesta…'}
                                style={{flex:1,padding:'12px 13px',borderRadius:12,border:'2px solid #dfe6e9',fontSize:'1.15rem',outline:'none',textAlign:'center',fontFamily:'Georgia,serif',fontWeight:700,color:'#2c3e50',transition:'border-color 0.2s'}}
                                onFocus={e=>e.target.style.borderColor='#3498db'}
                                onBlur={e=>e.target.style.borderColor='#dfe6e9'}/>
                            <button type="submit" style={{padding:'12px 17px',background:'linear-gradient(135deg,#27ae60,#2ecc71)',color:'white',border:'none',borderRadius:12,fontWeight:800,cursor:'pointer',fontSize:'1.1rem',boxShadow:'0 4px 12px rgba(39,174,96,0.4)'}}>✓</button>
                        </form>
                    )}
                    {modo==='FRACCIONES'&&!modal.errorMsg&&<p style={{fontSize:'0.73rem',color:'#95a5a6',textAlign:'center',margin:'8px 0 0'}}>Escribe la fracción simplificada (ej: 2/3)</p>}
                </div>
            </div>
        </div>
    );
};

// ─── Componente principal ──────────────────────────────────────────────────────
// ─── Pantalla de fin con estadísticas y envío al profesor ────────────────────
function PantallaFin({ ord, modo, stats, jugadores, baseStr, onSetup, onRepetir }) {
    const [codigo,    setCodigo]    = useState('');
    const [enviando,  setEnviando]  = useState(false);
    const [enviado,   setEnviado]   = useState(false);
    const [errorEnv,  setErrorEnv]  = useState('');

    const MODO_LABEL = { NATURALES:'Naturales', ENTEROS:'Enteros', DECIMALES:'Decimales', FRACCIONES:'Fracciones' };
    const getPct = (j) => {
        const s = stats[j.id] || { intentos:0, aciertos:0 };
        return s.intentos > 0 ? Math.round(s.aciertos/s.intentos*100) : 0;
    };
    const pctColor = (p) => p>=80?'#2ecc71':p>=50?'#f39c12':'#e74c3c';

    const enviarAlProfesor = async () => {
        const code = codigo.trim().toUpperCase();
        if (!code) { setErrorEnv('Escribe el código del profesor.'); return; }
        setEnviando(true); setErrorEnv('');
        try {
            // Buscar en codigos_profesor (el ID del doc ES el código)
            const codigoDoc = await getDoc(doc(db, 'codigos_profesor', code));
            if (!codigoDoc.exists()) {
                setErrorEnv('Código no encontrado.');
                setEnviando(false); return;
            }

            // Guardar informe
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'OCA',
                modalidad: MODO_LABEL[modo] || modo,
                fecha: new Date(),
                codigoProfesor: code,
                jugadores: jugadores.map(j => {
                    const s = stats[j.id] || { intentos: 0, aciertos: 0 };
                    const pct = s.intentos > 0 ? Math.round(s.aciertos / s.intentos * 100) : 0;
                    return { nombre: j.nombre, aciertos: s.aciertos, intentos: s.intentos, porcentaje: pct };
                }),
            });
            const s0 = stats[jugadores[0]?.id] || { intentos: 0, aciertos: 0 };
            guardarRegistroLocal('OCA', {
                titulo: 'Oca Matemática', aciertos: s0.aciertos, intentos: s0.intentos,
                nombre: jugadores[0]?.nombre || '', via: 'profesor',
            });
            setEnviado(true);
        } catch (e) {
            console.error(e);
            setErrorEnv('Error al enviar. Comprueba tu conexión.');
        }
        setEnviando(false);
    };

    return (
        <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#1a1a2e,#16213e)',display:'flex',alignItems:'center',justifyContent:'center',padding:20,fontFamily:"'Segoe UI',sans-serif",overflowY:'auto'}}>
            <Confetti recycle={false} numberOfPieces={300}/>
            <div style={{background:'rgba(255,255,255,0.07)',backdropFilter:'blur(20px)',borderRadius:24,border:'1px solid rgba(255,255,255,0.14)',padding:28,width:'100%',maxWidth:440,textAlign:'center'}}>
                <Trophy size={58} color="#f1c40f" style={{marginBottom:8}}/>
                <h1 style={{color:'white',fontSize:'1.6rem',fontWeight:900,margin:'0 0 4px'}}>¡Juego Terminado!</h1>
                <div style={{color:'rgba(255,255,255,0.45)',fontSize:'0.82rem',marginBottom:18}}>🦆 Oca · {MODO_LABEL[modo]}</div>

                {/* Tabla de resultados */}
                <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:20,textAlign:'left'}}>
                    {ord.map((j,idx)=>{
                        const s=stats[j.id]||{intentos:0,aciertos:0};
                        const pct=getPct(j);
                        return(
                            <div key={j.id} style={{background:'rgba(255,255,255,0.06)',borderRadius:12,padding:'10px 13px',border:`1px solid ${idx===0?'#f1c40f33':'rgba(255,255,255,0.07)'}`}}>
                                <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:5}}>
                                    <span style={{fontSize:'1.4rem'}}>{'🥇🥈🥉🏅'[idx]||'🏅'}</span>
                                    <div style={{width:9,height:9,borderRadius:'50%',background:j.color,flexShrink:0}}/>
                                    <span style={{color:'white',fontWeight:700,flex:1,fontSize:'0.88rem'}}>{j.nombre}</span>
                                    <span style={{color:'rgba(255,255,255,0.35)',fontSize:'0.74rem'}}>{j.terminado?'✓ Meta':`C.${j.posicion}`}</span>
                                </div>
                                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
                                    <div style={{background:'rgba(0,0,0,0.2)',borderRadius:8,padding:'5px 0',textAlign:'center'}}>
                                        <div style={{color:'rgba(255,255,255,0.4)',fontSize:'0.6rem',letterSpacing:.5}}>INTENTOS</div>
                                        <div style={{color:'white',fontWeight:800,fontSize:'1.1rem'}}>{s.intentos}</div>
                                    </div>
                                    <div style={{background:'rgba(0,0,0,0.2)',borderRadius:8,padding:'5px 0',textAlign:'center'}}>
                                        <div style={{color:'rgba(255,255,255,0.4)',fontSize:'0.6rem',letterSpacing:.5}}>ACIERTOS</div>
                                        <div style={{color:'#2ecc71',fontWeight:800,fontSize:'1.1rem'}}>{s.aciertos}</div>
                                    </div>
                                    <div style={{background:'rgba(0,0,0,0.2)',borderRadius:8,padding:'5px 0',textAlign:'center'}}>
                                        <div style={{color:'rgba(255,255,255,0.4)',fontSize:'0.6rem',letterSpacing:.5}}>ACIERTO %</div>
                                        <div style={{color:pctColor(pct),fontWeight:800,fontSize:'1.1rem'}}>{pct}%</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Enviar al profesor */}
                <div style={{background:'rgba(255,255,255,0.04)',borderRadius:14,border:'1px solid rgba(255,255,255,0.1)',padding:'14px 16px',marginBottom:16,textAlign:'left'}}>
                    <div style={{color:'rgba(255,255,255,0.6)',fontSize:'0.75rem',fontWeight:700,letterSpacing:.8,marginBottom:10}}>📤 ENVIAR RESULTADOS AL PROFESOR</div>
                    {enviado ? (
                        <div style={{display:'flex',alignItems:'center',gap:8,color:'#2ecc71',fontWeight:700,justifyContent:'center',padding:'8px 0'}}>
                            <CheckCircle size={20}/> ¡Informe enviado correctamente!
                        </div>
                    ) : (
                        <>
                            <div style={{display:'flex',gap:8}}>
                                <input
                                    value={codigo} onChange={e=>setCodigo(e.target.value.toUpperCase())}
                                    placeholder="Código del profesor"
                                    maxLength={8}
                                    style={{flex:1,padding:'10px 12px',borderRadius:10,border:'1.5px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.08)',color:'white',fontFamily:'inherit',fontSize:'0.9rem',outline:'none',letterSpacing:1}}
                                    onFocus={e=>e.target.style.borderColor='#3498db'}
                                    onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.2)'}
                                />
                                <button onClick={enviarAlProfesor} disabled={enviando} style={{padding:'10px 14px',borderRadius:10,border:'none',background:enviando?'rgba(255,255,255,0.1)':'linear-gradient(135deg,#3498db,#2980b9)',color:'white',fontWeight:800,cursor:enviando?'default':'pointer',opacity:enviando?.6:1,display:'flex',alignItems:'center',gap:6,fontFamily:'inherit',fontSize:'0.88rem'}}>
                                    <Send size={15}/>{enviando?'Enviando…':'Enviar'}
                                </button>
                            </div>
                            {errorEnv&&<div style={{color:'#e74c3c',fontSize:'0.78rem',marginTop:6}}>{errorEnv}</div>}
                        </>
                    )}
                </div>

                <div style={{display:'flex',gap:9}}>
                    <button onClick={onSetup} style={{flex:1,padding:'11px',borderRadius:12,border:'1.5px solid rgba(255,255,255,0.18)',background:'transparent',color:'white',cursor:'pointer',fontFamily:'inherit',fontWeight:700}}>⚙️ Configurar</button>
                    <button onClick={onRepetir} style={{flex:1,padding:'11px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#f1c40f,#e67e22)',color:'#1a1a2e',fontWeight:900,cursor:'pointer',fontFamily:'inherit'}}><RotateCcw size={14} style={{verticalAlign:'middle',marginRight:5}}/>Repetir</button>
                </div>
            </div>
        </div>
    );
}

export default function OcaMatematica({ onExit }) {
    const [pantalla, setPantalla] = useState('SETUP');
    const [modo,     setModo]     = useState('NATURALES');
    const [numJ,     setNumJ]     = useState(2);
    const [tiempo,   setTiempo]   = useState(30);
    const [nombres,  setNombres]  = useState(['','','','']); // nombres personalizados
    const [jugadores,setJugadores]= useState([]);
    const [turno,    setTurno]    = useState(0);
    const [dado,     setDado]     = useState(null);
    const [rodando,  setRodando]  = useState(false);
    const [modal,    setModal]    = useState(null);
    const [mensaje,  setMensaje]  = useState('');
    const [bloqueado,setBloqueado]= useState(false);
    // opPendiente: si un jugador falló, guarda la operación para repetirla el turno siguiente
    // { jugadorIdx, targetPos, question, answer, answerFrac }
    const [opPendiente, setOpPendiente] = useState({});
    // Estadísticas por jugador { jId: { intentos, aciertos } }
    const [stats, setStats] = useState({});

    // Animación paso a paso
    const [visualPos, setVisualPos] = useState({});
    const [animJid,   setAnimJid]   = useState(null);
    const [tick,      setTick]      = useState(0);
    const animQ    = useRef(null);  // { jId, steps[], idx, onDone }
    const timerRef = useRef(null);

    const sounds = useSounds();

    // Temporizador modal
    useEffect(() => {
        if (!modal || modal.errorMsg) return;
        if (modal.timeLeft <= 0) { handleTimeout(); return; }
        timerRef.current = setTimeout(() => setModal(p=>p?{...p,timeLeft:p.timeLeft-1}:null), 1000);
        return () => clearTimeout(timerRef.current);
    }, [modal?.timeLeft, modal?.errorMsg]);

    // Bucle animación: avanza un paso cada vez que cambia `tick`
    useEffect(() => {
        if (!animQ.current) return;
        const { jId, steps, idx, onDone } = animQ.current;
        if (idx >= steps.length) {
            setAnimJid(null); setVisualPos({}); animQ.current = null;
            onDone(); return;
        }
        setVisualPos({ [jId]: steps[idx] });
        sounds.step(idx);
        const t = setTimeout(() => {
            animQ.current = { ...animQ.current, idx: idx+1 };
            setTick(v => v+1);
        }, 330);
        return () => clearTimeout(t);
    }, [tick]);

    const iniciarAnim = (jId, steps, onDone) => {
        setAnimJid(jId);
        animQ.current = { jId, steps, idx: 0, onDone };
        setTick(v => v+1);
    };

    const iniciar = () => {
        const nuevos = Array.from({length:numJ},(_,i)=>({
            id:i,
            nombre: nombres[i].trim() || `Jugador ${i+1}`,
            posicion:0,
            base:genBase(modo), color:COLORES_J[i], ficha:NOMBRES_F[i],
            turnosPerdidos:0, terminado:false,
        }));
        setJugadores(nuevos); setTurno(0); setDado(null);
        setMensaje(''); setBloqueado(false); setVisualPos({}); setAnimJid(null);
        setOpPendiente({});
        setStats({});
        animQ.current = null; setPantalla('PLAYING');
    };

    const addStat = (jIdx, esAcierto) => {
        setStats(prev => {
            const cur = prev[jIdx] || { intentos: 0, aciertos: 0 };
            return { ...prev, [jIdx]: { intentos: cur.intentos+1, aciertos: cur.aciertos+(esAcierto?1:0) } };
        });
    };

    const mostrarMensaje = (msg, delay, cb) => {
        setMensaje(msg);
        setTimeout(() => { setMensaje(''); if (cb) cb(); }, delay);
    };

    const siguienteTurno = useCallback((jugs) => {
        setBloqueado(false); setDado(null);
        const js = jugs || jugadores;
        if (js.every(j => j.terminado)) { setPantalla('FIN'); return; }
        let next = (turno+1) % numJ, tries = 0;
        while (js[next]?.terminado && tries++ < numJ) next = (next+1) % numJ;
        setTurno(next);
    }, [turno, numJ, jugadores]);

    const tirar = () => {
        if (bloqueado || rodando || modal || animQ.current) return;
        const j = jugadores[turno];
        if (j.turnosPerdidos > 0) {
            const nj = jugadores.map((jj,i)=>i===turno?{...jj,turnosPerdidos:jj.turnosPerdidos-1}:jj);
            setJugadores(nj);
            mostrarMensaje(`${j.ficha} ${j.nombre} pierde turno.`, 2000, ()=>siguienteTurno(nj));
            return;
        }
        // ¿Tiene una operación pendiente por fallo anterior?
        if (opPendiente[turno]) {
            const op = opPendiente[turno];
            setBloqueado(true);
            setTimeout(() => {
                setModal({
                    jugadorId: j.id, jugadorNombre: j.nombre,
                    targetPos: op.targetPos,
                    question: op.question,
                    answer: op.answer, answerFrac: op.answerFrac,
                    userAnswer: '', errorMsg: '',
                    timeLeft: tiempo, totalTime: tiempo,
                    esPendiente: true,
                });
            }, 300);
            return;
        }
        setRodando(true); sounds.dice();
        let ticks = 0;
        const anim = setInterval(() => {
            setDado(Math.floor(Math.random()*6)+1);
            if (++ticks > 9) {
                clearInterval(anim);
                const tirada = Math.floor(Math.random()*6)+1;
                setDado(tirada); setRodando(false); setBloqueado(true);
                // Construir steps con posible rebote en meta
                const steps = [];
                for (let k=1; k<=tirada; k++) {
                    let p = j.posicion + k;
                    if (p > META) p = META - (p - META);
                    steps.push(p);
                }
                const target = steps[steps.length-1];
                iniciarAnim(j.id, steps, () => {
                    setTimeout(() => lanzar(target, j), 200);
                });
            }
        }, 90);
    };

    const lanzar = (pos, jRef) => {
        if (OCAS.has(pos)||pos===PUENTE_A||pos===PUENTE_B||pos===CARCEL||pos===CAVERNA||pos===MUERTE||pos===META) {
            aplicarEspecial(pos, turno, jRef, jugadores); return;
        }
        const op=getOp(pos,modo), res=resolverOp(jRef.base,op,modo);
        setModal({
            jugadorId:jRef.id, jugadorNombre:jRef.nombre,
            targetPos:pos, question:res.question,
            answer:res.answer, answerFrac:res.answerFrac,
            userAnswer:'', errorMsg:'',
            timeLeft:tiempo, totalTime:tiempo,
        });
    };

    const aplicarEspecial = (pos, jIdx, jug, jugsBase) => {
        const bj = jugsBase || jugadores;
        let nuevos = bj.map((jj,i)=>i!==jIdx?jj:{...jj,posicion:pos});
        let msg='', extraTurn=false;
        if (OCAS.has(pos)) {
            const nx=[...OCAS].find(o=>o>pos)||META;
            nuevos=nuevos.map((jj,i)=>i!==jIdx?jj:{...jj,posicion:nx});
            msg=`🦆 ¡De Oca en Oca! → casilla ${nx}`; extraTurn=true; sounds.special();
        } else if (pos===PUENTE_A) {
            nuevos=nuevos.map((jj,i)=>i!==jIdx?jj:{...jj,posicion:PUENTE_B});
            msg=`🌉 ¡De puente a puente! → casilla ${PUENTE_B}`; extraTurn=true; sounds.special();
        } else if (pos===PUENTE_B) {
            nuevos=nuevos.map((jj,i)=>i!==jIdx?jj:{...jj,posicion:PUENTE_A});
            msg=`🌉 ¡De puente a puente! → casilla ${PUENTE_A}`; extraTurn=true; sounds.special();
        } else if (pos===CARCEL) {
            nuevos=nuevos.map((jj,i)=>i!==jIdx?jj:{...jj,turnosPerdidos:2});
            msg=`⛓️ ¡Cárcel! Pierdes 2 turnos.`;
        } else if (pos===CAVERNA) {
            nuevos=nuevos.map((jj,i)=>i!==jIdx?jj:{...jj,turnosPerdidos:1});
            msg=`💀 ¡Caverna! Pierdes 1 turno.`;
        } else if (pos===MUERTE) {
            nuevos=nuevos.map((jj,i)=>i!==jIdx?jj:{...jj,posicion:1});
            msg=`☠️ ¡Muerte! ${jug.nombre} vuelve a casilla 1.`;
        } else if (pos===META) {
            nuevos=nuevos.map((jj,i)=>i!==jIdx?jj:{...jj,terminado:true});
            msg=`🏆 ¡${jug.nombre} llegó a la META!`;
        }
        setJugadores(nuevos);
        mostrarMensaje(msg, 2500, ()=>{
            if (extraTurn && !nuevos[jIdx].terminado) mostrarMensaje('¡Vuelves a tirar!', 1200, ()=>setBloqueado(false));
            else siguienteTurno(nuevos);
        });
    };

    const handleTimeout = () => {
        sounds.wrong();
        addStat(turno, false);
        // Guardar la operación para repetirla el próximo turno
        if (modal) {
            setOpPendiente(prev => ({
                ...prev,
                [turno]: {
                    targetPos: modal.targetPos,
                    question:  modal.question,
                    answer:    modal.answer,
                    answerFrac:modal.answerFrac,
                },
            }));
        }
        setModal(null);
        mostrarMensaje('⏰ ¡Tiempo agotado! Repetirás la operación en tu próximo turno.', 2500, ()=>siguienteTurno());
    };

    const comprobar = (e) => {
        e.preventDefault();
        if (!modal) return;
        const raw = modal.userAnswer.trim().replace(',','.');
        if (modo==='FRACCIONES') {
            const [un,ud]=raw.includes('/')?raw.split('/').map(Number):[Number(raw),1];
            const {n:cn,d:cd}=modal.answerFrac||simplify(...modal.answer.split('/').map(Number));
            if ((un*cd)!==(cn*ud)) {
                sounds.wrong(); addStat(turno, false);
                setOpPendiente(prev=>({...prev,[turno]:{targetPos:modal.targetPos,question:modal.question,answer:modal.answer,answerFrac:modal.answerFrac}}));
                setModal(p=>({...p,errorMsg:`❌ Incorrecto. Era ${modal.answer}. Repetirás la operación en tu próximo turno.`}));
                setTimeout(()=>{setModal(null);siguienteTurno();},3200); return;
            }
            if (raw!==modal.answer&&!(ud===1&&`${un}`===modal.answer)) {
                sounds.wrong(); addStat(turno, false);
                setOpPendiente(prev=>({...prev,[turno]:{targetPos:modal.targetPos,question:modal.question,answer:modal.answer,answerFrac:modal.answerFrac}}));
                setModal(p=>({...p,errorMsg:`✅ Correcto, pero no simplificada. Debe ser: ${modal.answer}. Repetirás en el próximo turno.`}));
                setTimeout(()=>{setModal(null);siguienteTurno();},3500); return;
            }
        } else if (modo==='DECIMALES') {
            if (Math.abs(Number(raw)-Number(modal.answer))>0.001) {
                sounds.wrong(); addStat(turno, false);
                setOpPendiente(prev=>({...prev,[turno]:{targetPos:modal.targetPos,question:modal.question,answer:modal.answer,answerFrac:modal.answerFrac}}));
                setModal(p=>({...p,errorMsg:`❌ Incorrecto. Era ${modal.answer}. Repetirás en tu próximo turno.`}));
                setTimeout(()=>{setModal(null);siguienteTurno();},3200); return;
            }
        } else {
            if (Number(raw)!==Number(modal.answer)) {
                sounds.wrong(); addStat(turno, false);
                setOpPendiente(prev=>({...prev,[turno]:{targetPos:modal.targetPos,question:modal.question,answer:modal.answer,answerFrac:modal.answerFrac}}));
                setModal(p=>({...p,errorMsg:`❌ Incorrecto. Era ${modal.answer}. Repetirás en tu próximo turno.`}));
                setTimeout(()=>{setModal(null);siguienteTurno();},3200); return;
            }
        }
        // Correcto → limpiar pendiente + actualizar base acumulada
        sounds.correct(); addStat(turno, true);
        setOpPendiente(prev=>{ const n={...prev}; delete n[turno]; return n; });
        const jIdx=turno;
        let nb;
        if (modo==='FRACCIONES') nb=modal.answerFrac||simplify(...modal.answer.split('/').map(Number));
        else if (modo==='DECIMALES') { const rv=Math.round(Number(modal.answer)*100); nb=simplify(rv,100); }
        else nb={n:Number(modal.answer),d:1,str:modal.answer};
        const ja=jugadores.map((jj,i)=>i===jIdx?{...jj,base:nb}:jj);
        setJugadores(ja); setModal(null);
        aplicarEspecial(modal.targetPos, jIdx, ja[jIdx], ja);
    };

    // ─── SETUP ───────────────────────────────────────────────────────────────
    if (pantalla==='SETUP') {
        const MODOS=[{id:'NATURALES',icon:'🔢',label:'Naturales',desc:'Sumas, restas y multiplicaciones',color:'#27ae60'},{id:'ENTEROS',icon:'±',label:'Enteros',desc:'Incluye negativos',color:'#3498db'},{id:'DECIMALES',icon:'0.5',label:'Decimales',desc:'Con cifras decimales',color:'#f39c12'},{id:'FRACCIONES',icon:'½',label:'Fracciones',desc:'Fracciones simplificadas',color:'#9b59b6'}];
        return(
            <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:20,fontFamily:"'Segoe UI',sans-serif"}}>
                <div style={{width:'100%',maxWidth:480,background:'rgba(255,255,255,0.05)',backdropFilter:'blur(20px)',borderRadius:24,border:'1px solid rgba(255,255,255,0.12)',padding:32,boxShadow:'0 30px 80px rgba(0,0,0,0.5)'}}>
                    <div style={{textAlign:'center',marginBottom:24}}>
                        <div style={{fontSize:'3.2rem',marginBottom:6}}>🦆</div>
                        <h1 style={{color:'white',fontSize:'1.85rem',margin:0,fontWeight:900,letterSpacing:'-0.5px'}}>La Oca Matemática</h1>
                        <p style={{color:'rgba(255,255,255,0.42)',margin:'5px 0 0',fontSize:'0.86rem'}}>Tira los dados · resuelve · acumula tu puntuación</p>
                    </div>
                    <div style={{marginBottom:18}}>
                        <div style={{color:'rgba(255,255,255,0.58)',fontSize:'0.76rem',fontWeight:700,letterSpacing:1,marginBottom:8}}>TIPO DE NÚMEROS</div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
                            {MODOS.map(m=><button key={m.id} onClick={()=>setModo(m.id)} style={{padding:'10px 8px',borderRadius:12,border:`2px solid ${modo===m.id?m.color:'rgba(255,255,255,0.1)'}`,background:modo===m.id?`${m.color}22`:'rgba(255,255,255,0.04)',color:'white',cursor:'pointer',textAlign:'left',fontFamily:'inherit',transition:'all 0.17s'}}><div style={{fontSize:'1.25rem',marginBottom:3}}>{m.icon}</div><div style={{fontWeight:700,fontSize:'0.86rem',color:modo===m.id?m.color:'white'}}>{m.label}</div><div style={{fontSize:'0.68rem',color:'rgba(255,255,255,0.38)',marginTop:2,lineHeight:1.3}}>{m.desc}</div></button>)}
                        </div>
                    </div>
                    <div style={{display:'flex',gap:14,marginBottom:20}}>
                        <div style={{flex:1}}>
                            <div style={{color:'rgba(255,255,255,0.58)',fontSize:'0.76rem',fontWeight:700,letterSpacing:1,marginBottom:7}}>JUGADORES</div>
                            <div style={{display:'flex',gap:5}}>{[1,2,3,4].map(n=><button key={n} onClick={()=>setNumJ(n)} style={{flex:1,padding:'8px 2px',borderRadius:10,border:`2px solid ${numJ===n?'#f1c40f':'rgba(255,255,255,0.13)'}`,background:numJ===n?'rgba(241,196,15,0.18)':'transparent',color:numJ===n?'#f1c40f':'rgba(255,255,255,0.4)',cursor:'pointer',fontWeight:700,fontSize:'1rem',fontFamily:'inherit'}}>{n}</button>)}</div>
                        </div>
                        <div style={{flex:1}}>
                            <div style={{color:'rgba(255,255,255,0.58)',fontSize:'0.76rem',fontWeight:700,letterSpacing:1,marginBottom:7}}>TIEMPO / PREGUNTA</div>
                            <div style={{display:'flex',gap:5}}>{[15,20,30,45].map(t=><button key={t} onClick={()=>setTiempo(t)} style={{flex:1,padding:'8px 2px',borderRadius:10,border:`2px solid ${tiempo===t?'#e74c3c':'rgba(255,255,255,0.13)'}`,background:tiempo===t?'rgba(231,76,60,0.18)':'transparent',color:tiempo===t?'#ff6b6b':'rgba(255,255,255,0.4)',cursor:'pointer',fontWeight:700,fontSize:'0.8rem',fontFamily:'inherit'}}>{t}s</button>)}</div>
                        </div>
                    </div>
                    {/* Nombres de jugadores */}
                    <div style={{marginBottom:18}}>
                        <div style={{color:'rgba(255,255,255,0.58)',fontSize:'0.76rem',fontWeight:700,letterSpacing:1,marginBottom:8}}>NOMBRES DE LOS JUGADORES</div>
                        <div style={{display:'flex',flexDirection:'column',gap:6}}>
                            {Array.from({length:numJ},(_,i)=>(
                                <div key={i} style={{display:'flex',alignItems:'center',gap:8}}>
                                    <div style={{width:10,height:10,borderRadius:'50%',background:COLORES_J[i],flexShrink:0}}/>
                                    <input
                                        value={nombres[i]}
                                        onChange={e=>setNombres(prev=>{const n=[...prev];n[i]=e.target.value;return n;})}
                                        placeholder={`Jugador ${i+1}`}
                                        maxLength={18}
                                        style={{flex:1,padding:'8px 12px',borderRadius:9,border:`1.5px solid ${COLORES_J[i]}55`,background:'rgba(255,255,255,0.07)',color:'white',fontFamily:'inherit',fontSize:'0.88rem',outline:'none'}}
                                        onFocus={e=>e.target.style.borderColor=COLORES_J[i]}
                                        onBlur={e=>e.target.style.borderColor=`${COLORES_J[i]}55`}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div style={{display:'flex',gap:10}}>
                        {onExit&&<button onClick={onExit} style={{padding:'12px 15px',borderRadius:12,border:'1.5px solid rgba(255,255,255,0.16)',background:'transparent',color:'rgba(255,255,255,0.42)',cursor:'pointer',fontFamily:'inherit'}}>← Volver</button>}
                        <button onClick={()=>{
                            const url='https://pikt.es/?juego=OCA';
                            if(navigator.share) navigator.share({title:'La Oca Matemática',text:'¡Juega a la Oca Matemática!',url}).catch(()=>{});
                            else navigator.clipboard.writeText(url).then(()=>alert('✅ Enlace copiado'));
                        }} style={{padding:'12px 14px',borderRadius:12,border:'1.5px solid rgba(255,255,255,0.16)',background:'transparent',color:'rgba(255,255,255,0.55)',cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:6}}>
                            <Share2 size={15}/> Compartir
                        </button>
                        <button onClick={iniciar} style={{flex:1,padding:'13px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#f1c40f,#e67e22)',color:'#1a1a2e',fontWeight:900,fontSize:'1.03rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontFamily:'inherit',boxShadow:'0 4px 18px rgba(241,196,15,0.4)'}}><Play size={19}/> ¡Empezar!</button>
                    </div>
                </div>
            </div>
        );
    }

    // ─── FIN ─────────────────────────────────────────────────────────────────
    if (pantalla==='FIN') {
        const ord=[...jugadores].sort((a,b)=>{ if(a.terminado&&!b.terminado)return -1;if(!a.terminado&&b.terminado)return 1;return b.posicion-a.posicion; });
        return <PantallaFin
            ord={ord} modo={modo} stats={stats} jugadores={jugadores}
            baseStr={baseStr}
            onSetup={()=>setPantalla('SETUP')} onRepetir={iniciar}
        />;
    }

    // ─── PLAYING ─────────────────────────────────────────────────────────────
    const j = jugadores[turno];
    return(
        <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)',display:'flex',flexDirection:'column',fontFamily:"'Segoe UI',sans-serif",userSelect:'none'}}>
            {/* Cabecera */}
            <div style={{padding:'7px 11px',display:'flex',alignItems:'center',justifyContent:'space-between',background:'rgba(0,0,0,0.35)',flexShrink:0,flexWrap:'wrap',gap:5}}>
                <button onClick={onExit} style={{padding:'5px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.16)',background:'transparent',color:'rgba(255,255,255,0.48)',cursor:'pointer',fontSize:'0.78rem',fontFamily:'inherit'}}>← Salir</button>
                <div style={{display:'flex',gap:5,flexWrap:'wrap',justifyContent:'center'}}>
                    {jugadores.map((jj,i)=>(
                        <div key={jj.id} style={{display:'flex',alignItems:'center',gap:5,padding:'3px 8px',borderRadius:16,background:turno===i?`${jj.color}28`:'rgba(255,255,255,0.05)',border:`1.5px solid ${turno===i?jj.color:'transparent'}`,transition:'all 0.2s'}}>
                            <div style={{width:7,height:7,borderRadius:'50%',background:jj.color}}/>
                            <span style={{color:'white',fontSize:'0.72rem',fontWeight:turno===i?700:400}}>{jj.ficha}</span>
                            <span style={{color:turno===i?jj.color:'rgba(255,255,255,0.55)',fontWeight:900,fontSize:'0.8rem',fontFamily:'Georgia,serif'}}>{baseStr(jj.base,modo)}</span>
                            <span style={{color:'rgba(255,255,255,0.32)',fontSize:'0.65rem'}}>C{jj.posicion}</span>
                            {jj.turnosPerdidos>0&&<span style={{fontSize:'0.6rem',color:'#e74c3c'}}>⛓{jj.turnosPerdidos}</span>}
                            {opPendiente[jj.id]&&!jj.turnosPerdidos&&<span style={{fontSize:'0.65rem',color:'#f39c12'}} title="Tiene operación pendiente">🔁</span>}
                            {jj.terminado&&<span style={{fontSize:'0.65rem'}}>🏆</span>}
                        </div>
                    ))}
                </div>
                <div style={{width:48}}/>
            </div>

            {/* Tablero + panel */}
            <div style={{flex:1,display:'flex',flexDirection:'column',gap:8,padding:'8px 9px 12px',overflowY:'auto'}}>
                <div style={{flex:1,minHeight:0}}>
                    <Tablero jugadores={jugadores} modo={modo} visualPos={visualPos} animJid={animJid} tick={tick}/>
                </div>

                {/* Panel dado / turno */}
                <div style={{background:'rgba(255,255,255,0.07)',borderRadius:14,border:'1px solid rgba(255,255,255,0.1)',padding:'11px 13px',flexShrink:0}}>
                    {mensaje?(
                        <div style={{background:'rgba(241,196,15,0.13)',border:'1.5px solid rgba(241,196,15,0.33)',borderRadius:10,padding:'10px 13px',color:'#f1c40f',fontWeight:700,textAlign:'center',fontSize:'0.88rem'}}>
                            {mensaje}
                        </div>
                    ):(
                        <div style={{display:'flex',alignItems:'center',gap:11}}>
                            <div style={{flexShrink:0,filter:rodando?'drop-shadow(0 0 12px rgba(241,196,15,0.7))':'none',transition:'filter 0.2s'}}>
                                {dado?<DadoSVG valor={dado} color={j.color} size={70}/>:
                                    <div style={{width:70,height:70,borderRadius:15,background:'rgba(255,255,255,0.05)',border:'2px dashed rgba(255,255,255,0.17)',display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{fontSize:'1.9rem'}}>🎲</span></div>}
                            </div>
                            <div style={{flex:1}}>
                                <div style={{color:'rgba(255,255,255,0.42)',fontSize:'0.7rem',marginBottom:2}}>TURNO DE</div>
                                <div style={{color:j.color,fontWeight:900,fontSize:'1rem',marginBottom:7}}>{j.ficha} {j.nombre}</div>
                                <button onClick={tirar} disabled={bloqueado||rodando||!!animQ.current} style={{padding:'9px 20px',borderRadius:11,border:'none',background:bloqueado||rodando?'rgba(255,255,255,0.07)':`linear-gradient(135deg,${j.color},${j.color}bb)`,color:'white',fontWeight:800,fontSize:'0.92rem',cursor:bloqueado||rodando?'default':'pointer',opacity:bloqueado||rodando?.4:1,display:'flex',alignItems:'center',gap:7,fontFamily:'inherit',boxShadow:bloqueado||rodando?'none':`0 4px 14px ${j.color}55`,transition:'all 0.2s'}}>
                                    <Dices size={17}/> Tirar Dado
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {modal&&<ModalPregunta modal={modal} modo={modo} onChange={v=>setModal(p=>({...p,userAnswer:v}))} onSubmit={comprobar}/>}
        </div>
    );
}
