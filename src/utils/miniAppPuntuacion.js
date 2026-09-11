// Módulo «Enviar al profesor» de las mini-apps.
// La mini-app corre en un iframe sandbox (sin acceso a Firebase ni a la web principal):
// solo puede llamar a window.enviarPuntuacion({...}), que hace postMessage al padre.
// El padre valida los datos con sanitizarPuntuacion() según la configuración que
// definió el autor (y que revisa el admin al aprobar) y es él quien escribe en Firestore.

export const TIPOS_PUNTUACION = {
  aciertos: {
    label: '✓ Aciertos / intentos',
    ejemplo: 'enviarPuntuacion({ aciertos: 7, intentos: 10 })',
    instr: 'aciertos (número de respuestas correctas) e intentos (total de preguntas o intentos, mayor o igual que aciertos)',
  },
  puntos: {
    label: '⭐ Puntos',
    ejemplo: 'enviarPuntuacion({ puntos: 850 })',
    instr: 'puntos (puntuación total obtenida, un número)',
  },
  nota: {
    label: '📝 Nota de 0 a 10',
    ejemplo: 'enviarPuntuacion({ nota: 8.5 })',
    instr: 'nota (calificación numérica de 0 a 10)',
  },
  tiempo: {
    label: '⏱️ Tiempo empleado',
    ejemplo: 'enviarPuntuacion({ segundos: 95 })',
    instr: 'segundos (tiempo total empleado en completar la actividad, en segundos)',
  },
};

export const PUNTUACION_DEFAULT = { activo: false, tipo: 'aciertos', etiqueta: '', max: null };

export function normalizarConfigPuntuacion(cfg) {
  const c = cfg || {};
  const tipo = TIPOS_PUNTUACION[c.tipo] ? c.tipo : 'aciertos';
  const max = Number(c.max);
  return {
    activo:   !!c.activo,
    tipo,
    etiqueta: String(c.etiqueta || '').trim().slice(0, 30),
    max:      tipo === 'puntos' && Number.isFinite(max) && max > 0 ? max : null,
  };
}

// Texto que se añade a los prompts de IA cuando el módulo está activo
export function instruccionesPuntuacion(cfg) {
  const c = normalizarConfigPuntuacion(cfg);
  if (!c.activo) return '';
  const t = TIPOS_PUNTUACION[c.tipo];
  return `MÓDULO «ENVIAR AL PROFESOR» (OBLIGATORIO):
- Existe una función global ya disponible: enviarPuntuacion(datos). NO la declares ni la implementes, solo llámala
- Cuando el alumno termine la actividad, muestra un botón grande «📤 Enviar al profesor» que llame a enviarPuntuacion con un objeto con: ${t.instr}${c.etiqueta ? ` (lo que se mide: ${c.etiqueta})` : ''}${c.max ? ` (puntuación máxima posible: ${c.max})` : ''}
- Ejemplo: ${t.ejemplo}
- Envía solo números en esos campos; la web se encarga de pedir el nombre del alumno y el código del profesor`;
}

const num = (v, min, max) => {
  if (v === '' || v == null || typeof v === 'boolean') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, Math.round(n * 100) / 100));
};

const mmss = (s) => `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, '0')}s`;

// Valida lo que manda la mini-app. Solo acepta los campos numéricos del tipo configurado.
// Devuelve null si los datos no son válidos.
export function sanitizarPuntuacion(raw, cfg) {
  if (!raw || typeof raw !== 'object') return null;
  const c = normalizarConfigPuntuacion(cfg);
  const eti = c.etiqueta ? ` ${c.etiqueta}` : '';

  switch (c.tipo) {
    case 'aciertos': {
      const a = num(raw.aciertos, 0, 100000);
      if (a == null) return null;
      const aciertos = Math.round(a);
      let intentos = num(raw.intentos, 0, 100000);
      intentos = intentos == null ? aciertos : Math.max(aciertos, Math.round(intentos));
      const porcentaje = intentos > 0 ? Math.round((aciertos / intentos) * 100) : 0;
      return { aciertos, intentos, porcentaje, resumen: `${aciertos}/${intentos}${eti || ' aciertos'}` };
    }
    case 'puntos': {
      const puntos = num(raw.puntos, -1000000, 1000000);
      if (puntos == null) return null;
      const porcentaje = c.max ? Math.round(Math.min(100, Math.max(0, (puntos / c.max) * 100))) : null;
      return { puntos, max: c.max, porcentaje, resumen: `${puntos}${c.max ? ` / ${c.max}` : ''}${eti || ' puntos'}` };
    }
    case 'nota': {
      const nota = num(raw.nota, 0, 10);
      if (nota == null) return null;
      return { nota, porcentaje: Math.round(nota * 10), resumen: `Nota ${nota}/10${eti ? ` ·${eti}` : ''}` };
    }
    case 'tiempo': {
      const s = num(raw.segundos, 0, 86400);
      if (s == null) return null;
      const segundos = Math.round(s);
      return { segundos, porcentaje: null, resumen: `⏱️ ${mmss(segundos)}${eti ? ` ·${eti}` : ''}` };
    }
    default:
      return null;
  }
}
