// FotoARecurso.jsx — Extractor de ejercicios con Gemini Vision

import { useState, useRef } from 'react';

// ─── modelo Gemini ──────────────────────────────────────────────────────────
import { callGeminiProxy, extractText } from '../geminiProxy.js';
const GEMINI_MODEL = 'gemini-2.0-flash';

// ─── prompt de extracción ──────────────────────────────────────────────────
const buildPrompt = ({ idioma = 'English', nivel = '3 ESO', asignatura = 'English', promptExtra = '' } = {}) => `You are an expert educational content extractor.

IMPORTANT LANGUAGE RULE: All exercise content (enunciado, titles, descriptions, item text, answers, tags) MUST be written in ${idioma}. The JSON keys stay in English but ALL values must be in ${idioma}.

Target level: ${nivel}. Subject: ${asignatura}.${promptExtra ? `\n\nAdditional instructions: ${promptExtra}` : ''}

Analyze this exercise page image carefully. Extract ALL exercises you can see.

Identify each exercise tipo (type):
- fill: fill in the blank, verb given in brackets like "(use)" or "(not make)", blank shown as a line
- choice: choose between exactly 2 options shown in bold/italics inline in the sentence
- wordbank: complete sentences using words from a provided box or list shown above
- construct: write full sentences from word prompts shown as "word1 / word2 / word3 /."
- match: connect left column items to right column items with arrows or lines
- order: arrange shuffled words into a grammatically correct sentence
- truefalse: read statements and mark True (T) or False (F)
- multichoice: questions with lettered options A B C D
- error: each sentence has one grammatical mistake to find and correct

Return ONLY a valid JSON object, NO markdown fences, NO explanation:
{"titulo":"descriptive title in ${idioma}","nivel":"${nivel}","asignatura":"${asignatura}","tema":"topic in ${idioma}",
"descripcion":"one sentence description in ${idioma}","tags":["tag1","tag2"],
"ejercicios":[

{"id":"ex0","tipo":"fill","titulo":"...","enunciado":"Complete with the verbs in brackets...","imagen":null,
"items":[{"id":1,"lbl":"1.","parts":["text before blank ","text after blank"],"hint":"(verb)","ans":["correct answer"],"alts":[["alternative"]]}]},

{"id":"ex1","tipo":"choice","titulo":"...","enunciado":"Choose the correct form...","imagen":null,
"items":[{"id":1,"lbl":"1.","parts":["before ","after"],"opts":["option1","option2"],"ans":"correct option"}]},

{"id":"ex2","tipo":"wordbank","titulo":"...","enunciado":"Complete with words from the box...","imagen":null,
"wordbank":["word1","word2"],"items":[{"id":1,"lbl":"1.","parts":["before ","after"],"ans":["answer"],"alts":[[]]}]},

{"id":"ex3","tipo":"construct","titulo":"...","enunciado":"Write sentences...","imagen":null,
"items":[{"id":1,"lbl":"1.","prompt":"word1 / word2 /.","ans":"Correct sentence.","alts":[]}]},

{"id":"ex4","tipo":"match","titulo":"...","enunciado":"Match each word...","imagen":null,
"items":[{"id":1,"lbl":"1.","left":"left item","right":"right item"}]},

{"id":"ex5","tipo":"order","titulo":"...","enunciado":"Put words in order...","imagen":null,
"items":[{"id":1,"lbl":"1.","shuffled":["w2","w1","w3"],"answer":"w1 w2 w3."}]},

{"id":"ex6","tipo":"truefalse","titulo":"...","enunciado":"True or False?","imagen":null,
"items":[{"id":1,"lbl":"1.","statement":"statement text","ans":"true"}]},

{"id":"ex7","tipo":"multichoice","titulo":"...","enunciado":"Choose the correct answer...","imagen":null,
"items":[{"id":1,"lbl":"1.","question":"question","opts":["A text","B text","C text","D text"],"ans":"A text"}]},

{"id":"ex8","tipo":"error","titulo":"...","enunciado":"Find and correct the mistake...","imagen":null,
"items":[{"id":1,"lbl":"1.","sentence":"sentence with error","errorWord":"wrongword","correction":"correctword"}]}

]}

Extract EVERY exercise and EVERY item visible. Include correct answers. Skip grammar explanation boxes that are not actual exercises.`;

