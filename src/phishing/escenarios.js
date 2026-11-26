// Escenarios de «¿Phishing o legítimo?» — dos tests: alumnos y profes.
// Todo es ficticio (IES Río Verde, BancoNorte…) y ningún enlace lleva a ninguna parte.
//
// Tipos: 'email' | 'web' | 'sms' | 'whatsapp' | 'instagram'
// `pista: n` marca un elemento con el número n de `pistas` (1-based) al corregir.
// Marcadores en textos: {nombre} y {email} (los datos que escribe el jugador, no se guardan).
//
// email.cuerpo: string | { p, pista } | { cabecera, color } | { boton, url, pista, color }
//               | { enlace, url, pista } | { codigo } | { firma }
// email.detalles: { responderA, enviadoPor, firmadoPor, seguridad } — cada valor string o { v, pista }
// adjuntos: [{ nombre, tipo: 'pdf'|'zip'|'xls'|'htm'|'exe'|'doc'|'img', tamano, pista }]
// chat.mensajes: [{ yo?, hora, partes: [string | { t, pista } | { enlace, url, pista }] }]

export const ESCENARIOS_ALUMNOS = [
    {
        id: 'a-cuenta', titulo: 'Tu cuenta se cerrará en 24 horas', tipo: 'email', respuesta: 'phishing',
        de: { nombre: 'Soporte Google Workspace', email: 'soporte@g00gle-educacion.com', pista: 1 },
        detalles: { responderA: { v: 'verificacion.cuentas2026@gmail.com', pista: 1 }, enviadoPor: 'mail-relay.g00gle-educacion.com', seguridad: 'Cifrado estándar (TLS)' },
        asunto: '⚠️ Tu cuenta de alumno se cerrará en 24 horas', asuntoPista: 2, fecha: 'hoy, 7:52',
        cuerpo: [
            { cabecera: 'Google Workspace for Education', color: '#5f6368' },
            { p: 'Estimado usuario:', pista: 3 },
            'Hemos detectado actividad inusual en tu cuenta del centro educativo.',
            { p: 'Si no verificas tu contraseña en las próximas 24 horas, tu cuenta se eliminará junto con todos tus trabajos y correos.', pista: 2 },
            { boton: 'Verificar mi cuenta', url: 'http://g00gle-educacion.com/login/verify?id=88213', pista: 4 },
            { firma: '© 2026 Google Workspace Security Team' },
        ],
        pistas: [
            'El remitente escribe «g00gle» con ceros y el dominio no es google.com. Además, si respondes, el correo va a una cuenta de Gmail cualquiera.',
            'Te asusta y te mete prisa («24 horas», «se eliminará todo») para que no te pares a pensar.',
            '«Estimado usuario»: no sabe ni cómo te llamas. Los avisos reales suelen usar tu nombre.',
            'El botón lleva a g00gle-educacion.com y además sin https. Ningún servicio serio te pide la contraseña por correo.',
        ],
        consejo: 'Si te llega un aviso sobre tu cuenta, no pulses el enlace: entra tú escribiendo la dirección de siempre.',
    },
    {
        id: 'a-classroom', titulo: 'Nueva tarea en Classroom', tipo: 'email', respuesta: 'legit',
        de: { nombre: 'Google Classroom', email: 'no-reply@classroom.google.com', pista: 1 },
        detalles: { enviadoPor: 'classroom.google.com', firmadoPor: { v: 'classroom.google.com', pista: 1 }, seguridad: 'Cifrado estándar (TLS)' },
        asunto: 'Nueva tarea: «Ecuaciones de segundo grado»', fecha: 'hoy, 9:14',
        cuerpo: [
            { cabecera: 'Google Classroom', color: '#1e8e3e' },
            'Hola, {nombre}:',
            { p: 'Martín Lacasa ha publicado una tarea nueva en Matemáticas 3.º ESO B.', pista: 2 },
            'Fecha de entrega: viernes, 23:59',
            { boton: 'Abrir', url: 'https://classroom.google.com/c/NjQ4MjE5/a/ODEyMzQ1/details', pista: 3, color: '#1e8e3e' },
            { firma: 'Recibes este correo porque estás en Matemáticas 3.º ESO B. Puedes cambiar las notificaciones en los ajustes de Classroom.' },
        ],
        pistas: [
            'Viene de classroom.google.com y los detalles dicen que está firmado por ese mismo dominio.',
            'Encaja con algo que esperas: una tarea de tu profe en una clase en la que estás.',
            'El enlace lleva a classroom.google.com y no te pide ningún dato.',
        ],
        consejo: 'Aunque sea real, si tienes dudas abre Classroom desde la app o escribiendo tú la dirección.',
    },
    {
        id: 'a-instagram', titulo: 'Has ganado un iPhone', tipo: 'instagram', respuesta: 'phishing',
        contacto: { nombre: 'instagram.premios.oficial', sub: 'Instagram · 312 seguidores', pista: 1 },
        mensajes: [
            { hora: '18:03', partes: [{ t: '🎉 ¡ENHORABUENA {nombre}! Has sido elegido/a en nuestro sorteo mensual para ganar un iPhone 17 Pro.', pista: 2 }] },
            { hora: '18:03', partes: [{ t: 'Para reclamarlo, inicia sesión con tu cuenta de Instagram antes de las 23:59 o se lo daremos a otra persona ⏰', pista: 3 }] },
            { hora: '18:04', partes: [{ enlace: 'bit.ly/premio-ig-17', url: 'https://bit.ly/premio-ig-17  →  instagram-premios.claim-now.top/login', pista: 4 }] },
        ],
        pistas: [
            'Instagram no te escribe por mensaje privado. Una cuenta con «oficial» en el nombre y 312 seguidores no es Instagram.',
            'No has participado en ningún sorteo: si es demasiado bueno para ser verdad, no es verdad.',
            'Prisa + «inicia sesión» = quieren tu contraseña.',
            'El enlace está acortado para que no veas adónde lleva de verdad: una web que no es instagram.com.',
        ],
        consejo: 'Nunca inicies sesión desde un enlace que te llega por mensaje. Bloquea y denuncia la cuenta.',
    },
    {
        id: 'a-mama', titulo: 'Hola mamá, número nuevo', tipo: 'whatsapp', respuesta: 'phishing',
        contacto: { nombre: '+34 612 77 90 31', sub: 'en línea', pista: 1 },
        mensajes: [
            { hora: '11:20', partes: ['Hola mamá, se me ha caído el móvil al agua y este es mi número nuevo 😩'] },
            { hora: '11:20', partes: [{ t: '¿Me puedes hacer un Bizum de 150 €? Es para pagar una cosa del insti y es urgente', pista: 2 }] },
            { hora: '11:21', partes: [{ t: 'Ahora no puedo hablar, luego te explico 🙏', pista: 3 }] },
        ],
        pistas: [
            'Un número desconocido que dice ser alguien de tu familia.',
            'Pide dinero con urgencia.',
            'Evita la llamada para que nadie pueda comprobar quién es.',
        ],
        consejo: 'Llama al número de siempre o pregunta algo que solo esa persona sabría. Avisa a tu familia de este timo, es de los más comunes.',
    },
    {
        id: 'a-web-falsa', titulo: 'Página para iniciar sesión (enlace de un mensaje)', tipo: 'web', respuesta: 'phishing',
        contexto: 'Has llegado aquí pulsando un enlace de un mensaje que decía: «Tu profe ha compartido las notas de la evaluación, mira la tuya».',
        contextoPista: 3,
        url: 'https://accounts.google.com.inicio-seguro.net/signin?continue=classroom', urlPista: 1, candadoPista: 2,
        pestana: 'Iniciar sesión - Cuentas',
        pagina: { marca: 'Google', titulo: 'Iniciar sesión', sub: 'para ir a Classroom', campos: ['email', 'password'], boton: 'Siguiente' },
        pistas: [
            'Lee la dirección hasta la primera «/»: el dominio de verdad es lo que va justo antes, inicio-seguro.net, no google.com. Todo lo de delante es decorado.',
            'El candado solo significa que la conexión va cifrada. Las webs falsas también lo tienen.',
            'Has llegado desde un enlace de un mensaje inesperado y muy tentador (las notas).',
        ],
        consejo: 'Para iniciar sesión, escribe tú la dirección o usa un marcador guardado. Nunca desde un enlace que te llega.',
    },
    {
        id: 'a-web-real', titulo: 'Página para iniciar sesión (escribiendo tú la dirección)', tipo: 'web', respuesta: 'legit',
        contexto: 'Has escrito tú classroom.google.com en el navegador y te ha llevado a esta página para iniciar sesión.',
        contextoPista: 2,
        url: 'https://accounts.google.com/v3/signin/identifier?continue=https://classroom.google.com', urlPista: 1,
        pestana: 'Iniciar sesión: Cuentas de Google',
        pagina: { marca: 'Google', titulo: 'Iniciar sesión', sub: 'Ir a Google Classroom', campos: ['email'], boton: 'Siguiente' },
        pistas: [
            'El dominio, justo antes de la primera «/», es accounts.google.com: la página real.',
            'Llegaste escribiendo tú la dirección, no desde un enlace que te mandó alguien.',
        ],
        consejo: 'Este es el camino seguro: escribir tú la dirección. Además, activa la verificación en dos pasos.',
    },
    {
        id: 'a-robux', titulo: '10.000 Robux gratis', tipo: 'email', respuesta: 'phishing',
        de: { nombre: 'Roblox Rewards', email: 'rewards@roblox-support-team.net', pista: 1 },
        detalles: { enviadoPor: 'sendmail-bulk.roblox-support-team.net', seguridad: 'Sin cifrado' },
        asunto: '🎁 10.000 Robux GRATIS por nuestro aniversario', asuntoPista: 2, fecha: 'ayer, 21:37',
        cuerpo: [
            { cabecera: 'ROBLOX · 20 ANIVERSARIO', color: '#111' },
            '¡Hola, jugador/a!',
            { p: 'Por nuestro aniversario regalamos 10.000 Robux a los 500 primeros jugadores que los reclamen.', pista: 2 },
            { p: 'Solo tienes que escribir tu usuario y tu contraseña de Roblox en nuestra página de recompensas.', pista: 3 },
            { boton: 'Conseguir mis Robux', url: 'http://roblox-support-team.net/free-robux/claim', pista: 4, color: '#00b06f' },
        ],
        pistas: [
            'El dominio no es roblox.com, aunque contenga la palabra «roblox».',
            'Regalos gratis, enormes y «para los primeros»: el cebo clásico.',
            'Pide tu contraseña en una web que no es la oficial.',
            'El enlace va a roblox-support-team.net, una web falsa (y sin https).',
        ],
        consejo: 'No existen los «Robux gratis». Quien te los ofrece quiere quedarse con tu cuenta.',
    },
    {
        id: 'a-paquete', titulo: 'Tu paquete está retenido', tipo: 'sms', respuesta: 'phishing',
        contacto: { nombre: 'Correos', sub: 'SMS', pista: 1 },
        mensajes: [
            { hora: '13:05', partes: [{ t: 'Correos: Su paquete está retenido por tasas de aduana pendientes (1,99 €). Abone antes de 48 h o será devuelto al remitente: ', pista: 2 }, { enlace: 'correos-es.envios-pago.info/p/8KD2', url: 'https://correos-es.envios-pago.info/p/8KD2', pista: 3 }] },
        ],
        pistas: [
            'El nombre que aparece en un SMS se puede falsificar. Además, ¿esperabas un paquete?',
            'Una cantidad pequeña para que no lo pienses: lo que quieren son los datos de la tarjeta.',
            'El dominio real es envios-pago.info, no la web de Correos.',
        ],
        consejo: 'Si esperas un paquete, mira el seguimiento en la web o la app oficial escribiendo tú la dirección.',
    },
    {
        id: 'a-codigo', titulo: '¿Me pasas el código?', tipo: 'whatsapp', respuesta: 'phishing',
        contacto: { nombre: 'Lucía (clase) 💜', sub: 'en línea', pista: 1 },
        mensajes: [
            { hora: '20:41', partes: ['Oyee 😅'] },
            { hora: '20:41', partes: [{ t: '¿te acaba de llegar un código de 6 cifras por SMS?', pista: 2 }] },
            { hora: '20:42', partes: [{ t: 'te lo he mandado sin querer, me lo pasas porfa? es que si no me bloquean la cuenta 😭', pista: 3 }] },
        ],
        pistas: [
            'Puede ser la cuenta de tu amiga… pero robada. Los atacantes usan las cuentas de gente que conoces.',
            'Ese código sirve para entrar en TU WhatsApp desde otro móvil.',
            'Nadie «manda un código sin querer». Si lo das, pierdes tu cuenta y la usan para engañar a tus contactos.',
        ],
        consejo: 'Los códigos de verificación no se pasan a nadie, ni a tus amigos. Avisa a Lucía por otro medio: le han robado la cuenta.',
    },
    {
        id: 'a-alerta', titulo: 'Alerta de inicio de sesión', tipo: 'email', respuesta: 'legit',
        contexto: 'Hace un rato has iniciado sesión con tu cuenta en el ordenador nuevo de casa.',
        de: { nombre: 'Google', email: 'no-reply@accounts.google.com', pista: 1 },
        detalles: { enviadoPor: 'accounts.google.com', firmadoPor: 'accounts.google.com', seguridad: 'Cifrado estándar (TLS)' },
        asunto: 'Alerta de seguridad: nuevo inicio de sesión en Windows', fecha: 'hoy, 17:26',
        cuerpo: [
            { cabecera: 'Google', color: '#5f6368' },
            'Se ha iniciado sesión en {email} desde un dispositivo Windows nuevo.',
            { p: 'Si has sido tú, no tienes que hacer nada. Si no, te ayudaremos a proteger tu cuenta.', pista: 2 },
            { boton: 'Revisar actividad', url: 'https://myaccount.google.com/notifications', pista: 3 },
            { firma: 'También puedes ver la actividad de seguridad en https://myaccount.google.com/notifications' },
        ],
        pistas: [
            'Viene de accounts.google.com, el dominio real, y está firmado por él.',
            'No te amenaza ni te pide la contraseña, y coincide con algo que acabas de hacer.',
            'El enlace va a myaccount.google.com.',
        ],
        consejo: 'Aun siendo real, lo más seguro es entrar tú en myaccount.google.com sin usar el enlace.',
    },
    {
        id: 'a-notas', titulo: 'Notas finales compartidas', tipo: 'email', respuesta: 'phishing',
        de: { nombre: 'Secretaría IES Río Verde', email: 'secretaria@iesrioverde.es.notificaciones-edu.com', pista: 1 },
        detalles: { enviadoPor: 'notificaciones-edu.com', seguridad: 'Cifrado estándar (TLS)' },
        asunto: 'Documento compartido: Notas_finales_3ESO.pdf', fecha: 'hoy, 12:02',
        cuerpo: [
            'Se ha compartido contigo un documento.',
            { p: 'Notas_finales_3ESO.pdf — Para verlo, inicia sesión con la cuenta del centro.', pista: 2 },
            { boton: 'Abrir en Drive', url: 'https://drive-google.notificaciones-edu.com/view?doc=notas3eso', pista: 3 },
        ],
        pistas: [
            '¡Trampa! El dominio real es lo último: notificaciones-edu.com. Que empiece por iesrioverde.es no significa nada.',
            'Te pide iniciar sesión para ver algo muy tentador: las notas.',
            'El enlace no va a drive.google.com, sino a otra web que se le parece.',
        ],
        consejo: 'Lee el correo y los enlaces de derecha a izquierda: el dominio de verdad es lo que va justo antes de .com / .es.',
    },
    {
        id: 'a-jefatura', titulo: 'Calendario de exámenes', tipo: 'email', respuesta: 'legit',
        de: { nombre: 'Jefatura de Estudios · IES Río Verde', email: 'jefatura@iesrioverde.es', pista: 1 },
        detalles: { enviadoPor: 'iesrioverde.es', firmadoPor: 'iesrioverde.es', seguridad: 'Cifrado estándar (TLS)' },
        asunto: 'Calendario de exámenes de la 2.ª evaluación', fecha: 'lun, 8:30',
        cuerpo: [
            'Buenos días:',
            { p: 'Ya está disponible en la web del centro el calendario de exámenes de la 2.ª evaluación. Os lo adjuntamos también en PDF.', pista: 2 },
            { enlace: 'www.iesrioverde.es/calendario-examenes', url: 'https://www.iesrioverde.es/calendario-examenes', pista: 3 },
            { firma: 'Jefatura de Estudios · IES Río Verde' },
        ],
        adjuntos: [{ nombre: 'Calendario_examenes_2EV.pdf', tipo: 'pdf', tamano: '212 KB', pista: 2 }],
        pistas: [
            'Viene del dominio real del instituto: lo que va después de la @ es iesrioverde.es y nada más.',
            'Es información normal, sin amenazas ni prisas, y el adjunto es un PDF corriente.',
            'El enlace lleva a la web del propio centro y no pide contraseñas.',
        ],
        consejo: 'Fíjate siempre en lo que va justo después de la @ y en el dominio del enlace antes de la primera «/».',
    },
];

