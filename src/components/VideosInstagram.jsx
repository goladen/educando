// Galería de vídeos de Instagram (@pikt314).
// Lee el feed que el cron diario deja cacheado en Firestore (sitio_publico/instagram_feed);
// al pulsar una tarjeta se reproduce el reel dentro de la web con el embed oficial.
//
// Uso como página completa:   <VideosInstagram onExit={...} />
// Uso como sección embebida:  <VideosInstagram limite={6} compacto />
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const CUENTA = 'pikt314';
const PERFIL = `https://www.instagram.com/${CUENTA}/`;

const urlEmbed = (permalink) => `${String(permalink).replace(/\/?$/, '/')}embed/captioned/`;

const fechaCorta = (iso) => {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
};

const tituloDe = (texto) => {
    const limpio = String(texto || '').split('\n').find(l => l.trim()) || 'Vídeo de PiKT';
    return limpio.length > 90 ? limpio.slice(0, 90) + '…' : limpio;
};

function Tarjeta({ item, onAbrir }) {
    const [falloImg, setFalloImg] = useState(false);
    return (
        <button onClick={() => onAbrir(item)} style={S.tarjeta} title={tituloDe(item.texto)}>
            <div style={S.marco}>
                {item.miniatura && !falloImg
                    ? <img src={item.miniatura} alt="" loading="lazy" referrerPolicy="no-referrer"
                           onError={() => setFalloImg(true)} style={S.img} />
                    : <div style={S.imgFallback}>📸</div>}
                <span style={S.play}>▶</span>
            </div>
            <div style={S.pie}>
                <div style={S.tituloTarjeta}>{tituloDe(item.texto)}</div>
                <div style={S.fecha}>{fechaCorta(item.fecha)}</div>
            </div>
        </button>
    );
}

function ModalVideo({ item, onCerrar }) {
    useEffect(() => {
        const esc = (e) => { if (e.key === 'Escape') onCerrar(); };
        window.addEventListener('keydown', esc);
        return () => window.removeEventListener('keydown', esc);
    }, [onCerrar]);

    return (
        <div style={S.fondoModal} onClick={onCerrar}>
            <div style={S.cajaModal} onClick={e => e.stopPropagation()}>
                <button onClick={onCerrar} style={S.cerrar}>✕</button>
                <iframe
                    src={urlEmbed(item.permalink)}
                    title={tituloDe(item.texto)}
                    style={S.iframe}
                    frameBorder="0"
                    scrolling="no"
                    allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
                    allowFullScreen
                />
                <a href={item.permalink} target="_blank" rel="noopener noreferrer" style={S.enlaceIg}>
                    Ver en Instagram ↗
                </a>
            </div>
        </div>
    );
}

export default function VideosInstagram({ onExit, limite = 24, soloVideos = true, compacto = false }) {
    const [items,   setItems]   = useState([]);
    const [estado,  setEstado]  = useState('cargando'); // cargando | listo | vacio | error
    const [abierto, setAbierto] = useState(null);

    useEffect(() => {
        let vivo = true;
        (async () => {
            try {
                const snap = await getDoc(doc(db, 'sitio_publico', 'instagram_feed'));
                if (!vivo) return;
                const datos = snap.exists() ? snap.data() : null;
                const lista = (datos?.items || [])
                    .filter(i => !soloVideos || i.tipo === 'VIDEO')
                    .slice(0, limite);
                setItems(lista);
                setEstado(lista.length ? 'listo' : 'vacio');
            } catch {
                if (vivo) setEstado('error');
            }
        })();
        return () => { vivo = false; };
    }, [limite, soloVideos]);

    const cuerpo = (
        <>
            <div style={S.cabecera}>
                <div>
                    <h2 style={S.h2}>{compacto ? 'Vídeos de PiKT' : '📸 Vídeos de PiKT en Instagram'}</h2>
                    <p style={S.sub}>Trucos, juegos nuevos y novedades · @{CUENTA}</p>
                </div>
                <a href={PERFIL} target="_blank" rel="noopener noreferrer" style={S.btnSeguir}>Seguir</a>
            </div>

            {estado === 'cargando' && <div style={S.aviso}>Cargando vídeos…</div>}
            {estado === 'error' && (
                <div style={S.aviso}>No se han podido cargar los vídeos.{' '}
                    <a href={PERFIL} target="_blank" rel="noopener noreferrer" style={S.enlaceSimple}>Míralos en Instagram ↗</a>
                </div>
            )}
            {estado === 'vacio' && (
                <div style={S.aviso}>Todavía no hay vídeos sincronizados.{' '}
                    <a href={PERFIL} target="_blank" rel="noopener noreferrer" style={S.enlaceSimple}>Ver el perfil ↗</a>
                </div>
            )}

            {estado === 'listo' && (
                <div style={S.rejilla}>
                    {items.map(i => <Tarjeta key={i.id} item={i} onAbrir={setAbierto} />)}
                </div>
            )}

            {abierto && <ModalVideo item={abierto} onCerrar={() => setAbierto(null)} />}
        </>
    );

    if (compacto) return <section style={S.seccion}>{cuerpo}</section>;

    return (
        <div style={S.pagina}>
            {onExit && <button onClick={onExit} style={S.volver}>← Volver</button>}
            <div style={S.contenedor}>{cuerpo}</div>
        </div>
    );
}

