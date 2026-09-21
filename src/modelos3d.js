// Catálogo de modelos 3D del visor.
//
// Añade aquí los modelos fijos (los que quieras que vea todo el mundo).
// Lo normal es subirlos a Cloudinary y pegar el secure_url que devuelve.
//
// Descarga desde Sketchfab: pestaña "Download 3D model" → Autoconverted format
// → glTF (o .glb si lo ofrece). NO el "Original format" ni el USDZ.
// Casi todos los modelos son CC-BY: hay que citar autor y enlace, por eso
// `autor`, `licencia` y `fuente` son obligatorios en cada entrada.

export const CATEGORIAS_3D = [
    { id: 'CIENCIAS',  nombre: 'Ciencias Naturales', emoji: '🔬', color: '#16a34a' },
    { id: 'HISTORIA',  nombre: 'Historia y Arte',    emoji: '🏛️', color: '#b45309' },
    { id: 'TECNO',     nombre: 'Tecnología',         emoji: '⚙️', color: '#0ea5e9' },
    { id: 'GEO',       nombre: 'Geografía',          emoji: '🌍', color: '#0d9488' },
    { id: 'OTROS',     nombre: 'Otros',              emoji: '📦', color: '#6b7280' },
];

/**
 * Modelo: {
 *   id, nombre, emoji, categoria,          // categoria = id de CATEGORIAS_3D
 *   url,                                   // .glb o .gltf accesible con CORS
 *   autor, licencia, fuente,               // atribución (obligatoria en CC-BY)
 *   descripcion?,                          // texto para el alumno
 *   escalaReal?                            // metros de la dimensión mayor (VR)
 * }
 */
export const MODELOS_3D = [
    // Ejemplo de entrada (descomenta y sustituye por tus modelos de Cloudinary):
    // {
    //     id: 'craneo',
    //     nombre: 'Cráneo humano',
    //     emoji: '💀',
    //     categoria: 'CIENCIAS',
    //     url: 'https://res.cloudinary.com/TU-CLOUD/raw/upload/v1700000000/modelos3d/craneo.glb',
    //     autor: 'Nombre del autor',
    //     licencia: 'CC BY 4.0',
    //     fuente: 'https://sketchfab.com/3d-models/...',
    //     descripcion: 'Cráneo humano completo para estudiar los huesos.',
    //     escalaReal: 0.2,
    // },
];

/* ---------- catálogo publicado (Firestore: colección modelos3d) ---------- */
/*
 * Es lo que ve TODO el mundo, con o sin cuenta. Solo el administrador
 * (goladen@gmail.com) puede escribir aquí; lo hace desde el panel del Visor 3D
 * marcando qué assets de Cloudinary quiere publicar. Un modelo con
 * `visible: false` queda guardado pero no se muestra a los demás.
 */

export const COLECCION_MODELOS = 'modelos3d';

export async function leerModelosPublicados({ soloVisibles = true } = {}) {
    const { db } = await import('./firebase');
    const { collection, getDocs } = await import('firebase/firestore');
    const snap = await getDocs(collection(db, COLECCION_MODELOS));
    return snap.docs
        .map(d => ({ id: d.id, ...d.data(), publicado: true }))
        .filter(m => (soloVisibles ? m.visible !== false : true))
        .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
}

export async function publicarModelo(modelo) {
    const { db } = await import('./firebase');
    const { doc, setDoc } = await import('firebase/firestore');
    // El id del documento es el public_id de Cloudinary saneado: así republicar
    // el mismo asset actualiza su ficha en vez de duplicarla.
    const id = (modelo.publicId || modelo.url).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    const datos = {
        nombre: modelo.nombre || 'Modelo',
        emoji: modelo.emoji || '🧊',
        categoria: modelo.categoria || 'OTROS',
        url: modelo.url,
        publicId: modelo.publicId || '',
        autor: modelo.autor || '',
        licencia: modelo.licencia || '',
        fuente: modelo.fuente || '',
        descripcion: modelo.descripcion || '',
        escalaReal: Number(modelo.escalaReal) || 0,
        visible: modelo.visible !== false,
        actualizado: Date.now(),
    };
    await setDoc(doc(db, COLECCION_MODELOS, id), datos);
    return { id, ...datos, publicado: true };
}

export async function despublicarModelo(id) {
    const { db } = await import('./firebase');
    const { doc, deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, COLECCION_MODELOS, id));
}

/* ---------- modelos añadidos por el profesor (este navegador) ---------- */

const CLAVE = 'pikt_modelos3d';

export function leerModelosLocales() {
    try {
        const raw = localStorage.getItem(CLAVE);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
}

export function guardarModeloLocal(modelo) {
    const lista = leerModelosLocales();
    const sinDuplicado = lista.filter(m => m.url !== modelo.url);
    const nuevo = [{ ...modelo, local: true, ts: Date.now() }, ...sinDuplicado].slice(0, 40);
    try { localStorage.setItem(CLAVE, JSON.stringify(nuevo)); } catch (_) {}
    return nuevo;
}

export function borrarModeloLocal(url) {
    const nuevo = leerModelosLocales().filter(m => m.url !== url);
    try { localStorage.setItem(CLAVE, JSON.stringify(nuevo)); } catch (_) {}
    return nuevo;
}

/** Valida que una URL pegada apunte a un modelo cargable. */
export function validarUrlModelo(url) {
    const u = String(url || '').trim();
    if (!u) return 'Pega la URL del modelo.';
    if (!/^https:\/\//i.test(u)) return 'La URL debe empezar por https://';
    if (!/\.(glb|gltf)(\?|#|$)/i.test(u)) return 'La URL debe terminar en .glb o .gltf (Sketchfab → Autoconverted format → glTF).';
    return null;
}
