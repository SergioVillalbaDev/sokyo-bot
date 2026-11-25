// Bromas de oro (1.14.0). Un miembro paga oro para gastarle una broma a otro durante
// un rato (por defecto 60 min):
//   · apodo    → le cambia el apodo en el servidor
//   · payaso   → le pone el rol «🤡 Payaso del día» (el que elija el staff)
//   · reaccion → el bot reacciona con un emoji a cada mensaje suyo
//   · loro     → el bot repite sus 3 próximos mensajes en «mOdO bUrLa»
// La víctima puede devolvérsela pagando el doble, y cualquiera puede comprarse un
// escudo. Quien no quiere jugar se sale con /comunidad broma salir (y entonces tampoco puede
// gastarlas). El staff decide qué bromas hay, sus precios y qué roles son intocables.
// Al acabar, el bot lo deja todo como estaba (barrerBromas, cada 30 s).
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const Broma = require('../models/Broma.js');
const PerfilBroma = require('../models/PerfilBroma.js');
const { t } = require('./i18n.js');

const TIPOS = ['apodo', 'payaso', 'reaccion', 'loro'];
const MENSAJES_LORO = 3;
const INFO = {
    apodo: { emoji: '🏷️', es: 'Cambiarle el apodo', en: 'Change their nickname' },
    payaso: { emoji: '🤡', es: 'Payaso del día', en: 'Clown of the day' },
    reaccion: { emoji: '💩', es: 'Reacción a todo lo que escriba', en: 'Reaction on everything they write' },
    loro: { emoji: '🦜', es: 'Loro burlón', en: 'Mocking parrot' },
};

const duracionMin = (b) => Math.max(5, Math.min(1440, parseInt(b?.duracionMin, 10) || 60));
const esperaMin = (b) => Math.max(0, Math.min(1440, parseInt(b?.esperaMin, 10) || 0));

// Precio con el descuento de la mascota del servidor.
function precioDe(cfg, tipo, descuento = null) {
    const base = Math.max(0, parseInt(cfg?.bromas?.tipos?.[tipo]?.precio, 10) || 0);
    const d = descuento ?? (cfg?.mascota?.activo ? require('./mascota.js').descuentoBromasServidor(cfg?.guildId) : 0);
    return Math.round(base * (1 - (d || 0)));
}

// «mOdO bUrLa»: alterna mayúsculas y minúsculas (solo letras).
function burla(texto) {
    let i = 0;
    return String(texto || '').replace(/\p{L}/gu, (c) => (i++ % 2 ? c.toUpperCase() : c.toLowerCase()));
}

// Un emoji normal (no de servidor), de 1 a 4 caracteres «de dibujo».
const emojiValido = (e) => !!e && /^\p{Extended_Pictographic}/u.test(e) && [...e].length <= 4;

