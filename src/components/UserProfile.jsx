import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, updateDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { User, MapPin, Heart, LifeBuoy, Shield, Trash2, X, Save, CheckCircle, Copy, AlertTriangle } from 'lucide-react';

// --- ENLACES EXTERNOS ---
const LINK_PRIVACIDAD = "https://tu-web-de-privacidad.com";
const LINK_BAJA_FEEDBACK = "https://tu-formulario-google-o-tally.com";

// AÑADIMOS showSupport COMO PROP (Por defecto true)
export default function UserProfile({ usuario, perfil, onClose, onUpdate, showSupport = true }) {
    const [formData, setFormData] = useState({
        displayName: perfil?.displayName || usuario.displayName || '',
        pais: perfil?.pais || '',
        region: perfil?.region || '',
        poblacion: perfil?.poblacion || '',
        temasPreferidos: perfil?.temasPreferidos || '',
        ciclo: perfil?.ciclo || 'Primaria',
    });

    const [guardando, setGuardando] = useState(false);
    const [faseBaja, setFaseBaja] = useState('NORMAL');
    const [mensajeCopia, setMensajeCopia] = useState('');

    // --- GUARDAR CAMBIOS ---
    const guardarCambios = async () => {
        setGuardando(true);
        try {
            await updateDoc(doc(db, "users", usuario.uid), formData);
            if (onUpdate) onUpdate();
            alert("¡Perfil actualizado!");
            onClose();
        } catch (e) {
            console.error(e);
            alert("Error al guardar.");
        }
        setGuardando(false);
    };

    // --- SOPORTE ---
    const copiarSoporte = () => {
        navigator.clipboard.writeText("goladen@gmail.com");
        setMensajeCopia("Has copiado el e-mail para soporte. Ve a tu correo y notifica lo que necesites.");
        setTimeout(() => setMensajeCopia(''), 5000);
    };

    // --- ELIMINAR CUENTA ---
    const eliminarCuenta = async () => {
        setFaseBaja('DESPIDIENDO');
        try {
            // 1. Borrar recursos (solo si es profesor tiene, si es alumno no hará nada o borrará sus respuestas si implementamos eso)
            const q = query(collection(db, "resources"), where("profesorUid", "==", usuario.uid));
            const snapshot = await getDocs(q);
            const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
            await Promise.all(deletePromises);

            // 2. Borrar datos de usuario
            await deleteDoc(doc(db, "users", usuario.uid));

            // 3. Borrar Auth
            if (auth.currentUser) await deleteUser(auth.currentUser);

            setTimeout(() => { window.location.href = LINK_BAJA_FEEDBACK; }, 4000);
        } catch (error) {
            console.error("Error borrando cuenta:", error);
            alert("Error al borrar cuenta. Intenta cerrar sesión y volver a entrar.");
            setFaseBaja('NORMAL');
        }
    };

    if (faseBaja === 'DESPIDIENDO') return (
        <div style={styles.overlay}><div style={styles.cardDespedida}><Heart size={60} color="#e74c3c" style={{ marginBottom: 20 }} /><h2>Sentimos mucho que te vayas</h2><p>Esperamos verte pronto...</p></div></div>
    );

    return (
        <div style={styles.overlay}>
            <div style={styles.card}>
                <button onClick={onClose} style={styles.btnClose}><X size={20} /></button>

                <div style={styles.header}>
                    <div style={styles.avatarContainer}><img src={usuario.photoURL} alt="Avatar" style={styles.avatar} /></div>
                    <h2 style={{ margin: '10px 0 5px 0' }}>Mi Perfil</h2>
                    <p style={{ color: '#666', fontSize: '14px' }}>{usuario.email}</p>
                </div>

                <div style={styles.scrollArea}>
                    <SectionTitle icon={<User size={18} />} title="Datos Personales" />
                    <Input label="Nombre visible" val={formData.displayName} set={v => setFormData({ ...formData, displayName: v })} />

                    <SectionTitle icon={<MapPin size={18} />} title="Ubicación" />
                    <div style={styles.row}>
                        <Input label="País" val={formData.pais} set={v => setFormData({ ...formData, pais: v })} />
                        <Input label="Región" val={formData.region} set={v => setFormData({ ...formData, region: v })} />
                    </div>
                    <Input label="Población" val={formData.poblacion} set={v => setFormData({ ...formData, poblacion: v })} />

                    <div style={{ marginBottom: 15 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 'bold', color: '#555', marginBottom: 5 }}>Ciclo Educativo</label>
                        <select
                            value={formData.ciclo}
                            onChange={e => setFormData({ ...formData, ciclo: e.target.value })}
                            style={styles.input}
                        >
                            <option value="Infantil">Infantil</option>
                            <option value="Primaria">Primaria</option>
                            <option value="Secundaria">Secundaria</option>
                            <option value="Bachillerato">Bachillerato</option>
                            <option value="FP">Formación Profesional</option>
                            <option value="Universidad">Universidad</option>
                            <option value="Otros">Otros</option>
                        </select>
                    </div>





                    <SectionTitle icon={<Heart size={18} />} title="Intereses" />
                    <Input label="Temas Preferidos" val={formData.temasPreferidos} set={v => setFormData({ ...formData, temasPreferidos: v })} placeholder="Ej: Matemáticas, Historia, Gamificación..." />

                    <div style={styles.divider}></div>

                    <div style={styles.actionsGrid}>
                        {/* CONDICIÓN: SOLO MOSTRAMOS SOPORTE SI showSupport ES TRUE */}
                        {showSupport && (
                            <ActionButton icon={<LifeBuoy size={18} />} label="Soporte" onClick={copiarSoporte} color="#2980b9" bg="#eaf2f8" />
                        )}
                        <ActionButton icon={<Shield size={18} />} label="Privacidad" onClick={() => window.open(LINK_PRIVACIDAD, '_blank')} color="#27ae60" bg="#eafaf1" />
                    </div>

                    {mensajeCopia && <div style={styles.toast}><CheckCircle size={16} /> {mensajeCopia}</div>}

                    {faseBaja === 'NORMAL' ? (
                        <button onClick={() => setFaseBaja('CONFIRMACION')} style={styles.btnDanger}><Trash2 size={16} /> Darse de baja</button>
                    ) : (
                            <div style={styles.dangerZone}>
                                <AlertTriangle size={30} color="#c0392b" />
                                <p style={{ fontWeight: 'bold', color: '#c0392b' }}>¿Estás seguro?</p>
                                <div style={{ display: 'flex', gap: 10, marginTop: 10, justifyContent: 'center' }}>
                                    <button onClick={eliminarCuenta} style={styles.btnConfirmDelete}>SÍ, ELIMINAR</button>
                                    <button onClick={() => setFaseBaja('NORMAL')} style={styles.btnCancelDelete}>VOLVER</button>
                                </div>
                            </div>
                        )}
                </div>

                <div style={styles.footer}>
                    <button onClick={guardarCambios} disabled={guardando} style={styles.btnSave}>{guardando ? 'Guardando...' : <><Save size={18} /> Guardar Cambios</>}</button>
                </div>
            </div>
        </div>
    );
}

