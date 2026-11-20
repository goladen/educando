// ─── Señales de tráfico (catálogo + dibujo en canvas) ────────────────────────
// Todas las señales se dibujan por código (sin imágenes externas): sirven para
// el catálogo, las preguntas del test y las texturas de la ciudad 3D.

export const CATEGORIAS_SENAL = [
    { id: 'PELIGRO',     nombre: 'Peligro',      emoji: '⚠️', color: '#d32f2f', desc: 'Triangulares con borde rojo: avisan de un peligro cercano para que extremes la precaución y adecúes la velocidad.' },
    { id: 'PRIORIDAD',   nombre: 'Prioridad',    emoji: '🛑', color: '#c62828', desc: 'Indican quién pasa primero en intersecciones y estrechamientos.' },
    { id: 'PROHIBICION', nombre: 'Prohibición',  emoji: '⛔', color: '#b71c1c', desc: 'Circulares con borde rojo: prohíben una maniobra o limitan algo (velocidad, giro, entrada…).' },
    { id: 'OBLIGACION',  nombre: 'Obligación',   emoji: '🔵', color: '#1565c0', desc: 'Circulares azules: obligan a hacer algo (seguir un sentido, rodear una glorieta…).' },
    { id: 'INDICACION',  nombre: 'Indicación',   emoji: '🟦', color: '#0d47a1', desc: 'Cuadradas o rectangulares: informan (pasos de peatones, aparcamientos, zonas especiales…).' },
    { id: 'SEMAFOROS',   nombre: 'Semáforos y agentes', emoji: '🚦', color: '#2e7d32', desc: 'Las órdenes de los agentes prevalecen sobre todo; después van los semáforos, las señales y las marcas viales.' },
    { id: 'MARCAS',      nombre: 'Marcas viales', emoji: '〰️', color: '#546e7a', desc: 'Pintadas en el suelo: separan carriles, marcan dónde detenerse o por dónde cruzan los peatones.' },
];

const ROJO = '#d32f2f', AZUL = '#1565c0', NEGRO = '#111', BLANCO = '#fff', AMARILLO = '#fbc02d';

// ─── Primitivas ──────────────────────────────────────────────────────────────
const poli = (ctx, pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
const escalar = (pts, cx, cy, k) => pts.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
const disco = (ctx, x, y, r, color) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); };

function trianguloBase(ctx, s, invertido = false) {
    const m = s * 0.05, w = s - 2 * m, h = w * 0.866;
    const y0 = (s - h) / 2 + (invertido ? 0 : s * 0.03);
    const pts = invertido
        ? [[m, y0], [s - m, y0], [s / 2, y0 + h]]
        : [[s / 2, y0], [s - m, y0 + h], [m, y0 + h]];
    const cy = invertido ? y0 + h / 3 : y0 + (2 * h) / 3;
    ctx.lineJoin = 'round';
    poli(ctx, pts); ctx.fillStyle = ROJO; ctx.fill();
    ctx.lineWidth = s * 0.03; ctx.strokeStyle = ROJO; ctx.stroke();
    poli(ctx, escalar(pts, s / 2, cy, 0.7)); ctx.fillStyle = BLANCO; ctx.fill();
    return { cx: s / 2, cy: invertido ? cy - s * 0.02 : cy + s * 0.02 };
}

function circuloBase(ctx, s, { fondo = BLANCO, borde = ROJO, grosor = 0.2 } = {}) {
    const r = s * 0.47;
    disco(ctx, s / 2, s / 2, r, borde);
    disco(ctx, s / 2, s / 2, r * (1 - grosor), fondo);
    return r * (1 - grosor);
}

function cuadradoBase(ctx, s, color = AZUL, ancho = 1, alto = 1) {
    const w = s * 0.9 * ancho, h = s * 0.9 * alto, x = (s - w) / 2, y = (s - h) / 2, r = s * 0.06;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
    ctx.fillStyle = color; ctx.fill();
    ctx.lineWidth = s * 0.02; ctx.strokeStyle = BLANCO; ctx.stroke();
    return { x, y, w, h };
}

/** Flecha gruesa siguiendo una polilínea; punta en el último punto. */
function flecha(ctx, pts, grosor, color, punta = grosor * 2.2) {
    const [x1, y1] = pts[pts.length - 2], [x2, y2] = pts[pts.length - 1];
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const bx = x2 - Math.cos(ang) * punta, by = y2 - Math.sin(ang) * punta;
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = grosor; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
    ctx.beginPath();
    pts.slice(0, -1).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.lineTo(bx, by); ctx.stroke();
    const n = punta * 0.62;
    poli(ctx, [[x2, y2], [bx + Math.sin(ang) * n, by - Math.cos(ang) * n], [bx - Math.sin(ang) * n, by + Math.cos(ang) * n]]);
    ctx.fill();
}