// ─── tipo metadata ─────────────────────────────────────────────────────────
const TIPO_INFO = {
  fill:        { label: 'Fill in',         color: '#6D28D9', bg: '#EDE9FE' },
  choice:      { label: 'Choose',          color: '#1D4ED8', bg: '#DBEAFE' },
  wordbank:    { label: 'Word bank',       color: '#B45309', bg: '#FEF3C7' },
  construct:   { label: 'Write',           color: '#047857', bg: '#D1FAE5' },
  match:       { label: 'Match',           color: '#0F766E', bg: '#CCFBF1' },
  order:       { label: 'Order',           color: '#C2410C', bg: '#FFEDD5' },
  truefalse:   { label: 'True / False',    color: '#0369A1', bg: '#E0F2FE' },
  multichoice: { label: 'Multiple choice', color: '#7E22CE', bg: '#F3E8FF' },
  error:       { label: 'Find the error',  color: '#B91C1C', bg: '#FEE2E2' },
};

// ─── estilos compartidos ───────────────────────────────────────────────────
const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  modal: {
    background: 'white', borderRadius: 20, width: '100%', maxWidth: 620,
    maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  header: {
    padding: '18px 24px', borderBottom: '1px solid #F1F5F9',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  body: { padding: '24px', overflowY: 'auto', flex: 1 },
  footer: { padding: '16px 24px', borderTop: '1px solid #F1F5F9', background: '#FAFAFA' },
  btnPrimary: {
    padding: '10px 22px', border: 'none', borderRadius: 10,
    background: '#4338CA', color: 'white', fontFamily: 'inherit',
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  btnSecondary: {
    padding: '10px 18px', border: '1px solid #E2E8F0', borderRadius: 10,
    background: 'white', color: '#374151', fontFamily: 'inherit',
    fontSize: 13, cursor: 'pointer',
  },
  dropZone: {
    border: '2px dashed #CBD5E1', borderRadius: 14, padding: '48px 32px',
    textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s',
  },
};

// ─── sub-components ────────────────────────────────────────────────────────
function TypeBadge({ tipo }) {
  const ti = TIPO_INFO[tipo] || { label: tipo, color: '#64748B', bg: '#F1F5F9' };
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600,
      background: ti.bg, color: ti.color, whiteSpace: 'nowrap',
    }}>{ti.label}</span>
  );
}

function ProgressBar({ value }) {
  return (
    <div style={{ width: '100%', height: 4, background: '#E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${value}%`, height: '100%', background: '#4338CA', borderRadius: 2, transition: 'width 0.35s ease' }} />
    </div>
  );
}

// ─── pantalla upload ───────────────────────────────────────────────────────
function UploadStep({ onFile }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef();

  const handleDrop = e => {
    e.preventDefault(); setOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) onFile(file);
  };

  return (
    <div>
      <div
        onClick={() => inputRef.current.click()}
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={handleDrop}
        style={{
          ...S.dropZone,
          borderColor: over ? '#4338CA' : '#CBD5E1',
          background: over ? '#EEF2FF' : 'white',
        }}
      >
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files[0]; if (f) onFile(f); }} />
        <div style={{ fontSize: 36, marginBottom: 12 }}>📷</div>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', marginBottom: 6 }}>
          Sube una foto de una página de ejercicios
        </p>
        <p style={{ fontSize: 12, color: '#94A3B8' }}>
          Haz clic o arrastra · JPG, PNG, HEIC, WebP
        </p>
      </div>
      <div style={{ marginTop: 14, padding: '10px 14px', background: '#F8FAFC', borderRadius: 10, fontSize: 12, color: '#64748B', lineHeight: 1.6 }}>
        <strong style={{ color: '#374151' }}>Tipos detectables automáticamente:</strong>{' '}
        {Object.values(TIPO_INFO).map(t => t.label).join(' · ')}
      </div>
    </div>
  );
}

