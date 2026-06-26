// ProgramacionRobotica.jsx
// Hub de la sección "Programación y robótica":
//  - Infografía didáctica del kit de robótica del centro (3 bloques con "más info").
//  - Botón al editor de bloques (BlocklyEditor, el que ya existe).
//  - Botón al editor de retos (RetosEditor, tipo Scratch).
//
// Los enlaces de referencia se pueden rellenar en KITS[].detalle.enlaces[].url.

import React, { useState } from 'react';
import BlocklyEditor from './BlocklyEditor';
import RetosEditor from './RetosEditor';
import mbot2Img from './assets/Imagenmbot.avif';
import microbitImg from './assets/imagenmicrobit.jfif';
import keystudioImg from './assets/imagenkeystudio.jpg';

const KITS = [
  {
    id: 'mbot2',
    emoji: '🤖',
    img: mbot2Img,
    titulo: 'Makeblock mBot2 y CyberPi',
    unidades: '10 unidades',
    resumen:
      'Plataforma avanzada que combina motores de precisión con CyberPi, un microordenador que va desde bloques (mBlock) hasta Python.',
    color: '#0EA5E9',
    detalle: {
      comoUsarlo:
        'Es una plataforma avanzada que combina motores de precisión con CyberPi, un microordenador que soporta desde programación por bloques (mBlock) hasta Python. En este portal puedes programarlo en vivo con el editor de bloques.',
      enlaces: [
        { texto: 'Conocer CyberPi (explicación de la placa) – CATEDU', url: 'https://libros.catedu.es/books/cyberpi-y-mbot2/page/conocer-cyberpi' },
        { texto: 'Editor de CyberPi / mBot2 (mBlock)', url: 'https://ide.mblock.cc/' },
        { texto: 'ROBOTIX – mBot2 Guía Oficial (especificaciones y software)', url: 'https://www.robotix.es/es/mbot-2' },
        { texto: 'Juegos Robótica – Webinar de Posibilidades mBot2', url: 'https://juegosrobotica.es/cursos/mbot-2/' },
      ],
      proyectos: [
        {
          titulo: 'Robot Resuelve-Laberintos',
          desc: 'Usar los sensores ultrasónicos y los motores integrados para programar un algoritmo de escape autónomo.',
        },
        {
          titulo: 'Estación IoT / Ciencia de Datos',
          desc: 'Aprovechar la conexión Wi-Fi de la CyberPi para recopilar datos ambientales del aula y subirlos a una hoja de cálculo en tiempo real.',
        },
        {
          titulo: 'Control por Inteligencia Artificial',
          desc: 'Programar el mBot2 para que responda a órdenes de voz (reconocimiento del habla) con los servicios cognitivos de mBlock.',
        },
      ],
    },
  },
  {
    id: 'microbit',
    emoji: '📟',
    img: microbitImg,
    titulo: 'BBC Micro:bit V2',
    unidades: '30 unidades',
    resumen:
      'Tarjeta programable de bolsillo, ideal para introducir electrónica básica a todo el grupo gracias a su alta disponibilidad de unidades.',
    color: '#16A34A',
    detalle: {
      comoUsarlo:
        'Una tarjeta programable de tamaño bolsillo ideal para introducir electrónica básica a todo el grupo gracias a su alta disponibilidad de unidades. En este portal se programa en vivo (MicroPython) e incluso se puede guardar el programa en la placa.',
      enlaces: [
        { texto: 'MakeCode – Editor micro:bit (programar por bloques)', url: 'https://makecode.microbit.org/#editor' },
        { texto: 'Micro:bit – Ideas de Proyectos (catálogo interactivo oficial)', url: 'https://microbit.org/es-es/projects/make-it-code-it/' },
        { texto: 'mSchools – Cuadernos de Proyectos Micro:bit', url: '' },
      ],
      proyectos: [
        {
          titulo: 'Datalogger de Encuestas',
          desc: 'Registrar votaciones de los alumnos con los botones A y B (almacenamiento interno) y exportar el CSV para analizarlo en matemáticas.',
        },
        {
          titulo: 'Podómetro / Cuenta-pasos',
          desc: 'Programar el acelerómetro integrado para medir la actividad física de los alumnos en educación física.',
        },
        {
          titulo: 'Juego de Reflejos',
          desc: 'Diseñar un juego arcade rápido con la matriz de LEDs de 5×5 y los pines táctiles de la placa.',
        },
      ],
    },
  },
  {
    id: 'smarthome',
    emoji: '🏠',
    img: keystudioImg,
    titulo: 'Kit Smart Home y Placa Shield',
    unidades: '5 Smart Home · 9 Shield',
    resumen:
      'Componentes de domótica que se acoplan a las placas de expansión (Shield) para crear maquetas automatizadas.',
    color: '#D97706',
    detalle: {
      comoUsarlo:
        'Componentes de domótica que se acoplan directamente a las placas de expansión (Shield / Innova Didactic Magna Tor) para crear maquetas automatizadas. ⚠️ IMPORTANTE: en el editor (MakeCode) hay que añadir la extensión "Smart Home Kit" para disponer de los bloques de los sensores y actuadores de la casa.',
      video: 'https://www.youtube.com/embed/QQHjohXzbqg',
      enlaces: [
        { texto: 'Montaje de la casa Smart Home – Conexiones (CATEDU)', url: 'https://libros.catedu.es/books/smart-home-esp32/page/conexiones' },
        { texto: 'Editor MakeCode (añade la extensión "Smart Home Kit")', url: 'https://makecode.microbit.org/#editor' },
        { texto: 'Tibot – Guía Smart Home Domótico (fichas técnicas y conexiones)', url: '' },
      ],
      proyectos: [
        {
          titulo: 'Hogar Sostenible',
          desc: 'Programar el sensor de luz junto al sensor de choque para que las luces LED de una maqueta se enciendan solas al anochecer.',
        },
        {
          titulo: 'Ventilador Inteligente por Voz',
          desc: 'Controlar el motor con ventilador usando el sensor de ruido, activando la refrigeración al detectar una palmada.',
        },
        {
          titulo: 'Alerta de Riego',
          desc: 'Medir la humedad del suelo de las plantas del centro y activar un servomotor que abra una compuerta cuando la tierra esté seca.',
        },
      ],
    },
  },
];

