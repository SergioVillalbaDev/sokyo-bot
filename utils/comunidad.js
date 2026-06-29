// Comunidad: lógica de Discord para sorteos, eventos, encuestas, sugerencias y
// presentaciones. El panel web (api/comunidadRoutes.js) crea/borra los documentos;
// aquí publicamos los mensajes en Discord, manejamos las interacciones (votos,
// participaciones, modales) y resolvemos lo que vence (lo llama el scheduler).
const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const Encuesta = require('../models/Encuesta.js');
const Sorteo = require('../models/Sorteo.js');
const Evento = require('../models/Evento.js');
const Sugerencia = require('../models/Sugerencia.js');
const Presentacion = require('../models/Presentacion.js');
const ActividadUsuario = require('../models/ActividadUsuario.js');
const { aplicarPieMarca } = require('./marca.js');

const COLOR = '#5865F2';
const EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

function barra(pct, len = 12) {
    const llenos = Math.round((pct / 100) * len);
    return '█'.repeat(llenos) + '░'.repeat(Math.max(0, len - llenos));
}

async function colorDe(guildId, fallback = COLOR) {
    try {
        const cfg = await ServidorConfig.findOne({ guildId }).select('colorEmbed').lean();
        return cfg?.colorEmbed || fallback;
    } catch { return fallback; }
}

// Las imágenes subidas desde el panel se guardan como `/uploads/xxx` (ruta
// relativa). Discord necesita una URL absoluta, así que le anteponemos el
// dominio público (FRONTEND_URL) que sirve también esos archivos.
function urlAbs(u) {
    if (!u || typeof u !== 'string') return null;
    if (/^https?:\/\//i.test(u)) return u;
    if (u.startsWith('/uploads/')) return `${(process.env.FRONTEND_URL || '').replace(/\/$/, '')}${u}`;
    return null;
}

// ============================ ENCUESTAS ============================

function construirEmbedEncuesta(enc, color, cerrada = false) {
    const total = enc.opciones.reduce((s, o) => s + (o.votos || 0), 0);
    const lineas = enc.opciones.map((o, i) => {
        const pct = total === 0 ? 0 : Math.round((o.votos / total) * 100);
        return `${EMOJIS[i]} **${o.texto}**\n\`${barra(pct)}\` ${pct}% · ${o.votos} vote${o.votos === 1 ? '' : 's'}`;
    });
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`📊 ${enc.pregunta}`)
        .setDescription(lineas.join('\n\n'))
        .setFooter({ text: `${total} vote${total === 1 ? '' : 's'}${enc.multiple ? ' · Multiple choice' : ''}${enc.anonima ? ' · Anonymous' : ''}` });
    if (cerrada) {
        const ganadora = enc.opciones.reduce((a, b) => (b.votos > (a?.votos ?? -1) ? b : a), null);
        embed.setTitle(`🔒 ${enc.pregunta}`)
            .addFields({ name: 'Poll closed', value: total > 0 ? `🏆 Most voted: **${ganadora.texto}**` : 'No votes.' });
    }
    return embed;
}

function filasEncuesta(enc) {
    const botones = enc.opciones.map((o, i) =>
        new ButtonBuilder().setCustomId(`enc_vote:${enc._id}:${i}`).setEmoji(EMOJIS[i]).setStyle(ButtonStyle.Secondary));
    const filas = [];
    for (let i = 0; i < botones.length; i += 5) {
        filas.push(new ActionRowBuilder().addComponents(botones.slice(i, i + 5)));
    }
    return filas;
}

async function publicarEncuesta(client, enc) {
    const canal = await client.channels.fetch(enc.canalId).catch(() => null);
    if (!canal?.isTextBased()) return false;
    const color = await colorDe(enc.guildId);
    const msg = await canal.send({ embeds: [construirEmbedEncuesta(enc, color)], components: filasEncuesta(enc) }).catch(() => null);
    if (!msg) return false;
    enc.mensajeId = msg.id;
    await enc.save().catch(() => {});
    return true;
}

