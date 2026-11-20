// ─── Test teórico de conducir (estilo examen del permiso B) ──────────────────
// 3 opciones por pregunta, como en el examen. Las de señales se generan a partir
// del catálogo (senales.js); el resto están escritas a mano con su explicación.
import { SENALES, SENAL_POR_ID } from './senales';

export const TEMAS_TEST = [
    { id: 'senales',   nombre: 'Señales',               emoji: '🚸' },
    { id: 'prioridad', nombre: 'Prioridad de paso',     emoji: '↔️' },
    { id: 'velocidad', nombre: 'Velocidad y distancias', emoji: '⏱️' },
    { id: 'peatones',  nombre: 'Peatones y usuarios vulnerables', emoji: '🚶' },
    { id: 'seguridad', nombre: 'Seguridad y salud',     emoji: '🦺' },
    { id: 'normas',    nombre: 'Normas y maniobras',    emoji: '📘' },
    { id: 'moto',      nombre: 'Moto (permisos A1, A2 y A)', emoji: '🏍️' },
];

// correcta = índice de la opción buena (se barajan al generar el test).
const MANUALES = [
    // MOTO
    { tema: 'moto', pregunta: '¿Quién debe llevar casco en una motocicleta?',
      opciones: ['El conductor y el pasajero, en todas las vías.', 'Solo el conductor.', 'Solo fuera de la ciudad.'], correcta: 0,
      explicacion: 'El casco homologado es obligatorio para conductor y pasajero en cualquier vía, también en ciudad.' },
    { tema: 'moto', pregunta: 'Como norma general, ¿qué edad mínima debe tener el pasajero de una motocicleta?',
      opciones: ['Más de 12 años.', 'Más de 7 años en cualquier caso.', 'Más de 16 años.'], correcta: 0,
      explicacion: 'La regla general es mayor de 12 años. Excepcionalmente, mayor de 7 si conduce su padre, madre, tutor o una persona autorizada por ellos, siempre con casco.' },
    { tema: 'moto', pregunta: '¿Cómo debe ir el pasajero de una moto?',
      opciones: ['A horcajadas, detrás del conductor y con los pies en los reposapiés.', 'De lado, detrás del conductor.', 'Delante del conductor si es un niño.'], correcta: 0,
      explicacion: 'El pasajero va detrás, a horcajadas y con los pies apoyados en los reposapiés. Nunca delante del conductor.' },
    { tema: 'moto', pregunta: '¿Puede una moto llevar pasajero si no tiene asiento ni reposapiés para él?',
      opciones: ['No: la moto tiene que estar preparada para llevar pasajero.', 'Sí, si va despacio.', 'Sí, si el pasajero es un niño.'], correcta: 0,
      explicacion: 'Solo se puede llevar pasajero si la moto está homologada para ello, con su asiento y sus reposapiés.' },
    { tema: 'moto', pregunta: '¿Qué alumbrado deben llevar encendido las motocicletas de día?',
      opciones: ['El de cruce (corto alcance).', 'Ninguno.', 'El de carretera (largo alcance).'], correcta: 0,
      explicacion: 'Las motocicletas circulan siempre con el alumbrado de cruce encendido, también de día, para ser más visibles.' },
    { tema: 'moto', pregunta: '¿A qué edad se puede obtener el permiso A2?',
      opciones: ['A los 18 años.', 'A los 16 años.', 'A los 20 años.'], correcta: 0,
      explicacion: 'AM (ciclomotores): 15 años. A1: 16 años. A2: 18 años. A: 20 años y 2 de experiencia con el A2.' },
    { tema: 'moto', pregunta: '¿Qué motocicletas permite conducir el permiso A1?',
      opciones: ['Hasta 125 cc y 11 kW de potencia.', 'Hasta 50 cc.', 'Cualquier motocicleta.'], correcta: 0,
      explicacion: 'El A1 autoriza motos de hasta 125 cc y 11 kW (con una relación potencia/peso de hasta 0,1 kW/kg).' },
    { tema: 'moto', pregunta: '¿Qué potencia máxima pueden tener las motos del permiso A2?',
      opciones: ['35 kW.', '11 kW.', 'No hay límite.'], correcta: 0,
      explicacion: 'El A2 autoriza motocicletas de hasta 35 kW (y una relación potencia/peso de hasta 0,2 kW/kg).' },
    { tema: 'moto', pregunta: 'Para frenar en recta con una moto, ¿qué es lo más eficaz?',
      opciones: ['Usar los dos frenos a la vez; el delantero es el que más frena.', 'Usar solo el freno trasero.', 'Usar solo el freno motor.'], correcta: 0,
      explicacion: 'En seco, el freno delantero aporta la mayor parte de la frenada; combinarlo con el trasero da estabilidad.' },
    { tema: 'moto', pregunta: '¿Dónde conviene reducir la velocidad al llegar a una curva con la moto?',
      opciones: ['Antes de la curva, con la moto recta.', 'En mitad de la curva, inclinado.', 'A la salida de la curva.'], correcta: 0,
      explicacion: 'Frenar inclinado puede hacer perder adherencia: se frena en recta antes de la curva y se traza con gas suave.' },
    { tema: 'moto', pregunta: 'Con lluvia, ¿qué zonas son especialmente deslizantes para una moto?',
      opciones: ['Las marcas viales pintadas y las tapas de alcantarilla.', 'El asfalto rugoso.', 'Ninguna: la lluvia mejora el agarre.'], correcta: 0,
      explicacion: 'La pintura, las tapas metálicas y las manchas de aceite resbalan mucho cuando están mojadas.' },
    { tema: 'moto', pregunta: '¿Por qué es peligroso circular en el ángulo muerto de un coche o un camión?',
      opciones: ['Porque su conductor puede no verte al cambiar de carril o girar.', 'Porque se gasta más combustible.', 'No es peligroso en ciudad.'], correcta: 0,
      explicacion: 'Las motos son estrechas y fáciles de perder de vista: hay que hacerse ver y no quedarse en los ángulos muertos.' },
    { tema: 'moto', pregunta: '¿Cada cuánto pasa la ITV una motocicleta de más de 4 años?',
      opciones: ['Cada 2 años.', 'Cada año.', 'Cada 5 años.'], correcta: 0,
      explicacion: 'Las motocicletas pasan la primera ITV a los 4 años y, después, cada 2 años.' },
    { tema: 'moto', pregunta: '¿De qué partes consta el examen práctico del permiso de moto?',
      opciones: ['Pruebas de destreza en circuito cerrado y circulación en vías abiertas al tráfico.', 'Solo circulación por ciudad.', 'Solo un test en el ordenador.'], correcta: 0,
      explicacion: 'Primero se hacen las maniobras en pista (como el slalom, el paso lento por un pasillo o la frenada) y después la prueba en circulación.' },
    { tema: 'moto', pregunta: 'En moto, ¿por qué hay que girar la cabeza además de mirar los retrovisores antes de cambiar de carril?',
      opciones: ['Porque los retrovisores tienen ángulos muertos.', 'No hace falta si se pone el intermitente.', 'Solo hay que hacerlo de noche.'], correcta: 0,
      explicacion: 'Un vistazo por encima del hombro cubre la zona que no muestran los espejos.' },

    // PRIORIDAD
    { tema: 'prioridad', pregunta: 'En una intersección sin señalizar, ¿quién tiene prioridad?',
      opciones: ['Los vehículos que se aproximan por la derecha.', 'Los vehículos que se aproximan por la izquierda.', 'El vehículo que circula más rápido.'], correcta: 0,
      explicacion: 'Si no hay señales, semáforos ni agentes, la regla general es ceder el paso a los que vienen por tu derecha.' },
    { tema: 'prioridad', pregunta: 'En una glorieta, ¿quién tiene prioridad, salvo señalización en contra?',
      opciones: ['Los que ya circulan dentro de la glorieta.', 'Los que quieren entrar en ella.', 'Los que vienen por la derecha para entrar.'], correcta: 0,
      explicacion: 'Los vehículos que están dentro de la glorieta tienen preferencia sobre los que pretenden entrar.' },
    { tema: 'prioridad', pregunta: '¿Qué orden de prioridad tienen las indicaciones en la vía?',
      opciones: ['Agentes, señalización circunstancial, semáforos, señales verticales y marcas viales.', 'Semáforos, agentes, señales verticales y marcas viales.', 'Señales verticales, semáforos, marcas viales y agentes.'], correcta: 0,
      explicacion: 'Las órdenes de los agentes prevalecen sobre todo; después van la señalización circunstancial (balizas, conos), los semáforos, las señales verticales y, por último, las marcas viales.' },
    { tema: 'prioridad', pregunta: 'Un semáforo está en verde, pero un agente te indica que te detengas. ¿Qué haces?',
      opciones: ['Me detengo: manda el agente.', 'Paso, porque el semáforo está en verde.', 'Paso despacio y con precaución.'], correcta: 0,
      explicacion: 'Las órdenes de los agentes prevalecen sobre los semáforos y las señales.' },
    { tema: 'prioridad', pregunta: 'Ante una señal de STOP en la que no viene ningún vehículo, ¿debes detenerte?',
      opciones: ['Sí, siempre hay que detenerse por completo.', 'No, si no viene nadie basta con reducir la velocidad.', 'Solo de noche.'], correcta: 0,
      explicacion: 'El STOP obliga a detenerse completamente aunque no venga nadie, y después ceder el paso.' },
    { tema: 'prioridad', pregunta: 'Ante una señal de «ceda el paso» y sin ningún vehículo a la vista, ¿estás obligado a detenerte?',
      opciones: ['No; solo debo ceder el paso si viene alguien.', 'Sí, siempre.', 'Sí, y además debo tocar el claxon.'], correcta: 0,
      explicacion: 'El ceda el paso no obliga a parar: obliga a no entorpecer a quien circule por la otra vía.' },
    { tema: 'prioridad', pregunta: 'Oyes la sirena y ves las luces de una ambulancia en servicio de urgencia detrás de ti. ¿Qué haces?',
      opciones: ['Facilitar su paso apartándome, normalmente hacia la derecha, y detenerme si hace falta.', 'Acelerar para que no me alcance.', 'Seguir igual: tengo prioridad en mi carril.'], correcta: 0,
      explicacion: 'Los vehículos de urgencia en servicio tienen prioridad: hay que dejarles paso de forma segura.' },
    { tema: 'prioridad', pregunta: 'El semáforo se pone en verde, pero el cruce está ocupado por vehículos detenidos. ¿Qué haces?',
      opciones: ['Espero antes de la línea hasta poder cruzar sin quedarme dentro.', 'Entro en el cruce porque tengo verde.', 'Toco el claxon para que se aparten.'], correcta: 0,
      explicacion: 'No debes entrar en una intersección si vas a quedarte detenido dentro y bloquear el paso a los demás.' },
    { tema: 'prioridad', pregunta: 'Vas a girar a la izquierda en un cruce y viene un vehículo de frente que sigue recto. ¿Quién pasa primero?',
      opciones: ['El que sigue recto; yo espero.', 'Yo, porque ya he puesto el intermitente.', 'El que llegue antes al centro del cruce.'], correcta: 0,
      explicacion: 'Quien gira a la izquierda debe ceder el paso a los vehículos que vienen de frente.' },
    // VELOCIDAD
    { tema: 'velocidad', pregunta: '¿Cuál es la velocidad máxima genérica en una calle urbana con un único carril por sentido?',
      opciones: ['30 km/h', '50 km/h', '40 km/h'], correcta: 0,
      explicacion: 'Desde 2021: 30 km/h en vías con un único carril por sentido, 50 km/h con dos o más carriles por sentido y 20 km/h en plataforma única.' },
    { tema: 'velocidad', pregunta: '¿Y en una vía urbana con dos o más carriles por sentido?',
      opciones: ['50 km/h', '30 km/h', '60 km/h'], correcta: 0,
      explicacion: 'Las vías urbanas con dos o más carriles por sentido tienen un límite genérico de 50 km/h.' },
    { tema: 'velocidad', pregunta: '¿Cuál es el límite en una calle de plataforma única (calzada y acera al mismo nivel)?',
      opciones: ['20 km/h', '30 km/h', '10 km/h'], correcta: 0,
      explicacion: 'En las vías de plataforma única el límite genérico es de 20 km/h.' },
    { tema: 'velocidad', pregunta: '¿Cuál es la velocidad máxima de un turismo en autopista y autovía?',
      opciones: ['120 km/h', '130 km/h', '100 km/h'], correcta: 0,
      explicacion: 'Para turismos y motos, el límite en autopistas y autovías es 120 km/h.' },
    { tema: 'velocidad', pregunta: '¿Cuál es la velocidad máxima de un turismo en una carretera convencional?',
      opciones: ['90 km/h', '100 km/h', '80 km/h'], correcta: 0,
      explicacion: 'Desde 2019 el límite genérico de turismos y motos en carreteras convencionales es 90 km/h.' },
    { tema: 'velocidad', pregunta: 'Si duplicas la velocidad, ¿cómo cambia la distancia de frenado?',
      opciones: ['Se multiplica aproximadamente por cuatro.', 'Se duplica.', 'No cambia si los frenos están bien.'], correcta: 0,
      explicacion: 'La distancia de frenado depende del cuadrado de la velocidad: el doble de velocidad son unas cuatro veces más metros.' },
    { tema: 'velocidad', pregunta: '¿Qué es la distancia de seguridad?',
      opciones: ['La que permite detenerte sin chocar si frena el vehículo de delante.', 'La distancia de un coche de largo.', 'La que te separa de la acera.'], correcta: 0,
      explicacion: 'Debes dejar espacio suficiente para detenerte ante un frenazo del que va delante. Una buena referencia en seco son al menos 2 segundos.' },
    { tema: 'velocidad', pregunta: 'La distancia de detención total es la suma de…',
      opciones: ['La distancia recorrida durante el tiempo de reacción y la de frenado.', 'La distancia de frenado y la de seguridad.', 'Solo la distancia de frenado.'], correcta: 0,
      explicacion: 'Mientras reaccionas (alrededor de un segundo) el coche sigue avanzando a la misma velocidad; después empieza a frenar.' },
    { tema: 'velocidad', pregunta: 'Con lluvia, ¿qué debes hacer con la distancia de seguridad?',
      opciones: ['Aumentarla, porque el coche necesita más metros para frenar.', 'Reducirla para ver mejor al de delante.', 'Mantenerla igual.'], correcta: 0,
      explicacion: 'Con el asfalto mojado la adherencia baja y la distancia de frenado aumenta: hay que dejar más espacio.' },
    // PEATONES Y VULNERABLES
    { tema: 'peatones', pregunta: 'Un peatón espera en el bordillo de un paso de cebra sin semáforo. ¿Qué haces?',
      opciones: ['Me detengo y le cedo el paso.', 'Paso deprisa antes de que baje.', 'Toco el claxon para avisarle.'], correcta: 0,
      explicacion: 'En los pasos para peatones sin semáforo, el conductor debe ceder el paso a los peatones que estén cruzando o vayan a hacerlo.' },
    { tema: 'peatones', pregunta: 'Giras en un cruce y en la calle a la que entras hay peatones cruzando. ¿Quién tiene prioridad?',
      opciones: ['Los peatones.', 'Yo, porque el semáforo está en verde para mí.', 'Quien llegue primero.'], correcta: 0,
      explicacion: 'Al girar, debes ceder el paso a los peatones que crucen la calzada a la que te incorporas, aunque no haya paso señalizado.' },
    { tema: 'peatones', pregunta: '¿Qué separación lateral mínima debes dejar al adelantar a un ciclista?',
      opciones: ['1,5 metros.', '0,5 metros.', '1 metro.'], correcta: 0,
      explicacion: 'Al adelantar a ciclistas hay que dejar al menos 1,5 m. En vías con dos o más carriles por sentido, hay que cambiar completamente de carril.' },
    { tema: 'peatones', pregunta: '¿Pueden los patinetes eléctricos circular por la acera?',
      opciones: ['No, tienen prohibido circular por las aceras y zonas peatonales.', 'Sí, si van despacio.', 'Sí, siempre.'], correcta: 0,
      explicacion: 'Los vehículos de movilidad personal (VMP) no pueden circular por aceras ni zonas peatonales.' },
    { tema: 'peatones', pregunta: 'En una calle residencial (S-28), los peatones…',
      opciones: ['Pueden usar toda la zona de circulación y tienen prioridad.', 'Deben ir siempre por la acera.', 'Solo pueden cruzar por los pasos de cebra.'], correcta: 0,
      explicacion: 'En las calles residenciales los peatones pueden ocupar toda la vía y tienen prioridad; el límite es 20 km/h.' },
    { tema: 'peatones', pregunta: 'Ves la señal de «Niños» (P-21). ¿Qué haces?',
      opciones: ['Reduzco la velocidad y presto mucha atención.', 'Toco el claxon para que se aparten.', 'Sigo igual si no veo a ninguno.'], correcta: 0,
      explicacion: 'La P-21 avisa de lugares con niños (colegios, parques). Pueden aparecer de repente: hay que ir muy despacio.' },
    // SEGURIDAD Y SALUD
    { tema: 'seguridad', pregunta: '¿Es obligatorio el cinturón de seguridad en ciudad?',
      opciones: ['Sí, en todas las vías y en todos los asientos.', 'Solo en autopista.', 'Solo en los asientos delanteros.'], correcta: 0,
      explicacion: 'El cinturón es obligatorio para todos los ocupantes y en todo tipo de vías, también en ciudad.' },
    { tema: 'seguridad', pregunta: '¿Cuántos puntos se pierden por conducir con el móvil en la mano?',
      opciones: ['6 puntos.', '3 puntos.', '1 punto.'], correcta: 0,
      explicacion: 'Desde 2022, sujetar el móvil con la mano mientras conduces supone perder 6 puntos.' },
    { tema: 'seguridad', pregunta: '¿Con cuántos puntos empieza el permiso de un conductor novel?',
      opciones: ['8 puntos.', '12 puntos.', '15 puntos.'], correcta: 0,
      explicacion: 'Los conductores con menos de 3 años de antigüedad empiezan con 8 puntos; el saldo general es de 12 (y se puede llegar a 15).' },
    { tema: 'seguridad', pregunta: '¿Cuál es la única forma de eliminar el alcohol del organismo?',
      opciones: ['Esperar el tiempo necesario.', 'Tomar café.', 'Comer algo y beber agua.'], correcta: 0,
      explicacion: 'El café, el agua o la comida no aceleran la eliminación del alcohol: solo el tiempo lo hace. Lo más seguro: si bebes, no conduzcas.' },
    { tema: 'seguridad', pregunta: '¿Cómo afecta el alcohol a la conducción?',
      opciones: ['Aumenta el tiempo de reacción y da una falsa sensación de seguridad.', 'Mejora los reflejos si se toma poco.', 'Solo afecta a la vista.'], correcta: 0,
      explicacion: 'Incluso en pequeñas cantidades, el alcohol retrasa las reacciones, reduce el campo visual y hace que se asuman más riesgos.' },
    { tema: 'seguridad', pregunta: 'En un viaje largo, ¿cada cuánto se recomienda descansar?',
      opciones: ['Cada 2 horas o unos 200 km.', 'Cada 5 horas.', 'Solo cuando tengas sueño.'], correcta: 0,
      explicacion: 'La fatiga reduce la atención. Se recomienda parar unos minutos cada 2 horas o 200 km.' },
    { tema: 'seguridad', pregunta: '¿Desde qué altura pueden los niños dejar de usar sistema de retención infantil y usar solo el cinturón?',
      opciones: ['Cuando miden más de 135 cm (se recomienda hasta 150 cm).', 'Cuando cumplen 6 años.', 'Cuando pesan más de 20 kg.'], correcta: 0,
      explicacion: 'Los menores de 135 cm de altura deben usar un sistema de retención infantil homologado adecuado a su talla y peso.' },
    { tema: 'seguridad', pregunta: '¿Cuál es la profundidad mínima legal del dibujo de los neumáticos de un turismo?',
      opciones: ['1,6 mm.', '0,5 mm.', '3 mm.'], correcta: 0,
      explicacion: 'El mínimo legal es 1,6 mm en las ranuras principales; con menos, el coche pierde agarre, sobre todo con lluvia.' },
    { tema: 'seguridad', pregunta: 'Desde 2026, si tu coche queda inmovilizado en la calzada de una carretera, ¿qué debes usar para señalizarlo?',
      opciones: ['La luz de emergencia V-16 conectada.', 'Los triángulos de emergencia.', 'Solo las luces de emergencia del coche.'], correcta: 0,
      explicacion: 'Desde el 1 de enero de 2026 la baliza V-16 conectada sustituye a los triángulos y evita tener que caminar por la calzada.' },
    { tema: 'seguridad', pregunta: '¿Cuándo es obligatorio ponerse el chaleco reflectante?',
      opciones: ['Al salir del vehículo en una vía interurbana (calzada o arcén).', 'Siempre que conduzcas de noche.', 'Solo si llueve.'], correcta: 0,
      explicacion: 'Si tienes que salir del coche en la calzada o el arcén de una vía interurbana, debes llevar el chaleco puesto para que te vean.' },
    // NORMAS Y MANIOBRAS
    { tema: 'normas', pregunta: '¿Se puede pisar una línea longitudinal continua?',
      opciones: ['No, ni pisarla ni rebasarla.', 'Sí, para adelantar a un vehículo lento.', 'Sí, si no viene nadie.'], correcta: 0,
      explicacion: 'La línea continua no se puede pisar ni cruzar (salvo casos muy concretos como un obstáculo que ocupe tu carril, con precaución).' },
    { tema: 'normas', pregunta: 'Para girar a la derecha, ¿cómo debes colocarte?',
      opciones: ['Lo más cerca posible del borde derecho de la calzada.', 'En el centro de la calzada.', 'Junto al eje de la calzada.'], correcta: 0,
      explicacion: 'Para girar a la derecha hay que ceñirse al borde derecho; para girar a la izquierda en doble sentido, acercarse al eje.' },
    { tema: 'normas', pregunta: 'En una calle de doble sentido, para girar a la izquierda te colocas…',
      opciones: ['Lo más cerca posible del eje (centro) de la calzada, sin invadir el carril contrario.', 'Pegado al borde derecho.', 'En el carril contrario.'], correcta: 0,
      explicacion: 'Antes de girar a la izquierda en doble sentido hay que acercarse al eje, señalizar y ceder el paso a los que vienen de frente.' },
    { tema: 'normas', pregunta: 'En una calle de sentido único, para girar a la izquierda te colocas…',
      opciones: ['Junto al borde izquierdo de la calzada.', 'Junto al borde derecho.', 'En el centro.'], correcta: 0,
      explicacion: 'En las vías de sentido único, el giro a la izquierda se prepara ciñéndose al borde izquierdo.' },
    { tema: 'normas', pregunta: '¿Cuándo hay que poner el intermitente?',
      opciones: ['Con antelación suficiente antes de girar, cambiar de carril o salir de un estacionamiento.', 'Justo en el momento de girar.', 'Solo si hay otros vehículos cerca.'], correcta: 0,
      explicacion: 'El intermitente avisa a los demás de lo que vas a hacer: tiene que encenderse antes de la maniobra, no durante.' },
    { tema: 'normas', pregunta: '¿Cuál es el recorrido máximo permitido marcha atrás?',
      opciones: ['15 metros, y sin invadir un cruce.', '50 metros.', 'No hay límite si se hace despacio.'], correcta: 0,
      explicacion: 'La marcha atrás solo se permite como maniobra complementaria, con un recorrido máximo de 15 m y sin invadir intersecciones.' },
    { tema: 'normas', pregunta: '¿Qué diferencia hay entre parada y estacionamiento?',
      opciones: ['La parada dura menos de 2 minutos y el conductor no abandona el vehículo.', 'La parada solo se hace en gasolineras.', 'No hay ninguna diferencia.'], correcta: 0,
      explicacion: 'Parada: inmovilización de menos de 2 minutos sin que el conductor salga. Si dura más o el conductor sale, es estacionamiento.' },
    { tema: 'normas', pregunta: '¿Se puede estacionar en doble fila?',
      opciones: ['No, está prohibido.', 'Sí, con las luces de emergencia.', 'Sí, durante menos de 5 minutos.'], correcta: 0,
      explicacion: 'Estacionar en doble fila está prohibido; además entorpece la circulación y a los vehículos de emergencia.' },
    { tema: 'normas', pregunta: '¿Cuándo se puede usar el claxon en ciudad?',
      opciones: ['Solo para evitar un posible accidente.', 'Para saludar.', 'Para meter prisa al de delante.'], correcta: 0,
      explicacion: 'En vía urbana el claxon solo debe usarse para evitar un accidente.' },
    { tema: 'normas', pregunta: '¿Puedes conducir con auriculares conectados a un reproductor de música?',
      opciones: ['No, está prohibido.', 'Sí, si el volumen es bajo.', 'Sí, con un solo auricular.'], correcta: 0,
      explicacion: 'Está prohibido conducir con cascos o auriculares conectados a reproductores de sonido: impiden oír sirenas, cláxones o peatones.' },
    { tema: 'normas', pregunta: '¿A qué edad se puede obtener el permiso de conducir B (turismos)?',
      opciones: ['A los 18 años.', 'A los 16 años.', 'A los 17 años.'], correcta: 0,
      explicacion: 'La edad mínima para el permiso B es de 18 años.' },
    { tema: 'normas', pregunta: '¿Cuándo pasa un turismo particular nuevo su primera ITV?',
      opciones: ['A los 4 años; después cada 2 años y, a partir de los 10, cada año.', 'Al año de comprarlo.', 'A los 10 años.'], correcta: 0,
      explicacion: 'La primera inspección se hace a los 4 años, después es bienal y, a partir de los 10 años, anual.' },
    { tema: 'normas', pregunta: 'Te acercas a un semáforo en ámbar fijo y puedes detenerte con seguridad. ¿Qué haces?',
      opciones: ['Me detengo.', 'Acelero para pasar antes del rojo.', 'Paso, porque el ámbar aún permite pasar.'], correcta: 0,
      explicacion: 'El ámbar fijo obliga a parar, salvo que estés tan cerca que no puedas hacerlo con seguridad.' },
];

