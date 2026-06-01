// Estadistica.jsx — Laboratorio de Estadística Descriptiva
import React, { useState, useRef, useEffect } from 'react';
import { db } from './firebase';
import { addDoc, collection, doc, getDoc } from 'firebase/firestore';
import { BarChart2, CheckCircle, Send, ArrowRight, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';

const D = {
    bg:'#0d1117', card:'#161b22', border:'#30363d',
    text:'#e6edf3', muted:'#8b949e', accent:'#3498db',
    green:'#27ae60', green2:'#2ecc71', red:'#e74c3c',
    gold:'#f39c12', dark2:'#21262d',
};
const CARD = { background:D.card, borderRadius:14, padding:20, border:`1px solid ${D.border}` };
const BTN  = (bg,col='white') => ({ padding:'10px 20px', borderRadius:9, border:'none', background:bg, color:col, fontWeight:700, cursor:'pointer', fontSize:'0.9rem', display:'inline-flex', alignItems:'center', gap:6 });

// ─── Studies ──────────────────────────────────────────────────────────────────
const ESTUDIOS = [
    {
        id:'alturas', W:8,
        titulo:'Alturas en el instituto',
        enunciado:'Se miden las alturas (en cm) de 30 alumnos elegidos al azar de un instituto de Huesca.',
        variable:'La altura en cm', poblacion:'Todos los alumnos del instituto de Huesca', tipo:'Cuantitativa continua',
        generarDatos: () => Array.from({length:30}, () => Math.floor(Math.random()*41)+150),
        opVar:  ['El número de alumnos del instituto','El instituto de Huesca','El peso medio de los alumnos'],
        opPob:  ['30 alumnos del instituto','Los profesores del instituto','La altura media de España'],
        opTipo: ['Cualitativa nominal','Cuantitativa discreta','Cualitativa ordinal'],
    },
    {
        id:'hermanos', W:1,
        titulo:'Número de hermanos',
        enunciado:'Se pregunta a 25 alumnos de 3º ESO por el número de hermanos que tienen.',
        variable:'El número de hermanos', poblacion:'Todos los alumnos de 3º ESO del centro', tipo:'Cuantitativa discreta',
        generarDatos: () => Array.from({length:25}, () => { const r=Math.random(); return r<0.15?0:r<0.45?1:r<0.75?2:r<0.90?3:4; }),
        opVar:  ['El nombre de los alumnos','La clase de 3º ESO','El número de alumnos encuestados'],
        opPob:  ['25 alumnos de 3º ESO','Los hermanos de los alumnos','Los profesores del centro'],
        opTipo: ['Cualitativa nominal','Cuantitativa continua','Cualitativa ordinal'],
    },
    {
        id:'movil', W:2,
        titulo:'Uso diario del móvil',
        enunciado:'Se registra el tiempo diario (en horas) de uso del móvil de 40 jóvenes de un barrio.',
        variable:'El tiempo de uso del móvil (horas)', poblacion:'Todos los jóvenes del barrio', tipo:'Cuantitativa continua',
        generarDatos: () => Array.from({length:40}, () => Math.floor(Math.random()*8)+1),
        opVar:  ['El número de jóvenes del barrio','El modelo de móvil','El barrio de residencia'],
        opPob:  ['40 jóvenes del barrio','Los móviles del barrio','Los padres de los jóvenes'],
        opTipo: ['Cualitativa nominal','Cuantitativa discreta','Cualitativa ordinal'],
    },
    {
        id:'vehiculos', W:1,
        titulo:'Vehículos por familia',
        enunciado:'Se encuesta a 20 familias de un bloque de pisos sobre el número de vehículos que tienen.',
        variable:'El número de vehículos', poblacion:'Todas las familias del bloque de pisos', tipo:'Cuantitativa discreta',
        generarDatos: () => Array.from({length:20}, () => Math.floor(Math.random()*4)),
        opVar:  ['El precio de los vehículos','El número de familias encuestadas','El bloque de pisos'],
        opPob:  ['20 familias del bloque','Los vehículos del bloque','Los propietarios de los coches'],
        opTipo: ['Cualitativa nominal','Cuantitativa continua','Cualitativa ordinal'],
    },
];

// ─── Math helpers ─────────────────────────────────────────────────────────────
const near    = (s, c, pct=1) => { const v=parseFloat(s); if(isNaN(v)) return false; if(Math.abs(c)<0.001) return Math.abs(v)<0.05; return Math.abs(v-c)/Math.abs(c)*100 <= pct; };
const nearInt = (s, c) => parseInt(s) === c;
const shuffle = a => [...a].sort(() => Math.random()-0.5);

const parseIntervalNums = (s) => {
    const m = s.replace(/\s/g,'').match(/[\[\(](-?\d+\.?\d*)[,;](-?\d+\.?\d*)[\]\)]/);
    return m ? { lo:parseFloat(m[1]), hi:parseFloat(m[2]) } : null;
};

function genFilas(datos, W) {
    const sorted = [...datos].sort((a,b)=>a-b);
    const minV=sorted[0], maxV=sorted[sorted.length-1];
    const rows=[];
    let lo=minV;
    while(true) {
        const hi=lo+W;
        const isLast=hi>=maxV;
        const hiD=isLast?maxV:hi;
        const ni=datos.filter(d=>isLast?d>=lo:d>=lo&&d<hi).length;
        rows.push({ lo, hiD, isLast, label:`[${lo}, ${hiD}${isLast?']':')'}`, xi:(lo+hiD)/2, ni });
        if(isLast) break;
        lo=hi;
    }
    return rows;
}

function computeCorrect(datos, estudio) {
    const n=datos.length;
    const isCont=estudio.tipo.includes('continua');
    const minV=Math.min(...datos), maxV=Math.max(...datos);
    let filas;
    if(isCont) {
        filas=genFilas(datos, estudio.W);
    } else {
        filas=[];
        for(let v=minV;v<=maxV;v++) filas.push({ lo:v,hiD:v,isLast:v===maxV,label:String(v),xi:v,ni:datos.filter(d=>d===v).length });
    }
    const sumXiNi=filas.reduce((s,f)=>s+f.xi*f.ni,0);
    const mean=sumXiNi/n;
    filas=filas.map(f=>({...f, pct:f.ni/n*100, xini:f.xi*f.ni, dev2ni:Math.pow(f.xi-mean,2)*f.ni}));
    const sumDev2ni=filas.reduce((s,f)=>s+f.dev2ni,0);
    const dt=Math.sqrt(sumDev2ni/n);
    const maxNi=Math.max(...filas.map(f=>f.ni));
    const moda=filas.find(f=>f.ni===maxNi).xi;
    let mediana;
    if(isCont) {
        const pos=n/2; let acum=0;
        for(const f of filas) {
            if(acum+f.ni>=pos){ mediana=f.lo+(pos-acum)/f.ni*(f.hiD-f.lo); break; }
            acum+=f.ni;
        }
    } else {
        const s=[...datos].sort((a,b)=>a-b);
        mediana=n%2===0?(s[n/2-1]+s[n/2])/2:s[Math.floor(n/2)];
    }
    return { filas, n, mean, moda, mediana, rango:maxV-minV, dt, sumXiNi, sumDev2ni };
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function EstadisticaApp({ onExit, usuario }) {
    const [fase,setFase]=useState(0);
    const [estudio,setEstudio]=useState(null);
    const [datos,setDatos]=useState([]);
    const [correct,setCorrect]=useState(null);
    const [scores,setScores]=useState({f1:0,f1t:3,f2:0,f2t:0,f3:0,f3t:4});
    const [showEnviar,setShowEnviar]=useState(false);
    const [codigoInput,setCodigoInput]=useState('');
    const [nombreInput,setNombreInput]=useState('');
    const [enviando,setEnviando]=useState(false);
    const [enviado,setEnviado]=useState(false);
    const [errorEnv,setErrorEnv]=useState('');
    const [isFullscreen,setIsFullscreen]=useState(false);
    const [modoClase,setModoClase]=useState(false);
    const appRef=useRef(null);

    useEffect(()=>{ const fn=()=>setIsFullscreen(!!document.fullscreenElement); document.addEventListener('fullscreenchange',fn); return()=>document.removeEventListener('fullscreenchange',fn); },[]);
    const toggleFS=()=>{ if(!document.fullscreenElement)appRef.current?.requestFullscreen?.(); else document.exitFullscreen?.(); };

    const iniciar=(est)=>{ const d=est.generarDatos(); setEstudio(est); setDatos(d); setCorrect(computeCorrect(d,est)); setFase(1); };

    const totalOk=scores.f1+scores.f2+scores.f3;
    const totalT=scores.f1t+scores.f2t+scores.f3t;

    const enviar=async()=>{
        const code=codigoInput.trim().toUpperCase();
        if(!code){setErrorEnv('Escribe el código del profesor.');return;}
        const nombre=usuario?.displayName||nombreInput.trim();
        if(!nombre){setErrorEnv('Escribe tu nombre.');return;}
        setEnviando(true);setErrorEnv('');
        try {
            const snap=await getDoc(doc(db,'codigos_profesor',code));
            if(!snap.exists()){setErrorEnv('Código no encontrado.');setEnviando(false);return;}
            await addDoc(collection(db,'informes_juegos'),{
                tipo:'ESTADISTICA', codigoProfesor:code, fecha:new Date(),
                uid:usuario?.uid||null, email:usuario?.email||null,
                aciertos:totalOk, total:totalT,
                jugadores:[{ nombre, aciertos:totalOk, intentos:totalT,
                    porcentaje:totalT>0?Math.round(totalOk/totalT*100):0,
                    modulos:[
                        {nombre:'Conceptos básicos',  aciertos:scores.f1, intentos:scores.f1t, porcentaje:Math.round(scores.f1/scores.f1t*100)},
                        {nombre:'Tabla y parámetros', aciertos:scores.f2, intentos:scores.f2t, porcentaje:scores.f2t>0?Math.round(scores.f2/scores.f2t*100):0},
                        {nombre:'Representación gráfica',aciertos:scores.f3,intentos:scores.f3t,porcentaje:Math.round(scores.f3/scores.f3t*100)},
                    ]
                }],
            });
            setEnviado(true);
        } catch(e){setErrorEnv('Error: '+e.message);}
        setEnviando(false);
    };

    return (
        <div ref={appRef} style={{minHeight:'100vh',background:D.bg,color:D.text,fontFamily:"'Segoe UI',sans-serif",display:'flex',flexDirection:'column'}}>
            {/* Header */}
            <div style={{padding:'12px 16px',background:D.card,borderBottom:`1px solid ${D.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <button onClick={onExit} style={{background:'transparent',border:`1px solid ${D.border}`,color:D.muted,padding:'6px 12px',borderRadius:7,cursor:'pointer'}}>← Salir</button>
                    <span style={{fontWeight:700,fontSize:'1.1rem'}}>📊 Estadística Descriptiva</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                    {fase>0 && <span style={{fontSize:'0.82rem',color:D.muted}}>{totalOk}/{totalT}</span>}
                    {fase===4 && <button onClick={()=>setShowEnviar(true)} style={BTN(D.accent)}><Send size={14}/>Enviar al profesor</button>}
                    <button onClick={toggleFS} style={{background:'transparent',border:`1px solid ${D.border}`,color:D.muted,padding:'6px 10px',borderRadius:7,cursor:'pointer',display:'flex',alignItems:'center'}}>
                        {isFullscreen?<Minimize2 size={14}/>:<Maximize2 size={14}/>}
                    </button>
                </div>
            </div>

            <div style={{flex:1,padding:20,maxWidth:920,width:'100%',margin:'0 auto',boxSizing:'border-box'}}>

                {/* Fase 0 */}
                {fase===0 && (
                    <div>
                        <div style={{textAlign:'center',marginBottom:28}}>
                            <BarChart2 size={48} color={D.accent} style={{marginBottom:8}}/>
                            <h2 style={{margin:0,color:D.text,fontSize:'1.4rem'}}>Elige un estudio estadístico</h2>
                            <p style={{color:D.muted,margin:'8px 0 0'}}>Trabajarás en 3 fases: identificación · tabla · gráfico</p>
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:16}}>
                            {ESTUDIOS.map(est=>(
                                <button key={est.id} onClick={()=>iniciar(est)}
                                    style={{...CARD,cursor:'pointer',textAlign:'left',border:`2px solid ${D.accent}`,color:D.text,width:'100%'}}
                                    onMouseEnter={e=>e.currentTarget.style.background='#1c2230'}
                                    onMouseLeave={e=>e.currentTarget.style.background=D.card}>
                                    <div style={{fontWeight:700,fontSize:'1rem',marginBottom:6,color:D.accent}}>{est.titulo}</div>
                                    <div style={{fontSize:'0.83rem',color:D.muted,lineHeight:1.5}}>{est.enunciado}</div>
                                </button>
                            ))}
                        </div>
                        <div style={{marginTop:20,textAlign:'center'}}>
                            <button onClick={()=>setModoClase(true)} style={{...BTN(D.gold,'#111'),fontSize:'1rem',padding:'13px 28px',borderRadius:12,boxShadow:'0 4px 18px rgba(243,156,18,0.25)'}}>
                                🖊 Modo Pizarra — crea tu propio estudio
                            </button>
                            <div style={{fontSize:'0.75rem',color:D.muted,marginTop:6}}>Introduce los datos en clase y comprueba fi, %, xᵢ·nᵢ y (xᵢ−x̄)²·nᵢ</div>
                        </div>
                    </div>
                )}

                {/* Enunciado (fases 1-3) */}
                {fase>=1&&fase<=3&&(
                    <div style={{...CARD,borderLeft:`4px solid ${D.accent}`,marginBottom:16}}>
                        <div style={{fontSize:'0.72rem',color:D.muted,fontWeight:700,marginBottom:6,letterSpacing:.5}}>ESTUDIO · {estudio.tipo.toUpperCase()}</div>
                        <div style={{fontSize:'1rem',color:D.text,marginBottom:10}}>{estudio.enunciado}</div>
                        <div style={{background:D.bg,padding:'10px 14px',borderRadius:8,fontFamily:'monospace',fontSize:'0.85rem',color:D.gold,lineHeight:1.8,border:`1px solid ${D.border}`,wordBreak:'break-all'}}>
                            {datos.join('  ·  ')}
                        </div>
                    </div>
                )}

                {/* Progress bar (fases 1-3) */}
                {fase>=1&&fase<=3&&(
                    <div style={{display:'flex',gap:8,marginBottom:20}}>
                        {['1. Conceptos','2. Tabla','3. Gráfico'].map((lbl,i)=>(
                            <div key={i} style={{flex:1,padding:'6px 0',textAlign:'center',borderRadius:8,fontSize:'0.78rem',fontWeight:700,
                                background:fase===i+1?D.accent:fase>i+1?D.green:D.dark2,
                                color:fase>=i+1?'white':D.muted,border:`1px solid ${fase===i+1?D.accent:fase>i+1?D.green:D.border}`}}>
                                {fase>i+1?'✓ ':''}{lbl}
                            </div>
                        ))}
                    </div>
                )}

                {fase===1&&<FaseQuiz estudio={estudio} onPasar={(ok)=>{setScores(s=>({...s,f1:ok,f1t:3}));setFase(2);}}/>}
                {fase===2&&<FaseTabla datos={datos} estudio={estudio} correct={correct} onPasar={(ok,t)=>{setScores(s=>({...s,f2:ok,f2t:t}));setFase(3);}}/>}
                {fase===3&&<FaseGrafico estudio={estudio} correct={correct} onPasar={(ok,t)=>{setScores(s=>({...s,f3:ok,f3t:t}));setFase(4);}}/>}

                {/* Fase 4 */}
                {fase===4&&(
                    <div style={{...CARD,textAlign:'center',padding:40}}>
                        <div style={{fontSize:60,marginBottom:10}}>🏆</div>
                        <h2 style={{color:D.green2,margin:'0 0 8px'}}>¡Estudio completado!</h2>
                        <p style={{color:D.muted}}>Has analizado los datos en las tres fases.</p>
                        <div style={{display:'flex',justifyContent:'center',gap:16,margin:'20px 0'}}>
                            {[{lbl:'Conceptos',ok:scores.f1,t:scores.f1t},{lbl:'Tabla',ok:scores.f2,t:scores.f2t},{lbl:'Gráfico',ok:scores.f3,t:scores.f3t}].map((s,i)=>(
                                <div key={i} style={{background:D.bg,borderRadius:10,padding:'12px 18px',border:`1px solid ${D.border}`}}>
                                    <div style={{fontSize:'0.72rem',color:D.muted,marginBottom:4}}>{s.lbl}</div>
                                    <div style={{fontSize:'1.3rem',fontWeight:700,color:s.t>0&&s.ok/s.t>=0.7?D.green2:D.red}}>{s.ok}/{s.t}</div>
                                </div>
                            ))}
                        </div>
                        <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
                            <button onClick={()=>{setFase(0);setEnviado(false);setScores({f1:0,f1t:3,f2:0,f2t:0,f3:0,f3t:4});}} style={BTN('#30363d')}><RefreshCw size={14}/>Nuevo estudio</button>
                            <button onClick={()=>setShowEnviar(true)} style={BTN(D.accent)}><Send size={14}/>Enviar al profesor</button>
                        </div>
                    </div>
                )}
            </div>

            {modoClase&&<ModoClase onClose={()=>setModoClase(false)}/>}

            {/* Send modal */}
            {showEnviar&&(
                <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
                    <div style={{...CARD,maxWidth:440,width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.5)'}}>
                        <div style={{fontWeight:700,fontSize:'1.1rem',color:D.gold,marginBottom:16}}>📤 Enviar al profesor</div>
                        <div style={{background:D.bg,borderRadius:10,padding:14,marginBottom:14,border:`1px solid ${D.border}`}}>
                            <div style={{fontSize:'0.72rem',color:D.muted,marginBottom:8}}>RESUMEN · {estudio?.titulo}</div>
                            {[{lbl:'Conceptos',ok:scores.f1,t:scores.f1t},{lbl:'Tabla',ok:scores.f2,t:scores.f2t},{lbl:'Gráfico',ok:scores.f3,t:scores.f3t}].map((s,i)=>(
                                <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',fontSize:'0.85rem',borderBottom:`1px solid ${D.border}`}}>
                                    <span style={{color:D.text}}>{s.lbl}</span>
                                    <span style={{color:s.t>0&&s.ok/s.t>=0.7?D.green2:D.gold,fontWeight:700}}>{s.ok}/{s.t} ({s.t>0?Math.round(s.ok/s.t*100):0}%)</span>
                                </div>
                            ))}
                        </div>
                        {enviado?(
                            <div style={{color:D.green2,fontWeight:700,textAlign:'center',padding:'12px 0',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}><CheckCircle size={18}/>¡Enviado correctamente!</div>
                        ):(
                            <>
                                {!usuario&&<input value={nombreInput} onChange={e=>setNombreInput(e.target.value)} placeholder="Tu nombre"
                                    style={{width:'100%',boxSizing:'border-box',padding:'10px 12px',borderRadius:9,border:`1.5px solid ${D.border}`,background:D.bg,color:D.text,fontSize:'0.9rem',marginBottom:10,outline:'none'}}/>}
                                <div style={{display:'flex',gap:8,marginBottom:8}}>
                                    <input value={codigoInput} onChange={e=>setCodigoInput(e.target.value.toUpperCase())} placeholder="Código del profesor" maxLength={8}
                                        style={{flex:1,padding:'10px 12px',borderRadius:9,border:`1.5px solid ${D.border}`,background:D.bg,color:D.text,fontSize:'0.9rem',letterSpacing:2,outline:'none'}}/>
                                    <button onClick={enviar} disabled={enviando} style={{...BTN(D.accent),opacity:enviando?0.6:1}}><Send size={14}/>{enviando?'Enviando…':'Enviar'}</button>
                                </div>
                                {errorEnv&&<div style={{color:D.red,fontSize:'0.8rem'}}>{errorEnv}</div>}
                            </>
                        )}
                        <div style={{display:'flex',justifyContent:'flex-end',marginTop:12}}>
                            <button onClick={()=>{setShowEnviar(false);setErrorEnv('');}} style={BTN('#30363d')}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── FASE 1: Quiz ─────────────────────────────────────────────────────────────
function FaseQuiz({ estudio, onPasar }) {
    const [opts] = useState(() => ({
        variable:  shuffle([estudio.variable,  ...estudio.opVar]),
        poblacion: shuffle([estudio.poblacion, ...estudio.opPob]),
        tipo:      shuffle([estudio.tipo,      ...estudio.opTipo]),
    }));
    const [resp, setResp] = useState({});
    const [checked, setChecked] = useState(false);
    const Qs = [
        { key:'variable',  label:'¿Cuál es la variable estadística estudiada?', correct:estudio.variable },
        { key:'poblacion', label:'¿Cuál es la población del estudio?',           correct:estudio.poblacion },
        { key:'tipo',      label:'¿De qué tipo es la variable?',                  correct:estudio.tipo },
    ];
    return (
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div style={{color:D.muted,fontSize:'0.88rem'}}>Selecciona la respuesta correcta para cada pregunta.</div>
            {Qs.map(q=>(
                <div key={q.key} style={{...CARD}}>
                    <div style={{fontWeight:700,marginBottom:12,color:D.text}}>{q.label}</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                        {opts[q.key].map(op=>{
                            const sel=resp[q.key]===op;
                            const ok=checked&&op===q.correct;
                            const bad=checked&&sel&&op!==q.correct;
                            return (
                                <button key={op} disabled={checked} onClick={()=>setResp(r=>({...r,[q.key]:op}))}
                                    style={{padding:'10px 12px',borderRadius:9,cursor:checked?'default':'pointer',textAlign:'left',fontSize:'0.87rem',fontWeight:sel?700:400,
                                        border:`2px solid ${ok?D.green:bad?D.red:sel?D.accent:D.border}`,
                                        background:ok?'#0d3321':bad?'#2c0d0d':sel?'#1a2a3a':D.bg,
                                        color:ok?D.green2:bad?D.red:D.text}}>
                                    {op}
                                </button>
                            );
                        })}
                    </div>
                    {checked&&<div style={{marginTop:6,fontSize:'0.78rem',fontWeight:700,color:resp[q.key]===q.correct?D.green2:D.red}}>
                        {resp[q.key]===q.correct?'✓ Correcto':`✗ Correcto: ${q.correct}`}
                    </div>}
                </div>
            ))}
            {!checked
                ? <button onClick={()=>{ if(Object.keys(resp).length===3)setChecked(true); }}
                    disabled={Object.keys(resp).length<3}
                    style={{...BTN(D.gold,'#111'),opacity:Object.keys(resp).length<3?0.5:1}}>Comprobar respuestas</button>
                : <button onClick={()=>onPasar(Qs.filter(q=>resp[q.key]===q.correct).length)} style={BTN(D.green)}>Pasar a la tabla <ArrowRight size={14}/></button>
            }
        </div>
    );
}

// ─── FASE 2: Tabla + Parámetros ───────────────────────────────────────────────
function FaseTabla({ datos, estudio, correct, onPasar }) {
    const { filas, n, mean, moda, mediana, rango, dt, sumXiNi, sumDev2ni } = correct;
    const isCont = estudio.tipo.includes('continua');
    const nr = filas.length;
    const emptyRow = () => ({ int:'', xi:'', ni:'', pct:'', xini:'', dev2ni:'' });
    const [tabla,setTabla]   = useState(()=>Array(nr).fill(0).map(emptyRow));
    const [sumas,setSumas]   = useState({ni:'',pct:'',xini:'',dev2ni:''});
    const [params,setParams] = useState({media:'',moda:'',mediana:'',rango:'',dt:''});
    const [checked,setChecked]=useState(false);
    const [co,setCo]=useState(null);
    const [so,setSo]=useState(null);
    const [po,setPo]=useState(null);
    const [score,setScore]=useState({ok:0,total:0});

    const setCell=(i,col,v)=>setTabla(t=>{const a=[...t];a[i]={...a[i],[col]:v};return a;});

    const comprobar=()=>{
        const newCo=tabla.map((row,i)=>{
            const f=filas[i];
            const intOk=isCont
                ? (()=>{ const p=parseIntervalNums(row.int); return p&&Math.abs(p.lo-f.lo)<=0.01&&Math.abs(p.hi-f.hiD)<=0.01; })()
                : near(row.int, f.xi);
            return { int:intOk, xi:near(row.xi,f.xi), ni:nearInt(row.ni,f.ni), pct:near(row.pct,f.pct), xini:near(row.xini,f.xini), dev2ni:near(row.dev2ni,f.dev2ni) };
        });
        const newSo={ ni:nearInt(sumas.ni,n), pct:near(sumas.pct,100), xini:near(sumas.xini,sumXiNi), dev2ni:near(sumas.dev2ni,sumDev2ni) };
        const newPo={ media:near(params.media,mean), moda:near(params.moda,moda), mediana:near(params.mediana,mediana,3), rango:near(params.rango,rango), dt:near(params.dt,dt) };
        setCo(newCo); setSo(newSo); setPo(newPo); setChecked(true);
        const okC=newCo.reduce((s,row)=>s+Object.values(row).filter(Boolean).length,0);
        const okS=Object.values(newSo).filter(Boolean).length;
        const okP=Object.values(newPo).filter(Boolean).length;
        setScore({ok:okC+okS+okP, total:nr*6+4+5});
    };

    const cs=(ok)=>({width:'100%',padding:'5px 3px',textAlign:'center',boxSizing:'border-box',outline:'none',borderRadius:5,fontSize:'0.82rem',
        border:`1.5px solid ${ok===undefined?D.border:ok?D.green:D.red}`,
        background:D.bg,color:ok===undefined?D.text:ok?D.green2:D.red});

    return (
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div style={{color:D.muted,fontSize:'0.85rem',lineHeight:1.6}}>
                Rellena la tabla completa. {isCont?'Escribe los intervalos como [a, b).':''} Para la última columna necesitarás la media (calcúlala en los parámetros primero). Tolerancia: ±1%.
            </div>
            <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.8rem',minWidth:580}}>
                    <thead>
                        <tr style={{background:D.accent,color:'white'}}>
                            <th style={{padding:'9px 6px',border:`1px solid ${D.border}`}}>{isCont?'Intervalo':'Valor xᵢ'}</th>
                            <th style={{padding:'9px 6px',border:`1px solid ${D.border}`}}>Marca xᵢ</th>
                            <th style={{padding:'9px 6px',border:`1px solid ${D.border}`}}>Frec. nᵢ</th>
                            <th style={{padding:'9px 6px',border:`1px solid ${D.border}`}}>% (nᵢ/n·100)</th>
                            <th style={{padding:'9px 6px',border:`1px solid ${D.border}`}}>xᵢ · nᵢ</th>
                            <th style={{padding:'9px 6px',border:`1px solid ${D.border}`}}>(xᵢ − x̄)² · nᵢ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filas.map((f,i)=>{
                            const ok=co?.[i];
                            return (
                                <tr key={i} style={{borderBottom:`1px solid ${D.border}`}}>
                                    <td style={{padding:3,border:`1px solid ${D.border}`}}>
                                        <input value={tabla[i].int} onChange={e=>setCell(i,'int',e.target.value)} disabled={checked} placeholder={f.label} style={{...cs(ok?.int),minWidth:isCont?110:50}}/>
                                    </td>
                                    <td style={{padding:3,border:`1px solid ${D.border}`}}><input type="number" step="0.5" value={tabla[i].xi} onChange={e=>setCell(i,'xi',e.target.value)} disabled={checked} style={cs(ok?.xi)}/></td>
                                    <td style={{padding:3,border:`1px solid ${D.border}`}}><input type="number" value={tabla[i].ni} onChange={e=>setCell(i,'ni',e.target.value)} disabled={checked} style={cs(ok?.ni)}/></td>
                                    <td style={{padding:3,border:`1px solid ${D.border}`}}><input type="number" step="0.1" value={tabla[i].pct} onChange={e=>setCell(i,'pct',e.target.value)} disabled={checked} style={cs(ok?.pct)}/></td>
                                    <td style={{padding:3,border:`1px solid ${D.border}`}}><input type="number" step="0.1" value={tabla[i].xini} onChange={e=>setCell(i,'xini',e.target.value)} disabled={checked} style={cs(ok?.xini)}/></td>
                                    <td style={{padding:3,border:`1px solid ${D.border}`}}><input type="number" step="0.01" value={tabla[i].dev2ni} onChange={e=>setCell(i,'dev2ni',e.target.value)} disabled={checked} style={cs(ok?.dev2ni)}/></td>
                                </tr>
                            );
                        })}
                        <tr style={{background:'#1a1a2e',fontWeight:700}}>
                            <td colSpan={2} style={{padding:'7px 8px',textAlign:'right',color:D.gold,border:`1px solid ${D.border}`,fontSize:'0.78rem'}}>SUMAS Σ →</td>
                            <td style={{padding:3,border:`1px solid ${D.border}`}}><input type="number" value={sumas.ni} onChange={e=>setSumas(s=>({...s,ni:e.target.value}))} disabled={checked} style={cs(so?.ni)}/></td>
                            <td style={{padding:3,border:`1px solid ${D.border}`}}><input type="number" step="0.1" value={sumas.pct} onChange={e=>setSumas(s=>({...s,pct:e.target.value}))} disabled={checked} style={cs(so?.pct)}/></td>
                            <td style={{padding:3,border:`1px solid ${D.border}`}}><input type="number" step="0.1" value={sumas.xini} onChange={e=>setSumas(s=>({...s,xini:e.target.value}))} disabled={checked} style={cs(so?.xini)}/></td>
                            <td style={{padding:3,border:`1px solid ${D.border}`}}><input type="number" step="0.01" value={sumas.dev2ni} onChange={e=>setSumas(s=>({...s,dev2ni:e.target.value}))} disabled={checked} style={cs(so?.dev2ni)}/></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {checked&&(
                <div style={{...CARD,background:'#1a2a3a',fontSize:'0.82rem',color:D.muted}}>
                    Referencia: Media x̄ = <b style={{color:D.gold}}>{mean.toFixed(3)}</b> · σ = <b style={{color:D.gold}}>{dt.toFixed(3)}</b> · Mediana = <b style={{color:D.gold}}>{mediana.toFixed(2)}</b> · Moda = <b style={{color:D.gold}}>{moda}</b>
                </div>
            )}

            <div style={{...CARD}}>
                <div style={{fontWeight:700,color:D.accent,marginBottom:14,fontSize:'0.9rem'}}>Parámetros estadísticos</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:12}}>
                    {[{k:'media',lbl:'Media (x̄)'},{k:'moda',lbl:'Moda (Mo)'},{k:'mediana',lbl:'Mediana (Me)'},{k:'rango',lbl:'Rango'},{k:'dt',lbl:'Desv. Típica (σ)'}].map(({k,lbl})=>{
                        const ok=po?.[k];
                        const correct_val=k==='media'?mean:k==='moda'?moda:k==='mediana'?mediana:k==='rango'?rango:dt;
                        return (
                            <div key={k}>
                                <div style={{fontSize:'0.75rem',color:D.muted,marginBottom:4,fontWeight:700}}>{lbl}</div>
                                <input type="number" step="0.01" value={params[k]} onChange={e=>setParams(p=>({...p,[k]:e.target.value}))} disabled={checked}
                                    style={{...cs(ok),padding:'10px 8px',fontSize:'1rem'}}/>
                                {checked&&!ok&&<div style={{fontSize:'0.68rem',color:D.red,marginTop:2}}>→ {correct_val.toFixed(2)}</div>}
                            </div>
                        );
                    })}
                </div>
            </div>

            {!checked
                ? <button onClick={comprobar} style={BTN(D.gold,'#111')}>Comprobar tabla y parámetros</button>
                : <>
                    <div style={{...CARD,background:'#0d1a0d',border:`1px solid ${D.green}`,textAlign:'center'}}>
                        <span style={{color:D.green2,fontWeight:700}}>✓ {score.ok} / {score.total} celdas correctas</span>
                    </div>
                    <button onClick={()=>onPasar(score.ok,score.total)} style={BTN(D.green)}>Pasar al gráfico <ArrowRight size={14}/></button>
                </>
            }
        </div>
    );
}

// ─── FASE 3: Gráfico ──────────────────────────────────────────────────────────
function GraficoSVG({ filas, isCont, titulo }) {
    const W=560, H=260, padL=44, padB=40, padT=16, padR=16;
    const chartW=W-padL-padR, chartH=H-padT-padB;
    const maxNi=Math.max(...filas.map(f=>f.ni));
    const n=filas.length;
    const barW=chartW/n;
    const gap=isCont?0:barW*0.18;
    const yTicks=[0,Math.ceil(maxNi/4),Math.ceil(maxNi/2),Math.ceil(maxNi*3/4),maxNi];
    const scaleY=v=>chartH-(v/maxNi*chartH);
    return (
        <div style={{...CARD,background:'#0d1117',overflowX:'auto'}}>
            <div style={{fontSize:'0.78rem',color:D.muted,marginBottom:8,fontWeight:700}}>{titulo}</div>
            <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',maxWidth:W,display:'block'}}>
                {yTicks.map((v,i)=>(
                    <g key={i}>
                        <line x1={padL} y1={padT+scaleY(v)} x2={W-padR} y2={padT+scaleY(v)} stroke="#30363d" strokeWidth={1}/>
                        <text x={padL-4} y={padT+scaleY(v)+4} textAnchor="end" fontSize={10} fill={D.muted}>{v}</text>
                    </g>
                ))}
                {filas.map((f,i)=>{
                    const x=padL+i*barW+gap/2;
                    const bw=barW-gap;
                    const bh=f.ni/maxNi*chartH;
                    const y=padT+chartH-bh;
                    return (
                        <g key={i}>
                            <rect x={x} y={y} width={bw} height={bh} fill={D.accent} opacity={0.85} rx={isCont?0:2}/>
                            {f.ni>0&&<text x={x+bw/2} y={y-4} textAnchor="middle" fontSize={10} fill={D.text} fontWeight="700">{f.ni}</text>}
                            <text x={x+bw/2} y={H-padB+14} textAnchor="middle" fontSize={9} fill={D.muted}
                                transform={filas.length>6?`rotate(-35,${x+bw/2},${H-padB+14})`:undefined}>
                                {f.label.length>10?f.label.replace(/\s/g,''):f.label}
                            </text>
                        </g>
                    );
                })}
                <line x1={padL} y1={padT} x2={padL} y2={padT+chartH} stroke={D.muted} strokeWidth={1.5}/>
                <line x1={padL} y1={padT+chartH} x2={W-padR} y2={padT+chartH} stroke={D.muted} strokeWidth={1.5}/>
                <text x={padL/2-4} y={H/2} textAnchor="middle" fontSize={10} fill={D.muted} transform={`rotate(-90,${padL/2-4},${H/2})`}>Frecuencia (nᵢ)</text>
                <text x={padL+(W-padL-padR)/2} y={H-2} textAnchor="middle" fontSize={10} fill={D.muted}>{isCont?'Intervalos':'Valores'}</text>
            </svg>
        </div>
    );
}

function FaseGrafico({ estudio, correct, onPasar }) {
    const isCont = estudio.tipo.includes('continua');
    const maxNi  = Math.max(...correct.filas.map(f=>f.ni));
    const [preguntas] = useState(() => [
        { key:'ejeX', label:'¿Qué se representa en el eje horizontal (X)?',
            opciones: shuffle([
                { val:'xi',  txt: isCont?'Los intervalos de la variable':'Los valores de la variable (xᵢ)' },
                { val:'ni',  txt:'Las frecuencias absolutas (nᵢ)' },
                { val:'pct', txt:'Los porcentajes (%)' },
                { val:'xini',txt:'El producto xᵢ · nᵢ' },
            ]),
            correct:'xi' },
        { key:'ejeY', label:'¿Qué determina la ALTURA de cada barra (eje Y)?',
            opciones: shuffle([
                { val:'ni',   txt:'La frecuencia absoluta o relativa de cada valor' },
                { val:'max',  txt:'El valor máximo del conjunto de datos' },
                { val:'mean', txt:'La media aritmética de la distribución' },
                { val:'rango',txt:'El rango de la distribución' },
            ]),
            correct:'ni' },
        { key:'barras', label:`Al ser una variable ${estudio.tipo}, las barras se dibujan…`,
            opciones: shuffle([
                { val:'separadas', txt:'SEPARADAS — Diagrama de barras (variable discreta)' },
                { val:'juntas',    txt:'JUNTAS sin espacio — Histograma (variable continua)' },
            ]),
            correct: isCont?'juntas':'separadas' },
        { key:'altura', label:'¿Cuál es la frecuencia de la barra más alta?',
            opciones: shuffle([
                { val:'ok',  txt:String(maxNi) },
                { val:'w1',  txt:String(maxNi-1) },
                { val:'w2',  txt:String(maxNi+1) },
                { val:'w3',  txt:String(Math.max(1,maxNi-2)) },
            ]),
            correct:'ok' },
    ]);
    const [resp,setResp]=useState({});
    const [checked,setChecked]=useState(false);
    return (
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div style={{color:D.muted,fontSize:'0.88rem'}}>Responde sobre la representación gráfica de los datos.</div>
            {preguntas.map(q=>(
                <div key={q.key} style={{...CARD}}>
                    <div style={{fontWeight:700,marginBottom:12,color:D.text}}>{q.label}</div>
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                        {q.opciones.map(op=>{
                            const sel=resp[q.key]===op.val;
                            const ok=checked&&op.val===q.correct;
                            const bad=checked&&sel&&op.val!==q.correct;
                            return (
                                <button key={op.val} disabled={checked} onClick={()=>setResp(r=>({...r,[q.key]:op.val}))}
                                    style={{padding:'10px 14px',borderRadius:9,cursor:checked?'default':'pointer',textAlign:'left',fontSize:'0.88rem',fontWeight:sel?700:400,
                                        border:`2px solid ${ok?D.green:bad?D.red:sel?D.accent:D.border}`,
                                        background:ok?'#0d3321':bad?'#2c0d0d':sel?'#1a2a3a':D.bg,
                                        color:ok?D.green2:bad?D.red:D.text}}>
                                    {op.txt}
                                </button>
                            );
                        })}
                    </div>
                    {checked&&<div style={{marginTop:6,fontSize:'0.78rem',fontWeight:700,color:resp[q.key]===q.correct?D.green2:D.red}}>
                        {resp[q.key]===q.correct?'✓ Correcto':`✗ Correcto: ${q.opciones.find(o=>o.val===q.correct)?.txt}`}
                    </div>}
                </div>
            ))}

            <GraficoSVG filas={correct.filas} isCont={isCont}
                titulo={isCont?`Histograma — ${estudio.titulo}`:`Diagrama de barras — ${estudio.titulo}`}/>

            {!checked
                ? <button onClick={()=>{if(Object.keys(resp).length===preguntas.length)setChecked(true);}}
                    disabled={Object.keys(resp).length<preguntas.length}
                    style={{...BTN(D.gold,'#111'),opacity:Object.keys(resp).length<preguntas.length?0.5:1}}>Comprobar</button>
                : <button onClick={()=>onPasar(preguntas.filter(q=>resp[q.key]===q.correct).length,preguntas.length)} style={BTN(D.green)}>
                    Ver resultados <ArrowRight size={14}/>
                  </button>
            }
        </div>
    );
}

// ─── MODO PIZARRA ─────────────────────────────────────────────────────────────
function ModoClase({ onClose }) {
    const [paso, setPaso]           = useState(1);
    const [cfg,  setCfg]            = useState({ variable:'', poblacion:'', tipo:'cuant_cont' });
    const [tabla, setTabla]         = useState(null);
    const [totales, setTotales]     = useState({ ni:'', fi:'', pct:'', xini:'', dev2ni:'' });
    const [active, setActive]       = useState(null); // {row: i | -1 para totales, col}
    const [checked, setChecked]     = useState(false);
    const [valRes,  setValRes]      = useState(null);
    const [totValRes, setTotValRes] = useState(null);
    const [showCalc, setShowCalc]   = useState(false);
    const [calcExpr, setCalcExpr]   = useState('');
    const [calcRes,  setCalcRes]    = useState(null);
    const [colChecked, setColChecked] = useState({});
    const [params, setParams]         = useState({ media:'', mediana:'', moda:'', rango:'', dt:'' });
    const [paramsRes, setParamsRes]   = useState(null);
    const [showGrafico, setShowGrafico] = useState(false);
    const [grafStep,    setGrafStep]    = useState(1);
    const [grafCfg,     setGrafCfg]     = useState({ barType:null, ejeX:null, ejeY:null });
    const [barHeights,  setBarHeights]  = useState([]);
    const [grafChecked, setGrafChecked] = useState(false);
    const [grafDrag,    setGrafDrag]    = useState(null);
    const svgRef = useRef(null);

    const TIPO_COLS = {
        cuant_cont:  ['intervalo','xi','ni','fi','pct','xini','dev2ni'],
        cuant_disc:  ['xi','ni','fi','pct','xini','dev2ni'],
        cualitativa: ['categoria','ni','fi','pct'],
    };
    // Columnas de totales por tipo (sin las de texto/marca)
    const TOT_COLS = {
        cuant_cont:  ['ni','fi','pct','xini','dev2ni'],
        cuant_disc:  ['ni','fi','pct','xini','dev2ni'],
        cualitativa: ['ni','fi','pct'],
    };
    // Cuántas columnas ocupa el label "TOTALES Σ →" (colspan)
    const TOT_SPAN = { cuant_cont:2, cuant_disc:1, cualitativa:1 };
    const HEADS = {
        intervalo:'Intervalo', xi:'Marca xᵢ', ni:'Frec. nᵢ',
        fi:'fᵢ (nᵢ/N)', pct:'%', xini:'xᵢ·nᵢ', dev2ni:'(xᵢ−x̄)²·nᵢ', categoria:'Categoría',
    };
    const NUM_COLS  = new Set(['xi','ni','fi','pct','xini','dev2ni']);
    const COMP_COLS = new Set(['fi','pct','xini','dev2ni']);
    const KB_COLS   = new Set(['xi','ni','fi','pct','xini','dev2ni','intervalo']);
    const PARAM_LABELS = { media:'Media x̄', mediana:'Mediana Me', moda:'Moda Mo', rango:'Rango', dt:'Desv. típica σ' };
    const COL_W = { intervalo:84, xi:46, ni:44, fi:50, pct:44, xini:58, dev2ni:66, categoria:68 };

    const parseDec = s => parseFloat(String(s||'').replace(',','.'));
    const checkVal = (s, c) => {
        const v = parseDec(s);
        if (isNaN(v)||isNaN(c)) return false;
        if (Math.abs(c) < 0.0001) return Math.abs(v) < 0.05;
        return Math.abs(v-c)/Math.abs(c)*100 <= 2;
    };
    const emptyRow  = (t) => Object.fromEntries(TIPO_COLS[t].map(c=>[c,'']));
    const fmt = (v, dec=3) => v != null ? String(+v.toFixed(dec)).replace('.',',') : '—';

    // Estadísticos en vivo a partir de lo que el alumno ha introducido
    const getStats = () => {
        if (!tabla) return null;
        const tipo = cfg.tipo;
        const rows = tabla.map(f => ({
            xi:   parseDec(f.xi),
            ni:   parseDec(f.ni) || 0,
            intv: tipo === 'cuant_cont' ? parseIntervalNums(f.intervalo || '') : null,
        })).filter(r => !isNaN(r.xi) && r.ni > 0);
        if (!rows.length) return null;
        const Nv  = rows.reduce((s,r)=>s+r.ni, 0);
        const sXN = rows.reduce((s,r)=>s+r.xi*r.ni, 0);
        const mv  = sXN / Nv;
        const sD2 = rows.reduce((s,r)=>s+Math.pow(r.xi-mv,2)*r.ni, 0);
        const dtv = Math.sqrt(sD2 / Nv);
        const mxNi = Math.max(...rows.map(r=>r.ni));
        const mods  = rows.filter(r=>r.ni===mxNi).map(r=>r.xi);
        const rang  = Math.max(...rows.map(r=>r.xi)) - Math.min(...rows.map(r=>r.xi));
        // Mediana
        let med = null;
        let ac = 0;
        const pos = Nv / 2;
        for (const r of rows) {
            if (ac + r.ni >= pos) {
                med = (tipo === 'cuant_cont' && r.intv)
                    ? r.intv.lo + (pos - ac) / r.ni * (r.intv.hi - r.intv.lo)
                    : r.xi;
                break;
            }
            ac += r.ni;
        }
        return { N:Nv, mean:mv, mediana:med, modas:mods, rango:rang, dt:dtv, sumXN:sXN, sumD2:sD2 };
    };

    const st   = getStats();
    const N    = st?.N    || 0;
    const mean = st?.mean || 0;

    const continuar = () => {
        setTabla(Array(4).fill(null).map(()=>emptyRow(cfg.tipo)));
        setTotales({ ni:'', fi:'', pct:'', xini:'', dev2ni:'' });
        setParams({ media:'', mediana:'', moda:'', rango:'', dt:'' });
        setActive(null); setChecked(false); setValRes(null); setTotValRes(null); setColChecked({}); setParamsRes(null);
        setShowGrafico(false); setBarHeights([]); setGrafChecked(false); setGrafDrag(null);
        setPaso(2);
    };

    const handleKey = (k) => {
        if (!active) return;
        const { row, col } = active;
        const up = (cur) => {
            const c = String(cur || '');
            if (k === 'back') return c.slice(0, -1);
            if (col !== 'intervalo') {
                if (k === ',' && c.includes(',')) return c;
                if (k === ',' && c === '') return '0,';
            }
            return c + k;
        };
        if (row === -2) {
            setParams(p => ({ ...p, [col]: up(p[col]) }));
        } else if (row === -1) {
            setTotales(p => ({ ...p, [col]: up(p[col]) }));
        } else {
            setTabla(p => {
                const t = p.map(r=>({...r}));
                t[row] = { ...t[row], [col]: up(t[row][col]) };
                return t;
            });
        }
    };

    const comprobar = () => {
        if (!st || !N) return;
        const tipo = cfg.tipo;
        const res = tabla.map(f => {
            const ni_v = parseDec(f.ni) || 0;
            const xi_v = parseDec(f.xi) || 0;
            const fi_c = ni_v / N;
            const r = { fi: checkVal(f.fi, fi_c), pct: checkVal(f.pct, fi_c * 100) };
            if (tipo !== 'cualitativa') {
                r.xini   = checkVal(f.xini,   xi_v * ni_v);
                r.dev2ni = checkVal(f.dev2ni,  Math.pow(xi_v - mean, 2) * ni_v);
            }
            return r;
        });
        const totRes = {
            ni:  checkVal(totales.ni,  N),
            fi:  checkVal(totales.fi,  1),
            pct: checkVal(totales.pct, 100),
        };
        if (tipo !== 'cualitativa') {
            totRes.xini   = checkVal(totales.xini,   st.sumXN);
            totRes.dev2ni = checkVal(totales.dev2ni,  st.sumD2);
        }
        let pRes = null;
        if (st && cfg.tipo !== 'cualitativa') {
            pRes = {
                media:   checkVal(params.media,   st.mean),
                mediana: checkVal(params.mediana, st.mediana),
                moda:    st.modas?.some(m => checkVal(params.moda, m)) ?? false,
                rango:   checkVal(params.rango,   st.rango),
                dt:      checkVal(params.dt,      st.dt),
            };
        }
        setValRes(res); setTotValRes(totRes); setParamsRes(pRes); setChecked(true); setActive(null);
    };

    const resetTabla = () => {
        setTabla(Array(tabla.length).fill(null).map(()=>emptyRow(cfg.tipo)));
        setTotales({ ni:'', fi:'', pct:'', xini:'', dev2ni:'' });
        setParams({ media:'', mediana:'', moda:'', rango:'', dt:'' });
        setChecked(false); setValRes(null); setTotValRes(null); setParamsRes(null); setActive(null); setColChecked({});
    };

    const checkCol = (col) => {
        if (!st || !N) return;
        const tipo = cfg.tipo;
        const rows = tabla.map(f => {
            const ni_v = parseDec(f.ni) || 0;
            const xi_v = parseDec(f.xi) || 0;
            const fi_c = ni_v / N;
            if (col === 'fi')     return checkVal(f.fi, fi_c);
            if (col === 'pct')    return checkVal(f.pct, fi_c * 100);
            if (col === 'xini')   return checkVal(f.xini, xi_v * ni_v);
            if (col === 'dev2ni') return checkVal(f.dev2ni, Math.pow(xi_v - mean, 2) * ni_v);
            return null;
        });
        let total = null;
        if (TOT_COLS[tipo].includes(col)) {
            if (col === 'fi')     total = checkVal(totales.fi,  1);
            if (col === 'pct')    total = checkVal(totales.pct, 100);
            if (col === 'xini')   total = checkVal(totales.xini,   st.sumXN);
            if (col === 'dev2ni') total = checkVal(totales.dev2ni, st.sumD2);
        }
        setColChecked(prev => ({ ...prev, [col]: { rows, total } }));
    };

    // Calculadora
    const evalCalc = () => {
        if (!calcExpr) return;
        try {
            const expr = calcExpr
                .replace(/,/g, '.').replace(/×/g, '*').replace(/÷/g, '/')
                .replace(/√\(/g, 'Math.sqrt(').replace(/\^2/g, '**2');
            // eslint-disable-next-line no-new-func
            const r = Function('return (' + expr + ')')();
            setCalcRes(typeof r === 'number' && Number.isFinite(r)
                ? String(+r.toFixed(10).replace(/\.?0+$/, '')).replace('.', ',')
                : 'Error');
        } catch { setCalcRes('Error'); }
    };

    // ── Gráfico helpers ───────────────────────────────────────────────────────
    const openGrafico = () => {
        if (!showGrafico) {
            const rows = tabla ? tabla.filter(f => {
                const ni = parseDec(f.ni);
                const lbl = cfg.tipo==='cualitativa'?f.categoria:cfg.tipo==='cuant_cont'?f.intervalo:f.xi;
                return ni > 0 && lbl;
            }) : [];
            setBarHeights(rows.map(()=>0));
            setGrafStep(1); setGrafCfg({barType:null,ejeX:null,ejeY:null}); setGrafChecked(false); setGrafDrag(null);
        }
        setShowGrafico(s=>!s);
    };
    const stopDrag = () => setGrafDrag(null);
    const startBarDrag = (idx, clientY) => {
        setGrafDrag(idx);
        if (!svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const svgY = (clientY - rect.top) * (260 / rect.height);
        const h = Math.max(0, Math.min(200, 218 - svgY));
        setBarHeights(prev => { const a=[...prev]; a[idx]=h; return a; });
    };
    const onSvgMove = (clientY) => {
        if (grafDrag === null || !svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const svgY = (clientY - rect.top) * (260 / rect.height);
        const h = Math.max(0, Math.min(200, 218 - svgY));
        setBarHeights(prev => { const a=[...prev]; a[grafDrag]=h; return a; });
    };

    // ── Paso 1: configuración ──────────────────────────────────────────────────
    if (paso === 1) return (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.93)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
            <div style={{...CARD,maxWidth:500,width:'100%',boxShadow:'0 24px 64px rgba(0,0,0,0.7)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}>
                    <div style={{fontWeight:700,fontSize:'1.15rem',color:D.gold}}>🖊 Modo Pizarra</div>
                    <button onClick={onClose} style={{background:'transparent',border:'none',color:D.muted,fontSize:'1.5rem',cursor:'pointer',lineHeight:1,padding:'0 4px'}}>×</button>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                    <div>
                        <div style={{fontSize:'0.72rem',color:D.muted,fontWeight:700,marginBottom:5,letterSpacing:.5}}>VARIABLE ESTADÍSTICA</div>
                        <input value={cfg.variable} onChange={e=>setCfg(c=>({...c,variable:e.target.value}))}
                            placeholder="Ej: Altura en cm, Número de hermanos…"
                            style={{width:'100%',boxSizing:'border-box',padding:'10px 12px',borderRadius:9,border:`1.5px solid ${D.border}`,background:D.bg,color:D.text,fontSize:'0.9rem',outline:'none'}}/>
                    </div>
                    <div>
                        <div style={{fontSize:'0.72rem',color:D.muted,fontWeight:700,marginBottom:5,letterSpacing:.5}}>POBLACIÓN</div>
                        <input value={cfg.poblacion} onChange={e=>setCfg(c=>({...c,poblacion:e.target.value}))}
                            placeholder="Ej: Todos los alumnos del centro…"
                            style={{width:'100%',boxSizing:'border-box',padding:'10px 12px',borderRadius:9,border:`1.5px solid ${D.border}`,background:D.bg,color:D.text,fontSize:'0.9rem',outline:'none'}}/>
                    </div>
                    <div>
                        <div style={{fontSize:'0.72rem',color:D.muted,fontWeight:700,marginBottom:8,letterSpacing:.5}}>TIPO DE VARIABLE</div>
                        <div style={{display:'flex',flexDirection:'column',gap:6}}>
                            {[
                                {v:'cuant_cont',  lbl:'Cuantitativa continua',  sub:'Con intervalos · Histograma'},
                                {v:'cuant_disc',  lbl:'Cuantitativa discreta',  sub:'Sin intervalos · Diagrama de barras'},
                                {v:'cualitativa', lbl:'Cualitativa',            sub:'Nominal u ordinal'},
                            ].map(({v,lbl,sub})=>(
                                <button key={v} onClick={()=>setCfg(c=>({...c,tipo:v}))}
                                    style={{padding:'11px 14px',borderRadius:9,cursor:'pointer',textAlign:'left',
                                        border:`2px solid ${cfg.tipo===v?D.accent:D.border}`,
                                        background:cfg.tipo===v?'#1a2a3a':D.bg,color:D.text}}>
                                    <span style={{fontWeight:700}}>{lbl}</span>
                                    <span style={{fontSize:'0.75rem',color:D.muted,marginLeft:10}}>{sub}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <button onClick={continuar} disabled={!cfg.variable.trim()}
                        style={{...BTN(D.accent),justifyContent:'center',marginTop:4,padding:'12px 20px',fontSize:'1rem',opacity:cfg.variable.trim()?1:0.45}}>
                        Continuar →
                    </button>
                </div>
            </div>
        </div>
    );

    // ── Paso 2: tabla + estadísticos + calculadora ─────────────────────────────
    const cols     = TIPO_COLS[cfg.tipo];
    const totCols  = TOT_COLS[cfg.tipo];
    const totSpan  = TOT_SPAN[cfg.tipo];
    const KEYS     = ['7','8','9','4','5','6','1','2','3',',','0','back'];

    const nextCell = () => {
        if (!active) return;
        const { row, col } = active;
        const kbCols = cols.filter(c => KB_COLS.has(c));
        const totColsSet = new Set(totCols);
        if (row === -2) {
            const paramKeys = ['media','mediana','moda','rango','dt'];
            const pIdx = paramKeys.indexOf(col);
            if (pIdx < paramKeys.length - 1) setActive({ row:-2, col:paramKeys[pIdx+1] });
            else setActive(null);
        } else if (row === -1) {
            const colIdx = kbCols.indexOf(col);
            setActive({ row:0, col:kbCols[(colIdx+1) % kbCols.length] });
        } else {
            if (row < tabla.length - 1) {
                setActive({ row:row+1, col });
            } else if (totColsSet.has(col)) {
                setActive({ row:-1, col });
            } else {
                const colIdx = kbCols.indexOf(col);
                setActive({ row:0, col:kbCols[(colIdx+1) % kbCols.length] });
            }
        }
    };

    const CALC_BTNS = [
        {lbl:'AC',  act:()=>{setCalcExpr('');setCalcRes(null);}, bg:'#7b1010'},
        {lbl:'←',   act:()=>setCalcExpr(e=>e.slice(0,-1)),      bg:'#30363d'},
        {lbl:'(',   act:()=>setCalcExpr(e=>e+'('),               bg:'#30363d'},
        {lbl:')',   act:()=>setCalcExpr(e=>e+')'),               bg:'#30363d'},
        {lbl:'√(',  act:()=>setCalcExpr(e=>e+'√('),             bg:D.accent},
        {lbl:'x²',  act:()=>setCalcExpr(e=>e+'^2'),              bg:D.accent},
        {lbl:'÷',   act:()=>setCalcExpr(e=>e+'/'),               bg:'#6e3a1a'},
        {lbl:'×',   act:()=>setCalcExpr(e=>e+'×'),               bg:'#6e3a1a'},
        {lbl:'7',   act:()=>setCalcExpr(e=>e+'7')},
        {lbl:'8',   act:()=>setCalcExpr(e=>e+'8')},
        {lbl:'9',   act:()=>setCalcExpr(e=>e+'9')},
        {lbl:'-',   act:()=>setCalcExpr(e=>e+'-'),               bg:'#6e3a1a'},
        {lbl:'4',   act:()=>setCalcExpr(e=>e+'4')},
        {lbl:'5',   act:()=>setCalcExpr(e=>e+'5')},
        {lbl:'6',   act:()=>setCalcExpr(e=>e+'6')},
        {lbl:'+',   act:()=>setCalcExpr(e=>e+'+'),               bg:'#6e3a1a'},
        {lbl:'1',   act:()=>setCalcExpr(e=>e+'1')},
        {lbl:'2',   act:()=>setCalcExpr(e=>e+'2')},
        {lbl:'3',   act:()=>setCalcExpr(e=>e+'3')},
        {lbl:'=',   act:evalCalc,                                 bg:D.green},
        {lbl:',',   act:()=>setCalcExpr(e=>e+',')},
        {lbl:'0',   act:()=>setCalcExpr(e=>e+'0')},
        {lbl:'.',   act:()=>setCalcExpr(e=>e+'.')},
        {lbl:'',    act:()=>{},                                   bg:'transparent'},
    ];

    const cellCss = (col, row) => {
        const isAct = active?.row === row && active?.col === col;
        let border = isAct ? D.accent : D.border;
        let bg = D.bg, color = D.text;
        // Check por columna individual
        if (COMP_COLS.has(col) && colChecked[col]) {
            const ok = row === -1 ? colChecked[col].total : colChecked[col].rows?.[row];
            if (ok !== null && ok !== undefined) {
                border = ok ? D.green : D.red;
                bg     = ok ? '#0d3321' : '#2c0d0d';
                color  = ok ? D.green2 : D.red;
            }
        }
        // Comprobar global sobreescribe
        if (checked) {
            const ok = row === -1
                ? totValRes?.[col]
                : COMP_COLS.has(col) ? valRes?.[row]?.[col] : undefined;
            if (ok !== undefined && ok !== null) {
                border = ok ? D.green : D.red;
                bg     = ok ? '#0d3321' : '#2c0d0d';
                color  = ok ? D.green2  : D.red;
            }
        }
        return {
            width:'100%', padding:'5px 2px', textAlign:'center',
            boxSizing:'border-box', borderRadius:5, fontSize:'1.1rem', fontWeight:600,
            border:`1.5px solid ${border}`, background:bg, color,
            cursor: checked ? 'default' : 'pointer', userSelect:'none', display:'block',
        };
    };

    const activeVal = active
        ? (active.row === -2 ? params[active.col]
           : active.row === -1 ? totales[active.col]
           : tabla?.[active.row]?.[active.col])
        : '';

    // — Gráfico computed ——
    const grafRows = tabla ? tabla.filter(f => {
        const ni = parseDec(f.ni);
        const lbl = cfg.tipo==='cualitativa'?f.categoria:cfg.tipo==='cuant_cont'?f.intervalo:f.xi;
        return ni > 0 && lbl;
    }) : [];
    const GW=540,GH=260,GPL=44,GPB=42,GPT=18,GPR=10,GCW=GW-GPL-GPR,GCH=GH-GPT-GPB;
    const gmaxNi = Math.max(...grafRows.map(f=>parseDec(f.ni)||0), 1);
    const gSlotW = grafRows.length ? GCW/grafRows.length : GCW;
    const gJuntas = grafCfg.barType==='juntas';
    const gBW = gSlotW*(gJuntas?1:0.82), gBOff = gSlotW*(gJuntas?0:0.09);
    const GCOLS=['#3498db','#e74c3c','#27ae60','#f39c12','#9b59b6','#1abc9c','#e67e22','#fd79a8'];
    const gYStep=Math.max(1,Math.ceil(gmaxNi/4));
    const gYTicks=[];
    for(let v=0;v<=gmaxNi;v+=gYStep) gYTicks.push(v);
    if(gYTicks[gYTicks.length-1]<gmaxNi) gYTicks.push(gmaxNi);
    const EJEX_CORRECT=cfg.tipo==='cuant_cont'?'intervalos':cfg.tipo==='cuant_disc'?'valores':'categorias';
    const EJEX_OPTS=cfg.tipo==='cuant_cont'
        ?[{v:'intervalos',lbl:'Los intervalos de clase'},{v:'ni',lbl:'Las frecuencias nᵢ'},{v:'xi',lbl:'Las marcas xᵢ'}]
        :cfg.tipo==='cuant_disc'
        ?[{v:'valores',lbl:'Los valores xᵢ'},{v:'ni',lbl:'Las frecuencias nᵢ'},{v:'intervalos',lbl:'Los intervalos'}]
        :[{v:'categorias',lbl:'Las categorías'},{v:'ni',lbl:'Las frecuencias nᵢ'},{v:'xi',lbl:'Valores numéricos'}];
    const EJEY_OPTS=[{v:'ni',lbl:'Frecuencias absolutas nᵢ'},{v:'xi',lbl:'Valores / Intervalos'},{v:'pct',lbl:'Porcentajes %'}];
    const grafAllQ = grafCfg.barType && grafCfg.ejeX && grafCfg.ejeY;
    const gmaxDrawn = Math.max(...barHeights,1);
    const gBarOk = grafRows.map((f,i)=>Math.abs((barHeights[i]||0)/gmaxDrawn-(parseDec(f.ni)||0)/gmaxNi)<=0.2);
    const gCorrQ1=(cfg.tipo==='cuant_cont'?'juntas':'separadas')===grafCfg.barType;
    const gCorrQ2=EJEX_CORRECT===grafCfg.ejeX, gCorrQ3='ni'===grafCfg.ejeY;

    return (
        <div style={{position:'fixed',inset:0,background:D.bg,zIndex:9999,display:'flex',flexDirection:'column',overflow:'hidden'}}>

            {/* Header */}
            <div style={{padding:'10px 16px',background:D.card,borderBottom:`1px solid ${D.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0,gap:8}}>
                <div style={{minWidth:0}}>
                    <span style={{fontWeight:700,color:D.gold,fontSize:'1rem'}}>🖊 Modo Pizarra</span>
                    <span style={{fontSize:'0.75rem',color:D.muted,marginLeft:10}}>{cfg.variable}</span>
                </div>
                <div style={{display:'flex',gap:6,flexShrink:0}}>
                    <button onClick={()=>setPaso(1)} style={{...BTN('#30363d'),padding:'6px 12px',fontSize:'0.78rem'}}>← Config</button>
                    <button onClick={onClose}        style={{...BTN('#30363d'),padding:'6px 12px',fontSize:'0.78rem'}}>Salir</button>
                </div>
            </div>

            {/* Info strip */}
            <div style={{padding:'6px 16px',background:'#1a2a3a',borderBottom:`1px solid ${D.border}`,fontSize:'0.75rem',color:D.muted,flexShrink:0,display:'flex',flexWrap:'wrap',gap:12}}>
                <span><b style={{color:D.text}}>Variable:</b> {cfg.variable}</span>
                {cfg.poblacion && <span><b style={{color:D.text}}>Población:</b> {cfg.poblacion}</span>}
                {N > 0 && <span style={{color:D.gold}}>N = {N}</span>}
            </div>

            {/* Scrollable area */}
            <div style={{flex:1, overflowY:'auto', padding:'12px 16px'}}>

                {/* ── Tabla ── */}
                <div style={{overflowX:'auto', marginBottom:16}}>
                    <table style={{borderCollapse:'collapse', fontSize:'0.8rem', width:'auto', tableLayout:'fixed'}}>
                        <thead>
                            <tr style={{background:D.accent, color:'white'}}>
                                {cols.map(c=>{
                                    const cd = colChecked[c];
                                    const allOk = cd && cd.rows.every(v=>v===true) && (cd.total===null||cd.total===true);
                                    const hasBad = cd && (cd.rows.some(v=>v===false) || cd.total===false);
                                    return (
                                        <th key={c} style={{width:COL_W[c]||50,padding:'4px 3px 3px',border:`1px solid ${D.border}`,whiteSpace:'normal',lineHeight:1.2,fontSize:'0.72rem',verticalAlign:'top',textAlign:'center'}}>
                                            <div style={{marginBottom:COMP_COLS.has(c)?4:0}}>{HEADS[c]}</div>
                                            {COMP_COLS.has(c) && (
                                                <button onClick={()=>checkCol(c)}
                                                    style={{padding:'2px 0',width:'100%',borderRadius:5,border:`1px solid ${!cd?'rgba(255,255,255,0.25)':allOk?D.green:D.red}`,
                                                        background:!cd?'rgba(255,255,255,0.12)':allOk?'#0d3321':'#2c0d0d',
                                                        color:!cd?'white':allOk?D.green2:D.red,
                                                        fontWeight:700,fontSize:'0.75rem',cursor:'pointer'}}>
                                                    ✓
                                                </button>
                                            )}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {tabla.map((fila, i) => (
                                <tr key={i} style={{borderBottom:`1px solid ${D.border}`}}>
                                    {cols.map(col => {
                                        const isKb = KB_COLS.has(col);
                                        const isAct = active?.row === i && active?.col === col;
                                        if (isKb) return (
                                            <td key={col} style={{padding:3,border:`1px solid ${D.border}`}}>
                                                <div onClick={()=>{ if(!checked) setActive(isAct?null:{row:i,col}); }}
                                                    style={cellCss(col, i)}>
                                                    {fila[col] || ''}
                                                    {isAct && <span style={{borderRight:'2px solid #58a6ff',marginLeft:1}}>&nbsp;</span>}
                                                    {!fila[col] && !isAct && <span style={{color:D.border}}>—</span>}
                                                </div>
                                            </td>
                                        );
                                        return (
                                            <td key={col} style={{padding:3,border:`1px solid ${D.border}`}}>
                                                <input value={fila[col]} disabled={checked}
                                                    onFocus={()=>setActive(null)}
                                                    onChange={e=>{ setTabla(t=>{ const a=t.map(r=>({...r})); a[i]={...a[i],[col]:e.target.value}; return a; }); }}
                                                    style={{width:'100%',minWidth:70,padding:'6px 4px',textAlign:'center',boxSizing:'border-box',outline:'none',borderRadius:5,fontSize:'0.8rem',border:`1.5px solid ${D.border}`,background:D.bg,color:D.text}}/>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}

                            {/* Fila totales */}
                            <tr style={{background:'#1a1a2e', fontWeight:700}}>
                                <td colSpan={totSpan} style={{padding:'7px 8px',textAlign:'right',color:D.gold,border:`1px solid ${D.border}`,fontSize:'0.78rem',whiteSpace:'nowrap'}}>
                                    TOTALES Σ →
                                </td>
                                {totCols.map(col => {
                                    const isAct = active?.row === -1 && active?.col === col;
                                    return (
                                        <td key={col} style={{padding:3,border:`1px solid ${D.border}`}}>
                                            <div onClick={()=>{ if(!checked) setActive(isAct?null:{row:-1,col}); }}
                                                style={cellCss(col, -1)}>
                                                {totales[col] || ''}
                                                {isAct && <span style={{borderRight:'2px solid #58a6ff',marginLeft:1}}>&nbsp;</span>}
                                                {!totales[col] && !isAct && <span style={{color:D.border}}>—</span>}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* ── Parámetros estadísticos (manual) ── */}
                {cfg.tipo !== 'cualitativa' && (
                    <div style={{...CARD,background:'#0b1520',border:`1px solid ${D.accent}`,marginBottom:14,padding:14}}>
                        <div style={{fontSize:'0.68rem',color:D.accent,fontWeight:700,marginBottom:10,letterSpacing:.6}}>
                            PARÁMETROS — rellena con el teclado y comprueba
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))',gap:8}}>
                            {[
                                {key:'media',   lbl:'Media x̄'},
                                {key:'mediana', lbl:'Mediana Me'},
                                {key:'moda',    lbl:'Moda Mo'},
                                {key:'rango',   lbl:'Rango'},
                                {key:'dt',      lbl:'Desv. típica σ'},
                            ].map(({key, lbl}) => {
                                const isAct = active?.row === -2 && active?.col === key;
                                const ok = paramsRes?.[key];
                                const correctVal = st ? (
                                    key === 'media'   ? st.mean :
                                    key === 'mediana' ? st.mediana :
                                    key === 'moda'    ? st.modas?.[0] :
                                    key === 'rango'   ? st.rango :
                                    key === 'dt'      ? st.dt : null
                                ) : null;
                                let bdr = isAct ? D.accent : D.border;
                                let pbg = D.bg, tc = D.text;
                                if (paramsRes) {
                                    bdr = ok ? D.green : D.red;
                                    pbg = ok ? '#0d3321' : '#2c0d0d';
                                    tc  = ok ? D.green2 : D.red;
                                }
                                return (
                                    <div key={key}>
                                        <div style={{fontSize:'0.62rem',color:D.muted,marginBottom:3,fontWeight:700}}>{lbl}</div>
                                        <div onClick={()=>{ if(!checked) setActive(isAct?null:{row:-2,col:key}); }}
                                            style={{background:pbg,borderRadius:8,padding:'8px 10px',border:`1.5px solid ${bdr}`,
                                                color:tc,fontSize:'1rem',fontWeight:700,textAlign:'center',
                                                cursor:checked?'default':'pointer',userSelect:'none',minHeight:38,
                                                display:'flex',alignItems:'center',justifyContent:'center',gap:2}}>
                                            {params[key] || ''}
                                            {isAct && <span style={{borderRight:'2px solid #58a6ff',marginLeft:1}}>&nbsp;</span>}
                                            {!params[key] && !isAct && <span style={{color:D.border,fontWeight:400}}>—</span>}
                                        </div>
                                        {paramsRes && !ok && correctVal !== null && (
                                            <div style={{fontSize:'0.68rem',color:D.red,marginTop:2}}>→ {fmt(correctVal,3)}</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── Calculadora ── */}
                <div style={{marginBottom:14}}>
                    <button onClick={()=>setShowCalc(s=>!s)}
                        style={{...BTN('#30363d'),fontSize:'0.8rem',padding:'7px 14px',marginBottom: showCalc?8:0}}>
                        🧮 Calculadora {showCalc ? '▲' : '▼'}
                    </button>
                    {showCalc && (
                        <div style={{...CARD,background:'#0d1117',maxWidth:310,padding:14}}>
                            {/* Display */}
                            <div style={{background:D.bg,borderRadius:8,padding:'10px 12px',marginBottom:10,border:`1px solid ${D.border}`,minHeight:56}}>
                                <div style={{fontSize:'0.8rem',color:D.muted,wordBreak:'break-all',minHeight:18,fontFamily:'monospace'}}>
                                    {calcExpr || <span style={{opacity:.4}}>0</span>}
                                </div>
                                {calcRes !== null && (
                                    <div style={{fontSize:'1.4rem',fontWeight:700,color:D.gold,textAlign:'right',marginTop:4,fontFamily:'monospace'}}>
                                        = {calcRes}
                                    </div>
                                )}
                            </div>
                            {/* Botones 4×6 */}
                            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:5}}>
                                {CALC_BTNS.map(({lbl,act,bg},idx)=>(
                                    lbl === ''
                                    ? <div key={idx}/>
                                    : <button key={idx} onClick={act}
                                        style={{padding:'11px 0',borderRadius:8,border:`1px solid ${D.border}`,
                                            background: bg || D.dark2,
                                            color: D.text, fontWeight:700, fontSize:'0.9rem', cursor:'pointer'}}>
                                        {lbl}
                                      </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Botones de acción ── */}
                <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                    {!checked ? (
                        <>
                            <button onClick={()=>setTabla(t=>[...t,emptyRow(cfg.tipo)])}
                                style={{...BTN('#30363d'),padding:'7px 12px',fontSize:'0.8rem'}}>+ Fila</button>
                            {tabla.length > 1 && (
                                <button onClick={()=>setTabla(t=>t.slice(0,-1))}
                                    style={{...BTN('#30363d'),padding:'7px 12px',fontSize:'0.8rem'}}>− Fila</button>
                            )}
                            <button onClick={comprobar} disabled={N === 0}
                                style={{...BTN(D.gold,'#111'),padding:'8px 18px',fontSize:'0.9rem',opacity:N===0?0.45:1}}>
                                ✓ Comprobar
                            </button>
                        </>
                    ) : (
                        <>
                            <div style={{...CARD,padding:'8px 14px',background:'#0d1a0d',border:`1px solid ${D.green}`,fontSize:'0.82rem'}}>
                                <span style={{color:D.green2}}>
                                    {valRes && totValRes && (()=>{
                                        const cOk  = valRes.flatMap(r=>Object.values(r)).filter(Boolean).length;
                                        const cTot = valRes.flatMap(r=>Object.values(r)).length;
                                        const tOk  = Object.values(totValRes).filter(Boolean).length;
                                        const tTot = Object.values(totValRes).length;
                                        const pOk  = paramsRes ? Object.values(paramsRes).filter(Boolean).length : 0;
                                        const pTot = paramsRes ? Object.values(paramsRes).length : 0;
                                        return `${cOk+tOk+pOk} / ${cTot+tTot+pTot} celdas correctas`;
                                    })()}
                                </span>
                            </div>
                            <button onClick={()=>{setChecked(false);setValRes(null);setTotValRes(null);setParamsRes(null);}}
                                style={{...BTN('#30363d'),padding:'7px 12px',fontSize:'0.8rem'}}>Editar</button>
                            <button onClick={resetTabla}
                                style={{...BTN(D.red),padding:'7px 12px',fontSize:'0.8rem'}}>Limpiar todo</button>
                        </>
                    )}
                </div>

                {/* ── Gráfico interactivo ── */}
                <div style={{marginTop:12}}>
                    <button onClick={openGrafico}
                        style={{...BTN('#30363d'),fontSize:'0.8rem',padding:'7px 14px',marginBottom:showGrafico?8:0}}>
                        📊 Gráfico {showGrafico ? '▲' : '▼'}
                    </button>

                    {showGrafico && (
                        <div style={{...CARD,padding:14}}>

                            {/* PASO 1: preguntas */}
                            {grafStep===1 && (
                                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                                    <div style={{fontWeight:700,color:D.gold,fontSize:'0.9rem'}}>Preguntas del gráfico</div>

                                    {/* Q1 barras */}
                                    <div>
                                        <div style={{fontSize:'0.72rem',color:D.muted,fontWeight:700,marginBottom:6,letterSpacing:.4}}>¿CÓMO SE DIBUJAN LAS BARRAS?</div>
                                        <div style={{display:'flex',gap:8}}>
                                            {[{v:'juntas',lbl:'Barras JUNTAS',sub:'Histograma'},{v:'separadas',lbl:'Barras SEPARADAS',sub:'Diagrama de barras'}].map(({v,lbl,sub})=>(
                                                <button key={v} onClick={()=>setGrafCfg(g=>({...g,barType:v}))}
                                                    style={{flex:1,padding:'10px 8px',borderRadius:9,cursor:'pointer',textAlign:'center',
                                                        border:`2px solid ${grafCfg.barType===v?D.accent:D.border}`,
                                                        background:grafCfg.barType===v?'#1a2a3a':D.bg,color:D.text}}>
                                                    <div style={{fontWeight:700,fontSize:'0.85rem'}}>{lbl}</div>
                                                    <div style={{fontSize:'0.7rem',color:D.muted,marginTop:3}}>{sub}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Q2 eje X */}
                                    <div>
                                        <div style={{fontSize:'0.72rem',color:D.muted,fontWeight:700,marginBottom:6,letterSpacing:.4}}>¿QUÉ SE PONE EN EL EJE X (HORIZONTAL)?</div>
                                        <div style={{display:'flex',flexDirection:'column',gap:6}}>
                                            {EJEX_OPTS.map(({v,lbl})=>(
                                                <button key={v} onClick={()=>setGrafCfg(g=>({...g,ejeX:v}))}
                                                    style={{padding:'9px 12px',borderRadius:9,cursor:'pointer',textAlign:'left',fontSize:'0.85rem',
                                                        border:`2px solid ${grafCfg.ejeX===v?D.accent:D.border}`,
                                                        background:grafCfg.ejeX===v?'#1a2a3a':D.bg,color:D.text,fontWeight:grafCfg.ejeX===v?700:400}}>
                                                    {lbl}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Q3 eje Y */}
                                    <div>
                                        <div style={{fontSize:'0.72rem',color:D.muted,fontWeight:700,marginBottom:6,letterSpacing:.4}}>¿QUÉ SE PONE EN EL EJE Y (VERTICAL)?</div>
                                        <div style={{display:'flex',flexDirection:'column',gap:6}}>
                                            {EJEY_OPTS.map(({v,lbl})=>(
                                                <button key={v} onClick={()=>setGrafCfg(g=>({...g,ejeY:v}))}
                                                    style={{padding:'9px 12px',borderRadius:9,cursor:'pointer',textAlign:'left',fontSize:'0.85rem',
                                                        border:`2px solid ${grafCfg.ejeY===v?D.accent:D.border}`,
                                                        background:grafCfg.ejeY===v?'#1a2a3a':D.bg,color:D.text,fontWeight:grafCfg.ejeY===v?700:400}}>
                                                    {lbl}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <button onClick={()=>setGrafStep(2)} disabled={!grafAllQ}
                                        style={{...BTN(D.accent),justifyContent:'center',opacity:grafAllQ?1:0.4,padding:'11px 20px'}}>
                                        Dibujar el gráfico →
                                    </button>
                                </div>
                            )}

                            {/* PASO 2: dibujar */}
                            {grafStep===2 && (
                                <div>
                                    <div style={{display:'flex',gap:8,marginBottom:8,alignItems:'center',flexWrap:'wrap'}}>
                                        <button onClick={()=>{setGrafStep(1);setGrafChecked(false);}}
                                            style={{...BTN('#30363d'),padding:'6px 12px',fontSize:'0.78rem'}}>← Preguntas</button>
                                        <span style={{fontSize:'0.72rem',color:D.muted}}>
                                            Haz clic y arrastra hacia arriba para levantar cada barra
                                        </span>
                                    </div>

                                    <div style={{overflowX:'auto'}}>
                                        <svg ref={svgRef}
                                            viewBox={`0 0 ${GW} ${GH}`}
                                            style={{width:'100%',maxWidth:GW,display:'block',touchAction:'none',cursor:grafDrag!==null?'ns-resize':'default'}}
                                            onMouseMove={e=>onSvgMove(e.clientY)}
                                            onMouseUp={stopDrag}
                                            onMouseLeave={stopDrag}
                                            onTouchMove={e=>{e.preventDefault();onSvgMove(e.touches[0].clientY);}}
                                            onTouchEnd={stopDrag}>

                                            {/* Fondo */}
                                            <rect x={0} y={0} width={GW} height={GH} fill={D.bg} rx={8}/>

                                            {/* Grid + Y ticks */}
                                            {gYTicks.map((v,i)=>{
                                                const y=GPT+GCH-(v/gmaxNi*GCH);
                                                return (<g key={i}>
                                                    <line x1={GPL} y1={y} x2={GW-GPR} y2={y} stroke="#30363d" strokeWidth={1}/>
                                                    <text x={GPL-4} y={y+4} textAnchor="end" fontSize={10} fill={D.muted}>{v}</text>
                                                </g>);
                                            })}

                                            {/* Barras */}
                                            {grafRows.map((f,i)=>{
                                                const x=GPL+i*gSlotW+gBOff;
                                                const h=barHeights[i]||0;
                                                const yBar=GPT+GCH-h;
                                                const col=grafChecked?(gBarOk[i]?D.green:D.red):GCOLS[i%GCOLS.length];
                                                const lbl=cfg.tipo==='cualitativa'?f.categoria:cfg.tipo==='cuant_cont'?f.intervalo:f.xi;
                                                const lblShort=lbl&&lbl.length>10?lbl.replace(/\s/g,''):lbl;
                                                return (<g key={i}>
                                                    {/* Barra coloreada */}
                                                    {h>0&&<rect x={x} y={yBar} width={gBW} height={h}
                                                        fill={col} opacity={0.88} rx={gJuntas?0:3}/>}
                                                    {/* Zona de interacción */}
                                                    <rect x={GPL+i*gSlotW} y={GPT} width={gSlotW} height={GCH}
                                                        fill="transparent" style={{cursor:'ns-resize'}}
                                                        onMouseDown={e=>{e.preventDefault();startBarDrag(i,e.clientY);}}
                                                        onTouchStart={e=>startBarDrag(i,e.touches[0].clientY)}/>
                                                    {/* Valor encima */}
                                                    {h>8&&<text x={x+gBW/2} y={yBar-3} textAnchor="middle"
                                                        fontSize={11} fill={col} fontWeight="700">
                                                        {Math.round(h/GCH*gmaxNi*10)/10}
                                                    </text>}
                                                    {/* Etiqueta X */}
                                                    <text x={GPL+i*gSlotW+gSlotW/2} y={GH-GPB+14}
                                                        textAnchor="middle" fontSize={9} fill={D.muted}
                                                        transform={grafRows.length>5?`rotate(-35,${GPL+i*gSlotW+gSlotW/2},${GH-GPB+14})`:undefined}>
                                                        {lblShort}
                                                    </text>
                                                </g>);
                                            })}

                                            {/* Ejes */}
                                            <line x1={GPL} y1={GPT} x2={GPL} y2={GPT+GCH} stroke={D.muted} strokeWidth={2}/>
                                            <line x1={GPL} y1={GPT+GCH} x2={GW-GPR} y2={GPT+GCH} stroke={D.muted} strokeWidth={2}/>
                                            <text x={GPL/2-2} y={GPT+GCH/2} textAnchor="middle" fontSize={10} fill={D.muted}
                                                transform={`rotate(-90,${GPL/2-2},${GPT+GCH/2})`}>nᵢ</text>
                                        </svg>
                                    </div>

                                    {!grafChecked ? (
                                        <div style={{marginTop:10,display:'flex',gap:8,flexWrap:'wrap'}}>
                                            <button onClick={()=>setGrafChecked(true)}
                                                disabled={barHeights.every(h=>h===0)}
                                                style={{...BTN(D.gold,'#111'),opacity:barHeights.every(h=>h===0)?0.4:1}}>
                                                ✓ Comprobar gráfico
                                            </button>
                                            <button onClick={()=>setBarHeights(grafRows.map(()=>0))}
                                                style={{...BTN('#30363d'),padding:'8px 12px',fontSize:'0.8rem'}}>
                                                Borrar barras
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{...CARD,background:'#0b1520',border:`1px solid ${D.border}`,padding:12,marginTop:10,fontSize:'0.82rem'}}>
                                            <div style={{fontWeight:700,color:D.accent,marginBottom:8}}>Resultados</div>
                                            {[
                                                {lbl:'Tipo de gráfico', ok:gCorrQ1, msg:gCorrQ1?'✓':`✗ → ${(cfg.tipo==='cuant_cont'?'juntas':'separadas')==='juntas'?'Barras juntas':'Barras separadas'}`},
                                                {lbl:'Eje X', ok:gCorrQ2, msg:gCorrQ2?'✓':`✗ → ${EJEX_OPTS.find(o=>o.v===EJEX_CORRECT)?.lbl}`},
                                                {lbl:'Eje Y', ok:gCorrQ3, msg:gCorrQ3?'✓':'✗ → Frecuencias absolutas nᵢ'},
                                            ].map(({lbl,ok,msg})=>(
                                                <div key={lbl} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:`1px solid ${D.border}`,gap:8}}>
                                                    <span style={{color:D.muted}}>{lbl}</span>
                                                    <span style={{color:ok?D.green2:D.red,fontWeight:700}}>{msg}</span>
                                                </div>
                                            ))}
                                            <div style={{marginTop:8,color:D.muted}}>
                                                Barras: <b style={{color:D.text}}>{gBarOk.filter(Boolean).length}/{gBarOk.length}</b> proporciones correctas (±20%)
                                            </div>
                                            <button onClick={()=>{setGrafChecked(false);setBarHeights(grafRows.map(()=>0));}}
                                                style={{...BTN('#30363d'),padding:'6px 12px',fontSize:'0.78rem',marginTop:10}}>
                                                Volver a dibujar
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Teclado numérico (fijo abajo) ── */}
            {active && !checked && (
                <div style={{background:D.card,borderTop:`2px solid ${D.accent}`,padding:'10px 16px',flexShrink:0}}>
                    <div style={{fontSize:'0.7rem',color:D.muted,marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span>
                            Celda: <b style={{color:D.accent}}>{HEADS[active.col] || PARAM_LABELS[active.col] || active.col}</b>
                            {active.row === -2 ? ' (PARÁMETRO)' : active.row === -1 ? ' (TOTALES)' : `  fila ${active.row + 1}`}
                            {activeVal ? <b style={{color:D.text,fontFamily:'monospace',marginLeft:8,fontSize:'0.78rem'}}>{activeVal}</b> : null}
                        </span>
                        <button onClick={()=>setActive(null)} style={{background:'transparent',border:'none',color:D.muted,cursor:'pointer',fontSize:'0.9rem',padding:'0 4px'}}>✕</button>
                    </div>
                    {active.col === 'intervalo' ? (
                        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:7,maxWidth:300}}>
                            {['7','8','9','back','4','5','6','[','1','2','3',']',',','0','(',')'].map((k,idx)=>(
                                <button key={idx} onClick={()=>handleKey(k)}
                                    style={{padding:'14px 0',borderRadius:9,
                                        border:`1px solid ${k==='back'?D.red:['[',']','(',')'].includes(k)?D.accent:D.border}`,
                                        background:k==='back'?'#2c0d0d':['[',']','(',')'].includes(k)?'#1a2a3a':D.dark2,
                                        color:k==='back'?D.red:['[',']','(',')'].includes(k)?D.accent:D.text,
                                        fontWeight:700,fontSize:'1.1rem',cursor:'pointer'}}>
                                    {k === 'back' ? '←' : k}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:7,maxWidth:240}}>
                            {KEYS.map((k,idx)=>(
                                <button key={idx} onClick={()=>handleKey(k)}
                                    style={{padding:'14px 0',borderRadius:9,
                                        border:`1px solid ${k==='back'?D.red:D.border}`,
                                        background:k==='back'?'#2c0d0d':D.dark2,
                                        color:k==='back'?D.red:D.text,fontWeight:700,fontSize:'1.1rem',cursor:'pointer'}}>
                                    {k === 'back' ? '←' : k}
                                </button>
                            ))}
                        </div>
                    )}
                    <button onClick={nextCell}
                        style={{marginTop:6,width:'100%',maxWidth:active.col==='intervalo'?300:240,
                            padding:'10px 0',borderRadius:9,border:`1px solid ${D.accent}`,
                            background:'#1a2a3a',color:D.accent,fontWeight:700,fontSize:'0.9rem',cursor:'pointer'}}>
                        ↓ Sig. celda
                    </button>
                </div>
            )}
        </div>
    );
}
