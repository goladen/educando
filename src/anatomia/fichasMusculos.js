// Fichas de los músculos principales para el visor 3D (nivel Primaria / ESO).
// Clave = id del músculo (campo `en` de public/anatomia/musculos.json, ver
// scripts/anatomia/musculos_seleccion.json). Cada ficha: { que, funcion, curiosidad }.
// Conviene que la revise un profesor de Biología o de Educación Física.

export const FICHAS_MUSCULOS = {
    frontal: {
        que: 'Músculo plano y fino de la frente.',
        funcion: 'Levanta las cejas y arruga la frente.',
        curiosidad: 'Es el que usas para poner cara de sorpresa. Está unido al occipital por una lámina de tendón que cubre la cabeza.',
    },
    occipital: {
        que: 'Músculo plano en la parte de atrás de la cabeza.',
        funcion: 'Tira del cuero cabelludo hacia atrás y trabaja junto al frontal.',
        curiosidad: 'Hay personas que, moviendo el frontal y el occipital, consiguen mover el pelo o las orejas.',
    },
    temporal: {
        que: 'Músculo en forma de abanico en la sien, a cada lado de la cabeza.',
        funcion: 'Sube la mandíbula para cerrar la boca y masticar.',
        curiosidad: 'Ponte los dedos en la sien y aprieta los dientes: notarás cómo se hincha.',
    },
    masetero: {
        que: 'Músculo grueso en la parte de atrás de la mejilla, sobre la mandíbula.',
        funcion: 'Sube la mandíbula con mucha fuerza para morder y masticar.',
        curiosidad: 'Para su tamaño, es uno de los músculos más fuertes del cuerpo.',
    },
    orbicular_ojo: {
        que: 'Músculo en forma de anillo alrededor de cada ojo.',
        funcion: 'Cierra los párpados: parpadear, guiñar o apretar los ojos.',
        curiosidad: 'Parpadeamos unas 15-20 veces por minuto. En una sonrisa sincera también se contrae: por eso «sonríen los ojos».',
    },
    orbicular_boca: {
        que: 'Músculo en forma de anillo alrededor de los labios.',
        funcion: 'Cierra y frunce los labios: hablar, silbar, soplar o dar un beso.',
        curiosidad: 'Se le llama el «músculo del beso».',
    },
    cigomatico: {
        que: 'Músculo que va del pómulo a la comisura de los labios.',
        funcion: 'Tira de la comisura hacia arriba y hacia fuera: es el músculo de la sonrisa.',
        curiosidad: 'Sonreír pone en marcha más de una docena de músculos de la cara, pero el cigomático mayor es el principal.',
    },
    buccinador: {
        que: 'Músculo plano en el interior de la mejilla.',
        funcion: 'Aprieta la mejilla contra los dientes: ayuda a masticar y a soplar.',
        curiosidad: 'Su nombre viene del latín «buccinator», trompetista: es el que hincha y vacía las mejillas al tocar la trompeta.',
    },
    esternocleidomastoideo: {
        que: 'Músculo largo a cada lado del cuello, desde detrás de la oreja hasta el esternón y la clavícula.',
        funcion: 'Gira e inclina la cabeza y la baja hacia el pecho.',
        curiosidad: 'Su nombre largo dice dónde se sujeta: esterno (esternón), cleido (clavícula) y mastoideo (detrás de la oreja).',
    },
    trapecio: {
        que: 'Músculo grande y plano de la parte alta de la espalda y la nuca.',
        funcion: 'Sube los hombros (como al encogerlos), lleva los omóplatos hacia atrás y sostiene la cabeza.',
        curiosidad: 'Los dos trapecios juntos tienen forma de trapecio o de rombo, y de ahí su nombre.',
    },
    dorsal_ancho: {
        que: 'Músculo muy ancho y plano que cubre la parte media y baja de la espalda.',
        funcion: 'Baja el brazo y lo lleva hacia atrás: trepar, nadar, remar o hacer dominadas.',
        curiosidad: 'Es el músculo más ancho del cuerpo. Los nadadores lo tienen muy desarrollado (espalda en forma de V).',
    },
    romboides: {
        que: 'Músculo con forma de rombo entre la columna y el omóplato, debajo del trapecio.',
        funcion: 'Junta los omóplatos hacia la columna y ayuda a mantener la espalda recta.',
        curiosidad: 'Pasar muchas horas encorvado ante una pantalla lo estira y lo debilita.',
    },
    pectoral_mayor: {
        que: 'Músculo grande en forma de abanico en la parte delantera del pecho.',
        funcion: 'Lleva el brazo hacia delante y hacia dentro: abrazar, empujar o hacer flexiones.',
        curiosidad: 'Tiene varias porciones (clavicular, esternal y abdominal) que trabajan juntas.',
    },
    serrato_anterior: {
        que: 'Músculo en el lateral de las costillas, con forma de dientes de sierra.',
        funcion: 'Lleva el omóplato hacia delante y lo mantiene pegado a las costillas.',
        curiosidad: 'Se le llama el «músculo del boxeador» porque trabaja al dar un puñetazo.',
    },
    intercostales: {
        que: 'Pequeños músculos que unen cada costilla con la siguiente.',
        funcion: 'Levantan las costillas para que entre aire en los pulmones (inspiración).',
        curiosidad: 'Hay tres capas de intercostales (externos, internos e íntimos); aquí se ven los externos.',
    },
    diafragma: {
        que: 'Músculo en forma de cúpula que separa el tórax del abdomen.',
        funcion: 'Es el músculo principal de la respiración: al contraerse baja, el tórax se agranda y entra el aire.',
        curiosidad: 'El hipo son contracciones involuntarias del diafragma. Funciona sin descanso, incluso dormidos.',
    },
    recto_abdominal: {
        que: 'Músculo largo y plano en el centro del abdomen, desde las costillas hasta el pubis.',
        funcion: 'Dobla el tronco hacia delante (como en los abdominales) y protege los órganos del abdomen.',
        curiosidad: 'La «tableta de chocolate» aparece porque unas bandas de tendón lo cruzan y lo dividen en cuadros.',
    },
    oblicuo_externo: {
        que: 'Músculo ancho en los laterales del abdomen, con fibras en diagonal.',
        funcion: 'Gira e inclina el tronco y ayuda a toser y a soplar con fuerza.',
        curiosidad: 'Sus fibras van en la misma dirección que meter las manos en los bolsillos delanteros.',
    },
    deltoides: {
        que: 'Músculo grueso y redondeado que cubre el hombro.',
        funcion: 'Levanta el brazo hacia los lados, hacia delante y hacia atrás.',
        curiosidad: 'Tiene forma de triángulo, como la letra griega delta (Δ). Es donde se suelen poner las vacunas.',
    },
    supraespinoso: {
        que: 'Músculo pequeño encima del omóplato, por debajo del trapecio.',
        funcion: 'Empieza el movimiento de levantar el brazo hacia el lado y estabiliza el hombro.',
        curiosidad: 'Forma parte del «manguito rotador», un grupo de músculos que sujetan el hombro. Es el que más se lesiona.',
    },
    infraespinoso: {
        que: 'Músculo plano que cubre la parte de atrás del omóplato.',
        funcion: 'Gira el brazo hacia fuera y ayuda a sujetar el hombro.',
        curiosidad: 'También es del manguito rotador. Trabaja mucho al lanzar una pelota.',
    },
    redondo_mayor: {
        que: 'Músculo grueso entre el borde del omóplato y el húmero.',
        funcion: 'Baja el brazo y lo gira hacia dentro.',
        curiosidad: 'Se le llama el «ayudante del dorsal ancho» porque hacen el mismo movimiento.',
    },
    biceps_braquial: {
        que: 'Músculo de la parte delantera del brazo, con dos cabezas (larga y corta).',
        funcion: 'Dobla el codo y gira el antebrazo para poner la palma hacia arriba.',
        curiosidad: '«Bíceps» significa «dos cabezas». Es el músculo que se enseña al «sacar bola».',
    },
    braquial: {
        que: 'Músculo del brazo situado debajo del bíceps.',
        funcion: 'Dobla el codo: es el que más fuerza hace en ese movimiento.',
        curiosidad: 'Aunque no se ve, trabaja más que el bíceps al doblar el codo.',
    },
    triceps_braquial: {
        que: 'Músculo de la parte de atrás del brazo, con tres cabezas.',
        funcion: 'Estira el codo: empujar, lanzar o hacer flexiones.',
        curiosidad: 'Es más grande que el bíceps: ocupa casi dos tercios del brazo.',
    },
    braquiorradial: {
        que: 'Músculo largo del antebrazo, en el lado del pulgar.',
        funcion: 'Dobla el codo, sobre todo con el pulgar hacia arriba (como al sujetar un martillo).',
        curiosidad: 'Es el bulto que se forma en el antebrazo, cerca del codo, al levantar una taza.',
    },
    flexores_antebrazo: {
        que: 'Grupo de músculos en la cara interna del antebrazo (la de la palma).',
        funcion: 'Doblan la muñeca y los dedos: agarrar, cerrar el puño o escribir.',
        curiosidad: 'Al cerrar el puño con fuerza se marcan sus tendones en la muñeca. Uno de ellos, el palmar largo, falta en alrededor del 14 % de las personas.',
    },
    extensores_antebrazo: {
        que: 'Grupo de músculos en la cara externa del antebrazo (la del dorso de la mano).',
        funcion: 'Estiran la muñeca y los dedos.',
        curiosidad: 'El «codo de tenista» es la inflamación de los tendones de estos músculos, cerca del codo.',
    },
    gluteo_mayor: {
        que: 'Músculo grande y grueso que forma la nalga.',
        funcion: 'Estira la cadera: levantarse de una silla, subir escaleras, correr y saltar.',
        curiosidad: 'Es el músculo más grande y voluminoso del cuerpo humano.',
    },
    gluteo_medio: {
        que: 'Músculo de la cadera, en la parte superior y lateral de la nalga.',
        funcion: 'Separa la pierna y mantiene la pelvis recta al andar sobre un pie.',
        curiosidad: 'Su zona superior externa es el lugar donde se ponen las inyecciones en la nalga.',
    },
    psoas_iliaco: {
        que: 'Músculo profundo que va de la columna lumbar y la pelvis hasta el fémur.',
        funcion: 'Dobla la cadera: subir la rodilla al andar, correr o subir escalones.',
        curiosidad: 'El psoas es el único músculo que une la columna con las piernas.',
    },
    recto_femoral: {
        que: 'Una de las cuatro cabezas del cuádriceps, en el centro de la parte delantera del muslo.',
        funcion: 'Estira la rodilla y además dobla la cadera, como al chutar un balón.',
        curiosidad: 'Es la única parte del cuádriceps que cruza la cadera.',
    },
    vasto_lateral: {
        que: 'Parte del cuádriceps en la cara externa del muslo.',
        funcion: 'Estira la rodilla: andar, saltar, levantarse.',
        curiosidad: 'Es la parte más grande del cuádriceps. En los bebés es donde se ponen algunas vacunas.',
    },
    vasto_medial: {
        que: 'Parte del cuádriceps en la cara interna del muslo, junto a la rodilla.',
        funcion: 'Estira la rodilla y mantiene la rótula en su sitio.',
        curiosidad: 'Por su forma se le llama «la gota».',
    },
    vasto_intermedio: {
        que: 'Parte del cuádriceps que está debajo del recto femoral, pegada al fémur.',
        funcion: 'Estira la rodilla.',
        curiosidad: 'No se ve desde fuera: está escondido bajo los otros tres. Sepáralo o aísla el resto para verlo.',
    },
    sartorio: {
        que: 'Músculo largo y estrecho que cruza el muslo en diagonal, de la cadera a la rodilla.',
        funcion: 'Dobla y gira la cadera y dobla la rodilla, como al sentarse con las piernas cruzadas.',
        curiosidad: 'Es el músculo más largo del cuerpo. Su nombre viene de «sastre», por cómo se sentaban para coser.',
    },
    aductores: {
        que: 'Grupo de músculos en la cara interna del muslo.',
        funcion: 'Juntan las piernas: montar a caballo, chutar con el interior del pie o patinar.',
        curiosidad: 'Su lesión es frecuente en futbolistas: el «tirón en el aductor».',
    },
    gracil: {
        que: 'Músculo largo y fino en la cara interna del muslo.',
        funcion: 'Junta las piernas y ayuda a doblar la rodilla.',
        curiosidad: '«Grácil» significa delgado y elegante. También se llama recto interno.',
    },
    biceps_femoral: {
        que: 'Músculo de la parte de atrás del muslo, en el lado externo. Es uno de los isquiotibiales.',
        funcion: 'Dobla la rodilla y estira la cadera: correr y frenar.',
        curiosidad: 'Los isquiotibiales se lesionan a menudo en los esprints: es el típico «pinchazo» en la parte de atrás del muslo.',
    },
    semitendinoso: {
        que: 'Isquiotibial de la parte de atrás del muslo, en el lado interno, con un tendón largo.',
        funcion: 'Dobla la rodilla y estira la cadera.',
        curiosidad: 'Su tendón se usa a veces en cirugía para reconstruir el ligamento cruzado de la rodilla.',
    },
    semimembranoso: {
        que: 'Isquiotibial ancho y plano, por debajo del semitendinoso.',
        funcion: 'Dobla la rodilla y estira la cadera.',
        curiosidad: 'Su nombre viene de su tendón, ancho como una membrana.',
    },
    gemelos: {
        que: 'Músculo de la pantorrilla con dos cabezas (interna y externa). También se llama gastrocnemio.',
        funcion: 'Ponerse de puntillas y dar impulso al saltar y correr.',
        curiosidad: 'Junto con el sóleo forma el tríceps sural. Los calambres en la pantorrilla suelen ser de los gemelos.',
    },
    soleo: {
        que: 'Músculo ancho y plano de la pantorrilla, debajo de los gemelos.',
        funcion: 'Ponerse de puntillas y mantenerse de pie sin caer hacia delante.',
        curiosidad: 'Se le llama el «segundo corazón»: al contraerse ayuda a que la sangre de las piernas suba hacia el corazón.',
    },
    tendon_aquiles: {
        que: 'Tendón que une los gemelos y el sóleo con el hueso del talón (calcáneo).',
        funcion: 'Transmite la fuerza de la pantorrilla al pie para andar, correr y saltar.',
        curiosidad: 'Es el tendón más grueso y fuerte del cuerpo. Su nombre viene del héroe griego Aquiles, cuyo único punto débil era el talón.',
    },
    tibial_anterior: {
        que: 'Músculo en la parte delantera de la pierna, junto a la espinilla.',
        funcion: 'Levanta la punta del pie para no tropezar al andar.',
        curiosidad: 'Al caminar mucho rato sobre los talones se nota cómo trabaja.',
    },
    peroneo_largo: {
        que: 'Músculo largo en el lado externo de la pierna, junto al peroné.',
        funcion: 'Gira la planta del pie hacia fuera y estabiliza el tobillo.',
        curiosidad: 'Su tendón cruza por debajo de la planta del pie y ayuda a mantener el arco.',
    },
};

export const PREGUNTABLES_MUSCULOS = Object.keys(FICHAS_MUSCULOS);
