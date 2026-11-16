// Fichas imprimibles (PDF desde el navegador) de una dinámica de aula:
// ficha del profesor, una ficha por grupo/alumno y tarjetas recortables.
import React from 'react';
import { createPortal } from 'react-dom';
import { AGRUPAMIENTOS, CREDITO, TIPOS_BANCO, textoItem, SORPRESAS } from './dinamicas';

const TINTA = '#1f2937';

const Pie = ({ din }) => (
    <div className="da-pie">
        <span>🎲 PiKT · Dinámicas de aula · {din.nombre}</span>
        <span>✨ {CREDITO} · pikt.es</span>
    </div>
);

const Cabecera = ({ din, materia, titulo, sub, color }) => (
    <div className="da-cab" style={{ background: `linear-gradient(120deg, ${color || din.color}, ${din.color}cc)` }}>
        <div style={{ fontSize: 46, lineHeight: 1 }}>{din.emoji}</div>
        <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.9, letterSpacing: 1, textTransform: 'uppercase' }}>{sub}</div>
            <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>{titulo}</div>
            <div style={{ fontSize: 11, opacity: 0.9 }}>«{din.original}» · {materia.emoji} {materia.nombre}</div>
        </div>
        <div className="da-sello">{CREDITO.replace('Basado en ideas de ', 'Idea de ')}</div>
    </div>
);

const Caja = ({ titulo, emoji, color = '#64748b', children, style }) => (
    <div className="da-caja" style={{ borderColor: color, ...style }}>
        <div className="da-caja-t" style={{ background: color }}>{emoji} {titulo}</div>
        <div style={{ padding: '6px 10px 8px' }}>{children}</div>
    </div>
);

const Lineas = ({ n, alto = 22 }) => Array.from({ length: n }, (_, i) => <div key={i} style={{ height: alto, borderBottom: '1px dashed #cbd5e1' }} />);

const Tabla = ({ cols, filas = 8, anchos, alto = 26, datos = [] }) => (
    <table className="da-tabla">
        <thead><tr>{cols.map((c, i) => <th key={i} style={{ width: anchos?.[i] }}>{c}</th>)}</tr></thead>
        <tbody>{Array.from({ length: filas }, (_, r) => <tr key={r} style={{ height: alto }}>{cols.map((_, k) => <td key={k}>{datos[r]?.[k] ?? ''}</td>)}</tr>)}</tbody>
    </table>
);

const NIVELES = [['🥚', 'Huevo'], ['🐣', 'Pollito'], ['🐔', 'Gallina'], ['🦖', 'Dinosaurio'], ['🐉', 'Dragón']];

