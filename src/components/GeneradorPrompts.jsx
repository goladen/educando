import { useState, useMemo, useEffect } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Generador de prompts para tu IA (Herramientas del Profesor)
// 7 plantillas de evaluación inclusiva + plantillas propias con [huecos].
// Todo se guarda en el dispositivo (localStorage); no se envía nada a PiKT.
// ─────────────────────────────────────────────────────────────────────────────

const LS_BORRADOR = 'pikt_prompts_borrador_v1';
const LS_GUARDADOS = 'pikt_prompts_guardados_v1';
const LS_PLANTILLAS = 'pikt_prompts_plantillas_v1';

const leerLS = (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } };
const escribirLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

// Campos de las plantillas. La misma clave se comparte entre plantillas (curso, materia…)
const CAMPOS = {
    curso: { label: 'Curso', hueco: 'curso', ej: ['3º Primaria', '5º Primaria', '6º Primaria', '1º ESO', '2º ESO', '3º ESO', '4º ESO', '1º Bachillerato'] },
    materia: { label: 'Materia', hueco: 'materia', ej: ['Matemáticas', 'Lengua', 'Inglés', 'Ciencias Naturales', 'Geografía e Historia', 'Física y Química'] },
    barreras: {
        label: 'Barreras observables', hueco: 'describe brevemente qué le cuesta, sin incluir datos personales', multi: true, sumar: true,
        ej: ['se pierde en enunciados largos', 'lectura lenta', 'cansancio al escribir', 'le cuesta empezar las tareas', 'se bloquea con el tiempo limitado', 'dificultad para organizar la respuesta'],
    },
    aprendizajes: { label: 'Aprendizajes y criterios a evaluar', hueco: 'indícalos', multi: true },
    prueba: { label: 'La prueba (opcional)', ayuda: 'Pégala aquí o adjúntala después en la IA.', hueco: '', multi: true, opcional: true, anexo: 'Esta es la prueba:' },
    consignas: { label: 'Consignas del examen', ayuda: 'Pégalas aquí o déjalo vacío para pegarlas en la IA.', hueco: 'pega las consignas', multi: true },
    examen: { label: 'El examen', ayuda: 'Pégalo aquí o déjalo vacío para pegarlo en la IA.', hueco: 'pega el examen', multi: true },
    objetivoPrueba: { label: 'Aprendizaje que se quiere evaluar', hueco: 'indica el aprendizaje', multi: true },
    necesidades: {
        label: 'Necesidades observadas', hueco: 'describe las necesidades, por ejemplo, lectura lenta, dificultad para decodificar o cansancio al escribir', multi: true, sumar: true,
        ej: ['lectura lenta', 'dificultad para decodificar', 'cansancio al escribir', 'errores al copiar de la pizarra', 'se satura con mucha información por página'],
    },
    numEjercicios: { label: 'Nº de ejercicios', hueco: 'número', ej: ['5', '8', '10'] },
    tiempo: { label: 'Duración prevista', hueco: 'tiempo', ej: ['45 minutos', '50 minutos', '55 minutos'] },
    dificultades: {
        label: 'Dificultades observables', hueco: 'descríbelas', multi: true, sumar: true,
        ej: ['deja ejercicios sin empezar', 'se queda mucho tiempo en el primero', 'no revisa antes de entregar', 'pierde el hilo a mitad de la prueba', 'se distrae con facilidad'],
    },
    objetivo: { label: 'Objetivo concreto', hueco: 'objetivo concreto', multi: true },
    formatoActual: { label: 'Formato actual de respuesta', hueco: 'formato actual', ej: ['respuesta escrita desarrollada', 'redacción', 'test escrito', 'problemas escritos', 'definiciones de memoria'] },
    barrera: {
        label: 'Barrera observable', hueco: 'describe la dificultad', multi: true, sumar: true,
        ej: ['le cuesta expresarse por escrito', 'escritura muy lenta', 'se bloquea al redactar', 'entiende el contenido pero no lo organiza en un texto'],
    },
    tarea: { label: 'Tarea de evaluación', hueco: 'describe la tarea', multi: true },
    criterios: { label: 'Aprendizaje y criterios a valorar', hueco: 'escríbelos', multi: true },
    resultados: { label: 'Resultados y criterios (anónimos)', ayuda: 'Sin nombres ni datos identificativos.', hueco: 'pega la información, sin nombres ni datos identificativos', multi: true },
};

