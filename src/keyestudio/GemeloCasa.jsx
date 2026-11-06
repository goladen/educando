// «🏠 Gemelo 3D»: la casa Smart Home en 3D, sincronizada con la real (o la simulada).
// Controles manuales (Actuadores, versión compacta) y reglas de domótica
// escritas como desigualdades («si T > 26 °C → ventilador»), que se ven cumplirse en vivo.
import React, { useEffect, useRef } from 'react';
import { st } from '../labMicrobit/estilosLab';
import { montarCasa } from './escenaCasa';
import { enviar } from './conexionKit';
import { useKit } from './useKit';
import { Lecturas, PanelSimulacion } from './Conectar';
import Actuadores from './Actuadores';
import Reglas from './Reglas';

const REGLAS = [
  { id: 'calor', sensor: 'temp', op: '>', umbral: 26, ud: '°C', texto: 'temperatura', accion: '🌀 ventilador al 100 %', si: () => enviar('vent', 100), no: () => enviar('vent', 0) },
  { id: 'gas', sensor: 'gas', op: '>', umbral: 40, ud: '%', texto: 'gas', accion: '🪟 abrir ventana + 🔔 alarma + 🌈 rojo', si: () => { enviar('ventana', 90); enviar('rgb', [255, 0, 0]); enviar('pita', [880, 400]); }, no: () => enviar('rgb', [0, 0, 0]), repetir: () => enviar('pita', [880, 300]) },
  { id: 'lluvia', sensor: 'vapor', op: '>', umbral: 25, ud: '%', texto: 'lluvia', accion: '🪟 cerrar ventana', si: () => enviar('ventana', 0) },
  { id: 'mov', sensor: 'pir', op: '=', umbral: 1, ud: '', texto: 'hay movimiento', estados: ['no hay movimiento', 'hay movimiento'], accion: '💡 encender la luz', si: () => enviar('led', 1), no: () => enviar('led', 0) },
  { id: 'oscuro', sensor: 'luz', op: '<', umbral: 15, ud: '%', texto: 'luz', accion: '💡 encender la luz', si: () => enviar('led', 1), no: () => enviar('led', 0) },
];

export default function GemeloCasa() {
  const kit = useKit();
  const host = useRef(null);
  const casa = useRef(null);

  useEffect(() => {
    casa.current = montarCasa({ host: host.current, placa: kit.fuente === 'placa' ? kit.placa : 'esp32' });
    return () => { casa.current?.destroy(); casa.current = null; };
  }, [kit.fuente, kit.placa]);
  useEffect(() => { casa.current?.setEstado({ salidas: kit.salidas, lectura: kit.lectura }); }, [kit.salidas, kit.lectura]);

  return (
    <div style={st.dosColumnas}>
      <div style={st.lateral}>
        <Reglas reglas={REGLAS} titulo="🤖 Reglas de domótica" nota="Activa una regla y cambia el número: la casa actúa cuando se cumple la desigualdad." />
        <PanelSimulacion />
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