// ─────────────────────────── Ficha del profesor ───────────────────────────
export function FichaProfesor({ din, materia, cfg, contenido, equipos, filas, url }) {
    const agr = AGRUPAMIENTOS[din.agrupamiento];
    const qr = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=4&data=${encodeURIComponent(url)}`;
    const conGrupos = equipos.some(e => e.miembros?.length) || filas;
    return (
        <div className="da-hoja da-flujo">
            <Cabecera din={din} materia={materia} titulo={din.nombre} sub="👩‍🏫 Ficha del profesor" />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
                <span className="da-chip">{agr.emoji} {agr.nombre}</span>
                <span className="da-chip">⏱️ {din.minutos} min aprox.</span>
                <span className="da-chip">{materia.emoji} {materia.nombre}</span>
                {(din.ajustes || []).map(a => (
                    <span key={a.k} className="da-chip">⚙️ {a.label}: {a.opciones ? (a.opciones.find(o => o[0] === cfg[a.k])?.[1] || cfg[a.k]) : cfg[a.k]}</span>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                    <Caja titulo="¿En qué consiste?" emoji="💡" color={din.color}><p style={{ margin: 0 }}>{din.resumen}</p></Caja>
                </div>
                <div style={{ width: 118, textAlign: 'center', fontSize: 9, color: '#475569' }}>
                    <img src={qr} alt="QR" style={{ width: 110, height: 110, border: `3px solid ${din.color}`, borderRadius: 10 }} />
                    <div>Escanea o abre el enlace para lanzarla en la PDI</div>
                </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
                <Caja titulo="Material" emoji="🎒" color="#0ea5e9" style={{ flex: 1 }}><ul>{din.material.map((m, i) => <li key={i}>{m}</li>)}</ul></Caja>
                <Caja titulo="Antes de empezar" emoji="🧰" color="#8b5cf6" style={{ flex: 1 }}><ul>{din.preparacion.map((m, i) => <li key={i}>{m}</li>)}</ul></Caja>
            </div>
            <Caja titulo="Paso a paso" emoji="🪜" color="#16a34a">
                <div className="da-pasos">{din.pasos.map((p, i) => <div key={i} className="da-paso"><span style={{ background: din.color }}>{i + 1}</span>{p}</div>)}</div>
            </Caja>
            <div style={{ display: 'flex', gap: 10 }}>
                <Caja titulo="Adaptación por materias" emoji="🌈" color="#f59e0b" style={{ flex: 1.4 }}>
                    <p style={{ margin: '0 0 3px' }}><b>🗣️ Idiomas:</b> {din.variantes.idiomas}</p>
                    <p style={{ margin: '0 0 3px' }}><b>➗ Matemáticas:</b> {din.variantes.mates}</p>
                    <p style={{ margin: 0 }}><b>📚 Otras materias:</b> {din.variantes.otras}</p>
                </Caja>
                <Caja titulo="Consejos" emoji="⭐" color="#ec4899" style={{ flex: 1 }}><ul>{din.consejos.map((m, i) => <li key={i}>{m}</li>)}</ul></Caja>
            </div>
            {conGrupos && (
                <Caja titulo={filas ? 'Filas' : 'Equipos de la sesión'} emoji="👥" color="#334155">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                        {(filas ? filas.map((f, i) => ({ nombre: `Fila ${i ? 'B (rota)' : 'A (fija)'}`, emoji: i ? '🔵' : '🔴', color: i ? '#2563eb' : '#dc2626', miembros: f })) : equipos).map((e, i) => (
                            <div key={i} style={{ border: `2px solid ${e.color}`, borderRadius: 8, padding: '3px 6px' }}>
                                <b style={{ color: e.color }}>{e.emoji} {e.nombre}</b>
                                <div style={{ fontSize: 9.5 }}>{(e.miembros || []).join(', ') || '—'}</div>
                            </div>
                        ))}
                    </div>
                </Caja>
            )}
            <Caja titulo={`Contenido de la sesión · ${TIPOS_BANCO[din.banco].nombre}`} emoji="📋" color="#475569">
                {din.banco === 'retos' ? (
                    <table className="da-tabla"><thead><tr><th style={{ width: 24 }}>#</th><th>Reto</th><th style={{ width: '32%' }}>Solución</th></tr></thead>
                        <tbody>{contenido.map((x, i) => <tr key={i}><td>{i + 1}</td><td>{x.p}</td><td><b>{String(x.r || '—').split('/').join(' · ')}</b></td></tr>)}</tbody></table>
                ) : (
                    <ol className="da-cols">{contenido.map((x, i) => <li key={i}>{textoItem(x)}</li>)}</ol>
                )}
            </Caja>
            <Caja titulo="Observación y evaluación" emoji="📝" color="#0f766e">
                <table className="da-tabla">
                    <thead><tr><th style={{ width: '22%' }}>{din.agrupamiento === 'equipos' ? 'Equipo' : 'Alumno/a'}</th>{din.evaluacion.map((c, i) => <th key={i}>{c}</th>)}<th style={{ width: '16%' }}>Notas</th></tr></thead>
                    <tbody>{Array.from({ length: din.agrupamiento === 'equipos' ? Math.max(equipos.length, 4) : 8 }, (_, r) => (
                        <tr key={r} style={{ height: 22 }}><td>{din.agrupamiento === 'equipos' && equipos[r] ? `${equipos[r].emoji} ${equipos[r].nombre}` : ''}</td>{din.evaluacion.map((_, k) => <td key={k} style={{ textAlign: 'center', color: '#94a3b8' }}>😀 🙂 😐</td>)}<td /></tr>
                    ))}</tbody>
                </table>
                <div style={{ fontSize: 9, color: '#64748b', marginTop: 3 }}>Rodea una carita por criterio. Enlace directo: {url}</div>
            </Caja>
            <Pie din={din} />
        </div>
    );
}

// ─────────────────────────── Ficha de grupo / alumno ───────────────────────────
function HojaEspecifica({ din, contenido, extra }) {
    const txt = contenido.map(textoItem);
    switch (din.hoja) {
        case 'escalera': return (
            <>
                <Caja titulo="Mi recorrido: colorea cada nivel que consigas" emoji="🏅" color={din.color}>
                    <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end' }}>
                        {NIVELES.map(([e, n], i) => (
                            <div key={i} style={{ textAlign: 'center' }}>
                                <div style={{ width: 62 + i * 6, height: 62 + i * 6, borderRadius: '50%', border: `3px dashed ${din.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 + i * 3 }}>{e}</div>
                                <b>{n}</b>
                            </div>
                        ))}
                    </div>
                </Caja>
                <Caja titulo="Preguntas para cada nivel" emoji="💬" color="#0ea5e9">
                    {NIVELES.slice(0, 4).map(([e, n], i) => <p key={i} style={{ margin: '0 0 5px' }}><b>{e} {n}:</b> {txt[i] || '…'}</p>)}
                </Caja>
                <Caja titulo="Mi mejor respuesta" emoji="✍️" color="#16a34a"><Lineas n={4} /></Caja>
            </>
        );
        case 'registro': return (
            <Caja titulo="¿Con quién he hablado?" emoji="💃" color={din.color}>
                <Tabla cols={['Ronda', 'Pregunta', 'Mi pareja', 'Algo que me contó']} anchos={['9%', '33%', '18%']} filas={8} alto={34} datos={txt.slice(0, 8).map((t, i) => [i + 1, t])} />
            </Caja>
        );
        case 'pista': return (
            <>
                <Caja titulo="Nuestra carrera: colorea una casilla cada vez que avancéis" emoji="🚦" color={din.color}>
                    <div style={{ display: 'flex', gap: 4 }}>
                        <div className="da-casilla" style={{ background: '#e2e8f0', fontSize: 9 }}>SALIDA</div>
                        {Array.from({ length: 10 }, (_, i) => <div key={i} className="da-casilla">{i + 1}</div>)}
                        <div className="da-casilla" style={{ fontSize: 22 }}>🏁</div>
                    </div>
                </Caja>
                <Caja titulo="Nuestras respuestas" emoji="✍️" color="#16a34a">
                    <Tabla cols={['Reto', 'Respuesta del equipo', '✔ / ✘']} anchos={['10%', '', '14%']} filas={12} alto={28} datos={Array.from({ length: 12 }, (_, i) => [i + 1])} />
                </Caja>
            </>
        );
        case 'citas': return (
            <Caja titulo="Mis citas" emoji="⏱️" color={din.color}>
                <Tabla cols={['Cita', 'Con quién', 'Pregunta', 'Algo que me contó']} anchos={['8%', '18%', '34%']} filas={10} alto={32} datos={txt.slice(0, 10).map((t, i) => [i + 1, '', t])} />
            </Caja>
        );
        case 'frases': return (
            <Caja titulo="Nuestras frases" emoji="🎭" color={din.color}>
                <Tabla cols={['Ronda', 'Dado', 'Palabra', 'Nuestra frase', 'Puntos']} anchos={['9%', '9%', '18%', '', '11%']} filas={10} alto={34} datos={Array.from({ length: 10 }, (_, i) => [i + 1])} />
                <p style={{ margin: '4px 0 0', fontSize: 10 }}>⚀⚁ = 1 punto · ⚂⚃ = 2 puntos · ⚄⚅ = 3 puntos · ¡Frase correcta = puntos dobles!</p>
            </Caja>
        );
        case 'palitos': return (
            <>
                <Caja titulo="Nuestros palitos (dibuja uno por cada acierto, tacha todos si sale KABOOM)" emoji="🥢" color={din.color}>
                    <div style={{ height: 90, border: '2px dashed #cbd5e1', borderRadius: 10 }} />
                </Caja>
                <Caja titulo="Frases y respuestas" emoji="✍️" color="#16a34a">
                    <Tabla cols={['#', 'Palito', 'Nuestra frase / respuesta', '✔ / ✘']} anchos={['7%', '25%', '', '12%']} filas={10} alto={30} datos={Array.from({ length: 10 }, (_, i) => [i + 1])} />
                </Caja>
            </>
        );
        case 'sobres': return (
            <Caja titulo="Hoja de respuestas de los sobres" emoji="✉️" color={din.color}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {Array.from({ length: 10 }, (_, i) => (
                        <div key={i} style={{ border: `2px solid ${din.color}`, borderRadius: 10, padding: '4px 8px', minHeight: 78, position: 'relative' }}>
                            <b style={{ color: din.color }}>✉️ Sobre {i + 1}</b>
                            <Lineas n={2} alto={20} />
                            <div style={{ position: 'absolute', right: 6, top: 4, width: 34, height: 34, border: '2px dashed #94a3b8', borderRadius: '50%', fontSize: 7, color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>sello</div>
                        </div>
                    ))}
                </div>
            </Caja>
        );
        case 'pistas': return (
            <>
                <Caja titulo="Estructuras para dar pistas" emoji="💡" color={din.color}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{(extra.pistas || []).map((p, i) => <span key={i} className="da-burbuja">{p}</span>)}</div>
                    <p style={{ margin: '6px 0 0' }}>🚫 Prohibido decir la palabra, traducirla o deletrearla.</p>
                </Caja>
                <Caja titulo="Palabras acertadas" emoji="🔥" color="#16a34a">
                    <Tabla cols={['Turno', '¿Quién se sentó?', 'Palabras acertadas', 'La mejor pista que dimos']} anchos={['9%', '20%', '28%']} filas={8} alto={36} datos={Array.from({ length: 8 }, (_, i) => [i + 1])} />
                </Caja>
            </>
        );
        case 'dado': return (
            <>
                <Caja titulo="Tabla del dado" emoji="🎲" color={din.color}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {txt.slice(0, 6).map((t, i) => <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', border: `2px solid ${din.color}55`, borderRadius: 10, padding: '4px 8px' }}><span className="da-num" style={{ background: din.color }}>{i + 1}</span>{t}</div>)}
                    </div>
                </Caja>
                {extra.piezas && (
                    <Caja titulo="Ruleta de frase: combina una pieza de cada columna" emoji="🎰" color="#2563eb">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, fontSize: 10.5 }}>
                            {[['Sujeto', extra.piezas.sujetos], ['Tiempo verbal', extra.piezas.tiempos], ['Complemento', extra.piezas.complementos]].map(([t, l]) => (
                                <div key={t}><b>{t}</b>{l.map((x, i) => <div key={i}>{i + 1}. {x}</div>)}</div>
                            ))}
                        </div>
                    </Caja>
                )}
                <Caja titulo="Nuestras frases" emoji="✍️" color="#16a34a">
                    <Tabla cols={['Tirada', 'Nº', 'Frase', '✔']} anchos={['10%', '8%', '', '9%']} filas={extra.piezas ? 7 : 10} alto={30} datos={Array.from({ length: 10 }, (_, i) => [i + 1])} />
                </Caja>
            </>
        );
        case 'marcador': return (
            <>
                <Caja titulo="Nuestro marcador" emoji="🎁" color={din.color}>
                    <Tabla cols={['Turno', 'Casilla', 'Respuesta', 'Puntos', 'Sorpresa', 'Total']} anchos={['9%', '10%', '', '11%', '16%', '11%']} filas={10} alto={30} datos={Array.from({ length: 10 }, (_, i) => [i + 1])} />
                </Caja>
                <Caja titulo="Sorpresas del tablero" emoji="✨" color="#f59e0b">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>{Object.values(SORPRESAS).map(s => <div key={s.nombre}><b>{s.emoji} {s.nombre}:</b> {s.texto}</div>)}</div>
                </Caja>
            </>
        );
        default: return null;
    }
}