// {{campo}} = hueco a rellenar · {un} {Un} {el} = forma de nombrar al alumno/a
const PLANTILLAS = [
    {
        id: 'P1', num: 1, titulo: 'Adapta el examen que ya tienes', emoji: '📝', color: '#6D28D9',
        desc: 'Adapta una prueba ya hecha a las barreras de un alumno/a sin rebajar el nivel.',
        texto: 'Actúa como docente especialista en atención a la diversidad, evaluación inclusiva y apoyo educativo. Voy a compartirte una prueba que ya tengo preparada. Ayúdame a adaptarla para {un} de {{curso}} que encuentra estas barreras observables: {{barreras}}. Mantén los aprendizajes y criterios que quiero evaluar: {{aprendizajes}}. Señala qué partes de la prueba pueden estar dificultando que muestre lo que sabe y propón cambios concretos en la presentación, las consignas, la organización o el tiempo. Devuélveme una versión adaptada lista para revisar, una tabla breve con los cambios y el motivo de cada uno. No rebajes automáticamente el nivel ni presupongas necesidades solo por un diagnóstico. Si falta información, pregúntame antes de asumirla.{{prueba}}',
    },
    {
        id: 'P2', num: 2, titulo: 'Aclara las consignas', emoji: '🔎', color: '#0E7490',
        desc: 'Reescribe enunciados con frases breves y una acción por paso.',
        texto: 'Revisa estas consignas de un examen de {{materia}} de {{curso}}: {{consignas}}. Reescríbelas con frases breves, vocabulario claro y una acción por paso. Conserva exactamente el contenido y el aprendizaje que se evalúa. Numera los pasos cuando ayude, destaca los verbos de acción y añade un ejemplo solo si aclara cómo responder, sin dar la solución. Al final, muéstrame una tabla con la consigna original, la propuesta y qué barrera podría reducir cada cambio. No elimines información necesaria ni simplifiques el contenido curricular.',
    },
    {
        id: 'P3', num: 3, titulo: 'Revisa las barreras de lectura', emoji: '📖', color: '#B45309',
        desc: 'Detecta si la extensión, el vocabulario o la presentación interfieren con lo que evalúas.',
        texto: 'Analiza esta prueba de {{materia}} de {{curso}}: {{examen}}. El objetivo es evaluar {{objetivoPrueba}}. Comprueba si la extensión de los textos, el vocabulario, la cantidad de información por página, la copia, la ortografía o la presentación pueden interferir con ese objetivo. Propón ajustes de acceso adecuados a estas necesidades observadas: {{necesidades}}. Distingue qué ajustes ayudan a acceder a la prueba y cuáles podrían cambiar lo que se está evaluando. No elimines una habilidad —como la ortografía— si forma parte explícita del objetivo.',
    },
    {
        id: 'P4', num: 4, titulo: 'Ayúdale a organizarse', emoji: '⏱️', color: '#15803D',
        desc: 'Apoyos de planificación y gestión del tiempo antes y durante la prueba.',
        texto: 'Tengo una prueba de {{materia}} de {{curso}} con {{numEjercicios}} ejercicios y una duración prevista de {{tiempo}}. Para {un} que presenta estas dificultades observables de atención, planificación o gestión del tiempo: {{dificultades}}, propón apoyos para organizar la tarea antes y durante la prueba. Incluye una secuencia breve de pasos, una distribución orientativa del tiempo y una pauta de revisión final. Mantén las mismas preguntas y criterios. Indica qué apoyos puede preparar el docente y cuáles podría usar el alumnado de manera autónoma. No atribuyas estas dificultades automáticamente a un diagnóstico.',
    },
    {
        id: 'P5', num: 5, titulo: 'Otra forma de responder', emoji: '🗣️', color: '#C2410C',
        desc: 'Tres alternativas para recoger evidencias del mismo aprendizaje.',
        texto: 'Quiero evaluar si el alumnado sabe {{objetivo}}. La prueba actual pide responder mediante {{formatoActual}}. {Un} encuentra esta barrera observable: {{barrera}}. Propón tres formas alternativas de recoger evidencia del mismo aprendizaje, por ejemplo, respuesta oral, demostración práctica, organizador visual, selección razonada o respuesta con apoyos. Para cada alternativa, indica qué tendría que hacer {el}, qué criterio se mantiene y qué aspecto podría dejar de comprobarse con la prueba original. No sugieras una alternativa si cambia el aprendizaje que se pretende evaluar. Señala qué decisión debe revisar el docente antes de aplicarla.',
    },
    {
        id: 'P6', num: 6, titulo: 'Prepara una rúbrica clara', emoji: '📊', color: '#1D4ED8',
        desc: 'Rúbrica de 3-4 criterios observables y 4 niveles, sin etiquetas.',
        texto: "Ayúdame a crear una rúbrica sencilla para esta tarea de evaluación: {{tarea}}. Curso: {{curso}}. Aprendizaje y criterios que debo valorar: {{criterios}}. Organiza la rúbrica en una tabla con tres o cuatro criterios observables y cuatro niveles de desempeño descritos con lenguaje claro. Separa el dominio del contenido de aspectos como ortografía, caligrafía, velocidad o presentación cuando no sean el objetivo evaluado. Si alguno de esos aspectos sí es un criterio, inclúyelo de forma explícita. Evita etiquetas como 'no se esfuerza' o 'es despistado/a'. Usa evidencias que se puedan observar en la respuesta.",
    },
    {
        id: 'P7', num: 7, titulo: '¿Y después de corregir?', emoji: '🧭', color: '#BE185D',
        desc: 'Ordena evidencias y propone próximos pasos de enseñanza.',
        texto: 'Te voy a compartir de forma anónima los resultados de una tarea y los criterios evaluados: {{resultados}}. Ayúdame a organizar las evidencias en tres apartados: qué aprendizajes muestra {el}, qué dificultades aparecen en la tarea y qué información todavía no podemos concluir. Después propón dos próximos pasos de enseñanza o apoyo y una manera breve de comprobar si han ayudado. No atribuyas el resultado a un diagnóstico, la motivación o la falta de esfuerzo si no hay evidencias. No emitas una conclusión clínica. Distingue siempre entre observación e interpretación.',
    },
];