async function manejarVotoEncuesta(interaction) {
    try {
        const [, id, idxStr] = interaction.customId.split(':');
        const idx = Number(idxStr);
        const enc = await Encuesta.findById(id);
        if (!enc || !enc.activa) return interaction.reply({ content: '⏹️ This poll is no longer active.', ephemeral: true });
        if (!enc.opciones[idx]) return interaction.reply({ content: '❌ Invalid option.', ephemeral: true });
        const uid = interaction.user.id;

        const yaEnEsta = enc.opciones[idx].votantes.includes(uid);
        if (yaEnEsta) {
            // Quitar el voto (toggle).
            enc.opciones[idx].votantes = enc.opciones[idx].votantes.filter((v) => v !== uid);
            enc.opciones[idx].votos = Math.max(0, enc.opciones[idx].votos - 1);
        } else {
            if (!enc.multiple) {
                // Voto único: quitar de cualquier otra opción.
                enc.opciones.forEach((o) => {
                    if (o.votantes.includes(uid)) {
                        o.votantes = o.votantes.filter((v) => v !== uid);
                        o.votos = Math.max(0, o.votos - 1);
                    }
                });
            }
            enc.opciones[idx].votantes.push(uid);
            enc.opciones[idx].votos += 1;
        }
        await enc.save();

        const color = await colorDe(enc.guildId);
        await interaction.update({ embeds: [construirEmbedEncuesta(enc, color)], components: filasEncuesta(enc) }).catch(() => {});
    } catch (e) {
        console.error('Voto encuesta:', e.message);
        if (!interaction.replied) interaction.reply({ content: '❌ Error al votar.', ephemeral: true }).catch(() => {});
    }
}

async function cerrarEncuesta(client, enc) {
    enc.activa = false;
    await enc.save().catch(() => {});
    try {
        const canal = await client.channels.fetch(enc.canalId).catch(() => null);
        if (canal?.isTextBased() && enc.mensajeId) {
            const msg = await canal.messages.fetch(enc.mensajeId).catch(() => null);
            const color = await colorDe(enc.guildId);
            if (msg) await msg.edit({ embeds: [construirEmbedEncuesta(enc, color, true)], components: [] }).catch(() => {});
        }
    } catch (e) { console.error('Cerrar encuesta:', e.message); }
}

// ============================ SORTEOS ============================

function construirEmbedSorteo(s, color, finalizado = false) {
    const embed = new EmbedBuilder()
        .setColor(finalizado ? '#95a5a6' : color)
        .setTitle(`🎉 ${s.nombre}`)
        .setDescription(`**Prize:** ${s.premio}`)
        .addFields(
            { name: '🏆 Ganadores', value: `${s.ganadores}`, inline: true },
            { name: '👥 Participantes', value: `${s.participantes.length}`, inline: true },
        );
    const reqs = [];
    if (s.nivelMin > 0) reqs.push(`Nivel ${s.nivelMin}+`);
    if (s.rolRequerido) reqs.push(`Rol <@&${s.rolRequerido}>`);
    if (reqs.length) embed.addFields({ name: '📋 Requisitos', value: reqs.join(' · '), inline: false });
    if (s.multiplicadores?.length) {
        embed.addFields({
            name: '✨ Multiplicadores',
            value: s.multiplicadores.map((m) => `<@&${m.rolId}> ×${m.multiplicador}`).join(' · '),
            inline: false,
        });
    }
    const img = urlAbs(s.imagen);
    if (img) embed.setImage(img);

    if (finalizado) {
        const ganadores = s.ganadoresSeleccionados.length
            ? s.ganadoresSeleccionados.map((g) => `<@${g.id}>`).join(', ')
            : 'Nobody met the requirements 😢';
        embed.setTitle(`🎊 ${s.nombre} — Ended!`).addFields({ name: '🏆 Winner(s)', value: ganadores });
    } else {
        embed.addFields({ name: '⏰ Ends', value: `<t:${Math.floor(new Date(s.fechaFin).getTime() / 1000)}:R>`, inline: false });
    }
    return embed;
}

function filaSorteo(s) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`sorteo_join:${s._id}`).setLabel(`🎉 Join (${s.participantes.length})`).setStyle(ButtonStyle.Primary),
    );
}

async function publicarSorteo(client, s) {
    const canal = await client.channels.fetch(s.canalId).catch(() => null);
    if (!canal?.isTextBased()) return false;
    const color = await colorDe(s.guildId);
    const msg = await canal.send({ embeds: [construirEmbedSorteo(s, color)], components: [filaSorteo(s)] }).catch(() => null);
    if (!msg) return false;
    s.mensajeId = msg.id;
    await s.save().catch(() => {});
    return true;
}

