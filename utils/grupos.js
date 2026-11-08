// Buscar grupo (/grupo): alguien busca gente para jugar a algo. Los demás se
// apuntan con un botón; al llenarse, el bot avisa a todos y (si está activado)
// crea una sala de voz solo para el grupo, que se borra sola cuando se queda vacía.
// Los grupos se cierran solos pasadas unas horas.
//
// /grupo abre una ventana con todo a la vista: a qué se juega, plazas, cuándo y un
// mensaje (caja grande, con varias líneas) para contar qué se va a hacer. «✏️ Editar»
// en el grupo abre la misma ventana para cambiarlo. Si algo falla al publicar o al
// guardar, lo escrito queda como borrador (1 hora, en memoria) y vuelve con «Volver a
// la ventana» o al usar /grupo otra vez.
const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, OverwriteType,
    ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const Grupo = require('../models/Grupo.js');
const { getConfigCached } = require('./config.js');
const { miembroPuedeModerar } = require('./permisos.js');
const { idiomaInteraccion } = require('./preferencias.js');
const { t, resolverIdioma } = require('./i18n.js');

const SALA_VACIA_MS = 5 * 60 * 1000;    // una sala vacía se borra a los 5 minutos
const GRACIA_SALA_MS = 10 * 60 * 1000;  // …y nada más crearla, hay 15 minutos para entrar
const salas = new Set();                 // ids de las salas de los grupos (para mirar rápido en voz)
let carga = null;
function cargarSalas() {
    if (!carga) {
        carga = Grupo.find({ salaVozId: { $type: 'string' } }).select('salaVozId').lean()
            .then((gs) => gs.forEach((g) => salas.add(g.salaVozId)))
            .catch(() => { carga = null; });
    }
    return carga;
}

// Lo que cabe en cada caja de la ventana.
const MAX_JUEGO = 100;
const MAX_CUANDO = 100;
const MAX_MENSAJE = 1000;
const MIN_PLAZAS = 2;
const MAX_PLAZAS = 25;

const COLOR = { abierto: '#22c55e', lleno: '#3b82f6', cerrado: '#64748b' };

function embedGrupo(g, idioma) {
    const lista = g.miembros.map((id, i) => `${i === 0 ? '👑' : '•'} <@${id}>`).join('\n');
    const titulo = g.estado === 'lleno' ? t(idioma, '✅ ¡Grupo completo!', '✅ Group full!') : g.estado === 'cerrado' ? t(idioma, '🔒 Grupo cerrado', '🔒 Group closed') : t(idioma, '🎮 Busco grupo', '🎮 Looking for group');
    const embed = new EmbedBuilder()
        .setColor(COLOR[g.estado] || COLOR.abierto)
        .setAuthor({ name: titulo })
        .setTitle(g.juego.slice(0, 256))
        .addFields(
            { name: t(idioma, '👥 Plazas', '👥 Slots'), value: `**${g.miembros.length}/${g.plazas}**`, inline: true },
            ...(g.cuando ? [{ name: t(idioma, '🕒 Cuándo', '🕒 When'), value: g.cuando.slice(0, 1024), inline: true }] : []),
            ...(g.salaVozId ? [{ name: t(idioma, '🔊 Sala', '🔊 Room'), value: `<#${g.salaVozId}>`, inline: true }] : []),
            { name: t(idioma, 'Apuntados', 'Joined'), value: lista.slice(0, 1024) || '—' },
        )
        .setFooter({ text: g.estado === 'abierto' ? t(idioma, 'Pulsa «Me apunto» para unirte', 'Press “Join” to join in') : t(idioma, 'Crea otro con /grupo', 'Start another one with /group') })
        .setTimestamp(g.creadoFecha);
    if (g.descripcion) embed.setDescription(g.descripcion.slice(0, MAX_MENSAJE));
    return embed;
}

