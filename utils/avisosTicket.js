// Avisos de los tickets:
//  - a quien abrió el ticket, por privado, cuando el staff le responde desde el
//    panel (si no lo ha apagado en /preferencias; como mucho uno cada 10 min);
//  - al staff, en el propio ticket, si lleva demasiadas horas sin respuesta
//    (Ajustes de tickets → «Avisar si un ticket lleva … sin respuesta»).
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Ticket = require('../models/Ticket.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { t } = require('./i18n.js');

const ultimoDM = new Map(); // canalId -> momento del último privado
const ENTRE_DMS = 10 * 60 * 1000;

async function avisarRespuesta(client, ticket, quien, contenido) {
    if (!ticket?.creadorId || ticket.estado === 'Cerrado') return;
    if (Date.now() - (ultimoDM.get(ticket.canalId) || 0) < ENTRE_DMS) return;
    const { quiereDM, idiomaMiembro } = require('./preferencias.js');
    if (!(await quiereDM(ticket.creadorId, 'tickets'))) return;
    const user = await client.users.fetch(ticket.creadorId).catch(() => null);
    if (!user || user.bot) return;
    ultimoDM.set(ticket.canalId, Date.now());
    if (ultimoDM.size > 5000) ultimoDM.clear();
    const cfg = await ServidorConfig.findOne({ guildId: ticket.guildId }).select('idioma').lean().catch(() => null);
    const idioma = await idiomaMiembro(ticket.creadorId, { cfg });
    const guild = client.guilds.cache.get(ticket.guildId);
    const { botonAbrirCuenta } = require('./cuenta.js');
    const { botonPreferencias } = require('./preferenciasDiscord.js');
    const fila = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${ticket.guildId}/${ticket.canalId}`).setEmoji('💬').setLabel(t(idioma, 'Ir al ticket', 'Go to the ticket')),
        botonAbrirCuenta(idioma, { vista: 'tickets', etiqueta: t(idioma, 'Ver en Mi cuenta', 'View in My account'), estilo: ButtonStyle.Secondary }),
        botonPreferencias(idioma),
    );
    const extracto = String(contenido || '').slice(0, 300);
    await user.send({
        content: t(idioma,
            `💬 **${quien}** te ha respondido en tu ticket «${ticket.titulo}»${guild ? ` de **${guild.name}**` : ''}:\n> ${extracto.replace(/\n/g, '\n> ')}`,
            `💬 **${quien}** replied to your ticket “${ticket.titulo}”${guild ? ` on **${guild.name}**` : ''}:\n> ${extracto.replace(/\n/g, '\n> ')}`).slice(0, 2000),
        components: [fila],
    }).catch(() => {});
}

// Barrido del programador: tickets que esperan respuesta desde hace demasiado.
async function avisarSinRespuesta(client) {
    const cfgs = await ServidorConfig.find({ avisoSinRespuestaHoras: { $gt: 0 } }).select('guildId avisoSinRespuestaHoras rolStaffId idioma').lean();
    for (const cfg of cfgs) {
        const limite = new Date(Date.now() - cfg.avisoSinRespuestaHoras * 3600 * 1000);
        const tickets = await Ticket.find({ guildId: cfg.guildId, estado: { $ne: 'Cerrado' }, esperaRespuesta: true, avisoSinRespuesta: null, ultimoMensajeUsuario: { $lte: limite } }).limit(20);
        for (const tk of tickets) {
            tk.avisoSinRespuesta = new Date();
            await tk.save().catch(() => {});
            const canal = client.channels.cache.get(tk.canalId);
            if (!canal?.isTextBased()) continue;
            const desde = `<t:${Math.floor(new Date(tk.ultimoMensajeUsuario).getTime() / 1000)}:R>`;
            const mencion = cfg.rolStaffId ? `<@&${cfg.rolStaffId}> ` : '';
            await canal.send({
                content: t(cfg,
                    `⏰ ${mencion}Este ticket espera respuesta del staff desde ${desde}.`,
                    `⏰ ${mencion}This ticket has been waiting for a staff reply since ${desde}.`),
                allowedMentions: { roles: cfg.rolStaffId ? [cfg.rolStaffId] : [] },
            }).catch(() => {});
        }
    }
}

module.exports = { avisarRespuesta, avisarSinRespuesta };
