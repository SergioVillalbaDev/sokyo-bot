// ============================================================================
// Puente «!comando» → «/comando». Cada comando de prefijo (comandos/*.js) tiene
// también su versión con barra (slash/*.js), que ejecuta EXACTAMENTE la misma
// lógica: el puente traduce las opciones de Discord a los argumentos de siempre
// y le pasa al comando un «mensaje» equivalente (responder, menciones, adjuntos…).
// Así las dos formas se comportan igual y no hay que mantener el código dos veces.
//
// Uso (un archivo por comando en slash/):
//   module.exports = crearSlashDesdePrefijo({
//       prefijo: require('../comandos/ban.js'),
//       nombre: 'ban', nombreEs: 'banear', desc: 'Ban a member', descEs: 'Banear a un miembro',
//       opciones: [{ tipo: 'usuario', nombre: 'user', es: 'usuario', desc: '…', descEs: '…', requerido: true }],
//       // o subcomandos: [{ nombre, es, desc, descEs, opciones: [...] }]
//   });
// Tipos de opción: usuario, rol, canal, texto, entero, adjunto. `elecciones` en las de texto.
// `junto: true` en una de texto la pasa como UN argumento aunque lleve espacios (p. ej. el
// nombre de un rol, que el comando lee de args[1]); sin él se parte en palabras (motivos…).
// `efimero: true` en el comando: las respuestas solo las ve quien lo usa (p. ej. /reportar).
// ============================================================================
const { SlashCommandBuilder, Collection, InteractionContextType } = require('discord.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

function añadirOpcion(builder, op) {
    const preparar = (o) => {
        o.setName(op.nombre).setDescription(op.desc).setRequired(!!op.requerido);
        if (op.es) o.setNameLocalizations(ES(op.es));
        if (op.descEs) o.setDescriptionLocalizations(ES(op.descEs));
        return o;
    };
    switch (op.tipo) {
        case 'usuario': return builder.addUserOption((o) => preparar(o));
        case 'rol': return builder.addRoleOption((o) => preparar(o));
        case 'canal': return builder.addChannelOption((o) => preparar(o));
        case 'entero': return builder.addIntegerOption((o) => {
            preparar(o);
            if (op.min !== undefined) o.setMinValue(op.min);
            if (op.max !== undefined) o.setMaxValue(op.max);
            return o;
        });
        case 'adjunto': return builder.addAttachmentOption((o) => preparar(o));
        default: return builder.addStringOption((o) => {
            preparar(o);
            if (op.max) o.setMaxLength(op.max);
            if (op.elecciones) o.addChoices(...op.elecciones.map((c) => ({ name: c.nombre, value: c.valor, ...(c.es ? { name_localizations: ES(c.es) } : {}) })));
            return o;
        });
    }
}

// Argumentos «!» a partir de las opciones, en el orden en que se declaran.
function argumentosDe(interaction, opciones) {
    const args = [];
    for (const op of opciones) {
        const o = interaction.options.get(op.nombre);
        if (!o || o.value === undefined || o.value === null || op.tipo === 'adjunto') continue;
        if (op.tipo === 'usuario') args.push(`<@${o.value}>`);
        else if (op.tipo === 'rol') args.push(`<@&${o.value}>`);
        else if (op.tipo === 'canal') args.push(`<#${o.value}>`);
        else if (op.tipo === 'entero') args.push(String(o.value));
        else if (op.junto) { const v = String(o.value).trim(); if (v) args.push(v); }
        else args.push(...String(o.value).trim().split(/\s+/).filter(Boolean));
    }
    return args;
}

// Un «mensaje» equivalente al de un comando con prefijo, hecho con la interacción.
// `estado.aplazando`: si el puente está avisando «pensando…» (deferReply), se espera
// a que termine antes de responder (si no, Discord rechazaría la segunda respuesta).
function mensajeDesdeInteraccion(interaction, args, estado = {}) {
    const usuarios = new Collection();
    const miembros = new Collection();
    const roles = new Collection();
    const canales = new Collection();
    const adjuntos = new Collection();
    const recorrer = (lista = []) => {
        for (const o of lista) {
            if (o.options) recorrer(o.options);
            if (o.user) usuarios.set(o.user.id, o.user);
            if (o.member && o.user) miembros.set(o.user.id, o.member);
            if (o.role) roles.set(o.role.id, o.role);
            if (o.channel) canales.set(o.channel.id, o.channel);
            if (o.attachment) adjuntos.set(o.attachment.id, o.attachment);
        }
    };
    recorrer(interaction.options?.data);

    // La primera respuesta va como respuesta a la interacción (pensando… → texto);
    // las siguientes, como mensajes de seguimiento. Devuelve el mensaje, por si el
    // comando lo edita después.
    let respondida = false;
    const responder = async (payload) => {
        const p = typeof payload === 'string' ? { content: payload } : { ...payload };
        // «Solo tú puedes ver esto»: se pide al responder (al editar ya no se puede cambiar).
        const nuevo = estado.efimero ? { ...p, flags: (p.flags || 0) | 64 } : p;
        if (estado.aplazando) await estado.aplazando.catch(() => {});
        if (!respondida) {
            respondida = true;
            if (interaction.deferred || interaction.replied) await interaction.editReply(p);
            else await interaction.reply(nuevo);
            return interaction.fetchReply().catch(() => null);
        }
        return interaction.followUp(nuevo);
    };

    return {
        id: interaction.id,
        esSlash: true,
        client: interaction.client,
        author: interaction.user,
        member: interaction.member,
        guild: interaction.guild,
        guildId: interaction.guildId,
        channel: interaction.channel,
        channelId: interaction.channelId,
        createdTimestamp: interaction.createdTimestamp,
        content: `/${interaction.commandName} ${args.join(' ')}`.trim(),
        mentions: {
            users: usuarios, members: miembros, roles, channels: canales, everyone: false,
            has: (id) => usuarios.has(id) || roles.has(id),
        },
        attachments: adjuntos,
        reference: null,
        reply: responder,
        // Con barra no hay mensaje del usuario que borrar ni al que reaccionar.
        delete: async () => {},
        react: async () => {},
        get respondida() { return respondida; },
    };
}

function crearSlashDesdePrefijo({ prefijo, nombre, nombreEs, desc, descEs, opciones = [], subcomandos = null, permisos = null, efimero = false }) {
    const data = new SlashCommandBuilder()
        .setName(nombre)
        .setDescription(desc)
        .setContexts(InteractionContextType.Guild);
    if (nombreEs) data.setNameLocalizations(ES(nombreEs));
    if (descEs) data.setDescriptionLocalizations(ES(descEs));
    if (permisos !== null) data.setDefaultMemberPermissions(permisos);
    if (subcomandos) {
        for (const sub of subcomandos) {
            data.addSubcommand((s) => {
                s.setName(sub.nombre).setDescription(sub.desc);
                if (sub.es) s.setNameLocalizations(ES(sub.es));
                if (sub.descEs) s.setDescriptionLocalizations(ES(sub.descEs));
                for (const op of sub.opciones || []) añadirOpcion(s, op);
                return s;
            });
        }
    } else {
        for (const op of opciones) añadirOpcion(data, op);
    }

    return {
        data,
        prefijo: prefijo.name, // a qué «!comando» equivale (para la ayuda y las pruebas)
        // `cfg`: la configuración del servidor, que el despachador de slash ya trae
        // (los comandos de prefijo la reciben igual desde messageCreate).
        async execute(interaction, client, cfg) {
            let args;
            if (subcomandos) {
                const sub = interaction.options.getSubcommand();
                const def = subcomandos.find((s) => s.nombre === sub);
                args = [def?.arg || sub, ...argumentosDe(interaction, def?.opciones || [])];
            } else {
                args = argumentosDe(interaction, opciones);
            }
            const estado = { efimero };
            const mensaje = mensajeDesdeInteraccion(interaction, args, estado);
            // Discord exige responder en 3 s: si el comando tarda, se avisa «pensando…».
            const reloj = setTimeout(() => {
                if (!mensaje.respondida && !interaction.deferred && !interaction.replied) estado.aplazando = interaction.deferReply(efimero ? { flags: 64 } : undefined);
            }, 2000);
            try {
                await prefijo.execute(mensaje, args, client, cfg);
            } finally {
                clearTimeout(reloj);
            }
            // Si el comando solo publicó en el canal (sin responder), se cierra la interacción.
            if (estado.aplazando) await estado.aplazando.catch(() => {});
            if (!mensaje.respondida) {
                if (interaction.deferred) await interaction.deleteReply().catch(() => {});
                else if (!interaction.replied) await interaction.reply({ content: '✅', flags: 64 }).catch(() => {});
            }
        },
    };
}

module.exports = { crearSlashDesdePrefijo, mensajeDesdeInteraccion, argumentosDe };