async function manejarEntradaSorteo(interaction) {
    try {
        const id = interaction.customId.split(':')[1];
        const s = await Sorteo.findById(id);
        if (!s || !s.activo) return interaction.reply({ content: '⏹️ This giveaway has already ended.', ephemeral: true });
        const uid = interaction.user.id;

        if (s.participantes.includes(uid)) {
            s.participantes = s.participantes.filter((p) => p !== uid);
            await s.save();
            await actualizarMensajeSorteo(interaction.client, s).catch(() => {});
            return interaction.reply({ content: '➖ You left the giveaway.', ephemeral: true });
        }

        // Requisitos.
        if (s.rolRequerido && !interaction.member.roles.cache.has(s.rolRequerido)) {
            return interaction.reply({ content: `❌ You need the <@&${s.rolRequerido}> role to join.`, ephemeral: true });
        }
        if (s.nivelMin > 0) {
            const act = await ActividadUsuario.findOne({ guildId: s.guildId, userId: uid }).select('nivel').lean();
            if ((act?.nivel || 0) < s.nivelMin) {
                return interaction.reply({ content: `❌ You need to be **level ${s.nivelMin}** or higher to join.`, ephemeral: true });
            }
        }

        s.participantes.push(uid);
        await s.save();
        await actualizarMensajeSorteo(interaction.client, s).catch(() => {});
        return interaction.reply({ content: '✅ You’re in the giveaway! Good luck 🍀', ephemeral: true });
    } catch (e) {
        console.error('Entrada sorteo:', e.message);
        if (!interaction.replied) interaction.reply({ content: '❌ Error joining.', ephemeral: true }).catch(() => {});
    }
}

async function actualizarMensajeSorteo(client, s) {
    if (!s.mensajeId) return;
    const canal = await client.channels.fetch(s.canalId).catch(() => null);
    if (!canal?.isTextBased()) return;
    const msg = await canal.messages.fetch(s.mensajeId).catch(() => null);
    if (!msg) return;
    const color = await colorDe(s.guildId);
    await msg.edit({ embeds: [construirEmbedSorteo(s, color)], components: [filaSorteo(s)] }).catch(() => {});
}

// Elige `n` ganadores al azar PONDERADO por peso (sin repetir). `pesos` es un
// mapa userId -> nº de "papeletas" (1 por defecto, más si tiene rol multiplicador).
function elegirPonderado(lista, n, pesos) {
    const pool = lista.map((id) => ({ id, peso: Math.max(1, pesos?.[id] || 1) }));
    const out = [];
    while (out.length < n && pool.length) {
        const total = pool.reduce((s, p) => s + p.peso, 0);
        let r = Math.random() * total;
        let idx = 0;
        for (let i = 0; i < pool.length; i++) { r -= pool[i].peso; if (r <= 0) { idx = i; break; } }
        out.push(pool.splice(idx, 1)[0].id);
    }
    return out;
}

// Termina un sorteo: elige ganadores, edita el mensaje y los anuncia.
// reroll=true vuelve a elegir entre los participantes (sorteo ya finalizado).
async function finalizarSorteo(client, s, { reroll = false } = {}) {
    const guild = client.guilds.cache.get(s.guildId);

    // Calcular papeletas según los roles multiplicadores (se aplica el mayor).
    const pesos = {};
    if (s.multiplicadores?.length && guild) {
        for (const id of s.participantes) {
            const miembro = await guild.members.fetch(id).catch(() => null);
            let mejor = 1;
            if (miembro) {
                for (const m of s.multiplicadores) {
                    if (miembro.roles.cache.has(m.rolId)) mejor = Math.max(mejor, m.multiplicador || 1);
                }
            }
            pesos[id] = mejor;
        }
    }

    const ids = elegirPonderado(s.participantes, Math.max(1, s.ganadores), pesos);
    const ganadores = [];
    for (const id of ids) {
        const miembro = guild ? await guild.members.fetch(id).catch(() => null) : null;
        ganadores.push({ id, tag: miembro?.user?.tag || id });
    }
    s.ganadoresSeleccionados = ganadores;
    s.activo = false;
    await s.save().catch(() => {});

    const canal = await client.channels.fetch(s.canalId).catch(() => null);
    if (canal?.isTextBased()) {
        const color = await colorDe(s.guildId);
        if (s.mensajeId) {
            const msg = await canal.messages.fetch(s.mensajeId).catch(() => null);
            if (msg) await msg.edit({ embeds: [construirEmbedSorteo(s, color, true)], components: [] }).catch(() => {});
        }
        const aviso = ganadores.length
            ? `🎊 ${reroll ? '**New draw**' : 'The giveaway'} **${s.nombre}** has ended.\n🏆 Winner(s): ${ganadores.map((g) => `<@${g.id}>`).join(', ')}\n🎁 Prize: **${s.premio}**`
            : `😢 The giveaway **${s.nombre}** ended with no valid participants.`;
        await canal.send({ content: aviso, allowedMentions: { users: ganadores.map((g) => g.id) } }).catch(() => {});
    }
    return ganadores;
}

