// Buscar grupo (/grupo): alguien busca gente para jugar a algo. Los demás se
// apuntan con un botón; al llenarse, el bot avisa a todos y (si está activado)
// crea una sala de voz solo para el grupo, que se borra sola cuando se queda vacía.
// Los grupos se cierran solos pasadas unas horas.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, OverwriteType } = require('discord.js');
const Grupo = require('../models/Grupo.js');
const { getConfigCached } = require('./config.js');
const { miembroPuedeModerar } = require('./permisos.js');
const { t } = require('./i18n.js');

const SALA_VACIA_MS = 5 * 60 * 1000;    // una sala vacía se borra a los 5 minutos
const GRACIA_SALA_MS = 10 * 60 * 1000;  // …y nada más crearla, hay 15 minutos para entrar
const salas = new Set();                 // ids de las salas de los grupos (para mirar rápido en voz)
let carga = null;
function cargarSalas() {
    if (!carga) {
        carga = Grupo.find({ salaVozId: { $type: 'string' } }).select('salaVozId').lean()
            .then((gs) => gs.forEach((g) => salas.add(g.salaVozId)))
            .catch(() => { carga = null; });
    }
    return carga;
}

const COLOR = { abierto: '#22c55e', lleno: '#3b82f6', cerrado: '#64748b' };

function embedGrupo(g, idioma) {
    const lista = g.miembros.map((id, i) => `${i === 0 ? '👑' : '•'} <@${id}>`).join('\n');
    const titulo = g.estado === 'lleno' ? t(idioma, '✅ ¡Grupo completo!', '✅ Group full!') : g.estado === 'cerrado' ? t(idioma, '🔒 Grupo cerrado', '🔒 Group closed') : t(idioma, '🎮 Busco grupo', '🎮 Looking for group');
    const embed = new EmbedBuilder()
        .setColor(COLOR[g.estado] || COLOR.abierto)
        .setAuthor({ name: titulo })
        .setTitle(g.juego.slice(0, 256))
        .addFields(
            { name: t(idioma, '👥 Plazas', '👥 Slots'), value: `**${g.miembros.length}/${g.plazas}**`, inline: true },
            ...(g.cuando ? [{ name: t(idioma, '🕒 Cuándo', '🕒 When'), value: g.cuando.slice(0, 1024), inline: true }] : []),
            ...(g.salaVozId ? [{ name: t(idioma, '🔊 Sala', '🔊 Room'), value: `<#${g.salaVozId}>`, inline: true }] : []),
            { name: t(idioma, 'Apuntados', 'Joined'), value: lista.slice(0, 1024) || '—' },
        )
        .setFooter({ text: g.estado === 'abierto' ? t(idioma, 'Pulsa «Me apunto» para unirte', 'Press “Join” to join in') : t(idioma, 'Crea otro con /grupo', 'Start another one with /group') })
        .setTimestamp(g.creadoFecha);
    if (g.descripcion) embed.setDescription(g.descripcion.slice(0, 1000));
    return embed;
}

function filaGrupo(g, idioma) {
    const cerrado = g.estado === 'cerrado';
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`grp_unir:${g._id}`).setStyle(ButtonStyle.Success).setEmoji('✋').setLabel(t(idioma, 'Me apunto', 'Join')).setDisabled(g.estado !== 'abierto'),
        new ButtonBuilder().setCustomId(`grp_salir:${g._id}`).setStyle(ButtonStyle.Secondary).setEmoji('🚪').setLabel(t(idioma, 'Salir', 'Leave')).setDisabled(cerrado),
        new ButtonBuilder().setCustomId(`grp_cerrar:${g._id}`).setStyle(ButtonStyle.Danger).setEmoji('🔒').setLabel(t(idioma, 'Cerrar', 'Close')).setDisabled(cerrado),
    );
}
const mensajeGrupo = (g, idioma) => ({ embeds: [embedGrupo(g, idioma)], components: [filaGrupo(g, idioma)], allowedMentions: { parse: [] } });

