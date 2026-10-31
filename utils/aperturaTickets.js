// Flujo para abrir un ticket desde Discord:
// botón del panel → (menú de tipos) → formulario del tipo → (respuesta de la IA con la FAQ) → ticket.
const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
    ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, RESTJSONErrorCodes
} = require('discord.js');
const crypto = require('crypto');
const Articulo = require('../models/Articulo.js');
const Ticket = require('../models/Ticket.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { obtenerConfig, buscarMotivo, buscarPanel, motivosDePanel, preguntasDe } = require('./config.js');
const { crearTicket, comprobarLimite } = require('./ticketManager.js');
const { pieDePagina, filaMarca } = require('./marca.js');
const { registrarLog } = require('./logs.js');
const ia = require('./ia.js');

const EFIMERO = { flags: MessageFlags.Ephemeral };
const esColor = (c) => /^#[0-9a-f]{6}$/i.test(c || '');
const esEmoji = (e) => !!e && (/^<a?:\w+:\d+>$/.test(e) || (/\p{Extended_Pictographic}/u.test(e) && [...e].length <= 4));

// ---------- Mensaje del panel ----------

function mensajePanel(config, panel, client) {
    const embed = new EmbedBuilder()
        .setTitle((panel.titulo || '🎫 Soporte').slice(0, 256))
        .setDescription((panel.descripcion || 'Pulsa el botón para abrir un ticket.').slice(0, 4096))
        .setColor(esColor(panel.color) ? panel.color : '#5865F2')
        .setFooter({ text: pieDePagina(config) });

    const fila = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`abrir_panel:${panel._id}`)
            .setLabel((panel.textoBoton || '📩 Abrir Ticket').slice(0, 80))
            .setStyle(ButtonStyle.Primary)
    );
    const marca = filaMarca(config, client);
    if (marca) fila.addComponents(marca.components[0]);
    return { embeds: [embed], components: [fila] };
}

// ---------- Formulario (modal) ----------

function construirModal(motivo) {
    const modal = new ModalBuilder()
        .setCustomId(`abrir:${motivo._id}`)
        .setTitle(`Ticket: ${motivo.nombre}`.slice(0, 45));
    preguntasDe(motivo).slice(0, 5).forEach((p, i) => {
        const input = new TextInputBuilder()
            .setCustomId(`p${i}`)
            .setLabel(p.etiqueta.slice(0, 45))
            .setStyle(p.estilo === 'corto' ? TextInputStyle.Short : TextInputStyle.Paragraph)
            .setRequired(p.requerida !== false)
            .setMaxLength(Math.min(Math.max(Number(p.max) || 1000, 10), 4000));
        if (p.placeholder) input.setPlaceholder(p.placeholder.slice(0, 100));
        modal.addComponents(new ActionRowBuilder().addComponents(input));
    });
    return modal;
}

// Botón del panel ("abrir_panel:<id>" o el antiguo "create_ticket").
async function alPulsarPanel(interaction) {
    const panelId = interaction.customId.startsWith('abrir_panel:') ? interaction.customId.split(':')[1] : null;
    const config = await obtenerConfig(interaction.guildId);

    const limite = await comprobarLimite(interaction.guildId, interaction.user.id, config);
    if (!limite.ok) {
        const enlaces = limite.abiertos.map(t => `<#${t.canalId}>`).join(', ');
        return interaction.reply({ content: `⚠️ Ya tienes ticket(s) abierto(s): ${enlaces}. Usa esos o ciérralos antes de abrir otro.`, ...EFIMERO });
    }

    const panel = buscarPanel(config, panelId) || buscarPanel(config);
    const motivos = motivosDePanel(config, panel).slice(0, 25);
    if (motivos.length === 0) {
        return interaction.reply({ content: '❌ Este servidor aún no tiene tipos de ticket configurados.', ...EFIMERO });
    }
    if (motivos.length === 1) return interaction.showModal(construirModal(motivos[0]));

    const menu = new StringSelectMenuBuilder()
        .setCustomId('sel_motivo')
        .setPlaceholder('👉 Selecciona el motivo de tu consulta...')
        .addOptions(motivos.map(m => {
            const opcion = {
                label: m.nombre.slice(0, 100),
                description: (m.descripcion || `Prioridad: ${m.urgencia}`).slice(0, 100),
                value: String(m._id)
            };
            if (esEmoji(m.emoji)) opcion.emoji = m.emoji;
            return opcion;
        }));
    return interaction.reply({
        content: 'Por favor, selecciona una categoría para poder ayudarte mejor:',
        components: [new ActionRowBuilder().addComponents(menu)],
        ...EFIMERO
    });
}

