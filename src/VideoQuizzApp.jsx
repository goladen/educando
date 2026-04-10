// VideoQuizzApp.jsx
// Vídeo de YouTube que se pausa en timestamps para mostrar ejercicios Omni.
// Uso: <VideoQuizzApp onBack={fn} recursoDirecto={null} />

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { db } from './firebase';
import { collection, query as fsQuery, where, getDocs, addDoc, getDoc, doc } from 'firebase/firestore';
import { BIBLIOTECA_VQ } from './BibliotecaVideoQuizz';
import piHappy  from './assets/Pi-contento.png';
import piAngry  from './assets/Pi-enfadado.png';
import piNeutral from './assets/Pi-neutro.png';
import correctSoundFile from './assets/correct-choice-43861.mp3';
import wrongSoundFile   from './assets/wrong.mp3';

const audioCorrect = new Audio(correctSoundFile);
const audioWrong   = new Audio(wrongSoundFile);
const playAudio = (a) => { try { a.currentTime = 0; a.play().catch(() => {}); } catch {} };

// ─── helpers ──────────────────────────────────────────────────────────────────
function extractVideoId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/)([^&?/\s]{11})/);
  return m ? m[1] : null;
}

function fmtTime(s) {
  if (!s && s !== 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const nm = (s = '') =>
  (s || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/['']/g, "'")
    .replace(/wasn't|was not/g, 'wasnot').replace(/weren't|were not/g, 'werenot')
    .replace(/isn't|is not/g, 'isnot').replace(/aren't|are not/g, 'arenot')
    .replace(/don't|do not/g, 'donot').replace(/doesn't|does not/g, 'doesnot')
    .replace(/can't|cannot/g, 'cannot').replace(/couldn't|could not/g, 'couldnot')
    .replace(/haven't|have not/g, 'havenot').replace(/hasn't|has not/g, 'hasnot')
    .replace(/hadn't|had not/g, 'hadnot').replace(/wouldn't|would not/g, 'wouldnot')
    .replace(/mustn't|must not/g, 'mustnot').replace(/shouldn't|should not/g, 'shouldnot');

const parseAlts = (alts) => {
  if (!alts) return [];
  return alts.flatMap(a =>
    Array.isArray(a) ? a : typeof a === 'string' ? a.split('|').map(s => s.trim()).filter(Boolean) : [a]
  );
};

const okAns = (user, correct, alts = []) =>
  !!(user?.trim()) && [correct, ...parseAlts(alts)].some(a => nm(String(a)) === nm(user));

function calcScore(ex, ans) {
  let c = 0, t = 0;
  (ex.items || []).forEach(item => {
    if (ex.tipo === 'choice') {
      t++; if ((ans[String(item.id)] || '') === item.ans) c++;
    } else if (ex.tipo === 'fill' || ex.tipo === 'wordbank') {
      const nb = item.parts.length - 1;
      for (let i = 0; i < nb; i++) {
        t++;
        if (okAns(ans[`${item.id}-${i}`] || '', item.ans[i], item.alts?.[i] || [])) c++;
      }
    } else if (ex.tipo === 'construct') {
      t++; if (okAns(ans[String(item.id)] || '', item.ans, item.alts || [])) c++;
    } else if (ex.tipo === 'match') {
      t++; if ((ans[`m_${item.id}`] || '') === item.right) c++;
    } else if (ex.tipo === 'order') {
      t++;
      const placed = ans[`ord_${item.id}`] || [];
      const built = placed.map(i => item.shuffled[i]).join(' ');
      if (nm(built) === nm(item.answer)) c++;
    } else if (ex.tipo === 'truefalse') {
      t++; if ((ans[`tf_${item.id}`] || '') === item.ans) c++;
    } else if (ex.tipo === 'multichoice') {
      t++; if ((ans[`mc_${item.id}`] || '') === item.ans) c++;
    } else if (ex.tipo === 'error') {
      t++; if (nm(ans[`err_${item.id}`] || '') === nm(item.correction)) c++;
    }
  });
  return { c, t };
}

const TIPO_INFO = {
  fill:        { label: 'Fill in',         color: '#6D28D9' },
  choice:      { label: 'Choose',          color: '#1D4ED8' },
  wordbank:    { label: 'Word bank',       color: '#B45309' },
  construct:   { label: 'Write',           color: '#047857' },
  match:       { label: 'Match',           color: '#0F766E' },
  order:       { label: 'Order',           color: '#C2410C' },
  truefalse:   { label: 'True / False',    color: '#0369A1' },
  multichoice: { label: 'Multiple choice', color: '#7E22CE' },
  error:       { label: 'Find the error',  color: '#B91C1C' },
};

function shuffleArr(arr) { return [...arr].sort(() => Math.random() - 0.5); }

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 640);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return mobile;
}

// ─── Shared sub-components ────────────────────────────────────────────────────
function ItemLabel({ lbl, color }) {
  return <span style={{ fontWeight:500, fontSize:13, color, minWidth:24, paddingTop:6, flexShrink:0 }}>{lbl}</span>;
}
function StatusIcon({ ok }) {
  return <span style={{ fontSize:16, lineHeight:1, flexShrink:0 }}>{ok ? '✓' : '✗'}</span>;
}
function CorrectAnswer({ text }) {
  return <span style={{ fontSize:12, color:'#059669', fontWeight:500, marginLeft:6, whiteSpace:'nowrap' }}>→ {text}</span>;
}

