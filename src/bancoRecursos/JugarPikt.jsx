// Banco de recursos → «🎮 Para jugar»: las Preguntas de PiKT (bancoPreguntas/recursosPikt.js) por etapa
// y materia, listas para jugarlas en clase. Arriba, los «⭐ Imprescindibles» (de momento, Lengua).
// Cada recurso abre /?jp=<id>: el selector de juego (components/ElegirJuegoFicha.jsx) con Invasión Pi,
// Luz roja, Money Board, Test, Burbujas, Pikatron, Plataformas o Bunker. También su ficha en PDF.
import { useEffect, useMemo, useState } from 'react';
import { recursosPikt, ETIQUETAS_PIKT } from '../bancoPreguntas/recursosPikt';
import BotonPdfRecurso from '../components/BotonPdfRecurso';

const { ETAPAS, MATERIAS } = ETIQUETAS_PIKT;
const ORDEN_ETAPAS = ['pri', 'eso', 'bach'];
const materiaDe = (r) => String(r.materiaPikt || '').replace(/-(c\d+|imp)$/, '');
const tipoDe = (r) => (/-imp$/.test(r.materiaPikt) ? 'imp' : /-c\d+$/.test(r.materiaPikt) ? 'curso' : r.materiaPikt === 'mezcla' ? 'mezcla' : 'materia');
const nPreguntas = (r) => (r.hojas || []).reduce((s, h) => s + (h.preguntas || []).length, 0);
// i: índice del tema (hoja) para entrar ya con él elegido
const jugar = (r, i = null) => { window.location.href = `/?jp=${encodeURIComponent(r.id)}${i !== null ? `&temas=${i}` : ''}`; };

function Tarjeta({ r, destacada = false }) {
    const temas = (r.hojas || []).map((h) => h.nombreHoja);
    return (
        <div style={{
            background: destacada ? 'linear-gradient(135deg,#fff7ed,#fef3c7)' : 'white', borderRadius: 14, padding: '12px 14px',
            border: destacada ? '2px solid #f59e0b' : '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 6,
        }}>
            <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.95rem' }}>{r.titulo}</div>
            <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                {temas.length > 1 ? `${temas.length} temas · ` : ''}{nPreguntas(r)} preguntas
            </div>
            {temas.length > 1 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 92, overflowY: 'auto' }}>
                    {temas.map((t, i) => (
                        <button key={i} onClick={() => jugar(r, i)} title={`Jugar solo «${t}»`}
                            style={{ padding: '2px 8px', borderRadius: 12, border: '1px solid #c5cae9', background: '#f5f7ff', color: '#3949ab', fontSize: '0.72rem', cursor: 'pointer' }}>{t}</button>
                    ))}
                </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 'auto', flexWrap: 'wrap' }}>
                <button onClick={() => jugar(r)} style={{ flex: 1, padding: '8px 10px', borderRadius: 9, border: 'none', background: destacada ? '#d97706' : '#3949ab', color: 'white', fontWeight: 800, cursor: 'pointer' }}>
                    🎮 Jugar
                </button>
                <BotonPdfRecurso recurso={r} texto="Ficha PDF" style={{ padding: '8px 10px', borderRadius: 9 }} />
            </div>
        </div>
    );
}

