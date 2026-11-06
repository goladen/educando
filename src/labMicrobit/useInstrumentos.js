// Mensajes del Laboratorio micro:bit que llegan por la antena (ver programasLab.js) → eventos.
import { useEffect, useRef, useState } from 'react';
import { escucharInstrumentos, enviarAInstrumentos, enviarAMandos } from '../mandos/mandosMicrobit.js';

/** 'I:G:1:2:5230' → { tipo: 'G', id: 1, k: 2, us: 5230 } … o null si no es un mensaje conocido. */
export function leerMensaje(linea) {
  const p = linea.split(':');
  if (p[0] !== 'I' || p.length < 3) return null;
  const tipo = p[1], id = Number(p[2]);
  const nums = (s) => (s || '').split(',').map(Number);
  switch (tipo) {
    case 'G': return { tipo, id, k: Number(p[3]), us: Number(p[4]) };
    case 'S': return { tipo, id, k: Number(p[3]), rssi: Number(p[4]) };
    case 'A': { const [x, y, z] = nums(p[3]); return { tipo, id, x, y, z }; }
    case 'C': return { tipo, id, grados: Number(p[3]) };
    case 'E': { const [temp, luz, sonido] = nums(p[3]); return { tipo, id, temp, luz, sonido }; }
    case 'F': return { tipo, id, us: Number(p[3]) };
    case 'P': return { tipo, id };
    case 'D': return { tipo, id, vals: nums(p[3]).filter((v) => v > 0) };
    case 'W': return { tipo, id, n: Number(p[3]), ms: Number(p[4]) };
    case 'X': { const [p0, p1, p2] = nums(p[3]); return { tipo, id, p0, p1, p2 }; }
    default: return null;
  }
}

/** Escucha los mensajes de los instrumentos: fn(evento). `fn` puede cambiar en cada render. */
export function useInstrumentos(fn) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => escucharInstrumentos((linea, t) => {
    const ev = leerMensaje(linea);
    if (ev) ref.current({ ...ev, t });
  }), []);
}

/**
 * Pone el instrumento en un modo ('GS:3', 'GR', 'IN', 'BR', 'SE', 'CA' o null = parado) y lo repite
 * cada 2 s (por si el instrumento se enciende tarde o se pierde un mensaje). Al salir lo para.
 */
export function useModoInstrumento(modo) {
  useEffect(() => {
    const m = modo ? `I:M:${modo}` : 'I:M:';
    enviarAInstrumentos(m);
    if (!modo) return undefined;
    const t = setInterval(() => enviarAInstrumentos(m), 2000);
    return () => { clearInterval(t); enviarAInstrumentos('I:M:'); };
  }, [modo]);
}

/**
 * Actividades en las que participan todas las placas (dados, orquesta, pantallas): pregunta quién hay
 * (ROL:*:?) y pasa a instrumento las que no lo son, salvo las de `excluir` (los satélites colocados del
 * Laboratorio). Al salir devuelve a mando solo las que ha cambiado. Pone el modo con useModoInstrumento.
 * Devuelve { [id]: { rol, t } } de las placas que han contestado.
 */
export function useTodasInstrumento(activa, modo, excluir = []) {
  const [vistas, setVistas] = useState({});
  const cambiadas = useRef(new Set());
  const fuera = useRef(excluir);
  fuera.current = excluir.map(String);
  useEffect(() => {
    if (!activa) return undefined;
    const quita = escucharInstrumentos((linea, t) => {
      const m = linea.match(/^I:H:(\d+):(M|S[1-4]|I)$/);
      if (!m) return;
      setVistas((v) => ({ ...v, [m[1]]: { rol: m[2], t } }));
      if (m[2] !== 'I' && !fuera.current.includes(m[1])) {
        cambiadas.current.add(m[1]);
        enviarAMandos(`ROL:${m[1]}:I`);
      }
    });
    enviarAMandos('ROL:*:?');
    const t = setInterval(() => enviarAMandos('ROL:*:?'), 8000);
    return () => {
      quita(); clearInterval(t);
      cambiadas.current.forEach((id) => enviarAMandos(`ROL:${id}:M`));
      cambiadas.current.clear();
    };
  }, [activa]);
  useModoInstrumento(activa ? modo : null);
  return vistas;
}