// ─── Exercise renderers (same as OmninteractiveApp) ───────────────────────────
function FillEx({ ex, ans, setAns, checked }) {
  return (
    <div>
      {(ex.items||[]).map(item => {
        const nb = item.parts.length - 1;
        const nodes = [];
        item.parts.forEach((part, i) => {
          nodes.push(<span key={`p${i}`}>{part}</span>);
          if (i < nb) {
            const val = ans[`${item.id}-${i}`] || '';
            const correct = item.ans[i];
            const alts = item.alts?.[i] || [];
            const st = checked ? (okAns(val,correct,alts)?'ok':'err') : '';
            nodes.push(
              <span key={`b${i}`} style={{display:'inline-flex',alignItems:'center',gap:4,verticalAlign:'middle'}}>
                <input value={val} onChange={e=>setAns(`${item.id}-${i}`,e.target.value)} readOnly={checked} placeholder="···"
                  style={{width:110,height:26,padding:'0 8px',border:`1.5px solid ${st==='ok'?'#059669':st==='err'?'#DC2626':'#CBD5E1'}`,borderRadius:7,background:st==='ok'?'#DCFCE7':st==='err'?'#FEE2E2':'white',fontFamily:'inherit',fontSize:13,outline:'none',verticalAlign:'middle'}} />
                {item.hint&&nb===1&&<span style={{fontSize:11,color:'#94A3B8',fontStyle:'italic'}}>{item.hint}</span>}
                {checked&&st==='err'&&<CorrectAnswer text={correct}/>}
              </span>
            );
          }
        });
        return (
          <div key={item.id} style={{display:'flex',gap:10,marginBottom:14,alignItems:'flex-start'}}>
            <ItemLabel lbl={item.lbl} color={TIPO_INFO[ex.tipo]?.color||'#6D28D9'}/>
            <span style={{lineHeight:2.5,fontSize:14}}>{nodes}</span>
          </div>
        );
      })}
    </div>
  );
}

