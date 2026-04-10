import { useState } from 'react';
import PptxGenJS from 'pptxgenjs';
import { Youtube, Loader2, Download, Eye, CheckCircle2, Clapperboard, Presentation } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const IDIOMAS    = ['Español', 'English', 'Français', 'Deutsch', 'Italiano', 'Português', 'Català', 'Euskera', 'Galego'];
const NUM_SLIDES = [5, 8, 10, 12, 15, 20];
const TIPOS_EJ   = ['fill', 'choice', 'truefalse', 'multichoice', 'match', 'order', 'construct', 'error', 'wordbank'];
const TIPO_LABEL = {
  fill:'Fill in the blank', choice:'Choose the correct', truefalse:'True / False',
  multichoice:'Multiple choice', match:'Match', order:'Order words',
  construct:'Write a sentence', error:'Find the error', wordbank:'Word bank',
};

function extractVideoId(url) {
  try {
    const u = new URL(url.trim());
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
    if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
    return null;
  } catch { return null; }
}

function generarCodigo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length:5}, ()=>chars[Math.floor(Math.random()*chars.length)]).join('');
}

// ─── PRESENTACIÓN ─────────────────────────────────────────────────────────────
function buildPromptPPTX({ idioma, numSlides, conEjercicios, promptExtra }) {
  return `Analiza el video de YouTube proporcionado, transcribe su contenido y crea una presentación educativa estructurada.

CONFIGURACIÓN:
- Idioma de salida: ${idioma}
- Número de diapositivas de contenido: ${numSlides}
- Incluir ejercicios de comprensión: ${conEjercicios ? 'SÍ' : 'NO'}
${promptExtra ? `- Instrucciones adicionales del profesor: ${promptExtra}` : ''}

INSTRUCCIONES:
1. Analiza y transcribe el video completamente
2. Extrae las ideas clave y organízalas en ${numSlides} diapositivas progresivas
3. Usa un lenguaje apropiado para el nivel educativo del contenido
4. La presentación debe fluir: introducción → desarrollo → conclusión
${conEjercicios ? `Para cada diapositiva de contenido, añade una pregunta de comprensión tipo test (4 opciones).` : ''}

RESPONDE EXCLUSIVAMENTE CON ESTE JSON (sin markdown, sin bloques de código, sin texto extra):
{
  "titulo": "Título principal extraído del video",
  "subtitulo": "Descripción breve del contenido",
  "diapositivas": [
    {
      "titulo": "Título de la diapositiva",
      "puntos": ["Punto clave 1", "Punto clave 2", "Punto clave 3"],
      "nota": "Nota del presentador"${conEjercicios ? `,
      "ejercicio": {
        "pregunta": "Pregunta de comprensión en ${idioma}",
        "opciones": ["Opción A", "Opción B", "Opción C", "Opción D"],
        "correcta": 0
      }` : ''}
    }
  ]
}

REGLAS: Solo JSON válido. Cada diapositiva 3-5 puntos (max 15 palabras c/u). Todo en ${idioma}. correcta = índice 0-3.`;
}

async function callGemini(youtubeUrl, promptText) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { fileData: { mimeType: 'video/mp4', fileUri: youtubeUrl } },
            { text: promptText }
          ]
        }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 8192 }
      })
    }
  );
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Error ${res.status}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(clean);
}

