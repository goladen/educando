// Algebra.jsx — 7-module interactive algebra practice for ESO
import React, { useState, useCallback } from 'react';
import { db } from './firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { CheckCircle, XCircle, RefreshCw, Send, Share2, ChevronDown, ChevronUp } from 'lucide-react';

// ─── Math utilities ───────────────────────────────────────────────────────────
const SUP = { 0:'', 1:'', 2:'²', 3:'³', 4:'⁴', 5:'⁵' };
const rInt = (lo, hi, ne) => { let v; do { v = Math.floor(Math.random()*(hi-lo+1))+lo; } while (ne !== undefined && v === ne); return v; };
const rItem = a => a[Math.floor(Math.random()*a.length)];
const shuffle = a => [...a].sort(() => Math.random() - 0.5);

function normPoly(c) { const a=[...c]; while(a.length>1&&a[a.length-1]===0)a.pop(); return a; }
function polyEq(a,b) { const na=normPoly(a),nb=normPoly(b); return na.length===nb.length&&na.every((v,i)=>v===nb[i]); }
function evalPoly(coeffs, x) { return coeffs.reduce((s,c,i)=>s+c*Math.pow(x,i),0); }

function polyStr(coeffs) {
    const terms=[];
    for(let d=coeffs.length-1;d>=0;d--) {
        const c=coeffs[d]; if(!c) continue;
        const ac=Math.abs(c);
        let t;
        if(d===0) t=`${ac}`;
        else if(d===1) t=ac===1?'x':`${ac}x`;
        else t=ac===1?`x${SUP[d]||`^${d}`}`:`${ac}x${SUP[d]||`^${d}`}`;
        terms.push({neg:c<0,t});
    }
    if(!terms.length) return '0';
    let s=(terms[0].neg?'−':'')+terms[0].t;
    for(let i=1;i<terms.length;i++) s+=terms[i].neg?` − ${terms[i].t}`:` + ${terms[i].t}`;
    return s;
}

function monoDisp(coef, deg) {
    if(deg===0) return `${coef}`;
    const sign=coef<0?'−':''; const ac=Math.abs(coef);
    const lit=deg===1?'x':`x${SUP[deg]||`^${deg}`}`;
    return ac===1?`${sign}${lit}`:`${sign}${ac}${lit}`;
}
function monoLit(deg) { if(deg===0)return '1'; return deg===1?'x':`x${SUP[deg]||`^${deg}`}`; }

function addPoly(a,b){const l=Math.max(a.length,b.length);return Array.from({length:l},(_,i)=>(a[i]||0)+(b[i]||0));}
function subPoly(a,b){const l=Math.max(a.length,b.length);return Array.from({length:l},(_,i)=>(a[i]||0)-(b[i]||0));}
function mulPoly(a,b){const r=Array(a.length+b.length-1).fill(0);a.forEach((ca,i)=>b.forEach((cb,j)=>{r[i+j]+=ca*cb;}));return r;}

// Ruffini: descCoeffs in descending order, returns full bottom row
function ruffiniRow(descCoeffs, root) {
    const row=[descCoeffs[0]];
    for(let i=1;i<descCoeffs.length;i++) row.push(descCoeffs[i]+row[row.length-1]*root);
    return row;
}
const toDesc = c => normPoly(c).reverse();
const toAsc  = c => [...c].reverse();

// Factor string: "(x − 3)" or "(x + 2)"
function factorStr(root) {
    if(root===0) return 'x';
    return root>0 ? `(x − ${root})` : `(x + ${Math.abs(root)})`;
}

