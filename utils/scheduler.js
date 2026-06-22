// Programador de tareas: un único barrido periódico que publica los anuncios
// programados y envía los recordatorios que ya han vencido. Mismo patrón que
// utils/autoClose.js (un setInterval que consulta la BD).
const path = require('path');
const AnuncioProgramado = require('../models/AnuncioProgramado.js');
const Recordatorio = require('../models/Recordatorio.js');
const { construirMensaje } = require('./embeds.js');
const { barrerPremiumCaducado } = require('./billing.js');
const EstadisticaDiaria = require('../models/EstadisticaDiaria.js');
const RegistroMensaje = require('../models/RegistroMensaje.js');
const ActividadUsuario = require('../models/ActividadUsuario.js');
const Log = require('../models/Log.js');
const Ticket = require('../models/Ticket.js');
const Sancion = require('../models/Sancion.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { enviarResumen } = require('./resumenDiario.js');

// Carpeta de imágenes subidas (para adjuntar embeds con imagen propia).
const UPLOADS_DIR = path.join(__dirname, '..', 'api', 'uploads');

// Publica los anuncios cuya fecha ya llegó. Reprograma los recurrentes.
async function enviarAnunciosPendientes(client) {
    const ahora = new Date();
    const pendientes = await AnuncioProgramado.find({ enviado: false, fechaEnvio: { $lte: ahora } });
    for (const a of pendientes) {
        try {
            const canal = await client.channels.fetch(a.canalId).catch(() => null);
            if (canal && canal.isTextBased()) {
                const payload = construirMensaje(a.contenido, a.embed, UPLOADS_DIR);
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

// Guarda/actualiza la foto diaria de cada servidor (upsert por día). Construye
// el histórico que la analítica usa para el crecimiento de miembros.
async function snapshotDiario(client) {
    const ahora = new Date();
    const inicioDia = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));
    const dia = inicioDia.toISOString().slice(0, 10);
    for (const [, guild] of client.guilds.cache) {
        try {
            const gid = guild.id;
            const [mensajes, entradas, salidas, ticketsAbiertos, ticketsCerrados, sanciones, activos] = await Promise.all([
                RegistroMensaje.countDocuments({ guildId: gid, fecha: { $gte: inicioDia } }),
                Log.countDocuments({ guildId: gid, categoria: 'Entradas', fecha: { $gte: inicioDia } }),
                Log.countDocuments({ guildId: gid, categoria: 'Salidas', fecha: { $gte: inicioDia } }),
                Ticket.countDocuments({ guildId: gid, fechaCreacion: { $gte: inicioDia } }),
                Ticket.countDocuments({ guildId: gid, fechaCierre: { $gte: inicioDia } }),
                Sancion.countDocuments({ guildId: gid, fecha: { $gte: inicioDia } }),
                ActividadUsuario.countDocuments({ guildId: gid, ultimoMensajeFecha: { $gte: inicioDia } }),
            ]);
            await EstadisticaDiaria.findOneAndUpdate(
                { guildId: gid, dia },
                { $set: { fecha: ahora, miembros: guild.memberCount || 0, mensajes, entradas, salidas, ticketsAbiertos, ticketsCerrados, sanciones, activos } },
                { upsert: true },
            );
        } catch (e) { console.error(`Snapshot de ${guild.id}:`, e.message); }
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

    // Red de seguridad: devuelve a Free los servidores con premium caducado (cada hora).
    const tickPremium = async () => {
        try {
            const n = await barrerPremiumCaducado();
            if (n) console.log(`⏳ Premium caducado en ${n} servidor(es) -> Free.`);
        } catch (e) { console.error('Barrido de premium:', e.message); }
    };
    setTimeout(tickPremium, 20 * 1000);
    setInterval(tickPremium, 60 * 60 * 1000);

    // Foto diaria de cada servidor: primera a los 30s, luego cada 6h (upsert por día).
    const tickSnapshot = async () => {
        try { await snapshotDiario(client); } catch (e) { console.error('Snapshot diario:', e.message); }
    };
    setTimeout(tickSnapshot, 30 * 1000);
    setInterval(tickSnapshot, 6 * 60 * 60 * 1000);

    // Briefing diario: cada 30 min mira qué servidores tienen el resumen activo,
    // ha llegado su hora (UTC) y no se ha enviado hoy.
    const tickResumen = async () => {
        try {
            const hoy = new Date().toISOString().slice(0, 10);
            const horaAhora = new Date().getUTCHours();
            const configs = await ServidorConfig.find({ 'resumenDiario.activo': true }).select('guildId resumenDiario');
            for (const cfg of configs) {
                const rd = cfg.resumenDiario || {};
                if (rd.lastDia === hoy) continue;            // ya enviado hoy
                if (horaAhora < (rd.hora || 9)) continue;     // aún no es su hora
                try { await enviarResumen(client, cfg.guildId, {}); }
                catch (e) { console.error(`Resumen diario ${cfg.guildId}:`, e.message); }
            }
        } catch (e) { console.error('Barrido de resúmenes:', e.message); }
    };
    setTimeout(tickResumen, 45 * 1000);
    setInterval(tickResumen, 30 * 60 * 1000);
}

module.exports = { iniciarProgramador, enviarAnunciosPendientes, enviarRecordatoriosPendientes };
