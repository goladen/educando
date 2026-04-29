// EditorVideoQuizz.jsx — Editor de recursos VideoQuizz
// Igual que EditorOmni pero con campo youtubeUrl y tiempo por ejercicio.

import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { Save, ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp, Image as ImgIcon, Globe, Lock, Play } from 'lucide-react';
import PublicarModal from './PublicarModal';

// ─── helpers ─────────────────────────────────────────────────────────────────
const uid     = () => 'ex_' + Math.random().toString(36).slice(2, 8);
const itemUid = () => Math.random().toString(36).slice(2, 8);

function extractVideoId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/)([^&?/\s]{11})/);
  return m ? m[1] : null;
}

// MM:SS ↔ seconds
function secsToMmss(s) {
  if (!s && s !== 0) return '';
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
function mmssToSecs(str) {
  if (!str) return 0;
  const parts = str.split(':');
  if (parts.length === 2) return parseInt(parts[0]||0)*60 + parseInt(parts[1]||0);
  return parseInt(str) || 0;
}

const TIPOS = ['fill','choice','wordbank','construct','match','order','truefalse','multichoice','error'];
const TIPO_LABEL = {
  fill:'Fill in the blank', choice:'Choose the correct', wordbank:'Word bank',
  construct:'Write a sentence', match:'Match', order:'Order words',
  truefalse:'True / False', multichoice:'Multiple choice', error:'Find the error',
};
const TIPO_COLOR = {
  fill:'#6D28D9', choice:'#1D4ED8', wordbank:'#B45309', construct:'#047857',
  match:'#0F766E', order:'#C2410C', truefalse:'#0369A1', multichoice:'#7E22CE', error:'#B91C1C',
};
const NIVELES = ['1 ESO','2 ESO','3 ESO','4 ESO','1 Bach','2 Bach','Primaria','FP','Otros'];
const COLORES = ['#DC2626','#EA580C','#D97706','#059669','#0F766E','#1D4ED8','#6D28D9','#7E22CE','#0369A1','#374151'];

function newItem(tipo) {
  const id = itemUid();
  switch (tipo) {
    case 'fill':        return { id, lbl:'', parts:['',''], hint:'', ans:[''], alts:[[]] };
    case 'choice':      return { id, lbl:'', parts:['',''], opts:['',''], ans:'' };
    case 'wordbank':    return { id, lbl:'', parts:['',''], ans:[''], alts:[[]] };
    case 'construct':   return { id, lbl:'', prompt:'', ans:'', alts:[] };
    case 'match':       return { id, lbl:'', left:'', right:'' };
    case 'order':       return { id, lbl:'', shuffled:[''], answer:'' };
    case 'truefalse':   return { id, lbl:'', statement:'', ans:'true' };
    case 'multichoice': return { id, lbl:'', question:'', opts:['','','',''], ans:'' };
    case 'error':       return { id, lbl:'', sentence:'', errorWord:'', correction:'' };
    default:            return { id, lbl:'' };
  }
}

function newExercise() {
  return { id:uid(), tipo:'fill', titulo:'', enunciado:'', imagen:null, tiempo:0, items:[newItem('fill')] };
}

function generarCodigo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length:5}, ()=>chars[Math.floor(Math.random()*chars.length)]).join('');
}

const RECURSO_BASE = {
  titulo:'', nivel:'3 ESO', asignatura:'English', tema:'Listening',
  color:'#DC2626', descripcion:'', tags:[],
  pais:'', region:'', poblacion:'', ciclo:'Secundaria',
  youtubeUrl:'',
  ejercicios:[newExercise()],
};

