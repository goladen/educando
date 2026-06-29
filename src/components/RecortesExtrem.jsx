import React, { useState, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// ──────────────────────────────────────────────────────────────────────────────
// Recortes Extrem — Multi-recorte de imágenes y PDF
// Carga una imagen o PDF, dibuja varios recuadros a la vez (ratón o táctil) y
// genera de golpe una matriz de imágenes recortadas que se pueden descargar.
// ──────────────────────────────────────────────────────────────────────────────

export default function RecortesExtrem() {
    const [imageSrc, setImageSrc]     = useState(null);   // dataURL de la imagen / página de PDF renderizada
    const [boxes, setBoxes]           = useState([]);      // { id, x, y, w, h, name }  (en px de pantalla)
    const [isDrawing, setIsDrawing]   = useState(false);
    const [currentBox, setCurrentBox] = useState(null);
    const [shape, setShape]           = useState('rect'); // 'rect' | 'oval' | 'free'
    const [crops, setCrops]           = useState([]);      // { id, name, dataURL, ext }
    const [loading, setLoading]       = useState(false);

    // Estado del PDF
    const [pdfDoc, setPdfDoc]   = useState(null);
    const [pdfPage, setPdfPage] = useState(1);
    const [pdfPages, setPdfPages] = useState(0);
    const [urlInput, setUrlInput] = useState('');

    const containerRef = useRef(null);
    const imgRef       = useRef(null);

    // ── Carga de archivo ──────────────────────────────────────────────────────
    const resetAll = () => { setBoxes([]); setCurrentBox(null); setIsDrawing(false); setCrops([]); };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        resetAll();
        setPdfDoc(null); setPdfPages(0); setPdfPage(1);

        if (file.type === 'application/pdf') {
            setLoading(true);
            try {
                const buf = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
                setPdfDoc(pdf);
                setPdfPages(pdf.numPages);
                await renderPdfPage(pdf, 1);
            } catch (err) {
                alert('No se pudo abrir el PDF: ' + err.message);
            } finally {
                setLoading(false);
            }
        } else if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = () => setImageSrc(reader.result);
            reader.readAsDataURL(file);
        } else {
            alert('Formato no soportado. Sube una imagen o un PDF.');
        }
    };

    // Carga una imagen o PDF desde una URL de la web
    const handleLoadUrl = async () => {
        const url = urlInput.trim();
        if (!url) return;
        resetAll();
        setPdfDoc(null); setPdfPages(0); setPdfPage(1);
        const esPdf = /\.pdf(\?|#|$)/i.test(url);
        setLoading(true);
        try {
            if (esPdf) {
                const pdf = await pdfjsLib.getDocument({ url }).promise;
                setPdfDoc(pdf);
                setPdfPages(pdf.numPages);
                await renderPdfPage(pdf, 1);
            } else {
                // Para que el canvas no quede "contaminado" al recortar, intentamos CORS
                const img = new Image();
                img.crossOrigin = 'anonymous';
                await new Promise((res, rej) => {
                    img.onload = res;
                    img.onerror = () => rej(new Error('No se pudo cargar la imagen (¿bloqueo CORS del servidor?).'));
                    img.src = url;
                });
                setImageSrc(url);
            }
        } catch (err) {
            alert('No se pudo cargar desde la web: ' + err.message + '\nDescarga el archivo y súbelo desde el ordenador.');
        } finally {
            setLoading(false);
        }
    };

    // Renderiza una página de PDF a un canvas y la convierte en imagen de fondo
    const renderPdfPage = async (pdf, pageNum) => {
        const page = await pdf.getPage(pageNum);
        const scale = 2; // alta resolución para recortes nítidos
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        setImageSrc(canvas.toDataURL('image/png'));
    };

    const cambiarPagina = async (delta) => {
        if (!pdfDoc) return;
        const next = Math.min(Math.max(pdfPage + delta, 1), pdfPages);
        if (next === pdfPage) return;
        setLoading(true);
        // Antes de cambiar de página consolidamos los recortes pendientes a la matriz,
        // así no se pierden los recuadros hechos en la página actual.
        consolidarBoxes();
        setBoxes([]); setCurrentBox(null); setIsDrawing(false);
        try {
            await renderPdfPage(pdfDoc, next);
            setPdfPage(next);
        } finally {
            setLoading(false);
        }
    };

    // ── Coordenadas relativas al contenedor (ratón y táctil) ───────────────────
    const getPoint = (e) => {
        const rect = containerRef.current.getBoundingClientRect();
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: cx - rect.left, y: cy - rect.top };
    };

    const startDraw = (e) => {
        if (!imageSrc) return;
        const { x, y } = getPoint(e);
        setIsDrawing(true);
        const base = { id: Date.now() + Math.random(), shape, name: `Recorte ${boxes.length + 1}` };
        if (shape === 'free') {
            setCurrentBox({ ...base, points: [{ x, y }] });
        } else {
            setCurrentBox({ ...base, x, y, w: 0, h: 0 });
        }
    };

    const moveDraw = (e) => {
        if (!isDrawing || !currentBox) return;
        const { x, y } = getPoint(e);
        if (currentBox.shape === 'free') {
            setCurrentBox(prev => ({ ...prev, points: [...prev.points, { x, y }] }));
        } else {
            setCurrentBox(prev => ({ ...prev, w: x - prev.x, h: y - prev.y }));
        }
    };

    // Caja contenedora (bbox) de una lista de puntos
    const bboxDePuntos = (pts) => {
        const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
        const minX = Math.min(...xs), minY = Math.min(...ys);
        return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
    };

    const endDraw = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        if (currentBox?.shape === 'free') {
            if (currentBox.points.length > 3) {
                const bb = bboxDePuntos(currentBox.points);
                if (bb.w > 12 && bb.h > 12) {
                    setBoxes(prev => [...prev, { id: currentBox.id, shape: 'free', name: currentBox.name, points: currentBox.points, ...bb }]);
                }
            }
        } else if (currentBox && Math.abs(currentBox.w) > 12 && Math.abs(currentBox.h) > 12) {
            setBoxes(prev => [...prev, {
                id: currentBox.id,
                shape: currentBox.shape,
                x: currentBox.w < 0 ? currentBox.x + currentBox.w : currentBox.x,
                y: currentBox.h < 0 ? currentBox.y + currentBox.h : currentBox.y,
                w: Math.abs(currentBox.w),
                h: Math.abs(currentBox.h),
                name: currentBox.name,
            }]);
        }
        setCurrentBox(null);
    };

    const handleNameChange = (id, name) => setBoxes(boxes.map(b => b.id === id ? { ...b, name } : b));
    const deleteBox = (id) => setBoxes(boxes.filter(b => b.id !== id));

    // ── Genera un recorte concreto en su mejor formato (menor peso) ────────────
    const renderCrop = useCallback((box) => {
        const img = imgRef.current;
        const scaleX = img.naturalWidth / img.clientWidth;
        const scaleY = img.naturalHeight / img.clientHeight;
        const canvas = document.createElement('canvas');
        canvas.width  = Math.max(1, Math.round(box.w * scaleX));
        canvas.height = Math.max(1, Math.round(box.h * scaleY));
        const ctx = canvas.getContext('2d');

        // Recorte por forma: recortamos (clip) la zona y dejamos transparente el resto
        if (box.shape === 'oval') {
            ctx.beginPath();
            ctx.ellipse(canvas.width / 2, canvas.height / 2, canvas.width / 2, canvas.height / 2, 0, 0, Math.PI * 2);
            ctx.clip();
        } else if (box.shape === 'free' && box.points?.length > 2) {
            ctx.beginPath();
            box.points.forEach((p, idx) => {
                const lx = (p.x - box.x) * scaleX;
                const ly = (p.y - box.y) * scaleY;
                idx === 0 ? ctx.moveTo(lx, ly) : ctx.lineTo(lx, ly);
            });
            ctx.closePath();
            ctx.clip();
        }

        ctx.drawImage(
            img,
            box.x * scaleX, box.y * scaleY, box.w * scaleX, box.h * scaleY,
            0, 0, canvas.width, canvas.height
        );

        // Óvalo y silueta libre necesitan canal alfa → siempre PNG (transparencia)
        if (box.shape === 'oval' || box.shape === 'free') {
            return { dataURL: canvas.toDataURL('image/png'), ext: '.png' };
        }
        const jpeg = canvas.toDataURL('image/jpeg', 0.85);
        const png  = canvas.toDataURL('image/png');
        const useJpeg = jpeg.length < png.length;
        return { dataURL: useJpeg ? jpeg : png, ext: useJpeg ? '.jpg' : '.png' };
    }, []);

    // ── Consolidar: pasa los recuadros de la página actual a la matriz acumulada ─
    // Devuelve la lista de crops resultante (útil para encadenar con descargas).
    const consolidarBoxes = () => {
        if (!imgRef.current || boxes.length === 0) return crops;
        const nuevos = boxes.map((box) => {
            const { dataURL, ext } = renderCrop(box);
            return { id: box.id, name: box.name, dataURL, ext, w: box.w, h: box.h };
        });
        const all = [...crops, ...nuevos];
        setCrops(all);
        return all;
    };

    // Botón "Añadir a la matriz": consolida y limpia los recuadros de la página
    const anadirAMatriz = () => {
        if (boxes.length === 0) return;
        consolidarBoxes();
        setBoxes([]);
    };

    const cropNombre = (crop, i) => crop.name || `Recorte ${i + 1}`;
    const sanitize = (name, i) => (name || '').trim().replace(/[^a-z0-9áéíóúñ]/gi, '_').toLowerCase() || `recorte_${i + 1}`;

    const renameCrop = (id, name) => setCrops(crops.map(c => c.id === id ? { ...c, name } : c));
    const deleteCrop = (id) => setCrops(crops.filter(c => c.id !== id));

    const descargarUno = (crop, i) => {
        const link = document.createElement('a');
        link.href = crop.dataURL;
        link.download = `${sanitize(cropNombre(crop, i), i)}${crop.ext}`;
        link.click();
    };

    // Descarga archivos sueltos (ráfaga controlada para no bloquear el navegador)
    const descargarTodos = () => {
        const lista = consolidarBoxes(); setBoxes([]);
        lista.forEach((crop, i) => setTimeout(() => descargarUno(crop, i), i * 200));
    };

    // Descarga todos los recortes comprimidos en un único .zip
    const descargarZip = async () => {
        const lista = consolidarBoxes(); setBoxes([]);
        if (lista.length === 0) return;
        const zip = new JSZip();
        const usados = {};
        lista.forEach((crop, i) => {
            let base = sanitize(cropNombre(crop, i), i);
            usados[base] = (usados[base] || 0) + 1;
            if (usados[base] > 1) base += `_${usados[base]}`;
            const b64 = crop.dataURL.split(',')[1];
            zip.file(`${base}${crop.ext}`, b64, { base64: true });
        });
        const blob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'recortes.zip';
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    };

    // Descarga un PDF con los recortes apilados verticalmente (una imagen debajo de otra)
    const descargarMatrizPdf = async () => {
        const lista = consolidarBoxes(); setBoxes([]);
        if (lista.length === 0) return;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageW = 210, pageH = 297, margin = 12, gap = 8, labelH = 6;
        const contentW = pageW - margin * 2;

        // Dimensiones reales de cada recorte para encajarlo sin deformar
        const dims = await Promise.all(lista.map(c => new Promise(res => {
            const im = new Image();
            im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
            im.onerror = () => res({ w: 1, h: 1 });
            im.src = c.dataURL;
        })));

        let y = margin;
        lista.forEach((crop, i) => {
            const { w, h } = dims[i];
            let dw = contentW;
            let dh = dw * h / w;
            const maxH = pageH - margin * 2 - labelH; // límite de altura por página
            if (dh > maxH) { dh = maxH; dw = dh * w / h; }

            // Si no cabe en lo que queda de página, pasamos a una nueva
            if (y + dh + labelH > pageH - margin) { pdf.addPage(); y = margin; }

            const dx = margin + (contentW - dw) / 2;
            const fmt = crop.ext === '.png' ? 'PNG' : 'JPEG';
            pdf.addImage(crop.dataURL, fmt, dx, y, dw, dh);

            pdf.setFontSize(9);
            pdf.text(String(cropNombre(crop, i)).slice(0, 60), pageW / 2, y + dh + 4, { align: 'center' });

            y += dh + labelH + gap;
        });
        pdf.save('recortes_apilados.pdf');
    };

    // ── UI ──────────────────────────────────────────────────────────────────────
    const btn = (bg) => ({ padding: '9px 16px', background: bg, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', fontSize: 14 });

    return (
        <div style={{ padding: 16, fontFamily: "'Segoe UI', Tahoma, sans-serif", color: '#2c3e50' }}>
            {/* Barra de herramientas */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
                <label style={{ ...btn('#34495e'), display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    📂 Cargar imagen o PDF
                    <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} style={{ display: 'none' }} />
                </label>

                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                        type="text"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleLoadUrl(); }}
                        placeholder="…o pega una URL (imagen/PDF de la web)"
                        style={{ padding: '8px 10px', border: '1px solid #ccc', borderRadius: 8, fontSize: 13, width: 240 }}
                    />
                    <button onClick={handleLoadUrl} style={btn('#16a085')}>🌐 Cargar</button>
                </div>

                {/* Selector de forma del recorte */}
                <div style={{ display: 'flex', gap: 4, background: '#ecf0f1', padding: 4, borderRadius: 8 }}>
                    {[
                        { id: 'rect', label: '▭ Rectángulo' },
                        { id: 'oval', label: '⬭ Óvalo' },
                        { id: 'free', label: '✎ Silueta' },
                    ].map(s => (
                        <button key={s.id} onClick={() => setShape(s.id)}
                            title={s.id === 'free' ? 'Dibuja a mano la silueta de un objeto (fondo transparente)' : undefined}
                            style={{ padding: '6px 10px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 'bold', background: shape === s.id ? '#0070f3' : 'transparent', color: shape === s.id ? '#fff' : '#34495e' }}>
                            {s.label}
                        </button>
                    ))}
                </div>

                {pdfPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#ecf0f1', padding: '6px 10px', borderRadius: 8 }}>
                        <button onClick={() => cambiarPagina(-1)} disabled={pdfPage <= 1} style={{ ...btn('#7f8c8d'), padding: '4px 10px' }}>◀</button>
                        <span style={{ fontWeight: 'bold' }}>Pág. {pdfPage} / {pdfPages}</span>
                        <button onClick={() => cambiarPagina(1)} disabled={pdfPage >= pdfPages} style={{ ...btn('#7f8c8d'), padding: '4px 10px' }}>▶</button>
                    </div>
                )}

                {boxes.length > 0 && (
                    <button onClick={anadirAMatriz} style={btn('#0070f3')}>➕ Añadir a la matriz ({boxes.length})</button>
                )}
                {(crops.length > 0 || boxes.length > 0) && (
                    <>
                        <button onClick={descargarTodos} style={btn('#27ae60')}>📥 Descargar sueltos</button>
                        <button onClick={descargarZip} style={btn('#8e44ad')}>🗜️ Descargar ZIP</button>
                        <button onClick={descargarMatrizPdf} style={btn('#c0392b')}>📄 PDF apilado</button>
                        <button onClick={() => { setBoxes([]); setCrops([]); }} style={btn('#e74c3c')}>🗑️ Limpiar todo</button>
                    </>
                )}
                {loading && <span style={{ color: '#7f8c8d' }}>Procesando…</span>}
            </div>

            {!imageSrc && !loading && (
                <div style={{ border: '2px dashed #bdc3c7', borderRadius: 14, padding: 50, textAlign: 'center', color: '#95a5a6', background: '#fafafa' }}>
                    <div style={{ fontSize: 46, marginBottom: 10 }}>✂️</div>
                    <p style={{ margin: 0, fontSize: 16 }}>Carga una <b>imagen</b> o un <b>PDF</b> y arrastra para dibujar varios recortes a la vez.</p>
                </div>
            )}

            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {/* Lienzo con la imagen y los recuadros */}
                {imageSrc && (
                    <div
                        ref={containerRef}
                        onMouseDown={startDraw}
                        onMouseMove={moveDraw}
                        onMouseUp={endDraw}
                        onMouseLeave={endDraw}
                        onTouchStart={startDraw}
                        onTouchMove={moveDraw}
                        onTouchEnd={endDraw}
                        style={{ position: 'relative', display: 'inline-block', userSelect: 'none', touchAction: 'none', cursor: 'crosshair', border: '1px solid #ddd', backgroundColor: '#fafafa', maxWidth: '100%' }}
                    >
                        <img ref={imgRef} src={imageSrc} crossOrigin="anonymous" alt="Origen" style={{ maxWidth: '100%', display: 'block' }} draggable={false} />

                        {/* Capa SVG con los contornos de cada recorte (rect / óvalo / silueta) */}
                        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                            {boxes.map((box) => (
                                box.shape === 'oval'
                                    ? <ellipse key={box.id} cx={box.x + box.w / 2} cy={box.y + box.h / 2} rx={box.w / 2} ry={box.h / 2} fill="rgba(0,112,243,0.07)" stroke="#0070f3" strokeWidth="2" />
                                    : box.shape === 'free'
                                        ? <polygon key={box.id} points={box.points.map(p => `${p.x},${p.y}`).join(' ')} fill="rgba(0,112,243,0.07)" stroke="#0070f3" strokeWidth="2" />
                                        : <rect key={box.id} x={box.x} y={box.y} width={box.w} height={box.h} fill="rgba(0,112,243,0.05)" stroke="#0070f3" strokeWidth="2" />
                            ))}
                            {isDrawing && currentBox && (
                                currentBox.shape === 'free'
                                    ? <polyline points={currentBox.points.map(p => `${p.x},${p.y}`).join(' ')} fill="rgba(255,77,77,0.1)" stroke="#ff4d4d" strokeWidth="2" strokeDasharray="5 4" />
                                    : currentBox.shape === 'oval'
                                        ? <ellipse cx={currentBox.x + currentBox.w / 2} cy={currentBox.y + currentBox.h / 2} rx={Math.abs(currentBox.w) / 2} ry={Math.abs(currentBox.h) / 2} fill="rgba(255,77,77,0.1)" stroke="#ff4d4d" strokeWidth="2" strokeDasharray="5 4" />
                                        : <rect x={Math.min(currentBox.x, currentBox.x + currentBox.w)} y={Math.min(currentBox.y, currentBox.y + currentBox.h)} width={Math.abs(currentBox.w)} height={Math.abs(currentBox.h)} fill="rgba(255,77,77,0.1)" stroke="#ff4d4d" strokeWidth="2" strokeDasharray="5 4" />
                            )}
                        </svg>

                        {/* Etiquetas editables (nombre + eliminar) ancladas al bbox de cada recorte */}
                        {boxes.map((box) => (
                            <div key={box.id} style={{ position: 'absolute', left: box.x, top: box.y - 30, pointerEvents: 'none' }}>
                                <div
                                    style={{ display: 'inline-flex', gap: 4, backgroundColor: '#0070f3', padding: 3, borderRadius: '4px 4px 4px 0', pointerEvents: 'auto', whiteSpace: 'nowrap' }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onTouchStart={(e) => e.stopPropagation()}
                                >
                                    <input
                                        type="text"
                                        value={box.name}
                                        onChange={(e) => handleNameChange(box.id, e.target.value)}
                                        style={{ border: 'none', padding: '2px 6px', fontSize: 12, borderRadius: 2, outline: 'none', width: 100 }}
                                    />
                                    <button onClick={() => deleteBox(box.id)} title="Eliminar recorte"
                                        style={{ background: '#ff4d4d', color: '#fff', border: 'none', borderRadius: 2, cursor: 'pointer', fontWeight: 'bold', fontSize: 12, padding: '2px 7px' }}>✕</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Galería / matriz de recortes generados */}
                {crops.length > 0 && (
                    <div style={{ flex: '1 1 280px', minWidth: 240 }}>
                        <h3 style={{ margin: '0 0 4px' }}>🖼️ Matriz de recortes ({crops.length})</h3>
                        {pdfPages > 1 && <p style={{ margin: '0 0 12px', fontSize: 12, color: '#7f8c8d' }}>Se acumulan los recortes de todas las páginas. Cambia de página y sigue recortando.</p>}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
                            {crops.map((crop, i) => (
                                <div key={crop.id} style={{ border: '1px solid #e0e0e0', borderRadius: 10, overflow: 'hidden', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                                    <div style={{ background: '#f4f6f8', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80, position: 'relative' }}>
                                        <img src={crop.dataURL} alt={cropNombre(crop, i)} style={{ maxWidth: '100%', maxHeight: 120, display: 'block' }} />
                                        <button onClick={() => deleteCrop(crop.id)} title="Eliminar de la matriz"
                                            style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(231,76,60,0.92)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, padding: '2px 6px' }}>✕</button>
                                    </div>
                                    <div style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <input
                                            type="text"
                                            value={crop.name}
                                            onChange={(e) => renameCrop(crop.id, e.target.value)}
                                            placeholder={`Recorte ${i + 1}`}
                                            style={{ flex: 1, minWidth: 0, border: '1px solid #eee', borderRadius: 4, padding: '3px 5px', fontSize: 12, outline: 'none' }}
                                        />
                                        <button onClick={() => descargarUno(crop, i)} title="Descargar"
                                            style={{ background: '#0070f3', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, padding: '3px 8px', flexShrink: 0 }}>⬇</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
