import { GoogleGenerativeAI } from "@google/generative-ai";

export const generarPreguntasGemini = async (apiKey, tema, tipoJuego) => {
    // SOLO ponemos los modelos que salían en tu lista JSON oficial
    const MODELOS = ["gemini-2.0-flash", "gemini-2.5-flash"];

    let errorFinal = null;

    for (const modelo of MODELOS) {
        try {
            console.log(`📡 Probando modelo: ${modelo}...`);
            const genAI = new GoogleGenerativeAI(apiKey);
            const aiModel = genAI.getGenerativeModel({ model: modelo });

            // Definimos formato según el juego
            let formato = "";
            switch (tipoJuego) {
                case 'PASAPALABRA':
                    formato = 'Un Array JSON de 6 objetos. Ejemplo: [{"letra":"A","pregunta":"Definición","respuesta":"Palabra"}]. La respuesta debe empezar por la letra.';
                    break;
                case 'CAZABURBUJAS':
                    formato = 'Un Array JSON de 10 objetos. Ejemplo: [{"pregunta":"¿...?","correcta":"Bien","incorrectas":["Mal1","Mal2"]}]';
                    break;
                case 'THINKHOOT':
                    formato = 'Un Array JSON de 10 objetos mixtos. Ejemplo: [{"pregunta":"...","correcta":"...","tipo":"test","incorrectas":["..."]}]';
                    break;
                case 'APAREJADOS':
                    formato = 'Un Array JSON de 8 parejas. Ejemplo: [{"terminoA":"Concepto","terminoB":"Definición"}]';
                    break;
                default:
                    throw new Error("Juego no soportado");
            }

            const prompt = `
        Genera un ejercicio sobre: "${tema}".
        Juego: ${tipoJuego}.
        Responde ÚNICAMENTE con el JSON válido (sin markdown \`\`\`).
        Estructura: ${formato}
      `;

            const result = await aiModel.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            console.log(`✅ ¡Éxito con ${modelo}!`);

            // Limpieza del JSON
            const jsonLimpio = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return [{ nombreHoja: `IA ${tema}`, preguntas: JSON.parse(jsonLimpio) }];

        } catch (error) {
            console.warn(`❌ Falló ${modelo}:`, error.message);

            // Si el error es 429, es que nos hemos pasado de velocidad.
            if (error.message.includes("429")) {
                alert("⏳ La IA está saturada (Error 429). Espera 1 minuto y vuelve a probar.");
                throw new Error("Límite de cuota excedido. Espera un poco.");
            }

            errorFinal = error;
            // Si falla, el bucle intentará automáticamente con el siguiente modelo de la lista
        }
    }

    // Si llegamos aquí, fallaron el 2.0 y el 2.5
    throw new Error(`No se pudo generar. Último error: ${errorFinal ? errorFinal.message : 'Desconocido'}`);
};