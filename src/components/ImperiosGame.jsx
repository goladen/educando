import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import correctSoundFile from '../assets/correct-choice-43861.mp3';
import wrongSoundFile   from '../assets/negative_beeps-6008.mp3';
import imperiosData from './imperios_historicos-v3.json';
import { guardarRegistroLocal } from '../utils/registrosLocales';

const WORLD_URL = 'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson';
let _worldCache = null;

// ── Diccionario español → inglés (nombres del world.geojson) ───────────────────
// Cubre todos los países usados en paisesActuales de los 20 imperios.
const ES_EN = {
  'Egipto':              { en: 'Egypt' },
  'Sudán':               { en: 'Sudan' },
  'Israel':              { en: 'Israel' },
  'Siria':               { en: 'Syria',          alt: 'Syrian Arab Republic' },
  'Italia':              { en: 'Italy' },
  'España':              { en: 'Spain' },
  'Francia':             { en: 'France' },
  'Grecia':              { en: 'Greece' },
  'Turquía':             { en: 'Turkey' },
  'Reino Unido':         { en: 'United Kingdom',  alt: 'Great Britain' },
  'Túnez':               { en: 'Tunisia' },
  'Perú':                { en: 'Peru' },
  'Bolivia':             { en: 'Bolivia' },
  'Ecuador':             { en: 'Ecuador' },
  'Chile':               { en: 'Chile' },
  'Argentina':           { en: 'Argentina' },
  'Colombia':            { en: 'Colombia' },
  'Mongolia':            { en: 'Mongolia' },
  'China':               { en: 'China' },
  'Rusia':               { en: 'Russia',          alt: 'Russian Federation' },
  'Corea del Sur':       { en: 'South Korea',     alt: 'Republic of Korea' },
  'Corea del Norte':     { en: 'North Korea',     alt: 'Dem. Rep. Korea' },
  'Irán':                { en: 'Iran' },
  'Irak':                { en: 'Iraq' },
  'Kazajistán':          { en: 'Kazakhstan' },
  'Ucrania':             { en: 'Ukraine' },
  'México':              { en: 'Mexico' },
  'Filipinas':           { en: 'Philippines' },
  'Cuba':                { en: 'Cuba' },
  'Guinea Ecuatorial':   { en: 'Equatorial Guinea', alt: 'Eq. Guinea' },
  'Chipre':              { en: 'Cyprus' },
  'Guatemala':           { en: 'Guatemala' },
  'Belice':              { en: 'Belize' },
  'Honduras':            { en: 'Honduras' },
  'El Salvador':         { en: 'El Salvador' },
  'Portugal':            { en: 'Portugal' },
  'Bahamas':             { en: 'Bahamas',         alt: 'The Bahamas' },
  'República Dominicana':{ en: 'Dominican Republic' },
  'Afganistán':          { en: 'Afghanistan' },
  'Pakistán':            { en: 'Pakistan' },
  'Vietnam':             { en: 'Vietnam' },
  'Arabia Saudita':      { en: 'Saudi Arabia' },
  'Arabia Saudí':        { en: 'Saudi Arabia' },
  'Hungría':             { en: 'Hungary' },
  'Bulgaria':            { en: 'Bulgaria' },
  'Jordania':            { en: 'Jordan' },
  'India':               { en: 'India' },
  'Bangladés':           { en: 'Bangladesh' },
  'Japón':               { en: 'Japan' },
  'Camboya':             { en: 'Cambodia' },
  'Tailandia':           { en: 'Thailand' },
  'Laos':                { en: 'Laos',            alt: 'Lao PDR' },
  'Canadá':              { en: 'Canada' },
  'Australia':           { en: 'Australia' },
  'Sudáfrica':           { en: 'South Africa' },
  'Estados Unidos':      { en: 'United States of America', alt: 'United States' },
  'Alemania':            { en: 'Germany' },
  'Bélgica':             { en: 'Belgium' },
  'Países Bajos':        { en: 'Netherlands' },
  'Suiza':               { en: 'Switzerland' },
};

// ── Orden y metadatos de las preguntas ─────────────────────────────────────────
const Q_KEYS = ['fechas', 'religion', 'caracteristicas', 'crecimiento', 'caida'];
const Q_META = {
  fechas:          { icon: '📅', label: '¿En qué época se desarrolló?' },
  religion:        { icon: '🛐', label: 'Religión' },
  caracteristicas: { icon: '🏛️', label: 'Características y aportes' },
  crecimiento:     { icon: '📈', label: 'Motivos de su auge' },
  caida:           { icon: '📉', label: 'Motivos de su caída' },
};

const WORLD_VIEW = { lonC: 0, latC: 20, lonSpan: 360, latSpan: 175 };

// ── Helpers ────────────────────────────────────────────────────────────────────
const shuffle = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const norm = s =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').trim();