export function FichaGrupo({ din, materia, contenido, extra, equipo, indice, porAlumno }) {
    const miembros = equipo?.miembros || [];
    return (
        <div className="da-hoja">
            <Cabecera din={din} materia={materia} color={equipo?.color}
                titulo={porAlumno ? din.nombre : `${equipo.emoji} Equipo ${equipo.nombre}`}
                sub={porAlumno ? `🧒 Ficha del alumno/a · ${indice + 1}` : `👥 Ficha de equipo · ${din.nombre}`} />
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <Caja titulo={porAlumno ? 'Me llamo' : 'Somos'} emoji={porAlumno ? '🙋' : equipo.emoji} color={equipo?.color || din.color} style={{ flex: 1 }}>
                    {miembros.length && !porAlumno
                        ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{miembros.map((m, i) => <span key={i} className="da-burbuja">{m}</span>)}</div>
                        : <Lineas n={porAlumno ? 1 : 3} />}
                    <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 10 }}><span>Curso: ________</span><span>Fecha: ____/____/______</span></div>
                </Caja>
                <Caja titulo="¿Cómo se juega?" emoji="🎮" color={din.color} style={{ flex: 1.5 }}>
                    <div className="da-reglas">{din.reglasAlumno.map((r, i) => <div key={i}><span className="da-num" style={{ background: din.color }}>{i + 1}</span>{r}</div>)}</div>
                </Caja>
            </div>
            <HojaEspecifica din={din} contenido={contenido} extra={extra} />
            <Caja titulo="¿Qué tal ha ido?" emoji="🌟" color="#64748b">
                <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: 11 }}>
                    <span>Hemos hablado en la lengua / con el vocabulario del tema: 😀 🙂 😐</span>
                    <span>Hemos respetado los turnos: 😀 🙂 😐</span>
                    <span>Lo hemos pasado: 🤩 😀 🙂</span>
                </div>
            </Caja>
            <Pie din={din} />
        </div>
    );
}

