import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { guardarRegistroLocal } from './utils/registrosLocales';
import { sonidoActivo, setSonidoActivo, sonidoCorrecto, sonidoIncorrecto, sonidoFinal } from './utils/sonidosFeedback';
import { TIPOS_MATES, crearGeneradorMates } from './ovniMates';
import { cargarModelosGranja, instanciarModelo, ponerClip } from './ovniModelos';
import { crearAmbiente, vientoEnHierba } from './ovniAmbiente';
import { generarFichaOvni } from './ovniFicha';
import ChipAntena from './mandos/ChipAntena.jsx';
import { useMandosOvni, PanelMandosOvni, PilotoEnJuego } from './ovniMandos.jsx';
import { escucharManos } from './manos/manosVision.js';
import VistaManos from './manos/VistaManos.jsx';
import { db } from './firebase';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import { leerCompeticionUrl, soloPrimitivos } from './utils/retoLink';
import ModalEnviarCompeticion from './components/ModalEnviarCompeticion';

// ─── Ovni Abducción ──────────────────────────────────────────────────────────
// Granja 3D de noche (three.js): el enunciado pide una categoría («Abduce: VERBOS»)
// y cada animal lleva un cartel con una palabra. Hay que abducir con el rayo
// a todos los de esa categoría; si subes uno equivocado, la nave lo escupe y
// pierdes una vida. Los animales son low-poly procedurales (patas articuladas,
// caminar/correr/pastar/asustarse), sin modelos externos.

// ─── Bancos de categorías (modo libre) ───────────────────────────────────────
// Materias de la portada (mismos ids y colores que las áreas de LandingGames3)
export const AREAS_OVNI = [
    { id: 'MATEMATICAS', label: 'Matemáticas', emoji: '🔢', color: '#009688' },
    { id: 'LENGUA', label: 'Lengua', emoji: '📖', color: '#7B1FA2' },
    { id: 'GEO_HISTORIA', label: 'Geo e Historia', emoji: '🌍', color: '#F57C00' },
    { id: 'FISICA_QUIMICA', label: 'Física y Química', emoji: '⚗️', color: '#C62828' },
    { id: 'BIOLOGIA', label: 'Biología', emoji: '🔬', color: '#2E7D32' },
    { id: 'MUSICA', label: 'Música', emoji: '🎵', color: '#5E35B1' },
    { id: 'TECNOLOGIA', label: 'Tecnología', emoji: '⚙️', color: '#546E7A' },
    { id: 'PLASTICA', label: 'Plástica', emoji: '🎨', color: '#AD1457' },
    { id: 'IDIOMAS', label: 'Idiomas', emoji: '🌐', color: '#1565C0' },
    { id: 'ED_FISICA', label: 'Educación Física', emoji: '🏃', color: '#15803d' },
    { id: 'TUTORIA', label: 'Tutoría', emoji: '🍎', color: '#c2410c' },
];

// Una palabra no puede estar en dos categorías del mismo banco (se corrige por pertenencia).
export const BANCOS_OVNI = [
    // ── Matemáticas (además del generador 🔢 Números) ──
    {
        id: 'pares', area: 'MATEMATICAS', nombre: 'Pares e impares', emoji: '🔢',
        categorias: {
            'Números pares': ['12', '38', '140', '6', '74', '1.000', '256', '90', '18', '2', '532', '48', '316', '64'],
            'Números impares': ['7', '15', '99', '3', '121', '57', '1', '333', '45', '89', '701', '23', '505', '77'],
        },
    },
    {
        id: 'figuras', area: 'MATEMATICAS', nombre: 'Polígonos, figuras curvas y cuerpos', emoji: '🔷',
        categorias: {
            'Polígonos': ['triángulo', 'cuadrado', 'pentágono', 'hexágono', 'rombo', 'trapecio', 'rectángulo', 'octógono', 'romboide', 'decágono'],
            'Figuras curvas': ['círculo', 'elipse', 'óvalo', 'semicírculo', 'corona circular', 'sector circular'],
            'Cuerpos geométricos': ['cubo', 'prisma', 'pirámide', 'cilindro', 'cono', 'esfera', 'tetraedro', 'octaedro', 'ortoedro', 'dodecaedro'],
        },
    },
    {
        id: 'unidades', area: 'MATEMATICAS', nombre: 'Unidades de medida', emoji: '📏',
        categorias: {
            'Longitud': ['metro', 'kilómetro', 'centímetro', 'milímetro', 'decímetro', 'hectómetro', 'milla', 'pulgada'],
            'Masa': ['gramo', 'kilogramo', 'miligramo', 'tonelada', 'decagramo', 'hectogramo', 'quintal'],
            'Capacidad': ['litro', 'mililitro', 'centilitro', 'decilitro', 'kilolitro', 'hectolitro', 'decalitro'],
            'Tiempo': ['segundo', 'minuto', 'hora', 'día', 'semana', 'década', 'siglo', 'milenio'],
        },
    },
    // ── Lengua ──
    {
        id: 'gramatica', area: 'LENGUA', nombre: 'Categorías gramaticales', emoji: '📝',
        categorias: {
            'Sustantivos': ['casa', 'perro', 'libro', 'mesa', 'árbol', 'ciudad', 'amigo', 'montaña', 'río', 'ventana', 'lápiz', 'camino', 'flor', 'escuela', 'nube'],
            'Verbos': ['correr', 'saltar', 'comer', 'escribir', 'cantar', 'leer', 'dormir', 'jugar', 'pensar', 'nadar', 'bailar', 'vivir', 'abrir', 'mirar', 'subir'],
            'Adjetivos': ['alto', 'bonito', 'rápido', 'feliz', 'verde', 'grande', 'suave', 'valiente', 'amable', 'alegre', 'oscuro', 'pequeño', 'dulce', 'limpio', 'tranquilo'],
            'Adverbios': ['rápidamente', 'ayer', 'siempre', 'aquí', 'nunca', 'lejos', 'todavía', 'despacio', 'ahora', 'jamás', 'cerca', 'pronto', 'también', 'quizás', 'hoy'],
        },
    },
    {
        id: 'nexos', area: 'LENGUA', nombre: 'Determinantes, pronombres, preposiciones y conjunciones', emoji: '🔗',
        categorias: {
            'Determinantes': ['el', 'un', 'una', 'unos', 'mi', 'tu', 'mis', 'sus', 'cada', 'este', 'esa', 'aquellos', 'dos', 'tres'],
            'Pronombres personales': ['yo', 'tú', 'él', 'nosotros', 'vosotras', 'ellos', 'me', 'te', 'nos', 'os', 'usted', 'conmigo', 'contigo'],
            'Preposiciones': ['a', 'ante', 'bajo', 'con', 'contra', 'de', 'desde', 'en', 'entre', 'hacia', 'hasta', 'para', 'por', 'según', 'sin', 'sobre', 'tras'],
            'Conjunciones': ['y', 'e', 'ni', 'o', 'u', 'pero', 'sino', 'aunque', 'porque', 'pues'],
        },
    },
    {
        id: 'acentuacion', area: 'LENGUA', nombre: 'Agudas, llanas y esdrújulas', emoji: '✍️',
        categorias: {
            'Agudas': ['canción', 'reloj', 'papel', 'café', 'sofá', 'camión', 'pared', 'feliz', 'jabón', 'ratón', 'mamá', 'vivir', 'corazón', 'compás', 'salud'],
            'Llanas': ['árbol', 'mesa', 'lápiz', 'casa', 'fácil', 'libro', 'azúcar', 'cárcel', 'perro', 'útil', 'silla', 'césped', 'zapato', 'móvil', 'ventana'],
            'Esdrújulas': ['música', 'pájaro', 'médico', 'teléfono', 'lámpara', 'sábado', 'brújula', 'plátano', 'número', 'cámara', 'miércoles', 'océano', 'fábrica', 'árboles', 'régimen'],
        },
    },
    {
        id: 'generos', area: 'LENGUA', nombre: 'Géneros literarios', emoji: '📚',
        categorias: {
            'Lírica': ['poema', 'soneto', 'oda', 'elegía', 'haiku', 'copla', 'égloga', 'madrigal'],
            'Narrativa': ['novela', 'cuento', 'fábula', 'leyenda', 'epopeya', 'mito', 'cantar de gesta'],
            'Teatro': ['tragedia', 'comedia', 'drama', 'entremés', 'sainete', 'farsa', 'auto sacramental'],
        },
    },
    // ── Geografía e Historia ──
    {
        id: 'geografia', area: 'GEO_HISTORIA', nombre: 'Países, capitales y ríos', emoji: '🌍',
        categorias: {
            'Países': ['Francia', 'Portugal', 'Italia', 'Alemania', 'Grecia', 'Noruega', 'Polonia', 'Suecia', 'Irlanda', 'Austria'],
            'Capitales': ['Madrid', 'París', 'Roma', 'Berlín', 'Lisboa', 'Atenas', 'Oslo', 'Varsovia', 'Dublín', 'Viena'],
            'Ríos': ['Ebro', 'Tajo', 'Duero', 'Guadalquivir', 'Danubio', 'Rin', 'Sena', 'Támesis', 'Loira', 'Volga'],
        },
    },
    {
        id: 'continentes', area: 'GEO_HISTORIA', nombre: 'Países por continentes', emoji: '🗺️',
        categorias: {
            'Europa': ['Francia', 'Italia', 'Alemania', 'Portugal', 'Grecia', 'Suecia', 'Polonia', 'Noruega', 'Irlanda', 'Austria', 'Hungría', 'Bélgica'],
            'América': ['México', 'Brasil', 'Argentina', 'Perú', 'Chile', 'Colombia', 'Canadá', 'Cuba', 'Venezuela', 'Uruguay', 'Bolivia', 'Ecuador'],
            'Asia': ['China', 'Japón', 'India', 'Tailandia', 'Vietnam', 'Corea del Sur', 'Indonesia', 'Filipinas', 'Mongolia', 'Nepal', 'Irán', 'Pakistán'],
            'África': ['Egipto', 'Marruecos', 'Kenia', 'Nigeria', 'Sudáfrica', 'Etiopía', 'Senegal', 'Ghana', 'Argelia', 'Túnez', 'Angola', 'Mali'],
            'Oceanía': ['Australia', 'Nueva Zelanda', 'Fiyi', 'Papúa Nueva Guinea', 'Samoa', 'Tonga', 'Vanuatu'],
        },
    },
    {
        id: 'espana', area: 'GEO_HISTORIA', nombre: 'Geografía de España', emoji: '🇪🇸',
        categorias: {
            'Cordilleras y sierras': ['Pirineos', 'Sistema Central', 'Sierra Nevada', 'Cordillera Cantábrica', 'Sistema Ibérico', 'Sierra Morena', 'Montes de Toledo', 'Cordillera Bética'],
            'Ríos de España': ['Ebro', 'Tajo', 'Duero', 'Guadalquivir', 'Guadiana', 'Miño', 'Júcar', 'Segura', 'Turia', 'Nervión'],
            'Islas': ['Mallorca', 'Menorca', 'Ibiza', 'Tenerife', 'Gran Canaria', 'Lanzarote', 'Fuerteventura', 'La Palma', 'Formentera', 'La Gomera'],
            'Comunidades autónomas': ['Aragón', 'Cataluña', 'Galicia', 'Andalucía', 'Castilla y León', 'Extremadura', 'Murcia', 'Navarra', 'Asturias', 'Cantabria'],
        },
    },
    {
        id: 'edades', area: 'GEO_HISTORIA', nombre: 'Etapas de la historia', emoji: '🏺',
        categorias: {
            'Prehistoria': ['Paleolítico', 'Neolítico', 'pinturas rupestres', 'dólmenes', 'menhires', 'Edad de los Metales', 'Atapuerca', 'Altamira'],
            'Edad Antigua': ['pirámides de Egipto', 'Imperio romano', 'Julio César', 'democracia ateniense', 'Cleopatra', 'acueducto de Segovia', 'Alejandro Magno', 'Mesopotamia', 'Coliseo'],
            'Edad Media': ['castillos', 'feudalismo', 'Al-Ándalus', 'Carlomagno', 'Reconquista', 'catedrales góticas', 'Camino de Santiago', 'monasterios románicos', 'Alhambra'],
            'Edad Moderna': ['descubrimiento de América', 'Renacimiento', 'Reyes Católicos', 'Felipe II', 'Leonardo da Vinci', 'Barroco', 'Lutero', 'Cervantes'],
            'Edad Contemporánea': ['Revolución francesa', 'Napoleón', 'Primera Guerra Mundial', 'Segunda Guerra Mundial', 'Constitución de 1978', 'llegada a la Luna', 'internet'],
        },
    },
    // ── Física y Química ──
    {
        id: 'estados', area: 'FISICA_QUIMICA', nombre: 'Estados de la materia (a 20 °C)', emoji: '🧊',
        categorias: {
            'Sólidos': ['hierro', 'madera', 'hielo', 'sal', 'piedra', 'oro', 'azúcar', 'vidrio', 'cobre', 'diamante'],
            'Líquidos': ['agua', 'aceite', 'leche', 'mercurio', 'vinagre', 'gasolina', 'alcohol', 'zumo', 'sangre'],
            'Gases': ['oxígeno', 'nitrógeno', 'helio', 'vapor de agua', 'dióxido de carbono', 'hidrógeno', 'butano', 'neón', 'metano'],
        },
    },
    {
        id: 'elementos', area: 'FISICA_QUIMICA', nombre: 'Metales, no metales y gases nobles', emoji: '⚛️',
        categorias: {
            'Metales': ['hierro', 'cobre', 'oro', 'plata', 'sodio', 'aluminio', 'zinc', 'plomo', 'calcio', 'magnesio', 'potasio', 'níquel'],
            'No metales': ['carbono', 'oxígeno', 'nitrógeno', 'azufre', 'fósforo', 'cloro', 'flúor', 'yodo', 'hidrógeno', 'bromo'],
            'Gases nobles': ['helio', 'neón', 'argón', 'kriptón', 'xenón', 'radón'],
        },
    },
    {
        id: 'energia', area: 'FISICA_QUIMICA', nombre: 'Fuentes de energía', emoji: '⚡',
        categorias: {
            'Renovables': ['solar', 'eólica', 'hidráulica', 'geotérmica', 'mareomotriz', 'biomasa', 'undimotriz'],
            'No renovables': ['petróleo', 'carbón', 'gas natural', 'nuclear', 'gasóleo', 'propano'],
        },
    },
    // ── Biología ──
    {
        id: 'vertebrados', area: 'BIOLOGIA', nombre: 'Clases de vertebrados', emoji: '🦎',
        categorias: {
            'Mamíferos': ['delfín', 'murciélago', 'ballena', 'león', 'vaca', 'ornitorrinco', 'canguro', 'lobo', 'conejo', 'elefante', 'foca', 'jirafa'],
            'Aves': ['pingüino', 'avestruz', 'águila', 'gallina', 'loro', 'búho', 'cigüeña', 'paloma', 'flamenco', 'colibrí', 'pato', 'gorrión'],
            'Reptiles': ['cocodrilo', 'tortuga', 'lagartija', 'serpiente', 'camaleón', 'iguana', 'víbora', 'caimán', 'geco', 'dragón de Komodo'],
            'Peces': ['tiburón', 'salmón', 'atún', 'sardina', 'caballito de mar', 'raya', 'trucha', 'merluza', 'pez payaso', 'bacalao'],
            'Anfibios': ['rana', 'sapo', 'salamandra', 'tritón', 'ajolote', 'gallipato'],
        },
    },
    {
        id: 'invertebrados', area: 'BIOLOGIA', nombre: 'Invertebrados', emoji: '🐌',
        categorias: {
            'Insectos': ['hormiga', 'abeja', 'mariposa', 'escarabajo', 'mosca', 'saltamontes', 'mosquito', 'libélula', 'mariquita'],
            'Arácnidos': ['araña', 'escorpión', 'garrapata', 'ácaro', 'tarántula'],
            'Moluscos': ['caracol', 'pulpo', 'calamar', 'mejillón', 'almeja', 'babosa', 'sepia', 'ostra'],
            'Crustáceos': ['cangrejo', 'gamba', 'langosta', 'percebe', 'cochinilla', 'bogavante', 'langostino'],
        },
    },
    {
        id: 'dieta', area: 'BIOLOGIA', nombre: 'Herbívoros, carnívoros y omnívoros', emoji: '🥕',
        categorias: {
            'Herbívoros': ['vaca', 'caballo', 'conejo', 'jirafa', 'elefante', 'cebra', 'oveja', 'koala', 'hipopótamo', 'panda'],
            'Carnívoros': ['león', 'tigre', 'lobo', 'águila', 'tiburón', 'cocodrilo', 'búho', 'lince', 'foca', 'serpiente'],
            'Omnívoros': ['cerdo', 'oso', 'gallina', 'ratón', 'mapache', 'jabalí', 'chimpancé', 'cuervo'],
        },
    },
    {
        id: 'locomotor', area: 'BIOLOGIA', nombre: 'Huesos y músculos', emoji: '🦴',
        categorias: {
            'Huesos': ['fémur', 'tibia', 'peroné', 'húmero', 'cúbito', 'radio', 'cráneo', 'costillas', 'esternón', 'clavícula', 'omóplato', 'rótula', 'pelvis', 'vértebras', 'falanges'],
            'Músculos': ['bíceps', 'tríceps', 'deltoides', 'pectoral', 'abdominales', 'gemelos', 'cuádriceps', 'glúteo', 'diafragma', 'sartorio', 'masetero', 'dorsal ancho'],
        },
    },
    {
        id: 'aparatos', area: 'BIOLOGIA', nombre: 'Aparatos y sistemas del cuerpo', emoji: '🫀',
        categorias: {
            'Sistema circulatorio': ['corazón', 'arterias', 'venas', 'capilares', 'aorta', 'aurícula', 'ventrículo', 'glóbulos rojos', 'plaquetas'],
            'Aparato respiratorio': ['pulmones', 'tráquea', 'bronquios', 'alvéolos', 'laringe', 'fosas nasales', 'bronquiolos'],
            'Aparato digestivo': ['estómago', 'esófago', 'intestino delgado', 'intestino grueso', 'hígado', 'páncreas', 'vesícula biliar', 'recto'],
            'Sistema nervioso': ['cerebro', 'cerebelo', 'neuronas', 'médula espinal', 'nervios', 'bulbo raquídeo'],
            'Aparato excretor': ['riñones', 'vejiga', 'uréteres', 'uretra', 'nefronas'],
        },
    },
    // ── Música ──
    {
        id: 'instrumentos', area: 'MUSICA', nombre: 'Familias de instrumentos', emoji: '🎻',
        categorias: {
            'Cuerda': ['violín', 'viola', 'violonchelo', 'contrabajo', 'guitarra', 'arpa', 'laúd', 'bandurria', 'ukelele'],
            'Viento madera': ['flauta', 'clarinete', 'oboe', 'fagot', 'saxofón', 'flautín', 'corno inglés'],
            'Viento metal': ['trompeta', 'trombón', 'tuba', 'trompa', 'fliscorno', 'bombardino'],
            'Percusión': ['tambor', 'timbal', 'platillos', 'xilófono', 'triángulo', 'castañuelas', 'bombo', 'pandereta', 'maracas'],
        },
    },
    {
        id: 'lenguaje_musical', area: 'MUSICA', nombre: 'Dinámica, tempo y figuras', emoji: '🎼',
        categorias: {
            'Dinámica': ['piano', 'forte', 'mezzoforte', 'fortissimo', 'pianissimo', 'crescendo', 'diminuendo'],
            'Tempo': ['allegro', 'adagio', 'andante', 'presto', 'largo', 'moderato', 'lento', 'vivace'],
            'Figuras musicales': ['redonda', 'blanca', 'negra', 'corchea', 'semicorchea', 'fusa', 'semifusa'],
        },
    },
    // ── Tecnología ──
    {
        id: 'materiales', area: 'TECNOLOGIA', nombre: 'Materiales de uso técnico', emoji: '🔩',
        categorias: {
            'Metales': ['hierro', 'acero', 'cobre', 'aluminio', 'bronce', 'latón', 'estaño', 'titanio'],
            'Plásticos': ['PVC', 'polietileno', 'metacrilato', 'nailon', 'poliestireno', 'PET', 'baquelita', 'teflón'],
            'Maderas': ['pino', 'roble', 'haya', 'contrachapado', 'aglomerado', 'DM', 'nogal', 'cedro'],
            'Pétreos y cerámicos': ['mármol', 'granito', 'ladrillo', 'porcelana', 'cerámica', 'pizarra', 'arcilla', 'azulejo'],
        },
    },
    {
        id: 'perifericos', area: 'TECNOLOGIA', nombre: 'Periféricos del ordenador', emoji: '🖥️',
        categorias: {
            'Entrada': ['teclado', 'ratón', 'micrófono', 'escáner', 'webcam', 'joystick', 'lector de huellas'],
            'Salida': ['monitor', 'impresora', 'altavoces', 'auriculares', 'proyector'],
            'Almacenamiento': ['disco duro', 'pendrive', 'tarjeta SD', 'DVD', 'SSD', 'disco externo'],
        },
    },
    // ── Plástica ──
    {
        id: 'colores', area: 'PLASTICA', nombre: 'Colores cálidos, fríos y neutros', emoji: '🌈',
        categorias: {
            'Colores cálidos': ['rojo', 'naranja', 'amarillo', 'ocre', 'granate', 'coral', 'bermellón'],
            'Colores fríos': ['azul', 'verde', 'violeta', 'turquesa', 'añil', 'cian'],
            'Colores neutros': ['blanco', 'negro', 'gris', 'gris perla', 'gris marengo'],
        },
    },
    {
        id: 'tecnicas', area: 'PLASTICA', nombre: 'Técnicas artísticas', emoji: '🖌️',
        categorias: {
            'Técnicas secas': ['lápiz de grafito', 'carboncillo', 'ceras', 'pastel', 'lápices de colores', 'sanguina'],
            'Técnicas húmedas': ['acuarela', 'témpera', 'óleo', 'acrílico', 'tinta china', 'gouache'],
            'Grabado y estampación': ['linograbado', 'xilografía', 'aguafuerte', 'serigrafía', 'monotipo'],
        },
    },
    {
        id: 'artistas', area: 'PLASTICA', nombre: 'Artistas y movimientos', emoji: '🖼️',
        categorias: {
            'Renacimiento': ['Leonardo da Vinci', 'Miguel Ángel', 'Rafael', 'Botticelli', 'Tiziano'],
            'Barroco': ['Velázquez', 'Rembrandt', 'Caravaggio', 'Rubens', 'Murillo'],
            'Impresionismo': ['Monet', 'Renoir', 'Degas', 'Pissarro', 'Sisley'],
            'Cubismo': ['Picasso', 'Braque', 'Juan Gris'],
            'Surrealismo': ['Dalí', 'Magritte', 'Miró', 'Max Ernst'],
        },
    },
    // ── Idiomas ──
    {
        id: 'english', area: 'IDIOMAS', nombre: 'English vocabulary', emoji: '🇬🇧',
        categorias: {
            'Animals': ['dog', 'horse', 'rabbit', 'tiger', 'sheep', 'monkey', 'duck', 'snake', 'whale', 'mouse'],
            'Colours': ['red', 'yellow', 'purple', 'green', 'orange', 'pink', 'brown', 'grey', 'blue', 'black'],
            'Food': ['bread', 'cheese', 'apple', 'rice', 'pasta', 'egg', 'soup', 'banana', 'cake', 'milk'],
            'Clothes': ['shirt', 'jacket', 'shoes', 'hat', 'skirt', 'socks', 'dress', 'scarf', 'trousers', 'gloves'],
        },
    },
    {
        id: 'sports', area: 'IDIOMAS', nombre: 'Sports: play, go or do?', emoji: '⚽',
        categorias: {
            'Play': ['football', 'basketball', 'tennis', 'volleyball', 'chess', 'golf', 'rugby', 'hockey', 'baseball', 'badminton'],
            'Go': ['swimming', 'skiing', 'cycling', 'running', 'climbing', 'surfing', 'skating', 'fishing', 'hiking', 'sailing'],
            'Do': ['karate', 'judo', 'yoga', 'gymnastics', 'athletics', 'aerobics', 'taekwondo', 'ballet', 'pilates'],
        },
    },
    {
        id: 'regular_irregular', area: 'IDIOMAS', nombre: 'Regular or irregular verbs', emoji: '🔁',
        categorias: {
            'Regular verbs': ['play', 'walk', 'watch', 'jump', 'clean', 'listen', 'cook', 'study', 'dance', 'open', 'visit', 'help'],
            'Irregular verbs': ['go', 'eat', 'swim', 'write', 'buy', 'see', 'drink', 'run', 'take', 'come', 'sing', 'sleep'],
        },
    },
    {
        id: 'past_forms', area: 'IDIOMAS', nombre: 'Irregular verbs: past simple or participle', emoji: '⏮️',
        categorias: {
            'Past simple': ['went', 'ate', 'wrote', 'saw', 'took', 'spoke', 'broke', 'drove', 'gave', 'swam', 'began', 'drank'],
            'Past participle': ['gone', 'eaten', 'written', 'seen', 'taken', 'spoken', 'broken', 'driven', 'given', 'swum', 'begun', 'drunk'],
        },
    },
    {
        id: 'francais', area: 'IDIOMAS', nombre: 'Vocabulaire français', emoji: '🇫🇷',
        categorias: {
            'Animaux': ['chien', 'chat', 'cheval', 'oiseau', 'vache', 'lapin', 'poisson', 'souris'],
            'Couleurs': ['rouge', 'bleu', 'vert', 'jaune', 'noir', 'blanc', 'rose', 'violet'],
            'Nourriture': ['pain', 'fromage', 'pomme', 'lait', 'gâteau', 'riz', 'poulet', 'soupe', 'beurre', 'confiture'],
            'Vêtements': ['chemise', 'pantalon', 'robe', 'chaussures', 'chapeau', 'jupe', 'écharpe', 'manteau'],
        },
    },
    // ── Educación Física ──
    {
        id: 'deportes', area: 'ED_FISICA', nombre: 'Tipos de deportes', emoji: '🏅',
        categorias: {
            'Deportes colectivos': ['fútbol', 'baloncesto', 'balonmano', 'voleibol', 'rugby', 'waterpolo', 'hockey', 'béisbol'],
            'Deportes individuales': ['atletismo', 'natación', 'ciclismo', 'gimnasia rítmica', 'escalada', 'esquí', 'triatlón', 'golf'],
            'Deportes de raqueta': ['tenis', 'bádminton', 'pádel', 'squash', 'tenis de mesa', 'frontenis'],
            'Deportes de combate': ['judo', 'kárate', 'boxeo', 'taekwondo', 'esgrima', 'lucha libre'],
        },
    },
    {
        id: 'capacidades', area: 'ED_FISICA', nombre: 'Capacidades físicas básicas', emoji: '💪',
        categorias: {
            'Resistencia': ['carrera continua', 'test de Cooper', 'nadar 1 km', 'correr 20 minutos', 'ciclismo de fondo', 'test de la Course Navette'],
            'Fuerza': ['flexiones', 'abdominales', 'sentadillas', 'levantar pesas', 'dominadas', 'balón medicinal'],
            'Velocidad': ['sprint de 30 m', 'salida de tacos', 'reacción a una señal', 'carrera de 60 m', 'relevos'],
            'Flexibilidad': ['estiramientos', 'yoga', 'test sit and reach', 'tocar las puntas de los pies', 'el puente', 'spagat'],
        },
    },
    // ── Tutoría ──
    {
        id: 'emociones', area: 'TUTORIA', nombre: 'Emociones agradables y desagradables', emoji: '😊',
        categorias: {
            'Emociones agradables': ['alegría', 'calma', 'gratitud', 'orgullo', 'entusiasmo', 'amor', 'satisfacción', 'ilusión'],
            'Emociones desagradables': ['tristeza', 'miedo', 'rabia', 'vergüenza', 'culpa', 'envidia', 'frustración', 'asco'],
        },
    },
    {
        id: 'habitos', area: 'TUTORIA', nombre: 'Hábitos saludables', emoji: '🥗',
        categorias: {
            'Hábitos saludables': ['dormir 9 horas', 'beber agua', 'comer fruta', 'hacer deporte', 'lavarse los dientes', 'desayunar bien', 'leer antes de dormir'],
            'Hábitos poco saludables': ['pantallas hasta tarde', 'saltarse el desayuno', 'bollería a diario', 'pasar el día sentado', 'refrescos azucarados', 'dormir poco', 'comida rápida'],
        },
    },
];

