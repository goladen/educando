import { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../firebase';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';

// ─── SONIDOS (Web Audio API) ──────────────────────────────────────────────────
function playOk() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523, ctx.currentTime);
    osc.frequency.setValueAtTime(659, ctx.currentTime + 0.08);
    osc.frequency.setValueAtTime(784, ctx.currentTime + 0.16);
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.start(); osc.stop(ctx.currentTime + 0.45);
  } catch {}
}
function playFail() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(130, ctx.currentTime + 0.35);
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(); osc.stop(ctx.currentTime + 0.4);
  } catch {}
}

// ─── CATEGORÍAS ───────────────────────────────────────────────────────────────
const CAT = {
  'alkali':      { label: 'Metal alcalino',          color: '#ef4444' },
  'alkaline':    { label: 'Metal alcalinotérreo',     color: '#f97316' },
  'transition':  { label: 'Metal de transición',     color: '#eab308' },
  'post':        { label: 'Metal post-transición',   color: '#84cc16' },
  'metalloid':   { label: 'Metaloide',               color: '#22c55e' },
  'nonmetal':    { label: 'No metal',                color: '#06b6d4' },
  'halogen':     { label: 'Halógeno',                color: '#8b5cf6' },
  'noble':       { label: 'Gas noble',               color: '#ec4899' },
  'lanthanide':  { label: 'Lantánido',               color: '#f59e0b' },
  'actinide':    { label: 'Actínido',                color: '#64748b' },
};

// ─── ELEMENTOS (row=período, col=grupo 1-18) ──────────────────────────────────
// z=protones, n=neutrones isotopo más común, masa=u.m.a., val=electrones de valencia
const EL = {
  H:  { name:'Hidrógeno',   z:1,   n:0,   masa:1.008,   cat:'nonmetal',  val:1, row:1, col:1  },
  He: { name:'Helio',       z:2,   n:2,   masa:4.003,   cat:'noble',     val:2, row:1, col:18 },
  Li: { name:'Litio',       z:3,   n:4,   masa:6.941,   cat:'alkali',    val:1, row:2, col:1  },
  Be: { name:'Berilio',     z:4,   n:5,   masa:9.012,   cat:'alkaline',  val:2, row:2, col:2  },
  B:  { name:'Boro',        z:5,   n:6,   masa:10.81,   cat:'metalloid', val:3, row:2, col:13 },
  C:  { name:'Carbono',     z:6,   n:6,   masa:12.011,  cat:'nonmetal',  val:4, row:2, col:14 },
  N:  { name:'Nitrógeno',   z:7,   n:7,   masa:14.007,  cat:'nonmetal',  val:5, row:2, col:15 },
  O:  { name:'Oxígeno',     z:8,   n:8,   masa:15.999,  cat:'nonmetal',  val:6, row:2, col:16 },
  F:  { name:'Flúor',       z:9,   n:10,  masa:18.998,  cat:'halogen',   val:7, row:2, col:17 },
  Ne: { name:'Neón',        z:10,  n:10,  masa:20.180,  cat:'noble',     val:8, row:2, col:18 },
  Na: { name:'Sodio',       z:11,  n:12,  masa:22.990,  cat:'alkali',    val:1, row:3, col:1  },
  Mg: { name:'Magnesio',    z:12,  n:12,  masa:24.305,  cat:'alkaline',  val:2, row:3, col:2  },
  Al: { name:'Aluminio',    z:13,  n:14,  masa:26.982,  cat:'post',      val:3, row:3, col:13 },
  Si: { name:'Silicio',     z:14,  n:14,  masa:28.085,  cat:'metalloid', val:4, row:3, col:14 },
  P:  { name:'Fósforo',     z:15,  n:16,  masa:30.974,  cat:'nonmetal',  val:5, row:3, col:15 },
  S:  { name:'Azufre',      z:16,  n:16,  masa:32.06,   cat:'nonmetal',  val:6, row:3, col:16 },
  Cl: { name:'Cloro',       z:17,  n:18,  masa:35.45,   cat:'halogen',   val:7, row:3, col:17 },
  Ar: { name:'Argón',       z:18,  n:22,  masa:39.948,  cat:'noble',     val:8, row:3, col:18 },
  K:  { name:'Potasio',     z:19,  n:20,  masa:39.098,  cat:'alkali',    val:1, row:4, col:1  },
  Ca: { name:'Calcio',      z:20,  n:20,  masa:40.078,  cat:'alkaline',  val:2, row:4, col:2  },
  Sc: { name:'Escandio',    z:21,  n:24,  masa:44.956,  cat:'transition',val:2, row:4, col:3  },
  Ti: { name:'Titanio',     z:22,  n:26,  masa:47.867,  cat:'transition',val:2, row:4, col:4  },
  V:  { name:'Vanadio',     z:23,  n:28,  masa:50.942,  cat:'transition',val:2, row:4, col:5  },
  Cr: { name:'Cromo',       z:24,  n:28,  masa:51.996,  cat:'transition',val:1, row:4, col:6  },
  Mn: { name:'Manganeso',   z:25,  n:30,  masa:54.938,  cat:'transition',val:2, row:4, col:7  },
  Fe: { name:'Hierro',      z:26,  n:30,  masa:55.845,  cat:'transition',val:2, row:4, col:8  },
  Co: { name:'Cobalto',     z:27,  n:32,  masa:58.933,  cat:'transition',val:2, row:4, col:9  },
  Ni: { name:'Níquel',      z:28,  n:30,  masa:58.693,  cat:'transition',val:2, row:4, col:10 },
  Cu: { name:'Cobre',       z:29,  n:34,  masa:63.546,  cat:'transition',val:1, row:4, col:11 },
  Zn: { name:'Zinc',        z:30,  n:34,  masa:65.38,   cat:'transition',val:2, row:4, col:12 },
  Ga: { name:'Galio',       z:31,  n:39,  masa:69.723,  cat:'post',      val:3, row:4, col:13 },
  Ge: { name:'Germanio',    z:32,  n:40,  masa:72.630,  cat:'metalloid', val:4, row:4, col:14 },
  As: { name:'Arsénico',    z:33,  n:42,  masa:74.922,  cat:'metalloid', val:5, row:4, col:15 },
  Se: { name:'Selenio',     z:34,  n:46,  masa:78.971,  cat:'nonmetal',  val:6, row:4, col:16 },
  Br: { name:'Bromo',       z:35,  n:44,  masa:79.904,  cat:'halogen',   val:7, row:4, col:17 },
  Kr: { name:'Kriptón',     z:36,  n:48,  masa:83.798,  cat:'noble',     val:8, row:4, col:18 },
  Rb: { name:'Rubidio',     z:37,  n:48,  masa:85.468,  cat:'alkali',    val:1, row:5, col:1  },
  Sr: { name:'Estroncio',   z:38,  n:50,  masa:87.62,   cat:'alkaline',  val:2, row:5, col:2  },
  Y:  { name:'Itrio',       z:39,  n:50,  masa:88.906,  cat:'transition',val:2, row:5, col:3  },
  Zr: { name:'Circonio',    z:40,  n:51,  masa:91.224,  cat:'transition',val:2, row:5, col:4  },
  Mo: { name:'Molibdeno',   z:42,  n:53,  masa:95.95,   cat:'transition',val:1, row:5, col:6  },
  Ag: { name:'Plata',       z:47,  n:60,  masa:107.868, cat:'transition',val:1, row:5, col:11 },
  Cd: { name:'Cadmio',      z:48,  n:64,  masa:112.414, cat:'transition',val:2, row:5, col:12 },
  Sn: { name:'Estaño',      z:50,  n:69,  masa:118.710, cat:'post',      val:4, row:5, col:14 },
  I:  { name:'Yodo',        z:53,  n:74,  masa:126.904, cat:'halogen',   val:7, row:5, col:17 },
  Xe: { name:'Xenón',       z:54,  n:77,  masa:131.293, cat:'noble',     val:8, row:5, col:18 },
  Cs: { name:'Cesio',       z:55,  n:78,  masa:132.905, cat:'alkali',    val:1, row:6, col:1  },
  Ba: { name:'Bario',       z:56,  n:81,  masa:137.327, cat:'alkaline',  val:2, row:6, col:2  },
  W:  { name:'Wolframio',   z:74,  n:110, masa:183.84,  cat:'transition',val:2, row:6, col:6  },
  Pt: { name:'Platino',     z:78,  n:117, masa:195.084, cat:'transition',val:1, row:6, col:10 },
  Au: { name:'Oro',         z:79,  n:118, masa:196.967, cat:'transition',val:1, row:6, col:11 },
  Hg: { name:'Mercurio',    z:80,  n:120, masa:200.592, cat:'transition',val:2, row:6, col:12 },
  Pb: { name:'Plomo',       z:82,  n:125, masa:207.2,   cat:'post',      val:4, row:6, col:14 },
  Bi: { name:'Bismuto',     z:83,  n:126, masa:208.980, cat:'post',      val:5, row:6, col:15 },
  Ra: { name:'Radio',       z:88,  n:138, masa:226.025, cat:'alkaline',  val:2, row:7, col:2  },
  U:  { name:'Uranio',      z:92,  n:146, masa:238.029, cat:'actinide',  val:2, row:10,col:6  },
};