// ─────────────────────────── Tarjetas recortables ───────────────────────────
function DesarrolloDado({ din, contenido }) {
    const caras = contenido.slice(0, 6).map(textoItem);
    const pos = { 1: [1, 0], 2: [0, 1], 3: [1, 1], 4: [2, 1], 5: [3, 1], 6: [1, 2] };
    const L = 150;
    return (
        <div style={{ position: 'relative', width: L * 4, height: L * 3, margin: '10px auto' }}>
            {Object.entries(pos).map(([n, [x, y]]) => (
                <div key={n} style={{ position: 'absolute', left: x * L, top: y * L, width: L, height: L, border: '2px solid #1f2937', boxSizing: 'border-box', background: `${din.color}18`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 8 }}>
                    <div style={{ fontSize: 40, fontWeight: 900, color: din.color, lineHeight: 1 }}>{n}</div>
                    <div style={{ fontSize: 10, fontWeight: 700 }}>{caras[n - 1] || ''}</div>
                </div>
            ))}
            {/* pestañas para pegar */}
            {[[1, 0, 'l'], [1, 0, 'r'], [1, 2, 'l'], [1, 2, 'r'], [3, 1, 't'], [3, 1, 'b'], [0, 1, 't']].map(([x, y, lado], i) => {
                const s = { position: 'absolute', background: '#e2e8f0', border: '1px dashed #64748b', boxSizing: 'border-box' };
                if (lado === 'l') Object.assign(s, { left: x * L - 22, top: y * L + 15, width: 22, height: L - 30 });
                if (lado === 'r') Object.assign(s, { left: (x + 1) * L, top: y * L + 15, width: 22, height: L - 30 });
                if (lado === 't') Object.assign(s, { left: x * L + 15, top: y * L - 22, width: L - 30, height: 22 });
                if (lado === 'b') Object.assign(s, { left: x * L + 15, top: (y + 1) * L, width: L - 30, height: 22 });
                return <div key={i} style={s} />;
            })}
        </div>
    );
}