// ─── PolyInput component ──────────────────────────────────────────────────────
function PolyInput({ value, onChange, maxDeg=4 }) {
    const ensure = d => { const a=[...value]; while(a.length<=d) a.push(0); return a; };
    const bump = (d,delta) => { const a=ensure(d); a[d]=Math.max(-30,Math.min(30,a[d]+delta)); onChange(a); };
    const reset = () => onChange(Array(maxDeg+1).fill(0));

    const btnS = bg => ({ padding:'5px 9px', borderRadius:7, border:'none', color:'white', cursor:'pointer', fontWeight:700, fontSize:'0.78rem', minWidth:40, background:bg });
    return (
        <div style={{display:'flex',flexDirection:'column',gap:8,alignItems:'center'}}>
            <div style={{background:'#0d1117',borderRadius:10,padding:'9px 22px',fontWeight:700,fontSize:'1.15rem',color:'#f39c12',minWidth:200,textAlign:'center',border:'2px solid rgba(243,156,18,0.3)',minHeight:42,display:'flex',alignItems:'center',justifyContent:'center'}}>
                {polyStr(value)}
            </div>
            <div style={{display:'flex',gap:5,flexWrap:'wrap',justifyContent:'center'}}>
                {Array.from({length:maxDeg+1},(_,d)=>{
                    const lbl=d===0?'1':d===1?'x':`x${SUP[d]||`^${d}`}`;
                    return (
                        <div key={d} style={{display:'flex',flexDirection:'column',gap:3}}>
                            <button style={btnS('#27ae60')} onClick={()=>bump(d,1)}>+{lbl}</button>
                            <button style={btnS('#c0392b')} onClick={()=>bump(d,-1)}>−{lbl}</button>
                        </div>
                    );
                })}
                <div style={{display:'flex',alignItems:'center'}}>
                    <button style={btnS('#566573')} onClick={reset}>Reset</button>
                </div>
            </div>
        </div>
    );
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
const CARD = { background:'#161b22', borderRadius:14, padding:20, border:'1px solid #30363d' };
const BTN = (bg,col='white') => ({ padding:'10px 22px', borderRadius:9, border:'none', background:bg, color:col, fontWeight:700, cursor:'pointer', fontSize:'0.95rem' });

function ScoreLine({ ok, total }) {
    return <span style={{fontSize:'0.85rem',color:'#8b949e'}}>✅ {ok} / {total}</span>;
}

function FeedbackBlock({ result, onNext, label='Siguiente →' }) {
    if(!result) return null;
    return (
        <div style={{display:'flex',flexDirection:'column',gap:10,alignItems:'center',marginTop:12}}>
            <div style={{padding:'10px 20px',borderRadius:10,background:result.ok?'#0d3321':'#2c0d0d',border:`1px solid ${result.ok?'#2ecc71':'#e74c3c'}`,color:result.ok?'#2ecc71':'#e74c3c',fontWeight:700,display:'flex',alignItems:'center',gap:8}}>
                {result.ok ? <CheckCircle size={18}/> : <XCircle size={18}/>}
                {result.ok ? '¡Correcto!' : (result.msg || 'Incorrecto')}
            </div>
            {result.explanation && <div style={{fontSize:'0.85rem',color:'#8b949e',textAlign:'center'}}>{result.explanation}</div>}
            <button style={BTN('#f39c12','#111')} onClick={onNext}>{label}</button>
        </div>
    );
}

// ─── Module colors ────────────────────────────────────────────────────────────
const MOD_COLORS = ['#9b59b6','#3498db','#27ae60','#f39c12','#e74c3c','#1abc9c','#e67e22'];
const MODULES = [
    { id:'terminologia',  label:'1. Terminología',        short:'1.' },
    { id:'valores',       label:'2. Valores Numéricos',   short:'2.' },
    { id:'monomios',      label:'3. Ops. Monomios',       short:'3.' },
    { id:'polinomios',    label:'4. Ops. Polinomios',     short:'4.' },
    { id:'ruffini',       label:'5. División Ruffini',    short:'5.' },
    { id:'identidades',   label:'6. Identidades Notables',short:'6.' },
    { id:'factorizacion', label:'7. Factorización',       short:'7.' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 1 — Terminología de monomios
// ═══════════════════════════════════════════════════════════════════════════════
function genMono() {
    const deg = rInt(0,5);
    const coef = rInt(-9,9,0);
    return { coef, deg };
}
function M1_Terminologia({ onScore }) {
    const genEj = () => Array.from({length:5}, genMono);
    const [monos, setMonos] = useState(genEj);
    const [resp, setResp] = useState(Array.from({length:5},()=>({coef:'',lit:'',grado:''})));
    const [checked, setChecked] = useState(null);
    const [score, setScore] = useState({ok:0,total:0});

    const setR = (i,k,v) => setResp(r => { const n=[...r]; n[i]={...n[i],[k]:v}; return n; });

    const comprobar = () => {
        const results = monos.map((m,i) => {
            const r = resp[i];
            const coefOk = parseInt(r.coef) === m.coef;
            const litOk  = r.lit === monoLit(m.deg);
            const gradoOk = parseInt(r.grado) === m.deg;
            return {coefOk, litOk, gradoOk, ok: coefOk&&litOk&&gradoOk};
        });
        const okCount = results.filter(r=>r.ok).length;
        setChecked(results);
        setScore(s => ({ok:s.ok+okCount, total:s.total+5}));
        onScore(okCount, 5);
    };

    const nuevo = () => {
        setMonos(genEj());
        setResp(Array.from({length:5},()=>({coef:'',lit:'',grado:''})));
        setChecked(null);
    };

    const litOptions = [0,1,2,3,4,5].map(d => ({val:monoLit(d), lbl:monoLit(d)==='1'?'1 (cte)':monoLit(d)}));
    const inS = ok => ({padding:'5px 8px',borderRadius:6,border:`1.5px solid ${ok===undefined?'#30363d':ok?'#27ae60':'#e74c3c'}`,background:'#0d1117',color:'#e6edf3',width:'70px',textAlign:'center'});
    const selS = ok => ({...inS(ok),cursor:'pointer'});

    return (
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <p style={{margin:0,color:'#8b949e',fontSize:'0.9rem'}}>Rellena el coeficiente, la parte literal y el grado de cada monomio.</p>
            <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',minWidth:420}}>
                    <thead>
                        <tr style={{color:'#8b949e',fontSize:'0.82rem',textAlign:'center'}}>
                            <th style={{padding:'8px 12px',textAlign:'left',borderBottom:'1px solid #30363d'}}>Monomio</th>
                            <th style={{padding:'8px',borderBottom:'1px solid #30363d'}}>Coeficiente</th>
                            <th style={{padding:'8px',borderBottom:'1px solid #30363d'}}>Parte literal</th>
                            <th style={{padding:'8px',borderBottom:'1px solid #30363d'}}>Grado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {monos.map((m,i) => {
                            const chk = checked?.[i];
                            return (
                                <tr key={i} style={{borderBottom:'1px solid #21262d'}}>
                                    <td style={{padding:'10px 12px',fontWeight:700,fontSize:'1.1rem',color:'#f39c12',fontFamily:'Georgia,serif'}}>
                                        {monoDisp(m.coef, m.deg)}
                                    </td>
                                    <td style={{padding:'8px',textAlign:'center'}}>
                                        <input type="number" value={resp[i].coef} onChange={e=>setR(i,'coef',e.target.value)} disabled={!!checked} style={inS(chk?.coefOk)} />
                                    </td>
                                    <td style={{padding:'8px',textAlign:'center'}}>
                                        <select value={resp[i].lit} onChange={e=>setR(i,'lit',e.target.value)} disabled={!!checked} style={selS(chk?.litOk)}>
                                            <option value="">—</option>
                                            {litOptions.map(o=><option key={o.val} value={o.val}>{o.lbl}</option>)}
                                        </select>
                                    </td>
                                    <td style={{padding:'8px',textAlign:'center'}}>
                                        <input type="number" value={resp[i].grado} onChange={e=>setR(i,'grado',e.target.value)} disabled={!!checked} style={inS(chk?.gradoOk)} />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
                {!checked
                    ? <button style={BTN('#f39c12','#111')} onClick={comprobar}>Comprobar</button>
                    : <button style={BTN('#3498db')} onClick={nuevo}><RefreshCw size={14} style={{marginRight:6,verticalAlign:'middle'}}/>Nuevo ejercicio</button>
                }
                <ScoreLine ok={score.ok} total={score.total}/>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 2 — Valores numéricos
// ═══════════════════════════════════════════════════════════════════════════════
function M2_Valores({ onScore }) {
    const genEj = () => {
        const deg = rInt(2,3);
        const coeffs = Array.from({length:deg+1}, (_,d) => d===deg ? rInt(1,5,0) : rInt(-4,4));
        const xPos = rInt(2,4); const xNeg = rInt(-3,-1);
        return { coeffs, xPos, xNeg, xCero:0,
            ansPos: evalPoly(coeffs, xPos), ansNeg: evalPoly(coeffs, xNeg), ansCero: evalPoly(coeffs, 0) };
    };
    const [ej, setEj] = useState(genEj);
    const [resp, setResp] = useState({pos:'',neg:'',cero:''});
    const [result, setResult] = useState(null);
    const [score, setScore] = useState({ok:0,total:0});

    const comprobar = () => {
        const posOk  = parseFloat(resp.pos) === ej.ansPos;
        const negOk  = parseFloat(resp.neg) === ej.ansNeg;
        const ceroOk = parseFloat(resp.cero) === ej.ansCero;
        const ok = posOk&&negOk&&ceroOk;
        const cnt = [posOk,negOk,ceroOk].filter(Boolean).length;
        setResult({ok, msg: ok ? '¡Correcto!' : `${cnt}/3 correctos. Revisa los cálculos.`,
            explanation:`p(${ej.xPos})=${ej.ansPos}, p(${ej.xNeg})=${ej.ansNeg}, p(0)=${ej.ansCero}`});
        setScore(s=>({ok:s.ok+cnt,total:s.total+3}));
        onScore(cnt,3);
    };
    const nuevo = () => { setEj(genEj()); setResp({pos:'',neg:'',cero:''}); setResult(null); };

    const inS = { padding:'8px 12px', borderRadius:7, border:'1.5px solid #30363d', background:'#0d1117', color:'#e6edf3', width:100, textAlign:'center', fontSize:'1rem' };

    return (
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <p style={{margin:0,color:'#8b949e',fontSize:'0.9rem'}}>Calcula el valor numérico del polinomio para cada valor de x.</p>
            <div style={{...CARD,textAlign:'center'}}>
                <div style={{fontSize:'0.85rem',color:'#8b949e',marginBottom:6}}>p(x) =</div>
                <div style={{fontSize:'1.5rem',fontWeight:700,color:'#f39c12',fontFamily:'Georgia,serif'}}>{polyStr(ej.coeffs)}</div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {[
                    {lbl:`p(${ej.xPos}) =`, key:'pos', x:ej.xPos},
                    {lbl:`p(${ej.xNeg}) =`, key:'neg', x:ej.xNeg},
                    {lbl:`p(0) =`,           key:'cero',x:0},
                ].map(({lbl,key})=>(
                    <div key={key} style={{display:'flex',alignItems:'center',gap:12}}>
                        <span style={{fontWeight:700,color:'#e6edf3',minWidth:90,fontFamily:'Georgia,serif'}}>{lbl}</span>
                        <input type="number" value={resp[key]} onChange={e=>setResp(r=>({...r,[key]:e.target.value}))} disabled={!!result} style={inS}/>
                    </div>
                ))}
            </div>
            {!result
                ? <button style={BTN('#f39c12','#111')} onClick={comprobar}>Comprobar</button>
                : <FeedbackBlock result={result} onNext={nuevo}/>
            }
            <ScoreLine ok={score.ok} total={score.total}/>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 3 — Operaciones con monomios
// ═══════════════════════════════════════════════════════════════════════════════
function M3_Monomios({ onScore }) {
    const [opMode, setOpMode] = useState('SUMA');
    const [score, setScore] = useState({ok:0,total:0});

    const genEj = useCallback((mode) => {
        const m = mode==='COMBINADO' ? rItem(['SUMA','RESTA','MULT']) : mode;
        if(m==='SUMA' || m==='RESTA') {
            const deg=rInt(1,4); const c1=rInt(-9,9,0); const c2=rInt(-9,9,0);
            const ans=Array(deg+1).fill(0); ans[deg]=m==='SUMA'?c1+c2:c1-c2;
            const opStr=m==='SUMA'?'+':'−';
            return {expr:`${monoDisp(c1,deg)} ${opStr} ${monoDisp(c2,deg)}`, ans};
        } else {
            const d1=rInt(0,2); const d2=rInt(0,3-d1); const c1=rInt(-9,9,0); const c2=rInt(-9,9,0);
            const ans=Array(d1+d2+1).fill(0); ans[d1+d2]=c1*c2;
            return {expr:`(${monoDisp(c1,d1)}) · (${monoDisp(c2,d2)})`, ans};
        }
    }, []);

    const [ej, setEj] = useState(() => genEj('SUMA'));
    const [resp, setResp] = useState([0,0,0,0,0,0]);
    const [result, setResult] = useState(null);

    const cambiarModo = (m) => { setOpMode(m); setEj(genEj(m)); setResp([0,0,0,0,0,0]); setResult(null); };
    const nuevo = () => { setEj(genEj(opMode)); setResp([0,0,0,0,0,0]); setResult(null); };

    const comprobar = () => {
        const ok = polyEq(normPoly(resp), normPoly(ej.ans));
        setResult({ok, msg: ok?'¡Correcto!':'Incorrecto. La respuesta es: '+polyStr(ej.ans)});
        setScore(s=>({ok:s.ok+(ok?1:0),total:s.total+1}));
        onScore(ok?1:0,1);
    };

    const MODOS = ['SUMA','RESTA','MULT','COMBINADO'];
    return (
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {MODOS.map(m=>(
                    <button key={m} onClick={()=>cambiarModo(m)} style={{padding:'6px 14px',borderRadius:8,border:`2px solid ${opMode===m?'#27ae60':'#30363d'}`,background:opMode===m?'#0d3321':'transparent',color:'white',cursor:'pointer',fontWeight:opMode===m?700:400}}>
                        {m==='SUMA'?'Suma':m==='RESTA'?'Resta':m==='MULT'?'Multiplicación':'Combinado'}
                    </button>
                ))}
            </div>
            <div style={{...CARD,textAlign:'center'}}>
                <div style={{fontSize:'1.4rem',fontWeight:700,color:'#e6edf3',fontFamily:'Georgia,serif'}}>{ej.expr}</div>
                <div style={{fontSize:'0.85rem',color:'#8b949e',marginTop:4}}>= ?</div>
            </div>
            <p style={{margin:0,color:'#8b949e',fontSize:'0.88rem'}}>Construye la respuesta con los botones:</p>
            <PolyInput value={resp} onChange={setResp} maxDeg={5}/>
            {!result
                ? <button style={BTN('#f39c12','#111')} onClick={comprobar}>Comprobar</button>
                : <FeedbackBlock result={result} onNext={nuevo}/>
            }
            <ScoreLine ok={score.ok} total={score.total}/>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 4 — Operaciones con polinomios
// ═══════════════════════════════════════════════════════════════════════════════
function M4_Polinomios({ onScore }) {
    const [opMode, setOpMode] = useState('SUMA');
    const [score, setScore] = useState({ok:0,total:0});

    const genPoly = (maxDeg) => {
        const deg=rInt(1,maxDeg);
        const c=Array.from({length:deg+1},(_,i)=>i===deg?rInt(1,5,0):rInt(-4,4));
        return c;
    };

    const genEj = useCallback((mode) => {
        const m = mode==='COMBINADO' ? rItem(['SUMA','RESTA','MULT']) : mode;
        const p=genPoly(2); const q=genPoly(m==='MULT'?1:2);
        let ans, expr;
        if(m==='SUMA')  { ans=addPoly(p,q); expr=`(${polyStr(p)}) + (${polyStr(q)})`; }
        else if(m==='RESTA') { ans=subPoly(p,q); expr=`(${polyStr(p)}) − (${polyStr(q)})`; }
        else { ans=mulPoly(p,q); expr=`(${polyStr(p)}) · (${polyStr(q)})`; }
        return {expr, ans: normPoly(ans)};
    }, []);

    const [ej, setEj] = useState(() => genEj('SUMA'));
    const [resp, setResp] = useState([0,0,0,0,0,0]);
    const [result, setResult] = useState(null);

    const cambiarModo = m => { setOpMode(m); setEj(genEj(m)); setResp([0,0,0,0,0,0]); setResult(null); };
    const nuevo = () => { setEj(genEj(opMode)); setResp([0,0,0,0,0,0]); setResult(null); };
    const comprobar = () => {
        const ok = polyEq(normPoly(resp), ej.ans);
        setResult({ok, msg: ok?'¡Correcto!':'Incorrecto. La respuesta es: '+polyStr(ej.ans)});
        setScore(s=>({ok:s.ok+(ok?1:0),total:s.total+1}));
        onScore(ok?1:0,1);
    };

    const MODOS = ['SUMA','RESTA','MULT','COMBINADO'];
    return (
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {MODOS.map(m=>(
                    <button key={m} onClick={()=>cambiarModo(m)} style={{padding:'6px 14px',borderRadius:8,border:`2px solid ${opMode===m?'#f39c12':'#30363d'}`,background:opMode===m?'#2d1e00':'transparent',color:'white',cursor:'pointer',fontWeight:opMode===m?700:400}}>
                        {m==='SUMA'?'Suma':m==='RESTA'?'Resta':m==='MULT'?'Multiplicación':'Combinado'}
                    </button>
                ))}
            </div>
            <div style={{...CARD,textAlign:'center'}}>
                <div style={{fontSize:'1.2rem',fontWeight:700,color:'#e6edf3',fontFamily:'Georgia,serif',lineHeight:1.6}}>{ej.expr}</div>
                <div style={{fontSize:'0.85rem',color:'#8b949e',marginTop:4}}>= ?</div>
            </div>
            <p style={{margin:0,color:'#8b949e',fontSize:'0.88rem'}}>Construye la respuesta con los botones:</p>
            <PolyInput value={resp} onChange={setResp} maxDeg={5}/>
            {!result
                ? <button style={BTN('#f39c12','#111')} onClick={comprobar}>Comprobar</button>
                : <FeedbackBlock result={result} onNext={nuevo}/>
            }
            <ScoreLine ok={score.ok} total={score.total}/>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 5 — División de Ruffini
// ═══════════════════════════════════════════════════════════════════════════════
function RuffiniTable({ descCoeffs, root, studentRow, onCellChange, checked }) {
    const n = descCoeffs.length;
    const correctRow = ruffiniRow(descCoeffs, root);
    const middleRow = correctRow.map((q,i) => i===0 ? null : root*correctRow[i-1]);

    const cellS = (extra={}) => ({ padding:'8px 14px', minWidth:52, textAlign:'center', fontWeight:700, fontSize:'1rem', ...extra });

    const cellColor = (i) => {
        if(!checked) return '#e6edf3';
        return studentRow[i] === correctRow[i] ? '#2ecc71' : '#e74c3c';
    };

    return (
        <div style={{overflowX:'auto',marginTop:8}}>
            <table style={{borderCollapse:'collapse',margin:'0 auto',background:'#0d1117',borderRadius:10,overflow:'hidden',border:'1px solid #30363d'}}>
                <tbody>
                    {/* Top row: dividend coefficients */}
                    <tr style={{borderBottom:'1px solid #30363d'}}>
                        <td style={cellS({borderRight:'2px solid #f39c12',color:'#f39c12'})}>{root>0?`+${root}`:root}</td>
                        {descCoeffs.map((c,i)=>(
                            <td key={i} style={cellS({color:'#e6edf3',borderLeft:i>0?'1px solid #30363d':'none'})}>{c}</td>
                        ))}
                    </tr>
                    {/* Middle row: products (shown after check) */}
                    <tr style={{borderBottom:'2px solid #566573'}}>
                        <td style={cellS({borderRight:'2px solid #f39c12'})}></td>
                        {descCoeffs.map((_,i)=>(
                            <td key={i} style={cellS({color:'#3498db',borderLeft:i>0?'1px solid #30363d':'none',fontSize:'0.9rem'})}>
                                {checked && i>0 ? middleRow[i] : ''}
                            </td>
                        ))}
                    </tr>
                    {/* Bottom row: student input */}
                    <tr>
                        <td style={cellS({borderRight:'2px solid #f39c12'})}></td>
                        {descCoeffs.map((_,i)=>(
                            <td key={i} style={{padding:'4px',borderLeft:i>0?'1px solid #30363d':'none',textAlign:'center'}}>
                                <input
                                    type="number"
                                    value={studentRow[i]??''}
                                    onChange={e=>onCellChange(i,parseInt(e.target.value)||0)}
                                    disabled={!!checked}
                                    style={{width:52,padding:'6px 4px',borderRadius:6,border:`1.5px solid ${!checked?'#566573':studentRow[i]===correctRow[i]?'#27ae60':'#e74c3c'}`,background:'#161b22',color:cellColor(i),textAlign:'center',fontWeight:700,fontSize:'0.95rem'}}
                                />
                            </td>
                        ))}
                    </tr>
                </tbody>
            </table>
            {checked && (
                <div style={{marginTop:10,textAlign:'center',fontSize:'0.85rem',color:'#8b949e'}}>
                    Cociente: <b style={{color:'#2ecc71'}}>{polyStr(toAsc(correctRow.slice(0,-1)))}</b>
                    &nbsp;&nbsp;Resto: <b style={{color:correctRow[n-1]===0?'#2ecc71':'#e74c3c'}}>{correctRow[n-1]}</b>
                </div>
            )}
        </div>
    );
}

function M5_Ruffini({ onScore }) {
    const genEj = () => {
        const root = rInt(-5,5,0);
        // Generate quotient poly of degree 2 with non-zero leading coeff
        const qAsc = [rInt(-4,4), rInt(-4,4), rInt(1,4)]; // ax²+bx+c (ascending)
        const divisorAsc = [-root, 1]; // (x - root)
        const dividendAsc = mulPoly(qAsc, divisorAsc);
        const descDiv = toDesc(dividendAsc);
        return { descDiv, root, correctRow: ruffiniRow(descDiv, root) };
    };
    const [ej, setEj] = useState(genEj);
    const [cells, setCells] = useState(() => Array(ej.descDiv.length).fill(''));
    const [checked, setChecked] = useState(false);
    const [result, setResult] = useState(null);
    const [score, setScore] = useState({ok:0,total:0});

    const onCell = (i,v) => setCells(c => { const n=[...c]; n[i]=v; return n; });

    const comprobar = () => {
        const ok = cells.every((v,i) => parseInt(v) === ej.correctRow[i]);
        setChecked(true);
        setResult({ok, msg:ok?'¡Correcto!':'Hay valores incorrectos en la tabla (marcados en rojo).'});
        setScore(s=>({ok:s.ok+(ok?1:0),total:s.total+1}));
        onScore(ok?1:0,1);
    };

    const nuevo = () => { const e=genEj(); setEj(e); setCells(Array(e.descDiv.length).fill('')); setChecked(false); setResult(null); };

    const dividend = polyStr(toAsc(ej.descDiv));
    const divisorStr = ej.root>0 ? `x − ${ej.root}` : `x + ${Math.abs(ej.root)}`;

    return (
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <p style={{margin:0,color:'#8b949e',fontSize:'0.9rem'}}>Aplica el algoritmo de Ruffini para dividir el polinomio. Rellena la fila inferior de la tabla.</p>
            <div style={{...CARD,textAlign:'center'}}>
                <div style={{fontSize:'1.15rem',fontWeight:700,color:'#e6edf3',fontFamily:'Georgia,serif'}}>
                    <span style={{color:'#f39c12'}}>{dividend}</span> ÷ <span style={{color:'#e74c3c'}}>({divisorStr})</span>
                </div>
            </div>
            <div style={{fontSize:'0.82rem',color:'#8b949e'}}>La fila de arriba son los coeficientes del dividendo (orden descendente). La última celda de la fila inferior es el resto.</div>
            <RuffiniTable descCoeffs={ej.descDiv} root={ej.root} studentRow={cells} onCellChange={onCell} checked={checked}/>
            {!result
                ? <button style={BTN('#f39c12','#111')} onClick={comprobar}>Comprobar</button>
                : <FeedbackBlock result={result} onNext={nuevo}/>
            }
            <ScoreLine ok={score.ok} total={score.total}/>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 6 — Identidades notables
// ═══════════════════════════════════════════════════════════════════════════════
const IDENTIDADES = [
    { id:0, name:'Cuadrado de una suma', pattern:'(ax + b)²' },
    { id:1, name:'Cuadrado de una diferencia', pattern:'(ax − b)²' },
    { id:2, name:'Producto de suma por diferencia', pattern:'(ax + b)(ax − b)' },
];

function M6_Identidades({ onScore }) {
    const genEj = () => {
        const tipo = rInt(0,2);
        const a = rInt(1,4); const b = rInt(1,9);
        let expr, ans;
        if(tipo===0) {
            expr=`(${a===1?'':a}x + ${b})²`;
            ans=[b*b, 2*a*b, a*a];
        } else if(tipo===1) {
            expr=`(${a===1?'':a}x − ${b})²`;
            ans=[b*b, -2*a*b, a*a];
        } else {
            expr=`(${a===1?'':a}x + ${b})(${a===1?'':a}x − ${b})`;
            ans=[-b*b, 0, a*a];
        }
        return { tipo, a, b, expr, ans };
    };
    const [ej, setEj] = useState(genEj);
    const [resp, setResp] = useState([0,0,0]);
    const [result, setResult] = useState(null);
    const [score, setScore] = useState({ok:0,total:0});

    const comprobar = () => {
        const ok = polyEq(normPoly(resp.slice(0,3)), normPoly(ej.ans));
        const hint = ej.tipo===2 ? 'Recuerda: (a+b)(a−b) = a² − b²' : ej.tipo===0 ? 'Recuerda: (a+b)² = a² + 2ab + b²' : 'Recuerda: (a−b)² = a² − 2ab + b²';
        setResult({ok, msg:ok?'¡Correcto!':'Incorrecto. '+polyStr(ej.ans), explanation: !ok ? hint : ''});
        setScore(s=>({ok:s.ok+(ok?1:0),total:s.total+1}));
        onScore(ok?1:0,1);
    };
    const nuevo = () => { setEj(genEj()); setResp([0,0,0]); setResult(null); };

    return (
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div style={{...CARD,display:'flex',flexDirection:'column',gap:8}}>
                <div style={{fontSize:'0.8rem',color:'#8b949e'}}>Identidad: <b style={{color:'#1abc9c'}}>{IDENTIDADES[ej.tipo].name}</b></div>
                <div style={{fontSize:'1.5rem',fontWeight:700,color:'#f39c12',textAlign:'center',fontFamily:'Georgia,serif'}}>{ej.expr}</div>
                <div style={{fontSize:'0.85rem',color:'#8b949e',textAlign:'center'}}>Desarrolla y escribe el resultado usando los botones</div>
            </div>
            <div style={{...CARD,background:'#0d1d1a',border:'1px solid #1abc9c22'}}>
                <div style={{fontSize:'0.8rem',color:'#1abc9c',marginBottom:8,fontWeight:700}}>📐 Las tres identidades notables:</div>
                {[
                    '(a+b)² = a² + 2ab + b²',
                    '(a−b)² = a² − 2ab + b²',
                    '(a+b)(a−b) = a² − b²',
                ].map((f,i)=><div key={i} style={{fontFamily:'Georgia,serif',fontSize:'0.9rem',color:'#8b949e',padding:'2px 0'}}>{f}</div>)}
            </div>
            <PolyInput value={resp} onChange={setResp} maxDeg={2}/>
            {!result
                ? <button style={BTN('#f39c12','#111')} onClick={comprobar}>Comprobar</button>
                : <FeedbackBlock result={result} onNext={nuevo}/>
            }
            <ScoreLine ok={score.ok} total={score.total}/>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 7 — Factorización por Ruffini
// ═══════════════════════════════════════════════════════════════════════════════
function M7_Factorizacion({ onScore }) {
    const genEj = () => {
        const numRoots = rInt(2,3);
        const pool = shuffle([-4,-3,-2,-1,1,2,3,4]);
        const roots = pool.slice(0, numRoots);
        let poly = [1];
        roots.forEach(r => { poly = mulPoly(poly, [-r, 1]); });
        poly = normPoly(poly);
        return { roots: [...roots].sort((a,b)=>a-b), poly };
    };

    const [ej, setEj] = useState(genEj);
    const [currentPoly, setCurrentPoly] = useState(ej.poly);
    const [foundRoots, setFoundRoots] = useState([]);
    const [testInput, setTestInput] = useState('');
    const [testResult, setTestResult] = useState(null);
    const [steps, setSteps] = useState([]);
    const [done, setDone] = useState(false);
    const [showHint, setShowHint] = useState(false);
    const [score, setScore] = useState({ok:0,total:0});

    const nuevo = () => {
        const e = genEj();
        setEj(e); setCurrentPoly(e.poly); setFoundRoots([]); setTestInput('');
        setTestResult(null); setSteps([]); setDone(false); setShowHint(false);
    };

    const probarRaiz = () => {
        const val = parseInt(testInput);
        if(isNaN(val)) return;
        const ev = evalPoly(currentPoly, val);
        if(ev === 0) {
            const desc = toDesc(currentPoly);
            const row = ruffiniRow(desc, val);
            const newDescQuotient = row.slice(0,-1);
            const newPoly = toAsc(newDescQuotient);
            const newFound = [...foundRoots, val];
            const newSteps = [...steps, {root:val, descCoeffs:desc, row}];
            setSteps(newSteps);
            setFoundRoots(newFound);
            setCurrentPoly(normPoly(newPoly));
            setTestInput('');
            setTestResult({ok:true, msg:`✅ ¡${val} es raíz! p(${val}) = 0`});
            // Check if fully factored (degree 1 remaining or all roots found)
            if(normPoly(newPoly).length <= 2 || newFound.length >= ej.roots.length) {
                setDone(true);
                setScore(s=>({ok:s.ok+1,total:s.total+1}));
                onScore(1,1);
            }
        } else {
            setTestResult({ok:false, msg:`❌ ${val} no es raíz: p(${val}) = ${ev}`});
        }
        setTimeout(()=>setTestResult(null), 2500);
    };

    const termIndep = Math.abs(ej.poly[0]);
    const divisors = Array.from({length:termIndep*2},(_,i)=>i-termIndep).filter(v=>v!==0&&termIndep%Math.abs(v)===0);

    return (
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <p style={{margin:0,color:'#8b949e',fontSize:'0.9rem'}}>
                Encuentra las raíces enteras del polinomio usando Ruffini y escribe su factorización.
            </p>
            <div style={{...CARD,textAlign:'center'}}>
                <div style={{fontSize:'0.85rem',color:'#8b949e',marginBottom:6}}>p(x) =</div>
                <div style={{fontSize:'1.4rem',fontWeight:700,color:'#f39c12',fontFamily:'Georgia,serif'}}>{polyStr(ej.poly)}</div>
            </div>

            {/* Hint */}
            <button onClick={()=>setShowHint(v=>!v)} style={{...BTN('transparent'),border:'1px solid #30363d',color:'#8b949e',display:'flex',alignItems:'center',gap:6,alignSelf:'flex-start'}}>
                {showHint?<ChevronUp size={14}/>:<ChevronDown size={14}/>} Pista: divisores del término independiente
            </button>
            {showHint && <div style={{...CARD,background:'#1a1a2e'}}>
                <div style={{fontSize:'0.85rem',color:'#8b949e'}}>
                    Término independiente: <b style={{color:'#f39c12'}}>{ej.poly[0]}</b> → posibles raíces enteras: <b style={{color:'#e67e22'}}>{divisors.join(', ')}</b>
                </div>
            </div>}

            {/* Root tester */}
            {!done && (
                <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
                    <span style={{color:'#8b949e',fontSize:'0.9rem'}}>Prueba x =</span>
                    <input type="number" value={testInput} onChange={e=>setTestInput(e.target.value)}
                        onKeyDown={e=>e.key==='Enter'&&probarRaiz()}
                        style={{width:80,padding:'8px 12px',borderRadius:7,border:'1.5px solid #30363d',background:'#0d1117',color:'#e6edf3',textAlign:'center',fontSize:'1rem'}}
                    />
                    <button style={BTN('#e67e22')} onClick={probarRaiz}>Comprobar raíz</button>
                    {testResult && <span style={{color:testResult.ok?'#2ecc71':'#e74c3c',fontWeight:700,fontSize:'0.9rem'}}>{testResult.msg}</span>}
                </div>
            )}

            {/* Ruffini steps */}
            {steps.length>0 && (
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                    <div style={{fontSize:'0.85rem',color:'#8b949e',fontWeight:700}}>Pasos de Ruffini realizados:</div>
                    {steps.map((st,idx)=>(
                        <div key={idx} style={{...CARD,background:'#0d1117'}}>
                            <div style={{fontSize:'0.82rem',color:'#e67e22',marginBottom:6}}>Paso {idx+1}: raíz = {st.root}</div>
                            <div style={{overflowX:'auto'}}>
                                <table style={{borderCollapse:'collapse',fontSize:'0.9rem'}}>
                                    <tbody>
                                        <tr><td style={{padding:'4px 10px',color:'#e67e22',borderRight:'2px solid #e67e22',fontWeight:700}}>{st.root}</td>
                                            {st.descCoeffs.map((c,i)=><td key={i} style={{padding:'4px 10px',color:'#e6edf3',borderLeft:i>0?'1px solid #30363d':'none',textAlign:'center',fontWeight:700}}>{c}</td>)}
                                        </tr>
                                        <tr style={{borderBottom:'2px solid #566573'}}>
                                            <td style={{padding:'4px 10px',borderRight:'2px solid #e67e22'}}></td>
                                            {st.row.map((q,i)=><td key={i} style={{padding:'4px 10px',color:'#3498db',borderLeft:i>0?'1px solid #30363d':'none',textAlign:'center'}}>
                                                {i>0?st.root*st.row[i-1]:''}
                                            </td>)}
                                        </tr>
                                        <tr>
                                            <td style={{padding:'4px 10px',borderRight:'2px solid #e67e22'}}></td>
                                            {st.row.map((q,i)=><td key={i} style={{padding:'4px 10px',color:i===st.row.length-1?'#e74c3c':'#2ecc71',borderLeft:i>0?'1px solid #30363d':'none',textAlign:'center',fontWeight:700}}>{q}</td>)}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Result */}
            {done && (
                <div style={{...CARD,background:'#0d3321',border:'1px solid #27ae60',textAlign:'center'}}>
                    <CheckCircle size={28} color="#2ecc71" style={{marginBottom:8}}/>
                    <div style={{color:'#2ecc71',fontWeight:700,fontSize:'1rem',marginBottom:10}}>¡Factorización completada!</div>
                    <div style={{fontSize:'1.2rem',fontFamily:'Georgia,serif',color:'#f39c12',fontWeight:700}}>
                        p(x) = {foundRoots.map(r=>factorStr(r)).join('')}
                        {normPoly(currentPoly).length===2 && currentPoly[1]!==1 && `· ${currentPoly[1]}`}
                    </div>
                    <div style={{fontSize:'0.8rem',color:'#8b949e',marginTop:6}}>Raíces encontradas: {foundRoots.join(', ')}</div>
                    <button style={{...BTN('#3498db'),marginTop:14}} onClick={nuevo}><RefreshCw size={14} style={{marginRight:6,verticalAlign:'middle'}}/>Nuevo polinomio</button>
                </div>
            )}
            <ScoreLine ok={score.ok} total={score.total}/>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN — AlgebraApp
// ═══════════════════════════════════════════════════════════════════════════════
export default function AlgebraApp({ onExit, usuario }) {
    const [modIdx, setModIdx] = useState(0);
    const [totals, setTotals] = useState(Array(7).fill(null).map(()=>({ok:0,total:0})));
    const [enviado, setEnviado] = useState(false);
    const [enviando, setEnviando] = useState(false);

    const handleScore = (modI) => (ok, total) => {
        setTotals(t => { const n=[...t]; n[modI]={ok:n[modI].ok+ok, total:n[modI].total+total}; return n; });
    };

    const totalOk    = totals.reduce((s,t)=>s+t.ok,0);
    const totalTotal = totals.reduce((s,t)=>s+t.total,0);

    const enviar = async () => {
        if(!usuario) { alert('Necesitas iniciar sesión para enviar resultados.'); return; }
        setEnviando(true);
        try {
            await addDoc(collection(db,'results'),{
                uid: usuario.uid,
                nombre: usuario.displayName || 'Alumno',
                email: usuario.email || '',
                tipoJuego: 'ALGEBRA',
                puntuacion: totalOk,
                aciertos: totalOk,
                total: totalTotal,
                modulos: totals.map((t,i)=>({modulo:MODULES[i].label,...t})),
                fecha: serverTimestamp(),
            });
            setEnviado(true);
        } catch(e) { alert('Error al enviar: '+e.message); }
        finally { setEnviando(false); }
    };

    const compartir = () => {
        const url = 'https://pikt.es/?juego=ALGEBRA';
        if(navigator.share) navigator.share({title:'Álgebra - PiKT', text:'Practica álgebra', url}).catch(()=>{});
        else navigator.clipboard.writeText(url).then(()=>alert('✅ Enlace copiado'));
    };

    const color = MOD_COLORS[modIdx];

    const MODS_JSX = [
        <M1_Terminologia  onScore={handleScore(0)}/>,
        <M2_Valores       onScore={handleScore(1)}/>,
        <M3_Monomios      onScore={handleScore(2)}/>,
        <M4_Polinomios    onScore={handleScore(3)}/>,
        <M5_Ruffini       onScore={handleScore(4)}/>,
        <M6_Identidades   onScore={handleScore(5)}/>,
        <M7_Factorizacion onScore={handleScore(6)}/>,
    ];

    return (
        <div style={{minHeight:'100vh',background:'#0d1117',color:'#e6edf3',fontFamily:"'Segoe UI',sans-serif",display:'flex',flexDirection:'column'}}>
            {/* Header */}
            <div style={{padding:'12px 16px',background:'#161b22',borderBottom:'1px solid #30363d',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                    <button onClick={onExit} style={{background:'transparent',border:'1px solid #30363d',color:'#8b949e',padding:'6px 12px',borderRadius:7,cursor:'pointer'}}>← Salir</button>
                    <span style={{fontWeight:700,fontSize:'1.1rem'}}>✖️ Álgebra</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <span style={{fontSize:'0.85rem',color:'#8b949e'}}>Total: {totalOk}/{totalTotal}</span>
                    <button onClick={compartir} style={{background:'transparent',border:'1px solid #30363d',color:'#8b949e',padding:'6px 10px',borderRadius:7,cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>
                        <Share2 size={14}/> Compartir
                    </button>
                    <button onClick={enviar} disabled={enviando||enviado||totalTotal===0}
                        style={{...BTN(enviado?'#27ae60':totalTotal===0?'#21262d':'#3498db'),display:'flex',alignItems:'center',gap:6,opacity:totalTotal===0?0.5:1}}>
                        <Send size={14}/>{enviado?'Enviado':'Enviar al profesor'}
                    </button>
                </div>
            </div>

            {/* Module tabs */}
            <div style={{display:'flex',overflowX:'auto',background:'#161b22',borderBottom:'1px solid #30363d',padding:'0 8px'}}>
                {MODULES.map((m,i)=>(
                    <button key={m.id} onClick={()=>setModIdx(i)}
                        style={{padding:'10px 14px',border:'none',borderBottom:modIdx===i?`3px solid ${MOD_COLORS[i]}`:'3px solid transparent',background:'transparent',color:modIdx===i?MOD_COLORS[i]:'#8b949e',cursor:'pointer',whiteSpace:'nowrap',fontWeight:modIdx===i?700:400,fontSize:'0.82rem',transition:'color 0.2s'}}>
                        {m.short} {m.label.split('. ')[1]}
                        {totals[i].total>0 && <span style={{marginLeft:6,fontSize:'0.7rem',opacity:0.7}}>{totals[i].ok}/{totals[i].total}</span>}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div style={{flex:1,padding:20,maxWidth:740,width:'100%',margin:'0 auto',boxSizing:'border-box'}}>
                <div style={{...CARD,borderColor:color+'44',marginBottom:16}}>
                    <div style={{fontWeight:700,fontSize:'1rem',color:color,marginBottom:4}}>{MODULES[modIdx].label}</div>
                    <div style={{fontSize:'0.8rem',color:'#8b949e'}}>
                        {['Identifica los componentes de un monomio: coeficiente, parte literal y grado.',
                          'Sustituye x por un valor numérico y evalúa la expresión.',
                          'Suma, resta y multiplica monomios semejantes.',
                          'Opera con polinomios de dos o tres términos.',
                          'Divide un polinomio por (x±a) usando el esquema de Ruffini.',
                          'Aplica las tres identidades notables para desarrollar expresiones cuadráticas.',
                          'Encuentra las raíces enteras de un polinomio y escribe su factorización como producto de factores lineales.'][modIdx]}
                    </div>
                </div>
                {MODS_JSX[modIdx]}
            </div>
        </div>
    );
}
