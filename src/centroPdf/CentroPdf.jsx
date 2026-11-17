// ─────────────────────────────────────────────────────────────────────────────
//  🖨️ Generar en PDF (/pdf): todos los generadores de PDF de PiKT en un sitio,
//  ordenados por lo que necesita el profe (no por herramienta):
//    · 📝 Fichas de ejercicios   → FichasPikt (motores de Math World, materias, Enigmic)
//    · 🎮 Un recurso en papel    → buscador de recursos + estética (clásica / arcade)
//    · 🎲 Juegos y apps          → cada juego con su estética propia (abre el juego)
//    · 🏫 Aula y profesor        → plano de clase, documentos, mapas, informes…
//  Los destinos que viven en LandingGames3 se abren con onIr(destino); los
//  autónomos (Documentos, Mapas INE, Cuerpo humano, Banco de Física) se montan aquí.
// ─────────────────────────────────────────────────────────────────────────────
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { formatosDisponibles, hojasDe } from '../utils/pdfRecurso';
import { normalizarPregunta } from '../utils/normalizarPreguntas';

const FichasPikt = lazy(() => import('../bancoRecursos/FichasPikt'));
const ModalPdfRecurso = lazy(() => import('../components/ModalPdfRecurso'));
const DocumentosPersonalizados = lazy(() => import('../components/DocumentosPersonalizados'));
const ExploradorINE = lazy(() => import('../estadistica/ExploradorINE'));
const VisorCuerpo = lazy(() => import('../anatomia/VisorCuerpo'));
const BancoProblemasFisica = lazy(() => import('../ecuaciones/BancoProblemasFisica'));

const MORADO = '#6D28D9';

// ── Catálogo ─────────────────────────────────────────────────────────────────
//  accion: { ir } → lo abre LandingGames3 · { vista } → se monta aquí · { info } → solo indica dónde está
const BLOQUES = [
    { id: 'FICHAS', emoji: '📝', nombre: 'Fichas de ejercicios', color: '#7b1fa2',
        desc: 'Ejercicios nuevos cada vez, con hoja de soluciones y corrección en la pizarra. Matemáticas, Lengua, Biología, Geografía, Música y Lógica.' },
    { id: 'RECURSO', emoji: '🎮', nombre: 'Mis preguntas en papel', color: '#0e7490',
        desc: 'Elige uno de tus recursos (o uno público) y la estética: test, rosco, sopa de letras, unir con flechas… o estilo arcade.' },
    { id: 'JUEGOS', emoji: '🎲', nombre: 'Fichas de juegos y apps', color: '#c2410c',
        desc: 'Cada juego con su propia estética: arcade, ovni, escape room de terror, puzzle recortable, orientación…' },
    { id: 'AULA', emoji: '🏫', nombre: 'Aula y profesorado', color: '#15803d',
        desc: 'Plano de clase, horarios, cartas personalizadas para familias, mapas, informes de notas…' },
];

