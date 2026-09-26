import React from 'react';

// Pantalla previa común de un reto por enlace (?reto=…): el alumno ve la
// configuración fijada por el profesor y solo tiene que pulsar «Empezar».
// Al terminar, el juego envía el resultado al profesor (o a la competición si
// el enlace lleva &comp=…&cat=…).
//
//   <PantallaReto reto={reto} nombreJuego="Fracciones" emoji="🍰" color="#7b1fa2"
//                 chips={resumen(config)} onEmpezar={…} onLibre={…} onSalir={…} />
export default function PantallaReto({ reto, nombreJuego, emoji = '🎯', color = '#1565C0', chips = [], onEmpezar, onLibre, onSalir, oscuro = false }) {
    const esCompeticion = !!(reto?.compId && reto?.catId);
    const c = oscuro
        ? { fondo: 'rgba(255,255,255,0.06)', borde: '1px solid rgba(255,255,255,0.12)', texto: '#f1f5f9', suave: '#94a3b8', chip: 'rgba(255,255,255,0.1)', chipTxt: '#f1f5f9' }
        : { fondo: 'white', borde: '1px solid #e8edf3', texto: '#2c3e50', suave: '#7f8c8d', chip: `${color}14`, chipTxt: color };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 16px', boxSizing: 'border-box', width: '100%' }}>
            <div style={{ background: c.fondo, border: c.borde, borderRadius: 22, padding: '28px 24px', maxWidth: 440, width: '100%', textAlign: 'center', boxShadow: oscuro ? 'none' : '0 12px 34px rgba(0,0,0,0.12)', fontFamily: "'Segoe UI', sans-serif", boxSizing: 'border-box' }}>
                <div style={{ fontSize: '2.6rem', lineHeight: 1 }}>{emoji}</div>
                <div style={{ color, fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 1, marginTop: 10 }}>🎯 Reto · {nombreJuego}</div>
                <h1 style={{ margin: '6px 0 4px', fontSize: '1.45rem', color: c.texto }}>{reto?.titulo || `Reto de ${nombreJuego}`}</h1>
                <p style={{ color: c.suave, fontSize: '0.86rem', margin: '0 0 16px', lineHeight: 1.5 }}>
                    Tu profesor ya ha preparado la configuración. Solo tienes que jugar y, al terminar, enviar tu resultado.
                </p>

                {chips.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center', marginBottom: 18 }}>
                        {chips.map((ch, i) => (
                            <span key={i} style={{ background: c.chip, color: c.chipTxt, borderRadius: 20, padding: '6px 13px', fontSize: '0.82rem', fontWeight: 700 }}>{ch}</span>
                        ))}
                    </div>
                )}

                {esCompeticion && (
                    <div style={{ background: 'rgba(245,158,11,0.14)', color: '#b45309', borderRadius: 10, padding: '8px 12px', fontSize: '0.8rem', fontWeight: 600, marginBottom: 16 }}>
                        🏆 Prueba de competición · al terminar envía tu puntuación con tu alias y tu contraseña
                    </div>
                )}

                <button onClick={onEmpezar}
                    style={{ width: '100%', background: color, border: 'none', color: 'white', borderRadius: 14, padding: '14px', cursor: 'pointer', fontWeight: 800, fontSize: '1.05rem', boxShadow: `0 6px 18px ${color}55`, fontFamily: 'inherit' }}>
                    ▶ Empezar el reto
                </button>

                <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
                    {onLibre && <button onClick={onLibre} style={{ background: 'none', border: 'none', color: c.suave, cursor: 'pointer', fontSize: '0.84rem', textDecoration: 'underline', fontFamily: 'inherit' }}>Jugar en modo libre</button>}
                    {onSalir && <button onClick={onSalir} style={{ background: 'none', border: 'none', color: c.suave, cursor: 'pointer', fontSize: '0.84rem', textDecoration: 'underline', fontFamily: 'inherit' }}>Salir</button>}
                </div>
            </div>
        </div>
    );
}

/**
 * Botón final de envío que respeta el contexto del reto: en una competición
 * abre el envío a la prueba; si no, el «Enviar al profesor» del propio juego.
 */
export const textoBotonEnvio = (reto) => (reto?.compId && reto?.catId) ? '🏆 Enviar a la competición' : '📤 Enviar al profesor';
