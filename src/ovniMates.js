// Generador de rondas de números para Ovni Abducción.
// Cada ronda devuelve { objetivo, items: [{ texto, correcta, explicacion }] }:
// los items correctos son los que hay que abducir y los incorrectos llevan la
// explicación que se enseña si el alumno los sube a la nave.

export const TIPOS_MATES = [
    { id: 'primos', nombre: 'Números primos', emoji: '🔒' },
    { id: 'compuestos', nombre: 'Números compuestos', emoji: '🧱' },
    { id: 'divisores', nombre: 'Divisores de un número', emoji: '➗' },
    { id: 'multiplos', nombre: 'Múltiplos de un número', emoji: '✖️' },
    { id: 'irreducibles', nombre: 'Fracciones irreducibles', emoji: '½' },
    { id: 'potencias2', nombre: 'Potencias de 2', emoji: '2ⁿ' },
    { id: 'potencias3', nombre: 'Potencias de 3', emoji: '3ⁿ' },
    { id: 'mayores', nombre: 'Mayores que…', emoji: '>' },
    { id: 'menores', nombre: 'Menores que…', emoji: '<' },
];

const POR_RONDA = 8;

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const barajar = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
};
const rango = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const mcd = (a, b) => (b ? mcd(b, a % b) : a);
const esPrimo = (n) => {
    if (n < 2) return false;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
    return true;
};
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const sup = (n) => String(n).split('').map(c => SUP[c]).join('');
/** 72 → «2³ × 3²» */
const factoriza = (n) => {
    const partes = [];
    let m = n;
    for (let p = 2; p * p <= m; p++) {
        let e = 0;
        while (m % p === 0) { m /= p; e++; }
        if (e) partes.push(e > 1 ? `${p}${sup(e)}` : `${p}`);
    }
    if (m > 1) partes.push(`${m}`);
    return partes.join(' × ');
};
const fmt = (n) => n.toLocaleString('es-ES', { maximumFractionDigits: 2 });

/** Junta 3-4 correctas y completa con incorrectas hasta POR_RONDA, sin textos repetidos. */
const montar = (objetivo, correctas, incorrectas) => {
    const vistos = new Set();
    const unicos = (lista) => lista.filter(it => (vistos.has(it.texto) ? false : (vistos.add(it.texto), true)));
    const nC = Math.min(3 + rnd(0, 1), correctas.length);
    const ok = unicos(barajar(correctas)).slice(0, nC).map(it => ({ ...it, correcta: true }));
    const mal = unicos(barajar(incorrectas)).slice(0, POR_RONDA - ok.length).map(it => ({ ...it, correcta: false }));
    return { objetivo, items: barajar([...ok, ...mal]) };
};