// /grupo juego plazas [detalles] [cuando]
async function crearGrupo(interaction, cfg, { juego, plazas, descripcion, cuando }, idioma) {
    const gc = cfg?.grupos;
    if (gc?.activo === false) return { error: t(idioma, '🎮 Buscar grupo está apagado en este servidor.', '🎮 Looking for group is turned off on this server.') };
    const abierto = await Grupo.findOne({ guildId: interaction.guildId, creadorId: interaction.user.id, estado: { $ne: 'cerrado' } });
    if (abierto) {
        const enlace = abierto.mensajeId ? `https://discord.com/channels/${abierto.guildId}/${abierto.canalId}/${abierto.mensajeId}` : '';
        return { error: t(idioma, `Ya tienes un grupo abierto (${abierto.juego}). Ciérralo antes de crear otro. ${enlace}`, `You already have an open group (${abierto.juego}). Close it before starting another. ${enlace}`) };
    }
    const canal = (gc?.canalId && interaction.guild.channels.cache.get(gc.canalId)) || interaction.channel;
    if (!canal?.isTextBased()) return { error: t(idioma, 'No encuentro dónde publicar el grupo.', 'I can’t find where to post the group.') };
    const g = await Grupo.create({
        guildId: interaction.guildId, canalId: canal.id, creadorId: interaction.user.id,
        juego: String(juego).slice(0, 100), plazas, descripcion: String(descripcion || '').slice(0, 500), cuando: String(cuando || '').slice(0, 100),
        miembros: [interaction.user.id],
        expira: new Date(Date.now() + Math.max(1, gc?.horasCaducidad || 6) * 3600 * 1000),
    });
    const msg = await canal.send(mensajeGrupo(g, cfg)).catch(() => null);
    if (!msg) { await g.deleteOne(); return { error: t(idioma, `No puedo escribir en <#${canal.id}>.`, `I can’t write in <#${canal.id}>.`) }; }
    g.mensajeId = msg.id;
    await g.save();
    return { ok: true, grupo: g, url: msg.url };
}

// Sala de voz solo para los del grupo (y el bot), con tantas plazas como el grupo.
async function crearSala(guild, g, cfg) {
    const canalGrupo = guild.channels.cache.get(g.canalId);
    const categoria = (cfg?.grupos?.categoriaId && guild.channels.cache.get(cfg.grupos.categoriaId)) || canalGrupo?.parent || null;
    const P = PermissionsBitField.Flags;
    const sala = await guild.channels.create({
        name: `🎮 ${g.juego}`.slice(0, 100),
        type: ChannelType.GuildVoice,
        userLimit: Math.min(99, g.plazas),
        ...(categoria ? { parent: categoria.id } : {}),
        permissionOverwrites: [
            { id: guild.id, type: OverwriteType.Role, deny: [P.Connect] },
            ...(guild.members.me ? [{ id: guild.members.me.id, type: OverwriteType.Member, allow: [P.ViewChannel, P.Connect, P.ManageChannels, P.MoveMembers] }] : []),
            ...g.miembros.map((id) => ({ id, type: OverwriteType.Member, allow: [P.ViewChannel, P.Connect, P.Speak] })),
        ],
        reason: t(cfg, 'Sala de un grupo de /grupo', 'Room for a /group party'),
    });
    salas.add(sala.id);
    return sala;
}