function filaGrupo(g, idioma) {
    const cerrado = g.estado === 'cerrado';
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`grp_unir:${g._id}`).setStyle(ButtonStyle.Success).setEmoji('✋').setLabel(t(idioma, 'Me apunto', 'Join')).setDisabled(g.estado !== 'abierto'),
        new ButtonBuilder().setCustomId(`grp_salir:${g._id}`).setStyle(ButtonStyle.Secondary).setEmoji('🚪').setLabel(t(idioma, 'Salir', 'Leave')).setDisabled(cerrado),
        new ButtonBuilder().setCustomId(`grp_editar:${g._id}`).setStyle(ButtonStyle.Secondary).setEmoji('✏️').setLabel(t(idioma, 'Editar', 'Edit')).setDisabled(cerrado),
        new ButtonBuilder().setCustomId(`grp_cerrar:${g._id}`).setStyle(ButtonStyle.Danger).setEmoji('🔒').setLabel(t(idioma, 'Cerrar', 'Close')).setDisabled(cerrado),
    );
}
const mensajeGrupo = (g, idioma) => ({ embeds: [embedGrupo(g, idioma)], components: [filaGrupo(g, idioma)], allowedMentions: { parse: [] } });
const enlaceGrupo = (g) => (g.mensajeId ? `https://discord.com/channels/${g.guildId}/${g.canalId}/${g.mensajeId}` : '');

// ============================== BORRADORES ==============================
// Lo escrito en la ventana que no se ha podido publicar o guardar. Uno por persona y
// por destino ('nuevo' o el id del grupo que se edita), una hora. En memoria: un
// reinicio del bot lo pierde, pero es justo el rato en que se va a reintentar.
const BORRADOR_MS = 60 * 60 * 1000;
const MAX_BORRADORES = 1000;
const borradores = new Map(); // `${guildId}:${userId}:${destino}` -> { datos, hasta }
const claveBorrador = (guildId, userId, destino) => `${guildId}:${userId}:${destino}`;

function guardarBorrador(guildId, userId, destino, datos, ahora = Date.now()) {
    const clave = claveBorrador(guildId, userId, destino);
    borradores.delete(clave); // al final de la cola: es el más reciente
    borradores.set(clave, { datos: { ...datos }, hasta: ahora + BORRADOR_MS });
    for (const [k, b] of borradores) {
        if (borradores.size <= MAX_BORRADORES && b.hasta > ahora) break;
        borradores.delete(k);
    }
}
function verBorrador(guildId, userId, destino, ahora = Date.now()) {
    const clave = claveBorrador(guildId, userId, destino);
    const b = borradores.get(clave);
    if (!b) return null;
    if (b.hasta <= ahora) { borradores.delete(clave); return null; }
    return { ...b.datos };
}
const borrarBorrador = (guildId, userId, destino) => borradores.delete(claveBorrador(guildId, userId, destino));

// =============================== VENTANA ================================
// «5», «5 personas», «somos 5»… → 5. Sin número o fuera de 2-25 → null.
function leerPlazas(v) {
    const m = String(v ?? '').match(/\d+/);
    const n = m ? parseInt(m[0], 10) : NaN;
    return n >= MIN_PLAZAS && n <= MAX_PLAZAS ? n : null;
}
const limpio = (v, max) => String(v ?? '').trim().slice(0, max);
// El mensaje conserva sus líneas, pero sin espacios al final ni más de una línea en blanco seguida.
const limpioMensaje = (v) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_MENSAJE);

// Lo que se ha escrito en la ventana (las plazas tal cual: se comprueban aparte).
function datosVentana(interaction) {
    const campo = (id) => { try { return interaction.fields.getTextInputValue(id) || ''; } catch { return ''; } };
    return {
        juego: limpio(campo('juego'), MAX_JUEGO),
        plazas: limpio(campo('plazas'), 20),
        cuando: limpio(campo('cuando'), MAX_CUANDO),
        descripcion: limpioMensaje(campo('mensaje')),
    };
}

