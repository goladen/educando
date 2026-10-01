// Modelos para la generación de recursos con IA (el "_" evita que Vercel lo publique).
// Orden según pruebas con scripts/probar-nvidia.mjs (2026-10-01, rosco de 20):
// Nemotron Super ~15 s, Gemma 4 60-100 s (mejor calidad), GPT-OSS ~30 s,
// Nemotron Lightning ~80 s. Gemini queda como último recurso.
// NVIDIA retira modelos cada pocos meses: lista pública en
// https://integrate.api.nvidia.com/v1/models

export const MODELOS = [
    process.env.NVIDIA_MODEL,
    'nvidia/nemotron-3-super-120b-a12b',
    'google/gemma-4-31b-it',
    'openai/gpt-oss-20b',
    'nvidia/nemotron-3.5-lightning-30b-a3b',
    'google/gemma-3-12b-it',
    'gemini:gemini-2.5-flash',
    'gemini:gemini-2.0-flash',
].filter(Boolean);

// Los modelos que "razonan" escriben el razonamiento en el texto y se quedan sin
// tokens antes del JSON: se desactiva o se reduce al mínimo.
export function opcionesModelo(modelo) {
    if (modelo.startsWith('nvidia/nemotron')) return { chat_template_kwargs: { enable_thinking: false } };
    if (modelo.startsWith('openai/gpt-oss')) return { reasoning_effort: 'low' };
    return {};
}
