// Movimientos del cuerpo para el visor 3D: qué huesos se mueven, alrededor de qué
// articulación y qué músculos se contraen (agonistas) o se relajan (antagonistas).
//
// Coordenadas three.js del modelo: el cuerpo mira hacia +Z, el lado DERECHO del cuerpo
// está en x < 0, y es la altura (m). Los ángulos están en radianes.
//
// Cada movimiento:
//   pivote(ctx)   punto de giro, calculado con la forma real de los huesos
//                 (ctx.extremo(id, 'min'|'max', { banda, preferir }), ctx.centro(id))
//   eje, rango    eje de giro y ángulos de inicio y final
//   rigidos(p)    factor (0-1) con el que una pieza gira como un sólido (0 = no se mueve)
//   deformar      músculos/órganos que cruzan la articulación: cada vértice gira según
//                 su posición a lo largo del segmento que se mueve (dir, desde el pivote)
//                 y su cercanía a ese segmento (radio)
//   vista         dirección desde la que mira la cámara (de lado si el movimiento va hacia delante/atrás)
//   ida / vuelta  las dos fases: nombre, músculos que se contraen y que se relajan
//                 (ids de pieza con lado), y una nota opcional
// Revisar con un profesor de Biología / Educación Física.

// sube o baja un punto (Vector3) en altura y lo devuelve
const subir = (v, dy) => { v.y += dy; return v; };
const der = (p) => p.lado === 'derecho';
const es = (p, sistema) => p.sistema === sistema;
const CUADRICEPS = ['recto_femoral.r', 'vasto_lateral.r', 'vasto_medial.r', 'vasto_intermedio.r'];
const ISQUIOS = ['biceps_femoral.r', 'semitendinoso.r', 'semimembranoso.r'];

