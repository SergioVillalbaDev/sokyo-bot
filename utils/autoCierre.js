// Cierre automático de tickets inactivos.
// Si el staff ha respondido y el usuario no contesta en `autoCierreHoras` (config del servidor),
// el ticket se cierra solo. Al 75 % del plazo se publica un aviso en el canal; cualquier mensaje
// nuevo reinicia la cuenta (registrarActividad vuelve a poner avisoInactividad a null).
const { EmbedBuilder } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const Ticket = require('../models/Ticket.js');
const { cerrarTicket, COLORES } = require('./ticketManager.js');

const INTERVALO_MS = 10 * 60 * 1000;
const HORA_MS = 60 * 60 * 1000;
const FRACCION_AVISO = 0.75;
const AUTOR = 'Sistema (inactividad)';
const MOTIVO = 'Cerrado automáticamente por inactividad';

// Revisa todos los servidores con el cierre automático activado. `ahora` se puede fijar en las pruebas.
async function revisarInactivos(client, ahora = new Date()) {
    const resumen = { avisados: 0, cerrados: 0 };
    const guildIds = client.guilds.cache.filter(g => g.available).map(g => g.id);
    const configs = await ServidorConfig.find({ guildId: { $in: guildIds }, autoCierreHoras: { $gt: 0 } })
        .select('guildId autoCierreHoras').lean();

    for (const { guildId, autoCierreHoras } of configs) {
        const plazoMs = autoCierreHoras * HORA_MS;
        const margenMs = plazoMs * (1 - FRACCION_AVISO); // tiempo mínimo entre el aviso y el cierre
        const tickets = await Ticket.find({
            guildId,
            estado: 'Abierto',
            esperando: 'usuario',
            canalEliminado: { $ne: true },
            ultimaActividad: { $lte: new Date(ahora.getTime() - plazoMs * FRACCION_AVISO) }
        }).select('canalId creadorId ultimaActividad avisoInactividad').lean();

        for (const ticket of tickets) {
            const canal = client.channels.cache.get(ticket.canalId);
            if (!canal) continue;
            try {
                if (!ticket.avisoInactividad) {
                    // Aunque el plazo ya haya pasado (función recién activada, bot apagado...) siempre se avisa antes.
                    const cierre = Math.max(ticket.ultimaActividad.getTime() + plazoMs, ahora.getTime() + margenMs);
                    if (await avisar(canal, ticket, ahora, cierre)) resumen.avisados++;
                } else if (ticket.ultimaActividad.getTime() <= ahora.getTime() - plazoMs
                    && ticket.avisoInactividad.getTime() <= ahora.getTime() - margenMs) {
                    // Nadie ha escrito desde la consulta (el usuario podría haber contestado justo ahora).
                    const sigueInactivo = await Ticket.exists({ _id: ticket._id, estado: 'Abierto', esperando: 'usuario', ultimaActividad: ticket.ultimaActividad });
                    if (!sigueInactivo) continue;
                    await cerrarTicket(client, ticket.canalId, { autor: AUTOR, motivo: MOTIVO });
                    resumen.cerrados++;
                }
            } catch (error) {
                console.warn(`⏰ Ticket inactivo ${ticket.canalId}:`, error.message);
            }
        }
    }
    return resumen;
}

async function avisar(canal, ticket, ahora, cierre) {
    // Se marca antes de publicar y solo si no hay actividad nueva: así el aviso no se repite.
    const marcado = await Ticket.updateOne(
        { _id: ticket._id, estado: 'Abierto', esperando: 'usuario', ultimaActividad: ticket.ultimaActividad, avisoInactividad: null },
        { $set: { avisoInactividad: ahora } }
    );
    if (!marcado.modifiedCount) return false;

    const embed = new EmbedBuilder()
        .setColor(COLORES.inactivo)
        .setTitle('⏰ Ticket sin respuesta')
        .setDescription(`Este ticket se cerrará automáticamente <t:${Math.floor(cierre / 1000)}:R> si no hay respuesta.\nEscribe cualquier mensaje para mantenerlo abierto.`)
        .setTimestamp(ahora);
    await canal.send({ content: `<@${ticket.creadorId}>`, embeds: [embed], allowedMentions: { users: [ticket.creadorId] } });
    return true;
}

// Arranca la revisión periódica (una al iniciar y luego cada INTERVALO_MS, sin solaparse).
function iniciarAutoCierre(client) {
    let enCurso = false;
    const revisar = async () => {
        if (enCurso) return;
        enCurso = true;
        try {
            const { avisados, cerrados } = await revisarInactivos(client);
            if (avisados || cerrados) console.log(`⏰ Inactividad: ${avisados} aviso(s) y ${cerrados} ticket(s) cerrado(s).`);
        } catch (error) {
            console.error('⏰ Revisión de tickets inactivos:', error.message);
        } finally {
            enCurso = false;
        }
    };
    revisar();
    return setInterval(revisar, INTERVALO_MS);
}

module.exports = { revisarInactivos, iniciarAutoCierre };
