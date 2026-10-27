// Fichas de los órganos principales para el visor 3D (nivel Primaria / ESO).
// Clave = id del órgano (campo `en` de public/anatomia/organos.json, ver
// scripts/anatomia/organos_seleccion.json). Cada ficha: { que, funcion, curiosidad }.
// Conviene que la revise un profesor de Biología.

export const FICHAS_ORGANOS = {
    // ── Sistema nervioso ──
    lobulo_frontal: {
        que: 'La parte delantera de cada hemisferio del cerebro, detrás de la frente.',
        funcion: 'Planifica, toma decisiones, controla los movimientos voluntarios y el lenguaje hablado. También regula la conducta y las emociones.',
        curiosidad: 'Es la última zona del cerebro en madurar: termina de desarrollarse hacia los 25 años.',
    },
    lobulo_parietal: {
        que: 'La parte superior y central de cada hemisferio cerebral.',
        funcion: 'Recibe las sensaciones del cuerpo (tacto, dolor, temperatura) y nos ayuda a orientarnos en el espacio.',
        curiosidad: 'Tiene un «mapa» del cuerpo en el que la mano y los labios ocupan mucho más espacio que la espalda: por eso son tan sensibles.',
    },
    lobulo_temporal: {
        que: 'La parte lateral e inferior de cada hemisferio, a la altura de las orejas.',
        funcion: 'Procesa lo que oímos, ayuda a entender el lenguaje y participa en la memoria.',
        curiosidad: 'Muy cerca, en su interior, está el hipocampo, clave para guardar recuerdos nuevos.',
    },
    lobulo_occipital: {
        que: 'La parte trasera de cada hemisferio cerebral, en la nuca.',
        funcion: 'Procesa la información que llega de los ojos: es el centro de la visión.',
        curiosidad: 'Aunque los ojos están delante, vemos con la parte de atrás del cerebro. Un golpe fuerte en la nuca puede hacer «ver las estrellas».',
    },
    insula_cisuras: {
        que: 'La corteza escondida en los pliegues (cisuras y surcos) del cerebro, incluida la ínsula, un lóbulo oculto bajo los demás.',
        funcion: 'Los pliegues permiten que quepa mucha corteza en poco espacio. La ínsula participa en el gusto y en sentir el propio cuerpo y las emociones.',
        curiosidad: 'Si se estirara la corteza de un cerebro humano, ocuparía más o menos lo que una servilleta grande.',
    },
    cuerpo_calloso: {
        que: 'Un grueso puente de fibras nerviosas que une los dos hemisferios del cerebro.',
        funcion: 'Permite que el hemisferio derecho y el izquierdo se comuniquen y trabajen juntos.',
        curiosidad: 'Tiene unos 200 millones de fibras nerviosas.',
    },
    cerebelo: {
        que: 'Órgano situado debajo de la parte trasera del cerebro, con muchos pliegues finos.',
        funcion: 'Coordina los movimientos, mantiene el equilibrio y ayuda a aprender habilidades como montar en bici.',
        curiosidad: 'Ocupa solo una décima parte del encéfalo, pero tiene más neuronas que todo el resto junto.',
    },
    tronco_encefalico: {
        que: 'La parte del encéfalo que une el cerebro con la médula espinal. Está formado por el mesencéfalo, el puente y el bulbo raquídeo.',
        funcion: 'Controla funciones vitales automáticas: la respiración, el latido del corazón, tragar o estar despiertos.',
        curiosidad: 'Por él pasan todas las señales que van del cerebro al cuerpo y del cuerpo al cerebro.',
    },
    medula_espinal: {
        que: 'Un cordón nervioso que baja por dentro de la columna vertebral, protegido por las vértebras y las meninges.',
        funcion: 'Lleva los mensajes entre el encéfalo y el cuerpo y produce los actos reflejos.',
        curiosidad: 'Al quitar la mano rápido de algo que quema, la orden sale de la médula, antes de que el cerebro lo note.',
    },
    nervio_ciatico: {
        que: 'Nervio que sale de la parte baja de la columna y baja por la parte de atrás de cada pierna.',
        funcion: 'Lleva las órdenes a los músculos de la pierna y trae las sensaciones de la pierna y del pie.',
        curiosidad: 'Es el nervio más largo y grueso del cuerpo: casi como un dedo en su origen. Su inflamación se llama ciática.',
    },
    ojo: {
        que: 'El órgano de la vista: una esfera de unos 2,5 cm. Por fuera se ven la esclerótica (lo blanco), el iris (la parte de color) y la córnea.',
        funcion: 'Recoge la luz y forma imágenes que el nervio óptico envía al cerebro.',
        curiosidad: 'El iris de cada persona es único, como una huella dactilar. La pupila se hace grande con poca luz y pequeña con mucha.',
    },
    // ── Aparato digestivo ──
    lengua: {
        que: 'Órgano muscular dentro de la boca, cubierto de papilas.',
        funcion: 'Mueve la comida al masticar, ayuda a tragar, detecta los sabores y es esencial para hablar.',
        curiosidad: 'Detecta cinco sabores básicos: dulce, salado, ácido, amargo y umami. No hay «zonas» para cada sabor: toda la lengua los nota.',
    },
    glandulas_salivales: {
        que: 'Glándulas que fabrican la saliva. Las principales son tres pares: parótidas, submandibulares y sublinguales.',
        funcion: 'La saliva humedece la comida, empieza a digerir el almidón y protege los dientes.',
        curiosidad: 'Fabricamos entre 1 y 1,5 litros de saliva al día. Las paperas son una inflamación de las parótidas.',
    },
    faringe: {
        que: 'Tubo detrás de la nariz y la boca, que comparten el aparato digestivo y el respiratorio.',
        funcion: 'Lleva la comida al esófago y el aire a la laringe.',
        curiosidad: 'La epiglotis tapa la laringe al tragar para que la comida no se vaya «por el otro lado».',
    },
    esofago: {
        que: 'Tubo muscular de unos 25 cm que va de la faringe al estómago, por detrás de la tráquea.',
        funcion: 'Empuja el bolo alimenticio hasta el estómago con contracciones (movimientos peristálticos).',
        curiosidad: 'Gracias a esas contracciones podríamos tragar incluso cabeza abajo.',
    },
    estomago: {
        que: 'Órgano en forma de bolsa, en la parte superior izquierda del abdomen.',
        funcion: 'Mezcla la comida con los jugos gástricos (con ácido y enzimas) y la convierte en una papilla llamada quimo.',
        curiosidad: 'Su jugo es muy ácido (más que el zumo de limón); una capa de moco protege al propio estómago para que no se digiera a sí mismo.',
    },
    higado: {
        que: 'El órgano interno más grande del cuerpo, en la parte superior derecha del abdomen.',
        funcion: 'Fabrica la bilis, almacena energía y vitaminas, y limpia la sangre de sustancias tóxicas.',
        curiosidad: 'Pesa alrededor de 1,5 kg y es capaz de regenerarse: puede volver a crecer aunque se le quite una parte.',
    },
    vesicula: {
        que: 'Pequeña bolsa verde debajo del hígado.',
        funcion: 'Guarda la bilis que fabrica el hígado y la vierte al duodeno para digerir las grasas.',
        curiosidad: 'A veces se forman en ella piedras (cálculos biliares). Se puede vivir sin vesícula.',
    },
    pancreas: {
        que: 'Glándula alargada situada detrás del estómago.',
        funcion: 'Fabrica jugo pancreático para la digestión y hormonas como la insulina, que regula el azúcar de la sangre.',
        curiosidad: 'Es a la vez glándula digestiva y endocrina. La diabetes tipo 1 aparece cuando no fabrica insulina.',
    },
    duodeno: {
        que: 'El primer tramo del intestino delgado, con forma de C, justo después del estómago.',
        funcion: 'Recibe la bilis y el jugo pancreático, que continúan la digestión.',
        curiosidad: 'Su nombre viene de «doce dedos», porque medía unos doce dedos de largo.',
    },
    intestino_delgado: {
        que: 'Tubo largo y plegado que ocupa el centro del abdomen (yeyuno e íleon).',
        funcion: 'Termina la digestión y absorbe los nutrientes, que pasan a la sangre.',
        curiosidad: 'Mide entre 6 y 7 metros. Por dentro tiene millones de vellosidades que multiplican su superficie.',
    },
    intestino_grueso: {
        que: 'El último tramo del tubo digestivo, que rodea al intestino delgado como un marco.',
        funcion: 'Absorbe agua y sales y forma las heces. En él viven billones de bacterias beneficiosas.',
        curiosidad: 'Mide aproximadamente 1,5 metros: es más corto que el delgado, pero mucho más ancho.',
    },
    apendice: {
        que: 'Pequeño tubo cerrado unido al principio del intestino grueso.',
        funcion: 'Parece que guarda bacterias beneficiosas y participa en las defensas.',
        curiosidad: 'Cuando se inflama (apendicitis) hay que operarlo: duele en la parte baja derecha del abdomen.',
    },
    // ── Aparato respiratorio ──
    traquea: {
        que: 'Tubo formado por anillos de cartílago, delante del esófago.',
        funcion: 'Lleva el aire desde la laringe hasta los bronquios.',
        curiosidad: 'Sus anillos tienen forma de C para que el esófago, que está detrás, pueda ensancharse al tragar.',
    },
    bronquios: {
        que: 'Tubos en los que se divide la tráquea, uno para cada pulmón, que se ramifican cada vez más.',
        funcion: 'Reparten el aire por los pulmones hasta los alvéolos.',
        curiosidad: 'Sus ramificaciones parecen un árbol al revés: por eso se llama «árbol bronquial».',
    },
    pulmon_derecho: {
        que: 'El pulmón derecho, dentro de la caja torácica. Tiene tres lóbulos.',
        funcion: 'En sus alvéolos el oxígeno pasa a la sangre y el dióxido de carbono sale de ella.',
        curiosidad: 'Es más grande que el izquierdo, que tiene un hueco para el corazón.',
    },
    pulmon_izquierdo: {
        que: 'El pulmón izquierdo. Tiene dos lóbulos y un hueco donde se apoya el corazón.',
        funcion: 'Intercambia gases: toma oxígeno del aire y expulsa dióxido de carbono.',
        curiosidad: 'Los dos pulmones tienen unos 300 millones de alvéolos: extendidos ocuparían media pista de tenis.',
    },
    // ── Aparato circulatorio ──
    auricula_derecha: {
        que: 'Cavidad superior derecha del corazón.',
        funcion: 'Recibe la sangre pobre en oxígeno que vuelve del cuerpo por las venas cavas.',
        curiosidad: 'En ella está el marcapasos natural del corazón (el nódulo sinusal), que da la señal de cada latido.',
    },
    ventriculo_derecho: {
        que: 'Cavidad inferior derecha del corazón.',
        funcion: 'Bombea la sangre pobre en oxígeno hacia los pulmones por la arteria pulmonar.',
        curiosidad: 'Su pared es más fina que la del izquierdo porque solo tiene que llevar la sangre hasta los pulmones, que están muy cerca.',
    },
    auricula_izquierda: {
        que: 'Cavidad superior izquierda del corazón.',
        funcion: 'Recibe la sangre rica en oxígeno que llega de los pulmones por las venas pulmonares.',
        curiosidad: 'Entre la aurícula y el ventrículo hay una válvula (la mitral) que impide que la sangre vuelva hacia atrás.',
    },
    ventriculo_izquierdo: {
        que: 'Cavidad inferior izquierda del corazón, la de pared más gruesa.',
        funcion: 'Bombea la sangre rica en oxígeno a todo el cuerpo a través de la aorta.',
        curiosidad: 'El corazón late unas 100 000 veces al día. Su pared es gruesa porque empuja la sangre hasta los pies y la cabeza.',
    },
    aorta: {
        que: 'La arteria más grande del cuerpo. Sale del ventrículo izquierdo, forma un arco y baja por el tórax y el abdomen.',
        funcion: 'Reparte la sangre rica en oxígeno a todo el cuerpo a través de sus ramas.',
        curiosidad: 'Tiene el grosor de una manguera de jardín (unos 2,5 cm de diámetro).',
    },
    arteria_pulmonar: {
        que: 'Arteria que sale del ventrículo derecho y se divide en dos, una para cada pulmón.',
        funcion: 'Lleva la sangre pobre en oxígeno a los pulmones para que se oxigene.',
        curiosidad: 'Es la única arteria que lleva sangre pobre en oxígeno: por eso se pinta de azul.',
    },
    vena_cava_superior: {
        que: 'Gran vena que desemboca en la aurícula derecha desde arriba.',
        funcion: 'Devuelve al corazón la sangre de la cabeza, el cuello y los brazos.',
        curiosidad: 'Las venas tienen válvulas por dentro para que la sangre no retroceda.',
    },
    vena_cava_inferior: {
        que: 'La vena más grande del cuerpo, que sube por el abdomen hasta la aurícula derecha.',
        funcion: 'Devuelve al corazón la sangre de las piernas y del abdomen.',
        curiosidad: 'Para que la sangre suba desde los pies ayudan los músculos de las piernas, sobre todo el sóleo.',
    },
    // ── Aparato excretor ──
    rinon: {
        que: 'Órgano con forma de judía, a cada lado de la columna, en la parte alta del abdomen y por detrás.',
        funcion: 'Filtra la sangre, elimina los desechos y el exceso de agua y fabrica la orina.',
        curiosidad: 'Los dos riñones filtran unos 180 litros de sangre al día, pero solo producen 1,5 litros de orina. Se puede vivir con uno solo. (Modelo simplificado.)',
    },
    ureter: {
        que: 'Tubo fino que baja desde cada riñón hasta la vejiga.',
        funcion: 'Lleva la orina del riñón a la vejiga.',
        curiosidad: 'Mide unos 25-30 cm y empuja la orina con contracciones, igual que el esófago con la comida.',
    },
    vejiga: {
        que: 'Bolsa muscular y elástica en la parte baja del abdomen, dentro de la pelvis.',
        funcion: 'Almacena la orina hasta que se expulsa.',
        curiosidad: 'Puede guardar entre 300 y 500 ml de orina. Sentimos ganas de orinar cuando está a medio llenar.',
    },
    uretra: {
        que: 'Conducto que lleva la orina desde la vejiga hasta el exterior.',
        funcion: 'Expulsa la orina al orinar.',
        curiosidad: 'Es más larga en los hombres (unos 20 cm) que en las mujeres (unos 4 cm).',
    },
    // ── Sistema endocrino y linfático ──
    tiroides: {
        que: 'Glándula con forma de mariposa en la parte delantera del cuello, debajo de la nuez.',
        funcion: 'Fabrica hormonas que regulan el metabolismo, el crecimiento y la temperatura del cuerpo.',
        curiosidad: 'Necesita yodo para funcionar: por eso la sal de cocina suele llevar yodo añadido.',
    },
    suprarrenal: {
        que: 'Pequeñas glándulas con forma de triángulo encima de cada riñón.',
        funcion: 'Fabrican hormonas como la adrenalina, que prepara el cuerpo para reaccionar ante un peligro.',
        curiosidad: 'La adrenalina acelera el corazón y la respiración en segundos: es la respuesta de «luchar o huir».',
    },
    bazo: {
        que: 'Órgano blando en la parte superior izquierda del abdomen, detrás del estómago.',
        funcion: 'Filtra la sangre, elimina los glóbulos rojos viejos y ayuda a las defensas.',
        curiosidad: 'Está muy lleno de sangre: es el órgano del abdomen que más se lesiona en los golpes fuertes. Se puede vivir sin él.',
    },
    timo: {
        que: 'Glándula situada detrás del esternón, por encima del corazón.',
        funcion: 'Entrena a unos glóbulos blancos (los linfocitos T) para defender el cuerpo.',
        curiosidad: 'Es grande en la infancia y se va haciendo pequeño a partir de la adolescencia.',
    },
};

export const PREGUNTABLES_ORGANOS = Object.keys(FICHAS_ORGANOS);
