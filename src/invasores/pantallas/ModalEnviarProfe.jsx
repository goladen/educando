// Envío del resultado de UN jugador a informes_juegos (tipo INVASORES), o a la competición si el
// enlace lleva &comp=&cat= (mismo patrón que Calamar / Bunker).
import React, { useState } from 'react';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../../firebase';
import { guardarRegistroLocal } from '../../utils/registrosLocales';
import { leerCompeticionUrl, soloPrimitivos } from '../../utils/retoLink';
import ModalEnviarCompeticion from '../../components/ModalEnviarCompeticion';
import { BTN, PANEL } from '../tema';

export const TIPO_JUEGO = 'INVASORES';

export default function ModalEnviarProfe(p) {
  const comp = leerCompeticionUrl();
  if (comp) {
    return <ModalEnviarCompeticion compId={comp.compId} catId={comp.catId} puntos={Number(p.datos?.puntos) || 0}
      detalle={soloPrimitivos(p.datos)} nombreJuego="Invasión Pi" tituloReto={comp.titulo} onClose={p.onClose} />;
  }
  return <ModalBase {...p} />;
}

const recorta = (arr) => (arr || []).slice(0, 40).map((r) => ({
  enunciado: String(r.enunciado || '').slice(0, 200),
  dada: String(r.dada || '').slice(0, 120),
  correcta: String(r.correcta || '').slice(0, 120),
}));

function ModalBase({ datos, onClose }) {
  const [nombre, setNombre] = useState(/^J\d$/.test(datos.nombre || '') ? '' : datos.nombre || '');
  const [curso, setCurso] = useState('');
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');

  const enviar = async () => {
    const code = codigo.trim().toUpperCase();
    if (!nombre.trim()) { setError('Escribe tu nombre.'); return; }
    if (!code) { setError('Escribe el código del profesor.'); return; }
    setEnviando(true); setError('');
    try {
      const snap = await getDoc(doc(db, 'codigos_profesor', code));
      if (!snap.exists()) { setError('Código no encontrado.'); setEnviando(false); return; }
      await addDoc(collection(db, 'informes_juegos'), {
        tipo: TIPO_JUEGO,
        modalidad: datos.modalidad || 'Individual',
        fecha: new Date(),
        codigoProfesor: code,
        recursoTitulo: datos.titulo || '',
        jugadores: [{
          nombre: nombre.trim(), curso: curso.trim(),
          aciertos: datos.aciertos, fallos: datos.fallos, intentos: datos.intentos, porcentaje: datos.porcentaje,
          puntos: datos.puntos, nivel: datos.nivel, rondas: datos.rondas, mejorRacha: datos.mejorRacha,
          eliminado: !!datos.eliminado, variante: datos.variante, posicion: datos.posicion || null,
          acertadas: recorta(datos.acertadas), falladas: recorta(datos.falladas),
        }],
      });
      guardarRegistroLocal(TIPO_JUEGO, {
        titulo: datos.titulo, aciertos: datos.aciertos, intentos: datos.intentos, porcentaje: datos.porcentaje,
        nombre: nombre.trim(), curso: curso.trim(), via: 'profesor',
      });
      setEnviado(true);
    } catch (e) { setError(`Error: ${e.message}`); }
    setEnviando(false);
  };

  const campo = 'w-full rounded-md border-2 border-slate-600 bg-slate-950 px-3 py-2 font-pixel text-xl text-slate-100 outline-none focus:border-cyan-400';

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-950/85 p-3">
      <div className={`${PANEL} w-full max-w-sm animate-inv-entrada`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-arcade text-xs text-amber-300">📤 ENVIAR AL PROFE</h3>
          <button type="button" onClick={onClose} className="font-arcade text-sm text-slate-400 hover:text-white">✕</button>
        </div>
        {enviado ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="text-5xl">✅</div>
            <div className="font-arcade text-xs text-green-300">¡INFORME ENVIADO!</div>
            <div className="font-pixel text-xl text-slate-300">{datos.puntos} puntos · {datos.aciertos}/{datos.intentos} aciertos</div>
            <button type="button" onClick={onClose} className={`${BTN.menu} text-[10px]`}>CERRAR</button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-arcade text-[9px] text-slate-400">NOMBRE Y APELLIDO</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-arcade text-[9px] text-slate-400">CURSO</span>
              <input value={curso} onChange={(e) => setCurso(e.target.value)} placeholder="Ej: 2º ESO B" className={campo} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-arcade text-[9px] text-slate-400">CÓDIGO DEL PROFESOR</span>
              <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} maxLength={10}
                className={`${campo} font-arcade text-sm tracking-widest`} />
            </label>
            {error && <p className="font-pixel text-lg text-rose-400">⚠ {error}</p>}
            <div className="mt-1 flex gap-2">
              <button type="button" onClick={onClose} className={`${BTN.menu} flex-1 text-[10px]`}>CANCELAR</button>
              <button type="button" onClick={enviar} disabled={enviando} className={`${BTN.primario} flex-[2] px-3 py-3 text-[10px]`}>
                {enviando ? 'ENVIANDO…' : '📤 ENVIAR'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