const KEY_CUSTOM = 'pikt_ovni_custom';
const KEY_JOYSTICK = 'pikt_ovni_joystick';
const KEY_MANDOS = 'pikt_ovni_mandos'; // { activos, invertir, turnos }
const EJEMPLO_CUSTOM = 'Frutas: manzana, pera, plátano, uva, naranja, fresa\nVerduras: lechuga, zanahoria, pepino, calabacín, puerro, acelga\nCereales: trigo, arroz, maíz, avena, cebada, centeno';

/** «Categoría: palabra, palabra…» por línea → { categoría: [palabras] } (o null si no hay al menos 2 categorías con 2 palabras). */
export const parsearCategorias = (texto) => {
    const cats = {};
    String(texto || '').split('\n').forEach(linea => {
        const i = linea.indexOf(':');
        if (i <= 0) return;
        const nombre = linea.slice(0, i).trim();
        const palabras = linea.slice(i + 1).split(',').map(p => p.trim()).filter(Boolean);
        if (nombre && palabras.length) cats[nombre] = [...new Set([...(cats[nombre] || []), ...palabras])];
    });
    const validas = Object.fromEntries(Object.entries(cats).filter(([, ps]) => ps.length >= 2));
    return Object.keys(validas).length >= 2 ? validas : null;
};

const barajar = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
};

/**
 * Rondas a partir de categorías de palabras: cada ronda pide una categoría
 * (barajadas, sin repetir dos seguidas) con 3-4 palabras suyas y el resto de otras.
 * Devuelve generarRonda(i) → { objetivo, items: [{ texto, correcta, explicacion }] }.
 */
export const crearGeneradorPalabras = (categorias, totalRondas) => {
    const nombres = Object.keys(categorias);
    const esDe = (p, cat) => (categorias[cat] || []).includes(p);
    const usadas = Object.fromEntries(nombres.map(c => [c, []]));
    const orden = [];
    while (orden.length < totalRondas) {
        barajar(nombres).forEach(c => {
            if (orden.length < totalRondas && orden[orden.length - 1] !== c) orden.push(c);
        });
    }
    const sacar = (cat, n, excluirCat) => {
        let libres = categorias[cat].filter(p => !usadas[cat].includes(p) && !(excluirCat && esDe(p, excluirCat)));
        if (libres.length < n) {
            usadas[cat] = [];
            libres = categorias[cat].filter(p => !(excluirCat && esDe(p, excluirCat)));
        }
        const elegidas = barajar(libres).slice(0, n);
        usadas[cat].push(...elegidas);
        return elegidas;
    };
    return (i) => {
        const objetivo = orden[i % orden.length];
        const otras = nombres.filter(c => c !== objetivo);
        const nObj = Math.min(categorias[objetivo].length, 3 + Math.floor(Math.random() * 2));
        const items = sacar(objetivo, nObj).map(p => ({ texto: p, correcta: true }));
        for (let k = 0; items.length < ANIMALES_POR_RONDA && k < 40; k++) {
            const c = otras[k % otras.length];
            const [p] = sacar(c, 1, objetivo);
            if (p && !items.some(it => it.texto === p)) items.push({ texto: p, correcta: false, explicacion: `«${p}» es de ${c}` });
        }
        return { objetivo, items };
    };
};

// ─── Ajustes del motor ───────────────────────────────────────────────────────
const LIMITE = 52;           // medio lado del prado donde se mueven nave y animales
const ALTURA_OVNI = 8;
const RADIO_RAYO = 3.4;      // distancia horizontal para poder abducir
const MANO_ZONA_MUERTA = 0.04; // mano con la webcam: margen en el centro sin moverse
const MANO_RECORRIDO = 0.18;   // desplazamiento de la palma para ir a tope
const ESCALA_ANIMAL = 1.3;
const ANIMALES_POR_RONDA = 8;
const VIDAS = 3;
export const COLORES_JUGADOR = [
    { hex: 0x00ffcc, css: '#00f0ff', nombre: 'cian' },
    { hex: 0xff4fd8, css: '#ff4fd8', nombre: 'magenta' },
];

const ANIMO = {
    tranquilos: { alerta: 0, espera: 1 },
    normal: { alerta: 5.5, espera: 1.0 },
    nerviosos: { alerta: 8, espera: 0.5 },
};

// velocidad paseando / huyendo (unidades por segundo)
const TIPOS = {
    vaca: { paseo: 0.7, huida: 4.5, alto: 2.2 },
    oveja: { paseo: 0.9, huida: 5.0, alto: 1.6 },
    cerdo: { paseo: 1.0, huida: 5.5, alto: 1.45 },
    pollo: { paseo: 2.2, huida: 6.0, alto: 1.3 },
    caballo: { paseo: 1.6, huida: 8.0, alto: 2.9 },
    // estos dos solo existen como modelo .glb (no tienen versión procedural)
    llama: { paseo: 1.0, huida: 6.0, alto: 2.4 },
    perro: { paseo: 1.8, huida: 7.0, alto: 1.15 },
};
const NOMBRES_TIPOS = ['vaca', 'oveja', 'cerdo', 'pollo', 'caballo'];

const lerpAng = (a, b, t) => {
    const d = ((((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
    return a + d * t;
};
const suave = (k, dt) => 1 - Math.exp(-k * dt);

// ─── Sonidos propios (mismo AudioContext compartido que sonidosFeedback) ─────
const audioCtx = () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!window.gameAudioCtx) window.gameAudioCtx = new AC();
    if (window.gameAudioCtx.state === 'suspended') window.gameAudioCtx.resume();
    return window.gameAudioCtx;
};
const sfx = {
    rayo() {
        if (!sonidoActivo()) return;
        try {
            const ctx = audioCtx(); if (!ctx) return;
            const t = ctx.currentTime;
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(110, t);
            osc.frequency.exponentialRampToValueAtTime(900, t + 1.1);
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.linearRampToValueAtTime(0.07, t + 0.1);
            gain.gain.linearRampToValueAtTime(0.0001, t + 1.2);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(t); osc.stop(t + 1.25);
        } catch { /* sin audio */ }
    },
    susto() {
        if (!sonidoActivo()) return;
        try {
            const ctx = audioCtx(); if (!ctx) return;
            const t = ctx.currentTime;
            const osc = ctx.createOscillator(); const mod = ctx.createOscillator();
            const modGain = ctx.createGain(); const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(520, t);
            osc.frequency.linearRampToValueAtTime(170, t + 0.35);
            mod.frequency.setValueAtTime(32, t);
            modGain.gain.setValueAtTime(40, t);
            gain.gain.setValueAtTime(0.12, t);
            gain.gain.linearRampToValueAtTime(0.0001, t + 0.35);
            mod.connect(modGain); modGain.connect(osc.frequency);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(t); mod.start(t); osc.stop(t + 0.36); mod.stop(t + 0.36);
        } catch { /* sin audio */ }
    },
    golpe() {
        if (!sonidoActivo()) return;
        try {
            const ctx = audioCtx(); if (!ctx) return;
            const t = ctx.currentTime;
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(140, t);
            osc.frequency.exponentialRampToValueAtTime(45, t + 0.25);
            gain.gain.setValueAtTime(0.25, t);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(t); osc.stop(t + 0.32);
        } catch { /* sin audio */ }
    },
};

// ─── Texturas de canvas ──────────────────────────────────────────────────────
const rectRedondo = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
};

const texturaCartel = (texto) => {
    const c = document.createElement('canvas');
    const fuente = 'bold 60px system-ui, "Segoe UI", sans-serif';
    let ctx = c.getContext('2d');
    ctx.font = fuente;
    const w = Math.ceil(ctx.measureText(texto).width) + 60;
    c.width = w; c.height = 100;
    ctx = c.getContext('2d');
    rectRedondo(ctx, 4, 4, w - 8, 92, 22);
    ctx.fillStyle = '#fffbea'; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = '#1e293b'; ctx.stroke();
    ctx.font = fuente; ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(texto, w / 2, 54);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return { tex, aspecto: w / 100 };
};

const texturaIcono = (simbolo, fondo) => {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.beginPath(); ctx.arc(64, 64, 56, 0, Math.PI * 2);
    ctx.fillStyle = fondo; ctx.fill();
    ctx.lineWidth = 8; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.font = 'bold 84px system-ui, sans-serif';
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(simbolo, 64, 70);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
};

const texturaPunto = () => {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
};

// ─── Fábrica de piezas low-poly ──────────────────────────────────────────────
const crearFabrica = () => {
    const geoCaja = new THREE.BoxGeometry(1, 1, 1);
    const geoIco = new THREE.IcosahedronGeometry(1, 0);
    const mats = new Map();
    const mat = (color, extra = {}) => {
        const clave = color + JSON.stringify(extra);
        if (!mats.has(clave)) mats.set(clave, new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra }));
        return mats.get(clave);
    };
    const pieza = (geo, padre, color, sx, sy, sz, x, y, z, extra) => {
        const m = new THREE.Mesh(geo, mat(color, extra));
        m.scale.set(sx, sy, sz); m.position.set(x, y, z);
        m.castShadow = true;
        padre.add(m);
        return m;
    };
    const caja = (...a) => pieza(geoCaja, ...a);
    const bola = (...a) => pieza(geoIco, ...a);
    // Pata con el pivote en la cadera: girar pivot.rotation.x = paso
    const pata = (padre, color, largo, grosor, x, yCadera, z, pezuña) => {
        const pivot = new THREE.Group();
        pivot.position.set(x, yCadera, z);
        caja(pivot, color, grosor, largo, grosor, 0, -largo / 2, 0);
        if (pezuña) caja(pivot, pezuña, grosor * 1.08, largo * 0.16, grosor * 1.08, 0, -largo + largo * 0.08, 0);
        padre.add(pivot);
        return pivot;
    };
    const dispose = () => { geoCaja.dispose(); geoIco.dispose(); mats.forEach(m => m.dispose()); };
    return { caja, bola, pata, mat, dispose };
};

