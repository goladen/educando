// Sesión «📱 móvil como cámara» del Corrector, al nivel de CorrectorExamenes para que
// siga recibiendo hojas aunque el profe esté mirando la tabla de resultados.
import { useCallback, useEffect, useRef, useState } from 'react';
import { crearSesionCorrector, escucharCorrector, actualizarCorrector, cerrarCorrector, textoARespuestas } from './escanerCorrector.js';
import { puntuar } from './omr.js';
import { estadosEscritas, textosLeidos } from './escritas.js';

export default function useSesionMovil({ cfg, clave, modo, onHoja, onClave }) {
  const [codigo, setCodigo] = useState('');
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');
  const [conectado, setConectado] = useState(false);
  const [recibidas, setRecibidas] = useState([]); // últimas hojas: { id, lista, nota, aciertos, fallos, blancos, clave? }

  const vistas = useRef(new Set());
  const latido = useRef({ valor: null, en: 0 });
  const datos = useRef({ cfg, clave, onHoja, onClave });
  datos.current = { cfg, clave, onHoja, onClave };

  const crear = useCallback(async () => {
    if (codigo || creando) return;
    setCreando(true);
    setError('');
    try {
      setCodigo(await crearSesionCorrector({ nPreguntas: cfg.nPreguntas, nOpciones: cfg.nOpciones, nEscritas: cfg.nEscritas || 0, letras: cfg.letras || 8, modo }));
    } catch {
      setError('No se pudo crear la sesión. ¿Hay conexión a internet?');
    }
    setCreando(false);
  }, [codigo, creando, cfg.nPreguntas, cfg.nOpciones, modo]);

  // Hojas que llegan del móvil → se corrigen aquí y se le devuelve la nota
  useEffect(() => {
    if (!codigo) return undefined;
    const quitar = escucharCorrector(codigo, (d) => {
      if (!d) return;
      if (d.movil && d.movil !== latido.current.valor) latido.current = { valor: d.movil, en: Date.now() };
      const nuevas = Object.entries(d.hojas || {}).filter(([id]) => !vistas.current.has(id)).sort((a, b) => (a[1].t || 0) - (b[1].t || 0));
      if (!nuevas.length) return;
      const { cfg: c, clave: k, onHoja: alHoja, onClave: alClave } = datos.current;
      const notas = {};
      for (const [id, h] of nuevas) {
        vistas.current.add(id);
        const respuestas = textoARespuestas(h.r).slice(0, c.nPreguntas);
        const escritas = (Array.isArray(h.e) ? h.e : []).map((c) => ({ c: String(c || ''), img: null }));
        if (h.modo === 'clave') {
          alClave(respuestas.map((x) => (x === '*' ? '' : x)), escritas.length ? textosLeidos(escritas) : null);
          setRecibidas((p) => [{ id, clave: true }, ...p].slice(0, 8));
          continue;
        }
        if (!h.lista) continue;
        const r = { lista: h.lista, respuestas, dudosas: Array.isArray(h.d) ? h.d : [], escritas };
        alHoja(r);
        const p = puntuar(respuestas, k, { penalizacion: c.penalizacion, escritas: estadosEscritas(r, c) });
        const resumen = { lista: h.lista, nota: p.nota, aciertos: p.aciertos, fallos: p.fallos, blancos: p.blancos, pendientes: p.pendientes };
        notas[`notas.${id}`] = resumen;
        setRecibidas((prev) => [{ id, ...resumen, dudosas: r.dudosas }, ...prev].slice(0, 8));
      }
      if (Object.keys(notas).length) actualizarCorrector(codigo, notas);
    });
    const t = setInterval(() => setConectado(Date.now() - latido.current.en < 15000), 2000);
    return () => { quitar(); clearInterval(t); };
  }, [codigo]);

  // El móvil necesita saber cuántas preguntas/opciones leer y si está leyendo la clave
  useEffect(() => {
    if (codigo) actualizarCorrector(codigo, { nPreguntas: cfg.nPreguntas, nOpciones: cfg.nOpciones, nEscritas: cfg.nEscritas || 0, letras: cfg.letras || 8, modo });
  }, [codigo, cfg.nPreguntas, cfg.nOpciones, cfg.nEscritas, cfg.letras, modo]);

  // Al cerrar el Corrector se borra la sesión
  const codigoRef = useRef('');
  codigoRef.current = codigo;
  useEffect(() => () => { if (codigoRef.current) cerrarCorrector(codigoRef.current); }, []);

  return { codigo, creando, error, conectado, recibidas, crear };
}