// Apodo válido: 1-32, sin menciones, enlaces ni palabras prohibidas.
function apodoValido(texto, cfg) {
    const s = String(texto || '').trim();
    if (!s || s.length > 32) return false;
    if (/[<>@`]|https?:|discord\.gg/i.test(s)) return false;
    const { palabraProhibida } = require('./confesiones.js');
    return !palabraProhibida(s, cfg);
}

// Reglas que se pueden comprobar sin Discord (las prueban los tests).
// Devuelve un código de error o null.
function comprobar({ cfg, tipo, autorId, objetivoId, objetivoBot, perfilAutor, perfilObjetivo, rolesObjetivo = [], activaObjetivo = false, devolucion = false, ahora = new Date() }) {
    const b = cfg?.bromas;
    if (!b?.activo) return 'apagadas';
    if (!TIPOS.includes(tipo) || !b.tipos?.[tipo]?.activo) return 'tipo';
    if (autorId === objetivoId) return 'tuyo';
    if (objetivoBot) return 'bot';
    if (perfilAutor?.fuera) return 'autorFuera';
    if (perfilObjetivo?.fuera) return 'objetivoFuera';
    if ((b.inmunes || []).some((r) => rolesObjetivo.includes(r))) return 'inmune';
    if (!devolucion && perfilObjetivo?.escudoHasta && new Date(perfilObjetivo.escudoHasta) > ahora) return 'escudo';
    if (activaObjetivo) return 'yaTiene';
    if (!devolucion && perfilAutor?.ultimaBroma && ahora - new Date(perfilAutor.ultimaBroma) < esperaMin(b) * 60000) return 'espera';
    return null;
}

function textoError(codigo, idioma, extra = {}) {
    const T = {
        apagadas: ['🃏 Las bromas no están activadas en este servidor.', '🃏 Pranks aren’t turned on on this server.'],
        tipo: ['Esa broma no está disponible en este servidor.', 'That prank isn’t available on this server.'],
        tuyo: ['No puedes gastarte una broma a ti mismo 😄', 'You can’t prank yourself 😄'],
        bot: ['A los bots no se les pueden gastar bromas.', 'You can’t prank bots.'],
        autorFuera: ['Te saliste de las bromas. Para volver a jugar: `/comunidad broma volver`.', 'You opted out of pranks. To play again: `/community prank rejoin`.'],
        objetivoFuera: ['Esa persona no juega a las bromas.', 'That person doesn’t take part in pranks.'],
        inmune: ['A esa persona no se le pueden gastar bromas (tiene un rol protegido).', 'That person can’t be pranked (they have a protected role).'],
        escudo: [`🛡️ Esa persona tiene un escudo hasta ${extra.hasta || 'dentro de un rato'}.`, `🛡️ That person has a shield until ${extra.hasta || 'a while from now'}.`],
        yaTiene: ['Ya le están gastando una broma. Espera a que acabe.', 'They’re already being pranked. Wait until it ends.'],
        espera: [`Espera ${extra.min || 'un poco'} antes de gastar otra broma.`, `Wait ${extra.min || 'a bit'} before your next prank.`],
        oro: [`No tienes suficiente oro: cuesta 🪙 ${extra.precio}.`, `You don’t have enough gold: it costs 🪙 ${extra.precio}.`],
        apodo: ['Ese apodo no vale: hasta 32 letras, sin menciones, enlaces ni palabras prohibidas.', 'That nickname isn’t allowed: up to 32 characters, no mentions, links or banned words.'],
        noApodo: ['No puedo cambiarle el apodo: está por encima del bot o es el dueño del servidor.', 'I can’t change their nickname: they’re above the bot or own the server.'],
        permApodo: ['El bot necesita el permiso «Gestionar apodos».', 'The bot needs the “Manage Nicknames” permission.'],
        rol: ['El staff no ha elegido el rol de payaso, o el bot no puede darlo.', 'The staff hasn’t picked the clown role, or the bot can’t give it.'],
        emoji: ['Pon un solo emoji normal (por ejemplo 💩).', 'Use a single regular emoji (e.g. 💩).'],
    };
    const x = T[codigo] || ['No se ha podido.', 'It couldn’t be done.'];
    return t(idioma, x[0], x[1]);
}

const perfil = (guildId, userId) => PerfilBroma.findOne({ guildId, userId }).lean();
const activaDe = (guildId, objetivoId) => Broma.findOne({ guildId, objetivoId, activa: true });

// Lo que hacen en Discord las bromas que cambian algo (apodo y rol).
async function aplicarEnDiscord(guild, objetivo, tipo, cfg, texto, autor) {
    if (tipo === 'apodo') {
        const me = guild.members.me;
        if (!me?.permissions.has(PermissionFlagsBits.ManageNicknames)) return { fallo: 'permApodo' };
        if (!objetivo.manageable || objetivo.id === guild.ownerId) return { fallo: 'noApodo' };
        const anterior = objetivo.nickname || null;
        const ok = await objetivo.setNickname(texto, `Broma de ${autor.user.username}`).then(() => true).catch(() => false);
        return ok ? { apodoAnterior: anterior } : { fallo: 'noApodo' };
    }
    if (tipo === 'payaso') {
        const rol = cfg.bromas.rolPayasoId ? guild.roles.cache.get(cfg.bromas.rolPayasoId) : null;
        if (!rol || !rol.editable || require('./permisos.js').errorRolPeligroso(rol)) return { fallo: 'rol' };
        const ok = await objetivo.roles.add(rol, `Broma de ${autor.user.username}`).then(() => true).catch(() => false);
        return ok ? { rolId: rol.id } : { fallo: 'rol' };
    }
    return {};
}

async function deshacerEnDiscord(guild, broma) {
    const m = await guild.members.fetch(broma.objetivoId).catch(() => null);
    if (!m) return;
    if (broma.tipo === 'apodo' && m.nickname === broma.texto) {
        await m.setNickname(broma.apodoAnterior || null, 'Fin de la broma').catch(() => {});
    }
    if (broma.tipo === 'payaso' && broma.rolId && m.roles.cache.has(broma.rolId)) {
        await m.roles.remove(broma.rolId, 'Fin de la broma').catch(() => {});
    }
}

// Cache de las bromas que actúan al escribir (reacción y loro), por servidor.
const enVivo = new Map(); // guildId -> { hasta, porUsuario: Map(userId -> broma) }
function olvidar(guildId) { enVivo.delete(guildId); }
async function vivasDe(guildId) {
    const c = enVivo.get(guildId);
    if (c && c.hasta > Date.now()) return c.porUsuario;
    const lista = await Broma.find({ guildId, activa: true, tipo: { $in: ['reaccion', 'loro'] } }).lean();
    const porUsuario = new Map(lista.map((b) => [b.objetivoId, b]));
    enVivo.set(guildId, { hasta: Date.now() + 30000, porUsuario });
    return porUsuario;
}

// Mensaje del anuncio, con «Devolvérsela» y «Comprar escudo».
function anuncio(broma, cfg, idioma) {
    const info = INFO[broma.tipo];
    const fin = Math.floor(new Date(broma.fin).getTime() / 1000);
    const detalle = {
        apodo: t(idioma, `ahora se llama **${broma.texto}**`, `is now called **${broma.texto}**`),
        payaso: t(idioma, 'es el **🤡 Payaso del día**', 'is the **🤡 Clown of the day**'),
        reaccion: t(idioma, `lleva un ${broma.texto} en todo lo que escribe`, `gets a ${broma.texto} on everything they write`),
        loro: t(idioma, `tiene un 🦜 loro que repetirá sus ${MENSAJES_LORO} próximos mensajes`, `has a 🦜 parrot that will repeat their next ${MENSAJES_LORO} messages`),
    }[broma.tipo];
    const e = new EmbedBuilder()
        .setColor('#f472b6')
        .setDescription(broma.devolucionDe
            ? t(idioma, `↩️ <@${broma.autorId}> se la ha **devuelto** a <@${broma.objetivoId}>: ${detalle} hasta <t:${fin}:t>. ${info.emoji}`, `↩️ <@${broma.autorId}> **got revenge** on <@${broma.objetivoId}>: they ${detalle} until <t:${fin}:t>. ${info.emoji}`)
            : t(idioma, `🃏 <@${broma.autorId}> le ha gastado una broma a <@${broma.objetivoId}>: ${detalle} hasta <t:${fin}:t>. ${info.emoji}`, `🃏 <@${broma.autorId}> pranked <@${broma.objetivoId}>: they ${detalle} until <t:${fin}:t>. ${info.emoji}`))
        .setFooter({ text: t(idioma, 'Cuesta oro · gasta las tuyas con «/comunidad broma» · ¿no quieres jugar? /comunidad broma salir', 'Costs gold · pull yours with “/community prank” · don’t want to play? /community prank optout') });
    const botones = [];
    if (cfg.bromas.devolver !== false && !broma.devolucionDe) {
        botones.push(new ButtonBuilder().setCustomId(`brm_dev:${broma._id}`).setStyle(ButtonStyle.Danger).setEmoji('↩️')
            .setLabel(t(idioma, `Devolvérsela (🪙 ${broma.precio * 2})`, `Get revenge (🪙 ${broma.precio * 2})`)));
    }
    botones.push(new ButtonBuilder().setCustomId('brm_escudo').setStyle(ButtonStyle.Secondary).setEmoji('🛡️')
        .setLabel(t(idioma, `Escudo ${cfg.bromas.escudoHoras || 12} h (🪙 ${cfg.bromas.escudoPrecio ?? 400})`, `${cfg.bromas.escudoHoras || 12} h shield (🪙 ${cfg.bromas.escudoPrecio ?? 400})`)));
    return { embeds: [e], components: [new ActionRowBuilder().addComponents(botones)], allowedMentions: { users: [broma.autorId, broma.objetivoId] } };
}

// Gasta una broma. `canal` = donde se usó (si no hay canal de anuncios).
async function gastar({ client, guild, cfg, autor, objetivo, tipo, texto = '', canal = null, idioma, devolucionDe = null, precio = null }) {
    const [perfilAutor, perfilObjetivo, activa] = await Promise.all([
        perfil(guild.id, autor.id), perfil(guild.id, objetivo.id), activaDe(guild.id, objetivo.id),
    ]);
    const codigo = comprobar({
        cfg, tipo, autorId: autor.id, objetivoId: objetivo.id, objetivoBot: objetivo.user.bot, perfilAutor, perfilObjetivo,
        rolesObjetivo: [...objetivo.roles.cache.keys()], activaObjetivo: !!activa, devolucion: !!devolucionDe,
    });
    if (codigo) {
        const extra = codigo === 'escudo' ? { hasta: `<t:${Math.floor(new Date(perfilObjetivo.escudoHasta).getTime() / 1000)}:t>` }
            : codigo === 'espera' ? { min: `<t:${Math.floor((new Date(perfilAutor.ultimaBroma).getTime() + esperaMin(cfg.bromas) * 60000) / 1000)}:R>` } : {};
        return { error: textoError(codigo, idioma, extra) };
    }
    if (tipo === 'apodo' && !apodoValido(texto, cfg)) return { error: textoError('apodo', idioma) };
    if (tipo === 'reaccion') { texto = (texto || '').trim() || '💩'; if (!emojiValido(texto)) return { error: textoError('emoji', idioma) }; }
    let coste = precio ?? precioDe(cfg, tipo);
    // Compañero equipado (1.21.0): las bromas normales salen más baratas (no las devoluciones).
    let descuentoCompa = 0;
    if (precio === null || precio === undefined) {
        const v = await require('./cofres.js').ventajasUsuario(guild.id, autor.id).catch(() => null);
        if (v?.bromas > 0) { descuentoCompa = v.bromas; coste = Math.round(coste * (1 - v.bromas)); }
    }
    const economia = require('./economia.js').en(guild.id);
    const saldo = await economia.cobrar(autor.id, coste);
    if (saldo === null) return { error: textoError('oro', idioma, { precio: coste }) };

    // Se reserva antes de tocar Discord: si otra broma a la misma persona llega a la vez, solo vale una.
    let broma;
    try {
        broma = await Broma.create({
            guildId: guild.id, autorId: autor.id, objetivoId: objetivo.id, tipo, texto: tipo === 'apodo' ? texto.trim() : texto,
            precio: coste, devolucionDe, fin: new Date(Date.now() + duracionMin(cfg.bromas) * 60000),
            restantes: tipo === 'loro' ? MENSAJES_LORO : 0,
        });
        if (await Broma.countDocuments({ guildId: guild.id, objetivoId: objetivo.id, activa: true }) > 1) {
            await Broma.deleteOne({ _id: broma._id });
            throw new Error('yaTiene');
        }
    } catch {
        await economia.darOro(autor.id, coste);
        return { error: textoError('yaTiene', idioma) };
    }
    const r = await aplicarEnDiscord(guild, objetivo, tipo, cfg, broma.texto, autor);
    if (r.fallo) {
        await Broma.deleteOne({ _id: broma._id });
        await economia.darOro(autor.id, coste);
        return { error: textoError(r.fallo, idioma) };
    }
    if (r.apodoAnterior !== undefined || r.rolId) {
        await Broma.updateOne({ _id: broma._id }, { $set: { apodoAnterior: r.apodoAnterior ?? null, rolId: r.rolId || null } });
    }
    olvidar(guild.id);
    await Promise.all([
        PerfilBroma.updateOne({ guildId: guild.id, userId: autor.id }, { $set: { ultimaBroma: new Date() }, $inc: devolucionDe ? { gastadas: 1, devueltas: 1 } : { gastadas: 1 } }, { upsert: true }),
        PerfilBroma.updateOne({ guildId: guild.id, userId: objetivo.id }, { $inc: { recibidas: 1 } }, { upsert: true }),
    ]);
    // Las bromas alegran a la mascota.
    await require('../models/Mascota.js').updateOne({ guildId: guild.id, estado: 'viva' }, [{ $set: { alegria: { $min: [100, { $add: ['$alegria', 1] }] } } }], { updatePipeline: true }).catch(() => {});

    const destino = (cfg.bromas.canalId && guild.channels.cache.get(cfg.bromas.canalId)) || canal;
    if (destino?.isTextBased()) {
        const msg = await destino.send(anuncio(broma, cfg, cfg)).catch(() => null);
        if (msg) await Broma.updateOne({ _id: broma._id }, { $set: { canalId: msg.channelId, mensajeId: msg.id } });
    }
    return { ok: true, broma, saldo, coste, descuentoCompa };
}

async function finalizar(client, broma) {
    const r = await Broma.updateOne({ _id: broma._id, activa: true }, { $set: { activa: false } });
    if (!r.modifiedCount) return;
    olvidar(broma.guildId);
    const guild = client.guilds.cache.get(broma.guildId);
    if (guild) await deshacerEnDiscord(guild, broma);
    // Los botones del anuncio dejan de servir.
    if (guild && broma.canalId && broma.mensajeId) {
        const canal = guild.channels.cache.get(broma.canalId);
        const msg = canal ? await canal.messages.fetch(broma.mensajeId).catch(() => null) : null;
        if (msg && msg.components?.length) await msg.edit({ components: [] }).catch(() => {});
    }
}

async function barrerBromas(client) {
    const vencidas = await Broma.find({ activa: true, fin: { $lte: new Date() } }).limit(100);
    for (const b of vencidas) await finalizar(client, b).catch((e) => console.error('Bromas · fin:', e.message));
}

// Al escribir: reacción y loro.
async function alMensaje(message, cfg) {
    if (!cfg?.bromas?.activo || message.author.bot) return;
    const vivas = await vivasDe(message.guild.id);
    const b = vivas.get(message.author.id);
    if (!b || new Date(b.fin) <= new Date()) return;
    if (b.tipo === 'reaccion') {
        await message.react(b.texto).catch(() => {});
    } else if (b.tipo === 'loro' && message.content) {
        const r = await Broma.findOneAndUpdate({ _id: b._id, activa: true, restantes: { $gt: 0 } }, { $inc: { restantes: -1 } }, { returnDocument: 'after' });
        if (!r) return;
        await message.reply({ content: `🦜 ${burla(message.content)}`.slice(0, 2000), allowedMentions: { parse: [] } }).catch(() => {});
        if (r.restantes <= 0) await finalizar(message.client, r);
        else olvidar(message.guild.id);
    }
}

// Escudo (para uno mismo).
async function comprarEscudo(guildId, userId, cfg, idioma) {
    if (!cfg?.bromas?.activo) return { error: textoError('apagadas', idioma) };
    const precio = Math.max(0, parseInt(cfg.bromas.escudoPrecio, 10) || 0);
    const horas = Math.max(1, Math.min(168, parseInt(cfg.bromas.escudoHoras, 10) || 12));
    const saldo = await require('./economia.js').en(guildId).cobrar(userId, precio);
    if (saldo === null) return { error: textoError('oro', idioma, { precio }) };
    const p = await perfil(guildId, userId);
    const desde = p?.escudoHasta && new Date(p.escudoHasta) > new Date() ? new Date(p.escudoHasta) : new Date();
    const hasta = new Date(desde.getTime() + horas * 3600000);
    await PerfilBroma.updateOne({ guildId, userId }, { $set: { escudoHasta: hasta } }, { upsert: true });
    return { ok: true, hasta, precio, saldo };
}

async function salir(guildId, userId, fuera) {
    await PerfilBroma.updateOne({ guildId, userId }, { $set: { fuera: !!fuera } }, { upsert: true });
    // Si se sale, se le quitan las que tenga encima.
    if (fuera) {
        const activa = await Broma.findOne({ guildId, objetivoId: userId, activa: true });
        return activa;
    }
    return null;
}

// Botones del anuncio (brm_*) y la ventana del apodo para devolverla.
async function manejar(interaction, client) {
    const id = interaction.customId || '';
    if (!id.startsWith('brm_')) return false;
    const { getConfigCached } = require('./config.js');
    const { idiomaInteraccion } = require('./preferencias.js');
    const cfg = await getConfigCached(interaction.guildId).catch(() => null);
    const idioma = await idiomaInteraccion(interaction, cfg);
    const privado = (content) => interaction.reply({ content, flags: 64 });

    if (interaction.isButton() && id === 'brm_escudo') {
        const r = await comprarEscudo(interaction.guildId, interaction.user.id, cfg, idioma);
        await privado(r.error ? `❌ ${r.error}` : t(idioma, `🛡️ Tienes escudo hasta <t:${Math.floor(r.hasta / 1000)}:t> (🪙 ${r.precio}). Te quedan 🪙 ${r.saldo}.`, `🛡️ You’re shielded until <t:${Math.floor(r.hasta / 1000)}:t> (🪙 ${r.precio}). You have 🪙 ${r.saldo} left.`));
        return true;
    }
    const [accion, bromaId] = id.split(':');
    const original = await Broma.findById(bromaId).catch(() => null);
    if (!original) { await privado(t(idioma, 'Esta broma ya no existe.', 'This prank no longer exists.')); return true; }
    if (original.objetivoId !== interaction.user.id) { await privado(t(idioma, 'Solo quien ha recibido la broma puede devolverla 😉', 'Only the person who got pranked can get revenge 😉')); return true; }
    if (original.devuelta) { await privado(t(idioma, 'Ya se la has devuelto.', 'You already got your revenge.')); return true; }

    // Devolver un apodo: primero, cuál.
    if (accion === 'brm_dev' && interaction.isButton() && original.tipo === 'apodo') {
        await interaction.showModal(new ModalBuilder().setCustomId(`brm_devap:${original._id}`).setTitle(t(idioma, '↩️ Su nuevo apodo', '↩️ Their new nickname'))
            .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('apodo')
                .setLabel(t(idioma, 'Apodo (hasta 32 letras)', 'Nickname (up to 32 characters)')).setStyle(TextInputStyle.Short).setMaxLength(32).setRequired(true))));
        return true;
    }
    if ((accion === 'brm_dev' && interaction.isButton()) || (accion === 'brm_devap' && interaction.isModalSubmit())) {
        const guild = interaction.guild;
        const autor = interaction.member;
        const objetivo = await guild.members.fetch(original.autorId).catch(() => null);
        if (!objetivo) { await privado(t(idioma, 'Quien te la gastó ya no está en el servidor.', 'Whoever pranked you is no longer on the server.')); return true; }
        // Se marca como devuelta antes de cobrar (solo una vez).
        const marca = await Broma.updateOne({ _id: original._id, devuelta: false }, { $set: { devuelta: true } });
        if (!marca.modifiedCount) { await privado(t(idioma, 'Ya se la has devuelto.', 'You already got your revenge.')); return true; }
        const texto = accion === 'brm_devap' ? interaction.fields.getTextInputValue('apodo') : original.texto;
        const r = await gastar({ client, guild, cfg, autor, objetivo, tipo: original.tipo, texto, canal: interaction.channel, idioma, devolucionDe: original._id, precio: original.precio * 2 });
        if (r.error) {
            await Broma.updateOne({ _id: original._id }, { $set: { devuelta: false } });
            await privado(`❌ ${r.error}`);
        } else {
            await privado(t(idioma, `↩️ ¡Venganza servida! (🪙 ${r.coste}). Te quedan 🪙 ${r.saldo}.`, `↩️ Revenge served! (🪙 ${r.coste}). You have 🪙 ${r.saldo} left.`));
        }
        return true;
    }
    return false;
}

// Para el panel.
async function resumen(client, guildId) {
    const guild = client.guilds.cache.get(guildId);
    const persona = (id) => {
        const m = guild?.members.cache.get(id);
        return { id, nombre: m?.displayName || id, avatar: m?.user.displayAvatarURL({ size: 64 }) || null };
    };
    const [activas, recientes, top] = await Promise.all([
        Broma.find({ guildId, activa: true }).sort({ fin: 1 }).limit(50).lean(),
        Broma.find({ guildId }).sort({ inicio: -1 }).limit(20).lean(),
        PerfilBroma.find({ guildId, gastadas: { $gt: 0 } }).sort({ gastadas: -1 }).limit(5).lean(),
    ]);
    const fila = (b) => ({ id: String(b._id), tipo: b.tipo, texto: b.texto, precio: b.precio, inicio: b.inicio, fin: b.fin, activa: b.activa, devolucion: !!b.devolucionDe, autor: persona(b.autorId), objetivo: persona(b.objetivoId) });
    return {
        activas: activas.map(fila),
        recientes: recientes.map(fila),
        top: top.map((p) => ({ ...persona(p.userId), gastadas: p.gastadas, recibidas: p.recibidas })),
        descuento: require('./mascota.js').descuentoBromasServidor(guildId),
    };
}

async function cancelar(client, guildId, bromaId) {
    const b = await Broma.findOne({ _id: bromaId, guildId, activa: true }).catch(() => null);
    if (!b) return false;
    await finalizar(client, b);
    return true;
}

module.exports = {
    TIPOS, INFO, MENSAJES_LORO, precioDe, burla, emojiValido, apodoValido, comprobar, textoError,
    gastar, finalizar, barrerBromas, alMensaje, comprarEscudo, salir, manejar, resumen, cancelar, anuncio,
    duracionMin, esperaMin,
};
