// Moderación desde el clic derecho (Apps → Sancionar / Ver ficha): la ficha de
// la persona y botones para avisar, aislar, expulsar o banear. Cada botón abre
// una ventanita para el motivo (que hace de confirmación) y, tras aplicarlo,
// queda un botón «Deshacer» unos minutos (ban y aislamiento).
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField } = require('discord.js');
const { fichaMiembro } = require('./ficha.js');
const { botonPanel } = require('./enlacesPanel.js');
const { miembroPuedeModerar } = require('./permisos.js');
const { t } = require('./i18n.js');

const ACCIONES = {
    aviso: { emoji: '⚠️', es: 'Avisar', en: 'Warn', flag: 'ModerateMembers', estilo: ButtonStyle.Secondary },
    timeout: { emoji: '🔇', es: 'Aislar', en: 'Time out', flag: 'ModerateMembers', estilo: ButtonStyle.Secondary },
    expulsion: { emoji: '👢', es: 'Expulsar', en: 'Kick', flag: 'KickMembers', estilo: ButtonStyle.Danger },
    ban: { emoji: '🔨', es: 'Banear', en: 'Ban', flag: 'BanMembers', estilo: ButtonStyle.Danger },
};
const DURACIONES = [[10, '10 min', '10 min'], [60, '1 h', '1 h'], [1440, '1 día', '1 day']];
const ETIQUETA_ACCION = { aviso: ['aviso', 'warning'], timeout: ['aislamiento', 'timeout'], expulsion: ['expulsión', 'kick'], ban: ['ban', 'ban'] };

const fecha = (ts) => (ts ? `<t:${Math.floor(ts / 1000)}:R>` : '—');

function embedFicha(f, idioma) {
    const e = new EmbedBuilder()
        .setColor(f.sanciones.activas ? 0xe74c3c : 0x5865f2)
        .setAuthor({ name: `${f.displayName} (@${f.username})`, iconURL: f.avatar })
        .setThumbnail(f.avatar)
        .addFields(
            { name: t(idioma, 'En el servidor', 'On the server'), value: f.enServidor ? t(idioma, `desde ${fecha(f.unidoEn)}`, `since ${fecha(f.unidoEn)}`) : t(idioma, 'Ya no está', 'Not here anymore'), inline: true },
            { name: t(idioma, 'Cuenta creada', 'Account created'), value: fecha(f.creadoEn), inline: true },
            { name: t(idioma, 'Nivel', 'Level'), value: `${f.nivel} · ${f.mensajes} ${t(idioma, 'mensajes', 'messages')}`, inline: true },
            { name: t(idioma, 'Sanciones', 'Sanctions'), value: f.sanciones.total
                ? `${f.sanciones.total}${f.sanciones.activas ? t(idioma, ` (${f.sanciones.activas} en vigor)`, ` (${f.sanciones.activas} active)`) : ''}\n${f.sanciones.ultimas.map((s) => `• ${t(idioma, ETIQUETA_ACCION[s.accion]?.[0] || s.accion, ETIQUETA_ACCION[s.accion]?.[1] || s.accion)} ${fecha(new Date(s.fecha).getTime())}${s.motivo ? `: ${s.motivo.slice(0, 60)}` : ''}${s.revocada ? t(idioma, ' (quitada)', ' (revoked)') : ''}`).join('\n')}`
                : t(idioma, 'Ninguna 👍', 'None 👍'), inline: false },
            { name: t(idioma, 'Tickets', 'Tickets'), value: `${f.tickets.total}${f.tickets.abiertos ? t(idioma, ` (${f.tickets.abiertos} abiertos)`, ` (${f.tickets.abiertos} open)`) : ''}`, inline: true },
        );
    if (f.roles.length) e.addFields({ name: t(idioma, 'Roles', 'Roles'), value: f.roles.map((r) => `<@&${r.id}>`).join(' ') + (f.totalRoles > f.roles.length ? ` +${f.totalRoles - f.roles.length}` : ''), inline: true });
    if (f.aisladoHasta) e.setFooter({ text: t(idioma, '🔇 Aislado ahora mismo', '🔇 Timed out right now') });
    return e;
}

// Botones de sanción para alguien (solo los que el moderador puede usar).
function filasSancion(moderador, cfg, userId, idioma) {
    const puede = (a) => miembroPuedeModerar(moderador, cfg, PermissionsBitField.Flags[ACCIONES[a].flag]);
    const boton = (id, etiqueta, emoji, estilo) => new ButtonBuilder().setCustomId(id).setLabel(etiqueta).setEmoji(emoji).setStyle(estilo);
    const fila1 = new ActionRowBuilder();
    if (puede('aviso')) fila1.addComponents(boton(`csan:aviso:0:${userId}`, t(idioma, 'Avisar', 'Warn'), '⚠️', ButtonStyle.Secondary));
    if (puede('timeout')) for (const [min, es, en] of DURACIONES) fila1.addComponents(boton(`csan:timeout:${min}:${userId}`, t(idioma, `Aislar ${es}`, `Time out ${en}`), '🔇', ButtonStyle.Secondary));
    const fila2 = new ActionRowBuilder();
    if (puede('expulsion')) fila2.addComponents(boton(`csan:expulsion:0:${userId}`, t(idioma, 'Expulsar', 'Kick'), '👢', ButtonStyle.Danger));
    if (puede('ban')) fila2.addComponents(boton(`csan:ban:0:${userId}`, t(idioma, 'Banear', 'Ban'), '🔨', ButtonStyle.Danger));
    fila2.addComponents(botonPanel(idioma, 'mod-miembros', t(idioma, 'Más en el panel', 'More in the panel')));
    return [fila1, fila2].filter((f) => f.components.length);
}

async function mensajeFicha(client, interaction, cfg, idioma, { conBotones = true } = {}) {
    const objetivo = interaction.targetUser || interaction.targetMember?.user;
    const f = await fichaMiembro(client, interaction.guildId, objetivo.id);
    if (!f) return { content: t(idioma, '🔎 No encuentro a esa persona.', '🔎 I can’t find that person.'), flags: 64 };
    const filas = conBotones && !f.bot && objetivo.id !== interaction.user.id ? filasSancion(interaction.member, cfg, objetivo.id, idioma) : [];
    return { embeds: [embedFicha(f, idioma)], components: filas, flags: 64 };
}

// Ventana del motivo (hace de confirmación: hay que pulsar «Enviar»).
function modalSancion(accion, min, userId, nombre, idioma) {
    const a = ACCIONES[accion];
    const titulo = `${a.emoji} ${t(idioma, a.es, a.en)}: ${nombre}`.slice(0, 45);
    return new ModalBuilder()
        .setCustomId(`csan_m:${accion}:${min}:${userId}`)
        .setTitle(titulo)
        .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('motivo').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)
                .setLabel(t(idioma, 'Motivo (opcional, lo verá en su aviso)', 'Reason (optional, they’ll see it)'))
                .setPlaceholder(t(idioma, 'Ej.: spam en #general', 'e.g. spam in #general')),
        ));
}

module.exports = { mensajeFicha, modalSancion, embedFicha, filasSancion, ACCIONES, ETIQUETA_ACCION };
