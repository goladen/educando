// «🟧 Placa 3D»: gemelo digital de la Imagina TdR STEAM, sincronizado con la real (o la simulada),
// con los mandos de sus actuadores y reglas propias de la placa escritas como desigualdades.
import React, { useEffect, useRef } from 'react';
import { st } from '../labMicrobit/estilosLab';
import { montarTdr } from './escenaTdr';
import { enviar } from './conexionKit';
import { useKit, useEventosKit } from './useKit';
import { Lecturas, PanelSimulacion } from './Conectar';
import Actuadores from './Actuadores';
import Reglas from './Reglas';

const REGLAS = [
  { id: 'noche', sensor: 'luz', op: '<', umbral: 20, ud: '%', texto: 'luz', accion: '🔴 encender el LED rojo (luz de noche)', si: () => enviar('led', 1), no: () => enviar('led', 0) },
  { id: 'calor', sensor: 'tempLM', op: '>', umbral: 28, ud: '°C', texto: 'temperatura (LM35)', accion: '🌈 RGB rojo + 🔔 aviso', si: () => { enviar('rgb', [255, 0, 0]); enviar('pita', [880, 300]); }, no: () => enviar('rgb', [0, 0, 0]) },
  { id: 'ruido', sensor: 'mic', op: '>', umbral: 60, ud: '%', texto: 'sonido', accion: '📟 «Silencio» en la LCD + 🔵 LED azul', si: () => { enviar('lcd', [1, '!! SILENCIO !!']); enviar('led2', 1); }, no: () => { enviar('lcd', [1, '']); enviar('led2', 0); } },
  { id: 'humedad', sensor: 'hum', op: '>', umbral: 70, ud: '%', texto: 'humedad (DHT11)', accion: '📟 «Humedad alta» en la LCD', si: () => enviar('lcd', [0, 'Humedad alta']), no: () => enviar('lcd', [0, 'PiKT TdR STEAM']) },
  { id: 'timbre', sensor: 'boton1', op: '=', umbral: 1, ud: '', texto: 'se pulsa SW1', estados: ['SW1 suelto', 'SW1 pulsado'], accion: '🔔 timbre', si: () => enviar('pita', [660, 250]), repetir: () => enviar('pita', [660, 150]) },
];

export default function PlacaTdr() {
  const kit = useKit();
  const host = useRef(null);
  const placa = useRef(null);

  useEffect(() => {
    placa.current = montarTdr({ host: host.current });
    return () => { placa.current?.destroy(); placa.current = null; };
  }, []);
  useEffect(() => { placa.current?.setEstado({ salidas: kit.salidas, lectura: kit.lectura }); }, [kit.salidas, kit.lectura]);
  useEventosKit((ev) => { if (ev.tipo === 'C' && ev.orden === 'pita') placa.current?.pitido(); });

  return (
    <div style={st.dosColumnas}>
      <div style={st.lateral}>
        <Reglas reglas={REGLAS} titulo="🤖 Reglas de la placa" />
        <PanelSimulacion campos={['pot', 'mic', 'boton1', 'calentar']} />
        <Actuadores compacto />
      </div>
      <div style={{ flex: '3 1 420px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', minHeight: 'min(62vh, 560px)', flex: 1 }}>
          <div ref={host} style={{ position: 'absolute', inset: 0 }} />
        </div>
        <Lecturas compacto />
      </div>
    </div>
  );
}