async function generarPPTX({ titulo, subtitulo, slides, conEjercicios, idioma }) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';

  const C_PRIMARY  = '6D28D9';
  const C_LIGHT_BG = 'F5F3FF';
  const C_TEXT     = '1F2937';
  const C_ACCENT   = 'EDE9FE';
  const C_GREEN    = '059669';
  const C_WHITE    = 'FFFFFF';
  const C_SOFT     = 'DDD6FE';

  // Portada
  const portada = pptx.addSlide();
  portada.background = { color: C_PRIMARY };
  portada.addShape(pptx.ShapeType.rect, { x:0, y:5.8, w:'100%', h:1.7, fill:{color:'5B21B6'}, line:{color:'5B21B6'} });
  portada.addText(titulo, { x:0.6, y:1.2, w:12.1, h:2.5, fontSize:38, bold:true, color:C_WHITE, align:'center', valign:'middle', wrap:true });
  if (subtitulo) portada.addText(subtitulo, { x:0.6, y:3.9, w:12.1, h:0.8, fontSize:18, color:C_SOFT, align:'center', italic:true });
  portada.addText('📹 Generado con pikt.es a partir de YouTube', { x:0.6, y:6.2, w:12.1, h:0.6, fontSize:12, color:C_SOFT, align:'center' });

  // Slides
  slides.forEach((s, i) => {
    const slide = pptx.addSlide();
    slide.background = { color: C_LIGHT_BG };
    slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:1.05, fill:{color:C_PRIMARY}, line:{color:C_PRIMARY} });
    slide.addText(`${i+1} / ${slides.length}`, { x:11.5, y:0.15, w:1.5, h:0.4, fontSize:10, color:C_SOFT, align:'right' });
    slide.addText(s.titulo||'', { x:0.35, y:0.12, w:10.8, h:0.8, fontSize:22, bold:true, color:C_WHITE, valign:'middle' });
    const hasEj = conEjercicios && s.ejercicio;
    const bullets = (s.puntos||[]).map(p => ({ text:p, options:{ bullet:{type:'bullet',indent:25}, paraSpaceAfter:6 } }));
    if (bullets.length>0) slide.addText(bullets, { x:0.6, y:1.2, w:12.0, h:hasEj?3.0:5.8, fontSize:17, color:C_TEXT, valign:'top', lineSpacingMultiple:1.35 });
    if (hasEj) {
      const ej = s.ejercicio; const ejY = 4.35;
      slide.addShape(pptx.ShapeType.rect, { x:0.5, y:ejY, w:12.3, h:2.85, fill:{color:C_ACCENT}, line:{color:C_PRIMARY,width:1.5} });
      slide.addText('❓ '+(ej.pregunta||''), { x:0.75, y:ejY+0.12, w:11.8, h:0.7, fontSize:13, bold:true, color:C_PRIMARY, wrap:true });
      ['A','B','C','D'].forEach((l,oi) => {
        slide.addText(`${l}) ${(ej.opciones||[])[oi]||''}`, {
          x:oi%2===0?0.75:6.9, y:ejY+0.9+Math.floor(oi/2)*0.7, w:5.8, h:0.6,
          fontSize:12, color:oi===ej.correcta?C_GREEN:C_TEXT, bold:oi===ej.correcta
        });
      });
    }
    if (s.nota) slide.addNotes(s.nota);
  });

  // Cierre
  const cierre = pptx.addSlide();
  cierre.background = { color: C_PRIMARY };
  cierre.addText(idioma==='English'?'Thank you!':idioma==='Français'?'Merci !':'¡Gracias!', { x:0.5, y:2.2, w:12.3, h:1.8, fontSize:52, bold:true, color:C_WHITE, align:'center' });
  cierre.addText('pikt.es', { x:0.5, y:4.2, w:12.3, h:0.6, fontSize:18, color:C_SOFT, align:'center', italic:true });

  const fileName = titulo.replace(/[^a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ \-_]/g,'').trim()||'presentacion';
  await pptx.writeFile({ fileName:`${fileName}.pptx` });
}

// ─── VIDEOQUIZZ ───────────────────────────────────────────────────────────────
function buildPromptVQ({ idioma, ejerciciosConfig, promptExtra }) {
  const ejDesc = ejerciciosConfig.map((e,i) =>
    `  Ejercicio ${i+1}: tipo="${e.tipo}" (${TIPO_LABEL[e.tipo]}), ${e.numPreguntas} pregunta(s), aparece en el segundo ${e.segundos} del video`
  ).join('\n');

  return `Analiza el vídeo de YouTube proporcionado y crea un recurso VideoQuizz educativo.

CONFIGURACIÓN:
- Idioma de los ejercicios: ${idioma}
- Número de ejercicios: ${ejerciciosConfig.length}
${promptExtra ? `- Instrucciones adicionales: ${promptExtra}` : ''}

EJERCICIOS A GENERAR:
${ejDesc}

TIPOS DE EJERCICIO Y FORMATO DE ITEMS:
- fill: item = { id, lbl, parts: ["texto antes","texto después"], hint:"(pista)", ans:["respuesta"], alts:[[]] }
- choice: item = { id, lbl, parts:["inicio","final"], opts:["op1","op2","op3"], ans:"op_correcta" }
- truefalse: item = { id, lbl, statement:"frase", ans:"true"/"false" }
- multichoice: item = { id, lbl, question:"pregunta", opts:["A","B","C","D"], ans:"opcion_correcta" }
- match: item = { id, lbl, left:"término", right:"definición" }
- order: item = { id, lbl, shuffled:["palabra1","palabra2","..."], answer:"frase correcta completa" }
- construct: item = { id, lbl, prompt:"palabras / clave", ans:"frase correcta completa", alts:["alternativa"] }
- error: item = { id, lbl, sentence:"frase con error", errorWord:"palabra_incorrecta", correction:"corrección" }
- wordbank: igual que fill pero añade wordbank:["palabra1","palabra2",...] en el ejercicio

INSTRUCCIONES:
1. Analiza el contenido del vídeo completamente
2. Crea preguntas que reflejen conceptos explicados en el vídeo, en el momento indicado (segundos)
3. Las preguntas deben ser relevantes al contenido del vídeo en ese instante
4. Todos los textos en ${idioma}
5. Usa ids numéricos para cada item (1, 2, 3...)

RESPONDE EXCLUSIVAMENTE CON ESTE JSON (sin markdown, sin código, sin texto extra):
{
  "titulo": "Título del recurso basado en el vídeo",
  "nivel": "3 ESO",
  "asignatura": "Asignatura",
  "tema": "Tema",
  "descripcion": "Breve descripción del recurso",
  "ejercicios": [
    {
      "id": "ex1",
      "tipo": "tipo_del_ejercicio",
      "titulo": "Título del ejercicio",
      "enunciado": "Instrucciones claras en ${idioma}",
      "tiempo": 60,
      "items": [...]
    }
  ]
}

REGLA CRÍTICA: Solo JSON válido. Los "tiempo" deben ser exactamente los segundos indicados en la configuración.`;
}