export default function ProgramacionRobotica({ usuario = null, onLoginRequest, onExit }) {
  const [vista, setVista] = useState('hub'); // 'hub' | 'bloques' | 'retos'
  const [infoKit, setInfoKit] = useState(null); // kit seleccionado para "más info"

  if (vista === 'bloques') {
    return (
      <BlocklyEditor
        usuario={usuario}
        onLoginRequest={onLoginRequest}
        onExit={() => setVista('hub')}
      />
    );
  }
  if (vista === 'retos') {
    return <RetosEditor usuario={usuario} onExit={() => setVista('hub')} />;
  }

  return (
    <div style={styles.wrapper}>
      <header style={styles.header}>
        {onExit && (
          <button onClick={onExit} style={styles.backBtn}>
            ← Volver
          </button>
        )}
        <span style={{ fontSize: 26 }}>🤖</span>
        <h2 style={styles.title}>Programación y robótica</h2>
      </header>

      <div style={styles.scroll}>
        {/* Cabecera infografía */}
        <div style={styles.infoHead}>
          <div style={styles.infoBadge}>📊 INFOGRAFÍA DIDÁCTICA</div>
          <h3 style={styles.infoH3}>Kit de Robótica y Computación</h3>
          <p style={styles.infoSub}>
            Recursos y proyectos para el Centro de Profesorado de Ejea de los Caballeros
            (ESO y Bachillerato)
          </p>
          <div style={styles.bloqueTag}>🤖 BLOQUE 1: ROBÓTICA MAKER Y MICROCONTROLADORES</div>
        </div>

        {/* Tarjetas de los 3 kits */}
        <div style={styles.kitGrid}>
          {KITS.map((k) => (
            <div key={k.id} style={{ ...styles.kitCard, borderTop: `5px solid ${k.color}` }}>
              {k.img ? (
                <img src={k.img} alt={k.titulo} style={styles.kitImg} />
              ) : (
                <div style={styles.kitEmoji}>{k.emoji}</div>
              )}
              <h4 style={{ ...styles.kitTitle, color: k.color }}>{k.titulo}</h4>
              <div style={styles.kitUnidades}>{k.unidades}</div>
              <p style={styles.kitResumen}>{k.resumen}</p>
              <button
                onClick={() => setInfoKit(k)}
                style={{ ...styles.masInfoBtn, background: k.color }}
              >
                ℹ️ Más info
              </button>
            </div>
          ))}
        </div>

        {/* Accesos a los editores */}
        <h3 style={styles.editoresH3}>✏️ Entra a programar</h3>
        <div style={styles.editoresRow}>
          <div style={{ ...styles.editorBtn('#475569'), opacity: 0.65, cursor: 'not-allowed', position: 'relative' }}>
            <span style={styles.proxBadge}>🔒 Próximamente</span>
            <span style={{ fontSize: 34 }}>🧩</span>
            <span style={styles.editorBtnTitle}>Editor de bloques</span>
            <span style={styles.editorBtnDesc}>
              Programar micro:bit, CyberPi/mBot2 y Arduino por bloques. (En preparación)
            </span>
          </div>
          <button onClick={() => setVista('retos')} style={styles.editorBtn('#7c3aed')}>
            <span style={{ fontSize: 34 }}>🎯</span>
            <span style={styles.editorBtnTitle}>Editor de retos</span>
            <span style={styles.editorBtnDesc}>
              Resuelve retos moviendo a Pi con bloques (estilo Scratch). ¡Llega al objetivo!
            </span>
          </button>
        </div>
      </div>

      {/* Modal "más info" */}
      {infoKit && (
        <div style={styles.modalOverlay} onClick={() => setInfoKit(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ ...styles.modalHead, background: infoKit.color }}>
              {infoKit.img ? (
                <img src={infoKit.img} alt={infoKit.titulo} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8 }} />
              ) : (
                <span style={{ fontSize: 30 }}>{infoKit.emoji}</span>
              )}
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0 }}>{infoKit.titulo}</h3>
                <div style={{ fontSize: 12, opacity: 0.9 }}>{infoKit.unidades}</div>
              </div>
              <button onClick={() => setInfoKit(null)} style={styles.modalClose}>
                ✕
              </button>
            </div>
            <div style={styles.modalBody}>
              <h4 style={styles.secLabel}>¿Cómo usarlo?</h4>
              <p style={styles.secText}>{infoKit.detalle.comoUsarlo}</p>

              {infoKit.detalle.video && (
                <>
                  <h4 style={styles.secLabel}>Vídeo explicativo</h4>
                  <div style={styles.videoBox}>
                    <iframe
                      src={infoKit.detalle.video}
                      title="Vídeo explicativo"
                      style={styles.videoIframe}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </>
              )}

              <h4 style={styles.secLabel}>Enlaces de referencia</h4>
              <ul style={styles.linkList}>
                {infoKit.detalle.enlaces.map((e, i) => (
                  <li key={i} style={styles.linkItem}>
                    {e.url ? (
                      <a href={e.url} target="_blank" rel="noopener noreferrer" style={styles.link}>
                        🔗 {e.texto}
                      </a>
                    ) : (
                      <span style={styles.linkPend}>🔗 {e.texto} (enlace pendiente)</span>
                    )}
                  </li>
                ))}
              </ul>

              <h4 style={styles.secLabel}>Propuestas de proyectos para el aula</h4>
              {infoKit.detalle.proyectos.map((p, i) => (
                <div key={i} style={styles.proyecto}>
                  <div style={{ ...styles.proyectoTitulo, color: infoKit.color }}>
                    {i + 1}. {p.titulo}
                  </div>
                  <div style={styles.proyectoDesc}>{p.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100%',
    background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 100%)',
    fontFamily: 'system-ui, sans-serif',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 18px',
    background: 'rgba(15,23,42,0.85)',
    borderBottom: '1px solid #334155',
  },
  backBtn: {
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid #475569',
    background: '#0f172a',
    color: '#e2e8f0',
    fontWeight: 600,
    cursor: 'pointer',
  },
  title: { margin: 0, color: '#f1f5f9', fontSize: 18, fontWeight: 800 },
  scroll: { flex: 1, overflow: 'auto', padding: '24px 18px 40px' },
  infoHead: { textAlign: 'center', maxWidth: 760, margin: '0 auto 26px' },
  infoBadge: {
    display: 'inline-block',
    background: '#7c3aed',
    color: '#fff',
    fontWeight: 800,
    fontSize: 12,
    padding: '5px 14px',
    borderRadius: 999,
    letterSpacing: '0.05em',
  },
  infoH3: { color: '#f8fafc', fontSize: 26, margin: '12px 0 6px', fontWeight: 800 },
  infoSub: { color: '#94a3b8', fontSize: 14, margin: 0, lineHeight: 1.5 },
  bloqueTag: {
    display: 'inline-block',
    marginTop: 16,
    background: 'rgba(14,165,233,0.15)',
    border: '1px solid #0EA5E9',
    color: '#7dd3fc',
    fontWeight: 700,
    fontSize: 13,
    padding: '7px 16px',
    borderRadius: 10,
  },
  kitGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 18,
    maxWidth: 1000,
    margin: '0 auto 34px',
  },
  kitCard: {
    background: '#fff',
    borderRadius: 16,
    padding: '20px 18px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
  },
  kitEmoji: { fontSize: 40 },
  kitImg: { width: '100%', height: 120, objectFit: 'cover', borderRadius: 10, marginBottom: 4 },
  kitTitle: { margin: '8px 0 2px', fontSize: 17, fontWeight: 800 },
  kitUnidades: {
    fontSize: 11,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 8,
  },
  kitResumen: { fontSize: 13.5, color: '#475569', lineHeight: 1.5, flex: 1, margin: 0 },
  masInfoBtn: {
    marginTop: 14,
    border: 'none',
    color: '#fff',
    fontWeight: 700,
    fontSize: 13,
    padding: '9px',
    borderRadius: 10,
    cursor: 'pointer',
  },
  editoresH3: { color: '#f1f5f9', textAlign: 'center', fontSize: 18, margin: '8px 0 16px' },
  editoresRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 16,
    maxWidth: 760,
    margin: '0 auto',
  },
  editorBtn: (c) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    textAlign: 'center',
    background: 'rgba(255,255,255,0.06)',
    border: `2px solid ${c}`,
    borderRadius: 16,
    padding: '20px 16px',
    cursor: 'pointer',
    color: '#f1f5f9',
  }),
  editorBtnTitle: { fontSize: 16, fontWeight: 800 },
  editorBtnDesc: { fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.45 },
  proxBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    background: '#f59e0b',
    color: '#0f172a',
    fontWeight: 800,
    fontSize: 10.5,
    padding: '3px 8px',
    borderRadius: 999,
  },
  pendiente: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 12.5,
    marginTop: 28,
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 100000,
    background: 'rgba(2,6,23,0.72)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modal: {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 16,
    width: '100%',
    maxWidth: 600,
    maxHeight: '88vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  modalHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '16px 18px',
    color: '#fff',
  },
  modalClose: {
    background: 'rgba(255,255,255,0.2)',
    border: 'none',
    color: '#fff',
    borderRadius: 8,
    width: 32,
    height: 32,
    cursor: 'pointer',
    fontSize: 15,
  },
  modalBody: { padding: '18px 20px', overflow: 'auto' },
  secLabel: { color: '#7dd3fc', fontSize: 14, fontWeight: 800, margin: '14px 0 6px' },
  secText: { color: '#cbd5e1', fontSize: 13.5, lineHeight: 1.6, margin: 0 },
  videoBox: { position: 'relative', width: '100%', paddingTop: '56.25%', borderRadius: 10, overflow: 'hidden', background: '#000' },
  videoIframe: { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' },
  linkList: { margin: '4px 0', padding: 0, listStyle: 'none' },
  linkItem: { marginBottom: 6 },
  link: { color: '#60a5fa', fontSize: 13, textDecoration: 'none' },
  linkPend: { color: '#94a3b8', fontSize: 13 },
  proyecto: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 10,
    padding: '10px 12px',
    marginBottom: 8,
  },
  proyectoTitulo: { fontWeight: 800, fontSize: 13.5, marginBottom: 3 },
  proyectoDesc: { color: '#cbd5e1', fontSize: 12.5, lineHeight: 1.45 },
};