// Botones: me apunto, salir y cerrar.
async function manejarBoton(interaction, client) {
    const [accion, id] = interaction.customId.split(':');
    const cfg = await getConfigCached(interaction.guildId).catch(() => null);
    const uid = interaction.user.id;
    let g = await Grupo.findById(id).catch(() => null);
    if (!g) return interaction.reply({ content: t(cfg, 'Este grupo ya no existe.', 'This group no longer exists.'), flags: 64 });

    if (accion === 'grp_unir') {
        // De una vez: solo entra si sigue abierto, hay sitio y no estaba ya.
        g = await Grupo.findOneAndUpdate(
            { _id: id, estado: 'abierto', miembros: { $ne: uid }, $expr: { $lt: [{ $size: '$miembros' }, '$plazas'] } },
            { $push: { miembros: uid } }, { returnDocument: 'after' },
        );
        if (!g) {
            const actual = await Grupo.findById(id);
            const motivo = actual?.miembros.includes(uid) ? t(cfg, 'Ya estás en este grupo.', 'You’re already in this group.')
                : actual?.estado === 'cerrado' ? t(cfg, 'Este grupo ya está cerrado.', 'This group is already closed.')
                : t(cfg, 'Llegas tarde: el grupo ya está completo.', 'Too late: the group is already full.');
            return interaction.reply({ content: motivo, flags: 64 });
        }
        // Si el grupo ya tenía sala (se llenó, alguien salió y vuelve a llenarse), el nuevo también puede entrar.
        if (g.salaVozId) {
            const sala = interaction.guild.channels.cache.get(g.salaVozId);
            await sala?.permissionOverwrites.edit(uid, { ViewChannel: true, Connect: true, Speak: true }).catch(() => {});
        }
        if (g.miembros.length >= g.plazas) {
            g.estado = 'lleno';
            if (cfg?.grupos?.crearSala !== false && !g.salaVozId) {
                const sala = await crearSala(interaction.guild, g, cfg).catch(() => null);
                if (sala) { g.salaVozId = sala.id; g.salaVaciaDesde = new Date(Date.now() + GRACIA_SALA_MS); }
            }
            await g.save();
            await interaction.update(mensajeGrupo(g, cfg));
            const sala = g.salaVozId ? t(cfg, ` Vuestra sala: <#${g.salaVozId}>`, ` Your room: <#${g.salaVozId}>`) : '';
            await interaction.channel.send({
                content: t(cfg, `🎉 ¡Grupo de **${g.juego}** completo! ${g.miembros.map((m) => `<@${m}>`).join(' ')}${sala}`, `🎉 The **${g.juego}** group is full! ${g.miembros.map((m) => `<@${m}>`).join(' ')}${sala}`).slice(0, 2000),
                allowedMentions: { users: g.miembros },
            }).catch(() => {});
            return;
        }
        return interaction.update(mensajeGrupo(g, cfg));
    }

    if (accion === 'grp_salir') {
        if (g.creadorId === uid) return interaction.reply({ content: t(cfg, 'Eres quien lo ha creado: si ya no vas, ciérralo con «Cerrar».', 'You started it: if you can’t make it, close it with “Close”.'), flags: 64 });
        g = await Grupo.findOneAndUpdate({ _id: id, miembros: uid, estado: { $ne: 'cerrado' } }, { $pull: { miembros: uid } }, { returnDocument: 'after' });
        if (!g) return interaction.reply({ content: t(cfg, 'No estabas en este grupo.', 'You weren’t in this group.'), flags: 64 });
        if (g.estado === 'lleno' && g.miembros.length < g.plazas) { g.estado = 'abierto'; await g.save(); }
        if (g.salaVozId) {
            const sala = interaction.guild.channels.cache.get(g.salaVozId);
            await sala?.permissionOverwrites.delete(uid).catch(() => {});
        }
        return interaction.update(mensajeGrupo(g, cfg));
    }

    if (accion === 'grp_cerrar') {
        if (g.creadorId !== uid && !miembroPuedeModerar(interaction.member, cfg, PermissionsBitField.Flags.ManageMessages)) {
            return interaction.reply({ content: t(cfg, 'Solo quien creó el grupo (o el staff) puede cerrarlo.', 'Only whoever started the group (or the staff) can close it.'), flags: 64 });
        }
        g.estado = 'cerrado';
        await g.save();
        return interaction.update(mensajeGrupo(g, cfg));
    }
    return false;
}

// Al moverse alguien en voz: la sala de un grupo vacía empieza a contar para borrarse.
async function alCambiarVoz(oldState, newState) {
    await cargarSalas();
    if (newState.channelId && salas.has(newState.channelId)) {
        await Grupo.updateOne({ salaVozId: newState.channelId }, { $set: { salaVaciaDesde: null } }).catch(() => {});
    }
    if (oldState.channelId && oldState.channelId !== newState.channelId && salas.has(oldState.channelId)) {
        const sala = oldState.guild.channels.cache.get(oldState.channelId);
        if (sala && sala.members.filter((m) => !m.user.bot).size === 0) {
            await Grupo.updateOne({ salaVozId: oldState.channelId }, { $set: { salaVaciaDesde: new Date() } }).catch(() => {});
        }
    }
}

// Barrido: cierra los grupos caducados y borra las salas que llevan un rato vacías.
async function barrerGrupos(client) {
    await cargarSalas();
    const ahora = Date.now();
    const caducados = await Grupo.find({ estado: { $ne: 'cerrado' }, expira: { $lte: new Date(ahora) } }).limit(50);
    for (const g of caducados) {
        g.estado = 'cerrado';
        await g.save().catch(() => {});
        const cfg = await getConfigCached(g.guildId).catch(() => null);
        const canal = client.channels.cache.get(g.canalId);
        const msg = canal && g.mensajeId ? await canal.messages.fetch(g.mensajeId).catch(() => null) : null;
        if (msg) await msg.edit(mensajeGrupo(g, cfg)).catch(() => {});
    }
    const conSala = await Grupo.find({ salaVozId: { $type: 'string' }, salaVaciaDesde: { $ne: null, $lte: new Date(ahora - SALA_VACIA_MS) } }).limit(50);
    for (const g of conSala) {
        const guild = client.guilds.cache.get(g.guildId);
        const sala = guild?.channels.cache.get(g.salaVozId);
        if (sala && sala.members.filter((m) => !m.user.bot).size > 0) { g.salaVaciaDesde = null; await g.save().catch(() => {}); continue; }
        if (sala) await sala.delete('Sala de grupo vacía').catch(() => {});
        salas.delete(g.salaVozId);
        g.salaVozId = null;
        g.salaVaciaDesde = null;
        await g.save().catch(() => {});
    }
}

module.exports = { crearGrupo, manejarBoton, alCambiarVoz, barrerGrupos, embedGrupo, mensajeGrupo, cargarSalas };
