// Dinámicas de aula (DINAMICAS_AULA): 10 dinámicas activas para orquestar desde la PDI.
// Basado en ideas de @myteachingexperience (Instagram). Redacción y adaptación propias de PiKT.
//
// Cada dinámica usa un «banco» de contenido (preguntas, estructuras, palabras o retos) que cambia
// según la materia elegida. El profesor puede sustituirlo por el suyo (se guarda en el dispositivo).

export const CREDITO = 'Basado en ideas de @myteachingexperience';
export const CREDITO_URL = 'https://www.instagram.com/myteachingexperience/';

export const EQUIPOS_BASE = [
    { nombre: 'Zorros', emoji: '🦊', color: '#f97316' },
    { nombre: 'Pulpos', emoji: '🐙', color: '#8b5cf6' },
    { nombre: 'Tigres', emoji: '🐯', color: '#eab308' },
    { nombre: 'Delfines', emoji: '🐬', color: '#0ea5e9' },
    { nombre: 'Unicornios', emoji: '🦄', color: '#ec4899' },
    { nombre: 'Tortugas', emoji: '🐢', color: '#22c55e' },
    { nombre: 'Búhos', emoji: '🦉', color: '#a16207' },
    { nombre: 'Dinos', emoji: '🦖', color: '#14b8a6' },
];

export const MATERIAS = [
    { id: 'ingles', nombre: 'Inglés', emoji: '🇬🇧', color: '#1d4ed8' },
    { id: 'frances', nombre: 'Francés', emoji: '🇫🇷', color: '#2563eb' },
    { id: 'lengua', nombre: 'Lengua', emoji: '📖', color: '#dc2626' },
    { id: 'mates', nombre: 'Matemáticas', emoji: '➗', color: '#059669' },
    { id: 'ciencias', nombre: 'Ciencias', emoji: '🔬', color: '#16a34a' },
    { id: 'sociales', nombre: 'Geografía e Historia', emoji: '🌍', color: '#b45309' },
    { id: 'propio', nombre: 'Mi contenido', emoji: '✍️', color: '#475569' },
];

export const TIPOS_BANCO = {
    preguntas: { nombre: 'Preguntas para conversar', ayuda: 'Una pregunta o tema de conversación por línea.' },
    estructuras: { nombre: 'Estructuras (una por número del dado)', ayuda: 'Seis líneas: la 1 corresponde al 1 del dado, la 2 al 2…' },
    palabras: { nombre: 'Palabras o conceptos', ayuda: 'Una palabra o concepto por línea.' },
    retos: { nombre: 'Retos con solución', ayuda: 'Una línea por reto: «pregunta | respuesta». Varias respuestas válidas separadas por «/».' },
};

// ─────────────────────────── Bancos por materia ───────────────────────────
const R = (p, r) => ({ p, r });