export const MOVIMIENTOS = [
    {
        id: 'codo', nombre: 'Doblar el codo', emoji: '💪', articulacion: 'Codo (articulación en bisagra)',
        pivote: (c) => subir(c.extremo('Humerus.r', 'min', { banda: 0.015 }), 0.012),
        eje: [1, 0, 0], rango: [0, -2.15],
        rigidos: (p) => (es(p, 'esqueleto') && der(p) && (['Radius', 'Ulna'].includes(p.en) || p.zona === 'mano') ? 1 : 0),
        deformar: { filtro: (p) => es(p, 'musculos') && der(p) && p.zona === 'brazo', dir: [0, -1, 0], radio: 0.065, largo: 0.45, mezcla: 0.035 },
        huesosTexto: 'Radio y cúbito (con la mano) giran alrededor del extremo del húmero.',
        ida: { nombre: 'Flexión (doblar)', agonistas: ['biceps_braquial.r', 'braquial.r', 'braquiorradial.r'], antagonistas: ['triceps_braquial.r'] },
        vuelta: { nombre: 'Extensión (estirar)', agonistas: ['triceps_braquial.r'], antagonistas: ['biceps_braquial.r', 'braquial.r'] },
        distancia: 1.1, vista: [-0.75, 0.15, 0.65],
    },
    {
        id: 'hombro', nombre: 'Subir el brazo hacia el lado', emoji: '🙋', articulacion: 'Hombro (articulación esférica: se mueve en todas direcciones)',
        pivote: (c) => subir(c.extremo('Humerus.r', 'max', { banda: 0.02 }), -0.024),
        eje: [0, 0, 1], rango: [0, -1.45],
        rigidos: (p) => (es(p, 'esqueleto') && der(p) && (['Humerus', 'Radius', 'Ulna'].includes(p.en) || p.zona === 'mano') ? 1 : 0),
        deformar: { filtro: (p) => es(p, 'musculos') && der(p) && ['brazo', 'torax', 'espalda'].includes(p.zona), dir: [0, -1, 0], radio: 0.075, largo: 0.9, mezcla: 0.05 },
        huesosTexto: 'El húmero gira en la cavidad del omóplato y arrastra el antebrazo y la mano.',
        ida: { nombre: 'Abducción (separar el brazo)', agonistas: ['deltoides.r', 'supraespinoso.r'], antagonistas: ['dorsal_ancho.r', 'pectoral_mayor.r', 'redondo_mayor.r'] },
        vuelta: { nombre: 'Aducción (bajar el brazo)', agonistas: ['dorsal_ancho.r', 'pectoral_mayor.r', 'redondo_mayor.r'], antagonistas: ['deltoides.r'] },
        distancia: 1.5, vista: [0, 0.1, 1],
    },
    {
        id: 'cadera', nombre: 'Subir la rodilla', emoji: '🦵', articulacion: 'Cadera (articulación esférica)',
        pivote: (c) => subir(c.extremo('Femur.r', 'max', { banda: 0.035, preferir: 'medial' }), -0.02),
        eje: [1, 0, 0], rango: [0, -1.35],
        rigidos: (p) => (es(p, 'esqueleto') && der(p) && (['Femur', 'Patella', 'Tibia', 'Fibula'].includes(p.en) || p.zona === 'pie') ? 1 : 0),
        deformar: { filtro: (p) => es(p, 'musculos') && der(p) && p.zona === 'pierna', dir: [0, -1, 0], radio: 0.11, largo: 1.0, mezcla: 0.06 },
        huesosTexto: 'La cabeza del fémur gira en la cadera y arrastra toda la pierna.',
        ida: { nombre: 'Flexión (subir la rodilla)', agonistas: ['psoas_iliaco.r', 'recto_femoral.r', 'sartorio.r'], antagonistas: ['gluteo_mayor.r', ...ISQUIOS] },
        vuelta: { nombre: 'Extensión (bajar la pierna)', agonistas: ['gluteo_mayor.r', ...ISQUIOS], antagonistas: ['psoas_iliaco.r', 'recto_femoral.r'] },
        distancia: 1.8, vista: [-1, 0.12, 0.3],
    },
    {
        id: 'rodilla', nombre: 'Doblar la rodilla', emoji: '🏃', articulacion: 'Rodilla (articulación en bisagra)',
        pivote: (c) => subir(c.extremo('Femur.r', 'min', { banda: 0.02 }), 0.025),
        eje: [1, 0, 0], rango: [0, 1.75],
        rigidos: (p) => {
            if (!es(p, 'esqueleto') || !der(p)) return 0;
            if (p.en === 'Patella') return 0.45; // la rótula se desliza: gira menos
            return ['Tibia', 'Fibula'].includes(p.en) || p.zona === 'pie' ? 1 : 0;
        },
        deformar: { filtro: (p) => es(p, 'musculos') && der(p) && p.zona === 'pierna', dir: [0, -1, 0], radio: 0.09, largo: 0.6, mezcla: 0.045 },
        huesosTexto: 'La tibia y el peroné (con el pie) giran bajo el fémur; la rótula se desliza.',
        ida: { nombre: 'Flexión (doblar)', agonistas: [...ISQUIOS, 'gemelos.r'], antagonistas: CUADRICEPS },
        vuelta: { nombre: 'Extensión (estirar)', agonistas: CUADRICEPS, antagonistas: ISQUIOS },
        distancia: 1.3, vista: [-1, 0.12, 0.25],
    },
    {
        id: 'tobillo', nombre: 'Ponerse de puntillas', emoji: '🩰', articulacion: 'Tobillo (articulación en bisagra)',
        pivote: (c) => subir(c.extremo('Tibia.r', 'min', { banda: 0.012 }).lerp(c.extremo('Fibula.r', 'min', { banda: 0.012 }), 0.5), 0.015),
        eje: [1, 0, 0], rango: [0, 0.65],
        rigidos: (p) => (es(p, 'esqueleto') && der(p) && p.zona === 'pie' ? 1 : 0),
        deformar: { filtro: (p) => es(p, 'musculos') && der(p) && p.zona === 'pierna', dir: [0, -1, 0], radio: 0.08, largo: 0.25, mezcla: 0.03 },
        huesosTexto: 'Los huesos del pie giran bajo la tibia y el peroné; el talón sube tirado por el tendón de Aquiles.',
        ida: { nombre: 'Flexión plantar (de puntillas)', agonistas: ['gemelos.r', 'soleo.r', 'tendon_aquiles.r', 'peroneo_largo.r'], antagonistas: ['tibial_anterior.r'] },
        vuelta: { nombre: 'Flexión dorsal (subir la punta)', agonistas: ['tibial_anterior.r'], antagonistas: ['gemelos.r', 'soleo.r'] },
        distancia: 1.0, vista: [-1, 0.15, 0.3],
    },
    {
        id: 'mandibula', nombre: 'Abrir y cerrar la boca', emoji: '😮', articulacion: 'Articulación temporomandibular (delante de la oreja)',
        pivote: (c) => { const v = c.extremo('Mandible', 'max', { banda: 0.012, preferir: 'posterior' }); v.x = 0; return v; },
        eje: [1, 0, 0], rango: [0, 0.38],
        rigidos: (p) => (es(p, 'esqueleto') && (p.en === 'Mandible' || p.en.startsWith('Lower ')) ? 1 : 0),
        deformar: { filtro: (p) => (es(p, 'musculos') && ['masetero', 'buccinador', 'orbicular_boca'].includes(p.en)) || (es(p, 'organos') && p.en === 'lengua'), dir: [0, -1, 0.4], radio: 0.09, largo: 0.15, mezcla: 0.025 },
        huesosTexto: 'La mandíbula, con los dientes de abajo, gira bajo el cráneo.',
        ida: { nombre: 'Abrir la boca', agonistas: [], antagonistas: ['masetero.r', 'masetero.l', 'temporal.r', 'temporal.l'], nota: 'La abren pequeños músculos bajo la mandíbula (no están en el modelo) ayudados por la gravedad.' },
        vuelta: { nombre: 'Cerrar y morder', agonistas: ['masetero.r', 'masetero.l', 'temporal.r', 'temporal.l'], antagonistas: [] },
        distancia: 0.75, vista: [-0.85, 0.05, 0.55],
    },
    {
        id: 'cabeza', nombre: 'Girar la cabeza', emoji: '🙂', articulacion: 'Atlas y axis (primeras vértebras del cuello)',
        pivote: (c) => { const v = c.centro('Atlas (C1)'); v.x = 0; return v; },
        eje: [0, 1, 0], rango: [-0.85, 0.85],
        rigidos: (p) => {
            // la laringe y el hioides se quedan en el cuello; la nariz gira con la cabeza
            if (es(p, 'esqueleto')) return (p.zona === 'cabeza' && !/Thyroid cartilage|Cricoid|Arytenoid|Corniculate|Hyoid/.test(p.en)) || p.en === 'Atlas (C1)' ? 1 : 0;
            if (es(p, 'musculos')) return p.zona === 'cabeza' && !p.en.startsWith('esternocleidomastoideo') ? 1 : 0;
            if (es(p, 'organos')) return p.zona === 'cabeza' && !['tiroides', 'faringe'].includes(p.en) ? 1 : 0;
            return 0;
        },
        deformar: { filtro: (p) => es(p, 'musculos') && p.en === 'esternocleidomastoideo', dir: [0, 1, 0], radio: 0.25, largo: 0.3, mezcla: 0.06 },
        huesosTexto: 'El cráneo gira sobre el axis junto con el atlas, la primera vértebra.',
        ida: { nombre: 'Girar a la izquierda', agonistas: ['esternocleidomastoideo.r'], antagonistas: ['esternocleidomastoideo.l'], nota: 'Curioso: para girar a la izquierda trabaja el esternocleidomastoideo del lado DERECHO.' },
        vuelta: { nombre: 'Girar a la derecha', agonistas: ['esternocleidomastoideo.l'], antagonistas: ['esternocleidomastoideo.r'], nota: 'Para girar a la derecha trabaja el esternocleidomastoideo izquierdo.' },
        distancia: 0.9, vista: [0, 0.25, 1],
    },
];
