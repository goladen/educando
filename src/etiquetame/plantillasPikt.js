// Diagramas PiKT de EtiquetaMe: plantillas listas para jugar (sin login, sin Firestore).
// Las imágenes son SVG propios en public/etiquetame/ (lienzo 1000×700).
// Las coordenadas se escriben en píxeles del lienzo y se pasan a % (el formato del juego).
//   p: [x, y] del punto en el dibujo · l: [x, y] de la casilla de la etiqueta.

const W = 1000, H = 700;
const pct = (v, total) => Math.round((v / total) * 10000) / 100;

const hoja = (nombreHoja, imagen, marcas) => ({
    nombreHoja,
    imageUrl: `/etiquetame/${imagen}`,
    markers: marcas.map(([text, p, l], i) => ({
        id: `m${i + 1}`,
        text,
        anchorX: pct(p[0], W), anchorY: pct(p[1], H),
        labelX:  pct(l[0], W), labelY:  pct(l[1], H),
    })),
});

const plantilla = (id, titulo, temas, ciclo, nivel, emoji, h) => ({
    id: `pikt-${id}`, titulo, temas, ciclo, nivel, emoji,
    tipoJuego: 'ETIQUETAS', tipo: 'ETIQUETAS', isFinished: true, esPlantillaPikt: true,
    profesorNombre: 'PiKT',
    hojas: [h],
});