// ... (MANTÉN EL RESTO DE COMPONENTES AUXILIARES Y ESTILOS IGUAL QUE ANTES)
const Input = ({ label, val, set, placeholder }) => (<div style={{ marginBottom: 15 }}><label style={{ display: 'block', fontSize: 12, fontWeight: 'bold', color: '#555', marginBottom: 5 }}>{label}</label><input value={val} onChange={e => set(e.target.value)} placeholder={placeholder} style={styles.input} /></div>);
const SectionTitle = ({ icon, title }) => (<div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#3F51B5', fontWeight: 'bold', marginTop: 20, marginBottom: 10 }}>{icon} {title}</div>);
const ActionButton = ({ icon, label, onClick, color, bg }) => (<button onClick={onClick} style={{ ...styles.actionBtn, color, background: bg }}>{icon} {label}</button>);

const styles = {
    overlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 },
    card: { background: 'white', width: '90%', maxWidth: '450px', maxHeight: '90vh', borderRadius: '20px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' },
    cardDespedida: { background: 'white', padding: 40, borderRadius: 20, textAlign: 'center' },
    btnClose: { position: 'absolute', top: 15, right: 15, background: '#f1f1f1', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    header: { padding: '30px 20px 10px', textAlign: 'center', background: 'linear-gradient(135deg, #e3f2fd 0%, #ffffff 100%)' },
    avatarContainer: { width: 80, height: 80, margin: '0 auto', borderRadius: '50%', padding: 3, background: 'linear-gradient(45deg, #3F51B5, #E91E63)' },
    avatar: { width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '3px solid white' },
    scrollArea: { padding: '0 25px', overflowY: 'auto', flex: 1 },
    input: { width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, outline: 'none', transition: 'border 0.2s', boxSizing: 'border-box' },
    row: { display: 'flex', gap: 10 },
    divider: { height: 1, background: '#eee', margin: '20px 0' },
    actionsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 },
    actionBtn: { padding: 12, border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 'bold', fontSize: 13 },
    toast: { background: '#2ecc71', color: 'white', padding: 10, borderRadius: 8, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 15 },
    btnDanger: { width: '100%', padding: 12, background: 'none', border: '1px solid #e74c3c', color: '#e74c3c', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 'bold' },
    dangerZone: { background: '#fdedec', padding: 15, borderRadius: 10, border: '1px solid #fadbd8', textAlign: 'center' },
    btnConfirmDelete: { background: '#c0392b', color: 'white', border: 'none', padding: '8px 15px', borderRadius: 5, cursor: 'pointer', fontWeight: 'bold' },
    btnCancelDelete: { background: 'white', color: '#555', border: '1px solid #ccc', padding: '8px 15px', borderRadius: 5, cursor: 'pointer' },
    footer: { padding: 20, borderTop: '1px solid #eee', background: 'white' },
    btnSave: { width: '100%', padding: 14, background: 'linear-gradient(45deg, #3F51B5, #5C6BC0)', color: 'white', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 4px 10px rgba(63, 81, 181, 0.3)' }
};