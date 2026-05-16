import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';

const THEME_COLORS = {
  dark:   { bg: 'linear-gradient(135deg,#1a0533,#0d1b4a)', accent: '#6c63ff', text: '#fff' },
  purple: { bg: 'linear-gradient(135deg,#6c63ff,#a855f7,#ec4899)', accent: '#fff', text: '#fff' },
  light:  { bg: '#f0f4ff', accent: '#6c63ff', text: '#1a1a2e' },
  blue:   { bg: 'linear-gradient(160deg,#0A0E45,#0d0d2b)', accent: '#a78bfa', text: '#fff' },
  green:  { bg: 'linear-gradient(135deg,#064e3b,#065f46)', accent: '#34d399', text: '#fff' },
  orange: { bg: 'linear-gradient(135deg,#7c2d12,#431407)', accent: '#fb923c', text: '#fff' },
};

function PresentationCard({ pres, onEdit, onPreview, onDelete, deleting }) {
  const numSlides = pres.slides?.length || 0;
  const theme = THEME_COLORS[pres.slides?.[0]?.theme] || THEME_COLORS.dark;
  const updatedAt = pres.updatedAt?.toDate?.() || (pres.updatedAt ? new Date(pres.updatedAt) : null);
  const dateStr = updatedAt ? updatedAt.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  return (
    <div style={{
      background: '#1f2937', border: '1px solid #374151', borderRadius: 16,
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      transition: 'transform 0.15s, box-shadow 0.15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
    >
      {/* Mini preview */}
      <div style={{ height: 120, background: theme.bg, position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ textAlign: 'center', maxWidth: '90%' }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: theme.text, lineHeight: 1.2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {pres.titulo || 'Sin título'}
          </div>
          <div style={{ marginTop: 6, display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
            {pres.slides?.slice(0, 5).map((s, i) => (
              <div key={i} style={{ width: 20, height: 12, borderRadius: 3, background: theme.accent, opacity: 0.6 + i * 0.08 }} />
            ))}
            {numSlides > 5 && <div style={{ fontSize: 9, color: theme.text, opacity: 0.7, alignSelf: 'center' }}>+{numSlides - 5}</div>}
          </div>
        </div>
        <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.4)', borderRadius: 8, padding: '2px 8px', fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: 700 }}>
          {numSlides} diap.
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontWeight: 800, color: '#fff', fontSize: 14, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {pres.titulo || 'Sin título'}
        </div>
        {dateStr && <div style={{ fontSize: 11, color: '#6b7280' }}>Actualizado: {dateStr}</div>}
      </div>

      {/* Actions */}
      <div style={{ padding: '0 14px 14px', display: 'flex', gap: 6 }}>
        <button onClick={onEdit} style={{ flex: 1, background: '#6c63ff', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 0', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
          ✏️ Editar
        </button>
        <button onClick={onPreview} style={{ flex: 1, background: '#374151', color: '#e5e7eb', border: 'none', borderRadius: 8, padding: '7px 0', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
          👁️ Ver
        </button>
        <button onClick={onDelete} disabled={deleting} style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', fontSize: 12 }}>
          {deleting ? '…' : '🗑️'}
        </button>
      </div>
    </div>
  );
}

export default function PresentationList({ usuario, onNew, onEdit }) {
  const [presentaciones, setPresentaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    if (!usuario) return;
    setLoading(true);
    getDocs(query(
      collection(db, 'presentations'),
      where('uid', '==', usuario.uid)
    )).then(snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => {
        const ta = a.updatedAt?.toMillis?.() || 0;
        const tb = b.updatedAt?.toMillis?.() || 0;
        return tb - ta;
      });
      setPresentaciones(docs);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [usuario]);

  const handleDelete = async (pres) => {
    if (!window.confirm(`¿Eliminar "${pres.titulo}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(pres.id);
    try {
      await deleteDoc(doc(db, 'presentations', pres.id));
      setPresentaciones(prev => prev.filter(p => p.id !== pres.id));
    } catch (e) {
      alert('Error al eliminar: ' + e.message);
    }
    setDeleting(null);
  };

  const handlePreview = (pres) => {
    window.open(`/pikt-viewer.html?id=${pres.id}`, '_blank');
  };

  return (
    <div style={{ padding: '24px 20px', maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#fff' }}>📊 Mis Presentaciones</h2>
          {!loading && <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{presentaciones.length} presentación{presentaciones.length !== 1 ? 'es' : ''}</div>}
        </div>
        <button onClick={onNew} style={{
          background: 'linear-gradient(135deg,#6c63ff,#a855f7)', color: '#fff', border: 'none',
          borderRadius: 12, padding: '10px 22px', cursor: 'pointer', fontWeight: 800, fontSize: 14,
          display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(108,99,255,0.4)',
        }}>
          + Nueva presentación
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>⏳ Cargando presentaciones…</div>
      )}

      {/* Empty state */}
      {!loading && presentaciones.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>📊</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Todavía no tienes presentaciones</div>
          <div style={{ fontSize: 14, marginBottom: 28, maxWidth: 360, margin: '0 auto 28px' }}>
            Crea presentaciones visuales para tus clases con el editor o déjaselas a la IA.
          </div>
          <button onClick={onNew} style={{
            background: 'linear-gradient(135deg,#6c63ff,#a855f7)', color: '#fff', border: 'none',
            borderRadius: 14, padding: '13px 32px', cursor: 'pointer', fontWeight: 800, fontSize: 15,
          }}>
            + Crear primera presentación
          </button>
        </div>
      )}

      {/* Grid */}
      {!loading && presentaciones.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 16 }}>
          {presentaciones.map(pres => (
            <PresentationCard
              key={pres.id}
              pres={pres}
              onEdit={() => onEdit(pres)}
              onPreview={() => handlePreview(pres)}
              onDelete={() => handleDelete(pres)}
              deleting={deleting === pres.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