const FORMAS_ALUMNO = {
    neutro: { label: 'alumno/a', un: 'un/a alumno/a', el: 'el alumno/a' },
    alumno: { label: 'alumno', un: 'un alumno', el: 'el alumno' },
    alumna: { label: 'alumna', un: 'una alumna', el: 'la alumna' },
};

const EXTRAS = [
    { id: 'dua', txt: 'Enmarca las propuestas en el Diseño Universal para el Aprendizaje (DUA): varias formas de presentar la información, de implicarse y de expresar lo aprendido.' },
    { id: 'lomloe', txt: 'Relaciona los cambios con las competencias específicas y los criterios de evaluación (LOMLOE) que te he indicado, sin inventar otros.' },
    { id: 'facil', txt: 'En el material para el alumnado usa pautas de lectura fácil: frases cortas, una idea por frase, sin dobles negaciones y con letra clara.' },
    { id: 'imprimir', txt: 'Entrega el material del alumnado listo para copiar en un documento A4 e imprimir, separado de las explicaciones para el docente.' },
    { id: 'tono', txt: 'Responde con un tono cercano y práctico, sin tecnicismos innecesarios.' },
    { id: 'preguntas', txt: 'Antes de empezar, hazme hasta tres preguntas si te falta información importante.' },
    { id: 'revisar', txt: 'Al final, resume en tres líneas qué debo revisar yo antes de usarlo en clase.' },
    { id: 'privacidad', txt: 'No te he dado datos personales ni diagnósticos: trabaja solo con las observaciones descritas y no me los pidas.' },
];

const IDIOMAS = [
    { id: 'es', label: 'Castellano', frase: '' },
    { id: 'ca', label: 'Català', frase: 'Redacta toda la respuesta en catalán.' },
    { id: 'va', label: 'Valencià', frase: 'Redacta toda la respuesta en valenciano.' },
    { id: 'gl', label: 'Galego', frase: 'Redacta toda la respuesta en gallego.' },
    { id: 'eu', label: 'Euskara', frase: 'Redacta toda la respuesta en euskera.' },
    { id: 'en', label: 'English', frase: 'Write the whole answer in English.' },
];

const IAS = [
    { id: 'chatgpt', label: 'ChatGPT', color: '#10a37f', url: q => `https://chatgpt.com/?q=${q}` },
    { id: 'claude', label: 'Claude', color: '#d97757', url: q => `https://claude.ai/new?q=${q}` },
    { id: 'gemini', label: 'Gemini', color: '#4285f4', url: null, base: 'https://gemini.google.com/app' },
    { id: 'copilot', label: 'Copilot', color: '#0078d4', url: q => `https://copilot.microsoft.com/?q=${q}` },
];

// Avisos de posibles datos personales o diagnósticos
const DIAGNOSTICOS = /\b(tdah|tea|asperger|dislexi[ac]o?|discalculi[ac]o?|disgrafi[ac]o?|autis(ta|mo)|diagn[oó]stic[oa]|altas capacidades|tel\b|tdl\b)/i;
const DATOS = [
    { re: /[\w.+-]+@[\w-]+\.[\w.]+/, msg: 'un correo electrónico' },
    { re: /\b[6789]\d{2}[\s.-]?\d{3}[\s.-]?\d{3}\b/, msg: 'un número de teléfono' },
    { re: /\b\d{8}[A-HJ-NP-TV-Z]\b/i, msg: 'un DNI' },
    { re: /\b(se llama|llamad[oa]|mi alumn[oa]|el niño|la niña)\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+/, msg: 'lo que parece un nombre propio' },
];

const TOKEN = /\{\{(\w+)\}\}|\{(un|Un|el)\}|\[([^\]\n]+)\]/g;
const mayus = s => s.charAt(0).toUpperCase() + s.slice(1);

// Campos que aparecen en un texto (plantillas PiKT usan {{clave}}, las propias [hueco])
function camposDe(texto) {
    const lista = [];
    const vistos = new Set();
    for (const m of texto.matchAll(TOKEN)) {
        const clave = m[1] || (m[3] ? m[3].trim() : null);
        if (!clave || vistos.has(clave)) continue;
        vistos.add(clave);
        lista.push(m[1] ? { clave, ...(CAMPOS[clave] || { label: clave, hueco: clave }) } : { clave, label: mayus(clave), hueco: clave, multi: clave.length > 18 });
    }
    return lista;
}

