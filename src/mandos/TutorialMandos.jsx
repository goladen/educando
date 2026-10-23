// Tutorial visual de los mandos micro:bit: dibujo de la placa V2 en el que se ilumina la parte
// que se usa (A, B, logo, pantalla) y la placa se mueve para enseñar los gestos (agitar, inclinar).
// Una pestaña por modo; cada paso se puede pulsar y, si no, se van pasando solos.
// Uso:  <BotonTutorialMandos inicial="futbol" />  o  <TutorialMandos inicial="candado" onClose={…} />
import React, { useEffect, useState } from 'react';

// ── Imágenes de 5×5 LED para la pantalla del dibujo ──
const LED = {
  A: '01110:10001:11111:10001:10001',
  B: '11110:10001:11110:10001:11110',
  C: '01111:10000:10000:10000:01111',
  D: '11110:10001:10001:10001:11110',
  K: '10010:10100:11000:10100:10010',
  L: '10000:10000:10000:10000:11111',
  n5: '11111:10000:11110:00001:11110',
  n3: '11110:00001:01110:00001:11110',
  n2: '11110:00001:01110:10000:11111',
  n7: '11111:00010:00100:01000:01000',
  n8: '01110:10001:01110:10001:01110',
  si: '00000:00001:00010:10100:01000',
  feliz: '00000:01010:00000:10001:01110',
  triste: '00000:01010:00000:01110:10001',
  flecha: '00100:01110:10101:00100:00100',
  giro: '01110:00001:10101:10011:01110',
  rombo: '00000:00100:01010:00100:00000',
  balon: '00100:01110:11111:01110:00100',
  num: '00100:01100:00100:00100:01110',
};