// Cada animal mira hacia +Z en su espacio local.
const construirAnimal = (F, tipo) => {
    const root = new THREE.Group();
    const torso = new THREE.Group();
    const cabeza = new THREE.Group();
    root.add(torso);
    const rig = { root, torso, cabeza, patas: [], cola: null, alas: [], baseTorso: 0, bipedo: false };

    if (tipo === 'vaca') {
        const y = 0.75;
        rig.patas = [[-0.32, 0.55], [0.32, 0.55], [-0.32, -0.55], [0.32, -0.55]]
            .map(([x, z]) => F.pata(root, 0xf5f5f0, 0.75, 0.22, x, y, z, 0x3b2a20));
        torso.position.y = y; rig.baseTorso = y;
        F.caja(torso, 0xf5f5f0, 0.9, 0.7, 1.6, 0, 0.35, 0);
        F.caja(torso, 0x1f1f1f, 0.92, 0.32, 0.42, 0, 0.42, 0.2);
        F.caja(torso, 0x1f1f1f, 0.92, 0.36, 0.38, 0, 0.3, -0.45);
        F.caja(torso, 0xf4a6b8, 0.3, 0.16, 0.3, 0, -0.02, -0.3);
        cabeza.position.set(0, 0.75, 0.85); torso.add(cabeza);
        F.caja(cabeza, 0xf5f5f0, 0.5, 0.5, 0.55, 0, 0, 0.15);
        F.caja(cabeza, 0xf4a6b8, 0.52, 0.24, 0.2, 0, -0.13, 0.43);
        F.caja(cabeza, 0xe8dcc0, 0.08, 0.2, 0.08, 0.2, 0.32, 0.05);
        F.caja(cabeza, 0xe8dcc0, 0.08, 0.2, 0.08, -0.2, 0.32, 0.05);
        F.caja(cabeza, 0x1f1f1f, 0.18, 0.08, 0.12, 0.33, 0.12, 0.05);
        F.caja(cabeza, 0x1f1f1f, 0.18, 0.08, 0.12, -0.33, 0.12, 0.05);
        F.caja(cabeza, 0x111111, 0.07, 0.07, 0.04, 0.17, 0.08, 0.43);
        F.caja(cabeza, 0x111111, 0.07, 0.07, 0.04, -0.17, 0.08, 0.43);
        rig.cola = new THREE.Group(); rig.cola.position.set(0, 0.6, -0.8); torso.add(rig.cola);
        F.caja(rig.cola, 0x1f1f1f, 0.06, 0.6, 0.06, 0, -0.3, 0);
    } else if (tipo === 'oveja') {
        const y = 0.45;
        rig.patas = [[-0.24, 0.32], [0.24, 0.32], [-0.24, -0.32], [0.24, -0.32]]
            .map(([x, z]) => F.pata(root, 0x2b2b2b, 0.45, 0.14, x, y, z));
        torso.position.y = y; rig.baseTorso = y;
        [[0, 0.38, 0.22, 0.4], [0, 0.38, -0.22, 0.42], [0.2, 0.32, 0, 0.36], [-0.2, 0.32, 0, 0.36], [0, 0.56, 0, 0.36], [0, 0.42, -0.42, 0.3]]
            .forEach(([x, yy, z, r]) => F.bola(torso, 0xf3f0e6, r, r, r, x, yy, z));
        cabeza.position.set(0, 0.55, 0.55); torso.add(cabeza);
        F.caja(cabeza, 0x2b2b2b, 0.32, 0.36, 0.42, 0, 0, 0.12);
        F.bola(cabeza, 0xf3f0e6, 0.22, 0.16, 0.22, 0, 0.2, 0.02);
        F.caja(cabeza, 0x2b2b2b, 0.22, 0.08, 0.1, 0.24, 0.06, 0.02);
        F.caja(cabeza, 0x2b2b2b, 0.22, 0.08, 0.1, -0.24, 0.06, 0.02);
        F.caja(cabeza, 0xffffff, 0.07, 0.07, 0.03, 0.1, 0.06, 0.33);
        F.caja(cabeza, 0xffffff, 0.07, 0.07, 0.03, -0.1, 0.06, 0.33);
    } else if (tipo === 'cerdo') {
        const y = 0.36;
        rig.patas = [[-0.24, 0.38], [0.24, 0.38], [-0.24, -0.38], [0.24, -0.38]]
            .map(([x, z]) => F.pata(root, 0xf3a3b5, 0.36, 0.16, x, y, z, 0xc97b8e));
        torso.position.y = y; rig.baseTorso = y;
        F.caja(torso, 0xf3a3b5, 0.75, 0.62, 1.15, 0, 0.32, 0);
        cabeza.position.set(0, 0.42, 0.6); torso.add(cabeza);
        F.caja(cabeza, 0xf3a3b5, 0.52, 0.46, 0.4, 0, 0, 0.1);
        F.caja(cabeza, 0xe48aa0, 0.26, 0.2, 0.1, 0, -0.05, 0.34);
        F.caja(cabeza, 0x7a3044, 0.05, 0.06, 0.02, 0.06, -0.05, 0.4);
        F.caja(cabeza, 0x7a3044, 0.05, 0.06, 0.02, -0.06, -0.05, 0.4);
        F.caja(cabeza, 0xe48aa0, 0.14, 0.16, 0.06, 0.18, 0.28, 0.02);
        F.caja(cabeza, 0xe48aa0, 0.14, 0.16, 0.06, -0.18, 0.28, 0.02);
        F.caja(cabeza, 0x111111, 0.06, 0.06, 0.03, 0.13, 0.1, 0.31);
        F.caja(cabeza, 0x111111, 0.06, 0.06, 0.03, -0.13, 0.1, 0.31);
        rig.cola = new THREE.Group(); rig.cola.position.set(0, 0.5, -0.6); torso.add(rig.cola);
        F.caja(rig.cola, 0xe48aa0, 0.06, 0.06, 0.18, 0, 0, -0.06);
        F.caja(rig.cola, 0xe48aa0, 0.06, 0.14, 0.06, 0, 0.06, -0.14);
    } else if (tipo === 'caballo') {
        const y = 1.0;
        rig.patas = [[-0.24, 0.65], [0.24, 0.65], [-0.24, -0.65], [0.24, -0.65]]
            .map(([x, z]) => F.pata(root, 0x8b5a2b, 1.0, 0.18, x, y, z, 0x2b1d12));
        torso.position.y = y; rig.baseTorso = y;
        F.caja(torso, 0x8b5a2b, 0.7, 0.72, 1.75, 0, 0.36, 0);
        cabeza.position.set(0, 0.6, 0.8); torso.add(cabeza);
        const cuello = F.caja(cabeza, 0x8b5a2b, 0.32, 0.95, 0.42, 0, 0.35, 0.08); cuello.rotation.x = 0.5;
        const crin = F.caja(cabeza, 0x2b1d12, 0.12, 0.9, 0.14, 0, 0.42, -0.12); crin.rotation.x = 0.5;
        F.caja(cabeza, 0x8b5a2b, 0.32, 0.34, 0.72, 0, 0.78, 0.5);
        F.caja(cabeza, 0x5d3a1a, 0.33, 0.2, 0.2, 0, 0.72, 0.84);
        F.caja(cabeza, 0x8b5a2b, 0.08, 0.18, 0.08, 0.1, 1.0, 0.25);
        F.caja(cabeza, 0x8b5a2b, 0.08, 0.18, 0.08, -0.1, 1.0, 0.25);
        F.caja(cabeza, 0x111111, 0.05, 0.07, 0.07, 0.17, 0.86, 0.55);
        F.caja(cabeza, 0x111111, 0.05, 0.07, 0.07, -0.17, 0.86, 0.55);
        rig.cola = new THREE.Group(); rig.cola.position.set(0, 0.62, -0.88); torso.add(rig.cola);
        const colaC = F.caja(rig.cola, 0x2b1d12, 0.12, 0.8, 0.14, 0, -0.36, -0.08); colaC.rotation.x = -0.3;
    } else {
        // pollo
        const y = 0.3;
        rig.bipedo = true;
        rig.patas = [[-0.1, 0], [0.1, 0]].map(([x, z]) => F.pata(root, 0xf4b400, 0.3, 0.06, x, y, z));
        torso.position.y = y; rig.baseTorso = y;
        F.caja(torso, 0xfafafa, 0.42, 0.42, 0.52, 0, 0.24, 0);
        F.caja(torso, 0xfafafa, 0.24, 0.26, 0.12, 0, 0.4, -0.3);
        rig.alas = [1, -1].map(lado => {
            const p = new THREE.Group(); p.position.set(0.22 * lado, 0.38, 0); torso.add(p);
            F.caja(p, 0xececec, 0.06, 0.26, 0.36, 0.02 * lado, -0.12, 0);
            p.userData.lado = lado;
            return p;
        });
        cabeza.position.set(0, 0.5, 0.2); torso.add(cabeza);
        F.caja(cabeza, 0xfafafa, 0.26, 0.28, 0.26, 0, 0.1, 0.04);
        F.caja(cabeza, 0xf59e0b, 0.08, 0.07, 0.14, 0, 0.08, 0.22);
        F.caja(cabeza, 0xdc2626, 0.05, 0.13, 0.2, 0, 0.28, 0.04);
        F.caja(cabeza, 0xdc2626, 0.05, 0.1, 0.05, 0, -0.03, 0.16);
        F.caja(cabeza, 0x111111, 0.04, 0.05, 0.05, 0.13, 0.14, 0.1);
        F.caja(cabeza, 0x111111, 0.04, 0.05, 0.05, -0.13, 0.14, 0.1);
    }
    root.scale.setScalar(ESCALA_ANIMAL);
    return rig;
};

// ─── Ovni ────────────────────────────────────────────────────────────────────
const construirOvni = (F, colorHex = 0x00ffcc) => {
    const tinte = new THREE.Color(colorHex);
    const ovni = new THREE.Group();
    const inclin = new THREE.Group();
    const giro = new THREE.Group();
    ovni.add(inclin); inclin.add(giro);

    const perfil = [[0, -0.55], [1.1, -0.5], [2.4, -0.15], [3.0, 0], [2.6, 0.22], [1.6, 0.45], [0, 0.5]]
        .map(([x, y]) => new THREE.Vector2(x, y));
    const casco = new THREE.Mesh(new THREE.LatheGeometry(perfil, 28),
        new THREE.MeshStandardMaterial({ color: 0xb8c4d6, metalness: 0.45, roughness: 0.35, flatShading: true }));
    casco.castShadow = true;
    giro.add(casco);

    const anillo = new THREE.Mesh(new THREE.TorusGeometry(2.75, 0.09, 6, 40),
        new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.4 }));
    anillo.rotation.x = Math.PI / 2; anillo.position.y = 0.02;
    giro.add(anillo);

    const geoLuz = new THREE.SphereGeometry(0.15, 8, 6);
    const luces = [];
    for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const l = new THREE.Mesh(geoLuz, new THREE.MeshBasicMaterial({ color: tinte.clone() }));
        l.position.set(Math.cos(a) * 2.78, 0.06, Math.sin(a) * 2.78);
        giro.add(l); luces.push(l);
    }

    const cupula = new THREE.Mesh(new THREE.SphereGeometry(1.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: tinte.clone().lerp(new THREE.Color(0xffffff), 0.4), transparent: true, opacity: 0.45, emissive: tinte.clone().multiplyScalar(0.55), emissiveIntensity: 0.5, roughness: 0.1 }));
    cupula.position.y = 0.45;
    inclin.add(cupula);

    // tripulante
    const alien = new THREE.Group(); alien.position.y = 0.5; inclin.add(alien);
    F.bola(alien, 0x4ade80, 0.42, 0.5, 0.42, 0, 0.45, 0);
    F.bola(alien, 0x111111, 0.13, 0.18, 0.08, 0.15, 0.52, 0.34);
    F.bola(alien, 0x111111, 0.13, 0.18, 0.08, -0.15, 0.52, 0.34);
    F.caja(alien, 0x4ade80, 0.04, 0.3, 0.04, 0.16, 0.95, 0);
    F.caja(alien, 0x4ade80, 0.04, 0.3, 0.04, -0.16, 0.95, 0);
    F.bola(alien, 0xfacc15, 0.07, 0.07, 0.07, 0.16, 1.12, 0, { emissive: 0xfacc15, emissiveIntensity: 1 });
    F.bola(alien, 0xfacc15, 0.07, 0.07, 0.07, -0.16, 1.12, 0, { emissive: 0xfacc15, emissiveIntensity: 1 });

    const panza = new THREE.Mesh(new THREE.CircleGeometry(1.0, 24),
        new THREE.MeshBasicMaterial({ color: tinte.clone(), transparent: true, opacity: 0.9 }));
    panza.rotation.x = Math.PI / 2; panza.position.y = -0.56;
    giro.add(panza);

    // luz casi blanca con un toque del color de la nave: ilumina el suelo sin «pintarlo»
    const foco = new THREE.SpotLight(tinte.clone().lerp(new THREE.Color(0xffffff), 0.6), 110, 32, 0.42, 1, 2);
    foco.position.set(0, -0.6, 0);
    const destinoFoco = new THREE.Object3D(); destinoFoco.position.set(0, -12, 0);
    ovni.add(foco); ovni.add(destinoFoco); foco.target = destinoFoco;

    return { ovni, inclin, giro, luces, panza, foco, alien };
};