// La ventana de /grupo y de «Editar», con lo que ya hubiera escrito. Discord corta las
// etiquetas a 45 letras y los textos de ayuda a 100.
function ventanaGrupo(destino, datos = {}, idioma) {
    const caja = (id, etiqueta, estilo, { obligatorio = false, max, ayuda, valor }) => {
        const c = new TextInputBuilder().setCustomId(id).setLabel(etiqueta).setStyle(estilo)
            .setRequired(obligatorio).setMaxLength(max).setPlaceholder(ayuda);
        const v = String(valor ?? '').slice(0, max);
        if (v) c.setValue(v);
        return new ActionRowBuilder().addComponents(c);
    };
    return new ModalBuilder()
        .setCustomId(`grp_ventana:${destino}`)
        .setTitle(destino === 'nuevo' ? t(idioma, 'Buscar grupo', 'Look for a group') : t(idioma, 'Editar el grupo', 'Edit the group'))
        .addComponents(
            caja('juego', t(idioma, '¿A qué vais a jugar?', 'What are you going to play?'), TextInputStyle.Short, {
                obligatorio: true, max: MAX_JUEGO, valor: datos.juego,
                ayuda: t(idioma, 'Valorant, Minecraft, Among Us…', 'Valorant, Minecraft, Among Us…'),
            }),
            caja('plazas', t(idioma, 'Plazas en total, contándote a ti', 'Total slots, counting you'), TextInputStyle.Short, {
                obligatorio: true, max: 20, valor: datos.plazas,
                ayuda: t(idioma, `Un número del ${MIN_PLAZAS} al ${MAX_PLAZAS}`, `A number from ${MIN_PLAZAS} to ${MAX_PLAZAS}`),
            }),
            caja('cuando', t(idioma, '¿Cuándo? (opcional)', 'When? (optional)'), TextInputStyle.Short, {
                max: MAX_CUANDO, valor: datos.cuando,
                ayuda: t(idioma, 'Ahora, a las 22:00, el sábado por la tarde…', 'Now, at 10 pm, Saturday afternoon…'),
            }),
            caja('mensaje', t(idioma, 'Mensaje: ¿qué vais a hacer? (opcional)', 'Message: what will you do? (optional)'), TextInputStyle.Paragraph, {
                max: MAX_MENSAJE, valor: datos.descripcion,
                ayuda: t(idioma, 'Cuéntalo con detalle: modo, nivel, si hace falta micro, normas… Puedes usar varias líneas.', 'Tell them in detail: mode, rank, mic needed, rules… You can use several lines.'),
            }),
        );
}

// «Volver a la ventana» con lo que había escrito.
const filaReabrir = (destino, idioma) => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`grp_reabrir:${destino}`).setStyle(ButtonStyle.Primary).setEmoji('✏️').setLabel(t(idioma, 'Volver a la ventana', 'Back to the form')),
);

const grupoAbiertoDe = (guildId, userId) => Grupo.findOne({ guildId, creadorId: userId, estado: { $ne: 'cerrado' } });
const avisoYaAbierto = (g, idioma) => t(idioma,
    `Ya tienes un grupo abierto (**${g.juego}**). Ciérralo con «🔒 Cerrar» antes de crear otro, o cámbialo con «✏️ Editar». ${enlaceGrupo(g)}`,
    `You already have an open group (**${g.juego}**). Close it with “🔒 Close” before starting another, or change it with “✏️ Edit”. ${enlaceGrupo(g)}`).trim();
const avisoApagado = (idioma) => t(idioma, '🎮 Buscar grupo está apagado en este servidor.', '🎮 Looking for group is turned off on this server.');
const puedeGestionar = (interaction, g, cfg) => g.creadorId === interaction.user.id
    || miembroPuedeModerar(interaction.member, cfg, PermissionsBitField.Flags.ManageMessages);

// La ventana hay que abrirla en menos de 3 s: si la base de datos tarda, no se espera a
// saber si ya tiene un grupo abierto (se vuelve a mirar al publicar).
function sinEsperar(promesa, ms = 1500) {
    let reloj;
    const limite = new Promise((r) => { reloj = setTimeout(r, ms, null); });
    return Promise.race([promesa.catch(() => null), limite]).finally(() => clearTimeout(reloj));
}

// /grupo → la ventana (con el borrador, si quedó algo sin publicar).
async function abrirVentanaNuevo(interaction, cfg) {
    const [idioma, abierto] = await Promise.all([
        idiomaInteraccion(interaction, cfg),
        cfg?.grupos?.activo === false ? null : sinEsperar(grupoAbiertoDe(interaction.guildId, interaction.user.id)),
    ]);
    if (cfg?.grupos?.activo === false) return interaction.reply({ content: avisoApagado(idioma), flags: 64 });
    if (abierto) return interaction.reply({ content: avisoYaAbierto(abierto, idioma), flags: 64 });
    return interaction.showModal(ventanaGrupo('nuevo', verBorrador(interaction.guildId, interaction.user.id, 'nuevo') || {}, idioma));
}

