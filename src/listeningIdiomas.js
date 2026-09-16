// Registro de idiomas del juego de Listening.
// Para añadir un idioma: crea su biblioteca (mismo formato que BibliotecaListening.js)
// y añádelo aquí. El juego (ListeningGame.jsx) no necesita más cambios.
import { NIVELES_LISTENING, LISTENING_ITEMS } from './BibliotecaListening';
import { NIVELES_LISTENING_FR, LISTENING_ITEMS_FR } from './BibliotecaListeningFR';

// Filtros de la pantalla Explorar: cada nivel sabe qué ítems le corresponden
const TESTS_EN = {
    'A-G': it => 'ABCDEFG'.includes(it.letter),
    'H-N': it => 'HIJKLMN'.includes(it.letter),
    'O-Z': it => 'OPQRSTUVWXYZ'.includes(it.letter),
};

export const IDIOMAS_LISTENING = {
    en: {
        id: 'en',
        flag: '🇬🇧',
        label: 'English',
        subtitulo: 'Listen a Minute · 95 topics',
        lang: 'en-GB',                       // voz usada si un audio no está disponible
        buscarPlaceholder: '🔍 Search topic...',
        niveles: NIVELES_LISTENING.map(n => ({ ...n, test: TESTS_EN[n.id] || null })),
        items: LISTENING_ITEMS,
    },
    fr: {
        id: 'fr',
        flag: '🇫🇷',
        label: 'Français',
        subtitulo: 'Écouter une minute',
        lang: 'fr-FR',
        buscarPlaceholder: '🔍 Chercher un sujet...',
        niveles: NIVELES_LISTENING_FR.map(n => ({ ...n, test: n.id ? (it => it.nivel === n.id) : null })),
        items: LISTENING_ITEMS_FR,
    },
};

export const IDIOMA_POR_DEFECTO = 'en';

export const getIdioma = (id) => IDIOMAS_LISTENING[id] || IDIOMAS_LISTENING[IDIOMA_POR_DEFECTO];
export const getItems = (id) => getIdioma(id).items;
export const getItem = (id, itemId) => getItems(id).find(i => i.id === itemId) || null;
