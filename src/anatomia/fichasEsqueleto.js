// Fichas de información del esqueleto para el visor 3D (nivel Primaria / ESO).
// Clave = nombre inglés de la pieza (campo `en` de public/anatomia/esqueleto.json).
// Las piezas sin ficha propia usan la de su familia (FAMILIAS, por expresión regular).
// Cada ficha: { que, funcion, curiosidad }. Conviene que la revise un profesor de Biología.

export const FICHAS = {
    // ── Cráneo y cara ──
    'Frontal bone': {
        que: 'Hueso plano de la frente. Forma la parte delantera del cráneo y el techo de las órbitas de los ojos.',
        funcion: 'Protege la parte delantera del cerebro y sostiene la forma de la frente y las cejas.',
        curiosidad: 'Al nacer está dividido en dos mitades que se sueldan en los primeros años de vida.',
    },
    'Parietal bone': {
        que: 'Hay dos parietales, uno a cada lado. Forman el techo y los laterales del cráneo.',
        funcion: 'Protegen la parte superior del cerebro.',
        curiosidad: 'Donde se juntan con el frontal está la «fontanela» de los bebés, la zona blanda de la cabeza que se cierra hacia los 18 meses.',
    },
    'Occipital bone': {
        que: 'Hueso de la nuca, en la parte trasera e inferior del cráneo.',
        funcion: 'Protege la parte posterior del cerebro y se articula con la primera vértebra (el atlas).',
        curiosidad: 'Tiene un gran agujero, el agujero magno, por donde la médula espinal sale del cráneo hacia la columna.',
    },
    'Temporal bone': {
        que: 'Hay dos, uno a cada lado de la cabeza, a la altura de las orejas.',
        funcion: 'Protege los lados del cerebro y guarda en su interior el oído medio y el oído interno. Se articula con la mandíbula.',
        curiosidad: 'Es uno de los huesos más duros del cuerpo: su parte «petrosa» se llama así porque es dura como la piedra.',
    },
    'Sphenoid bone': {
        que: 'Hueso central de la base del cráneo, con forma de mariposa o murciélago.',
        funcion: 'Une muchos huesos del cráneo y de la cara y forma parte de las órbitas de los ojos.',
        curiosidad: 'Tiene un hueco llamado «silla turca» donde se aloja la hipófisis, una glándula que controla el crecimiento.',
    },
    'Ethmoid bone': {
        que: 'Hueso pequeño y ligero, lleno de huecos, situado entre los ojos, detrás de la nariz.',
        funcion: 'Forma parte de la nariz y de las órbitas. Por sus agujeros pasan los nervios del olfato.',
        curiosidad: 'Su parte superior parece un colador: se llama «lámina cribosa».',
    },
    'Nasal bone': {
        que: 'Dos huesos pequeños y alargados que forman el puente de la nariz.',
        funcion: 'Dan forma a la parte superior de la nariz. La parte inferior es de cartílago.',
        curiosidad: 'Es el hueso de la cara que más se rompe, por golpes en la nariz.',
    },
    'Maxilla': {
        que: 'Hueso de la mandíbula superior. Hay dos maxilares que se unen en el centro.',
        funcion: 'Sostiene los dientes de arriba, forma el paladar duro y el suelo de las órbitas.',
        curiosidad: 'A diferencia de la mandíbula, el maxilar superior no se mueve: está soldado al cráneo.',
    },
    'Mandible': {
        que: 'Hueso de la mandíbula inferior, con forma de herradura.',
        funcion: 'Sostiene los dientes de abajo y permite masticar y hablar.',
        curiosidad: 'Es el único hueso de la cabeza que se mueve (sin contar los huesecillos del oído) y el más fuerte de la cara.',
    },
    'Zygomatic bone': {
        que: 'El pómulo. Hay dos, uno en cada mejilla.',
        funcion: 'Da forma a las mejillas y protege los ojos por abajo y por los lados.',
        curiosidad: 'Su prolongación hacia la oreja forma el «arco cigomático», que se nota con los dedos delante de la oreja.',
    },
    'Lacrimal bone': {
        que: 'Hueso muy pequeño en la pared interna de la órbita del ojo.',
        funcion: 'Tiene un canal por donde las lágrimas pasan del ojo a la nariz.',
        curiosidad: 'Es el hueso más pequeño y frágil de la cara. Por ese canal se te «moquea» la nariz al llorar.',
    },
    'Palatine bone': {
        que: 'Dos huesos en forma de L en la parte trasera del paladar.',
        funcion: 'Forman la parte posterior del paladar duro y parte de la nariz.',
        curiosidad: 'Con la lengua puedes notar dónde termina el paladar duro y empieza el blando, sin hueso.',
    },
    'Vomer': {
        que: 'Hueso fino y plano que forma la parte de abajo del tabique nasal.',
        funcion: 'Separa las dos fosas nasales.',
        curiosidad: 'Su nombre viene del latín «arado», por su forma.',
    },
    'Inferior nasal concha bone': {
        que: 'Hueso fino y enrollado dentro de cada fosa nasal.',
        funcion: 'Hace que el aire dé vueltas para calentarlo, humedecerlo y filtrarlo antes de llegar a los pulmones.',
        curiosidad: 'Es como un radiador: por eso respirar por la nariz es más sano que por la boca.',
    },
    'Sinus of frontal bone': {
        que: 'Cavidad llena de aire dentro del hueso frontal, encima de los ojos.',
        funcion: 'Aligera el cráneo y ayuda a que la voz resuene.',
        curiosidad: 'Cuando se inflaman con un resfriado aparece la sinusitis, que duele en la frente.',
    },
    'Sinus of sphenoid bone': {
        que: 'Cavidad llena de aire dentro del esfenoides.',
        funcion: 'Aligera el cráneo y ayuda a que la voz resuene.',
        curiosidad: 'Junto con los demás senos, hace que la cabeza pese bastante menos.',
    },
    'Hyoid bone': {
        que: 'Hueso en forma de U en el cuello, debajo de la mandíbula.',
        funcion: 'Sujeta la lengua y ayuda a tragar y a hablar.',
        curiosidad: 'Es el único hueso del cuerpo que no se toca con ningún otro hueso: está colgado de músculos y ligamentos.',
    },
    // ── Oído ──
    'Malleus': {
        que: 'El primero de los tres huesecillos del oído medio. Tiene forma de martillo.',
        funcion: 'Está pegado al tímpano y recoge sus vibraciones para pasarlas al yunque.',
        curiosidad: 'Los tres huesecillos juntos caben en una moneda de un céntimo.',
    },
    'Incus': {
        que: 'El huesecillo del medio del oído, con forma de yunque.',
        funcion: 'Pasa las vibraciones del martillo al estribo.',
        curiosidad: 'Martillo, yunque y estribo amplifican el sonido unas 20 veces.',
    },
    'Stapes': {
        que: 'El último huesecillo del oído medio, con forma de estribo de montar.',
        funcion: 'Transmite las vibraciones al oído interno, donde se convierten en señales para el cerebro.',
        curiosidad: 'Es el hueso más pequeño del cuerpo: mide unos 3 milímetros.',
    },
    // ── Columna ──
    'Atlas (C1)': {
        que: 'La primera vértebra cervical. Es un anillo sin cuerpo vertebral.',
        funcion: 'Sostiene el cráneo y permite mover la cabeza arriba y abajo, como al decir «sí».',
        curiosidad: 'Se llama así por el titán Atlas de la mitología, que sostenía el cielo sobre sus hombros.',
    },
    'Axis (C2)': {
        que: 'La segunda vértebra cervical. Tiene un saliente hacia arriba llamado «diente».',
        funcion: 'El atlas gira sobre su diente: permite mover la cabeza a los lados, como al decir «no».',
        curiosidad: 'Entre el atlas y el axis se hace la mitad de todo el giro de la cabeza.',
    },
    'Sacrum': {
        que: 'Hueso triangular al final de la columna, formado por 5 vértebras soldadas.',
        funcion: 'Une la columna con la pelvis y transmite el peso del cuerpo a las piernas.',
        curiosidad: 'Las 5 vértebras sacras se sueldan entre los 16 y los 25 años.',
    },
    'Coccyx': {
        que: 'El último hueso de la columna, formado por 3 a 5 vértebras muy pequeñas soldadas.',
        funcion: 'En él se sujetan músculos y ligamentos de la pelvis.',
        curiosidad: 'Es lo que queda de la cola de nuestros antepasados: por eso se le llama «rabadilla».',
    },
    // ── Tórax ──
    'Manubrium of sternum': {
        que: 'La parte de arriba del esternón, con forma de corbata ancha.',
        funcion: 'Se une a las clavículas y a las primeras costillas.',
        curiosidad: 'Donde se une con el cuerpo del esternón se nota un pequeño bulto: el «ángulo de Louis».',
    },
    'Body of sternum': {
        que: 'La parte central y más larga del esternón, el hueso plano del centro del pecho.',
        funcion: 'Las costillas se unen a él mediante cartílagos y protege el corazón.',
        curiosidad: 'En la reanimación (RCP) se comprime la mitad inferior del esternón para bombear la sangre.',
    },
    'Xiphoid process': {
        que: 'La punta inferior del esternón, pequeña y en parte de cartílago.',
        funcion: 'En ella se sujetan músculos del abdomen y el diafragma.',
        curiosidad: 'Se vuelve de hueso con la edad, normalmente después de los 40 años.',
    },
    'Clavicle': {
        que: 'Hueso largo con forma de S entre el esternón y el hombro.',
        funcion: 'Mantiene el hombro separado del pecho para que el brazo se mueva libremente.',
        curiosidad: 'Es el primer hueso que empieza a formarse antes de nacer y uno de los que más se rompe al caer.',
    },
    'Scapula': {
        que: 'El omóplato: hueso plano y triangular en la parte alta de la espalda.',
        funcion: 'Une el brazo con el tronco y en él se sujetan muchos músculos del hombro.',
        curiosidad: 'No está unido a las costillas con ninguna articulación: se desliza sobre ellas sujeto por músculos.',
    },
    // ── Brazo ──
    'Humerus': {
        que: 'El hueso del brazo, entre el hombro y el codo.',
        funcion: 'Permite mover el brazo en todas direcciones desde el hombro y doblarlo por el codo.',
        curiosidad: 'El «calambrazo» al darte en el codo no es del hueso: es un nervio (el cubital) que pasa pegado al húmero.',
    },
    'Radius': {
        que: 'Uno de los dos huesos del antebrazo, en el lado del pulgar.',
        funcion: 'Gira alrededor del cúbito para poner la palma hacia arriba o hacia abajo.',
        curiosidad: 'Es el hueso que más se rompe en la muñeca al apoyar la mano en una caída.',
    },
    'Ulna': {
        que: 'El cúbito: hueso del antebrazo en el lado del dedo meñique.',
        funcion: 'Forma la articulación del codo con el húmero.',
        curiosidad: 'La punta del codo que te apoyas en la mesa es el cúbito (el olécranon).',
    },
    'Scaphoid bone': {
        que: 'Hueso del carpo (muñeca) en el lado del pulgar, con forma de barca.',
        funcion: 'Une las dos filas de huesos de la muñeca.',
        curiosidad: 'Es el hueso de la muñeca que más se fractura y le cuesta soldar porque le llega poca sangre.',
    },
    // ── Pierna ──
    'Hip bone': {
        que: 'El coxal: el hueso de la cadera. Hay dos, que con el sacro forman la pelvis.',
        funcion: 'Sostiene el peso del tronco, protege órganos del abdomen y une las piernas al cuerpo.',
        curiosidad: 'Está formado por tres huesos (ilion, isquion y pubis) que se sueldan en la adolescencia.',
    },
    'Femur': {
        que: 'El hueso del muslo, entre la cadera y la rodilla.',
        funcion: 'Sostiene el peso del cuerpo al estar de pie, andar y correr.',
        curiosidad: 'Es el hueso más largo y fuerte del cuerpo: mide aproximadamente la cuarta parte de tu altura.',
    },
    'Patella': {
        que: 'La rótula: hueso redondeado y plano delante de la rodilla.',
        funcion: 'Protege la rodilla y hace de polea para que el músculo del muslo estire la pierna con menos esfuerzo.',
        curiosidad: 'Es el hueso sesamoideo más grande: se forma dentro de un tendón. Los bebés la tienen de cartílago.',
    },
    'Tibia': {
        que: 'El hueso grueso de la pierna, en la parte delantera e interna (la espinilla).',
        funcion: 'Sostiene el peso del cuerpo entre la rodilla y el tobillo.',
        curiosidad: 'Es el segundo hueso más largo. Por eso duele tanto un golpe en la espinilla: está justo debajo de la piel.',
    },
    'Fibula': {
        que: 'El peroné: hueso fino y largo en la parte externa de la pierna.',
        funcion: 'Sujeta músculos y forma el tobillo por fuera. Casi no soporta peso.',
        curiosidad: 'El bulto de la parte de fuera del tobillo es el final del peroné (el maléolo lateral).',
    },
    'Talus': {
        que: 'El astrágalo: hueso del tobillo, entre la tibia y el talón.',
        funcion: 'Pasa todo el peso de la pierna al pie y permite subir y bajar la punta del pie.',
        curiosidad: 'Es de los pocos huesos en los que no se sujeta ningún músculo.',
    },
    'Calcaneus': {
        que: 'El hueso del talón.',
        funcion: 'Recibe el peso del cuerpo al apoyar el pie y en él se sujeta el tendón de Aquiles.',
        curiosidad: 'Es el hueso más grande del pie.',
    },
};