const ITEMS = [
    // ── Juegos y apps con estética propia
    { id: 'invasores', bloque: 'JUEGOS', emoji: '👾', nombre: 'Invasión Pi', estetica: 'Arcade neón (papel o pantalla negra)', color: '#0891b2',
        desc: 'Cada pregunta es un alien numerado. Con QR y código para jugar después en clase con las mismas preguntas y en el mismo orden.',
        donde: 'En el menú del juego elige las preguntas y pulsa «🖨️ Ficha PDF».', etapas: ['Primaria', 'ESO'], materias: 'Todas', accion: { ir: 'invasores' },
        claves: 'aliens marcianos arcade retro preguntas test' },
    { id: 'ovni', bloque: 'JUEGOS', emoji: '🛸', nombre: 'Ovni Abducción', estetica: 'Ciencia ficción', color: '#22d3ee',
        desc: '«Rodea lo que abduce el ovni» por rondas, tabla para clasificar y soluciones con la explicación de cada trampa.',
        donde: 'Pantalla de inicio del juego → «🖨️ Ficha PDF para preparar el contenido».', etapas: ['Primaria', 'ESO'], materias: 'Lengua, Matemáticas, Ciencias', accion: { ir: 'ovni' },
        claves: 'clasificar categorias palabras' },
    { id: 'escape', bloque: 'JUEGOS', emoji: '🎃', nombre: 'Escape Room Halloween', estetica: 'Terror (cuadernillo por salas)', color: '#ea580c',
        desc: 'Cuadernillo con portada, una hoja por sala con sus preguntas y candados, y hoja de respuestas (dos por folio).',
        donde: 'En el editor del escape → «📄 Fichas en PDF y preguntas fijas».', etapas: ['Primaria', 'ESO'], materias: 'Todas', accion: { ir: 'escape' },
        claves: 'halloween candados terror escape room' },
    { id: 'oca', bloque: 'JUEGOS', emoji: '🦆', nombre: 'La Oca Matemática', estetica: 'Juego de mesa (tablero recortable)', color: '#e67e22',
        desc: 'El tablero de 63 casillas con la operación de cada una, hojas de cálculo de 4 jugadores, tarjetas con el número inicial, dado y fichas para recortar.',
        donde: 'Elige el tipo de números → «🖨️ Jugar en papel (PDF)».', etapas: ['Primaria', 'ESO'], materias: 'Matemáticas', accion: { ir: 'oca' },
        claves: 'oca tablero dado naturales enteros decimales fracciones juego de mesa' },
    { id: 'domino', bloque: 'JUEGOS', emoji: '🁣', nombre: 'Dominó Matemático', estetica: 'Fichas de dominó recortables', color: '#9b59b6',
        desc: 'Las 28 fichas para recortar (naturales, enteros, decimales, fracciones o ecuaciones), un juego distinto por grupo y hoja de soluciones.',
        donde: 'Elige el modo → «🖨️ Jugar en papel (PDF)», número de grupos y descargar.', etapas: ['Primaria', 'ESO'], materias: 'Matemáticas', accion: { ir: 'domino' },
        claves: 'domino fichas fracciones equivalentes ecuaciones juego de mesa' },
    { id: 'puzzle', bloque: 'JUEGOS', emoji: '🧩', nombre: 'Puzzle de imágenes', estetica: 'Recortable', color: '#9333ea',
        desc: 'Tablero con rejilla (y guía tenue) más las piezas desordenadas para recortar del mismo tamaño.',
        donde: 'Elige imagen y dificultad → «📄 Descargar PDF».', etapas: ['Infantil', 'Primaria', 'ESO'], materias: 'Todas', accion: { ir: 'puzzle' },
        claves: 'recortar piezas imagen' },
    { id: 'pizarras', bloque: 'JUEGOS', emoji: '🧱', nombre: 'Pizarras verticales', estetica: 'Problemas de ingenio', color: '#4338ca',
        desc: 'Problemas para aulas de pensamiento, con las instrucciones para el profesor, y juegos de magia matemática.',
        donde: 'Elige los problemas → botón de imprimir (en el diálogo de impresión elige «Guardar como PDF»).', etapas: ['Primaria', 'ESO'], materias: 'Matemáticas', accion: { ir: 'pizarras' },
        claves: 'ingenio arcomat magia pensamiento' },
    { id: 'calculadora', bloque: 'JUEGOS', emoji: '🧮', nombre: 'Uso de la calculadora', estetica: 'Teclas de la calculadora', color: '#0f766e',
        desc: 'Una ficha por bloque (operaciones, memoria, fracciones, potencias…) con las teclas dibujadas y sus soluciones.',
        donde: 'Botón «📄» de cada bloque o «📄 Ficha PDF» dentro del bloque.', etapas: ['Primaria', 'ESO'], materias: 'Matemáticas', accion: { ir: 'calculadora' },
        claves: 'casio teclas' },
    { id: 'fisica', bloque: 'JUEGOS', emoji: '⚛️', nombre: 'Simuladores de Física y Química', estetica: 'Ficha con capturas del simulador', color: '#2563eb',
        desc: 'Ficha de cada simulador con capturas, preguntas y problemas con ecuaciones. Se puede editar antes de generar.',
        donde: 'Abre un simulador → «🖨️ Ficha PDF».', etapas: ['ESO', 'Bachillerato'], materias: 'Física y Química', accion: { ir: 'fisica' },
        claves: 'fisica quimica simulador fuerzas energia' },
    { id: 'bancoFisica', bloque: 'JUEGOS', emoji: '📚', nombre: 'Banco de problemas de Física', estetica: 'Problemas por temas', color: '#1d4ed8',
        desc: 'Elige tema y número de problemas y genera la ficha con sus soluciones (también desde una ficha tuya con IA).',
        donde: 'Pestaña «🖨️ Generar ficha PDF».', etapas: ['ESO', 'Bachillerato'], materias: 'Física y Química', accion: { vista: 'BANCO_FISICA' },
        claves: 'problemas fisica cinematica dinamica' },
    { id: 'cuerpo', bloque: 'JUEGOS', emoji: '🫀', nombre: 'Cuerpo humano 3D', estetica: 'Lámina para etiquetar', color: '#dc2626',
        desc: 'Lámina del aparato o sistema elegido con los órganos numerados para escribir su nombre.',
        donde: 'Elige el sistema → «🖨️ Ficha PDF».', etapas: ['Primaria', 'ESO', 'Bachillerato'], materias: 'Biología', accion: { vista: 'CUERPO' },
        claves: 'anatomia organos esqueleto musculos' },
    { id: 'patio', bloque: 'JUEGOS', emoji: '🎠', nombre: 'Patio de Juegos (Primaria)', estetica: 'Infantil y colorida', color: '#16a34a',
        desc: 'Fichas en papel de matemáticas y lengua de 1.º a 6.º de Primaria.',
        donde: 'Elige curso y actividad → «🖨️ Imprimir / Guardar PDF».', etapas: ['Primaria'], materias: 'Matemáticas, Lengua', accion: { ir: 'patio' },
        claves: 'primaria primero segundo tercero cuarto quinto sexto' },
    { id: 'comic', bloque: 'JUEGOS', emoji: '💬', nombre: 'Creador de cómics', estetica: 'Viñetas de cómic', color: '#db2777',
        desc: 'Imprime el cómic que has creado o una plantilla de viñetas para que los alumnos la completen a mano.',
        donde: 'Dentro del creador → botón de imprimir / PDF.', etapas: ['Primaria', 'ESO'], materias: 'Lengua, Idiomas, Todas', accion: { ir: 'comic' },
        claves: 'vinetas historieta plantilla' },
    // ── Aula y profesorado
    { id: 'dinamicas', bloque: 'AULA', emoji: '🎉', nombre: 'Dinámicas de aula', estetica: 'Fichas de la dinámica y recortables', color: '#ec4899',
        desc: 'Para cada una de las 10 dinámicas (KABOOM, sobres, citas rápidas, mímica, dado…): ficha del profe con QR, ficha por equipo o por alumno y recortables (tarjetas, palitos, sobres, dado).',
        donde: 'Elige una dinámica y la materia → «🖨️ Fichas PDF» → «🖨️ Imprimir / PDF» (en la ventana de impresión, «Guardar como PDF»).', etapas: ['Primaria', 'ESO', 'Bachillerato'], materias: 'Todas, Idiomas, Tutoría', accion: { ir: 'dinamicas' },
        claves: 'dinamicas kaboom sobres citas rapidas mimica silla caliente dado tablero piedra papel baile semaforo luz roja verde equipos tarjetas recortables' },
    { id: 'gestion', bloque: 'AULA', emoji: '🏫', nombre: 'Gestión de Aula', estetica: 'Documentos de clase', color: '#e67e22',
        desc: 'Plano de clase, grupos, listas y horarios listos para imprimir.',
        donde: 'Abre la herramienta (p. ej. Plano de clase) → «🖨 Imprimir».', etapas: ['Primaria', 'ESO', 'Bachillerato'], materias: 'Tutoría', accion: { ir: 'gestion' },
        claves: 'plano clase grupos horario lista asientos' },
    { id: 'documentos', bloque: 'AULA', emoji: '✉️', nombre: 'Documentos personalizados', estetica: 'Cartas e informes', color: '#7c3aed',
        desc: 'Escribe un texto con campos {{Nombre}}, {{Nota}}… pega tu tabla y saca un documento por alumno (PDF o ZIP).',
        donde: 'Se abre aquí mismo.', etapas: ['Primaria', 'ESO', 'Bachillerato'], materias: 'Tutoría', accion: { vista: 'DOCUMENTOS' },
        claves: 'combinar correspondencia cartas familias informe notas diploma' },
    { id: 'mapas', bloque: 'AULA', emoji: '🗺️', nombre: 'Mapas de España con datos del INE', estetica: 'Mapa temático', color: '#0369a1',
        desc: 'Mapa por provincias o comunidades con datos reales (población, paro, renta…) para analizar o colorear.',
        donde: 'Pestaña «Mapas» → «Ficha PDF».', etapas: ['ESO', 'Bachillerato'], materias: 'Geografía, Matemáticas', accion: { vista: 'INE' },
        claves: 'ine geografia estadistica provincias comunidades poblacion' },
    { id: 'quienesquien', bloque: 'AULA', emoji: '🕵️', nombre: '¿Quién es quién? (cartel)', estetica: 'Cartel con QR', color: '#7c3aed',
        desc: 'Cartel con el QR y el código para que los alumnos rellenen su ficha el primer día de clase.',
        donde: 'Panel del profesor del juego → imprimir el cartel.', etapas: ['Primaria', 'ESO', 'Bachillerato'], materias: 'Tutoría', accion: { ir: 'quienesquien' },
        claves: 'conocerse tutoria primer dia qr' },
    { id: 'comunidades', bloque: 'AULA', emoji: '👥', nombre: 'Comunidades', estetica: 'Horarios y documentos', color: '#1565C0',
        desc: 'Horarios y documentos del centro o del grupo descargables en PDF o PNG.',
        donde: 'Dentro de la comunidad → botón «PDF».', etapas: ['Primaria', 'ESO', 'Bachillerato'], materias: 'Centro', accion: { ir: 'comunidades' },
        claves: 'horario centro claustro' },
    { id: 'notas', bloque: 'AULA', emoji: '📊', nombre: 'Informe de notas en PDF', estetica: 'Informe', color: '#475569',
        desc: 'Resultados de los juegos de tus grupos en un informe para imprimir o guardar.',
        donde: 'Panel del profesor › Informes › Grupos → «Descargar PDF».', etapas: ['Primaria', 'ESO', 'Bachillerato'], materias: 'Todas', accion: { info: true },
        claves: 'notas calificaciones resultados informes' },
    { id: 'papel', bloque: 'AULA', emoji: '🧾', nombre: 'Ficha en papel ↔ hoja interactiva', estetica: 'Hoja interactiva', color: '#475569',
        desc: 'Convierte tu hoja interactiva en una ficha imprimible con su clave de respuestas.',
        donde: 'Panel del profesor › Herramientas › Papel interactivo → «🖨️ Ficha PDF».', etapas: ['Primaria', 'ESO', 'Bachillerato'], materias: 'Todas', accion: { info: true },
        claves: 'omninteractive hoja' },
    { id: 'misrecursos', bloque: 'AULA', emoji: '🗂️', nombre: 'PDF desde «Mis recursos»', estetica: 'Clásica', color: '#475569',
        desc: 'Cada recurso tiene también su botón morado de PDF en el panel del profesor (y en la Biblioteca).',
        donde: 'Panel del profesor › Mis recursos → botón morado 📄.', etapas: ['Primaria', 'ESO', 'Bachillerato'], materias: 'Todas', accion: { info: true },
        claves: 'recursos biblioteca' },
];