export function Tarjetas({ din, materia, contenido, cfg, equipos }) {
    let tarjetas = [];
    let estilo = 'tarjeta';
    if (din.banco === 'estructuras') {
        return (
            <div className="da-hoja">
                <Cabecera din={din} materia={materia} titulo="Dado para recortar y montar" sub="✂️ Recortables" />
                <p style={{ textAlign: 'center', margin: '6px 0' }}>Recorta por el borde, dobla por las líneas y pega las pestañas grises. ¡Un dado por grupo!</p>
                <DesarrolloDado din={din} contenido={contenido} />
                <Pie din={din} />
            </div>
        );
    }
    if (din.id === 'kaboom') {
        estilo = 'palito';
        tarjetas = [...contenido.map(x => ({ t: textoItem(x) })), ...Array.from({ length: cfg.kabooms || 4 }, () => ({ t: '💥 KABOOM 💥', k: true }))];
    } else if (din.id === 'sobres') {
        estilo = 'sobre';
        const retos = contenido.slice(0, 10);
        (equipos.length ? equipos : [{ nombre: '', emoji: '' }]).forEach(e => retos.forEach((x, i) => tarjetas.push({ t: textoItem(x), n: i + 1, e })));
    } else {
        tarjetas = contenido.map((x, i) => ({ t: textoItem(x), n: i + 1 }));
    }
    const porHoja = estilo === 'palito' ? 16 : 12;
    const hojas = [];
    for (let i = 0; i < tarjetas.length; i += porHoja) hojas.push(tarjetas.slice(i, i + porHoja));
    return hojas.map((h, k) => (
        <div key={k} className="da-hoja">
            <Cabecera din={din} materia={materia} titulo={estilo === 'sobre' ? 'Retos para meter en los sobres' : estilo === 'palito' ? 'Palitos para el bote' : 'Tarjetas para recortar'} sub={`✂️ Recortables · hoja ${k + 1} de ${hojas.length}`} />
            <div className={`da-rejilla da-${estilo}s`}>
                {h.map((x, i) => (
                    <div key={i} className={`da-${estilo}`} style={{ borderColor: x.k ? '#dc2626' : din.color, background: x.k ? '#fee2e2' : 'white' }}>
                        {estilo === 'sobre' && <div style={{ fontSize: 10, fontWeight: 800, color: x.e.color || din.color }}>✉️ Sobre {x.n} {x.e.emoji} {x.e.nombre}</div>}
                        {estilo === 'tarjeta' && <div style={{ fontSize: 9, color: '#94a3b8' }}>{din.emoji} {x.n}</div>}
                        <div style={{ fontWeight: 800, fontSize: din.banco === 'palabras' ? 20 : 13, color: x.k ? '#b91c1c' : TINTA }}>{x.t}</div>
                    </div>
                ))}
            </div>
            <Pie din={din} />
        </div>
    ));
}

