import { useRef, useState, useEffect } from 'react';

const COLORS = ['#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#1abc9c', '#2c3e50', '#ffffff'];
const SIZES  = [2, 5, 10, 18];

export default function AnnotationOverlay({ onClose, bgDataURL }) {
    const canvasRef    = useRef(null);
    const bgImgRef     = useRef(null); // cached background Image object
    const drawingRef   = useRef(false);
    const lastPtRef    = useRef(null);
    const capStartRef  = useRef(null);

    const [mode,        setMode]        = useState('draw');
    const [color,       setColor]       = useState('#e74c3c');
    const [size,        setSize]        = useState(5);
    const [captureRect, setCaptureRect] = useState(null);

    // Pre-load background image
    useEffect(() => {
        if (!bgDataURL) return;
        const img = new Image();
        img.src = bgDataURL;
        bgImgRef.current = img;
    }, [bgDataURL]);

    // Size canvas to viewport on mount + resize
    useEffect(() => {
        const canvas = canvasRef.current;
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;

        const onResize = () => {
            const tmp = document.createElement('canvas');
            tmp.width  = canvas.width;
            tmp.height = canvas.height;
            tmp.getContext('2d').drawImage(canvas, 0, 0);
            canvas.width  = window.innerWidth;
            canvas.height = window.innerHeight;
            canvas.getContext('2d').drawImage(tmp, 0, 0);
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const getXY = (e) => {
        const r = canvasRef.current.getBoundingClientRect();
        const t = e.touches ? e.touches[0] : e;
        return { x: t.clientX - r.left, y: t.clientY - r.top };
    };

    const handleDown = (e) => {
        e.preventDefault();
        const pt = getXY(e);
        if (mode === 'draw') {
            drawingRef.current = true;
            lastPtRef.current  = pt;
            const ctx = canvasRef.current.getContext('2d');
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, size / 2, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
        } else {
            capStartRef.current = pt;
            setCaptureRect(null);
        }
    };

    const handleMove = (e) => {
        e.preventDefault();
        const pt = getXY(e);
        if (mode === 'draw' && drawingRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx.strokeStyle = color;
            ctx.lineWidth   = size;
            ctx.lineCap     = 'round';
            ctx.lineJoin    = 'round';
            ctx.beginPath();
            ctx.moveTo(lastPtRef.current.x, lastPtRef.current.y);
            ctx.lineTo(pt.x, pt.y);
            ctx.stroke();
            lastPtRef.current = pt;
        } else if (mode === 'capture' && capStartRef.current) {
            const s = capStartRef.current;
            setCaptureRect({
                x: Math.min(s.x, pt.x),
                y: Math.min(s.y, pt.y),
                w: Math.abs(pt.x - s.x),
                h: Math.abs(pt.y - s.y),
            });
        }
    };

    const handleUp = (e) => {
        e.preventDefault();
        drawingRef.current = false;
        if (mode === 'capture') {
            const rect = captureRect;
            if (rect && rect.w > 10 && rect.h > 10) {
                const composite = document.createElement('canvas');
                composite.width  = rect.w;
                composite.height = rect.h;
                const ctx = composite.getContext('2d');

                // 1. Draw background crop (captured before overlay appeared)
                if (bgImgRef.current && bgImgRef.current.complete) {
                    ctx.drawImage(
                        bgImgRef.current,
                        rect.x, rect.y, rect.w, rect.h,
                        0,      0,      rect.w, rect.h,
                    );
                }

                // 2. Draw annotation strokes on top
                ctx.drawImage(
                    canvasRef.current,
                    rect.x, rect.y, rect.w, rect.h,
                    0,      0,      rect.w, rect.h,
                );

                const dataURL = composite.toDataURL('image/png');
                sessionStorage.setItem('pizarraCaptura', dataURL);
                onClose();
                window.dispatchEvent(new CustomEvent('abrirPizarraConCaptura'));
            }
            capStartRef.current = null;
            setCaptureRect(null);
        }
    };

    const limpiar = () => {
        const canvas = canvasRef.current;
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        setCaptureRect(null);
    };

    const btnBase = {
        border: 'none', borderRadius: 8, padding: '5px 8px',
        cursor: 'pointer', fontSize: 18, lineHeight: 1, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9990, pointerEvents: 'all' }}>

            {/* Drawing canvas */}
            <canvas
                ref={canvasRef}
                style={{
                    position: 'absolute', inset: 0,
                    width: '100%', height: '100%',
                    cursor: mode === 'draw' ? 'crosshair' : 'cell',
                    touchAction: 'none',
                }}
                onMouseDown={handleDown}
                onMouseMove={handleMove}
                onMouseUp={handleUp}
                onTouchStart={handleDown}
                onTouchMove={handleMove}
                onTouchEnd={handleUp}
            />

            {/* Capture selection rectangle */}
            {captureRect && (
                <div style={{
                    position: 'absolute',
                    left: captureRect.x, top: captureRect.y,
                    width: captureRect.w, height: captureRect.h,
                    border: '2px dashed #3b82f6',
                    background: 'rgba(59,130,246,0.07)',
                    pointerEvents: 'none',
                }} />
            )}

            {/* Floating toolbar */}
            <div
                style={{
                    position: 'fixed', top: 60, right: 12,
                    background: 'rgba(12,12,12,0.90)', backdropFilter: 'blur(12px)',
                    borderRadius: 14, padding: '10px 8px',
                    display: 'flex', flexDirection: 'column', gap: 6,
                    zIndex: 9991, boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
                    alignItems: 'center', pointerEvents: 'all', userSelect: 'none',
                }}
                onMouseDown={e => e.stopPropagation()}
                onTouchStart={e => e.stopPropagation()}
            >
                {/* Draw mode */}
                <button
                    onClick={() => { setMode('draw'); setCaptureRect(null); }}
                    title="Lapiz"
                    style={{ ...btnBase, background: mode === 'draw' ? '#3b82f6' : 'rgba(255,255,255,0.08)', color: '#fff' }}
                >✏️</button>

                <div style={{ width: 26, height: 1, background: 'rgba(255,255,255,0.15)' }} />

                {/* Color palette */}
                {COLORS.map(c => (
                    <button
                        key={c}
                        onClick={() => setColor(c)}
                        style={{
                            width: 22, height: 22, borderRadius: '50%',
                            background: c, padding: 0,
                            border: c === color ? '2px solid #fff' : '2px solid rgba(255,255,255,0.2)',
                            cursor: 'pointer',
                        }}
                    />
                ))}

                <div style={{ width: 26, height: 1, background: 'rgba(255,255,255,0.15)' }} />

                {/* Size options */}
                {SIZES.map(s => (
                    <button
                        key={s}
                        onClick={() => setSize(s)}
                        title={`Grosor ${s}`}
                        style={{
                            width: Math.max(s + 8, 14), height: Math.max(s + 8, 14),
                            borderRadius: '50%', background: color, padding: 0,
                            border: s === size ? '2px solid #fff' : '2px solid rgba(255,255,255,0.2)',
                            cursor: 'pointer',
                        }}
                    />
                ))}

                <div style={{ width: 26, height: 1, background: 'rgba(255,255,255,0.15)' }} />

                {/* Capture mode */}
                <button
                    onClick={() => setMode('capture')}
                    title="Capturar zona → Pizarra"
                    style={{ ...btnBase, background: mode === 'capture' ? '#10b981' : 'rgba(255,255,255,0.08)', color: '#fff' }}
                >📷</button>

                {/* Clear */}
                <button
                    onClick={limpiar}
                    title="Borrar todo"
                    style={{ ...btnBase, background: 'rgba(255,255,255,0.05)', color: '#f87171' }}
                >🗑️</button>

                <div style={{ width: 26, height: 1, background: 'rgba(255,255,255,0.15)' }} />

                {/* Close */}
                <button
                    onClick={onClose}
                    title="Cerrar anotador"
                    style={{ ...btnBase, background: 'rgba(255,255,255,0.05)', color: '#9ca3af', fontSize: 14, fontWeight: 'bold' }}
                >✕</button>
            </div>

            {/* Capture-mode hint */}
            {mode === 'capture' && (
                <div style={{
                    position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
                    color: '#fff', borderRadius: 10, padding: '8px 18px',
                    fontSize: 13, pointerEvents: 'none', whiteSpace: 'nowrap',
                }}>
                    Arrastra para seleccionar una zona · se abrirá en la Pizarra
                </div>
            )}
        </div>
    );
}