// ── Contenido de cada pestaña: paso = { zona, gesto?, led, titulo, texto } ──
// zona: 'A' | 'B' | 'AB' | 'logo' | 'pantalla' | null · gesto: 'agitar' | 'izq' | 'der' | 'delante' | 'detras' | 'mantenerA' | null
const PESTANAS = {
  inicio: {
    t: '👋 Primeros pasos', color: '#0ea5e9',
    intro: 'Cada alumno tiene una micro:bit con pilas. Una micro:bit «antena», enchufada por USB al ordenador del profe, recoge por radio lo que pulsáis. Los mandos cambian de modo solos según el juego.',
    pasos: [
      { zona: 'pantalla', led: 'num', titulo: 'Al encenderlo, muestra su número', texto: 'El número que pasa por la pantalla es el de tu mando (ponle una pegatina). El profe puede escribir tu nombre junto a él.' },
      { zona: 'B', led: 'A', titulo: 'Para unirte a la partida', texto: 'Pulsa B o agita el mando (en fútbol, robots y dibujo vale cualquier botón). Tu nombre o tu avatar aparecen en la pantalla grande.' },
      { zona: 'pantalla', led: 'si', titulo: '✔ Enviado', texto: 'Cuando envías algo, el mando muestra un ✔ y pita: la antena lo ha recibido. Si sale una ✘, acércate un poco a la antena y vuelve a probar.' },
      { zona: 'pantalla', led: 'feliz', titulo: '🙂 / 🙁 ¿Acertaste?', texto: 'Al corregir, tu mando enseña una carita feliz con música si acertaste, o triste si no.' },
    ],
  },
  letras: {
    t: '🔤 Letras A-D', color: '#ef4444', usos: 'Quiz con mandos · salas del escape room · tirón de cuerda',
    intro: 'Para las preguntas de opción múltiple. La pantalla del mando enseña la letra que tienes elegida.',
    pasos: [
      { zona: 'A', led: 'A', titulo: 'A cambia la letra', texto: 'Cada pulsación pasa a la siguiente: A → B → C → D → A…' },
      { zona: 'pantalla', led: 'C', titulo: 'Mira la pantalla', texto: 'La letra que ves es la que se enviará. Compárala con las respuestas de la pizarra.' },
      { zona: 'B', led: 'si', titulo: 'B envía la respuesta', texto: 'Solo cuenta tu primera respuesta de cada pregunta: ¡piénsalo antes de enviar!' },
      { zona: null, gesto: 'agitar', led: 'si', titulo: '…o agita el mando', texto: 'Agitar también envía la letra elegida. Hazlo con una sacudida clara.' },
    ],
  },
  numero: {
    t: '🔢 Número', color: '#7c3aed', usos: 'Quiz numérico · candado de cifras del escape room',
    intro: 'Para responder con un número. El mando empieza en 0.',
    pasos: [
      { zona: 'A', led: 'n7', titulo: 'A baja el número', texto: 'Cada pulsación resta 1.' },
      { zona: 'B', led: 'n8', titulo: 'B sube el número', texto: 'Cada pulsación suma 1.' },
      { zona: 'B', gesto: 'mantener', led: 'n8', titulo: 'Mantén pulsado para ir rápido', texto: 'Si dejas el botón apretado, el número cambia cada vez más deprisa. Suelta un poco antes de llegar.' },
      { zona: null, gesto: 'agitar', led: 'si', titulo: 'Agita para enviar', texto: 'Cuando la pantalla muestre tu número, agita el mando (o pulsa A y B a la vez).' },
    ],
  },
  abecedario: {
    t: '🔡 Abecedario', color: '#0d9488', usos: 'Candado de palabras del escape room',
    intro: 'Para escribir palabras letra a letra. Después de la Z vienen las cifras del 0 al 9 (para códigos mixtos). La Ñ se escribe como N.',
    pasos: [
      { zona: 'B', led: 'L', titulo: 'B: letra siguiente', texto: 'A → B → C… → Z → 0 → 1 … → 9 → A' },
      { zona: 'A', led: 'K', titulo: 'A: letra anterior', texto: 'Para volver atrás si te pasas. Mantén pulsado para ir rápido.' },
      { zona: null, gesto: 'agitar', led: 'si', titulo: 'Agita para enviar la letra', texto: 'Se envía la letra que ves (o pulsa A y B a la vez). Luego busca la siguiente letra del código.' },
    ],
  },
  candado: {
    t: '🔒 Candado del escape room', color: '#f59e0b', usos: 'Escape room de Halloween (modo mandos)',
    intro: 'Cada alumno escribe SU intento del código, carácter a carácter. El mando se pone solo en modo número (si el código son cifras) o en modo abecedario (si es una palabra).',
    ejemplo: true,
    pasos: [
      { zona: 'B', led: 'n5', titulo: '1 · Marca el primer carácter', texto: 'Código de cifras: A baja y B sube. Código de letras: B letra siguiente, A anterior.' },
      { zona: null, gesto: 'agitar', led: 'si', titulo: '2 · Agita para enviarlo', texto: 'En la pantalla grande se rellena un punto de tu fila: ●○○' },
      { zona: 'B', led: 'n3', titulo: '3 · Siguiente carácter y vuelve a agitar', texto: 'Uno a uno, hasta completar el código: ●●○ → ●●●' },
      { zona: 'pantalla', led: 'triste', titulo: '✘ Si un carácter no es…', texto: 'Tu intento se borra (carita triste) y esperas 3 segundos antes de empezar de nuevo. ¡Mirad bien las pistas!' },
      { zona: 'pantalla', led: 'feliz', titulo: '🗝️ ¡El primero que lo completa abre la puerta!', texto: 'Su avatar se hace GIGANTE en la mansión y sale su nombre en grande.' },
    ],
  },
  calamar: {
    t: '🦑 Luz roja · Luz verde', color: '#e6317f', usos: 'Juego del calamar con mandos',
    intro: 'Hay una pregunta para todos en la pizarra. Solo los que aciertan pueden avanzar, y solo con la luz verde. ¡Cuidado con la muñeca!',
    pasos: [
      { zona: 'A', led: 'B', titulo: '🟢 Luz verde: A cambia la letra', texto: 'Elige la respuesta (A → B → C → D) mirando la pizarra.' },
      { zona: 'B', gesto: 'agitarB', led: 'si', titulo: 'B o agitar: envías tu respuesta', texto: 'Tu primer envío de cada pregunta es la respuesta. Carita feliz = has acertado.' },
      { zona: null, gesto: 'agitar', led: 'feliz', titulo: '✅ Si aciertas: ¡agita para avanzar!', texto: 'Cada sacudida es un paso hacia la meta, mientras dure la luz verde.' },
      { zona: 'pantalla', led: 'triste', titulo: '🔴 Luz roja: ¡quieto!', texto: 'Si agitas o respondes con la luz roja, ¡quedas ELIMINADO! (Con la luz amarilla, mientras la muñeca se gira, no avanzas pero sigues vivo).' },
      { zona: 'pantalla', led: 'A', titulo: '🔄 Con cada luz roja cambia la pregunta', texto: 'Hay que volver a acertar la nueva pregunta para seguir avanzando. ¡Aprovecha la luz roja para pensarla (sin moverte)!' },
      { zona: null, led: 'balon', titulo: '🏁 ¿Cuándo acaba?', texto: 'Cuando se termina el tiempo o cuando todos los que siguen vivos han cruzado la meta.' },
    ],
  },
  mover: {
    t: '🤖 Mover', color: '#16a34a', usos: 'Pista de robots · Copia el dibujo',
    intro: 'Tu mando lleva un robot (o una tortuga que dibuja). La pantalla muestra una flecha.',
    pasos: [
      { zona: 'A', led: 'flecha', titulo: 'A avanza', texto: 'Una pulsación = avanzar las casillas que diga el profe, hacia donde mira el robot.' },
      { zona: 'B', led: 'giro', titulo: 'B gira 90° a la derecha', texto: 'Para ir a la izquierda, gira tres veces.' },
      { zona: 'AB', led: 'rombo', titulo: 'A + B a la vez: lápiz', texto: 'Sube o baja el lápiz: con el lápiz bajado el robot deja rastro al moverse.' },
    ],
  },
  futbol: {
    t: '⚽ Fútbol', color: '#15803d', usos: 'Partido 3D con mandos (micro:bit V2)',
    intro: 'Cada mando es un jugador. El aro amarillo del campo marca quién lleva el balón. La pantalla del mando muestra un balón.',
    pasos: [
      { zona: 'A', gesto: 'mantener', led: 'balon', titulo: 'Mantén A para correr', texto: 'Tu jugador corre hacia donde mira. Al soltar A, se para.' },
      { zona: 'B', led: 'giro', titulo: 'B gira a la derecha', texto: 'Mientras lo mantienes, sigue girando. Corre y gira a la vez para hacer curvas.' },
      { zona: 'logo', led: 'giro', titulo: 'Toca el logo: gira a la izquierda', texto: 'El logo dorado de arriba es táctil. Pon el dedo encima mientras quieras girar.' },
      { zona: null, gesto: 'agitar', led: 'balon', titulo: 'Agita: ¡tiro a puerta!', texto: 'Si llevas el balón y miras hacia la portería rival, chutas. Sin balón, agitar da una arrancada rápida.' },
      { zona: null, gesto: 'izq', led: 'balon', titulo: 'Inclina para pasar', texto: 'Inclina el mando hacia un lado: pasas al compañero de ese lado. Vuelve a ponerlo plano antes del siguiente pase.' },
      { zona: null, gesto: 'delante', led: 'balon', titulo: 'Inclina hacia delante o hacia atrás', texto: 'Delante = pase al compañero que tienes por delante. Atrás = pase hacia atrás.' },
      { zona: 'A', led: 'B', titulo: '⚔️ ¡Duelo! A cambia la letra', texto: 'Si un rival te alcanza, el partido se para y sale una pregunta. Tu mando enseña una letra: A la cambia (A→B→C→D).' },
      { zona: 'B', gesto: 'agitarB', led: 'si', titulo: 'B o agitar envía tu respuesta', texto: 'Solo tienes UNA oportunidad. El primero que acierta se queda el balón; el otro se queda aturdido un momento.' },
    ],
  },
};
const ORDEN = ['inicio', 'letras', 'numero', 'abecedario', 'candado', 'calamar', 'mover', 'futbol'];

