// 🏠 Laboratorio con las placas de Innova Didáctica / Keyestudio (Imagina TdR STEAM sobre ESP32, kit
// Smart Home con ESP32 o micro:bit en la Shield): sus sensores se usan para hacer mates y ciencia.
// Las pestañas dependen de la placa elegida (lo que tiene cada una):
//   · Imagina TdR STEAM: panel, placa 3D, estación, luz y distancia, potenciómetro, sonómetro, música y reacción.
//   · Smart Home: panel, gemelo 3D de la casa, estación, luz y distancia, y servo y ángulos.
// Todo funciona también en simulación. Reutiliza del Laboratorio micro:bit (sin modificarlo) los
// estilos, la escena 3D y la sala.
import React, { useEffect, useState } from 'react';
import { st } from '../labMicrobit/estilosLab';
import { leerConfig, PLACAS } from './placasKit';
import { usarSimulacion, cerrarLaboratorio, elegirPlacaKit, medirReaccion } from './conexionKit';
import { useKit } from './useKit';
import Conectar from './Conectar';
import Panel from './Panel';
import GemeloCasa from './GemeloCasa';
import PlacaTdr from './PlacaTdr';
import Estacion from './Estacion';
import LuzDistancia from './LuzDistancia';
import ServoAngulos from './ServoAngulos';
import Potenciometro from './Potenciometro';
import Sonometro from './Sonometro';
import Musica from './Musica';
import ReaccionJugadores from '../estadistica/ReaccionJugadores';

// Sonómetro con el micrófono de la placa (o el de la simulación)
function SonometroLab() {
  const kit = useKit();
  return <Sonometro sinSensor={kit.lectura && kit.lectura.mic == null
    ? <div style={st.aviso}>No hay micrófono en tu montaje: conéctalo al puerto analógico A3 de la placa (o elige su pin en «Conectar → ⚙️ Pines»).</div>
    : null} />;
}

// Competición de tiempo de reacción (la misma de Math World → Estadística) con la opción de la placa
function ReaccionLab() {
  const kit = useKit();
  return <ReaccionJugadores placa={{ disponible: kit.fuente === 'placa' && kit.estado === 'conectada', medir: medirReaccion }} />;
}

const PESTANAS = {
  conectar: ['🔌 Conectar', Conectar],
  panel: ['🎛️ Panel', Panel],
  placa3d: ['🟧 Placa 3D', PlacaTdr],
  gemelo: ['🏠 Gemelo 3D', GemeloCasa],
  estacion: ['🌡️ Estación y gráficas', Estacion],
  luz: ['🔆 Luz y distancia', LuzDistancia],
  pot: ['🎚️ Potenciómetro', Potenciometro],
  sonido: ['🎤 Sonómetro', SonometroLab],
  musica: ['🎵 Música', Musica],
  reaccion: ['⏱️ Reacción', ReaccionLab],
  servo: ['🚪 Servo y ángulos', ServoAngulos],
};
const PESTANAS_PLACA = {
  tdr: ['conectar', 'panel', 'placa3d', 'estacion', 'luz', 'pot', 'sonido', 'musica', 'reaccion'],
  casa: ['conectar', 'panel', 'gemelo', 'estacion', 'luz', 'servo'],
};

export default function LabKeyestudio({ onExit }) {
  const kit = useKit();
  const [config, setConfig] = useState(leerConfig);
  const [pestana, setPestana] = useState('conectar');

  useEffect(() => {
    elegirPlacaKit(config.placa);
    usarSimulacion();
    return () => { cerrarLaboratorio(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ids = PESTANAS_PLACA[kit.placa === 'tdr' ? 'tdr' : 'casa'];
  const actual = ids.includes(pestana) ? pestana : 'conectar';
  const Contenido = PESTANAS[actual][1];
  const estado = kit.fuente === 'sim'
    ? ['🧪 Simulación', '#38bdf8']
    : kit.estado === 'conectada' ? ['🟢 Placa conectada', '#22c55e'] : kit.estado === 'conectando' ? ['⏳ Conectando…', '#facc15'] : ['🔴 Sin conexión', '#ef4444'];

  return (
    <div style={st.raiz}>
      <div style={st.cab}>
        <button style={st.mini} onClick={onExit}>← Volver</button>
        <h2 style={st.titulo}>{kit.placa === 'tdr' ? '🟧 Laboratorio Imagina TdR STEAM' : '🏠 Laboratorio Smart Home'}</h2>
        <span style={{ ...st.nota, marginTop: 0 }}>{PLACAS[kit.placa]?.nombre}</span>
        <button style={{ ...st.chip(true), borderColor: estado[1] }} onClick={() => setPestana('conectar')}>{estado[0]}</button>
      </div>
      <div style={st.pestanas}>
        {ids.map((id) => <button key={id} style={st.pestana(actual === id)} onClick={() => setPestana(id)}>{PESTANAS[id][0]}</button>)}
      </div>
      <div style={st.cuerpo}>
        <Contenido config={config} setConfig={setConfig} />
      </div>
    </div>
  );
}
