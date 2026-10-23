// Pruebas de los flujos de Discord: necesitan un MongoDB (MONGO_URI_TEST, por defecto mongodb://127.0.0.1:27017).
const path = require('path');
const REPO = path.join(__dirname, '..');
const MONGO = (process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017').replace(/\/$/, '');
const fs = require('fs');
const mongoose = require('mongoose');
const { Collection, ChannelType } = require('discord.js');
const { crearCliente, crearServidor, crearMiembro, crearCanal } = require('./fakeDiscord.js');
const Ticket = require(`${REPO}/models/Ticket.js`);
const Mensaje = require(`${REPO}/models/Mensaje.js`);
const Log = require(`${REPO}/models/Log.js`);
const ServidorConfig = require(`${REPO}/models/ServidorConfig.js`);
const { cargarCanalesTicket } = require(`${REPO}/utils/ticketCache.js`);
const { actualizarConfig, invalidarConfig } = require(`${REPO}/utils/config.js`);

let fallos = 0, ok = 0;
const check = (cond, nombre, extra) => {
    if (cond) { ok++; console.log(`  ✔ ${nombre}`); }
    else { fallos++; console.log(`  ✘ ${nombre}`, extra !== undefined ? JSON.stringify(extra, (k, v) => typeof v === 'bigint' ? String(v) : v).slice(0, 500) : ''); }
};
const esperar = (ms) => new Promise(r => setTimeout(r, ms));

const interaccionCreate = require(`${REPO}/events/interactionCreate.js`);
const messageCreate = require(`${REPO}/events/messageCreate.js`);
const messageUpdate = require(`${REPO}/events/messageUpdate.js`);
const messageDelete = require(`${REPO}/events/messageDelete.js`);
const channelDelete = require(`${REPO}/events/channelDelete.js`);

let client;
function interaccion({ tipo, customId, miembro, guild, canal, values, fields = {}, message = null, comando, opciones = {}, users }) {
    const i = {
        customId, commandName: comando, client, user: miembro.user, member: miembro, guild, guildId: guild?.id,
        channel: canal, channelId: canal?.id, values, users, message,
        deferred: false, replied: false, r: [],
        inGuild: () => Boolean(guild),
        isAutocomplete: () => false,
        isChatInputCommand: () => tipo === 'comando',
        isMessageComponent: () => ['boton', 'select', 'userselect'].includes(tipo),
        isButton: () => tipo === 'boton',
        isStringSelectMenu: () => tipo === 'select',
        isModalSubmit: () => tipo === 'modal',
        isRepliable: () => true,
        isFromMessage: () => Boolean(message),
        fields: { getTextInputValue: (id) => fields[id] ?? '', getStringSelectValues: (id) => fields[id] },
        options: {
            getSubcommand: () => opciones.sub,
            getString: (n) => opciones[n] ?? null,
            getUser: (n) => opciones[n] ?? null,
            getRole: (n) => opciones[n] ?? null,
            getChannel: (n) => opciones[n] ?? null,
            getInteger: (n) => opciones[n] ?? null
        },
        reply: async (p) => { i.replied = true; i.r.push(['reply', p]); },
        deferReply: async (p) => { i.deferred = true; i.r.push(['deferReply', p]); },
        editReply: async (p) => { i.r.push(['editReply', p]); },
        update: async (p) => { i.replied = true; i.r.push(['update', p]); },
        deferUpdate: async () => { i.deferred = true; i.r.push(['deferUpdate']); },
        showModal: async (m) => { i.replied = true; i.r.push(['showModal', m.toJSON()]); }
    };
    return i;
}
const ultimoTexto = (i) => { const u = i.r[i.r.length - 1]; const p = u?.[1]; return typeof p === 'string' ? p : (p?.content ?? ''); };
const ejecutar = async (i) => { await interaccionCreate.execute(i, client); return i; };

function mensajeDiscord({ id, miembro, canal, guild, contenido, adjuntos = [] }) {
    return {
        id, author: { ...miembro.user, displayAvatarURL: miembro.user.displayAvatarURL }, member: miembro, guild, guildId: guild.id,
        channelId: canal.id, channel: canal, content: contenido, partial: false, editedTimestamp: null,
        url: `https://discord.com/channels/${guild.id}/${canal.id}/${id}`,
        attachments: new Collection(adjuntos.map((u, n) => [String(n), { url: u }])),
        reply: async () => {}
    };
}

(async () => {
    await mongoose.connect(`${MONGO}/sokyo_test_discord`);
    await mongoose.connection.dropDatabase();

    client = crearCliente();
    client.commands = new Collection();
    for (const f of fs.readdirSync(`${REPO}/comandos`)) { const c = require(`${REPO}/comandos/${f}`); client.commands.set(c.data.name, c); }

    const A = crearServidor(client, { id: 'gA', name: 'Servidor A' });
    const admin = crearMiembro(A, 'admin1', 'admin1', { admin: true });
    const u1 = crearMiembro(A, 'u1', 'usuario1');
    const u2 = crearMiembro(A, 'u2', 'usuario2');
    const staff = crearMiembro(A, 'staff1', 'staff1', { roles: ['rolstaff'] });
    const general = crearCanal(client, A, { name: 'general' });
    await actualizarConfig('gA', { rolesStaff: ['rolstaff'] });
    await cargarCanalesTicket();

    console.log('\n— Abrir ticket desde el panel de Discord');
    let i = await ejecutar(interaccion({ tipo: 'boton', customId: 'create_ticket', miembro: u1, guild: A, canal: general }));
    const modal = i.r[0]?.[1];
    check(i.r[0]?.[0] === 'showModal' && modal.components.length === 3 && modal.components[0].component.options.length === 3, 'botón abre un formulario con categoría, asunto y descripción', i.r);
    check(modal.title.length <= 45 && modal.components[0].component.required === true, 'formulario válido para Discord (título ≤ 45, select obligatorio)');

    i = await ejecutar(interaccion({ tipo: 'modal', customId: 'modal_abrir_ticket', miembro: u1, guild: A, canal: general, fields: { motivo: ['Reportar Usuario'], asuntoInput: 'Spam', descripcionInput: 'Un usuario hace spam' } }));
    check(i.r[0][0] === 'deferReply' && /✅ ¡Listo!/.test(ultimoTexto(i)) && i.r[1][1].components[0].components[0].data.url, 'enviar el formulario crea el ticket y da enlace', i.r);
    let ticket = await Ticket.findOne({ creadorId: 'u1' });
    const canal = client.channels.cache.get(ticket.canalId);
    check(ticket.numero === 1 && ticket.prioridad === 'Alta' && ticket.mensajeControlId && canal, 'ticket guardado con número, prioridad y mensaje de control');

    i = await ejecutar(interaccion({ tipo: 'boton', customId: 'create_ticket', miembro: u1, guild: A, canal: general }));
    check(i.r[0][0] === 'reply' && /Ya tienes un ticket abierto/.test(ultimoTexto(i)), 'segundo ticket bloqueado ANTES de rellenar el formulario', i.r);

    i = await ejecutar(interaccion({ tipo: 'select', customId: 'seleccionar_motivo_ticket', miembro: u2, guild: A, canal: general, values: ['Donaciones'] }));
    check(i.r[0][0] === 'showModal' && i.r[0][1].components[0].component.options.find(o => o.value === 'Donaciones').default === true, 'menú antiguo de categorías sigue funcionando (preseleccionada)', i.r);

    console.log('\n— Conversación');
    await messageCreate.execute(mensajeDiscord({ id: 'm1', miembro: u1, canal, guild: A, contenido: 'Hola', adjuntos: ['https://cdn.discordapp.com/attachments/1/2/foto.png?ex=1'] }), client);
    await messageCreate.execute(mensajeDiscord({ id: 'm2', miembro: staff, canal, guild: A, contenido: 'Te ayudo' }), client);
    await messageCreate.execute(mensajeDiscord({ id: 'm3', miembro: u1, canal: general, guild: A, contenido: 'fuera de ticket' }), client);
    const msgs = await Mensaje.find({ ticketId: canal.id }).sort({ fecha: 1 });
    check(msgs.length === 2 && msgs[0].esStaff === false && msgs[1].esStaff === true && msgs[0].imagenes.length === 1, 'mensajes del ticket guardados (staff detectado, adjuntos)', msgs);
    check((await Mensaje.countDocuments({ ticketId: general.id })) === 0, 'mensajes de otros canales no se guardan');
    ticket = await Ticket.findById(ticket._id);
    check(ticket.esperando === 'usuario' && ticket.primeraRespuestaStaff, 'actividad del ticket actualizada');

    const editado = { ...mensajeDiscord({ id: 'm1', miembro: u1, canal, guild: A, contenido: 'Hola (editado)' }), editedTimestamp: Date.now() };
    await messageUpdate.execute({ partial: false, content: 'Hola' }, editado, client);
    check((await Mensaje.findOne({ mensajeId: 'm1' })).editado === true, 'edición sincronizada en la conversación');
    await messageUpdate.execute({ partial: true }, { ...editado, id: 'm9', editedTimestamp: null }, client);
    check((await Log.countDocuments({ categoria: 'Mensajes Editados' })) === 1, 'cargar una vista previa de enlace NO cuenta como edición');
    await messageDelete.execute(mensajeDiscord({ id: 'm2', miembro: staff, canal, guild: A, contenido: 'Te ayudo' }), client);
    check((await Mensaje.findOne({ mensajeId: 'm2' })).borrado === true, 'borrado marcado en la conversación');

    console.log('\n— Botones del ticket');
    i = await ejecutar(interaccion({ tipo: 'boton', customId: 'reclamar_ticket', miembro: u1, guild: A, canal }));
    check(/Solo el equipo de soporte/.test(ultimoTexto(i)), 'un usuario no puede reclamar', i.r);
    i = await ejecutar(interaccion({ tipo: 'boton', customId: 'reclamar_ticket', miembro: staff, guild: A, canal }));
    check(/Ahora este ticket es tuyo/.test(ultimoTexto(i)), 'staff reclama', i.r);
    const control = canal.mensajes.get(ticket.mensajeControlId);
    check(control.payload.components[0].components[0].data.disabled === true && control.payload.embeds[0].data.fields[2].value === '<@staff1>', 'embed y botón de reclamar actualizados');

    i = await ejecutar(interaccion({ tipo: 'boton', customId: 'add_user_prompt', miembro: staff, guild: A, canal }));
    check(i.r[0][0] === 'reply' && i.r[0][1].components.length === 1, 'añadir usuario muestra el selector');
    i = await ejecutar(interaccion({ tipo: 'userselect', customId: 'add_user_select', miembro: staff, guild: A, canal, users: new Collection([['u2', u2.user], ['bot2', { id: 'bot2', username: 'otrobot', bot: true }]]) }));
    check(/usuario2 añadido/.test(ultimoTexto(i)) && /bots no se pueden/.test(ultimoTexto(i)), 'añade personas e ignora bots', i.r);
    check(canal.overwrites.get('u2')?.ViewChannel === true, 'el invitado obtiene permisos');

    i = await ejecutar(interaccion({ tipo: 'boton', customId: 'close_ticket', miembro: u2, guild: A, canal }));
    check(/Solo quien abrió/.test(ultimoTexto(i)), 'un invitado no puede cerrar', i.r);
    i = await ejecutar(interaccion({ tipo: 'boton', customId: 'close_ticket', miembro: u1, guild: A, canal }));
    check(i.r[0][0] === 'showModal' && i.r[0][1].custom_id === 'modal_cerrar_ticket', 'cerrar pide motivo en un formulario', i.r);
    i = await ejecutar(interaccion({ tipo: 'modal', customId: 'modal_cerrar_ticket', miembro: u1, guild: A, canal, fields: { motivoCierre: 'Ya está resuelto' } }));
    check(/Ticket cerrado/.test(ultimoTexto(i)), 'el creador cierra su ticket', i.r);
    await esperar(300);
    ticket = await Ticket.findById(ticket._id);
    check(ticket.estado === 'Cerrado' && ticket.motivoCierre === 'Ya está resuelto' && canal.overwrites.get('u2')?.SendMessages === false, 'cerrado: invitados también en solo lectura');
    const dm = client.dms.find(d => d.id === 'u1');
    check(dm && dm.p.components[0].components.length === 5, 'DM con 5 botones de valoración');

    console.log('\n— Valoración por DM');
    i = await ejecutar(interaccion({ tipo: 'boton', customId: `csat_4_${canal.id}`, miembro: u2, guild: null, canal: null }));
    check(/No se encontró/.test(ultimoTexto(i)), 'nadie más que el creador puede valorar', i.r);
    i = await ejecutar(interaccion({ tipo: 'boton', customId: `csat_4_${canal.id}`, miembro: u1, guild: null, canal: null }));
    check(i.r[0][0] === 'update' && i.r[0][1].components[0].components[0].data.custom_id === `csatcom_${canal.id}`, 'valorar ofrece dejar comentario', i.r);
    i = await ejecutar(interaccion({ tipo: 'boton', customId: `csatcom_${canal.id}`, miembro: u1, guild: null, canal: null }));
    check(i.r[0][0] === 'showModal', 'botón de comentario abre formulario');
    i = await ejecutar(interaccion({ tipo: 'modal', customId: `modal_csat_${canal.id}`, miembro: u1, guild: null, canal: null, fields: { comentario: '¡Muy rápidos!' }, message: {} }));
    ticket = await Ticket.findById(ticket._id);
    check(ticket.valoracionCSAT === 4 && ticket.comentarioCSAT === '¡Muy rápidos!' && i.r[0][0] === 'update', 'valoración y comentario guardados');

    console.log('\n— Ticket cerrado: reabrir, transcript, eliminar');
    i = await ejecutar(interaccion({ tipo: 'boton', customId: 'reopen_ticket', miembro: u1, guild: A, canal }));
    check(/Solo el equipo/.test(ultimoTexto(i)), 'usuario no puede reabrir');
    i = await ejecutar(interaccion({ tipo: 'boton', customId: 'reopen_ticket', miembro: staff, guild: A, canal }));
    check(/Ticket reabierto/.test(ultimoTexto(i)), 'staff reabre', i.r);
    i = await ejecutar(interaccion({ tipo: 'comando', comando: 'ticket', miembro: staff, guild: A, canal, opciones: { sub: 'prioridad', nivel: 'Urgente' } }));
    check(/Prioridad cambiada a \*\*Urgente\*\*/.test(ultimoTexto(i)), '/ticket prioridad', i.r);
    i = await ejecutar(interaccion({ tipo: 'comando', comando: 'ticket', miembro: staff, guild: A, canal, opciones: { sub: 'quitar', usuario: u2.user } }));
    check(/ya no participa/.test(ultimoTexto(i)) && !canal.overwrites.has('u2'), '/ticket quitar', i.r);
    i = await ejecutar(interaccion({ tipo: 'comando', comando: 'ticket', miembro: staff, guild: A, canal, opciones: { sub: 'liberar' } }));
    check(/sin asignar/.test(ultimoTexto(i)) && !(await Ticket.findById(ticket._id)).asignadoA, '/ticket liberar', i.r);
    i = await ejecutar(interaccion({ tipo: 'comando', comando: 'ticket', miembro: staff, guild: A, canal, opciones: { sub: 'transcript' } }));
    check(i.r[1][1].files?.length === 1, '/ticket transcript adjunta HTML', i.r);
    i = await ejecutar(interaccion({ tipo: 'comando', comando: 'ticket', miembro: staff, guild: A, canal, opciones: { sub: 'cerrar', motivo: null } }));
    check(/Ticket cerrado/.test(ultimoTexto(i)), '/ticket cerrar', i.r);
    i = await ejecutar(interaccion({ tipo: 'comando', comando: 'ticket', miembro: staff, guild: A, canal: general, opciones: { sub: 'cerrar' } }));
    check(/solo funciona dentro de un canal de ticket/.test(ultimoTexto(i)), '/ticket fuera de un ticket avisa', i.r);
    i = await ejecutar(interaccion({ tipo: 'boton', customId: 'delete_ticket', miembro: staff, guild: A, canal }));
    check(i.r[0][1].components[0].components.length === 2, 'eliminar canal pide confirmación');
    i = await ejecutar(interaccion({ tipo: 'boton', customId: 'delete_ticket_confirm', miembro: staff, guild: A, canal }));
    await channelDelete.execute(canal, client);
    ticket = await Ticket.findById(ticket._id);
    check(!client.channels.cache.has(canal.id) && ticket.canalEliminado === true && ticket.cerradoPor === 'staff1', 'canal eliminado y ticket marcado (sin pisar quién lo cerró)', ticket);

    console.log('\n— Compatibilidad con tickets antiguos');
    const viejoCanal = crearCanal(client, A, { name: 'ticket-viejo' });
    await Ticket.create({ guildId: 'gA', canalId: viejoCanal.id, creadorId: 'u2', creadorNombre: 'usuario2', notasInternas: [{ contenido: 'nota vieja', autor: 'Admin' }] });
    await cargarCanalesTicket();
    const msgViejo = await viejoCanal.send({ content: 'antiguo' });
    msgViejo.author = { id: 'bot' };
    i = await ejecutar(interaccion({ tipo: 'boton', customId: 'reclamar_ticket', miembro: staff, guild: A, canal: viejoCanal, message: msgViejo }));
    const viejo = await Ticket.findOne({ canalId: viejoCanal.id });
    check(/tuyo/.test(ultimoTexto(i)) && viejo.mensajeControlId === msgViejo.id && msgViejo.payload.embeds, 'ticket antiguo: aprende su mensaje de control y lo actualiza', i.r);
    check(viejo.notasInternas[0].contenido === 'nota vieja' && viejo.notasInternas[0].fecha === undefined, 'notas antiguas se leen sin inventar fecha');

    console.log('\n— Slash commands generales');
    i = await ejecutar(interaccion({ tipo: 'comando', comando: 'panel', miembro: admin, guild: A, canal: general, opciones: {} }));
    check(/Panel de soporte publicado/.test(ultimoTexto(i)), '/panel', i.r);
    i = await ejecutar(interaccion({ tipo: 'comando', comando: 'config', miembro: admin, guild: A, canal: general, opciones: { sub: 'ver' } }));
    check(i.r[0][1].embeds?.[0].data.fields.length === 10 && i.r[0][1].embeds[0].data.fields.some(f => /inactividad/.test(f.name) && f.value === 'Desactivado'), '/config ver', i.r);
    i = await ejecutar(interaccion({ tipo: 'comando', comando: 'config', miembro: admin, guild: A, canal: general, opciones: { sub: 'limite', cantidad: 3 } }));
    invalidarConfig('gA');
    check(/hasta \*\*3\*\*/.test(ultimoTexto(i)), '/config limite', i.r);
    i = await ejecutar(interaccion({ tipo: 'comando', comando: 'config', miembro: admin, guild: A, canal: general, opciones: { sub: 'rol-staff', rol: { id: 'rolstaff', toString: () => '<@&rolstaff>' } } }));
    check(/ya no forma parte/.test(ultimoTexto(i)), '/config rol-staff alterna (quita)', i.r);
    i = await ejecutar(interaccion({ tipo: 'comando', comando: 'usuario', miembro: u1, guild: A, canal: general, opciones: { usuario: u2.user } }));
    check(/Solo el equipo/.test(ultimoTexto(i)), '/usuario de otro sin ser staff → denegado', i.r);
    i = await ejecutar(interaccion({ tipo: 'comando', comando: 'usuario', miembro: u1, guild: A, canal: general, opciones: {} }));
    check(i.r[0][1].embeds?.[0].data.fields[0].value === '1', '/usuario propio', i.r);
    i = await ejecutar(interaccion({ tipo: 'comando', comando: 'estadisticas', miembro: admin, guild: A, canal: general, opciones: {} }));
    check(i.r[1]?.[1].embeds?.[0].data.fields.length === 10, '/estadisticas', i.r);
    for (const c of ['ayuda', 'dado', 'moneda']) {
        i = await ejecutar(interaccion({ tipo: 'comando', comando: c, miembro: u1, guild: A, canal: general, opciones: {} }));
        check(i.r.length === 1 && !/❌/.test(ultimoTexto(i)), `/${c}`, i.r);
    }

    console.log('\n— Cierre automático por inactividad');
    const { revisarInactivos } = require(`${REPO}/utils/autoCierre.js`);
    const HORA = 60 * 60 * 1000;
    i = await ejecutar(interaccion({ tipo: 'comando', comando: 'config', miembro: admin, guild: A, canal: general, opciones: { sub: 'inactividad', horas: 24 } }));
    check(/tras \*\*24 h\*\*/.test(ultimoTexto(i)) && (await ServidorConfig.findOne({ guildId: 'gA' })).autoCierreHoras === 24, '/config inactividad', i.r);
    invalidarConfig('gA');
    const canalInactivo = crearCanal(client, A, { name: 'ticket-inactivo' });
    let inactivo = await Ticket.create({ guildId: 'gA', canalId: canalInactivo.id, creadorId: 'u1', creadorNombre: 'usuario1' });
    await cargarCanalesTicket();
    const escribir = (miembro, id) => messageCreate.execute(mensajeDiscord({ id, miembro, canal: canalInactivo, guild: A, contenido: '...' }), client);
    const avisosEn = (c) => [...c.mensajes.values()].filter(m => m.payload.embeds?.[0]?.data.title === '⏰ Ticket sin respuesta');

    let res0 = await revisarInactivos(client, new Date(Date.now() + 100 * HORA));
    check(res0.avisados === 0 && res0.cerrados === 0, 'si se espera al staff no se avisa ni se cierra', res0);
    await escribir(admin, 'i1');
    let base = Date.now();
    res0 = await revisarInactivos(client, new Date(base + 17 * HORA));
    check(res0.avisados === 0 && avisosEn(canalInactivo).length === 0, 'antes del 75 % del plazo no se avisa', res0);
    res0 = await revisarInactivos(client, new Date(base + 18 * HORA));
    const aviso = avisosEn(canalInactivo)[0];
    inactivo = await Ticket.findById(inactivo._id);
    check(res0.avisados === 1 && aviso?.payload.content === '<@u1>' && /<t:\d+:R>/.test(aviso.payload.embeds[0].data.description) && inactivo.avisoInactividad, 'al 75 % se avisa en el canal mencionando al usuario', { res0, aviso: aviso?.payload });
    res0 = await revisarInactivos(client, new Date(base + 20 * HORA));
    check(res0.avisados === 0 && res0.cerrados === 0 && avisosEn(canalInactivo).length === 1, 'el aviso no se repite', res0);
    await escribir(u1, 'i2');
    inactivo = await Ticket.findById(inactivo._id);
    check(inactivo.avisoInactividad === null && inactivo.esperando === 'staff', 'si el usuario contesta tras el aviso, la cuenta se reinicia', inactivo);
    res0 = await revisarInactivos(client, new Date(base + 30 * HORA));
    check(res0.avisados === 0 && res0.cerrados === 0, 'tras la respuesta del usuario ya no se cierra', res0);

    await escribir(admin, 'i3');
    base = Date.now();
    res0 = await revisarInactivos(client, new Date(base + 18 * HORA));
    check(res0.avisados === 1 && avisosEn(canalInactivo).length === 2, 'nueva respuesta del staff → nuevo aviso', res0);
    res0 = await revisarInactivos(client, new Date(base + 23 * HORA));
    check(res0.cerrados === 0, 'no se cierra antes de cumplirse el plazo', res0);
    res0 = await revisarInactivos(client, new Date(base + 24 * HORA));
    await esperar(300);
    inactivo = await Ticket.findById(inactivo._id);
    check(res0.cerrados === 1 && inactivo.estado === 'Cerrado' && inactivo.cerradoPor === 'Sistema (inactividad)' && inactivo.motivoCierre === 'Cerrado automáticamente por inactividad', 'al cumplirse el plazo se cierra con cerrarTicket', inactivo);
    check(client.dms.some(d => d.id === 'u1' && /inactividad/.test(JSON.stringify(d.p))), 'el usuario recibe el resumen del cierre por DM');

    const canalTardio = crearCanal(client, A, { name: 'ticket-tardio' });
    let tardio = await Ticket.create({ guildId: 'gA', canalId: canalTardio.id, creadorId: 'u2', creadorNombre: 'usuario2', esperando: 'usuario', ultimaActividad: new Date(Date.now() - 100 * HORA) });
    res0 = await revisarInactivos(client);
    tardio = await Ticket.findById(tardio._id);
    check(res0.avisados === 1 && res0.cerrados === 0 && tardio.estado === 'Abierto', 'con el plazo ya vencido se avisa antes de cerrar', res0);
    res0 = await revisarInactivos(client, new Date(Date.now() + 5 * HORA));
    check(res0.cerrados === 0, 'tras avisar se deja al menos el 25 % del plazo para responder', res0);
    i = await ejecutar(interaccion({ tipo: 'comando', comando: 'config', miembro: admin, guild: A, canal: general, opciones: { sub: 'inactividad', horas: 0 } }));
    res0 = await revisarInactivos(client, new Date(Date.now() + 100 * HORA));
    check(/desactivado/.test(ultimoTexto(i)) && res0.cerrados === 0 && (await Ticket.findById(tardio._id)).estado === 'Abierto', 'con 0 horas no se cierra nada', { res0, r: i.r });
    invalidarConfig('gA');

    console.log('\n— Aviso "Bot actualizado"');
    const { anunciarActualizacion, version } = require(`${REPO}/utils/anuncioActualizacion.js`);
    const T = crearServidor(client, { id: 'gT', name: 'TOKYTO Gaming' });
    crearMiembro(T, 't1', 'tokyto1');
    crearMiembro(T, 't2', 'tokyto2', { dmsCerrados: true });
    crearMiembro(T, 'tbot', 'otrobot', { bot: true });
    crearCanal(client, T, { name: 'reglas' });
    const generalT = crearCanal(client, T, { name: '💬・general' });
    const dmsAntes = client.dms.length;
    const enviadosAntes = client.enviados.length;
    let res = await anunciarActualizacion(client, { pausaMs: 0 });
    const dmsAviso = client.dms.slice(dmsAntes);
    check(dmsAviso.length === 1 && dmsAviso[0].id === 't1' && /Bot actualizado/.test(dmsAviso[0].p), 'DM a los miembros del servidor Tokyto (no a bots ni a otros servidores)', dmsAviso);
    const publicados = client.enviados.slice(enviadosAntes);
    check(publicados.length === 1 && publicados[0].canal === generalT.id && /Bot actualizado/.test(publicados[0].payload.content), 'si alguien tiene los DMs cerrados se publica en el general', publicados);
    check(res.gT?.enviados === 1 && res.gT?.fallidos === 1 && !res.gA, 'resumen correcto y solo en el servidor Tokyto', res);
    check((await ServidorConfig.findOne({ guildId: 'gT' })).ultimaVersionAnunciada === version, 'versión anunciada guardada');
    check(await Log.exists({ guildId: 'gT', accion: new RegExp('Bot actualizado') }), 'queda registrado en la auditoría');
    res = await anunciarActualizacion(client, { pausaMs: 0 });
    check(client.dms.length === dmsAntes + 1 && client.enviados.length === enviadosAntes + 1 && !res.gT, 'no se repite al reiniciar con la misma versión');

    const cliente2 = crearCliente();
    const S = crearServidor(cliente2, { id: 'gS', name: 'Comunidad Sokyo' });
    crearServidor(cliente2, { id: 'gO', name: 'Otro servidor' });
    crearMiembro(S, 's1', 'sokyo1');
    crearCanal(cliente2, S, { name: 'general' });
    res = await anunciarActualizacion(cliente2, { pausaMs: 0 });
    check(res.gS?.enviados === 1 && res.gS.publicadoEn === null && !res.gO && cliente2.enviados.length === 0, 'tolera erratas en el nombre (Tokyto ≈ Sokyo) y si todos reciben el DM no publica en el general', res);

    console.log(`\n${ok} correctas, ${fallos} fallidas`);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error('ERROR FATAL', e); process.exit(2); });