const CSS = `
@keyframes tmAgitar { 0%,100% { transform: translate(0,0) rotate(0deg); } 15% { transform: translate(-10px,-3px) rotate(-6deg); } 30% { transform: translate(10px,3px) rotate(6deg); } 45% { transform: translate(-9px,2px) rotate(-5deg); } 60% { transform: translate(9px,-2px) rotate(5deg); } 75% { transform: translate(-4px,0) rotate(-2deg); } }
@keyframes tmIzq { 0%,15%,100% { transform: rotate(0deg); } 40%,75% { transform: rotate(-22deg); } }
@keyframes tmDer { 0%,15%,100% { transform: rotate(0deg); } 40%,75% { transform: rotate(22deg); } }
@keyframes tmDelante { 0%,15%,100% { transform: scaleY(1) translateY(0); } 40%,75% { transform: scaleY(0.72) translateY(-14px); } }
@keyframes tmLatido { 0%,100% { opacity: .95; } 50% { opacity: .35; } }
@keyframes tmPulsar { 0%,100% { transform: scale(1); } 50% { transform: scale(0.82); } }
.tm-placa { transform-box: fill-box; transform-origin: 50% 85%; }
.tm-agitar { animation: tmAgitar 1.2s ease-in-out infinite; }
.tm-izq { animation: tmIzq 2.4s ease-in-out infinite; }
.tm-der { animation: tmDer 2.4s ease-in-out infinite; }
.tm-delante { animation: tmDelante 2.4s ease-in-out infinite; }
.tm-aro { animation: tmLatido 1s ease-in-out infinite; }
.tm-boton { transform-box: fill-box; transform-origin: center; }
.tm-pulsar { animation: tmPulsar .9s ease-in-out infinite; }
.tm-mantener { transform: scale(0.82); }
`;

