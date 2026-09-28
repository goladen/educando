import React from 'react';
import { X } from 'lucide-react';
import { FormAppAula } from '../../AppsAula';

// Editor de reto para las apps «por rondas» de Control de Aula (Enigmic, ¿Quién es quién?
// histórico): reutiliza su mismo formulario. El reto guarda { app, config, rondasMax, detalle }.
export default function ConfigAppAulaReto({ app, config, onAceptar, onClose }) {
    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.62)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 20, padding: '18px 18px 8px', maxWidth: 560, width: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.35)', fontFamily: "'Segoe UI', sans-serif" }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#95a5a6' }}><X size={20} /></button>
                </div>
                <FormAppAula appFija={app} inicial={config} sinLimite={false} textoBoton="✔ Usar esta configuración"
                    onLanzar={({ config: cfg, rondasMax, detalle }) => onAceptar(
                        { app, config: cfg, rondasMax, detalle },
                        [detalle, `🔁 ${rondasMax} ${rondasMax === 1 ? 'ronda' : 'rondas'}`].filter(Boolean),
                    )} />
            </div>
        </div>
    );
}