// Publica un grupo nuevo. Devuelve { ok, grupo, url } o { error, borrador?, reintentar? }.
async function crearGrupo(interaction, cfg, { juego, plazas, descripcion, cuando }, idioma) {
    const gc = cfg?.grupos;
    if (gc?.activo === false) return { error: avisoApagado(idioma), borrador: false, reintentar: false };
    const abierto = await grupoAbiertoDe(interaction.guildId, interaction.user.id);
    if (abierto) {
        return { error: `${avisoYaAbierto(abierto, idioma)}\n${t(idioma, 'Cuando lo cierres, usa /grupo otra vez: lo que has escrito te estará esperando.', 'Once you close it, use /group again: what you wrote will be waiting for you.')}`, reintentar: false };
    }
    const canal = (gc?.canalId && interaction.guild.channels.cache.get(gc.canalId)) || interaction.channel;
    if (!canal?.isTextBased()) return { error: t(idioma, 'No encuentro dónde publicar el grupo.', 'I can’t find where to post the group.') };
    const g = await Grupo.create({
        guildId: interaction.guildId, canalId: canal.id, creadorId: interaction.user.id,
        juego: limpio(juego, MAX_JUEGO), plazas, descripcion: limpioMensaje(descripcion), cuando: limpio(cuando, MAX_CUANDO),
        miembros: [interaction.user.id],
        expira: new Date(Date.now() + Math.max(1, gc?.horasCaducidad || 6) * 3600 * 1000),
    });
    const msg = await canal.send(mensajeGrupo(g, cfg)).catch(() => null);
    if (!msg) { await g.deleteOne(); return { error: t(idioma, `No puedo escribir en <#${canal.id}>.`, `I can’t write in <#${canal.id}>.`) }; }
    g.mensajeId = msg.id;
    await g.save();
    return { ok: true, grupo: g, url: msg.url };
}

// Guarda lo cambiado en la ventana de «Editar». Nunca deja menos plazas que apuntados.
async function editarGrupo(interaction, cfg, id, { juego, plazas, descripcion, cuando }, idioma) {
    const g = await Grupo.findOne({ _id: id, guildId: interaction.guildId }).catch(() => null);
    if (!g) return { error: t(idioma, 'Este grupo ya no existe.', 'This group no longer exists.'), borrador: false, reintentar: false };
    if (!puedeGestionar(interaction, g, cfg)) return { error: t(idioma, 'Solo quien creó el grupo (o el staff) puede editarlo.', 'Only whoever started the group (or the staff) can edit it.'), borrador: false, reintentar: false };
    const cerrado = { error: t(idioma, 'Este grupo ya está cerrado: crea otro con /grupo.', 'This group is already closed: start another one with /group.'), borrador: false, reintentar: false };
    if (g.estado === 'cerrado') return cerrado;
    // De una vez: alguien puede apuntarse mientras se edita.
    let nuevo = await Grupo.findOneAndUpdate(
        { _id: g._id, estado: { $ne: 'cerrado' }, $expr: { $lte: [{ $size: '$miembros' }, plazas] } },
        { $set: { juego: limpio(juego, MAX_JUEGO), plazas, descripcion: limpioMensaje(descripcion), cuando: limpio(cuando, MAX_CUANDO) } },
        { returnDocument: 'after' },
    );
    if (!nuevo) {
        const actual = await Grupo.findById(g._id);
        if (!actual || actual.estado === 'cerrado') return cerrado;
        const n = actual.miembros.length;
        return { error: t(idioma, `❌ Ya hay ${n} apuntados: pon ${n} plazas o más.`, `❌ ${n} people have already joined: set ${n} slots or more.`) };
    }
    // Más plazas que apuntados: vuelve a abrirse. Justas: se llena (sala y aviso, como al apuntarse el último).
    let seHaLlenado = false;
    if (nuevo.estado === 'lleno' && nuevo.miembros.length < nuevo.plazas) {
        await Grupo.updateOne({ _id: nuevo._id, estado: 'lleno' }, { $set: { estado: 'abierto' } });
        nuevo.estado = 'abierto';
    } else if (nuevo.estado === 'abierto' && nuevo.miembros.length >= nuevo.plazas) {
        const lleno = await marcarLleno(interaction.guild, nuevo, cfg);
        if (lleno) { nuevo = lleno; seHaLlenado = true; }
    }
    // La sala, si ya la tienen: mismo nombre y plazas que el grupo. Sin esperar: Discord
    // solo deja renombrar un canal 2 veces cada 10 minutos y retiene lo demás.
    // (Solo si ya la tenían: una recién creada al llenarse ya sale con lo nuevo.)
    const sala = g.salaVozId && nuevo.salaVozId === g.salaVozId && interaction.guild.channels.cache.get(nuevo.salaVozId);
    if (sala) {
        const cambios = {};
        if (nuevo.juego !== g.juego) cambios.name = `🎮 ${nuevo.juego}`.slice(0, 100);
        if (nuevo.plazas !== g.plazas) cambios.userLimit = Math.min(99, nuevo.plazas);
        if (Object.keys(cambios).length) sala.edit(cambios).catch(() => {});
    }
    const canal = interaction.guild.channels.cache.get(nuevo.canalId);
    const msg = interaction.message?.id === nuevo.mensajeId ? interaction.message
        : (canal && nuevo.mensajeId ? await canal.messages.fetch(nuevo.mensajeId).catch(() => null) : null);
    if (msg) await msg.edit(mensajeGrupo(nuevo, cfg)).catch(() => {});
    if (seHaLlenado) await avisarLleno(canal, nuevo, cfg);
    return { ok: true, grupo: nuevo, url: msg?.url || enlaceGrupo(nuevo) };
}

