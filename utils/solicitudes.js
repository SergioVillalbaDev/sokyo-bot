// Solicitudes (por ejemplo, para entrar al staff): el panel publica un mensaje con un
// botón por formulario. Quien lo pulsa responde a sus preguntas en una ventana; al
// staff le llega al canal de revisión con «Aceptar» y «Rechazar» (también se hace
// desde el panel). Al aceptar, el bot le da el rol del formulario; en los dos casos
// se le avisa por privado. Tras un rechazo hay que esperar unos días para volver.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField } = require('discord.js');
const Solicitud = require('../models/Solicitud.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { getConfigCached } = require('./config.js');
const { miembroPuedeModerar } = require('./permisos.js');
const { idiomaMiembro } = require('./preferencias.js');
const { t } = require('./i18n.js');

const MAX_PREGUNTAS = 5; // lo que cabe en una ventana de Discord
const formularioDe = (cfg, id) => (cfg?.solicitudes?.formularios || []).find((f) => f.id === id) || null;
const abiertos = (cfg) => (cfg?.solicitudes?.formularios || []).filter((f) => f.abierto !== false && (f.preguntas || []).some((p) => String(p).trim()));
const puedeRevisar = (member, cfg) => miembroPuedeModerar(member, cfg, PermissionsBitField.Flags.ManageRoles);

// Mensaje público con un botón por formulario abierto.
function mensajePanel(cfg) {
    const s = cfg.solicitudes;
    const forms = abiertos(cfg);
    const embed = new EmbedBuilder()
        .setColor('#8b5cf6')
        .setTitle((s.titulo || t(cfg, '📝 Solicitudes', '📝 Applications')).slice(0, 256))
        .setDescription([
            s.descripcion || '',
            '',
            ...forms.map((f) => `${f.emoji || '📝'} **${f.nombre}**${f.descripcion ? ` — ${f.descripcion}` : ''}`),
        ].join('\n').slice(0, 4000) || '—');
    if (!forms.length) embed.setFooter({ text: t(cfg, 'Ahora mismo no hay solicitudes abiertas', 'There are no open applications right now') });
    const filas = [];
    for (let i = 0; i < Math.min(forms.length, 25); i += 5) {
        filas.push(new ActionRowBuilder().addComponents(forms.slice(i, i + 5).map((f) => {
            const b = new ButtonBuilder().setCustomId(`sol_abrir:${f.id}`).setStyle(ButtonStyle.Primary).setLabel(f.nombre.slice(0, 80));
            if (f.emoji) { try { b.setEmoji(f.emoji); } catch { /* emoji no válido: sin él */ } }
            return b;
        })));
    }
    return { embeds: [embed], components: filas, allowedMentions: { parse: [] } };
}

// Publica (o actualiza) el mensaje de las solicitudes. Devuelve { ok, error, url }.
async function publicarPanel(client, guildId) {
    const cfg = await ServidorConfig.findOne({ guildId });
    const s = cfg?.solicitudes;
    const guild = client.guilds.cache.get(guildId);
    const canal = guild && s?.canalId ? guild.channels.cache.get(s.canalId) : null;
    if (!canal || !canal.isTextBased()) return { ok: false, error: 'Elige el canal donde publicarlo' };
    const viejo = s.panelMensajeId ? await canal.messages.fetch(s.panelMensajeId).catch(() => null) : null;
    const msg = viejo ? await viejo.edit(mensajePanel(cfg)).catch(() => null) : await canal.send(mensajePanel(cfg)).catch(() => null);
    if (!msg) return { ok: false, error: 'El bot no puede escribir en ese canal' };
    if (!viejo) await ServidorConfig.updateOne({ guildId }, { $set: { 'solicitudes.panelMensajeId': msg.id } });
    return { ok: true, url: msg.url };
}

// Botón «Formulario X» → comprobaciones → ventana con las preguntas.
async function abrir(interaction) {
    const cfg = await getConfigCached(interaction.guildId).catch(() => null);
    const idioma = await idiomaMiembro(interaction.user.id, { locale: interaction.locale, cfg });
    const form = formularioDe(cfg, interaction.customId.split(':')[1]);
    const responder = (content) => interaction.reply({ content, flags: 64 });
    if (!cfg?.solicitudes?.activo || !form || form.abierto === false) return responder(t(idioma, '🔒 Esta solicitud está cerrada ahora mismo.', '🔒 This application is closed right now.'));
    if (form.rolId && interaction.member?.roles.cache.has(form.rolId)) return responder(t(idioma, '✅ Ya tienes ese rol.', '✅ You already have that role.'));
    const ultima = await Solicitud.findOne({ guildId: interaction.guildId, userId: interaction.user.id, formularioId: form.id }).sort({ fecha: -1 });
    if (ultima?.estado === 'pendiente') return responder(t(idioma, '⏳ Ya tienes una solicitud de este tipo esperando respuesta. ¡Paciencia!', '⏳ You already have an application of this kind waiting for an answer. Hang tight!'));
    const esperaDias = Math.max(0, form.esperaDias ?? 7);
    if (ultima?.estado === 'rechazada' && esperaDias > 0) {
        const cuando = new Date(new Date(ultima.fechaRevision || ultima.fecha).getTime() + esperaDias * 86400000);
        if (cuando > new Date()) return responder(t(idioma, `⏳ Podrás volver a pedirlo <t:${Math.floor(cuando / 1000)}:R>.`, `⏳ You can apply again <t:${Math.floor(cuando / 1000)}:R>.`));
    }
    const preguntas = (form.preguntas || []).map((p) => String(p).trim()).filter(Boolean).slice(0, MAX_PREGUNTAS);
    const modal = new ModalBuilder().setCustomId(`sol_modal:${form.id}`).setTitle(form.nombre.slice(0, 45));
    preguntas.forEach((p, i) => {
        const campo = new TextInputBuilder().setCustomId(`p${i}`).setLabel(p.length > 45 ? `${p.slice(0, 44)}…` : p)
            .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000);
        if (p.length > 45) campo.setPlaceholder(p.slice(0, 100));
        modal.addComponents(new ActionRowBuilder().addComponents(campo));
    });
    return interaction.showModal(modal);
}