const findFeature = (features, item) => {
  const n1 = item.nameEn || item.nombre, n2 = item.nameAlt;
  const nm1 = norm(n1), nm2 = n2 ? norm(n2) : null;
  return (
    features.find(f => f.properties?.name === n1) ||
    (n2 && features.find(f => f.properties?.name === n2)) ||
    features.find(f => norm(f.properties?.name) === nm1) ||
    (nm2 && features.find(f => norm(f.properties?.name) === nm2)) ||
    features.find(f => { const fn = norm(f.properties?.name || ''); return fn && (fn.includes(nm1) || (nm1.includes(fn) && nm1.length > 3)); }) ||
    null
  );
};

// ── Proyección equirectangular ajustada a una vista ────────────────────────────
const makeProjFromView = (lonC, latC, lonSpan, latSpan, W, H) => {
  const pad = 18;
  const cos = Math.max(0.1, Math.cos((latC * Math.PI) / 180));
  const availW = W - 2 * pad, availH = H - 2 * pad;
  const scale = Math.min(availW / (lonSpan * cos), availH / latSpan);
  const projW = lonSpan * cos * scale;
  const projH = latSpan * scale;
  const offX = pad + (availW - projW) / 2;
  const offY = pad + (availH - projH) / 2;
  const vL = lonC - lonSpan / 2;
  const vT = latC + latSpan / 2;
  return {
    fwd: (lon, lat) => ({ x: offX + (lon - vL) * cos * scale, y: offY + (vT - lat) * scale }),
    inv: (x, y)     => ({ lon: vL + (x - offX) / (cos * scale), lat: vT - (y - offY) / scale }),
    cos, scale, offX, offY,
  };
};

// Renderiza el mapa; colorOf(feature) -> {fill,stroke,lw} o null (gris por defecto)
const renderMapColored = (canvas, features, view, colorOf,
  bgColor = '#bfdbfe', grayFill = '#d8e3ec', grayStroke = '#9fb3c4') => {
  const { lonC, latC, lonSpan, latSpan } = view;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, W, H);
  const { fwd } = makeProjFromView(lonC, latC, lonSpan, latSpan, W, H);
  const drawGeom = (geom, fill, stroke, lw) => {
    ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = lw;
    const drawRing = ring => {
      if (ring.length < 2) return;
      ctx.beginPath();
      ring.forEach(([lon, lat], i) => { const { x, y } = fwd(lon, lat); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
      ctx.closePath(); ctx.fill(); ctx.stroke();
    };
    if (geom.type === 'Polygon') geom.coordinates.forEach(drawRing);
    else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(p => p.forEach(drawRing));
  };
  const special = [];
  for (const f of features) {
    const c = colorOf(f);
    if (c) { special.push([f, c]); continue; }
    drawGeom(f.geometry, grayFill, grayStroke, 0.5);
  }
  for (const [f, c] of special) drawGeom(f.geometry, c.fill, c.stroke, c.lw);
};

// ── Point in polygon (ray casting, con huecos) ─────────────────────────────────
const pointInRing = (lon, lat, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > lat) !== (yj > lat)) && (lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};
const pointInPolygon = (lon, lat, poly) => {
  if (!poly.length || !pointInRing(lon, lat, poly[0])) return false;
  for (let k = 1; k < poly.length; k++) if (pointInRing(lon, lat, poly[k])) return false;
  return true;
};
const pointInFeature = (feature, lon, lat) => {
  const g = feature.geometry;
  if (!g) return false;
  if (g.type === 'Polygon')      return pointInPolygon(lon, lat, g.coordinates);
  if (g.type === 'MultiPolygon') return g.coordinates.some(poly => pointInPolygon(lon, lat, poly));
  return false;
};

const playSound = (type) => {
  const file = type === 'CORRECT' ? correctSoundFile : wrongSoundFile;
  const audio = new Audio(file);
  audio.volume = 0.6;
  audio.play().catch(() => {});
  if (type === 'CORRECT') setTimeout(() => { audio.pause(); audio.currentTime = 0; }, 1500);
};

const inp = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: '#f1f5f9', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' };
const BG = 'linear-gradient(135deg,#3b1d0f 0%,#7c2d12 45%,#1e3a5f 100%)';