// ─────────────────────────── Portal de impresión ───────────────────────────
export const CSS_IMPRESION = `
.da-print { display: none; }
@media print {
    @page { size: A4; margin: 9mm; }
    html, body { background: #fff !important; }
    body * { visibility: hidden !important; }
    .da-print, .da-print * { visibility: visible !important; }
    .da-print { display: block !important; position: absolute; left: 0; top: 0; width: 100%; }
    .da-print * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
.da-print { font-family: 'Fredoka', 'Nunito', 'Segoe UI', system-ui, sans-serif; color: ${TINTA}; font-size: 11.5px; line-height: 1.35; }
.da-hoja { break-after: page; page-break-after: always; position: relative; padding-bottom: 26px; min-height: 270mm; box-sizing: border-box; }
.da-hoja.da-flujo { min-height: 0; }
.da-hoja:last-child { break-after: auto; page-break-after: auto; }
.da-cab { display: flex; gap: 12px; align-items: center; color: white; border-radius: 16px; padding: 10px 14px; position: relative; overflow: hidden; }
.da-cab::after { content: ''; position: absolute; right: -30px; top: -40px; width: 140px; height: 140px; border-radius: 50%; background: rgba(255,255,255,0.15); }
.da-sello { background: white; color: ${TINTA}; border-radius: 999px; padding: 4px 10px; font-size: 9px; font-weight: 700; transform: rotate(-4deg); z-index: 1; white-space: nowrap; }
.da-caja { border: 2px solid; border-radius: 12px; margin-top: 8px; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
.da-caja-t { color: white; font-weight: 800; padding: 3px 10px; font-size: 12px; }
.da-caja ul, .da-caja ol { margin: 0; padding-left: 18px; }
.da-chip { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 999px; padding: 2px 9px; font-size: 10px; font-weight: 700; }
.da-pasos { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; }
.da-paso { display: flex; gap: 6px; align-items: flex-start; }
.da-paso span, .da-num { color: white; border-radius: 50%; min-width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-size: 10px; flex-shrink: 0; margin-right: 4px; }
.da-reglas > div { display: flex; align-items: flex-start; margin-bottom: 3px; }
.da-burbuja { background: #f1f5f9; border: 1.5px solid #cbd5e1; border-radius: 999px; padding: 2px 10px; font-weight: 700; }
.da-tabla { width: 100%; border-collapse: collapse; font-size: 10.5px; }
.da-tabla th { background: #f1f5f9; border: 1px solid #94a3b8; padding: 3px 5px; text-align: left; }
.da-tabla td { border: 1px solid #cbd5e1; padding: 2px 5px; vertical-align: top; }
.da-cols { columns: 2; column-gap: 20px; }
.da-casilla { flex: 1; height: 40px; border: 2px solid #94a3b8; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; }
.da-pie { position: absolute; bottom: 0; left: 0; right: 0; display: flex; justify-content: space-between; font-size: 9px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 4px; }
.da-rejilla { display: grid; gap: 0; margin-top: 10px; }
.da-tarjetas, .da-sobres { grid-template-columns: repeat(3, 1fr); }
.da-palitos { grid-template-columns: repeat(2, 1fr); }
.da-tarjeta, .da-sobre, .da-palito { border: 2px dashed; margin: 3px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 8px; box-sizing: border-box; }
.da-tarjeta, .da-sobre { height: 52mm; }
.da-palito { height: 13mm; flex-direction: row; gap: 8px; border-radius: 999px; }
`;

export default function ImpresionDinamica({ din, materia, cfg, contenido, extra, equipos, filas, opciones, url }) {
    const porAlumno = din.agrupamiento === 'parejas' || din.agrupamiento === 'filas';
    const fichasGrupo = porAlumno
        ? Array.from({ length: Math.max(1, opciones.copias || 1) }, (_, i) => ({ i }))
        : equipos.map((e, i) => ({ e, i }));
    return createPortal(
        <div className="da-print">
            {opciones.profe && <FichaProfesor din={din} materia={materia} cfg={cfg} contenido={contenido} equipos={equipos} filas={filas} url={url} />}
            {opciones.grupos && fichasGrupo.map(({ e, i }) => (
                <FichaGrupo key={i} din={din} materia={materia} contenido={contenido} extra={extra} equipo={e || { color: din.color }} indice={i} porAlumno={porAlumno} />
            ))}
            {opciones.tarjetas && <Tarjetas din={din} materia={materia} contenido={contenido} cfg={cfg} equipos={equipos} />}
        </div>,
        document.body,
    );
}