function botonesRevision(id, cfg) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`sol_ok:${id}`).setStyle(ButtonStyle.Success).setEmoji('✅').setLabel(t(cfg, 'Aceptar', 'Accept')),
        new ButtonBuilder().setCustomId(`sol_no:${id}`).setStyle(ButtonStyle.Danger).setEmoji('✖️').setLabel(t(cfg, 'Rechazar', 'Reject')),
    );
}

// Ventana enviada → se guarda y le llega al staff.
async function procesarModal(interaction) {
    const cfg = await getConfigCached(interaction.guildId).catch(() => null);
    const idioma = await idiomaMiembro(interaction.user.id, { locale: interaction.locale, cfg });
    const form = formularioDe(cfg, interaction.customId.split(':')[1]);
    if (!form) return interaction.reply({ content: t(idioma, 'Este formulario ya no existe.', 'This form no longer exists.'), flags: 64 });
    const preguntas = (form.preguntas || []).map((p) => String(p).trim()).filter(Boolean).slice(0, MAX_PREGUNTAS);
    const respuestas = preguntas.map((p, i) => ({ pregunta: p, respuesta: interaction.fields.getTextInputValue(`p${i}`) || '' }));
    const sol = await Solicitud.create({
        guildId: interaction.guildId, formularioId: form.id, formularioNombre: form.nombre,
        userId: interaction.user.id, userTag: interaction.user.username, respuestas,
    });
    const canal = cfg.solicitudes.canalRevisionId ? interaction.guild.channels.cache.get(cfg.solicitudes.canalRevisionId) : null;
    if (canal?.isTextBased()) {
        const m = interaction.member;
        const embed = new EmbedBuilder()
            .setColor('#8b5cf6')
            .setAuthor({ name: `${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ size: 64 }) })
            .setTitle(t(cfg, `📝 Solicitud: ${form.nombre}`, `📝 Application: ${form.nombre}`).slice(0, 256))
            .setDescription(t(cfg,
                `<@${interaction.user.id}> · cuenta creada <t:${Math.floor(interaction.user.createdTimestamp / 1000)}:R>${m?.joinedTimestamp ? ` · en el servidor desde <t:${Math.floor(m.joinedTimestamp / 1000)}:R>` : ''}`,
                `<@${interaction.user.id}> · account created <t:${Math.floor(interaction.user.createdTimestamp / 1000)}:R>${m?.joinedTimestamp ? ` · on the server since <t:${Math.floor(m.joinedTimestamp / 1000)}:R>` : ''}`))
            .addFields(respuestas.map((r) => ({ name: r.pregunta.slice(0, 256), value: (r.respuesta || '—').slice(0, 1024) })))
            .setTimestamp();
        const msg = await canal.send({ embeds: [embed], components: [botonesRevision(sol._id, cfg)], allowedMentions: { parse: [] } }).catch(() => null);
        if (msg) { sol.revisionCanalId = canal.id; sol.revisionMensajeId = msg.id; await sol.save(); }
    }
    return interaction.reply({ content: t(idioma, '✅ ¡Solicitud enviada! El staff la revisará y te avisaré por privado.', '✅ Application sent! The staff will review it and I’ll let you know by DM.'), flags: 64 });
}

// Aceptar o rechazar (desde Discord o el panel). Devuelve { ok, error, aviso }.
async function resolver(client, id, { aceptar, motivo = '', revisor }) {
    const sol = await Solicitud.findOneAndUpdate(
        { _id: id, estado: 'pendiente' },
        { $set: { estado: aceptar ? 'aceptada' : 'rechazada', motivo: String(motivo || '').slice(0, 500), revisadoPor: revisor, fechaRevision: new Date() } },
        { returnDocument: 'after' },
    );
    if (!sol) return { ok: false, error: 'ya' };
    const cfg = await getConfigCached(sol.guildId);
    const guild = client.guilds.cache.get(sol.guildId);
    const form = formularioDe(cfg, sol.formularioId);
    let aviso = null;
    if (aceptar && form?.rolId && guild) {
        const member = await guild.members.fetch(sol.userId).catch(() => null);
        const ok = member ? await member.roles.add(form.rolId, t(cfg, `Solicitud aceptada por ${revisor}`, `Application accepted by ${revisor}`)).then(() => true).catch(() => false) : false;
        if (!ok) aviso = member ? 'rol' : 'fuera';
    }
    // Privado a quien la pidió.
    const user = await client.users.fetch(sol.userId).catch(() => null);
    if (user) {
        const idioma = await idiomaMiembro(sol.userId, { cfg });
        const servidor = guild ? guild.name : '';
        const texto = aceptar
            ? (form?.mensajeAceptado || t(idioma, `🎉 ¡Tu solicitud «${sol.formularioNombre}» en **${servidor}** ha sido aceptada!`, `🎉 Your “${sol.formularioNombre}” application on **${servidor}** has been accepted!`))
            : t(idioma, `Tu solicitud «${sol.formularioNombre}» en **${servidor}** no ha salido esta vez.${sol.motivo ? `\n> ${sol.motivo}` : ''}`, `Your “${sol.formularioNombre}” application on **${servidor}** wasn’t accepted this time.${sol.motivo ? `\n> ${sol.motivo}` : ''}`);
        await user.send({ content: texto.slice(0, 2000) }).catch(() => {});
    }
    // El aviso del staff dice qué se hizo y se queda sin botones.
    const canal = sol.revisionCanalId ? client.channels.cache.get(sol.revisionCanalId) : null;
    const msg = canal && sol.revisionMensajeId ? await canal.messages.fetch(sol.revisionMensajeId).catch(() => null) : null;
    if (msg) {
        const embed = EmbedBuilder.from(msg.embeds[0] || {})
            .setColor(aceptar ? '#22c55e' : '#ef4444')
            .setFooter({ text: aceptar ? t(cfg, `✅ Aceptada por ${revisor}`, `✅ Accepted by ${revisor}`) : t(cfg, `✖️ Rechazada por ${revisor}${sol.motivo ? `: ${sol.motivo}` : ''}`, `✖️ Rejected by ${revisor}${sol.motivo ? `: ${sol.motivo}` : ''}`).slice(0, 2048) });
        await msg.edit({ embeds: [embed], components: [] }).catch(() => {});
    }
    return { ok: true, solicitud: sol, aviso };
}

async function manejarBoton(interaction, client) {
    const id = interaction.customId;
    if (interaction.isButton() && id.startsWith('sol_abrir:')) return abrir(interaction);
    if (interaction.isModalSubmit() && id.startsWith('sol_modal:')) return procesarModal(interaction);
    const cfg = await getConfigCached(interaction.guildId).catch(() => null);
    if (!puedeRevisar(interaction.member, cfg)) return interaction.reply({ content: t(cfg, '❌ Solo el staff puede revisar las solicitudes.', '❌ Only the staff can review applications.'), flags: 64 });
    const solId = id.split(':')[1];
    if (interaction.isButton() && id.startsWith('sol_no:')) {
        // Rechazar: primero una ventana para el motivo (opcional).
        const modal = new ModalBuilder().setCustomId(`sol_nomodal:${solId}`).setTitle(t(cfg, 'Rechazar la solicitud', 'Reject the application'))
            .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('motivo').setLabel(t(cfg, 'Motivo (se le envía; opcional)', 'Reason (sent to them; optional)')).setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)));
        return interaction.showModal(modal);
    }
    const aceptar = id.startsWith('sol_ok:');
    const motivo = interaction.isModalSubmit() ? interaction.fields.getTextInputValue('motivo') : '';
    await interaction.deferReply({ flags: 64 });
    const r = await resolver(client, solId, { aceptar, motivo, revisor: interaction.user.username });
    if (!r.ok) return interaction.editReply(t(cfg, 'Otra persona del staff ya la ha revisado.', 'Someone else on the staff already reviewed it.'));
    const extra = r.aviso === 'rol' ? t(cfg, ' ⚠️ Pero no he podido darle el rol (¿está por encima del mío?).', ' ⚠️ But I couldn’t give them the role (is it above mine?).') : r.aviso === 'fuera' ? t(cfg, ' ⚠️ Ya no está en el servidor.', ' ⚠️ They’re no longer on the server.') : '';
    return interaction.editReply((aceptar ? t(cfg, '✅ Aceptada.', '✅ Accepted.') : t(cfg, '✖️ Rechazada.', '✖️ Rejected.')) + extra);
}

module.exports = { publicarPanel, mensajePanel, abrir, procesarModal, resolver, manejarBoton, formularioDe, MAX_PREGUNTAS };
