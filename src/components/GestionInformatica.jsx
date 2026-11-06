// ─────────────────────────────────────────────────────────────────────────────
// Gestión informática · zona para el personal de mantenimiento de ordenadores
// del centro. Ofrece programas descargables para Windows (archivos .bat con
// interfaz gráfica en PowerShell) servidos desde public/descargas/gestion-informatica/.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { Monitor, Download, ImageOff, UserCheck, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';

const BASE = '/descargas/gestion-informatica/';

const PROGRAMAS = [
    {
        id: 'fondos',
        archivo: 'pikt-bloqueo-fondos.bat',
        titulo: 'Bloqueo de fondos',
        icono: ImageOff,
        color: '#c0392b',
        fondo: '#fdecea',
        resumen: 'Impide que los alumnos cambien el fondo de escritorio y la imagen de la pantalla de bloqueo. Afecta a todas las cuentas del equipo.',
        funciones: [
            'Bloquear el cambio del fondo de escritorio',
            'Volver a permitir el cambio del fondo de escritorio',
            'Bloquear el cambio de la pantalla de bloqueo (opcional: ocultarla del todo)',
            'Volver a permitir el cambio de la pantalla de bloqueo',
            'Muestra el estado actual y permite reiniciar el equipo',
        ],
        pasos: [
            'Descarga el archivo y ábrelo con doble clic en el ordenador del alumno.',
            'Acepta el aviso de Windows para darle permisos de administrador.',
            'Pulsa el botón que necesites.',
            'Reinicia el ordenador para que se aplique a todas las cuentas.',
        ],
        tecnico: [
            'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\ActiveDesktop → NoChangingWallPaper = 1',
            'HKLM\\Software\\Policies\\Microsoft\\Windows\\Personalization → NoChangingLockScreen = 1',
            'Opcional: …\\Personalization → NoLockScreen = 1 (no muestra la pantalla de bloqueo)',
        ],
    },
    {
        id: 'puestos',
        archivo: 'pikt-registro-puestos.bat',
        titulo: 'Registro de puestos',
        icono: UserCheck,
        color: '#2563eb',
        fondo: '#e0ecff',
        resumen: 'Al iniciar sesión el alumno escribe su nombre y curso. Se muestra siempre en pantalla para que el profesor lo vea al pasar, y se registra quién usó el ordenador y cuándo.',
        funciones: [
            'Pantalla de identificación al iniciar Windows (nombre, apellido y curso)',
            'Etiqueta siempre visible con nombre, curso, equipo y hora de entrada (no se puede mover ni cerrar; los clics la atraviesan)',
            'Registro de ENTRADA y SALIDA (al cerrar sesión o apagar) con fecha, hora, equipo, usuario de Windows y duración',
            'Los alumnos solo pueden añadir líneas al registro: no pueden leerlo, modificarlo ni borrarlo',
            'Panel de administración: instalar, ver y buscar en el registro, exportar a Excel, vaciar y desinstalar',
            'Lista de cursos y posición de la etiqueta configurables',
        ],
        pasos: [
            'Descarga el archivo y ábrelo con doble clic con una cuenta de administrador.',
            'Revisa la lista de cursos y pulsa «Instalar / actualizar en este equipo».',
            'Desde el siguiente inicio de sesión se pedirá la identificación.',
            'Para consultar quién usó el equipo, vuelve a abrir el mismo archivo y pulsa «Ver el registro de uso».',
        ],
        tecnico: [
            'Se instala en C:\\ProgramData\\PiktPuesto (puesto.ps1, lanzar.vbs, config.json, registro.csv)',
            'Arranque para todos los usuarios: HKLM\\…\\CurrentVersion\\Run → PiktPuesto',
            'registro.csv: separado por «;» y en UTF-8, se abre directamente con Excel',
            'Por defecto no se pide identificación a las cuentas de administrador (configurable)',
        ],
    },
];

function TarjetaPrograma({ p }) {
    const [abierto, setAbierto] = useState(false);
    const Icono = p.icono;
    return (
        <div style={{ ...card, borderTop: `4px solid ${p.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                <div style={{ background: p.fondo, padding: 12, borderRadius: '50%', display: 'flex' }}>
                    <Icono size={28} color={p.color} />
                </div>
                <h3 style={{ margin: 0, color: '#2c3e50' }}>{p.titulo}</h3>
            </div>
            <p style={{ margin: '0 0 14px', color: '#555', fontSize: '0.92rem', lineHeight: 1.45 }}>{p.resumen}</p>

            <ul style={{ margin: '0 0 16px', paddingLeft: 20, color: '#444', fontSize: '0.88rem', lineHeight: 1.5 }}>
                {p.funciones.map(f => <li key={f}>{f}</li>)}
            </ul>

            <a href={BASE + p.archivo} download={p.archivo}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 16px', borderRadius: 10, background: p.color, color: 'white', fontWeight: 700, textDecoration: 'none', marginTop: 'auto' }}>
                <Download size={18} /> Descargar {p.archivo}
            </a>

            <button onClick={() => setAbierto(a => !a)}
                style={{ marginTop: 10, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'center' }}>
                {abierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />} Cómo se usa y detalles técnicos
            </button>
            {abierto && (
                <div style={{ marginTop: 8, fontSize: '0.86rem', color: '#444' }}>
                    <ol style={{ margin: '0 0 12px', paddingLeft: 20, lineHeight: 1.5 }}>
                        {p.pasos.map(s => <li key={s}>{s}</li>)}
                    </ol>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', fontFamily: 'Consolas, monospace', fontSize: '0.78rem', color: '#334155', lineHeight: 1.6, wordBreak: 'break-word' }}>
                        {p.tecnico.map(t => <div key={t}>{t}</div>)}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function GestionInformatica({ onBack }) {
    return (
        <div style={{ padding: '20px 16px', maxWidth: 1000, margin: '0 auto' }}>
            <button onClick={onBack}
                style={{ marginBottom: 20, padding: '7px 14px', borderRadius: 8, border: '1px solid #dde', background: 'white', cursor: 'pointer', fontSize: '0.85rem', color: '#555' }}>
                ← Volver a herramientas
            </button>

            <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <h2 style={{ color: '#2c3e50', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, margin: '0 0 8px' }}>
                    <Monitor size={30} /> Gestión informática
                </h2>
                <p style={{ color: '#7f8c8d', margin: 0 }}>Programas para el mantenimiento de los ordenadores del centro (Windows 10 / 11).</p>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: '#fff8e1', border: '1px solid #ffe08a', borderRadius: 12, padding: '12px 16px', marginBottom: 24, fontSize: '0.88rem', color: '#6b5300', lineHeight: 1.45 }}>
                <ShieldAlert size={22} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                    Los programas piden permisos de administrador al abrirlos. Es posible que el navegador o Windows
                    (SmartScreen) avisen al descargar un archivo <b>.bat</b>: pulsa «Conservar» y, si aparece
                    «Windows protegió su PC», elige «Más información» → «Ejecutar de todas formas».
                    Puedes abrir el archivo con el Bloc de notas para revisar exactamente lo que hace.
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                {PROGRAMAS.map(p => <TarjetaPrograma key={p.id} p={p} />)}
            </div>
        </div>
    );
}

const card = {
    background: 'white',
    borderRadius: 15,
    padding: 24,
    boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
    border: '1px solid #eee',
    display: 'flex',
    flexDirection: 'column',
};
