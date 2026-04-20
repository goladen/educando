import React, { useState, useEffect } from 'react';
import { Save, X, Globe } from 'lucide-react';

const PLANETAS_DEFAULT = [
    { nombre: 'Sol',      emoji: '☀️', texto: 'El Sol es la estrella central de nuestro sistema solar. Su diámetro es 109 veces el de la Tierra y contiene el 99,8 % de toda la masa del sistema. En su núcleo, la fusión nuclear convierte hidrógeno en helio a 15 millones de grados, liberando la energía que hace posible la vida en la Tierra.' },
    { nombre: 'Mercurio', emoji: '⚫', texto: 'Mercurio es el planeta más pequeño y el más cercano al Sol. Un año mercuriano dura solo 88 días terrestres. Sin atmósfera protectora, las temperaturas oscilan entre −180 °C de noche y 430 °C de día.' },
    { nombre: 'Venus',    emoji: '🟡', texto: 'Venus es el planeta más caliente del sistema solar, con temperaturas de 465 °C, gracias a su densa atmósfera de dióxido de carbono que atrapa el calor. Es el objeto más brillante del cielo nocturno después de la Luna.' },
    { nombre: 'Tierra',   emoji: '🔵', texto: 'La Tierra es el único planeta conocido que alberga vida. Tiene un 71 % de su superficie cubierta de agua líquida y una atmósfera rica en nitrógeno y oxígeno. Su satélite natural, la Luna, estabiliza la inclinación del eje terrestre.' },
    { nombre: 'Luna',     emoji: '🌕', texto: 'La Luna es el único satélite natural de la Tierra y el quinto más grande del sistema solar. Su superficie está cubierta de cráteres de impacto. Las mareas oceánicas de la Tierra son causadas principalmente por la atracción gravitatoria lunar.' },
    { nombre: 'Marte',    emoji: '🔴', texto: 'Marte, el planeta rojo, debe su color al óxido de hierro de su suelo. Tiene el volcán más grande del sistema solar, el Olimpo, de 22 km de altura. Un día marciano dura 24 horas y 37 minutos, muy similar al terrestre.' },
    { nombre: 'Jupiter',  emoji: '🟠', texto: 'Júpiter es el planeta más grande del sistema solar, con una masa 318 veces la de la Tierra. La Gran Mancha Roja es una tormenta anticiclónica que lleva activa más de 350 años. Tiene 95 lunas confirmadas, entre ellas Ganímedes, la luna más grande del sistema solar.' },
    { nombre: 'Saturno',  emoji: '🪐', texto: 'Saturno es famoso por sus espectaculares anillos, formados por partículas de hielo y roca. Es el planeta menos denso del sistema solar; podría flotar en agua. Tiene 146 lunas, entre ellas Titán, que posee una atmósfera densa y lagos de metano líquido.' },
    { nombre: 'Urano',    emoji: '🔵', texto: 'Urano es el único planeta que gira de lado, con una inclinación axial de 98°. Compuesto principalmente de hielo de agua, metano y amoníaco, su atmósfera de metano le da su característico color azul verdoso.' },
    { nombre: 'Neptuno',  emoji: '🔵', texto: 'Neptuno es el planeta más alejado del Sol. Tiene los vientos más rápidos del sistema solar, superando los 2000 km/h. Su luna más grande, Tritón, orbita en sentido retrógrado y se cree que fue capturada del cinturón de Kuiper.' },
];

const MUSICA_DEFAULT = 'https://www.youtube.com/watch?v=7GlsxNI4LVI';

const s = {
    overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:9000, display:'flex', alignItems:'center', justifyContent:'center' },
    modal: { background:'#fff', borderRadius:16, width:'min(820px,96vw)', maxHeight:'92vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 8px 40px rgba(0,0,0,0.25)' },
    header: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 24px', background:'linear-gradient(135deg,#0f0c29,#302b63,#24243e)', color:'#fff', flexShrink:0 },
    body: { overflowY:'auto', padding:'24px', flex:1, display:'flex', flexDirection:'column', gap:20 },
    section: { background:'#f8f9ff', borderRadius:12, padding:'16px 20px', border:'1px solid #e0e4ff' },
    sectionTitle: { fontWeight:700, fontSize:14, color:'#302b63', marginBottom:12, textTransform:'uppercase', letterSpacing:1 },
    label: { display:'block', fontWeight:600, fontSize:13, color:'#555', marginBottom:4 },
    input: { width:'100%', padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, fontSize:14, boxSizing:'border-box' },
    row: { display:'flex', gap:12, flexWrap:'wrap' },
    col: { flex:1, minWidth:160 },
    planetRow: { display:'flex', alignItems:'flex-start', gap:10, padding:'8px 0', borderBottom:'1px solid #eee' },
    textarea: { width:'100%', padding:'6px 10px', border:'1px solid #ddd', borderRadius:6, fontSize:13, resize:'vertical', boxSizing:'border-box', minHeight:60 },
    checkbox: { width:18, height:18, marginTop:3, cursor:'pointer', flexShrink:0 },
    footer: { padding:'16px 24px', display:'flex', justifyContent:'flex-end', gap:12, borderTop:'1px solid #eee', flexShrink:0 },
    btnSave: { display:'flex', alignItems:'center', gap:6, background:'linear-gradient(135deg,#302b63,#24243e)', color:'#fff', border:'none', borderRadius:8, padding:'10px 22px', fontWeight:700, cursor:'pointer', fontSize:14 },
    btnCancel: { display:'flex', alignItems:'center', gap:6, background:'#f3f4f6', color:'#555', border:'none', borderRadius:8, padding:'10px 18px', fontWeight:600, cursor:'pointer', fontSize:14 },
    iconBtn: { background:'none', border:'none', color:'#fff', cursor:'pointer', padding:4, borderRadius:6, display:'flex', alignItems:'center' },
    slider: { width:'100%', accentColor:'#302b63' },
    toggle: { display:'flex', alignItems:'center', gap:10, cursor:'pointer', userSelect:'none' },
};

