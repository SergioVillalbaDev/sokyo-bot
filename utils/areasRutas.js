// Qué ÁREA del panel hace falta para cada ruta de la API (2.0.0). Antes muchas rutas solo
// miraban que la persona fuera staff de ESE servidor: un moderador con acceso solo a
// «Tickets» podía, llamando a la API a mano, cambiar el casino o borrar un sorteo. Ahora el
// middleware de api/server.js (exigirAreaPorRuta) mira esta tabla en CADA petición del staff
// (no de los propietarios ni de la clave de soporte) y, si la ruta tiene área, comprueba que
// la persona la tenga en ese servidor. Las rutas que ya llevan exigeArea() siguen igual
// (comprobarlo dos veces no hace daño).
//
// Cada regla: [métodos, expresión de la ruta (sin /api), área, modelo para saber el servidor
// de un recurso por id (opcional)]. Las rutas de «elegir de una lista» (canales, roles,
// miembros) quedan fuera a propósito: las usan todos los desplegables del panel.
const TODOS = 'GET,POST,PUT,PATCH,DELETE';
const ESCRIBIR = 'POST,PUT,PATCH,DELETE';

const REGLAS = [
    // ---- Comunidad y diversión
    [TODOS, /^\/sorteos(\/|$)/, 'comunidad', 'Sorteo'],
    [TODOS, /^\/eventos(\/|$)/, 'comunidad', 'Evento'],
    [TODOS, /^\/encuestas(\/|$)/, 'comunidad', 'Encuesta'],
    [TODOS, /^\/sugerencias(\/|$)/, 'comunidad', 'Sugerencia'],
    [TODOS, /^\/presentaciones(\/|$)/, 'comunidad', 'Presentacion'],
    [TODOS, /^\/trivia(\/|$)/, 'comunidad', 'TriviaPregunta'],
    [ESCRIBIR, /^\/config\/[^/]+\/(sugerencias|presentaciones|dinamicas)$/, 'comunidad'],
    [TODOS, /^\/config\/[^/]+\/modulos\/(cumpleanos|salon|grupos|clanes|confesiones|temporadas|bromas|mascota|casino|compis)(\/|$)/, 'comunidad'],
    [TODOS, /^\/config\/[^/]+\/economia$/, 'comunidad'],
    [TODOS, /^\/config\/[^/]+\/modulos\/tienda(\/|$)/, 'roles'],
    [TODOS, /^\/config\/[^/]+\/modulos\/solicitudes(\/|$)/, 'roles'],
    [TODOS, /^\/config\/[^/]+\/modulos\/(ausente|fijos|contadores)(\/|$)/, 'mensajes'],
    // ---- Música y voz
    [TODOS, /^\/config\/[^/]+\/voztemporal(\/|$)/, 'musica'],
    [TODOS, /^\/config\/[^/]+\/musica(\/|$)/, 'musica'],
    // ---- Tickets
    [TODOS, /^\/tickets(\/|$)/, 'tickets'],
    [TODOS, /^\/usuarios\/stats$/, 'tickets'],
    // ---- Moderación
    [TODOS, /^\/reportes(\/|$)/, 'moderacion', 'Reporte'],
    [TODOS, /^\/sanciones\/tipos(\/|$)/, 'moderacion', 'TipoSancion'],
    [TODOS, /^\/sanciones(\/|$)/, 'moderacion', 'Sancion'],
    // ---- Roles
    [TODOS, /^\/paneles(\/|$)/, 'roles', 'RolePanel'],
    [ESCRIBIR, /^\/roles(\/|$)/, 'roles'],
    // ---- Mensajes y anuncios
    [TODOS, /^\/anuncios\/presets(\/|$)/, 'mensajes', 'AnuncioPreset'],
    [TODOS, /^\/anuncios(\/|$)/, 'mensajes', 'AnuncioProgramado'],
    [ESCRIBIR, /^\/embed\//, 'mensajes'],
    // ---- Datos y registro
    [TODOS, /^\/stats\/analitica(\/|$)/, 'datos'], // /stats/uso no: lo lee la cabecera del panel (plan) para todos
    [TODOS, /^\/logs(\/|$)/, 'logs'],
    // ---- Servidor y ajustes
    [ESCRIBIR, /^\/servidor\/(emojis|stickers)(\/|$)/, 'config'],
    [ESCRIBIR, /^\/config\/[^/]+\/modulos\/organizar-canales$/, 'config'],
    // ---- Plan y facturación
    [ESCRIBIR, /^\/billing\/(checkout|portal)$/, 'cuenta'],
];

// Devuelve { area, modelo } para esta petición, o null si la ruta no tiene área.
function areaDeRuta(metodo, ruta) {
    const p = String(ruta || '').replace(/^\/api(?=\/)/, '');
    for (const [metodos, re, area, modelo] of REGLAS) {
        if (metodos.split(',').includes(metodo) && re.test(p)) return { area, modelo: modelo || null };
    }
    return null;
}

// Id de Mongo que va en la ruta (para buscar de qué servidor es el recurso).
function idDeRuta(ruta) {
    const m = String(ruta || '').match(/\/([0-9a-f]{24})(?:\/|$)/i);
    return m ? m[1] : null;
}

// Servidor al que apunta la petición: el de la ruta (/config/:guildId), el de la query o el del cuerpo.
function guildDeRuta(req) {
    const p = String(req.path || '').replace(/^\/api(?=\/)/, '');
    const m = p.match(/^\/(?:config|seguridad|bienvenidas|cuenta|embed|embudo|resumen)\/([^/]+)/);
    return (m && m[1]) || req.query?.guildId || req.body?.guildId || null;
}

module.exports = { REGLAS, areaDeRuta, idDeRuta, guildDeRuta };