// Entradas de búsqueda que llevan a los otros bloques
const ATAJOS = [
    { id: 'aFichas', bloque: 'FICHAS', emoji: '📝', nombre: 'Fichas de ejercicios (generador)', color: '#7b1fa2', accion: { bloque: 'FICHAS' },
        desc: 'Matemáticas (cálculo, fracciones, ecuaciones, geometría, estadística…), Lengua (ortografía, sintaxis…), Biología, Geografía, Música y acertijos de lógica.',
        claves: 'mates matematicas calculo fracciones decimales dinero porcentajes divisibilidad potencias raices medidas unidades geometria estadistica probabilidad ecuaciones sistemas polinomios funciones lengua ortografia sintaxis morfologia lexico biologia celula animales geografia paises banderas provincias musica pentagrama notas enigmic logica acertijos' },
    { id: 'aRecurso', bloque: 'RECURSO', emoji: '🎮', nombre: 'Un recurso mío en papel', color: '#0e7490', accion: { bloque: 'RECURSO' },
        desc: 'Pasapalabra (rosco), test, preguntas abiertas, unir con flechas, sopa de letras, letras desordenadas, ruleta, línea del tiempo, etiquetas, listening… o estilo arcade.',
        claves: 'pasapalabra rosco test sopa letras unir flechas anagrama ruleta linea tiempo etiquetas listening burbujas aparejados preguntas recurso arcade' },
];

