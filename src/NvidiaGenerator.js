// Generación de contenido con la API de NVIDIA (proxy api/nvidia.js, solo admin).
import { auth } from './firebase';

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

async function llamarNvidia(messages, opciones = {}) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Inicia sesión para usar la IA.');

    const r = await fetch('/api/nvidia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages, ...opciones }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error?.message || data.error || data.detail || `Error ${r.status}`);
    const texto = data.choices?.[0]?.message?.content;
    if (!texto) throw new Error('La IA no devolvió contenido.');
    return { texto, modelo: data.model };
}

function extraerArrayJSON(texto) {
    const limpio = texto.replace(/```json/gi, '').replace(/```/g, '').trim();
    const ini = limpio.indexOf('[');
    const fin = limpio.lastIndexOf(']');
    if (ini === -1 || fin <= ini) throw new Error('La respuesta de la IA no contiene un JSON válido.');
    return JSON.parse(limpio.slice(ini, fin + 1));
}

/**
 * Genera un rosco de Pasapalabra.
 * @returns {Promise<Array>} hojas en el formato del editor: [{ nombreHoja, preguntas: [{letra, pregunta, respuesta}] }]
 */
export async function generarPasapalabraNvidia({ tema, idioma, nivel, numPreguntas }) {
    const n = Math.min(25, Math.max(15, Number(numPreguntas) || 20));

    const system = 'Eres un profesor experto que crea roscos de Pasapalabra educativos. Respondes ÚNICAMENTE con JSON válido, sin markdown ni comentarios.';
    const user = `Crea un rosco de Pasapalabra con EXACTAMENTE ${n} preguntas.
- Temática: ${tema}
- Idioma de preguntas y respuestas: ${idioma}
- Nivel del alumnado: ${nivel}

Reglas:
1. Cada pregunta usa una letra DISTINTA del alfabeto A-Z (sin Ñ), en orden alfabético.
2. Prioriza que la respuesta EMPIECE por la letra. La definición debe empezar por "Empieza por la X:" (traducido al idioma pedido).
3. Solo si para una letra no hay palabra razonable que empiece por ella, usa una que la CONTENGA y la definición debe empezar por "Contiene la X:" (traducido al idioma pedido).
4. La respuesta es una sola palabra (o término muy corto), adecuada al nivel, sin ambigüedad y sin que aparezca en la definición.
5. Definiciones claras y breves, adaptadas al nivel.

Formato exacto:
[{"letra":"A","pregunta":"Empieza por la A: ...","respuesta":"..."}]`;

    const mensajes = [{ role: 'system', content: system }, { role: 'user', content: user }];
    const minimo = Math.ceil(n * 0.6); // por debajo de esto se considera un fallo del modelo
    const excluir = [];
    let mejor = [];
    let ultimoError = null;

    // Si un modelo devuelve JSON roto o muy pocas preguntas válidas, se pide al siguiente.
    for (let intento = 0; intento < 5; intento++) {
        let respuesta;
        try {
            respuesta = await llamarNvidia(mensajes, { temperature: 0.6, max_tokens: 4096, excluir });
        } catch (e) {
            ultimoError = e;
            break; // el servidor ya ha probado todos los modelos que quedaban
        }
        try {
            const preguntas = validarRosco(extraerArrayJSON(respuesta.texto));
            if (preguntas.length > mejor.length) mejor = preguntas;
            if (preguntas.length >= minimo) break;
            ultimoError = new Error(`${respuesta.modelo}: solo ${preguntas.length} preguntas válidas`);
        } catch (e) {
            ultimoError = new Error(`${respuesta.modelo}: ${e.message}`);
        }
        console.warn('NVIDIA: se pasa al siguiente modelo →', ultimoError.message);
        if (!respuesta.modelo) break;
        excluir.push(respuesta.modelo);
    }

    if (!mejor.length) throw ultimoError || new Error('La IA no generó preguntas válidas. Prueba de nuevo.');
    return [{ nombreHoja: tema.slice(0, 40), preguntas: mejor }];
}

function validarRosco(crudo) {
    const usadas = new Set();
    const preguntas = [];
    for (const q of crudo) {
        const pregunta = String(q?.pregunta || '').trim();
        const respuesta = String(q?.respuesta || '').trim();
        const letra = sinTildes(String(q?.letra || respuesta.charAt(0) || '')).toUpperCase().charAt(0);
        if (!pregunta || !respuesta || !ABC.includes(letra) || usadas.has(letra)) continue;
        // La letra tiene que estar en la respuesta (al inicio o contenida)
        if (!sinTildes(respuesta).toUpperCase().includes(letra)) continue;
        usadas.add(letra);
        preguntas.push({ letra, pregunta, respuesta, correcta: '', incorrectas: ['', '', ''] });
    }
    return preguntas.sort((a, b) => a.letra.localeCompare(b.letra));
}
