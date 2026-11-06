// 📡 Laboratorio de mates con micro:bit: el usuario crea su sala en 3D y la usa con un GPS de clase
// (satélites que pitan + receptor), un medidor de distancias y otros instrumentos (inclinómetro,
// brújula, sensores y caída libre) y actividades de clase (cronómetro, dados, orquesta, pantallas, pines, frío o
// caliente, en Actividades.jsx). Todo funciona también en simulación, sin placas.
// Placas: la antena de los mandos + programas de src/labMicrobit/programasLab.js.
import React, { useEffect, useState } from 'react';
import ChipAntena from '../mandos/ChipAntena.jsx';
import { escucharEstadoAntena } from '../mandos/mandosMicrobit.js';
import EditorSala from './EditorSala.jsx';
import GpsLab from './GpsLab.jsx';
import { Inclinometro, Brujula, Sensores, Caida } from './Instrumentos.jsx';
import { Dados, Orquesta, Pantallas, Pines, FrioCaliente } from './Actividades.jsx';
import Cronometro from './Cronometro.jsx';
import PrepararPlacas from './PrepararPlacas.jsx';
import PanelPlacas from './PanelPlacas.jsx';
import { usePlacasLab } from './usePlacasLab';
import { leerSalas, guardarSalas, leerSalaActual, guardarSalaActual } from './salas';
import { st } from './estilosLab';

const PESTANAS = [
  ['sala', '🏠 Mi sala'],
  ['gps', '🛰️ GPS'],
  ['distancia', '📏 Distancia'],
  ['inclinometro', '📐 Inclinómetro'],
  ['brujula', '🧭 Brújula'],
  ['sensores', '🌡️ Sensores'],
  ['caida', '🪂 Caída libre'],
  ['pines', '🔌 Pines'],
  ['frio', '🔥 Frío o caliente'],
  ['crono', '⏱️ Cronómetro'],
  ['dados', '🎲 Dados'],
  ['orquesta', '🎵 Orquesta'],
  ['pantallas', '📟 Pantallas'],
  ['placas', '⚙️ Preparar placas'],
];

// Funciones de las placas que necesita cada pestaña (barra «📋 Placas»)
const INSTRUMENTO = { necesarios: ['I'] };
// En estas participan todas las placas (useTodasInstrumento): no se repite el reparto mientras están abiertas
const TODAS = new Set(['crono', 'dados', 'orquesta', 'pantallas']);
const PLACAS_PESTANA = {
  gps: { necesarios: ['S1', 'S2', 'S3', 'I'], opcionales: ['S4'] },
  distancia: { necesarios: ['S1', 'I'] },
  inclinometro: INSTRUMENTO, brujula: INSTRUMENTO, sensores: INSTRUMENTO, caida: INSTRUMENTO, pines: INSTRUMENTO,
  frio: { necesarios: ['S1', 'I'] },
  placas: { necesarios: [], opcionales: ['S1', 'S2', 'S3', 'S4', 'I'] },
};

export default function LabMicrobit({ onExit }) {
  const [pestana, setPestana] = useState('sala');
  const [salas, setSalas] = useState(leerSalas);
  const [salaId, setSalaIdState] = useState(() => leerSalaActual());
  const [antena, setAntena] = useState({ antenaOk: false, instrumentos: false });
  useEffect(() => escucharEstadoAntena(setAntena), []);
  useEffect(() => guardarSalas(salas), [salas]);
  const radioLab = antena.antenaOk && antena.instrumentos;
  const placas = usePlacasLab(radioLab && !TODAS.has(pestana));
  const satelites = Object.keys(placas.roles).filter((id) => placas.roles[id][0] === 'S');

  const sala = salas.find((s) => s.id === salaId) || salas[0];
  const setSalaId = (id) => { setSalaIdState(id); guardarSalaActual(id); };
  const guardarSala = (s) => setSalas((l) => l.map((x) => (x.id === s.id ? s : x)));
  const anadirSala = (s) => { setSalas((l) => [...l, s]); setSalaId(s.id); };
  const borrarSala = (id) => {
    setSalas((l) => {
      const resto = l.filter((x) => x.id !== id);
      if (resto.length) setSalaId(resto[0].id);
      return resto.length ? resto : l;
    });
  };

  return (
    <div style={st.raiz}>
      <header style={st.cab}>
        <button style={st.btn('#334155')} onClick={onExit}>← Volver</button>
        <h2 style={st.titulo}>📡 Laboratorio de mates con micro:bit</h2>
        <span style={{ color: '#94a3b8', fontSize: 13 }}>Sala: <b style={{ color: '#f1f5f9' }}>{sala.nombre}</b></span>
        <ChipAntena />
      </header>
      <nav style={st.pestanas}>
        {PESTANAS.map(([k, t]) => <button key={k} style={st.pestana(pestana === k)} onClick={() => setPestana(k)}>{t}</button>)}
      </nav>
      {antena.antenaOk && !antena.instrumentos && pestana !== 'sala' && (
        <div style={{ ...st.aviso, margin: '8px 12px 0' }}>
          ⚠️ Esta antena tiene un programa que todavía no reenvía las medidas del laboratorio. Vuelve a grabarla en <b>⚙️ Preparar placas</b> (sigue sirviendo para los mandos).
        </div>
      )}
      {radioLab && PLACAS_PESTANA[pestana] && <PanelPlacas placas={placas} {...PLACAS_PESTANA[pestana]} />}
      <main style={st.cuerpo}>
        {pestana === 'sala' && <EditorSala salas={salas} salaId={sala.id} setSalaId={setSalaId} guardarSala={guardarSala} borrarSala={borrarSala} anadirSala={anadirSala} />}
        {pestana === 'gps' && <GpsLab key={'g' + sala.id} sala={sala} modo="gps" />}
        {pestana === 'distancia' && <GpsLab key={'d' + sala.id} sala={sala} modo="distancia" />}
        {pestana === 'inclinometro' && <Inclinometro />}
        {pestana === 'brujula' && <Brujula />}
        {pestana === 'sensores' && <Sensores />}
        {pestana === 'caida' && <Caida />}
        {pestana === 'pines' && <Pines radio={radioLab} />}
        {pestana === 'frio' && <FrioCaliente radio={radioLab} />}
        {pestana === 'crono' && <Cronometro radio={radioLab} excluir={satelites} />}
        {pestana === 'dados' && <Dados radio={radioLab} excluir={satelites} />}
        {pestana === 'orquesta' && <Orquesta radio={radioLab} excluir={satelites} />}
        {pestana === 'pantallas' && <Pantallas radio={radioLab} excluir={satelites} />}
        {pestana === 'placas' && <PrepararPlacas />}
      </main>
    </div>
  );
}