const GENERADORES = {
    primos(nivel) {
        const max = nivel === 'eso' ? 200 : 100;
        const primos = rango(2, max).filter(esPrimo);
        // los compuestos impares son los que más engañan (21, 51, 91…)
        const compuestos = rango(4, max).filter(n => !esPrimo(n));
        const trampas = compuestos.filter(n => n % 2 && n % 5);
        const incorrectas = [...barajar(trampas).slice(0, 4), ...barajar(compuestos).slice(0, 4)]
            .map(n => ({ texto: `${n}`, explicacion: `${n} = ${factoriza(n)}, es compuesto` }));
        if (Math.random() < 0.35) incorrectas.unshift({ texto: '1', explicacion: 'el 1 no es primo ni compuesto' });
        return montar('Números primos', primos.map(n => ({ texto: `${n}` })), incorrectas);
    },
    compuestos(nivel) {
        const max = nivel === 'eso' ? 200 : 100;
        const compuestos = rango(4, max).filter(n => !esPrimo(n));
        const primos = rango(2, max).filter(esPrimo);
        const incorrectas = primos.map(p => ({ texto: `${p}`, explicacion: `${p} solo se divide entre 1 y ${p}: es primo` }));
        if (Math.random() < 0.35) incorrectas.unshift({ texto: '1', explicacion: 'el 1 no es primo ni compuesto' });
        const trampas = compuestos.filter(n => n % 2 && n % 5);
        const correctas = [...barajar(trampas).slice(0, 3), ...barajar(compuestos).slice(0, 3)].map(n => ({ texto: `${n}` }));
        return montar('Números compuestos', correctas, barajar(incorrectas).slice(0, 8));
    },
    divisores(nivel) {
        const opciones = nivel === 'eso' ? [24, 30, 36, 40, 48, 60, 72, 84, 90, 96, 100, 120, 144, 180] : [12, 16, 18, 20, 24, 28, 30, 36, 40, 48];
        const N = pick(opciones);
        const divs = rango(1, N).filter(d => N % d === 0);
        const noDivs = rango(2, N - 1).filter(d => N % d !== 0);
        // sobre todo números pequeños, que son los que se confunden con divisores
        const pequeños = noDivs.filter(d => d <= N / 2);
        const elegidos = [...barajar(pequeños).slice(0, 5), ...barajar(noDivs).slice(0, 2)];
        const incorrectas = [...new Set(elegidos)].map(d => ({
            texto: `${d}`,
            explicacion: `${N} : ${d} no es exacta (${N} = ${d} × ${Math.floor(N / d)} + ${N % d})`,
        }));
        incorrectas.push({ texto: `${N * 2}`, explicacion: `${N * 2} es múltiplo de ${N}, no divisor` });
        return montar(`Divisores de ${N}`, divs.map(d => ({ texto: `${d}` })), incorrectas);
    },
    multiplos(nivel) {
        const k = nivel === 'eso' ? rnd(6, 15) : rnd(3, 10);
        const tope = k * (nivel === 'eso' ? 15 : 10);
        const multiplos = rango(1, tope / k).map(m => m * k);
        const noMult = rango(k + 1, tope).filter(n => n % k !== 0);
        // trampas: justo al lado de un múltiplo
        const cerca = noMult.filter(n => n % k === 1 || n % k === k - 1);
        const explica = (n) => ({ texto: `${n}`, explicacion: `${n} = ${k} × ${Math.floor(n / k)} + ${n % k}, no es múltiplo de ${k}` });
        const incorrectas = [...barajar(cerca).slice(0, 4), ...barajar(noMult).slice(0, 4)].map(explica);
        const divsK = rango(2, k - 1).filter(d => k % d === 0);
        if (divsK.length) { const d = pick(divsK); incorrectas.unshift({ texto: `${d}`, explicacion: `${d} es divisor de ${k}, no múltiplo` }); }
        return montar(`Múltiplos de ${k}`, multiplos.map(n => ({ texto: `${n}` })), incorrectas);
    },
    irreducibles(nivel) {
        const max = nivel === 'eso' ? 20 : 12;
        const irred = [];
        for (let b = 2; b <= max; b++) for (let a = 1; a < b; a++) if (mcd(a, b) === 1) irred.push([a, b]);
        const reducibles = [];
        irred.forEach(([a, b]) => {
            for (let g = 2; g <= 5; g++) if (b * g <= max * 2) reducibles.push([a * g, b * g, g]);
        });
        const correctas = irred.filter(([, b]) => b > 2).map(([a, b]) => ({ texto: `${a}/${b}` }));
        const incorrectas = reducibles.map(([a, b]) => {
            const g = mcd(a, b);
            return { texto: `${a}/${b}`, explicacion: `${a}/${b} se simplifica entre ${g}: es ${a / g}/${b / g}` };
        });
        return montar('Fracciones irreducibles', correctas, incorrectas);
    },
    potencias2(nivel) {
        const maxE = nivel === 'eso' ? 10 : 7;
        const tope = 2 ** maxE;
        const pot = rango(1, maxE).map(e => 2 ** e);
        // pares que no son potencias: 3·2ⁿ, 5·2ⁿ, 7·2ⁿ…
        const noPot = rango(3, tope).filter(n => n % 2 === 0 && (n & (n - 1)) !== 0);
        const trampas = noPot.filter(n => [3, 5, 7].some(f => n % f === 0 && ((n / f) & (n / f - 1)) === 0));
        const explica = (n) => ({ texto: `${n}`, explicacion: `${n} = ${factoriza(n)}, no es potencia de 2` });
        const incorrectas = [...barajar(trampas).slice(0, 5), ...barajar(noPot).slice(0, 3)].map(explica);
        incorrectas.push({ texto: '27', explicacion: '27 = 3³, es potencia de 3' });
        return montar('Potencias de 2', pot.map(n => ({ texto: `${n}` })), incorrectas);
    },
    potencias3(nivel) {
        const maxE = nivel === 'eso' ? 6 : 5;
        const tope = 3 ** maxE;
        const pot = rango(1, maxE).map(e => 3 ** e);
        const esPot3 = (n) => { while (n % 3 === 0) n /= 3; return n === 1; };
        const noPot = rango(4, tope).filter(n => n % 3 === 0 && !esPot3(n));
        const trampas = noPot.filter(n => esPot3(n / 2) || esPot3(n / 4)); // 6, 18, 54, 12, 36…
        const explica = (n) => ({ texto: `${n}`, explicacion: `${n} = ${factoriza(n)}, no es potencia de 3` });
        const incorrectas = [...barajar(trampas).slice(0, 4), ...barajar(noPot).slice(0, 4)].map(explica);
        incorrectas.push({ texto: '16', explicacion: '16 = 2⁴, es potencia de 2' });
        return montar('Potencias de 3', pot.map(n => ({ texto: `${n}` })), incorrectas);
    },
    mayores(nivel) { return comparar(nivel, true); },
    menores(nivel) { return comparar(nivel, false); },
};

