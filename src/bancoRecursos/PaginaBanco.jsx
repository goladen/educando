// Página propia del Banco de recursos: /banco (ver) y /banco/nuevo (añadir).
// Sin sesión se ven los recursos públicos; para añadir (o ver los «solo profesores")
// se entra con Google y se queda en la misma página.
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase';
import BancoRecursos from './BancoRecursos';

export default function PaginaBanco({ usuario, cargando, onExit }) {
    const ruta = window.location.pathname.replace(/\/+$/, '').toLowerCase();
    const nuevo = ruta.endsWith('/nuevo');
    const fichas = ruta.endsWith('/fichas');
    const sinCuenta = !usuario || usuario.isAnonymous;
    const entrar = async () => {
        try { await signInWithPopup(auth, new GoogleAuthProvider()); }
        catch (e) { if (e.code !== 'auth/popup-closed-by-user') alert(e.message); }
    };

    return (
        <div style={{ minHeight: '100vh', background: '#e8eaf6', padding: '16px 16px 40px', boxSizing: 'border-box', fontFamily: 'Arial, sans-serif' }}>
            <div style={{ maxWidth: 1000, margin: '0 auto' }}>
                {cargando ? (
                    <div style={{ textAlign: 'center', padding: 60, color: '#607d8b' }}>Cargando…</div>
                ) : sinCuenta && nuevo ? (
                    <div style={{ maxWidth: 440, margin: '60px auto', background: 'white', borderRadius: 18, padding: 28, textAlign: 'center', boxShadow: '0 6px 24px rgba(0,0,0,0.1)' }}>
                        <div style={{ fontSize: '3rem' }}>📚</div>
                        <h1 style={{ color: '#1a237e', margin: '6px 0 8px', fontSize: '1.5rem' }}>Banco de recursos</h1>
                        <p style={{ color: '#455a64', margin: '0 0 18px' }}>Inicia sesión para añadir tu recurso al banco del profesorado.</p>
                        <button onClick={entrar} style={{ background: '#3949ab', color: 'white', border: 'none', borderRadius: 12, padding: '12px 22px', fontWeight: 800, fontSize: '1rem', cursor: 'pointer' }}>
                            Entrar con Google
                        </button>
                        <div style={{ marginTop: 16 }}>
                            <button onClick={onExit} style={{ background: 'none', border: 'none', color: '#3949ab', textDecoration: 'underline', cursor: 'pointer' }}>Ir a la página principal</button>
                        </div>
                    </div>
                ) : (
                    <>
                        {sinCuenta && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                                <button onClick={entrar} style={{ background: '#3949ab', color: 'white', border: 'none', borderRadius: 10, padding: '8px 16px', fontWeight: 800, cursor: 'pointer' }}>
                                    Entrar con Google
                                </button>
                            </div>
                        )}
                        <BancoRecursos key={usuario?.uid || 'publico'} usuario={sinCuenta ? null : usuario} abrirNuevo={nuevo} seccionInicial={fichas ? 'fichas' : 'recursos'} onVolver={onExit} />
                    </>
                )}
            </div>
        </div>
    );
}
