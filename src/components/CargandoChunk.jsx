// Fallback de <Suspense> mientras se descarga el código de un juego/herramienta cargado con lazy().
export default function CargandoChunk({ texto = 'Cargando…' }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: '40vh', padding: 40, color: '#7b1fa2', fontWeight: 800 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', border: '4px solid #e9d5ff', borderTopColor: '#7b1fa2', animation: 'cargandoChunkGiro 0.8s linear infinite' }} />
            {texto}
            <style>{'@keyframes cargandoChunkGiro { to { transform: rotate(360deg); } }'}</style>
        </div>
    );
}