export const BANCOS = {
    ingles: {
        preguntas: [
            'What did you do last weekend?', 'What is your favourite food and why?', 'If you could travel anywhere, where would you go?',
            'What do you usually do after school?', 'Who is your favourite singer or band?', 'What would you buy with 100 euros?',
            'Have you ever been to another country?', 'What are you going to do this summer?', 'What is the best film you have ever seen?',
            'Do you prefer the beach or the mountains? Why?', 'What is your morning routine like?', 'What job would you like to have in the future?',
        ],
        estructuras: [
            'I usually… / I never… (present simple)', 'Right now I am… (present continuous)', 'Yesterday I… (past simple)',
            'Tomorrow I am going to…', 'If I had…, I would…', 'I have never… / Have you ever…?',
        ],
        palabras: ['apple', 'umbrella', 'elephant', 'guitar', 'swimming', 'teacher', 'kitchen', 'bicycle', 'sandwich', 'football', 'rain', 'dancing', 'camera', 'library', 'sleeping', 'doctor', 'pizza', 'telephone'],
        retos: [
            R('Past simple of «go»', 'went'), R('Plural of «child»', 'children'), R('Opposite of «expensive»', 'cheap'),
            R('Translate: «biblioteca»', 'library'), R('Complete: She ___ (be) my best friend.', 'is'), R('Past simple of «buy»', 'bought'),
            R('Comparative of «good»', 'better'), R('___ you like pizza? (Do / Does)', 'do'), R('Correct it: «He don\'t play tennis.»', "he doesn't play tennis/he does not play tennis"),
            R('Superlative of «big»', 'the biggest/biggest'), R('Past participle of «eat»', 'eaten'), R('Translate: «tengo hambre»', "i'm hungry/i am hungry"),
        ],
        pistas: ['It\'s a…', 'You use it to…', 'You can find it in…', 'It\'s the opposite of…', 'It rhymes with…'],
        piezas: {
            sujetos: ['I', 'You', 'My best friend', 'We', 'They', 'My teacher'],
            tiempos: ['present simple', 'present continuous', 'past simple', 'going to', 'present perfect', 'would'],
            complementos: ['at the weekend', 'in the park', 'with my family', 'every morning', 'at school', 'on holiday'],
        },
    },
    frances: {
        preguntas: [
            "Qu'est-ce que tu as fait le week-end dernier ?", 'Quel est ton plat préféré ? Pourquoi ?', 'Où voudrais-tu voyager ?',
            "Qu'est-ce que tu fais après l'école ?", 'Tu as des frères et sœurs ?', 'Quel est ton sport préféré ?',
            'Comment est ta maison ?', "Qu'est-ce que tu vas faire cet été ?", 'Quelle est ta matière préférée ?',
            'Tu préfères la plage ou la montagne ?', 'Décris ta journée typique.', 'Quel métier voudrais-tu faire ?',
        ],
        estructuras: [
            "D'habitude, je… (présent)", 'Je suis en train de…', "Hier, j'ai… (passé composé)",
            'Demain, je vais… (futur proche)', "Si j'étais…, je…", "J'aime… parce que…",
        ],
        palabras: ['la pomme', 'le parapluie', "l'éléphant", 'la guitare', 'nager', 'le professeur', 'la cuisine', 'le vélo', 'le croissant', 'le football', 'la pluie', 'danser', "l'appareil photo", 'la bibliothèque', 'dormir', 'le médecin', 'la baguette', 'le téléphone'],
        retos: [
            R('Passé composé de « aller » (je)', 'je suis allé/je suis allée/suis allé/suis allée'), R('Pluriel de « cheval »', 'chevaux'), R('Contraire de « grand »', 'petit'),
            R('Traduis : « biblioteca »', 'bibliothèque/la bibliothèque'), R('Complète : Nous ___ (être) amis.', 'sommes'), R('Féminin de « acteur »', 'actrice'),
            R('Traduis : « tengo hambre »', "j'ai faim"), R('Article : ___ eau (le / la / l\')', "l'"), R('Conjugue « avoir » (ils)', 'ils ont/ont'),
            R('Comment dit-on « gracias » ?', 'merci'), R('Futur proche : je ___ manger', 'vais'), R('Contraire de « toujours »', 'jamais'),
        ],
        pistas: ["C'est un / une…", "On l'utilise pour…", 'On le trouve dans…', "C'est le contraire de…", 'Ça ressemble à…'],
        piezas: {
            sujetos: ['Je', 'Tu', 'Mon ami', 'Nous', 'Vous', 'Ils'],
            tiempos: ['présent', 'passé composé', 'futur proche', 'imparfait', 'futur simple', 'conditionnel'],
            complementos: ['le week-end', 'au parc', 'avec ma famille', 'tous les matins', "à l'école", 'en vacances'],
        },
    },
    lengua: {
        preguntas: [
            '¿Cuál es el último libro que has leído y qué te pareció?', 'Cuenta una anécdota divertida que te haya pasado.', 'Si fueras un personaje de cuento, ¿quién serías?',
            'Describe a tu mejor amigo con tres adjetivos.', '¿Qué superpoder elegirías y por qué?', 'Explica cómo se prepara tu comida favorita.',
            '¿Qué harías si encontraras una carta misteriosa?', 'Convence a tu pareja de leer tu libro favorito.', 'Describe tu lugar favorito usando los cinco sentidos.',
            'Inventa el principio de una historia de miedo.', '¿Qué cambiarías de tu ciudad o pueblo?', 'Cuenta lo que hiciste ayer con conectores (primero, después, finalmente).',
        ],
        estructuras: [
            'Una oración con sujeto, verbo y complemento directo', 'Una pregunta y su respuesta', 'Una comparación (más… que / tan… como)',
            'Una oración en pretérito perfecto simple', 'Una oración con un conector (porque, aunque, sin embargo)', 'Una oración en futuro con un adjetivo calificativo',
        ],
        palabras: ['biblioteca', 'dragón', 'paraguas', 'bicicleta', 'cocinar', 'astronauta', 'mariposa', 'tormenta', 'castillo', 'nadar', 'pirata', 'volcán', 'guitarra', 'hospital', 'dormir', 'cohete', 'playa', 'reloj'],
        retos: [
            R('Sinónimo de «rápido»', 'veloz/ligero/raudo'), R('Antónimo de «generoso»', 'tacaño/egoísta'), R('¿Qué clase de palabra es «rápidamente»?', 'adverbio'),
            R('Plural de «lápiz»', 'lápices'), R('¿Lleva tilde «arbol»? Escríbela bien', 'árbol'), R('Sujeto de: «Los niños juegan en el patio»', 'los niños'),
            R('Pretérito perfecto simple de «andar» (yo)', 'anduve'), R('¿Aguda, llana o esdrújula? «música»', 'esdrújula'), R('Aumentativo de «casa»', 'casona/casaza'),
            R('Escribe una palabra con «güe»', 'pingüino/cigüeña/vergüenza/agüero'), R('Figura literaria: «tus ojos son dos luceros»', 'metáfora'), R('Una palabra de la familia de «pan»', 'panadero/panadería/panecillo/empanada'),
        ],
        pistas: ['Es un / una…', 'Sirve para…', 'Lo encuentras en…', 'Es lo contrario de…', 'Rima con…'],
        piezas: {
            sujetos: ['Yo', 'Mi abuela', 'Los piratas', 'Nosotros', 'Un dragón', 'Mi profe'],
            tiempos: ['presente', 'pretérito perfecto simple', 'pretérito imperfecto', 'futuro', 'condicional', 'pretérito perfecto compuesto'],
            complementos: ['en la playa', 'por la noche', 'con mucho cuidado', 'en el castillo', 'durante el recreo', 'sin hacer ruido'],
        },
    },
    mates: {
        preguntas: [
            'Explica cómo calcularías el 15 % de 80.', '¿Dónde usas las fracciones en tu vida diaria?', 'Explica qué es un número primo con un ejemplo.',
            '¿Cómo calcularías el área de tu clase?', 'Inventa un problema que se resuelva con una multiplicación.', '¿Qué es mayor: 3/4 o 0,7? ¿Por qué?',
            'Explica la diferencia entre perímetro y área.', '¿Cómo estimarías cuántas personas caben en el patio?', 'Explica cómo se resuelve 2x + 3 = 11.',
            '¿Qué truco usas para multiplicar mentalmente por 9?', 'Describe un cuadrado sin decir «cuadrado».', '¿Qué probabilidad hay de sacar un 6 en un dado? Explícalo.',
        ],
        estructuras: [
            'Inventa una suma de 3 cifras para tu compañero', 'Di dos fracciones equivalentes y explícalas', 'Explica un problema con «primero…, luego…»',
            'Estima una medida del aula y justifícala', 'Inventa un problema cuyo resultado sea 24', 'Describe una figura geométrica sin nombrarla',
        ],
        palabras: ['triángulo', 'fracción', 'paralelas', 'perímetro', 'círculo', 'multiplicar', 'ángulo recto', 'pirámide', 'división', 'cubo', 'simetría', 'número primo', 'porcentaje', 'diámetro', 'ecuación', 'hexágono', 'media', 'kilómetro'],
        retos: [
            R('7 × 8', '56'), R('25 % de 60', '15'), R('3/4 + 1/4', '1'), R('Raíz cuadrada de 81', '9'), R('Primo siguiente a 13', '17'),
            R('Suma de los ángulos de un triángulo', '180/180°/180 grados'), R('2x + 3 = 11 → x =', '4'), R('Área de un cuadrado de lado 6', '36'),
            R('1,5 horas en minutos', '90'), R('m.c.m. de 4 y 6', '12'), R('(−3) · (−4)', '12'), R('Perímetro de un rectángulo de 5 × 3', '16'),
        ],
        pistas: ['Es una figura / operación que…', 'Se usa para…', 'Tiene… lados / partes', 'Es lo contrario de…', 'Un ejemplo es…'],
    },
    ciencias: {
        preguntas: [
            '¿Por qué es importante reciclar?', 'Explica qué le pasa al agua cuando hierve.', '¿Qué animal te gustaría ser? Habla de su hábitat y alimentación.',
            'Explica cómo se alimentan las plantas.', '¿Qué harías para ahorrar energía en casa?', 'Describe el ciclo del agua con tus palabras.',
            '¿Por qué tenemos estaciones?', 'Explica para qué sirve el corazón.', '¿Qué diferencia hay entre un virus y una bacteria?',
            '¿Cómo funciona un imán?', 'Describe una cadena alimentaria.', '¿Qué invento científico crees que cambió más el mundo?',
        ],
        estructuras: [
            'Describe un ser vivo: es…, tiene…, se alimenta de…', 'Causa y consecuencia: si…, entonces…', 'Compara: …se parece a… porque…',
            'Un proceso: primero…, después…, al final…', 'Una hipótesis: creo que… porque…', 'Un ejemplo de la vida diaria de este fenómeno',
        ],
        palabras: ['fotosíntesis', 'volcán', 'esqueleto', 'imán', 'mariposa', 'planeta', 'célula', 'tornado', 'corazón', 'microscopio', 'evaporación', 'dinosaurio', 'pulmones', 'átomo', 'raíz', 'arcoíris', 'terremoto', 'gravedad'],
        retos: [
            R('Gas que liberan las plantas en la fotosíntesis', 'oxígeno'), R('Planeta más cercano al Sol', 'mercurio'), R('Órgano que bombea la sangre', 'corazón/el corazón'),
            R('Estado del agua a −5 °C', 'sólido/hielo'), R('Fórmula del agua', 'h2o'), R('Animal que solo come plantas', 'herbívoro'),
            R('Hueso más largo del cuerpo', 'fémur/el fémur'), R('Fuerza que nos atrae hacia la Tierra', 'gravedad/la gravedad'), R('Unidad básica de los seres vivos', 'célula/la célula'),
            R('Paso de líquido a gas', 'evaporación/vaporización/ebullición'), R('Capa de gases que rodea la Tierra', 'atmósfera/la atmósfera'), R('¿Cuántas patas tiene un insecto?', '6/seis'),
        ],
        pistas: ['Es un ser vivo / un fenómeno que…', 'Lo encuentras en…', 'Sirve para…', 'Se parece a…', 'Sin él / ella…'],
    },
    sociales: {
        preguntas: [
            '¿Qué época de la historia te gustaría visitar y por qué?', 'Describe tu ciudad o pueblo a alguien que no lo conoce.', '¿Qué país te gustaría conocer y qué sabes de él?',
            'Si fueras alcalde o alcaldesa, ¿qué cambiarías?', 'Explica para qué sirve un mapa.', '¿Qué personaje histórico invitarías a cenar?',
            '¿Cómo era la vida sin electricidad?', '¿Por qué tantas ciudades nacieron junto a un río?', '¿Qué tradición de tu zona te gusta más?',
            'Explica la diferencia entre clima y tiempo atmosférico.', '¿Qué invento de la Prehistoria fue más importante?', '¿Cómo cuidarías el patrimonio de tu localidad?',
        ],
        estructuras: [
            'Sitúa en el tiempo: en el año…, …', 'Localiza: …está al norte / sur / este / oeste de…', 'Compara épocas: antes…, ahora…',
            'Causa y consecuencia: como…, …', 'Describe un paisaje: relieve, clima y vegetación', 'Opina sobre un hecho histórico: pienso que… porque…',
        ],
        palabras: ['pirámide', 'castillo', 'río', 'volcán', 'mapa', 'caballero', 'faraón', 'brújula', 'montaña', 'isla', 'rey', 'desierto', 'romanos', 'vikingo', 'catedral', 'océano', 'momia', 'acueducto'],
        retos: [
            R('Capital de Francia', 'parís'), R('Río más largo de la Península Ibérica', 'tajo/el tajo'), R('Civilización de las pirámides de Guiza', 'egipcia/egipcios/los egipcios'),
            R('Continente de Brasil', 'américa/américa del sur/sudamérica'), R('Año de la llegada de Colón a América', '1492'), R('Océano entre Europa y América', 'atlántico/el atlántico'),
            R('Pico más alto de la Península', 'mulhacén/el mulhacén'), R('Etapa anterior a la escritura', 'prehistoria/la prehistoria'), R('Punto cardinal por donde sale el Sol', 'este'),
            R('Lengua de la antigua Roma', 'latín/el latín'), R('Capital de Italia', 'roma'), R('Cordillera entre España y Francia', 'pirineos/los pirineos'),
        ],
        pistas: ['Es un lugar / un personaje que…', 'Está en…', 'Lo usaban para…', 'Pertenece a la época de…', 'Se parece a…'],
    },
    propio: { preguntas: [], estructuras: [], palabras: [], retos: [], pistas: ['Es un / una…', 'Sirve para…', 'Se parece a…'] },
};

