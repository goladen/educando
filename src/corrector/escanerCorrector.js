// 📱 El móvil como cámara del Corrector de exámenes.
// El ordenador crea live_games/{C????} y enseña un QR a /?corregir=CODIGO. El móvil lee
// las hojas con su cámara y manda solo el nº de lista y las letras; el ordenador pone
// la nota y se la devuelve para el cartel del móvil.
// La CLAVE y los NOMBRES no se escriben en la sesión (live_games es de lectura abierta).
//
// Documento live_games/{codigo}:
//   tipoJuego: 'CORRECTOR_ESCANER', codigo, createdAt
//   nPreguntas, nOpciones, modo: 'alumnos' | 'clave', titulo       (ordenador)
//   hojas: { [id]: { lista, r: 'AB-*C…', d: [dudosas], modo, t } }  (móvil)
//   notas: { [id]: { lista, nota, aciertos, fallos, blancos, ok } }  (ordenador)
//   movil: ms del último latido
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

export const TIPO_CORRECTOR = 'CORRECTOR_ESCANER';
const ref = (codigo) => doc(db, 'live_games', codigo);
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const urlCorrectorMovil = (codigo) => `${window.location.origin}/?corregir=${encodeURIComponent(codigo)}`;

/** ['A','','*'] ↔ 'A-*' (texto corto para Firestore) */
export const respuestasATexto = (resp) => resp.map((x) => x || '-').join('');
export const textoARespuestas = (txt) => String(txt || '').split('').map((c) => (c === '-' ? '' : c));

export async function crearSesionCorrector(datos) {
  for (let i = 0; i < 6; i++) {
    const codigo = 'C' + Array.from({ length: 4 }, () => ALFABETO[Math.floor(Math.random() * ALFABETO.length)]).join('');
    if ((await getDoc(ref(codigo))).exists()) continue;
    await setDoc(ref(codigo), { tipoJuego: TIPO_CORRECTOR, codigo, createdAt: serverTimestamp(), hojas: {}, notas: {}, movil: 0, modo: 'alumnos', ...datos });
    return codigo;
  }
  throw new Error('No se pudo crear la sesión');
}

export const escucharCorrector = (codigo, fn, onError) =>
  onSnapshot(ref(codigo), (s) => fn(s.exists() ? s.data() : null), (e) => onError?.(e));
export const actualizarCorrector = (codigo, datos) => updateDoc(ref(codigo), datos).catch(() => {});
export const cerrarCorrector = (codigo) => deleteDoc(ref(codigo)).catch(() => {});

/** Móvil: manda una hoja leída. Devuelve su id (para encontrar luego su nota). */
export function enviarHoja(codigo, { lista, respuestas, dudosas, modo }) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  return updateDoc(ref(codigo), {
    [`hojas.${id}`]: { lista: lista || 0, r: respuestasATexto(respuestas), d: dudosas || [], modo, t: Date.now() },
    movil: Date.now(),
  }).then(() => id);
}

export const latidoCorrector = (codigo) => updateDoc(ref(codigo), { movil: Date.now() }).catch(() => {});
