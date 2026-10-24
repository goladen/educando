// ─────────────────────────────────────────────────────────────────────────────
//  useNotificacionesProfesor
//  Notificaciones AGREGADAS para el profesor. Cada grupo genera UNA sola
//  notificación aunque haya muchos elementos nuevos:
//    · resultados  → informes_juegos con mi codigoProfesor
//    · preguntas   → preguntas_pendientes del trivial enviadas por alumnos
//    · apps        → novedades marcadas como app/actualización, filtradas por
//                    los intereses del profesor (users/{uid}.intereses)
//
//  El "ya visto" se guarda en users/{uid}.notifVisto = { resultados, preguntas, apps }
//  como milisegundos. La primera vez se sella con la fecha actual para no
//  inundar con el histórico.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { db } from '../firebase';
import {
    collection, query, where, orderBy, limit, onSnapshot, doc, setDoc,
} from 'firebase/firestore';

export const CLAVES_NOTIF = ['resultados', 'preguntas', 'apps'];

// Intereses disponibles (los mismos que usa el admin al publicar una novedad).
// Son las materias de la vista «Por Materia» de la página principal
// (MATERIAS de LandingGames3). Además el profe puede escribir «Otros» en
// users/{uid}.interesesOtros.
export const INTERESES = [
    { id: 'mates',    label: 'Matemáticas',           emoji: '🔢' },
    { id: 'lengua',   label: 'Lengua',                emoji: '📖' },
    { id: 'sociales', label: 'Geografía e Historia',  emoji: '🌍' },
    { id: 'fyq',      label: 'Física y Química',      emoji: '⚗️' },
    { id: 'biologia', label: 'Biología',              emoji: '🔬' },
    { id: 'musica',   label: 'Música',                emoji: '🎵' },
    { id: 'tecno',    label: 'Tecnología y robótica', emoji: '🤖' },
    { id: 'plastica', label: 'Plástica',              emoji: '🎨' },
    { id: 'idiomas',  label: 'Idiomas',               emoji: '🌐' },
    { id: 'edfisica', label: 'Educación Física',      emoji: '🏃' },
    { id: 'tutoria',  label: 'Tutoría y aula',        emoji: '🍎' },
];
const IDS_INTERESES = new Set(INTERESES.map(i => i.id));
// Ids antiguos que siguen valiendo: «Ciencias» se partió en FyQ y Biología.
// (infantil ya no es categoría → esos profes reciben el aviso.)
const ALIAS_INTERESES = { ciencias: ['fyq', 'biologia'] };

/** Intereses válidos (categorías actuales) a partir de una lista que puede tener ids antiguos. */
export function normalizarIntereses(ids = []) {
    const out = [];
    (ids || []).forEach(id => (ALIAS_INTERESES[id] || [id]).forEach(x => {
        if (IDS_INTERESES.has(x) && !out.includes(x)) out.push(x);
    }));
    return out;
}

/** ¿Tiene el profe los intereses rellenos? (alguna categoría actual o un «Otros» escrito) */
export const interesesCompletos = (perfil) =>
    normalizarIntereses(perfil?.intereses).length > 0 || !!String(perfil?.interesesOtros || '').trim();

export const ms = (f) => {
    if (!f) return 0;
    if (typeof f === 'number') return f;
    if (f.toMillis) return f.toMillis();
    if (f.seconds)  return f.seconds * 1000;
    const d = new Date(f);
    return isNaN(d) ? 0 : d.getTime();
};