// Menú de tipos ("sel_motivo" o el antiguo "seleccionar_motivo_ticket" con el nombre).
async function alElegirMotivo(interaction) {
    const config = await obtenerConfig(interaction.guildId);
    const motivo = buscarMotivo(config, interaction.values[0]);
    if (!motivo) return interaction.update({ content: '❌ Ese tipo de ticket ya no existe.', components: [] });
    return interaction.showModal(construirModal(motivo));
}

// ---------- Envío del formulario ----------

// Consultas resueltas por la IA a la espera de que el usuario confirme (id → datos).
const pendientes = new Map();
const CADUCIDAD_MS = 15 * 60 * 1000;
setInterval(() => {
    const ahora = Date.now();
    for (const [id, p] of pendientes) if (p.expira < ahora) pendientes.delete(id);
}, 10 * 60 * 1000).unref();

function errorAmigable(error) {
    if (error?.code === RESTJSONErrorCodes.MissingPermissions || error?.code === RESTJSONErrorCodes.MissingAccess) {
        return '❌ El bot no tiene permisos para crear el canal del ticket. Un administrador debe ejecutar `/setup` o darle los permisos **Gestionar canales** y **Gestionar roles**.';
    }
    return '❌ Hubo un error al crear el ticket. Inténtalo de nuevo en un momento.';
}

async function abrirYResponder(interaction, client, motivoId, respuestas) {
    try {
        const res = await crearTicket(client, { guild: interaction.guild, user: interaction.user, motivoId, respuestas });
        if (!res.ok) return interaction.editReply({ content: `⚠️ ${res.error}`, embeds: [], components: [] });
        return interaction.editReply({ content: `✅ Tu ticket ha sido creado: <#${res.canal.id}>`, embeds: [], components: [] });
    } catch (error) {
        console.error('Error creando ticket:', error);
        return interaction.editReply({ content: errorAmigable(error), embeds: [], components: [] }).catch(() => {});
    }
}

async function conocimientoDelServidor(guildId) {
    const [articulos, cerrados] = await Promise.all([
        Articulo.find({ guildId }).sort({ usos: -1, fecha: -1 }).limit(60).lean(),
        Ticket.find({
            guildId, estado: 'Cerrado', 'ia.resumenCierre': { $ne: null },
            $or: [{ valoracionCSAT: null }, { valoracionCSAT: { $gte: 4 } }]
        }).sort({ fechaCierre: -1 }).limit(20).select('motivo titulo ia.resumenCierre').lean()
    ]);
    const resueltos = cerrados.map(t => `Tipo: ${t.motivo}. Consulta: ${t.titulo}. Cómo se resolvió: ${t.ia.resumenCierre}`);
    return { articulos, resueltos };
}