function Pantalla5x5({ patron, cx, cy }) {
  const filas = (LED[patron] || LED.A).split(':');
  return (
    <g>
      {filas.map((f, y) => [...f].map((c, x) => (
        <rect key={`${x}-${y}`} x={cx - 34 + x * 16} y={cy - 36 + y * 16} width={6} height={10} rx={1.5}
          fill={c === '1' ? '#ff3b30' : '#3f1d1d'} style={c === '1' ? { filter: 'drop-shadow(0 0 3px #ff3b30)' } : undefined} />
      )))}
    </g>
  );
}

function Boton({ x, y, letra, activo, modo }) {
  return (
    <g>
      {activo && <circle className="tm-aro" cx={x} cy={y} r={30} fill="none" stroke="#facc15" strokeWidth={5} />}
      <g className={`tm-boton ${activo ? (modo === 'mantener' ? 'tm-mantener' : 'tm-pulsar') : ''}`}>
        <rect x={x - 17} y={y - 17} width={34} height={34} rx={5} fill="#9ca3af" stroke="#4b5563" strokeWidth={2} />
        <circle cx={x} cy={y} r={11} fill="#111827" />
      </g>
      <text x={x} y={y - 24} textAnchor="middle" fontSize={15} fontWeight="900" fill="#e5e7eb">{letra}</text>
    </g>
  );
}

