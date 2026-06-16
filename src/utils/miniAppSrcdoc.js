// Quita import/export sueltos que la IA añade a veces a pesar de las instrucciones.
// Sin esto, el navegador rompe al insertar el <script> porque Babel standalone
// no transforma módulos ES por defecto (solo JSX), y "import"/"export" no son
// válidos en un script clásico.
function stripModuleSyntax(code) {
  return code
    .replace(/^[ \t]*import\s[\s\S]*?from\s*['"][^'"]+['"]\s*;?/gm, '')
    .replace(/^[ \t]*import\s*['"][^'"]+['"]\s*;?/gm, '')
    .replace(/^[ \t]*export\s+default\s+(function|class)/gm, '$1')
    .replace(/^[ \t]*export\s+default\s+\w+\s*;?\s*$/gm, '')
    .replace(/^[ \t]*export\s+\{[^}]*\}\s*;?\s*$/gm, '')
    .replace(/^[ \t]*export\s+(const|let|var|function|class)\s+/gm, '$1 ');
}

// Shared builder for the sandboxed iframe HTML used in MiniAppCreator and MiniAppViewer
export function buildSrcdoc(code) {
  // Escape </script> inside user code to prevent HTML injection
  const safe = stripModuleSyntax(code).replace(/<\/script>/gi, '<\\/script>');
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone@7.29.7/babel.min.js"></script>
  <script>
    window.onerror = function(msg, src, line) {
      window.parent.postMessage({ type:'miniapp-error', msg: msg + ' (línea '+line+')' }, '*');
    };
    window.addEventListener('unhandledrejection', function(e) {
      window.parent.postMessage({ type:'miniapp-error', msg: String(e.reason) }, '*');
    });
  </script>
  <style>* { box-sizing: border-box; } body { margin: 0; padding: 8px; font-family: system-ui, sans-serif; }</style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect, useRef, useCallback, useMemo, useReducer } = React;
    ${safe}
    try {
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
    } catch(e) {
      window.parent.postMessage({ type:'miniapp-error', msg: e.message }, '*');
    }
  </script>
</body>
</html>`;
}