// ─── pantalla preview ──────────────────────────────────────────────────────
function PreviewStep({ imgSrc, onAnalyze, onReset, loading }) {
  return (
    <div>
      <img src={imgSrc} alt="preview" style={{
        width: '100%', maxHeight: 320, objectFit: 'contain',
        borderRadius: 12, border: '1px solid #E2E8F0', display: 'block', marginBottom: 16,
      }} />
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onAnalyze} disabled={loading} style={{
          ...S.btnPrimary, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          opacity: loading ? 0.7 : 1,
        }}>
          ⚡ Extraer ejercicios con Gemini IA
        </button>
        <button onClick={onReset} style={S.btnSecondary}>Cambiar</button>
      </div>
    </div>
  );
}

// ─── pantalla loading ──────────────────────────────────────────────────────
function LoadingStep({ msg, progress }) {
  return (
    <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
      <div style={{
        width: 44, height: 44, border: '3px solid #E2E8F0', borderTopColor: '#4338CA',
        borderRadius: '50%', animation: 'spin 0.75s linear infinite', margin: '0 auto 16px',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', marginBottom: 6 }}>{msg}</p>
      <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 16 }}>La IA está leyendo y extrayendo los ejercicios</p>
      <div style={{ maxWidth: 280, margin: '0 auto' }}>
        <ProgressBar value={progress} />
      </div>
    </div>
  );
}