// ─── Motor del juego ─────────────────────────────────────────────────────────
export function crearMotor(contenedor, opciones, cb) {
    const { generarRonda, rondas: totalRondas, animo, jugadores: nJug = 1, modelos = null } = opciones;
    // con modelos .glb: los animales cargados + la gallina procedural; si no, todos procedurales
    const tiposDisponibles = modelos && Object.keys(modelos).length ? [...Object.keys(modelos), 'pollo'] : NOMBRES_TIPOS;
    const animoCfg = ANIMO[animo] || ANIMO.normal;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false; // se marca needsUpdate una vez por fotograma (2 vistas)
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    contenedor.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';

    const escena = new THREE.Scene();
    escena.fog = new THREE.Fog(0x2b1d50, 38, 150); // la distancia se funde con el morado del horizonte

    const F = crearFabrica();
    const texturas = [];

    // Cielo con degradado + estrellas + luna (siguen a la cámara)
    const cielo = new THREE.Group(); escena.add(cielo);
    cielo.add(new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false,
        uniforms: { arriba: { value: new THREE.Color(0x070414) }, horizonte: { value: new THREE.Color(0x3d2669) } },
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 arriba; uniform vec3 horizonte; varying vec3 vP; void main(){ float h = normalize(vP).y; gl_FragColor = vec4(mix(horizonte, arriba, smoothstep(-0.02, 0.55, h)), 1.0); }',
    })));
    const estrellasPos = [];
    for (let i = 0; i < 900; i++) {
        const th = Math.random() * Math.PI * 2; const ph = Math.acos(Math.random() * 0.92 + 0.05);
        estrellasPos.push(Math.sin(ph) * Math.cos(th) * 380, Math.cos(ph) * 380, Math.sin(ph) * Math.sin(th) * 380);
    }
    const geoEstrellas = new THREE.BufferGeometry();
    geoEstrellas.setAttribute('position', new THREE.Float32BufferAttribute(estrellasPos, 3));
    const texPunto = texturaPunto(); texturas.push(texPunto);
    const estrellas = new THREE.Points(geoEstrellas, new THREE.PointsMaterial({ size: 2.2, map: texPunto, transparent: true, depthWrite: false, fog: false, color: 0xe0e7ff, sizeAttenuation: false }));
    cielo.add(estrellas);
    const luna = new THREE.Mesh(new THREE.SphereGeometry(14, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfef9c3, fog: false }));
    luna.position.set(-140, 150, -300); cielo.add(luna);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texPunto, color: 0xfef3c7, transparent: true, opacity: 0.35, depthWrite: false, fog: false }));
    halo.scale.set(90, 90, 1); halo.position.copy(luna.position); cielo.add(halo);

    // Luces
    // noche: luz de luna fría y poca luz ambiente, para que destaquen el rayo, las luciérnagas y las ventanas
    escena.add(new THREE.HemisphereLight(0x7f8fe0, 0x1f3014, 0.85));
    const lunaLuz = new THREE.DirectionalLight(0xc7d2fe, 1.5);
    lunaLuz.position.set(-30, 60, 25);
    lunaLuz.castShadow = true;
    lunaLuz.shadow.mapSize.set(2048, 2048);
    Object.assign(lunaLuz.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 160 });
    lunaLuz.shadow.bias = -0.0005;
    escena.add(lunaLuz);

    // Suelo: prado plano dentro de la valla y lomas fuera
    const geoSuelo = new THREE.PlaneGeometry(420, 420, 120, 120);
    geoSuelo.rotateX(-Math.PI / 2);
    const pos = geoSuelo.attributes.position;
    const colores = [];
    const cTmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        const fuera = Math.max(Math.abs(x), Math.abs(z)) - 64;
        let y = 0;
        if (fuera > 0) y = Math.min(fuera / 30, 1) * (Math.sin(x * 0.05) * 4 + Math.cos(z * 0.045) * 5 + Math.sin((x + z) * 0.11) * 1.5 + 4);
        pos.setY(i, y);
        const v = Math.random() * 0.06;
        cTmp.setHSL(0.27 + v * 0.3, 0.45, (fuera > 0 ? 0.15 : 0.2) + v);
        colores.push(cTmp.r, cTmp.g, cTmp.b);
    }
    geoSuelo.setAttribute('color', new THREE.Float32BufferAttribute(colores, 3));
    geoSuelo.computeVertexNormals();
    const suelo = new THREE.Mesh(geoSuelo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
    suelo.receiveShadow = true;
    escena.add(suelo);

    // Matas de hierba (instanciadas)
    const geoMata = new THREE.ConeGeometry(0.18, 0.6, 4);
    geoMata.translate(0, 0.3, 0);
    const matas = new THREE.InstancedMesh(geoMata, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), 900);
    const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const s = new THREE.Vector3(); const p = new THREE.Vector3();
    for (let i = 0; i < 900; i++) {
        p.set((Math.random() - 0.5) * 124, 0, (Math.random() - 0.5) * 124);
        q.setFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.4, Math.random() * Math.PI, (Math.random() - 0.5) * 0.4));
        const k = 0.6 + Math.random() * 0.9; s.set(k, k * (0.7 + Math.random() * 0.8), k);
        m4.compose(p, q, s); matas.setMatrixAt(i, m4);
        cTmp.setHSL(0.24 + Math.random() * 0.08, 0.45, 0.21 + Math.random() * 0.1);
        matas.setColorAt(i, cTmp);
    }
    matas.instanceColor.needsUpdate = true;
    matas.receiveShadow = true;
    escena.add(matas);

    // Valla del prado
    const LV = 62;
    const postes = [];
    for (let t = -LV; t <= LV; t += 4) postes.push([t, -LV], [t, LV], [-LV, t], [LV, t]);
    const valla = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 1.6, 0.3), F.mat(0x8a6a48), postes.length);
    postes.forEach(([x, z], i) => { m4.makeTranslation(x, 0.8, z); valla.setMatrixAt(i, m4); });
    valla.castShadow = true;
    escena.add(valla);
    [[0, -LV, LV * 2, 0], [0, LV, LV * 2, 0], [-LV, 0, LV * 2, Math.PI / 2], [LV, 0, LV * 2, Math.PI / 2]].forEach(([x, z, largo, rot]) => {
        [0.6, 1.2].forEach(h => {
            const tabla = F.caja(escena, 0x9c7a55, largo, 0.14, 0.08, x, h, z);
            tabla.rotation.y = rot;
        });
    });

    // Granero, silo y casa al fondo
    const granero = new THREE.Group(); granero.position.set(-22, 0, -82); escena.add(granero);
    F.caja(granero, 0xb91c1c, 14, 8, 12, 0, 4, 0);
    const forma = new THREE.Shape(); forma.moveTo(-7.6, 0); forma.lineTo(0, 5); forma.lineTo(7.6, 0); forma.closePath();
    const tejado = new THREE.Mesh(new THREE.ExtrudeGeometry(forma, { depth: 12.8, bevelEnabled: false }), F.mat(0x5b1414));
    tejado.position.set(0, 8, -6.4); tejado.castShadow = true; granero.add(tejado);
    F.caja(granero, 0x7f1d1d, 5, 6, 0.3, 0, 3, 6.05);
    F.caja(granero, 0xfafafa, 5.4, 0.3, 0.35, 0, 6.1, 6.1);
    F.caja(granero, 0xfef08a, 2.4, 1.6, 0.2, 0, 9.8, 6.4, { emissive: 0xfde047, emissiveIntensity: 1.2 });
    const silo = new THREE.Group(); silo.position.set(-8, 0, -84); escena.add(silo);
    const cil = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 14, 16), F.mat(0x94a3b8)); cil.position.y = 7; cil.castShadow = true; silo.add(cil);
    const capa = new THREE.Mesh(new THREE.SphereGeometry(3.05, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), F.mat(0x64748b)); capa.position.y = 14; silo.add(capa);
    const casa = new THREE.Group(); casa.position.set(28, 0, -86); escena.add(casa);
    F.caja(casa, 0xe7d8c0, 10, 6, 8, 0, 3, 0);
    const formaC = new THREE.Shape(); formaC.moveTo(-5.6, 0); formaC.lineTo(0, 3.5); formaC.lineTo(5.6, 0); formaC.closePath();
    const tejC = new THREE.Mesh(new THREE.ExtrudeGeometry(formaC, { depth: 8.6, bevelEnabled: false }), F.mat(0x4b5563));
    tejC.position.set(0, 6, -4.3); casa.add(tejC);
    [[-2.8, 3.4], [2.8, 3.4]].forEach(([x, y]) => F.caja(casa, 0xfde68a, 1.6, 1.4, 0.2, x, y, 4.05, { emissive: 0xfbbf24, emissiveIntensity: 1.4 }));
    F.caja(casa, 0x6b4423, 1.6, 2.8, 0.2, 0, 1.4, 4.05);
    const farol = new THREE.PointLight(0xfbbf24, 60, 30, 2); farol.position.set(28, 4, -80); escena.add(farol);

    // Ambiente: viento en la hierba, luciérnagas, niebla baja, halos de luz y efectos del rayo
    const amb = crearAmbiente(escena, {
        limite: LIMITE, alturaOvni: ALTURA_OVNI, radioRayo: RADIO_RAYO, texturas,
        halos: [[-22, 9.8, -75.5, 0xffd27a, 7], [25.2, 3.4, -81.9, 0xffc04d, 4.5], [30.8, 3.4, -81.9, 0xffc04d, 4.5], [28, 4, -80, 0xffb02e, 9]],
    });
    vientoEnHierba(matas.material, amb.uViento);

    // Árboles alrededor
    const geoTronco = new THREE.CylinderGeometry(0.35, 0.5, 2.4, 6); geoTronco.translate(0, 1.2, 0);
    const geoCopa = new THREE.ConeGeometry(2.2, 4.5, 7); geoCopa.translate(0, 4.6, 0);
    const geoCopa2 = new THREE.ConeGeometry(1.6, 3.4, 7); geoCopa2.translate(0, 6.6, 0);
    for (let i = 0; i < 70; i++) {
        const a = Math.random() * Math.PI * 2; const r = 72 + Math.random() * 60;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (z < -70 && Math.abs(x) < 40) continue; // deja ver la granja
        const arbol = new THREE.Group();
        const fuera = Math.max(Math.abs(x), Math.abs(z)) - 64;
        const yBase = Math.min(fuera / 30, 1) * (Math.sin(x * 0.05) * 4 + Math.cos(z * 0.045) * 5 + Math.sin((x + z) * 0.11) * 1.5 + 4);
        arbol.position.set(x, yBase - 0.2, z);
        const k = 0.8 + Math.random() * 0.7; arbol.scale.setScalar(k);
        const tronco = new THREE.Mesh(geoTronco, F.mat(0x5b3a1e)); tronco.castShadow = true; arbol.add(tronco);
        const verde = [0x1f4d2b, 0x245c32, 0x1b4426][i % 3];
        const c1 = new THREE.Mesh(geoCopa, F.mat(verde)); c1.castShadow = true; arbol.add(c1);
        const c2 = new THREE.Mesh(geoCopa2, F.mat(verde)); c2.castShadow = true; arbol.add(c2);
        escena.add(arbol);
    }
    // Pacas de paja y rocas junto a la valla
    const geoPaca = new THREE.CylinderGeometry(1, 1, 1.6, 12); geoPaca.rotateZ(Math.PI / 2);
    [[-58, 20], [-57, 23], [57, -30], [58, 10], [-30, 57], [35, 58]].forEach(([x, z]) => {
        const paca = new THREE.Mesh(geoPaca, F.mat(0xd4a84b)); paca.position.set(x, 1, z); paca.rotation.y = Math.random() * 3; paca.castShadow = true; escena.add(paca);
    });

    // Rayo tractor (uno por nave)
    const geoRayo = new THREE.CylinderGeometry(0.7, RADIO_RAYO * 0.85, 1, 32, 1, true);
    geoRayo.translate(0, 0.5, 0);
    const crearRayo = (colorHex) => {
        const uniforms = { uTiempo: { value: 0 }, uColor: { value: new THREE.Color(colorHex) }, uFuerza: { value: 0 } };
        const malla = new THREE.Mesh(geoRayo, new THREE.ShaderMaterial({
            uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
            vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
            fragmentShader: `uniform float uTiempo; uniform vec3 uColor; uniform float uFuerza; varying vec2 vUv;
                void main(){
                    float bandas = 0.55 + 0.45 * sin(vUv.y * 26.0 + uTiempo * 9.0);
                    float borde = 0.6 + 0.4 * sin(vUv.x * 6.2832 * 6.0 + uTiempo * 2.0);
                    float a = (0.25 + 0.75 * vUv.y) * bandas * borde * uFuerza;
                    gl_FragColor = vec4(uColor * 1.4, a * 0.55);
                }`,
        }));
        malla.visible = false;
        escena.add(malla);
        return { malla, uniforms };
    };

    // ── Jugadores: nave, rayo, círculo, marcador y cámara propios ──
    const colorRojo = new THREE.Color(0xff3355);
    const blanco = new THREE.Color(0xffffff);
    const jugadores = Array.from({ length: nJug }, (_, idx) => {
        const color = new THREE.Color(COLORES_JUGADOR[idx].hex);
        const O = construirOvni(F, COLORES_JUGADOR[idx].hex);
        escena.add(O.ovni);
        const rayo = crearRayo(COLORES_JUGADOR[idx].hex);
        const circulo = new THREE.Mesh(new THREE.RingGeometry(RADIO_RAYO - 0.25, RADIO_RAYO, 48).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false }));
        circulo.position.y = 0.06; escena.add(circulo);
        const marca = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.85, 6, 1).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.9, depthWrite: false }));
        marca.position.y = 0.08 + idx * 0.01; marca.visible = false; escena.add(marca);
        const camara = new THREE.PerspectiveCamera(55, 1, 0.1, 800);
        const x0 = nJug === 2 ? (idx === 0 ? -14 : 14) : 0;
        camara.position.set(x0, 17, 44);
        return {
            idx, color, O, rayo, circulo, marca, camara,
            mirar: new THREE.Vector3(x0, 0, 20),
            ovni: { x: x0, z: 30, vx: 0, vz: 0 },
            vidas: VIDAS, aciertos: 0, fallos: 0, puntos: 0,
            aciertosLista: [], fallosLista: [],
            abduciendo: null, objetivoId: null, objetivoVisible: false,
            rayoRojoHasta: 0, temblor: 0,
        };
    });

    amb.prepararJugadores(jugadores);

    // Partículas (explosiones de color)
    const NP = 600;
    const pPos = new Float32Array(NP * 3).fill(-999);
    const pCol = new Float32Array(NP * 3);
    const pVel = new Float32Array(NP * 3);
    const pVida = new Float32Array(NP);
    const geoPart = new THREE.BufferGeometry();
    geoPart.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    geoPart.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    const particulas = new THREE.Points(geoPart, new THREE.PointsMaterial({ size: 0.55, map: texPunto, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    particulas.frustumCulled = false;
    escena.add(particulas);
    let pSig = 0;
    const explosion = (x, y, z, color, n = 70, fuerza = 7) => {
        const c = new THREE.Color(color);
        for (let i = 0; i < n; i++) {
            const k = pSig; pSig = (pSig + 1) % NP;
            pPos[k * 3] = x; pPos[k * 3 + 1] = y; pPos[k * 3 + 2] = z;
            const th = Math.random() * Math.PI * 2; const ph = Math.acos(Math.random() * 2 - 1); const v = fuerza * (0.4 + Math.random() * 0.6);
            pVel[k * 3] = Math.sin(ph) * Math.cos(th) * v; pVel[k * 3 + 1] = Math.cos(ph) * v + 2; pVel[k * 3 + 2] = Math.sin(ph) * Math.sin(th) * v;
            pCol[k * 3] = c.r; pCol[k * 3 + 1] = c.g; pCol[k * 3 + 2] = c.b;
            pVida[k] = 0.8 + Math.random() * 0.6;
        }
    };

    const texAlerta = texturaIcono('!', '#ef4444');
    const texMareo = texturaIcono('?', '#f59e0b');
    texturas.push(texAlerta, texMareo);

    // ── Estado de la partida ──
    const estado = { ronda: 0, objetivo: null, animales: [], pausaHasta: 0, terminado: false, ultimoSusto: 0 };

    const quitarAnimal = (a) => {
        if (a.rig.root.parent) a.rig.root.parent.remove(a.rig.root);
        if (a.modelo) { a.modelo.mixer.stopAllAction(); a.modelo.mixer.uncacheRoot(a.modelo.obj); }
        a.cartel.material.map.dispose();
        a.cartel.material.dispose();
        a.icono.material.dispose();
        a.fuera = true;
    };

    const crearAnimal = ({ texto: palabra, correcta, explicacion }, id, x, z) => {
        const tipo = tiposDisponibles[Math.floor(Math.random() * tiposDisponibles.length)];
        let rig; let modelo = null;
        if (modelos?.[tipo]) {
            // modelo animado: el .glb mide 1 de alto, se escala a la altura del tipo
            modelo = instanciarModelo(modelos[tipo], TIPOS[tipo].alto / ESCALA_ANIMAL);
            rig = { root: new THREE.Group(), torso: new THREE.Group(), cabeza: new THREE.Group(), patas: [], cola: null, alas: [], baseTorso: 0, bipedo: false };
            rig.root.add(modelo.obj);
            rig.root.scale.setScalar(ESCALA_ANIMAL);
            ponerClip(modelo, 'Idle', 0);
        } else {
            rig = construirAnimal(F, tipo);
        }
        const { tex, aspecto } = texturaCartel(palabra);
        const cartel = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
        const hCartel = 0.8;
        cartel.scale.set(aspecto * hCartel, hCartel, 1);
        cartel.position.y = TIPOS[tipo].alto / ESCALA_ANIMAL + 0.45;
        cartel.renderOrder = 10;
        rig.root.add(cartel);
        const icono = new THREE.Sprite(new THREE.SpriteMaterial({ map: texAlerta, depthWrite: false }));
        icono.scale.set(0.55, 0.55, 1);
        icono.position.y = cartel.position.y + 0.65;
        icono.visible = false; icono.renderOrder = 11;
        rig.root.add(icono);
        rig.root.position.set(x, 0, z);
        rig.root.rotation.y = Math.random() * Math.PI * 2;
        escena.add(rig.root);
        return {
            id, tipo, palabra, correcta, explicacion, rig, modelo, cartel, icono, hCartel, aspecto,
            x, y: 0, z, vx: 0, vz: 0, vy: 0, por: null,
            estado: 'PASEO', t: Math.random() * 2, fase: Math.random() * 6, amp: 0, aparicion: 0,
            fuera: false,
        };
    };

    const resumenJugador = (j) => ({
        vidas: j.vidas, aciertos: j.aciertos, fallos: j.fallos, puntos: j.puntos,
    });

    const emitirHud = () => {
        const quedan = estado.animales.filter(a => !a.fuera && a.correcta).length;
        cb.onHud({ ronda: estado.ronda + 1, totalRondas, objetivo: estado.objetivo, quedan, jugadores: jugadores.map(resumenJugador) });
    };

    const empezarRonda = (i) => {
        estado.animales.forEach(a => { if (!a.fuera) quitarAnimal(a); });
        estado.ronda = i;
        const { objetivo, items } = generarRonda(i);
        estado.objetivo = objetivo;
        const puestos = [];
        estado.animales = barajar(items).slice(0, ANIMALES_POR_RONDA).map((it, idx) => {
            let x = 0, z = 0;
            for (let intento = 0; intento < 40; intento++) {
                x = (Math.random() * 2 - 1) * (LIMITE - 6);
                z = (Math.random() * 2 - 1) * (LIMITE - 6);
                const lejos = jugadores.every(j => Math.hypot(x - j.ovni.x, z - j.ovni.z) > 12);
                if (lejos && puestos.every(([px, pz]) => Math.hypot(px - x, pz - z) > 9)) break;
            }
            puestos.push([x, z]);
            const a = crearAnimal(it, `${i}-${idx}`, x, z);
            a.aparicion = -idx * 0.12; // aparecen escalonados
            return a;
        });
        jugadores.forEach(j => { j.abduciendo = null; });
        cb.onRonda({ ronda: i + 1, totalRondas, objetivo: estado.objetivo });
        emitirHud();
    };

    const terminar = (ganado) => {
        if (estado.terminado || destruido) return;
        estado.terminado = true;
        const j0 = jugadores[0];
        cb.onFin({
            ganado, totalRondas,
            rondasCompletadas: ganado ? totalRondas : estado.ronda,
            aciertos: j0.aciertos, fallos: j0.fallos,
            fallosLista: j0.fallosLista, aciertosLista: j0.aciertosLista,
            jugadores: jugadores.map(j => ({ ...resumenJugador(j), aciertosLista: j.aciertosLista, fallosLista: j.fallosLista })),
        });
    };

    // ── Controles ──
    // 1 jugador: WASD o flechas + Espacio/Enter. 2 jugadores: J1 WASD + Espacio, J2 flechas + Enter.
    const teclas = new Set();
    const joys = jugadores.map(() => ({ x: 0, y: 0, activo: false }));
    const abducir = (idx = 0) => {
        const j = jugadores[idx];
        if (!j || estado.terminado || j.abduciendo || j.objetivoId == null) return;
        const a = estado.animales.find(an => an.id === j.objetivoId);
        if (!a || a.fuera || a.estado === 'ABDUCCION' || a.estado === 'CAIDA') return;
        a.estado = 'ABDUCCION'; a.vy = 0.5; a.icono.visible = false; a.por = j;
        j.abduciendo = a;
        amb.onda(a.x, a.z, j.color, 4, 0.7);
        sfx.rayo();
    };
    const alPulsar = (e) => {
        const k = e.key.toLowerCase();
        if (k === ' ' || k === 'enter') {
            e.preventDefault();
            abducir(nJug === 2 && k === 'enter' ? 1 : 0);
            return;
        }
        if (k.startsWith('arrow')) e.preventDefault();
        teclas.add(k);
    };
    const alSoltar = (e) => teclas.delete(e.key.toLowerCase());
    window.addEventListener('keydown', alPulsar);
    window.addEventListener('keyup', alSoltar);

    // Mandos micro:bit (modo F): cada inclinación envía un aviso, así que da un impulso de ~0,9 s
    // en esa dirección; inclinar otra vez hacia el mismo lado antes de que acabe lo alarga.
    const impulsos = jugadores.map(() => null);
    const DIRS_MANDO = { I: [-1, 0], D: [1, 0], F: [0, -1], T: [0, 1] };
    const impulso = (idx, dir) => {
        const v = DIRS_MANDO[dir];
        if (!v || !jugadores[idx]) return;
        const ahora = reloj.getElapsed();
        const imp = impulsos[idx];
        if (imp && imp.x === v[0] && imp.z === v[1] && imp.hasta > ahora) imp.hasta = Math.min(imp.hasta + 0.9, ahora + 2.4);
        else impulsos[idx] = { x: v[0], z: v[1], hasta: ahora + 0.9 };
    };
    // Modo V (volante, programas v6): dirección mientras el mando sigue inclinado. El mando la
    // repite cada 300 ms; si deja de llegar (radio perdida) se para sola a los 1,2 s.
    const inclinaciones = jugadores.map(() => null);
    const setInclinacion = (idx, x, z, analogica = false) => {
        if (!jugadores[idx]) return;
        inclinaciones[idx] = x || z ? { x, z, analogica, hasta: reloj.getElapsed() + 1.2 } : null;
        if (!x && !z) impulsos[idx] = null;
    };
    const entrada = (idx) => {
        const inc = inclinaciones[idx];
        if (inc && reloj.getElapsed() < inc.hasta) { const l = Math.hypot(inc.x, inc.z); return inc.analogica && l <= 1 ? { x: inc.x, z: inc.z } : { x: inc.x / l, z: inc.z / l }; }
        const imp = impulsos[idx];
        if (imp && reloj.getElapsed() < imp.hasta) return { x: imp.x, z: imp.z };
        const joy = joys[idx];
        if (joy.activo) return { x: joy.x, z: joy.y };
        const wasd = nJug === 1 || idx === 0;
        const flechas = nJug === 1 || idx === 1;
        let x = 0, z = 0;
        if ((flechas && teclas.has('arrowup')) || (wasd && teclas.has('w'))) z -= 1;
        if ((flechas && teclas.has('arrowdown')) || (wasd && teclas.has('s'))) z += 1;
        if ((flechas && teclas.has('arrowleft')) || (wasd && teclas.has('a'))) x -= 1;
        if ((flechas && teclas.has('arrowright')) || (wasd && teclas.has('d'))) x += 1;
        const l = Math.hypot(x, z);
        return l > 1 ? { x: x / l, z: z / l } : { x, z };
    };

    // ── Tamaño y reparto de pantalla ──
    // Con 2 jugadores: en horizontal, izquierda/derecha; en vertical, arriba/abajo.
    let vistas = [];
    const redimensionar = () => {
        const w = contenedor.clientWidth || 1, h = contenedor.clientHeight || 1;
        renderer.setSize(w, h);
        let disposicion = 'solo';
        if (nJug === 1) vistas = [{ x: 0, y: 0, w, h }];
        else if (w >= h) { disposicion = 'h'; vistas = [{ x: 0, y: 0, w: w / 2, h }, { x: w / 2, y: 0, w: w / 2, h }]; }
        else { disposicion = 'v'; vistas = [{ x: 0, y: h / 2, w, h: h / 2 }, { x: 0, y: 0, w, h: h / 2 }]; }
        jugadores.forEach((j, i) => {
            const v = vistas[i];
            j.camara.aspect = v.w / v.h;
            // en vistas estrechas o verticales alejamos un poco la cámara
            j.camara.fov = v.w / v.h < 1 ? 70 : 55;
            j.camara.updateProjectionMatrix();
        });
        cb.onDisposicion?.(disposicion);
    };
    const ro = new ResizeObserver(redimensionar);
    ro.observe(contenedor);
    redimensionar();

    // Elige el clip según el estado y ajusta su velocidad a la del animal
    const animarModelo = (a, vel, dt) => {
        const m = a.modelo;
        const alto = TIPOS[a.tipo].alto;
        let clip = 'Idle'; let ritmo = 1;
        if (a.estado === 'ABDUCCION') { clip = 'Run'; ritmo = 1.9; }
        else if (a.estado === 'CAIDA') clip = 'Jump';
        else if (a.estado === 'HUIDA') { clip = 'Run'; ritmo = THREE.MathUtils.clamp(vel / (alto * 1.6), 0.6, 1.6); }
        else if (a.estado === 'PASEO' && vel > 0.05) {
            clip = vel < alto * 0.45 ? 'WalkSlow' : 'Walk';
            ritmo = THREE.MathUtils.clamp(vel / (alto * (clip === 'Walk' ? 0.55 : 0.35)), 0.5, 1.8);
        }
        ponerClip(m, clip, clip === 'Run' ? 0.15 : 0.3);
        if (m.accion) m.accion.timeScale = ritmo;
        m.mixer.update(dt);
    };

    // ── Actualización de cada animal ──
    const actualizarAnimal = (a, dt, t) => {
        const tipoCfg = TIPOS[a.tipo];
        // se asusta de la nave más cercana
        let cerca = jugadores[0];
        let dist = Infinity;
        jugadores.forEach(j => { const d = Math.hypot(a.x - j.ovni.x, a.z - j.ovni.z); if (d < dist) { dist = d; cerca = j; } });
        const dx = a.x - cerca.ovni.x, dz = a.z - cerca.ovni.z;
        const algunaAbduce = jugadores.some(j => j.abduciendo);
        let salto = 0;

        if (a.aparicion < 1) {
            a.aparicion = Math.min(1, a.aparicion + dt * 2.2);
        }

        if (a.estado === 'PASEO') {
            a.t -= dt;
            if (a.t <= 0) {
                if (a.tipo === 'pollo') {
                    if (Math.random() > 0.4) { const ang = Math.random() * Math.PI * 2; a.vx = Math.sin(ang) * tipoCfg.paseo; a.vz = Math.cos(ang) * tipoCfg.paseo; a.t = 0.4 + Math.random() * 0.5; }
                    else { a.vx = 0; a.vz = 0; a.t = 0.5 + Math.random() * 0.8; }
                } else if (Math.random() > 0.35) {
                    const ang = Math.random() * Math.PI * 2; const v = tipoCfg.paseo * (0.6 + Math.random() * 0.6);
                    a.vx = Math.sin(ang) * v; a.vz = Math.cos(ang) * v; a.t = 1.5 + Math.random() * 3;
                } else { a.vx = 0; a.vz = 0; a.t = 1.5 + Math.random() * 2.5; }
            }
            if (animoCfg.alerta > 0 && dist < animoCfg.alerta && !(nJug === 1 && algunaAbduce) && a.aparicion >= 1) {
                a.estado = 'ALERTA'; a.t = animoCfg.espera; a.vx = 0; a.vz = 0;
                a.icono.material.map = texAlerta; a.icono.visible = true;
            }
        } else if (a.estado === 'ALERTA') {
            a.t -= dt;
            salto = Math.abs(Math.sin(t * 14)) * 0.25;
            // gira para mirar a la nave
            a.rig.root.rotation.y = lerpAng(a.rig.root.rotation.y, Math.atan2(-dx, -dz), suave(10, dt));
            if (dist > animoCfg.alerta * 1.6) { a.estado = 'PASEO'; a.t = 0; a.icono.visible = false; }
            else if (a.t <= 0) {
                a.estado = 'HUIDA'; a.t = 2 + Math.random();
                const l = dist || 1;
                const ang = Math.atan2(dx / l, dz / l) + (Math.random() - 0.5) * 0.8;
                a.vx = Math.sin(ang) * tipoCfg.huida; a.vz = Math.cos(ang) * tipoCfg.huida;
                if (t - estado.ultimoSusto > 0.35) { sfx.susto(); estado.ultimoSusto = t; }
            }
        } else if (a.estado === 'HUIDA') {
            a.t -= dt;
            if (a.t < 0.6) { a.vx *= 1 - suave(3, dt); a.vz *= 1 - suave(3, dt); }
            if (a.t <= 0 || dist > animoCfg.alerta * 3) { a.estado = 'PASEO'; a.t = 0.5; a.icono.visible = false; }
        } else if (a.estado === 'ABDUCCION') {
            const nave = a.por.ovni;
            a.vy = Math.min(a.vy + dt * 5, 6);
            a.y += a.vy * dt;
            a.x += (nave.x - a.x) * suave(4, dt);
            a.z += (nave.z - a.z) * suave(4, dt);
            a.vx = 0; a.vz = 0;
            a.rig.root.rotation.y += dt * (2 + a.y);
            if (a.y >= ALTURA_OVNI - 1.4) resolverAbduccion(a, a.por);
        } else if (a.estado === 'CAIDA') {
            a.vy -= 25 * dt;
            a.y += a.vy * dt;
            a.rig.root.rotation.x += dt * 6;
            if (a.y <= 0) {
                a.y = 0;
                if (a.vy < -5) { a.vy = -a.vy * 0.35; sfx.golpe(); explosion(a.x, 0.3, a.z, 0xa3a3a3, 18, 3); }
                else {
                    a.vy = 0; a.vx = 0; a.vz = 0; a.rig.root.rotation.x = 0;
                    a.estado = 'MAREO'; a.t = 1.6;
                    a.icono.material.map = texMareo; a.icono.visible = true;
                }
            }
        } else if (a.estado === 'MAREO') {
            a.t -= dt;
            a.rig.root.rotation.z = Math.sin(t * 9) * 0.18;
            if (a.t <= 0) { a.estado = 'PASEO'; a.t = 0; a.rig.root.rotation.z = 0; a.icono.visible = false; }
        }

        a.x += a.vx * dt; a.z += a.vz * dt;
        if (a.estado !== 'ABDUCCION') {
            if (a.x < -LIMITE) { a.x = -LIMITE; a.vx = Math.abs(a.vx); }
            if (a.x > LIMITE) { a.x = LIMITE; a.vx = -Math.abs(a.vx); }
            if (a.z < -LIMITE) { a.z = -LIMITE; a.vz = Math.abs(a.vz); }
            if (a.z > LIMITE) { a.z = LIMITE; a.vz = -Math.abs(a.vz); }
        }

        // ── Animación: clips del .glb o esqueleto procedural ──
        const rig = a.rig;
        const vel = Math.hypot(a.vx, a.vz);
        const forcejeo = a.estado === 'ABDUCCION' || a.estado === 'CAIDA';
        if (a.modelo) animarModelo(a, vel, dt);
        else {
        const ampObjetivo = forcejeo ? 0.9 : Math.min(vel * (a.tipo === 'pollo' ? 0.35 : 0.2), 0.75);
        a.amp += (ampObjetivo - a.amp) * suave(8, dt);
        a.fase += dt * (forcejeo ? 18 : (2 + vel * (a.tipo === 'pollo' ? 5 : 2.6)));
        const sn = Math.sin(a.fase);
        if (rig.bipedo) {
            rig.patas[0].rotation.x = sn * a.amp; rig.patas[1].rotation.x = -sn * a.amp;
        } else {
            // paso cruzado: delantera izq. con trasera dcha.
            rig.patas[0].rotation.x = sn * a.amp; rig.patas[3].rotation.x = sn * a.amp;
            rig.patas[1].rotation.x = -sn * a.amp; rig.patas[2].rotation.x = -sn * a.amp;
        }
        rig.torso.position.y = rig.baseTorso + Math.abs(Math.cos(a.fase)) * a.amp * 0.07;
        rig.torso.rotation.z = Math.sin(a.fase) * a.amp * 0.05;
        // pastar cuando está parado
        const pastando = a.estado === 'PASEO' && vel < 0.05 && a.tipo !== 'pollo';
        const picoteo = a.estado === 'PASEO' && vel < 0.05 && a.tipo === 'pollo' ? Math.max(0, Math.sin(t * 7 + a.fase)) * 0.7 : 0;
        const cabezaObj = forcejeo ? Math.sin(t * 20) * 0.3 : pastando ? 0.75 + Math.sin(t * 2 + a.fase) * 0.08 : picoteo + Math.sin(a.fase * 2) * a.amp * 0.15;
        rig.cabeza.rotation.x += (cabezaObj - rig.cabeza.rotation.x) * suave(5, dt);
        if (rig.cola) rig.cola.rotation.z = Math.sin(t * 3 + a.fase) * 0.35;
        rig.alas.forEach(ala => {
            const aleteo = vel > 2 || forcejeo ? 0.4 + Math.sin(t * 32) * 0.6 : 0.05;
            ala.rotation.z = aleteo * ala.userData.lado * -1;
        });
        }
        if (vel > 0.1 && a.estado !== 'ALERTA') {
            rig.root.rotation.y = lerpAng(rig.root.rotation.y, Math.atan2(a.vx, a.vz), suave(a.estado === 'HUIDA' ? 10 : 4, dt));
        }

        // aparición con rebote elástico
        let esc = ESCALA_ANIMAL;
        if (a.aparicion < 1) {
            const k = Math.max(0, a.aparicion);
            esc *= k === 0 ? 0.0001 : 1 + Math.sin(k * Math.PI * 2.5) * (1 - k) * 0.5 - (1 - k) * 0.6;
        }
        if (a.estado === 'ABDUCCION') esc *= THREE.MathUtils.clamp((ALTURA_OVNI - 1 - a.y) / 3, 0.25, 1);
        rig.root.scale.setScalar(Math.max(esc, 0.0001));
        rig.root.position.set(a.x, a.y + salto, a.z);

        // el cartel del objetivo se agranda
        const kc = jugadores.some(j => j.objetivoId === a.id) ? 1.3 : 1;
        a.cartel.scale.set(a.aspecto * a.hCartel * kc, a.hCartel * kc, 1);
    };

    const quedanCorrectas = () => estado.animales.filter(an => !an.fuera && an.correcta).length;

    const resolverAbduccion = (a, j) => {
        j.abduciendo = null;
        a.por = null;
        const { x, z } = j.ovni;
        if (a.correcta) {
            j.aciertos++; j.puntos++;
            j.aciertosLista.push({ palabra: a.palabra, categoria: estado.objetivo });
            explosion(x, ALTURA_OVNI - 1, z, 0x4ade80, 90, 8);
            explosion(x, ALTURA_OVNI - 1, z, 0xfde047, 40, 5);
            amb.destello(j, 0x4ade80);
            amb.onda(x, z, 0x4ade80, 8, 1.0);
            quitarAnimal(a);
            sonidoCorrecto();
            cb.onAviso({ tipo: 'ok', jugador: j.idx, texto: `✅ «${a.palabra}» → ${estado.objetivo}${nJug === 2 ? ' · +1' : ''}` });
            emitirHud();
            if (quedanCorrectas() === 0) {
                if (estado.ronda + 1 >= totalRondas) {
                    estado.pausaHasta = reloj.getElapsed() + 1.4;
                    setTimeout(() => terminar(true), 1400);
                } else {
                    cb.onAviso({ tipo: 'ronda', texto: '🌟 ¡Ronda completada!' });
                    const sig = estado.ronda + 1;
                    estado.pausaHasta = reloj.getElapsed() + 1.6;
                    setTimeout(() => { if (!estado.terminado && !destruido) empezarRonda(sig); }, 1600);
                }
            }
        } else {
            j.fallos++;
            // en solitario se pierde una vida; en duelo se resta un punto
            if (nJug === 1) j.vidas--; else j.puntos--;
            j.fallosLista.push({ palabra: a.palabra, explicacion: a.explicacion, buscabas: estado.objetivo });
            a.estado = 'CAIDA'; a.vy = 2;
            const ang = Math.random() * Math.PI * 2;
            a.vx = Math.sin(ang) * 3.5; a.vz = Math.cos(ang) * 3.5;
            explosion(x, ALTURA_OVNI - 1, z, 0xef4444, 60, 6);
            amb.destello(j, 0xff3355);
            amb.onda(x, z, 0xff3355, 6, 0.8);
            j.rayoRojoHasta = reloj.getElapsed() + 0.7;
            j.temblor = 0.6;
            sonidoIncorrecto();
            cb.onAviso({ tipo: 'mal', jugador: j.idx, texto: `❌ ${a.explicacion || `«${a.palabra}» no es de ${estado.objetivo}`}${nJug === 2 ? ' · −1' : ''}` });
            emitirHud();
            if (nJug === 1 && j.vidas <= 0) {
                estado.pausaHasta = reloj.getElapsed() + 1.6;
                setTimeout(() => terminar(false), 1600);
            }
        }
    };

    // ── Bucle ──
    const reloj = new THREE.Timer();
    reloj.connect(document); // al volver a la pestaña no da un salto de tiempo
    let raf = 0;
    let destruido = false;
    const VMAX = 12;

    const actualizarJugador = (j, dt, t, enPausa) => {
        const nave = j.ovni;
        const inp = j.abduciendo || enPausa ? { x: 0, z: 0 } : entrada(j.idx);
        nave.vx += (inp.x * VMAX - nave.vx) * suave(inp.x ? 3.5 : 2.5, dt);
        nave.vz += (inp.z * VMAX - nave.vz) * suave(inp.z ? 3.5 : 2.5, dt);
        nave.x = THREE.MathUtils.clamp(nave.x + nave.vx * dt, -LIMITE, LIMITE);
        nave.z = THREE.MathUtils.clamp(nave.z + nave.vz * dt, -LIMITE, LIMITE);
        // las dos naves se empujan si se acercan demasiado
        jugadores.forEach(o => {
            if (o === j) return;
            const ddx = nave.x - o.ovni.x, ddz = nave.z - o.ovni.z, d = Math.hypot(ddx, ddz);
            if (d < 6.2 && d > 0.001) { const k = (6.2 - d) / 2; nave.x += ddx / d * k; nave.z += ddz / d * k; }
        });
        const O = j.O;
        const flotar = Math.sin(t * 2 + j.idx * 1.7) * 0.25;
        O.ovni.position.set(nave.x, ALTURA_OVNI + flotar, nave.z);
        O.inclin.rotation.z += (-nave.vx * 0.035 - O.inclin.rotation.z) * suave(5, dt);
        O.inclin.rotation.x += (nave.vz * 0.035 - O.inclin.rotation.x) * suave(5, dt);
        O.giro.rotation.y += dt * (1.2 + Math.hypot(nave.vx, nave.vz) * 0.15);
        O.alien.rotation.y = Math.sin(t * 0.8 + j.idx) * 0.6;
        O.luces.forEach((l, i) => {
            const k = (Math.sin(t * 6 - i * 0.9) + 1) / 2;
            l.material.color.copy(j.color).multiplyScalar(0.35 + k * 0.75);
        });

        // objetivo más cercano bajo la nave
        let mejor = null; let dMin = RADIO_RAYO;
        if (!j.abduciendo && !enPausa) {
            estado.animales.forEach(a => {
                if (a.fuera || a.estado === 'CAIDA' || a.estado === 'ABDUCCION' || a.aparicion < 1) return;
                const d = Math.hypot(a.x - nave.x, a.z - nave.z);
                if (d < dMin) { dMin = d; mejor = a; }
            });
        }
        j.objetivoId = mejor ? mejor.id : null;
        if (!!mejor !== j.objetivoVisible) { j.objetivoVisible = !!mejor; cb.onObjetivo(j.idx, j.objetivoVisible); }

        // rayo, foco y círculo
        const rojo = t < j.rayoRojoHasta;
        const u = j.rayo.uniforms;
        u.uTiempo.value = t;
        u.uColor.value.copy(rojo ? colorRojo : j.color);
        const fuerzaObj = j.abduciendo || rojo ? 1 : mejor ? 0.35 : 0;
        u.uFuerza.value += (fuerzaObj - u.uFuerza.value) * suave(8, dt);
        j.rayo.malla.visible = u.uFuerza.value > 0.01;
        j.rayo.malla.position.set(nave.x, 0, nave.z);
        j.rayo.malla.scale.set(1, ALTURA_OVNI + flotar - 0.5, 1);
        O.foco.intensity = 110 + u.uFuerza.value * 380;
        O.foco.color.copy(rojo ? colorRojo : j.color).lerp(blanco, 0.6);
        O.panza.material.color.copy(rojo ? colorRojo : j.color);
        j.circulo.position.x = nave.x; j.circulo.position.z = nave.z;
        j.circulo.material.color.copy(mejor ? new THREE.Color(0x4ade80) : j.color);
        j.circulo.material.opacity = 0.3 + Math.sin(t * 4) * 0.12 + (mejor ? 0.3 : 0);
        j.marca.visible = !!mejor;
        if (mejor) {
            j.marca.position.x = mejor.x; j.marca.position.z = mejor.z;
            j.marca.rotation.y = t * 1.5 * (j.idx ? -1 : 1);
            const k = 1 + Math.sin(t * 8) * 0.08; j.marca.scale.set(k, 1, k);
        }

        // cámara que sigue a la nave con inercia
        const cam = j.camara;
        cam.position.lerp(new THREE.Vector3(nave.x * 0.85, 17, nave.z + 14), suave(2.5, dt));
        j.mirar.lerp(new THREE.Vector3(nave.x, 0, nave.z - 3), suave(4, dt));
        if (j.temblor > 0) {
            j.temblor = Math.max(0, j.temblor - dt);
            const k = j.temblor * 0.6;
            cam.position.x += (Math.random() - 0.5) * k; cam.position.y += (Math.random() - 0.5) * k;
        }
        cam.lookAt(j.mirar);
    };

    const bucle = (marca) => {
        if (destruido) return;
        raf = requestAnimationFrame(bucle);
        reloj.update(marca);
        const dt = Math.min(reloj.getDelta(), 0.05);
        const t = reloj.getElapsed();
        const enPausa = estado.terminado || t < estado.pausaHasta;

        jugadores.forEach(j => actualizarJugador(j, dt, t, enPausa));
        estado.animales.forEach(a => { if (!a.fuera) actualizarAnimal(a, dt, t); });

        // partículas
        for (let i = 0; i < NP; i++) {
            if (pVida[i] <= 0) continue;
            pVida[i] -= dt;
            if (pVida[i] <= 0) { pPos[i * 3 + 1] = -999; continue; }
            pVel[i * 3 + 1] -= 9 * dt;
            pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
            const f = Math.min(1, pVida[i]);
            pCol[i * 3] *= 0.985 + f * 0.015; pCol[i * 3 + 1] *= 0.985 + f * 0.015; pCol[i * 3 + 2] *= 0.985 + f * 0.015;
        }
        geoPart.attributes.position.needsUpdate = true;
        geoPart.attributes.color.needsUpdate = true;

        amb.actualizar(dt, t, jugadores);

        // una vista por jugador (las sombras se calculan una sola vez por fotograma)
        renderer.shadowMap.needsUpdate = true;
        renderer.setScissorTest(nJug > 1);
        jugadores.forEach((j, i) => {
            const v = vistas[i];
            if (!v) return;
            renderer.setViewport(v.x, v.y, v.w, v.h);
            renderer.setScissor(v.x, v.y, v.w, v.h);
            cielo.position.copy(j.camara.position);
            renderer.render(escena, j.camara);
        });
    };

    empezarRonda(0);
    raf = requestAnimationFrame(bucle);

    return {
        abducir,
        depurar: () => ({ estado, jugadores }),
        setJoy(idx, x, y, activo) { const joy = joys[idx]; if (joy) { joy.x = x; joy.y = y; joy.activo = activo; } },
        impulso,
        setInclinacion,
        destruir() {
            destruido = true;
            cancelAnimationFrame(raf);
            reloj.dispose();
            ro.disconnect();
            window.removeEventListener('keydown', alPulsar);
            window.removeEventListener('keyup', alSoltar);
            estado.animales.forEach(a => { if (!a.fuera) quitarAnimal(a); });
            escena.traverse(o => {
                if (o.userData.compartido) return; // geometría y material del .glb en caché
                if (o.geometry) o.geometry.dispose();
                if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
            });
            texturas.forEach(tx => tx.dispose());
            F.dispose();
            renderer.dispose();
            if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        },
    };
}


// ─── UI ──────────────────────────────────────────────────────────────────────
const NEON = '#00f0ff';
const VERDE = '#4ade80';

const Joystick = ({ onMover }) => {
    const baseRef = useRef(null);
    const idRef = useRef(null);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const mover = (e) => {
        const r = baseRef.current.getBoundingClientRect();
        let dx = e.clientX - r.left - r.width / 2;
        let dy = e.clientY - r.top - r.height / 2;
        const max = r.width * 0.32;
        const d = Math.hypot(dx, dy);
        if (d > max) { dx = dx / d * max; dy = dy / d * max; }
        setPos({ x: dx, y: dy });
        onMover(dx / max, dy / max, true);
    };
    const soltar = (e) => {
        if (idRef.current !== e.pointerId) return;
        idRef.current = null;
        setPos({ x: 0, y: 0 });
        onMover(0, 0, false);
    };
    return (
        <div
            ref={baseRef}
            onPointerDown={(e) => { idRef.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); mover(e); }}
            onPointerMove={(e) => { if (idRef.current === e.pointerId) mover(e); }}
            onPointerUp={soltar} onPointerCancel={soltar}
            style={{ width: 'min(30vw, 150px)', aspectRatio: '1/1', borderRadius: '50%', background: 'rgba(10,15,40,0.55)', border: `2px solid ${NEON}88`, position: 'relative', touchAction: 'none', boxShadow: `0 0 18px ${NEON}44` }}
        >
            <div style={{ position: 'absolute', left: '50%', top: '50%', width: '40%', height: '40%', borderRadius: '50%', background: `${NEON}bb`, boxShadow: `0 0 15px ${NEON}`, transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`, transition: idRef.current === null ? 'transform 0.2s ease-out' : 'none' }} />
        </div>
    );
};

// Zona de cada jugador sobre el canvas (toda la pantalla o su mitad)
const zonaJugador = (disposicion, i) => {
    if (disposicion === 'h') return { left: i ? '50%' : 0, top: 0, width: '50%', height: '100%' };
    if (disposicion === 'v') return { left: 0, top: i ? '50%' : 0, width: '100%', height: '50%' };
    return { left: 0, top: 0, width: '100%', height: '100%' };
};

const JuegoOvni = ({ generarRonda, rondas, animo, nombres, mandos = null, ctrl = null, onFin, onSalir }) => {
    const nJug = nombres.length;
    const duo = nJug === 2;
    const contRef = useRef(null);
    const motorRef = useRef(null);
    const [hud, setHud] = useState(null);
    const [avisos, setAvisos] = useState([null, null]);
    const [avisoRonda, setAvisoRonda] = useState(null);
    const [cartelRonda, setCartelRonda] = useState(null);
    const [objetivos, setObjetivos] = useState([false, false]);
    const [disposicion, setDisposicion] = useState(duo ? 'h' : 'solo');
    // Joystick en pantalla: en tablets, si se elige con el botón 🕹️ (se recuerda) o en cuanto se toca la
    // pantalla con el dedo (un PC conectado a un monitor táctil «parece» tener teclado y ratón).
    const [tactil, setTactil] = useState(() => {
        if (typeof window === 'undefined') return false;
        try { const g = localStorage.getItem(KEY_JOYSTICK); if (g !== null) return g === '1'; } catch { /* sin localStorage */ }
        return !!window.matchMedia?.('(pointer: coarse)').matches;
    });
    const cambiarTactil = (v) => { setTactil(v); try { localStorage.setItem(KEY_JOYSTICK, v ? '1' : '0'); } catch { /* sin localStorage */ } };
    useEffect(() => {
        if (tactil) return undefined;
        const alTocar = (e) => { if (e.pointerType === 'touch') setTactil(true); };
        window.addEventListener('pointerdown', alTocar);
        return () => window.removeEventListener('pointerdown', alTocar);
    }, [tactil]);
    const onFinRef = useRef(onFin);
    onFinRef.current = onFin;
    // al empezar cada ronda: con turnos pasa el mando al siguiente; devuelve quién pilota
    const alRondaRef = useRef(null);
    alRondaRef.current = (r) => {
        if (!mandos?.activos || !ctrl) return null;
        return mandos.turnos && r.ronda > 1 ? ctrl.rotarPilotos() : ctrl.pilotos;
    };

    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        const tAvisos = [0, 0]; let tRonda = 0; let tAvisoRonda = 0;
        let cancelado = false; let motor = null;
        // primero los animales .glb (si fallan, el juego usa los procedurales)
        cargarModelosGranja().catch(() => null).then(modelos => {
        if (cancelado) return;
        motor = crearMotor(contRef.current, { generarRonda, rondas, animo, jugadores: nJug, modelos }, {
            onHud: setHud,
            onDisposicion: setDisposicion,
            onObjetivo: (idx, v) => setObjetivos(o => { const n = [...o]; n[idx] = v; return n; }),
            onAviso: (a) => {
                if (a.tipo === 'ronda') {
                    setAvisoRonda({ ...a, k: Date.now() }); clearTimeout(tAvisoRonda);
                    tAvisoRonda = setTimeout(() => setAvisoRonda(null), 2200);
                    return;
                }
                const i = a.jugador || 0;
                setAvisos(av => { const n = [...av]; n[i] = { ...a, k: Date.now() }; return n; });
                clearTimeout(tAvisos[i]);
                tAvisos[i] = setTimeout(() => setAvisos(av => { const n = [...av]; n[i] = null; return n; }), 2400);
            },
            onRonda: (r) => { setCartelRonda({ ...r, pilotos: alRondaRef.current(r) }); clearTimeout(tRonda); tRonda = setTimeout(() => setCartelRonda(null), 2600); },
            onFin: (res) => onFinRef.current(res),
        });
        motorRef.current = motor;
        setCargando(false);
        });
        return () => { cancelado = true; tAvisos.forEach(clearTimeout); clearTimeout(tRonda); clearTimeout(tAvisoRonda); motor?.destruir(); motorRef.current = null; };
    }, [generarRonda, rondas, animo, nJug]);

    // ── Mandos micro:bit: inclinar = mover, agitar o A = abducir ──
    // Quién pilota cada nave lo lleva useMandosOvni (menú); aquí solo se traducen sus eventos.
    const botonARef = useRef({});
    const invertir = !!mandos?.invertir;
    const manejadorRef = ctrl?.manejadorRef;
    useEffect(() => {
        if (!mandos?.activos || !manejadorRef) return undefined;
        manejadorRef.current = (idx, ev) => {
            const motor = motorRef.current;
            if (!motor) return;
            if (ev.accion === 'V') {
                const d = ev.dir;
                const x = d.includes('I') ? -1 : d.includes('D') ? 1 : 0;
                const z = (d.includes('F') ? -1 : d.includes('T') ? 1 : 0) * (invertir ? -1 : 1);
                motor.setInclinacion(idx, x, z);
            } else if (ev.accion === 'P') {
                const inv = { F: 'T', T: 'F' };
                motor.impulso(idx, invertir && inv[ev.dir] ? inv[ev.dir] : ev.dir);
            } else if (ev.accion === 'S') {
                motor.abducir(idx);
            } else if (ev.accion === 'A') {
                // el mando repite «A pulsado» cada 400 ms: solo cuenta el momento de pulsar
                if (ev.on && !botonARef.current[ev.id]) motor.abducir(idx);
                botonARef.current[ev.id] = ev.on;
            }
        };
        return () => { manejadorRef.current = null; };
    }, [mandos?.activos, invertir, manejadorRef]);
    // al cambiar de piloto, la nave se para (no sigue con la inclinación del anterior)
    const piloto0 = ctrl?.pilotos[0], piloto1 = ctrl?.pilotos[1];
    useEffect(() => { motorRef.current?.setInclinacion(0, 0, 0); }, [piloto0]);
    useEffect(() => { motorRef.current?.setInclinacion(1, 0, 0); }, [piloto1]);

    // ── Mano con la webcam: la palma mueve la nave (más lejos del centro = más rápido)
    // y al cerrar el puño abduce. Con 2 jugadores, cada uno en su mitad de la cámara.
    const conMano = !!mandos?.mano;
    useEffect(() => {
        if (!conMano) return undefined;
        const st = [0, 1].map(() => ({ vista: false, cerrado: false, frames: 0, tAbd: 0 }));
        const eje = (d) => Math.sign(d) * Math.min(1, Math.max(0, (Math.abs(d) - MANO_ZONA_MUERTA) / MANO_RECORRIDO));
        const baja = escucharManos((manos) => {
            const motor = motorRef.current;
            if (!motor) return;
            const porJug = nJug === 2
                ? [manos.find(m => m.centro.x < 0.5) || null, manos.find(m => m.centro.x >= 0.5) || null]
                : [manos[0] || null];
            const ahora = performance.now();
            porJug.forEach((m, i) => {
                const s = st[i];
                if (!m) {
                    if (s.vista) motor.setInclinacion(i, 0, 0);
                    s.vista = false; s.cerrado = false; s.frames = 0;
                    return;
                }
                s.vista = true;
                // puño confirmado en 3 fotogramas seguidos (evita abducir por un parpadeo del detector)
                s.frames = m.dedos === 0 ? s.frames + 1 : 0;
                const cerrado = s.frames >= 3;
                if (cerrado) {
                    motor.setInclinacion(i, 0, 0); // la nave se queda quieta mientras abduce
                    if (!s.cerrado && ahora - s.tAbd > 600) { motor.abducir(i); s.tAbd = ahora; }
                } else if (m.dedos > 0) {
                    const cx = nJug === 2 ? (i === 0 ? 0.25 : 0.75) : 0.5;
                    const escala = nJug === 2 ? 1.6 : 1;
                    motor.setInclinacion(i, eje((m.centro.x - cx) * escala), eje((m.centro.y - 0.5) * escala), true);
                }
                s.cerrado = cerrado;
            });
        });
        return () => { baja(); motorRef.current?.setInclinacion(0, 0, 0); motorRef.current?.setInclinacion(1, 0, 0); };
    }, [conMano, nJug]);

    const pista = (i) => {
        if (conMano) return <>✋ mueve la mano · <b style={{ color: VERDE }}>✊ cierra el puño</b> para abducir</>;
        if (mandos?.activos) return <>inclina para mover · <b style={{ color: VERDE }}>agita o A</b> abducir</>;
        if (!duo) return <><b style={{ color: NEON }}>WASD / flechas</b> mover · <b style={{ color: VERDE }}>Espacio</b> abducir</>;
        return i === 0
            ? <><b style={{ color: COLORES_JUGADOR[0].css }}>WASD</b> mover · <b style={{ color: VERDE }}>Espacio</b> abducir</>
            : <><b style={{ color: COLORES_JUGADOR[1].css }}>Flechas</b> mover · <b style={{ color: VERDE }}>Enter</b> abducir</>;
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#070414', userSelect: 'none', touchAction: 'none', overflow: 'hidden', fontFamily: 'system-ui, "Segoe UI", sans-serif' }}>
            <style>{`@keyframes ovniEntra { from { opacity: 0; transform: translate(-50%, -20px) scale(0.9); } to { opacity: 1; transform: translate(-50%, 0) scale(1); } }
                @keyframes ovniRonda { 0% { opacity: 0; transform: translate(-50%,-50%) scale(0.7); } 15% { opacity: 1; transform: translate(-50%,-50%) scale(1.05); } 25% { transform: translate(-50%,-50%) scale(1); } 85% { opacity: 1; } 100% { opacity: 0; } }`}</style>
            <div ref={contRef} style={{ position: 'absolute', inset: 0 }} />
            {/* viñeteado: bordes más oscuros, la vista se centra en la nave */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(5,2,20,0.55) 100%)' }} />
            {cargando && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: NEON, fontWeight: 800, fontSize: '1.2rem', gap: 10, zIndex: 5 }}>
                    <div style={{ fontSize: 56 }}>🛸</div>Preparando la granja…
                </div>
            )}

            {/* Línea divisoria de la pantalla partida */}
            {duo && disposicion === 'h' && <div style={{ position: 'absolute', top: 0, bottom: 0, left: 'calc(50% - 2px)', width: 4, background: `linear-gradient(${COLORES_JUGADOR[0].css}, ${COLORES_JUGADOR[1].css})`, boxShadow: '0 0 12px rgba(255,255,255,0.4)', pointerEvents: 'none' }} />}
            {duo && disposicion === 'v' && <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(50% - 2px)', height: 4, background: `linear-gradient(90deg, ${COLORES_JUGADOR[0].css}, ${COLORES_JUGADOR[1].css})`, boxShadow: '0 0 12px rgba(255,255,255,0.4)', pointerEvents: 'none' }} />}

            {/* Barra superior: salir + enunciado común */}
            <div style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', alignItems: 'flex-start', gap: 10, pointerEvents: 'none', zIndex: 3 }}>
                <button onClick={onSalir} style={{ pointerEvents: 'auto', background: 'rgba(10,15,36,0.7)', color: '#fff', border: `1px solid ${NEON}66`, borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontWeight: 700 }}>✕ Salir</button>
                <button onClick={() => cambiarTactil(!tactil)} title={tactil ? 'Volver a jugar con el teclado' : 'Mostrar el joystick en pantalla (monitor o pizarra táctil)'}
                    style={{ pointerEvents: 'auto', background: tactil ? `${NEON}33` : 'rgba(10,15,36,0.7)', color: '#fff', border: `1px solid ${tactil ? NEON : NEON + '66'}`, borderRadius: 10, padding: '8px 10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                    {tactil ? '⌨️ Teclado' : '🕹️ Joystick'}
                </button>
                {hud && (
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 }}>
                        <div style={{ background: 'rgba(10,15,36,0.78)', border: `2px solid ${NEON}`, borderRadius: 16, padding: '6px 18px', boxShadow: `0 0 16px ${NEON}55`, color: '#fff', textAlign: 'center', maxWidth: '100%' }}>
                            <div style={{ fontSize: 'clamp(0.7rem, 1.6vw, 0.85rem)', color: '#a5b4fc', letterSpacing: 1 }}>RONDA {hud.ronda}/{hud.totalRondas} · 🛸 ABDUCE</div>
                            <div style={{ fontSize: 'clamp(1.1rem, 3.2vw, 1.9rem)', fontWeight: 900, color: NEON, textShadow: `0 0 12px ${NEON}`, lineHeight: 1.15, overflowWrap: 'anywhere' }}>{hud.objetivo.toUpperCase()}</div>
                            <div style={{ fontSize: 'clamp(0.75rem, 1.8vw, 0.95rem)', color: '#e2e8f0' }}>Quedan <b style={{ color: VERDE }}>{hud.quedan}</b></div>
                        </div>
                    </div>
                )}
                {hud && !duo && (
                    <div style={{ background: 'rgba(10,15,36,0.7)', borderRadius: 10, padding: '8px 12px', color: '#fff', fontWeight: 700, fontSize: '1rem', whiteSpace: 'nowrap' }}>
                        {'❤️'.repeat(Math.max(hud.jugadores[0].vidas, 0))}{'🖤'.repeat(Math.max(VIDAS - hud.jugadores[0].vidas, 0))}
                        <span style={{ marginLeft: 10, color: VERDE }}>✓ {hud.jugadores[0].aciertos}</span>
                    </div>
                )}
                {mandos?.activos && <span style={{ pointerEvents: 'auto' }}><ChipAntena /></span>}
                {duo && <div style={{ width: 74 }} />}
            </div>

            {/* Zona de cada jugador: marcador, avisos y controles */}
            {nombres.map((nombre, i) => {
                const col = duo ? COLORES_JUGADOR[i].css : NEON;
                const datos = hud?.jugadores?.[i];
                const aviso = avisos[i];
                const arribaLibre = !duo || i === 0 || disposicion === 'h';
                return (
                    <div key={i} style={{ position: 'absolute', ...zonaJugador(disposicion, i), pointerEvents: 'none' }}>
                        {duo && datos && (
                            <div style={{ position: 'absolute', top: arribaLibre ? 104 : 10, left: '50%', transform: 'translateX(-50%)', background: 'rgba(10,15,36,0.78)', border: `2px solid ${col}`, borderRadius: 12, padding: '4px 14px', color: '#fff', fontWeight: 800, whiteSpace: 'nowrap', boxShadow: `0 0 12px ${col}66` }}>
                                <span style={{ color: col }}>🛸 {nombre}</span>
                                <span style={{ marginLeft: 10, fontSize: '1.15rem' }}>{datos.puntos} pts</span>
                                <span style={{ marginLeft: 8, fontSize: '0.8rem', color: '#94a3b8' }}>✓{datos.aciertos} ✗{datos.fallos}</span>
                            </div>
                        )}
                        {aviso && (
                            <div key={aviso.k} style={{ position: 'absolute', top: duo ? (arribaLibre ? 150 : 56) : '24%', left: '50%', transform: 'translateX(-50%)', animation: 'ovniEntra 0.25s ease-out', background: aviso.tipo === 'ok' ? 'rgba(22,101,52,0.92)' : 'rgba(153,27,27,0.94)', color: '#fff', borderRadius: 14, padding: '9px 16px', fontWeight: 800, fontSize: duo ? 'clamp(0.8rem, 1.8vw, 1.05rem)' : 'clamp(0.95rem, 2.4vw, 1.3rem)', boxShadow: '0 6px 24px rgba(0,0,0,0.4)', width: 'max-content', maxWidth: '88%', textAlign: 'center' }}>
                                {aviso.texto}
                            </div>
                        )}
                        <div style={{ position: 'absolute', left: 14, right: 14, bottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <div style={{ pointerEvents: 'auto' }}>
                                {tactil && !mandos?.activos ? <Joystick onMover={(x, y, activo) => motorRef.current?.setJoy(i, x, y, activo)} /> : (
                                    <div style={{ background: 'rgba(10,15,36,0.6)', color: '#cbd5e1', borderRadius: 10, padding: '8px 12px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                                        {mandos?.activos && ctrl && <PilotoEnJuego ctrl={ctrl} i={i} color={col} />}
                                        <div>{pista(i)}</div>
                                    </div>
                                )}
                            </div>
                            <button
                                onPointerDown={(e) => { e.preventDefault(); motorRef.current?.abducir(i); }}
                                style={{
                                    pointerEvents: 'auto', width: duo ? 'min(20vw, 104px)' : 'min(26vw, 130px)', aspectRatio: '1/1', borderRadius: '50%',
                                    border: `3px solid ${objetivos[i] ? VERDE : col + '88'}`,
                                    background: objetivos[i] ? 'rgba(34,197,94,0.25)' : 'rgba(10,15,36,0.55)',
                                    boxShadow: objetivos[i] ? `0 0 30px ${VERDE} inset, 0 0 22px ${VERDE}` : 'none',
                                    color: '#fff', fontWeight: 900, fontSize: 'clamp(0.7rem, 2vw, 0.95rem)', cursor: 'pointer',
                                    transform: objetivos[i] ? 'scale(1.06)' : 'scale(1)', transition: 'all 0.15s', touchAction: 'none',
                                }}
                            >
                                <div style={{ fontSize: duo ? 'clamp(1.3rem, 4.5vw, 2rem)' : 'clamp(1.6rem, 6vw, 2.6rem)' }}>🛸</div>
                                ABDUCIR
                            </button>
                        </div>
                    </div>
                );
            })}

            {/* Cámara de la mano (abajo en el centro, entre los botones) */}
            {conMano && (
                <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 3, pointerEvents: 'none', opacity: 0.92 }}>
                    <VistaManos ancho={duo ? 220 : 180} lineaCentral={duo}
                        colorMano={(m) => (duo ? COLORES_JUGADOR[m.centro.x < 0.5 ? 0 : 1].css : NEON)}
                        style={{ border: `2px solid ${NEON}88`, borderRadius: 12 }} />
                </div>
            )}

            {/* Cartel de inicio de ronda / ronda completada */}
            {(cartelRonda || avisoRonda) && (
                <div key={cartelRonda ? `r${cartelRonda.ronda}` : avisoRonda.k} style={{ position: 'absolute', top: '50%', left: '50%', animation: 'ovniRonda 2.2s ease-out forwards', textAlign: 'center', pointerEvents: 'none', color: '#fff', textShadow: `0 0 18px ${NEON}, 0 2px 4px #000`, width: '90vw', zIndex: 4 }}>
                    {cartelRonda ? (
                        <>
                            <div style={{ fontSize: 'clamp(1rem, 3vw, 1.6rem)', fontWeight: 700, color: '#c7d2fe' }}>Ronda {cartelRonda.ronda} de {cartelRonda.totalRondas}</div>
                            <div style={{ fontSize: 'clamp(1.8rem, 6vw, 3.6rem)', fontWeight: 900 }}>Abduce: <span style={{ color: NEON }}>{cartelRonda.objetivo}</span></div>
                            {cartelRonda.pilotos && cartelRonda.pilotos.slice(0, nJug).some(p => p != null) && (
                                <div style={{ fontSize: 'clamp(1rem, 3vw, 1.6rem)', fontWeight: 800, marginTop: 6 }}>
                                    {cartelRonda.pilotos.slice(0, nJug).map((p, k) => p != null && (
                                        <span key={k} style={{ color: duo ? COLORES_JUGADOR[k].css : '#fde68a', margin: '0 12px' }}>🎮 Pilota {ctrl.nombreDe(p)}</span>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{ fontSize: 'clamp(1.8rem, 6vw, 3.4rem)', fontWeight: 900 }}>{avisoRonda.texto}</div>
                    )}
                </div>
            )}
        </div>
    );
};

const estiloBtn = (activo, color = NEON) => ({
    background: activo ? `${color}22` : 'rgba(255,255,255,0.04)', color: activo ? color : '#cbd5e1',
    border: `2px solid ${activo ? color : 'rgba(255,255,255,0.15)'}`, borderRadius: 12, padding: '10px 12px',
    cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', textAlign: 'left',
});

const estiloInput = {
    padding: '9px 12px', borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: '0.9rem',
    outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
};

const ModalBase = ({ titulo, color = NEON, onClose, children }) => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 10001, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 14 }}>
        <div style={{ background: '#1a1330', border: `1px solid ${color}55`, borderRadius: 20, width: '100%', maxWidth: 420, maxHeight: '92vh', overflowY: 'auto', padding: '22px 24px', color: 'white', fontFamily: "'Segoe UI', sans-serif", boxShadow: `0 0 30px ${color}33` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', color }}>{titulo}</h3>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem' }}>✕</button>
            </div>
            {children}
        </div>
    </div>
);

const Etiqueta = ({ children }) => <label style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 600, display: 'block', marginBottom: 4 }}>{children}</label>;

