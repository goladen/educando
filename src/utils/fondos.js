// Fondos disponibles para calendarios y horarios (imágenes en src/assets).
import FondoMarino from '../assets/FondoMarino.png';
import p1 from '../assets/pantalla1.jpeg';
import p2 from '../assets/pantalla2.jpeg';
import p3 from '../assets/pantalla3.jpeg';
import p4 from '../assets/pantalla4.jpeg';
import p5 from '../assets/pantalla5.jpeg';

export const FONDOS = [
    { id: '',       label: 'Sin fondo',     url: null },
    { id: 'marino', label: 'Fondo marino',  url: FondoMarino },
    { id: 'p1',     label: 'Fondo 1',       url: p1 },
    { id: 'p2',     label: 'Fondo 2',       url: p2 },
    { id: 'p3',     label: 'Fondo 3',       url: p3 },
    { id: 'p4',     label: 'Fondo 4',       url: p4 },
    { id: 'p5',     label: 'Fondo 5',       url: p5 },
];

export const fondoUrl = (id) => (FONDOS.find(f => f.id === id) || {}).url || null;

// Estilo para pintar el fondo con una capa blanca translúcida encima (legibilidad).
export const fondoBg = (url, tint = 0.82) => url
    ? { backgroundColor: 'transparent', backgroundImage: `linear-gradient(rgba(255,255,255,${tint}),rgba(255,255,255,${tint})), url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {};