export default function useNotificacionesProfesor(usuario) {
    const uid = usuario?.uid || null;

    const [perfil,    setPerfil]    = useState(null);   // { codigoProfesor, notifVisto, intereses }
    const [informes,  setInformes]  = useState([]);
    const [preguntas, setPreguntas] = useState([]);
    const [novedades, setNovedades] = useState([]);

    // ── Perfil del profesor (código, vistos, intereses) ──────────────────────
    useEffect(() => {
        if (!uid) { setPerfil(null); return; }
        return onSnapshot(doc(db, 'users', uid), s => setPerfil(s.data() || {}), () => setPerfil({}));
    }, [uid]);

    const codigo    = perfil?.codigoProfesor || '';
    const visto     = perfil?.notifVisto || {};
    const intereses = normalizarIntereses(perfil?.intereses);
    // Profe sin intereses (o solo con categorías que ya no existen): aviso fijo
    const faltanIntereses = !!perfil && perfil.role !== 'alumno' && !interesesCompletos(perfil);

    // Sella la primera visita para no mostrar el histórico como "nuevo"
    const sellado = useRef({});
    useEffect(() => {
        if (!uid || !perfil) return;
        const faltan = CLAVES_NOTIF.filter(k => !visto[k] && !sellado.current[k]);
        if (!faltan.length) return;
        const ahora = Date.now();
        faltan.forEach(k => { sellado.current[k] = ahora; });
        setDoc(
            doc(db, 'users', uid),
            { notifVisto: Object.fromEntries(faltan.map(k => [k, ahora])) },
            { merge: true }
        ).catch(() => {});
    }, [uid, perfil]); // eslint-disable-line react-hooks/exhaustive-deps

    const desde = (k) => visto[k] || sellado.current[k] || Date.now();

    // ── 1. Resultados nuevos en Informes de Juegos ───────────────────────────
    useEffect(() => {
        if (!uid || !codigo) { setInformes([]); return; }
        const q = query(collection(db, 'informes_juegos'), where('codigoProfesor', '==', codigo));
        return onSnapshot(q, snap => {
            setInformes(snap.docs.map(d => {
                const x = d.data();
                return {
                    id: d.id,
                    fecha: ms(x.fecha),
                    juego: x.tipo || x.juego || x.tipoJuego || '',
                    jugador: x.jugadores?.[0]?.nombre || x.nombre || x.alumno || '',
                };
            }));
        }, () => setInformes([]));
    }, [uid, codigo]);

    // ── 2. Preguntas del trivial enviadas por alumnos ────────────────────────
    const [misTrivials, setMisTrivials] = useState([]);
    useEffect(() => {
        if (!uid) { setMisTrivials([]); return; }
        const q = query(collection(db, 'trivial_recursos'), where('creadorUid', '==', uid));
        return onSnapshot(
            q,
            snap => setMisTrivials(snap.docs.map(d => ({ id: d.id, titulo: d.data().titulo || 'Trivial' }))),
            () => setMisTrivials([])
        );
    }, [uid]);

    const trivialsKey = misTrivials.map(t => t.id).sort().join(',');
    useEffect(() => {
        if (!trivialsKey) { setPreguntas([]); return; }
        const mapa = {};
        const unsubs = misTrivials.map(t => onSnapshot(
            collection(db, 'trivial_recursos', t.id, 'preguntas_pendientes'),
            snap => {
                mapa[t.id] = snap.docs.map(d => {
                    const x = d.data();
                    return {
                        id: t.id + '/' + d.id,
                        fecha: ms(x.fechaCreacion || x.fecha),
                        autor: x.autor || x.enviadoPor || x.alumno || '',
                        recursoId: t.id,
                        recursoTitulo: t.titulo,
                    };
                });
                setPreguntas(Object.values(mapa).flat());
            },
            () => {}
        ));
        return () => unsubs.forEach(u => u());
    }, [trivialsKey]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── 3. Apps nuevas / actualizadas según intereses ────────────────────────
    useEffect(() => {
        const q = query(collection(db, 'novedades'), orderBy('fecha', 'desc'), limit(40));
        return onSnapshot(q, snap => setNovedades(
            snap.docs.map(d => ({ id: d.id, ...d.data(), _ms: ms(d.data().fecha) }))
                .filter(n => n.tipo === 'app' || n.tipo === 'actualizacion')
        ), () => setNovedades([]));
    }, []);

    const encajaIntereses = (n) => {
        const cats = normalizarIntereses(n.categorias);
        if (!cats.length) return true;               // novedad general → para todos
        if (!intereses.length) return true;          // sin intereses → lo ve todo
        return cats.some(c => intereses.includes(c));
    };

    // ── Agregados: UNA notificación por grupo ────────────────────────────────
    const nuevosInformes  = informes.filter(i => i.fecha > desde('resultados'));
    const nuevasPreguntas = preguntas.filter(p => p.fecha > desde('preguntas'));
    const nuevasApps      = novedades.filter(n => n._ms > desde('apps') && encajaIntereses(n));

    const marcarVisto = async (clave) => {
        if (!uid) return;
        try {
            await setDoc(doc(db, 'users', uid), { notifVisto: { [clave]: Date.now() } }, { merge: true });
        } catch (_) {}
    };

    const grupos = [];
    // No se puede «marcar como visto»: desaparece al guardar los intereses en Mi perfil
    if (faltanIntereses) grupos.push({
        clave: 'intereses',
        emoji: '🎯',
        titulo: 'Completa tus intereses',
        detalle: 'Indica qué materias te interesan en Mi perfil: así te avisaremos cuando haya una herramienta nueva de tu área.',
        fecha: Date.now(),
        items: [],
    });
    if (nuevosInformes.length) grupos.push({
        clave: 'resultados',
        emoji: '📊',
        titulo: nuevosInformes.length === 1
            ? 'Tienes 1 resultado nuevo'
            : `Tienes ${nuevosInformes.length} resultados nuevos`,
        detalle: resumenAlumnos(nuevosInformes.map(i => i.jugador)),
        fecha: Math.max(...nuevosInformes.map(i => i.fecha)),
        items: nuevosInformes,
    });
    if (nuevasPreguntas.length) grupos.push({
        clave: 'preguntas',
        emoji: '❓',
        titulo: nuevasPreguntas.length === 1
            ? '1 pregunta nueva para tu Trivial'
            : `${nuevasPreguntas.length} preguntas nuevas para tu Trivial`,
        detalle: resumenAlumnos(nuevasPreguntas.map(p => p.autor))
            || [...new Set(nuevasPreguntas.map(p => p.recursoTitulo))].join(', '),
        fecha: Math.max(...nuevasPreguntas.map(p => p.fecha)),
        items: nuevasPreguntas,
    });
    if (nuevasApps.length) grupos.push({
        clave: 'apps',
        emoji: '🆕',
        titulo: nuevasApps.length === 1 ? 'Novedad en pikt.es' : `${nuevasApps.length} novedades en pikt.es`,
        detalle: nuevasApps.map(n => n.titulo).slice(0, 3).join(' · '),
        fecha: Math.max(...nuevasApps.map(n => n._ms)),
        items: nuevasApps,
    });

    return {
        grupos,                 // como mucho 3 entradas, una por tipo
        total: grupos.length,   // lo que suma la campanita
        marcarVisto,
        intereses,
        faltanIntereses,
        codigo,
    };
}

// "Ana, Luis y 3 más" — sin repetir nombres
function resumenAlumnos(nombres) {
    const l = [...new Set(nombres.filter(Boolean))];
    if (!l.length) return '';
    if (l.length <= 2) return l.join(' y ');
    return `${l[0]}, ${l[1]} y ${l.length - 2} más`;
}