const ETIQUETA_JUEGO = {
    PASAPALABRA: '🔤 Pasapalabra', CAZABURBUJAS: '🫧 Burbujas', PIKATRON: '🏃 Pikatron', PIKATRON_2: '🏃 Pikatron 2', APAREJADOS: '🃏 AparejaDOS',
    RULETA: '🎡 Ruleta', WORDLE: '🟩 Wordle', SOPA: '🔎 Sopa de letras', THINKHOOT: '⚡ PiLive', LINEA_TIEMPO: '🕰️ Línea del tiempo',
    ETIQUETAS: '🏷️ EtiquetaMe', LISTENING_RECURSO: '🎧 Listening', MONEYBOARD: '💰 Money Board', JEOPARDY: '💰 Money Board',
};

const sinTildes = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const tieneOpciones = (r) => r && (r.tipoJuego === 'LISTENING_RECURSO' || formatosDisponibles(r).length > 0);

// Preguntas del recurso → formato de la ficha arcade de Invasión Pi
function preguntasArcade(recurso) {
    const out = [];
    hojasDe(recurso).forEach((h) => (h.preguntas || []).forEach((p) => {
        const q = normalizarPregunta(p?.terminoA !== undefined ? { pregunta: p.terminoA, respuesta: p.terminoB } : p);
        if (!q || q.tipo === 'ORDENAR') return;
        const id = `a${out.length}`;
        if (q.tipo === 'MULTIPLE') out.push({ id, enunciado: q.enunciado, opciones: q.opciones, correcta: q.correcta, respuesta: 'opciones' });
        else if (q.tipo === 'RELLENAR') out.push({ id, enunciado: `${q.enunciado}: ${q.bloques[0]} ______ ${q.bloques[2]}`.trim(), correcta: q.correcta, respuesta: 'texto' });
        else out.push({ id, enunciado: q.enunciado, correcta: q.correcta, respuesta: 'texto' });
    }));
    return out;
}

async function compartir(url, titulo) {
    try { if (navigator.share) { await navigator.share({ title: titulo, url }); return 'ok'; } } catch { /* cancelado */ }
    try { await navigator.clipboard.writeText(url); return 'copiado'; } catch { window.prompt('Copia el enlace:', url); return 'ok'; }
}