/** Preguntas de señales generadas a partir del catálogo. */
function preguntasDeSenales() {
    const out = [];
    SENALES.forEach(s => {
        const mismas = SENALES.filter(o => o.id !== s.id && o.nombre !== s.nombre);
        const deCategoria = mismas.filter(o => o.categoria === s.categoria);
        const pool = (deCategoria.length >= 2 ? deCategoria : mismas);
        out.push({
            id: `S_${s.id}`, tema: 'senales', senal: s.id, generada: true,
            pregunta: '¿Qué indica esta señal?',
            _correcta: s.nombre, _pool: pool.map(o => o.nombre),
            explicacion: `${s.nombre}${s.codigo && !/Semáforo|Agente|Marca/.test(s.codigo) ? ` (${s.codigo})` : ''}: ${s.descripcion}`,
        });
        if (s.accion) {
            out.push({
                id: `SA_${s.id}`, tema: 'senales', senal: s.id, generada: true,
                pregunta: 'Ante esta señal, ¿qué debes hacer?',
                _correcta: s.accion, _pool: pool.filter(o => o.accion).map(o => o.accion),
                explicacion: `${s.nombre}: ${s.descripcion}`,
            });
        }
    });
    return out;
}

const barajar = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
};

/** Convierte una pregunta del banco a { pregunta, opciones (barajadas), correcta, explicacion, senal } */
function materializar(p) {
    if (p.generada) {
        const malas = barajar([...new Set(p._pool.filter(x => x !== p._correcta))]).slice(0, 2);
        const ops = barajar([p._correcta, ...malas]);
        return { id: p.id, tema: p.tema, senal: p.senal, pregunta: p.pregunta, opciones: ops, correcta: ops.indexOf(p._correcta), explicacion: p.explicacion };
    }
    const orden = barajar([0, 1, 2]);
    return { id: p.id, tema: p.tema, senal: p.senal || null, pregunta: p.pregunta, opciones: orden.map(i => p.opciones[i]), correcta: orden.indexOf(p.correcta), explicacion: p.explicacion };
}

