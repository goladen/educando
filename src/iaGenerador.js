// Navegador: generación automática de recursos con IA (api/ia-recurso.js)
// y lectura de documentos de referencia (.txt, .pdf, .docx).
import { auth } from './firebase';
import { interpretarRespuesta, minimoValidas, normalizarParams } from './iaRecursos';

async function token() {
    const t = await auth.currentUser?.getIdToken();
    if (!t) throw new Error('Inicia sesión para usar la IA.');
    return t;
}

async function postIA(body) {
    return fetch('/api/ia-recurso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
        body: JSON.stringify(body),
    });
}

/** { disponible, proximo, ilimitado } del usuario actual. */
export async function estadoUsoIA() {
    const r = await postIA({ accion: 'estado' });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Error ${r.status}`);
    return data;
}

// Una petición = un modelo. Devuelve { texto, modelo, quedan } o lanza un Error
// con .modelo/.quedan (para pasar al siguiente) o .limite/.proximo.
async function pedirUnModelo(tipo, params, excluir) {
    const r = await postIA({ tipo, params, excluir });

    if (!r.ok) {
        const crudo = await r.text();
        let data = {};
        try { data = JSON.parse(crudo); } catch { /* respuesta no JSON (Cloudflare/Vercel) */ }
        const motivo = data.error || crudo.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300) || `Error ${r.status}`;
        const err = new Error(data.model ? `${data.model}: ${motivo}` : motivo);
        Object.assign(err, { modelo: data.model, quedan: data.quedan ?? 0, limite: !!data.limite, proximo: data.proximo });
        throw err;
    }

    // Streaming SSE de OpenAI: "data: {choices:[{delta:{content}}]}" ... "data: [DONE]"
    const modelo = r.headers.get('X-Modelo');
    const quedan = Number(r.headers.get('X-Quedan') || 0);
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let texto = '';
    let errorStream = null;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lineas = buffer.split('\n');
        buffer = lineas.pop();
        for (const linea of lineas) {
            const l = linea.trim();
            if (!l.startsWith('data:')) continue;
            const payload = l.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            try {
                const ev = JSON.parse(payload);
                if (ev.error) errorStream = typeof ev.error === 'string' ? ev.error : JSON.stringify(ev.error);
                texto += ev.choices?.[0]?.delta?.content || '';
            } catch { /* fragmento incompleto */ }
        }
    }
    if (!texto.trim()) {
        throw Object.assign(new Error(`${modelo}: ${errorStream || 'respuesta vacía'}`), { modelo, quedan });
    }
    return { texto, modelo, quedan };
}

/**
 * Genera un recurso probando modelos en cascada hasta obtener uno válido.
 * @param onProgreso (mensaje) => void
 * @returns {Promise<{ hojas, validas, modelo }>}
 */
export async function generarRecursoIA(tipo, params, onProgreso = () => {}) {
    const p = normalizarParams(tipo, params);
    const minimo = minimoValidas(p.n);
    const excluir = [];
    const errores = [];
    let mejor = null;

    for (let intento = 0; intento < 12; intento++) {
        onProgreso(intento === 0 ? 'Generando…' : `Probando otro modelo (${intento + 1})…`);
        let respuesta;
        try {
            respuesta = await pedirUnModelo(tipo, p, excluir);
        } catch (e) {
            if (e.limite) throw e;
            errores.push(e.message);
            if (!e.modelo || !e.quedan) break;
            excluir.push(e.modelo);
            continue;
        }
        try {
            const r = interpretarRespuesta(tipo, respuesta.texto, p);
            if (!mejor || r.validas > mejor.validas) mejor = { ...r, modelo: respuesta.modelo };
            if (r.validas >= minimo) break;
            console.warn(`IA ${respuesta.modelo}: pocas preguntas válidas:\n`, respuesta.texto);
            errores.push(`${respuesta.modelo}: solo ${r.validas} válidas de ${p.n}`);
        } catch (e) {
            console.warn(`IA ${respuesta.modelo}: respuesta no interpretable:\n`, respuesta.texto);
            errores.push(`${respuesta.modelo}: ${e.message}`);
        }
        if (!respuesta.modelo || !respuesta.quedan) break;
        excluir.push(respuesta.modelo);
    }

    if (!mejor?.validas) throw new Error(errores.join('\n') || 'La IA no generó contenido válido. Prueba de nuevo.');
    return mejor;
}

// ---------------------------------------------------------------------------
// DOCUMENTOS DE REFERENCIA
// ---------------------------------------------------------------------------

/** Extrae el texto de un .txt, .md, .pdf o .docx. */
export async function textoDeArchivo(file) {
    const nombre = file.name.toLowerCase();

    if (nombre.endsWith('.pdf')) {
        const pdfjsLib = await import('pdfjs-dist');
        const { default: worker } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
        pdfjsLib.GlobalWorkerOptions.workerSrc = worker;
        const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
        const paginas = [];
        for (let i = 1; i <= pdf.numPages; i++) {
            const contenido = await (await pdf.getPage(i)).getTextContent();
            paginas.push(contenido.items.map(it => it.str).join(' '));
        }
        return paginas.join('\n\n').replace(/[ \t]+/g, ' ').trim();
    }

    if (nombre.endsWith('.docx')) {
        const { default: JSZip } = await import('jszip');
        const zip = await JSZip.loadAsync(await file.arrayBuffer());
        const xml = await zip.file('word/document.xml')?.async('string');
        if (!xml) throw new Error('El .docx no tiene contenido legible.');
        return xml
            .replace(/<w:tab\/>/g, ' ')
            .replace(/<\/w:p>/g, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    if (/\.(txt|md|csv)$/.test(nombre) || file.type.startsWith('text/')) return (await file.text()).trim();

    throw new Error('Formato no admitido. Usa .txt, .pdf o .docx (o pega el texto).');
}
