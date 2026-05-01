// DominoFichas.js

// Valores objetivo (7 valores por modo para hacer las 28 fichas del dominó doble-6)
const TARGETS = {
    NATURALES:  [1, 2, 3, 4, 5, 6, 10],
    ENTEROS:    [-3, -1, 0, 2, 4, -5, 7],
    DECIMALES:  [0.5, 1.2, 2.5, 3.0, 4.5, 1.5, 0.2],
    FRACCIONES: ['1/2', '1/3', '1/4', '2/3', '3/4', '1/5', '1'],
    ECUACIONES: [1, 2, 3, -1, -2, 0, 5] // El resultado de la 'x'
};

// Generadores de operaciones aleatorias que dan como resultado un valor específico
const generarOperacion = (val, modo) => {
    const r = Math.random();
    if (modo === 'NATURALES') {
        if (r < 0.33) return `${val + 2} - 2`;
        if (r < 0.66) return `${val * 2} / 2`;
        let a = Math.max(1, Math.floor(val / 2));
        return `${a} + ${val - a}`;
    }
    if (modo === 'ENTEROS') {
        if (r < 0.33) return `${val - 3} + 3`;
        if (r < 0.66) return `${val * -1} × (-1)`;
        return `${val + 5} - 5`;
    }
    if (modo === 'DECIMALES') {
        if (r < 0.33) return `${(val + 0.5).toFixed(1)} - 0.5`;
        if (r < 0.66) return `${(val / 2).toFixed(2)} × 2`;
        return `${(val - 0.1).toFixed(1)} + 0.1`;
    }
    if (modo === 'FRACCIONES') {
        const [n, d] = val.split('/').map(Number);
        if (!d) return `${n}/2 + ${n}/2`; // Para el '1'
        if (r < 0.33) return `${n * 2}/${d * 2}`; // Fracción equivalente
        if (r < 0.66) return `${n}/${d * 2} + ${n}/${d * 2}`;
        return `${n * 3}/${d * 3}`;
    }
    if (modo === 'ECUACIONES') {
        if (r < 0.33) return `x + 1 = ${val + 1}`;
        if (r < 0.66) return `2x = ${val * 2}`;
        return `x - 2 = ${val - 2}`;
    }
    return val;
};

// Formato visual puro del resultado
const formatoSolucion = (val, modo) => {
    if (modo === 'ECUACIONES') return `x=${val}`;
    return `${val}`;
};

export const generarFichas = (modo) => {
    const targets = TARGETS[modo];
    let fichas = [];
    let idCounter = 0;

    // Generar las 28 combinaciones (doble 6 equivale a 7 valores combinados entre sí)
    for (let i = 0; i < 7; i++) {
        for (let j = i; j < 7; j++) {
            const valA = targets[i];
            const valB = targets[j];

            // Para evitar patrones predecibles, aleatorizamos qué lado lleva la operación y cuál la solución
            const ladoA_esOp = Math.random() > 0.5;
            
            const textA = ladoA_esOp ? generarOperacion(valA, modo) : formatoSolucion(valA, modo);
            const textB = !ladoA_esOp ? generarOperacion(valB, modo) : formatoSolucion(valB, modo);

            fichas.push({
                id: `ficha_${idCounter++}`,
                valA: valA, // Valor matemático real para comparar
                valB: valB,
                textA: textA, // Texto a mostrar en el extremo A
                textB: textB, // Texto a mostrar en el extremo B
                isDouble: i === j
            });
        }
    }
    
    // Barajar fichas usando algoritmo de Fisher-Yates
    for (let i = fichas.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [fichas[i], fichas[j]] = [fichas[j], fichas[i]];
    }
    
    return fichas;
};

export const MODOS_DOMINO = [
    {id: 'NATURALES', label: 'Naturales', desc: 'Operaciones básicas', color: '#27ae60', icon: '🔢'},
    {id: 'ENTEROS', label: 'Enteros', desc: 'Positivos y negativos', color: '#3498db', icon: '±'},
    {id: 'DECIMALES', label: 'Decimales', desc: 'Cálculo con decimales', color: '#f39c12', icon: '0.5'},
    {id: 'FRACCIONES', label: 'Fracciones', desc: 'Sumas y equivalencias', color: '#9b59b6', icon: '½'},
    {id: 'ECUACIONES', label: 'Ecuaciones', desc: 'Despeja la X', color: '#e74c3c', icon: 'x='}
];