// ═════════════════════════════════════════════════════════════════════════════
export default function CentroPdf({ onExit, onIr }) {
    const [bloque, setBloque] = useState(null);   // null = inicio · FICHAS | RECURSO | JUEGOS | AULA
    const [vista, setVista] = useState(null);     // herramienta montada aquí (DOCUMENTOS, INE, CUERPO, BANCO_FISICA)
    const [busqueda, setBusqueda] = useState('');
    const [aviso, setAviso] = useState('');
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 700;

    useEffect(() => { if (!aviso) return undefined; const t = setTimeout(() => setAviso(''), 2200); return () => clearTimeout(t); }, [aviso]);

    const abrir = (item) => {
        const a = item.accion || {};
        if (a.bloque) { setBusqueda(''); setBloque(a.bloque); return; }
        if (a.vista) { setVista(a.vista); return; }
        if (a.ir) onIr?.(a.ir);
    };

    const resultados = useMemo(() => {
        const t = sinTildes(busqueda.trim());
        if (!t) return [];
        const palabras = t.split(/\s+/).filter(Boolean);
        return [...ATAJOS, ...ITEMS].filter((i) => {
            const texto = sinTildes([i.nombre, i.desc, i.estetica, i.materias, i.claves, (i.etapas || []).join(' ')].join(' '));
            return palabras.every((w) => texto.includes(w));
        });
    }, [busqueda]);

    const compartirCentro = async () => {
        const r = await compartir(`${window.location.origin}/pdf`, 'Generar en PDF · PiKT');
        if (r === 'copiado') setAviso('🔗 Enlace copiado');
    };

    // ── Herramientas montadas aquí ──
    const volverVista = () => setVista(null);
    if (vista) {
        return (
            <Suspense fallback={<Cargando />}>
                {vista === 'DOCUMENTOS' && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#f8fafc', overflowY: 'auto', padding: 12, boxSizing: 'border-box' }}>
                        <DocumentosPersonalizados onBack={volverVista} />
                    </div>
                )}
                {vista === 'INE' && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#f8fafc', overflowY: 'auto' }}>
                        <ExploradorINE onClose={volverVista} rutaCompartir={(q) => `${window.location.origin}/estadistica?${q}`} />
                    </div>
                )}
                {vista === 'CUERPO' && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#0f172a', overflowY: 'auto' }}>
                        <VisorCuerpo onExit={volverVista} />
                    </div>
                )}
                {vista === 'BANCO_FISICA' && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#f8fafc', overflowY: 'auto' }}>
                        <BancoProblemasFisica onVolver={volverVista} />
                    </div>
                )}
            </Suspense>
        );
    }

    const info = BLOQUES.find((b) => b.id === bloque);

    return (
        <div style={S.pagina}>
            {/* Cabecera */}
            <div style={S.barra}>
                <button onClick={() => (bloque ? setBloque(null) : onExit?.())} style={S.btnBarra}>← {bloque ? (isMobile ? 'Atrás' : 'Generar en PDF') : 'Volver'}</button>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'center', fontWeight: 900, fontSize: isMobile ? '1rem' : '1.2rem', color: '#1e1b4b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {info ? `${info.emoji} ${info.nombre}` : '🖨️ Generar en PDF'}
                </div>
                <button onClick={compartirCentro} title="Compartir este centro de PDF" style={{ ...S.btnBarra, background: MORADO, color: 'white', borderColor: MORADO }}>🔗{isMobile ? '' : ' Compartir'}</button>
            </div>

            <div style={S.contenido}>
                {!bloque && (
                    <>
                        <div style={{ textAlign: 'center', margin: '6px 0 16px' }}>
                            <div style={{ fontSize: isMobile ? '1.45rem' : '1.9rem', fontWeight: 900, color: '#1e1b4b' }}>¿Qué quieres imprimir?</div>
                            <div style={{ color: '#475569', fontWeight: 600, marginTop: 4 }}>Todo lo que PiKT puede pasar a papel, en un solo sitio. Siempre con soluciones para ti.</div>
                        </div>

                        <div style={S.buscador}>
                            <span style={{ fontSize: '1.2rem' }}>🔎</span>
                            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} autoFocus={!isMobile}
                                placeholder="Busca: fracciones, sopa de letras, plano de clase, célula…"
                                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', fontSize: '1rem', background: 'transparent', fontFamily: 'inherit' }} />
                            {busqueda && <button onClick={() => setBusqueda('')} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#64748b' }}>✕</button>}
                        </div>

                        {busqueda.trim() ? (
                            <>
                                <div style={{ color: '#475569', fontWeight: 700, margin: '4px 0 10px' }}>
                                    {resultados.length ? `${resultados.length} resultado${resultados.length === 1 ? '' : 's'}` : 'No hay nada con esa búsqueda. Prueba con otra palabra o entra en un bloque.'}
                                </div>
                                <Rejilla items={resultados} onAbrir={abrir} />
                            </>
                        ) : (
                            <>
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
                                    {BLOQUES.map((b) => {
                                        const n = b.id === 'JUEGOS' || b.id === 'AULA' ? ITEMS.filter((i) => i.bloque === b.id).length : null;
                                        return (
                                            <button key={b.id} onClick={() => setBloque(b.id)} style={{ ...S.bloque, borderTop: `6px solid ${b.color}` }}>
                                                <span style={{ fontSize: '2.6rem', lineHeight: 1 }}>{b.emoji}</span>
                                                <span style={{ flex: 1, minWidth: 0 }}>
                                                    <span style={{ display: 'block', fontWeight: 900, fontSize: '1.15rem', color: '#0f172a' }}>{b.nombre}</span>
                                                    <span style={{ display: 'block', color: '#475569', fontSize: '0.88rem', marginTop: 4, lineHeight: 1.35 }}>{b.desc}</span>
                                                    {n && <span style={{ ...S.chip, background: `${b.color}18`, color: b.color, marginTop: 8, display: 'inline-block' }}>{n} generadores</span>}
                                                </span>
                                                <span style={{ color: b.color, fontSize: '1.6rem', fontWeight: 900 }}>›</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div style={S.pasos}>
                                    <div style={{ fontWeight: 900, color: '#1e1b4b', marginBottom: 8 }}>¿Cómo funciona?</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 10 }}>
                                        {[['1', 'Elige qué necesitas', 'Fichas nuevas, tus propias preguntas, un juego o un documento de clase.'],
                                            ['2', 'Ajusta y descarga', 'Número de ejercicios, estilo y, si quieres, la hoja de soluciones.'],
                                            ['3', 'Después, a jugar', 'Muchas fichas llevan un QR y un código: en clase se juega con las mismas preguntas.']].map(([n, t, d]) => (
                                            <div key={n} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                                <span style={{ background: MORADO, color: 'white', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, flexShrink: 0 }}>{n}</span>
                                                <span><b style={{ color: '#0f172a' }}>{t}</b><br /><span style={{ color: '#475569', fontSize: '0.86rem' }}>{d}</span></span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                )}

                {bloque && <p style={{ color: '#475569', fontWeight: 600, margin: '0 0 14px', textAlign: 'center' }}>{info.desc}</p>}

                {bloque === 'FICHAS' && (
                    <Suspense fallback={<Cargando />}>
                        <FichasPikt />
                    </Suspense>
                )}

                {bloque === 'RECURSO' && <PdfDeRecurso />}

                {(bloque === 'JUEGOS' || bloque === 'AULA') && (
                    <Rejilla items={ITEMS.filter((i) => i.bloque === bloque)} onAbrir={abrir} />
                )}
            </div>

            {aviso && <div style={S.toast}>{aviso}</div>}
        </div>
    );
}

// ── Tarjetas de generadores ──────────────────────────────────────────────────
function Rejilla({ items, onAbrir }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: 12 }}>
            {items.map((i) => {
                const soloInfo = i.accion?.info;
                return (
                    <div key={i.id} style={{ ...S.tarjeta, borderLeft: `6px solid ${i.color}` }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '2rem', lineHeight: 1 }}>{i.emoji}</span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ display: 'block', fontWeight: 900, color: '#0f172a' }}>{i.nombre}</span>
                                {i.estetica && <span style={{ ...S.chip, background: `${i.color}1f`, color: '#1e293b', marginTop: 4, display: 'inline-block' }}>🎨 {i.estetica}</span>}
                            </span>
                        </div>
                        <div style={{ color: '#475569', fontSize: '0.86rem', lineHeight: 1.4 }}>{i.desc}</div>
                        {(i.etapas?.length > 0 || i.materias) && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {(i.etapas || []).map((e) => <span key={e} style={S.chip}>{e}</span>)}
                                {i.materias && <span style={{ ...S.chip, background: '#ede9fe', color: '#5b21b6' }}>{i.materias}</span>}
                            </div>
                        )}
                        {i.donde && (
                            <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 10, padding: '6px 9px', fontSize: '0.8rem', color: '#334155' }}>
                                📍 <b>{soloInfo ? 'Dónde está:' : 'Al abrir:'}</b> {i.donde}
                            </div>
                        )}
                        {!soloInfo && (
                            <button onClick={() => onAbrir(i)} style={{ ...S.btn, background: i.color, marginTop: 'auto' }}>Abrir ›</button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ── 🎮 PDF de un recurso: buscador + estética ────────────────────────────────
function PdfDeRecurso() {
    const uid = auth.currentUser?.uid || null;
    const [pestana, setPestana] = useState(uid ? 'MIOS' : 'PUBLICOS');
    const [listas, setListas] = useState({ MIOS: null, PUBLICOS: null });
    const [error, setError] = useState('');
    const [texto, setTexto] = useState('');
    const [codigo, setCodigo] = useState('');
    const [buscandoCodigo, setBuscandoCodigo] = useState(false);
    const [recurso, setRecurso] = useState(null);

    useEffect(() => {
        if (pestana === 'CODIGO' || listas[pestana] !== null) return undefined;
        let vivo = true;
        const q = pestana === 'MIOS'
            ? query(collection(db, 'resources'), where('profesorUid', '==', uid))
            : query(collection(db, 'resources'), where('isPrivate', '==', false));
        getDocs(q)
            .then((snap) => {
                if (!vivo) return;
                const docs = snap.docs.map((d) => ({ ...d.data(), id: d.id })).filter(tieneOpciones);
                if (pestana === 'PUBLICOS') docs.sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
                setListas((p) => ({ ...p, [pestana]: docs }));
            })
            .catch((e) => { if (vivo) setError('No se han podido cargar los recursos: ' + e.message); });
        return () => { vivo = false; };
    }, [pestana, listas, uid]);

    const lista = useMemo(() => {
        const t = sinTildes(texto.trim());
        const base = listas[pestana] || [];
        return (t ? base.filter((r) => sinTildes(`${r.titulo} ${r.profesorNombre || ''} ${ETIQUETA_JUEGO[r.tipoJuego] || r.tipoJuego}`).includes(t)) : base).slice(0, 120);
    }, [listas, pestana, texto]);

    const buscarCodigo = async () => {
        const c = codigo.trim().toUpperCase();
        if (!c) return;
        setBuscandoCodigo(true); setError('');
        try {
            const snap = await getDocs(query(collection(db, 'resources'), where('accessCode', '==', c)));
            const r = snap.docs.map((d) => ({ ...d.data(), id: d.id }))[0];
            if (!r) setError('No hay ningún recurso con ese código.');
            else if (!tieneOpciones(r)) setError('Ese recurso no tiene preguntas que se puedan pasar a papel.');
            else setRecurso(r);
        } catch (e) { setError('No se ha podido buscar: ' + e.message); }
        setBuscandoCodigo(false);
    };

    if (recurso) return <EsteticasRecurso recurso={recurso} onCambiar={() => setRecurso(null)} />;

    const pestanas = [uid && ['MIOS', '👤 Mis recursos'], ['PUBLICOS', '🌍 Públicos'], ['CODIGO', '🔑 Tengo un código']].filter(Boolean);
    return (
        <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 12 }}>
                {pestanas.map(([k, l]) => (
                    <button key={k} onClick={() => { setPestana(k); setError(''); }}
                        style={{ ...S.pestana, ...(pestana === k ? { background: '#0e7490', color: 'white', borderColor: '#0e7490' } : {}) }}>{l}</button>
                ))}
            </div>
            {!uid && <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem', marginBottom: 10 }}>Inicia sesión para ver también tus propios recursos.</div>}

            {pestana === 'CODIGO' ? (
                <div style={{ ...S.tarjeta, maxWidth: 460, margin: '0 auto', textAlign: 'center' }}>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>Escribe el código del recurso</div>
                    <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Es el código de acceso que aparece en la tarjeta del recurso.</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && buscarCodigo()} placeholder="Ej.: AB12CD"
                            style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 10, border: '2px solid #cbd5e1', fontSize: '1.1rem', fontWeight: 800, letterSpacing: 2, textAlign: 'center', fontFamily: 'inherit' }} />
                        <button onClick={buscarCodigo} disabled={buscandoCodigo || !codigo.trim()} style={{ ...S.btn, background: '#0e7490', width: 'auto', padding: '10px 16px' }}>{buscandoCodigo ? '…' : 'Buscar'}</button>
                    </div>
                </div>
            ) : (
                <>
                    <div style={S.buscador}>
                        <span>🔎</span>
                        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar por título, juego o profesor…"
                            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', fontSize: '0.98rem', background: 'transparent', fontFamily: 'inherit' }} />
                    </div>
                    {listas[pestana] === null && !error && <Cargando texto="Cargando recursos…" />}
                    {listas[pestana] && lista.length === 0 && (
                        <div style={{ textAlign: 'center', color: '#64748b', margin: 24 }}>
                            {pestana === 'MIOS' ? 'Todavía no tienes recursos con preguntas. Créalos en tu panel de profesor o usa uno público.' : 'No hay recursos con esa búsqueda.'}
                        </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 250px), 1fr))', gap: 10 }}>
                        {lista.map((r) => (
                            <button key={r.id} onClick={() => setRecurso(r)} style={{ ...S.tarjeta, cursor: 'pointer', textAlign: 'left', border: '2px solid #e2e8f0', fontFamily: 'inherit' }}>
                                <span style={{ fontWeight: 900, color: '#0f172a' }}>{r.titulo || 'Sin título'}</span>
                                <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    <span style={{ ...S.chip, background: '#cffafe', color: '#155e75' }}>{ETIQUETA_JUEGO[r.tipoJuego] || r.tipoJuego || 'Recurso'}</span>
                                    {pestana === 'PUBLICOS' && r.profesorNombre && <span style={S.chip}>👤 {r.profesorNombre}</span>}
                                </span>
                                <span style={{ color: '#0e7490', fontWeight: 800, fontSize: '0.85rem' }}>Pasar a papel ›</span>
                            </button>
                        ))}
                    </div>
                </>
            )}
            {error && <div style={{ color: '#b91c1c', fontWeight: 700, textAlign: 'center', margin: 14 }}>{error}</div>}
        </div>
    );
}

