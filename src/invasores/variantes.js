// Registro de variantes (patrón estrategia): el contenedor y PlayerZone no saben cuál se juega.
import { crearMundoDispara, stepDispara, fuegoDispara, bloqueadoDispara } from './motor/motorDispara';
import { crearMundoFiltro, stepFiltro } from './motor/motorFiltro';
import PanelDispara from './ui/PanelDispara';
import { PanelFiltro, CabeceraFiltro } from './ui/PanelFiltro';

export const VARIANTES = {
  DISPARA: {
    id: 'DISPARA',
    nombre: 'Dispara al responder',
    emoji: '⌨️',
    resumen: 'Teclea la respuesta y pulsa FUEGO antes de que el alien toque el suelo.',
    crearMundo: crearMundoDispara,
    step: stepDispara,
    alFuego: fuegoDispara,           // FUEGO = comprobar lo tecleado
    bloqueado: bloqueadoDispara,
    Panel: PanelDispara,
    Cabecera: null,
    seMueve: false,
  },
  FILTRO: {
    id: 'FILTRO',
    nombre: 'Filtro de respuestas',
    emoji: '🛸',
    resumen: 'Destruye las naves con respuestas falsas y deja pasar la correcta.',
    crearMundo: crearMundoFiltro,
    step: stepFiltro,
    alFuego: null,                   // FUEGO = disparo libre (lo procesa el motor con el input)
    bloqueado: () => false,
    Panel: PanelFiltro,
    Cabecera: CabeceraFiltro,
    seMueve: true,
  },
};
