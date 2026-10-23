// Aviso de "Bot actualizado": la primera vez que arranca una versión nueva del bot
// (campo "version" de package.json) se lo dice a los miembros del servidor
// configurado: por privado a cada uno y, si no llega a todos, también en el canal
// general. Se anuncia una sola vez por versión y servidor (queda guardado en la BD).
const mongoose = require('mongoose');
const { ChannelType, PermissionsBitField } = require('discord.js');
const { version } = require('../package.json');
const ServidorConfig = require('../models/ServidorConfig.js');
const Log = require('../models/Log.js');
const { enviarLogADiscord } = require('./logsManager.js');

// Servidor al que avisar (nombre o ID). Vacío = aviso desactivado.
const SERVIDOR = process.env.ANUNCIO_SERVIDOR ?? 'Tokyto';
const MENSAJE = process.env.ANUNCIO_MENSAJE || '🚀 **Bot actualizado**\nYa están disponibles las últimas mejoras. ¡Gracias por usar Sokyo!';
// Mandar el mismo DM a muchísima gente es lo que Discord considera spam: por encima
// de este número de miembros solo se publica en el canal general.
const MAX_DMS = Number(process.env.ANUNCIO_MAX_DMS) || 250;

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizar = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Distancia de edición (Levenshtein) para tolerar erratas en el nombre del servidor.
function distancia(a, b) {
    const fila = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let anterior = fila[0];
        fila[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const actual = fila[j];
            fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
            anterior = actual;
        }
    }
    return fila[b.length];
}

// Servidores que coinciden con ANUNCIO_SERVIDOR: por ID, por nombre (sin acentos ni
// mayúsculas) o por una palabra del nombre casi igual (por si hay una errata). Si el
// bot solo está en un servidor y ninguno coincide, se usa ese.
function servidoresObjetivo(client, servidor = SERVIDOR) {
    const objetivo = normalizar(servidor);
    if (!objetivo) return [];
    const disponibles = client.guilds.cache.filter((g) => g.available);

    const exactos = disponibles.filter((g) => g.id === servidor || normalizar(g.name).includes(objetivo));
    if (exactos.size) return [...exactos.values()];

    const parecidos = disponibles.filter((g) => g.name.split(/\s+/).some((palabra) => {
        const p = normalizar(palabra);
        return p.length >= 3 && distancia(p, objetivo) <= 2;
    }));
    if (parecidos.size) return [...parecidos.values()];

    if (disponibles.size === 1) {
        console.warn(`📣 Ningún servidor se llama "${servidor}": aviso de actualización en ${disponibles.first().name}, el único donde está el bot.`);
        return [disponibles.first()];
    }
    console.warn(`📣 No encuentro el servidor "${servidor}" para el aviso de actualización. Pon su nombre o ID en ANUNCIO_SERVIDOR.`);
    return [];
}

// Canal donde publicar el aviso: el que se llame "general" (o lo contenga), el de
// mensajes del sistema o, si no, el primer canal de texto donde el bot pueda escribir.
function canalGeneral(guild) {
    const me = guild.members.me;
    const F = PermissionsBitField.Flags;
    const puedeEscribir = (canal) => !!canal?.permissionsFor(me)?.has([F.ViewChannel, F.SendMessages]);
    const textos = guild.channels.cache
        .filter((c) => c.type === ChannelType.GuildText && puedeEscribir(c))
        .sort((a, b) => a.rawPosition - b.rawPosition);
    return textos.find((c) => normalizar(c.name) === 'general')
        || textos.find((c) => normalizar(c.name).includes('general'))
        || (puedeEscribir(guild.systemChannel) ? guild.systemChannel : null)
        || textos.first()
        || null;
}

async function anunciarEnServidor(client, guild, pausaMs) {
    await ServidorConfig.updateOne({ guildId: guild.id }, { $setOnInsert: { guildId: guild.id } }, { upsert: true });
    // Se marca ANTES de enviar: si el bot se reinicia a mitad, nadie recibe el aviso dos veces.
    const pendiente = await ServidorConfig.findOneAndUpdate(
        { guildId: guild.id, ultimaVersionAnunciada: { $ne: version } },
        { $set: { ultimaVersionAnunciada: version } }
    );
    if (!pendiente) return null;

    let miembros;
    try {
        miembros = await guild.members.fetch();
    } catch {
        miembros = guild.members.cache;
    }
    const humanos = [...miembros.values()].filter((m) => !m.user.bot);

    let enviados = 0;
    let fallidos = 0;
    const omitidos = humanos.length > MAX_DMS ? humanos.length : 0;
    if (!omitidos) {
        for (const miembro of humanos) {
            try {
                await miembro.send(MENSAJE);
                enviados++;
            } catch {
                fallidos++; // DMs cerrados o el usuario bloqueó al bot
            }
            if (pausaMs) await esperar(pausaMs); // ritmo pausado para no parecer spam
        }
    }

    // Si no ha llegado a todos por privado, se publica en el general para que nadie se quede sin saberlo.
    let publicadoEn = null;
    if (fallidos || omitidos || humanos.length === 0) {
        const canal = canalGeneral(guild);
        if (canal) {
            try {
                await canal.send({ content: MENSAJE, allowedMentions: { parse: [] } });
                publicadoEn = canal.name;
            } catch (error) {
                console.warn(`📣 No se pudo publicar el aviso en #${canal.name}:`, error.message);
            }
        }
    }

    const resumen = [
        `${enviados} por privado`,
        fallidos && `${fallidos} con los DMs cerrados`,
        omitidos && `${omitidos} sin DM (servidor grande)`,
        publicadoEn ? `publicado en #${publicadoEn}` : (fallidos || omitidos || !humanos.length) && 'no se pudo publicar en ningún canal',
    ].filter(Boolean).join(', ');
    console.log(`📣 Aviso "Bot actualizado" (v${version}) en ${guild.name}: ${resumen}.`);

    try {
        const log = await Log.create({
            guildId: guild.id,
            categoria: 'General',
            accion: `🚀 Bot actualizado a la v${version}`,
            usuario: 'Sistema',
            detalles: `Aviso enviado: ${resumen}.`,
            color: '#5865F2',
        });
        await enviarLogADiscord(client, log);
    } catch (error) { console.error('Error guardando el log del aviso de actualización:', error.message); }

    return { enviados, fallidos, omitidos, publicadoEn };
}

// El evento ready puede llegar antes que la conexión a Mongo: se espera a que esté lista.
function esperarMongo() {
    if (mongoose.connection.readyState === 1) return Promise.resolve();
    return new Promise((resolve) => mongoose.connection.once('connected', resolve));
}

async function anunciarActualizacion(client, { pausaMs = 1200 } = {}) {
    const resultados = {};
    const guilds = servidoresObjetivo(client);
    if (!guilds.length) return resultados;
    await esperarMongo();
    for (const guild of guilds) {
        try {
            resultados[guild.id] = await anunciarEnServidor(client, guild, pausaMs);
        } catch (error) {
            console.error(`📣 Error enviando el aviso de actualización en ${guild.name}:`, error);
        }
    }
    return resultados;
}

module.exports = { anunciarActualizacion, servidoresObjetivo, canalGeneral, normalizar, distancia, version };