// ─────────────────────────── Dinámicas ───────────────────────────
export const AGRUPAMIENTOS = {
    parejas: { nombre: 'Parejas que cambian', emoji: '👫' },
    filas: { nombre: 'Dos filas enfrentadas', emoji: '↔️' },
    equipos: { nombre: 'Equipos', emoji: '👥' },
    grupos: { nombre: 'Grupos pequeños (3-4)', emoji: '🎲' },
};

export const DINAMICAS = [
    {
        id: 'piedra', nombre: 'Piedra, papel o tijera por niveles', original: 'Rock, Scissors, Paper', emoji: '✊', color: '#f97316',
        agrupamiento: 'parejas', minutos: 10, banco: 'preguntas',
        resumen: 'Todos empiezan siendo un huevo 🥚. Las parejas dialogan con la pregunta de su nivel y después juegan a piedra, papel o tijera: quien gana evoluciona y busca a alguien de su nuevo nivel; quien pierde busca otra pareja de su mismo nivel.',
        material: ['Espacio para moverse (patio o mesas apartadas)', 'La PDI con el proyector de PiKT', 'Opcional: la ficha de niveles para cada alumno'],
        preparacion: ['Elige la materia y revisa las preguntas de cada nivel.', 'Explica los cinco niveles con sus gestos: 🥚 agachado, 🐣 de cuclillas, 🐔 aleteando, 🦖 garras, 🐉 ¡campeón!', 'Decide si quien pierde baja un nivel o solo busca otra pareja.'],
        pasos: ['Todos se mueven por el aula haciendo el gesto de su nivel.', 'Se busca a alguien del MISMO nivel y se saluda.', 'Hacen y responden la pregunta de su nivel que aparece en la pantalla.', 'Juegan a piedra, papel o tijera.', 'Quien gana sube un nivel; quien pierde busca otra pareja.', 'Al llegar a 🐉 se sientan y ayudan al profe a vigilar que se hable en la lengua meta.'],
        reglasAlumno: ['Busca a alguien de tu mismo nivel.', 'Primero se habla: pregunta y responde la frase de tu nivel.', 'Después: ¡piedra, papel o tijera!', 'Si ganas, subes de nivel. Si pierdes, busca otra pareja.'],
        consejos: ['Niveles más altos = preguntas más difíciles: así los rápidos se esfuerzan más.', 'Si se atascan en un nivel, pulsa «Nuevas preguntas».', 'Pide que respondan con frases completas antes de jugar.'],
        variantes: {
            idiomas: 'Cada nivel trabaja una estructura (presente → pasado → futuro → condicional). Antes de jugar deben hacer la pregunta y responder con frase completa.',
            mates: 'Cada nivel es un cálculo mental de más dificultad: se lo plantean el uno al otro y solo juegan si ambos aciertan.',
            otras: 'Preguntas de repaso del tema; en el nivel 🦖 deben explicar «por qué».',
        },
        evaluacion: ['Usa la lengua meta / el vocabulario del tema', 'Responde con frase completa', 'Respeta el turno y las reglas', 'Ayuda cuando llega a campeón'],
        ajustes: [{ k: 'minutos', label: 'Minutos de juego', def: 8, min: 2, max: 30 }],
        hoja: 'escalera',
    },
    {
        id: 'baile', nombre: 'Baila, para y habla', original: 'Dance, Stop, Speak', emoji: '💃', color: '#ec4899',
        agrupamiento: 'parejas', minutos: 12, banco: 'preguntas',
        resumen: 'Suena la música y todos bailan por el aula. Cuando se para, cada uno busca a la persona más cercana y practica la pregunta o estructura que aparece en la PDI hasta que vuelve la música.',
        material: ['Altavoz (música de PiKT, una canción de YouTube o la tuya)', 'Espacio despejado', 'Opcional: ficha de registro «¿Con quién hablé?»'],
        preparacion: ['Elige las preguntas o estructuras de la sesión.', 'Ajusta cuánto dura la música (al azar) y cuánto el turno de hablar.', 'Pacta una señal de silencio para cuando para la música.'],
        pasos: ['Pulsa «¡Música!». Todos bailan o caminan al ritmo.', 'PiKT para la música en un momento al azar y suena la alarma.', 'Cada uno busca pareja (nunca la misma dos veces).', 'Leen la pregunta en la pantalla y hablan los dos por turnos.', 'Cuando acaba el tiempo vuelve la música automáticamente.'],
        reglasAlumno: ['Cuando suena la música: ¡baila!', 'Cuando para: busca a alguien nuevo.', 'Pregunta y responde lo que dice la pantalla.', 'Apunta con quién has hablado.'],
        consejos: ['Elige «Canción de YouTube» y pega el enlace: PiKT la pone y la para sola. Con Spotify u otra música, elige «Mi música» y PiKT te avisa cuándo pararla.', 'Ve subiendo la dificultad de las preguntas en cada ronda.', 'Pide que al final cuenten algo que les dijo su pareja.'],
        variantes: {
            idiomas: 'Una estructura por ronda (I like… / Do you like…?). La pareja debe responder con la estructura completa.',
            mates: 'Al parar, la PDI muestra un cálculo: el primero que lo resuelva se lo explica al otro.',
            otras: 'Cada parada es una pregunta de repaso o de opinión sobre el tema.',
        },
        evaluacion: ['Cambia de pareja cada ronda', 'Usa la estructura propuesta', 'Escucha y responde a su pareja', 'Cuenta lo que le dijeron'],
        ajustes: [
            { k: 'bailarMin', label: 'Música mínima (s)', def: 10, min: 5, max: 60 },
            { k: 'bailarMax', label: 'Música máxima (s)', def: 25, min: 6, max: 90 },
            { k: 'hablar', label: 'Tiempo de hablar (s)', def: 40, min: 10, max: 180 },
            { k: 'rondas', label: 'Rondas', def: 6, min: 1, max: 20 },
        ],
        hoja: 'registro',
    },
    {
        id: 'semaforo', nombre: 'Luz roja, luz verde', original: 'Red Light, Green Light', emoji: '🚦', color: '#22c55e',
        agrupamiento: 'equipos', minutos: 15, banco: 'retos',
        resumen: 'Una carrera por equipos con semáforo. En luz verde aparece un reto y los equipos lo resuelven en su mini-pizarra; en luz roja se congelan y se corrige: quien acierta avanza una casilla y quien falla vuelve a la salida (o retrocede una).',
        material: ['Una mini-pizarra o folio por equipo', 'La PDI con la pista de carreras', 'Ficha de equipo para anotar respuestas'],
        preparacion: ['Forma los equipos y elige cuántas casillas tiene la pista.', 'Decide el castigo: volver a la salida o retroceder una.', 'Revisa los retos y sus soluciones.'],
        pasos: ['Pulsa «Luz verde»: aparece el reto y corre el tiempo.', 'Cada equipo escribe su respuesta y la levanta.', 'Al acabar el tiempo: ¡luz roja! Nadie escribe más.', 'Muestra la solución y marca ✔ o ✘ a cada equipo.', 'Gana el primer equipo que llega a la meta 🏁.'],
        reglasAlumno: ['En verde: pensad y escribid en equipo.', 'En rojo: ¡quietos! Levantad la pizarra.', 'Si acertáis, avanzáis. Si falláis, retrocedéis.', 'Todos los del equipo deben saber explicar la respuesta.'],
        consejos: ['Pregunta al azar a un miembro del equipo para que explique: así todos participan.', 'Si la clase es grande, que cada equipo tenga un «portavoz» rotatorio.', 'Para Primaria, mejor retroceder una casilla que volver al inicio.'],
        variantes: {
            idiomas: 'Retos de gramática y vocabulario: traducir, conjugar, corregir errores.',
            mates: 'Cálculo mental o problemas cortos con respuesta numérica.',
            otras: 'Preguntas de repaso con respuesta corta.',
        },
        evaluacion: ['Trabaja en equipo', 'Respeta la luz roja', 'Sabe explicar la respuesta', 'Acepta el resultado'],
        ajustes: [
            { k: 'casillas', label: 'Casillas hasta la meta', def: 6, min: 3, max: 12 },
            { k: 'segundos', label: 'Segundos por reto', def: 30, min: 10, max: 180 },
            { k: 'castigo', label: 'Si fallan…', def: 'inicio', opciones: [['inicio', 'vuelven a la salida'], ['uno', 'retroceden una'], ['nada', 'se quedan donde están']] },
        ],
        hoja: 'pista',
    },
    {
        id: 'citas', nombre: 'Citas rápidas de repaso', original: 'Speed Dating', emoji: '⏱️', color: '#ef4444',
        agrupamiento: 'filas', minutos: 15, banco: 'preguntas',
        resumen: 'Dos filas enfrentadas. Cada pareja conversa o se hace preguntas durante el tiempo marcado. Al sonar el pitido, la fila B se mueve un puesto y empieza una nueva «cita» con otra pregunta.',
        material: ['Sillas o mesas en dos filas enfrentadas', 'La PDI con la barra de tiempo', 'Opcional: tarjetas de preguntas recortables'],
        preparacion: ['Coloca dos filas enfrentadas (A fija, B rota).', 'Si cargas la lista de clase, PiKT dice quién se sienta con quién en cada ronda.', 'Ajusta el tiempo de cada cita y el de cambio.'],
        pasos: ['Pulsa «Empezar»: aparece la pregunta de la ronda.', 'Las parejas conversan; primero habla la fila A y luego la B.', 'Pitido de aviso cuando quedan 10 segundos.', '¡A rotar! La fila B se mueve un puesto a la derecha (el último pasa al principio).', 'Nueva ronda, nueva pregunta.'],
        reglasAlumno: ['Fila A: te quedas en tu sitio.', 'Fila B: al oír el pitido, te mueves un puesto a la derecha.', 'Pregunta, escucha y responde.', 'Apunta una cosa que te ha contado cada compañero.'],
        consejos: ['Con número impar, una silla vacía hace de «descanso» o participas tú.', 'Que la fila A y B se alternen el turno de empezar.', 'Al final, puesta en común: «Mi pareja me dijo que…».'],
        variantes: {
            idiomas: 'Conversación guiada con preguntas reales: practicar fluidez y estilo indirecto al final.',
            mates: 'Cada uno lleva una tarjeta con un problema; lo resuelven juntos y se intercambian la tarjeta al rotar.',
            otras: 'Repaso antes de examen: preguntas del tema que se hacen el uno al otro.',
        },
        evaluacion: ['Mantiene la conversación todo el tiempo', 'Formula preguntas correctas', 'Escucha activamente', 'Rota con orden'],
        ajustes: [
            { k: 'ronda', label: 'Segundos por cita', def: 90, min: 20, max: 300 },
            { k: 'cambio', label: 'Segundos para rotar', def: 12, min: 5, max: 60 },
            { k: 'rondas', label: 'Rondas', def: 8, min: 1, max: 30 },
        ],
        hoja: 'citas',
    },
    {
        id: 'mimica', nombre: 'Mímica y frase', original: 'Mimic', emoji: '🎭', color: '#8b5cf6',
        agrupamiento: 'equipos', minutos: 15, banco: 'palabras',
        resumen: 'El equipo lanza el dado para saber cuántos puntos se juega, roba una carta y uno representa la palabra con mímica. Si su equipo la adivina, entre todos construyen una frase correcta con esa palabra para ganar los puntos dobles.',
        material: ['Las tarjetas recortables (o la PDI)', 'Opcional: un dado de verdad', 'Ficha de equipo para escribir las frases'],
        preparacion: ['Imprime y recorta las tarjetas o usa «mantener pulsado para ver» en la PDI.', 'Forma los equipos y decide el orden de los mimos.'],
        pasos: ['El equipo lanza el dado: 1-2 = 1 punto, 3-4 = 2 puntos, 5-6 = 3 puntos.', 'El mimo mira la carta sin que la vea nadie más.', 'Mímica sin hablar ni señalar objetos hasta que acabe el tiempo.', 'Si su equipo acierta: tienen el tiempo de frase para construir una oración con esa palabra.', 'Frase correcta = puntos dobles. Cambia el turno.'],
        reglasAlumno: ['El mimo no puede hablar ni hacer sonidos.', 'Solo adivina tu equipo.', 'Después, construid una frase con la palabra.', 'Frase correcta = ¡puntos dobles!'],
        consejos: ['Puedes pedir la frase con la estructura que estáis trabajando.', 'Si un equipo falla, otro puede «robar» la palabra con una frase.', 'Con micro:bit también se puede lanzar el dado agitándola.'],
        variantes: {
            idiomas: 'Verbos y vocabulario del tema; la frase en el tiempo verbal de la unidad.',
            mates: 'Conceptos (paralelas, simetría, multiplicar…); la frase debe ser una definición o un ejemplo.',
            otras: 'Conceptos del tema; la frase explica qué es.',
        },
        evaluacion: ['Representa sin hablar', 'Construye una frase correcta', 'Usa el vocabulario del tema', 'Coopera con su equipo'],
        ajustes: [
            { k: 'mimo', label: 'Segundos de mímica', def: 60, min: 15, max: 180 },
            { k: 'frase', label: 'Segundos para la frase', def: 45, min: 15, max: 180 },
        ],
        hoja: 'frases',
    },
    {
        id: 'kaboom', nombre: 'Kaboom', original: 'Kaboom', emoji: '💣', color: '#f59e0b',
        agrupamiento: 'equipos', minutos: 15, banco: 'retos',
        resumen: 'Un bote de palitos con retos o palabras para construir frases. Por turnos, cada equipo roba un palito: si lo resuelve, se lo queda; si falla, lo devuelve. Pero cuidado: si sale «KABOOM», ¡el equipo pierde todos sus palitos!',
        material: ['Un bote con palitos (o los palitos recortables) o la PDI', 'Ficha de equipo para contar palitos'],
        preparacion: ['Decide cuántos «KABOOM» hay en el bote.', 'Revisa los retos o palabras de los palitos.', 'Forma los equipos y el orden de turnos.'],
        pasos: ['El equipo roba un palito.', 'Si es un reto: tiene el tiempo marcado para resolverlo o construir la frase.', 'Correcto: se queda el palito. Incorrecto: vuelve al bote.', '¡KABOOM!: pierde todos sus palitos (vuelven al bote).', 'Gana quien tenga más palitos al acabar el tiempo o el bote.'],
        reglasAlumno: ['Robad un palito por turno.', 'Resolvedlo bien para quedároslo.', 'Si sale KABOOM… ¡perdéis todos!', 'Gana el equipo con más palitos.'],
        consejos: ['Más KABOOM = más emoción, pero menos aprendizaje: 3-4 suele ir bien.', 'Puedes añadir palitos «x2» con tus propias reglas.', 'En Infantil y Primaria: palabras para leer en vez de frases.'],
        variantes: {
            idiomas: 'Cada palito tiene una palabra: hay que decir una frase correcta con ella o traducirla.',
            mates: 'Cada palito tiene un cálculo; el equipo tiene que resolverlo sin calculadora.',
            otras: 'Preguntas de repaso del tema.',
        },
        evaluacion: ['Resuelve el reto correctamente', 'Construye frases completas', 'Gestiona la frustración del KABOOM', 'Respeta el turno'],
        ajustes: [
            { k: 'kabooms', label: 'Palitos KABOOM', def: 4, min: 1, max: 10 },
            { k: 'segundos', label: 'Segundos por palito', def: 30, min: 10, max: 120 },
        ],
        hoja: 'palitos',
    },
    {
        id: 'sobres', nombre: 'Reto de los 10 sobres', original: '10 Envelopes Challenge', emoji: '✉️', color: '#0ea5e9',
        agrupamiento: 'equipos', minutos: 25, banco: 'retos',
        resumen: 'Cada equipo tiene 10 sobres cerrados con retos cada vez más difíciles. Solo pueden abrir el siguiente sobre cuando el profe (o la PDI) da por buena la respuesta del anterior. ¡Gana el primero en abrir los 10!',
        material: ['10 sobres por equipo con los retos recortables (o solo la PDI)', 'Hoja de respuestas del equipo', 'Opcional: sellos o pegatinas'],
        preparacion: ['Imprime las tarjetas de sobres: una tira por equipo.', 'Mete cada reto en su sobre numerado (del 1 al 10).', 'Ordena los retos de más fácil a más difícil.'],
        pasos: ['Cada equipo abre el sobre 1 y resuelve el reto en su hoja.', 'Lleva la respuesta al profe o la escribe en la PDI.', 'Si es correcta, puede abrir el siguiente sobre.', 'Si no, vuelve a intentarlo (puedes dar una pista).', 'Gana quien abra los 10 sobres; el resto sigue hasta que acabe el tiempo.'],
        reglasAlumno: ['Abrid los sobres en orden.', 'Escribid la respuesta en vuestra hoja.', 'Solo con la respuesta correcta se abre el siguiente.', 'Todos deben entender cada reto.'],
        consejos: ['Pide que lleve la respuesta un miembro distinto cada vez.', 'Los últimos sobres pueden ser retos creativos (crear una frase, dibujar…).', 'Proyecta el tablero para ver la carrera en directo.'],
        variantes: {
            idiomas: 'Retos de gramática, vocabulario, comprensión de una frase y, al final, escribir un mini texto.',
            mates: 'Una cadena de problemas: el resultado de uno puede ser el dato del siguiente.',
            otras: 'Escape room lineal del tema: cada sobre, una pista.',
        },
        evaluacion: ['Resuelve los retos en equipo', 'Todos participan en las respuestas', 'Persevera ante el error', 'Escribe con orden en su hoja'],
        ajustes: [{ k: 'minutos', label: 'Minutos de juego', def: 25, min: 5, max: 60 }],
        hoja: 'sobres',
    },
    {
        id: 'silla', nombre: 'La silla caliente', original: 'Hot Seat', emoji: '🔥', color: '#dc2626',
        agrupamiento: 'equipos', minutos: 12, banco: 'palabras',
        resumen: 'Un alumno se sienta de espaldas a la PDI. Su equipo ve la palabra en gigante y le da pistas usando las estructuras trabajadas, sin decir la palabra. ¿Cuántas acierta antes de que se acabe el tiempo?',
        material: ['Una silla de espaldas a la PDI', 'La PDI con la palabra en grande', 'Ficha de equipo con las estructuras para dar pistas'],
        preparacion: ['Coloca «la silla caliente» de espaldas a la pantalla.', 'Revisa las palabras y las estructuras de pista.', 'Forma los equipos y el orden de quién se sienta.'],
        pasos: ['Un miembro del equipo se sienta en la silla.', 'Pulsa «Empezar»: aparece la palabra y corre el tiempo.', 'El equipo da pistas con las estructuras (prohibido decir la palabra o traducirla).', 'Acierto = punto y nueva palabra. Se puede pasar.', 'Al acabar el tiempo, turno del siguiente equipo.'],
        reglasAlumno: ['Quien está en la silla no mira la pantalla.', 'Dad pistas sin decir la palabra.', 'Usad las estructuras de la ficha.', 'Un punto por palabra acertada.'],
        consejos: ['Exige frases completas: «It\'s a thing you use to…».', 'Si gritan todos a la vez, pide pistas por turno.', 'Variante: el de la silla hace preguntas de sí / no.'],
        variantes: {
            idiomas: 'Vocabulario del tema con estructuras de definición (It\'s a…, You use it to…).',
            mates: 'Conceptos matemáticos: hay que definirlos sin decir el nombre.',
            otras: 'Personajes, lugares o conceptos del tema.',
        },
        evaluacion: ['Da pistas con frases completas', 'Usa las estructuras trabajadas', 'No dice la palabra', 'Escucha a sus compañeros'],
        ajustes: [{ k: 'turno', label: 'Segundos por turno', def: 60, min: 15, max: 240 }],
        hoja: 'pistas',
    },
    {
        id: 'dado', nombre: 'Lanza y habla', original: 'Roll & Speak', emoji: '🎲', color: '#14b8a6',
        agrupamiento: 'grupos', minutos: 12, banco: 'estructuras',
        resumen: 'Se lanza el dado y el número marca la estructura o el tipo de reto que hay que decir. Opcional: la ruleta de frase sortea un sujeto, un tiempo verbal y un complemento para construir la oración.',
        material: ['Un dado por grupo (o el de la PDI)', 'La ficha con la tabla del dado', 'Opcional: cuaderno para escribir las frases'],
        preparacion: ['Revisa las seis estructuras (una por número).', 'Forma grupos de 3 o 4.', 'Decide si se juega toda la clase con la PDI o cada grupo con su dado.'],
        pasos: ['Un alumno lanza el dado.', 'Mira en la tabla qué estructura le toca.', 'Dice (o escribe) su frase antes de que acabe el tiempo.', 'El grupo comprueba si es correcta: si sí, gana un punto.', 'Turno del siguiente.'],
        reglasAlumno: ['Lanza el dado.', 'Busca tu número en la tabla.', 'Di una frase con esa estructura.', 'Si es correcta, ¡punto para ti!'],
        consejos: ['La ruleta de frase obliga a combinar sujeto + tiempo + complemento: muy útil en idiomas.', 'Pide que escriban la mejor frase de cada ronda.', 'Si sale un número repetido, la frase debe ser distinta a las anteriores.'],
        variantes: {
            idiomas: 'Cada número, un tiempo verbal o una función comunicativa.',
            mates: 'Cada número, un tipo de reto (estimar, inventar un problema, explicar…).',
            otras: 'Cada número, una forma de explicar el tema (definir, comparar, dar un ejemplo…).',
        },
        evaluacion: ['Usa la estructura que le toca', 'Construye frases correctas', 'Corrige con respeto a sus compañeros', 'Amplía sus frases'],
        ajustes: [{ k: 'hablar', label: 'Segundos para decir la frase', def: 30, min: 10, max: 120 }],
        hoja: 'dado',
    },
    {
        id: 'tablero', nombre: 'Tablero sorpresa', original: 'Baamboozle', emoji: '🎁', color: '#6366f1',
        agrupamiento: 'equipos', minutos: 20, banco: 'retos',
        resumen: 'Un tablero de casillas numeradas. Por turnos, cada equipo elige una casilla y resuelve el reto (corregir un error, completar una frase…). Si acierta gana sus puntos… y algunas casillas esconden sorpresas: doble, robar, intercambiar o ¡bomba!',
        material: ['La PDI con el tablero', 'Ficha de equipo con el marcador'],
        preparacion: ['Revisa los retos y decide cuántas casillas y sorpresas habrá.', 'Forma los equipos.', 'Explica las sorpresas antes de empezar.'],
        pasos: ['El equipo elige un número del tablero.', 'Aparece el reto y corre el tiempo.', 'Muestra la solución: ✔ suma los puntos de la casilla; ✘ no suma.', 'Si acertaron y la casilla tiene sorpresa, se aplica.', 'Turno del siguiente equipo. Gana quien más puntos tenga.'],
        reglasAlumno: ['Elegid una casilla en vuestro turno.', 'Resolved el reto en equipo antes de que acabe el tiempo.', 'Si acertáis: ¡puntos y quizá sorpresa!', 'La bomba os deja a cero… ¡ánimo!'],
        consejos: ['Las sorpresas igualan la partida: los equipos que van detrás no se desconectan.', 'Si un equipo falla, puedes dar rebote al siguiente por la mitad de puntos.', 'Usa retos de «corregir el error» para trabajar errores frecuentes.'],
        variantes: {
            idiomas: 'Corregir errores, completar huecos, traducir o decir sinónimos.',
            mates: 'Cálculos y problemas cortos; las casillas altas valen más.',
            otras: 'Repaso del tema con preguntas de respuesta corta.',
        },
        evaluacion: ['Resuelve el reto en equipo', 'Justifica la respuesta', 'Acepta las sorpresas con deportividad', 'Respeta el turno'],
        ajustes: [
            { k: 'casillas', label: 'Casillas', def: 16, min: 6, max: 24 },
            { k: 'sorpresas', label: 'Casillas con sorpresa', def: 5, min: 0, max: 12 },
            { k: 'segundos', label: 'Segundos por reto', def: 30, min: 10, max: 180 },
        ],
        hoja: 'marcador',
    },
];