// Ventana enviada: publica el grupo o guarda los cambios. Si algo falla, lo escrito
// queda como borrador y se ofrece «Volver a la ventana».
async function manejarVentana(interaction) {
    const destino = interaction.customId.split(':')[1] || 'nuevo';
    const cfg = await getConfigCached(interaction.guildId).catch(() => null);
    const idioma = await idiomaInteraccion(interaction, cfg);
    const { guildId } = interaction;
    const uid = interaction.user.id;
    const datos = datosVentana(interaction);

    const fallo = (r) => {
        const guardado = r.borrador !== false;
        if (guardado) guardarBorrador(guildId, uid, destino, datos);
        const msg = {
            content: `${r.error}${guardado ? `\n${t(idioma, '📝 Lo que has escrito está guardado.', '📝 What you wrote is saved.')}` : ''}`.slice(0, 2000),
            components: guardado && r.reintentar !== false ? [filaReabrir(destino, idioma)] : [],
            allowedMentions: { parse: [] },
        };
        return interaction.deferred ? interaction.editReply(msg) : interaction.reply({ ...msg, flags: 64 });
    };

    const plazas = leerPlazas(datos.plazas);
    if (!datos.juego) return fallo({ error: t(idioma, '❌ Falta a qué vais a jugar.', '❌ You didn’t say what you’re going to play.') });
    if (!plazas) return fallo({ error: t(idioma, `❌ En «Plazas» pon un número del ${MIN_PLAZAS} al ${MAX_PLAZAS} (contándote a ti).`, `❌ In “Slots” put a number from ${MIN_PLAZAS} to ${MAX_PLAZAS} (counting you).`) });

    await interaction.deferReply({ flags: 64 });
    const r = destino === 'nuevo'
        ? await crearGrupo(interaction, cfg, { ...datos, plazas }, idioma)
        : await editarGrupo(interaction, cfg, destino, { ...datos, plazas }, idioma);
    if (r.error) return fallo(r);
    borrarBorrador(guildId, uid, destino);
    if (destino !== 'nuevo') return interaction.editReply({ content: t(idioma, `✅ Cambios guardados. ${r.url}`, `✅ Changes saved. ${r.url}`).trim(), components: [] });
    const sala = cfg?.grupos?.crearSala !== false;
    return interaction.editReply({
        content: t(idioma,
            `✅ ¡Grupo publicado! ${r.url}\nCuando se llene os aviso a todos${sala ? ' y os creo una sala de voz' : ''}.\n✏️ Si quieres cambiar algo (también el mensaje), pulsa «Editar» en el grupo.`,
            `✅ Group posted! ${r.url}\nWhen it fills up I’ll let everyone know${sala ? ' and make you a voice room' : ''}.\n✏️ To change anything (the message too), press “Edit” on the group.`),
        components: [],
    });
}