export const PLANTILLAS_PIKT = [
    plantilla('celula-animal', 'Célula eucariota animal', 'Ciencias Naturales · Biología', 'Secundaria',
        '5º-6º Primaria · 1º y 3º ESO', '🔬',
        hoja('Célula eucariota animal', 'celula-animal.svg', [
            ['Membrana plasmática',      [500, 131],   [890, 60]],
            ['Centriolos',               [545, 190],   [890, 150]],
            ['Mitocondria',              [650, 255],   [890, 245]],
            ['Lisosoma',                 [705, 350],   [890, 345]],
            ['Aparato de Golgi',         [640, 425],   [890, 445]],
            ['Ribosomas',                [440, 530],   [110, 590]],
            ['Citoplasma',               [318, 470],   [110, 480]],
            ['Retículo endoplasmático',  [347, 340],   [110, 360]],
            ['Núcleo',                   [425, 290],   [110, 230]],
            ['Nucléolo',                 [490, 325],   [300, 50]],
        ])),

    plantilla('celula-vegetal', 'Célula eucariota vegetal', 'Ciencias Naturales · Biología', 'Secundaria',
        '5º-6º Primaria · 1º y 3º ESO', '🌿',
        hoja('Célula eucariota vegetal', 'celula-vegetal.svg', [
            ['Citoplasma',           [520, 190],   [890, 80]],
            ['Cloroplasto',          [620, 195],   [890, 180]],
            ['Pared celular',        [769, 350],   [890, 350]],
            ['Gran vacuola central', [580, 380],   [890, 520]],
            ['Núcleo',               [302, 275],   [110, 240]],
            ['Mitocondria',          [330, 400],   [110, 360]],
            ['Membrana plasmática',  [265, 420],   [110, 470]],
            ['Aparato de Golgi',     [362, 460],   [110, 600]],
        ])),

    plantilla('flor', 'Anatomía de una flor', 'Ciencias Naturales · Biología', 'Secundaria',
        'Primaria · 1º ESO', '🌸',
        hoja('Anatomía de una flor', 'flor.svg', [
            // El dibujo está escalado ×1,25 alrededor de (500, 430)
            ['Estigma',  [500, 157.5], [890, 80]],
            ['Antera',   [625, 211.3], [890, 190]],
            ['Pétalo',   [687.5, 292.5], [890, 320]],
            ['Ovario',   [557.5, 430], [890, 440]],
            ['Sépalo',   [643.8, 513.8], [890, 560]],
            ['Pistilo',  [500, 267.5], [110, 250]],
            ['Estambre', [420, 327.5], [110, 360]],
            ['Óvulos',   [485, 432.5], [110, 480]],
        ])),

    plantilla('microscopio', 'El microscopio óptico', 'Biología y Geología', 'Secundaria',
        '1º y 3º ESO', '🔭',
        hoja('El microscopio óptico', 'microscopio.svg', [
            ['Ocular',                [404, 86],    [110, 80]],
            ['Brazo',                 [400, 380],   [110, 300]],
            ['Tornillo macrométrico', [400, 500],   [110, 450]],
            ['Tornillo micrométrico', [400, 566],   [110, 560]],
            ['Base',                  [330, 626],   [110, 650]],
            ['Revólver',              [560, 255],   [890, 200]],
            ['Objetivos',             [560, 315],   [890, 310]],
            ['Pinzas',                [652, 430],   [890, 405]],
            ['Platina',               [700, 451],   [890, 480]],
            ['Foco',                  [560, 582],   [890, 580]],
        ])),

    // Digestivo y respiratorio: capturas del modelo 3D del Cuerpo humano (public/anatomia,
    // Z-Anatomy CC BY-SA 4.0) con colores de libro de texto y algunos órganos semitransparentes.
    plantilla('digestivo', 'Aparato digestivo humano', 'Ciencias Naturales · Biología', 'Secundaria',
        'Primaria · 3º ESO', '🍽️',
        hoja('Aparato digestivo humano', 'digestivo.jpg', [
            ['Glándulas salivales', [462, 68],  [110, 60]],
            ['Faringe',             [502, 128], [110, 170]],
            ['Hígado',              [438, 360], [110, 340]],
            ['Intestino grueso',    [426, 512], [110, 500]],
            ['Ano',                 [498, 640], [110, 640]],
            ['Boca',                [498, 86],  [890, 70]],
            ['Esófago',             [500, 224], [890, 220]],
            ['Estómago',            [542, 352], [890, 330]],
            ['Páncreas',            [478, 416], [890, 420]],
            ['Intestino delgado',   [510, 520], [890, 540]],
        ])),

    plantilla('respiratorio', 'Aparato respiratorio humano', 'Ciencias Naturales · Biología', 'Secundaria',
        'Primaria · 3º ESO', '🫁',
        hoja('Aparato respiratorio humano', 'respiratorio.jpg', [
            ['Faringe',          [500, 112], [110, 110]],
            ['Tráquea',          [500, 240], [110, 230]],
            ['Pulmón derecho',   [416, 336], [110, 340]],
            ['Diafragma',        [500, 520], [110, 560]],
            ['Pulmón izquierdo', [600, 264], [890, 250]],
            ['Bronquios',        [548, 330], [890, 400]],
        ])),

    plantilla('ciclo-agua', 'El ciclo del agua', 'Ciencias Naturales · Geografía', 'Primaria',
        'Primaria · 1º ESO', '💧',
        hoja('El ciclo del agua', 'ciclo-agua.svg', [
            ['Evaporación',        [230, 330], [110, 250]],
            ['Condensación',       [290, 150], [290, 40]],
            ['Precipitación',      [680, 250], [890, 160]],
            ['Transpiración',      [517, 320], [517, 235]],
            ['Escorrentía',        [560, 450], [470, 540]],
            ['Infiltración',       [900, 450], [760, 500]],
            ['Aguas subterráneas', [700, 632], [600, 682]],
            ['Acumulación',        [150, 580], [150, 660]],
        ])),

    plantilla('circunferencia', 'Elementos de la circunferencia', 'Matemáticas · Geometría', 'Secundaria',
        '5º-6º Primaria · 1º-2º ESO', '⭕',
        hoja('Elementos de la circunferencia', 'circunferencia.svg', [
            ['Centro',         [500, 350],     [890, 350]],
            ['Radio',          [481, 242],     [300, 50]],
            ['Diámetro',       [362, 374.3],   [110, 380]],
            ['Cuerda',         [371.9, 502.8], [110, 560]],
            ['Arco',           [319.8, 223.8], [110, 170]],
            ['Recta tangente', [725.7, 252.2], [890, 200]],
            ['Recta secante',  [742, 379.9],   [890, 520]],
        ])),

    plantilla('tierra', 'Capas internas de la Tierra', 'Ciencias Naturales · Geología', 'Secundaria',
        'Primaria · 1º ESO', '🌍',
        hoja('Capas internas de la Tierra', 'tierra.svg', [
            ['Corteza',        [589.3, 124.7], [890, 70]],
            ['Manto superior', [654.1, 215.9], [890, 165]],
            ['Manto inferior', [640.9, 271.3], [890, 260]],
            ['Núcleo externo', [602.4, 322.2], [110, 250]],
            ['Núcleo interno', [528.3, 341.7], [110, 450]],
            ['Litosfera',      [753, 410],     [890, 480]],
        ])),

    plantilla('volcan', 'Partes de un volcán', 'Ciencias Naturales · Geología', 'Secundaria',
        'Primaria · 1º ESO', '🌋',
        hoja('Partes de un volcán', 'volcan.svg', [
            ['Cámara magmática',        [500, 625], [110, 610]],
            ['Chimenea principal',      [500, 380], [110, 440]],
            ['Cráter',                  [500, 165], [890, 150]],
            ['Cono volcánico',          [690, 440], [890, 450]],
            ['Colada de lava',          [345, 322], [110, 290]],
            ['Cono secundario',         [690, 292], [890, 290]],
            ['Nube de gases y cenizas', [500, 70],  [110, 80]],
        ])),
];
