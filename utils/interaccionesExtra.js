// Botones, menús y ventanas de las funciones nuevas de Discord: la ayuda por
// categorías, el clic derecho (Sancionar / Reportar), las confirmaciones de
// !ban y !kick con «Deshacer», las preferencias y los recordatorios.
// manejar() devuelve true si la interacción era suya.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const { getConfigCached } = require('./config.js');
const { idiomaInteraccion } = require('./preferencias.js');
const { respuestaError } = require('./erroresDiscord.js');
const { miembroPuedeModerar } = require('./permisos.js');
const { t } = require('./i18n.js');

const DESHACER_MS = 15 * 60 * 1000; // «Deshacer» vale 15 minutos
const ETIQUETAS = { aviso: ['Aviso puesto', 'Warning given'], timeout: ['Aislado', 'Timed out'], expulsion: ['Expulsado', 'Kicked'], ban: ['Baneado', 'Banned'] };
const FLAG = { aviso: 'ModerateMembers', timeout: 'ModerateMembers', expulsion: 'KickMembers', ban: 'BanMembers' };

const botonDeshacer = (sancionId, idioma) => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`desh:${sancionId}`).setStyle(ButtonStyle.Secondary).setEmoji('↩️').setLabel(t(idioma, 'Deshacer', 'Undo')),
);

// Aplica una sanción y devuelve el texto de «hecho» con su «Deshacer».
async function aplicarYContar(client, interaction, idioma, { usuarioId, usuarioNombre, tipo, motivo }) {
    const { aplicarSancion, duracionTexto } = require('./moderationManager.js');
    const sancion = await aplicarSancion(client, {
        guildId: interaction.guildId, usuarioId, tipo, motivo,
        moderador: { id: interaction.user.id, tag: interaction.user.username },
    });
    const cfg = await getConfigCached(interaction.guildId).catch(() => null);
    const [es, en] = ETIQUETAS[tipo.accion] || ['Hecho', 'Done'];
    const dur = tipo.duracionMin > 0 ? ` (${duracionTexto(tipo.duracionMin, cfg)})` : '';
    const nota = tipo.accion === 'expulsion' ? t(idioma, ' Puede volver con una invitación.', ' They can come back with an invite.') : '';
    const puedeDeshacer = tipo.accion === 'ban' || tipo.accion === 'timeout';
    return {
        content: `✅ ${t(idioma, es, en)}: **${usuarioNombre}**${dur}.${nota}${puedeDeshacer ? t(idioma, '\n¿Te has equivocado? Tienes 15 minutos para deshacerlo.', '\nMade a mistake? You have 15 minutes to undo it.') : ''}`,
        components: puedeDeshacer ? [botonDeshacer(sancion._id, idioma)] : [],
    };
}

