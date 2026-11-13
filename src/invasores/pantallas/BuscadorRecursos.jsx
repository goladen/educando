// Recursos públicos del profesor (o por código de acceso) que se pueden jugar en la variante elegida.
import React, { useEffect, useState } from 'react';
import BuscarFichaCodigo from '../../components/BuscarFichaCodigo';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { conRecursosPikt } from '../../bancoPreguntas/recursosPikt';
import { limpiar } from '../../utils/normalizarPreguntas';
import { desdeRecurso, jugables } from '../preguntas';
import { BTN, PANEL } from '../tema';

export default function BuscadorRecursos({ variante, onPick, onCerrar }) {
  const [todos, setTodos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [codigo, setCodigo] = useState('');
  const [aviso, setAviso] = useState('');

  const cuenta = (r) => jugables(desdeRecurso(r), variante).length;

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'resources'), where('isPrivate', '==', false)));
        const lista = (await conRecursosPikt(snap.docs.map((d) => ({ ...d.data(), id: d.id })), 'CAZABURBUJAS', {}, { rellenar: true }))
          .map((r) => ({ r, n: cuenta(r) }))
          .filter((x) => x.n > 0)
          .sort((a, b) => (b.r.playCount || 0) - (a.r.playCount || 0));
        if (vivo) setTodos(lista);
      } catch (e) { console.error('[Invasión Pi] buscador', e); }
      if (vivo) setCargando(false);
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variante]);

  const porCodigo = async () => {
    const code = codigo.trim().toUpperCase();
    if (!code) return;
    setAviso('Buscando…');
    try {
      const snap = await getDocs(query(collection(db, 'resources'), where('accessCode', '==', code)));
      if (snap.empty) { setAviso('No hay ningún recurso con ese código.'); return; }
      const r = { ...snap.docs[0].data(), id: snap.docs[0].id };
      if (!cuenta(r)) { setAviso('Ese recurso no tiene preguntas que se puedan jugar en esta variante.'); return; }
      onPick(r);
    } catch (e) { setAviso(`Error: ${e.message}`); }
  };

  const q = limpiar(busqueda);
  const resultados = !q ? todos : todos.filter(({ r }) =>
    limpiar(r.titulo).includes(q) || limpiar(r.temas).includes(q) || (r.hojas || []).some((h) => limpiar(h.nombreHoja).includes(q)));

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-950/85 p-3" onPointerDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className={`${PANEL} flex max-h-[90vh] w-full max-w-xl flex-col gap-3 animate-inv-entrada`}>
        <div className="flex items-center justify-between">
          <h3 className="font-arcade text-xs text-cyan-300 sm:text-sm">🔎 RECURSO DEL PROFE</h3>
          <button type="button" onClick={onCerrar} className="font-arcade text-sm text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="flex gap-2">
          <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && porCodigo()}
            placeholder="CÓDIGO" maxLength={12}
            className="min-w-0 flex-1 rounded-md border-2 border-slate-600 bg-slate-950 px-3 py-2 font-arcade text-xs tracking-widest text-slate-100 outline-none focus:border-cyan-400" />
          <button type="button" onClick={porCodigo} className={`${BTN.menu} text-[10px]`}>USAR</button>
        </div>
        <BuscarFichaCodigo oscuro />
        {aviso && <p className="font-pixel text-lg text-amber-300">{aviso}</p>}
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por título, tema u hoja…"
          className="rounded-md border-2 border-slate-600 bg-slate-950 px-3 py-2 font-pixel text-xl text-slate-100 outline-none focus:border-cyan-400" />
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
          {cargando ? <p className="py-6 text-center font-arcade text-[10px] text-slate-400">CARGANDO…</p>
            : resultados.length === 0 ? <p className="py-6 text-center font-pixel text-xl text-slate-400">Sin recursos compatibles.</p>
              : resultados.slice(0, 120).map(({ r, n }) => (
                <button key={r.id} type="button" onClick={() => onPick(r)}
                  className="rounded-md border-2 border-slate-700 bg-slate-800/70 px-3 py-2 text-left transition-colors hover:border-cyan-400">
                  <div className="font-pixel text-xl leading-tight text-slate-50">{r.titulo || 'Sin título'}</div>
                  <div className="font-pixel text-base text-slate-400">
                    {r.tipoJuego || 'Recurso'}{r.profesorNombre ? ` · ${r.profesorNombre}` : ''} · {n} pregunta(s)
                  </div>
                </button>
              ))}
        </div>
      </div>
    </div>
  );
}
