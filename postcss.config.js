// Invasión Pi usa Tailwind v4, que escribe los colores en oklch() y color-mix(). Los navegadores
// antiguos (Chrome < 111, p. ej. el Chrome 109 de Windows 7/8.1, Firefox < 113) no los entienden:
// los fondos quedaban transparentes y el juego se veía «a oscuras», sin gráficos.
// Este paso pasa la hoja del juego por Lightning CSS con navegadores antiguos como objetivo:
// convierte los colores a hex (y deja la versión P3 dentro de @supports para los modernos).
import postcss from 'postcss';

let lightning = null;
try { lightning = await import('lightningcss'); } catch { /* sin lightningcss: se deja tal cual */ }

const OBJETIVOS = { chrome: 69 << 16, edge: 79 << 16, firefox: 60 << 16, safari: 12 << 16, ios_saf: 12 << 16 };

const compatAntiguos = () => ({
  postcssPlugin: 'pikt-compat-navegadores-antiguos',
  OnceExit(root) {
    const file = (root.source?.input?.file || '').replace(/\\/g, '/');
    if (!lightning || !/\/src\/invasores\//.test(file)) return;
    // Sin @layer (Chrome < 99 ignora el bloque entero): las variables iniciales de Tailwind van fuera.
    root.walkAtRules('layer', (r) => { if (r.nodes) r.replaceWith(r.nodes); else r.remove(); });
    const { code } = lightning.transform({
      filename: file, code: Buffer.from(root.toString()), targets: OBJETIVOS, minify: false, errorRecovery: true,
    });
    root.removeAll();
    root.append(postcss.parse(code.toString(), { from: file }).nodes);
  },
});
compatAntiguos.postcss = true;

export default {
  plugins: [
    (await import('@tailwindcss/postcss')).default(),
    compatAntiguos(),
    (await import('autoprefixer')).default(),
  ],
};