async function manejar(interaction, client) {
    const id = interaction.customId || '';
    if (!id) return false;

    // --- Ayuda: cambiar de categoría ---
    if (interaction.isStringSelectMenu() && id === 'ayuda:cat') {
        const cfg = await getConfigCached(interaction.guildId).catch(() => null);
        const idioma = await idiomaInteraccion(interaction, cfg);
        const { mensajeAyuda } = require('./ayuda.js');
        const cat = interaction.values[0] === 'inicio' ? null : interaction.values[0];
        const msg = mensajeAyuda(idioma, (cfg && cfg.prefijo) || '!', { categoria: cat });
        // La ayuda de !help es pública: quien no la pidió recibe la suya, aparte.
        if (interaction.message?.interaction || interaction.message?.flags?.has?.(64)) await interaction.update(msg);
        else if (interaction.message?.mentions?.repliedUser?.id === interaction.user.id) await interaction.update(msg);
        else await interaction.reply({ ...msg, flags: 64 });
        return true;
    }

    // --- Clic derecho «Sancionar»: botón → ventana con el motivo ---
    if (interaction.isButton() && id.startsWith('csan:')) {
        const [, accion, min, userId] = id.split(':');
        const cfg = await getConfigCached(interaction.guildId).catch(() => null);
        const idioma = await idiomaInteraccion(interaction, cfg);
        if (!miembroPuedeModerar(interaction.member, cfg, PermissionsBitField.Flags[FLAG[accion]])) {
            await interaction.reply({ content: t(idioma, '❌ No tienes permiso para esta acción.', '❌ You don’t have permission for this action.'), flags: 64 });
            return true;
        }
        const { modalSancion } = require('./moderacionRapida.js');
        const objetivo = await client.users.fetch(userId).catch(() => null);
        await interaction.showModal(modalSancion(accion, Number(min) || 0, userId, objetivo?.username || userId, idioma));
        return true;
    }
    if (interaction.isModalSubmit() && id.startsWith('csan_m:')) {
        const [, accion, min, userId] = id.split(':');
        const cfg = await getConfigCached(interaction.guildId).catch(() => null);
        const idioma = await idiomaInteraccion(interaction, cfg);
        if (!miembroPuedeModerar(interaction.member, cfg, PermissionsBitField.Flags[FLAG[accion]])) {
            await interaction.reply({ content: t(idioma, '❌ No tienes permiso para esta acción.', '❌ You don’t have permission for this action.'), flags: 64 });
            return true;
        }
        const objetivo = await client.users.fetch(userId).catch(() => null);
        try {
            const r = await aplicarYContar(client, interaction, idioma, {
                usuarioId: userId, usuarioNombre: objetivo?.username || userId,
                tipo: { nombre: null, accion, duracionMin: Number(min) || 0, borrarMensajesHoras: 0 },
                motivo: interaction.fields.getTextInputValue('motivo') || '',
            });
            await interaction.reply({ ...r, flags: 64 });
        } catch (e) {
            await interaction.reply({ content: `❌ ${e.message}`, flags: 64 }).catch(() => {});
        }
        return true;
    }

    // --- Deshacer un ban o un aislamiento recién puesto ---
    if (interaction.isButton() && id.startsWith('desh:')) {
        const cfg = await getConfigCached(interaction.guildId).catch(() => null);
        const idioma = await idiomaInteraccion(interaction, cfg);
        const Sancion = require('../models/Sancion.js');
        const s = await Sancion.findById(id.slice(5)).catch(() => null);
        if (!s || s.guildId !== interaction.guildId) { await interaction.reply({ content: t(idioma, '🔎 Esa sanción ya no existe.', '🔎 That sanction no longer exists.'), flags: 64 }); return true; }
        if (!miembroPuedeModerar(interaction.member, cfg, PermissionsBitField.Flags[FLAG[s.accion]])) {
            await interaction.reply({ content: t(idioma, '❌ No tienes permiso para deshacerlo.', '❌ You don’t have permission to undo it.'), flags: 64 });
            return true;
        }
        if (Date.now() - new Date(s.fecha).getTime() > DESHACER_MS) {
            await interaction.reply({ content: t(idioma, '⌛ Ya han pasado más de 15 minutos. Puedes quitarla en el panel: Moderación → Historial de sanciones.', '⌛ More than 15 minutes have passed. You can remove it in the panel: Moderation → Sanction history.'), flags: 64 });
            return true;
        }
        try {
            const { revocarSancion } = require('./moderationManager.js');
            await revocarSancion(client, s._id, { id: interaction.user.id, tag: interaction.user.username });
            await interaction.update({ content: t(idioma, `↩️ Deshecho: ${s.usuarioTag || s.usuarioId} ya no está ${s.accion === 'ban' ? 'baneado' : 'aislado'}.`, `↩️ Undone: ${s.usuarioTag || s.usuarioId} is no longer ${s.accion === 'ban' ? 'banned' : 'timed out'}.`), components: [] });
        } catch (e) {
            await interaction.reply({ content: `❌ ${e.message}`, flags: 64 }).catch(() => {});
        }
        return true;
    }

    // --- Clic derecho «Reportar mensaje»: llega el motivo ---
    if (interaction.isModalSubmit() && id.startsWith('crep_m:')) {
        const [, canalId, mensajeId] = id.split(':');
        const cfg = await getConfigCached(interaction.guildId).catch(() => null);
        const idioma = await idiomaInteraccion(interaction, cfg);
        try {
            const canal = interaction.guild.channels.cache.get(canalId);
            const mensaje = canal ? await canal.messages.fetch(mensajeId).catch(() => null) : null;
            if (!mensaje) { await interaction.reply({ content: t(idioma, '🔎 Ese mensaje ya no existe.', '🔎 That message no longer exists.'), flags: 64 }); return true; }
            const { crearReporte } = require('./reportes.js');
            await crearReporte(client, {
                guildId: interaction.guildId, reportante: interaction.user, reportado: mensaje.author,
                canalId, mensaje, motivo: interaction.fields.getTextInputValue('motivo') || '',
            });
            await interaction.reply({ content: t(idioma, '✅ Reporte enviado al staff. Nadie más sabe que has sido tú. ¡Gracias!', '✅ Report sent to the staff. Nobody else knows it was you. Thanks!'), flags: 64 });
        } catch (e) {
            await interaction.reply({ content: `❌ ${e.message}`, flags: 64 }).catch(() => {});
        }
        return true;
    }

    // --- !ban / !kick: confirmar o cancelar ---
    if (interaction.isButton() && (id.startsWith('conf:') || id.startsWith('conf_no:'))) {
        const { verPendiente, tomarPendiente } = require('./confirmaciones.js');
        const clave = id.split(':')[1];
        const cfg = await getConfigCached(interaction.guildId).catch(() => null);
        const idioma = await idiomaInteraccion(interaction, cfg);
        const p = verPendiente(clave);
        if (p && p.autorId !== interaction.user.id) {
            await interaction.reply({ content: t(idioma, '🙅 Solo quien lo pidió puede confirmarlo.', '🙅 Only whoever asked can confirm it.'), flags: 64 });
            return true;
        }
        const pendiente = tomarPendiente(clave);
        if (!pendiente) { await interaction.update({ content: t(idioma, '⌛ Esto ha caducado. Vuelve a escribir el comando.', '⌛ This expired. Type the command again.'), components: [] }); return true; }
        if (id.startsWith('conf_no:')) { await interaction.update({ content: t(idioma, '👍 Cancelado, no se ha hecho nada.', '👍 Cancelled, nothing was done.'), components: [] }); return true; }
        try {
            const r = await aplicarYContar(client, interaction, idioma, pendiente.datos);
            await interaction.update(r);
        } catch (e) {
            await interaction.update({ content: `❌ ${e.message}`, components: [] }).catch(() => {});
        }
        return true;
    }

    // --- Música: páginas de /cola ---
    if (interaction.isButton() && id.startsWith('cola:')) {
        const cfg = await getConfigCached(interaction.guildId).catch(() => null);
        const player = client.lavalink?.getPlayer(interaction.guildId);
        if (!player || !player.queue.current) {
            await interaction.update({ content: t(cfg, '📭 La música ya ha terminado.', '📭 The music has already ended.'), embeds: [], components: [] });
            return true;
        }
        const { mensajeCola } = require('./musicaExtra.js');
        await interaction.update(mensajeCola(player, Number(id.split(':')[1]) || 0, cfg));
        return true;
    }

    // --- Preferencias de cada miembro (/preferencias) ---
    if (id.startsWith('pref:')) {
        const { manejarPreferencias } = require('./preferenciasDiscord.js');
        await manejarPreferencias(interaction);
        return true;
    }

    // --- Recordatorios: borrar uno desde /recordatorios ---
    if (interaction.isButton() && id.startsWith('rec_borrar:')) {
        const Recordatorio = require('../models/Recordatorio.js');
        const cfg = await getConfigCached(interaction.guildId).catch(() => null);
        const idioma = await idiomaInteraccion(interaction, cfg);
        await Recordatorio.deleteOne({ _id: id.split(':')[1], userId: interaction.user.id }).catch(() => {});
        const { mensajeRecordatorios } = require('./recordatorios.js');
        await interaction.update(await mensajeRecordatorios(interaction.user.id, idioma));
        return true;
    }
    // --- Recordatorios: «10 min más» / «1 hora más» en el propio aviso ---
    if (interaction.isButton() && id.startsWith('rec_pos:')) {
        const [, recId, min] = id.split(':');
        const cfg = interaction.guildId ? await getConfigCached(interaction.guildId).catch(() => null) : null;
        const idioma = await idiomaInteraccion(interaction, cfg);
        const { posponer } = require('./recordatorios.js');
        const r = await posponer(recId, interaction.user.id, Number(min) || 10);
        if (!r) {
            await interaction.reply({ content: t(idioma, '🙅 Este recordatorio no es tuyo (o ya no existe).', '🙅 This reminder isn’t yours (or no longer exists).'), flags: 64 });
            return true;
        }
        const cuando = `<t:${Math.floor(r.fechaAviso.getTime() / 1000)}:R>`;
        await interaction.update({ content: `${interaction.message.content}\n💤 ${t(idioma, `Pospuesto: te lo vuelvo a recordar ${cuando}.`, `Snoozed: I’ll remind you again ${cuando}.`)}`.slice(0, 2000), components: [] });
        return true;
    }

    return false;
}

module.exports = { manejar, aplicarYContar, respuestaError };
