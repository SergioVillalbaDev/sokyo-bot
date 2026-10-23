// ============================================================================
// rolePanelManager — toda la lógica de los paneles de autoasignación de roles.
// Construye el mensaje (embed + componentes), lo publica/edita en Discord y
// aplica los cambios de rol según el mecanismo (botón / menú / reacción /
// verificación), respetando exclusividad, límite, "no quitar" y temporales.
// ============================================================================
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const RolTemporal = require('../models/RolTemporal.js');
const { getConfigCached } = require('./config.js');
const { t } = require('./i18n.js');

// Carpeta donde la API guarda las imágenes subidas.
const UPLOADS_DIR = path.join(__dirname, '..', 'api', 'uploads');

const ESTILOS = {
    primary: ButtonStyle.Primary,
    secondary: ButtonStyle.Secondary,
    success: ButtonStyle.Success,
    danger: ButtonStyle.Danger,
};

// Normaliza un emoji para guardarlo/compararlo: custom -> "<:nombre:id>" (o
// "<a:nombre:id>" si es animado), unicode -> el carácter.
function emojiDeReaccion(reaction) {
    if (reaction.emoji.id) {
        return `<${reaction.emoji.animated ? 'a' : ''}:${reaction.emoji.name}:${reaction.emoji.id}>`;
    }
    return reaction.emoji.name;
}

// Construye { embeds, components } a partir del panel y el servidor (para los nombres de rol).
async function construirMensaje(panel, guild) {
    const cfg = await getConfigCached(panel.guildId).catch(() => null);
    const embed = new EmbedBuilder()
        .setTitle(panel.titulo || t(cfg, '🎭 Roles', '🎭 Roles'))
        .setColor(panel.color || '#5865F2');

    let desc = panel.descripcion || '';
    // En reacciones añadimos la leyenda "emoji — texto". El texto es editable
    // (item.label); si no hay, cae al nombre del rol.
    if (panel.tipo === 'reaccion') {
        const lineas = panel.items.map((it) => {
            const rol = guild.roles.cache.get(it.roleId);
            return `${it.emoji || '•'} — ${it.label || (rol ? rol.name : t(cfg, 'rol', 'role'))}`;
        });
        desc += (desc ? '\n\n' : '') + lineas.join('\n');
    }
    if (desc) embed.setDescription(desc);
    if (panel.imagen) embed.setImage(panel.imagen);

    const components = [];

    if (panel.tipo === 'boton') {
        let row = new ActionRowBuilder();
        panel.items.forEach((it, i) => {
            if (i > 0 && i % 5 === 0) { components.push(row); row = new ActionRowBuilder(); }
            const rol = guild.roles.cache.get(it.roleId);
            const btn = new ButtonBuilder()
                .setCustomId(`rp_btn:${panel._id}:${it.roleId}`)
                .setLabel((it.label || (rol ? rol.name : t(cfg, 'Rol', 'Role'))).slice(0, 80))
                .setStyle(ESTILOS[it.estilo] || ButtonStyle.Secondary);
            if (it.emoji) btn.setEmoji(it.emoji);
            row.addComponents(btn);
        });
        if (row.components.length) components.push(row);
    } else if (panel.tipo === 'menu') {
        const maxVals = panel.exclusivo ? 1 : (panel.maxRoles > 0 ? Math.min(panel.maxRoles, panel.items.length) : panel.items.length || 1);
        const menu = new StringSelectMenuBuilder()
            .setCustomId(`rp_menu:${panel._id}`)
            .setPlaceholder(t(cfg, 'Selecciona tus roles...', 'Select your roles...'))
            .setMinValues(0)
            .setMaxValues(Math.max(1, maxVals));
        panel.items.forEach((it) => {
            const rol = guild.roles.cache.get(it.roleId);
            const opt = { label: (it.label || (rol ? rol.name : t(cfg, 'Rol', 'Role'))).slice(0, 100), value: it.roleId };
            if (it.descripcion) opt.description = it.descripcion.slice(0, 100);
            if (it.emoji) opt.emoji = it.emoji;
            menu.addOptions(opt);
        });
        components.push(new ActionRowBuilder().addComponents(menu));
    } else if (panel.tipo === 'verificacion') {
        const it = panel.items[0] || {};
        const btn = new ButtonBuilder()
            .setCustomId(`rp_verify:${panel._id}`)
            .setLabel((it.label || t(cfg, '✅ Verificarme', '✅ Verify me')).slice(0, 80))
            .setStyle(ButtonStyle.Success);
        if (it.emoji) btn.setEmoji(it.emoji);
        components.push(new ActionRowBuilder().addComponents(btn));
    }

    return { embeds: [embed], components };
}

