// Discord simulado para probar el bot sin Discord (scripts/simulador/simular.js).
// Dos servidores (GA, donde se juega, y GB), varias personas, canales que guardan lo que se les
// manda y mensajes que se pueden editar. Solo lo que el bot usa; lo que falte salta como error
// en el informe (así se ve dónde el simulador se queda corto).
const { Collection, PermissionsBitField, MessageFlagsBitField, ChannelType } = require('discord.js');
const F = PermissionsBitField.Flags;

let contador = 1000;
const nuevoId = () => String(900000000000000000n + BigInt(contador++));

function aJSON(x) {
    if (x == null) return x;
    if (typeof x.toJSON === 'function') return x.toJSON();
    return x;
}
// Payload de discord.js (string u objeto con builders) → JSON plano como el que llega a Discord.
function normalizar(p) {
    if (p == null) return {};
    if (typeof p === 'string') return { content: p };
    const o = { ...p };
    if (o.embeds) o.embeds = o.embeds.map(aJSON);
    if (o.components) o.components = o.components.map(aJSON);
    if (o.files) o.files = o.files.map((f) => ({ name: f?.name || f?.attachment?.name || 'archivo', tam: Buffer.isBuffer(f?.attachment) ? f.attachment.length : (Buffer.isBuffer(f) ? f.length : 0) }));
    return o;
}

function rol(guild, id, name, position, perms = 0n, extra = {}) {
    return {
        id, name, position, rawPosition: position, hexColor: '#99aab5', color: 0, managed: false, hoist: false, mentionable: false,
        permissions: new PermissionsBitField(perms), tags: null, icon: null, unicodeEmoji: null, editable: true, guild,
        get members() { return guild.members.cache.filter((m) => m.roles.cache.has(id)); },
        iconURL: () => null, comparePositionTo: (o) => position - o.position, toString: () => `<@&${id}>`,
        edit: async () => guild.roles.cache.get(id), delete: async () => { guild.roles.cache.delete(id); }, setPosition: async () => {},
        ...extra,
    };
}

function crearMensaje(canal, payload, autor) {
    const n = normalizar(payload);
    const m = {
        id: nuevoId(), channelId: canal.id, channel: canal, guild: canal.guild, guildId: canal.guild?.id, author: autor,
        member: canal.guild?.members.cache.get(autor?.id) || null,
        content: n.content || '', embeds: n.embeds || [], components: n.components || [], attachments: new Collection(),
        createdTimestamp: Date.now(), createdAt: new Date(), editable: true, deletable: true, pinned: false, reactions: { cache: new Collection(), removeAll: async () => {} },
        flags: new MessageFlagsBitField(typeof n.flags === "number" ? n.flags : 0), url: `https://discord.com/channels/${canal.guild?.id}/${canal.id}/x`, webhookId: null,
        mentions: { users: new Collection(), roles: new Collection(), members: new Collection(), everyone: false, has: () => false },
        _historial: [n],
        async edit(p) { const x = normalizar(p); m._historial.push(x); if ('content' in x) m.content = x.content || ''; if (x.embeds) m.embeds = x.embeds; if (x.components) m.components = x.components; canal._registro?.({ tipo: 'edit', canal: canal.id, payload: x }); return m; },
        async delete() { canal.messages.cache.delete(m.id); return m; },
        async react() {}, async pin() { m.pinned = true; }, async unpin() { m.pinned = false; },
        async reply(p) { return canal.send(p); }, async fetch() { return m; },
        async startThread({ name }) { return canal.guild._crearCanal(name, ChannelType.PublicThread, canal.id); },
        createMessageComponentCollector() { return { on() {}, stop() {} }; },
        createReactionCollector() { return { on() {}, stop() {} }; },
        awaitMessageComponent: async () => { throw new Error('Collector received no interactions before ending with reason: time'); },
        toString: () => m.url,
    };
    return m;
}

