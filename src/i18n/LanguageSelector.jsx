// Selector de idioma. Colócalo en cualquier cabecera/menú:
//   import LanguageSelector from './i18n/LanguageSelector';
//   <LanguageSelector />
import { useLanguage } from './LanguageContext';

export default function LanguageSelector({ compacto = false }) {
    const { idioma, setIdioma, idiomas } = useLanguage();

    return (
        <select
            value={idioma}
            onChange={(e) => setIdioma(e.target.value)}
            title="Cambiar idioma"
            aria-label="Cambiar idioma"
            style={{
                padding: compacto ? '2px 6px' : '6px 10px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                background: '#fff',
                fontSize: compacto ? 13 : 14,
                cursor: 'pointer',
            }}
        >
            {Object.entries(idiomas).map(([codigo, info]) => (
                <option key={codigo} value={codigo}>
                    {info.bandera} {info.etiqueta}
                </option>
            ))}
        </select>
    );
}