// Sala de voz solo para los del grupo (y el bot), con tantas plazas como el grupo.
async function crearSala(guild, g, cfg) {
    const canalGrupo = guild.channels.cache.get(g.canalId);
    const categoria = (cfg?.grupos?.categoriaId && guild.channels.cache.get(cfg.grupos.categoriaId)) || canalGrupo?.parent || null;
    const P = PermissionsBitField.Flags;
    const sala = await guild.channels.create({
        name: `🎮 ${g.juego}`.slice(0, 100),
        type: ChannelType.GuildVoice,
        userLimit: Math.min(99, g.plazas),
        ...(categoria ? { parent: categoria.id } : {}),
        permissionOverwrites: [
            { id: guild.id, type: OverwriteType.Role, deny: [P.Connect] },
            ...(guild.members.me ? [{ id: guild.members.me.id, type: OverwriteType.Member, allow: [P.ViewChannel, P.Connect, P.ManageChannels, P.MoveMembers] }] : []),
            ...g.miembros.map((id) => ({ id, type: OverwriteType.Member, allow: [P.ViewChannel, P.Connect, P.Speak] })),
        ],
        reason: t(cfg, 'Sala de un grupo de /grupo', 'Room for a /group party'),
    });
    salas.add(sala.id);
    return sala;
}

// Se acaba de llenar: lo marca «lleno» de una vez (si se apunta el último a la vez que
// se editan las plazas, solo uno crea la sala) y crea la sala si toca. Devuelve el grupo
// al día, o null si otro ya lo había hecho.
async function marcarLleno(guild, g, cfg) {
    const lleno = await Grupo.findOneAndUpdate(
        { _id: g._id, estado: 'abierto', $expr: { $gte: [{ $size: '$miembros' }, '$plazas'] } },
        { $set: { estado: 'lleno' } }, { returnDocument: 'after' },
    );
    if (!lleno) return null;
    if (cfg?.grupos?.crearSala !== false && !lleno.salaVozId) {
        const sala = await crearSala(guild, lleno, cfg).catch(() => null);
        if (sala) {
            lleno.salaVozId = sala.id;
            lleno.salaVaciaDesde = new Date(Date.now() + GRACIA_SALA_MS);
            await Grupo.updateOne({ _id: lleno._id }, { $set: { salaVozId: lleno.salaVozId, salaVaciaDesde: lleno.salaVaciaDesde } });
        }
    }
    return lleno;
}

// «🎉 ¡Grupo completo!» mencionando a todos, con su sala.
async function avisarLleno(canal, g, cfg) {
    if (!canal?.isTextBased?.()) return;
    const sala = g.salaVozId ? t(cfg, ` Vuestra sala: <#${g.salaVozId}>`, ` Your room: <#${g.salaVozId}>`) : '';
    await canal.send({
        content: t(cfg, `🎉 ¡Grupo de **${g.juego}** completo! ${g.miembros.map((m) => `<@${m}>`).join(' ')}${sala}`, `🎉 The **${g.juego}** group is full! ${g.miembros.map((m) => `<@${m}>`).join(' ')}${sala}`).slice(0, 2000),
        allowedMentions: { users: g.miembros },
    }).catch(() => {});
}