function canal(guild, id, name, type = ChannelType.GuildText, parentId = null) {
    const c = {
        id, name, type, parentId, guild, guildId: guild.id, position: 0, rawPosition: guild.channels.cache.size, topic: '', nsfw: false,
        rateLimitPerUser: 0, userLimit: 0, bitrate: 64000, viewable: true, manageable: true, deletable: true,
        permissionOverwrites: { cache: new Collection(), edit: async () => {}, create: async () => {}, delete: async () => {}, set: async () => {} },
        isTextBased: () => [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.GuildVoice].includes(type),
        isThread: () => type === ChannelType.PublicThread || type === ChannelType.PrivateThread,
        isVoiceBased: () => type === ChannelType.GuildVoice || type === ChannelType.GuildStageVoice,
        isDMBased: () => false, isSendable: () => true,
        permissionsFor: () => new PermissionsBitField(PermissionsBitField.All),
        messages: {
            cache: new Collection(),
            fetch: async (q) => {
                if (typeof q === 'string') { const m = c.messages.cache.get(q); if (!m) throw Object.assign(new Error('Unknown Message'), { code: 10008 }); return m; }
                return c.messages.cache.clone();
            },
            delete: async () => {},
        },
        async send(p) { const m = crearMensaje(c, p, guild.client.user); c.messages.cache.set(m.id, m); guild.client._registro({ tipo: 'send', canal: id, payload: m._historial[0] }); return m; },
        async bulkDelete() { return new Collection(); },
        async edit() { return c; }, async delete() { guild.channels.cache.delete(id); }, async setParent() { return c; }, async setName() { return c; },
        async setPosition() { return c; }, async setUserLimit() { return c; }, async setBitrate() { return c; }, async setTopic() { return c; },
        async createInvite() { return { code: 'abc', url: 'https://discord.gg/abc' }; }, async sendTyping() {},
        async createWebhook() { return { id: nuevoId(), token: 't', send: async (p) => c.send(p), delete: async () => {} }; },
        async fetchWebhooks() { return new Collection(); },
        threads: { create: async ({ name }) => guild._crearCanal(name, ChannelType.PublicThread, id), cache: new Collection(), fetchActive: async () => ({ threads: new Collection() }) },
        members: new Collection(),
        get children() { return { cache: guild.channels.cache.filter((x) => x.parentId === id) }; },
        toString: () => `<#${id}>`,
        _registro: (e) => guild.client._registro(e),
        setArchived: async () => {}, setLocked: async () => {}, join: async () => {}, leave: async () => {},
        members_: null,
    };
    return c;
}

function usuario(client, id, username, extra = {}) {
    return {
        id, username, globalName: username, displayName: username, tag: username, discriminator: '0', bot: false, system: false, avatar: null,
        createdAt: new Date(Date.now() - 400 * 864e5), createdTimestamp: Date.now() - 400 * 864e5,
        displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png', avatarURL: () => null, bannerURL: () => null,
        async send(p) { client._registro({ tipo: 'dm', a: id, payload: normalizar(p) }); return crearMensaje({ id: `dm-${id}`, guild: null, messages: { cache: new Collection() } }, p, client.user); },
        async createDM() { return { send: (p) => this.send(p) }; }, async fetch() { return this; },
        toString: () => `<@${id}>`, ...extra,
    };
}

function miembro(guild, user, perms, roles = []) {
    const cache = new Collection(roles.map((r) => [r.id, r]));
    const m = {
        id: user.id, user, guild, client: guild.client, nickname: null, joinedAt: new Date(Date.now() - 30 * 864e5), joinedTimestamp: Date.now() - 30 * 864e5,
        premiumSince: null, pending: false, partial: false, communicationDisabledUntil: null, communicationDisabledUntilTimestamp: null,
        get displayName() { return m.nickname || user.globalName || user.username; },
        permissions: new PermissionsBitField(perms),
        roles: {
            cache,
            get highest() { return [...cache.values()].reduce((a, r) => (r.position > a.position ? r : a), guild.roles.everyone); },
            async add(r) { const id = typeof r === 'string' ? r : r.id; const x = guild.roles.cache.get(id); if (x) cache.set(id, x); return m; },
            async remove(r) { cache.delete(typeof r === 'string' ? r : r.id); return m; },
            async set() { return m; },
        },
        displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png', displayHexColor: '#ffffff', displayColor: 0,
        async kick() {}, async ban() {}, async timeout() { return m; }, async send(p) { return user.send(p); }, async setNickname(n) { m.nickname = n; return m; },
        async fetch() { return m; }, async edit() { return m; },
        isCommunicationDisabled: () => false, voice: { channel: null, channelId: null, setChannel: async () => {}, setMute: async () => {}, disconnect: async () => {} },
        presence: null, manageable: true, kickable: true, bannable: true, moderatable: true,
        permissionsIn: () => new PermissionsBitField(perms), toString: () => `<@${user.id}>`,
    };
    return m;
}

