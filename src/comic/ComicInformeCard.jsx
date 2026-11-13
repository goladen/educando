import { useId, useRef, useState } from 'react';
import { Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import ComicPagina, { svgAPng } from './ComicPagina';
import { normalizarComic, vistaPagina } from './modeloComic';

// Tarjeta de un cómic enviado al profesor (informes_juegos, tipo COMIC).
// Se carga en diferido desde InformesJuegos2 para no meter el dibujo en ese chunk.

const fmtFecha = (f) => {
    try {
        const d = f?.toDate ? f.toDate() : f?.seconds ? new Date(f.seconds * 1000) : new Date(f);
        return d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
    } catch { return ''; }
};

export default function ComicInformeCard({ inf, onBorrar, borrando, borradoOk, modoSeleccion, seleccionado, onSeleccionar, onBuscarJugador }) {
    const [confirmar, setConfirmar] = useState(false);
    const [abierto, setAbierto] = useState(false);
    const [pag, setPag] = useState(0);
    const svgGrande = useRef(null);
    const pref = 'ci' + useId().replace(/[^a-zA-Z0-9]/g, '');
    const j = (inf.jugadores || [])[0] || {};
    const comic = inf.comic && (Array.isArray(inf.comic.vinetas) || Array.isArray(inf.comic.paginas)) ? normalizarComic(inf.comic) : null;
    const nPag = comic ? comic.paginas.length : 0;
    const autores = (inf.jugadores || []).map((x) => x.nombre).filter(Boolean);
    const titulo = comic?.titulo || inf.titulo || 'Cómic';

    const descargar = async () => {
        if (!svgGrande.current) return;
        try {
            const blob = await svgAPng(svgGrande.current, 2);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${nPag > 1 ? `pag${pag + 1}-` : ''}${(j.nombre || 'comic').replace(/[^a-z0-9áéíóúñ]+/gi, '-')}-${titulo.replace(/[^a-z0-9áéíóúñ]+/gi, '-')}.png`;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 4000);
        } catch { /* nada */ }
    };

    return (
        <div style={{ background: 'white', borderRadius: 13, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: seleccionado ? '2px solid #1565C0' : '1.5px solid #e8e8e8' }}>
            <div onClick={modoSeleccion ? onSeleccionar : undefined} style={{ padding: '11px 15px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', cursor: modoSeleccion ? 'pointer' : 'default' }}>
                {modoSeleccion && <input type="checkbox" checked={seleccionado} onChange={(e) => { e.stopPropagation(); onSeleccionar(); }} onClick={(e) => e.stopPropagation()} style={{ width: 17, height: 17, cursor: 'pointer', accentColor: '#1565C0' }} />}
                <span style={{ fontSize: '1.4rem' }}>💬</span>
                <div style={{ flex: 1, minWidth: 150 }}>
                    <div style={{ fontWeight: 700, color: '#2c3e50', fontSize: '0.92rem' }}>
                        Cómic<span style={{ color: '#e84393', fontWeight: 600 }}> · {titulo}</span>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#95a5a6' }}>
                        {fmtFecha(inf.fecha)}
                        {autores.length > 1 && <> · 👥 {autores.length} autores</>}
                        {autores.length <= 1 && j.nombre && <> · <span onClick={(e) => { e.stopPropagation(); onBuscarJugador?.(j.nombre); }} style={{ cursor: 'pointer', borderBottom: '1px dotted #aaa', fontWeight: 600, color: '#2c3e50' }}>{j.nombre}</span></>}
                        {j.curso && <span style={{ marginLeft: 5, color: '#aaa' }}>({j.curso})</span>}
                        {j.vinetas > 0 && <span style={{ marginLeft: 5 }}>· {j.vinetas} viñetas</span>}
                        {nPag > 1 && <span style={{ marginLeft: 5 }}>· {nPag} páginas</span>}
                        {inf.reto && <span style={{ marginLeft: 5, color: '#d35400' }}>· 🎓 {inf.reto}</span>}
                    </div>
                </div>
                {comic && !modoSeleccion && <button onClick={() => setAbierto(true)} style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid #f8c4dd', background: '#fdeef5', color: '#c2185b', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}>👁 Ver cómic</button>}
                {!modoSeleccion && <button onClick={(e) => { e.stopPropagation(); setConfirmar(true); }} style={{ padding: '4px 7px', borderRadius: 7, border: '1px solid #fdd', background: '#fdecea', color: '#e74c3c', cursor: 'pointer' }}><Trash2 size={13} /></button>}
            </div>
            {comic && (
                <div onClick={() => !modoSeleccion && setAbierto(true)} style={{ padding: '0 15px 12px', cursor: 'pointer' }}>
                    <div style={{ height: 180, background: '#f5f6fa', borderRadius: 9, overflow: 'hidden' }}><ComicPagina comic={vistaPagina(comic, 0)} idPrefijo={pref + 'p'} /></div>
                </div>
            )}
            {confirmar && (
                <div style={{ background: '#fdecea', borderTop: '1px solid #fdd', padding: '10px 15px', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.83rem' }}>
                    <AlertTriangle size={14} color="#e74c3c" />
                    <span style={{ flex: 1, color: '#c0392b' }}>¿Eliminar este cómic?</span>
                    <button onClick={() => { setConfirmar(false); onBorrar(); }} disabled={borrando} style={{ padding: '4px 12px', borderRadius: 7, border: 'none', background: '#e74c3c', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>{borrando ? 'Borrando…' : 'Eliminar'}</button>
                    <button onClick={() => setConfirmar(false)} style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontSize: '0.8rem' }}>Cancelar</button>
                </div>
            )}
            {borradoOk && <div style={{ background: '#e8f5e9', padding: '8px 15px', fontSize: '0.8rem', color: '#27ae60', display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle size={13} />Eliminado</div>}
            {abierto && comic && (
                <div onClick={() => { setAbierto(false); setPag(0); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10050, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 14, gap: 10 }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 8 }}>
                        {nPag > 1 && <>
                            <button onClick={() => setPag((p) => Math.max(0, p - 1))} disabled={pag === 0} style={{ padding: '8px 12px', borderRadius: 9, border: 'none', background: 'rgba(255,255,255,0.15)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>◀</button>
                            <span style={{ color: 'white', fontWeight: 700, alignSelf: 'center' }}>Página {pag + 1} / {nPag}</span>
                            <button onClick={() => setPag((p) => Math.min(nPag - 1, p + 1))} disabled={pag === nPag - 1} style={{ padding: '8px 12px', borderRadius: 9, border: 'none', background: 'rgba(255,255,255,0.15)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>▶</button>
                        </>}
                        <button onClick={descargar} style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: '#0984e3', color: 'white', fontWeight: 700, cursor: 'pointer' }}>🖼️ Descargar PNG</button>
                        <button onClick={() => setAbierto(false)} style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: 'rgba(255,255,255,0.15)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>✕ Cerrar</button>
                    </div>
                    <div onClick={(e) => e.stopPropagation()} style={{ flex: 1, width: '100%', maxWidth: 1000, minHeight: 0 }}>
                        <ComicPagina comic={vistaPagina(comic, pag)} svgRef={svgGrande} idPrefijo={pref + 'g' + pag} />
                    </div>
                    {autores.length > 1 && <div onClick={(e) => e.stopPropagation()} style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', textAlign: 'center', maxWidth: 900 }}>👥 {autores.join(', ')}</div>}
                </div>
            )}
        </div>
    );
}
