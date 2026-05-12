import { useState, useRef, useEffect, useCallback } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';

// GeoJSON with geo.properties.name for each country
const GEO_URL = 'https://cdn.jsdelivr.net/gh/holtzy/D3-graph-gallery@master/DATA/world.geojson';

const MODOS = [
    { id: 'mapa_pais',       icon: '🗺️', label: 'Mapa País' },
    { id: 'mapa_continente', icon: '🌍', label: 'Continente' },
    { id: 'bandera',         icon: '🚩', label: 'Bandera' },
    { id: 'info',            icon: 'ℹ️',  label: 'Información' },
];

// Continent view configs [label, center [lon,lat], scale, filter keywords]
const CONTINENTES = [
    { label: 'África',            center: [20,  0],  scale: 280, keys: ['africa','áfrica'] },
    { label: 'Asia',              center: [90, 35],  scale: 260, keys: ['asia'] },
    { label: 'Europa',            center: [15, 55],  scale: 600, keys: ['europa','europe'] },
    { label: 'América del Norte', center: [-100,45], scale: 300, keys: ['norte','north','norteamérica'] },
    { label: 'América del Sur',   center: [-60,-15], scale: 350, keys: ['sur','south','sudamérica'] },
    { label: 'Oceanía',           center: [140,-25], scale: 350, keys: ['oceania','oceanía'] },
    { label: 'Antártida',         center: [0,  -70], scale: 260, keys: ['antartida','antártida','antarctica'] },
];

const REST = 'https://restcountries.com/v3.1';

// Convert SVG element to PNG dataURL
async function svgToDataURL(svgEl, w = 600, h = 380) {
    const clone = svgEl.cloneNode(true);
    clone.setAttribute('width', w);
    clone.setAttribute('height', h);
    const svgStr = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#f0f4f8';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/png'));
            URL.revokeObjectURL(url);
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
    });
}

// Render country info to canvas PNG
function infoToDataURL(pais) {
    const canvas = document.createElement('canvas');
    canvas.width = 520; canvas.height = 340;
    const ctx = canvas.getContext('2d');
    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#e8f4fd'); grad.addColorStop(1, '#dbeafe');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Border
    ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    // Flag emoji placeholder rect
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(20, 20, 4, 50);
    // Title
    ctx.fillStyle = '#1e3a5f'; ctx.font = 'bold 26px Arial';
    ctx.fillText(pais.name?.common || '—', 34, 54);
    // Divider
    ctx.strokeStyle = '#93c5fd'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(20, 68); ctx.lineTo(500, 68); ctx.stroke();
    // Data rows
    ctx.font = '17px Arial';
    const rows = [
        ['🏙️ Capital',      (pais.capital || []).join(', ') || '—'],
        ['🌎 Región',        pais.region || '—'],
        ['👥 Población',     (pais.population || 0).toLocaleString('es-ES')],
        ['📐 Superficie',    `${(pais.area || 0).toLocaleString('es-ES')} km²`],
        ['🗣️ Idiomas',       Object.values(pais.languages || {}).join(', ') || '—'],
        ['💰 Moneda',        Object.values(pais.currencies || {}).map(c => c.name).join(', ') || '—'],
    ];
    rows.forEach(([key, val], i) => {
        const y = 100 + i * 38;
        ctx.fillStyle = '#64748b'; ctx.font = 'bold 15px Arial';
        ctx.fillText(key, 20, y);
        ctx.fillStyle = '#1e293b'; ctx.font = '17px Arial';
        ctx.fillText(String(val).slice(0, 52), 160, y);
    });
    return canvas.toDataURL('image/png');
}

