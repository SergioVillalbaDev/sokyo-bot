// Validación de variables de entorno críticas. El bot NO arranca si la seguridad está mal configurada
// (antes la API quedaba abierta sin protección si faltaba API_KEY).
const MIN_LONGITUD = 16;

function validarEntorno(env = process.env) {
    const errores = [];
    if (!env.DISCORD_TOKEN) errores.push('DISCORD_TOKEN no está definido.');
    if (!env.MONGO_URI) errores.push('MONGO_URI no está definido.');

    const api = env.API_KEY || '';
    const jwt = env.JWT_SECRET || '';
    if (api.length < MIN_LONGITUD) errores.push(`API_KEY debe tener al menos ${MIN_LONGITUD} caracteres.`);
    if (jwt.length < MIN_LONGITUD) errores.push(`JWT_SECRET debe tener al menos ${MIN_LONGITUD} caracteres.`);
    if (api && jwt && api === jwt) errores.push('JWT_SECRET debe ser DISTINTO de API_KEY.');
    if (/cambia-/i.test(api) || /cambia-/i.test(jwt)) errores.push('API_KEY/JWT_SECRET siguen con el valor de ejemplo de .env.example: genera claves propias.');
    return errores;
}

module.exports = { validarEntorno };