// ─────────────────────────────────────────────────────────
// SUBCOMPONENTE: Modo Presentación
// ─────────────────────────────────────────────────────────
function ModoPresentacion({ onBack }) {
  const [step,         setStep]         = useState('config');
  const [youtubeUrl,   setYoutubeUrl]   = useState('');
  const [idioma,       setIdioma]       = useState('Español');
  const [numSlides,    setNumSlides]    = useState(10);
  const [conEjercicios,setConEjercicios]= useState(false);
  const [promptExtra,  setPromptExtra]  = useState('');
  const [titulo,       setTitulo]       = useState('');
  const [subtitulo,    setSubtitulo]    = useState('');
  const [slides,       setSlides]       = useState([]);
  const [error,        setError]        = useState('');
  const [loadingMsg,   setLoadingMsg]   = useState('');

  const videoId  = extractVideoId(youtubeUrl);
  const urlValida = !!videoId;

  const handleGenerar = async () => {
    if (!urlValida) { setError('Introduce una URL válida de YouTube.'); return; }
    if (!GEMINI_KEY) { setError('No se encontró la clave de Gemini (VITE_GEMINI_API_KEY).'); return; }
    setError(''); setStep('loading');
    setLoadingMsg('Analizando el video con IA… Esto puede tardar 30-60 segundos.');
    try {
      const parsed = await callGemini(youtubeUrl, buildPromptPPTX({ idioma, numSlides, conEjercicios, promptExtra }));
      setTitulo(parsed.titulo||'Presentación');
      setSubtitulo(parsed.subtitulo||'');
      setSlides(parsed.diapositivas||[]);
      setStep('preview');
    } catch(e) { setError('Error: '+e.message); setStep('config'); }
  };

  const handleDescargar = async () => {
    setStep('loading'); setLoadingMsg('Generando archivo PPTX…');
    try {
      await generarPPTX({ titulo, subtitulo, slides, conEjercicios, idioma });
      setStep('done');
    } catch(e) { setError('Error al generar PPTX: '+e.message); setStep('preview'); }
  };

  if (step==='loading') return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:340,gap:18}}>
      <Loader2 size={48} color="#6D28D9" style={{animation:'spin 1s linear infinite'}}/>
      <p style={{color:'#6D28D9',fontWeight:600,fontSize:'1rem',textAlign:'center',maxWidth:360}}>{loadingMsg}</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (step==='done') return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:340,gap:20}}>
      <CheckCircle2 size={64} color="#059669"/>
      <h3 style={{color:'#1F2937',margin:0}}>¡PPTX descargado!</h3>
      <p style={{color:'#6B7280',margin:0}}>Revisa tu carpeta de descargas.</p>
      <div style={{display:'flex',gap:12,marginTop:8}}>
        <button onClick={()=>setStep('preview')} style={btnSecondary}>← Ver presentación</button>
        <button onClick={()=>{setStep('config');setYoutubeUrl('');setSlides([]);}} style={btnPrimary}>Nueva presentación</button>
      </div>
    </div>
  );

  if (step==='preview') return (
    <div style={{maxWidth:900,margin:'0 auto',padding:'0 8px 32px'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
        <button onClick={()=>setStep('config')} style={btnSecondary}>← Editar config</button>
        <div style={{flex:1}}>
          <h2 style={{margin:0,color:'#6D28D9',fontSize:'1.25rem'}}>{titulo}</h2>
          {subtitulo&&<p style={{margin:0,color:'#9CA3AF',fontSize:'0.85rem'}}>{subtitulo}</p>}
        </div>
        <button onClick={handleDescargar} style={btnPrimary}><Download size={16}/> Descargar PPTX</button>
      </div>
      {error&&<div style={errorBox}>{error}</div>}
      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        <div style={slideCard('#6D28D9','white')}>
          <span style={{fontSize:'0.7rem',opacity:0.7,textTransform:'uppercase',letterSpacing:1}}>Portada</span>
          <h3 style={{margin:'6px 0 4px',fontSize:'1.2rem',color:'white'}}>{titulo}</h3>
          {subtitulo&&<p style={{margin:0,fontSize:'0.85rem',color:'#DDD6FE'}}>{subtitulo}</p>}
        </div>
        {slides.map((s,i)=>(
          <div key={i} style={slideCard('#F5F3FF','#1F2937')}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              <span style={{background:'#6D28D9',color:'white',borderRadius:99,padding:'2px 10px',fontSize:'0.75rem',fontWeight:700}}>{i+1}</span>
              <strong style={{color:'#6D28D9',fontSize:'1rem'}}>{s.titulo}</strong>
            </div>
            <ul style={{margin:0,paddingLeft:20,color:'#374151',fontSize:'0.88rem',lineHeight:1.6}}>
              {(s.puntos||[]).map((p,j)=><li key={j}>{p}</li>)}
            </ul>
            {s.nota&&<p style={{margin:'8px 0 0',fontSize:'0.78rem',color:'#9CA3AF',fontStyle:'italic'}}>📝 {s.nota}</p>}
            {conEjercicios&&s.ejercicio&&(
              <div style={{marginTop:12,background:'#EDE9FE',borderRadius:8,padding:'10px 14px',borderLeft:'3px solid #6D28D9'}}>
                <p style={{margin:'0 0 8px',fontWeight:700,color:'#6D28D9',fontSize:'0.85rem'}}>❓ {s.ejercicio.pregunta}</p>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
                  {(s.ejercicio.opciones||[]).map((op,oi)=>(
                    <span key={oi} style={{fontSize:'0.8rem',color:oi===s.ejercicio.correcta?'#059669':'#374151',fontWeight:oi===s.ejercicio.correcta?700:400}}>
                      {['A','B','C','D'][oi]}) {op}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        <div style={slideCard('#6D28D9','white')}>
          <span style={{fontSize:'0.7rem',opacity:0.7,textTransform:'uppercase',letterSpacing:1}}>Cierre</span>
          <h3 style={{margin:'6px 0 4px',fontSize:'1.5rem',color:'white',textAlign:'center'}}>
            {idioma==='English'?'Thank you!':idioma==='Français'?'Merci !':'¡Gracias!'}
          </h3>
        </div>
      </div>
      <div style={{textAlign:'center',marginTop:28}}>
        <button onClick={handleDescargar} style={{...btnPrimary,fontSize:'1rem',padding:'12px 32px'}}>
          <Download size={18}/> Descargar PPTX
        </button>
      </div>
    </div>
  );

  // Config
  return (
    <div style={{maxWidth:680,margin:'0 auto',padding:'0 8px 32px'}}>
      <button onClick={onBack} style={{...btnSecondary,marginBottom:28}}>← Volver</button>
      <div style={{textAlign:'center',marginBottom:32}}>
        <div style={{background:'#EDE9FE',borderRadius:'50%',width:64,height:64,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px'}}>
          <Presentation size={32} color="#6D28D9"/>
        </div>
        <h2 style={{margin:0,color:'#6D28D9'}}>Video → Presentación</h2>
        <p style={{color:'#9CA3AF',margin:'6px 0 0',fontSize:'0.9rem'}}>Convierte cualquier video de YouTube en una presentación PPTX.</p>
      </div>
      {error&&<div style={errorBox}>{error}</div>}
      <div style={card}>
        <label style={labelStyle}>URL del video de YouTube *</label>
        <div style={{position:'relative',marginBottom:20}}>
          <input type="url" value={youtubeUrl} onChange={e=>{setYoutubeUrl(e.target.value);setError('');}}
            placeholder="https://www.youtube.com/watch?v=..."
            style={{...inputStyle,paddingRight:48,borderColor:youtubeUrl&&!urlValida?'#EF4444':undefined}}/>
          {urlValida&&<CheckCircle2 size={18} color="#059669" style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)'}}/>}
        </div>
        {urlValida&&(
          <div style={{background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:8,padding:'8px 14px',marginBottom:20,fontSize:'0.83rem',color:'#166534'}}>
            ✅ Video detectado: <code style={{fontSize:'0.8rem'}}>{videoId}</code>
          </div>
        )}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20}}>
          <div>
            <label style={labelStyle}>Idioma</label>
            <select value={idioma} onChange={e=>setIdioma(e.target.value)} style={inputStyle}>
              {IDIOMAS.map(i=><option key={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Nº diapositivas</label>
            <select value={numSlides} onChange={e=>setNumSlides(Number(e.target.value))} style={inputStyle}>
              {NUM_SLIDES.map(n=><option key={n} value={n}>{n} diapositivas</option>)}
            </select>
          </div>
        </div>
        <div onClick={()=>setConEjercicios(v=>!v)}
          style={{display:'flex',alignItems:'center',gap:14,padding:'14px 16px',background:conEjercicios?'#EDE9FE':'#F9FAFB',border:`2px solid ${conEjercicios?'#6D28D9':'#E5E7EB'}`,borderRadius:10,cursor:'pointer',marginBottom:20,transition:'all 0.2s'}}>
          <div style={{width:46,height:26,borderRadius:99,background:conEjercicios?'#6D28D9':'#D1D5DB',position:'relative',flexShrink:0}}>
            <div style={{position:'absolute',top:3,left:conEjercicios?23:3,width:20,height:20,borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.3)'}}/>
          </div>
          <div>
            <div style={{fontWeight:600,color:conEjercicios?'#6D28D9':'#374151',fontSize:'0.95rem'}}>Incluir ejercicios de comprensión</div>
            <div style={{fontSize:'0.8rem',color:'#9CA3AF'}}>Añade una pregunta tipo test al final de cada diapositiva</div>
          </div>
        </div>
        <label style={labelStyle}>Instrucciones adicionales (opcional)</label>
        <textarea value={promptExtra} onChange={e=>setPromptExtra(e.target.value)} rows={3}
          placeholder="Ej: «Adapta para alumnos de 4º ESO», «Enfócate en aspectos históricos»…"
          style={{...inputStyle,resize:'vertical',fontFamily:'inherit',marginBottom:24}}/>
        <button onClick={handleGenerar} disabled={!urlValida}
          style={{...btnPrimary,width:'100%',fontSize:'1rem',padding:'13px',opacity:urlValida?1:0.5,cursor:urlValida?'pointer':'not-allowed'}}>
          <Eye size={18}/> Generar presentación
        </button>
        <p style={{textAlign:'center',color:'#9CA3AF',fontSize:'0.78rem',margin:'10px 0 0'}}>
          Usa Gemini 2.0 Flash · Puede tardar hasta 1 minuto
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// SUBCOMPONENTE: Modo VideoQuizz
// ─────────────────────────────────────────────────────────
const EJ_DEFAULT = { tipo:'choice', numPreguntas:4, minutos:'1', segundos:60 };

function ModoVideoQuizz({ onBack, usuario }) {
  const [step,      setStep]      = useState('config'); // config | url | loading | done | error
  const [idioma,    setIdioma]    = useState('Español');
  const [promptExtra,setPromptExtra]=useState('');
  const [ejercicios,setEjercicios]= useState([{...EJ_DEFAULT,id:1,minutos:'1',segundos:60}]);
  const [youtubeUrl,setYoutubeUrl]= useState('');
  const [error,     setError]     = useState('');
  const [resultado, setResultado] = useState(null); // recurso generado
  const [saving,    setSaving]    = useState(false);

  const videoId   = extractVideoId(youtubeUrl);
  const urlValida = !!videoId;

  const addEjercicio = () => {
    const prev = ejercicios[ejercicios.length-1];
    const prevSecs = prev ? prev.segundos : 60;
    setEjercicios(e=>[...e,{...EJ_DEFAULT,id:Date.now(),minutos:String(Math.floor((prevSecs+90)/60)),segundos:prevSecs+90}]);
  };
  const removeEjercicio = (id) => setEjercicios(e=>e.filter(x=>x.id!==id));
  const updateEjercicio = (id,field,val) => setEjercicios(e=>e.map(x=>x.id===id?{...x,[field]:val}:x));

  const handleTimeChange = (id, raw) => {
    const parts = raw.split(':');
    let secs = 0;
    if (parts.length===2) secs = parseInt(parts[0]||0)*60 + parseInt(parts[1]||0);
    else secs = parseInt(raw)||0;
    updateEjercicio(id,'minutos',raw);
    updateEjercicio(id,'segundos',secs);
  };

  const handleGenerar = async () => {
    if (!urlValida) { setError('Introduce una URL válida de YouTube.'); return; }
    if (!GEMINI_KEY) { setError('No se encontró la clave de Gemini.'); return; }
    setError(''); setStep('loading');
    try {
      const sorted = [...ejercicios].sort((a,b)=>a.segundos-b.segundos);
      const parsed = await callGemini(youtubeUrl, buildPromptVQ({ idioma, ejerciciosConfig:sorted.map(e=>({tipo:e.tipo,numPreguntas:e.numPreguntas,segundos:e.segundos})), promptExtra }));
      // Asegurar tiempo correcto
      const ejConTiempo = (parsed.ejercicios||[]).map((ex,i)=>({
        ...ex,
        tiempo: sorted[i]?.segundos ?? ex.tiempo ?? 60,
        id: ex.id || ('vqex'+i),
      }));
      setResultado({ ...parsed, ejercicios:ejConTiempo, youtubeUrl, color:'#DC2626' });
      setStep('done');
    } catch(e) { setError('Error: '+e.message); setStep('url'); }
  };

  const handleGuardar = async () => {
    if (!resultado) return;
    setSaving(true);
    try {
      await addDoc(collection(db,'recursos'),{
        ...resultado,
        tipoJuego:'VIDEOQUIZZ', tipo:'VIDEOQUIZZ',
        isFinished: false,
        profesorUid: usuario?.uid||'anon',
        profesorNombre: usuario?.displayName||'Anon',
        pais: usuario?.pais||'', region: usuario?.region||'', poblacion: usuario?.poblacion||'',
        ciclo: resultado.ciclo||'Secundaria',
        playCount:0, fechaCreacion:new Date(),
        accessCode: generarCodigo(), origen:'videoapresentacion_vq',
      });
      alert('✅ Recurso VideoQuizz guardado en Borrador. Puedes publicarlo desde "Crear VideoQuizz" en las herramientas.');
      onBack();
    } catch(e) { alert('Error al guardar: '+e.message); }
    setSaving(false);
  };

  // Step: config (ejercicios)
  if (step==='config') return (
    <div style={{maxWidth:700,margin:'0 auto',padding:'0 8px 32px'}}>
      <button onClick={onBack} style={{...btnSecondary,marginBottom:28}}>← Volver</button>
      <div style={{textAlign:'center',marginBottom:32}}>
        <div style={{background:'#FEE2E2',borderRadius:'50%',width:64,height:64,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px'}}>
          <Clapperboard size={32} color="#DC2626"/>
        </div>
        <h2 style={{margin:0,color:'#DC2626'}}>Video → VideoQuizz</h2>
        <p style={{color:'#9CA3AF',margin:'6px 0 0',fontSize:'0.9rem'}}>
          Configura los ejercicios y la IA los generará automáticamente a partir del vídeo.
        </p>
      </div>

      <div style={card}>
        {/* Idioma */}
        <div style={{marginBottom:20}}>
          <label style={labelStyle}>Idioma de los ejercicios</label>
          <select value={idioma} onChange={e=>setIdioma(e.target.value)} style={inputStyle}>
            {IDIOMAS.map(i=><option key={i}>{i}</option>)}
          </select>
        </div>

        {/* Ejercicios */}
        <label style={labelStyle}>Ejercicios ({ejercicios.length})</label>
        <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:16}}>
          {ejercicios.map((ej,idx)=>(
            <div key={ej.id} style={{background:'#F8FAFC',borderRadius:12,padding:'14px 16px',border:'1px solid #E2E8F0',position:'relative'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                <div style={{width:26,height:26,borderRadius:8,background:'#DC2626',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:13,flexShrink:0}}>{idx+1}</div>
                <span style={{fontWeight:600,color:'#374151',fontSize:13}}>Ejercicio {idx+1}</span>
                {ejercicios.length>1&&(
                  <button onClick={()=>removeEjercicio(ej.id)} style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',color:'#94A3B8',fontSize:16}}>✕</button>
                )}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                <div>
                  <label style={labelStyle}>Tipo</label>
                  <select value={ej.tipo} onChange={e=>updateEjercicio(ej.id,'tipo',e.target.value)} style={inputStyle}>
                    {TIPOS_EJ.map(t=><option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Nº preguntas</label>
                  <select value={ej.numPreguntas} onChange={e=>updateEjercicio(ej.id,'numPreguntas',Number(e.target.value))} style={inputStyle}>
                    {[2,3,4,5,6,8].map(n=><option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Aparece en (MM:SS)</label>
                  <input value={ej.minutos} onChange={e=>{updateEjercicio(ej.id,'minutos',e.target.value);}}
                    onBlur={e=>handleTimeChange(ej.id,e.target.value)}
                    placeholder="1:30" style={inputStyle}/>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button onClick={addEjercicio} style={{...btnSecondary,width:'100%',justifyContent:'center',marginBottom:20,borderStyle:'dashed'}}>
          + Añadir ejercicio
        </button>

        {/* Prompt extra */}
        <label style={labelStyle}>Instrucciones adicionales (opcional)</label>
        <textarea value={promptExtra} onChange={e=>setPromptExtra(e.target.value)} rows={2}
          placeholder="Ej: «Usa vocabulario de nivel B1», «Enfócate en la segunda mitad del vídeo»…"
          style={{...inputStyle,resize:'vertical',fontFamily:'inherit',marginBottom:24}}/>

        <button onClick={()=>setStep('url')} style={{...btnPrimary,background:'#DC2626',width:'100%',fontSize:'1rem',padding:'13px'}}>
          Siguiente: añadir URL del vídeo →
        </button>
      </div>
    </div>
  );

  // Step: url
  if (step==='url') return (
    <div style={{maxWidth:680,margin:'0 auto',padding:'0 8px 32px'}}>
      <button onClick={()=>setStep('config')} style={{...btnSecondary,marginBottom:28}}>← Volver a configuración</button>
      <div style={{textAlign:'center',marginBottom:28}}>
        <Youtube size={40} color="#DC2626" style={{marginBottom:8}}/>
        <h2 style={{margin:0,color:'#DC2626'}}>URL del vídeo de YouTube</h2>
        <p style={{color:'#9CA3AF',margin:'6px 0 0',fontSize:'0.9rem'}}>
          La IA analizará el vídeo y generará los {ejercicios.length} ejercicio(s) configurados.
        </p>
      </div>
      {error&&<div style={errorBox}>{error}</div>}
      <div style={card}>
        <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:20,background:'#FFF7ED',borderRadius:10,padding:'14px',border:'1px solid #FED7AA'}}>
          <div style={{fontWeight:700,fontSize:13,color:'#EA580C'}}>Resumen de ejercicios:</div>
          {ejercicios.map((ej,i)=>(
            <div key={ej.id} style={{fontSize:13,color:'#374151',display:'flex',gap:8,alignItems:'center'}}>
              <span style={{background:'#DC2626',color:'white',borderRadius:6,padding:'1px 8px',fontWeight:700,fontSize:11}}>{i+1}</span>
              <span>{TIPO_LABEL[ej.tipo]} · {ej.numPreguntas} preguntas · ⏱ {ej.minutos||'0:00'}</span>
            </div>
          ))}
          <div style={{fontSize:12,color:'#9CA3AF',marginTop:4}}>Idioma: {idioma}{promptExtra?` · Prompt extra: "${promptExtra.slice(0,40)}…"`:''}</div>
        </div>

        <label style={labelStyle}>URL del vídeo de YouTube *</label>
        <div style={{position:'relative',marginBottom:16}}>
          <input type="url" value={youtubeUrl} onChange={e=>{setYoutubeUrl(e.target.value);setError('');}}
            placeholder="https://www.youtube.com/watch?v=..."
            style={{...inputStyle,paddingRight:48,borderColor:youtubeUrl&&!urlValida?'#EF4444':undefined}}/>
          {urlValida&&<CheckCircle2 size={18} color="#059669" style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)'}}/>}
        </div>
        {urlValida&&(
          <div style={{background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:8,padding:'8px 14px',marginBottom:16,fontSize:'0.83rem',color:'#166534'}}>
            ✅ Video detectado: <code style={{fontSize:'0.8rem'}}>{videoId}</code>
          </div>
        )}
        <button onClick={handleGenerar} disabled={!urlValida}
          style={{...btnPrimary,background:'#DC2626',width:'100%',fontSize:'1rem',padding:'13px',opacity:urlValida?1:0.5,cursor:urlValida?'pointer':'not-allowed'}}>
          <Clapperboard size={18}/> Generar VideoQuizz con IA
        </button>
        <p style={{textAlign:'center',color:'#9CA3AF',fontSize:'0.78rem',margin:'10px 0 0'}}>
          Usa Gemini 2.0 Flash · Puede tardar hasta 1 minuto
        </p>
      </div>
    </div>
  );

  // Step: loading
  if (step==='loading') return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:340,gap:18}}>
      <Clapperboard size={48} color="#DC2626" style={{animation:'pulse 1s ease-in-out infinite'}}/>
      <p style={{color:'#DC2626',fontWeight:600,fontSize:'1rem',textAlign:'center',maxWidth:360}}>
        Analizando el vídeo y generando ejercicios… Esto puede tardar 30-90 segundos.
      </p>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );

  // Step: done
  if (step==='done' && resultado) return (
    <div style={{maxWidth:700,margin:'0 auto',padding:'0 8px 40px'}}>
      <div style={{textAlign:'center',marginBottom:24}}>
        <CheckCircle2 size={52} color="#059669" style={{marginBottom:8}}/>
        <h2 style={{margin:0,color:'#059669'}}>¡VideoQuizz generado!</h2>
        <p style={{color:'#6B7280',margin:'6px 0 0'}}>{resultado.titulo}</p>
      </div>

      {/* Preview ejercicios */}
      <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:24}}>
        {(resultado.ejercicios||[]).map((ex,i)=>(
          <div key={ex.id||i} style={{background:'white',borderRadius:12,border:'1px solid #E2E8F0',padding:'14px 18px',borderLeft:'4px solid #DC2626'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
              <span style={{background:'#DC2626',color:'white',borderRadius:6,padding:'2px 10px',fontWeight:700,fontSize:11}}>
                {i+1} · ⏱ {Math.floor((ex.tiempo||0)/60)}:{String((ex.tiempo||0)%60).padStart(2,'0')}
              </span>
              <span style={{fontWeight:700,color:'#0F172A',fontSize:14}}>{ex.titulo}</span>
              <span style={{fontSize:11,color:'#94A3B8',marginLeft:'auto'}}>{TIPO_LABEL[ex.tipo]||ex.tipo}</span>
            </div>
            <p style={{margin:0,fontSize:13,color:'#475569'}}>{ex.enunciado}</p>
            <div style={{fontSize:12,color:'#94A3B8',marginTop:4}}>{(ex.items||[]).length} preguntas</div>
          </div>
        ))}
      </div>

      <div style={{display:'flex',gap:12,flexWrap:'wrap',justifyContent:'center'}}>
        <button onClick={()=>{setStep('config');setResultado(null);setYoutubeUrl('');}} style={btnSecondary}>
          🔄 Generar otro
        </button>
        <button onClick={handleGuardar} disabled={saving}
          style={{...btnPrimary,background:'#059669',opacity:saving?0.7:1}}>
          {saving?<Loader2 size={16} style={{animation:'spin 1s linear infinite'}}/>:<CheckCircle2 size={16}/>}
          {saving?'Guardando…':'Guardar como borrador'}
        </button>
      </div>
      <p style={{textAlign:'center',color:'#9CA3AF',fontSize:'0.78rem',marginTop:10}}>
        Se guardará como Borrador. Publícalo desde "Crear VideoQuizz" para que los alumnos lo vean.
      </p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return null;
}

// ─────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────
export default function VideoAPresentacion({ onBack, usuario }) {
  const [modo, setModo] = useState(null); // null | 'pptx' | 'vq'

  if (modo==='pptx') return <ModoPresentacion onBack={()=>setModo(null)}/>;
  if (modo==='vq')   return <ModoVideoQuizz   onBack={()=>setModo(null)} usuario={usuario}/>;

  return (
    <div style={{maxWidth:700,margin:'0 auto',padding:'0 16px 40px'}}>
      <button onClick={onBack} style={{...btnSecondary,marginBottom:36}}>← Volver a herramientas</button>

      <div style={{textAlign:'center',marginBottom:40}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:12,marginBottom:12}}>
          <Youtube size={36} color="#DC2626"/>
          <h2 style={{margin:0,color:'#1F2937',fontSize:'1.6rem'}}>Video → Recurso</h2>
        </div>
        <p style={{color:'#9CA3AF',margin:0,fontSize:'1rem'}}>
          ¿Qué quieres crear a partir de un vídeo de YouTube?
        </p>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        {/* Presentación */}
        <button onClick={()=>setModo('pptx')}
          style={{background:'white',border:'2px solid #EDE9FE',borderRadius:20,padding:'32px 24px',cursor:'pointer',textAlign:'center',transition:'all 0.2s',fontFamily:'inherit'}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='#6D28D9';e.currentTarget.style.background='#F5F3FF';}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='#EDE9FE';e.currentTarget.style.background='white';}}>
          <div style={{background:'#EDE9FE',borderRadius:'50%',width:64,height:64,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
            <Presentation size={32} color="#6D28D9"/>
          </div>
          <h3 style={{margin:'0 0 8px',color:'#6D28D9',fontSize:'1.15rem'}}>Presentación PPTX</h3>
          <p style={{margin:0,color:'#9CA3AF',fontSize:'0.88rem',lineHeight:1.5}}>
            La IA transcribe el vídeo y genera una presentación lista para usar en clase.
          </p>
        </button>

        {/* VideoQuizz */}
        <button onClick={()=>setModo('vq')}
          style={{background:'white',border:'2px solid #FEE2E2',borderRadius:20,padding:'32px 24px',cursor:'pointer',textAlign:'center',transition:'all 0.2s',fontFamily:'inherit'}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='#DC2626';e.currentTarget.style.background='#FFF5F5';}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='#FEE2E2';e.currentTarget.style.background='white';}}>
          <div style={{background:'#FEE2E2',borderRadius:'50%',width:64,height:64,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
            <Clapperboard size={32} color="#DC2626"/>
          </div>
          <h3 style={{margin:'0 0 8px',color:'#DC2626',fontSize:'1.15rem'}}>VideoQuizz</h3>
          <p style={{margin:0,color:'#9CA3AF',fontSize:'0.88rem',lineHeight:1.5}}>
            La IA genera ejercicios interactivos que aparecen en momentos concretos del vídeo.
          </p>
        </button>
      </div>
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────
const btnPrimary = {
  background:'#6D28D9', color:'white', border:'none',
  borderRadius:10, padding:'9px 20px', cursor:'pointer',
  fontWeight:600, fontSize:'0.9rem',
  display:'inline-flex', alignItems:'center', gap:7
};
const btnSecondary = {
  background:'white', color:'#555', border:'1px solid #dde',
  borderRadius:8, padding:'7px 14px', cursor:'pointer',
  fontSize:'0.85rem', display:'inline-flex', alignItems:'center', gap:5
};
const card = {
  background:'white', borderRadius:16, padding:'28px',
  boxShadow:'0 4px 20px rgba(0,0,0,0.07)', border:'1px solid #EDE9FE'
};
const inputStyle = {
  width:'100%', padding:'10px 14px', borderRadius:8,
  border:'1px solid #D1D5DB', fontSize:'0.93rem',
  outline:'none', boxSizing:'border-box', background:'white'
};
const labelStyle = {
  display:'block', fontSize:'0.82rem', fontWeight:600,
  color:'#374151', marginBottom:6, textTransform:'uppercase', letterSpacing:0.5
};
const errorBox = {
  background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8,
  padding:'10px 14px', color:'#DC2626', fontSize:'0.88rem', marginBottom:16
};
const slideCard = (bg, color) => ({
  background:bg, borderRadius:12, padding:'16px 20px',
  boxShadow:'0 2px 8px rgba(0,0,0,0.06)', color
});
