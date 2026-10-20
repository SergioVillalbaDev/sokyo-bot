// Cliente de Discord simulado con lo mínimo que usan la API, los comandos y el ticketManager.
const { Collection, ChannelType, PermissionsBitField, PermissionFlagsBits } = require('discord.js');

let seq = 1000;
const nuevoId = () => String(++seq) + '000000000000';

function crearCliente() {
    const client = {
        guilds: { cache: new Collection() },
        channels: { cache: new Collection(), fetch: async (id) => client.channels.cache.get(id) || Promise.reject(new Error('Unknown Channel')) },
        users: { fetch: async (id) => ({ id, username: `user${id}`, send: async (p) => { client.dms.push({ id, p }); return {}; } }) },
        user: { id: 'bot', tag: 'Sokyo#0001', displayAvatarURL: () => 'https://cdn.discordapp.com/avatars/bot.png' },
        rest: { post: async () => ({ refreshed_urls: [] }) },
        isReady: () => true,
        dms: [],
        enviados: []
    };
    return client;
}

function crearMiembro(guild, id, username, { admin = false, roles = [] } = {}) {
    const perms = new PermissionsBitField(admin ? PermissionFlagsBits.Administrator : PermissionFlagsBits.ViewChannel);
    const miembro = {
        id, guild,
        user: { id, username, bot: false, displayAvatarURL: () => `https://cdn.discordapp.com/avatars/${id}.png` },
        permissions: perms,
        roles: { cache: new Collection(roles.map(r => [r, { id: r }])) }
    };
    guild.members.cache.set(id, miembro);
    return miembro;
}

function crearCanal(client, guild, { name, type = ChannelType.GuildText, parent = null }) {
    const canal = {
        id: nuevoId(), name, type, guild, parentId: parent, rawPosition: guild.channels.cache.size,
        get parent() { return guild.channels.cache.get(this.parentId) || null; },
        children: { get cache() { return guild.channels.cache.filter(c => c.parentId === canal.id); } },
        mensajes: new Map(),
        overwrites: new Map(),
        isTextBased: () => type !== ChannelType.GuildCategory,
        isThread: () => false,
        permissionsFor: () => ({ has: () => true }),
        async send(payload) {
            const msg = {
                id: nuevoId(), payload, url: `https://discord.com/channels/${guild.id}/${canal.id}/x`,
                edit: async (p) => { msg.payload = p; return msg; }
            };
            canal.mensajes.set(msg.id, msg);
            client.enviados.push({ canal: canal.id, payload });
            return msg;
        },
        messages: { fetch: async (id) => canal.mensajes.get(id) || Promise.reject(new Error('Unknown Message')) },
        async setParent(id) { canal.parentId = id; return canal; },
        async setName(n) { canal.name = n; return canal; },
        permissionOverwrites: {
            edit: async (id, opts) => { canal.overwrites.set(id, { ...(canal.overwrites.get(id) || {}), ...opts }); },
            delete: async (id) => { canal.overwrites.delete(id); }
        },
        async delete() { guild.channels.cache.delete(canal.id); client.channels.cache.delete(canal.id); }
    };
    guild.channels.cache.set(canal.id, canal);
    client.channels.cache.set(canal.id, canal);
    return canal;
}

function crearServidor(client, { id, name }) {
    const guild = {
        id, name, available: true, memberCount: 3,
        iconURL: () => null,
        channels: { cache: new Collection() },
        roles: { cache: new Collection() },
        members: {
            cache: new Collection(),
            fetch: async (uid) => guild.members.cache.get(uid) || Promise.reject(new Error('Unknown Member'))
        }
    };
    guild.channels.create = async ({ name, type, parent, permissionOverwrites }) => {
        const canal = crearCanal(client, guild, { name, type, parent });
        (permissionOverwrites || []).forEach(o => canal.overwrites.set(o.id, o));
        return canal;
    };
    guild.roles.cache.set(id, { id, name: '@everyone', position: 0, hexColor: '#000000', managed: false });
    guild.roles.everyone = guild.roles.cache.get(id);
    guild.roles.cache.set('rolstaff', { id: 'rolstaff', name: 'Soporte', position: 2, hexColor: '#ff0000', managed: false });
    guild.members.me = crearMiembro(guild, 'bot', 'Sokyo', { admin: true });
    client.guilds.cache.set(id, guild);
    return guild;
}

module.exports = { crearCliente, crearServidor, crearMiembro, crearCanal };
