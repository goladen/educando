import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Mismas capas que el selector de ubicación de TopoClimbing
export const CAPAS = {
    callejero: { label: 'Mapa', emoji: '🗺️', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap', maxZoom: 19, maxNativeZoom: 19 },
    satelite: { label: 'Satélite', emoji: '🛰️', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles © Esri', maxZoom: 21, maxNativeZoom: 19 },
    topo: { label: 'Topo', emoji: '⛰️', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap, © OpenTopoMap', maxZoom: 19, maxNativeZoom: 17 },
};

export const MAGENTA = '#c026d3';

const iconoBaliza = (num, { encontrada, activa, grande } = {}) => {
    const s = grande ? 34 : 28;
    const color = encontrada ? '#16a34a' : MAGENTA;
    const html = `<div style="position:relative;width:${s}px;height:${s}px">
        <svg width="${s}" height="${s}" viewBox="0 0 28 28" style="overflow:visible">
          ${activa ? `<circle cx="14" cy="14" r="17" fill="none" stroke="#facc15" stroke-width="3" opacity=".9"/>` : ''}
          <circle cx="14" cy="14" r="11" fill="${encontrada ? 'rgba(22,163,74,.35)' : 'rgba(255,255,255,.15)'}" stroke="${color}" stroke-width="3"/>
          <circle cx="14" cy="14" r="1.6" fill="${color}"/>
        </svg>
        <span style="position:absolute;left:${s - 2}px;top:-10px;font:900 ${grande ? 17 : 15}px 'Segoe UI',sans-serif;color:${color};
          text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff;white-space:nowrap">${num}${encontrada ? ' ✓' : ''}</span></div>`;
    return L.divIcon({ html, className: 'orient-icono', iconSize: [s, s], iconAnchor: [s / 2, s / 2] });
};

const iconoSalida = (meta) => L.divIcon({
    className: 'orient-icono', iconSize: [34, 34], iconAnchor: [17, 19],
    html: `<svg width="34" height="34" viewBox="0 0 34 34" style="overflow:visible">
        <polygon points="17,3 31,28 3,28" fill="rgba(255,255,255,.15)" stroke="${MAGENTA}" stroke-width="3" stroke-linejoin="round"/>
        ${meta ? `<circle cx="17" cy="19" r="15" fill="none" stroke="${MAGENTA}" stroke-width="2.5"/><circle cx="17" cy="19" r="11" fill="none" stroke="${MAGENTA}" stroke-width="2.5"/>` : ''}
      </svg>`,
});

const iconoYo = () => L.divIcon({
    className: 'orient-icono', iconSize: [20, 20], iconAnchor: [10, 10],
    html: `<div style="width:20px;height:20px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 2px #2563eb,0 2px 8px rgba(0,0,0,.4)"></div>`,
});

const NorteControl = L.Control.extend({
    options: { position: 'topright' },
    onAdd() {
        const d = L.DomUtil.create('div');
        d.innerHTML = `<svg width="38" height="50" viewBox="0 0 38 50" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))">
          <rect x="1" y="1" width="36" height="48" rx="8" fill="rgba(255,255,255,.9)"/>
          <polygon points="19,8 27,36 19,30 11,36" fill="#111"/>
          <text x="19" y="47" text-anchor="middle" font-size="11" font-weight="900" font-family="Segoe UI,sans-serif">N</text></svg>`;
        return d;
    },
});

/**
 * Mapa Leaflet de la carrera.
 *  carrera: { salida, balizas[], config:{ metaEnSalida } }
 *  verBalizas / verLineas / verSalida: qué se dibuja
 *  editable: arrastrar marcadores (onMoverBaliza(i,lat,lng), onMoverSalida(lat,lng)) y clic (onClickMapa)
 *  encontradas: Set de ids de baliza ya encontradas · activa: id de la baliza actual
 *  posicion: { lat, lng, precision } del jugador
 *  estatico: sin controles ni interacción (impresión)
 */
export default function MapaOrientacion({
    carrera, capa = 'callejero', verBalizas = true, verLineas = false, verSalida = true,
    editable = false, onClickMapa, onMoverBaliza, onMoverSalida, onClickBaliza,
    encontradas, activa, posicion, seguirPosicion = false, estatico = false,
    alto = 380, ancho = '100%', ajustarKey, centroInicial, onMapa, grande = false,
}) {
    const divRef = useRef(null);
    const mapRef = useRef(null);
    const tileRef = useRef(null);
    const capaMarcas = useRef(null);
    const yoRef = useRef(null);
    const cbs = useRef({});
    cbs.current = { onClickMapa, onMoverBaliza, onMoverSalida, onClickBaliza };

    // Crear el mapa una vez
    useEffect(() => {
        const map = L.map(divRef.current, {
            zoomControl: !estatico, attributionControl: true, dragging: !estatico, scrollWheelZoom: !estatico,
            doubleClickZoom: !estatico, touchZoom: !estatico, boxZoom: !estatico, keyboard: !estatico,
            zoomSnap: estatico ? 0.25 : 1, maxZoom: 21,
        }).setView(centroInicial || [40.416, -3.703], centroInicial ? 17 : 6);
        L.control.scale({ imperial: false, maxWidth: 160, position: 'bottomleft' }).addTo(map);
        new NorteControl().addTo(map);
        capaMarcas.current = L.layerGroup().addTo(map);
        map.on('click', (e) => cbs.current.onClickMapa?.(e.latlng.lat, e.latlng.lng));
        mapRef.current = map;
        onMapa?.(map);
        const t = setTimeout(() => map.invalidateSize(), 120);
        const ro = new ResizeObserver(() => map.invalidateSize());
        ro.observe(divRef.current);
        return () => { clearTimeout(t); ro.disconnect(); map.remove(); mapRef.current = null; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Capa base
    useEffect(() => {
        const map = mapRef.current; if (!map) return;
        const c = CAPAS[capa] || CAPAS.callejero;
        if (tileRef.current) map.removeLayer(tileRef.current);
        tileRef.current = L.tileLayer(c.url, { attribution: c.attribution, maxZoom: c.maxZoom, maxNativeZoom: c.maxNativeZoom, crossOrigin: true, subdomains: 'abc' }).addTo(map);
    }, [capa]);

    // Marcadores
    useEffect(() => {
        const g = capaMarcas.current; if (!g) return;
        g.clearLayers();
        const meta = !!carrera?.config?.metaEnSalida;
        const balizas = carrera?.balizas || [];
        if (verLineas) {
            const pts = [];
            if (carrera?.salida) pts.push([carrera.salida.lat, carrera.salida.lng]);
            balizas.forEach(b => pts.push([b.lat, b.lng]));
            if (meta && carrera?.salida) pts.push([carrera.salida.lat, carrera.salida.lng]);
            if (pts.length > 1) L.polyline(pts, { color: MAGENTA, weight: 3, opacity: 0.85, interactive: false }).addTo(g);
        }
        if (verSalida && carrera?.salida) {
            const m = L.marker([carrera.salida.lat, carrera.salida.lng], { icon: iconoSalida(meta), draggable: editable, zIndexOffset: 500 }).addTo(g);
            if (editable) m.on('dragend', (e) => { const p = e.target.getLatLng(); cbs.current.onMoverSalida?.(p.lat, p.lng); });
            if (!estatico) m.bindTooltip(meta ? 'Salida y meta' : 'Salida', { direction: 'bottom', offset: [0, 12] });
        }
        if (verBalizas) balizas.forEach((b, i) => {
            const m = L.marker([b.lat, b.lng], {
                icon: iconoBaliza(i + 1, { encontrada: encontradas?.has?.(b.id), activa: activa === b.id, grande }),
                draggable: editable, zIndexOffset: activa === b.id ? 800 : 0,
            }).addTo(g);
            if (editable) m.on('dragend', (e) => { const p = e.target.getLatLng(); cbs.current.onMoverBaliza?.(i, p.lat, p.lng); });
            m.on('click', () => cbs.current.onClickBaliza?.(i, b));
            if (!estatico && b.nombre) m.bindTooltip(`${i + 1}. ${b.nombre}`, { direction: 'top', offset: [0, -14] });
        });
    }, [carrera, verBalizas, verLineas, verSalida, editable, encontradas, activa, estatico, grande]);

    // Ajustar la vista a la carrera
    useEffect(() => {
        const map = mapRef.current; if (!map) return;
        const pts = [];
        if (carrera?.salida) pts.push([carrera.salida.lat, carrera.salida.lng]);
        if (verBalizas || editable) (carrera?.balizas || []).forEach(b => pts.push([b.lat, b.lng]));
        if (!pts.length) return;
        const t = setTimeout(() => {
            map.invalidateSize();
            if (pts.length === 1) map.setView(pts[0], 18);
            else map.fitBounds(L.latLngBounds(pts), { padding: estatico ? [46, 46] : [40, 40], maxZoom: 19 });
        }, 60);
        return () => clearTimeout(t);
    }, [ajustarKey]); // eslint-disable-line react-hooks/exhaustive-deps

    // Posición del jugador
    useEffect(() => {
        const map = mapRef.current; if (!map) return;
        if (yoRef.current) { yoRef.current.forEach(l => map.removeLayer(l)); yoRef.current = null; }
        if (!posicion) return;
        const ll = [posicion.lat, posicion.lng];
        const circ = L.circle(ll, { radius: posicion.precision || 10, color: '#2563eb', weight: 1, fillOpacity: 0.12, interactive: false }).addTo(map);
        const pto = L.marker(ll, { icon: iconoYo(), interactive: false, zIndexOffset: 1000 }).addTo(map);
        yoRef.current = [circ, pto];
        if (seguirPosicion) map.panTo(ll, { animate: true });
    }, [posicion, seguirPosicion]);

    return <div ref={divRef} style={{ width: ancho, height: alto, borderRadius: estatico ? 0 : 14, overflow: 'hidden', background: '#e5e7eb', cursor: editable ? 'crosshair' : undefined }} />;
}

/** Botonera para cambiar de capa. */
export function SelectorCapa({ capa, onCapa, compacto }) {
    return (
        <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: 10, padding: 3, gap: 2 }}>
            {Object.entries(CAPAS).map(([k, c]) => (
                <button key={k} onClick={() => onCapa(k)} style={{
                    border: 'none', borderRadius: 8, padding: compacto ? '5px 8px' : '6px 11px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem',
                    background: capa === k ? 'white' : 'transparent', color: capa === k ? '#0f172a' : '#64748b',
                    boxShadow: capa === k ? '0 1px 4px rgba(0,0,0,.12)' : 'none',
                }}>{c.emoji} {compacto ? '' : c.label}</button>
            ))}
        </div>
    );
}
