import { useState, useRef } from 'react';
import { db } from './firebase';
import { doc, addDoc, collection, query, where, getDocs, updateDoc, getCountFromServer } from 'firebase/firestore';
import Confetti from 'react-confetti';
import { Save, CircleDollarSign, Mic, Type, Skull, Trophy, Crown, Medal, User } from 'lucide-react';

// --- CONFIGURACIÓN DE LA RULETA (13 GAJOS) ---
const SEGMENTOS = [
    { texto: '50', valor: 50, color: '#e67e22', tipo: 'PUNTOS' },
    { texto: '100', valor: 100, color: '#f1c40f', tipo: 'PUNTOS' },
    { texto: '150', valor: 150, color: '#2ecc71', tipo: 'PUNTOS' },
    { texto: 'QUIEBRA', valor: 0, color: '#000000', textCol: 'white', tipo: 'QUIEBRA' },
    { texto: '200', valor: 200, color: '#e74c3c', tipo: 'PUNTOS' },
    { texto: '50', valor: 50, color: '#9b59b6', tipo: 'PUNTOS' },
    { texto: '100', valor: 100, color: '#3498db', tipo: 'PUNTOS' },
    { texto: '150', valor: 150, color: '#1abc9c', tipo: 'PUNTOS' },
    { texto: 'QUIEBRA', valor: 0, color: '#000000', textCol: 'white', tipo: 'QUIEBRA' },
    { texto: '50', valor: 50, color: '#f39c12', tipo: 'PUNTOS' },
    { texto: '200', valor: 200, color: '#d35400', tipo: 'PUNTOS' },
    { texto: '100', valor: 100, color: '#8e44ad', tipo: 'PUNTOS' },
    { texto: '50', valor: 50, color: '#27ae60', tipo: 'PUNTOS' }
];

const NUM_SEGMENTOS = SEGMENTOS.length;
const ANGLE_PER_SEGMENT = 360 / NUM_SEGMENTOS;
const PRECIO_VOCAL = 50;
const BONO_RESOLVER = 250; // Premio extra por resolver

// --- UTILS ---
const clean = (t) => t ? t.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "") : "";
const esVocal = (letra) => "aeiouáéíóú".includes(letra.toLowerCase());