function servidor(client, id, name) {
    const g = {
        id, name, ownerId: null, memberCount: 0, icon: null, banner: null, available: true, client, premiumTier: 0, premiumSubscriptionCount: 0,
        features: ['COMMUNITY'], preferredLocale: 'es-ES', createdAt: new Date(Date.now() - 900 * 864e5), createdTimestamp: Date.now() - 900 * 864e5, description: '',
        verificationLevel: 1, maximumMembers: 500000, vanityURLCode: null, nsfwLevel: 0, afkChannelId: null,
        iconURL: () => null, bannerURL: () => null, splashURL: () => null, toString: () => name,
    };
    g.roles = {
        cache: new Collection(), everyone: null,
        async create(o = {}) { const r = rol(g, nuevoId(), o.name || 'rol', 1, o.permissions ? new PermissionsBitField(o.permissions).bitfield : 0n); g.roles.cache.set(r.id, r); return r; },
        async fetch(rid) { return rid ? g.roles.cache.get(rid) : g.roles.cache; }, async edit() {}, async setPositions() {},
        get highest() { return [...g.roles.cache.values()].reduce((a, r) => (r.position > a.position ? r : a)); },
        resolve: (r) => g.roles.cache.get(typeof r === 'string' ? r : r?.id),
    };
    g.channels = {
        cache: new Collection(),
        async create(o = {}) { return g._crearCanal(o.name || 'canal', o.type ?? ChannelType.GuildText, o.parent?.id || o.parent || null); },
        async fetch(cid) { return cid ? g.channels.cache.get(cid) : g.channels.cache; },
        async setPositions() {}, resolve: (c) => g.channels.cache.get(typeof c === 'string' ? c : c?.id),
    };
    g._crearCanal = (nombre, tipo = ChannelType.GuildText, parentId = null) => { const c = canal(g, nuevoId(), nombre, tipo, parentId); g.channels.cache.set(c.id, c); client.channels.cache.set(c.id, c); return c; };
    g.members = {
        cache: new Collection(), me: null,
        async fetch(q) {
            if (typeof q === 'string') { const m = g.members.cache.get(q); if (!m) throw Object.assign(new Error('Unknown Member'), { code: 10007 }); return m; }
            if (q?.user) { const ids = Array.isArray(q.user) ? q.user : [q.user]; return new Collection(ids.map((i) => [i, g.members.cache.get(i)]).filter(([, m]) => m)); }
            return g.members.cache;
        },
        async search() { return new Collection(); }, async ban() {}, async unban() {}, async kick() {},
        resolve: (u) => g.members.cache.get(typeof u === 'string' ? u : u?.id),
    };
    g.emojis = { cache: new Collection(), async create() { return { id: nuevoId(), name: 'e' }; }, async fetch() { return g.emojis.cache; } };
    g.stickers = { cache: new Collection(), async create() { return { id: nuevoId() }; }, async fetch() { return g.stickers.cache; } };
    g.bans = { async fetch() { return new Collection(); }, async create() {}, async remove() {} };
    g.invites = { async fetch() { return new Collection(); }, cache: new Collection() };
    g.commands = { async set() { return new Collection(); }, async fetch() { return new Collection(); }, cache: new Collection() };
    g.scheduledEvents = { async create() { return { id: nuevoId(), url: 'https://discord.com/events/x' }; }, async fetch() { return new Collection(); }, cache: new Collection() };
    g.autoModerationRules = { async fetch() { return new Collection(); }, cache: new Collection() };
    g.voiceStates = { cache: new Collection() };
    g.fetchOwner = async () => g.members.cache.get(g.ownerId);
    g.fetchAuditLogs = async () => ({ entries: new Collection() });
    g.fetch = async () => g; g.edit = async () => g; g.leave = async () => {}; g.setIcon = async () => g;
    g.voiceAdapterCreator = () => ({ sendPayload: () => true, destroy: () => {} });

    const everyone = rol(g, id, '@everyone', 0, F.ViewChannel | F.SendMessages | F.ReadMessageHistory);
    g.roles.cache.set(id, everyone); g.roles.everyone = everyone;
    for (const [rid, n, p, perms] of [[`${id}1`, 'Staff', 5, F.ManageMessages | F.KickMembers | F.ModerateMembers], [`${id}2`, 'Color', 2, 0n], [`${id}3`, 'Admin', 8, F.Administrator], [`${id}4`, 'VIP', 3, 0n]]) {
        g.roles.cache.set(rid, rol(g, rid, n, p, perms));
    }
    const cat = g._crearCanal('General', ChannelType.GuildCategory);
    for (const n of ['general', 'casino', 'mascotas', 'logs', 'anuncios', 'tickets']) g._crearCanal(n, ChannelType.GuildText, cat.id);
    g._crearCanal('Charla', ChannelType.GuildVoice, cat.id);
    g.systemChannel = g.channels.cache.find((c) => c.name === 'general'); g.systemChannelId = g.systemChannel.id;
    return g;
}

