import React, { useState } from 'react';
import { textoBotonEnvio } from './PantallaReto';
import ModalEnviarResultado from './ModalEnviarResultado';

/**
 * Pantalla final común de un reto por enlace para juegos sin envío propio:
 * muestra el resultado y el botón «Enviar al profesor» / «Enviar a la competición».
 *
 *  <FinReto reto={reto} tipo="RETOS" nombreJuego="Sudoku" titulo="¡Reto superado!"
 *           valor="✓" detalle="Sudoku · Medio" datos={{ aciertos: 1, intentos: 1, puntos: 100 }}
 *           onRepetir={…} onSalir={…} />
 */
export default function FinReto({ reto, tipo, nombreJuego, titulo = '¡Reto terminado!', valor, detalle, datos = {}, onRepetir, onSalir }) {
    const [enviar, setEnviar] = useState(false);
    const esComp = !!(reto?.compId && reto?.catId);
    return (
        <div style={{ minHeight: '100vh', width: '100%', background: 'linear-gradient(135deg,#1a1a2e,#16213e)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box' }}>
            <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 22, padding: '28px 24px', maxWidth: 420, width: '100%', textAlign: 'center', color: 'white', fontFamily: "'Segoe UI', sans-serif" }}>
                <div style={{ fontSize: '2.6rem' }}>🏁</div>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginTop: 6 }}>🎯 {reto?.titulo || `Reto de ${nombreJuego}`}</div>
                <h2 style={{ margin: '6px 0 4px' }}>{titulo}</h2>
                {valor != null && <div style={{ fontSize: '3rem', fontWeight: 900, color: '#f1c40f', margin: '6px 0' }}>{valor}</div>}
                {detalle && <div style={{ color: '#94a3b8', marginBottom: 18 }}>{detalle}</div>}
                <button onClick={() => setEnviar(true)}
                    style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '1rem', color: 'white',
                        background: esComp ? 'linear-gradient(135deg,#f39c12,#e67e22)' : 'linear-gradient(135deg,#27ae60,#2ecc71)' }}>
                    {textoBotonEnvio(reto)}
                </button>
                <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 12 }}>
                    {onRepetir && <button onClick={onRepetir} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', textDecoration: 'underline' }}>Repetir</button>}
                    {onSalir && <button onClick={onSalir} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', textDecoration: 'underline' }}>Salir</button>}
                </div>
            </div>
            {enviar && <ModalEnviarResultado tipo={tipo} nombreJuego={nombreJuego} reto={reto} datos={{ ...datos, ...(detalle ? { configuracion: detalle } : {}) }} onClose={() => setEnviar(false)} />}
        </div>
    );
}