export default function RuletaGame({ recurso, usuario, alTerminar }) {
    // ESTADOS
    const [fase, setFase] = useState('SETUP');
    const [jugadores, setJugadores] = useState([]);
    const [turno, setTurno] = useState(0);
    const [mensajeCentral, setMensajeCentral] = useState('');

    // Ruleta
    const [rotacion, setRotacion] = useState(0);
    const [girando, setGirando] = useState(false);
    const [valorActual, setValorActual] = useState(0);

    // Pregunta
    const [preguntaActual, setPreguntaActual] = useState(null);
    const [colaPreguntas, setColaPreguntas] = useState([]);
    const [todasLasPreguntas, setTodasLasPreguntas] = useState([]);
    const [feedbackPregunta, setFeedbackPregunta] = useState(null);
    const [textoRespuesta, setTextoRespuesta] = useState('');

    // Panel
    const [fraseOculta, setFraseOculta] = useState('');
    const [letrasDichas, setLetrasDichas] = useState([]);
    const [inputLetra, setInputLetra] = useState('');
    const [modoPanel, setModoPanel] = useState(null);
    const [inputResolver, setInputResolver] = useState('');

    const procesandoRef = useRef(false);

    // --- SETUP ---
    const iniciar = (nombres) => {
        let pool = [];
        if (recurso.hojas) recurso.hojas.forEach(h => pool.push(...h.preguntas));
        setTodasLasPreguntas(pool);
        setColaPreguntas([...pool].sort(() => Math.random() - 0.5));

        const frase = recurso.hojas && recurso.hojas[0].frase ? recurso.hojas[0].frase.toUpperCase() : "PANEL DE EJEMPLO";
        setFraseOculta(frase);
        setLetrasDichas([]);

        const colors = ['#3498db', '#e74c3c', '#2ecc71'];
        const nuevosJugadores = nombres.map((nombre, i) => ({
            nombre: nombre,
            puntos: 0,
            color: colors[i % 3]
        }));

        setJugadores(nuevosJugadores);
        setTurno(0);
        setRotacion(0);
        setFase('GIRO');
        procesandoRef.current = false;
    };

    // --- GIRO ---
    const girarRuleta = () => {
        if (girando || procesandoRef.current) return;
        setGirando(true);
        procesandoRef.current = true;
        setMensajeCentral('');

        const indexGanador = Math.floor(Math.random() * NUM_SEGMENTOS);
        const segmentoGanador = SEGMENTOS[indexGanador];

        const anguloCentroGajo = (indexGanador * ANGLE_PER_SEGMENT) + (ANGLE_PER_SEGMENT / 2);
        const vueltas = 5 + Math.floor(Math.random() * 3);
        const extraGiro = vueltas * 360;
        const rotacionObjetivo = extraGiro + (270 - anguloCentroGajo);

        setRotacion(prev => {
            const actualNormalizado = prev % 360;
            let distancia = rotacionObjetivo - actualNormalizado;
            while (distancia < extraGiro) distancia += 360;
            return prev + distancia;
        });

        setTimeout(() => {
            setGirando(false);
            procesandoRef.current = false;
            procesarTirada(segmentoGanador);
        }, 4000);
    };

    const procesarTirada = (segmento) => {
        if (segmento.tipo === 'QUIEBRA') {
            setMensajeCentral(`☠️ ${jugadores[turno].nombre} lo pierde todo.`);
            setJugadores(prev => prev.map((j, i) => i === turno ? { ...j, puntos: 0 } : j));
            setTimeout(siguienteTurno, 2000);
        } else {
            setValorActual(segmento.valor);
            setMensajeCentral(`¡Juegas por ${segmento.valor}€!`);
            setTimeout(cargarNuevaPregunta, 1500);
        }
    };

    // --- PREGUNTAS ---
    const cargarNuevaPregunta = () => {
        let nuevaCola = [...colaPreguntas];
        if (nuevaCola.length === 0) nuevaCola = [...todasLasPreguntas].sort(() => Math.random() - 0.5);

        const p = nuevaCola[0] || { pregunta: "¿Listo para resolver?", respuesta: "si", incorrectas: [] };
        setColaPreguntas(nuevaCola.slice(1));
        setPreguntaActual(p);
        setTextoRespuesta('');
        setFeedbackPregunta(null);
        setFase('PREGUNTA');
        setMensajeCentral('');
    };

    const verificarPregunta = (respUser, esMultiple = false) => {
        if (procesandoRef.current) return;
        procesandoRef.current = true;

        const correcta = preguntaActual.respuesta || preguntaActual.correcta;
        const acierto = esMultiple ? (respUser === correcta) : (clean(respUser) === clean(correcta));

        if (acierto) {
            setFeedbackPregunta('CORRECTO');
            setTimeout(() => {
                procesandoRef.current = false;
                setFase('PANEL');
                setModoPanel(null);
            }, 1000);
        } else {
            setFeedbackPregunta('INCORRECTO');
            setMensajeCentral(`Respuesta: ${correcta}`);
            setTimeout(() => {
                procesandoRef.current = false;
                siguienteTurno();
            }, 2500);
        }
    };

    // --- PANEL ---
    const intentarConsonante = () => {
        if (procesandoRef.current) return;
        const l = inputLetra.toLowerCase();

        if (!l || esVocal(l)) return alert("Introduce una CONSONANTE.");
        if (letrasDichas.includes(l)) return alert("Esa letra ya está dicha.");

        procesandoRef.current = true;
        setLetrasDichas(prev => [...prev, l]);

        const matches = clean(fraseOculta).split('').filter(c => c === clean(l)).length;

        if (matches > 0) {
            const ganado = parseInt(valorActual) * matches;
            setJugadores(prev => prev.map((j, i) => {
                if (i === turno) return { ...j, puntos: j.puntos + ganado };
                return j;
            }));
            setMensajeCentral(`¡Hay ${matches}! Ganaste ${ganado}€`);
            setTimeout(() => { procesandoRef.current = false; setFase('GIRO'); }, 2000);
        } else {
            setMensajeCentral("Esa letra no está.");
            setTimeout(() => { procesandoRef.current = false; siguienteTurno(); }, 2000);
        }
        setInputLetra('');
        setModoPanel(null);
    };

    const comprarVocal = () => {
        if (procesandoRef.current) return;
        if (jugadores[turno].puntos < PRECIO_VOCAL) return alert(`Necesitas ${PRECIO_VOCAL}€.`);
        const l = inputLetra.toLowerCase();
        if (!l || !esVocal(l)) return alert("Introduce una VOCAL.");
        if (letrasDichas.includes(l)) return alert("Esa vocal ya está dicha.");

        procesandoRef.current = true;
        setJugadores(prev => prev.map((j, i) => i === turno ? { ...j, puntos: j.puntos - PRECIO_VOCAL } : j));
        setLetrasDichas(prev => [...prev, l]);

        const matches = clean(fraseOculta).split('').filter(c => c === clean(l)).length;
        if (matches > 0) {
            setMensajeCentral(`¡Hay ${matches}!`);
            setTimeout(() => { procesandoRef.current = false; setModoPanel(null); }, 1500);
        } else {
            setMensajeCentral("Esa vocal no está.");
            setTimeout(() => { procesandoRef.current = false; siguienteTurno(); }, 2000);
        }
        setInputLetra('');
    };

    // --- RESOLVER PANEL (CON BONO) ---
    const resolverPanel = (e) => {
        e.preventDefault();
        if (procesandoRef.current) return;
        procesandoRef.current = true;

        if (clean(inputResolver) === clean(fraseOculta)) {
            // 1. Revelar panel
            setLetrasDichas("abcdefghijklmnñopqrstuvwxyz".split(''));

            // 2. Sumar bono al ganador
            setJugadores(prev => prev.map((j, i) => {
                if (i === turno) return { ...j, puntos: j.puntos + BONO_RESOLVER };
                return j;
            }));
            setMensajeCentral(`¡CORRECTO! +${BONO_RESOLVER}€`);

            // 3. Terminar
            setTimeout(() => {
                setFase('FIN');
                procesandoRef.current = false;
            }, 2000);
        } else {
            setMensajeCentral("Incorrecto.");
            setTimeout(() => {
                procesandoRef.current = false;
                siguienteTurno();
            }, 2000);
        }
    };

    const siguienteTurno = () => {
        setFase('GIRO');
        setMensajeCentral('');
        setModoPanel(null);
        setFeedbackPregunta(null);
        if (jugadores.length > 1) setTurno(prev => (prev + 1) % jugadores.length);
        procesandoRef.current = false;
    };

    const guardarRecord = async () => {
        if (jugadores.length > 1) return;
        try {
            const pts = jugadores[0].puntos;
            const rankingRef = collection(db, 'ranking');
            const qRanking = query(rankingRef, where('recursoId', '==', recurso.id), where('tipoJuego', '==', 'RULETA'), where('aciertos', '>', pts));
            const snapshotRanking = await getCountFromServer(qRanking);
            const miPosicion = snapshotRanking.data().count + 1;

            let medallaReal = '';
            if (miPosicion === 1) medallaReal = '🥇';
            else if (miPosicion === 2) medallaReal = '🥈';
            else if (miPosicion === 3) medallaReal = '🥉';

            const qExistente = query(rankingRef, where('recursoId', '==', recurso.id), where('tipoJuego', '==', 'RULETA'), where('email', '==', usuario.email));
            const snapExistente = await getDocs(qExistente);

            if (!snapExistente.empty) {
                const docRef = snapExistente.docs[0];
                if (pts > docRef.data().aciertos) {
                    await updateDoc(doc(db, 'ranking', docRef.id), { aciertos: pts, fecha: new Date(), medalla: medallaReal });
                    alert(`🚀 ¡Nuevo Récord! Posición: ${miPosicion} ${medallaReal}`);
                } else alert(`⚠️ No superaste tu récord.`);
            } else {
                await addDoc(rankingRef, {
                    recursoId: recurso.id, recursoTitulo: recurso.titulo, tipoJuego: 'RULETA', juego: 'Ruleta', categoria: 'General', email: usuario.email, jugador: usuario.displayName, aciertos: pts, fecha: new Date(), medalla: medallaReal
                });
                alert(`✅ Guardado. ¡Posición ${miPosicion}! ${medallaReal}`);
            }
            alTerminar();
        } catch (e) { alert("Error guardando."); }
    };

    if (fase === 'SETUP') return <SetupScreen recurso={recurso} onStart={iniciar} onExit={alTerminar} usuario={usuario} />;

    return (
        <div className="ruleta-container">
            <EstilosRuleta />

            {/* PANEL */}
            <div className="tablero-marco">
                <div className="tablero-grid">
                    {fraseOculta.split('').map((char, i) => {
                        if (char === ' ') return <div key={i} className="celda-vacia"></div>;
                        const visible = letrasDichas.includes(char.toLowerCase()) || fase === 'FIN';
                        return (
                            <div key={i} className={`celda ${visible ? 'revelada' : 'oculta'}`}>
                                <div className="celda-inner">
                                    <div className="celda-front"></div>
                                    <div className="celda-back">{char}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* HUD */}
            <div className="hud-jugadores">
                {jugadores.map((j, i) => (
                    <div key={i} className={`card-jugador ${i === turno ? 'activo' : ''}`} style={{ borderColor: j.color }}>
                        <div className="nombre" style={{ background: j.color }}>{j.nombre}</div>
                        <div className="puntos">{j.puntos} €</div>
                    </div>
                ))}
            </div>

            <div className="zona-accion">
                {/* RULETA SVG */}
                {fase === 'GIRO' && (
                    <div className="ruleta-wrapper">
                        <div className="flecha-indicador">▼</div>
                        <svg className="ruleta-svg" viewBox="0 0 100 100" style={{ transform: `rotate(${rotacion}deg)` }}>
                            {SEGMENTOS.map((seg, i) => {
                                const startAngle = i * ANGLE_PER_SEGMENT;
                                const endAngle = (i + 1) * ANGLE_PER_SEGMENT;
                                const x1 = 50 + 50 * Math.cos(Math.PI * startAngle / 180);
                                const y1 = 50 + 50 * Math.sin(Math.PI * startAngle / 180);
                                const x2 = 50 + 50 * Math.cos(Math.PI * endAngle / 180);
                                const y2 = 50 + 50 * Math.sin(Math.PI * endAngle / 180);
                                const pathData = `M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`;
                                const midAngle = startAngle + (ANGLE_PER_SEGMENT / 2);
                                const tx = 50 + 38 * Math.cos(Math.PI * midAngle / 180);
                                const ty = 50 + 38 * Math.sin(Math.PI * midAngle / 180);
                                return (
                                    <g key={i}>
                                        <path d={pathData} fill={seg.color} stroke="#fff" strokeWidth="0.5" />
                                        <text x={tx} y={ty} fill={seg.textCol || "white"} fontSize="4.5" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${midAngle + 90}, ${tx}, ${ty})`}>
                                            {seg.tipo === 'QUIEBRA' ? '☠️' : seg.texto}
                                        </text>
                                    </g>
                                );
                            })}
                            <circle cx="50" cy="50" r="8" fill="#fff" stroke="#ccc" strokeWidth="1" />
                            <text x="50" y="52" fontSize="2.5" textAnchor="middle" fontWeight="bold" fill="#333">TIRAR</text>
                        </svg>
                        <button className="boton-invisible" onClick={girarRuleta} disabled={girando}></button>
                    </div>
                )}

                {/* MODAL PREGUNTA */}
                {fase === 'PREGUNTA' && preguntaActual && (
                    <div className="modal-accion">
                        <div className="modal-header" style={{ background: '#3498db' }}>JUEGAS POR {valorActual} €</div>
                        <div className="modal-body">
                            <p className="pregunta-texto">{preguntaActual.pregunta}</p>
                            {(preguntaActual.incorrectas && preguntaActual.incorrectas.length > 0 && preguntaActual.incorrectas[0] !== "") ? (
                                <div className="opciones-grid">
                                    {mezclar(preguntaActual).map((op, k) => (
                                        <button key={k} className={`btn-opcion ${feedbackPregunta ? (op === (preguntaActual.respuesta || preguntaActual.correcta) ? 'verde' : 'rojo') : ''}`} onClick={() => verificarPregunta(op, true)} disabled={!!feedbackPregunta}>{op}</button>
                                    ))}
                                </div>
                            ) : (
                                    <div className="input-row">
                                        <input autoFocus value={textoRespuesta} onChange={e => setTextoRespuesta(e.target.value)} placeholder="Tu respuesta..." disabled={!!feedbackPregunta} />
                                        <button onClick={() => verificarPregunta(textoRespuesta, false)}>ENVIAR</button>
                                    </div>
                                )}
                            {feedbackPregunta === 'CORRECTO' && <div className="tick-animado">✅</div>}
                            {feedbackPregunta === 'INCORRECTO' && <div className="aviso-fallo">Respuesta correcta: {preguntaActual.respuesta || preguntaActual.correcta}</div>}
                        </div>
                    </div>
                )}

                {/* PANEL CONTROLES */}
                {fase === 'PANEL' && (
                    <div className="panel-controles">
                        {!modoPanel ? (
                            <div className="botones-accion">
                                <button onClick={() => setModoPanel('CONSONANTE')} className="btn-consonante"><Mic /> Consonante</button>
                                <button onClick={() => setModoPanel('VOCAL')} className="btn-vocal" disabled={jugadores[turno].puntos < PRECIO_VOCAL}><CircleDollarSign /> Vocal ({PRECIO_VOCAL}€)</button>
                                <button onClick={() => setModoPanel('RESOLVER')} className="btn-resolver"><Type /> Resolver</button>
                            </div>
                        ) : (
                                <div className="input-panel">
                                    {modoPanel === 'CONSONANTE' && (<div><h3>Di una Consonante:</h3><input autoFocus maxLength={1} value={inputLetra} onChange={e => setInputLetra(e.target.value.toUpperCase())} /><button onClick={intentarConsonante} disabled={procesandoRef.current}>Jugar</button></div>)}
                                    {modoPanel === 'VOCAL' && (<div><h3>Comprar Vocal ({PRECIO_VOCAL}€):</h3><input autoFocus maxLength={1} value={inputLetra} onChange={e => setInputLetra(e.target.value.toUpperCase())} /><button onClick={comprarVocal} disabled={procesandoRef.current}>Comprar</button></div>)}
                                    {modoPanel === 'RESOLVER' && (<form onSubmit={resolverPanel}><h3>Resolver Panel:</h3><input autoFocus value={inputResolver} onChange={e => setInputResolver(e.target.value)} placeholder="Escribe la frase exacta..." style={{ width: '300px' }} /><button type="submit" disabled={procesandoRef.current}>¡RESOLVER!</button></form>)}
                                    <button className="btn-cancelar" onClick={() => setModoPanel(null)}>Atrás</button>
                                </div>
                            )}
                    </div>
                )}
                {mensajeCentral && <div className="mensaje-flotante">{mensajeCentral}</div>}
            </div>

            {/* FIN - PANTALLA PREMIUM CON PODIO */}
            {fase === 'FIN' && (
                <div className="overlay-fin">
                    <Confetti recycle={false} />
                    <div className="card-fin-premium">
                        <div className="header-fin">
                            <Trophy size={60} color="#f1c40f" className="trophy-icon" />
                            <h1>¡PANEL RESUELTO!</h1>
                        </div>
                        <h2 className="frase-final">"{fraseOculta}"</h2>
                        <div className="podio-container">
                            {(() => {
                                const ranking = [...jugadores].sort((a, b) => b.puntos - a.puntos);
                                const podiumData = [ranking[1], ranking[0], ranking[2]].filter(x => x !== undefined);
                                return podiumData.map((j, i) => {
                                    const rankReal = ranking.indexOf(j);
                                    let altura = '120px';
                                    if (rankReal === 0) altura = '160px';
                                    if (rankReal === 2) altura = '90px';

                                    return (
                                        <div key={i} className={`pedestal-wrapper rank-${rankReal + 1}`}>
                                            <div className="avatar-flotante" style={{ borderColor: j.color }}>
                                                {rankReal === 0 && <Crown size={30} className="corona-icon" />}
                                                {rankReal === 1 && <Medal size={24} className="medalla-silver" />}
                                                {rankReal === 2 && <Medal size={24} className="medalla-bronze" />}
                                                <User size={30} color={j.color} />
                                            </div>
                                            <div className="pedestal-bloque" style={{ height: altura }}>
                                                <div className="p-nombre">{j.nombre}</div>
                                                <div className="p-puntos">{j.puntos} €</div>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                        <div className="botones-fin">
                            {jugadores.length === 1 && (
                                <button className="btn-save-premium" onClick={guardarRecord}>
                                    <Save size={20} /> Guardar mi Récord
                                </button>
                            )}
                            <button className="btn-salir-premium" onClick={alTerminar}>Salir</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- SUBCOMPONENTES ---
const SetupScreen = ({ recurso, onStart, onExit, usuario }) => {
    const [nombres, setNombres] = useState(['Jugador 1', 'Jugador 2', 'Jugador 3']);
    const [num, setNum] = useState(1);
    const arrancar = () => onStart(num === 1 ? [usuario.displayName] : nombres.slice(0, num));
    return (
        <div className="setup-overlay">
            <div className="setup-card">
                <h1>🎡 La Ruleta</h1>
                <p>{recurso.titulo}</p>
                <div className="selector-jugadores">
                    {[1, 2, 3].map(n => <button key={n} className={num === n ? 'selected' : ''} onClick={() => setNum(n)}>{n} Jugador{n > 1 ? 'es' : ''}</button>)}
                </div>
                {num > 1 && <div className="inputs-nombres">{Array.from({ length: num }).map((_, i) => <input key={i} value={nombres[i]} onChange={e => { const c = [...nombres]; c[i] = e.target.value; setNombres(c); }} />)}</div>}
                <button className="btn-start" onClick={arrancar}>¡A JUGAR!</button>
                <button className="btn-close" onClick={onExit}>Volver</button>
            </div>
            <EstilosRuleta />
        </div>
    );
};

const mezclar = (p) => [p.respuesta || p.correcta, ...(p.incorrectas || [])].sort(() => Math.random() - 0.5);

const EstilosRuleta = () => (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Righteous&family=Roboto:wght@400;700&display=swap');
        .ruleta-container { width: 100vw; height: 100vh; background: #1e272e; display: flex; flex-direction: column; overflow: hidden; font-family: 'Roboto', sans-serif; }
        
        /* PANEL */
        .tablero-marco { flex: 1; display: flex; justify-content: center; align-items: center; background: #0d47a1; padding: 15px; border-bottom: 5px solid #f1c40f; box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
        .tablero-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; padding: 20px; background: #1565c0; border: 8px solid #0d47a1; border-radius: 15px; box-shadow: inset 0 0 30px rgba(0,0,0,0.5); max-width: 90%; }
        
        .celda-vacia { width: 40px; height: 50px; }
        .celda { width: 40px; height: 50px; perspective: 1000px; }
        .celda-inner { position: relative; width: 100%; height: 100%; text-align: center; transition: transform 0.6s; transform-style: preserve-3d; }
        .celda.revelada .celda-inner { transform: rotateY(180deg); }
        .celda-front, .celda-back { position: absolute; width: 100%; height: 100%; backface-visibility: hidden; border-radius: 4px; box-shadow: 0 4px 0 rgba(0,0,0,0.3); border: 2px solid #ddd; }
        .celda-front { background: white; } 
        .celda-back { background: #fff; color: black; font-family: 'Righteous'; font-size: 2rem; display: flex; align-items: center; justify-content: center; transform: rotateY(180deg); }
        .celda.oculta { cursor: default; } 
        .celda.oculta .celda-front { background: white; }
        
        .zona-accion { flex: 2; position: relative; display: flex; justify-content: center; align-items: center; background: radial-gradient(circle, #2c3e50 0%, #000 100%); }

        .ruleta-wrapper { position: relative; width: 450px; height: 450px; display: flex; justify-content: center; align-items: center; }
        .ruleta-svg { width: 100%; height: 100%; filter: drop-shadow(0 10px 20px rgba(0,0,0,0.5)); transition: transform 4s cubic-bezier(0.1, 0.8, 0.1, 1); }
        .flecha-indicador { position: absolute; top: -10px; font-size: 3rem; color: #e74c3c; z-index: 20; filter: drop-shadow(0 2px 2px black); }
        .boton-invisible { position: absolute; width: 80px; height: 80px; border-radius: 50%; border: none; background: transparent; cursor: pointer; z-index: 30; }

        .hud-jugadores { display: flex; justify-content: center; gap: 20px; padding: 10px; background: #1a252f; border-bottom: 1px solid #333; }
        .card-jugador { background: #34495e; border-radius: 8px; width: 120px; text-align: center; opacity: 0.5; transition: 0.3s; transform: scale(0.9); border: 2px solid transparent; }
        .card-jugador.activo { opacity: 1; transform: scale(1.05); border-color: white !important; box-shadow: 0 0 15px rgba(255,255,255,0.2); }
        .card-jugador .nombre { padding: 5px; color: white; font-weight: bold; font-size: 0.8rem; }
        .card-jugador .puntos { padding: 10px; font-family: 'Righteous'; color: #f1c40f; font-size: 1.2rem; background: rgba(0,0,0,0.2); }

        .modal-accion { position: absolute; background: white; border-radius: 15px; width: 80%; max-width: 550px; z-index: 50; overflow: hidden; box-shadow: 0 20px 50px black; animation: popIn 0.3s; }
        .modal-header { padding: 15px; color: white; font-weight: bold; font-size: 1.2rem; text-align: center; font-family: 'Righteous'; }
        .modal-body { padding: 25px; text-align: center; }
        .pregunta-texto { font-size: 1.3rem; color: #333; margin-bottom: 20px; font-weight: 500; }
        .opciones-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .btn-opcion { padding: 15px; border: 2px solid #ddd; background: white; border-radius: 8px; cursor: pointer; font-weight: bold; color: #555; transition: 0.2s; }
        .btn-opcion:hover { background: #f9f9f9; transform: translateY(-2px); }
        .btn-opcion.verde { background: #2ecc71; color: white; border-color: #27ae60; }
        .btn-opcion.rojo { background: #e74c3c; color: white; border-color: #c0392b; }
        .input-row { display: flex; gap: 10px; justify-content: center; }
        .input-row input { padding: 10px; font-size: 1.2rem; border: 2px solid #3498db; border-radius: 5px; width: 70%; }
        .tick-animado { font-size: 3rem; margin-top: 10px; animation: bounce 0.5s; }
        .aviso-fallo { background: #e74c3c; color: white; padding: 10px; margin-top: 15px; border-radius: 5px; font-weight: bold; }

        .panel-controles { background: rgba(0,0,0,0.9); padding: 25px; border-radius: 15px; border: 1px solid #555; }
        .botones-accion { display: flex; gap: 15px; }
        .botones-accion button { padding: 15px 25px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 5px; transition: transform 0.2s; color: white; width: 110px; }
        .botones-accion button:hover:not(:disabled) { transform: translateY(-3px); }
        .btn-consonante { background: #3498db; }
        .btn-vocal { background: #9b59b6; }
        .btn-resolver { background: #e67e22; }
        .input-panel { text-align: center; color: white; }
        .input-panel input { font-size: 2rem; width: 100px; text-align: center; text-transform: uppercase; margin: 15px; border-radius: 5px; border: none; padding: 5px; }
        .input-panel button { padding: 10px 20px; border-radius: 5px; border: none; cursor: pointer; background: #2ecc71; font-weight: bold; margin-left: 10px; }
        .btn-cancelar { background: #e74c3c !important; }

        .mensaje-flotante { position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); background: #f1c40f; color: black; padding: 12px 30px; border-radius: 30px; font-weight: bold; box-shadow: 0 5px 15px rgba(0,0,0,0.5); font-size: 1.1rem; animation: slideUp 0.3s; z-index: 100; white-space: nowrap; border: 2px solid white; }

        .setup-overlay, .overlay-fin { position: fixed; top:0; left:0; width:100%; height:100%; background: #2c3e50; z-index: 200; display:flex; justify-content:center; align-items:center; }
        .setup-card, .card-fin { background: white; padding: 30px; border-radius: 20px; text-align: center; width: 90%; max-width: 400px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
        .selector-jugadores { display: flex; gap: 10px; justify-content: center; margin: 20px 0; }
        .selector-jugadores button { padding: 10px; border: 1px solid #ccc; background: #f9f9f9; cursor: pointer; border-radius: 5px; flex: 1; }
        .selector-jugadores button.selected { background: #3498db; color: white; border-color: #2980b9; }
        .inputs-nombres input { display: block; width: 100%; padding: 8px; margin: 5px 0; border: 1px solid #ddd; border-radius: 5px; }
        .btn-start { background: #2ecc71; color: white; border: none; padding: 12px; width: 100%; font-size: 1.2rem; border-radius: 8px; margin-top: 15px; cursor: pointer; font-weight: bold; }
        .btn-close, .btn-salir { background: transparent; border: none; color: #7f8c8d; margin-top: 10px; cursor: pointer; text-decoration: underline; }
        
        .card-fin-premium { background: white; padding: 40px; border-radius: 25px; text-align: center; width: 90%; max-width: 500px; box-shadow: 0 0 60px rgba(241, 196, 15, 0.5); border: 4px solid #f1c40f; animation: popIn 0.5s; }
        .titulo-final { font-family: 'Righteous'; color: #2c3e50; margin-bottom: 5px; }
        .frase-final { color: #f1c40f; font-family: 'Righteous'; margin-bottom: 40px; font-size: 1.5rem; text-shadow: 1px 1px 0 #000; letter-spacing: 1px; }
        
        .podio-container { display: flex; justify-content: center; align-items: flex-end; gap: 15px; height: 220px; margin-bottom: 30px; }
        .pedestal-wrapper { display: flex; flex-direction: column; align-items: center; width: 100px; }
        .avatar-flotante { width: 60px; height: 60px; border-radius: 50%; border: 4px solid; background: white; display: flex; justify-content: center; align-items: center; margin-bottom: 10px; position: relative; box-shadow: 0 5px 15px rgba(0,0,0,0.2); }
        .corona-icon { position: absolute; top: -20px; color: #f1c40f; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3)); }
        .medalla-silver { position: absolute; top: -15px; color: #bdc3c7; }
        .medalla-bronze { position: absolute; top: -15px; color: #d35400; }
        
        .pedestal-bloque { width: 100%; border-radius: 10px 10px 0 0; display: flex; flex-direction: column; justify-content: center; align-items: center; color: white; box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
        .rank-1 .pedestal-bloque { background: linear-gradient(to bottom, #f1c40f, #f39c12); }
        .rank-2 .pedestal-bloque { background: linear-gradient(to bottom, #bdc3c7, #95a5a6); }
        .rank-3 .pedestal-bloque { background: linear-gradient(to bottom, #d35400, #e67e22); }
        
        .p-nombre { font-weight: bold; font-size: 0.9rem; margin-bottom: 5px; text-shadow: 0 1px 2px rgba(0,0,0,0.3); display: block; width: 100%; }
        .p-puntos { font-family: 'Righteous'; font-size: 1.4rem; background: rgba(0,0,0,0.2); padding: 5px 10px; border-radius: 15px; display: block; width: 90%; }

        .btn-save-premium { background: #27ae60; color: white; padding: 12px 30px; border: none; border-radius: 30px; font-size: 1.1rem; cursor: pointer; display: flex; align-items: center; gap: 10px; margin: 0 auto 10px; font-weight: bold; box-shadow: 0 4px 0 #1e8449; transition: transform 0.1s; }
        .btn-save-premium:active { transform: translateY(4px); box-shadow: none; }
        .btn-salir-premium { background: transparent; border: 2px solid #bdc3c7; color: #7f8c8d; padding: 8px 25px; border-radius: 20px; cursor: pointer; font-weight: bold; }

        @keyframes popIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes slideUp { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        @keyframes bounce { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.2); } }
        @media (max-width: 600px) { .ruleta-wrapper { transform: scale(0.8); margin-top: 0; } .hud-jugadores { flex-wrap: wrap; } .tablero-marco { padding: 5px; } .celda { width: 25px; height: 35px; font-size: 1rem; } }
    `}</style>
);