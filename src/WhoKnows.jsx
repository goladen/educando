import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from './firebase';
import { collection, getDocs, getDoc, doc, addDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { useT, useLanguage } from './i18n/LanguageContext';
import LanguageSelector from './i18n/LanguageSelector';
import correctSound from './assets/correct-choice-43861.mp3';
import wrongSound from './assets/negative_beeps-6008.mp3';

const _okAudio = new Audio(correctSound);
const _failAudio = new Audio(wrongSound);
const playOk = () => { try { _okAudio.currentTime = 0; _okAudio.play().catch(() => {}); } catch { /* noop */ } };
const playFail = () => { try { _failAudio.currentTime = 0; _failAudio.play().catch(() => {}); } catch { /* noop */ } };

// ─── Config ──────────────────────────────────────────────────────────────────
const RECURSO_ID = 'ki0UtmWJ5nOiXLsBJ9Vb'; // Trivial de escalada
const TIEMPO = 30;            // segundos por pregunta
const PTS_MAX = 50, PTS_MIN = 30, PTS_FALLO = -5;

const CAT_IDS = ['geo', 'esp', 'his', 'art', 'cie', 'dep'];
const CAT_DEF = {
    geo: { nombre: 'Geografía',    emoji: '🌍', hex: '#3498db' },
    esp: { nombre: 'Espectáculos', emoji: '🎬', hex: '#e84393' },
    his: { nombre: 'Historia',     emoji: '📜', hex: '#f1c40f' },
    art: { nombre: 'Arte y Lit.',  emoji: '🎨', hex: '#9b59b6' },
    cie: { nombre: 'Ciencias',     emoji: '🔬', hex: '#2ecc71' },
    dep: { nombre: 'Deportes',     emoji: '⚽', hex: '#e67e22' },
};
const POR_CAT_MIX = { rapido: 4, master: 8 };  // preguntas/categoría en modo mix
const TOTAL_SINGLE = { rapido: 24, master: 48 }; // total en categoría única
const HARD_MIX = { rapido: 1, master: 2 };       // difíciles mínimas por categoría (mix)
const HARD_SINGLE = { rapido: 6, master: 12 };   // difíciles mínimas (categoría única)

const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clean = s => s ? String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim() : '';

export default function WhoKnows({ onExit }) {
    const t = useT();
    const { idioma, primeCache } = useLanguage();

    // Precarga en la caché de idioma las traducciones revisadas del recurso.
    const primeTraducciones = (porCat) => {
        if (idioma === 'es' || !porCat) return;
        const pares = {};
        for (const p of Object.values(porCat).flat()) {
            const tr = p?.traducciones?.[idioma];
            if (!tr) continue;
            if (tr.q && p.q) pares[p.q] = tr.q;
            if (tr.a && p.a) pares[p.a] = tr.a;
            if (Array.isArray(tr.w) && Array.isArray(p.w)) p.w.forEach((w, i) => { if (tr.w[i] && w) pares[w] = tr.w[i]; });
            if (tr.b0 && p.bloques?.[0]) pares[p.bloques[0]] = tr.b0;
            if (tr.b2 && p.bloques?.[2]) pares[p.bloques[2]] = tr.b2;
        }
        if (Object.keys(pares).length) primeCache(idioma, pares);
    };

    const [fase, setFase] = useState('CARGANDO'); // CARGANDO | CONFIG | JUGANDO | FIN
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth <= 640);
    useEffect(() => {
        const fn = () => setIsMobile(window.innerWidth <= 640);
        window.addEventListener('resize', fn);
        return () => window.removeEventListener('resize', fn);
    }, []);
    const [preguntasPorCat, setPreguntasPorCat] = useState({});
    const [cats, setCats] = useState(CAT_DEF); // nombres/emojis del recurso

    // Config
    const [categoriaSel, setCategoriaSel] = useState('mix');
    const [modo, setModo] = useState('rapido');

    // Partida
    const [cola, setCola] = useState([]);
    const [idx, setIdx] = useState(0);
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(TIEMPO);
    const [respondida, setRespondida] = useState(false);
    const [resultado, setResultado] = useState(null); // { ok:bool, puntos:int, timeout:bool }
    const [inputCorta, setInputCorta] = useState('');
    const [ordenSlots, setOrdenSlots] = useState({ available: [], slots: [] });
    const [answers, setAnswers] = useState([]); // opciones barajadas (SELECCION)
    const startRef = useRef(0);

    // Ranking
    const [nombre, setNombre] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [guardado, setGuardado] = useState(false);
    const [ranking, setRanking] = useState(null);
    const [miEntradaId, setMiEntradaId] = useState(null);
    // Visor de rankings por categoría
    const [rankingsAll, setRankingsAll] = useState(null);
    const [rkCat, setRkCat] = useState('mix');
    const [rkModo, setRkModo] = useState('rapido');

    // ── Cargar preguntas del recurso ─────────────────────────────────────────
    useEffect(() => {
        (async () => {
            try {
                const [snap, recursoDoc] = await Promise.all([
                    getDocs(collection(db, 'trivial_recursos', RECURSO_ID, 'preguntas')),
                    getDoc(doc(db, 'trivial_recursos', RECURSO_ID)),
                ]);
                const por = { geo: [], esp: [], his: [], art: [], cie: [], dep: [] };
                snap.forEach(d => {
                    const q = { id: d.id, ...d.data() };
                    const tipo = q.tipo || 'SELECCION';
                    const valida = q.categoria && (
                        (tipo === 'SELECCION' && q.q && q.a && q.w?.length) ||
                        (tipo === 'CORTA' && q.q && q.a) ||
                        (tipo === 'RELLENAR' && q.bloques?.length >= 2) ||
                        (tipo === 'ORDENAR' && q.bloques?.length >= 2)
                    );
                    if (valida && por[q.categoria]) por[q.categoria].push(q);
                });
                setPreguntasPorCat(por);
                if (recursoDoc.exists() && recursoDoc.data().categorias) {
                    const c = { ...CAT_DEF };
                    for (const id of CAT_IDS) {
                        const st = recursoDoc.data().categorias[id];
                        if (st) c[id] = { ...c[id], nombre: st.nombre || c[id].nombre, emoji: st.emoji || c[id].emoji };
                    }
                    setCats(c);
                }
                setFase('CONFIG');
            } catch (e) { console.error(e); setFase('CONFIG'); }
        })();
    }, []);

    // Precargar traducciones revisadas al cargar y al cambiar de idioma.
    useEffect(() => { primeTraducciones(preguntasPorCat); }, [idioma, preguntasPorCat]); // eslint-disable-line

    // ── Construir la cola de preguntas (difíciles al final, orden variable) ───
    // Selecciona `need` preguntas de un pool garantizando al menos `hardQuota`
    // difíciles (si las hay), y rellena el resto con normales (o más difíciles).
    const pickCat = (pool, need, hardQuota) => {
        const hard = shuffle(pool.filter(q => q.dificultad === 'dificil'));
        const normal = shuffle(pool.filter(q => q.dificultad !== 'dificil'));
        const nHard = Math.min(hardQuota, hard.length, need);
        const picked = hard.slice(0, nHard);
        for (const q of normal) { if (picked.length >= need) break; picked.push(q); }
        for (let i = nHard; i < hard.length && picked.length < need; i++) picked.push(hard[i]);
        return picked.slice(0, need);
    };

    const empezar = () => {
        let seleccion = [];
        if (categoriaSel === 'mix') {
            for (const c of CAT_IDS) seleccion.push(...pickCat(preguntasPorCat[c] || [], POR_CAT_MIX[modo], HARD_MIX[modo]));
        } else {
            seleccion = pickCat(preguntasPorCat[categoriaSel] || [], TOTAL_SINGLE[modo], HARD_SINGLE[modo]);
        }
        if (!seleccion.length) return;
        // Normales barajadas primero, difíciles barajadas al final.
        const normales  = shuffle(seleccion.filter(q => q.dificultad !== 'dificil'));
        const dificiles = shuffle(seleccion.filter(q => q.dificultad === 'dificil'));
        setCola([...normales, ...dificiles]);
        setIdx(0); setScore(0);
        setFase('JUGANDO');
    };

    const preg = cola[idx];
    const tipo = preg?.tipo || 'SELECCION';

    // ── Preparar cada pregunta ────────────────────────────────────────────────
    useEffect(() => {
        if (fase !== 'JUGANDO' || !preg) return;
        setRespondida(false); setResultado(null); setInputCorta('');
        setTimeLeft(TIEMPO); startRef.current = Date.now();
        if (tipo === 'SELECCION') setAnswers(shuffle([preg.a, ...(preg.w || [])]));
        else setAnswers([]);
        if (tipo === 'ORDENAR') setOrdenSlots({ available: shuffle(preg.bloques || []), slots: [] });
        else setOrdenSlots({ available: [], slots: [] });
    }, [idx, fase]); // eslint-disable-line

    // ── Temporizador ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (fase !== 'JUGANDO' || respondida || !preg) return;
        const t = setInterval(() => {
            const restante = Math.ceil((TIEMPO * 1000 - (Date.now() - startRef.current)) / 1000);
            if (restante <= 0) { clearInterval(t); setTimeLeft(0); resolver(null); }
            else setTimeLeft(restante);
        }, 200);
        return () => clearInterval(t);
    }, [fase, respondida, idx]); // eslint-disable-line

    // ── Resolver la pregunta ──────────────────────────────────────────────────
    const resolver = useCallback((esCorrecta) => {
        if (respondida) return;
        if (esCorrecta === null) { // timeout: sin penalización, muestra feedback
            setResultado({ ok: false, puntos: 0, timeout: true });
            playFail();
        } else if (esCorrecta) {
            const restanteMs = Math.max(0, TIEMPO * 1000 - (Date.now() - startRef.current));
            const puntos = Math.round(PTS_MIN + (PTS_MAX - PTS_MIN) * (restanteMs / (TIEMPO * 1000)));
            setScore(s => s + puntos);
            setResultado({ ok: true, puntos });
            playOk();
        } else {
            setScore(s => s + PTS_FALLO);
            setResultado({ ok: false, puntos: PTS_FALLO });
            playFail();
        }
        setRespondida(true);
    }, [respondida]);

    const siguiente = () => {
        if (idx + 1 >= cola.length) { setFase('FIN'); cargarRanking(); }
        else setIdx(i => i + 1);
    };

    // ── Respuesta correcta (para el feedback) ─────────────────────────────────
    const respuestaCorrectaTexto = () => {
        if (tipo === 'RELLENAR') return preg.bloques?.[1];
        if (tipo === 'ORDENAR') return (preg.bloques || []).join(' → ');
        return preg.a;
    };

    // ── Ranking ───────────────────────────────────────────────────────────────
    const cargarRanking = async () => {
        try {
            const snap = await getDocs(query(collection(db, 'whoknows_scores'), where('recursoId', '==', RECURSO_ID)));
            const todas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setRanking(todas.filter(r => r.modo === modo).sort((a, b) => (b.puntuacion || 0) - (a.puntuacion || 0)).slice(0, 20));
        } catch (e) { console.error(e); setRanking([]); }
    };

    const abrirRankings = async () => {
        setFase('RANKINGS');
        if (rankingsAll) return;
        try {
            const snap = await getDocs(query(collection(db, 'whoknows_scores'), where('recursoId', '==', RECURSO_ID)));
            setRankingsAll(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { console.error(e); setRankingsAll([]); }
    };

    const guardarPuntuacion = async () => {
        if (!nombre.trim() || guardado) return;
        setGuardando(true);
        try {
            const ref = await addDoc(collection(db, 'whoknows_scores'), {
                recursoId: RECURSO_ID, modo, categoria: categoriaSel,
                nombre: nombre.trim().slice(0, 24), puntuacion: score,
                preguntas: cola.length, fecha: serverTimestamp(),
            });
            setMiEntradaId(ref.id); setGuardado(true);
            await cargarRanking();
        } catch (e) { console.error(e); }
        setGuardando(false);
    };

    // ── Estilos base ──────────────────────────────────────────────────────────
    const wrap = { minHeight: '100dvh', background: 'linear-gradient(160deg,#0b1220,#0e2233 60%,#0a2a3a)', color: 'white', fontFamily: "'Segoe UI',sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', padding: isMobile ? '52px 12px 16px' : '20px 16px' };
    const btnBack = { position: 'fixed', top: 12, left: 12, zIndex: 50, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#cbd5e1', borderRadius: 10, padding: '7px 12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' };

    // ── CARGANDO ──────────────────────────────────────────────────────────────
    if (fase === 'CARGANDO') return <div style={{ ...wrap, justifyContent: 'center' }}>{t('Cargando preguntas…')}</div>;

    // ── CONFIG ────────────────────────────────────────────────────────────────
    if (fase === 'CONFIG') {
        const totalMix = POR_CAT_MIX[modo] * CAT_IDS.length;
        const catDisponibles = CAT_IDS.filter(c => (preguntasPorCat[c] || []).length > 0);
        return (
            <div style={wrap}>
                <button style={btnBack} onClick={onExit}>← Climbing</button>
                <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 50 }}><LanguageSelector compacto /></div>
                <div style={{ textAlign: 'center', margin: isMobile ? '8px 0 18px' : '30px 0 24px' }}>
                    <div style={{ fontSize: isMobile ? '2.4rem' : '3rem' }}>🧠</div>
                    <h1 style={{ margin: '8px 0 2px', fontSize: 'clamp(1.7rem,5vw,2.4rem)', fontWeight: 900 }}>Who Knows?</h1>
                    <p style={{ color: '#94a3b8', margin: 0 }}>{t('Test de escalada · elige categoría y modo')}</p>
                </div>

                <div style={{ width: '100%', maxWidth: 560 }}>
                    <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{t('Categoría')}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))', gap: 8, marginBottom: 22 }}>
                        <button onClick={() => setCategoriaSel('mix')}
                            style={{ background: categoriaSel === 'mix' ? '#0ea5e9' : 'rgba(255,255,255,0.05)', border: `2px solid ${categoriaSel === 'mix' ? '#0ea5e9' : '#334155'}`, color: 'white', borderRadius: 12, padding: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
                            🎲 {t('Mix de categorías')}
                        </button>
                        {catDisponibles.map(c => (
                            <button key={c} onClick={() => setCategoriaSel(c)}
                                style={{ background: categoriaSel === c ? cats[c].hex : 'rgba(255,255,255,0.05)', border: `2px solid ${categoriaSel === c ? cats[c].hex : '#334155'}`, color: 'white', borderRadius: 12, padding: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
                                {cats[c].emoji} {t(cats[c].nombre)}
                            </button>
                        ))}
                    </div>

                    <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{t('Modo')}</div>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
                        {[['rapido', '⚡', t('Rápido'), categoriaSel === 'mix' ? `${totalMix} ${t('preguntas')} (4/${t('categoría')})` : `24 ${t('preguntas')}`],
                          ['master', '👑', t('Master'), categoriaSel === 'mix' ? `${POR_CAT_MIX.master * 6} ${t('preguntas')} (8/${t('categoría')})` : `48 ${t('preguntas')}`]].map(([k, ic, lab, sub]) => (
                            <button key={k} onClick={() => setModo(k)}
                                style={{ flex: 1, background: modo === k ? '#7c3aed' : 'rgba(255,255,255,0.05)', border: `2px solid ${modo === k ? '#a855f7' : '#334155'}`, color: 'white', borderRadius: 14, padding: '16px', cursor: 'pointer' }}>
                                <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{ic} {lab}</div>
                                <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: 3 }}>{sub}</div>
                            </button>
                        ))}
                    </div>

                    <button onClick={empezar}
                        style={{ width: '100%', background: 'linear-gradient(135deg,#22c55e,#16a34a)', border: 'none', color: 'white', padding: '15px', borderRadius: 14, cursor: 'pointer', fontWeight: 800, fontSize: '1.1rem' }}>
                        ▶ {t('Empezar')}
                    </button>
                    <button onClick={abrirRankings}
                        style={{ width: '100%', marginTop: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid #334155', color: '#e2e8f0', padding: '13px', borderRadius: 14, cursor: 'pointer', fontWeight: 700, fontSize: '1rem' }}>
                        🏆 {t('Ver rankings')}
                    </button>
                </div>
            </div>
        );
    }

    // ── VISOR DE RANKINGS POR CATEGORÍA ──────────────────────────────────────
    if (fase === 'RANKINGS') {
        const catsRank = ['mix', ...CAT_IDS.filter(c => (preguntasPorCat[c] || []).length > 0)];
        const lista = (rankingsAll || []).filter(r => r.modo === rkModo && (r.categoria || 'mix') === rkCat)
            .sort((a, b) => (b.puntuacion || 0) - (a.puntuacion || 0)).slice(0, 20);
        return (
            <div style={wrap}>
                <button style={btnBack} onClick={() => setFase('CONFIG')}>← {t('Volver')}</button>
                <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 50 }}><LanguageSelector compacto /></div>
                <div style={{ textAlign: 'center', margin: isMobile ? '8px 0 16px' : '24px 0 18px' }}>
                    <div style={{ fontSize: isMobile ? '2.4rem' : '3rem' }}>🏆</div>
                    <h1 style={{ margin: '6px 0 2px', fontSize: 'clamp(1.5rem,5vw,2.2rem)', fontWeight: 900 }}>{t('Rankings')}</h1>
                </div>

                <div style={{ width: '100%', maxWidth: 480 }}>
                    {/* Modo */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                        {['rapido', 'master'].map(m => (
                            <button key={m} onClick={() => setRkModo(m)}
                                style={{ flex: 1, background: rkModo === m ? '#7c3aed' : 'rgba(255,255,255,0.05)', border: `2px solid ${rkModo === m ? '#a855f7' : '#334155'}`, color: 'white', borderRadius: 10, padding: '9px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
                                {m === 'master' ? `👑 ${t('Master')}` : `⚡ ${t('Rápido')}`}
                            </button>
                        ))}
                    </div>
                    {/* Categorías */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                        {catsRank.map(c => {
                            const activo = rkCat === c;
                            const hex = c === 'mix' ? '#0ea5e9' : (cats[c]?.hex || '#64748b');
                            return (
                                <button key={c} onClick={() => setRkCat(c)}
                                    style={{ background: activo ? hex : 'rgba(255,255,255,0.05)', border: `1.5px solid ${activo ? hex : '#334155'}`, color: activo ? 'white' : '#cbd5e1', borderRadius: 20, padding: '5px 12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
                                    {c === 'mix' ? `🎲 ${t('Mix')}` : `${cats[c]?.emoji || ''} ${t(cats[c]?.nombre || c)}`}
                                </button>
                            );
                        })}
                    </div>
                    {/* Tabla */}
                    {rankingsAll === null ? <div style={{ color: '#64748b' }}>{t('Cargando…')}</div>
                        : lista.length === 0 ? <div style={{ color: '#64748b', textAlign: 'center', padding: 24 }}>{t('Aún no hay puntuaciones. ¡Sé el primero!')}</div> : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {lista.map((r, i) => {
                                    const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
                                    return (
                                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', borderRadius: 10, padding: '9px 14px' }}>
                                            <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 800 }}>{medal}</span>
                                            <span style={{ flex: 1, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre}</span>
                                            <span style={{ fontWeight: 900, color: '#22c55e', minWidth: 52, textAlign: 'right' }}>{r.puntuacion}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                </div>
            </div>
        );
    }

    // ── FIN + RANKING ─────────────────────────────────────────────────────────
    if (fase === 'FIN') {
        return (
            <div style={wrap}>
                <button style={btnBack} onClick={onExit}>← Climbing</button>
                <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 50 }}><LanguageSelector compacto /></div>
                <div style={{ textAlign: 'center', margin: '30px 0 20px' }}>
                    <div style={{ fontSize: '3rem' }}>🏁</div>
                    <h1 style={{ margin: '8px 0', fontSize: '2rem', fontWeight: 900 }}>{t('¡Terminado!')}</h1>
                    <div style={{ fontSize: '2.6rem', fontWeight: 900, color: '#22c55e' }}>{score} {t('pts')}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{cola.length} {t('preguntas')} · {t(modo === 'master' ? 'Master' : 'Rápido')} · {categoriaSel === 'mix' ? t('Mix') : t(cats[categoriaSel]?.nombre)}</div>
                </div>

                {!guardado ? (
                    <div style={{ width: '100%', maxWidth: 420, display: 'flex', gap: 8, marginBottom: 24 }}>
                        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder={t('Tu nombre para el ranking')}
                            onKeyDown={e => { if (e.key === 'Enter') guardarPuntuacion(); }}
                            style={{ flex: 1, background: '#0f172a', border: '2px solid #334155', borderRadius: 10, color: 'white', padding: '12px 14px', fontSize: '1rem', outline: 'none' }} />
                        <button onClick={guardarPuntuacion} disabled={!nombre.trim() || guardando}
                            style={{ background: '#1d4ed8', border: 'none', color: 'white', padding: '0 20px', borderRadius: 10, cursor: nombre.trim() ? 'pointer' : 'default', fontWeight: 700, opacity: nombre.trim() ? 1 : 0.5 }}>
                            {guardando ? '…' : t('Guardar')}
                        </button>
                    </div>
                ) : <div style={{ color: '#4ade80', fontWeight: 700, marginBottom: 18 }}>✓ {t('Puntuación guardada')}</div>}

                <div style={{ width: '100%', maxWidth: 480 }}>
                    <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>🏆 {t('Ranking')} ({t(modo === 'master' ? 'Master' : 'Rápido')})</div>
                    {ranking === null ? <div style={{ color: '#64748b' }}>{t('Cargando…')}</div> : ranking.length === 0 ? <div style={{ color: '#64748b' }}>{t('Aún no hay puntuaciones. ¡Sé el primero!')}</div> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {ranking.map((r, i) => {
                                const yo = r.id === miEntradaId;
                                const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
                                return (
                                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: yo ? '#1d4ed833' : 'rgba(255,255,255,0.05)', border: `1px solid ${yo ? '#3b82f6' : '#334155'}`, borderRadius: 10, padding: '9px 14px' }}>
                                        <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 800 }}>{medal}</span>
                                        <span style={{ flex: 1, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre}{yo && ` (${t('tú')})`}</span>
                                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{r.categoria === 'mix' ? t('Mix') : t(cats[r.categoria]?.nombre || r.categoria)}</span>
                                        <span style={{ fontWeight: 900, color: '#22c55e', minWidth: 52, textAlign: 'right' }}>{r.puntuacion}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <button onClick={() => { setFase('CONFIG'); setGuardado(false); setNombre(''); setMiEntradaId(null); setRanking(null); }}
                        style={{ width: '100%', marginTop: 18, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '12px', borderRadius: 12, cursor: 'pointer', fontWeight: 700 }}>
                        🔁 {t('Jugar otra vez')}
                    </button>
                </div>
            </div>
        );
    }

    // ── JUGANDO ───────────────────────────────────────────────────────────────
    if (!preg) return <div style={{ ...wrap, justifyContent: 'center' }}>{t('No hay preguntas disponibles.')}</div>;
    const catInfo = cats[preg.categoria] || CAT_DEF[preg.categoria] || { nombre: '', emoji: '', hex: '#64748b' };
    const puntosPreview = Math.round(PTS_MIN + (PTS_MAX - PTS_MIN) * (timeLeft / TIEMPO));

    return (
        <div style={wrap}>
            {isMobile && <div style={{ position: 'fixed', top: 10, right: 10, zIndex: 50 }}><LanguageSelector compacto /></div>}
            {/* Barra superior */}
            <div style={{ width: '100%', maxWidth: 620, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span style={{ background: catInfo.hex + '22', color: catInfo.hex, border: `1px solid ${catInfo.hex}66`, borderRadius: 8, padding: '3px 10px', fontSize: isMobile ? '0.74rem' : '0.8rem', fontWeight: 700, maxWidth: isMobile ? 130 : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{catInfo.emoji} {t(catInfo.nombre)}</span>
                <span style={{ color: '#64748b', fontSize: isMobile ? '0.78rem' : '0.85rem', whiteSpace: 'nowrap' }}>{isMobile ? `${idx + 1}/${cola.length}` : `${t('Pregunta')} ${idx + 1}/${cola.length}`}</span>
                <span style={{ marginLeft: 'auto', fontWeight: 900, color: '#22c55e', fontSize: isMobile ? '0.95rem' : '1rem', whiteSpace: 'nowrap' }}>{score} {t('pts')}</span>
                {!isMobile && <LanguageSelector compacto />}
            </div>

            {/* Temporizador */}
            <div style={{ width: '100%', maxWidth: 620, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
                    <span style={{ color: timeLeft > 5 ? '#94a3b8' : '#f87171', fontWeight: 700 }}>⏱ {timeLeft}s</span>
                    {!respondida && <span style={{ color: '#94a3b8' }}>{t('vale')} ~{puntosPreview} {t('pts')}</span>}
                </div>
                <div style={{ height: 8, background: '#1e293b', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(timeLeft / TIEMPO) * 100}%`, background: timeLeft > 5 ? '#22c55e' : '#ef4444', transition: 'width 0.2s linear' }} />
                </div>
            </div>

            {/* Pregunta */}
            <div style={{ width: '100%', maxWidth: 620, background: 'rgba(255,255,255,0.04)', border: '1px solid #334155', borderRadius: 18, padding: isMobile ? '16px 14px' : '22px 20px' }}>
                {tipo !== 'RELLENAR' && preg.q && <h2 style={{ fontSize: isMobile ? '1.12rem' : '1.35rem', margin: isMobile ? '0 0 16px' : '0 0 20px', lineHeight: 1.4 }}>{t(preg.q)}</h2>}

                {/* SELECCION */}
                {tipo === 'SELECCION' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {answers.map((op, i) => {
                            const esCorrecta = op === preg.a;
                            const bg = !respondida ? '#0f172a' : esCorrecta ? '#14532d' : '#3f1d1d';
                            const bd = !respondida ? '#334155' : esCorrecta ? '#22c55e' : '#7f1d1d';
                            return (
                                <button key={i} disabled={respondida} onClick={() => resolver(esCorrecta)}
                                    style={{ background: bg, border: `2px solid ${bd}`, color: 'white', borderRadius: 12, padding: isMobile ? '13px 14px' : '14px 16px', textAlign: 'left', cursor: respondida ? 'default' : 'pointer', fontSize: isMobile ? '0.95rem' : '1rem', lineHeight: 1.35 }}>
                                    {t(op)}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* CORTA */}
                {tipo === 'CORTA' && (
                    <div>
                        <input value={inputCorta} onChange={e => setInputCorta(e.target.value)} disabled={respondida}
                            onKeyDown={e => { if (e.key === 'Enter' && inputCorta.trim() && !respondida) resolver(clean(inputCorta) === clean(preg.a) || (preg.alternativas || []).some(a => clean(a) === clean(inputCorta))); }}
                            placeholder={t('Escribe tu respuesta…')} autoFocus
                            style={{ width: '100%', boxSizing: 'border-box', background: '#0f172a', border: '2px solid #475569', borderRadius: 10, color: 'white', padding: '13px 15px', fontSize: '1.05rem', outline: 'none', marginBottom: 12 }} />
                        {!respondida && <button onClick={() => resolver(clean(inputCorta) === clean(preg.a) || (preg.alternativas || []).some(a => clean(a) === clean(inputCorta)))} disabled={!inputCorta.trim()}
                            style={{ width: '100%', background: '#1d4ed8', border: 'none', color: 'white', padding: '13px', borderRadius: 10, cursor: inputCorta.trim() ? 'pointer' : 'default', fontWeight: 800, opacity: inputCorta.trim() ? 1 : 0.5 }}>{t('Responder')}</button>}
                    </div>
                )}

                {/* RELLENAR */}
                {tipo === 'RELLENAR' && (
                    <div>
                        <div style={{ fontSize: isMobile ? '1.05rem' : '1.25rem', lineHeight: 1.6, marginBottom: 16 }}>
                            <span>{t(preg.bloques?.[0])} </span>
                            <span style={{ borderBottom: '3px solid #38bdf8', padding: '0 12px', color: '#38bdf8', fontWeight: 700 }}>___</span>
                            {preg.bloques?.[2] && <span> {t(preg.bloques[2])}</span>}
                        </div>
                        <input value={inputCorta} onChange={e => setInputCorta(e.target.value)} disabled={respondida}
                            onKeyDown={e => { if (e.key === 'Enter' && inputCorta.trim() && !respondida) resolver(clean(inputCorta) === clean(preg.bloques?.[1]) || (preg.alternativas || []).some(a => clean(a) === clean(inputCorta))); }}
                            placeholder={t('Completa el hueco…')} autoFocus
                            style={{ width: '100%', boxSizing: 'border-box', background: '#0f172a', border: '2px solid #38bdf8', borderRadius: 10, color: '#38bdf8', padding: '13px 15px', fontSize: '1.05rem', outline: 'none', marginBottom: 12 }} />
                        {!respondida && <button onClick={() => resolver(clean(inputCorta) === clean(preg.bloques?.[1]) || (preg.alternativas || []).some(a => clean(a) === clean(inputCorta)))} disabled={!inputCorta.trim()}
                            style={{ width: '100%', background: '#0e7490', border: 'none', color: 'white', padding: '13px', borderRadius: 10, cursor: inputCorta.trim() ? 'pointer' : 'default', fontWeight: 800, opacity: inputCorta.trim() ? 1 : 0.5 }}>{t('Responder')}</button>}
                    </div>
                )}

                {/* ORDENAR */}
                {tipo === 'ORDENAR' && (
                    <div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 44, background: '#0f172a', borderRadius: 10, padding: '8px 10px', marginBottom: 10, border: '2px dashed #334155' }}>
                            {ordenSlots.slots.length === 0 && <span style={{ color: '#475569', fontSize: '0.85rem', alignSelf: 'center' }}>{t('Toca los elementos en el orden correcto')}</span>}
                            {ordenSlots.slots.map((s, i) => (
                                <button key={i} disabled={respondida} onClick={() => setOrdenSlots(p => ({ slots: p.slots.filter(x => x !== s), available: [...p.available, s] }))}
                                    style={{ background: '#1d4ed8', border: 'none', color: 'white', borderRadius: 8, padding: '7px 14px', cursor: respondida ? 'default' : 'pointer', fontWeight: 600 }}>{i + 1}. {s}</button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                            {ordenSlots.available.map((s, i) => (
                                <button key={i} disabled={respondida} onClick={() => setOrdenSlots(p => ({ available: p.available.filter(x => x !== s), slots: [...p.slots, s] }))}
                                    style={{ background: '#334155', border: '1px solid #475569', color: '#e2e8f0', borderRadius: 8, padding: '7px 14px', cursor: respondida ? 'default' : 'pointer' }}>{s}</button>
                            ))}
                        </div>
                        {!respondida && <button onClick={() => resolver(JSON.stringify(ordenSlots.slots) === JSON.stringify(preg.bloques))} disabled={ordenSlots.slots.length !== (preg.bloques || []).length}
                            style={{ width: '100%', background: '#166534', border: 'none', color: 'white', padding: '13px', borderRadius: 10, cursor: ordenSlots.slots.length === (preg.bloques || []).length ? 'pointer' : 'default', fontWeight: 800, opacity: ordenSlots.slots.length === (preg.bloques || []).length ? 1 : 0.5 }}>{t('Confirmar orden')}</button>}
                    </div>
                )}

                {/* Feedback */}
                {respondida && resultado && (
                    <div style={{ marginTop: 18, background: resultado.ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', border: `2px solid ${resultado.ok ? '#22c55e' : '#ef4444'}`, borderRadius: 14, padding: '16px 18px' }}>
                        {resultado.ok ? (
                            <div style={{ color: '#4ade80', fontWeight: 800, fontSize: '1.1rem' }}>✓ {t('¡Correcto!')}  +{resultado.puntos} {t('pts')}</div>
                        ) : (
                            <>
                                <div style={{ color: '#f87171', fontWeight: 800, marginBottom: 6 }}>{resultado.timeout ? `⏱ ${t('Se acabó el tiempo')}` : `✗ ${t('Incorrecto')}  ${resultado.puntos} ${t('pts')}`}</div>
                                <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>{t('Respuesta correcta:')}</div>
                                <div style={{ color: '#4ade80', fontWeight: 800, fontSize: '1.05rem' }}>{tipo === 'SELECCION' ? t(respuestaCorrectaTexto()) : respuestaCorrectaTexto()}</div>
                            </>
                        )}
                        <button onClick={siguiente}
                            style={{ width: '100%', marginTop: 14, background: '#1d4ed8', border: 'none', color: 'white', padding: '12px', borderRadius: 10, cursor: 'pointer', fontWeight: 800 }}>
                            {idx + 1 >= cola.length ? t('Ver resultado →') : t('Siguiente →')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