function EsteticasRecurso({ recurso, onCambiar }) {
    const formatos = useMemo(() => formatosDisponibles(recurso), [recurso]);
    const arcade = useMemo(() => preguntasArcade(recurso), [recurso]);
    const nHojas = hojasDe(recurso).length;
    const esListening = recurso.tipoJuego === 'LISTENING_RECURSO';
    const [clasica, setClasica] = useState(false);
    const [oscuro, setOscuro] = useState(false);
    const [soluciones, setSoluciones] = useState(true);
    const [generando, setGenerando] = useState(false);
    const [error, setError] = useState('');

    const descargarArcade = async () => {
        setGenerando(true); setError('');
        try {
            const preguntas = arcade.slice(0, 60);
            const titulo = recurso.titulo || 'Invasión Pi';
            // Código corto: en clase se juega con estas preguntas en este orden (Invasión Pi, Luz roja, Burbujas…)
            const [{ crearCodigoFicha, urlCodigoFicha }, { recursoDePreguntas }, { generarPdfInvasores }] = await Promise.all([
                import('../utils/fichaCodigo'), import('../invasores/fichaEnlace'), import('../invasores/pdfInvasores'),
            ]);
            const codigoFicha = await crearCodigoFicha({ juego: 'INVASORES', titulo, recurso: recursoDePreguntas(preguntas, titulo) });
            await generarPdfInvasores({
                preguntas, titulo, variante: 'DISPARA', oscuro, soluciones,
                qrUrl: codigoFicha ? urlCodigoFicha(codigoFicha) : `${window.location.origin}/invasores`,
                vinculada: !!codigoFicha, codigoFicha,
            });
        } catch (e) { setError('No se ha podido crear el PDF: ' + e.message); }
        setGenerando(false);
    };

    return (
        <div>
            <div style={{ ...S.tarjeta, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
                <span style={{ fontSize: '1.8rem' }}>📄</span>
                <span style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 900, color: '#0f172a' }}>{recurso.titulo || 'Sin título'}</span>
                    <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{ETIQUETA_JUEGO[recurso.tipoJuego] || recurso.tipoJuego} · {nHojas} hoja{nHojas === 1 ? '' : 's'}</span>
                </span>
                <button onClick={onCambiar} style={S.pestana}>↺ Elegir otro</button>
            </div>

            <div style={{ fontWeight: 900, color: '#1e1b4b', fontSize: '1.15rem', margin: '4px 0 10px', textAlign: 'center' }}>Elige el estilo de la ficha</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 14 }}>
                {/* Clásica */}
                <div style={{ ...S.tarjeta, borderTop: '6px solid #6D28D9' }}>
                    <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a' }}>{esListening ? '🎧 Listening en papel' : '📄 Clásica'}</div>
                    <div style={{ color: '#475569', fontSize: '0.86rem' }}>
                        {esListening ? 'Texto, preguntas de comprensión y soluciones.' : 'Limpia y con poca tinta. Elige el formato:'}
                    </div>
                    {!esListening && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            {formatos.map((f) => <span key={f.id} title={f.desc} style={{ ...S.chip, background: '#ede9fe', color: '#4c1d95' }}>{f.emoji} {f.label}</span>)}
                        </div>
                    )}
                    <div style={{ color: '#64748b', fontSize: '0.8rem' }}>Con QR y código para jugarlo después en clase.</div>
                    <button onClick={() => setClasica(true)} style={{ ...S.btn, background: '#6D28D9', marginTop: 'auto' }}>Elegir formato y descargar ›</button>
                </div>

                {/* Arcade */}
                {!esListening && (
                    <div style={{ ...S.tarjeta, borderTop: '6px solid #0891b2', background: oscuro ? '#020617' : 'white', color: oscuro ? '#e2e8f0' : undefined, transition: 'background .2s' }}>
                        <div style={{ fontSize: '1.15rem', fontWeight: 900, color: oscuro ? '#22d3ee' : '#0f172a', fontFamily: 'monospace' }}>👾 ARCADE · Invasión Pi</div>
                        <div style={{ color: oscuro ? '#94a3b8' : '#475569', fontSize: '0.86rem' }}>
                            Cada pregunta es un alien numerado con casillas A-D o caja para escribir, marcador de «aliens derrotados» y claves para el profe.
                        </div>
                        {arcade.length ? (
                            <>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {[[false, '☀️ Papel blanco'], [true, '🌙 Pantalla negra']].map(([v, l]) => (
                                        <button key={l} onClick={() => setOscuro(v)}
                                            style={{ ...S.pestana, padding: '6px 10px', fontSize: '0.82rem', ...(oscuro === v ? { background: '#0891b2', color: 'white', borderColor: '#0891b2' } : {}) }}>{l}</button>
                                    ))}
                                </div>
                                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.86rem', fontWeight: 700 }}>
                                    <input type="checkbox" checked={soluciones} onChange={(e) => setSoluciones(e.target.checked)} /> Página de soluciones
                                </label>
                                <div style={{ color: oscuro ? '#94a3b8' : '#64748b', fontSize: '0.8rem' }}>
                                    {Math.min(arcade.length, 60)} preguntas{arcade.length > 60 ? ` (de ${arcade.length})` : ''}. Con código para jugarlas en Invasión Pi, Luz roja, Burbujas…
                                </div>
                                <button onClick={descargarArcade} disabled={generando} style={{ ...S.btn, background: 'linear-gradient(135deg,#22d3ee,#a855f7)', color: '#0b1020', marginTop: 'auto', opacity: generando ? 0.6 : 1 }}>
                                    {generando ? 'Creando PDF…' : '⬇️ Descargar PDF arcade'}
                                </button>
                            </>
                        ) : (
                            <div style={{ color: '#b45309', fontWeight: 700, fontSize: '0.86rem' }}>Este recurso no tiene preguntas con respuesta para este estilo (prueba la clásica).</div>
                        )}
                    </div>
                )}
            </div>
            {error && <div style={{ color: '#b91c1c', fontWeight: 700, textAlign: 'center', margin: 14 }}>{error}</div>}

            {clasica && (
                <Suspense fallback={null}>
                    <ModalPdfRecurso recurso={recurso} onClose={() => setClasica(false)} />
                </Suspense>
            )}
        </div>
    );
}

