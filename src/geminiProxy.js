// Cliente del proxy seguro de Gemini.
// Llama a /api/gemini (Vercel Function) — la clave nunca sale al navegador.
export async function callGeminiProxy({ model = 'gemini-2.0-flash', contents, generationConfig }) {
    const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, contents, generationConfig }),
    });

    const data = await res.json();

    if (!res.ok) {
        const msg = data?.error?.message || data?.error || `Gemini error ${res.status}`;
        throw new Error(msg);
    }

    return data;
}

export function extractText(data) {
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}