// ─── pantalla resultado ────────────────────────────────────────────────────
function ResultStep({ resource, onUse, onReset }) {
  const [copied, setCopied] = useState(false);
  const exs = resource.ejercicios || [];
  const total = exs.reduce((s, e) => s + (e.items?.length || 0), 0);
  const tipos = [...new Set(exs.map(e => e.tipo))];

  const copyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(resource, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const downloadJSON = () => {
    const str = JSON.stringify(resource, null, 2);
    const blob = new Blob([str], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (resource.titulo || 'resource').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* success banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 12, marginBottom: 16 }}>
        <div style={{ width: 30, height: 30, background: '#DCFCE7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669', fontWeight: 700, flexShrink: 0 }}>✓</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#15803D' }}>{exs.length} ejercicios detectados · {total} preguntas</div>
          <div style={{ fontSize: 12, color: '#166534', marginTop: 2 }}>{resource.nivel} · {resource.asignatura} · {resource.tema}</div>
        </div>
      </div>

      {/* resource card */}
      <div style={{ border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>{resource.titulo}</div>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 10 }}>{resource.descripcion}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
            <span style={{ padding: '2px 9px', background: '#EEF2FF', color: '#4338CA', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{resource.nivel}</span>
            {(resource.tags || []).slice(0, 4).map(t => (
              <span key={t} style={{ padding: '2px 9px', background: '#F1F5F9', color: '#64748B', borderRadius: 20, fontSize: 11 }}>{t}</span>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {tipos.map(t => <TypeBadge key={t} tipo={t} />)}
          </div>
        </div>

        {/* exercise list */}
        {exs.map((ex, i) => (
          <div key={ex.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: i < exs.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#64748B', flexShrink: 0 }}>{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.titulo}</div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{(ex.enunciado || '').substring(0, 65)}{ex.enunciado?.length > 65 ? '…' : ''}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
              <TypeBadge tipo={ex.tipo} />
              <span style={{ fontSize: 11, color: '#94A3B8' }}>{ex.items?.length || 0}q</span>
            </div>
          </div>
        ))}
      </div>

      {/* actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {onUse && (
          <button onClick={() => onUse(resource)} style={{ ...S.btnPrimary, flex: 1 }}>
            ▶ Abrir en Omninteractive
          </button>
        )}
        <button onClick={downloadJSON} style={S.btnSecondary}>⬇ JSON</button>
        <button onClick={copyJSON} style={S.btnSecondary}>{copied ? '¡Copiado!' : 'Copiar'}</button>
        <button onClick={onReset} style={{ ...S.btnSecondary, color: '#94A3B8' }}>Otra foto</button>
      </div>
      <p style={{ marginTop: 10, fontSize: 11, color: '#94A3B8', textAlign: 'center' }}>
        El JSON es compatible directamente con BibliotecaOmni.js
      </p>
    </div>
  );
}

// ─── pantalla error ────────────────────────────────────────────────────────
function ErrorStep({ message, onReset }) {
  return (
    <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
      <div style={{ width: 48, height: 48, background: '#FEE2E2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 20 }}>!</div>
      <p style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', marginBottom: 6 }}>Algo ha salido mal</p>
      <p style={{ fontSize: 13, color: '#64748B', marginBottom: 20, maxWidth: 360, margin: '0 auto 20px' }}>{message}</p>
      <button onClick={onReset} style={S.btnPrimary}>Volver a intentar</button>
    </div>
  );
}

// ─── paso de configuración ────────────────────────────────────────────────
const NIVELES = ['Infantil', '1 Primaria', '2 Primaria', '3 Primaria', '4 Primaria', '5 Primaria', '6 Primaria', '1 ESO', '2 ESO', '3 ESO', '4 ESO', '1 Bach', '2 Bach', 'FP', 'Universidad', 'Otros'];
const IDIOMAS = ['Español', 'English', 'Français', 'Català', 'Euskera', 'Galego', 'Deutsch', 'Italiano', 'Português', 'Otro'];

function ConfigStep({ config, setConfig, onNext }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ padding: '12px 16px', background: '#EEF2FF', borderRadius: 12, fontSize: 13, color: '#4338CA', lineHeight: 1.5 }}>
        Configura el idioma y nivel antes de analizar la imagen para que la IA genere los ejercicios correctamente.
      </div>

      <div>
        <label style={cfgLbl}>Idioma del recurso</label>
        <select style={cfgInp} value={config.idioma} onChange={e => setConfig(c => ({ ...c, idioma: e.target.value }))}>
          {IDIOMAS.map(i => <option key={i}>{i}</option>)}
        </select>
      </div>

      <div>
        <label style={cfgLbl}>Nivel educativo</label>
        <select style={cfgInp} value={config.nivel} onChange={e => setConfig(c => ({ ...c, nivel: e.target.value }))}>
          {NIVELES.map(n => <option key={n}>{n}</option>)}
        </select>
      </div>

      <div>
        <label style={cfgLbl}>Asignatura</label>
        <input style={cfgInp} value={config.asignatura} onChange={e => setConfig(c => ({ ...c, asignatura: e.target.value }))} placeholder="English, Matemáticas, Historia…" />
      </div>

      <div>
        <label style={cfgLbl}>Instrucciones extra para la IA <span style={{ fontWeight: 400, color: '#94A3B8' }}>(opcional)</span></label>
        <textarea
          style={{ ...cfgInp, height: 80, resize: 'vertical' }}
          value={config.promptExtra}
          onChange={e => setConfig(c => ({ ...c, promptExtra: e.target.value }))}
          placeholder="Ej: Presta especial atención a los tiempos verbales. Las preguntas son de tipo fill-in. Ignora el recuadro de vocabulario…"
        />
      </div>

      <button onClick={onNext} style={{ ...S.btnPrimary, alignSelf: 'flex-end', padding: '10px 28px' }}>
        Continuar →
      </button>
    </div>
  );
}

const cfgLbl = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 };
const cfgInp = {
  width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 9,
  fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};

// ─── componente principal ──────────────────────────────────────────────────
export default function FotoARecurso({ onResourceExtracted, onClose, apiKey }) {
  const [step, setStep] = useState('config');
  const [config, setConfig] = useState({ idioma: 'English', nivel: '3 ESO', asignatura: 'English', promptExtra: '' });
  const [imgData, setImgData] = useState(null);
  const [imgSrc, setImgSrc] = useState(null);
  const [resource, setResource] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [loadingMsg, setLoadingMsg] = useState('Analizando imagen…');

  const handleFile = file => {
    const reader = new FileReader();
    reader.onload = e => {
      setImgData({ b64: e.target.result.split(',')[1], mime: file.type });
      setImgSrc(e.target.result);
      setStep('preview');
    };
    reader.readAsDataURL(file);
  };

  const reset = () => {
    setStep('config'); setImgData(null); setImgSrc(null);
    setResource(null); setError(null); setProgress(0);
  };

  const analyze = async () => {
    if (!imgData) { setStep('error'); return; }
    setStep('loading'); setProgress(0);

    const prompt = buildPrompt(config);
    const msgs = ['Analizando imagen…', 'Detectando tipos de ejercicio…', 'Extrayendo preguntas…', 'Construyendo el recurso…', 'Casi listo…'];
    let mi = 0;
    const msgInterval = setInterval(() => setLoadingMsg(msgs[++mi % msgs.length]), 2200);
    const progInterval = setInterval(() => setProgress(p => Math.min(p + Math.random() * 7 + 1, 87)), 380);

    try {
      const data = await callGeminiProxy({
        model: GEMINI_MODEL,
        contents: [{ parts: [
          { text: prompt },
          { inline_data: { mime_type: imgData.mime, data: imgData.b64 } },
        ]}],
        generationConfig: { temperature: 0.1 },
      });

      clearInterval(msgInterval); clearInterval(progInterval);
      setProgress(100);

      const raw = extractText(data);
      const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const extracted = JSON.parse(clean);

      extracted.id = 'auto_' + Date.now();
      extracted.color = '#4338CA';

      setResource(extracted);
      setTimeout(() => setStep('result'), 300);

    } catch (e) {
      clearInterval(msgInterval); clearInterval(progInterval);
      setError(
        e.message.includes('JSON') ? 'No se pudo interpretar la respuesta. Prueba con una imagen más clara.' :
        e.message.includes('fetch') ? 'Error de red. Verifica tu conexión.' :
        e.message
      );
      setStep('error');
    }
  };

  const stepTitles = {
    config:  'Configurar extracción',
    upload:  'Subir imagen',
    preview: 'Vista previa',
    loading: 'Extrayendo ejercicios…',
    result:  'Recurso extraído',
    error:   'Error',
  };

  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div style={S.modal}>
        {/* header */}
        <div style={S.header}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#0F172A' }}>{stepTitles[step]}</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
              Powered by Gemini {GEMINI_MODEL} · pikt.es
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 20, color: '#94A3B8', padding: '0 4px', lineHeight: 1 }}>×</button>
        </div>

        {/* body */}
        <div style={S.body}>
          {step === 'config'   && <ConfigStep config={config} setConfig={setConfig} onNext={() => setStep('upload')} />}
          {step === 'upload'   && <UploadStep onFile={handleFile} />}
          {step === 'preview'  && <PreviewStep imgSrc={imgSrc} onAnalyze={analyze} onReset={reset} />}
          {step === 'loading'  && <LoadingStep msg={loadingMsg} progress={progress} />}
          {step === 'result'   && resource && (
            <ResultStep
              resource={resource}
              onUse={onResourceExtracted}
              onReset={reset}
            />
          )}
          {step === 'error'    && <ErrorStep message={error} onReset={reset} />}
        </div>
      </div>
    </div>
  );
}