// Botones: me apunto, salir, editar, cerrar y «Volver a la ventana».
async function manejarBoton(interaction, client) {
    const [accion, id] = interaction.customId.split(':');
    const cfg = await getConfigCached(interaction.guildId).catch(() => null);
    // El idioma de quien pulsa solo hace falta para contestarle a él: «Me apunto» tiene que
    // actualizar el mensaje en menos de 3 s y no espera a mirarlo.
    let idioma = resolverIdioma(cfg);
    const conIdioma = async () => { idioma = await idiomaInteraccion(interaction, cfg); };
    const uid = interaction.user.id;
    const responder = (content) => interaction.reply({ content, flags: 64, allowedMentions: { parse: [] } });
    if (accion !== 'grp_unir') await conIdioma(); // «Me apunto» solo lo mira si tiene que contestar

    // «Volver a la ventana» de un grupo nuevo (los de editar siguen abajo, con su grupo).
    if (accion === 'grp_reabrir' && id === 'nuevo') {
        const datos = verBorrador(interaction.guildId, uid, 'nuevo');
        if (!datos) return responder(t(idioma, '⌛ Ya no tengo guardado lo que escribiste (se guarda una hora). Usa /grupo otra vez.', '⌛ I no longer have what you wrote (it’s kept for an hour). Use /group again.'));
        if (cfg?.grupos?.activo === false) return responder(avisoApagado(idioma));
        const abierto = await sinEsperar(grupoAbiertoDe(interaction.guildId, uid));
        if (abierto) return responder(avisoYaAbierto(abierto, idioma));
        return interaction.showModal(ventanaGrupo('nuevo', datos, idioma));
    }

    let g = await Grupo.findById(id).catch(() => null);
    if (!g) { await conIdioma(); return responder(t(idioma, 'Este grupo ya no existe.', 'This group no longer exists.')); }

    if (accion === 'grp_editar' || accion === 'grp_reabrir') {
        if (!puedeGestionar(interaction, g, cfg)) return responder(t(idioma, 'Solo quien creó el grupo (o el staff) puede editarlo.', 'Only whoever started the group (or the staff) can edit it.'));
        if (g.estado === 'cerrado') return responder(t(idioma, 'Este grupo ya está cerrado: crea otro con /grupo.', 'This group is already closed: start another one with /group.'));
        const borrador = verBorrador(interaction.guildId, uid, String(g._id));
        if (accion === 'grp_reabrir' && !borrador) return responder(t(idioma, '⌛ Ya no tengo guardado lo que escribiste (se guarda una hora). Pulsa «✏️ Editar» en el grupo.', '⌛ I no longer have what you wrote (it’s kept for an hour). Press “✏️ Edit” on the group.'));
        const datos = borrador || { juego: g.juego, plazas: g.plazas, cuando: g.cuando, descripcion: g.descripcion };
        return interaction.showModal(ventanaGrupo(String(g._id), datos, idioma));
    }

    if (accion === 'grp_unir') {
        // De una vez: solo entra si sigue abierto, hay sitio y no estaba ya.
        g = await Grupo.findOneAndUpdate(
            { _id: id, estado: 'abierto', miembros: { $ne: uid }, $expr: { $lt: [{ $size: '$miembros' }, '$plazas'] } },
            { $push: { miembros: uid } }, { returnDocument: 'after' },
        );
        if (!g) {
            const [actual] = await Promise.all([Grupo.findById(id), conIdioma()]);
            const motivo = actual?.miembros.includes(uid) ? t(idioma, 'Ya estás en este grupo.', 'You’re already in this group.')
                : actual?.estado === 'cerrado' ? t(idioma, 'Este grupo ya está cerrado.', 'This group is already closed.')
                : t(idioma, 'Llegas tarde: el grupo ya está completo.', 'Too late: the group is already full.');
            return responder(motivo);
        }
        // Si el grupo ya tenía sala (se llenó, alguien salió y vuelve a llenarse), el nuevo también puede entrar.
        if (g.salaVozId) {
            const sala = interaction.guild.channels.cache.get(g.salaVozId);
            await sala?.permissionOverwrites.edit(uid, { ViewChannel: true, Connect: true, Speak: true }).catch(() => {});
        }
        if (g.miembros.length >= g.plazas) {
            const lleno = await marcarLleno(interaction.guild, g, cfg);
            if (lleno) {
                await interaction.update(mensajeGrupo(lleno, cfg));
                await avisarLleno(interaction.channel, lleno, cfg);
                return;
            }
            g = (await Grupo.findById(id)) || g; // otro lo ha marcado a la vez: se pinta como esté
        }
        return interaction.update(mensajeGrupo(g, cfg));
    }

    if (accion === 'grp_salir') {
        if (g.creadorId === uid) return responder(t(idioma, 'Eres quien lo ha creado: si ya no vas, ciérralo con «Cerrar».', 'You started it: if you can’t make it, close it with “Close”.'));
        g = await Grupo.findOneAndUpdate({ _id: id, miembros: uid, estado: { $ne: 'cerrado' } }, { $pull: { miembros: uid } }, { returnDocument: 'after' });
        if (!g) return responder(t(idioma, 'No estabas en este grupo.', 'You weren’t in this group.'));
        if (g.estado === 'lleno' && g.miembros.length < g.plazas) { g.estado = 'abierto'; await g.save(); }
        if (g.salaVozId) {
            const sala = interaction.guild.channels.cache.get(g.salaVozId);
            await sala?.permissionOverwrites.delete(uid).catch(() => {});
        }
        return interaction.update(mensajeGrupo(g, cfg));
    }

    if (accion === 'grp_cerrar') {
        if (!puedeGestionar(interaction, g, cfg)) {
            return responder(t(idioma, 'Solo quien creó el grupo (o el staff) puede cerrarlo.', 'Only whoever started the group (or the staff) can close it.'));
        }
        g.estado = 'cerrado';
        await g.save();
        return interaction.update(mensajeGrupo(g, cfg));
    }
    return false;
}

