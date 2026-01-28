import { useState } from 'react';
import { Home } from 'lucide-react'; // Asegúrate de tener lucide-react instalado
import PasapalabraGame from './PasapalabraGame';
import CazaBurbujasGame from './CazaBurbujasGame';
import AparejadosGame from './AparejadosGame';

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

    // Renderizamos el juego seleccionado y le pasamos las props
    // Nota: El botón Casa se renderiza FUERA del juego para estar siempre encima
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

            {recurso.tipoJuego === 'THINKHOOT' && (
                <ThinkHootGame
                    isHost={false} // Si entra por aquí es modo prueba
                    codigoSala={recurso.id} // En modo prueba usa el ID como sala falsa
                    usuario={usuario}
                    onExit={alTerminar}
                />
            )}



        </>
    );
}