// Traducción por lotes usando el proxy seguro de Gemini (/api/gemini).
// La clave nunca sale al navegador (ver src/geminiProxy.js).
import { callGeminiProxy, extractText } from '../geminiProxy.js';

// Idioma origen de TODOS los textos del proyecto: español.
export const IDIOMA_ORIGEN = 'es';

// Idiomas soportados. La clave es el código guardado; el nombre se usa en el prompt.
export const IDIOMAS = {
    es: { nombre: 'Español',   etiqueta: 'Español',            bandera: '🇪🇸', promptNombre: 'Spanish' },
    en: { nombre: 'English',   etiqueta: 'English',            bandera: '🇬🇧', promptNombre: 'English' },
    ca: { nombre: 'Català',    etiqueta: 'Català / Valencià',  bandera: '🌐', promptNombre: 'Catalan/Valencian' },
    fr: { nombre: 'Français',  etiqueta: 'Français',           bandera: '🇫🇷', promptNombre: 'French' },
};

/**
 * Traduce un array de cadenas al idioma destino.
 * Devuelve un array del mismo tamaño; si algo falla, devuelve los originales.
 * @param {string[]} textos
 * @param {string} idiomaDestino  código de IDIOMAS distinto de 'es'
 * @returns {Promise<string[]>}
 */
export async function traducirLote(textos, idiomaDestino) {
    if (idiomaDestino === IDIOMA_ORIGEN || !textos.length) return textos;

    const destino = IDIOMAS[idiomaDestino]?.promptNombre || idiomaDestino;

    // Enviamos un objeto {"0":"texto",...} y pedimos el mismo objeto traducido,
    // para conservar el emparejamiento aunque el modelo reordene.
    const entrada = {};
    textos.forEach((t, i) => { entrada[i] = t; });

    const prompt = `You are a professional translator for an educational web app for children.
Translate the VALUES of the following JSON object from Spanish to ${destino}.
Rules:
- Keep the SAME keys and the SAME number of entries.
- Keep any emojis, HTML tags, {placeholders}, numbers and line breaks exactly as they are.
- Do NOT translate proper nouns, brand names or code (e.g. "pikt.es", "Pi").
- Respond ONLY with the translated JSON object, no markdown, no comments.

${JSON.stringify(entrada)}`;

    const MODELOS = ['gemini-2.0-flash', 'gemini-2.5-flash'];
    let ultimoError = null;

    for (const model of MODELOS) {
        try {
            const data = await callGeminiProxy({
                model,
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2 },
            });
            const raw = extractText(data).replace(/```json/gi, '').replace(/```/g, '').trim();
            const obj = JSON.parse(raw);
            const salida = textos.map((original, i) => {
                const v = obj[i];
                return (typeof v === 'string' && v.trim()) ? v : original;
            });
            return salida;
        } catch (err) {
            ultimoError = err;
            if (String(err.message).includes('429')) break; // saturado: no reintentar
        }
    }

    console.warn('[i18n] Falló la traducción, se usan los textos originales:', ultimoError?.message);
    return textos;
}