const ctrlBtn  = { width: 42, height: 42, borderRadius: 11, border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: '1.35rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, userSelect: 'none', touchAction: 'manipulation', boxShadow: '0 2px 6px rgba(0,0,0,0.35)' };
const arrowBtn = { width: 36, height: 36, borderRadius: 9, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: '0.95rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, userSelect: 'none', touchAction: 'manipulation' };

// ── Modal Enviar al profesor ───────────────────────────────────────────────────
function ModalEnviarProfe({ datos, onClose }) {
  const [codigo, setCodigo]     = useState('');
  const [nombre, setNombre]     = useState('');
  const [curso,  setCurso]      = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado,  setEnviado]  = useState(false);
  const [error,    setError]    = useState('');

  const enviar = async () => {
    const code = codigo.trim().toUpperCase();
    if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
    if (code.length < 3) { setError('Escribe el código del profesor.'); return; }
    setEnviando(true); setError('');
    try {
      const snap = await getDoc(doc(db, 'codigos_profesor', code));
      if (!snap.exists()) { setError('Código de profesor no encontrado.'); setEnviando(false); return; }
      const aciertos = datos.fase1Aciertos + datos.fase2Aciertos;
      const intentos = datos.paisesTotal + datos.preguntasTotal;
      const porcentaje = Math.round((aciertos / Math.max(1, intentos)) * 100);
      await addDoc(collection(db, 'informes_juegos'), {
        tipo: 'IMPERIOS',
        modalidad: 'Individual',
        fecha: new Date(),
        codigoProfesor: code,
        config: {
          imperio:        datos.imperio,
          paisesTotal:    datos.paisesTotal,
          fase1Aciertos:  datos.fase1Aciertos,
          fase2Aciertos:  datos.fase2Aciertos,
          preguntasTotal: datos.preguntasTotal,
        },
        jugadores: [{
          nombre:     nombre.trim(),
          curso:      curso.trim(),
          aciertos,
          intentos,
          fallos:     intentos - aciertos,
          porcentaje,
        }],
      });
      // Copia local en el dispositivo (Mis registros)
      guardarRegistroLocal('IMPERIOS', {
        titulo: datos.imperio, aciertos, intentos, porcentaje,
        nombre: nombre.trim(), curso: curso.trim(), via: 'profesor',
      });
      setEnviado(true);
    } catch (e) { setError('Error: ' + e.message); }
    setEnviando(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#1e272e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, width: '100%', maxWidth: 380, padding: '26px 28px', color: 'white', fontFamily: "'Segoe UI',sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f1c40f' }}>📤 Enviar al profesor</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
        </div>
        {enviado ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '3rem' }}>✅</div>
            <div style={{ color: '#2ecc71', fontWeight: 700 }}>¡Informe enviado!</div>
            <div style={{ color: '#aaa', fontSize: '0.88rem', marginTop: 8 }}>{datos.fase1Aciertos + datos.fase2Aciertos}/{datos.paisesTotal + datos.preguntasTotal} aciertos</div>
            <button onClick={onClose} style={{ marginTop: 16, padding: '9px 22px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: 'white' }}>Cerrar</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div><label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>Nombre y apellido</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre completo" style={inp} /></div>
            <div><label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>Curso</label>
              <input value={curso} onChange={e => setCurso(e.target.value)} placeholder="Ej: 2º ESO B" style={inp} /></div>
            <div><label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>Código del profesor</label>
              <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Ej: PROF01" maxLength={10} style={{ ...inp, letterSpacing: 2, fontWeight: 700 }} /></div>
            {error && <div style={{ color: '#e74c3c', fontSize: '0.8rem' }}>⚠ {error}</div>}
            <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer', color: 'white' }}>Cancelar</button>
              <button onClick={enviar} disabled={enviando} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: enviando ? '#555' : 'linear-gradient(135deg,#3498db,#2980b9)', color: 'white', fontWeight: 700, cursor: enviando ? 'default' : 'pointer' }}>
                {enviando ? 'Enviando…' : '📤 Enviar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modal de información ───────────────────────────────────────────────────────
function ModalInfo({ onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#1e272e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, width: '100%', maxWidth: 440, padding: '24px 26px', color: '#e9eef2', fontFamily: "'Segoe UI',sans-serif", maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f59e0b' }}>🏛️ Imperios de la Historia</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.3rem' }}>✕</button>
        </div>
        <div style={{ fontSize: '0.92rem', lineHeight: 1.5 }}>
          <p style={{ marginTop: 0 }}>Repasa los grandes imperios y civilizaciones que se estudian en Primaria, ESO y Bachillerato, ordenados por relevancia histórica.</p>
          <p style={{ fontWeight: 700, color: '#fcd34d', margin: '14px 0 4px' }}>1️⃣ Fase del mapa</p>
          <p style={{ margin: '0 0 8px' }}>Elige un imperio (o uno al azar) y <b>pulsa en el mapa todos los países actuales</b> que coincidían, al menos en parte, con su extensión. Cuando termines, pulsa <b>Comprobar</b>: verás los aciertos en verde, los errores en rojo y los que te faltaron en azul.</p>
          <p style={{ fontWeight: 700, color: '#fcd34d', margin: '14px 0 4px' }}>2️⃣ Fase de preguntas</p>
          <p style={{ margin: '0 0 8px' }}>Responde 5 preguntas sobre el imperio: época, religión, características y aportes a la ciencia y la cultura, motivos de su auge y motivos de su caída.</p>
          <p style={{ fontWeight: 700, color: '#fcd34d', margin: '14px 0 4px' }}>📊 Resultados</p>
          <p style={{ margin: 0 }}>Al acabar puedes <b>guardar tu partida en este dispositivo</b> (aparecerá en «Mis registros») y <b>enviar el resultado a tu profesor</b> con su código.</p>
        </div>
        <button onClick={onClose} style={{ marginTop: 18, width: '100%', padding: '11px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: 'white', fontWeight: 800, cursor: 'pointer' }}>¡Entendido!</button>
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function ImperiosGame({ onBack }) {
  const [pantalla,    setPantalla]    = useState('intro');   // intro | mapa | quiz | resultado
  const [worldFeats,  setWorldFeats]  = useState(_worldCache);
  const [cargando,    setCargando]    = useState(false);

  const [imperio,     setImperio]     = useState(null);
  const [targetFeats, setTargetFeats] = useState([]);
  const [paisesNoEncontrados, setPaisesNoEncontrados] = useState([]);
  const [selectedFeats, setSelectedFeats] = useState([]);
  const [revealed,    setRevealed]    = useState(false);
  const [fase1Score,  setFase1Score]  = useState(0);
  const [zoomed,      setZoomed]      = useState(false);

  const [preguntas,   setPreguntas]   = useState([]);
  const [qIdx,        setQIdx]        = useState(0);
  const [qSelected,   setQSelected]   = useState(null);
  const [qFase,       setQFase]       = useState('jugando'); // jugando | feedback
  const [fase2Score,  setFase2Score]  = useState(0);

  const [modalEnviar, setModalEnviar] = useState(false);
  const [infoOpen,    setInfoOpen]    = useState(false);
  const [guardadoLocal, setGuardadoLocal] = useState(false);

  const canvasRef    = useRef(null);
  const viewRef      = useRef({ ...WORLD_VIEW });
  const baseViewRef  = useRef({ ...WORLD_VIEW });
  const isPanRef     = useRef(false);
  const movedRef     = useRef(false);
  const panStartRef  = useRef(null);
  const downRef      = useRef(null);
  const lastTouchRef = useRef(null);

  // Carga del mapa mundial
  useEffect(() => {
    if (_worldCache) { setWorldFeats(_worldCache); return; }
    setCargando(true);
    fetch(WORLD_URL).then(r => r.json()).then(d => {
      _worldCache = d.features;
      setWorldFeats(_worldCache);
      setCargando(false);
    }).catch(() => setCargando(false));
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !worldFeats) return;
    const targetSet   = new Set(targetFeats);
    const selectedSet = new Set(selectedFeats);
    renderMapColored(canvas, worldFeats, viewRef.current, (f) => {
      const isT = targetSet.has(f), isS = selectedSet.has(f);
      if (!revealed) {
        if (isS) return { fill: '#f59e0b', stroke: '#b45309', lw: 1.2 };
        return null;
      }
      if (isT && isS)  return { fill: '#22c55e', stroke: '#15803d', lw: 1.2 };  // acierto
      if (isT && !isS) return { fill: '#93c5fd', stroke: '#1d4ed8', lw: 2 };    // se olvidó
      if (!isT && isS) return { fill: '#ef4444', stroke: '#991b1b', lw: 1.2 };  // fallo
      return null;
    });
  }, [worldFeats, targetFeats, selectedFeats, revealed]);

  useEffect(() => { if (pantalla === 'mapa') redraw(); }, [pantalla, redraw]);

  // ── Zoom rueda ───────────────────────────────────────────────────────────────
  const canvasToGeo = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const { lonC, latC, lonSpan, latSpan } = viewRef.current;
    const W = canvas.width, H = canvas.height;
    const { inv } = makeProjFromView(lonC, latC, lonSpan, latSpan, W, H);
    const rect = canvas.getBoundingClientRect();
    return inv((clientX - rect.left) * (W / rect.width), (clientY - rect.top) * (H / rect.height));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = e => {
      e.preventDefault();
      const { lonC: oL, latC: oA, lonSpan, latSpan } = viewRef.current;
      const factor = e.deltaY < 0 ? 0.78 : 1.28;
      const newLS = Math.max(4, Math.min(360, lonSpan * factor));
      const newAS = Math.max(2, Math.min(180, latSpan * factor));
      const geo = canvasToGeo(e.clientX, e.clientY);
      let nL = oL, nA = oA;
      if (geo) {
        const W = canvas.width, H = canvas.height;
        const rect = canvas.getBoundingClientRect();
        const fx = ((e.clientX - rect.left) * (W / rect.width)) / W;
        const fy = ((e.clientY - rect.top) * (H / rect.height)) / H;
        nL = geo.lon - (fx - 0.5) * newLS;
        nA = geo.lat + (fy - 0.5) * newAS;
      }
      viewRef.current = { lonC: nL, latC: nA, lonSpan: newLS, latSpan: newAS };
      setZoomed(true);
      redraw();
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [canvasToGeo, redraw, pantalla]);

  // ── Clic / selección de país ─────────────────────────────────────────────────
  const handleMapClick = useCallback((clientX, clientY) => {
    if (revealed || !worldFeats) return;
    const geo = canvasToGeo(clientX, clientY);
    if (!geo) return;
    const f = worldFeats.find(ft => pointInFeature(ft, geo.lon, geo.lat));
    if (!f) return;
    setSelectedFeats(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
  }, [revealed, worldFeats, canvasToGeo]);

  // ── Pan ──────────────────────────────────────────────────────────────────────
  const onMouseDown = useCallback(e => {
    if (e.button !== 0) return;
    isPanRef.current = true;
    movedRef.current = false;
    downRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, ...viewRef.current };
  }, []);

  const onMouseMove = useCallback(e => {
    if (!isPanRef.current || !panStartRef.current) return;
    if (Math.hypot(e.clientX - downRef.current.x, e.clientY - downRef.current.y) > 5) movedRef.current = true;
    const { mouseX, mouseY, lonC, latC, lonSpan, latSpan } = panStartRef.current;
    const canvas = canvasRef.current; if (!canvas) return;
    const W = canvas.width, H = canvas.height;
    const rect = canvas.getBoundingClientRect();
    const { cos, scale } = makeProjFromView(lonC, latC, lonSpan, latSpan, W, H);
    const dx = (e.clientX - mouseX) * (W / rect.width);
    const dy = (e.clientY - mouseY) * (H / rect.height);
    viewRef.current = { lonC: lonC - dx / (cos * scale), latC: latC + dy / scale, lonSpan, latSpan };
    setZoomed(true);
    redraw();
  }, [redraw]);

  const onMouseUp = useCallback(e => {
    if (isPanRef.current && !movedRef.current && downRef.current) handleMapClick(e.clientX, e.clientY);
    isPanRef.current = false;
  }, [handleMapClick]);

  const onTouchStart = useCallback(e => {
    if (e.touches.length === 1) {
      isPanRef.current = true;
      movedRef.current = false;
      downRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      panStartRef.current = { mouseX: e.touches[0].clientX, mouseY: e.touches[0].clientY, ...viewRef.current };
    } else if (e.touches.length === 2) {
      isPanRef.current = false;
      lastTouchRef.current = [{ x: e.touches[0].clientX, y: e.touches[0].clientY }, { x: e.touches[1].clientX, y: e.touches[1].clientY }];
    }
  }, []);

  const onTouchMove = useCallback(e => {
    e.preventDefault();
    if (e.touches.length === 1 && isPanRef.current && panStartRef.current) {
      if (Math.hypot(e.touches[0].clientX - downRef.current.x, e.touches[0].clientY - downRef.current.y) > 6) movedRef.current = true;
      const { mouseX, mouseY, lonC, latC, lonSpan, latSpan } = panStartRef.current;
      const canvas = canvasRef.current; if (!canvas) return;
      const W = canvas.width, H = canvas.height;
      const rect = canvas.getBoundingClientRect();
      const { cos, scale } = makeProjFromView(lonC, latC, lonSpan, latSpan, W, H);
      const dx = (e.touches[0].clientX - mouseX) * (W / rect.width);
      const dy = (e.touches[0].clientY - mouseY) * (H / rect.height);
      viewRef.current = { lonC: lonC - dx / (cos * scale), latC: latC + dy / scale, lonSpan, latSpan };
      setZoomed(true);
      redraw();
    } else if (e.touches.length === 2 && lastTouchRef.current) {
      const prev = lastTouchRef.current;
      const cur = [{ x: e.touches[0].clientX, y: e.touches[0].clientY }, { x: e.touches[1].clientX, y: e.touches[1].clientY }];
      const prevDist = Math.hypot(prev[1].x - prev[0].x, prev[1].y - prev[0].y);
      const curDist  = Math.hypot(cur[1].x - cur[0].x, cur[1].y - cur[0].y);
      if (prevDist > 0) {
        const fc = prevDist / curDist;
        const { lonSpan, latSpan } = viewRef.current;
        viewRef.current = { ...viewRef.current, lonSpan: Math.max(4, Math.min(360, lonSpan * fc)), latSpan: Math.max(2, Math.min(180, latSpan * fc)) };
        setZoomed(true);
        redraw();
      }
      lastTouchRef.current = cur;
    }
  }, [redraw]);

  const onTouchEnd = useCallback(e => {
    if (isPanRef.current && !movedRef.current && downRef.current && e.changedTouches?.length) {
      handleMapClick(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    }
    isPanRef.current = false;
    lastTouchRef.current = null;
  }, [handleMapClick]);

  const resetView = useCallback(() => {
    viewRef.current = { ...baseViewRef.current };
    setZoomed(false);
    redraw();
  }, [redraw]);

  // Zoom con botón (alrededor del centro de la vista)
  const zoomBy = useCallback((factor) => {
    const v = viewRef.current;
    viewRef.current = {
      ...v,
      lonSpan: Math.max(4, Math.min(360, v.lonSpan * factor)),
      latSpan: Math.max(2, Math.min(180, v.latSpan * factor)),
    };
    setZoomed(true);
    redraw();
  }, [redraw]);

  // Desplazar con flechas (fracción del ancho/alto visible)
  const panBy = useCallback((dxFrac, dyFrac) => {
    const v = viewRef.current;
    viewRef.current = { ...v, lonC: v.lonC + dxFrac * v.lonSpan, latC: v.latC + dyFrac * v.latSpan };
    setZoomed(true);
    redraw();
  }, [redraw]);

  // ── Empezar imperio ──────────────────────────────────────────────────────────
  const empezarImperio = (imp) => {
    if (!worldFeats) return;
    const feats = [];
    const noEnc = [];
    (imp.paisesActuales || []).forEach(nombreEs => {
      const m = ES_EN[nombreEs];
      const item = m ? { nombre: nombreEs, nameEn: m.en, nameAlt: m.alt } : { nombre: nombreEs };
      const f = findFeature(worldFeats, item);
      if (f) { if (!feats.includes(f)) feats.push(f); }
      else noEnc.push(nombreEs);
    });
    setImperio(imp);
    setTargetFeats(feats);
    setPaisesNoEncontrados(noEnc);
    setSelectedFeats([]);
    setRevealed(false);
    setFase1Score(0);
    setZoomed(false);
    viewRef.current = { ...WORLD_VIEW };
    baseViewRef.current = { ...WORLD_VIEW };
    setPreguntas(Q_KEYS.filter(k => imp[k]?.opciones?.length).map(k => ({
      key: k,
      pregunta: imp[k].pregunta,
      opciones: shuffle(imp[k].opciones),
    })));
    setQIdx(0);
    setQSelected(null);
    setQFase('jugando');
    setFase2Score(0);
    setGuardadoLocal(false);
    setPantalla('mapa');
  };

  const comprobar = () => {
    const targetSet = new Set(targetFeats);
    let correct = 0;
    selectedFeats.forEach(f => { if (targetSet.has(f)) correct++; });
    setFase1Score(correct);
    setRevealed(true);
    playSound(correct >= Math.ceil(targetFeats.length / 2) ? 'CORRECT' : 'WRONG');
  };

  const responder = (op) => {
    if (qFase !== 'jugando') return;
    const correct = !!op.correcta;
    playSound(correct ? 'CORRECT' : 'WRONG');
    if (correct) setFase2Score(s => s + 1);
    setQSelected(op);
    setQFase('feedback');
    setTimeout(() => {
      const next = qIdx + 1;
      if (next >= preguntas.length) { setPantalla('resultado'); return; }
      setQIdx(next);
      setQSelected(null);
      setQFase('jugando');
    }, 1500);
  };

  // ── INTRO ──────────────────────────────────────────────────────────────────
  if (pantalla === 'intro') {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px 40px', fontFamily: 'sans-serif' }}>
        <button onClick={onBack} style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: '0.9rem' }}>← Volver</button>
        <button onClick={() => setInfoOpen(true)} title="¿Cómo se juega?" style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: '50%', width: 38, height: 38, cursor: 'pointer', fontSize: '1.1rem', fontWeight: 900 }}>ℹ️</button>

        {infoOpen && <ModalInfo onClose={() => setInfoOpen(false)} />}

        <div style={{ marginTop: 30, textAlign: 'center', maxWidth: 640, width: '100%' }}>
          <div style={{ fontSize: 54 }}>🏛️</div>
          <h1 style={{ color: 'white', margin: '4px 0 4px', fontSize: '1.9rem', fontWeight: 900 }}>Imperios de la Historia</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', margin: '0 0 8px', fontSize: '0.95rem' }}>
            1️⃣ Localiza en el mapa los países que abarcó el imperio · 2️⃣ Responde sobre su historia
          </p>

          {cargando && <p style={{ color: '#fcd34d', fontSize: '0.85rem' }}>🌍 Cargando mapa del mundo…</p>}

          <button
            onClick={() => empezarImperio(imperiosData[Math.floor(Math.random() * imperiosData.length)])}
            disabled={!worldFeats}
            style={{ marginTop: 8, marginBottom: 18, padding: '13px 26px', borderRadius: 14, border: 'none', cursor: worldFeats ? 'pointer' : 'wait',
              background: worldFeats ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 900, fontSize: '1rem', boxShadow: '0 6px 18px rgba(0,0,0,0.3)' }}>
            🎲 Imperio aleatorio
          </button>

          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem', margin: '4px 0 10px', fontWeight: 600 }}>o elige uno concreto:</div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10 }}>
            {imperiosData.map((imp, i) => (
              <button key={imp.id} onClick={() => empezarImperio(imp)} disabled={!worldFeats}
                style={{ padding: '12px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'white', cursor: worldFeats ? 'pointer' : 'wait', textAlign: 'left', fontSize: '0.9rem', fontWeight: 600, transition: 'background .12s', display: 'flex', alignItems: 'center', gap: 8 }}
                onMouseEnter={e => { if (worldFeats) e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: '0.78rem', minWidth: 18 }}>{i + 1}</span>
                {imp.nombre}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── MAPA ─────────────────────────────────────────────────────────────────────
  if (pantalla === 'mapa') {
    const objetivo = targetFeats.length;
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 16, fontFamily: 'sans-serif' }}>
        <div style={{ width: '100%', maxWidth: 620, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <button onClick={() => setPantalla('intro')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: 'white', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: '0.8rem' }}>← Imperios</button>
          <span style={{ color: 'white', fontWeight: 800, fontSize: '0.95rem' }}>🏛️ {imperio?.nombre}</span>
          <span style={{ color: revealed ? '#86efac' : 'rgba(255,255,255,0.65)', fontSize: '0.82rem', fontWeight: 700 }}>
            {revealed ? `${fase1Score}/${objetivo}` : `${selectedFeats.length} / ${objetivo}`}
          </span>
        </div>

        <div style={{ width: '100%', maxWidth: 620, textAlign: 'center', marginBottom: 8 }}>
          <span style={{ background: 'rgba(255,255,255,0.12)', color: 'white', borderRadius: 20, padding: '6px 16px', fontSize: '0.86rem', fontWeight: 600 }}>
            {revealed
              ? '✅ Verde = acierto · 🔴 Rojo = error · 🔵 Azul = te faltó'
              : `🗺️ Pulsa los ${objetivo} países actuales que abarcó este imperio`}
          </span>
        </div>

        <div style={{ position: 'relative', width: '100%', maxWidth: 620, marginBottom: 14, borderRadius: 18, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', cursor: isPanRef.current ? 'grabbing' : 'pointer' }}>
          <canvas ref={canvasRef} width={620} height={400}
            style={{ display: 'block', width: '100%', height: 'auto', userSelect: 'none', touchAction: 'none' }}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={() => { isPanRef.current = false; }}
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
          />
          {/* Controles de zoom */}
          <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={() => zoomBy(0.7)}  style={ctrlBtn} title="Acercar">＋</button>
            <button onClick={() => zoomBy(1.4)}  style={ctrlBtn} title="Alejar">－</button>
            <button onClick={resetView} style={{ ...ctrlBtn, fontSize: '1.05rem' }} title="Restablecer vista">⟳</button>
          </div>

          {/* Cruceta de desplazamiento */}
          <div style={{ position: 'absolute', bottom: 10, right: 10, display: 'grid', gridTemplateColumns: 'repeat(3,36px)', gridTemplateRows: 'repeat(3,36px)', gap: 3 }}>
            <span />
            <button onClick={() => panBy(0, 0.2)}  style={arrowBtn} title="Arriba">▲</button>
            <span />
            <button onClick={() => panBy(-0.2, 0)} style={arrowBtn} title="Izquierda">◀</button>
            <span />
            <button onClick={() => panBy(0.2, 0)}  style={arrowBtn} title="Derecha">▶</button>
            <span />
            <button onClick={() => panBy(0, -0.2)} style={arrowBtn} title="Abajo">▼</button>
            <span />
          </div>
        </div>

        {revealed && paisesNoEncontrados.length > 0 && (
          <div style={{ width: '100%', maxWidth: 620, color: 'rgba(255,255,255,0.55)', fontSize: '0.74rem', textAlign: 'center', marginBottom: 8 }}>
            ⚠ No localizables en este mapa: {paisesNoEncontrados.join(', ')}
          </div>
        )}

        <div style={{ width: '100%', maxWidth: 620 }}>
          {!revealed ? (
            <button onClick={comprobar} disabled={selectedFeats.length === 0}
              style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', cursor: selectedFeats.length ? 'pointer' : 'not-allowed', background: selectedFeats.length ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'rgba(255,255,255,0.15)', color: 'white', fontWeight: 900, fontSize: '1rem' }}>
              ✔ Comprobar
            </button>
          ) : (
            <button onClick={() => setPantalla('quiz')}
              style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#2563eb,#1e40af)', color: 'white', fontWeight: 900, fontSize: '1rem' }}>
              Continuar a las preguntas →
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── QUIZ ─────────────────────────────────────────────────────────────────────
  if (pantalla === 'quiz') {
    const q = preguntas[qIdx];
    const meta = q ? Q_META[q.key] : null;
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 16, fontFamily: 'sans-serif' }}>
        <div style={{ width: '100%', maxWidth: 620, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ color: 'white', fontWeight: 800, fontSize: '0.95rem' }}>🏛️ {imperio?.nombre}</span>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem' }}>Pregunta {qIdx + 1}/{preguntas.length}</span>
        </div>

        <div style={{ width: '100%', maxWidth: 620, display: 'flex', gap: 4, marginBottom: 16 }}>
          {preguntas.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < qIdx ? '#22c55e' : i === qIdx ? '#f59e0b' : 'rgba(255,255,255,0.14)' }} />
          ))}
        </div>

        {q && (
          <div style={{ width: '100%', maxWidth: 620, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 18, padding: '22px 20px', marginBottom: 16 }}>
            <div style={{ color: '#fcd34d', fontSize: '0.78rem', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>{meta?.icon} {meta?.label}</div>
            <div style={{ color: 'white', fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.4 }}>{q.pregunta}</div>
          </div>
        )}

        <div style={{ width: '100%', maxWidth: 620, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {q?.opciones.map((op, i) => {
            let bg = 'rgba(255,255,255,0.09)', border = 'rgba(255,255,255,0.18)';
            if (qFase === 'feedback') {
              if (op.correcta) { bg = 'rgba(34,197,94,0.85)'; border = '#15803d'; }
              else if (op === qSelected) { bg = 'rgba(239,68,68,0.85)'; border = '#991b1b'; }
            }
            return (
              <button key={i} onClick={() => responder(op)} disabled={qFase === 'feedback'}
                style={{ textAlign: 'left', padding: '14px 16px', borderRadius: 12, border: `2px solid ${border}`, background: bg, color: 'white', fontWeight: 600, fontSize: '0.95rem', cursor: qFase === 'jugando' ? 'pointer' : 'default', lineHeight: 1.35, transition: 'background .12s' }}
                onMouseEnter={e => { if (qFase === 'jugando') e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
                onMouseLeave={e => { if (qFase === 'jugando') e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; }}>
                {op.texto}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── RESULTADO ────────────────────────────────────────────────────────────────
  const totalAciertos = fase1Score + fase2Score;
  const totalIntentos = targetFeats.length + preguntas.length;
  const pct = Math.round((totalAciertos / Math.max(1, totalIntentos)) * 100);
  const pctColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'sans-serif' }}>
      <div style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 24, padding: '32px 28px', maxWidth: 460, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 52 }}>{pct >= 80 ? '🏆' : pct >= 50 ? '🎖️' : '📜'}</div>
        <h2 style={{ color: 'white', margin: '6px 0 2px', fontSize: '1.5rem', fontWeight: 900 }}>{imperio?.nombre}</h2>
        <div style={{ color: pctColor, fontSize: '2.6rem', fontWeight: 900, margin: '6px 0' }}>{pct}%</div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', margin: '14px 0 20px' }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 8px' }}>
            <div style={{ fontSize: '1.4rem' }}>🗺️</div>
            <div style={{ color: 'white', fontWeight: 800, fontSize: '1.1rem' }}>{fase1Score}/{targetFeats.length}</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.74rem' }}>Países</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 8px' }}>
            <div style={{ fontSize: '1.4rem' }}>❓</div>
            <div style={{ color: 'white', fontWeight: 800, fontSize: '1.1rem' }}>{fase2Score}/{preguntas.length}</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.74rem' }}>Preguntas</div>
          </div>
        </div>

        <button
          onClick={() => {
            guardarRegistroLocal('IMPERIOS', { titulo: imperio?.nombre, aciertos: totalAciertos, intentos: totalIntentos, porcentaje: pct, via: 'guardado' });
            setGuardadoLocal(true);
          }}
          disabled={guardadoLocal}
          style={{ width: '100%', padding: '13px', borderRadius: 14, border: 'none', cursor: guardadoLocal ? 'default' : 'pointer', background: guardadoLocal ? 'rgba(34,197,94,0.25)' : 'linear-gradient(135deg,#16a34a,#15803d)', color: 'white', fontWeight: 800, fontSize: '0.95rem', marginBottom: 10 }}>
          {guardadoLocal ? '✅ Guardado en este dispositivo' : '💾 Guardar en el dispositivo'}
        </button>
        <button onClick={() => setModalEnviar(true)}
          style={{ width: '100%', padding: '13px', borderRadius: 14, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#f1c40f,#e67e22)', color: 'white', fontWeight: 800, fontSize: '0.95rem', marginBottom: 10 }}>
          📤 Enviar al profesor
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setPantalla('intro')} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '2px solid rgba(255,255,255,0.25)', background: 'transparent', color: 'white', fontWeight: 700, cursor: 'pointer' }}>🔄 Otro imperio</button>
          <button onClick={onBack} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.12)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Salir</button>
        </div>
      </div>

      {modalEnviar && (
        <ModalEnviarProfe
          datos={{
            imperio: imperio?.nombre,
            paisesTotal: targetFeats.length,
            fase1Aciertos: fase1Score,
            fase2Aciertos: fase2Score,
            preguntasTotal: preguntas.length,
          }}
          onClose={() => setModalEnviar(false)}
        />
      )}
    </div>
  );
}
