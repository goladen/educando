import React, { useState } from 'react';
import PantallaReto, { textoBotonEnvio } from './PantallaReto';
import ModalEnviarResultado from './ModalEnviarResultado';

/**
 * Reto por enlace para juegos «por rondas» que ya saben jugar con la prop `aula`
 * de Control de Aula (Enigmic, ¿Quién es quién? histórico…).
 *
 * reto.config = { app, config, rondasMax, detalle }
 *   → PantallaReto → render(aula) con { config, rondasMax, onProgreso, onTerminar }
 *   → resultado final (puntos acumulados) → envío al profesor o a la competición.
 */
export default function RetoConRondas({ reto, tipo, nombreJuego, emoji, color = '#7c3aed', render, onLibre, onSalir }) {
    const cfg = reto.config || {};
    const rondasMax = Math.max(1, Number(cfg.rondasMax) || 1);
    const [fase, setFase] = useState('intro'); // intro | juego | fin
    const [prog, setProg] = useState({ puntos: 0, rondas: 0 });
    const [enviar, setEnviar] = useState(false);
    const [partida, setPartida] = useState(0);

    const fondo = { minHeight: '100vh', background: 'linear-gradient(135deg,#1a1a2e,#16213e)', display: 'flex', alignItems: 'center', justifyContent: 'center' };

    if (fase === 'intro') return (
        <div style={fondo}>
            <PantallaReto reto={reto} nombreJuego={nombreJuego} emoji={emoji} color={color} oscuro
                chips={[cfg.detalle, `🔁 ${rondasMax} ${rondasMax === 1 ? 'ronda' : 'rondas'}`].filter(Boolean)}
                onEmpezar={() => { setProg({ puntos: 0, rondas: 0 }); setPartida(p => p + 1); setFase('juego'); }}
                onLibre={onLibre} onSalir={onSalir} />
        </div>
    );

    if (fase === 'juego') return (
        <React.Fragment key={partida}>
            {render({ config: cfg.config || {}, rondasMax, onProgreso: (p) => setProg(prev => ({ ...prev, ...p })), onTerminar: () => setFase('fin') })}
        </React.Fragment>
    );

    const esComp = !!(reto.compId && reto.catId);
    return (
        <div style={fondo}>
            <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 22, padding: '28px 24px', maxWidth: 420, width: '90%', textAlign: 'center', color: 'white', fontFamily: "'Segoe UI', sans-serif" }}>
                <div style={{ fontSize: '2.6rem' }}>🏁</div>
                <h2 style={{ margin: '8px 0 4px' }}>{reto.titulo || `Reto de ${nombreJuego}`}</h2>
                <div style={{ fontSize: '3rem', fontWeight: 900, color: '#f1c40f', margin: '8px 0' }}>{prog.puntos || 0}</div>
                <div style={{ color: '#94a3b8', marginBottom: 18 }}>puntos · {prog.rondas || 0} {prog.rondas === 1 ? 'ronda' : 'rondas'}</div>
                <button onClick={() => setEnviar(true)}
                    style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '1rem', color: 'white',
                        background: esComp ? 'linear-gradient(135deg,#f39c12,#e67e22)' : 'linear-gradient(135deg,#27ae60,#2ecc71)' }}>
                    {textoBotonEnvio(reto)}
                </button>
                {onSalir && <button onClick={onSalir} style={{ marginTop: 12, background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', textDecoration: 'underline' }}>Salir</button>}
            </div>
            {enviar && (
                <ModalEnviarResultado tipo={tipo} nombreJuego={nombreJuego} reto={reto}
                    datos={{ puntos: prog.puntos || 0, rondas: prog.rondas || 0, ...(prog.resueltos != null ? { aciertos: prog.resueltos, intentos: prog.rondas } : {}), configuracion: cfg.detalle || '' }}
                    onClose={() => setEnviar(false)} />
            )}
        </div>
    );
}
