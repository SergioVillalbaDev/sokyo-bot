// El pie «Powered by Sokyo» que el bot pone en sus mensajes de los servidores Free
// (utils/marca.js: pieMarca). Para las vistas previas del panel. `esPremium` empieza en
// null («cargando») y nunca se trata como Free.
export const pieMarca = (esPremium) => (esPremium === false ? 'Powered by Sokyo' : '');