const Cargando = ({ texto = 'Cargando…' }) => <div style={{ textAlign: 'center', color: MORADO, fontWeight: 800, padding: 30 }}>{texto}</div>;

const S = {
    pagina: { position: 'fixed', inset: 0, zIndex: 9999, background: 'linear-gradient(180deg,#f5f3ff 0%,#eef2f7 260px)', overflowY: 'auto', fontFamily: "'Segoe UI', Tahoma, sans-serif", textAlign: 'left' },
    barra: { position: 'sticky', top: 0, zIndex: 2, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.96)', borderBottom: '1px solid #e2e8f0' },
    btnBarra: { padding: '8px 14px', borderRadius: 20, border: '2px solid #cbd5e1', background: 'white', color: '#1e293b', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem', flexShrink: 0 },
    contenido: { maxWidth: 1000, margin: '0 auto', padding: '16px 16px 40px', boxSizing: 'border-box' },
    buscador: { display: 'flex', alignItems: 'center', gap: 8, background: 'white', borderRadius: 16, padding: '10px 14px', boxShadow: '0 3px 12px rgba(0,0,0,0.07)', border: '2px solid #ddd6fe', marginBottom: 16 },
    bloque: { display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', background: 'white', border: 'none', borderRadius: 18, padding: '18px 16px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,0.08)', fontFamily: 'inherit' },
    pasos: { marginTop: 20, background: 'white', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    tarjeta: { display: 'flex', flexDirection: 'column', gap: 8, background: 'white', borderRadius: 14, padding: '14px 14px', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', boxSizing: 'border-box' },
    chip: { fontSize: '0.72rem', padding: '2px 8px', borderRadius: 8, background: '#f1f5f9', color: '#475569', fontWeight: 700 },
    btn: { width: '100%', padding: '10px 12px', borderRadius: 12, border: 'none', color: 'white', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.92rem' },
    pestana: { padding: '8px 14px', borderRadius: 20, border: '2px solid #cbd5e1', background: 'white', color: '#1e293b', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.88rem' },
    toast: { position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1e1b4b', color: 'white', padding: '10px 18px', borderRadius: 20, fontWeight: 800, zIndex: 10001, boxShadow: '0 6px 20px rgba(0,0,0,0.25)' },
};
