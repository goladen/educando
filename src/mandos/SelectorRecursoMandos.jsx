// Selector de recursos para el Quiz con mandos: «Mis recursos» (si hay sesión)
// y «Públicos». Con letras valen las preguntas de opción múltiple (correcta +
// 1-3 incorrectas); con número, las que tienen un entero por respuesta.
import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { categoriasDeRecurso, limpiar } from '../utils/normalizarPreguntas';
import { aNumeroMando } from './mandosMicrobit.js';

/** Las respuestas numéricas del quiz van de 1 a 19 (fáciles de marcar en el mando). */
export const MIN_NUM_QUIZ = 1;
export const MAX_NUM_QUIZ = 19;

/** Texto → número válido para el quiz numérico (MIN_NUM_QUIZ … MAX_NUM_QUIZ) o null. */
export function numeroQuiz(txt) {
  const n = aNumeroMando(txt);
  return n !== null && n >= MIN_NUM_QUIZ && n <= MAX_NUM_QUIZ ? n : null;
}

/** Pregunta normalizada → formato del quiz { texto, opciones, correcta } o { texto, valor }. */
function aQuiz(p, numerico) {
  if (numerico) {
    const valor = p.tipo === 'MULTIPLE' || p.tipo === 'CORTA' ? numeroQuiz(p.correcta) : null;
    return valor === null ? null : { texto: p.enunciado, valor };
  }
  if (p.tipo !== 'MULTIPLE') return null;
  return { texto: p.enunciado, opciones: p.opciones, correcta: p.opciones.indexOf(p.correcta) };
}

/** Hojas del recurso con las preguntas jugables ya en formato quiz. */
export function hojasQuiz(recurso, numerico = false) {
  return categoriasDeRecurso(recurso)
    .map((c) => ({ nombre: c.nombre, preguntas: c.preguntas.map((p) => aQuiz(p, numerico)).filter(Boolean) }))
    .filter((h) => h.preguntas.length > 0);
}

const conPreguntas = (docs, numerico) =>
  docs
    .map((r) => ({ r, n: hojasQuiz(r, numerico).reduce((s, h) => s + h.preguntas.length, 0) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => (b.r.playCount || 0) - (a.r.playCount || 0));

export default function SelectorRecursoMandos({ seleccionado, onPick, numerico = false }) {
  const uid = auth.currentUser?.uid || null;
  const [pestana, setPestana] = useState(uid ? 'MIOS' : 'PUBLICOS');
  const [listas, setListas] = useState({ MIOS: null, PUBLICOS: null });
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    if (listas[pestana] !== null) return;
    let vivo = true;
    const q =
      pestana === 'MIOS'
        ? query(collection(db, 'resources'), where('profesorUid', '==', uid))
        : query(collection(db, 'resources'), where('isPrivate', '==', false));
    getDocs(q)
      .then((snap) => {
        if (!vivo) return;
        const docs = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        setListas((prev) => ({ ...prev, [pestana]: docs }));
      })
      .catch((e) => {
        console.error('[mandos] recursos', e);
        if (vivo) {
          setError('No se pudieron cargar los recursos.');
          setListas((prev) => ({ ...prev, [pestana]: [] }));
        }
      });
    return () => {
      vivo = false;
    };
  }, [pestana, uid, listas]);

  const docs = listas[pestana];
  const lista = useMemo(() => (docs ? conPreguntas(docs, numerico) : null), [docs, numerico]);
  const resultados = useMemo(() => {
    const q = limpiar(busqueda);
    if (!lista || !q) return lista || [];
    return lista.filter(
      ({ r }) =>
        limpiar(r.titulo).includes(q) ||
        limpiar(r.temas).includes(q) ||
        (r.hojas || []).some((h) => limpiar(h.nombreHoja).includes(q))
    );
  }, [lista, busqueda]);

  return (
    <div style={st.caja}>
      <div style={st.fila}>
        {uid && (
          <button style={st.tab(pestana === 'MIOS')} onClick={() => setPestana('MIOS')}>
            Mis recursos
          </button>
        )}
        <button style={st.tab(pestana === 'PUBLICOS')} onClick={() => setPestana('PUBLICOS')}>
          Públicos
        </button>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por título, tema u hoja…"
          style={st.input}
        />
      </div>
      {error && <p style={st.error}>{error}</p>}
      <div style={st.lista}>
        {lista === null ? (
          <p style={st.vacio}>Cargando recursos…</p>
        ) : resultados.length === 0 ? (
          <p style={st.vacio}>
            {pestana === 'MIOS'
              ? `No tienes recursos con preguntas ${numerico ? 'de respuesta numérica' : 'de opción múltiple'}.`
              : 'No hay recursos compatibles con esa búsqueda.'}
          </p>
        ) : (
          resultados.map(({ r, n }) => (
            <button key={r.id} onClick={() => onPick(r)} style={st.item(seleccionado?.id === r.id)}>
              <div style={{ fontWeight: 700 }}>{r.titulo || 'Sin título'}</div>
              <div style={st.meta}>
                {r.profesorNombre ? `${r.profesorNombre} · ` : ''}
                {n} pregunta{n === 1 ? '' : 's'} {numerico ? 'con respuesta numérica' : 'de opción múltiple'}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

const st = {
  caja: { marginTop: 12 },
  fila: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  tab: (on) => ({
    padding: '7px 14px',
    borderRadius: 999,
    border: `1px solid ${on ? '#facc15' : '#475569'}`,
    background: on ? 'rgba(250,204,21,0.15)' : 'transparent',
    color: '#f1f5f9',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  }),
  input: {
    flex: '1 1 200px',
    minWidth: 0,
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #475569',
    background: '#020617',
    color: '#f1f5f9',
    fontSize: 14,
  },
  lista: { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto', marginTop: 10 },
  item: (on) => ({
    textAlign: 'left',
    padding: '10px 12px',
    borderRadius: 10,
    border: `1px solid ${on ? '#facc15' : '#334155'}`,
    background: on ? 'rgba(250,204,21,0.12)' : 'rgba(15,23,42,0.6)',
    color: '#f1f5f9',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 14,
  }),
  meta: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  vacio: { color: '#94a3b8', fontSize: 13, textAlign: 'center', margin: '14px 0' },
  error: { color: '#fca5a5', fontSize: 13, margin: '8px 0 0' },
};