export default function EditorSolarSystem({ datos, setDatos, onClose, onSave, usuario }) {

    const [titulo, setTitulo]       = useState('');
    const [temas, setTemas]         = useState('');
    const [ciclo, setCiclo]         = useState('Secundaria');
    const [pais, setPais]           = useState('');
    const [region, setRegion]       = useState('');
    const [poblacion, setPoblacion] = useState('');
    const [musicaUrl, setMusicaUrl] = useState(MUSICA_DEFAULT);
    const [duracion, setDuracion]   = useState(8);
    const [planetas, setPlanetas]   = useState(
        PLANETAS_DEFAULT.map(p => ({ ...p, activo: true }))
    );
    const [compActiva, setCompActiva]     = useState(true);
    const [compTexto, setCompTexto]       = useState('');
    const [compDuracion, setCompDuracion] = useState(14);

    useEffect(() => {
        const tc = datos?.tourConfig;
        setTitulo(datos?.titulo || '');
        setTemas(datos?.temas || usuario?.temasPreferidos || '');
        setCiclo(datos?.ciclo || usuario?.ciclo || 'Secundaria');
        setPais(datos?.pais || usuario?.pais || '');
        setRegion(datos?.region || usuario?.region || '');
        setPoblacion(datos?.poblacion || usuario?.poblacion || usuario?.localidad || '');

        if (tc) {
            setMusicaUrl(tc.musicaUrl || MUSICA_DEFAULT);
            setDuracion(tc.duracionEscena || 8);
            setCompActiva(tc.comparativa?.activa ?? true);
            setCompTexto(tc.comparativa?.texto || '');
            setCompDuracion(tc.comparativa?.duracion || 14);

            if (tc.planetas?.length) {
                const merged = PLANETAS_DEFAULT.map(pd => {
                    const saved = tc.planetas.find(p => p.nombre === pd.nombre);
                    return saved
                        ? { ...pd, texto: saved.texto ?? pd.texto, activo: saved.activo ?? true }
                        : { ...pd, activo: false };
                });
                setPlanetas(merged);
            }
        }
    }, []);

    const togglePlaneta = (idx) => {
        setPlanetas(prev => prev.map((p, i) => i === idx ? { ...p, activo: !p.activo } : p));
    };

    const setTextoPlaneta = (idx, txt) => {
        setPlanetas(prev => prev.map((p, i) => i === idx ? { ...p, texto: txt } : p));
    };

    const handleSave = () => {
        if (!titulo.trim()) return alert('Añade un título al recurso.');
        const activos = planetas.filter(p => p.activo);
        if (activos.length < 1) return alert('Selecciona al menos un planeta.');

        const tourConfig = {
            planetas: planetas.filter(p => p.activo).map(p => ({ nombre: p.nombre, texto: p.texto })),
            musicaUrl: musicaUrl.trim() || MUSICA_DEFAULT,
            duracionEscena: duracion,
            comparativa: { activa: compActiva, texto: compTexto.trim(), duracion: compDuracion },
        };

        setDatos(prev => ({
            ...prev,
            titulo,
            temas,
            ciclo,
            pais,
            region,
            poblacion,
            tipo: 'SOLAR_SYSTEM',
            tipoJuego: 'SOLAR_SYSTEM',
            tourConfig,
            hojas: [{ nombreHoja: 'Tour Solar' }],
            isFinished: true,
            profesorNombre: prev.profesorNombre || usuario?.displayName || '',
        }));

        setTimeout(() => onSave(), 0);
    };

    return (
        <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={s.modal}>
                <div style={s.header}>
                    <span style={{ fontWeight:700, fontSize:17, display:'flex', alignItems:'center', gap:8 }}>
                        🪐 Editor — Tour del Sistema Solar
                    </span>
                    <button style={s.iconBtn} onClick={onClose}><X size={20}/></button>
                </div>

                <div style={s.body}>

                    {/* ── Metadata ── */}
                    <div style={s.section}>
                        <div style={s.sectionTitle}>Información del recurso</div>
                        <div style={s.row}>
                            <div style={{ ...s.col, flex:2 }}>
                                <label style={s.label}>Título *</label>
                                <input style={s.input} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej: Tour por el Sistema Solar" />
                            </div>
                            <div style={s.col}>
                                <label style={s.label}>Ciclo</label>
                                <select style={s.input} value={ciclo} onChange={e => setCiclo(e.target.value)}>
                                    {['Infantil','Primaria','Secundaria','Bachillerato','Universidad'].map(c => <option key={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                        <div style={{ ...s.row, marginTop:10 }}>
                            <div style={s.col}>
                                <label style={s.label}>Temas</label>
                                <input style={s.input} value={temas} onChange={e => setTemas(e.target.value)} placeholder="Astronomía, Ciencias..." />
                            </div>
                            <div style={s.col}>
                                <label style={s.label}>País</label>
                                <input style={s.input} value={pais} onChange={e => setPais(e.target.value)} placeholder="España" />
                            </div>
                            <div style={s.col}>
                                <label style={s.label}>Región</label>
                                <input style={s.input} value={region} onChange={e => setRegion(e.target.value)} placeholder="Madrid" />
                            </div>
                        </div>
                    </div>

                    {/* ── Música y duración ── */}
                    <div style={s.section}>
                        <div style={s.sectionTitle}>Audio</div>
                        <div style={s.row}>
                            <div style={{ ...s.col, flex:2 }}>
                                <label style={s.label}><Globe size={12} style={{marginRight:4}}/>URL de música (YouTube o audio directo)</label>
                                <input style={s.input} value={musicaUrl} onChange={e => setMusicaUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
                            </div>
                            <div style={s.col}>
                                <label style={s.label}>Duración por planeta: <b>{duracion}s</b></label>
                                <input type="range" min={4} max={30} value={duracion} onChange={e => setDuracion(+e.target.value)} style={s.slider} />
                            </div>
                        </div>
                    </div>

                    {/* ── Planetas ── */}
                    <div style={s.section}>
                        <div style={s.sectionTitle}>Planetas del tour</div>
                        {planetas.map((p, i) => (
                            <div key={p.nombre} style={s.planetRow}>
                                <input type="checkbox" checked={p.activo} onChange={() => togglePlaneta(i)} style={s.checkbox} />
                                <div style={{ flex:1 }}>
                                    <div style={{ fontWeight:600, fontSize:13, marginBottom:4, color: p.activo ? '#302b63' : '#aaa' }}>
                                        {p.emoji} {p.nombre}
                                    </div>
                                    {p.activo && (
                                        <textarea
                                            style={s.textarea}
                                            value={p.texto}
                                            onChange={e => setTextoPlaneta(i, e.target.value)}
                                            placeholder={`Texto de narración para ${p.nombre}...`}
                                            rows={3}
                                        />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── Escena comparativa ── */}
                    <div style={s.section}>
                        <div style={s.sectionTitle}>Escena comparativa de tamaños</div>
                        <label style={s.toggle}>
                            <input type="checkbox" checked={compActiva} onChange={e => setCompActiva(e.target.checked)} style={s.checkbox} />
                            <span style={{ fontSize:14, color:'#333' }}>Mostrar escena comparativa al final del tour</span>
                        </label>

                        {compActiva && (
                            <div style={{ marginTop:14, display:'flex', flexDirection:'column', gap:12 }}>
                                <div>
                                    <label style={s.label}>Duración de la comparativa: <b>{compDuracion}s</b></label>
                                    <input type="range" min={6} max={40} value={compDuracion} onChange={e => setCompDuracion(+e.target.value)} style={s.slider} />
                                </div>
                                <div>
                                    <label style={s.label}>Texto personalizado (dejar vacío para generarlo automáticamente)</label>
                                    <textarea
                                        style={{ ...s.textarea, minHeight:80 }}
                                        value={compTexto}
                                        onChange={e => setCompTexto(e.target.value)}
                                        placeholder="Observa la diferencia de tamaño entre estos mundos..."
                                        rows={4}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                </div>

                <div style={s.footer}>
                    <button style={s.btnCancel} onClick={onClose}><X size={15}/> Cancelar</button>
                    <button style={s.btnSave} onClick={handleSave}><Save size={15}/> Guardar recurso</button>
                </div>
            </div>
        </div>
    );
}