function barraDiagonal(ctx, s, r, color = ROJO) {
    ctx.save();
    ctx.beginPath(); ctx.arc(s / 2, s / 2, r, 0, Math.PI * 2); ctx.clip();
    ctx.strokeStyle = color; ctx.lineWidth = s * 0.08; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(s / 2 - r, s / 2 - r); ctx.lineTo(s / 2 + r, s / 2 + r); ctx.stroke();
    ctx.restore();
}

/** Persona andando. (x,y) = centro, u = altura total. */
function peaton(ctx, x, y, u, color = NEGRO) {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = u * 0.13;
    disco(ctx, x + u * 0.05, y - u * 0.4, u * 0.1, color);
    ctx.beginPath(); ctx.moveTo(x + u * 0.03, y - u * 0.26); ctx.lineTo(x - u * 0.04, y + u * 0.06); ctx.stroke(); // tronco
    ctx.lineWidth = u * 0.1;
    ctx.beginPath(); ctx.moveTo(x - u * 0.04, y + u * 0.06); ctx.lineTo(x + u * 0.16, y + u * 0.26); ctx.lineTo(x + u * 0.14, y + u * 0.48); ctx.stroke(); // pierna
    ctx.beginPath(); ctx.moveTo(x - u * 0.04, y + u * 0.06); ctx.lineTo(x - u * 0.12, y + u * 0.27); ctx.lineTo(x - u * 0.27, y + u * 0.44); ctx.stroke(); // pierna
    ctx.lineWidth = u * 0.08;
    ctx.beginPath(); ctx.moveTo(x + u * 0.02, y - u * 0.2); ctx.lineTo(x + u * 0.2, y - u * 0.04); ctx.lineTo(x + u * 0.25, y + u * 0.1); ctx.stroke(); // brazo
    ctx.beginPath(); ctx.moveTo(x + u * 0.02, y - u * 0.2); ctx.lineTo(x - u * 0.15, y - u * 0.06); ctx.lineTo(x - u * 0.22, y + u * 0.08); ctx.stroke(); // brazo
}

/** Silueta de coche visto de frente (para adelantamiento prohibido). */
function cocheFrente(ctx, x, y, w, color) {
    ctx.fillStyle = color;
    const h = w * 0.62;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.32, y - h * 0.2); ctx.lineTo(x - w * 0.22, y - h * 0.62); ctx.lineTo(x + w * 0.22, y - h * 0.62); ctx.lineTo(x + w * 0.32, y - h * 0.2);
    ctx.lineTo(x + w / 2, y - h * 0.16); ctx.lineTo(x + w / 2, y + h * 0.3); ctx.lineTo(x - w / 2, y + h * 0.3); ctx.lineTo(x - w / 2, y - h * 0.16);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(x - w * 0.46, y + h * 0.25, w * 0.2, h * 0.28);
    ctx.fillRect(x + w * 0.26, y + h * 0.25, w * 0.2, h * 0.28);
    ctx.fillStyle = BLANCO;
    poli(ctx, [[x - w * 0.24, y - h * 0.22], [x - w * 0.17, y - h * 0.52], [x + w * 0.17, y - h * 0.52], [x + w * 0.24, y - h * 0.22]]); ctx.fill();
    disco(ctx, x - w * 0.33, y + h * 0.04, w * 0.07, BLANCO);
    disco(ctx, x + w * 0.33, y + h * 0.04, w * 0.07, BLANCO);
}

