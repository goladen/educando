// Lógica pura del generador de Pasapalabra con NVIDIA (sin Firebase), compartida
// por src/NvidiaGenerator.js (web) y scripts/probar-nvidia.mjs (prueba local).

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

export function mensajesPasapalabra({ tema, idioma, nivel, n }) {
    const system = 'Eres un profesor experto que crea roscos de Pasapalabra educativos. Respondes ÚNICAMENTE con JSON válido, sin markdown ni comentarios.';
    // El orden de los campos importa: el modelo escribe primero la PALABRA y luego
    // la define. Si escribe antes la definición, fuerza palabras que no encajan.
    const user = `Crea un rosco de Pasapalabra con EXACTAMENTE ${n} palabras.
- Temática: ${tema}
- Idioma de TODAS las palabras y definiciones: ${idioma}
- Nivel del alumnado: ${nivel}

Cómo hacerlo:
1. Elige ${n} palabras reales en ${idioma}, relacionadas con la temática y conocidas a ese nivel, cada una con una letra inicial DISTINTA (A-Z, sin Ñ). No hace falta usar todas las letras: sáltate las difíciles.
2. Solo si te faltan palabras, puedes usar alguna que CONTENGA la letra (sin empezar por ella).
3. Para cada palabra escribe una definición correcta y precisa que tenga como única respuesta esa palabra. La palabra no puede aparecer en la definición.
4. La definición empieza por "Empieza por la X:" (o "Contiene la X:" en el caso 2), traducido al ${idioma}.
5. Revisa que cada definición describe exactamente su palabra (no otra del tema), que es adecuada al nivel ${nivel} y que todo está en ${idioma}. Si una palabra es demasiado difícil para ese nivel, cámbiala por otra.
6. Las definiciones son una sola frase, sin notas, aclaraciones ni paréntesis. No uses comillas dobles dentro del texto.

Formato exacto (ordenado por letra, "respuesta" siempre primero):
[{"respuesta":"Asteroide","letra":"A","pregunta":"Empieza por la A: ..."}]`;
    return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

// Extrae el array de preguntas aunque el modelo añada razonamiento (<think>),
// markdown, texto alrededor, comas finales o corte la respuesta a medias.
export function extraerArrayJSON(texto) {
    const limpio = texto
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/```(?:json)?/gi, '')
        .trim();

    const intentar = (s) => {
        try {
            const v = JSON.parse(s.replace(/,\s*([\]}])/g, '$1'));
            if (Array.isArray(v)) return v;
            const arr = v && Object.values(v).find(Array.isArray); // {"preguntas":[...]}
            return arr || null;
        } catch { return null; }
    };

    const ini = limpio.search(/\[\s*\{/);
    if (ini !== -1) {
        const fin = limpio.lastIndexOf(']');
        const completo = fin > ini && intentar(limpio.slice(ini, fin + 1));
        if (completo) return completo;
        // Respuesta cortada: quedarse hasta el último objeto cerrado
        const ultimo = limpio.lastIndexOf('}');
        const cortado = ultimo > ini && intentar(limpio.slice(ini, ultimo + 1) + ']');
        if (cortado) return cortado;
    }
    const obj = limpio.indexOf('{');
    const envuelto = obj !== -1 && intentar(limpio.slice(obj, limpio.lastIndexOf('}') + 1));
    if (envuelto) return envuelto;

    // Último recurso: objeto a objeto, sacando los campos con regex. Rescata JSON
    // con comillas sin escapar dentro de las definiciones (aspecto de "rollo").
    const campo = (trozo, nombre) =>
        trozo.match(new RegExp(`"${nombre}"\\s*:\\s*"([\\s\\S]*?)"\\s*(?=,\\s*"\\w+"\\s*:|\\s*\\}?$)`))?.[1];
    const rescatados = (limpio.match(/\{[^{}]*\}/g) || [])
        .map(t => t.trim())
        .map(t => intentar(`[${t}]`)?.[0] || {
            letra: campo(t, 'letra'), pregunta: campo(t, 'pregunta'), respuesta: campo(t, 'respuesta'),
        })
        .filter(q => q.pregunta && q.respuesta);
    if (rescatados.length) return rescatados;

    console.warn('NVIDIA: respuesta no interpretable:\n', texto);
    throw new Error(`JSON no válido (empieza por: "${limpio.slice(0, 80).replace(/\s+/g, ' ')}…")`);
}

export function validarRosco(crudo) {
    const usadas = new Set();
    const preguntas = [];
    for (const q of crudo) {
        const pregunta = String(q?.pregunta || '').trim();
        const respuesta = String(q?.respuesta || '').trim();
        const letra = sinTildes(String(q?.letra || respuesta.charAt(0) || '')).toUpperCase().charAt(0);
        if (!pregunta || !respuesta || !ABC.includes(letra) || usadas.has(letra)) continue;
        // "Contiene la X" (en cualquier idioma) → basta con contenerla; si no, debe empezar por ella
        const resp = sinTildes(respuesta).toUpperCase();
        const contiene = /^\s*(contiene|contains|contient|cont[eé]|enth[aä]lt|cont[eé]m)\b/i.test(pregunta);
        if (contiene ? !resp.includes(letra) : !resp.startsWith(letra)) continue;
        // Notas del propio modelo coladas en la definición ("Nota: no es válida…")
        if (/\(\s*nota|\bnot[ae]\s*:|corregir|no es v[aá]lid/i.test(pregunta)) continue;
        usadas.add(letra);
        preguntas.push({ letra, pregunta, respuesta, correcta: '', incorrectas: ['', '', ''] });
    }
    return preguntas.sort((a, b) => a.letra.localeCompare(b.letra));
}