// ─── Item sub-editors (same as EditorOmni) ───────────────────────────────────
function ItemEditorFill({ item, onChange }) {
  const nb = item.parts.length - 1;
  return (
    <div style={{fontSize:13,display:'flex',flexDirection:'column',gap:6}}>
      <label style={lbl}>Etiqueta</label>
      <input style={inp} value={item.lbl} onChange={e=>onChange('lbl',e.target.value)} placeholder="1."/>
      <label style={lbl}>Pista (ej: "(use)")</label>
      <input style={inp} value={item.hint} onChange={e=>onChange('hint',e.target.value)} placeholder="(verb)"/>
      <label style={lbl}>Partes de la frase</label>
      {item.parts.map((p,i)=>(
        <div key={i} style={{display:'flex',gap:6,alignItems:'center'}}>
          <span style={{fontSize:11,color:'#94A3B8',minWidth:50}}>{i===0?'Inicio':i<item.parts.length-1?`Parte ${i}`:'Final'}</span>
          <input style={{...inp,flex:1}} value={p} onChange={e=>{const np=[...item.parts];np[i]=e.target.value;onChange('parts',np);}} placeholder={`Parte ${i+1}`}/>
          {item.parts.length>2&&i>0&&i<item.parts.length-1&&(
            <button style={btnSm} onClick={()=>{const np=item.parts.filter((_,j)=>j!==i);const na=item.ans.filter((_,j)=>j!==i-1);const nl=item.alts.filter((_,j)=>j!==i-1);onChange('parts',np);onChange('ans',na);onChange('alts',nl);}}>✕</button>
          )}
        </div>
      ))}
      <button style={btnAdd} onClick={()=>{onChange('parts',[...item.parts.slice(0,-1),'',item.parts[item.parts.length-1]]);onChange('ans',[...item.ans,'']);onChange('alts',[...item.alts,[]]);}}>+ añadir hueco</button>
      {item.ans.map((a,i)=>(
        <div key={i}>
          <label style={lbl}>Respuesta {nb>1?`(hueco ${i+1})`:''}</label>
          <input style={inp} value={a} onChange={e=>{const n=[...item.ans];n[i]=e.target.value;onChange('ans',n);}} placeholder="respuesta"/>
          <label style={{...lbl,marginTop:4}}>Alternativas válidas (separadas por |)</label>
          <input style={inp} value={(item.alts?.[i]||[]).join('|')} onChange={e=>{const n=[...(item.alts||[])];n[i]=e.target.value.split('|').map(s=>s.trim()).filter(Boolean);onChange('alts',n);}} placeholder="wasn't | was not"/>
        </div>
      ))}
    </div>
  );
}

function ItemEditorChoice({ item, onChange }) {
  return (
    <div style={{fontSize:13,display:'flex',flexDirection:'column',gap:6}}>
      <label style={lbl}>Etiqueta</label><input style={inp} value={item.lbl} onChange={e=>onChange('lbl',e.target.value)} placeholder="1."/>
      <label style={lbl}>Inicio de frase</label><input style={inp} value={item.parts[0]} onChange={e=>onChange('parts',[e.target.value,item.parts[1]])} placeholder="She ___"/>
      <label style={lbl}>Final de frase</label><input style={inp} value={item.parts[1]} onChange={e=>onChange('parts',[item.parts[0],e.target.value])} placeholder=" every day."/>
      <label style={lbl}>Opciones</label>
      {item.opts.map((o,i)=>(
        <div key={i} style={{display:'flex',gap:6,alignItems:'center'}}>
          <input style={{...inp,flex:1}} value={o} onChange={e=>{const n=[...item.opts];n[i]=e.target.value;onChange('opts',n);}} placeholder={`Opción ${i+1}`}/>
          <input type="radio" checked={item.ans===o} onChange={()=>onChange('ans',o)} title="Correcta"/>
          {item.opts.length>2&&<button style={btnSm} onClick={()=>onChange('opts',item.opts.filter((_,j)=>j!==i))}>✕</button>}
        </div>
      ))}
      <button style={btnAdd} onClick={()=>onChange('opts',[...item.opts,''])}>+ opción</button>
    </div>
  );
}