/** Dibujo de la micro:bit V2 con la zona activa iluminada y el gesto animado. */
export function DibujoMicrobit({ zona, gesto, led, ancho = 320 }) {
  const claseGesto = { agitar: 'tm-agitar', agitarB: 'tm-agitar', izq: 'tm-izq', der: 'tm-der', delante: 'tm-delante', detras: 'tm-delante' }[gesto] || '';
  const modoBoton = gesto === 'mantener' ? 'mantener' : 'pulsar';
  return (
    <svg viewBox="-10 -30 320 290" width={ancho} style={{ maxWidth: '100%', display: 'block', overflow: 'visible' }}>
      <g className={`tm-placa ${claseGesto}`}>
        {/* placa */}
        <rect x={20} y={20} width={260} height={200} rx={22} fill="#111827" stroke={zona === 'todo' || claseGesto ? '#facc15' : '#374151'} strokeWidth={claseGesto ? 5 : 3} />
        {/* conector inferior */}
        <rect x={20} y={196} width={260} height={24} rx={4} fill="#b8860b" />
        {[45, 95, 150, 205, 255].map((x, i) => (
          <g key={x}>
            <circle cx={x} cy={207} r={i === 4 ? 9 : 10} fill="#111827" stroke="#facc15" strokeWidth={2} />
            <text x={x} y={233} textAnchor="middle" fontSize={9} fill="#9ca3af">{['0', '1', '2', '3V', 'GND'][i]}</text>
          </g>
        ))}
        {/* logo táctil (V2) */}
        {zona === 'logo' && <ellipse className="tm-aro" cx={150} cy={42} rx={34} ry={20} fill="none" stroke="#facc15" strokeWidth={5} />}
        <g>
          <rect x={128} y={33} width={44} height={18} rx={9} fill="none" stroke="#d4a017" strokeWidth={3} />
          <circle cx={140} cy={42} r={3} fill="#d4a017" /><circle cx={160} cy={42} r={3} fill="#d4a017" />
        </g>
        {/* pantalla 5×5 */}
        {zona === 'pantalla' && <rect className="tm-aro" x={106} y={64} width={88} height={88} rx={10} fill="none" stroke="#facc15" strokeWidth={5} />}
        <Pantalla5x5 patron={led} cx={150} cy={110} />
        {/* botones */}
        <Boton x={56} y={112} letra="A" activo={zona === 'A' || zona === 'AB'} modo={modoBoton} />
        <Boton x={244} y={112} letra="B" activo={zona === 'B' || zona === 'AB' || gesto === 'agitarB'} modo={modoBoton} />
      </g>
      {/* etiquetas fijas */}
      <text x={150} y={-12} textAnchor="middle" fontSize={11} fill="#9ca3af">logo táctil</text>
      <line x1={150} y1={-8} x2={150} y2={28} stroke="#6b7280" strokeDasharray="3 3" />
      {gesto === 'mantener' && <text x={150} y={262} textAnchor="middle" fontSize={14} fontWeight="900" fill="#facc15">✋ ¡mantener pulsado!</text>}
      {(gesto === 'agitar' || gesto === 'agitarB') && <text x={150} y={262} textAnchor="middle" fontSize={14} fontWeight="900" fill="#facc15">〰 ¡agitar! 〰</text>}
      {gesto === 'izq' && <text x={150} y={262} textAnchor="middle" fontSize={14} fontWeight="900" fill="#facc15">↙ inclinar a un lado ↘</text>}
      {(gesto === 'delante' || gesto === 'detras') && <text x={150} y={262} textAnchor="middle" fontSize={14} fontWeight="900" fill="#facc15">↑ inclinar adelante / atrás ↓</text>}
    </svg>
  );
}

/** Ejemplo del candado: el código 532 marcado y enviado cifra a cifra. */
function EjemploCandado() {
  const pasos = [['n5', '●○○'], ['n3', '●●○'], ['n2', '●●●']];
  return (
    <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: 'rgba(245,158,11,.12)', border: '1px dashed #f59e0b' }}>
      <div style={{ fontWeight: 800, color: '#fcd34d', marginBottom: 6 }}>Ejemplo: el código es 532</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {pasos.map(([p, puntos], i) => (
          <React.Fragment key={p}>
            <div style={{ textAlign: 'center' }}>
              <svg viewBox="100 58 100 104" width={56}><rect x={104} y={62} width={92} height={96} rx={10} fill="#111827" /><Pantalla5x5 patron={p} cx={150} cy={110} /></svg>
              <div style={{ fontSize: 12, color: '#e5e7eb' }}>〰 agitar</div>
              <div style={{ fontSize: 16, letterSpacing: 2, color: '#fcd34d' }}>{puntos}</div>
            </div>
            {i < pasos.length - 1 && <span style={{ fontSize: 22, color: '#9ca3af' }}>→</span>}
          </React.Fragment>
        ))}
        <span style={{ fontSize: 22, color: '#9ca3af' }}>→</span>
        <div style={{ fontSize: 30 }}>🔓</div>
      </div>
    </div>
  );
}