// ─── Enviar al profesor ──────────────────────────────────────────────────────
// Con enlace de competición (&comp=…) la puntuación va a esa prueba (solo en individual).
function ModalEnviarProfe(p) {
    const comp = p.resultado.jugadores.length === 1 ? leerCompeticionUrl() : null;
    if (comp) {
        return <ModalEnviarCompeticion compId={comp.compId} catId={comp.catId} puntos={Number(p.resultado.aciertos) || 0}
            detalle={soloPrimitivos({ aciertos: p.resultado.aciertos, fallos: p.resultado.fallos, contenido: p.config.contenido })}
            nombreJuego="Ovni Abducción" tituloReto={comp.titulo} onClose={p.onClose} />;
    }
    return <ModalEnviarProfeBase {...p} />;
}

function ModalEnviarProfeBase({ resultado, config, nombres: nombresIniciales, onClose }) {
    const duo = resultado.jugadores.length === 2;
    const [codigo, setCodigo] = useState('');
    const [nombres, setNombres] = useState(() => nombresIniciales.map(n => (/^Jugador \d$/.test(n) ? '' : n)));
    const [curso, setCurso] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [enviado, setEnviado] = useState(false);
    const [error, setError] = useState('');

    const enviar = async () => {
        const code = codigo.trim().toUpperCase();
        if (nombres.some(n => !n.trim())) { setError(duo ? 'Escribid los dos nombres.' : 'Escribe tu nombre.'); return; }
        if (!code) { setError('Escribe el código del profesor.'); return; }
        setEnviando(true); setError('');
        try {
            const snap = await getDoc(doc(db, 'codigos_profesor', code));
            if (!snap.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
            const puntos = resultado.jugadores.map(j => j.puntos);
            const jugadores = resultado.jugadores.map((j, i) => {
                const intentos = j.aciertos + j.fallos;
                const rival = duo ? puntos[1 - i] : null;
                return {
                    nombre: nombres[i].trim(), curso: curso.trim(),
                    aciertos: j.aciertos, fallos: j.fallos, intentos,
                    porcentaje: intentos > 0 ? Math.round((j.aciertos / intentos) * 100) : 0,
                    puntos: j.puntos,
                    ...(duo
                        ? { resultadoDuelo: j.puntos > rival ? 'gana' : j.puntos < rival ? 'pierde' : 'empate', rival: nombres[1 - i].trim() }
                        : { vidas: j.vidas, ganado: !!resultado.ganado }),
                    rondasCompletadas: resultado.rondasCompletadas, totalRondas: resultado.totalRondas,
                    aciertosLista: (j.aciertosLista || []).slice(0, 60).map(a => ({ palabra: String(a.palabra).slice(0, 60), categoria: String(a.categoria).slice(0, 80) })),
                    fallosLista: (j.fallosLista || []).slice(0, 60).map(f => ({ palabra: String(f.palabra).slice(0, 60), explicacion: String(f.explicacion || '').slice(0, 160), buscabas: String(f.buscabas).slice(0, 80) })),
                };
            });
            await addDoc(collection(db, 'informes_juegos'), {
                tipo: 'OVNI',
                modalidad: duo ? 'Duelo · pantalla dividida' : 'Individual',
                fecha: new Date(),
                codigoProfesor: code,
                recursoTitulo: config.contenido,
                config,
                jugadores,
            });
            jugadores.forEach(j => guardarRegistroLocal('OVNI', {
                titulo: `Ovni · ${config.contenido}`, aciertos: j.aciertos, intentos: j.intentos,
                porcentaje: j.porcentaje, nombre: j.nombre, curso: j.curso, via: 'profesor',
            }));
            setEnviado(true);
        } catch (e) { setError('Error: ' + e.message); }
        setEnviando(false);
    };

    return (
        <ModalBase titulo="📤 Enviar al profesor" color="#facc15" onClose={onClose}>
            {enviado ? (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <div style={{ fontSize: '3rem' }}>✅</div>
                    <div style={{ color: VERDE, fontWeight: 700 }}>¡Informe enviado!</div>
                    <div style={{ color: '#aaa', fontSize: '0.88rem', marginTop: 8 }}>
                        {resultado.jugadores.map((j, i) => <div key={i}>{nombres[i]}: {j.aciertos} aciertos · {j.fallos} fallos</div>)}
                    </div>
                    <button onClick={onClose} style={{ marginTop: 16, padding: '9px 22px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: 'white' }}>Cerrar</button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '8px 10px' }}>
                        Se envía: {config.contenido} · {config.rondas} rondas · aciertos, fallos y la explicación de cada error.
                    </div>
                    {nombres.map((n, i) => (
                        <div key={i}>
                            <Etiqueta>{duo ? <span style={{ color: COLORES_JUGADOR[i].css }}>Jugador {i + 1} (nave {COLORES_JUGADOR[i].nombre})</span> : 'Nombre y apellido'}</Etiqueta>
                            <input value={n} onChange={e => setNombres(ns => ns.map((x, k) => (k === i ? e.target.value : x)))} placeholder="Nombre completo" style={estiloInput} />
                        </div>
                    ))}
                    <div><Etiqueta>Curso</Etiqueta>
                        <input value={curso} onChange={e => setCurso(e.target.value)} placeholder="Ej: 5º Primaria A" style={estiloInput} /></div>
                    <div><Etiqueta>Código del profesor</Etiqueta>
                        <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="Ej: PROF01" maxLength={10} style={{ ...estiloInput, letterSpacing: 2, fontWeight: 700 }} /></div>
                    {error && <div style={{ color: '#f87171', fontSize: '0.8rem' }}>⚠ {error}</div>}
                    <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
                        <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer', color: 'white' }}>Cancelar</button>
                        <button onClick={enviar} disabled={enviando} style={{ flex: 2, padding: 10, borderRadius: 10, border: 'none', background: enviando ? '#555' : 'linear-gradient(135deg,#facc15,#f59e0b)', color: '#1a1330', fontWeight: 800, cursor: enviando ? 'default' : 'pointer' }}>
                            {enviando ? 'Enviando…' : '📤 Enviar'}
                        </button>
                    </div>
                </div>
            )}
        </ModalBase>
    );
}

// ─── Ficha PDF para preparar el contenido ───────────────────────────────────
const TAMAÑOS_FICHA = [['auto', '📄 Auto (1 página)', '0.9rem'], [0.75, 'A', '0.75rem'], [1, 'A', '0.95rem'], [1.25, 'A', '1.15rem'], [1.5, 'A', '1.35rem']];
const ESCALAS_AUTO = [1.6, 1.5, 1.4, 1.3, 1.2, 1.1, 1, 0.9, 0.8, 0.7, 0.6];

function ModalFicha({ contenido, crearGenerador, categorias, onClose }) {
    const [n, setN] = useState(6);
    const [soluciones, setSoluciones] = useState(true);
    const [clasificar, setClasificar] = useState(true);
    const [tamaño, setTamaño] = useState('auto');
    const [estado, setEstado] = useState('');

    const generar = async (ver) => {
        setEstado('Generando…');
        try {
            const gen = crearGenerador(n);
            const rondasFicha = Array.from({ length: n }, (_, i) => gen(i));
            const base = { titulo: contenido, rondas: rondasFicha, clasificacion: categorias && clasificar ? categorias : null };
            let escala = tamaño;
            if (tamaño === 'auto') {
                // el tamaño más grande con el que la parte del alumno cabe en una página
                escala = ESCALAS_AUTO[ESCALAS_AUTO.length - 1];
                for (const e of ESCALAS_AUTO) {
                    const prueba = await generarFichaOvni({ ...base, soluciones: false, escala: e });
                    if (prueba.paginasAlumno === 1) { escala = e; break; }
                }
            }
            const pdf = await generarFichaOvni({ ...base, soluciones, escala });
            const archivo = `ficha-ovni-${contenido.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.pdf`;
            if (ver) {
                const url = pdf.output('bloburl');
                if (!window.open(url, '_blank')) pdf.save(archivo);
            } else pdf.save(archivo);
            setEstado(tamaño === 'auto'
                ? (pdf.paginasAlumno === 1 ? `Tamaño automático: ${Math.round(escala * 100)} % (cabe en 1 página).` : `Ni con el tamaño mínimo cabe en 1 página: ocupa ${pdf.paginasAlumno}. Prueba con menos ejercicios.`)
                : `Ficha del alumno: ${pdf.paginasAlumno} página${pdf.paginasAlumno > 1 ? 's' : ''}.`);
        } catch (e) {
            console.error(e);
            setEstado('No se pudo generar el PDF: ' + e.message);
        }
    };

    return (
        <ModalBase titulo="🖨️ Ficha para preparar en clase" onClose={onClose}>
            <p style={{ margin: '0 0 12px', fontSize: '0.88rem', color: '#cbd5e1' }}>
                Ficha en PDF con el contenido elegido (<b style={{ color: NEON }}>{contenido}</b>): en cada ejercicio el alumno rodea lo que debe abducir el ovni y explica una de las trampas. Las rondas de la ficha y del juego son distintas pero del mismo tipo, así que la ficha sirve de práctica previa.
            </p>
            <Etiqueta>Ejercicios</Etiqueta>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {[4, 6, 8, 10].map(k => <button key={k} onClick={() => setN(k)} style={{ ...estiloBtn(n === k), textAlign: 'center', minWidth: 48 }}>{k}</button>)}
            </div>
            <Etiqueta>Tamaño del texto</Etiqueta>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                {TAMAÑOS_FICHA.map(([v, txt, fs]) => (
                    <button key={txt} onClick={() => setTamaño(v)} title={v === 'auto' ? 'El más grande que quepa en una página' : `${Math.round(v * 100)} %`}
                        style={{ ...estiloBtn(tamaño === v), textAlign: 'center', padding: '8px 10px', fontSize: fs }}>{txt}</button>
                ))}
            </div>
            {categorias && (
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, fontSize: '0.9rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={clasificar} onChange={e => setClasificar(e.target.checked)} /> Añadir tabla para clasificar palabras
                </label>
            )}
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, fontSize: '0.9rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={soluciones} onChange={e => setSoluciones(e.target.checked)} /> Hoja de soluciones (con la explicación de cada trampa)
            </label>
            <div style={{ display: 'flex', gap: 9 }}>
                <button onClick={() => generar(true)} style={{ flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${NEON}`, background: 'transparent', color: NEON, fontWeight: 800, cursor: 'pointer' }}>👁 Ver</button>
                <button onClick={() => generar(false)} style={{ flex: 2, padding: 10, borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${NEON}, #0891b2)`, color: '#05202a', fontWeight: 800, cursor: 'pointer' }}>⬇️ Descargar PDF</button>
            </div>
            {estado && <div style={{ marginTop: 10, fontSize: '0.85rem', color: estado.startsWith('No') ? '#f87171' : '#94a3b8' }}>{estado}</div>}
        </ModalBase>
    );
}

export default function OvniAbduccion({ onExit }) {
    const [pantalla, setPantalla] = useState('MENU');
    const [area, setArea] = useState('MATEMATICAS');
    const [bancoId, setBancoId] = useState('numeros');
    const [rondas, setRondas] = useState(5);
    const [animo, setAnimo] = useState('normal');
    const [modo, setModo] = useState('solo');
    const [mandos, setMandos] = useState(() => {
        try { return { activos: false, invertir: false, turnos: false, ...JSON.parse(localStorage.getItem(KEY_MANDOS) || '{}') }; } catch { return { activos: false, invertir: false, turnos: false }; }
    });
    const ctrlMandos = useMandosOvni(mandos.activos, modo === 'duo' ? 2 : 1);
    const cambiarMandos = (cambios) => setMandos(m => {
        const n = { ...m, ...cambios };
        try { localStorage.setItem(KEY_MANDOS, JSON.stringify(n)); } catch { /* sin localStorage */ }
        return n;
    });
    const [nombresDuo, setNombresDuo] = useState(['Jugador 1', 'Jugador 2']);
    const [textoCustom, setTextoCustom] = useState(() => { try { return localStorage.getItem(KEY_CUSTOM) || EJEMPLO_CUSTOM; } catch { return EJEMPLO_CUSTOM; } });
    const [partida, setPartida] = useState(null);
    const [resultado, setResultado] = useState(null);
    const [sonido, setSonido] = useState(sonidoActivo());
    const [verEnvio, setVerEnvio] = useState(false);
    const [verFicha, setVerFicha] = useState(false);

    // los .glb de los animales se van descargando mientras se elige el contenido
    useEffect(() => { cargarModelosGranja().catch(() => {}); }, []);

    const [tiposMates, setTiposMates] = useState(() => TIPOS_MATES.map(t => t.id));
    const [nivelMates, setNivelMates] = useState('primaria');

    const custom = bancoId === 'custom';
    const numeros = bancoId === 'numeros';
    const catsCustom = custom ? parsearCategorias(textoCustom) : null;
    const banco = BANCOS_OVNI.find(b => b.id === bancoId);
    const puedeEmpezar = custom ? !!catsCustom : numeros ? tiposMates.length > 0 : !!banco;
    const categoriasPalabras = numeros ? null : custom ? catsCustom : banco?.categorias || null;
    const contenido = numeros ? `Números (${nivelMates === 'eso' ? 'ESO' : 'Primaria'})` : custom ? 'Mis categorías' : banco?.nombre || '';

    // mismo contenido para el juego y para la ficha
    const crearGenerador = (n) => (numeros ? crearGeneradorMates(tiposMates, nivelMates) : crearGeneradorPalabras(categoriasPalabras, n));

    const empezar = () => {
        if (!puedeEmpezar) return;
        if (custom) { try { localStorage.setItem(KEY_CUSTOM, textoCustom); } catch { /* sin localStorage */ } }
        const nombres = modo === 'duo' ? nombresDuo.map((n, i) => n.trim() || `Jugador ${i + 1}`) : ['Jugador 1'];
        const config = {
            contenido, rondas, animo, jugadores: nombres.length,
            origen: numeros ? 'numeros' : custom ? 'propias' : 'banco',
            materia: custom ? 'Propias' : (AREAS_OVNI.find(a => a.id === area)?.label || ''),
            ...(numeros
                ? { nivel: nivelMates, tipos: TIPOS_MATES.filter(t => tiposMates.includes(t.id)).map(t => t.nombre) }
                : { categorias: Object.keys(categoriasPalabras || {}) }),
        };
        setPartida({ generarRonda: crearGenerador(rondas), rondas, animo, nombres, config, mandos: { ...mandos }, k: Date.now() });
        setResultado(null);
        setPantalla('JUEGO');
    };
    const elegirArea = (id) => {
        setArea(id);
        setBancoId(id === 'MATEMATICAS' ? 'numeros' : (BANCOS_OVNI.find(b => b.area === id)?.id || 'custom'));
    };
    const alternarTipo = (id) => setTiposMates(ts => (ts.includes(id) ? ts.filter(t => t !== id) : [...ts, id]));

    const alTerminar = (res) => {
        setResultado(res);
        setPantalla('FIN');
        if (res.ganado || res.jugadores.length === 2) sonidoFinal();
        res.jugadores.forEach((j, i) => guardarRegistroLocal('OVNI', {
            titulo: `Ovni · ${partida?.config.contenido || ''}${res.jugadores.length === 2 ? ` · ${partida.nombres[i]}` : ''}`,
            aciertos: j.aciertos, intentos: j.aciertos + j.fallos, via: 'juego',
        }));
    };

    if (pantalla === 'JUEGO' && partida) {
        return <JuegoOvni key={partida.k} generarRonda={partida.generarRonda} rondas={partida.rondas} animo={partida.animo} nombres={partida.nombres} mandos={partida.mandos} ctrl={ctrlMandos} onFin={alTerminar} onSalir={() => setPantalla('MENU')} />;
    }

    const fondo = { position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto', background: 'radial-gradient(ellipse at top, #2d1b4e 0%, #110c1c 60%, #070414 100%)', color: '#fff', fontFamily: 'system-ui, "Segoe UI", sans-serif' };
    const h3 = { color: '#a5b4fc', fontSize: '0.9rem', letterSpacing: 1, textTransform: 'uppercase' };

    if (pantalla === 'FIN' && resultado && partida) {
        const duo = resultado.jugadores.length === 2;
        const [p1, p2] = resultado.jugadores;
        const ganador = duo ? (p1.puntos === p2.puntos ? -1 : p1.puntos > p2.puntos ? 0 : 1) : null;
        const repaso = resultado.jugadores.flatMap((j, i) => j.fallosLista.map(f => ({ ...f, jugador: i })));
        return (
            <div style={fondo}>
                <div style={{ maxWidth: 680, margin: '0 auto', padding: '36px 16px', textAlign: 'center' }}>
                    {duo ? (
                        <>
                            <div style={{ fontSize: 60 }}>{ganador === -1 ? '🤝' : '🏆'}</div>
                            <h1 style={{ margin: '8px 0', color: ganador === -1 ? NEON : COLORES_JUGADOR[ganador].css, textShadow: `0 0 18px ${ganador === -1 ? NEON : COLORES_JUGADOR[ganador].css}` }}>
                                {ganador === -1 ? '¡Empate!' : `¡Gana ${partida.nombres[ganador]}!`}
                            </h1>
                        </>
                    ) : (
                        <>
                            <div style={{ fontSize: 64 }}>{resultado.ganado ? '🛸✨' : '🛸💥'}</div>
                            <h1 style={{ color: resultado.ganado ? VERDE : '#f87171', textShadow: `0 0 18px ${resultado.ganado ? VERDE : '#f87171'}`, margin: '8px 0' }}>
                                {resultado.ganado ? '¡Misión completada!' : 'Nave averiada'}
                            </h1>
                        </>
                    )}
                    <p style={{ color: '#c7d2fe' }}>{partida.config.contenido} · rondas {resultado.rondasCompletadas}/{resultado.totalRondas}</p>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', margin: '18px 0', flexWrap: 'wrap' }}>
                        {resultado.jugadores.map((j, i) => {
                            const col = duo ? COLORES_JUGADOR[i].css : NEON;
                            return (
                                <div key={i} style={{ background: `${col}14`, border: `2px solid ${col}`, borderRadius: 16, padding: '12px 20px', minWidth: 170 }}>
                                    {duo && <div style={{ fontWeight: 800, color: col, marginBottom: 4 }}>🛸 {partida.nombres[i]}</div>}
                                    {duo && <div style={{ fontSize: 34, fontWeight: 900 }}>{j.puntos} <span style={{ fontSize: 14, color: '#94a3b8' }}>pts</span></div>}
                                    <div style={{ display: 'flex', gap: 14, justifyContent: 'center', fontWeight: 800, fontSize: duo ? '1rem' : '1.6rem' }}>
                                        <span style={{ color: VERDE }}>✓ {j.aciertos}</span>
                                        <span style={{ color: '#f87171' }}>✗ {j.fallos}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {repaso.length > 0 && (
                        <div style={{ textAlign: 'left', background: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: '12px 16px', margin: '0 0 18px' }}>
                            <div style={{ fontWeight: 800, marginBottom: 8, color: '#fca5a5' }}>Para repasar</div>
                            {repaso.map((f, i) => (
                                <div key={i} style={{ padding: '4px 0', borderTop: i ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                                    {duo && <span style={{ color: COLORES_JUGADOR[f.jugador].css, fontWeight: 700, marginRight: 6 }}>{partida.nombres[f.jugador]}:</span>}
                                    <b style={{ color: NEON }}>{f.palabra}</b> → {f.explicacion || 'no era de la categoría'} <span style={{ color: '#94a3b8' }}>(buscabas {f.buscabas})</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button onClick={() => setVerEnvio(true)} style={{ padding: '11px 18px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#facc15,#f59e0b)', color: '#1a1330', fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem' }}>📤 Enviar al profesor</button>
                        <button onClick={empezar} style={{ ...estiloBtn(true, VERDE), textAlign: 'center' }}>🔁 Jugar otra vez</button>
                        <button onClick={() => setPantalla('MENU')} style={{ ...estiloBtn(true), textAlign: 'center' }}>⚙️ Cambiar contenido</button>
                        <button onClick={onExit} style={{ ...estiloBtn(false), textAlign: 'center' }}>← Salir</button>
                    </div>
                </div>
                {verEnvio && <ModalEnviarProfe resultado={resultado} config={partida.config} nombres={partida.nombres} onClose={() => setVerEnvio(false)} />}
            </div>
        );
    }

    return (
        <div style={fondo}>
            <div style={{ maxWidth: 820, margin: '0 auto', padding: '20px 16px 40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button onClick={onExit} style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontWeight: 700 }}>← Volver</button>
                    <button onClick={() => setSonido(setSonidoActivo(!sonido))} style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>{sonido ? '🔊' : '🔇'}</button>
                </div>
                <div style={{ textAlign: 'center', margin: '14px 0 20px' }}>
                    <div style={{ fontSize: 56 }}>🛸</div>
                    <h1 style={{ margin: '4px 0', color: NEON, textShadow: `0 0 18px ${NEON}`, fontSize: 'clamp(1.8rem, 5vw, 2.6rem)' }}>Ovni Abducción</h1>
                    <p style={{ color: '#c7d2fe', margin: 0 }}>Cada animal lleva una palabra o un número. Abduce solo los que encajan con lo que se pide.</p>
                </div>

                <h3 style={h3}>Materia</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {AREAS_OVNI.map(a => {
                        const activa = area === a.id && !custom;
                        return (
                            <button key={a.id} onClick={() => elegirArea(a.id)}
                                style={{ ...estiloBtn(activa, a.color), textAlign: 'center', padding: '7px 12px', fontSize: '0.88rem', ...(activa ? { background: a.color, color: '#fff', borderColor: a.color } : {}) }}>
                                {a.emoji} {a.label}
                            </button>
                        );
                    })}
                    <button onClick={() => setBancoId('custom')} style={{ ...estiloBtn(custom, VERDE), textAlign: 'center', padding: '7px 12px', fontSize: '0.88rem' }}>✏️ Mis categorías</button>
                </div>

                {!custom && (
                    <>
                        <h3 style={h3}>Contenido</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                            {area === 'MATEMATICAS' && (
                                <button onClick={() => setBancoId('numeros')} style={estiloBtn(numeros, '#facc15')}>
                                    <span style={{ fontSize: '1.3rem', marginRight: 6 }}>🔢</span>Números (generador)
                                    <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#94a3b8', marginTop: 4 }}>Primos, divisores, múltiplos, fracciones, potencias, mayor/menor</div>
                                </button>
                            )}
                            {BANCOS_OVNI.filter(b => b.area === area).map(b => (
                                <button key={b.id} onClick={() => setBancoId(b.id)} style={estiloBtn(bancoId === b.id)}>
                                    <span style={{ fontSize: '1.3rem', marginRight: 6 }}>{b.emoji}</span>{b.nombre}
                                    <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#94a3b8', marginTop: 4 }}>{Object.keys(b.categorias).join(' · ')}</div>
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {custom && (
                    <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: 6 }}>Una categoría por línea: <code style={{ color: VERDE }}>Categoría: palabra, palabra, palabra</code> (mínimo 2 categorías con 2 palabras).</div>
                        <textarea value={textoCustom} onChange={e => setTextoCustom(e.target.value)} rows={6}
                            style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.35)', color: '#fff', border: `1px solid ${catsCustom ? VERDE : '#f87171'}`, borderRadius: 10, padding: 10, fontSize: '0.95rem', fontFamily: 'inherit' }} />
                        {!catsCustom && <div style={{ color: '#fca5a5', fontSize: '0.85rem' }}>Faltan categorías: necesitas al menos 2 con 2 palabras cada una.</div>}
                    </div>
                )}

                {numeros && (
                    <div style={{ marginTop: 12, background: 'rgba(250,204,21,0.06)', border: '1px solid rgba(250,204,21,0.3)', borderRadius: 12, padding: 12 }}>
                        <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: 8 }}>Cada ronda sale al azar de los tipos marcados, con números nuevos:</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
                            {TIPOS_MATES.map(t => (
                                <button key={t.id} onClick={() => alternarTipo(t.id)} style={{ ...estiloBtn(tiposMates.includes(t.id), '#facc15'), padding: '8px 10px' }}>
                                    {tiposMates.includes(t.id) ? '☑' : '☐'} <span style={{ display: 'inline-block', minWidth: 26, textAlign: 'center' }}>{t.emoji}</span> {t.nombre}
                                </button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ color: '#a5b4fc', fontSize: '0.85rem', fontWeight: 700 }}>NIVEL</span>
                            {[['primaria', '🎒 Primaria'], ['eso', '🎓 ESO']].map(([id, txt]) =>
                                <button key={id} onClick={() => setNivelMates(id)} style={{ ...estiloBtn(nivelMates === id, '#facc15'), textAlign: 'center', padding: '6px 12px' }}>{txt}</button>)}
                            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                                {nivelMates === 'eso' ? 'Números hasta 200, potencias hasta 2¹⁰ y 3⁶, decimales y negativos' : 'Números hasta 100, potencias hasta 2⁷ y 3⁵, enteros'}
                            </span>
                        </div>
                        {!tiposMates.length && <div style={{ color: '#fca5a5', fontSize: '0.85rem', marginTop: 6 }}>Marca al menos un tipo.</div>}
                    </div>
                )}

                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 18 }}>
                    <div>
                        <h3 style={h3}>Jugadores</h3>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button onClick={() => setModo('solo')} style={{ ...estiloBtn(modo === 'solo'), textAlign: 'center' }}>🛸 1 jugador</button>
                            <button onClick={() => setModo('duo')} style={{ ...estiloBtn(modo === 'duo', COLORES_JUGADOR[1].css), textAlign: 'center' }}>🛸🛸 2 · pantalla dividida</button>
                        </div>
                    </div>
                    <div>
                        <h3 style={h3}>Mandos</h3>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <button onClick={() => cambiarMandos({ activos: !mandos.activos })} style={{ ...estiloBtn(mandos.activos, '#facc15'), textAlign: 'center' }}>🎮 Mandos micro:bit</button>
                            <button onClick={() => cambiarMandos({ mano: !mandos.mano })} style={{ ...estiloBtn(!!mandos.mano, '#22c55e'), textAlign: 'center' }}>✋ Mano (cámara)</button>
                        </div>
                    </div>
                    <div>
                        <h3 style={h3}>Rondas</h3>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {[3, 5, 8].map(n => <button key={n} onClick={() => setRondas(n)} style={{ ...estiloBtn(rondas === n), textAlign: 'center', minWidth: 52 }}>{n}</button>)}
                        </div>
                    </div>
                    <div>
                        <h3 style={h3}>Animales</h3>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {[['tranquilos', '😌 Tranquilos'], ['normal', '🐄 Normales'], ['nerviosos', '😱 Asustadizos']].map(([id, txt]) =>
                                <button key={id} onClick={() => setAnimo(id)} style={{ ...estiloBtn(animo === id), textAlign: 'center' }}>{txt}</button>)}
                        </div>
                    </div>
                </div>

                {modo === 'duo' && (
                    <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                        {nombresDuo.map((n, i) => (
                            <div key={i} style={{ border: `2px solid ${COLORES_JUGADOR[i].css}66`, borderRadius: 12, padding: 10, background: `${COLORES_JUGADOR[i].css}0d` }}>
                                <div style={{ color: COLORES_JUGADOR[i].css, fontWeight: 800, fontSize: '0.85rem', marginBottom: 6 }}>
                                    🛸 Nave {COLORES_JUGADOR[i].nombre} · {i === 0 ? 'mitad izquierda · WASD + Espacio' : 'mitad derecha · Flechas + Enter'}
                                </div>
                                <input value={n} onChange={e => setNombresDuo(ns => ns.map((x, k) => (k === i ? e.target.value : x)))} placeholder={`Jugador ${i + 1}`} style={estiloInput} />
                            </div>
                        ))}
                        <div style={{ gridColumn: '1 / -1', fontSize: '0.8rem', color: '#94a3b8' }}>
                            Los dos ovnis comparten la granja y el enunciado: acierto +1 punto, error −1. En tablet o pizarra táctil cada mitad tiene su joystick y su botón.
                        </div>
                    </div>
                )}

                {mandos.activos && (
                    <PanelMandosOvni ctrl={ctrlMandos} duo={modo === 'duo'} colores={COLORES_JUGADOR.map(c => c.css)}
                        invertir={mandos.invertir} onInvertir={v => cambiarMandos({ invertir: v })}
                        turnos={mandos.turnos} onTurnos={v => cambiarMandos({ turnos: v })} />
                )}

                {mandos.mano && (
                    <div style={{ marginTop: 16, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', border: '2px solid #22c55e66', borderRadius: 14, padding: 12, background: 'rgba(34,197,94,0.06)' }}>
                        <VistaManos ancho={240} lineaCentral={modo === 'duo'}
                            colorMano={(m) => (modo === 'duo' ? COLORES_JUGADOR[m.centro.x < 0.5 ? 0 : 1].css : NEON)} />
                        <div style={{ flex: '1 1 240px', color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1.5 }}>
                            <b style={{ color: '#22c55e' }}>✋ Pilotar con la mano</b><br />
                            Pon la palma delante de la cámara: en el centro la nave se queda quieta; muévela hacia un lado y la nave va hacia allí (cuanto más lejos, más rápido).
                            <b style={{ color: VERDE }}> Cierra el puño</b> encima de un animal para abducirlo.
                            {modo === 'duo' && <><br />Con 2 jugadores, cada uno en su mitad de la cámara (la línea discontinua): izquierda = nave {COLORES_JUGADOR[0].nombre}, derecha = nave {COLORES_JUGADOR[1].nombre}.</>}
                            <br /><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Todo se procesa en este ordenador: no se envía ninguna imagen.</span>
                        </div>
                    </div>
                )}

                <div style={{ textAlign: 'center', marginTop: 28 }}>
                    <button onClick={empezar} disabled={!puedeEmpezar}
                        style={{ background: 'transparent', color: NEON, border: `3px solid ${NEON}`, borderRadius: 14, padding: '14px 42px', fontSize: '1.3rem', fontWeight: 900, cursor: !puedeEmpezar ? 'not-allowed' : 'pointer', opacity: !puedeEmpezar ? 0.5 : 1, boxShadow: `0 0 20px ${NEON}66 inset, 0 0 20px ${NEON}66`, letterSpacing: 2 }}>
                        🚀 DESPEGAR
                    </button>
                    <div style={{ marginTop: 14 }}>
                        <button onClick={() => setVerFicha(true)} disabled={!puedeEmpezar}
                            style={{ background: 'rgba(255,255,255,0.06)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '9px 16px', cursor: puedeEmpezar ? 'pointer' : 'not-allowed', fontWeight: 700 }}>
                            🖨️ Ficha PDF para preparar el contenido
                        </button>
                    </div>
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: 14 }}>
                        {modo === 'duo'
                            ? 'Si un ovni abduce un animal equivocado, la nave lo escupe y ese jugador pierde un punto.'
                            : `Si abduces un animal equivocado la nave lo escupe y pierdes una vida (${VIDAS} en total).`}
                    </p>
                </div>
            </div>
            {verFicha && <ModalFicha contenido={contenido} crearGenerador={crearGenerador} categorias={categoriasPalabras} onClose={() => setVerFicha(false)} />}
        </div>
    );
}