// ============================ EVENTOS ============================

function construirEmbedEvento(e, color) {
    const ICONO = { voz: '🔊', escenario: '🎤', externo: '📍' };
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${ICONO[e.tipo] || '📅'} ${e.titulo}`)
        .addFields(
            { name: '🗓️ When', value: `<t:${Math.floor(new Date(e.fechaInicio).getTime() / 1000)}:F> (<t:${Math.floor(new Date(e.fechaInicio).getTime() / 1000)}:R>)` },
        );
    if (e.descripcion) embed.setDescription(e.descripcion);
    const img = urlAbs(e.portada);
    if (img) embed.setImage(img);
    return embed;
}

async function publicarEvento(client, e) {
    const canal = await client.channels.fetch(e.canalId).catch(() => null);
    if (!canal?.isTextBased()) return false;
    const color = await colorDe(e.guildId);
    const msg = await canal.send({ embeds: [construirEmbedEvento(e, color)] }).catch(() => null);
    if (!msg) return false;
    e.mensajeId = msg.id;
    await e.save().catch(() => {});
    return true;
}

// ============================ SUGERENCIAS ============================

function construirEmbedSugerencia(sug, color) {
    const neto = (sug.votos_pos || 0) - (sug.votos_neg || 0);
    const ESTADO = {
        pendiente: { t: '⏳ Pending', c: color },
        revision: { t: '👀 Under review', c: '#e67e22' },
        aceptada: { t: '✅ Accepted', c: '#2ecc71' },
        rechazada: { t: '❌ Rejected', c: '#e74c3c' },
    };
    const est = ESTADO[sug.estado] || ESTADO.pendiente;
    return new EmbedBuilder()
        .setColor(est.c)
        .setAuthor({ name: sug.autor || 'Anonymous' })
        .setDescription(sug.texto)
        .addFields(
            { name: 'Votes', value: `👍 ${sug.votos_pos || 0}  ·  👎 ${sug.votos_neg || 0}  ·  Net: **${neto >= 0 ? '+' : ''}${neto}**`, inline: true },
            { name: 'Status', value: est.t, inline: true },
        );
}

function filaSugerencia(sug) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`sug_up:${sug._id}`).setEmoji('👍').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`sug_down:${sug._id}`).setEmoji('👎').setStyle(ButtonStyle.Danger),
    );
}

// Crea la sugerencia y publica su embed con votos en el canal.
async function crearYPublicarSugerencia(canal, guildId, autor, texto, color) {
    const sug = await Sugerencia.create({
        guildId, canalId: canal.id, autorId: autor.id, autor: autor.tag, texto: texto.slice(0, 1000),
    });
    const enviado = await canal.send({ embeds: [construirEmbedSugerencia(sug, color)], components: [filaSugerencia(sug)] }).catch(() => null);
    if (enviado) { sug.mensajeId = enviado.id; await sug.save().catch(() => {}); }
    return sug;
}

// messageCreate: si el mensaje cae en el canal de sugerencias (modo 'mensaje'),
// lo convertimos en un embed con votos. En modo 'formulario' el canal está
// bloqueado y se sugiere por botón, así que aquí solo borramos lo que se cuele.
async function manejarMensajeSugerencia(message, cfg) {
    try {
        if (!cfg?.canalSugerencias || message.channelId !== cfg.canalSugerencias) return false;
        if (message.author.bot) return false;

        // En modo formulario el canal es "solo sugerencias": borra cualquier mensaje suelto.
        if (cfg.sugerenciasModo === 'formulario') { await message.delete().catch(() => {}); return true; }

        const texto = message.content?.trim();
        if (!texto) return false;
        if (cfg.sugerenciasMinLong > 0 && texto.length < cfg.sugerenciasMinLong) {
            await message.delete().catch(() => {});
            await message.author.send(`✍️ Your suggestion in **${message.guild?.name}** is too short (minimum ${cfg.sugerenciasMinLong} characters).`).catch(() => {});
            return true;
        }

        const color = cfg.colorEmbed || COLOR;
        await crearYPublicarSugerencia(message.channel, message.guildId, message.author, texto, color);
        await message.delete().catch(() => {}); // limpiar el mensaje original
        return true;
    } catch (e) { console.error('Mensaje sugerencia:', e.message); return false; }
}

// Publica (o republica) el panel del modo formulario y bloquea el chat libre
// del canal (deja solo el botón para sugerir).
async function publicarPanelSugerencias(client, guildId, cfg) {
    try {
        if (cfg?.sugerenciasModo !== 'formulario' || !cfg.canalSugerencias) return false;
        const canal = await client.channels.fetch(cfg.canalSugerencias).catch(() => null);
        if (!canal?.isTextBased()) return false;

        // Bloquear el envío de mensajes a @everyone (el bot sí puede; el botón funciona).
        try {
            await canal.permissionOverwrites.edit(canal.guild.roles.everyone, { SendMessages: false });
        } catch (e) { console.error('Bloqueo canal sugerencias:', e.message); }

        const color = cfg.colorEmbed || COLOR;
        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle('💡 Suggestions')
            .setDescription('Click the button to submit your suggestion. The community can vote it up/down 👍/👎.');
        aplicarPieMarca(embed, cfg);
        const fila = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`sug_nueva:${guildId}`).setLabel('💡 New suggestion').setStyle(ButtonStyle.Primary),
        );
        await canal.send({ embeds: [embed], components: [fila] }).catch(() => {});
        return true;
    } catch (e) { console.error('Panel sugerencias:', e.message); return false; }
}

// Botón "Nueva sugerencia" → modal con la plantilla configurada.
async function abrirModalSugerencia(interaction) {
    try {
        const guildId = interaction.customId.split(':')[1];
        const cfg = await ServidorConfig.findOne({ guildId }).select('sugerenciasPlantilla').lean();
        const input = new TextInputBuilder()
            .setCustomId('texto')
            .setLabel('Your suggestion')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);
        if (cfg?.sugerenciasPlantilla) input.setValue(cfg.sugerenciasPlantilla.slice(0, 1000));
        const modal = new ModalBuilder().setCustomId(`sug_modal:${guildId}`).setTitle('New suggestion')
            .addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    } catch (e) {
        console.error('Modal sugerencia:', e.message);
        if (!interaction.replied) interaction.reply({ content: '❌ No se pudo abrir el formulario.', ephemeral: true }).catch(() => {});
    }
}

// Modal de sugerencia enviado → crea y publica la sugerencia.
async function procesarModalSugerencia(interaction) {
    try {
        const guildId = interaction.customId.split(':')[1];
        const cfg = await ServidorConfig.findOne({ guildId }).lean();
        const texto = (interaction.fields.getTextInputValue('texto') || '').trim();
        if (!texto) return interaction.reply({ content: '❌ The suggestion is empty.', ephemeral: true });
        if (cfg?.sugerenciasMinLong > 0 && texto.length < cfg.sugerenciasMinLong) {
            return interaction.reply({ content: `✍️ Too short (minimum ${cfg.sugerenciasMinLong} characters).`, ephemeral: true });
        }
        const canal = interaction.channel;
        await crearYPublicarSugerencia(canal, guildId, interaction.user, texto, cfg?.colorEmbed || COLOR);
        await interaction.reply({ content: '✅ Suggestion submitted! Thank you.', ephemeral: true }).catch(() => {});
    } catch (e) {
        console.error('Procesar modal sugerencia:', e.message);
        if (!interaction.replied) interaction.reply({ content: '❌ Error submitting the suggestion.', ephemeral: true }).catch(() => {});
    }
}

async function manejarVotoSugerencia(interaction) {
    try {
        const [tipo, id] = interaction.customId.split(':');
        const sug = await Sugerencia.findById(id);
        if (!sug) return interaction.reply({ content: '❌ This suggestion no longer exists.', ephemeral: true });
        const uid = interaction.user.id;
        const positivo = tipo === 'sug_up';

        // Quitar voto previo del lado contrario.
        if (positivo) {
            if (sug.votantes_neg.includes(uid)) { sug.votantes_neg = sug.votantes_neg.filter((v) => v !== uid); sug.votos_neg = Math.max(0, sug.votos_neg - 1); }
            if (sug.votantes_pos.includes(uid)) { sug.votantes_pos = sug.votantes_pos.filter((v) => v !== uid); sug.votos_pos = Math.max(0, sug.votos_pos - 1); }
            else { sug.votantes_pos.push(uid); sug.votos_pos += 1; }
        } else {
            if (sug.votantes_pos.includes(uid)) { sug.votantes_pos = sug.votantes_pos.filter((v) => v !== uid); sug.votos_pos = Math.max(0, sug.votos_pos - 1); }
            if (sug.votantes_neg.includes(uid)) { sug.votantes_neg = sug.votantes_neg.filter((v) => v !== uid); sug.votos_neg = Math.max(0, sug.votos_neg - 1); }
            else { sug.votantes_neg.push(uid); sug.votos_neg += 1; }
        }
        await sug.save();
        const color = await colorDe(sug.guildId);
        await interaction.update({ embeds: [construirEmbedSugerencia(sug, color)], components: [filaSugerencia(sug)] }).catch(() => {});
    } catch (e) {
        console.error('Voto sugerencia:', e.message);
        if (!interaction.replied) interaction.reply({ content: '❌ Error al votar.', ephemeral: true }).catch(() => {});
    }
}

// Refresca el embed de una sugerencia en Discord (tras cambiar estado en el panel).
async function refrescarSugerencia(client, sug) {
    if (!sug.mensajeId || !sug.canalId) return;
    const canal = await client.channels.fetch(sug.canalId).catch(() => null);
    if (!canal?.isTextBased()) return;
    const msg = await canal.messages.fetch(sug.mensajeId).catch(() => null);
    if (!msg) return;
    const color = await colorDe(sug.guildId);
    await msg.edit({ embeds: [construirEmbedSugerencia(sug, color)], components: [filaSugerencia(sug)] }).catch(() => {});
}

// ============================ PRESENTACIONES ============================

// Publica (o republica) el panel con el botón "Presentarme" en el canal de intro.
async function publicarPanelPresentacion(client, guildId, cfg) {
    try {
        const pres = cfg?.presentaciones;
        if (!pres?.activo || !pres.canalIntro) return false;
        const canal = await client.channels.fetch(pres.canalIntro).catch(() => null);
        if (!canal?.isTextBased()) return false;
        const color = cfg.colorEmbed || COLOR;
        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle('👋 Introduce yourself to the community!')
            .setDescription('Click the button to fill out a short intro so everyone gets to know you.');
        aplicarPieMarca(embed, cfg);
        const fila = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`intro_start:${guildId}`).setLabel('📝 Presentarme').setStyle(ButtonStyle.Primary),
        );
        await canal.send({ embeds: [embed], components: [fila] }).catch(() => {});
        return true;
    } catch (e) { console.error('Panel presentación:', e.message); return false; }
}

// Botón "Presentarme" → abre el modal. En modo 'plantilla' es un único campo
// rellenable; en modo 'preguntas', un campo por pregunta (máx. 5, límite Discord).
async function abrirModalPresentacion(interaction) {
    try {
        const guildId = interaction.customId.split(':')[1];
        const cfg = await ServidorConfig.findOne({ guildId }).select('presentaciones').lean();
        const pres = cfg?.presentaciones || {};
        const modal = new ModalBuilder().setCustomId(`intro_modal:${guildId}`).setTitle('Your intro');

        if (pres.modo === 'plantilla') {
            const input = new TextInputBuilder()
                .setCustomId('_plantilla')
                .setLabel('Fill out your intro')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(1500);
            if (pres.plantilla) input.setValue(pres.plantilla.slice(0, 1500));
            modal.addComponents(new ActionRowBuilder().addComponents(input));
        } else {
            const preguntas = (pres.preguntas || []).slice(0, 5);
            if (!preguntas.length) return interaction.reply({ content: '❌ No questions are configured.', ephemeral: true });
            preguntas.forEach((p) => {
                const input = new TextInputBuilder()
                    .setCustomId(p.id)
                    .setLabel((p.texto || 'Pregunta').slice(0, 45))
                    .setStyle(p.tipo === 'texto' ? TextInputStyle.Paragraph : TextInputStyle.Short)
                    .setRequired(!!p.requerida)
                    .setMaxLength(p.tipo === 'numero' ? 6 : 300);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
            });
        }
        await interaction.showModal(modal);
    } catch (e) {
        console.error('Modal presentación:', e.message);
        if (!interaction.replied) interaction.reply({ content: '❌ No se pudo abrir el formulario.', ephemeral: true }).catch(() => {});
    }
}

// Evalúa los filtros sobre las respuestas (mapa { preguntaId: valor }). En modo
// plantilla, todos los campos evalúan contra el texto completo (_plantilla).
function evaluarFiltros(filtros, respuestasPorId, plantilla = false) {
    for (const f of filtros || []) {
        const val = (plantilla ? (respuestasPorId._plantilla || '') : (respuestasPorId[f.campo] || '')).trim();
        if (val === '') continue;
        let coincide = false;
        const num = parseFloat(val);
        const objetivo = f.valor ?? '';
        const objNum = parseFloat(objetivo);
        switch (f.operador) {
            case 'menor_que': coincide = !isNaN(num) && !isNaN(objNum) && num < objNum; break;
            case 'mayor_que': coincide = !isNaN(num) && !isNaN(objNum) && num > objNum; break;
            case 'igual_a': coincide = val.toLowerCase() === String(objetivo).toLowerCase(); break;
            case 'contiene': coincide = val.toLowerCase().includes(String(objetivo).toLowerCase()); break;
            case 'no_contiene': coincide = !val.toLowerCase().includes(String(objetivo).toLowerCase()); break;
            default: coincide = false;
        }
        if (coincide) return f; // primer filtro que dispara
    }
    return null;
}

// Modal enviado → guarda la presentación, aplica filtros y avisa al staff.
async function procesarPresentacion(interaction) {
    try {
        const guildId = interaction.customId.split(':')[1];
        const cfg = await ServidorConfig.findOne({ guildId }).lean();
        const pres = cfg?.presentaciones || {};
        const modoPlantilla = pres.modo === 'plantilla';

        const respuestas = [];
        const respuestasPorId = {};
        if (modoPlantilla) {
            let v = '';
            try { v = interaction.fields.getTextInputValue('_plantilla') || ''; } catch { v = ''; }
            respuestas.push({ pregunta: 'Intro', respuesta: v });
            respuestasPorId._plantilla = v;
        } else {
            (pres.preguntas || []).slice(0, 5).forEach((p) => {
                let v = '';
                try { v = interaction.fields.getTextInputValue(p.id) || ''; } catch { v = ''; }
                respuestas.push({ pregunta: p.texto || p.id, respuesta: v });
                respuestasPorId[p.id] = v;
            });
        }

        const filtro = evaluarFiltros(pres.filtros, respuestasPorId, modoPlantilla);
        // Acciones de moderación automáticas si el filtro las pide.
        const accionMod = filtro && ['banear', 'expulsar', 'aislar'].includes(filtro.accion);
        if (accionMod && interaction.member) {
            try {
                if (filtro.accion === 'banear') await interaction.member.ban({ reason: 'Intro filter' });
                else if (filtro.accion === 'expulsar') await interaction.member.kick('Intro filter');
                else if (filtro.accion === 'aislar') await interaction.member.timeout(60 * 60 * 1000, 'Intro filter'); // 1 hora
            } catch (e) { console.error('Acción mod presentación:', e.message); }
        }
        const descartada = !!(filtro && (filtro.accion === 'descartar' || accionMod));
        const marcada = !!(filtro && filtro.accion === 'marcar');

        await Presentacion.create({
            guildId,
            autorId: interaction.user.id,
            autor: interaction.user.tag,
            respuestas,
            descartada,
            motivoDescarte: filtro ? `Filtro: ${filtro.campo} ${filtro.operador} ${filtro.valor}` : '',
            procesada: descartada, // si se descarta automáticamente, ya está "resuelta"
        });

        // Aviso al usuario si el filtro lo pide.
        if (filtro && filtro.avisarUsuario && filtro.mensajeAviso) {
            await interaction.user.send(filtro.mensajeAviso).catch(() => {});
        }

        // Publicar al staff (salvo descarte silencioso ya avisado).
        if (pres.canalStaff && !descartada) {
            const canal = await interaction.client.channels.fetch(pres.canalStaff).catch(() => null);
            if (canal?.isTextBased()) {
                const color = cfg.colorEmbed || COLOR;
                const embed = new EmbedBuilder()
                    .setColor(marcada ? '#e67e22' : color)
                    .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                    .setTitle('📝 New intro')
                    .addFields(respuestas.map((r) => ({ name: r.pregunta.slice(0, 256), value: (r.respuesta || '—').slice(0, 1024) })));
                if (marcada) embed.setFooter({ text: `⚠️ Marcada por filtro: ${filtro.campo} ${filtro.operador} ${filtro.valor}` });
                await canal.send({ embeds: [embed] }).catch(() => {});
            }
        }

        const respuesta = descartada
            ? (filtro?.mensajeAviso ? '📩 We’ve sent you a message with more info.' : '❌ Your intro doesn’t meet the server’s requirements.')
            : '✅ Thanks! Your intro was submitted successfully.';
        await interaction.reply({ content: respuesta, ephemeral: true }).catch(() => {});
    } catch (e) {
        console.error('Procesar presentación:', e.message);
        if (!interaction.replied) interaction.reply({ content: '❌ Error submitting your intro.', ephemeral: true }).catch(() => {});
    }
}

// ============================ SCHEDULER ============================

// Barrido periódico: cierra encuestas vencidas, termina sorteos vencidos y
// envía los recordatorios de eventos. Lo llama utils/scheduler.js.
async function barrerComunidad(client) {
    const ahora = new Date();

    // Encuestas vencidas.
    const encuestas = await Encuesta.find({ activa: true, fechaFin: { $lte: ahora } });
    for (const enc of encuestas) {
        try { await cerrarEncuesta(client, enc); } catch (e) { console.error('Cierre encuesta:', e.message); }
    }

    // Sorteos vencidos.
    const sorteos = await Sorteo.find({ activo: true, fechaFin: { $lte: ahora } });
    for (const s of sorteos) {
        try { await finalizarSorteo(client, s); } catch (e) { console.error('Fin sorteo:', e.message); }
    }

    // Recordatorios de eventos (X min antes del inicio).
    const eventos = await Evento.find({ recordatorio: { $gt: 0 }, recordatorioEnviado: false, fechaInicio: { $gt: ahora } });
    for (const e of eventos) {
        const avisoEn = new Date(new Date(e.fechaInicio).getTime() - e.recordatorio * 60000);
        if (avisoEn > ahora) continue;
        try {
            const canal = await client.channels.fetch(e.canalId).catch(() => null);
            if (canal?.isTextBased()) {
                await canal.send(`🔔 **Recordatorio:** el evento **${e.titulo}** empieza <t:${Math.floor(new Date(e.fechaInicio).getTime() / 1000)}:R>.`).catch(() => {});
            }
            e.recordatorioEnviado = true;
            await e.save().catch(() => {});
        } catch (err) { console.error('Recordatorio evento:', err.message); }
    }
}

module.exports = {
    // encuestas
    publicarEncuesta, manejarVotoEncuesta, cerrarEncuesta,
    // sorteos
    publicarSorteo, manejarEntradaSorteo, finalizarSorteo,
    // eventos
    publicarEvento,
    // sugerencias
    manejarMensajeSugerencia, manejarVotoSugerencia, refrescarSugerencia,
    publicarPanelSugerencias, abrirModalSugerencia, procesarModalSugerencia,
    // presentaciones
    publicarPanelPresentacion, abrirModalPresentacion, procesarPresentacion,
    // scheduler
    barrerComunidad,
};