function ChoiceEx({ ex, ans, setAns, checked }) {
  return (
    <div>
      {(ex.items||[]).map(item => {
        const sel = ans[String(item.id)] || '';
        return (
          <div key={item.id} style={{display:'flex',gap:10,marginBottom:12,alignItems:'flex-start'}}>
            <ItemLabel lbl={item.lbl} color={TIPO_INFO[ex.tipo]?.color||'#1D4ED8'}/>
            <span style={{lineHeight:2.5,fontSize:14}}>
              <span>{item.parts[0]}</span>
              {(item.opts||[]).map(opt => {
                let bg='transparent',border='#D1D5DB',color='#6B7280',fw=400;
                if(!checked&&opt===sel){bg='#EFF6FF';border='#3B82F6';color='#1D4ED8';fw=500;}
                if(checked){
                  if(opt===item.ans){bg='#DCFCE7';border='#059669';color='#047857';fw=500;}
                  else if(opt===sel){bg='#FEE2E2';border='#DC2626';color='#B91C1C';fw=500;}
                }
                return <button key={opt} onClick={()=>!checked&&setAns(String(item.id),opt)}
                  style={{margin:'0 4px',padding:'2px 11px',borderRadius:20,border:`1.5px solid ${border}`,background:bg,color,fontWeight:fw,cursor:checked?'default':'pointer',fontFamily:'inherit',fontSize:13,verticalAlign:'middle'}}>{opt}</button>;
              })}
              <span>{item.parts[1]}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function WordbankEx({ ex, ans, setAns, checked }) {
  return (
    <div>
      <div style={{display:'flex',flexWrap:'wrap',gap:6,padding:'10px 14px',background:'#FFFBEB',border:'1px dashed #FCD34D',borderRadius:10,marginBottom:20}}>
        <div style={{width:'100%',fontSize:10,fontWeight:600,color:'#92400E',letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:2}}>Word bank</div>
        {(ex.wordbank||[]).map(w=><span key={w} style={{padding:'3px 12px',background:'#FEF3C7',border:'1px solid #F59E0B',borderRadius:20,fontSize:13,color:'#78350F'}}>{w}</span>)}
      </div>
      <FillEx ex={ex} ans={ans} setAns={setAns} checked={checked}/>
    </div>
  );
}

function ConstructEx({ ex, ans, setAns, checked }) {
  return (
    <div>
      {(ex.items||[]).map(item => {
        const val = ans[String(item.id)] || '';
        const isOk = checked&&okAns(val,item.ans,item.alts||[]);
        const isWr = checked&&!isOk;
        return (
          <div key={item.id} style={{marginBottom:18}}>
            <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:7,alignItems:'center'}}>
              <ItemLabel lbl={item.lbl} color={TIPO_INFO[ex.tipo]?.color||'#047857'}/>
              {(item.prompt||'').split(' / ').map((chip,i)=><span key={i} style={{padding:'3px 9px',background:'#F8FAFC',border:'1px solid #E2E8F0',borderRadius:7,fontSize:12,color:'#64748B'}}>{chip}</span>)}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <input value={val} onChange={e=>setAns(String(item.id),e.target.value)} readOnly={checked} placeholder="Write your sentence here…"
                style={{flex:1,height:34,padding:'0 12px',border:`1.5px solid ${isOk?'#059669':isWr?'#DC2626':'#CBD5E1'}`,borderRadius:8,background:isOk?'#DCFCE7':isWr?'#FEE2E2':'white',color:isOk?'#047857':isWr?'#B91C1C':'#0F172A',fontFamily:'inherit',fontSize:13,outline:'none'}}/>
              {checked&&<StatusIcon ok={isOk}/>}
            </div>
            {isWr&&<div style={{marginTop:5,fontSize:12,color:'#059669',fontWeight:500,paddingLeft:2}}>✓ {item.ans}</div>}
          </div>
        );
      })}
    </div>
  );
}

function MatchEx({ ex, ans, setAns, checked }) {
  const options = useMemo(()=>[...(ex.items||[]).map(i=>i.right)].sort(),[ex.id]);
  return (
    <div>
      {(ex.items||[]).map(item=>{
        const val=ans[`m_${item.id}`]||'';
        const isOk=checked&&val===item.right;
        const isWr=checked&&val!==item.right;
        return(
          <div key={item.id} style={{display:'flex',gap:12,alignItems:'flex-start',marginBottom:12,flexWrap:'wrap'}}>
            <ItemLabel lbl={item.lbl} color={TIPO_INFO[ex.tipo]?.color||'#0F766E'}/>
            <span style={{minWidth:140,fontSize:14,fontWeight:500,paddingTop:5,color:TIPO_INFO[ex.tipo]?.color||'#0F766E'}}>{item.left}</span>
            <div style={{flex:1,minWidth:180}}>
              <select value={val} onChange={e=>!checked&&setAns(`m_${item.id}`,e.target.value)} disabled={checked}
                style={{width:'100%',height:34,padding:'0 10px',border:`1.5px solid ${isOk?'#059669':isWr?'#DC2626':'#CBD5E1'}`,borderRadius:8,background:isOk?'#DCFCE7':isWr?'#FEE2E2':'white',fontFamily:'inherit',fontSize:13,outline:'none',cursor:checked?'default':'pointer'}}>
                <option value="">— choose —</option>
                {options.map((r,i)=><option key={i} value={r}>{r}</option>)}
              </select>
              {isWr&&<div style={{marginTop:4,fontSize:12,color:'#059669',fontWeight:500}}>✓ {item.right}</div>}
            </div>
            {checked&&<StatusIcon ok={isOk}/>}
          </div>
        );
      })}
    </div>
  );
}

function OrderEx({ ex, ans, setAns, checked }) {
  return (
    <div>
      {(ex.items||[]).map(item=>{
        const placed=ans[`ord_${item.id}`]||[];
        const remaining=(item.shuffled||[]).map((w,i)=>({w,i})).filter(({i})=>!placed.includes(i));
        const built=placed.map(i=>item.shuffled[i]).join(' ');
        const isOk=checked&&nm(built)===nm(item.answer);
        const isWr=checked&&!isOk;
        return(
          <div key={item.id} style={{marginBottom:22}}>
            <span style={{fontWeight:500,fontSize:13,color:TIPO_INFO[ex.tipo]?.color||'#C2410C',display:'block',marginBottom:8}}>{item.lbl}</span>
            <div style={{display:'flex',flexWrap:'wrap',gap:6,padding:'8px 12px',background:'#F8FAFC',border:'1px solid #E2E8F0',borderRadius:9,marginBottom:8,minHeight:40}}>
              {remaining.length===0&&<span style={{fontSize:12,color:'#CBD5E1',fontStyle:'italic',lineHeight:'26px'}}>All words placed</span>}
              {remaining.map(({w,i})=><button key={i} onClick={()=>!checked&&setAns(`ord_${item.id}`,[...placed,i])}
                style={{padding:'4px 10px',borderRadius:7,border:'1.5px solid #CBD5E1',background:'white',cursor:checked?'default':'pointer',fontSize:13,fontFamily:'inherit',color:'#374151'}}>{w}</button>)}
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6,padding:'8px 12px',border:`1.5px solid ${isOk?'#059669':isWr?'#DC2626':'#E2E8F0'}`,borderRadius:9,minHeight:40,background:isOk?'#DCFCE7':isWr?'#FEE2E2':'#FAFAFA',alignItems:'center'}}>
              {placed.length===0&&<span style={{fontSize:12,color:'#CBD5E1',fontStyle:'italic'}}>Click words above…</span>}
              {placed.map((idx,pos)=><button key={`${idx}-${pos}`} onClick={()=>!checked&&setAns(`ord_${item.id}`,placed.filter((_,p)=>p!==pos))}
                style={{padding:'4px 10px',borderRadius:7,border:'1.5px solid #CBD5E1',background:'white',cursor:checked?'default':'pointer',fontSize:13,fontFamily:'inherit',color:'#374151'}}>{item.shuffled[idx]}</button>)}
              {checked&&<StatusIcon ok={isOk}/>}
            </div>
            {isWr&&<div style={{marginTop:5,fontSize:12,color:'#059669',fontWeight:500}}>✓ {item.answer}</div>}
          </div>
        );
      })}
    </div>
  );
}

function TrueFalseEx({ ex, ans, setAns, checked }) {
  return (
    <div>
      {(ex.items||[]).map(item=>{
        const val=ans[`tf_${item.id}`]||'';
        const isOk=checked&&val===item.ans;
        const isWr=checked&&val&&val!==item.ans;
        return(
          <div key={item.id} style={{display:'flex',gap:10,marginBottom:14,alignItems:'flex-start'}}>
            <ItemLabel lbl={item.lbl} color={TIPO_INFO[ex.tipo]?.color||'#0369A1'}/>
            <div style={{flex:1}}>
              <p style={{margin:'0 0 7px',fontSize:14,lineHeight:1.5,color:'#0F172A'}}>{item.statement}</p>
              <div style={{display:'flex',gap:8}}>
                {['true','false'].map(opt=>{
                  const label=opt==='true'?'True':'False';const sel=val===opt;
                  let bg='transparent',border='#D1D5DB',color='#6B7280',fw=400;
                  if(!checked&&sel){bg='#EFF6FF';border='#3B82F6';color='#1D4ED8';fw=500;}
                  if(checked){if(opt===item.ans){bg='#DCFCE7';border='#059669';color='#047857';fw=500;}else if(sel){bg='#FEE2E2';border='#DC2626';color='#B91C1C';fw=500;}}
                  return <button key={opt} onClick={()=>!checked&&setAns(`tf_${item.id}`,opt)}
                    style={{padding:'5px 18px',borderRadius:20,border:`1.5px solid ${border}`,background:bg,color,fontWeight:fw,cursor:checked?'default':'pointer',fontFamily:'inherit',fontSize:13}}>{label}</button>;
                })}
                {checked&&isWr&&<span style={{fontSize:12,color:'#059669',fontWeight:500,alignSelf:'center',marginLeft:4}}>→ {item.ans==='true'?'True':'False'}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MultiChoiceEx({ ex, ans, setAns, checked }) {
  return (
    <div>
      {(ex.items||[]).map(item=>{
        const val=ans[`mc_${item.id}`]||'';
        return(
          <div key={item.id} style={{marginBottom:20}}>
            <div style={{display:'flex',gap:10,marginBottom:10,alignItems:'flex-start'}}>
              <ItemLabel lbl={item.lbl} color={TIPO_INFO[ex.tipo]?.color||'#7E22CE'}/>
              <p style={{margin:0,fontSize:14,lineHeight:1.5,fontWeight:500}}>{item.question}</p>
            </div>
            <div style={{paddingLeft:32,display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 12px'}}>
              {(item.opts||[]).map((opt,idx)=>{
                const letter=['A','B','C','D'][idx];const sel=val===opt;const isAns=opt===item.ans;
                let bg='transparent',border='#E2E8F0',textColor='#374151';
                if(!checked&&sel){bg='#EFF6FF';border='#3B82F6';textColor='#1D4ED8';}
                if(checked){if(isAns){bg='#DCFCE7';border='#059669';textColor='#047857';}else if(sel){bg='#FEE2E2';border='#DC2626';textColor='#B91C1C';}}
                return <button key={opt} onClick={()=>!checked&&setAns(`mc_${item.id}`,opt)}
                  style={{padding:'7px 12px',borderRadius:8,border:`1.5px solid ${border}`,background:bg,color:textColor,cursor:checked?'default':'pointer',fontFamily:'inherit',fontSize:13,textAlign:'left',display:'flex',gap:8,alignItems:'center'}}>
                  <span style={{fontWeight:600,opacity:0.6,minWidth:14}}>{letter}</span><span>{opt}</span>
                </button>;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ErrorEx({ ex, ans, setAns, checked }) {
  return (
    <div>
      {(ex.items||[]).map(item=>{
        const val=ans[`err_${item.id}`]||'';
        const isOk=checked&&nm(val)===nm(item.correction);const isWr=checked&&!isOk;
        const eIdx=item.sentence.indexOf(item.errorWord);
        const before=eIdx>=0?item.sentence.slice(0,eIdx):item.sentence;
        const after=eIdx>=0?item.sentence.slice(eIdx+item.errorWord.length):'';
        return(
          <div key={item.id} style={{marginBottom:20}}>
            <div style={{display:'flex',gap:10,marginBottom:8,alignItems:'flex-start'}}>
              <ItemLabel lbl={item.lbl} color={TIPO_INFO[ex.tipo]?.color||'#B91C1C'}/>
              <p style={{margin:0,fontSize:14,lineHeight:1.6}}>{before}<span style={{color:'#B91C1C',fontWeight:600,textDecoration:'underline'}}>{item.errorWord}</span>{after}</p>
            </div>
            <div style={{paddingLeft:32,display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:13,color:'#64748B'}}>Correction:</span>
              <input value={val} onChange={e=>setAns(`err_${item.id}`,e.target.value)} readOnly={checked} placeholder="correct word…"
                style={{width:150,height:30,padding:'0 10px',border:`1.5px solid ${isOk?'#059669':isWr?'#DC2626':'#CBD5E1'}`,borderRadius:7,background:isOk?'#DCFCE7':isWr?'#FEE2E2':'white',fontFamily:'inherit',fontSize:13,outline:'none'}}/>
              {checked&&<StatusIcon ok={isOk}/>}
              {isWr&&<CorrectAnswer text={item.correction}/>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ExRenderer({ ex, ans, setAns, checked }) {
  const props = { ex, ans, setAns, checked };
  switch (ex.tipo) {
    case 'fill':        return <FillEx {...props}/>;
    case 'choice':      return <ChoiceEx {...props}/>;
    case 'wordbank':    return <WordbankEx {...props}/>;
    case 'construct':   return <ConstructEx {...props}/>;
    case 'match':       return <MatchEx {...props}/>;
    case 'order':       return <OrderEx {...props}/>;
    case 'truefalse':   return <TrueFalseEx {...props}/>;
    case 'multichoice': return <MultiChoiceEx {...props}/>;
    case 'error':       return <ErrorEx {...props}/>;
    default: return null;
  }
}

// ─── Modal enviar al profesor ─────────────────────────────────────────────────
function ModalEnviarVQ({ recurso, resultados, onClose }) {
  const [nombre,   setNombre]   = useState('');
  const [curso,    setCurso]    = useState('');
  const [codigo,   setCodigo]   = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado,  setEnviado]  = useState(false);
  const [error,    setError]    = useState('');
  const totalC   = resultados.reduce((s,r)=>s+r.c,0);
  const totalT   = resultados.reduce((s,r)=>s+r.t,0);
  const pctTotal = totalT>0 ? Math.round(totalC/totalT*100) : 0;

  const enviar = async () => {
    if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
    const code = codigo.trim().toUpperCase();
    if (!code) { setError('Escribe el código del profesor.'); return; }
    setEnviando(true); setError('');
    try {
      const snap = await getDoc(doc(db,'codigos_profesor',code));
      if (!snap.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
      await addDoc(collection(db,'informes_juegos'),{
        tipo:'VIDEOQUIZZ', modalidad:'Individual', fecha:new Date(),
        codigoProfesor:code, recursoTitulo:recurso.titulo,
        jugadores:[{ nombre:nombre.trim(), curso:curso.trim(), porcentaje:pctTotal, correcto:pctTotal>=60, puntos:pctTotal,
          tipoEjercicio:recurso.titulo, detalles:resultados.map(r=>({titulo:r.titulo,pct:r.t>0?Math.round(r.c/r.t*100):0})) }],
      });
      setEnviado(true);
    } catch(e) { setError('Error: '+e.message); }
    setEnviando(false);
  };

  const inp = {padding:'9px 12px',borderRadius:9,border:'1.5px solid #E2E8F0',fontSize:'0.9rem',outline:'none',width:'100%',boxSizing:'border-box',fontFamily:'inherit'};
  return (
    <div style={{position:'fixed',inset:0,zIndex:3000,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'white',borderRadius:20,width:'100%',maxWidth:380,padding:'26px 28px',boxShadow:'0 30px 80px rgba(0,0,0,0.5)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
          <h3 style={{margin:0,color:'#1F2937',fontSize:'1.05rem'}}>📤 Enviar resultados</h3>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'#9CA3AF',fontSize:'1.3rem'}}>✕</button>
        </div>
        {enviado ? (
          <div style={{textAlign:'center',padding:'20px 0'}}>
            <div style={{fontSize:48}}>✅</div>
            <div style={{fontWeight:700,color:'#059669',fontSize:'1.05rem',marginTop:8}}>¡Enviado!</div>
            <div style={{fontSize:'2rem',fontWeight:900,color:pctTotal===100?'#059669':pctTotal>=60?'#D97706':'#DC2626',margin:'10px 0'}}>{pctTotal}%</div>
            <button onClick={onClose} style={{marginTop:8,padding:'9px 22px',borderRadius:10,border:'none',background:'#F1F5F9',cursor:'pointer',fontFamily:'inherit'}}>Cerrar</button>
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <div><label style={{fontSize:'0.78rem',color:'#6B7280',fontWeight:600,display:'block',marginBottom:4}}>Nombre *</label>
              <input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Tu nombre completo" style={inp}/></div>
            <div><label style={{fontSize:'0.78rem',color:'#6B7280',fontWeight:600,display:'block',marginBottom:4}}>Curso</label>
              <input value={curso} onChange={e=>setCurso(e.target.value)} placeholder="Ej: 3º ESO A" style={inp}/></div>
            <div><label style={{fontSize:'0.78rem',color:'#6B7280',fontWeight:600,display:'block',marginBottom:4}}>Código del profesor *</label>
              <input value={codigo} onChange={e=>setCodigo(e.target.value.toUpperCase())} placeholder="XXXXX" style={{...inp,textTransform:'uppercase',letterSpacing:3,fontWeight:700}}/></div>
            {error&&<div style={{color:'#DC2626',fontSize:'0.82rem',background:'#FEF2F2',padding:'8px 12px',borderRadius:8}}>{error}</div>}
            <button onClick={enviar} disabled={enviando} style={{padding:'11px',borderRadius:10,border:'none',background:'#6D28D9',color:'white',fontWeight:700,cursor:'pointer',fontFamily:'inherit',marginTop:4,opacity:enviando?0.7:1}}>
              {enviando?'Enviando…':'Enviar resultados'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Play Screen ──────────────────────────────────────────────────────────────
function PlayScreen({ recurso, onBack }) {
  const isMobile = useIsMobile();
  const videoId  = extractVideoId(recurso.youtubeUrl);
  const color    = recurso.color || '#DC2626';

  const playerRef = useRef(null);
  const [playerReady, setPlayerReady] = useState(false);

  const sortedEx = useMemo(() =>
    [...(recurso.ejercicios||[])].sort((a,b) => (a.tiempo||0) - (b.tiempo||0))
  , [recurso.ejercicios]);

  const [done,       setDone]       = useState({});    // exId -> {c,t}
  const [currentEx,  setCurrentEx]  = useState(null);
  const [answers,    setAnswers]    = useState({});
  const [checked,    setChecked]    = useState({});
  const [showSummary,setShowSummary]= useState(false);
  const [showModal,  setShowModal]  = useState(false);

  const soloUnIntento = !!recurso.soloUnIntento;
  const attemptKey    = `vq_done_${recurso.id||recurso.titulo}`;
  const alreadyDone   = soloUnIntento && !!localStorage.getItem(attemptKey);

  // YouTube player — callback ref avoids re-initialization issues
  const playerDivRef = useCallback(node => {
    if (!node || !videoId) return;

    const init = () => {
      try {
        playerRef.current = new window.YT.Player(node, {
          videoId,
          playerVars: { rel:0, modestbranding:1, playsinline:1 },
          events: { onReady: () => setPlayerReady(true) },
        });
      } catch(e) { console.error('YT init error', e); }
    };

    if (window.YT?.Player) { init(); }
    else {
      if (!document.getElementById('yt-api-script')) {
        const s = document.createElement('script');
        s.id  = 'yt-api-script';
        s.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(s);
      }
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); init(); };
    }
  }, [videoId]);

  // Destroy player on unmount
  useEffect(() => () => { try { playerRef.current?.destroy(); } catch{} }, []);

  // Poll for exercise triggers
  useEffect(() => {
    if (!playerReady || currentEx) return;
    const poll = setInterval(() => {
      try {
        if (playerRef.current?.getPlayerState?.() !== 1) return; // 1 = playing
        const t = playerRef.current?.getCurrentTime?.() || 0;
        const next = sortedEx.find(ex => !done[ex.id] && t >= (ex.tiempo||0) - 0.4);
        if (next) {
          playerRef.current.pauseVideo();
          setCurrentEx({ ...next, items: shuffleArr(next.items) });
        }
      } catch{}
    }, 300);
    return () => clearInterval(poll);
  }, [playerReady, currentEx, done, sortedEx]);

  const exAns     = currentEx ? (answers[currentEx.id]||{}) : {};
  const isChecked = currentEx ? !!checked[currentEx.id] : false;
  const score     = isChecked && currentEx ? calcScore(currentEx, exAns) : null;
  const pct       = score && score.t>0 ? Math.round(score.c/score.t*100) : 0;
  const scol      = !score ? color : pct===100 ? '#059669' : pct>=60 ? '#D97706' : '#DC2626';
  const info      = currentEx ? (TIPO_INFO[currentEx.tipo]||{}) : {};

  const setAns = (key, val) => {
    if (!currentEx) return;
    setAnswers(p => ({ ...p, [currentEx.id]: { ...(p[currentEx.id]||{}), [key]:val } }));
  };

  const handleCheck = () => {
    if (!currentEx||isChecked) return;
    setChecked(p => ({ ...p, [currentEx.id]: true }));
    const s = calcScore(currentEx, exAns);
    if (s.c>0) playAudio(audioCorrect); else playAudio(audioWrong);
  };

  const handleContinue = () => {
    const s = calcScore(currentEx, exAns);
    const newDone = { ...done, [currentEx.id]: s };
    setDone(newDone);
    setCurrentEx(null);
    const allDone = sortedEx.every(ex => newDone[ex.id]);
    if (allDone) {
      if (soloUnIntento) localStorage.setItem(attemptKey,'1');
      setShowSummary(true);
    } else {
      setTimeout(() => { try { playerRef.current?.playVideo(); } catch{} }, 100);
    }
  };

  const completados = sortedEx.filter(ex => done[ex.id]).length;

  // ── Summary ──
  if (showSummary) {
    const resultados = sortedEx.map(ex => {
      const s = done[ex.id] || { c:0, t:0 };
      return { id:ex.id, titulo:ex.titulo, c:s.c, t:s.t, pct:s.t>0?Math.round(s.c/s.t*100):0 };
    });
    const totalC=resultados.reduce((s,r)=>s+r.c,0), totalT=resultados.reduce((s,r)=>s+r.t,0);
    const pctTotal = totalT>0 ? Math.round(totalC/totalT*100) : 0;
    const piImg    = pctTotal>=60 ? piHappy : pctTotal<30 ? piAngry : piNeutral;
    return (
      <div style={{minHeight:'100dvh',background:'#0F172A',fontFamily:'inherit'}}>
        <div style={{background:`linear-gradient(135deg,${color},${color}cc)`,padding:'28px 20px',textAlign:'center',color:'white'}}>
          <img src={piImg} alt="Pi" style={{width:80,height:80,objectFit:'contain',marginBottom:10}}/>
          <div style={{fontSize:52,fontWeight:900,lineHeight:1}}>{pctTotal}<span style={{fontSize:22}}>%</span></div>
          <div style={{fontSize:14,opacity:0.85,marginTop:6}}>{recurso.titulo}</div>
          <div style={{fontSize:13,opacity:0.7,marginTop:2}}>{totalC}/{totalT} respuestas correctas</div>
        </div>
        <div style={{maxWidth:600,margin:'0 auto',padding:'20px 16px 40px'}}>
          <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:20}}>
            {resultados.map(r=>(
              <div key={r.id} style={{background:'#1E293B',borderRadius:12,padding:'14px 18px',display:'flex',alignItems:'center',gap:14}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:14,color:'white',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{r.titulo}</div>
                  <div style={{fontSize:12,color:'rgba(255,255,255,0.5)',marginTop:2}}>{r.c}/{r.t} correctas · ⏱ {fmtTime(sortedEx.find(e=>e.id===r.id)?.tiempo||0)}</div>
                </div>
                <div style={{flexShrink:0,textAlign:'right'}}>
                  <div style={{fontWeight:800,fontSize:18,color:r.pct===100?'#10B981':r.pct>=60?'#F59E0B':'#EF4444'}}>{r.pct}%</div>
                  <div style={{width:70,height:5,background:'rgba(255,255,255,0.1)',borderRadius:3,overflow:'hidden',marginTop:4}}>
                    <div style={{width:`${r.pct}%`,height:'100%',background:r.pct===100?'#10B981':r.pct>=60?'#F59E0B':'#EF4444',borderRadius:3}}/>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            {!soloUnIntento&&(
              <button onClick={()=>{setDone({});setAnswers({});setChecked({});setShowSummary(false);setTimeout(()=>{try{playerRef.current?.seekTo(0);playerRef.current?.playVideo();}catch{}},300);}}
                style={{flex:1,minWidth:130,padding:'12px',borderRadius:11,border:`1.5px solid ${color}`,background:'transparent',color:color,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>🔁 Repetir</button>
            )}
            <button onClick={()=>setShowModal(true)} style={{flex:1,minWidth:130,padding:'12px',borderRadius:11,border:'none',background:'linear-gradient(135deg,#3B82F6,#2563EB)',color:'white',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>📤 Enviar al profesor</button>
            <button onClick={onBack} style={{flex:1,minWidth:130,padding:'12px',borderRadius:11,border:'none',background:'#1F2937',color:'white',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>← Volver</button>
          </div>
        </div>
        {showModal&&<ModalEnviarVQ recurso={recurso} resultados={resultados} onClose={()=>setShowModal(false)}/>}
      </div>
    );
  }

  // ── Already done ──
  if (alreadyDone) return (
    <div style={{minHeight:'100dvh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#0F172A',padding:20,textAlign:'center',fontFamily:'inherit'}}>
      <img src={piNeutral} alt="Pi" style={{width:90,objectFit:'contain',marginBottom:16}}/>
      <h2 style={{color:'white',margin:'0 0 8px'}}>Solo un intento permitido</h2>
      <p style={{color:'rgba(255,255,255,0.5)',maxWidth:300,margin:0}}>Ya has completado este vídeo quiz desde este dispositivo.</p>
      <button onClick={onBack} style={{marginTop:20,padding:'10px 24px',borderRadius:10,border:'none',background:color,color:'white',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>← Volver</button>
    </div>
  );

  // ── Main player ──
  return (
    <div style={{position:'fixed',inset:0,background:'#000',display:'flex',flexDirection:'column',fontFamily:'inherit'}}>
      {/* Top bar */}
      <div style={{background:'#0F172A',padding:'0 12px',display:'flex',alignItems:'center',gap:10,flexShrink:0,height:48,borderBottom:'1px solid #1E293B'}}>
        <button onClick={onBack} style={{border:'none',background:`${color}25`,borderRadius:8,cursor:'pointer',padding:'5px 10px',color:color,fontWeight:700,fontSize:14,flexShrink:0}}>← Salir</button>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:isMobile?13:15,color:'white',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{recurso.titulo}</div>
        </div>
        {/* Exercise dots */}
        <div style={{display:'flex',gap:5,alignItems:'center',flexShrink:0}}>
          {sortedEx.map(ex=>(
            <div key={ex.id} title={`${fmtTime(ex.tiempo)} — ${ex.titulo}`}
              style={{width:10,height:10,borderRadius:'50%',transition:'background 0.3s',
                background:done[ex.id]?'#10B981':ex.id===currentEx?.id?'#F59E0B':'rgba(255,255,255,0.2)',
                border:ex.id===currentEx?.id?'2px solid #F59E0B':'2px solid transparent'}}/>
          ))}
        </div>
        <span style={{fontSize:12,color:'rgba(255,255,255,0.5)',flexShrink:0}}>{completados}/{sortedEx.length}</span>
      </div>

      {/* Video */}
      <div style={{flex:1,position:'relative',background:'#000'}}>
        <div ref={playerDivRef} style={{width:'100%',height:'100%'}}/>

        {!videoId&&(
          <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',color:'white',background:'#111',flexDirection:'column',gap:8}}>
            <div style={{fontSize:48}}>🎬</div>
            <div style={{color:'rgba(255,255,255,0.5)'}}>URL de YouTube no válida</div>
          </div>
        )}

        {/* Exercise overlay */}
        {currentEx&&(
          <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.9)',display:'flex',alignItems:'center',justifyContent:'center',padding:isMobile?'10px':'20px',overflowY:'auto',zIndex:10}}>
            <div style={{background:'white',borderRadius:18,width:'100%',maxWidth:640,maxHeight:'92vh',overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'0 25px 70px rgba(0,0,0,0.7)'}}>
              {/* Header */}
              <div style={{background:`linear-gradient(135deg,${color}18,${color}08)`,borderBottom:`2px solid ${color}25`,padding:'16px 20px',flexShrink:0}}>
                <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
                  <div style={{width:36,height:36,borderRadius:10,background:color,color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:16,flexShrink:0}}>
                    {sortedEx.findIndex(e=>e.id===currentEx.id)+1}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
                      <span style={{fontWeight:800,fontSize:16,color:'#0F172A'}}>{currentEx.titulo}</span>
                      <span style={{padding:'2px 8px',borderRadius:20,background:`${info.color||color}20`,color:info.color||color,fontSize:10,fontWeight:700,textTransform:'uppercase'}}>{info.label}</span>
                      <span style={{fontSize:11,color:'#94A3B8'}}>⏱ {fmtTime(currentEx.tiempo)}</span>
                    </div>
                    <p style={{margin:0,fontSize:13,color:'#475569',lineHeight:1.5}}>{currentEx.enunciado}</p>
                  </div>
                </div>
              </div>
              {/* Body */}
              <div style={{flex:1,overflowY:'auto',padding:'20px'}}>
                {currentEx.imagen&&(
                  <div style={{marginBottom:14,borderRadius:10,overflow:'hidden',maxHeight:180}}>
                    <img src={currentEx.imagen} alt="" style={{width:'100%',display:'block',objectFit:'cover'}}/>
                  </div>
                )}
                <ExRenderer ex={currentEx} ans={exAns} setAns={setAns} checked={isChecked}/>
              </div>
              {/* Footer */}
              <div style={{padding:'14px 20px',borderTop:'1px solid #F1F5F9',background:'#FAFBFC',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,flexShrink:0,flexWrap:'wrap'}}>
                {score ? (
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{fontSize:24,fontWeight:900,color:scol,lineHeight:1}}>{score.c}<span style={{fontSize:13,color:'#94A3B8'}}>/{score.t}</span></div>
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:scol}}>{pct===100?'🎉 Perfect!':pct>=80?'👍 Very good!':pct>=60?'🙂 Good effort!':'📚 Keep practising!'}</div>
                      <div style={{width:100,height:5,background:'#E2E8F0',borderRadius:3,overflow:'hidden',marginTop:4}}>
                        <div style={{width:`${pct}%`,height:'100%',background:scol,borderRadius:3,transition:'width 0.5s'}}/>
                      </div>
                    </div>
                  </div>
                ) : (
                  <span style={{fontSize:12,color:'#94A3B8'}}>{(currentEx.items||[]).length} preguntas</span>
                )}
                <div style={{display:'flex',gap:8}}>
                  {!isChecked&&(
                    <button onClick={handleCheck} style={{padding:'10px 20px',borderRadius:10,border:'none',background:color,color:'white',fontFamily:'inherit',fontSize:14,fontWeight:700,cursor:'pointer',boxShadow:`0 4px 14px ${color}55`}}>Check ✓</button>
                  )}
                  {isChecked&&(
                    <button onClick={handleContinue} style={{padding:'10px 20px',borderRadius:10,border:'none',background:'#059669',color:'white',fontFamily:'inherit',fontSize:14,fontWeight:700,cursor:'pointer',boxShadow:'0 4px 14px #05996955'}}>▶ Continuar vídeo</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Browse Screen ────────────────────────────────────────────────────────────
function BrowseScreen({ onSelect, onBack }) {
  const [recursos, setRecursos] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [searchQ,  setSearchQ]  = useState('');
  const [nivel,    setNivel]    = useState('');

  useEffect(() => {
    (async () => {
      try {
        const q    = fsQuery(collection(db,'resources'), where('tipoJuego','==','VIDEOQUIZZ'), where('isFinished','==',true));
        const snap = await getDocs(q);
        const fromFirestore = snap.docs.map(d => ({ id:d.id, ...d.data() }));
        // Merge: Firestore first, then biblioteca (avoid duplicates by id)
        const fsIds = new Set(fromFirestore.map(r => r.id));
        const merged = [...fromFirestore, ...BIBLIOTECA_VQ.filter(r => !fsIds.has(r.id))];
        setRecursos(merged);
      } catch(e) {
        console.error(e);
        setRecursos(BIBLIOTECA_VQ);
      }
      setLoading(false);
    })();
  }, []);

  const niveles  = [...new Set(recursos.map(r=>r.nivel).filter(Boolean))].sort();
  const filtered = useMemo(() => recursos.filter(r => {
    if (nivel && r.nivel!==nivel) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      return r.titulo?.toLowerCase().includes(q) || r.descripcion?.toLowerCase().includes(q) ||
             (r.tags||[]).some(t=>t.toLowerCase().includes(q));
    }
    return true;
  }), [recursos, searchQ, nivel]);

  return (
    <div style={{minHeight:'100vh',background:'#0F172A',fontFamily:'inherit'}}>
      {/* Header */}
      <div style={{background:'linear-gradient(135deg,#DC2626,#991B1B)',padding:'16px',color:'white'}}>
        <div style={{maxWidth:860,margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
            <button onClick={onBack} style={{border:'none',background:'rgba(255,255,255,0.2)',borderRadius:8,cursor:'pointer',fontSize:18,padding:'4px 10px',color:'white',flexShrink:0}}>←</button>
            <div>
              <div style={{fontSize:20,fontWeight:800,letterSpacing:'-0.5px'}}>🎬 VideoQuizz</div>
              <div style={{fontSize:12,opacity:0.75}}>Vídeos con ejercicios interactivos · pikt.es</div>
            </div>
          </div>
          <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Buscar vídeos..."
            style={{display:'block',width:'100%',boxSizing:'border-box',height:42,padding:'0 16px',borderRadius:12,border:'none',outline:'none',fontSize:14,fontFamily:'inherit',background:'rgba(255,255,255,0.15)',color:'white'}}/>
        </div>
      </div>

      {/* Level filters */}
      {niveles.length>0&&(
        <div style={{background:'#1E293B',borderBottom:'1px solid #334155',padding:'10px 16px'}}>
          <div style={{maxWidth:860,margin:'0 auto',display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
            <span style={{fontSize:12,color:'rgba(255,255,255,0.4)',marginRight:2}}>Nivel:</span>
            {['', ...niveles].map(n=>(
              <button key={n} onClick={()=>setNivel(n)}
                style={{padding:'3px 10px',borderRadius:20,border:`1.5px solid ${nivel===n?'#DC2626':'#334155'}`,background:nivel===n?'#DC262620':'transparent',color:nivel===n?'#FCA5A5':'rgba(255,255,255,0.55)',fontFamily:'inherit',fontSize:12,cursor:'pointer',fontWeight:nivel===n?600:400}}>
                {n||'Todos'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      <div style={{maxWidth:860,margin:'20px auto',padding:'0 16px 40px',display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:14}}>
        {loading&&<div style={{gridColumn:'1/-1',textAlign:'center',padding:60,color:'rgba(255,255,255,0.3)'}}>Cargando...</div>}
        {!loading&&filtered.length===0&&<div style={{gridColumn:'1/-1',textAlign:'center',padding:60,color:'rgba(255,255,255,0.3)'}}>No hay vídeos disponibles todavía.</div>}
        {filtered.map(r=>{
          const vid   = extractVideoId(r.youtubeUrl);
          const thumb = vid ? `https://img.youtube.com/vi/${vid}/mqdefault.jpg` : null;
          const clr   = r.color || '#DC2626';
          return (
            <div key={r.id} onClick={()=>onSelect(r)}
              style={{background:'#1E293B',borderRadius:14,border:'1px solid #334155',overflow:'hidden',cursor:'pointer',transition:'transform 0.15s,box-shadow 0.15s',borderTop:`3px solid ${clr}`}}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='0 10px 30px rgba(0,0,0,0.5)';}}
              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';}}>
              {/* Thumbnail */}
              <div style={{position:'relative',paddingBottom:'56.25%',background:'#111'}}>
                {thumb
                  ? <img src={thumb} alt="" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}/>
                  : <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:36,color:'#334155'}}>🎬</div>
                }
                <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.25)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <div style={{width:44,height:44,borderRadius:'50%',background:'rgba(255,255,255,0.9)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,color:clr}}>▶</div>
                </div>
                <div style={{position:'absolute',bottom:8,right:8,background:'rgba(0,0,0,0.8)',color:'white',fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:6}}>
                  {(r.ejercicios||[]).length} preguntas
                </div>
              </div>
              {/* Info */}
              <div style={{padding:'14px'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                  <span style={{fontSize:11,fontWeight:700,color:clr,padding:'2px 8px',borderRadius:10,background:`${clr}20`}}>{r.nivel}</span>
                  <span style={{fontSize:11,color:'rgba(255,255,255,0.35)'}}>{r.asignatura}</span>
                </div>
                <h3 style={{margin:'0 0 4px',fontSize:15,fontWeight:700,color:'white',lineHeight:1.3}}>{r.titulo}</h3>
                <p style={{margin:0,fontSize:12,color:'rgba(255,255,255,0.45)',lineHeight:1.4,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{r.descripcion}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function VideoQuizzApp({ onBack = () => {}, recursoDirecto = null }) {
  const [screen,  setScreen]  = useState(recursoDirecto ? 'play' : 'browse');
  const [recurso, setRecurso] = useState(recursoDirecto);

  if (screen === 'play' && recurso) {
    return <PlayScreen recurso={recurso} onBack={() => { if (recursoDirecto) onBack(); else setScreen('browse'); }}/>;
  }
  return <BrowseScreen onSelect={r => { setRecurso(r); setScreen('play'); }} onBack={onBack}/>;
}