export default function JugarPikt() {
    const [lista, setLista] = useState(null);
    const [etapa, setEtapa] = useState('');
    const [materia, setMateria] = useState(() => {
        try { return new URLSearchParams(window.location.search).get('materia') || ''; } catch { return ''; }
    });
    const [texto, setTexto] = useState('');

    useEffect(() => {
        recursosPikt('CAZABURBUJAS', { rellenar: true }).then(setLista).catch((e) => { console.error(e); setLista([]); });
    }, []);

    const materias = useMemo(() => [...new Set((lista || []).map(materiaDe).filter((m) => MATERIAS[m]))], [lista]);
    const q = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const pasa = (r) => (!etapa || r.etapaPikt === etapa) && (!materia || materiaDe(r) === materia)
        && (!q || [r.titulo, r.temas, ...(r.hojas || []).map((h) => h.nombreHoja)].some((x) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q)));
    const visibles = (lista || []).filter(pasa);
    const imprescindibles = visibles.filter((r) => tipoDe(r) === 'imp');

    const chip = (on) => ({ padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, border: `2px solid ${on ? '#3949ab' : '#c5cae9'}`, background: on ? '#3949ab' : 'white', color: on ? 'white' : '#3949ab' });
    const rejilla = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 };

    if (!lista) return <div style={{ textAlign: 'center', color: '#607d8b', margin: 30 }}>Cargando preguntas de PiKT…</div>;
    return (
        <div>
            <p style={{ textAlign: 'center', color: '#455a64', margin: '0 0 12px' }}>
                Bancos de preguntas de PiKT por etapa, materia y tema, listos para jugar en clase (Invasión Pi, Luz roja, Money Board, Test, Burbujas…) o imprimir como ficha.
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 8 }}>
                <button onClick={() => setEtapa('')} style={chip(!etapa)}>Todas las etapas</button>
                {ORDEN_ETAPAS.map((e) => <button key={e} onClick={() => setEtapa(e)} style={chip(etapa === e)}>{ETAPAS[e].label}</button>)}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 10 }}>
                <button onClick={() => setMateria('')} style={chip(!materia)}>Todas las materias</button>
                {materias.map((m) => <button key={m} onClick={() => setMateria(m)} style={chip(materia === m)}>{MATERIAS[m].emoji} {MATERIAS[m].label}</button>)}
            </div>
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar un tema (acentuación, metáfora, Cervantes…)"
                style={{ display: 'block', width: '100%', maxWidth: 460, margin: '0 auto 16px', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #c5cae9', boxSizing: 'border-box', fontSize: '0.92rem' }} />

            {imprescindibles.length > 0 && (
                <section style={{ marginBottom: 20 }}>
                    <h3 style={{ color: '#b45309', margin: '0 0 4px' }}>⭐ Imprescindibles</h3>
                    <p style={{ color: '#78716c', fontSize: '0.84rem', margin: '0 0 10px' }}>Los temas que todo docente quiere llevar al aula al menos un día: cada tema es una hoja (en Money Board, una categoría).</p>
                    <div style={rejilla}>{imprescindibles.map((r) => <Tarjeta key={r.id} r={r} destacada />)}</div>
                </section>
            )}

            {ORDEN_ETAPAS.filter((e) => !etapa || e === etapa).map((e) => {
                const deEtapa = visibles.filter((r) => r.etapaPikt === e && tipoDe(r) !== 'imp');
                if (!deEtapa.length) return null;
                const porMateria = [...new Set(deEtapa.map(materiaDe))];
                return (
                    <section key={e} style={{ marginBottom: 18 }}>
                        <h3 style={{ color: '#1a237e', margin: '0 0 8px' }}>{ETAPAS[e].label}</h3>
                        {porMateria.map((m) => {
                            const rs = deEtapa.filter((r) => materiaDe(r) === m)
                                .sort((a, b) => ({ materia: 0, curso: 1, mezcla: 2 }[tipoDe(a)] - { materia: 0, curso: 1, mezcla: 2 }[tipoDe(b)]) || a.titulo.localeCompare(b.titulo));
                            return (
                                <div key={m} style={{ marginBottom: 12 }}>
                                    {MATERIAS[m] && <div style={{ fontWeight: 800, color: '#3949ab', fontSize: '0.88rem', margin: '0 0 6px' }}>{MATERIAS[m].emoji} {MATERIAS[m].label}</div>}
                                    <div style={rejilla}>{rs.map((r) => <Tarjeta key={r.id} r={r} />)}</div>
                                </div>
                            );
                        })}
                    </section>
                );
            })}
            {!visibles.length && <p style={{ textAlign: 'center', color: '#607d8b' }}>No hay preguntas con esos filtros.</p>}
        </div>
    );
}
