import { useState } from 'react';
import { Home } from 'lucide-react';
import PasapalabraGame from './PasapalabraGame';
import CazaBurbujasGame from './CazaBurbujasGame';
import AparejadosGame from './AparejadosGame';
import ThinkHootGame from './ThinkHootGame';
import RuletaGame from './RuletaGame';

export default function GamePlayer({ recurso, usuario, alTerminar }) {

    // Botón de Salir al Inicio (Cierra el juego actual)
    const BotonCasa = () => (
        <button
            onClick={alTerminar}
            style={{
                position: 'fixed', top: '10px', left: '10px', zIndex: 9999,
                background: 'white', border: '2px solid #333', borderRadius: '50%',
                width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
            }}
            title="Volver al Inicio"
        >
            <Home size={24} color="#333" />
        </button>
    );

    return (
        <>
            <BotonCasa />

            {recurso.tipoJuego === 'PASAPALABRA' && (
                <PasapalabraGame recurso={recurso} usuario={usuario} alTerminar={alTerminar} />
            )}

            {recurso.tipoJuego === 'CAZABURBUJAS' && (
                <CazaBurbujasGame recurso={recurso} usuario={usuario} alTerminar={alTerminar} />
            )}

            {recurso.tipoJuego === 'APAREJADOS' && (
                <AparejadosGame recurso={recurso} usuario={usuario} alTerminar={alTerminar} />
            )}

            {recurso.tipoJuego === 'RULETA' && (
                <RuletaGame recurso={recurso} usuario={usuario} alTerminar={alTerminar} />
            )}

            {recurso.tipoJuego === 'THINKHOOT' && (
                <ThinkHootGame
                    isHost={false}
                    codigoSala={recurso.id}
                    usuario={usuario}
                    onExit={alTerminar}
                />
            )}
        </>
    );
}