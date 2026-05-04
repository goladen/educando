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
                {/* Grid lines */}
                {yTicks.map((v,i)=>(
                    <g key={i}>
                        <line x1={padL} y1={padT+scaleY(v)} x2={W-padR} y2={padT+scaleY(v)} stroke="#30363d" strokeWidth={1}/>
                        <text x={padL-4} y={padT+scaleY(v)+4} textAnchor="end" fontSize={10} fill={D.muted}>{v}</text>
                    </g>
                ))}
                {/* Bars */}
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
                {/* Axes */}
                <line x1={padL} y1={padT} x2={padL} y2={padT+chartH} stroke={D.muted} strokeWidth={1.5}/>
                <line x1={padL} y1={padT+chartH} x2={W-padR} y2={padT+chartH} stroke={D.muted} strokeWidth={1.5}/>
                {/* Axis labels */}
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

            {/* Gráfico real debajo de las preguntas */}
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