function crearCliente() {
    const eventos = [];
    const client = {
        ws: { ping: 42 }, readyAt: new Date(), readyTimestamp: Date.now(), uptime: 1000, options: { intents: 0 },
        isReady: () => true, on() { return client; }, once() { return client; }, off() { return client; }, emit: () => true,
        _registro: (e) => eventos.push(e), eventos,
        musica: null,
        // Lavalink sin nada sonando (como el bot de verdad cuando nadie ha puesto música).
        lavalink: { getPlayer: () => undefined, createPlayer: () => ({ connect: async () => {}, play: async () => {}, queue: { add: async () => {}, tracks: [] }, search: async () => ({ tracks: [] }), destroy: async () => {}, connected: false }), nodeManager: { nodes: new Collection() }, useable: false, players: new Collection(), on() {} }, commands: new Collection(), slashCommands: new Collection(),
    };
    client.user = usuario(client, '800000000000000001', 'Sokyo', { bot: true });
    client.user.setPresence = () => {}; client.user.setActivity = () => {};
    client.application = { id: client.user.id, commands: { set: async () => new Collection(), fetch: async () => new Collection() }, fetch: async () => ({ description: '' }), edit: async () => ({}) };
    client.guilds = { cache: new Collection(), fetch: async (id) => client.guilds.cache.get(id) };
    client.channels = { cache: new Collection(), fetch: async (id) => { const c = client.channels.cache.get(id); if (!c) throw Object.assign(new Error('Unknown Channel'), { code: 10003 }); return c; } };
    const usuarios = new Collection();
    client.users = { cache: usuarios, fetch: async (id) => usuarios.get(id) || usuario(client, id, `u${String(id).slice(-4)}`) };

    const GA = servidor(client, '700000000000000001', 'Nébula Gaming');
    const GB = servidor(client, '700000000000000002', 'Otro servidor');
    client.guilds.cache.set(GA.id, GA); client.guilds.cache.set(GB.id, GB);
    for (const g of [GA, GB]) for (const c of g.channels.cache.values()) client.channels.cache.set(c.id, c);

    const personas = {
        dueno: usuario(client, '600000000000000001', 'dueno'),
        ana: usuario(client, '600000000000000002', 'ana'),
        leo: usuario(client, '600000000000000003', 'leo'),
        mod: usuario(client, '600000000000000004', 'mod'),
        eva: usuario(client, '600000000000000005', 'eva'),
    };
    for (const u of Object.values(personas)) usuarios.set(u.id, u);
    usuarios.set(client.user.id, client.user);
    for (const g of [GA, GB]) {
        g.ownerId = personas.dueno.id;
        const me = miembro(g, client.user, PermissionsBitField.All, [g.roles.cache.get(`${g.id}3`)]);
        const rolBot = rol(g, `${g.id}9`, 'Sokyo', 50, PermissionsBitField.All, { managed: true });
        g.roles.cache.set(rolBot.id, rolBot); me.roles.cache.set(rolBot.id, rolBot);
        g.members.me = me; g.members.cache.set(client.user.id, me);
        g.members.cache.set(personas.dueno.id, miembro(g, personas.dueno, PermissionsBitField.All, [g.roles.cache.get(`${g.id}3`)]));
        g.members.cache.set(personas.ana.id, miembro(g, personas.ana, F.ViewChannel | F.SendMessages | F.Connect | F.Speak));
        g.members.cache.set(personas.leo.id, miembro(g, personas.leo, F.ViewChannel | F.SendMessages | F.Connect | F.Speak));
        g.members.cache.set(personas.eva.id, miembro(g, personas.eva, F.ViewChannel | F.SendMessages | F.Connect | F.Speak));
        g.members.cache.set(personas.mod.id, miembro(g, personas.mod, F.ViewChannel | F.SendMessages | F.KickMembers | F.ModerateMembers | F.ManageMessages | F.BanMembers, [g.roles.cache.get(`${g.id}1`)]));
        g.memberCount = g.members.cache.size;
    }
    return { client, GA, GB, personas, normalizar, crearMensaje };
}

module.exports = { crearCliente, normalizar, crearMensaje, nuevoId };
