// Registro de actividad de usuarios (mensajes y voz) para el módulo de
// moderación. Lo llaman los eventos messageCreate y voiceStateUpdate.
const ActividadUsuario = require('../models/ActividadUsuario.js');
const RegistroMensaje = require('../models/RegistroMensaje.js');

// Guarda un mensaje: actualiza el resumen del usuario y lo añade al log con
// expiración según el plan (30 días free · 90 días premium).
async function registrarMensaje(message, esPremium) {
    const dias = esPremium ? 90 : 30;
    const expiraEn = new Date(Date.now() + dias * 86400000);
    const contenido = (message.content || '').slice(0, 500);

    await Promise.all([
        ActividadUsuario.updateOne(
            { guildId: message.guild.id, userId: message.author.id },
            {
                $set: {
                    usuarioTag: message.author.username,
                    ultimoMensajeFecha: new Date(),
                    ultimoMensajeCanalId: message.channel.id,
                    ultimoMensajeTexto: contenido,
                },
                $inc: { mensajesTotal: 1 },
            },
            { upsert: true },
        ),
        RegistroMensaje.create({
            guildId: message.guild.id,
            userId: message.author.id,
            usuarioTag: message.author.username,
            canalId: message.channel.id,
            contenido,
            expiraEn,
        }),
    ]);
}

// Guarda la última vez que un usuario entró a un canal de voz.
async function registrarVoz(guildId, member, canalId) {
    await ActividadUsuario.updateOne(
        { guildId, userId: member.id },
        { $set: { usuarioTag: member.user.username, ultimaVozFecha: new Date(), ultimaVozCanalId: canalId } },
        { upsert: true },
    );
}

module.exports = { registrarMensaje, registrarVoz };