// Fichas por familia (para las piezas sin ficha propia)
const FAMILIAS = [
    [/^Vertebra C/, {
        que: 'Vértebra cervical: una de las 7 vértebras del cuello.',
        funcion: 'Sostienen la cabeza y le dan mucha movilidad al cuello.',
        curiosidad: 'Casi todos los mamíferos, incluida la jirafa, tienen 7 vértebras cervicales: las suyas son mucho más largas. La C7 es el bulto que notas en la base del cuello.',
    }],
    [/^Vertebra T/, {
        que: 'Vértebra torácica: una de las 12 vértebras de la espalda.',
        funcion: 'A cada una se unen dos costillas, así que forman la parte trasera de la caja torácica.',
        curiosidad: 'Son las vértebras que menos se mueven, porque las costillas las sujetan.',
    }],
    [/^Vertebra L/, {
        que: 'Vértebra lumbar: una de las 5 vértebras de la zona baja de la espalda.',
        funcion: 'Son las más grandes y fuertes porque soportan casi todo el peso del tronco.',
        curiosidad: 'Por eso el dolor de espalda más frecuente es el lumbar: hay que agacharse doblando las rodillas.',
    }],
    [/^(First|Second|Third|Fourth|Fifth|Sixth|Seventh) rib$/, {
        que: 'Costilla verdadera: una de las 7 primeras costillas de cada lado.',
        funcion: 'Protegen el corazón y los pulmones y suben y bajan al respirar.',
        curiosidad: 'Se llaman «verdaderas» porque se unen directamente al esternón con su propio cartílago.',
    }],
    [/^(Eighth|Ninth|Tenth) rib$/, {
        que: 'Costilla falsa: las costillas 8.ª, 9.ª y 10.ª.',
        funcion: 'Protegen los pulmones y órganos como el hígado y el bazo.',
        curiosidad: 'Se llaman «falsas» porque no llegan al esternón: se unen al cartílago de la costilla de encima.',
    }],
    [/^(Eleventh|Twelfth) rib$/, {
        que: 'Costilla flotante: las costillas 11.ª y 12.ª.',
        funcion: 'Protegen por detrás los riñones.',
        curiosidad: 'Se llaman «flotantes» porque por delante no se unen a nada.',
    }],
    [/^Costal cartilage/, {
        que: 'Cartílago costal: une la costilla con el esternón.',
        funcion: 'Al ser flexible, permite que la caja torácica se ensanche al respirar.',
        curiosidad: 'Con la edad estos cartílagos se endurecen y el pecho pierde flexibilidad.',
    }],
    [/incisor/, {
        que: 'Diente incisivo: dientes delanteros, planos y con borde afilado.',
        funcion: 'Sirven para cortar los alimentos, como al morder una manzana.',
        curiosidad: 'Un adulto tiene 8 incisivos. Los dientes se cuentan en las piezas del esqueleto aunque no son huesos.',
    }],
    [/canine/, {
        que: 'Diente canino (colmillo): diente puntiagudo al lado de los incisivos.',
        funcion: 'Sirve para desgarrar los alimentos.',
        curiosidad: 'Tiene la raíz más larga de todos los dientes. Un adulto tiene 4.',
    }],
    [/premolar/, {
        que: 'Premolar: diente con dos puntas (cúspides) entre el canino y los molares.',
        funcion: 'Tritura y desgarra los alimentos.',
        curiosidad: 'Los niños no tienen premolares de leche: salen directamente los definitivos.',
    }],
    [/molar tooth/, {
        que: 'Molar: diente grande y ancho del fondo de la boca.',
        funcion: 'Muele y tritura los alimentos.',
        curiosidad: 'Las «muelas del juicio» son los terceros molares y salen entre los 17 y los 25 años (a veces nunca).',
    }],
    [/^(Capitate|Hamate|Lunate|Pisiform|Trapezium|Trapezoid|Triquetrum) bone$/, {
        que: 'Hueso del carpo: uno de los 8 huesos pequeños de la muñeca, colocados en dos filas.',
        funcion: 'Dan flexibilidad a la muñeca para moverla en todas direcciones.',
        curiosidad: 'La mano tiene 27 huesos: 8 del carpo, 5 metacarpianos y 14 falanges.',
    }],
    [/metacarpal/, {
        que: 'Metacarpiano: uno de los 5 huesos largos de la palma de la mano.',
        funcion: 'Forman la palma y se unen a las falanges de los dedos.',
        curiosidad: 'Los nudillos que se marcan al cerrar el puño son las cabezas de los metacarpianos.',
    }],
    [/phalanx of .* of hand/, {
        que: 'Falange de la mano: uno de los huesos de los dedos.',
        funcion: 'Permiten doblar los dedos para agarrar y hacer movimientos precisos.',
        curiosidad: 'Cada dedo tiene 3 falanges (proximal, media y distal), menos el pulgar, que tiene 2.',
    }],
    [/^(Navicular|Cuboid|Medial cuneiform|Intermediate cuneiform|Lateral cuneiform) bone$/, {
        que: 'Hueso del tarso: uno de los 7 huesos de la parte de atrás del pie.',
        funcion: 'Forman el arco del pie, que reparte el peso y amortigua al andar.',
        curiosidad: 'El pie tiene 26 huesos: 7 del tarso, 5 metatarsianos y 14 falanges. ¡Entre los dos pies hay una cuarta parte de los huesos del cuerpo!',
    }],
    [/metatarsal/, {
        que: 'Metatarsiano: uno de los 5 huesos largos del pie.',
        funcion: 'Forman la planta del pie y transmiten el impulso al caminar y saltar.',
        curiosidad: 'El quinto metatarsiano se fractura a menudo en los esguinces de tobillo.',
    }],
    [/phalanx of .* of foot/, {
        que: 'Falange del pie: uno de los huesos de los dedos del pie.',
        funcion: 'Ayudan a mantener el equilibrio y a impulsarse al andar.',
        curiosidad: 'El dedo gordo tiene 2 falanges y los demás 3, igual que en la mano.',
    }],
    [/Sesamoid bones of foot/, {
        que: 'Huesos sesamoideos: dos huesecillos debajo de la base del dedo gordo del pie.',
        funcion: 'Protegen un tendón y ayudan a impulsarse al andar y saltar.',
        curiosidad: 'Se llaman así porque parecen semillas de sésamo.',
    }],
    [/cells of ethmoid/, {
        que: 'Celdillas etmoidales: pequeñas cavidades con aire dentro del etmoides.',
        funcion: 'Aligeran el cráneo y forman parte de los senos paranasales.',
        curiosidad: 'Son como un panal de abejas lleno de aire.',
    }],
    [/cartilage/i, {
        que: 'Cartílago: tejido flexible, más blando que el hueso.',
        funcion: 'Da forma a zonas que deben ser flexibles, como la nariz o la laringe.',
        curiosidad: 'El cartílago tiroides forma la «nuez», que se nota más en los chicos tras la adolescencia.',
    }],
];