export const SORPRESAS = {
    doble: { nombre: '¡Doble!', emoji: '✨', texto: 'Duplicáis vuestros puntos.' },
    robar: { nombre: 'Robo', emoji: '🦝', texto: 'Robad 10 puntos al equipo que elijáis.' },
    regalo: { nombre: 'Regalo', emoji: '🎀', texto: 'Regalad 10 puntos a otro equipo.' },
    cambio: { nombre: 'Intercambio', emoji: '🔄', texto: 'Intercambiad vuestros puntos con otro equipo.' },
    estrella: { nombre: 'Estrella', emoji: '⭐', texto: '¡20 puntos extra!' },
    bomba: { nombre: '¡Bomba!', emoji: '💣', texto: 'Os quedáis a cero puntos.' },
};

// ─────────────────────────── Utilidades ───────────────────────────
export const barajar = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
};

export const normalizar = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’`´]/g, "'").replace(/[.,;:!¡?¿"«»()]/g, '').replace(/\s+/g, ' ').trim();

export const respuestaCorrecta = (dada, solucion) => {
    const d = normalizar(dada);
    if (!d) return false;
    return String(solucion || '').split('/').some(s => normalizar(s) === d);
};

// Texto ⇄ banco para el editor de contenido.
// En los retos, una línea «# Nombre» abre una categoría (columnas del Tablero sorpresa, como en Money Board).
export const bancoATexto = (tipo, items) => {
    let cat = null; const out = [];
    (items || []).forEach(x => {
        if (tipo === 'retos' && x.c && x.c !== cat) { cat = x.c; out.push(`# ${cat}`); }
        out.push(tipo === 'retos' ? `${x.p} | ${x.r}` : x);
    });
    return out.join('\n');
};
export const textoABanco = (tipo, texto) => {
    let cat = null; const out = [];
    String(texto || '').split('\n').map(s => s.trim()).filter(Boolean).forEach(l => {
        if (l.startsWith('#')) { cat = l.replace(/^#+/, '').trim() || null; return; }
        if (tipo !== 'retos') { out.push(l); return; }
        const i = l.indexOf('|');
        const x = i < 0 ? { p: l, r: '' } : { p: l.slice(0, i).trim(), r: l.slice(i + 1).trim() };
        if (cat) x.c = cat;
        out.push(x);
    });
    return out;
};

// Preguntas de un recurso de PiKT (Money Board o cualquier otro) → texto del editor.
// cats = categoriasDeRecurso(recurso): [{ nombre, preguntas: [{ tipo, enunciado, correcta, opciones?, bloques? }] }]
export function recursoATexto(tipo, cats) {
    const limpio = (t) => String(t || '').replace(/[|\n]/g, ' / ').replace(/\s+/g, ' ').trim();
    const reto = (q) => {
        if (q.tipo === 'RELLENAR') return { p: `${q.enunciado}: ${q.bloques[0]} ___ ${q.bloques[2]}`, r: q.correcta };
        if (q.tipo === 'ORDENAR') return { p: `${q.enunciado}: ${barajar(q.bloques).join(' · ')}`, r: q.correcta };
        if (q.tipo === 'MULTIPLE' && q.opciones?.length) return { p: `${q.enunciado} (${q.opciones.join(' · ')})`, r: q.correcta };
        return { p: q.enunciado, r: q.correcta };
    };
    const lineas = [];
    cats.forEach(c => {
        if (tipo === 'retos' && cats.length > 1) lineas.push(`# ${limpio(c.nombre)}`);
        c.preguntas.forEach(q => {
            if (tipo === 'retos') { const x = reto(q); lineas.push(`${limpio(x.p)} | ${limpio(x.r)}`); }
            else if (tipo === 'palabras') lineas.push(limpio(q.correcta));
            else lineas.push(limpio(q.enunciado));
        });
    });
    return lineas.join('\n');
}

// Contenido propio guardado en el dispositivo: { 'kaboom:ingles': 'texto…' }
const LS_CONTENIDO = 'da_contenido_v1';
export const leerPropios = () => { try { return JSON.parse(localStorage.getItem(LS_CONTENIDO)) || {}; } catch { return {}; } };
export const guardarPropio = (clave, texto) => {
    const p = leerPropios();
    if (texto == null) delete p[clave]; else p[clave] = texto;
    try { localStorage.setItem(LS_CONTENIDO, JSON.stringify(p)); } catch { /* sin almacenamiento */ }
};

export function contenidoDe(din, materia) {
    const propio = leerPropios()[`${din.id}:${materia}`];
    if (propio != null) return textoABanco(din.banco, propio);
    return BANCOS[materia]?.[din.banco] || [];
}

export const dinamicaDe = (id) => DINAMICAS.find(d => d.id === id);
export const materiaDe = (id) => MATERIAS.find(m => m.id === id) || MATERIAS[0];
export const ajustesPorDefecto = (din) => Object.fromEntries((din.ajustes || []).map(a => [a.k, a.def]));

// Texto visible de un elemento del banco (los retos llevan solución aparte)
export const textoItem = (x) => (typeof x === 'string' ? x : x?.p || '');