// ─── 30 PREGUNTAS ─────────────────────────────────────────────────────────────
const ALL_Q = [
  { q:'¿Cuántos protones tiene el Carbono (C)?', opts:['4','6','8','12'], ans:1, exp:'Z=6 para el C. El número atómico Z es siempre igual al número de protones.' },
  { q:'¿Cuál es la masa atómica aproximada del Oxígeno?', opts:['8 u.m.a.','12 u.m.a.','16 u.m.a.','32 u.m.a.'], ans:2, exp:'O tiene 8p+8n = 16 u.m.a.' },
  { q:'¿Cuántos electrones tiene el Helio en estado neutro?', opts:['1','2','3','4'], ans:1, exp:'En átomo neutro, e⁻ = Z = 2.' },
  { q:'¿Qué partícula subatómica no tiene carga eléctrica?', opts:['Protón','Electrón','Neutrón','Positrón'], ans:2, exp:'El neutrón es neutro. Descubierto por Chadwick (1932).' },
  { q:'El isótopo C-12 tiene 6 protones. ¿Cuántos neutrones tiene?', opts:['4','5','6','8'], ans:2, exp:'n = A − Z = 12 − 6 = 6.' },
  { q:'¿Qué partícula define el número atómico Z?', opts:['Electrón','Neutrón','Protón','Quark'], ans:2, exp:'Z = número de protones. Determina qué elemento es.' },
  { q:'¿Cuál es la masa aproximada de un protón en u.m.a.?', opts:['0.00054','0.511','1.007','2.014'], ans:2, exp:'Protón ≈ 1.007 u.m.a. Electrón ≈ 0.00054 u.m.a. (1836× menor).' },
  { q:'¿Cuántos protones tiene el Hierro (Fe)?', opts:['18','26','29','56'], ans:1, exp:'Z(Fe)=26. El 56 es su número de masa A, no Z.' },
  { q:'La masa del electrón respecto al protón es aproximadamente:', opts:['Igual','10× menor','200× menor','1836× menor'], ans:3, exp:'mp/me ≈ 1836.' },
  { q:'El Litio tiene Z=3. ¿Cuántos neutrones tiene el Li-7?', opts:['3','4','5','7'], ans:1, exp:'n = A − Z = 7 − 3 = 4.' },
  { q:'¿Cuántos electrones de valencia tiene el Cloro (Cl)?', opts:['3','5','7','8'], ans:2, exp:'Cl está en el grupo 17 (halógenos): 7 electrones de valencia.' },
  { q:'¿A qué grupo pertenece el Sodio (Na)?', opts:['Halógenos','Metales alcalinos','Gases nobles','Metaloides'], ans:1, exp:'Na (Z=11) está en el grupo 1: metales alcalinos.' },
  { q:'¿Cuál es el número atómico del Nitrógeno (N)?', opts:['5','6','7','8'], ans:2, exp:'Z(N)=7.' },
  { q:'¿Cuántos neutrones tiene el Ca-40 (Z=20)?', opts:['10','18','20','40'], ans:2, exp:'n = 40 − 20 = 20.' },
  { q:'¿Qué elemento tiene Z=79?', opts:['Platino','Mercurio','Oro','Plomo'], ans:2, exp:'Au (Oro) tiene Z=79.' },
  { q:'¿Cuántos electrones de valencia tienen los gases nobles (excepto He)?', opts:['2','6','7','8'], ans:3, exp:'Grupo 18 (excepto He): 8 electrones de valencia → muy estables.' },
  { q:'¿A qué grupo pertenecen F, Cl, Br, I?', opts:['Calcógenos','Pnictógenos','Halógenos','Gases nobles'], ans:2, exp:'Halógenos = grupo 17. Muy reactivos, les falta 1 e⁻ para completar su capa.' },
  { q:'¿Cuál es la masa atómica aproximada del Sodio (Na)?', opts:['11 u.m.a.','23 u.m.a.','27 u.m.a.','40 u.m.a.'], ans:1, exp:'Na: Z=11, n=12 → A=23 u.m.a.' },
  { q:'¿Cuántos protones tiene el Cloro (Cl)?', opts:['7','15','17','35'], ans:2, exp:'Z(Cl)=17.' },
  { q:'¿Qué partícula tiene carga negativa?', opts:['Protón','Neutrón','Electrón','Quark Up'], ans:2, exp:'El electrón tiene carga −1e (−1.6×10⁻¹⁹ C).' },
  { q:'¿Cuántos electrones de valencia tiene el Oxígeno (O)?', opts:['2','4','6','8'], ans:2, exp:'O está en el grupo 16: 6 electrones de valencia.' },
  { q:'¿A qué período pertenece el Carbono (C)?', opts:['Período 1','Período 2','Período 3','Período 4'], ans:1, exp:'El período indica el número de capas electrónicas. C tiene 2 capas → período 2.' },
  { q:'¿Cuántos neutrones tiene el Fe-56 (Z=26)?', opts:['26','28','30','56'], ans:2, exp:'n = 56 − 26 = 30.' },
  { q:'¿Qué elemento tiene número atómico Z=1?', opts:['Helio','Litio','Hidrógeno','Boro'], ans:2, exp:'H es el elemento más ligero, Z=1.' },
  { q:'¿Cuántos electrones de valencia tiene el Nitrógeno (N)?', opts:['3','5','7','8'], ans:1, exp:'N está en el grupo 15: 5 electrones de valencia.' },
  { q:'¿Cuál es la masa atómica del Calcio (Ca)?', opts:['20 u.m.a.','40 u.m.a.','48 u.m.a.','56 u.m.a.'], ans:1, exp:'Ca: Z=20, n=20 → A=40 u.m.a.' },
  { q:'¿Cuántos protones tiene el Aluminio (Al)?', opts:['12','13','14','27'], ans:1, exp:'Z(Al)=13. El 27 es su número de masa.' },
  { q:'¿Qué grupo de elementos reacciona muy poco?', opts:['Metales alcalinos','Halógenos','Gases nobles','Metaloides'], ans:2, exp:'Los gases nobles tienen la capa de valencia completa → inertes.' },
  { q:'¿En qué período está el Sodio (Na)?', opts:['Período 1','Período 2','Período 3','Período 4'], ans:2, exp:'Na (Z=11) tiene 3 capas electrónicas → período 3.' },
  { q:'¿Cuántos neutrones tiene el He-4?', opts:['0','1','2','4'], ans:2, exp:'He-4: A=4, Z=2 → n = 4−2 = 2.' },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pick10() { return shuffle(ALL_Q).slice(0, 10); }

// ─── MODAL ENVIAR AL PROFESOR ─────────────────────────────────────────────────
function ModalEnviarProfe({ datos, onClose }) {
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [curso,  setCurso]  = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado,  setEnviado]  = useState(false);
  const [error,    setError]    = useState('');

  const enviar = async () => {
    const code = codigo.trim().toUpperCase();
    if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
    if (!code)          { setError('Escribe el código del profesor.'); return; }
    setEnviando(true); setError('');
    try {
      const snap = await getDoc(doc(db, 'codigos_profesor', code));
      if (!snap.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
      await addDoc(collection(db, 'informes_juegos'), {
        tipo: 'ATOMOS_TEST', modalidad: 'Individual', fecha: new Date(),
        codigoProfesor: code,
        jugadores: [{ nombre: nombre.trim(), curso: curso.trim(),
          aciertos: datos.aciertos, intentos: 10,
          porcentaje: Math.round((datos.aciertos / 10) * 100) }],
      });
      setEnviado(true);
    } catch (e) { setError('Error: ' + e.message); }
    setEnviando(false);
  };

  const inp = { padding:'9px 12px', borderRadius:8, border:'1.5px solid rgba(255,255,255,0.15)',
    background:'rgba(255,255,255,0.07)', color:'white', fontSize:'0.9rem',
    outline:'none', width:'100%', boxSizing:'border-box' };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:10000, display:'flex', justifyContent:'center', alignItems:'center' }}>
      <div style={{ background:'#1e293b', border:'1px solid #334155', borderRadius:18, width:'100%', maxWidth:360, padding:'24px', color:'white' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h3 style={{ margin:0, color:'#f1c40f' }}>📤 Enviar al profesor</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:'1.3rem' }}>✕</button>
        </div>
        {enviado ? (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{ fontSize:'3rem' }}>✅</div>
            <div style={{ color:'#22c55e', fontWeight:700, fontSize:'1.1rem' }}>¡Informe enviado!</div>
            <div style={{ color:'#94a3b8', marginTop:8 }}>{datos.aciertos}/10 aciertos</div>
            <button onClick={onClose} style={{ marginTop:16, padding:'9px 22px', borderRadius:10, border:'none', background:'#334155', cursor:'pointer', color:'white' }}>Cerrar</button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ background:'rgba(99,102,241,0.15)', border:'1px solid #6366f1', borderRadius:8, padding:'10px 12px', fontSize:13, textAlign:'center', color:'#a5b4fc' }}>
              Resultado: <strong style={{ color:'#fff' }}>{datos.aciertos}/10</strong> — {Math.round((datos.aciertos/10)*100)}%
            </div>
            <div><label style={{ fontSize:12, color:'#94a3b8', display:'block', marginBottom:4 }}>Nombre y apellido</label>
              <input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Tu nombre completo" style={inp}/></div>
            <div><label style={{ fontSize:12, color:'#94a3b8', display:'block', marginBottom:4 }}>Curso</label>
              <input value={curso} onChange={e=>setCurso(e.target.value)} placeholder="Ej: 3º ESO B" style={inp}/></div>
            <div><label style={{ fontSize:12, color:'#94a3b8', display:'block', marginBottom:4 }}>Código del profesor</label>
              <input value={codigo} onChange={e=>setCodigo(e.target.value.toUpperCase())} placeholder="Ej: PROF01" maxLength={10} style={{ ...inp, letterSpacing:2, fontWeight:700 }}/></div>
            {error && <div style={{ color:'#ef4444', fontSize:13 }}>⚠ {error}</div>}
            <div style={{ display:'flex', gap:8, marginTop:4 }}>
              <button onClick={onClose} style={{ flex:1, padding:'10px', borderRadius:10, border:'1px solid #334155', background:'transparent', cursor:'pointer', color:'white' }}>Cancelar</button>
              <button onClick={enviar} disabled={enviando} style={{ flex:2, padding:'10px', borderRadius:10, border:'none', background:enviando?'#374151':'linear-gradient(135deg,#3b82f6,#2563eb)', color:'white', fontWeight:700, cursor:enviando?'default':'pointer' }}>
                {enviando ? 'Enviando…' : '📤 Enviar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TABLA PERIÓDICA (CSS grid — posicionamiento explícito) ──────────────────
function TablaPeriodica({ activeEl, onSelect, sz = 36 }) {
  const SZ  = sz;
  const GAP = 2;

  // Números de grupo (encabezado)
  const groups = Array.from({ length: 18 }, (_, i) => i + 1);

  return (
    <div style={{ overflowX: 'auto', padding: '4px 10px 6px' }}>
      {/* Encabezado grupos 1-18 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(18, ${SZ}px)`,
        gap: GAP,
        marginBottom: GAP,
        width: 18 * SZ + 17 * GAP,
      }}>
        {groups.map(g => (
          <div key={g} style={{ textAlign: 'center', fontSize: 8, color: '#334155', lineHeight: `${SZ * 0.6}px`, height: SZ * 0.6 }}>
            {g}
          </div>
        ))}
      </div>

      {/* Grid principal 7×18 — cada elemento se coloca con gridRow/gridColumn */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(18, ${SZ}px)`,
        gridTemplateRows: `repeat(7, ${SZ}px)`,
        gap: GAP,
        width: 18 * SZ + 17 * GAP,
      }}>
        {Object.entries(EL)
          .filter(([, d]) => d.row >= 1 && d.row <= 7)
          .map(([sym, d]) => {
            const clr    = CAT[d.cat]?.color ?? '#475569';
            const active = activeEl === sym;
            return (
              <div key={sym}
                onClick={() => onSelect(sym)}
                title={`${sym} · ${d.name} · Z=${d.z} · ${CAT[d.cat]?.label}`}
                style={{
                  gridRow: d.row, gridColumn: d.col,
                  background:  active ? clr : `${clr}22`,
                  border:      `1.5px solid ${active ? clr : `${clr}66`}`,
                  borderRadius: 4, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.12s, box-shadow 0.12s',
                  boxShadow: active ? `0 0 10px ${clr}99` : 'none',
                  userSelect: 'none',
                }}>
                <span style={{ fontSize: 7, color: active ? 'rgba(255,255,255,0.75)' : '#64748b', lineHeight: 1 }}>{d.z}</span>
                <span style={{ fontSize: sym.length > 2 ? 9 : 11, fontWeight: 700, color: active ? '#fff' : clr, lineHeight: 1.25 }}>{sym}</span>
              </div>
            );
          })}
      </div>

      {/* Leyenda compacta */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', marginTop: 6 }}>
        {Object.entries(CAT).filter(([k]) => k !== 'lanthanide' && k !== 'actinide').map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
            <div style={{ width: 9, height: 9, borderRadius: 2, background: v.color }} />
            <span style={{ color: '#64748b' }}>{v.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
function SimuladorAtomos() {
  const [activeEl, setActiveEl]       = useState('H');
  const [rotation, setRotation]       = useState({ x: 20, y: 30 });
  const [time, setTime]               = useState(0);
  const [selPart, setSelPart]         = useState(null);
  const [realScale, setRealScale]     = useState(false);
  const [rightTab, setRightTab]       = useState('info');
  const [fullscreen, setFullscreen]   = useState(null); // 'tabla' | 'modelo' | 'quiz'
  const [paused, setPaused]           = useState(false);

  // Quiz
  const [quiz, setQuiz]           = useState(() => pick10());
  const [qIdx, setQIdx]           = useState(0);
  const [chosen, setChosen]       = useState(null);
  const [answers, setAnswers]     = useState([]);
  const [finished, setFinished]   = useState(false);
  const [showModal, setShowModal] = useState(false);

  const isDrag = useRef(false);
  const prev   = useRef({ x: 0, y: 0 });
  const el     = EL[activeEl];

  // Animación
  const pausedRef = useRef(false);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => {
    let id;
    const t = () => { if (!pausedRef.current) setTime(v => v + 0.04); id = requestAnimationFrame(t); };
    id = requestAnimationFrame(t);
    return () => cancelAnimationFrame(id);
  }, []);

  const onMD = e => { isDrag.current = true; prev.current = { x: e.clientX, y: e.clientY }; };
  const onMM = e => {
    if (!isDrag.current) return;
    const dx = e.clientX - prev.current.x, dy = e.clientY - prev.current.y;
    setRotation(r => ({ x: r.x - dy * 0.5, y: r.y + dx * 0.5 }));
    prev.current = { x: e.clientX, y: e.clientY };
  };
  const onMU = () => { isDrag.current = false; };
  const onTS = e => { if (e.touches.length===1) { isDrag.current=true; prev.current={x:e.touches[0].clientX,y:e.touches[0].clientY}; }};
  const onTM = e => {
    if (!isDrag.current||e.touches.length!==1) return;
    const dx=e.touches[0].clientX-prev.current.x, dy=e.touches[0].clientY-prev.current.y;
    setRotation(r=>({x:r.x-dy*0.5,y:r.y+dx*0.5}));
    prev.current={x:e.touches[0].clientX,y:e.touches[0].clientY};
  };

  const coreParticles = useMemo(() => {
    const total = el.z + el.n;
    const size  = realScale ? 1.5 : 13;
    return Array.from({ length: total }, (_, i) => {
      const isP = i < el.z;
      const phi  = Math.acos(-1 + (2 * i) / Math.max(total, 1));
      const th   = Math.sqrt(total * Math.PI) * phi;
      const r    = total === 1 ? 0 : size * (0.7 + 0.5 * ((i * 2654435761) % 100) / 100);
      return { type: isP ? 'proton' : 'neutron', x: r*Math.sin(phi)*Math.cos(th), y: r*Math.sin(phi)*Math.sin(th), z: r*Math.cos(phi) };
    });
  }, [el, realScale]);

  const project = (x, y, z) => {
    const rX = rotation.x * Math.PI / 180, rY = rotation.y * Math.PI / 180;
    const x1 = x*Math.cos(rY)-z*Math.sin(rY), z1 = x*Math.sin(rY)+z*Math.cos(rY);
    const y2 = y*Math.cos(rX)-z1*Math.sin(rX), z2 = y*Math.sin(rX)+z1*Math.cos(rX);
    const d = 600/(600+z2);
    return { x: x1*d+250, y: y2*d+250, depth: z2 };
  };

  const visEl = Math.min(el.z, 12);
  const orbits = useMemo(() => Array.from({ length: visEl }, (_, i) => ({
    i, theta: (i*Math.PI)/visEl, phi: (i*Math.PI*2)/visEl+0.5,
    r: realScale ? 240 : 85 + i*13,
  })), [visEl, realScale]);

  // Quiz logic
  const curQ  = quiz[qIdx];
  const score = answers.filter(a => a.correct).length;

  const handleAnswer = idx => {
    if (chosen !== null) return;
    setChosen(idx);
    if (idx === curQ.ans) playOk(); else playFail();
  };
  const handleNext = () => {
    const newAns = [...answers, { chosen, correct: chosen === curQ.ans }];
    setAnswers(newAns);
    if (qIdx + 1 >= quiz.length) { setFinished(true); }
    else { setQIdx(q => q+1); setChosen(null); }
  };
  const resetQuiz = () => {
    setQuiz(pick10()); setQIdx(0); setChosen(null); setAnswers([]); setFinished(false);
  };

  const catInfo    = CAT[el.cat];
  const scoreColor = score >= 8 ? '#22c55e' : score >= 5 ? '#f59e0b' : '#ef4444';

  // ── SVG del átomo — función directa (NO componente) para evitar remount cada frame ──
  const atomSVG = (idPfx = 'a') => (
    <svg width={480} height={380} style={{ overflow:'visible' }}>
      <defs>
        <radialGradient id={`${idPfx}pgr`} cx="30%" cy="30%" r="70%"><stop offset="0%" stopColor="#fca5a5"/><stop offset="100%" stopColor="#dc2626"/></radialGradient>
        <radialGradient id={`${idPfx}ngr`} cx="30%" cy="30%" r="70%"><stop offset="0%" stopColor="#cbd5e1"/><stop offset="100%" stopColor="#475569"/></radialGradient>
        <radialGradient id={`${idPfx}egr`} cx="30%" cy="30%" r="70%"><stop offset="0%" stopColor="#fef08a"/><stop offset="100%" stopColor="#ca8a04"/></radialGradient>
      </defs>
      {orbits.map(orbit => {
        const pts = Array.from({ length: 65 }, (_, i) => {
          const u = (i*Math.PI*2)/64;
          return project(orbit.r*Math.cos(u)*Math.sin(orbit.theta), orbit.r*Math.sin(u)*Math.sin(orbit.phi), orbit.r*Math.cos(u)*Math.cos(orbit.theta));
        });
        const path = `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map(p=>`L ${p.x} ${p.y}`).join(' ');
        const u  = time*1.5 + orbit.i*(Math.PI*2/visEl);
        const ep = project(orbit.r*Math.cos(u)*Math.sin(orbit.theta), orbit.r*Math.sin(u)*Math.sin(orbit.phi), orbit.r*Math.cos(u)*Math.cos(orbit.theta));
        return (
          <g key={orbit.i}>
            <path d={path} fill="none" stroke={selPart==='electron'?'#facc15':'rgba(255,255,255,0.06)'} strokeWidth={selPart==='electron'?1.5:1}/>
            <circle cx={ep.x} cy={ep.y} r={realScale?1.5:6} fill={`url(#${idPfx}egr)`} style={{cursor:'pointer'}} onClick={e=>{e.stopPropagation();setSelPart('electron');}}/>
          </g>
        );
      })}
      {coreParticles.map((p,i)=>({...p,proj:project(p.x,p.y,p.z),i}))
        .sort((a,b)=>b.proj.depth-a.proj.depth)
        .map(p=>(
          <circle key={p.i} cx={p.proj.x} cy={p.proj.y} r={realScale?2:10}
            fill={p.type==='proton'?`url(#${idPfx}pgr)`:`url(#${idPfx}ngr)`}
            stroke={selPart===p.type?'#fff':'#0f172a'} strokeWidth={selPart===p.type?1.5:0.4}
            style={{cursor:'pointer'}} onClick={e=>{e.stopPropagation();setSelPart(p.type);}}/>
        ))}
    </svg>
  );

  // ── Panel de info — función directa ──────────────────────────────────────
  const infoPanel = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ background:'#1e293b', borderRadius:10, padding:'12px 14px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 12px', fontSize:13 }}>
          {[['Z (protones)',el.z],['Neutrones',el.n],['Electrones',el.z],['Masa atómica',`${el.masa} u.m.a.`],
            ['Número de masa A',el.z+el.n],['Valencia (e⁻ ext.)',el.val],['Período',el.row],['Grupo',el.col],
          ].map(([l,v])=>(
            <div key={l}><div style={{ color:'#64748b', fontSize:11 }}>{l}</div><div style={{ fontWeight:700, color:'#e2e8f0' }}>{v}</div></div>
          ))}
        </div>
      </div>
      <div style={{ background:`${catInfo?.color}18`, border:`1px solid ${catInfo?.color}55`, borderRadius:8, padding:'8px 12px', fontSize:13 }}>
        <span style={{ color:catInfo?.color, fontWeight:700 }}>● {catInfo?.label}</span>
        <div style={{ color:'#94a3b8', fontSize:12, marginTop:4 }}>
          {el.cat==='alkali'     && 'Muy reactivos. Reaccionan violentamente con el agua. 1 electrón de valencia fácil de ceder.'}
          {el.cat==='alkaline'   && '2 electrones de valencia. Menos reactivos que los alcalinos. Forman óxidos y sales estables.'}
          {el.cat==='transition' && 'Metales duros con múltiples estados de oxidación. Buenos conductores. Forman complejos de color.'}
          {el.cat==='post'       && 'Metales blandos con menor punto de fusión. Conductores moderados.'}
          {el.cat==='metalloid'  && 'Propiedades intermedias metal/no-metal. Semiconductores clave en electrónica (Si, Ge).'}
          {el.cat==='nonmetal'   && 'Malos conductores. Electronegatividad alta. Forman moléculas covalentes.'}
          {el.cat==='halogen'    && 'Grupo 17. Les falta 1 e⁻ para completar su capa → muy reactivos. Forman sales con metales.'}
          {el.cat==='noble'      && 'Capa de valencia completa → prácticamente inertes. No forman compuestos en condiciones normales.'}
          {el.cat==='lanthanide' && 'Tierras raras. Configuración [Xe] 4f. Usados en imanes, luminoforos y láseres.'}
          {el.cat==='actinide'   && 'Mayoría radiactivos. Configuración [Rn] 5f. Usados en energía nuclear.'}
        </div>
      </div>
      {selPart ? (
        <div style={{ background:'#1e293b', borderRadius:10, padding:'12px 14px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <div style={{ width:18,height:18,borderRadius:'50%', background:selPart==='proton'?'#ef4444':selPart==='neutron'?'#94a3b8':'#facc15' }}/>
            <strong style={{ fontSize:16 }}>{selPart==='proton'?'Protón':selPart==='neutron'?'Neutrón':'Electrón'}</strong>
          </div>
          <p style={{ color:'#94a3b8', fontSize:12, margin:'0 0 10px', lineHeight:1.5 }}>
            {selPart==='proton'   && 'Hadrón con carga +1e. Compuesto por 2 quarks Up (+⅔) y 1 Down (−⅓). Masa ≈ 1.007 u.m.a.'}
            {selPart==='neutron'  && 'Hadrón sin carga. Compuesto por 1 quark Up (+⅔) y 2 Down (−⅓). Masa ≈ 1.008 u.m.a.'}
            {selPart==='electron' && 'Leptón elemental sin subestructura conocida. Carga −1e. Masa ≈ 0.00054 u.m.a. (1836× menos que el protón).'}
          </p>
          {selPart !== 'electron' && (
            <div style={{ display:'flex', justifyContent:'space-around' }}>
              {selPart==='proton'
                ? <><QB l="u" bg="#f87171" c="Up +⅔"/><QB l="u" bg="#f87171" c="Up +⅔"/><QB l="d" bg="#60a5fa" c="Down −⅓"/></>
                : <><QB l="u" bg="#f87171" c="Up +⅔"/><QB l="d" bg="#60a5fa" c="Down −⅓"/><QB l="d" bg="#60a5fa" c="Down −⅓"/></>}
            </div>
          )}
        </div>
      ) : (
        <p style={{ color:'#334155', fontSize:13 }}>👆 Toca una partícula del modelo 3D para ver su estructura interna.</p>
      )}
    </div>
  );

  // ── Contenido del quiz — función directa ─────────────────────────────────
  const quizContent = (fs = false) => (
    <div style={{ display:'flex', flexDirection:'column', gap: fs?16:12, padding: fs?'0 0 24px':'14px', width:'100%' }}>
      {finished ? (
        <>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:fs?56:44 }}>{score>=8?'🏆':score>=5?'👍':'📚'}</div>
            <div style={{ fontSize:fs?32:24, fontWeight:900, color:scoreColor }}>{score} / 10</div>
            <div style={{ fontSize:fs?15:13, color:'#64748b', marginBottom:12 }}>
              {score>=8?'¡Excelente! Dominas la física atómica.':score>=5?'Bien. Repasa los que fallaste.':'Estudia el tema y vuelve a intentarlo.'}
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:8 }}>
            {answers.map((a,i)=>(
              <div key={i} style={{ background:a.correct?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)', border:`1px solid ${a.correct?'#22c55e':'#ef4444'}`, borderRadius:7, padding:'6px 10px', fontSize:fs?13:11 }}>
                <strong style={{ color:a.correct?'#22c55e':'#ef4444' }}>{a.correct?'✓':'✗'} P{i+1}.</strong>{' '}
                <span style={{ color:'#cbd5e1' }}>{quiz[i].opts[quiz[i].ans]}</span>
                {!a.correct && <div style={{ color:'#94a3b8', marginTop:3 }}>{quiz[i].exp}</div>}
              </div>
            ))}
          </div>
          <button onClick={()=>setShowModal(true)} style={{ padding:fs?'14px':'11px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#f59e0b,#d97706)', color:'white', fontWeight:700, fontSize:fs?16:14, cursor:'pointer' }}>
            📤 Enviar al profesor
          </button>
          <button onClick={resetQuiz} style={{ padding:fs?'12px':'10px', borderRadius:10, border:'1px solid #334155', background:'transparent', color:'#94a3b8', fontWeight:700, cursor:'pointer' }}>
            🔄 Nuevo test (10 preguntas al azar)
          </button>
        </>
      ) : (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:fs?14:12, color:'#475569' }}>
            <span>Pregunta {qIdx+1} / 10</span>
            <span style={{ color:'#22c55e' }}>✓ {answers.filter(a=>a.correct).length} correctas</span>
          </div>
          <div style={{ height:5, background:'#1e293b', borderRadius:99 }}>
            <div style={{ height:5, width:`${(qIdx/10)*100}%`, background:'#6366f1', borderRadius:99, transition:'width 0.3s' }}/>
          </div>
          <p style={{ fontWeight:700, fontSize:fs?19:14, color:'#e2e8f0', lineHeight:1.5, margin:0 }}>{curQ.q}</p>
          <div style={{ display:'flex', flexDirection:'column', gap:fs?10:7 }}>
            {curQ.opts.map((opt,i)=>{
              const isChosen=chosen===i, isCorrect=i===curQ.ans;
              let bg='#1e293b', border='#334155', color='#cbd5e1';
              if (chosen!==null) {
                if (isCorrect)    { bg='rgba(34,197,94,0.15)'; border='#22c55e'; color='#86efac'; }
                else if (isChosen){ bg='rgba(239,68,68,0.15)'; border='#ef4444'; color='#fca5a5'; }
              }
              return (
                <button key={i} onClick={()=>handleAnswer(i)} style={{
                  padding:fs?'13px 16px':'9px 12px', background:bg, border:`1.5px solid ${border}`,
                  borderRadius:8, color, fontSize:fs?16:13, textAlign:'left',
                  cursor:chosen!==null?'default':'pointer', fontWeight:(isChosen||(chosen!==null&&isCorrect))?700:400,
                }}>
                  {chosen!==null&&isCorrect?'✓ ':chosen!==null&&isChosen?'✗ ':''}{opt}
                </button>
              );
            })}
          </div>
          {chosen!==null && (
            <div style={{ background:chosen===curQ.ans?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)', border:`1px solid ${chosen===curQ.ans?'#22c55e':'#ef4444'}`, borderRadius:8, padding:fs?'12px 16px':'9px 12px', fontSize:fs?14:12, color:'#94a3b8', lineHeight:1.5 }}>
              <strong style={{ color:chosen===curQ.ans?'#22c55e':'#ef4444' }}>{chosen===curQ.ans?'¡Correcto! ':'Incorrecto. '}</strong>{curQ.exp}
            </div>
          )}
          <button onClick={handleNext} disabled={chosen===null} style={{
            padding:fs?'15px':'11px', borderRadius:8, border:'none',
            background:chosen===null?'#1e293b':'#6366f1', color:chosen===null?'#475569':'white',
            fontWeight:700, fontSize:fs?17:14, cursor:chosen===null?'default':'pointer',
          }}>{qIdx+1<10?'Siguiente →':'Ver resultado'}</button>
        </>
      )}
    </div>
  );

  // ── Helpers — funciones directas (no componentes React) ──────────────────
  const btnFS = (target, label = '⛶') => (
    <button onClick={() => setFullscreen(target)} title="Pantalla completa"
      style={{ padding:'3px 9px', borderRadius:6, border:'1px solid #334155', background:'transparent', color:'#475569', cursor:'pointer', fontSize:13, flexShrink:0 }}>
      {label}
    </button>
  );

  const fsHeader = (title) => (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 18px', borderBottom:'1px solid #1e293b', flexShrink:0, background:'#0f172a' }}>
      <span style={{ fontWeight:700, color:'#94a3b8', fontSize:14 }}>{title}</span>
      <button onClick={() => setFullscreen(null)} style={{ padding:'6px 18px', borderRadius:8, border:'1px solid #334155', background:'#1e293b', color:'#f1f5f9', fontWeight:700, fontSize:13, cursor:'pointer' }}>
        ✕ Cerrar
      </button>
    </div>
  );

  const fsBase = { position:'fixed', inset:0, zIndex:9500, background:'#0b1120', display:'flex', flexDirection:'column', overflow:'hidden' };
  const dragProps = { onMouseDown:onMD, onMouseMove:onMM, onMouseUp:onMU, onMouseLeave:onMU, onTouchStart:onTS, onTouchMove:onTM, onTouchEnd:onMU };

  const scalaBtn = () => (
    <button onClick={()=>setRealScale(v=>!v)} style={{ padding:'7px 12px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:700, background:realScale?'#7f1d1d':'#14532d', color:realScale?'#fca5a5':'#86efac' }}>
      {realScale?'🔬 Escala real ON':'👁 Ver escala real'}
    </button>
  );

  const pauseBtn = () => (
    <button onClick={()=>setPaused(v=>!v)} title={paused?'Reanudar rotación':'Pausar para clicar partículas'}
      style={{ padding:'7px 12px', borderRadius:8, border:`1px solid ${paused?'#3b82f6':'#334155'}`, cursor:'pointer', fontSize:12, fontWeight:700, background:paused?'#1e3a5f':'transparent', color:paused?'#60a5fa':'#475569' }}>
      {paused?'▶ Reanudar':'⏸ Pausar'}
    </button>
  );

  return (
    <>
      {/* ════════════════ VISTA NORMAL ════════════════ */}
      <div style={{ fontFamily:'system-ui,sans-serif', display:'flex', flexDirection:'column', width:'100%', height:'100vh', background:'#0f172a', color:'#f1f5f9', overflow:'hidden' }}>

        {/* ── Tabla periódica (top) ── */}
        <div style={{ borderBottom:'1px solid #1e293b', flexShrink:0 }}>
          <div style={{ padding:'4px 10px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:11, color:'#475569', fontWeight:700 }}>TABLA PERIÓDICA — selecciona un elemento</span>
            {btnFS('tabla', '⛶ Ampliar tabla')}
          </div>
          <TablaPeriodica activeEl={activeEl} onSelect={sym => { setActiveEl(sym); setSelPart(null); }} />
        </div>

        {/* ── Zona inferior ── */}
        <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

          {/* Modelo 3D */}
          <div style={{ flex:'0 0 52%', position:'relative', display:'flex', alignItems:'center', justifyContent:'center', cursor:'grab', borderRight:'1px solid #1e293b' }} {...dragProps}>
            <div style={{ position:'absolute', top:8, left:10, fontSize:11, color: paused?'#60a5fa':'#334155' }}>
              {paused ? '⏸ PAUSADO — clic en protón / neutrón / electrón' : `🔄 Arrastra · X:${Math.round(rotation.x)}° Y:${Math.round(rotation.y)}°`}
            </div>
            <div style={{ position:'absolute', top:6, right:8, display:'flex', gap:6, alignItems:'center' }}>
              {el.z > 12 && <span style={{ fontSize:10, color:'#475569', background:'#1e293b', padding:'2px 7px', borderRadius:6 }}>12/{el.z} e⁻</span>}
              {btnFS('modelo')}
            </div>
            <div style={{ position:'absolute', top:28, left:10 }}>
              <span style={{ fontSize:26, fontWeight:900, color:catInfo?.color??'#6366f1' }}>{activeEl}</span>
              <span style={{ fontSize:13, color:'#475569', marginLeft:6 }}>{el.name}</span>
            </div>
            {atomSVG('a')}
            <div style={{ position:'absolute', bottom:10, left:10, right:10, display:'flex', gap:8, flexWrap:'wrap' }}>
              {pauseBtn()}
              {scalaBtn()}
            </div>
            {realScale && (
              <div style={{ position:'absolute', bottom:42, left:10, right:10, background:'rgba(127,29,29,0.35)', border:'1px solid #dc2626', borderRadius:8, padding:'8px 12px', fontSize:11, textAlign:'center' }}>
                Si el núcleo midiera 1 px, el e⁻ del H estaría a <strong>+10 m</strong>. El átomo es 99.999% vacío.
              </div>
            )}
          </div>

          {/* Panel derecho */}
          <div style={{ flex:'0 0 48%', display:'flex', flexDirection:'column', overflow:'hidden' }}>
            {/* Pestañas */}
            <div style={{ display:'flex', alignItems:'stretch', borderBottom:'1px solid #1e293b', flexShrink:0 }}>
              {[['info','⚛️ Estructura'],['quiz','🧪 Test']].map(([k,lbl])=>(
                <button key={k} onClick={()=>setRightTab(k)} style={{
                  flex:1, padding:'10px 4px', fontSize:13, fontWeight:700,
                  background:rightTab===k?'#1e293b':'transparent',
                  color:rightTab===k?'#f1f5f9':'#475569',
                  border:'none', borderBottom:rightTab===k?'2px solid #6366f1':'2px solid transparent', cursor:'pointer',
                }}>{lbl}</button>
              ))}
              <div style={{ display:'flex', alignItems:'center', paddingRight:8 }}>
                {btnFS(rightTab==='quiz'?'quiz':'modelo')}
              </div>
            </div>

            {rightTab==='info' && (
              <div style={{ flex:1, padding:'14px', overflowY:'auto' }}>{infoPanel()}</div>
            )}
            {rightTab==='quiz' && (
              <div style={{ flex:1, overflowY:'auto' }}>{quizContent()}</div>
            )}
          </div>
        </div>

      </div>

      {/* ════════════════ OVERLAYS FULLSCREEN ════════════════ */}

      {/* Tabla periódica */}
      {fullscreen === 'tabla' && (
        <div style={fsBase}>
          {fsHeader('⚛️ Tabla Periódica — selecciona un elemento')}
          <div style={{ flex:1, overflowY:'auto' }}>
            <TablaPeriodica sz={46} activeEl={activeEl} onSelect={sym => { setActiveEl(sym); setSelPart(null); }} />
            {/* Tira de info del elemento seleccionado */}
            <div style={{ background:'#1e293b', margin:'0 16px 20px', borderRadius:10, padding:'14px 18px', display:'flex', flexWrap:'wrap', gap:'6px 20px', alignItems:'center' }}>
              <span style={{ color:catInfo?.color, fontWeight:900, fontSize:24 }}>{activeEl}</span>
              <span style={{ color:'#94a3b8', fontSize:18 }}>{el.name}</span>
              <span style={{ color:'#64748b', fontSize:14 }}>
                Z={el.z} · A={el.z+el.n} · {el.masa} u.m.a. · {catInfo?.label} · {el.val} e⁻ de valencia · Período {el.row} · Grupo {el.col}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modelo 3D */}
      {fullscreen === 'modelo' && (
        <div style={fsBase}>
          {fsHeader(`⚛️ Modelo 3D — ${el.name} (${activeEl})`)}
          <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
            <div style={{ flex:'0 0 60%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'grab', position:'relative' }} {...dragProps}>
              <div style={{ position:'absolute', top:8, left:14, fontSize:11, color: paused?'#60a5fa':'#334155' }}>
                {paused ? '⏸ PAUSADO — clic en partícula' : `🔄 ${Math.round(rotation.x)}° ${Math.round(rotation.y)}°`}
              </div>
              <div style={{ transform:'scale(1.55)', transformOrigin:'center' }}>
                {atomSVG('fs')}
              </div>
              <div style={{ position:'absolute', bottom:14, left:14, display:'flex', gap:8, flexWrap:'wrap' }}>
                {pauseBtn()}
                {scalaBtn()}
              </div>
              {realScale && (
                <div style={{ position:'absolute', bottom:52, left:14, right:14, background:'rgba(127,29,29,0.35)', border:'1px solid #dc2626', borderRadius:8, padding:'8px 12px', fontSize:11, textAlign:'center' }}>
                  Si el núcleo midiera 1 px, el e⁻ del H estaría a <strong>+10 m</strong>. El átomo es 99.999% vacío.
                </div>
              )}
            </div>
            <div style={{ flex:'0 0 40%', overflowY:'auto', padding:'18px', borderLeft:'1px solid #1e293b' }}>
              <div style={{ fontSize:30, fontWeight:900, color:catInfo?.color, marginBottom:6 }}>
                {activeEl} <span style={{ fontSize:17, color:'#64748b', fontWeight:400 }}>{el.name}</span>
              </div>
              {infoPanel()}
            </div>
          </div>
        </div>
      )}

      {/* Quiz */}
      {fullscreen === 'quiz' && (
        <div style={fsBase}>
          {fsHeader('🧪 Test de Átomos — 10 preguntas al azar')}
          <div style={{ flex:1, display:'flex', justifyContent:'center', overflowY:'auto', padding:'20px 16px' }}>
            <div style={{ width:'100%', maxWidth:580 }}>
              {quizContent(true)}
            </div>
          </div>
        </div>
      )}

      {/* Modal envío profesor (encima de todo) */}
      {showModal && <ModalEnviarProfe datos={{ aciertos: score }} onClose={()=>setShowModal(false)} />}
    </>
  );
}

function QB({ l, bg, c }) {
  return (
    <div style={{ textAlign:'center' }}>
      <div style={{ width:32,height:32,borderRadius:'50%',background:bg,margin:'0 auto 4px',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:13,color:'#0f172a' }}>{l}</div>
      <span style={{ fontSize:11,color:'#94a3b8' }}>{c}</span>
    </div>
  );
}

export default SimuladorAtomos;
