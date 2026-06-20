// Programador de tareas: un único barrido periódico que publica los anuncios
// programados y envía los recordatorios que ya han vencido. Mismo patrón que
// utils/autoClose.js (un setInterval que consulta la BD).
const AnuncioProgramado = require('../models/AnuncioProgramado.js');
const Recordatorio = require('../models/Recordatorio.js');
const { construirMensaje } = require('./embeds.js');

// Publica los anuncios cuya fecha ya llegó. Reprograma los recurrentes.
async function enviarAnunciosPendientes(client) {
    const ahora = new Date();
    const pendientes = await AnuncioProgramado.find({ enviado: false, fechaEnvio: { $lte: ahora } });
    for (const a of pendientes) {
        try {
            const canal = await client.channels.fetch(a.canalId).catch(() => null);
            if (canal && canal.isTextBased()) {
                const payload = construirMensaje(a.contenido, a.embed);
                if (payload.content || payload.embeds) await canal.send(payload);
            }
        } catch (e) {
            console.error('Error enviando anuncio programado:', e.message);
        }
        // Recurrente: avanza la fecha al próximo turno (saltando los perdidos). Si no, lo marca enviado.
        if (a.repetir === 'diario' || a.repetir === 'semanal') {
            const paso = a.repetir === 'diario' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
            let next = a.fechaEnvio.getTime() + paso;
            while (next <= Date.now()) next += paso;
            a.fechaEnvio = new Date(next);
        } else {
            a.enviado = true;
        }
        await a.save().catch(() => {});
    }
}

// Avisa de los recordatorios vencidos (en el canal, o por MD si el canal no existe).
async function enviarRecordatoriosPendientes(client) {
    const ahora = new Date();
    const pendientes = await Recordatorio.find({ avisado: false, fechaAviso: { $lte: ahora } });
    for (const r of pendientes) {
        try {
            const canal = await client.channels.fetch(r.canalId).catch(() => null);
            const texto = `⏰ <@${r.userId}>, recordatorio: ${r.mensaje || '(sin texto)'}`;
            if (canal && canal.isTextBased()) {
                await canal.send({ content: texto.slice(0, 2000), allowedMentions: { users: [r.userId] } });
            } else {
                const user = await client.users.fetch(r.userId).catch(() => null);
                if (user) await user.send(`⏰ Recordatorio: ${r.mensaje || '(sin texto)'}`).catch(() => {});
            }
        } catch (e) {
            console.error('Error enviando recordatorio:', e.message);
        }
        r.avisado = true;
        await r.save().catch(() => {});
    }
}

// Arranca el barrido: primera pasada a los 15s, luego cada `intervaloMs` (30s).
function iniciarProgramador(client, intervaloMs = 30 * 1000) {
    const tick = async () => {
        try { await enviarAnunciosPendientes(client); } catch (e) { console.error('Programador (anuncios):', e.message); }
        try { await enviarRecordatoriosPendientes(client); } catch (e) { console.error('Programador (recordatorios):', e.message); }
    };
    setTimeout(tick, 15 * 1000);
    setInterval(tick, intervaloMs);
}

module.exports = { iniciarProgramador, enviarAnunciosPendientes, enviarRecordatoriosPendientes };