async function alEnviarFormulario(interaction, client) {
    const motivoId = interaction.customId.slice('abrir:'.length);
    const config = await obtenerConfig(interaction.guildId);
    const motivo = buscarMotivo(config, motivoId);

    // Responder ya: si venía del menú efímero lo reemplazamos; si venía del panel público, respuesta efímera nueva.
    const desdeEfimero = interaction.isFromMessage() && interaction.message?.flags?.has(MessageFlags.Ephemeral);
    if (desdeEfimero) await interaction.update({ content: '⏳ Procesando tu solicitud...', components: [], embeds: [] });
    else await interaction.reply({ content: '⏳ Procesando tu solicitud...', ...EFIMERO });

    if (!motivo) return interaction.editReply({ content: '❌ Ese tipo de ticket ya no existe. Vuelve a pulsar el botón del panel.' });

    const respuestas = preguntasDe(motivo).slice(0, 5).map((p, i) => {
        let valor = '';
        try { valor = interaction.fields.getTextInputValue(`p${i}`) || ''; } catch { /* formulario cambiado mientras se rellenaba */ }
        return { pregunta: p.etiqueta, respuesta: valor.trim() };
    });

    const limite = await comprobarLimite(interaction.guildId, interaction.user.id, config);
    if (!limite.ok) {
        const enlaces = limite.abiertos.map(t => `<#${t.canalId}>`).join(', ');
        return interaction.editReply({ content: `⚠️ Ya tienes ticket(s) abierto(s): ${enlaces}.` });
    }

    // ¿Puede la IA resolverlo con la base de conocimiento antes de abrir el ticket?
    const iaActiva = ia.iaConfigurada() && config.ia?.activada !== false && config.ia?.deflexion !== false;
    if (iaActiva) {
        const { articulos, resueltos } = await conocimientoDelServidor(interaction.guildId);
        if (articulos.length + resueltos.length > 0) {
            try {
                await interaction.editReply({ content: '🤖 Buscando una respuesta rápida a tu consulta...' });
                const r = await ia.conIA(config, () => ia.responderConFaq({ motivo: motivo.nombre, respuestas, articulos, resueltos }));
                if (r.puede_resolver && r.respuesta.trim()) {
                    const id = crypto.randomBytes(6).toString('hex');
                    const idsValidos = new Set(articulos.map(a => String(a._id)));
                    pendientes.set(id, {
                        guildId: interaction.guildId, userId: interaction.user.id, motivoId: String(motivo._id),
                        motivoNombre: motivo.nombre, respuestas,
                        articulos: r.articulos_usados.filter(a => idsValidos.has(a)),
                        expira: Date.now() + CADUCIDAD_MS
                    });
                    const embed = new EmbedBuilder()
                        .setColor('#9b59b6')
                        .setTitle('🤖 Puede que esto te ayude')
                        .setDescription(r.respuesta.slice(0, 4000))
                        .setFooter({ text: '¿Se ha solucionado? Si no, abre el ticket y te atenderá el equipo.' });
                    const botones = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`deflex_ok:${id}`).setLabel('✅ Sí, solucionado').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`deflex_abrir:${id}`).setLabel('📩 No, abrir ticket').setStyle(ButtonStyle.Secondary)
                    );
                    return interaction.editReply({ content: '', embeds: [embed], components: [botones] });
                }
            } catch (e) {
                if (!(e instanceof ia.IAError)) console.error('Error en la respuesta IA:', e);
                // Si la IA falla o no hay cupo, se abre el ticket normalmente.
            }
        }
    }

    await interaction.editReply({ content: '⏳ Creando tu ticket...' });
    return abrirYResponder(interaction, client, String(motivo._id), respuestas);
}

// Botones "✅ Sí, solucionado" / "📩 No, abrir ticket".
async function alResponderDeflexion(interaction, client) {
    const [accion, id] = interaction.customId.split(':');
    const pendiente = pendientes.get(id);
    if (!pendiente || pendiente.expira < Date.now() || pendiente.userId !== interaction.user.id) {
        return interaction.update({ content: '⌛ Esta consulta ha caducado. Vuelve a pulsar el botón del panel si aún necesitas ayuda.', embeds: [], components: [] });
    }
    pendientes.delete(id);

    if (accion === 'deflex_ok') {
        await interaction.update({ content: '✅ ¡Genial! Nos alegra que se haya solucionado. Si necesitas algo más, abre un ticket cuando quieras.', embeds: [], components: [] });
        await ServidorConfig.updateOne({ guildId: pendiente.guildId }, { $inc: { 'ia.ticketsEvitados': 1 } });
        if (pendiente.articulos.length > 0) await Articulo.updateMany({ _id: { $in: pendiente.articulos } }, { $inc: { usos: 1 } });
        await registrarLog(client, {
            guildId: pendiente.guildId, categoria: 'IA', accion: '🤖 Consulta resuelta por la IA',
            usuario: interaction.user.username, detalles: `${pendiente.motivoNombre}: ${pendiente.respuestas[0]?.respuesta || ''}`.slice(0, 500), color: '#9b59b6'
        });
        return;
    }

    await interaction.update({ content: '⏳ Creando tu ticket...', embeds: [], components: [] });
    return abrirYResponder(interaction, client, pendiente.motivoId, pendiente.respuestas);
}

module.exports = { mensajePanel, construirModal, alPulsarPanel, alElegirMotivo, alEnviarFormulario, alResponderDeflexion };
