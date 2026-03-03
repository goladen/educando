import React, { useState } from 'react';
import { Loader } from 'lucide-react';

// IMPORTAMOS LOS JUEGOS
import CazaBurbujasGame from './CazaBurbujasGame';
import AparejadosGame from './AparejadosGame';
import PasapalabraGame from './PasapalabraGame';
import PikatronRun from './PikatronRun';
import SopaDeLetrasGame from './SopaDeLetrasGame';
import TextWordleGame from './TextWordleGame';
export default function MotorMinijuego({ pregunta, usuario, onTerminar }) {
    const [terminado, setTerminado] = useState(false);

    const handleJuegoTerminado = (puntosConseguidos) => {
        setTerminado(true);
        if (onTerminar) onTerminar(puntosConseguidos);
    };

    if (terminado) {
        return (
            <div style={{ textAlign: 'center', color: 'white', paddingTop: '100px' }}>
                <h2 style={{ fontSize: '2.5rem', color: '#f1c40f' }}>¡Prueba completada! 🏅</h2>
                <p style={{ fontSize: '1.2rem' }}>Esperando a que el resto de atletas terminen...</p>
                <Loader className="spin" size={60} style={{ marginTop: '30px', animation: 'spin 2s linear infinite' }} />
                <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    // --- EMPAQUETAMOS LAS PROPIEDADES OLÍMPICAS ---
    const propsOlimpicas = {
        recurso: pregunta.recursoObjeto,
        usuario: usuario,
        modoOlimpico: true,
        tiempoOlimpico: pregunta.tiempo,
        hojaOlimpica: pregunta.hojaMinijuego || 'General',
        onOlimpicoFinish: handleJuegoTerminado
    };

    // --- RENDERIZADOR ---
    if (pregunta.app === 'CAZABURBUJAS') return <CazaBurbujasGame {...propsOlimpicas} />;
    if (pregunta.app === 'APAREJADOS') return <AparejadosGame {...propsOlimpicas} />;
    if (pregunta.app === 'PASAPALABRA') return <PasapalabraGame {...propsOlimpicas} />;
    if (pregunta.app === 'PIKATRON') return <PikatronRun {...propsOlimpicas} />; // <--- AÑADE ESTA LÍNEA
    if (pregunta.app === 'SOPA') return <SopaDeLetrasGame {...propsOlimpicas} />;
    if (pregunta.app === 'WORDLE') return <TextWordleGame {...propsOlimpicas} />;

    return <div style={{ color: 'white', textAlign: 'center', marginTop: '50px' }}>Juego {pregunta.app} no integrado aún.</div>;
}