// Mayores / menores. Primaria: enteros cerca del número. ESO: decimales y negativos
// (se trabaja en centésimas para no arrastrar errores de coma flotante).
function comparar(nivel, mayores) {
    const enteros = nivel !== 'eso';
    const N = enteros ? rnd(15, 95) * 100 : pick([rnd(-8, 8) * 100, rnd(-8, 8) * 100 + 50, rnd(-40, 40) * 10]);
    const saltos = enteros ? [100, 200, 300, 500, 800, 1000, 1500, 2000, 2500] : [1, 5, 9, 10, 25, 40, 50, 90, 100, 150, 250, 400];
    const arriba = [], abajo = [];
    saltos.forEach(s => { arriba.push(N + s); abajo.push(N - s); });
    const txt = (h) => fmt(h / 100);
    const nTxt = txt(N);
    const objetivo = `${mayores ? 'Mayores' : 'Menores'} que ${nTxt}`;
    const buenos = mayores ? arriba : abajo;
    const malos = mayores ? abajo : arriba;
    const correctas = buenos.map(h => ({ texto: txt(h) }));
    const incorrectas = malos.map(h => ({ texto: txt(h), explicacion: `${txt(h)} es ${mayores ? 'menor' : 'mayor'} que ${nTxt}` }));
    // el propio número es la trampa clásica
    incorrectas.unshift({ texto: nTxt, explicacion: `${nTxt} es igual, no ${mayores ? 'mayor' : 'menor'}` });
    const res = montar(objetivo, correctas, [incorrectas[0], ...barajar(incorrectas.slice(1))]);
    return res;
}

/**
 * Devuelve generarRonda(i) para el motor del juego.
 * @param {string[]} tipos  ids de TIPOS_MATES elegidos
 * @param {'primaria'|'eso'} nivel
 */
export const crearGeneradorMates = (tipos, nivel = 'primaria') => {
    const lista = tipos.filter(t => GENERADORES[t]);
    if (!lista.length) return null;
    let cola = [];
    let ultimo = null;
    return () => {
        if (!cola.length) {
            cola = barajar(lista);
            if (cola.length > 1 && cola[0] === ultimo) cola.push(cola.shift());
        }
        ultimo = cola.shift();
        return GENERADORES[ultimo](nivel);
    };
};