export const BANCO_TEST = [...MANUALES.map((p, i) => ({ ...p, id: `M${i}` })), ...preguntasDeSenales()];

export const contarPorTema = () => Object.fromEntries(TEMAS_TEST.map(t => [t.id, BANCO_TEST.filter(p => p.tema === t.id).length]));

/**
 * Genera un test.
 * - modo 'examen': 30 preguntas mezclando temas (≈ 1/3 de señales).
 * - temas: lista de ids de tema (vacío = todos).
 */
export function generarTest({ n = 30, temas = [], modo = 'practica' } = {}) {
    let pool = BANCO_TEST.filter(p => !temas.length || temas.includes(p.tema));
    if (modo === 'examen_moto') {
        // Examen tipo permiso A2: ≈ 1/3 de moto, ≈ 1/4 de señales y el resto general
        const moto = barajar(BANCO_TEST.filter(p => p.tema === 'moto')).slice(0, Math.round(n / 3));
        const vistas = new Set();
        const sen = barajar(BANCO_TEST.filter(p => p.tema === 'senales')).filter(p => (vistas.has(p.senal) ? false : vistas.add(p.senal))).slice(0, Math.round(n / 4));
        const resto = barajar(BANCO_TEST.filter(p => p.tema !== 'senales' && p.tema !== 'moto')).slice(0, n - moto.length - sen.length);
        return barajar([...moto, ...sen, ...resto]).map(materializar);
    }
    if (modo === 'examen') {
        const senales = barajar(BANCO_TEST.filter(p => p.tema === 'senales'));
        const resto = barajar(BANCO_TEST.filter(p => p.tema !== 'senales' && p.tema !== 'moto'));
        const nSen = Math.round(n / 3);
        // Una sola pregunta por señal para no repetir la misma imagen
        const vistas = new Set();
        const sen = senales.filter(p => (vistas.has(p.senal) ? false : vistas.add(p.senal))).slice(0, nSen);
        pool = barajar([...sen, ...resto.slice(0, n - sen.length)]);
        return pool.map(materializar);
    }
    const vistas = new Set();
    pool = barajar(pool).filter(p => !p.senal || (vistas.has(p.senal) ? false : vistas.add(p.senal)));
    return pool.slice(0, n).map(materializar);
}

export { SENAL_POR_ID };