// Publica el panel en su canal (o edita el mensaje si ya existe). Sincroniza reacciones.
async function publicarPanel(client, panel) {
    const cfg = await getConfigCached(panel.guildId).catch(() => null);
    const guild = client.guilds.cache.get(panel.guildId);
    if (!guild) throw new Error(t(cfg, 'Servidor no encontrado', 'Server not found'));
    const canal = guild.channels.cache.get(panel.channelId);
    if (!canal) throw new Error(t(cfg, 'Canal no encontrado', 'Channel not found'));
    await guild.roles.fetch().catch(() => {}); // nombres de rol al día

    const { embeds, components } = await construirMensaje(panel, guild);
    const payload = { embeds, components: panel.tipo === 'reaccion' ? [] : components };

    // Imagen subida: la adjuntamos al mensaje y la referenciamos con attachment://.
    // (Así Discord la muestra aunque la API esté en localhost.)
    let tieneAdjunto = false;
    if (panel.imagenArchivo) {
        const ruta = path.join(UPLOADS_DIR, panel.imagenArchivo);
        if (fs.existsSync(ruta)) {
            embeds[0].setImage(`attachment://${panel.imagenArchivo}`);
            payload.files = [new AttachmentBuilder(ruta, { name: panel.imagenArchivo })];
            tieneAdjunto = true;
        }
    }

    let mensaje = panel.messageId ? await canal.messages.fetch(panel.messageId).catch(() => null) : null;
    // Con adjunto reenviamos el mensaje (editar adjuntos es poco fiable); sin él, editamos en sitio.
    if (mensaje && tieneAdjunto) {
        await mensaje.delete().catch(() => {});
        mensaje = null;
    }
    if (mensaje) {
        await mensaje.edit(payload);
    } else {
        mensaje = await canal.send(payload);
        panel.messageId = mensaje.id;
        await panel.save();
    }

    if (panel.tipo === 'reaccion') {
        await mensaje.reactions.removeAll().catch(() => {});
        for (const it of panel.items) {
            if (it.emoji) await mensaje.react(it.emoji).catch(() => {});
        }
    }
    return mensaje;
}

// Programa un rol temporal si el item tiene duración.
async function programarTemporal(panel, member, item) {
    if (item && item.duracionMin > 0) {
        await RolTemporal.create({
            guildId: panel.guildId, userId: member.id, roleId: item.roleId,
            expiraEn: new Date(Date.now() + item.duracionMin * 60000),
        });
    }
}

// Alterna un rol (botón / reacción). Devuelve: 'añadido' | 'quitado' | 'limite' | 'ya_tiene'.
async function toggleRol(member, panel, roleId, { soloAñadir = false } = {}) {
    const tiene = member.roles.cache.has(roleId);

    if (tiene && !soloAñadir) {
        if (panel.permitirQuitar === false) return 'ya_tiene';
        await member.roles.remove(roleId).catch(() => {});
        await RolTemporal.deleteMany({ guildId: panel.guildId, userId: member.id, roleId });
        return 'quitado';
    }
    if (tiene) return 'ya_tiene';

    // No lo tiene: añadir (respetando exclusivo / límite).
    if (panel.exclusivo) {
        const otros = panel.items.map((i) => i.roleId).filter((id) => id !== roleId && member.roles.cache.has(id));
        if (otros.length) {
            await member.roles.remove(otros).catch(() => {});
            await RolTemporal.deleteMany({ guildId: panel.guildId, userId: member.id, roleId: { $in: otros } });
        }
    } else if (panel.maxRoles > 0) {
        const cuenta = panel.items.filter((i) => member.roles.cache.has(i.roleId)).length;
        if (cuenta >= panel.maxRoles) return 'limite';
    }

    await member.roles.add(roleId).catch(() => {});
    await programarTemporal(panel, member, panel.items.find((i) => i.roleId === roleId));
    return 'añadido';
}

// Aplica la selección de un menú: pone los marcados, quita los desmarcados (del panel).
async function aplicarSeleccionMenu(member, panel, seleccionados) {
    const idsPanel = panel.items.map((i) => i.roleId);
    const aQuitar = idsPanel.filter((id) => !seleccionados.includes(id) && member.roles.cache.has(id));
    const aPoner = seleccionados.filter((id) => !member.roles.cache.has(id));

    if (aQuitar.length && panel.permitirQuitar !== false) {
        await member.roles.remove(aQuitar).catch(() => {});
        await RolTemporal.deleteMany({ guildId: panel.guildId, userId: member.id, roleId: { $in: aQuitar } });
    }
    if (aPoner.length) {
        await member.roles.add(aPoner).catch(() => {});
        for (const id of aPoner) await programarTemporal(panel, member, panel.items.find((i) => i.roleId === id));
    }
    return { puestos: aPoner.length, quitados: panel.permitirQuitar !== false ? aQuitar.length : 0 };
}

// Barredor: quita los roles temporales vencidos. Lo llama un setInterval en ready.js.
async function barrerRolesTemporales(client) {
    const vencidos = await RolTemporal.find({ expiraEn: { $lte: new Date() } }).limit(100);
    for (const v of vencidos) {
        try {
            const guild = client.guilds.cache.get(v.guildId);
            const member = guild ? await guild.members.fetch(v.userId).catch(() => null) : null;
            if (member) await member.roles.remove(v.roleId).catch(() => {});
        } catch (e) { console.error('Error barriendo rol temporal:', e.message); }
        await RolTemporal.deleteOne({ _id: v._id });
    }
}

module.exports = {
    construirMensaje, publicarPanel, toggleRol, aplicarSeleccionMenu,
    barrerRolesTemporales, emojiDeReaccion,
};