export const ESCENARIOS_PROFES = [
    {
        id: 'p-direccion', titulo: 'La directora necesita tarjetas regalo', tipo: 'email', respuesta: 'phishing',
        de: { nombre: 'Ana Beltrán (Dirección)', email: 'direccion.iesrioverde@gmail.com', pista: 1 },
        detalles: { responderA: { v: 'ana.beltran.direccion@outlook.com', pista: 1 }, enviadoPor: 'gmail.com', seguridad: 'Cifrado estándar (TLS)' },
        asunto: '¿Estás en el centro?', fecha: 'hoy, 10:17',
        cuerpo: [
            '{nombre}, ¿estás disponible?',
            { p: 'Necesito que me hagas un favor discreto. Estoy en una reunión en la Delegación y no puedo llamar.', pista: 3 },
            { p: 'Hay que comprar 5 tarjetas regalo de 100 € para un detalle con el claustro. Rasca los códigos, mándame una foto y te lo reembolso hoy mismo.', pista: 2 },
            { firma: 'Enviado desde mi iPhone' },
        ],
        pistas: [
            'El nombre es el de la directora, pero la dirección es un Gmail cualquiera, y si respondes va a otra cuenta de Outlook.',
            'Tarjetas regalo y fotos de los códigos: es dinero que no se puede rastrear ni recuperar.',
            'Urgencia + secreto + «no puedo llamar»: así te impiden comprobarlo.',
        ],
        consejo: 'Ante cualquier petición de dinero, llama o pregunta en persona usando el contacto que ya tenías. Es el «fraude del CEO», muy común en centros.',
    },
    {
        id: 'p-ms-password', titulo: 'Tu contraseña caduca hoy', tipo: 'email', respuesta: 'phishing',
        de: { nombre: 'Microsoft 365 · Administrador', email: 'it-admin@m1crosoft-365-support.com', pista: 1 },
        detalles: { enviadoPor: 'mta4.m1crosoft-365-support.com', seguridad: 'Cifrado estándar (TLS)' },
        asunto: 'Tu contraseña caduca hoy – acción necesaria', asuntoPista: 3, fecha: 'hoy, 8:03',
        cuerpo: [
            { cabecera: 'Microsoft 365', color: '#0078d4' },
            { p: 'Estimado/a usuario/a:', pista: 3 },
            'La contraseña de {email} caduca hoy a las 23:59.',
            { p: 'Para mantener tu contraseña actual y no perder el acceso a tu correo y a OneDrive, confírmala a continuación.', pista: 2 },
            { boton: 'Mantener la contraseña actual', url: 'https://m1crosoft-365-support.com/owa/keep-password?user=8812', pista: 4, color: '#0078d4' },
            { firma: 'Microsoft Corporation, One Microsoft Way, Redmond, WA 98052' },
        ],
        pistas: [
            '«m1crosoft» con un 1 en vez de i, y no es microsoft.com.',
            '«Mantener la contraseña actual» no existe: ningún sistema te pide confirmar la contraseña que ya tienes.',
            'Saludo genérico y plazo de horas: la fórmula de siempre.',
            'El botón lleva a m1crosoft-365-support.com, una web que solo quiere tu contraseña.',
        ],
        consejo: 'Si tu contraseña caduca de verdad, el aviso te sale al iniciar sesión en la web oficial. Avisa al coordinador TIC de estos correos.',
    },
    {
        id: 'p-drive', titulo: 'Documento compartido por un compañero', tipo: 'email', respuesta: 'legit',
        de: { nombre: 'Javier Ortega (a través de Google Docs)', email: 'drive-shares-dm-noreply@google.com', pista: 1 },
        detalles: { responderA: 'javier.ortega@iesrioverde.es', enviadoPor: 'google.com', firmadoPor: { v: 'google.com', pista: 1 }, seguridad: 'Cifrado estándar (TLS)' },
        asunto: 'Documento compartido contigo: «Programación didáctica 2.º ESO - Lengua»', fecha: 'mar, 16:45',
        contexto: 'En la reunión de departamento, Javier dijo que compartiría la programación para revisarla.',
        cuerpo: [
            { p: 'Javier Ortega (javier.ortega@iesrioverde.es) te ha invitado a editar el siguiente documento:', pista: 2 },
            '📄 Programación didáctica 2.º ESO - Lengua',
            { boton: 'Abrir', url: 'https://docs.google.com/document/d/1HqZ7pXk2vR9wLm/edit?usp=sharing_eip', pista: 3 },
            { firma: 'Google LLC, 1600 Amphitheatre Parkway, Mountain View, CA 94043, EE. UU. Has recibido este correo porque Javier Ortega ha compartido un documento contigo.' },
        ],
        pistas: [
            'Es la dirección real con la que Drive avisa de los documentos compartidos, y está firmado por google.com.',
            'Lo comparte un compañero con su dirección del centro, y es lo que dijo que haría.',
            'El enlace va a docs.google.com y no pide nada extra.',
        ],
        consejo: 'Si te comparten algo que no esperas, aunque el aviso sea real, pregunta antes al compañero.',
    },
    {
        id: 'p-justificante', titulo: 'Justificante de falta', tipo: 'email', respuesta: 'phishing',
        de: { nombre: 'Marta Gil', email: 'marta.gil.84@gmail.com' },
        detalles: { enviadoPor: 'gmail.com', seguridad: 'Cifrado estándar (TLS)' },
        asunto: 'Justificante falta de Lucas', fecha: 'hoy, 15:40',
        cuerpo: [
            'Buenas tardes:',
            { p: 'Le adjunto el justificante médico de la falta de ayer de mi hijo Lucas.', pista: 3 },
            { p: 'Por favor ábralo cuanto antes para que no le cuente como falta injustificada, que mañana es el plazo.', pista: 2 },
            'Un saludo, Marta',
        ],
        adjuntos: [{ nombre: 'Justificante_medico_Lucas.zip', tipo: 'zip', tamano: '18 KB', pista: 1 }],
        pistas: [
            'Un justificante médico es una foto o un PDF, no un .zip. Los comprimidos se usan para colar programas maliciosos sin que los detecte el correo.',
            'Prisa para que lo abras sin pensarlo.',
            'Datos genéricos: ¿tienes un alumno Lucas? ¿Tiene una madre llamada Marta Gil? Los atacantes prueban con nombres comunes.',
        ],
        consejo: 'No abras comprimidos ni archivos raros. Las familias deberían usar la plataforma del centro; si dudas, llama a la familia con el teléfono de la ficha.',
    },
    {
        id: 'p-hacienda', titulo: 'Reembolso de Hacienda', tipo: 'email', respuesta: 'phishing',
        de: { nombre: 'Agencia Tributaria', email: 'notificaciones@aeat-reembolsos.com', pista: 1 },
        detalles: { enviadoPor: 'aeat-reembolsos.com', seguridad: 'Sin cifrado' },
        asunto: 'Notificación: tiene un reembolso pendiente de 487,30 €', fecha: 'ayer, 19:12',
        cuerpo: [
            { cabecera: 'Agencia Tributaria', color: '#a50e1e' },
            { p: 'Estimado contribuyente:', pista: 3 },
            'Tras la revisión de su última declaración, le corresponde un reembolso de 487,30 €.',
            { p: 'Para recibirlo debe confirmar los datos de su tarjeta bancaria en un plazo de 48 horas. Pasado ese plazo perderá el derecho al reembolso.', pista: 2 },
            { boton: 'Acceder al reembolso', url: 'http://aeat-reembolsos.com/devolucion/confirmar-tarjeta', pista: 4, color: '#a50e1e' },
        ],
        pistas: [
            'La Agencia Tributaria usa dominios .gob.es, no aeat-reembolsos.com.',
            'Hacienda devuelve el dinero a la cuenta de la declaración: nunca pide la tarjeta ni pone plazos de 48 horas.',
            'Saludo genérico.',
            'El enlace no es https ni de un dominio .gob.es.',
        ],
        consejo: 'Las devoluciones se consultan entrando tú en la sede electrónica oficial, nunca desde un enlace.',
    },
    {
        id: 'p-web-ms', titulo: 'Página para iniciar sesión en Microsoft', tipo: 'web', respuesta: 'phishing',
        contexto: 'Has pulsado «Ver documento» en un correo que decía «Factura pendiente: revisión urgente».',
        contextoPista: 2,
        url: 'https://login.microsoftonline.com-auth-verify.site/common/oauth2/authorize', urlPista: 1, candadoPista: 3,
        pestana: 'Iniciar sesión en la cuenta',
        pagina: { marca: 'Microsoft', titulo: 'Iniciar sesión', sub: 'Para ver «Factura_0923.pdf», confirma tu cuenta.', campos: ['email', 'password'], boton: 'Iniciar sesión' },
        pistas: [
            'Mira lo que va justo antes de la primera «/»: com-auth-verify.site. El dominio real de Microsoft acaba en microsoftonline.com y aquí eso solo es decorado.',
            'Vienes de un correo inesperado que mete prisa con una factura.',
            'El candado no garantiza nada: solo dice que la conexión va cifrada hasta… la web del atacante.',
        ],
        consejo: 'Si ya has escrito la contraseña en una web así, cámbiala ya desde la web oficial y avisa al coordinador TIC.',
    },
    {
        id: 'p-claustro', titulo: 'Convocatoria de claustro', tipo: 'email', respuesta: 'legit',
        de: { nombre: 'Jefatura de Estudios', email: 'jefatura@iesrioverde.es', pista: 1 },
        detalles: { enviadoPor: 'iesrioverde.es', firmadoPor: 'iesrioverde.es', seguridad: 'Cifrado estándar (TLS)' },
        asunto: 'Convocatoria de claustro ordinario – jueves 16:30', fecha: 'lun, 9:02',
        cuerpo: [
            'Buenos días:',
            { p: 'Se convoca claustro ordinario el jueves a las 16:30 en el salón de actos, con el siguiente orden del día:', pista: 2 },
            '1. Lectura y aprobación del acta anterior (adjunta).\n2. Análisis de los resultados de la 1.ª evaluación.\n3. Ruegos y preguntas.',
            { firma: 'Jefatura de Estudios · IES Río Verde' },
        ],
        adjuntos: [{ nombre: 'Acta_claustro_anterior.pdf', tipo: 'pdf', tamano: '184 KB', pista: 3 }],
        pistas: [
            'Viene del dominio del centro y está firmado por él.',
            'Información habitual que esperas, sin prisas, dinero ni contraseñas.',
            'El adjunto es un PDF corriente y coherente con el mensaje.',
        ],
        consejo: 'Así es un correo normal. Aun así, si algo no te cuadra (un adjunto raro, una petición extraña), pregunta.',
    },
    {
        id: 'p-licencias', titulo: 'Licencias digitales que caducan', tipo: 'email', respuesta: 'phishing',
        de: { nombre: 'Editorial · Licencias Digitales', email: 'licencias@editorial-digital-renovacion.com', pista: 1 },
        detalles: { enviadoPor: 'mailer.editorial-digital-renovacion.com', seguridad: 'Cifrado estándar (TLS)' },
        asunto: 'Las licencias digitales de tus alumnos caducan el viernes', fecha: 'hoy, 7:30',
        cuerpo: [
            'Estimado/a docente:',
            { p: 'Las 27 licencias del libro digital de tus grupos caducan este viernes. Tus alumnos perderán el acceso al contenido y a todas sus actividades.', pista: 2 },
            { p: 'Renueva ahora con tu tarjeta (9,95 € por licencia). El centro te lo reembolsará después.', pista: 3 },
            { boton: 'Renovar licencias', url: 'https://editorial-digital-renovacion.com/pago?ref=27', pista: 4, color: '#f97316' },
        ],
        pistas: [
            'El remitente no es el dominio de ninguna editorial conocida, sino uno genérico creado para la ocasión.',
            'Presión con algo que te importa: tus alumnos se quedan sin material.',
            'Te pide pagar con tu tarjeta personal algo que gestiona el centro.',
            'El pago es en una web desconocida.',
        ],
        consejo: 'Las licencias las gestiona el centro o el coordinador TIC. Consulta antes de pagar nada.',
    },
    {
        id: 'p-factura', titulo: 'Factura pendiente con macros', tipo: 'email', respuesta: 'phishing',
        de: { nombre: 'Administración · Suministros Escolares Norte', email: 'facturas@suministros-norte.com' },
        detalles: { enviadoPor: 'suministros-norte.com', seguridad: 'Cifrado estándar (TLS)' },
        asunto: 'RE: Factura nº 2026-0923 pendiente', asuntoPista: 2, fecha: 'hoy, 11:48',
        cuerpo: [
            'Buenos días:',
            'Le reenvío la factura pendiente de pago del pedido de material.',
            { p: 'Si no se ve bien al abrirla, pulse «Habilitar contenido» en la barra amarilla.', pista: 3 },
            { firma: 'Dpto. de Administración\nSuministros Escolares Norte, S. L.' },
        ],
        adjuntos: [{ nombre: 'Factura_2026-0923.xlsm', tipo: 'xls', tamano: '96 KB', pista: 1 }],
        pistas: [
            'Un .xlsm es un Excel con macros: pequeños programas que se ejecutan al abrirlo.',
            '«RE:» de una conversación que nunca has tenido: es para que parezca la respuesta a algo tuyo.',
            '«Habilitar contenido» es justo lo que activa las macros y el programa malicioso.',
        ],
        consejo: 'Las facturas las gestiona Secretaría. Nunca habilites macros en un archivo que te llega por correo.',
    },
    {
        id: 'p-banco', titulo: 'Tarjeta bloqueada', tipo: 'sms', respuesta: 'phishing',
        contacto: { nombre: 'BancoNorte', sub: 'SMS', pista: 1 },
        mensajes: [
            { hora: 'lun 09:12', partes: ['BancoNorte: su código para operar es 552019. No lo comparta con nadie.'] },
            { hora: '14:33', partes: [{ t: 'BancoNorte: Hemos bloqueado su tarjeta por un cargo sospechoso de 749,00 € en una tienda online. ', pista: 2 }, 'Si no lo reconoce, verifique su identidad: ', { enlace: 'banconorte-seguridad.com/verificar', url: 'https://banconorte-seguridad.com/verificar', pista: 3 }] },
        ],
        pistas: [
            'El nombre del remitente de un SMS se puede falsificar, y el mensaje falso puede colarse en el mismo hilo que los reales del banco.',
            'Un cargo alto y alarmante para que actúes rápido.',
            'El enlace no es la web del banco, sino un dominio parecido.',
        ],
        consejo: 'Llama al teléfono que aparece en tu tarjeta o entra en la app oficial. El banco nunca te pedirá claves ni códigos por SMS.',
    },
    {
        id: 'p-ms-codigo', titulo: 'Código de seguridad de Microsoft', tipo: 'email', respuesta: 'legit',
        contexto: 'Acabas de pulsar «¿Olvidaste tu contraseña?» en la web oficial de Microsoft.',
        de: { nombre: 'Equipo de cuentas Microsoft', email: 'account-security-noreply@accountprotection.microsoft.com', pista: 1 },
        detalles: { enviadoPor: 'accountprotection.microsoft.com', firmadoPor: 'accountprotection.microsoft.com', seguridad: 'Cifrado estándar (TLS)' },
        asunto: 'Código de seguridad de la cuenta Microsoft', fecha: 'hoy, 18:20',
        cuerpo: [
            { cabecera: 'Cuenta Microsoft', color: '#0078d4' },
            { p: 'Usa el siguiente código de seguridad para la cuenta {email}.', pista: 2 },
            { codigo: '482913' },
            { p: 'Si no reconoces esta solicitud, puedes ignorar este correo. No te pediremos nunca tu contraseña por correo.', pista: 3 },
            { firma: 'Gracias,\nEl equipo de cuentas Microsoft' },
        ],
        pistas: [
            'El dominio es accountprotection.microsoft.com, de Microsoft, y está firmado por él.',
            'Encaja exactamente con lo que acabas de hacer.',
            'No hay enlaces ni te pide nada: el código lo escribes tú en la web oficial que ya tienes abierta.',
        ],
        consejo: 'Si te llega un código que NO has pedido, alguien está intentando entrar: cambia la contraseña y activa la verificación en dos pasos.',
    },
    {
        id: 'p-teams', titulo: 'Reunión de departamento por Teams', tipo: 'email', respuesta: 'legit',
        de: { nombre: 'Laura Méndez', email: 'laura.mendez@iesrioverde.es', pista: 1 },
        detalles: { enviadoPor: 'iesrioverde.es', firmadoPor: 'iesrioverde.es', seguridad: 'Cifrado estándar (TLS)' },
        asunto: 'Reunión de departamento (Teams) – martes 17:00', fecha: 'vie, 13:15',
        cuerpo: [
            'Hola a todos:',
            { p: 'Como quedamos en la última reunión, el martes a las 17:00 nos vemos por Teams para cerrar las rúbricas de la 2.ª evaluación.', pista: 2 },
            { boton: 'Unirse a la reunión ahora', url: 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_ZjQ5YTk0/0?context=%7b%22Tid%22', pista: 3, color: '#4b53bc' },
            { firma: 'Laura Méndez\nJefa del Departamento de Matemáticas · IES Río Verde' },
        ],
        pistas: [
            'Una compañera con la dirección del centro, firmada por iesrioverde.es.',
            'Es lo que acordasteis: no hay sorpresas ni prisas.',
            'El enlace va a teams.microsoft.com y no pide nada más que unirte.',
        ],
        consejo: 'Correcto. Aun así, desconfía si una «reunión» te pide descargar algo o iniciar sesión en una web rara.',
    },
    {
        id: 'p-buzon-voz', titulo: 'Mensaje de voz nuevo', tipo: 'email', respuesta: 'phishing',
        de: { nombre: 'Centralita IES Río Verde', email: 'voicemail@iesrioverde-es.net', pista: 1 },
        detalles: { enviadoPor: 'iesrioverde-es.net', seguridad: 'Cifrado estándar (TLS)' },
        asunto: 'Tienes 1 mensaje de voz nuevo (0:47)', fecha: 'hoy, 12:55',
        cuerpo: [
            '🔊 Has recibido un mensaje de voz nuevo.',
            'De: +34 9•• ••• 412\nDuración: 0:47',
            { p: 'Para escucharlo, abre el archivo adjunto e inicia sesión con tu cuenta del centro.', pista: 3 },
        ],
        adjuntos: [{ nombre: 'Mensaje_voz_0047.htm', tipo: 'htm', tamano: '4 KB', pista: 2 }],
        pistas: [
            'iesrioverde-es.net no es iesrioverde.es: un guion y otra terminación bastan para engañar.',
            'Un audio no es un .htm de 4 KB: es una página web que abre un formulario falso.',
            'Ningún mensaje de voz te pide iniciar sesión para escucharlo.',
        ],
        consejo: 'Desconfía de los adjuntos .htm/.html. Reenvía el correo al coordinador TIC y bórralo.',
    },
];

export const REGLAS = {
    alumnos: [
        ['🔎', 'Mira el remitente', 'Lo que importa es lo que va después de la @, no el nombre que aparece.'],
        ['🔗', 'Mira el enlace antes de pulsar', 'Pasa el ratón o mantén pulsado. El dominio es lo que va justo antes de la primera «/».'],
        ['⏰', 'Desconfía de las prisas y los regalos', '«Solo hoy», «se cerrará tu cuenta», «has ganado»… es para que no pienses.'],
        ['🔑', 'Tus claves son tuyas', 'Ni contraseñas ni códigos: ni a webs raras ni a tus amigos.'],
        ['🗣️', 'Ante la duda, pregunta', 'A tu familia o a tu profe, y comprueba por otro camino.'],
    ],
    profes: [
        ['🔎', 'Remitente y dominio', 'El nombre se falsifica fácil: mira la dirección, el «responder a» y por quién está firmado.'],
        ['📎', 'Adjuntos peligrosos', '.zip, .htm, .xlsm, .exe… y nunca pulses «Habilitar contenido».'],
        ['🔗', 'Dominio del enlace', 'Lee hasta la primera «/». El candado solo dice que la conexión está cifrada.'],
        ['💸', 'Dinero, secreto y urgencia', 'Tarjetas regalo, pagos o «no puedo hablar»: comprueba siempre por otro canal.'],
        ['🛡️', 'Avisa y protege', 'Reenvía al coordinador TIC, activa la verificación en dos pasos y cambia la clave si caíste.'],
    ],
};