// Al moverse alguien en voz: la sala de un grupo vacía empieza a contar para borrarse.
async function alCambiarVoz(oldState, newState) {
    await cargarSalas();
    if (newState.channelId && salas.has(newState.channelId)) {
        await Grupo.updateOne({ salaVozId: newState.channelId }, { $set: { salaVaciaDesde: null } }).catch(() => {});
    }
    if (oldState.channelId && oldState.channelId !== newState.channelId && salas.has(oldState.channelId)) {
        const sala = oldState.guild.channels.cache.get(oldState.channelId);
        if (sala && sala.members.filter((m) => !m.user.bot).size === 0) {
            await Grupo.updateOne({ salaVozId: oldState.channelId }, { $set: { salaVaciaDesde: new Date() } }).catch(() => {});
        }
    }
}

// Barrido: cierra los grupos caducados y borra las salas que llevan un rato vacías.
async function barrerGrupos(client) {
    await cargarSalas();
    const ahora = Date.now();
    const caducados = await Grupo.find({ estado: { $ne: 'cerrado' }, expira: { $lte: new Date(ahora) } }).limit(50);
    for (const g of caducados) {
        g.estado = 'cerrado';
        await g.save().catch(() => {});
        const cfg = await getConfigCached(g.guildId).catch(() => null);
        const canal = client.channels.cache.get(g.canalId);
        const msg = canal && g.mensajeId ? await canal.messages.fetch(g.mensajeId).catch(() => null) : null;
        if (msg) await msg.edit(mensajeGrupo(g, cfg)).catch(() => {});
    }
    const conSala = await Grupo.find({ salaVozId: { $type: 'string' }, salaVaciaDesde: { $ne: null, $lte: new Date(ahora - SALA_VACIA_MS) } }).limit(50);
    for (const g of conSala) {
        const guild = client.guilds.cache.get(g.guildId);
        const sala = guild?.channels.cache.get(g.salaVozId);
        if (sala && sala.members.filter((m) => !m.user.bot).size > 0) { g.salaVaciaDesde = null; await g.save().catch(() => {}); continue; }
        if (sala) await sala.delete('Sala de grupo vacía').catch(() => {});
        salas.delete(g.salaVozId);
        g.salaVozId = null;
        g.salaVaciaDesde = null;
        await g.save().catch(() => {});
    }
}

module.exports = {
    crearGrupo, editarGrupo, abrirVentanaNuevo, manejarVentana, manejarBoton, alCambiarVoz, barrerGrupos,
    embedGrupo, filaGrupo, mensajeGrupo, ventanaGrupo, datosVentana, leerPlazas, cargarSalas,
    guardarBorrador, verBorrador, borrarBorrador, MAX_MENSAJE,
};
