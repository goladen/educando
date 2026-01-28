import { useState, useEffect } from 'react';
import { db } from './firebase';

import { doc, getDoc, setDoc, addDoc, collection, query, where, getDocs, orderBy, limit, updateDoc } from 'firebase/firestore';
export default function AparejadosGame({ recurso, usuario, alTerminar }) {
    const [fase, setFase] = useState('SETUP');
    const [hojaSeleccionada, setHojaSeleccionada] = useState('General');
    const [cartas, setCartas] = useState([]);
    const [flipped, setFlipped] = useState([]);
    const [matched, setMatched] = useState([]);
    const [puntos, setPuntos] = useState(0);
    const [tiempo, setTiempo] = useState(60);
    const [verRanking, setVerRanking] = useState(false);

    const iniciar = (hoja) => {
        setHojaSeleccionada(hoja);
        let pool = [];
        if (hoja === 'General') {
            recurso.hojas.forEach(h => { h.preguntas.forEach((p, i) => pool.push({ ...p, idOriginal: i })); });
        } else {
            const hObj = recurso.hojas.find(h => h.nombreHoja === hoja);
            if (hObj) hObj.preguntas.forEach((p, i) => pool.push({ ...p, idOriginal: i }));
        }

        pool.sort(() => Math.random() - 0.5);
        const limitConfig = parseInt(recurso.config?.numParejas) || 8;
        const limitReal = Math.min(pool.length, limitConfig);
        const seleccion = pool.slice(0, limitReal);

        let mazo = [];
        seleccion.forEach((p, i) => {
            mazo.push({ id: i, content: p.terminoA, pairId: i, uniqueId: `a-${i}` });
            mazo.push({ id: i, content: p.terminoB, pairId: i, uniqueId: `b-${i}` });
        });

        mazo.sort(() => Math.random() - 0.5);
        setCartas(mazo);
        setMatched([]); setFlipped([]);
        setTiempo(parseInt(recurso.config?.tiempoTotal) || 60);
        setPuntos(0);
        setFase('JUEGO');
    };

    useEffect(() => {
        if (fase !== 'JUEGO') return;
        const t = setInterval(() => {
            setTiempo(prev => { if (prev <= 1) setFase('FIN'); return prev - 1; });
        }, 1000);
        return () => clearInterval(t);
    }, [fase]);

    const handleClick = (carta) => {
        if (flipped.length >= 2 || flipped.includes(carta.uniqueId) || matched.includes(carta.uniqueId)) return;
        const newFlipped = [...flipped, carta.uniqueId];
        setFlipped(newFlipped);
        if (newFlipped.length === 2) {
            const carta1 = cartas.find(c => c.uniqueId === newFlipped[0]);
            const carta2 = cartas.find(c => c.uniqueId === newFlipped[1]);
            if (carta1.pairId === carta2.pairId) {
                const newMatched = [...matched, carta1.uniqueId, carta2.uniqueId];
                setMatched(newMatched);
                const ptsPareja = parseInt(recurso.config?.puntosPareja) || 10;
                setPuntos(p => p + ptsPareja);
                setFlipped([]);
                if (newMatched.length === cartas.length) setTimeout(() => setFase('FIN'), 500);
            } else {
                setTimeout(() => setFlipped([]), 1000);
            }
        }
    };

    if (fase === 'SETUP' && !verRanking) return <PantallaSetup recurso={recurso} onStart={iniciar} onRanking={() => setVerRanking(true)} onExit={alTerminar} />;

    if (verRanking) return <PantallaRanking recurso={recurso} usuario={usuario} onBack={() => setVerRanking(false)} />;

  /*  if (fase === 'FIN') {
        const guardar = async () => {
            await addDoc(collection(db, 'ranking'), {
                recursoId: recurso.id, juego: 'Aparejados', categoria: hojaSeleccionada, jugador: usuario.displayName, aciertos: puntos, fecha: new Date()
            });
            alert("Guardado"); onExit();*/

    if (fase === 'FIN') {
        const guardar = async () => {
            try {
                const rankingRef = collection(db, 'ranking');
                const q = query(rankingRef, where('recursoId', '==', recurso.id), where('categoria', '==', hojaSeleccionada), where('jugador', '==', usuario.displayName), where('juego', '==', 'Aparejados'));
                const snap = await getDocs(q);

                if (!snap.empty) {
                    const old = snap.docs[0].data().aciertos;
                    if (puntos > old) {
                        await updateDoc(doc(db, 'ranking', snap.docs[0].id), { aciertos: puntos, fecha: new Date() });
                        alert("🚀 ¡Nuevo Récord!");
                    } else {
                        alert(`⚠️ No has superado tu mejor registro en ${hojaSeleccionada} de ${recurso.titulo}.`);
                    }
                } else {
                    await addDoc(rankingRef, {
                        recursoId: recurso.id, tituloJuego: recurso.titulo, juego: 'Aparejados', categoria: hojaSeleccionada, jugador: usuario.displayName, aciertos: puntos, fecha: new Date()
                    });
                    alert("✅ Guardado");
                }
                onExit(); // O alTerminar
            } catch (e) { console.error(e); alert("Error"); }
        



};
        return (
            <div className="card-menu">
                <h1>¡Tiempo!</h1>
                <h2>Puntos: {puntos}</h2>
                <button className="btn-success" onClick={guardar}>💾 Guardar</button>
                <button className="btn-back" onClick={alTerminar}>Salir</button>
                <EstilosComunes />
            </div>
        )
    }

    return (
        <div id="game-ui">
            <header>
                <button className="btn-back-small" onClick={alTerminar}>SALIR</button>
                <div className="stat-box">⏱ {tiempo}</div>
                <div className="stat-box">⭐ {puntos}</div>
            </header>
            <div className="table-container">
                <div className="game-board" style={{ gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(cartas.length))}, 1fr)` }}>
                    {cartas.map(carta => (
                        <div key={carta.uniqueId} className={`card ${flipped.includes(carta.uniqueId) || matched.includes(carta.uniqueId) ? 'flipped' : ''}`} onClick={() => handleClick(carta)}>
                            <div className="face front">{carta.content}</div>
                            <div className="face back">?</div>
                        </div>
                    ))}
                </div>
            </div>
            <EstilosComunes />
            <style>{`
                #game-ui { display: flex; flex-direction: column; height: 100vh; width: 100%; position:fixed; top:0; left:0; background: #2c3e50; }
                header { height: 50px; background: rgba(0,0,0,0.3); display: flex; justify-content: space-between; align-items: center; padding: 0 20px; color: white; }
                .stat-box { font-family: 'Fredoka One'; font-size: 1.2rem; color: #f1c40f; }
                .btn-back-small { background: rgba(0,0,0,0.5); border: 1px solid #777; color: white; padding: 5px 10px; border-radius: 5px; cursor: pointer; }
                .table-container { flex: 1; background-color: #27ae60; border: 8px solid #1e8449; border-radius: 10px; margin: 10px; box-shadow: inset 0 0 50px rgba(0,0,0,0.5); padding: 10px; display: flex; justify-content: center; align-items: center; }
                .game-board { display: grid; gap: 10px; width: 100%; height: 100%; justify-items: center; align-items: center; }
                .card { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; transition: transform 0.4s; cursor: pointer; }
                .card.flipped { transform: rotateY(180deg); }
                .face { position: absolute; width: 100%; height: 100%; backface-visibility: hidden; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-weight: bold; font-size: clamp(10px, 2vmin, 18px); padding: 5px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
                .face.back { background: repeating-linear-gradient(45deg, #c0392b, #c0392b 5px, #e74c3c 5px, #e74c3c 10px); border: 2px solid white; color: white; font-size: 2rem; }
                .face.front { background: #ecf0f1; color: #2c3e50; transform: rotateY(180deg); border: 1px solid #bdc3c7; }
            `}</style>
        </div>
    );
}

const PantallaSetup = ({ recurso, onStart, onRanking, onExit }) => {
    const [hoja, setHoja] = useState('General');
    const hojasDisponibles = recurso.hojas ? recurso.hojas.map(h => h.nombreHoja) : [];

    return (
        <div className="card-menu">
            <h1>Juego de Parejas</h1>
            <h2 style={{ color: 'white', fontSize: '1.2rem' }}>{recurso.titulo}</h2>
            {hojasDisponibles.length > 0 && (
                <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                    <label style={{ display: 'block', marginBottom: '5px', color: '#ccc' }}>Selecciona Modalidad:</label>
                    <select value={hoja} onChange={e => setHoja(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none' }}>
                        <option value="General">General (Mezcla todo)</option>
                        {hojasDisponibles.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                </div>
            )}
            <button className="btn-success" onClick={() => onStart(hoja)}>🃏 Jugar</button>
            <button className="btn-ranking" onClick={onRanking}>🏆 Ver Ranking</button>
            <button className="btn-back" onClick={onExit}>⬅ Volver</button>
            <EstilosComunes />
        </div>
    );
}

const PantallaRanking = ({ recurso, usuario, onBack }) => {
    const [hoja, setHoja] = useState('General');
    const [top10, setTop10] = useState([]);
    const [miMejor, setMiMejor] = useState(null);
    const hojas = recurso.hojas ? recurso.hojas.map(h => h.nombreHoja) : [];

    useEffect(() => {
        const fetchRanking = async () => {
            try {
                const ref = collection(db, 'ranking');
                const qTop = query(ref, where('recursoId', '==', recurso.id), where('juego', '==', 'Aparejados'), where('categoria', '==', hoja), orderBy('aciertos', 'desc'), limit(10));
                const snapTop = await getDocs(qTop);
                setTop10(snapTop.docs.map(d => d.data()));

                const qMejor = query(ref, where('recursoId', '==', recurso.id), where('juego', '==', 'Aparejados'), where('categoria', '==', hoja), where('jugador', '==', usuario.displayName), orderBy('aciertos', 'desc'), limit(1));
                const snapMejor = await getDocs(qMejor);
                if (!snapMejor.empty) setMiMejor(snapMejor.docs[0].data().aciertos);
            } catch (e) { console.log(e); }
        };
        fetchRanking();
    }, [hoja]);

    const getMedalla = (i) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1);

    return (
        <div className="card-menu">
            <h2 style={{ color: '#f1c40f' }}>🏆 Ranking</h2>
            <select value={hoja} onChange={e => setHoja(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '15px', borderRadius: '5px' }}><option value="General">General</option>{hojas.map(h => <option key={h} value={h}>{h}</option>)}</select>
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', height: '200px', overflowY: 'auto', marginBottom: '15px' }}>
                {top10.map((f, i) => <div key={i} className="ranking-row"><span className="rank-pos">{getMedalla(i)}</span><span className="rank-name">{f.jugador}</span><span className="rank-score">{f.aciertos}</span></div>)}
            </div>
            {miMejor !== null && <div className="personal-best">Tu Record: {miMejor}</div>}
            <button className="btn-back" onClick={onBack}>Cerrar</button>
            <EstilosComunes />
        </div>
    );
};

const EstilosComunes = () => (
    <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Roboto:wght@400;700&display=swap');
    .card-menu { background: rgba(0,0,0,0.6); padding: 30px; border-radius: 20px; width: 90%; max-width: 400px; text-align: center; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); margin: 50px auto; color: white; font-family: 'Roboto', sans-serif; }
    h1, h2 { font-family: 'Fredoka One'; margin: 0 0 20px 0; color: #f1c40f; text-shadow: 2px 2px 0 #000; }
    .btn-success { width: 100%; padding: 12px; border: none; border-radius: 25px; font-weight: bold; cursor: pointer; color: #333; background: #2ecc71; margin-bottom: 10px; font-size:1.1rem; }
    .btn-ranking { width: 100%; padding: 12px; border: none; border-radius: 25px; font-weight: bold; cursor: pointer; background: #8e44ad; color: white; font-size: 1rem; margin-bottom: 10px; }
    .btn-back { background: transparent; border: 1px solid #777; color: #ccc; width: 100%; padding: 10px; border-radius: 20px; cursor: pointer; }
    .ranking-row { display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 0.9rem; color:white; }
    .rank-pos { width: 30px; font-weight: bold; }
    .rank-name { flex: 1; text-align: left; }
    .rank-score { font-weight: bold; color: #f1c40f; }
    .personal-best { margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 10px; border: 1px solid #f1c40f; color: #f1c40f; font-weight: bold; }
  `}</style>
);