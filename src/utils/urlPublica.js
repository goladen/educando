// Base de los enlaces de «compartir». En la vista alumno del profe (pikt.es/alumno/…) la URL
// actual no le sirve a quien no tiene cuenta, así que se comparte desde la raíz.
export const basePublica = () =>
    window.location.origin + (/^\/alumno(\/|$)/i.test(window.location.pathname) ? '/' : window.location.pathname);
