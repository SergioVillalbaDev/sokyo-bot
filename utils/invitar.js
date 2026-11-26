// ➕ Invitar a Sokyo (2.3.1). Un solo sitio para el enlace de añadir el bot a un servidor y para que el
// PERFIL del bot en Discord tenga el botón «Añadir app» (eso sale solo si la aplicación tiene enlace de
// instalación: se configura aquí al arrancar, como la descripción en utils/descripcionBot.js).
//  · Permisos: los mismos que el botón de la web (Administrador, así el setup rápido puede crearlo todo).
//    Se cambian con PERMISOS_INVITACION en el .env. Instalar en servidor = scopes bot + applications.commands.
//  · Si en el portal de Discord el bot no es «Public Bot», nadie más puede añadirlo: no se puede arreglar
//    desde aquí; /api/health (instalacion.publico) y los registros lo avisan.
//  · INSTALACION_AUTOMATICA=no lo apaga (por si alguien prefiere tocarlo a mano en el portal).
const { Routes } = require('discord.js');

const SCOPES = ['applications.commands', 'bot'];
const permisos = () => String(process.env.PERMISOS_INVITACION || '8');
const estado = { comprobado: false, publico: null, enlace: null, error: null };

function urlInvitar({ guildId = null, clientId = null } = {}) {
    const id = clientId || process.env.DISCORD_CLIENT_ID;
    if (!id) return null;
    const p = new URLSearchParams({ client_id: id, scope: SCOPES.slice().reverse().join(' '), permissions: permisos() });
    if (guildId) { p.set('guild_id', guildId); p.set('disable_guild_select', 'true'); }
    return `https://discord.com/oauth2/authorize?${p}`;
}

const mismos = (a, b) => JSON.stringify({ s: [...(a?.scopes || [])].sort(), p: String(a?.permissions ?? '') }) === JSON.stringify({ s: [...(b?.scopes || [])].sort(), p: String(b?.permissions ?? '') });

// Pone (si hace falta) el enlace de instalación «de Discord» para servidores. Deja como esté la instalación
// para usuarios y un enlace propio si alguien lo puso a mano. Devuelve el estado.
async function ponerInstalacion(client) {
    if (String(process.env.INSTALACION_AUTOMATICA || '').toLowerCase() === 'no') return estado;
    try {
        const app = await client.rest.get(Routes.currentApplication());
        estado.comprobado = true;
        estado.publico = app.bot_public !== false;
        if (!estado.publico) console.warn('⚠️ El bot NO es público: en el portal de Discord (Bot → Public Bot) hay que activarlo para que otros puedan añadirlo.');
        if (app.custom_install_url) { estado.enlace = 'propio'; return estado; }
        const quiero = { scopes: SCOPES, permissions: permisos() };
        const tipos = { ...(app.integration_types_config || {}) };
        const yaEsta = mismos(app.install_params, quiero) && mismos(tipos['0']?.oauth2_install_params, quiero);
        if (yaEsta) { estado.enlace = 'discord'; return estado; }
        tipos['0'] = { ...(tipos['0'] || {}), oauth2_install_params: quiero };
        try {
            await client.rest.patch(Routes.currentApplication(), { body: { install_params: quiero, integration_types_config: tipos } });
        } catch (e) {
            // Por si Discord no acepta la configuración por tipos: al menos el enlace de siempre.
            await client.rest.patch(Routes.currentApplication(), { body: { install_params: quiero } });
            console.warn('Instalación del bot (solo install_params):', e.message);
        }
        estado.enlace = 'discord';
        console.log('➕ Enlace de instalación del bot puesto: el perfil del bot ya tiene «Añadir app».');
    } catch (e) {
        estado.error = String(e.message || e).slice(0, 200);
        console.error('Instalación del bot:', estado.error);
    }
    return estado;
}

module.exports = { SCOPES, permisos, urlInvitar, ponerInstalacion, estado };