const S = {
    pagina:      { minHeight: '100vh', background: 'linear-gradient(160deg,#0f172a 0%,#1e1b4b 100%)', padding: '56px 16px 40px' },
    contenedor:  { maxWidth: 1100, margin: '0 auto' },
    seccion:     { maxWidth: 1100, margin: '0 auto', padding: '24px 12px' },
    volver:      { position: 'fixed', top: 12, left: 12, zIndex: 20, padding: '8px 14px', borderRadius: 10, border: 'none', background: '#fff', color: '#334155', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.2)' },
    cabecera:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 },
    h2:          { margin: 0, color: '#fff', fontSize: 'clamp(20px,3vw,28px)', fontWeight: 800 },
    sub:         { margin: '4px 0 0', color: '#cbd5e1', fontSize: 14 },
    btnSeguir:   { padding: '9px 18px', borderRadius: 999, background: 'linear-gradient(45deg,#f09433,#dc2743,#bc1888)', color: '#fff', fontWeight: 700, textDecoration: 'none', fontSize: 14 },
    rejilla:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 14 },
    tarjeta:     { display: 'block', padding: 0, border: 'none', borderRadius: 14, overflow: 'hidden', background: '#1e293b', cursor: 'pointer', textAlign: 'left', boxShadow: '0 4px 14px rgba(0,0,0,.25)' },
    marco:       { position: 'relative', aspectRatio: '9 / 16', background: '#334155' },
    img:         { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
    imgFallback: { width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 34, background: 'linear-gradient(45deg,#f09433,#bc1888)' },
    play:        { position: 'absolute', inset: 0, margin: 'auto', width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,0,0,.55)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 18, pointerEvents: 'none' },
    pie:         { padding: '9px 10px 11px' },
    tituloTarjeta: { color: '#e2e8f0', fontSize: 13, fontWeight: 600, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
    fecha:       { color: '#94a3b8', fontSize: 11, marginTop: 5 },
    aviso:       { color: '#cbd5e1', background: 'rgba(255,255,255,.06)', padding: '16px 18px', borderRadius: 12, fontSize: 14 },
    enlaceSimple:{ color: '#fbbf24', fontWeight: 700 },
    fondoModal:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)', display: 'grid', placeItems: 'center', zIndex: 10000, padding: 12 },
    cajaModal:   { position: 'relative', width: 'min(420px,94vw)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', gap: 8 },
    cerrar:      { position: 'absolute', top: -38, right: 0, width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#fff', color: '#334155', fontWeight: 800, cursor: 'pointer' },
    iframe:      { width: '100%', height: 'min(78vh,720px)', background: '#fff', borderRadius: 12, border: 'none' },
    enlaceIg:    { color: '#fff', textAlign: 'center', fontSize: 13, textDecoration: 'none', opacity: .9 },
};