export default function GeografiaPanel({ onPegarEnPizarra, onClose }) {
    const [modo, setModo]           = useState('mapa_pais');
    const [busqueda, setBusqueda]   = useState('');
    const [paisData, setPaisData]   = useState(null);
    const [cargando, setCargando]   = useState(false);
    const [error, setError]         = useState('');
    const [continente, setContinente] = useState(null); // objeto CONTINENTES
    const [proyeccion, setProyeccion] = useState({ center: [0, 20], scale: 140 });
    const [paisNombre, setPaisNombre] = useState('');   // english name matched in geo
    const mapContainerRef           = useRef(null);

    // Drag state
    const [pos, setPos] = useState({ x: 80, y: 60 });
    const dragRef = useRef(null);
    const onDragStart = (e) => {
        dragRef.current = { startX: e.clientX - pos.x, startY: e.clientY - pos.y };
    };
    const onDragMove = useCallback((e) => {
        if (!dragRef.current) return;
        setPos({ x: e.clientX - dragRef.current.startX, y: e.clientY - dragRef.current.startY });
    }, []);
    const onDragEnd = () => { dragRef.current = null; };
    useEffect(() => {
        window.addEventListener('mousemove', onDragMove);
        window.addEventListener('mouseup', onDragEnd);
        return () => { window.removeEventListener('mousemove', onDragMove); window.removeEventListener('mouseup', onDragEnd); };
    }, [onDragMove]);

    // Fetch REST Countries
    const buscarPais = async () => {
        if (!busqueda.trim()) return;
        setCargando(true); setError(''); setPaisData(null); setPaisNombre('');
        try {
            const fields = 'name,flags,capital,region,population,area,languages,currencies,cca2,latlng';
            const res = await fetch(`${REST}/name/${encodeURIComponent(busqueda.trim())}?fields=${fields}`);
            if (!res.ok) throw new Error('País no encontrado');
            const data = await res.json();
            const p = data[0];
            setPaisData(p);
            setPaisNombre(p.name?.common || '');
            // Update map projection to center on country
            if (p.latlng?.length === 2) {
                const [lat, lon] = p.latlng;
                setProyeccion({ center: [lon, lat], scale: 600 });
            }
        } catch (e) {
            setError('País no encontrado. Prueba en inglés (Spain, France...)');
        }
        setCargando(false);
    };

    const buscarContinente = (c) => {
        setContinente(c);
        setProyeccion({ center: c.center, scale: c.scale });
        setError('');
    };

    // Add map SVG to pizarra
    const pegarMapa = async () => {
        const svgEl = mapContainerRef.current?.querySelector('svg');
        if (!svgEl) return;
        const dataURL = await svgToDataURL(svgEl, 600, 380);
        if (dataURL) onPegarEnPizarra(dataURL, 600, 380);
    };

    // Add flag image to pizarra
    const pegarBandera = () => {
        if (!paisData?.flags?.png) return;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const maxW = 420;
            const w = Math.min(img.naturalWidth, maxW);
            const h = Math.round(img.naturalHeight * w / img.naturalWidth);
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            onPegarEnPizarra(canvas.toDataURL('image/png'), w, h);
        };
        img.src = paisData.flags.png;
    };

    // Add info card to pizarra
    const pegarInfo = () => {
        if (!paisData) return;
        onPegarEnPizarra(infoToDataURL(paisData), 520, 340);
    };

    const renderMapSection = (esContinente = false) => (
        <div>
            {esContinente ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {CONTINENTES.map(c => (
                        <button key={c.label} onClick={() => buscarContinente(c)}
                            style={{ padding: '5px 10px', borderRadius: 20, border: '1px solid #93c5fd',
                                background: continente?.label === c.label ? '#2563eb' : '#eff6ff',
                                color: continente?.label === c.label ? '#fff' : '#1e40af',
                                cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                            {c.label}
                        </button>
                    ))}
                </div>
            ) : (
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    <input
                        value={busqueda} onChange={e => setBusqueda(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && buscarPais()}
                        placeholder="Nombre del país (ej: Spain, France...)"
                        style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid #93c5fd', fontSize: '0.85rem', outline: 'none' }}
                    />
                    <button onClick={buscarPais} style={{ padding: '7px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
                        {cargando ? '...' : '🔍'}
                    </button>
                </div>
            )}
            {error && <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: '4px 0 8px' }}>{error}</p>}
            <div ref={mapContainerRef} style={{ borderRadius: 8, overflow: 'hidden', background: '#dbeafe', border: '1px solid #93c5fd' }}>
                <ComposableMap
                    projection="geoMercator"
                    projectionConfig={{ center: proyeccion.center, scale: proyeccion.scale }}
                    style={{ width: '100%', height: 260 }}
                >
                    <Geographies geography={GEO_URL}>
                        {({ geographies }) => geographies.map(geo => {
                            const name = geo.properties?.name || '';
                            const isSelected = !esContinente && paisNombre &&
                                name.toLowerCase().includes(paisNombre.toLowerCase().split(' ')[0]);
                            return (
                                <Geography
                                    key={geo.rsmKey}
                                    geography={geo}
                                    fill={isSelected ? '#2563eb' : '#c7d2fe'}
                                    stroke="#fff"
                                    strokeWidth={0.5}
                                    style={{ default: { outline: 'none' }, hover: { outline: 'none', fill: isSelected ? '#1d4ed8' : '#a5b4fc' }, pressed: { outline: 'none' } }}
                                />
                            );
                        })}
                    </Geographies>
                </ComposableMap>
            </div>
            {(paisNombre || continente) && (
                <button onClick={pegarMapa}
                    style={{ marginTop: 10, width: '100%', padding: '8px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
                    📌 Añadir a la Pizarra
                </button>
            )}
        </div>
    );

    const renderBanderaSection = () => (
        <div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <input
                    value={busqueda} onChange={e => setBusqueda(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && buscarPais()}
                    placeholder="Nombre del país (ej: Spain, France...)"
                    style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid #93c5fd', fontSize: '0.85rem', outline: 'none' }}
                />
                <button onClick={buscarPais} style={{ padding: '7px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
                    {cargando ? '...' : '🔍'}
                </button>
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: '4px 0 8px' }}>{error}</p>}
            {paisData?.flags && (
                <div>
                    <div style={{ textAlign: 'center', marginBottom: 10 }}>
                        <img src={paisData.flags.svg || paisData.flags.png} alt="Bandera"
                            style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }} />
                        <p style={{ margin: '8px 0 0', fontWeight: 700, color: '#1e3a5f' }}>{paisData.name?.common}</p>
                        {paisData.flags.alt && <p style={{ margin: '2px 0', fontSize: '0.75rem', color: '#64748b' }}>{paisData.flags.alt}</p>}
                    </div>
                    <button onClick={pegarBandera}
                        style={{ width: '100%', padding: '8px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
                        📌 Añadir a la Pizarra
                    </button>
                </div>
            )}
        </div>
    );

    const renderInfoSection = () => (
        <div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <input
                    value={busqueda} onChange={e => setBusqueda(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && buscarPais()}
                    placeholder="Nombre del país (ej: Spain, France...)"
                    style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid #93c5fd', fontSize: '0.85rem', outline: 'none' }}
                />
                <button onClick={buscarPais} style={{ padding: '7px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
                    {cargando ? '...' : '🔍'}
                </button>
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: '4px 0 8px' }}>{error}</p>}
            {paisData && (
                <div style={{ background: '#eff6ff', borderRadius: 10, padding: 12, border: '1px solid #93c5fd' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        {paisData.flags?.svg && <img src={paisData.flags.svg} alt="" style={{ height: 28, borderRadius: 3, boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />}
                        <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1e3a5f' }}>{paisData.name?.common}</span>
                    </div>
                    {[
                        ['🏙️ Capital',      (paisData.capital || []).join(', ') || '—'],
                        ['🌎 Región',        paisData.region || '—'],
                        ['👥 Población',     (paisData.population || 0).toLocaleString('es-ES')],
                        ['📐 Superficie',    `${(paisData.area || 0).toLocaleString('es-ES')} km²`],
                        ['🗣️ Idiomas',       Object.values(paisData.languages || {}).join(', ') || '—'],
                        ['💰 Moneda',        Object.values(paisData.currencies || {}).map(c => c.name).join(', ') || '—'],
                    ].map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
                            <span style={{ color: '#64748b', fontSize: '0.82rem', minWidth: 100 }}>{k}</span>
                            <span style={{ color: '#1e293b', fontSize: '0.85rem', fontWeight: 600 }}>{String(v).slice(0, 55)}</span>
                        </div>
                    ))}
                    <button onClick={pegarInfo}
                        style={{ marginTop: 8, width: '100%', padding: '8px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
                        📌 Añadir a la Pizarra
                    </button>
                </div>
            )}
        </div>
    );

    return (
        <div style={{
            position: 'fixed', left: pos.x, top: pos.y, width: 380, zIndex: 500,
            background: 'white', borderRadius: 14, boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
            overflow: 'hidden', userSelect: 'none',
        }}>
            {/* Header (draggable) */}
            <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', background: '#1e3a5f', cursor: 'grab' }}
                onMouseDown={onDragStart}
            >
                <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem' }}>🌍 Geografía</span>
                <button onClick={onClose}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>

            {/* Mode tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
                {MODOS.map(m => (
                    <button key={m.id} onClick={() => { setModo(m.id); setBusqueda(''); setPaisData(null); setError(''); setPaisNombre(''); setContinente(null); setProyeccion({ center: [0, 20], scale: 140 }); }}
                        style={{ flex: 1, padding: '8px 4px', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700,
                            background: modo === m.id ? '#eff6ff' : 'white',
                            color: modo === m.id ? '#2563eb' : '#64748b',
                            borderBottom: modo === m.id ? '2px solid #2563eb' : '2px solid transparent' }}>
                        <div style={{ fontSize: 18 }}>{m.icon}</div>
                        {m.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div style={{ padding: 14, maxHeight: 420, overflowY: 'auto' }}>
                {modo === 'mapa_pais'       && renderMapSection(false)}
                {modo === 'mapa_continente' && renderMapSection(true)}
                {modo === 'bandera'         && renderBanderaSection()}
                {modo === 'info'            && renderInfoSection()}
            </div>
        </div>
    );
}
