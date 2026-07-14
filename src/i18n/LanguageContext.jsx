// Contexto global de idioma + traducción bajo demanda con caché.
//
// Uso:
//   import { useT } from './i18n/LanguageContext';
//   const t = useT();
//   <button>{t('Guardar')}</button>
//
// o con el componente:
//   import { T } from './i18n/LanguageContext';
//   <T>Guardar</T>
//
// El texto ORIGINAL siempre se escribe en español. Si el idioma activo es
// español no se hace ninguna llamada; en otro idioma se pide la traducción a
// Gemini (por lotes) y se cachea en memoria + localStorage para no repetirla.
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { IDIOMA_ORIGEN, IDIOMAS, traducirLote } from './translateGemini.js';

const LS_IDIOMA = 'pikt_idioma';
const LS_CACHE = 'pikt_i18n_cache_v2';
const LanguageContext = createContext(null);

function leerCache() {
    try { return JSON.parse(localStorage.getItem(LS_CACHE) || '{}'); }
    catch { return {}; }
}

export function LanguageProvider({ children }) {
    const [idioma, setIdiomaState] = useState(() => {
        const guardado = localStorage.getItem(LS_IDIOMA);
        return guardado && IDIOMAS[guardado] ? guardado : IDIOMA_ORIGEN;
    });

    // Caché completa: { "en:Guardar": "Save", ... }. Vive en estado para forzar
    // re-render cuando llegan traducciones nuevas.
    const [cache, setCache] = useState(leerCache);

    // Cola de textos pendientes de traducir (Set para deduplicar) + debounce.
    const pendientes = useRef(new Set());
    const timer = useRef(null);

    const setIdioma = useCallback((nuevo) => {
        if (!IDIOMAS[nuevo]) return;
        localStorage.setItem(LS_IDIOMA, nuevo);
        setIdiomaState(nuevo);
    }, []);

    const flush = useCallback(async () => {
        const idiomaActual = localStorage.getItem(LS_IDIOMA) || IDIOMA_ORIGEN;
        if (idiomaActual === IDIOMA_ORIGEN) { pendientes.current.clear(); return; }

        const textos = Array.from(pendientes.current);
        pendientes.current.clear();
        if (!textos.length) return;

        let traducciones;
        try {
            traducciones = await traducirLote(textos, idiomaActual);
        } catch (err) {
            // Fallo (p.ej. /api/gemini caído): NO cacheamos nada para poder
            // reintentar más tarde. t() seguirá mostrando el original.
            console.warn(err?.message || err);
            return;
        }
        setCache((prev) => {
            const siguiente = { ...prev };
            textos.forEach((original, i) => {
                siguiente[`${idiomaActual}:${original}`] = traducciones[i];
            });
            try { localStorage.setItem(LS_CACHE, JSON.stringify(siguiente)); } catch { /* cuota llena */ }
            return siguiente;
        });
    }, []);

    const encolar = useCallback((texto) => {
        pendientes.current.add(texto);
        clearTimeout(timer.current);
        timer.current = setTimeout(flush, 250); // agrupa los textos de un render
    }, [flush]);

    // t(texto): devuelve la traducción si existe; si no, encola y devuelve el
    // original como fallback mientras llega.
    const t = useCallback((texto) => {
        if (idioma === IDIOMA_ORIGEN || typeof texto !== 'string' || !texto.trim()) return texto;
        const key = `${idioma}:${texto}`;
        if (key in cache) return cache[key];
        encolar(texto);
        return texto;
    }, [idioma, cache, encolar]);

    useEffect(() => () => clearTimeout(timer.current), []);

    return (
        <LanguageContext.Provider value={{ idioma, setIdioma, t, idiomas: IDIOMAS }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error('useLanguage debe usarse dentro de <LanguageProvider>');
    return ctx;
}

// Hook cómodo: const t = useT();
export function useT() {
    return useLanguage().t;
}

// Componente: <T>Texto en español</T>. Los hijos deben ser una cadena.
export function T({ children }) {
    const t = useT();
    return typeof children === 'string' ? t(children) : children;
}