function texto(ctx, t, x, y, tam, color = NEGRO, peso = 'bold') {
    ctx.fillStyle = color; ctx.font = `${peso} ${tam}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t, x, y);
}

function flechasGiratorias(ctx, cx, cy, r, grosor, color) {
    for (let k = 0; k < 3; k++) {
        const a0 = (k * 2 * Math.PI) / 3 - Math.PI / 2 + 0.35, a1 = a0 + 1.35;
        const pts = [];
        for (let t = 0; t <= 1.0001; t += 0.1) { const a = a0 + (a1 - a0) * t; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
        flecha(ctx, pts, grosor, color, grosor * 2);
    }
}

function semaforoCaja(ctx, s, encendida, opciones = {}) {
    const w = s * 0.36, h = s * 0.86, x = (s - w) / 2, y = (s - h) / 2;
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, w * 0.25) : ctx.rect(x, y, w, h); ctx.fill();
    const cols = [['R', '#ff1744', '#4a1010'], ['A', '#ffab00', '#4a3a10'], ['V', '#00e676', '#103a1a']];
    cols.forEach(([k, on, off], i) => {
        const cy = y + h * (0.18 + i * 0.32), r = w * 0.34;
        disco(ctx, s / 2, cy, r, encendida === k ? on : off);
        if (encendida === k && opciones.flecha) {
            flecha(ctx, [[s / 2 - r * 0.6, cy], [s / 2 + r * 0.7, cy]], r * 0.35, '#063', r * 0.6);
        }
        if (encendida === k && opciones.intermitente) {
            ctx.strokeStyle = on; ctx.lineWidth = s * 0.02;
            for (let a = 0; a < 8; a++) {
                const an = (a * Math.PI) / 4;
                ctx.beginPath();
                ctx.moveTo(s / 2 + Math.cos(an) * r * 1.2 + (Math.cos(an) > 0 ? w * 0.15 : -w * 0.15) * 0, cy + Math.sin(an) * r * 1.2);
                ctx.lineTo(s / 2 + Math.cos(an) * r * 1.9, cy + Math.sin(an) * r * 1.9);
                ctx.stroke();
            }
        }
    });
}

function calzadaVista(ctx, s, pintar) {
    ctx.fillStyle = '#4a4f55'; ctx.fillRect(s * 0.05, s * 0.05, s * 0.9, s * 0.9);
    ctx.fillStyle = BLANCO;
    pintar(ctx, s);
}

// ─── Catálogo ────────────────────────────────────────────────────────────────
// accion: qué debe hacer el conductor (se usa en el catálogo y en el test).
export const SENALES = [
    // PELIGRO
    { id: 'P-1', codigo: 'P-1', categoria: 'PELIGRO', nombre: 'Intersección con prioridad',
      descripcion: 'Avisa de que te acercas a un cruce en el que tú tienes prioridad: los que llegan por la vía que cruza deben cederte el paso.',
      accion: 'Tienes prioridad, pero modera la velocidad y vigila por si alguien no te cede el paso.',
      dibujar(ctx, s) { const { cx, cy } = trianguloBase(ctx, s); ctx.fillStyle = NEGRO; ctx.fillRect(cx - s * 0.05, cy - s * 0.2, s * 0.1, s * 0.36); ctx.fillRect(cx - s * 0.16, cy - s * 0.035, s * 0.32, s * 0.06); } },
    { id: 'P-3', codigo: 'P-3', categoria: 'PELIGRO', nombre: 'Semáforos',
      descripcion: 'Avisa de que más adelante hay un semáforo que regula la circulación.',
      accion: 'Prepárate para detenerte si el semáforo cambia a ámbar o rojo.',
      dibujar(ctx, s) {
          const { cx, cy } = trianguloBase(ctx, s);
          const w = s * 0.12, h = s * 0.3;
          ctx.fillStyle = NEGRO; ctx.fillRect(cx - w / 2, cy - h / 2 - s * 0.02, w, h);
          ['#e53935', '#ffb300', '#43a047'].forEach((c, i) => disco(ctx, cx, cy - h / 2 + s * 0.035 + i * h * 0.31, w * 0.33, c));
      } },
    { id: 'P-4', codigo: 'P-4', categoria: 'PELIGRO', nombre: 'Intersección con circulación giratoria',
      descripcion: 'Avisa de que te acercas a una glorieta (rotonda).',
      accion: 'Reduce la velocidad: dentro de la glorieta tienen prioridad los que ya circulan por ella.',
      dibujar(ctx, s) { const { cx, cy } = trianguloBase(ctx, s); flechasGiratorias(ctx, cx, cy - s * 0.01, s * 0.12, s * 0.035, NEGRO); } },
    { id: 'P-20', codigo: 'P-20', categoria: 'PELIGRO', nombre: 'Peatones',
      descripcion: 'Avisa de un lugar donde es frecuente que haya peatones en la calzada o de un paso para peatones.',
      accion: 'Modera la velocidad y prepárate para ceder el paso a los peatones.',
      dibujar(ctx, s) { const { cx, cy } = trianguloBase(ctx, s); peaton(ctx, cx, cy - s * 0.01, s * 0.36); } },
    { id: 'P-21', codigo: 'P-21', categoria: 'PELIGRO', nombre: 'Niños',
      descripcion: 'Avisa de un lugar frecuentado por niños: colegios, parques o zonas de juego.',
      accion: 'Reduce mucho la velocidad: un niño puede salir corriendo sin mirar.',
      dibujar(ctx, s) {
          const { cx, cy } = trianguloBase(ctx, s);
          peaton(ctx, cx - s * 0.08, cy - s * 0.01, s * 0.34);
          peaton(ctx, cx + s * 0.1, cy + s * 0.03, s * 0.26);
      } },
    // PRIORIDAD
    { id: 'R-1', codigo: 'R-1', categoria: 'PRIORIDAD', nombre: 'Ceda el paso',
      descripcion: 'Obliga a ceder el paso en la próxima intersección a los vehículos que circulan por la vía a la que te acercas.',
      accion: 'No es obligatorio parar si no viene nadie, pero sí ceder el paso a quien circule por la otra vía.',
      dibujar(ctx, s) { trianguloBase(ctx, s, true); } },
    { id: 'R-2', codigo: 'R-2', categoria: 'PRIORIDAD', nombre: 'Detención obligatoria (STOP)',
      descripcion: 'Obliga a detenerse por completo ante la línea de detención (o antes de la intersección si no hay línea) y ceder el paso.',
      accion: 'Para del todo, aunque no venga nadie; después cede el paso y sal cuando sea seguro.',
      dibujar(ctx, s) {
          const r = s * 0.47, pts = [];
          for (let k = 0; k < 8; k++) { const a = Math.PI / 8 + (k * Math.PI) / 4; pts.push([s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r]); }
          poli(ctx, pts); ctx.fillStyle = BLANCO; ctx.fill();
          poli(ctx, escalar(pts, s / 2, s / 2, 0.92)); ctx.fillStyle = ROJO; ctx.fill();
          texto(ctx, 'STOP', s / 2, s / 2 + s * 0.01, s * 0.26, BLANCO);
      } },
    { id: 'R-3', codigo: 'R-3', categoria: 'PRIORIDAD', nombre: 'Calzada con prioridad',
      descripcion: 'Indica que circulas por una vía con prioridad: en los cruces, los que vienen por las otras vías deben cederte el paso.',
      accion: 'Tienes prioridad en las intersecciones hasta que veas la señal de fin de prioridad.',
      dibujar(ctx, s) {
          const c = s / 2, r = s * 0.47;
          poli(ctx, [[c, c - r], [c + r, c], [c, c + r], [c - r, c]]); ctx.fillStyle = BLANCO; ctx.fill(); ctx.lineWidth = s * 0.015; ctx.strokeStyle = '#555'; ctx.stroke();
          poli(ctx, [[c, c - r * 0.62], [c + r * 0.62, c], [c, c + r * 0.62], [c - r * 0.62, c]]); ctx.fillStyle = AMARILLO; ctx.fill();
      } },
    { id: 'R-4', codigo: 'R-4', categoria: 'PRIORIDAD', nombre: 'Fin de prioridad',
      descripcion: 'Indica que la vía deja de tener prioridad. A partir de aquí rigen las normas generales (por ejemplo, prioridad a la derecha).',
      accion: 'Ya no tienes prioridad: presta atención a las señales y a los que vienen por la derecha.',
      dibujar(ctx, s) {
          const c = s / 2, r = s * 0.47;
          poli(ctx, [[c, c - r], [c + r, c], [c, c + r], [c - r, c]]); ctx.fillStyle = BLANCO; ctx.fill(); ctx.lineWidth = s * 0.015; ctx.strokeStyle = '#555'; ctx.stroke();
          poli(ctx, [[c, c - r * 0.62], [c + r * 0.62, c], [c, c + r * 0.62], [c - r * 0.62, c]]); ctx.fillStyle = AMARILLO; ctx.fill();
          ctx.save(); poli(ctx, [[c, c - r], [c + r, c], [c, c + r], [c - r, c]]); ctx.clip();
          ctx.strokeStyle = NEGRO; ctx.lineWidth = s * 0.035;
          for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(c - r + k * s * 0.08, c + r + k * s * 0.08 - s * 0.0); ctx.lineTo(c + r + k * s * 0.08, c - r + k * s * 0.08); ctx.stroke(); }
          ctx.restore();
      } },
    { id: 'R-5', codigo: 'R-5', categoria: 'PRIORIDAD', nombre: 'Prioridad en sentido contrario',
      descripcion: 'En un estrechamiento, obliga a ceder el paso a los vehículos que vienen en sentido contrario.',
      accion: 'Espera a que pasen los que vienen de frente antes de entrar en el estrechamiento.',
      dibujar(ctx, s) {
          circuloBase(ctx, s);
          flecha(ctx, [[s * 0.4, s * 0.3], [s * 0.4, s * 0.72]], s * 0.07, NEGRO, s * 0.13);
          flecha(ctx, [[s * 0.6, s * 0.7], [s * 0.6, s * 0.28]], s * 0.07, ROJO, s * 0.13);
      } },
    { id: 'R-6', codigo: 'R-6', categoria: 'PRIORIDAD', nombre: 'Prioridad respecto al sentido contrario',
      descripcion: 'En un estrechamiento, tienes prioridad sobre los vehículos que vienen de frente.',
      accion: 'Puedes pasar primero, con precaución.',
      dibujar(ctx, s) {
          cuadradoBase(ctx, s);
          flecha(ctx, [[s * 0.38, s * 0.3], [s * 0.38, s * 0.72]], s * 0.06, ROJO, s * 0.12);
          flecha(ctx, [[s * 0.6, s * 0.74], [s * 0.6, s * 0.24]], s * 0.08, BLANCO, s * 0.15);
      } },
    // PROHIBICIÓN
    { id: 'R-100', codigo: 'R-100', categoria: 'PROHIBICION', nombre: 'Circulación prohibida',
      descripcion: 'Prohíbe la circulación de toda clase de vehículos en ambos sentidos.',
      accion: 'No puedes entrar con el vehículo por esa vía.',
      dibujar(ctx, s) { circuloBase(ctx, s); } },
    { id: 'R-101', codigo: 'R-101', categoria: 'PROHIBICION', nombre: 'Entrada prohibida',
      descripcion: 'Prohíbe la entrada a toda clase de vehículos. Suele estar al final de las calles de sentido único.',
      accion: 'No entres: estarías circulando en sentido contrario.',
      dibujar(ctx, s) { disco(ctx, s / 2, s / 2, s * 0.47, ROJO); ctx.fillStyle = BLANCO; ctx.fillRect(s * 0.17, s * 0.42, s * 0.66, s * 0.16); } },
    { id: 'R-301-20', codigo: 'R-301', categoria: 'PROHIBICION', nombre: 'Velocidad máxima 20 km/h',
      descripcion: 'Prohíbe circular a más de 20 km/h. Es el límite de las calles de plataforma única (calzada y acera al mismo nivel).',
      accion: 'No superes los 20 km/h.',
      dibujar(ctx, s) { circuloBase(ctx, s); texto(ctx, '20', s / 2, s / 2 + s * 0.02, s * 0.36); } },
    { id: 'R-301-30', codigo: 'R-301', categoria: 'PROHIBICION', nombre: 'Velocidad máxima 30 km/h',
      descripcion: 'Prohíbe circular a más de 30 km/h. Es el límite general de las calles urbanas con un único carril por sentido.',
      accion: 'No superes los 30 km/h.',
      dibujar(ctx, s) { circuloBase(ctx, s); texto(ctx, '30', s / 2, s / 2 + s * 0.02, s * 0.36); } },
    { id: 'R-301-50', codigo: 'R-301', categoria: 'PROHIBICION', nombre: 'Velocidad máxima 50 km/h',
      descripcion: 'Prohíbe circular a más de 50 km/h. Es el límite general de las vías urbanas con dos o más carriles por sentido.',
      accion: 'No superes los 50 km/h.',
      dibujar(ctx, s) { circuloBase(ctx, s); texto(ctx, '50', s / 2, s / 2 + s * 0.02, s * 0.36); } },
    { id: 'R-302', codigo: 'R-302', categoria: 'PROHIBICION', nombre: 'Giro a la derecha prohibido',
      descripcion: 'Prohíbe girar a la derecha en la próxima intersección.',
      accion: 'Sigue recto o gira a la izquierda si está permitido.',
      dibujar(ctx, s) {
          const r = circuloBase(ctx, s);
          flecha(ctx, [[s * 0.4, s * 0.74], [s * 0.4, s * 0.42], [s * 0.72, s * 0.42]], s * 0.075, NEGRO, s * 0.13);
          barraDiagonal(ctx, s, r);
      } },
    { id: 'R-303', codigo: 'R-303', categoria: 'PROHIBICION', nombre: 'Giro a la izquierda prohibido',
      descripcion: 'Prohíbe girar a la izquierda en la próxima intersección (y también cambiar de sentido en ella).',
      accion: 'Sigue recto o gira a la derecha si está permitido.',
      dibujar(ctx, s) {
          const r = circuloBase(ctx, s);
          flecha(ctx, [[s * 0.6, s * 0.74], [s * 0.6, s * 0.42], [s * 0.28, s * 0.42]], s * 0.075, NEGRO, s * 0.13);
          ctx.save(); ctx.translate(s, 0); ctx.scale(-1, 1); barraDiagonal(ctx, s, r); ctx.restore();
      } },
    { id: 'R-305', codigo: 'R-305', categoria: 'PROHIBICION', nombre: 'Adelantamiento prohibido',
      descripcion: 'Prohíbe adelantar a los vehículos de motor que circulen (salvo motos de dos ruedas) desde la señal hasta la siguiente intersección o la señal de fin.',
      accion: 'No adelantes; mantente detrás guardando la distancia de seguridad.',
      dibujar(ctx, s) { circuloBase(ctx, s); cocheFrente(ctx, s * 0.35, s * 0.52, s * 0.25, ROJO); cocheFrente(ctx, s * 0.65, s * 0.52, s * 0.25, NEGRO); } },
    { id: 'R-307', codigo: 'R-307', categoria: 'PROHIBICION', nombre: 'Parada y estacionamiento prohibido',
      descripcion: 'Prohíbe parar y estacionar en el lado de la calzada donde está la señal.',
      accion: 'No puedes detener el vehículo ahí, ni siquiera un momento para dejar a alguien.',
      dibujar(ctx, s) {
          const r = circuloBase(ctx, s, { fondo: AZUL, grosor: 0.17 });
          ctx.save(); ctx.beginPath(); ctx.arc(s / 2, s / 2, r, 0, Math.PI * 2); ctx.clip();
          ctx.strokeStyle = ROJO; ctx.lineWidth = s * 0.08;
          ctx.beginPath(); ctx.moveTo(s / 2 - r, s / 2 - r); ctx.lineTo(s / 2 + r, s / 2 + r); ctx.moveTo(s / 2 + r, s / 2 - r); ctx.lineTo(s / 2 - r, s / 2 + r); ctx.stroke();
          ctx.restore();
      } },
    { id: 'R-308', codigo: 'R-308', categoria: 'PROHIBICION', nombre: 'Estacionamiento prohibido',
      descripcion: 'Prohíbe estacionar en el lado donde está la señal. Sí se permite la parada (menos de 2 minutos sin que el conductor abandone el vehículo).',
      accion: 'Puedes parar un momento, pero no aparcar.',
      dibujar(ctx, s) { const r = circuloBase(ctx, s, { fondo: AZUL, grosor: 0.17 }); barraDiagonal(ctx, s, r); } },
    { id: 'R-500', codigo: 'R-500', categoria: 'PROHIBICION', nombre: 'Fin de prohibiciones',
      descripcion: 'Indica el final de todas las prohibiciones señalizadas anteriormente para los vehículos en movimiento.',
      accion: 'Las prohibiciones anteriores (velocidad, adelantar…) dejan de aplicarse.',
      dibujar(ctx, s) {
          disco(ctx, s / 2, s / 2, s * 0.47, '#333'); disco(ctx, s / 2, s / 2, s * 0.45, BLANCO);
          ctx.save(); ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.45, 0, Math.PI * 2); ctx.clip();
          ctx.strokeStyle = '#777'; ctx.lineWidth = s * 0.018;
          for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(s * 0.1 + k * s * 0.05, s * 0.9 + k * s * 0.05); ctx.lineTo(s * 0.9 + k * s * 0.05, s * 0.1 + k * s * 0.05); ctx.stroke(); }
          ctx.restore();
      } },
    { id: 'R-501', codigo: 'R-501', categoria: 'PROHIBICION', nombre: 'Fin de la limitación de velocidad',
      descripcion: 'Indica el final del tramo con la velocidad limitada; vuelve a regir el límite genérico de la vía.',
      accion: 'Puedes circular hasta el límite general de esa vía.',
      dibujar(ctx, s) {
          disco(ctx, s / 2, s / 2, s * 0.47, '#333'); disco(ctx, s / 2, s / 2, s * 0.45, BLANCO);
          texto(ctx, '30', s / 2, s / 2 + s * 0.02, s * 0.34, '#999');
          ctx.save(); ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.45, 0, Math.PI * 2); ctx.clip();
          ctx.strokeStyle = '#333'; ctx.lineWidth = s * 0.02;
          for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(s * 0.1 + k * s * 0.045, s * 0.9 + k * s * 0.045); ctx.lineTo(s * 0.9 + k * s * 0.045, s * 0.1 + k * s * 0.045); ctx.stroke(); }
          ctx.restore();
      } },
    // OBLIGACIÓN
    { id: 'R-400', codigo: 'R-400', categoria: 'OBLIGACION', nombre: 'Sentido obligatorio',
      descripcion: 'Obliga a seguir la dirección y el sentido que indica la flecha (en este caso, a la derecha).',
      accion: 'Solo puedes continuar hacia donde apunta la flecha.',
      dibujar(ctx, s) { circuloBase(ctx, s, { fondo: AZUL, borde: AZUL, grosor: 0 }); flecha(ctx, [[s * 0.24, s / 2], [s * 0.78, s / 2]], s * 0.1, BLANCO, s * 0.2); } },
    { id: 'R-401', codigo: 'R-401', categoria: 'OBLIGACION', nombre: 'Paso obligatorio',
      descripcion: 'Obliga a pasar por el lado del obstáculo (isleta, mediana…) que indica la flecha.',
      accion: 'Rodea el obstáculo por el lado que marca la flecha.',
      dibujar(ctx, s) { circuloBase(ctx, s, { fondo: AZUL, borde: AZUL, grosor: 0 }); flecha(ctx, [[s * 0.3, s * 0.3], [s * 0.7, s * 0.7]], s * 0.1, BLANCO, s * 0.2); } },
    { id: 'R-402', codigo: 'R-402', categoria: 'OBLIGACION', nombre: 'Intersección de sentido giratorio obligatorio',
      descripcion: 'Obliga a circular por la glorieta en el sentido de las flechas (contrario a las agujas del reloj).',
      accion: 'Entra en la glorieta y gira hacia la derecha, rodeando la isleta central.',
      dibujar(ctx, s) { circuloBase(ctx, s, { fondo: AZUL, borde: AZUL, grosor: 0 }); ctx.save(); ctx.translate(s, 0); ctx.scale(-1, 1); flechasGiratorias(ctx, s / 2, s / 2, s * 0.22, s * 0.065, BLANCO); ctx.restore(); } },
    // INDICACIÓN
    { id: 'S-13', codigo: 'S-13', categoria: 'INDICACION', nombre: 'Situación de un paso para peatones',
      descripcion: 'Indica dónde está un paso de peatones (paso de cebra).',
      accion: 'Si un peatón está cruzando o va a cruzar, detente y cédele el paso.',
      dibujar(ctx, s) {
          cuadradoBase(ctx, s);
          const pts = [[s / 2, s * 0.15], [s * 0.85, s * 0.8], [s * 0.15, s * 0.8]];
          poli(ctx, pts); ctx.fillStyle = BLANCO; ctx.fill();
          ctx.fillStyle = NEGRO;
          for (let k = 0; k < 4; k++) ctx.fillRect(s * (0.29 + k * 0.12), s * 0.7, s * 0.07, s * 0.07);
          peaton(ctx, s / 2, s * 0.5, s * 0.32);
      } },
    { id: 'S-17', codigo: 'S-17', categoria: 'INDICACION', nombre: 'Estacionamiento',
      descripcion: 'Indica un lugar donde está permitido estacionar.',
      accion: 'Puedes aparcar respetando las condiciones que indique un panel complementario.',
      dibujar(ctx, s) { cuadradoBase(ctx, s); texto(ctx, 'P', s / 2, s / 2 + s * 0.03, s * 0.62, BLANCO); } },
    { id: 'S-28', codigo: 'S-28', categoria: 'INDICACION', nombre: 'Calle residencial',
      descripcion: 'Zona con normas especiales: velocidad máxima de 20 km/h, los peatones pueden usar toda la calzada y tienen prioridad, y solo se estaciona en los lugares señalizados.',
      accion: 'Circula muy despacio (20 km/h como máximo) y cede el paso a los peatones.',
      dibujar(ctx, s) {
          cuadradoBase(ctx, s, AZUL, 1, 0.72);
          ctx.fillStyle = BLANCO;
          poli(ctx, [[s * 0.14, s * 0.5], [s * 0.28, s * 0.32], [s * 0.42, s * 0.5]]); ctx.fill();
          ctx.fillRect(s * 0.17, s * 0.5, s * 0.22, s * 0.16);
          peaton(ctx, s * 0.55, s * 0.5, s * 0.26, BLANCO);
          peaton(ctx, s * 0.7, s * 0.55, s * 0.18, BLANCO);
          disco(ctx, s * 0.82, s * 0.63, s * 0.035, BLANCO);
      } },
    { id: 'S-30', codigo: 'S-30', categoria: 'INDICACION', nombre: 'Zona a 30',
      descripcion: 'Indica la entrada a una zona en la que la velocidad máxima es 30 km/h en todas sus calles.',
      accion: 'No superes los 30 km/h mientras estés dentro de la zona.',
      dibujar(ctx, s) {
          cuadradoBase(ctx, s, BLANCO, 0.78, 1);
          ctx.lineWidth = s * 0.012; ctx.strokeStyle = '#333'; ctx.strokeRect(s * 0.15, s * 0.06, s * 0.7, s * 0.88);
          texto(ctx, 'ZONA', s / 2, s * 0.2, s * 0.12);
          disco(ctx, s / 2, s * 0.58, s * 0.26, ROJO); disco(ctx, s / 2, s * 0.58, s * 0.2, BLANCO);
          texto(ctx, '30', s / 2, s * 0.59, s * 0.2);
      } },
    // SEMÁFOROS Y AGENTES
    { id: 'SEM-R', codigo: 'Semáforo', categoria: 'SEMAFOROS', nombre: 'Semáforo en rojo',
      descripcion: 'Prohíbe pasar la línea de detención (o el semáforo si no hay línea).',
      accion: 'Detente antes de la línea y espera al verde.',
      dibujar(ctx, s) { semaforoCaja(ctx, s, 'R'); } },
    { id: 'SEM-A', codigo: 'Semáforo', categoria: 'SEMAFOROS', nombre: 'Semáforo en ámbar fijo',
      descripcion: 'Obliga a detenerse, salvo que al encenderse estés tan cerca que no puedas parar en condiciones de seguridad.',
      accion: 'Frena y detente; solo continúa si no puedes parar con seguridad.',
      dibujar(ctx, s) { semaforoCaja(ctx, s, 'A'); } },
    { id: 'SEM-V', codigo: 'Semáforo', categoria: 'SEMAFOROS', nombre: 'Semáforo en verde',
      descripcion: 'Permite pasar, siempre que la intersección no esté bloqueada y respetando a los peatones que aún estén cruzando.',
      accion: 'Puedes pasar con precaución; no entres si te vas a quedar parado dentro del cruce.',
      dibujar(ctx, s) { semaforoCaja(ctx, s, 'V'); } },
    { id: 'SEM-AI', codigo: 'Semáforo', categoria: 'SEMAFOROS', nombre: 'Semáforo en ámbar intermitente',
      descripcion: 'Permite pasar, pero obliga a extremar la precaución y, si procede, a ceder el paso según las normas o señales.',
      accion: 'Pasa despacio, atento a peatones y a las señales de prioridad del cruce.',
      dibujar(ctx, s) { semaforoCaja(ctx, s, 'A', { intermitente: true }); } },
    { id: 'SEM-FL', codigo: 'Semáforo', categoria: 'SEMAFOROS', nombre: 'Flecha verde',
      descripcion: 'Permite circular solo en la dirección que indica la flecha.',
      accion: 'Puedes girar hacia donde marca la flecha, con precaución.',
      dibujar(ctx, s) { semaforoCaja(ctx, s, 'V', { flecha: true }); } },
    { id: 'AGENTE', codigo: 'Agente', categoria: 'SEMAFOROS', nombre: 'Agente con el brazo levantado',
      descripcion: 'El brazo levantado verticalmente obliga a detenerse a todos los que se acerquen al agente, salvo que no puedan hacerlo con seguridad.',
      accion: 'Detente. Las órdenes del agente prevalecen sobre semáforos y señales.',
      dibujar(ctx, s) {
          ctx.fillStyle = '#e3f2fd'; ctx.fillRect(s * 0.05, s * 0.05, s * 0.9, s * 0.9);
          const x = s / 2, y = s * 0.55, u = s * 0.62;
          ctx.fillStyle = '#1a237e'; ctx.strokeStyle = '#1a237e'; ctx.lineCap = 'round';
          disco(ctx, x, y - u * 0.4, u * 0.08, '#f1c27d');
          ctx.fillRect(x - u * 0.09, y - u * 0.5, u * 0.18, u * 0.05);
          ctx.fillRect(x - u * 0.12, y - u * 0.3, u * 0.24, u * 0.4);
          ctx.fillStyle = AMARILLO; ctx.fillRect(x - u * 0.12, y - u * 0.12, u * 0.24, u * 0.05);
          ctx.lineWidth = u * 0.08; ctx.strokeStyle = '#1a237e';
          ctx.beginPath(); ctx.moveTo(x + u * 0.1, y - u * 0.27); ctx.lineTo(x + u * 0.14, y - u * 0.62); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x - u * 0.1, y - u * 0.27); ctx.lineTo(x - u * 0.16, y - u * 0.02); ctx.stroke();
          ctx.lineWidth = u * 0.09;
          ctx.beginPath(); ctx.moveTo(x - u * 0.06, y + u * 0.1); ctx.lineTo(x - u * 0.07, y + u * 0.42); ctx.moveTo(x + u * 0.06, y + u * 0.1); ctx.lineTo(x + u * 0.07, y + u * 0.42); ctx.stroke();
          disco(ctx, x + u * 0.14, y - u * 0.64, u * 0.05, BLANCO);
      } },
    // MARCAS VIALES
    { id: 'M-CONT', codigo: 'Marca vial', categoria: 'MARCAS', nombre: 'Línea longitudinal continua',
      descripcion: 'Ningún conductor puede pisarla ni rebasarla. Separa sentidos o carriles donde no se puede adelantar ni cambiar de carril.',
      accion: 'No la pises ni la cruces.',
      dibujar(ctx, s) { calzadaVista(ctx, s, (c) => c.fillRect(s * 0.47, s * 0.05, s * 0.06, s * 0.9)); } },
    { id: 'M-DISC', codigo: 'Marca vial', categoria: 'MARCAS', nombre: 'Línea longitudinal discontinua',
      descripcion: 'Separa carriles. Se puede rebasar para adelantar o cambiar de carril si la maniobra es segura y está permitida.',
      accion: 'Puedes cruzarla con precaución, señalizando con el intermitente.',
      dibujar(ctx, s) { calzadaVista(ctx, s, (c) => { for (let y = 0.08; y < 0.9; y += 0.22) c.fillRect(s * 0.47, s * y, s * 0.06, s * 0.12); }); } },
    { id: 'M-DET', codigo: 'Marca vial', categoria: 'MARCAS', nombre: 'Línea de detención',
      descripcion: 'Línea transversal continua: indica dónde detenerse ante un STOP, un semáforo o un agente.',
      accion: 'Si tienes que parar, detente justo antes de ella.',
      dibujar(ctx, s) { calzadaVista(ctx, s, (c) => { c.fillRect(s * 0.08, s * 0.4, s * 0.84, s * 0.08); c.font = `bold ${s * 0.16}px Arial`; c.textAlign = 'center'; c.fillText('STOP', s / 2, s * 0.75); }); } },
    { id: 'M-CEBRA', codigo: 'Marca vial', categoria: 'MARCAS', nombre: 'Paso de peatones',
      descripcion: 'Franjas blancas paralelas al eje de la calzada. Los peatones que lo usan tienen prioridad.',
      accion: 'Cede el paso a los peatones que estén cruzando o a punto de hacerlo.',
      dibujar(ctx, s) { calzadaVista(ctx, s, (c) => { for (let x = 0.1; x < 0.9; x += 0.16) c.fillRect(s * x, s * 0.25, s * 0.09, s * 0.5); }); } },
];

export const SENAL_POR_ID = Object.fromEntries(SENALES.map(s => [s.id, s]));

const cacheCanvas = new Map();
/** Canvas con la señal dibujada (fondo transparente). */
export function senalCanvas(id, tam = 256) {
    const k = `${id}@${tam}`;
    if (cacheCanvas.has(k)) return cacheCanvas.get(k);
    const def = SENAL_POR_ID[id];
    const c = document.createElement('canvas');
    c.width = c.height = tam;
    const ctx = c.getContext('2d');
    if (def) def.dibujar(ctx, tam);
    cacheCanvas.set(k, c);
    return c;
}

const cacheURL = new Map();
export function senalDataURL(id, tam = 200) {
    const k = `${id}@${tam}`;
    if (!cacheURL.has(k)) cacheURL.set(k, senalCanvas(id, tam).toDataURL('image/png'));
    return cacheURL.get(k);
}
