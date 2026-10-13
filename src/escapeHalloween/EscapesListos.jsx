import React, { useState } from 'react';
import LISTOS from './escapesListos.json';
import { infoPrueba } from './bancoEscape';
import { descargarPdfEscape } from './FichasEscape';

/**
 *  Escape rooms LISTOS PARA JUGAR (modo pizarra + fichas): ya montados, con las preguntas congeladas
 *  en escapesListos.json (scripts/generar-escapes-listos.mjs). Sin configurar nada:
 *  1) imprimir la hoja de respuestas (o el cuadernillo)  2) proyectar y jugar.
 */
export default function EscapesListos({ onJugar, onPersonalizar, onAtras }) {
    const [creando, setCreando] = useState('');
    const pdf = async (listo, tipo, soluciones) => {
        const clave = listo.id + tipo + soluciones;
        setCreando(clave);
        try { await descargarPdfEscape(tipo, { config: listo.config, titulo: listo.titulo, soluciones }); }
        catch (e) { alert('No se pudo crear el PDF: ' + e.message); }
        setCreando('');
    };
    const boton = (listo, tipo, soluciones, texto) => {
        const clave = listo.id + tipo + soluciones;
        return <button className="eh-btn2" disabled={!!creando} onClick={() => pdf(listo, tipo, soluciones)}>{creando === clave ? '⏳ Creando PDF…' : texto}</button>;
    };
    const paso = (n, texto) => (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ minWidth: 28, height: 28, borderRadius: '50%', background: '#ff8c1a', color: '#1a0700', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>
            <div style={{ flex: 1 }}>{texto}</div>
        </div>
    );

    return (
        <div style={{ maxWidth: 980, margin: '24px auto', padding: '0 14px 40px', position: 'relative', zIndex: 1 }}>
            <button className="eh-btn2" onClick={onAtras}>← Atrás</button>
            <h2 className="eh-titulo" style={{ fontSize: 'clamp(2rem,5vw,2.8rem)', textAlign: 'center', margin: '14px 0 4px' }}>Listos para jugar</h2>
            <p style={{ textAlign: 'center', opacity: .85, marginTop: 0 }}>Sin configurar nada: imprime las fichas, proyecta la mansión y a jugar. Lo que sale en la pantalla es lo mismo que hay en las fichas.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16, marginTop: 14 }}>
                {LISTOS.map(listo => {
                    const { config } = listo;
                    const nPreg = config.partida.pruebas.reduce((s, p) => s + p.preguntas.length, 0);
                    return (
                        <div key={listo.id} className="eh-panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, borderColor: 'rgba(255,140,26,.6)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ fontSize: '2.6rem' }}>{listo.id === 'PRIMARIA' ? '🎒' : '🎓'}</div>
                                <div>
                                    <div className="eh-titulo" style={{ fontSize: '1.6rem' }}>{listo.id === 'PRIMARIA' ? 'Primaria' : 'ESO'}</div>
                                    <div style={{ fontSize: '.85rem', opacity: .8 }}>{config.pruebas.length} salas · {nPreg} preguntas + {config.partida.batalla.length} en la batalla · {config.minutos} min</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {config.pruebas.map((p, i) => {
                                    const inf = infoPrueba(p, i, config.pruebas);
                                    return <span key={p.id} style={{ padding: '4px 10px', borderRadius: 20, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', fontSize: '.82rem' }}>{inf.emoji} {inf.materia}</span>;
                                })}
                                <span style={{ padding: '4px 10px', borderRadius: 20, background: 'rgba(220,38,38,.2)', border: '1px solid rgba(248,113,113,.4)', fontSize: '.82rem' }}>🧟 Batalla final</span>
                            </div>
                            <div style={{ display: 'grid', gap: 10, fontSize: '.95rem' }}>
                                {paso(1, <>Imprime una <b>hoja de respuestas</b> por alumno (salen dos por folio) o el <b>cuadernillo</b> completo.
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                                        {boton(listo, 'HOJA', false, '📝 Hoja de respuestas')}
                                        {boton(listo, 'CUADERNILLO', false, '📘 Cuadernillo')}
                                    </div></>)}
                                {paso(2, <>Para ti, las soluciones:
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                                        {boton(listo, 'HOJA', true, '✅ Plantilla de corrección')}
                                        {boton(listo, 'CUADERNILLO', true, '✅ Cuadernillo con soluciones')}
                                    </div></>)}
                                {paso(3, <>Proyecta en la pizarra y pulsa <b>Jugar</b>. Tú pasas las preguntas y escribes los códigos que diga la clase.</>)}
                            </div>
                            <button className="eh-btn" style={{ fontSize: '1.15rem', marginTop: 'auto' }} onClick={() => onJugar(config, listo.titulo)}>📽️ Jugar en el monitor</button>
                            <button className="eh-btn2" onClick={() => onPersonalizar(config, listo.titulo)}>✏️ Usarlo como base y personalizarlo</button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
