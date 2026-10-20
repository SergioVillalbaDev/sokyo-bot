const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { firmarToken, igualesSeguro } = require('../utils/auth.js');
const { crearAutenticacion, staffDeServidor, soloSesionDiscord, esStaffDe, infoServidor } = require('./middleware.js');
const rutasStaff = require('./staff.js');
const rutasPortal = require('./portal.js');

const COOKIE_ESTADO = 'sokyo_oauth_state';

function leerCookie(req, nombre) {
    const cookies = req.headers.cookie || '';
    const par = cookies.split(';').map(c => c.trim()).find(c => c.startsWith(`${nombre}=`));
    return par ? decodeURIComponent(par.slice(nombre.length + 1)) : null;
}

module.exports = (client) => {
    const app = express();
    const port = Number(process.env.PORT) || 3000;
    const API_KEY = process.env.API_KEY || '';
    const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
    const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
    const OAUTH_REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || `http://localhost:${port}/api/auth/discord/callback`;
    const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    const oauthActivo = Boolean(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET);

    let JWT_SECRET = process.env.JWT_SECRET || API_KEY;
    if (!JWT_SECRET || JWT_SECRET === 'cambia-este-secreto-de-sesion') {
        // Nunca firmamos sesiones con un secreto conocido: cualquiera podría falsificarlas.
        JWT_SECRET = crypto.randomBytes(32).toString('hex');
        console.warn('⚠️  JWT_SECRET no está definido: se usa uno aleatorio y las sesiones se cerrarán al reiniciar el bot.');
    }
    if (!oauthActivo) console.warn('⚠️  DISCORD_CLIENT_ID/SECRET no definidos: el login con Discord (panel y portal) está desactivado.');
    if (!oauthActivo && !API_KEY) console.warn('⚠️  Sin OAuth ni API_KEY nadie podrá entrar al panel web. Configura al menos uno de los dos.');

    const autenticar = crearAutenticacion({ apiKey: API_KEY, jwtSecret: JWT_SECRET });

    app.disable('x-powered-by');
    // La API se autentica con cabeceras (no cookies), así que CORS abierto no permite CSRF
    // y deja abrir el panel desde cualquier dispositivo de la red.
    app.use(cors());
    app.use(express.json({ limit: '100kb' }));

    // ------------------------------------------------------------ públicas

    app.get('/api/estado', (req, res) => res.json({
        ok: true,
        message: 'Sokyo Bot está operativo',
        discord: client.isReady(),
        servidores: client.guilds.cache.size
    }));

    app.get('/api/auth/config', (req, res) => res.json({ discord: oauthActivo, apiKey: Boolean(API_KEY) }));

    // 1. Inicio del login con Discord
    app.get('/api/auth/discord', (req, res) => {
        if (!oauthActivo) return res.status(503).send('El login con Discord no está configurado en el servidor.');

        // La cookie de estado debe quedar en el mismo host que recibe el callback.
        const callback = new URL(OAUTH_REDIRECT_URI);
        if (req.get('host') !== callback.host) return res.redirect(new URL('/api/auth/discord', callback).href);

        const estado = crypto.randomBytes(16).toString('hex');
        res.cookie(COOKIE_ESTADO, estado, { httpOnly: true, sameSite: 'lax', secure: callback.protocol === 'https:', maxAge: 10 * 60 * 1000 });
        const params = new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            redirect_uri: OAUTH_REDIRECT_URI,
            response_type: 'code',
            scope: 'identify',
            state: estado
        });
        res.redirect(`https://discord.com/oauth2/authorize?${params}`);
    });

    // 2. Callback: valida el estado (anti-CSRF), obtiene el usuario y emite la sesión.
    //    El token viaja en el fragmento (#), que el navegador nunca envía a ningún servidor.
    app.get('/api/auth/discord/callback', async (req, res) => {
        const volver = (params) => res.redirect(`${FRONTEND_URL}/#${new URLSearchParams(params)}`);
        const { code, state, error } = req.query;
        const estadoGuardado = leerCookie(req, COOKIE_ESTADO);
        res.clearCookie(COOKIE_ESTADO);

        if (error || !code) return volver({ error: 'denegado' });
        if (!state || !estadoGuardado || !igualesSeguro(state, estadoGuardado)) return volver({ error: 'estado' });

        try {
            const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: DISCORD_CLIENT_ID,
                    client_secret: DISCORD_CLIENT_SECRET,
                    grant_type: 'authorization_code',
                    code: String(code),
                    redirect_uri: OAUTH_REDIRECT_URI
                })
            });
            const tokenData = await tokenRes.json();
            if (!tokenRes.ok || !tokenData.access_token) throw new Error(`Discord no devolvió access_token (${tokenRes.status})`);

            const userRes = await fetch('https://discord.com/api/users/@me', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` }
            });
            const user = await userRes.json();
            if (!userRes.ok || !user.id) throw new Error(`No se pudo leer el usuario de Discord (${userRes.status})`);

            const avatar = user.avatar
                ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
                : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(user.id) >> 22n) % 6n)}.png`;
            volver({ token: firmarToken({ id: user.id, username: user.username, avatar }, JWT_SECRET) });
        } catch (err) {
            console.error('Error en el callback de OAuth:', err.message);
            volver({ error: 'oauth' });
        }
    });

    // ------------------------------------------------------- autenticadas

    // Datos de la sesión + servidores donde se es staff (para el selector del panel).
    app.get('/api/yo', autenticar, async (req, res) => {
        const servidores = [];
        for (const guild of client.guilds.cache.values()) {
            if (req.auth.tipo === 'apikey' || await esStaffDe(guild, req.auth.usuario.id)) servidores.push(infoServidor(guild));
        }
        servidores.sort((a, b) => a.nombre.localeCompare(b.nombre));
        res.json({ ...req.auth.usuario, tipo: req.auth.tipo, servidores });
    });

    app.use('/api/servidores/:guildId', autenticar, staffDeServidor(client), rutasStaff(client));
    app.use('/api/portal', autenticar, soloSesionDiscord, rutasPortal(client));

    app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

    // Errores: siempre en JSON y con un mensaje entendible.
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
        if (err.name === 'TicketError') return res.status(err.status || 400).json({ error: err.message, codigo: err.codigo });
        if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'El cuerpo de la petición no es JSON válido.' });
        if (err.type === 'entity.too.large') return res.status(413).json({ error: 'La petición es demasiado grande.' });
        if (err.code === 50013) return res.status(403).json({ error: 'Al bot le faltan permisos en Discord para hacer eso.' });
        if (err.code === 50001) return res.status(403).json({ error: 'El bot no tiene acceso a ese canal.' });
        console.error('❌ Error en la API:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    });

    // En Express 5 este callback también recibe el error de arranque (se gestiona abajo).
    const servidor = app.listen(port, (error) => { if (!error) console.log(`🌐 API escuchando en el puerto ${port}`); });
    servidor.on('error', (error) => {
        if (error.code === 'EADDRINUSE') console.error(`🔴 El puerto ${port} ya está en uso. Cierra el otro proceso o cambia PORT en el .env.`);
        else console.error('🔴 Error en la API:', error);
        process.exit(1);
    });
    return servidor;
};