function ItemEditorSimple({ item, onChange, tipo }) {
  const fields = {
    construct: [{f:'prompt',p:'Palabras clave (sep. /)'},{f:'ans',p:'Respuesta correcta'},{f:'alts_str',p:'Alternativas (sep. |)'}],
    match:     [{f:'left',p:'Columna izquierda'},{f:'right',p:'Columna derecha'}],
    order:     [{f:'shuffled_str',p:'Palabras mezcladas (sep. coma)'},{f:'answer',p:'Orden correcto'}],
    truefalse: [{f:'statement',p:'Enunciado'}],
    multichoice:[{f:'question',p:'Pregunta'}],
    error:     [{f:'sentence',p:'Frase con error'},{f:'errorWord',p:'Palabra incorrecta'},{f:'correction',p:'Corrección'}],
  };
  return (
    <div style={{fontSize:13,display:'flex',flexDirection:'column',gap:6}}>
      <label style={lbl}>Etiqueta</label>
      <input style={inp} value={item.lbl} onChange={e=>onChange('lbl',e.target.value)} placeholder="1."/>
      {(fields[tipo]||[]).map(({f,p})=>(
        <div key={f}>
          <label style={lbl}>{p}</label>
          <input style={inp} value={
            f==='alts_str'?(item.alts||[]).join('|'):
            f==='shuffled_str'?(item.shuffled||[]).join(', '):
            item[f]||''
          } onChange={e=>{
            if(f==='alts_str') onChange('alts',e.target.value.split('|').map(s=>s.trim()).filter(Boolean));
            else if(f==='shuffled_str') onChange('shuffled',e.target.value.split(',').map(s=>s.trim()).filter(Boolean));
            else onChange(f,e.target.value);
          }} placeholder={p}/>
        </div>
      ))}
      {tipo==='truefalse'&&(
        <div>
          <label style={lbl}>Respuesta</label>
          <select style={inp} value={item.ans} onChange={e=>onChange('ans',e.target.value)}>
            <option value="true">True</option><option value="false">False</option>
          </select>
        </div>
      )}
      {tipo==='multichoice'&&(
        <div>
          <label style={lbl}>Opciones (A-D)</label>
          {(item.opts||['','','','']).map((o,i)=>(
            <div key={i} style={{display:'flex',gap:6,alignItems:'center',marginBottom:4}}>
              <span style={{fontSize:11,color:'#94A3B8',minWidth:16}}>{['A','B','C','D'][i]}</span>
              <input style={{...inp,flex:1}} value={o} onChange={e=>{const n=[...(item.opts||[])];n[i]=e.target.value;onChange('opts',n);}} placeholder={`Opción ${i+1}`}/>
              <input type="radio" checked={item.ans===o} onChange={()=>onChange('ans',o)} title="Correcta"/>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ItemEditor({ tipo, item, onChange }) {
  switch(tipo) {
    case 'fill': case 'wordbank': return <ItemEditorFill item={item} onChange={onChange}/>;
    case 'choice': return <ItemEditorChoice item={item} onChange={onChange}/>;
    default: return <ItemEditorSimple item={item} onChange={onChange} tipo={tipo}/>;
  }
}

// ─── ExercisePanel ────────────────────────────────────────────────────────────
function ExercisePanel({ ex, idx, total, onUpdate, onDelete, onMove, color, onCapture }) {
  const [open,      setOpen]      = useState(true);
  const [openItems, setOpenItems] = useState({});
  const [mmss,      setMmss]      = useState(() => secsToMmss(ex.tiempo||0));

  const updateField = (k,v) => onUpdate({ ...ex, [k]:v });
  const updateItem  = (i,field,val) => { const items=ex.items.map((it,j)=>j===i?{...it,[field]:val}:it); onUpdate({...ex,items}); };
  const addItem     = () => onUpdate({...ex,items:[...ex.items,newItem(ex.tipo)]});
  const deleteItem  = (i) => onUpdate({...ex,items:ex.items.filter((_,j)=>j!==i)});
  const changeType  = (tipo) => onUpdate({...ex,tipo,items:[newItem(tipo)],wordbank:tipo==='wordbank'?['']:undefined});

  const tc = TIPO_COLOR[ex.tipo] || color;

  const handleMmssChange = (val) => {
    setMmss(val);
    // parse on blur / change
    const s = mmssToSecs(val);
    updateField('tiempo', s);
  };

  return (
    <div style={{border:'1px solid #E2E8F0',borderRadius:14,overflow:'hidden',marginBottom:12,borderLeft:`4px solid ${tc}`}}>
      <div style={{background:'#F8FAFC',padding:'12px 16px',display:'flex',alignItems:'center',gap:10}}>
        <div style={{width:28,height:28,borderRadius:8,background:tc,color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,flexShrink:0}}>{idx+1}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:600,color:'#0F172A',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{ex.titulo||'(sin título)'}</div>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{fontSize:10,fontWeight:700,padding:'1px 7px',borderRadius:10,background:`${tc}18`,color:tc}}>{TIPO_LABEL[ex.tipo]||ex.tipo}</span>
            {(ex.tiempo||0)>0&&<span style={{fontSize:10,color:'#94A3B8'}}>⏱ {secsToMmss(ex.tiempo)}</span>}
          </div>
        </div>
        <div style={{display:'flex',gap:4,alignItems:'center'}}>
          {idx>0&&<button style={btnSm} onClick={()=>onMove(idx,-1)}>↑</button>}
          {idx<total-1&&<button style={btnSm} onClick={()=>onMove(idx,1)}>↓</button>}
          <button style={btnSm} onClick={()=>onDelete(idx)}>🗑</button>
          <button onClick={()=>setOpen(o=>!o)} style={{border:'none',background:'transparent',cursor:'pointer',color:'#94A3B8',padding:'2px 4px'}}>
            {open?<ChevronUp size={16}/>:<ChevronDown size={16}/>}
          </button>
        </div>
      </div>

      {open&&(
        <div style={{padding:'16px'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
            <div>
              <label style={lbl}>Tipo de ejercicio</label>
              <select style={inp} value={ex.tipo} onChange={e=>changeType(e.target.value)}>
                {TIPOS.map(t=><option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Título del ejercicio</label>
              <input style={inp} value={ex.titulo} onChange={e=>updateField('titulo',e.target.value)} placeholder="Question 1…"/>
            </div>
            <div>
              <label style={lbl}>⏱ Aparece en (MM:SS)</label>
              <div style={{display:'flex',gap:6}}>
                <input style={{...inp,flex:1}} value={mmss} onChange={e=>setMmss(e.target.value)} onBlur={()=>handleMmssChange(mmss)} placeholder="1:30"/>
                {onCapture&&(
                  <button onClick={()=>{const t=onCapture();if(t!==null){const s=Math.floor(t);setMmss(secsToMmss(s));updateField('tiempo',s);}}}
                    title="Capturar tiempo actual del vídeo"
                    style={{padding:'0 10px',borderRadius:8,border:'1px solid #E2E8F0',background:'#EFF6FF',color:'#1D4ED8',cursor:'pointer',flexShrink:0,fontSize:12,fontWeight:700}}>
                    ⏺ Cap
                  </button>
                )}
              </div>
            </div>
            <div>
              <label style={lbl}>Tiempo límite (s, 0=sin límite)</label>
              <input style={inp} type="number" min="0" max="300" value={ex.tiempoLimite||0}
                onChange={e=>updateField('tiempoLimite',Math.max(0,parseInt(e.target.value)||0))} placeholder="30"/>
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <label style={lbl}>Enunciado / instrucciones</label>
            <textarea style={{...inp,height:56,resize:'vertical'}} value={ex.enunciado} onChange={e=>updateField('enunciado',e.target.value)} placeholder="Answer the following questions about the video."/>
          </div>
          <div style={{marginBottom:16,display:'flex',gap:8,alignItems:'center'}}>
            <ImgIcon size={14} color="#94A3B8"/>
            <input style={{...inp,flex:1}} value={ex.imagen||''} onChange={e=>updateField('imagen',e.target.value||null)} placeholder="URL de imagen (opcional)"/>
          </div>

          {ex.tipo==='wordbank'&&(
            <div style={{marginBottom:14,padding:'10px 14px',background:'#FFFBEB',border:'1px dashed #FCD34D',borderRadius:10}}>
              <label style={lbl}>Palabras del banco (separadas por ",")</label>
              <input style={inp} value={(ex.wordbank||[]).join(', ')} onChange={e=>updateField('wordbank',e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} placeholder="not build, take, write"/>
            </div>
          )}

          <div style={{borderTop:'1px solid #F1F5F9',paddingTop:12}}>
            <div style={{fontSize:12,fontWeight:600,color:'#64748B',marginBottom:8}}>Preguntas / ítems ({ex.items.length})</div>
            {ex.items.map((item,i)=>(
              <div key={item.id||i} style={{border:'1px solid #F1F5F9',borderRadius:10,marginBottom:8,overflow:'hidden'}}>
                <div style={{background:'#F8FAFC',padding:'8px 12px',display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}
                  onClick={()=>setOpenItems(o=>({...o,[i]:!o[i]}))}>
                  <span style={{fontSize:12,fontWeight:600,color:'#64748B',flex:1}}>Ítem {i+1}{item.lbl?` — ${item.lbl}`:''}</span>
                  <button style={btnSm} onClick={e=>{e.stopPropagation();deleteItem(i);}}>✕</button>
                  {openItems[i]?<ChevronUp size={14}/>:<ChevronDown size={14}/>}
                </div>
                {openItems[i]&&(
                  <div style={{padding:'10px 12px'}}>
                    <ItemEditor tipo={ex.tipo} item={item} onChange={(field,val)=>updateItem(i,field,val)}/>
                  </div>
                )}
              </div>
            ))}
            <button style={btnAdd} onClick={addItem}>+ añadir ítem</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function EditorVideoQuizz({ recursoInicial = null, usuario, onBack }) {
  const [recurso,    setRecurso]    = useState(() => {
    if (recursoInicial) {
      return {
        ...RECURSO_BASE,
        ...recursoInicial,
        ejercicios: (recursoInicial.ejercicios || []).map(ex => ({
          ...ex,
          tiempo: ex.tiempo ?? 0,
          items: (ex.items || []).map(item => {
            if (!Array.isArray(item.alts)) return item;
            return {
              ...item,
              alts: item.alts.map(a =>
                Array.isArray(a) ? a : (typeof a === 'string' ? a.split('|').map(s => s.trim()).filter(Boolean) : [])
              ),
            };
          }),
        })),
      };
    }
    return { ...RECURSO_BASE };
  });
  const [saving,     setSaving]     = useState(false);
  const [showConfig, setShowConfig] = useState(!recursoInicial);
  const [modalPublicar, setModalPublicar] = useState(null);

  // YouTube preview player
  const previewPlayerRef = useRef(null);
  const previewDivRef    = useRef(null);
  const [previewReady,   setPreviewReady] = useState(false);

  useEffect(() => {
    if (!recurso.pais && usuario?.pais)
      setRecurso(r => ({ ...r, pais:usuario.pais, region:usuario.region||'', poblacion:usuario.poblacion||'' }));
  }, []);

  const videoId = extractVideoId(recurso.youtubeUrl);

  // Init preview player when videoId changes
  const previewDivCb = useCallback(node => {
    if (!node) { try { previewPlayerRef.current?.destroy(); } catch{} previewPlayerRef.current=null; return; }
    if (!videoId) return;
    previewDivRef.current = node;

    const init = () => {
      try {
        previewPlayerRef.current = new window.YT.Player(node, {
          videoId, playerVars:{ rel:0, modestbranding:1 },
          events:{ onReady:()=>setPreviewReady(true) },
        });
      } catch{}
    };

    if (window.YT?.Player) { init(); }
    else {
      if (!document.getElementById('yt-api-script')) {
        const s=document.createElement('script'); s.id='yt-api-script'; s.src='https://www.youtube.com/iframe_api'; document.head.appendChild(s);
      }
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); init(); };
    }
  }, [videoId]);

  useEffect(() => () => { try { previewPlayerRef.current?.destroy(); } catch{} }, []);

  const captureTime = () => {
    try { return previewPlayerRef.current?.getCurrentTime?.() ?? null; } catch { return null; }
  };

  const setField = (k,v) => setRecurso(r=>({...r,[k]:v}));

  const addExercise    = () => setRecurso(r=>({...r,ejercicios:[...r.ejercicios,newExercise()]}));
  const updateExercise = (i,ex) => setRecurso(r=>({...r,ejercicios:r.ejercicios.map((e,j)=>j===i?ex:e)}));
  const deleteExercise = (i) => setRecurso(r=>({...r,ejercicios:r.ejercicios.filter((_,j)=>j!==i)}));
  const moveExercise   = (i,dir) => {
    const exs=[...recurso.ejercicios]; const j=i+dir;
    [exs[i],exs[j]]=[exs[j],exs[i]];
    setRecurso(r=>({...r,ejercicios:exs}));
  };

  const sanitizeEjercicios = (ejercicios) => ejercicios.map(ex=>({
    ...ex,
    items:(ex.items||[]).map(item=>{
      const clean={...item};
      // Firestore no admite arrays anidados: convierte alts [[a,b],[c]] → ["a|b","c"]
      if(Array.isArray(item.alts)) clean.alts=item.alts.map(a=>Array.isArray(a)?a.join('|'):(a||''));
      // Idem para cualquier otro campo que pudiera ser array de arrays
      Object.keys(clean).forEach(k=>{
        if(Array.isArray(clean[k])) clean[k]=clean[k].map(v=>Array.isArray(v)?v.join('|'):v);
      });
      return clean;
    }),
  }));

  const save = async (extraRecurso = {}) => {
    if (!recurso.titulo.trim()) return alert('Añade un título al recurso.');
    if (!recurso.youtubeUrl.trim()) return alert('Añade la URL del vídeo de YouTube.');
    if (!recurso.ejercicios.length) return alert('El recurso necesita al menos un ejercicio.');
    const recursoEfectivo = { ...recurso, ...extraRecurso };
    setSaving(true);
    try {
      const data = {
        ...recursoEfectivo,
        ejercicios: sanitizeEjercicios(recursoEfectivo.ejercicios),
        tipoJuego: 'VIDEOQUIZZ',
        tipo: 'VIDEOQUIZZ',
        isFinished: !!recursoEfectivo.isFinished,
        profesorUid: usuario?.uid||'anon',
        profesorNombre: usuario?.displayName||'Anon',
        pais: recursoEfectivo.pais||usuario?.pais||'',
        region: recursoEfectivo.region||usuario?.region||'',
        poblacion: recursoEfectivo.poblacion||usuario?.poblacion||'',
        ciclo: recursoEfectivo.ciclo||'Secundaria',
        temas: recursoEfectivo.tema||'',
        playCount: 0,
        fechaCreacion: new Date(),
        accessCode: generarCodigo(),
        origen: 'editor_videoquizz',
      };
      delete data.id;
      if (recursoEfectivo.id && !recursoEfectivo.id.startsWith('auto_')) {
        await updateDoc(doc(db,'resources',recursoEfectivo.id), data);
        alert('Recurso actualizado.');
      } else {
        await addDoc(collection(db,'resources'), data);
        alert('Recurso guardado correctamente.');
      }
      onBack?.();
    } catch(e) { alert('Error al guardar: '+e.message); }
    finally { setSaving(false); }
  };

  // Sort exercises by tiempo for display
  const sortedIdxs = recurso.ejercicios
    .map((ex,i)=>({ex,i}))
    .sort((a,b)=>(a.ex.tiempo||0)-(b.ex.tiempo||0));

  return (
    <div style={{minHeight:'100vh',background:'#F0F4FF',fontFamily:'inherit'}}>
      {/* Top bar */}
      <div style={{background:'white',borderBottom:'1px solid #E2E8F0',padding:'12px 20px',display:'flex',alignItems:'center',gap:12,position:'sticky',top:0,zIndex:100}}>
        <button onClick={() => setModalPublicar('cerrar')} style={{border:'none',background:'transparent',cursor:'pointer',color:'#64748B',display:'flex',alignItems:'center',gap:4,fontSize:14}}>
          <ArrowLeft size={18}/> Volver
        </button>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:16,color:'#0F172A'}}>🎬 Editor VideoQuizz</div>
          <div style={{fontSize:12,color:'#94A3B8'}}>{recurso.titulo||'Nuevo vídeo quiz'}</div>
        </div>
        <button onClick={()=>setShowConfig(c=>!c)} style={{border:'1px solid #E2E8F0',background:showConfig?'#FEF2F2':'white',color:showConfig?'#DC2626':'#64748B',borderRadius:8,padding:'7px 14px',cursor:'pointer',fontSize:13,fontWeight:600}}>
          ⚙ Configuración
        </button>
        <button onClick={()=>setRecurso(r=>({...r,isFinished:!r.isFinished}))}
          style={{display:'flex',alignItems:'center',gap:7,border:`1.5px solid ${recurso.isFinished?'#059669':'#E2E8F0'}`,background:recurso.isFinished?'#ECFDF5':'white',color:recurso.isFinished?'#059669':'#94A3B8',borderRadius:9,padding:'7px 14px',cursor:'pointer',fontWeight:700,fontSize:13}}>
          {recurso.isFinished?<Globe size={15}/>:<Lock size={15}/>}
          {recurso.isFinished?'Publicado':'Borrador'}
        </button>
        <button onClick={() => recurso.isFinished ? save() : setModalPublicar('guardar')} disabled={saving} style={{border:'none',background:recurso.color||'#DC2626',color:'white',borderRadius:9,padding:'9px 20px',cursor:'pointer',fontWeight:700,fontSize:14,display:'flex',alignItems:'center',gap:7,opacity:saving?0.7:1}}>
          <Save size={16}/> {saving?'Guardando…':'Guardar'}
        </button>
        {modalPublicar && (
          <PublicarModal
            modo={modalPublicar}
            yaPublicado={!!recurso.isFinished}
            onGuardarPublicar={async () => { await save({ isFinished: true }); setModalPublicar(null); }}
            onGuardarSolo={async () => { await save(); setModalPublicar(null); }}
            onSalirSinGuardar={() => { setModalPublicar(null); onBack?.(); }}
            onCancelar={() => setModalPublicar(null)}
          />
        )}
      </div>

      <div style={{maxWidth:900,margin:'24px auto',padding:'0 16px 60px'}}>

        {/* Config panel */}
        {showConfig&&(
          <div style={{background:'white',borderRadius:16,border:'1px solid #E2E8F0',padding:'24px',marginBottom:20,boxShadow:'0 1px 8px rgba(0,0,0,0.04)'}}>
            <div style={{fontWeight:700,fontSize:15,color:'#0F172A',marginBottom:18}}>Configuración del recurso</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <div style={{gridColumn:'1/-1'}}>
                <label style={lbl}>Título *</label>
                <input style={inp} value={recurso.titulo} onChange={e=>setField('titulo',e.target.value)} placeholder="The Industrial Revolution – Video Quiz"/>
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <label style={lbl}>URL de YouTube *</label>
                <input style={inp} value={recurso.youtubeUrl} onChange={e=>setField('youtubeUrl',e.target.value)} placeholder="https://www.youtube.com/watch?v=..."/>
              </div>
              <div><label style={lbl}>Nivel</label>
                <select style={inp} value={recurso.nivel} onChange={e=>setField('nivel',e.target.value)}>
                  {NIVELES.map(n=><option key={n} value={n}>{n}</option>)}
                </select></div>
              <div><label style={lbl}>Ciclo</label>
                <select style={inp} value={recurso.ciclo} onChange={e=>setField('ciclo',e.target.value)}>
                  {['Infantil','Primaria','Secundaria','Bachillerato','FP','Otros'].map(c=><option key={c}>{c}</option>)}
                </select></div>
              <div><label style={lbl}>Asignatura</label>
                <input style={inp} value={recurso.asignatura} onChange={e=>setField('asignatura',e.target.value)} placeholder="History"/></div>
              <div><label style={lbl}>Tema</label>
                <input style={inp} value={recurso.tema} onChange={e=>setField('tema',e.target.value)} placeholder="Industrial Revolution"/></div>
              <div style={{gridColumn:'1/-1'}}><label style={lbl}>Descripción</label>
                <textarea style={{...inp,height:56,resize:'vertical'}} value={recurso.descripcion} onChange={e=>setField('descripcion',e.target.value)}/></div>
              <div><label style={lbl}>Tags (coma)</label>
                <input style={inp} value={(recurso.tags||[]).join(', ')} onChange={e=>setField('tags',e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} placeholder="history, industrial, revolution"/></div>
              <div><label style={lbl}>Color</label>
                <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:4}}>
                  {COLORES.map(c=><div key={c} onClick={()=>setField('color',c)} style={{width:26,height:26,borderRadius:'50%',background:c,cursor:'pointer',border:recurso.color===c?'3px solid #0F172A':'2px solid transparent'}}/>)}
                </div></div>
              <div><label style={lbl}>País</label>
                <input style={inp} value={recurso.pais} onChange={e=>setField('pais',e.target.value)} placeholder="España"/></div>
              <div><label style={lbl}>Región</label>
                <input style={inp} value={recurso.region} onChange={e=>setField('region',e.target.value)}/></div>
              <div><label style={lbl}>Localidad</label>
                <input style={inp} value={recurso.poblacion} onChange={e=>setField('poblacion',e.target.value)}/></div>
              <div style={{gridColumn:'1/-1'}}>
                <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',background:recurso.soloUnIntento?'#FFF7ED':'#F8FAFC',borderRadius:10,border:`1px solid ${recurso.soloUnIntento?'#FED7AA':'#E2E8F0'}`,cursor:'pointer'}}
                  onClick={()=>setField('soloUnIntento',!recurso.soloUnIntento)}>
                  <div style={{width:20,height:20,borderRadius:5,border:`2px solid ${recurso.soloUnIntento?'#EA580C':'#CBD5E1'}`,background:recurso.soloUnIntento?'#EA580C':'white',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    {recurso.soloUnIntento&&<span style={{color:'white',fontSize:13,fontWeight:700,lineHeight:1}}>✓</span>}
                  </div>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:recurso.soloUnIntento?'#EA580C':'#334155'}}>Solo un intento por dispositivo</div>
                    <div style={{fontSize:11,color:'#94A3B8'}}>El alumno solo podrá hacer el quiz una vez desde el mismo navegador.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* YouTube preview */}
        {videoId&&(
          <div style={{background:'white',borderRadius:16,border:'1px solid #E2E8F0',padding:'20px',marginBottom:20,boxShadow:'0 1px 8px rgba(0,0,0,0.04)'}}>
            <div style={{fontWeight:700,fontSize:14,color:'#0F172A',marginBottom:12,display:'flex',alignItems:'center',gap:8}}>
              <Play size={16} color="#DC2626"/> Vista previa del vídeo
              <span style={{fontSize:12,color:'#94A3B8',fontWeight:400}}>— usa el botón ⏺ Cap en cada ejercicio para capturar el tiempo actual</span>
            </div>
            <div style={{position:'relative',paddingBottom:'56.25%',background:'#111',borderRadius:10,overflow:'hidden'}}>
              <div ref={previewDivCb} style={{position:'absolute',inset:0,width:'100%',height:'100%'}}/>
              {!previewReady&&(
                <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,0.4)',fontSize:14}}>Cargando reproductor...</div>
              )}
            </div>
          </div>
        )}

        {/* Exercises — sorted by tiempo */}
        <div style={{background:'white',borderRadius:16,border:'1px solid #E2E8F0',padding:'20px 20px 8px',boxShadow:'0 1px 8px rgba(0,0,0,0.04)'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <div>
              <div style={{fontWeight:700,fontSize:15,color:'#0F172A'}}>Ejercicios ({recurso.ejercicios.length})</div>
              <div style={{fontSize:12,color:'#94A3B8',marginTop:2}}>Ordenados por tiempo de aparición en el vídeo</div>
            </div>
            <button onClick={addExercise} style={{border:'none',background:recurso.color||'#DC2626',color:'white',borderRadius:9,padding:'8px 16px',cursor:'pointer',fontWeight:700,fontSize:13,display:'flex',alignItems:'center',gap:6}}>
              <Plus size={15}/> Añadir ejercicio
            </button>
          </div>
          {sortedIdxs.map(({ex,i})=>(
            <ExercisePanel
              key={ex.id||i}
              ex={ex} idx={i} total={recurso.ejercicios.length}
              color={recurso.color||'#DC2626'}
              onUpdate={ex=>updateExercise(i,ex)}
              onDelete={deleteExercise}
              onMove={moveExercise}
              onCapture={previewReady ? captureTime : null}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Shared micro-styles ──────────────────────────────────────────────────────
const lbl = { fontSize:11, fontWeight:600, color:'#64748B', display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.04em' };
const inp = { width:'100%', boxSizing:'border-box', padding:'8px 11px', borderRadius:8, border:'1px solid #E2E8F0', fontSize:13, fontFamily:'inherit', outline:'none', color:'#0F172A' };
const btnSm  = { background:'#F1F5F9', border:'1px solid #E2E8F0', borderRadius:6, padding:'3px 8px', cursor:'pointer', fontSize:12, color:'#475569' };
const btnAdd = { background:'#F8FAFC', border:'1px dashed #CBD5E1', borderRadius:8, padding:'6px 14px', cursor:'pointer', fontSize:12, color:'#64748B', width:'100%', marginTop:6, fontFamily:'inherit' };
