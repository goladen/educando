// Bancos de categorías del Ovni Abducción (también los usa el Tiro con arco en «clases de palabras»).
// Módulo aparte y sin three.js para no cargar todo el Ovni desde otros juegos.

const ITEMS_POR_RONDA = 8;

const barajar = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
};

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

/**
 * Rondas a partir de categorías de palabras: cada ronda pide una categoría
 * (barajadas, sin repetir dos seguidas) con 3-4 palabras suyas y el resto de otras.
 * Devuelve generarRonda(i) → { objetivo, items: [{ texto, correcta, explicacion }] }.
 */
export const crearGeneradorPalabras = (categorias, totalRondas, porRonda = ITEMS_POR_RONDA) => {
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
        for (let k = 0; items.length < porRonda && k < 40; k++) {
            const c = otras[k % otras.length];
            const [p] = sacar(c, 1, objetivo);
            if (p && !items.some(it => it.texto === p)) items.push({ texto: p, correcta: false, explicacion: `«${p}» es de ${c}` });
        }
        return { objetivo, items };
    };
};

