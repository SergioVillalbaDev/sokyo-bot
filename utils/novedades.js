// Novedades de cada versión: van en el aviso «Bot actualizado» (utils/anuncioActualizacion.js)
// y en la ventana «Novedades» del panel (la primera vez que se entra tras actualizar).
// Al subir la versión del bot, añade aquí lo nuevo en pocas palabras y sin
// tecnicismos: es lo que leen los miembros del servidor. Discord corta los
// mensajes a 2000 caracteres: unas 10-12 líneas como mucho.
// Cada novedad: un texto (solo en español) o { es, en, tab } — `tab` es la
// sección del panel donde está (navConfig.js), para el botón «Ver».
const NOVEDADES = {
    '1.7.0': [
        '🎵 La música vuelve a sonar: el servidor de música se pone al día solo con el audio cifrado que Discord exige desde 2026.',
        '👥 Nueva sección «Miembros» en el panel: todo el servidor en una lista, con botones para aislar, expulsar y banear, y una pestaña de baneados para quitar un ban.',
        '📣 Crear canales de anuncios: el panel dice claro qué pasa (por ejemplo, que el servidor necesita la Comunidad activada) en vez de un error genérico.',
        '🔐 Todos los permisos de Discord en roles y canales, cada uno con su explicación y con buscador.',
        '💾 Autoguardado: los ajustes se guardan solos al dejar de tocarlos (y con Ctrl + S).',
        '↩️ Botón «Atrás» en el panel, y el atrás del navegador ya no te saca de él.',
        '👤 Tu foto, abajo en el menú, abre tu perfil («Mi cuenta») sin volver a entrar, y desde «Mi cuenta» vas directo al panel.',
        '🗂️ Mover categorías sin recorrer toda la página: botón «Mover» en cada una, vista «Solo categorías» y «Al principio» / «Al final».',
        '⚡ Modo ligero automático para PCs con pocos recursos y para Firefox: la web va mucho más fluida.',
        '⌨️ Más comodidad: atajos de teclado (pulsa ?), botón «Volver arriba», secciones recientes en el buscador y aviso si cierras con algo sin guardar.',
    ],
};

const textoDe = (n, idioma = 'es') => (typeof n === 'string' ? n : (n[idioma] || n.es));

// Mensaje del aviso para una versión (null si no tiene novedades apuntadas).
function mensajeNovedades(version) {
    const lista = NOVEDADES[version];
    if (!lista || !lista.length) return null;
    const texto = [
        `🚀 **Sokyo se ha actualizado (v${version})**`,
        '',
        '**Novedades:**',
        ...lista.map((l) => `• ${textoDe(l)}`),
        '',
        '¡Gracias por usar Sokyo!',
    ].join('\n');
    return texto.length <= 2000 ? texto : `${texto.slice(0, 1990)}…`;
}

// Para el panel y la página pública /novedades: [{ texto, tab }] en el idioma pedido.
function novedadesDe(version, idioma = 'es') {
    return (NOVEDADES[version] || []).map((n) => ({ texto: textoDe(n, idioma), tab: typeof n === 'string' ? null : n.tab || null }));
}

module.exports = { NOVEDADES, mensajeNovedades, novedadesDe };