// Devuelve segmentos para la vista previa: { t, tipo: 'texto' | 'lleno' | 'hueco' }
function componer(texto, valores, forma) {
    const segs = [];
    let ult = 0;
    for (const m of texto.matchAll(TOKEN)) {
        if (m.index > ult) segs.push({ t: texto.slice(ult, m.index), tipo: 'texto' });
        ult = m.index + m[0].length;
        if (m[2]) {
            const f = FORMAS_ALUMNO[forma] || FORMAS_ALUMNO.neutro;
            segs.push({ t: m[2] === 'el' ? f.el : m[2] === 'Un' ? mayus(f.un) : f.un, tipo: 'texto' });
            continue;
        }
        const clave = m[1] || m[3].trim();
        const meta = m[1] ? (CAMPOS[clave] || {}) : {};
        const v = (valores[clave] || '').trim();
        if (meta.opcional) {
            if (v) segs.push({ t: `\n\n${meta.anexo}\n"""\n${v}\n"""`, tipo: 'lleno' });
            continue;
        }
        if (!v) { segs.push({ t: `[${meta.hueco || clave}]`, tipo: 'hueco' }); continue; }
        segs.push({ t: v.includes('\n') ? `\n"""\n${v}\n"""\n` : v, tipo: 'lleno' });
    }
    if (ult < texto.length) segs.push({ t: texto.slice(ult), tipo: 'texto' });
    return segs;
}

// Convierte una plantilla PiKT en texto editable con [huecos]
function aTextoEditable(texto) {
    return texto
        .replace(/\{\{(\w+)\}\}/g, (_, k) => (CAMPOS[k]?.opcional ? '' : `[${CAMPOS[k]?.hueco || k}]`))
        .replace(/\{Un\}/g, 'Un/a alumno/a').replace(/\{un\}/g, 'un/a alumno/a').replace(/\{el\}/g, 'el alumno/a');
}