/** Tutorial completo (ventana). `inicial` = id de la pestaña. */
export default function TutorialMandos({ inicial = 'inicio', onClose }) {
  const [tab, setTab] = useState(PESTANAS[inicial] ? inicial : 'inicio');
  const [paso, setPaso] = useState(0);
  const [auto, setAuto] = useState(true);
  const P = PESTANAS[tab];
  const actual = P.pasos[Math.min(paso, P.pasos.length - 1)];

  useEffect(() => { setPaso(0); setAuto(true); }, [tab]);
  useEffect(() => {
    if (!auto) return undefined;
    const t = setInterval(() => setPaso((p) => (p + 1) % P.pasos.length), 3200);
    return () => clearInterval(t);
  }, [auto, P]);
  useEffect(() => {
    const f = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onClose]);

  return (
    <div style={st.fondo} onClick={onClose}>
      <style>{CSS}</style>
      <div style={st.caja} onClick={(e) => e.stopPropagation()}>
        <div style={st.cabecera}>
          <b style={{ fontSize: 18 }}>📖 Cómo se usan los mandos micro:bit</b>
          <button style={st.cerrar} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div style={st.pestanas}>
          {ORDEN.map((id) => (
            <button key={id} onClick={() => setTab(id)} style={st.pestana(tab === id, PESTANAS[id].color)}>{PESTANAS[id].t}</button>
          ))}
        </div>
        <div style={st.cuerpo}>
          <div style={st.dibujo}>
            <DibujoMicrobit zona={actual.zona} gesto={actual.gesto} led={actual.led} />
            <div style={{ ...st.bocadillo, borderColor: P.color }}>
              <div style={{ fontWeight: 900, fontSize: 17 }}>{actual.titulo}</div>
              <div style={{ fontSize: 14, color: '#cbd5e1', marginTop: 4, lineHeight: 1.45 }}>{actual.texto}</div>
            </div>
          </div>
          <div style={st.texto}>
            {P.usos && <div style={{ ...st.usos, background: P.color }}>{P.usos}</div>}
            <p style={{ margin: '0 0 10px', lineHeight: 1.5, color: '#e2e8f0' }}>{P.intro}</p>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {P.pasos.map((p, i) => (
                <li key={i}>
                  <button onClick={() => { setPaso(i); setAuto(false); }} style={st.paso(i === paso, P.color)}>
                    <span style={{ ...st.numero, background: i === paso ? P.color : '#334155' }}>{i + 1}</span>
                    <span><b>{p.titulo}</b><br /><span style={{ fontSize: 13, color: '#cbd5e1' }}>{p.texto}</span></span>
                  </button>
                </li>
              ))}
            </ol>
            {P.ejemplo && <EjemploCandado />}
            <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
              <button style={st.btn} onClick={() => setAuto((a) => !a)}>{auto ? '⏸ Parar' : '▶ Ver solo'}</button>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>Pulsa un paso para verlo en el dibujo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Botón que abre el tutorial. */
export function BotonTutorialMandos({ inicial = 'inicio', texto = '📖 Tutorial de los mandos', style }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} style={{ ...st.btnAbrir, ...style }}>{texto}</button>
      {abierto && <TutorialMandos inicial={inicial} onClose={() => setAbierto(false)} />}
    </>
  );
}

const st = {
  fondo: { position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(2,6,23,.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, fontFamily: 'system-ui, sans-serif' },
  caja: { width: 'min(1040px, 100%)', maxHeight: 'calc(100vh - 24px)', overflow: 'auto', background: '#0f172a', color: '#f1f5f9', borderRadius: 18, border: '1px solid #334155', boxShadow: '0 20px 60px rgba(0,0,0,.6)' },
  cabecera: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #1e293b', position: 'sticky', top: 0, background: '#0f172a', zIndex: 2 },
  cerrar: { background: 'transparent', border: '1px solid #475569', color: '#e2e8f0', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 16 },
  pestanas: { display: 'flex', gap: 6, flexWrap: 'wrap', padding: '10px 16px' },
  pestana: (on, c) => ({ padding: '7px 12px', borderRadius: 99, border: `2px solid ${on ? c : '#334155'}`, background: on ? c : 'transparent', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }),
  cuerpo: { display: 'flex', flexWrap: 'wrap', gap: 18, padding: '6px 16px 18px' },
  dibujo: { flex: '1 1 320px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, minWidth: 0 },
  bocadillo: { width: '100%', maxWidth: 380, boxSizing: 'border-box', border: '3px solid', borderRadius: 14, padding: '10px 14px', background: 'rgba(15,23,42,.9)', minHeight: 90 },
  texto: { flex: '1 1 380px', minWidth: 0 },
  usos: { display: 'inline-block', color: '#fff', fontWeight: 800, fontSize: 12, padding: '3px 10px', borderRadius: 99, marginBottom: 8 },
  paso: (on, c) => ({ display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 12, border: `2px solid ${on ? c : '#1e293b'}`, background: on ? 'rgba(255,255,255,.07)' : 'transparent', color: '#f1f5f9', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }),
  numero: { minWidth: 26, height: 26, borderRadius: 99, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#fff', flexShrink: 0 },
  btn: { background: '#334155', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontWeight: 800, cursor: 'pointer' },
  btnAbrir: { background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 14px', fontWeight: 800, cursor: 'pointer', fontSize: 14 },
};
