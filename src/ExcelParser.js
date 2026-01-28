import readXlsxFile from 'read-excel-file';

export const procesarArchivoExcel = async (file, tipoJuego) => {
    try {
        // Si viene de Drive es un Blob, si viene del PC es un File. Ambos funcionan igual aquí.
        const sheets = await readXlsxFile(file, { getSheets: true });

        const resultado = [];

        for (const sheet of sheets) {
            const rows = await readXlsxFile(file, { sheet: sheet.name });

            // Limpieza básica: Quitamos filas vacías del todo
            const filasConDatos = rows.filter(row => row.some(celda => celda !== null && celda !== ""));

            // Detectar y saltar encabezados (si la fila 1 tiene textos como "Pregunta", "Letra"...)
            const primeraFila = filasConDatos[0] ? filasConDatos[0].map(c => c?.toString().toLowerCase()) : [];
            const esEncabezado = primeraFila.includes("pregunta") || primeraFila.includes("letra") || primeraFila.includes("termino");

            const filasAProcesar = esEncabezado ? filasConDatos.slice(1) : filasConDatos;

            // Procesamos fila a fila sin que explote
            const preguntasProcesadas = filasAProcesar.map(row => {
                try {
                    return formatearFila(row, tipoJuego);
                } catch (e) {
                    console.warn(`Fila ignorada en hoja ${sheet.name}:`, row);
                    return null;
                }
            }).filter(p => p !== null);

            if (preguntasProcesadas.length > 0) {
                resultado.push({
                    nombreHoja: sheet.name,
                    preguntas: preguntasProcesadas
                });
            }
        }

        return resultado;
    } catch (error) {
        console.error("Error crítico leyendo Excel:", error);
        // Devolvemos array vacío en vez de romper la app
        return [];
    }
};

// AYUDANTE: Convierte filas en objetos JSON
const formatearFila = (row, tipo) => {
    if (!row || row.length === 0) return null;

    const str = (index) => (row[index] !== undefined && row[index] !== null) ? row[index].toString().trim() : "";

    switch (tipo) {
        case 'PASAPALABRA':
            // Necesita 3 columnas: Letra | Definición | Respuesta
            if (!str(0) || !str(1) || !str(2)) return null;
            return {
                letra: str(0).toUpperCase(),
                pregunta: str(1),
                respuesta: str(2)
            };

        case 'CAZABURBUJAS':
            // Necesita mínimo 2 columnas: Pregunta | Correcta | (Incorrectas opcionales)
            if (!str(0) || !str(1)) return null;
            // Las incorrectas son desde la columna 2 en adelante
            const incorrectas = row.slice(2).map(val => val ? val.toString().trim() : "").filter(v => v !== "");
            return {
                pregunta: str(0),
                correcta: str(1),
                incorrectas: incorrectas
            };

        case 'THINKHOOT':
            // Estructura: Pregunta | Correcta | (Incorrectas...)
            if (!str(0) || !str(1)) return null;
            const inc = row.slice(2).map(val => val ? val.toString().trim() : "").filter(v => v !== "");
            return {
                pregunta: str(0),
                correcta: str(1),
                tipo: inc.length > 0 ? 'test' : 'corta', // Si hay incorrectas es Test, si no, es Corta
                incorrectas: inc
            };

        case 'APAREJADOS':
            // Necesita 2 columnas: Término A | Término B
            if (!str(0) || !str(1)) return null;
            return {
                terminoA: str(0),
                terminoB: str(1)
            };

        default:
            return null;
    }
};