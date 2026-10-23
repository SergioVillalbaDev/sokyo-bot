// Pruebas end-to-end de la API: necesitan un MongoDB (MONGO_URI_TEST, por defecto mongodb://127.0.0.1:27017).
const path = require('path');
const REPO = path.join(__dirname, '..');
const MONGO = (process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017').replace(/\/$/, '');
process.env.API_KEY = 'clave-de-prueba';
process.env.JWT_SECRET = 'secreto-de-prueba';
process.env.PORT = process.env.PORT_TEST || '3999';
process.env.FRONTEND_URL = 'https://panel.ejemplo.com';

const mongoose = require('mongoose');
const { ChannelType } = require('discord.js');
const { firmarToken } = require(`${REPO}/utils/auth.js`);
const { cargarCanalesTicket, esCanalTicket } = require(`${REPO}/utils/ticketCache.js`);
const { crearCliente, crearServidor, crearMiembro, crearCanal } = require('./fakeDiscord.js');

let fallos = 0, ok = 0;
const check = (cond, nombre, extra) => {
    if (cond) { ok++; console.log(`  ✔ ${nombre}`); }
    else { fallos++; console.log(`  ✘ ${nombre}`, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ''); }
};
const esperar = (ms) => new Promise(r => setTimeout(r, ms));

const BASE = `http://127.0.0.1:${process.env.PORT}`;
async function api(ruta, { metodo = 'GET', token, clave, body, crudo } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (clave) headers['x-api-key'] = clave;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(BASE + ruta, { method: metodo, headers, body: crudo ?? (body !== undefined ? JSON.stringify(body) : undefined) });
    const tipo = res.headers.get('content-type') || '';
    const datos = tipo.includes('json') ? await res.json() : await res.text();
    return { status: res.status, datos, headers: res.headers };
}

(async () => {
    await mongoose.connect(`${MONGO}/sokyo_test_api`);
    await mongoose.connection.dropDatabase();
    for (const m of ['Ticket', 'Mensaje', 'Log', 'ServidorConfig']) await require(`${REPO}/models/${m}.js`).syncIndexes();

    const client = crearCliente();
    const A = crearServidor(client, { id: 'guildA', name: 'Servidor A' });
    const B = crearServidor(client, { id: 'guildB', name: 'Servidor B' });
    crearMiembro(A, 'admin1', 'admin1', { admin: true });
    crearMiembro(A, 'u1', 'usuario.uno');
    crearMiembro(A, 'staff1', 'staff_uno', { roles: ['rolstaff'] });
    crearMiembro(B, 'adminB', 'adminB', { admin: true });
    const canalSoporte = crearCanal(client, A, { name: 'soporte' });
    crearCanal(client, A, { name: 'Tickets', type: ChannelType.GuildCategory });

    const servidor = require(`${REPO}/api/server.js`)(client);
    await esperar(300);

    const tk = (id, username) => firmarToken({ id, username, avatar: null }, process.env.JWT_SECRET);
    const T = { admin: tk('admin1', 'admin1'), u1: tk('u1', 'usuario.uno'), staff: tk('staff1', 'staff_uno'), adminB: tk('adminB', 'adminB') };
    const CLAVE = process.env.API_KEY;

    console.log('\n— Autenticación');
    check((await api('/api/estado')).status === 200, 'estado público');
    check((await api('/api/yo')).status === 401, 'sin sesión → 401');
    check((await api('/api/yo', { token: 'basura.firma' })).status === 401, 'token falso → 401');
    check((await api('/api/yo', { token: tk('x', 'x').slice(0, -2) + 'aa' })).status === 401, 'firma manipulada → 401');
    let r = await api('/api/yo', { clave: CLAVE });
    check(r.status === 200 && r.datos.servidores.length === 2 && r.datos.tipo === 'apikey', 'clave de API ve todos los servidores', r.datos);
    r = await api('/api/yo', { token: T.u1 });
    check(r.status === 200 && r.datos.servidores.length === 0, 'usuario normal no es staff de nada', r.datos);
    r = await api('/api/yo', { token: T.staff });
    check(r.datos.servidores.length === 0, 'rol de staff aún sin configurar');
    check((await api('/api/servidores/guildA', { token: T.u1 })).status === 403, 'usuario normal no entra al panel → 403');
    check((await api('/api/servidores/nope', { clave: CLAVE })).status === 404, 'servidor inexistente → 404');
    check((await api('/api/auth/config')).datos.apiKey === true, 'auth/config informa de la clave');

    console.log('\n— Configuración');
    r = await api('/api/servidores/guildA', { token: T.admin });
    check(r.status === 200 && r.datos.config.motivos.length === 3 && r.datos.config.premiumActivo === false, 'config por defecto creada al vuelo', r.datos);
    r = await api('/api/servidores/guildA/config', { metodo: 'PUT', token: T.admin, body: { motivos: [] } });
    check(r.status === 400 && /al menos una/.test(r.datos.error), 'no se pueden dejar 0 categorías', r.datos);
    r = await api('/api/servidores/guildA/config', { metodo: 'PUT', token: T.admin, body: { urgencias: [{ nombre: 'Urgente', color: '#ff0000', nivel: 4 }] } });
    check(r.status === 400 && /usa la urgencia/.test(r.datos.error), 'no se puede borrar una urgencia en uso', r.datos);
    r = await api('/api/servidores/guildA/config', { metodo: 'PUT', token: T.admin, body: { colorPanel: 'rojo' } });
    check(r.status === 400, 'color inválido → 400');
    r = await api('/api/servidores/guildA/config', { metodo: 'PUT', token: T.admin, body: { rolesStaff: ['inventado'] } });
    check(r.status === 400, 'rol inexistente → 400');
    r = await api('/api/servidores/guildA/config', { metodo: 'PUT', token: T.admin, body: { rolesStaff: ['rolstaff'], modulos: { logsMiembros: false }, maxTicketsPorUsuario: 1 } });
    check(r.status === 200 && r.datos.config.rolesStaff[0] === 'rolstaff' && r.datos.config.modulos.logsMiembros === false && r.datos.config.modulos.valoraciones === true, 'roles de staff y módulos guardados', r.datos);
    check(r.datos.config.autoCierreHoras === 0, 'cierre por inactividad desactivado por defecto', r.datos.config);
    for (const horas of [-1, 721, 1.5, 'mucho']) {
        r = await api('/api/servidores/guildA/config', { metodo: 'PUT', token: T.admin, body: { autoCierreHoras: horas } });
        check(r.status === 400 && /entre 0 \(desactivado\) y 720/.test(r.datos.error), `cierre por inactividad = ${JSON.stringify(horas)} → 400`, r.datos);
    }
    r = await api('/api/servidores/guildA/config', { metodo: 'PUT', token: T.admin, body: { autoCierreHoras: 48 } });
    check(r.status === 200 && r.datos.config.autoCierreHoras === 48, 'cierre por inactividad guardado', r.datos);
    r = await api('/api/servidores/guildA/config', { metodo: 'PUT', token: T.admin, body: { autoCierreHoras: 0 } });
    check(r.status === 200 && r.datos.config.autoCierreHoras === 0, 'cierre por inactividad desactivable con 0', r.datos);
    r = await api('/api/yo', { token: T.staff });
    check(r.datos.servidores.length === 1 && r.datos.servidores[0].id === 'guildA', 'el rol de staff da acceso al panel', r.datos);
    r = await api('/api/servidores/guildA/discord', { token: T.staff });
    check(r.status === 200 && !r.datos.roles.some(x => x.id === 'guildA') && r.datos.categorias.length === 1 && r.datos.canales.length >= 1, 'roles y canales del servidor', r.datos);

    console.log('\n— Panel de soporte');
    r = await api('/api/servidores/guildA/panel', { metodo: 'POST', token: T.admin, body: { canalId: canalSoporte.id } });
    check(r.status === 200 && r.datos.mensajeId, 'publicar panel', r.datos);
    const msgPanel = canalSoporte.mensajes.get(r.datos.mensajeId);
    check(msgPanel.payload.components[0].components[0].data.custom_id === 'create_ticket', 'el panel tiene el botón create_ticket');
    r = await api('/api/servidores/guildA/config', { metodo: 'PUT', token: T.admin, body: { mensajeSoporteTitulo: '🎫 Nuevo título', textoBoton: 'Pedir ayuda' } });
    check(r.datos.panelActualizado === true, 'cambiar textos actualiza el panel publicado', r.datos);
    check(msgPanel.payload.embeds[0].data.title === '🎫 Nuevo título' && msgPanel.payload.components[0].components[0].data.label === 'Pedir ayuda', 'el mensaje del panel refleja los textos nuevos');

    console.log('\n— Portal: crear ticket');
    r = await api('/api/portal/servidores', { token: T.u1 });
    check(r.status === 200 && r.datos.length === 1 && r.datos[0].motivos.length === 3, 'portal lista solo servidores donde es miembro', r.datos);
    check((await api('/api/portal/tickets', { clave: CLAVE })).status === 403, 'portal no admite clave de API');
    r = await api('/api/portal/tickets', { metodo: 'POST', token: T.u1, body: { guildId: 'guildA', motivo: 'Inventado', asunto: 'x', descripcion: 'y' } });
    check(r.status === 400, 'categoría inexistente → 400', r.datos);
    r = await api('/api/portal/tickets', { metodo: 'POST', token: T.u1, body: { guildId: 'guildA', motivo: 'Reportar Usuario', asunto: 'Me insultan', descripcion: 'En el canal general' } });
    check(r.status === 201 && r.datos.numero === 1 && r.datos.prioridad === 'Alta' && r.datos.notasInternas === undefined, 'ticket creado desde el portal (nº 1)', r.datos);
    const canalId = r.datos.canalId;
    const canalTicket = client.channels.cache.get(canalId);
    check(canalTicket && /^ticket-000\d-usuario-uno$/.test(canalTicket.name), 'nombre del canal con número y slug', canalTicket?.name);
    check(canalTicket.overwrites.get('rolstaff') && canalTicket.overwrites.get('guildA').deny, 'permisos: staff ve, @everyone no');
    check(esCanalTicket(canalId), 'canal registrado en la caché de tickets');
    const control = [...canalTicket.mensajes.values()][0];
    check(control.payload.allowedMentions.roles.includes('rolstaff'), 'menciona al rol de staff al abrir');
    r = await api('/api/portal/tickets', { metodo: 'POST', token: T.u1, body: { guildId: 'guildA', motivo: 'Donaciones', asunto: 'Otro', descripcion: 'z' } });
    check(r.status === 409 && /Ya tienes un ticket/.test(r.datos.error), 'límite de 1 ticket abierto', r.datos);

    console.log('\n— Conversación y notas');
    r = await api(`/api/portal/tickets/${canalId}/mensajes`, { metodo: 'POST', token: T.u1, body: { contenido: '@everyone ayuda porfa' } });
    check(r.status === 201, 'usuario escribe desde el portal', r.datos);
    const ultimo = client.enviados[client.enviados.length - 1].payload;
    check(Array.isArray(ultimo.allowedMentions.parse) && ultimo.allowedMentions.parse.length === 0 && ultimo.embeds, 'sin menciones masivas (embed)');
    r = await api(`/api/portal/tickets/${canalId}/mensajes`, { metodo: 'POST', token: T.u1, body: { contenido: 'x'.repeat(2001) } });
    check(r.status === 400, 'mensaje > 2000 caracteres → 400');
    r = await api(`/api/servidores/guildA/tickets/${canalId}/mensajes`, { metodo: 'POST', token: T.staff, body: { contenido: 'Hola, te ayudo' } });
    check(r.status === 201 && r.datos.esStaff === true && r.datos.usuario === 'staff_uno', 'staff responde con su nombre', r.datos);
    r = await api(`/api/servidores/guildA/tickets/${canalId}`, { token: T.staff });
    check(r.datos.esperando === 'usuario' && r.datos.primeraRespuestaStaff, 'actividad: ahora espera al usuario y hay 1ª respuesta', r.datos);
    r = await api(`/api/servidores/guildA/tickets/${canalId}/notas`, { metodo: 'POST', token: T.staff, body: { contenido: 'Nota secreta' } });
    check(r.status === 201 && r.datos.notasInternas[0].fecha && r.datos.notasInternas[0].autor === 'staff_uno', 'nota interna con fecha y autor', r.datos.notasInternas);
    const notaId = r.datos.notasInternas[0]._id;
    r = await api(`/api/portal/tickets/${canalId}`, { token: T.u1 });
    check(r.status === 200 && r.datos.notasInternas === undefined, 'el portal NO filtra las notas internas al usuario', Object.keys(r.datos));
    r = await api('/api/portal/tickets', { token: T.u1 });
    check(r.datos.length === 1 && r.datos[0].notasInternas === undefined && r.datos[0].servidor.nombre === 'Servidor A', 'lista del portal sin notas y con servidor');
    r = await api(`/api/portal/tickets/${canalId}/mensajes`, { token: T.u1 });
    check(r.status === 200 && r.datos.length === 2, 'usuario ve la conversación', r.datos.length);
    check((await api(`/api/portal/tickets/${canalId}/mensajes`, { token: T.staff })).status === 404, 'otro usuario no ve el ticket en el portal');

    console.log('\n— Gestión del staff');
    r = await api('/api/servidores/guildA/tickets?q=%231', { token: T.staff });
    check(r.datos.length === 1, 'búsqueda por número #1', r.datos.length);
    r = await api('/api/servidores/guildA/tickets?q=insultan', { token: T.staff });
    check(r.datos.length === 1 && r.datos[0].notasInternas === undefined, 'búsqueda por texto, sin notas en la lista');
    r = await api(`/api/servidores/guildA/tickets/${canalId}/asignacion`, { metodo: 'PUT', token: T.staff, body: { accion: 'reclamar' } });
    check(r.status === 200 && r.datos.asignadoA === 'staff1' && r.datos.participantes.some(p => p.id === 'staff1' && p.rol === 'Staff'), 'reclamar ticket', r.datos);
    r = await api(`/api/servidores/guildA/tickets/${canalId}/asignacion`, { metodo: 'PUT', token: T.admin, body: { accion: 'reclamar' } });
    check(r.status === 409 && /staff_uno/.test(r.datos.error), 'no se puede reclamar uno ya asignado', r.datos);
    r = await api(`/api/servidores/guildA/tickets/${canalId}/asignacion`, { metodo: 'PUT', clave: CLAVE, body: { accion: 'reclamar' } });
    check(r.status === 400, 'reclamar con clave de API pide login de Discord');
    r = await api(`/api/servidores/guildA/tickets/${canalId}/prioridad`, { metodo: 'PUT', token: T.staff, body: { prioridad: 'Urgente' } });
    check(r.status === 200 && r.datos.prioridad === 'Urgente', 'cambiar prioridad');
    check(control.payload.embeds[0].data.fields.some(f => f.value === 'Urgente'), 'el embed del ticket se actualiza con la prioridad');
    r = await api(`/api/servidores/guildA/tickets/${canalId}/prioridad`, { metodo: 'PUT', token: T.staff, body: { prioridad: 'Mondongo' } });
    check(r.status === 400, 'prioridad inexistente → 400');
    check((await api(`/api/servidores/guildB/tickets/${canalId}`, { token: T.adminB })).status === 404, 'staff de otro servidor no accede al ticket (aislamiento)');
    check((await api(`/api/servidores/guildA/tickets/${canalId}`, { token: T.adminB })).status === 403, 'admin de B no entra en A');

    console.log('\n— Cerrar, valorar, reabrir');
    r = await api(`/api/servidores/guildA/tickets/${canalId}/cerrar`, { metodo: 'PUT', token: T.staff, body: { motivo: 'Resuelto' } });
    check(r.status === 200 && r.datos.estado === 'Cerrado' && r.datos.cerradoPor === 'staff_uno' && r.datos.motivoCierre === 'Resuelto', 'cerrar con motivo', r.datos);
    await esperar(300);
    const archivo = A.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.startsWith('🗄️'));
    check(archivo && canalTicket.parentId === archivo.id, 'canal movido a la categoría de archivo');
    check(canalTicket.overwrites.get('u1')?.SendMessages === false, 'el creador queda en solo lectura');
    check(canalTicket.name.startsWith('cerrado-'), 'canal renombrado a cerrado-', canalTicket.name);
    check(client.dms.length === 1 && client.dms[0].p.components.length === 1 && client.dms[0].p.files.length === 1, 'DM con estrellas y transcript', client.dms.length);
    check(control.payload.components[0].components[0].data.custom_id === 'reopen_ticket', 'botones del ticket pasan a Reabrir/Transcript/Eliminar');
    r = await api(`/api/servidores/guildA/tickets/${canalId}/cerrar`, { metodo: 'PUT', token: T.staff });
    check(r.status === 409, 'cerrar dos veces → 409 (sin DM duplicado)');
    check(client.dms.length === 1, 'no se envió otro DM');
    r = await api(`/api/portal/tickets/${canalId}/mensajes`, { metodo: 'POST', token: T.u1, body: { contenido: 'hola?' } });
    check(r.status === 409, 'no se puede escribir en un ticket cerrado');
    r = await api(`/api/portal/tickets/${canalId}/valoracion`, { metodo: 'POST', token: T.u1, body: { valoracion: 5, comentario: 'Genial' } });
    check(r.status === 200 && r.datos.valoracionCSAT === 5 && r.datos.comentarioCSAT === 'Genial', 'valorar desde el portal', r.datos);
    r = await api(`/api/portal/tickets/${canalId}/valoracion`, { metodo: 'POST', token: T.u1, body: { valoracion: 9 } });
    check(r.status === 400, 'valoración fuera de rango → 400');

    r = await api('/api/servidores/guildA/resumen', { token: T.staff });
    check(r.status === 200 && r.datos.cerrados === 1 && r.datos.abiertos === 0 && r.datos.valoracionMedia === 5 && r.datos.porDia.length === 14, 'resumen del dashboard', r.datos);
    check(r.datos.porDia[13].abiertos === 1 && r.datos.porDia[13].cerrados === 1 && r.datos.porStaff[0].nombre === 'staff_uno', 'gráfica de hoy y ranking de staff', r.datos.porDia[13]);
    r = await api('/api/servidores/guildA/usuarios', { token: T.staff });
    check(r.datos.length === 1 && r.datos[0].ratingMedio === 5 && r.datos[0].totalTickets === 1, 'estadísticas de usuarios', r.datos);
    r = await api('/api/servidores/guildA/logs?categoria=Tickets', { token: T.staff });
    check(r.status === 200 && r.datos.limite === 50 && r.datos.logs.length >= 5 && r.datos.logs.every(l => l.categoria === 'Tickets'), 'logs filtrados por categoría en el servidor', r.datos.logs?.map(l => l.accion));
    r = await api('/api/servidores/guildB/logs', { token: T.adminB });
    check(r.datos.logs.length === 0, 'los logs de A no aparecen en B');

    r = await api(`/api/servidores/guildA/tickets/${canalId}/reabrir`, { metodo: 'PUT', token: T.admin });
    check(r.status === 200 && r.datos.estado === 'Abierto' && r.datos.cerradoPor === null, 'reabrir', r.datos);
    check(canalTicket.overwrites.get('u1')?.SendMessages === true && canalTicket.parentId === null, 'reabrir devuelve permisos y lo saca del archivo');
    r = await api(`/api/servidores/guildA/tickets/${canalId}/reabrir`, { metodo: 'PUT', token: T.admin });
    check(r.status === 409, 'reabrir uno abierto → 409');

    r = await api(`/api/servidores/guildA/tickets/${canalId}/transcript`, { token: T.staff });
    check(r.status === 200 && /attachment; filename="transcript-0001-usuario-uno.html"/.test(r.headers.get('content-disposition')) && r.datos.includes('Hola, te ayudo') && !r.datos.includes('<script'), 'transcript HTML descargable', r.headers.get('content-disposition'));

    r = await api(`/api/servidores/guildA/tickets/${canalId}/notas/${notaId}`, { metodo: 'DELETE', token: T.staff });
    check(r.status === 200 && r.datos.notasInternas.length === 0, 'borrar nota');
    r = await api(`/api/servidores/guildA/tickets/${canalId}/notas/abc`, { metodo: 'DELETE', token: T.staff });
    check(r.status === 404, 'borrar nota inexistente → 404');

    r = await api(`/api/servidores/guildA/tickets/${canalId}/visibilidad`, { metodo: 'PUT', token: T.staff, body: { visible: false } });
    check(r.datos.visibleWeb === false, 'ocultar del panel');
    check((await api('/api/servidores/guildA/tickets', { token: T.staff })).datos.length === 0, 'oculto no sale en la lista normal');
    check((await api('/api/servidores/guildA/tickets?ocultos=1', { token: T.staff })).datos.length === 1, 'sale en la lista de ocultos');

    console.log('\n— Canal borrado en Discord');
    await canalTicket.delete();
    const { marcarCanalEliminado } = require(`${REPO}/utils/ticketManager.js`);
    await marcarCanalEliminado(client, canalId);
    r = await api(`/api/servidores/guildA/tickets/${canalId}`, { token: T.staff });
    check(r.datos.canalEliminado === true && r.datos.estado === 'Cerrado' && r.datos.canalExiste === false, 'ticket con canal borrado queda cerrado', r.datos);
    r = await api(`/api/servidores/guildA/tickets/${canalId}/reabrir`, { metodo: 'PUT', token: T.staff });
    check(r.status === 410, 'no se puede reabrir si el canal ya no existe');
    r = await api('/api/portal/tickets', { metodo: 'POST', token: T.u1, body: { guildId: 'guildA', motivo: 'Donaciones', asunto: 'Nuevo', descripcion: 'Otra duda' } });
    check(r.status === 201 && r.datos.numero === 2, 'tras cerrarse puede abrir otro (nº correlativo 2)', r.datos);
    await cargarCanalesTicket();
    check(!esCanalTicket(canalId) && esCanalTicket(r.datos.canalId), 'caché de canales recargada');

    console.log('\n— Robustez');
    r = await api('/api/servidores/guildA/config', { metodo: 'PUT', token: T.admin, crudo: '{malo', body: undefined });
    check(r.status === 400 || r.status === 415, 'JSON inválido → error controlado', r);
    r = await fetch(BASE + '/api/servidores/guildA/config', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${T.admin}` }, body: '{malo' });
    check(r.status === 400 && (await r.json()).error, 'JSON malformado → 400 en JSON');
    check((await api('/api/no-existe', { clave: CLAVE })).status === 404, 'ruta desconocida → 404 JSON');
    let ultimoStatus = 0;
    for (let i = 0; i < 7; i++) ultimoStatus = (await api(`/api/portal/tickets/${r.datos?.canalId || 'x'}/mensajes`, { metodo: 'POST', token: T.u1, body: { contenido: `spam ${i}` } })).status;
    check(ultimoStatus === 429, 'limitador de mensajes → 429', ultimoStatus);

    console.log(`\n${ok} correctas, ${fallos} fallidas`);
    servidor.close();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    process.exit(fallos ? 1 : 0);
})().catch(async (e) => { console.error('ERROR FATAL', e); process.exit(2); });