const GENERICA = {
    que: 'Pieza del esqueleto humano.',
    funcion: 'El esqueleto sostiene el cuerpo, protege los órganos y permite el movimiento junto con los músculos.',
    curiosidad: 'Un adulto tiene unos 206 huesos; un bebé nace con alrededor de 300, que se van soldando.',
};

export const fichaDe = (pieza) => {
    if (!pieza) return null;
    if (FICHAS[pieza.en]) return FICHAS[pieza.en];
    const f = FAMILIAS.find(([re]) => re.test(pieza.en));
    return f ? f[1] : GENERICA;
};

// Huesos que se preguntan en el juego «¿Dónde está?» (los que tienen ficha propia o son muy conocidos)
export const PREGUNTABLES = [
    'Frontal bone', 'Parietal bone', 'Occipital bone', 'Temporal bone', 'Mandible', 'Maxilla', 'Zygomatic bone', 'Nasal bone',
    'Hyoid bone', 'Atlas (C1)', 'Axis (C2)', 'Sacrum', 'Coccyx', 'Clavicle', 'Scapula', 'Body of sternum', 'Manubrium of sternum',
    'Humerus', 'Radius', 'Ulna', 'Hip bone', 'Femur', 'Patella', 'Tibia', 'Fibula', 'Calcaneus', 'Talus',
    'First rib', 'Twelfth rib', 'Vertebra L3', 'Vertebra T6', 'Vertebra C5', 'First metacarpal bone', 'First metatarsal bone',
];