export default function GeneradorPrompts({ onBack }) {
    const borrador = useMemo(() => leerLS(LS_BORRADOR, {}), []);
    const [plantillaId, setPlantillaId] = useState(borrador.plantillaId || null);
    const [valores, setValores] = useState(borrador.valores || {});
    const [forma, setForma] = useState(borrador.forma || 'neutro');
    const [extras, setExtras] = useState(borrador.extras || ['privacidad']);
    const [idioma, setIdioma] = useState(borrador.idioma || 'es');
    const [rol, setRol] = useState(borrador.rol || '');
    const [otras, setOtras] = useState(borrador.otras || '');
    const [propias, setPropias] = useState(() => leerLS(LS_PLANTILLAS, []));
    const [guardados, setGuardados] = useState(() => leerLS(LS_GUARDADOS, []));
    const [editor, setEditor] = useState(null); // { id?, titulo, texto }
    const [aviso, setAviso] = useState('');
    const [verGuardados, setVerGuardados] = useState(false);
    const [ancho, setAncho] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

    useEffect(() => {
        const r = () => setAncho(window.innerWidth);
        window.addEventListener('resize', r);
        return () => window.removeEventListener('resize', r);
    }, []);
    useEffect(() => { escribirLS(LS_BORRADOR, { plantillaId, valores, forma, extras, idioma, rol, otras }); }, [plantillaId, valores, forma, extras, idioma, rol, otras]);
    useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(''), 3500); return () => clearTimeout(t); }, [aviso]);

    const todas = [...PLANTILLAS, ...propias.map(p => ({ ...p, propia: true, emoji: '✍️', color: '#475569' }))];
    const plantilla = todas.find(p => p.id === plantillaId) || null;
    const campos = plantilla ? camposDe(plantilla.texto) : [];
    const usaAlumno = plantilla ? /\{(un|Un|el)\}/.test(plantilla.texto) : false;

    const segmentos = useMemo(() => {
        if (!plantilla) return [];
        const segs = [];
        if (rol.trim()) segs.push({ t: `Actúa como ${rol.trim().replace(/\.$/, '')}. `, tipo: 'lleno' });
        segs.push(...componer(plantilla.texto, valores, forma));
        const lineas = [
            ...EXTRAS.filter(e => extras.includes(e.id)).map(e => e.txt),
            ...otras.split('\n').map(s => s.trim()).filter(Boolean),
        ];
        const fraseIdioma = IDIOMAS.find(i => i.id === idioma)?.frase;
        if (fraseIdioma) lineas.push(fraseIdioma);
        if (lineas.length) segs.push({ t: '\n\nIndicaciones adicionales:\n' + lineas.map(l => `- ${l}`).join('\n'), tipo: 'lleno' });
        return segs;
    }, [plantilla, valores, forma, extras, idioma, rol, otras]);

    const prompt = segmentos.map(s => s.t).join('');
    const huecos = segmentos.filter(s => s.tipo === 'hueco').length;
    const textoUsuario = [rol, otras, ...campos.map(c => valores[c.clave] || '')].join('\n');
    const avisosDatos = DATOS.filter(d => d.re.test(textoUsuario)).map(d => d.msg);
    const hayDiagnostico = DIAGNOSTICOS.test(textoUsuario);

    const setValor = (k, v) => setValores(prev => ({ ...prev, [k]: v }));
    const sumarValor = (k, ej) => setValores(prev => {
        const actual = (prev[k] || '').trim();
        if (actual.toLowerCase().includes(ej.toLowerCase())) return prev;
        return { ...prev, [k]: actual ? `${actual.replace(/[.,;]\s*$/, '')}, ${ej}` : ej };
    });
    const toggleExtra = id => setExtras(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const copiar = async (silencioso) => {
        try { await navigator.clipboard.writeText(prompt); }
        catch {
            const ta = document.createElement('textarea'); ta.value = prompt; document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); } catch { /* nada */ } ta.remove();
        }
        if (!silencioso) setAviso('✅ Prompt copiado. Pégalo en tu IA.');
    };
    const abrirEn = async ia => {
        await copiar(true);
        const q = encodeURIComponent(prompt);
        const url = ia.url && q.length < 7000 ? ia.url(q) : (ia.base || ia.url(''));
        window.open(url, '_blank', 'noopener');
        setAviso(ia.url && q.length < 7000
            ? `✅ Abriendo ${ia.label}. Si el texto no aparece, pégalo (Ctrl+V): ya está copiado.`
            : `✅ Prompt copiado. En ${ia.label}, pégalo con Ctrl+V.`);
    };
    const descargar = () => {
        const blob = new Blob([prompt], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `prompt-${(plantilla?.titulo || 'pikt').toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, '-')}.txt`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    const guardar = () => {
        const nombre = window.prompt('Nombre para guardar este prompt:', `${plantilla.titulo}${valores.curso ? ' · ' + valores.curso : ''}`);
        if (!nombre) return;
        const nuevo = { id: Date.now().toString(36), nombre: nombre.trim(), plantillaId, valores: Object.fromEntries(campos.map(c => [c.clave, valores[c.clave] || ''])), forma, extras, idioma, rol, otras, fecha: new Date().toISOString() };
        const lista = [nuevo, ...guardados].slice(0, 60);
        setGuardados(lista); escribirLS(LS_GUARDADOS, lista);
        setAviso('💾 Guardado en «Mis prompts» (en este dispositivo).');
    };
    const cargar = g => {
        if (!todas.some(p => p.id === g.plantillaId)) { setAviso('⚠️ La plantilla de ese prompt ya no existe.'); return; }
        setPlantillaId(g.plantillaId); setValores(prev => ({ ...prev, ...g.valores })); setForma(g.forma || 'neutro');
        setExtras(g.extras || []); setIdioma(g.idioma || 'es'); setRol(g.rol || ''); setOtras(g.otras || '');
        setVerGuardados(false);
    };
    const borrarGuardado = id => { const lista = guardados.filter(g => g.id !== id); setGuardados(lista); escribirLS(LS_GUARDADOS, lista); };

    const guardarPlantilla = () => {
        const titulo = editor.titulo.trim() || 'Mi plantilla';
        const texto = editor.texto.trim();
        if (!texto) { setAviso('⚠️ Escribe el texto de la plantilla.'); return; }
        const id = editor.id || 'U' + Date.now().toString(36);
        const nueva = { id, titulo, texto, desc: `${camposDe(texto).length} huecos para rellenar` };
        const lista = editor.id ? propias.map(p => p.id === id ? nueva : p) : [nueva, ...propias];
        setPropias(lista); escribirLS(LS_PLANTILLAS, lista);
        setEditor(null); setPlantillaId(id);
    };
    const borrarPlantilla = id => {
        if (!window.confirm('¿Borrar esta plantilla?')) return;
        const lista = propias.filter(p => p.id !== id); setPropias(lista); escribirLS(LS_PLANTILLAS, lista);
        if (plantillaId === id) setPlantillaId(null);
    };

    const estrecho = ancho < 900;

    // ── Editor de plantilla propia ──
    if (editor) {
        const camposEd = camposDe(editor.texto);
        return (
            <div style={S.pagina}>
                <button onClick={() => setEditor(null)} style={S.volver}>← Volver al generador</button>
                <h2 style={S.h2}>✍️ {editor.id ? 'Editar mi plantilla' : 'Crear mi plantilla'}</h2>
                <p style={S.sub}>Escribe tu prompt y pon entre <b>[corchetes]</b> lo que cambiará cada vez (por ejemplo <code>[curso]</code> o <code>[pega el texto]</code>). Cada corchete se convierte en un campo para rellenar.</p>
                <div style={S.caja}>
                    <label style={S.label}>Nombre de la plantilla</label>
                    <input value={editor.titulo} onChange={e => setEditor({ ...editor, titulo: e.target.value })} placeholder="Ej.: Preparar un examen de repaso" style={S.input} />
                    <label style={{ ...S.label, marginTop: 14 }}>Texto del prompt</label>
                    <textarea value={editor.texto} onChange={e => setEditor({ ...editor, texto: e.target.value })} rows={12}
                        placeholder="Actúa como docente de [materia]. Prepara un repaso de [tema] para [curso] con…" style={{ ...S.input, fontFamily: 'inherit', lineHeight: 1.5, resize: 'vertical' }} />
                    <div style={{ marginTop: 10, fontSize: '0.85rem', color: '#475569' }}>
                        Campos detectados: {camposEd.length ? camposEd.map(c => <span key={c.clave} style={S.chipHueco}>{c.clave}</span>) : <i>ninguno todavía</i>}
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                        <button onClick={guardarPlantilla} style={S.btnPrim('#6D28D9')}>💾 Guardar plantilla</button>
                        <button onClick={() => setEditor(null)} style={S.btnSec}>Cancelar</button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Catálogo de plantillas ──
    if (!plantilla) {
        return (
            <div style={S.pagina}>
                {onBack && <button onClick={onBack} style={S.volver}>← Volver a herramientas</button>}
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <h2 style={S.h2}>🤖 Generador de prompts para tu IA</h2>
                    <p style={S.sub}>Elige una plantilla, rellena lo que necesites y llévate el prompt a ChatGPT, Claude, Gemini o la IA que uses. También puedes crear las tuyas.</p>
                </div>
                <div style={S.privacidad}>🔒 <b>Privacidad:</b> describe barreras <b>observables</b> («se pierde en enunciados largos»), nunca nombres, diagnósticos ni datos del alumnado. Lo que escribes se queda en este dispositivo: PiKT no lo envía a ninguna parte.</div>

                <h3 style={S.h3}>Evaluación inclusiva · 7 códigos</h3>
                <div style={S.rejilla}>
                    {PLANTILLAS.map(p => (
                        <div key={p.id} onClick={() => setPlantillaId(p.id)} style={S.tarjeta(p.color)}
                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'} onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                <span style={{ fontSize: 28 }}>{p.emoji}</span>
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: p.color, letterSpacing: 1 }}>CÓDIGO {p.num}</span>
                            </div>
                            <div style={{ fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>{p.titulo}</div>
                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{p.desc}</div>
                        </div>
                    ))}
                </div>

                <h3 style={S.h3}>Mis plantillas</h3>
                <div style={S.rejilla}>
                    <div onClick={() => setEditor({ titulo: '', texto: '' })} style={{ ...S.tarjeta('#475569'), borderStyle: 'dashed', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 110 }}>
                        <span style={{ fontSize: 30 }}>➕</span>
                        <div style={{ fontWeight: 800, color: '#334155' }}>Crear la mía desde cero</div>
                    </div>
                    {propias.map(p => (
                        <div key={p.id} onClick={() => setPlantillaId(p.id)} style={{ ...S.tarjeta('#475569'), position: 'relative' }}>
                            <button onClick={e => { e.stopPropagation(); borrarPlantilla(p.id); }} title="Borrar" style={S.btnMini}>🗑️</button>
                            <div style={{ fontSize: 26, marginBottom: 6 }}>✍️</div>
                            <div style={{ fontWeight: 800, color: '#1e293b', marginBottom: 4, paddingRight: 24 }}>{p.titulo}</div>
                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{p.desc}</div>
                        </div>
                    ))}
                </div>

                {guardados.length > 0 && (
                    <>
                        <h3 style={S.h3}>Mis prompts guardados</h3>
                        <ListaGuardados guardados={guardados} todas={todas} onCargar={cargar} onBorrar={borrarGuardado} />
                    </>
                )}
            </div>
        );
    }

    // ── Generador ──
    return (
        <div style={S.pagina}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                <button onClick={() => setPlantillaId(null)} style={{ ...S.volver, marginBottom: 0 }}>← Plantillas</button>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {guardados.length > 0 && <button onClick={() => setVerGuardados(v => !v)} style={S.btnSec}>📂 Mis prompts ({guardados.length})</button>}
                    <button onClick={() => setEditor(plantilla.propia ? { id: plantilla.id, titulo: plantilla.titulo, texto: plantilla.texto } : { titulo: `${plantilla.titulo} (mía)`, texto: aTextoEditable(plantilla.texto) })} style={S.btnSec}>
                        ✏️ {plantilla.propia ? 'Editar plantilla' : 'Editar el texto como mío'}
                    </button>
                </div>
            </div>
            {verGuardados && <div style={{ marginBottom: 16 }}><ListaGuardados guardados={guardados} todas={todas} onCargar={cargar} onBorrar={borrarGuardado} /></div>}

            <h2 style={{ ...S.h2, color: plantilla.color, textAlign: 'left' }}>
                {plantilla.emoji} {plantilla.num ? `Código ${plantilla.num}: ` : ''}{plantilla.titulo}
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: estrecho ? '1fr' : 'minmax(0,1fr) minmax(0,1.05fr)', gap: 20, alignItems: 'start' }}>
                {/* Formulario */}
                <div style={S.caja}>
                    <div style={S.privacidadMini}>🔒 Sin nombres, diagnósticos ni datos personales: describe lo que observas.</div>

                    {campos.map(c => (
                        <div key={c.clave} style={{ marginBottom: 14 }}>
                            <label style={S.label}>{c.label}{c.opcional && <span style={{ fontWeight: 400, color: '#94a3b8' }}> · opcional</span>}</label>
                            {c.ayuda && <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: 4 }}>{c.ayuda}</div>}
                            {c.multi
                                ? <textarea value={valores[c.clave] || ''} onChange={e => setValor(c.clave, e.target.value)} rows={c.opcional || ['consignas', 'examen', 'resultados'].includes(c.clave) ? 5 : 2} placeholder={c.hueco} style={{ ...S.input, fontFamily: 'inherit', resize: 'vertical' }} />
                                : <input value={valores[c.clave] || ''} onChange={e => setValor(c.clave, e.target.value)} placeholder={c.hueco} style={S.input} />}
                            {c.ej && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                                    {c.ej.map(ej => (
                                        <button key={ej} onClick={() => c.sumar ? sumarValor(c.clave, ej) : setValor(c.clave, ej)} style={S.chip}>{c.sumar ? '+ ' : ''}{ej}</button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}

                    {usaAlumno && (
                        <div style={{ marginBottom: 14 }}>
                            <label style={S.label}>Cómo nombrar al alumnado en el prompt</label>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {Object.entries(FORMAS_ALUMNO).map(([k, f]) => (
                                    <button key={k} onClick={() => setForma(k)} style={S.opcion(forma === k, plantilla.color)}>{f.label}</button>
                                ))}
                            </div>
                        </div>
                    )}

                    <details style={{ marginTop: 6 }} open={extras.length > 1 || !!otras || !!rol}>
                        <summary style={{ cursor: 'pointer', fontWeight: 800, color: '#334155', padding: '6px 0' }}>⚙️ Personaliza tus indicaciones</summary>
                        <div style={{ paddingTop: 8 }}>
                            <label style={S.label}>Rol de la IA (opcional)</label>
                            <input value={rol} onChange={e => setRol(e.target.value)} placeholder="Ej.: orientador/a educativo/a de un IES" style={S.input} />
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6, marginBottom: 12 }}>
                                {['docente de pedagogía terapéutica', 'orientador/a educativo/a', 'maestro/a de audición y lenguaje', 'experto/a en Diseño Universal para el Aprendizaje'].map(r => (
                                    <button key={r} onClick={() => setRol(r)} style={S.chip}>{r}</button>
                                ))}
                            </div>

                            <label style={S.label}>Añadir al prompt</label>
                            {EXTRAS.map(e => (
                                <label key={e.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.86rem', color: '#334155', marginBottom: 6, cursor: 'pointer' }}>
                                    <input type="checkbox" checked={extras.includes(e.id)} onChange={() => toggleExtra(e.id)} style={{ marginTop: 3 }} />
                                    <span>{e.txt}</span>
                                </label>
                            ))}

                            <label style={{ ...S.label, marginTop: 10 }}>Idioma de la respuesta</label>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                                {IDIOMAS.map(i => <button key={i.id} onClick={() => setIdioma(i.id)} style={S.opcion(idioma === i.id, plantilla.color)}>{i.label}</button>)}
                            </div>

                            <label style={S.label}>Otras indicaciones tuyas (una por línea)</label>
                            <textarea value={otras} onChange={e => setOtras(e.target.value)} rows={3} placeholder={'Ej.: Usa ejemplos con situaciones de la vida diaria.\nNo uses más de una página.'} style={{ ...S.input, fontFamily: 'inherit', resize: 'vertical' }} />
                        </div>
                    </details>
                </div>

                {/* Vista previa */}
                <div style={{ position: estrecho ? 'static' : 'sticky', top: 12 }}>
                    <div style={{ ...S.caja, borderTop: `4px solid ${plantilla.color}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                            <b style={{ color: '#1e293b' }}>Tu prompt</b>
                            <span style={{ fontSize: '0.78rem', color: huecos ? '#b45309' : '#15803d', fontWeight: 700 }}>
                                {huecos ? `${huecos} hueco${huecos > 1 ? 's' : ''} sin rellenar` : '✔ Listo para usar'}
                            </span>
                        </div>
                        <div style={S.preview}>
                            {segmentos.map((s, i) => (
                                <span key={i} style={s.tipo === 'hueco' ? S.marcaHueco : s.tipo === 'lleno' ? S.marcaLleno : undefined}>{s.t}</span>
                            ))}
                        </div>
                        {huecos > 0 && <div style={{ fontSize: '0.78rem', color: '#92400e', marginTop: 6 }}>Los huecos en <span style={S.marcaHueco}>[naranja]</span> puedes rellenarlos aquí o directamente en la IA.</div>}

                        {(avisosDatos.length > 0 || hayDiagnostico) && (
                            <div style={S.alerta}>
                                {avisosDatos.length > 0 && <div>⚠️ Parece que has escrito {avisosDatos.join(' y ')}. Quítalo antes de enviarlo a una IA.</div>}
                                {hayDiagnostico && <div>💡 Has mencionado un diagnóstico. Estos prompts funcionan mejor (y protegen más al alumno/a) describiendo las <b>barreras que observas</b> en la tarea.</div>}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                            <button onClick={() => copiar(false)} style={S.btnPrim(plantilla.color)}>📋 Copiar</button>
                            <button onClick={guardar} style={S.btnSec}>💾 Guardar</button>
                            <button onClick={descargar} style={S.btnSec}>⬇️ .txt</button>
                        </div>
                        <div style={{ marginTop: 12, fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>Abrir en tu IA (se copia solo):</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                            {IAS.map(ia => <button key={ia.id} onClick={() => abrirEn(ia)} style={S.btnIa(ia.color)}>{ia.label} ↗</button>)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 10 }}>Revisa siempre lo que te devuelva la IA: la decisión final es del docente.</div>
                    </div>
                </div>
            </div>

            {aviso && <div style={S.toast}>{aviso}</div>}
        </div>
    );
}

function ListaGuardados({ guardados, todas, onCargar, onBorrar }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {guardados.map(g => {
                const p = todas.find(x => x.id === g.plantillaId);
                return (
                    <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px' }}>
                        <span style={{ fontSize: 22 }}>{p?.emoji || '📄'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.nombre}</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{p?.titulo || 'Plantilla borrada'} · {new Date(g.fecha).toLocaleDateString('es-ES')}</div>
                        </div>
                        <button onClick={() => onCargar(g)} style={S.btnSec}>Abrir</button>
                        <button onClick={() => onBorrar(g.id)} title="Borrar" style={{ ...S.btnSec, padding: '7px 10px' }}>🗑️</button>
                    </div>
                );
            })}
        </div>
    );
}

const S = {
    pagina: { padding: '20px 16px', maxWidth: 1100, margin: '0 auto', boxSizing: 'border-box' },
    volver: { marginBottom: 20, padding: '7px 14px', borderRadius: 8, border: '1px solid #dde', background: 'white', cursor: 'pointer', fontSize: '0.85rem', color: '#555' },
    h2: { color: '#2c3e50', margin: '0 0 8px', textAlign: 'center' },
    h3: { color: '#334155', margin: '26px 0 12px', fontSize: '1.05rem' },
    sub: { color: '#64748b', margin: '0 auto', maxWidth: 680 },
    rejilla: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 230px), 1fr))', gap: 14 },
    tarjeta: c => ({ background: 'white', borderRadius: 14, padding: 16, cursor: 'pointer', border: `2px solid ${c}30`, borderLeft: `5px solid ${c}`, boxShadow: '0 3px 10px rgba(0,0,0,0.05)', transition: 'transform 0.15s' }),
    caja: { background: 'white', borderRadius: 14, padding: 18, border: '1px solid #e2e8f0', boxShadow: '0 3px 12px rgba(0,0,0,0.05)', boxSizing: 'border-box', minWidth: 0 },
    label: { display: 'block', fontWeight: 700, fontSize: '0.86rem', color: '#334155', marginBottom: 5 },
    input: { width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 9, border: '1px solid #cbd5e1', fontSize: '0.92rem', outline: 'none', background: '#fff', color: '#1e293b' },
    chip: { padding: '4px 9px', borderRadius: 999, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', cursor: 'pointer', fontSize: '0.76rem' },
    chipHueco: { display: 'inline-block', margin: '2px 4px', padding: '2px 8px', borderRadius: 999, background: '#ffedd5', color: '#9a3412', fontSize: '0.78rem', fontWeight: 700 },
    opcion: (on, c) => ({ padding: '6px 12px', borderRadius: 8, border: `2px solid ${on ? c : '#e2e8f0'}`, background: on ? `${c}15` : 'white', color: on ? c : '#475569', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }),
    btnPrim: c => ({ padding: '9px 16px', borderRadius: 9, border: 'none', background: c, color: 'white', fontWeight: 800, cursor: 'pointer', fontSize: '0.9rem' }),
    btnSec: { padding: '7px 13px', borderRadius: 9, border: '1px solid #cbd5e1', background: 'white', color: '#334155', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' },
    btnIa: c => ({ padding: '7px 12px', borderRadius: 9, border: `2px solid ${c}`, background: 'white', color: c, fontWeight: 800, cursor: 'pointer', fontSize: '0.84rem' }),
    btnMini: { position: 'absolute', top: 8, right: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 15 },
    preview: { whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.9rem', lineHeight: 1.6, color: '#1e293b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, maxHeight: '55vh', overflowY: 'auto' },
    marcaHueco: { background: '#ffedd5', color: '#9a3412', borderRadius: 4, padding: '0 3px', fontWeight: 700 },
    marcaLleno: { background: '#dcfce7', color: '#14532d', borderRadius: 4, padding: '0 2px' },
    privacidad: { background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e3a8a', borderRadius: 12, padding: '12px 14px', fontSize: '0.88rem', lineHeight: 1.5 },
    privacidadMini: { background: '#eff6ff', color: '#1e3a8a', borderRadius: 8, padding: '8px 10px', fontSize: '0.8rem', marginBottom: 14 },
    alerta: { marginTop: 10, background: '#fef3c7', border: '1px solid #fcd34d', color: '#78350f', borderRadius: 10, padding: '9px 11px', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: 6 },
    toast: { position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: 'white', padding: '11px 18px', borderRadius: 10, fontSize: '0.9rem', zIndex: 10000, boxShadow: '0 6px 20px rgba(0,0,0,0.25)', maxWidth: 'calc(100vw - 32px)', textAlign: 'center' },
};
