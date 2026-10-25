// ============================================================================
// Rutas de gestión de CATEGORÍAS y CANALES del servidor (texto, voz, anuncios,
// foro, escenario), con las opciones que permite Discord: tema, NSFW, modo
// lento, bitrate, límite de usuarios, posición y permisos por rol/canal.
// El middleware global de server.js ya acota el acceso por /config/:guildId.
// ============================================================================
const express = require('express');
const { ChannelType, PermissionsBitField } = require('discord.js');

// Tipos de canal que el panel puede crear/editar (clave en español -> tipo real).
const TIPOS = {
    texto: ChannelType.GuildText,
    voz: ChannelType.GuildVoice,
    anuncios: ChannelType.GuildAnnouncement,
    foro: ChannelType.GuildForum,
    escenario: ChannelType.GuildStageVoice,
};
const TIPO_DE_VALOR = Object.fromEntries(Object.entries(TIPOS).map(([k, v]) => [v, k]));

// Canales que Discord coloca en la lista del servidor: todos menos categorías e
// hilos (los de tipos que el panel no edita, como los de medios, salen como 'otro').
const HILOS = new Set([ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread]);
const esOrdenable = (c) => !!c && c.type !== ChannelType.GuildCategory && !HILOS.has(c.type);
// Orden en que Discord los enseña: dentro de cada categoría, primero los de texto
// y después los de voz (cada grupo por su posición; a igualdad, el más antiguo).
const VOZ = new Set([ChannelType.GuildVoice, ChannelType.GuildStageVoice]);
const ordenDiscord = (a, b) => (VOZ.has(a.type) - VOZ.has(b.type))
    || (a.rawPosition - b.rawPosition)
    || (a.id.length - b.id.length) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// Permisos con sentido para un permiso "por canal" (overwrite), agrupados por
// contexto. Es un catálogo curado (no los ~40 flags de Discord), igual que
// PERMISOS_CATALOGO hace para los roles.
const PERMISOS_CANAL = [
    { grupo: 'General', permisos: ['ViewChannel', 'ManageChannels', 'ManageRoles'] },
    { grupo: 'Texto', permisos: ['SendMessages', 'ReadMessageHistory', 'EmbedLinks', 'AttachFiles', 'AddReactions', 'ManageMessages', 'MentionEveryone', 'UseApplicationCommands', 'SendMessagesInThreads', 'CreatePublicThreads'] },
    { grupo: 'Voz', permisos: ['Connect', 'Speak', 'Stream', 'UseVAD', 'PrioritySpeaker', 'MuteMembers', 'DeafenMembers', 'MoveMembers'] },
];
const FLAGS_VALIDOS = new Set(PERMISOS_CANAL.flatMap((g) => g.permisos));

// `exigeArea` (de server.js): los cambios piden el área "config" de Acceso al
// panel, la misma que muestra "Categorías y canales" en el menú.
const pasar = () => (req, res, next) => next();
module.exports = ({ client, exigeArea = pasar }) => {
    const router = express.Router();
    const puedeEditar = exigeArea('config');

    // Saca del body una lista de overwrites {id, allow, deny} ya validada
    // (solo flags conocidos, máximo 50 entradas para no reventar la API).
    function construirOverwrites(lista) {
        if (!Array.isArray(lista)) return undefined;
        const limpiar = (arr) => (Array.isArray(arr) ? arr.filter((f) => FLAGS_VALIDOS.has(f)) : []);
        return lista
            .filter((o) => o && o.id)
            .slice(0, 50)
            .map((o) => ({ id: String(o.id), allow: limpiar(o.allow), deny: limpiar(o.deny) }));
    }

    // Overwrites finales al guardar desde el panel: los de ROL que se editan ahí,
    // sin tocar los de MIEMBRO (p. ej. el acceso del creador de un ticket o del
    // dueño de una sala de voz temporal), que gestionan otros sistemas del bot.
    function overwritesConLosDeMiembro(canalOCategoria, listaRoles) {
        const nuevos = construirOverwrites(listaRoles) || [];
        const idsNuevos = new Set(nuevos.map((o) => o.id));
        const miembrosPrevios = canalOCategoria.permissionOverwrites.cache
            .filter((ov) => ov.type === 1 && !idsNuevos.has(ov.id))
            .map((ov) => ({ id: ov.id, allow: ov.allow.toArray(), deny: ov.deny.toArray() }));
        return [...nuevos, ...miembrosPrevios];
    }
    // ¿Son los mismos permisos que ya tiene? (para no mandar a Discord lo que no cambia)
    const firmaPermisos = (lista) => lista
        .map((o) => `${o.id}:${PermissionsBitField.resolve(o.allow)}:${PermissionsBitField.resolve(o.deny)}`)
        .sort().join('|');
    const mismosPermisos = (canalOCategoria, lista) => firmaPermisos(lista)
        === firmaPermisos(canalOCategoria.permissionOverwrites.cache.map((ov) => ({ id: ov.id, allow: ov.allow.bitfield, deny: ov.deny.bitfield })));

    // Discord solo deja cambiar el NOMBRE (o el tema) de un mismo canal 2 veces
    // cada 10 minutos. Si se pasa, discord.js deja la petición esperando hasta 10
    // minutos y el panel se quedaba en «Guardando…». Se lleva la cuenta de los
    // cambios de nombre hechos desde aquí para avisar antes con el tiempo que falta.
    const VENTANA_NOMBRE = 10 * 60 * 1000;
    const cambiosDeNombre = new Map(); // id del canal -> [instantes]
    function esperaParaRenombrar(id) {
        const ahora = Date.now();
        const recientes = (cambiosDeNombre.get(id) || []).filter((t) => ahora - t < VENTANA_NOMBRE);
        cambiosDeNombre.set(id, recientes);
        return recientes.length >= 2 ? recientes[0] + VENTANA_NOMBRE - ahora : 0;
    }
    const anotarCambioDeNombre = (id) => cambiosDeNombre.set(id, [...(cambiosDeNombre.get(id) || []), Date.now()]);

    // Aplica en Discord, en UNA sola petición, solo lo que cambia. Si Discord la
    // retiene (su límite de cambios), se responde igual a los pocos segundos: el
    // cambio se aplica solo en cuanto Discord lo permita. Devuelve el aviso para
    // el panel (null si todo ha ido normal).
    const ESPERA_MAXIMA = Number(process.env.CANALES_ESPERA_MS) || 8000;
    async function guardarEnDiscord(canal, cambios) {
        let aviso = null;
        const tocaNombre = cambios.name !== undefined || cambios.topic !== undefined;
        if (tocaNombre) {
            const espera = esperaParaRenombrar(canal.id);
            if (espera > 0) {
                delete cambios.name; delete cambios.topic;
                aviso = { aviso: 'limite_nombre', minutos: Math.max(1, Math.ceil(espera / 60000)) };
            }
        }
        if (!Object.keys(cambios).length) return aviso;
        if (cambios.name !== undefined || cambios.topic !== undefined) anotarCambioDeNombre(canal.id);
        const peticion = canal.edit(cambios);
        let temporizador;
        const plazo = new Promise((resolve) => { temporizador = setTimeout(() => resolve('en-cola'), ESPERA_MAXIMA); });
        const resultado = await Promise.race([peticion.then(() => 'hecho'), plazo]).finally(() => clearTimeout(temporizador));
        if (resultado === 'en-cola') {
            peticion.catch((e) => console.error(`Cambio pendiente en Discord (canal ${canal.id}):`, e.message));
            return { aviso: 'en_cola' };
        }
        return aviso;
    }

    // Overwrites de un canal/categoría en formato panel (con nombre para mostrar).
    function serializarOverwrites(canal, guild) {
        return canal.permissionOverwrites.cache.map((ov) => ({
            id: ov.id,
            nombre: ov.id === guild.id
                ? '@everyone'
                : (guild.roles.cache.get(ov.id)?.name || guild.members.cache.get(ov.id)?.displayName || ov.id),
            tipo: ov.type === 0 ? 'rol' : 'miembro',
            allow: ov.allow.toArray(),
            deny: ov.deny.toArray(),
        }));
    }

    function serializarCanal(canal, guild) {
        return {
            id: canal.id,
            nombre: canal.name,
            tipo: TIPO_DE_VALOR[canal.type] || 'otro',
            categoriaId: canal.parentId,
            posicion: canal.position,
            topic: canal.topic || null,
            nsfw: !!canal.nsfw,
            slowmode: canal.rateLimitPerUser || 0,
            bitrate: canal.bitrate || null,
            userLimit: canal.userLimit || null,
            overwrites: serializarOverwrites(canal, guild),
        };
    }

    function serializarCategoria(categoria, guild) {
        return {
            id: categoria.id,
            nombre: categoria.name,
            posicion: categoria.position,
            overwrites: serializarOverwrites(categoria, guild),
            canales: guild.channels.cache
                .filter((c) => c.parentId === categoria.id && esOrdenable(c))
                .sort(ordenDiscord)
                .map((c) => serializarCanal(c, guild)),
        };
    }

    // Catálogo de permisos por canal (para pintar los toggles del editor).
    router.get('/servidor/permisos-canal', (req, res) => res.json(PERMISOS_CANAL));

    // Árbol completo: categorías con sus canales + los canales sin categoría.
    router.get('/config/:guildId/canales/estructura', async (req, res) => {
        try {
            const guild = client.guilds.cache.get(req.params.guildId);
            if (!guild) return res.json({ categorias: [], sinCategoria: [] });

            const categorias = guild.channels.cache
                .filter((c) => c.type === ChannelType.GuildCategory)
                .sort(ordenDiscord)
                .map((c) => serializarCategoria(c, guild));

            const sinCategoria = guild.channels.cache
                .filter((c) => !c.parentId && esOrdenable(c))
                .sort(ordenDiscord)
                .map((c) => serializarCanal(c, guild));

            res.json({ categorias, sinCategoria });
        } catch (error) {
            console.error('Error al obtener la estructura de canales:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    });

    // Crear una categoría.
    router.post('/config/:guildId/canales/categorias', puedeEditar, async (req, res) => {
        try {
            const guild = client.guilds.cache.get(req.params.guildId);
            if (!guild) return res.status(404).json({ error: 'Servidor no encontrado' });
            const nombre = String(req.body.nombre || '').trim().slice(0, 100);
            if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });

            const categoria = await guild.channels.create({
                name: nombre,
                type: ChannelType.GuildCategory,
                permissionOverwrites: construirOverwrites(req.body.overwrites),
            });
            res.json({ success: true, categoria: serializarCategoria(categoria, guild) });
        } catch (error) {
            console.error('Error al crear categoría:', error);
            res.status(500).json({ error: 'No se pudo crear la categoría' });
        }
    });

    // Editar una categoría (nombre, posición, permisos).
    router.patch('/config/:guildId/canales/categorias/:id', puedeEditar, async (req, res) => {
        try {
            const guild = client.guilds.cache.get(req.params.guildId);
            if (!guild) return res.status(404).json({ error: 'Servidor no encontrado' });
            const categoria = guild.channels.cache.get(req.params.id);
            if (!categoria || categoria.type !== ChannelType.GuildCategory) return res.status(404).json({ error: 'Categoría no encontrada' });

            const cuerpo = req.body || {};
            const cambios = {};
            const nombre = cuerpo.nombre !== undefined ? String(cuerpo.nombre).trim().slice(0, 100) : '';
            if (nombre && nombre !== categoria.name) cambios.name = nombre;
            if (cuerpo.posicion !== undefined) {
                const posicion = Math.max(0, parseInt(cuerpo.posicion, 10) || 0);
                if (posicion !== categoria.position) cambios.position = posicion;
            }
            if (Array.isArray(cuerpo.overwrites)) {
                const permisos = overwritesConLosDeMiembro(categoria, cuerpo.overwrites);
                if (!mismosPermisos(categoria, permisos)) cambios.permissionOverwrites = permisos;
            }
            const aviso = await guardarEnDiscord(categoria, cambios);

            res.json({ success: true, ...aviso, categoria: serializarCategoria(categoria, guild) });
        } catch (error) {
            console.error('Error al editar categoría:', error);
            res.status(500).json({ error: 'No se pudo editar la categoría' });
        }
    });

    // Eliminar una categoría (sus canales quedan sin categoría, como en Discord).
    router.delete('/config/:guildId/canales/categorias/:id', puedeEditar, async (req, res) => {
        try {
            const guild = client.guilds.cache.get(req.params.guildId);
            if (!guild) return res.status(404).json({ error: 'Servidor no encontrado' });
            const categoria = guild.channels.cache.get(req.params.id);
            if (!categoria || categoria.type !== ChannelType.GuildCategory) return res.status(404).json({ error: 'Categoría no encontrada' });

            await categoria.delete();
            res.json({ success: true });
        } catch (error) {
            console.error('Error al eliminar categoría:', error);
            res.status(500).json({ error: 'No se pudo eliminar la categoría' });
        }
    });

    // ¿Puede el bot mover este canal o categoría? Discord exige "Ver canal" y
    // "Gestionar canales" en CADA canal que se toca (los permisos del canal
    // pueden quitárselos aunque los tenga en el servidor).
    const F = PermissionsBitField.Flags;
    function puedeGestionar(canal, yo) {
        if (!yo || typeof canal.permissionsFor !== 'function') return true;
        const permisos = canal.permissionsFor(yo);
        return !!permisos && permisos.has([F.ViewChannel, F.ManageChannels]);
    }

    // Error de Discord -> respuesta para el panel, con un código que el panel
    // traduce a un mensaje claro (y el texto de Discord para lo que no se espera).
    function respuestaDeError(error) {
        if (error && error.code === 50013) return { status: 403, cuerpo: { error: 'Al bot le faltan permisos en Discord', codigo: 'sin_permiso' } };
        if (error && (error.status === 429 || error.name === 'RateLimitError')) return { status: 429, cuerpo: { error: 'Discord está limitando los cambios', codigo: 'limite' } };
        if (error && typeof error.code === 'number') {
            return { status: 502, cuerpo: { error: 'Discord ha rechazado el cambio', codigo: 'discord', detalle: String(error.message || '').slice(0, 300) } };
        }
        return { status: 500, cuerpo: { error: 'No se pudo guardar el orden', codigo: 'error' } };
    }

    // Reordenar de golpe (arrastrar y soltar en el panel): el orden de las
    // categorías y, en el orden final, cada canal con la categoría donde queda.
    // Todo va en UNA llamada a Discord, así no se topa con su límite de cambios.
    // Solo se mandan las listas que cambian (las categorías si cambia su orden y,
    // de cada categoría, todos sus canales si cambia algo en ella): Discord
    // rechaza la petición entera si el bot no puede tocar uno solo de los canales,
    // así que un canal privado de otra categoría ya no impide ordenar el resto.
    router.put('/config/:guildId/canales/orden', puedeEditar, async (req, res) => {
        try {
            const guild = client.guilds.cache.get(req.params.guildId);
            if (!guild) return res.status(404).json({ error: 'Servidor no encontrado' });
            const cuerpo = req.body || {}; // sin cuerpo JSON, Express 5 lo deja sin definir
            const cats = Array.isArray(cuerpo.categorias) ? cuerpo.categorias.map(String) : [];
            const lista = Array.isArray(cuerpo.canales) ? cuerpo.canales : [];
            if (cats.length > 100 || lista.length > 500) return res.status(400).json({ error: 'Demasiados canales' });

            // Lo que ya no existe en Discord (una sala de voz temporal que se cerró,
            // un ticket borrado… mientras se ordenaba) se salta: no hay nada que
            // colocar y no debe impedir guardar el resto. Lo que existe pero no es
            // del tipo correcto es una petición mal hecha (400).
            const esCategoria = (id) => guild.channels.cache.get(id)?.type === ChannelType.GuildCategory;
            const existe = (id) => guild.channels.cache.has(id);
            if (new Set(cats).size !== cats.length || !cats.every((id) => esCategoria(id) || !existe(id))) {
                return res.status(400).json({ error: 'Categoría no válida' });
            }
            let ignorados = 0;
            const catsVivas = cats.filter(esCategoria);
            ignorados += cats.length - catsVivas.length;

            // Orden pedido: categoría ('' = sin categoría) -> canales en orden.
            const pedido = new Map();
            const vistos = new Set();
            for (const it of lista) {
                const id = String(it && it.id);
                if (vistos.has(id)) return res.status(400).json({ error: 'Canal no válido' });
                vistos.add(id);
                const canal = guild.channels.cache.get(id);
                if (canal && !esOrdenable(canal)) return res.status(400).json({ error: 'Canal no válido' });
                const parent = it.categoriaId ? String(it.categoriaId) : '';
                if (parent && !esCategoria(parent) && existe(parent)) return res.status(400).json({ error: 'Categoría no válida' });
                // Canal borrado, o categoría de destino borrada: se salta.
                if (!canal || (parent && !esCategoria(parent))) { ignorados++; continue; }
                if (!pedido.has(parent)) pedido.set(parent, []);
                pedido.get(parent).push(id);
            }

            // Lo que hay ahora en Discord, en el orden en que lo enseña (solo lo pedido).
            const actuales = (filtro) => guild.channels.cache.filter(filtro).sort(ordenDiscord).map((c) => c.id);
            const iguales = (a, b) => a.length === b.length && a.every((id, i) => id === b[i]);

            const posiciones = [];
            const catsActuales = actuales((c) => c.type === ChannelType.GuildCategory && catsVivas.includes(c.id));
            if (!iguales(catsVivas, catsActuales)) catsVivas.forEach((id, i) => posiciones.push({ channel: id, position: i }));
            for (const [parent, ids] of pedido) {
                const antes = actuales((c) => (c.parentId || '') === parent && esOrdenable(c) && ids.includes(c.id));
                if (iguales(ids, antes)) continue;
                ids.forEach((id, i) => {
                    const nueva = { channel: id, position: i };
                    // Al cambiar de categoría NO se copian los permisos de la nueva:
                    // el canal conserva los suyos (como al editarlo a mano).
                    if ((guild.channels.cache.get(id).parentId || '') !== parent) Object.assign(nueva, { parent: parent || null, lockPermissions: false });
                    posiciones.push(nueva);
                });
            }
            if (!posiciones.length) return res.json({ success: true, sinCambios: true, ignorados });

            // Antes de llamar a Discord: ¿puede el bot tocar todo lo que se mueve
            // (y las categorías que reciben canales)? Si no, se dice cuáles.
            const yo = guild.members.me;
            if (yo && !yo.permissions.has(F.ManageChannels)) {
                return res.status(403).json({ error: 'El bot no tiene "Gestionar canales" en el servidor', codigo: 'sin_permiso_servidor' });
            }
            const bloqueados = new Set();
            for (const p of posiciones) {
                const canal = guild.channels.cache.get(p.channel);
                if (!puedeGestionar(canal, yo)) bloqueados.add(canal.name);
                const destino = p.parent && guild.channels.cache.get(p.parent);
                if (destino && !puedeGestionar(destino, yo)) bloqueados.add(destino.name);
            }
            if (bloqueados.size) {
                return res.status(403).json({ error: 'El bot no tiene permiso en algunos canales', codigo: 'sin_permiso', canales: [...bloqueados].slice(0, 10) });
            }

            // Si Discord la retiene (su límite de cambios), se responde igual a los
            // pocos segundos: el orden se aplica solo en cuanto Discord lo permita.
            const peticion = guild.channels.setPositions(posiciones);
            let temporizador;
            const plazo = new Promise((resolve) => { temporizador = setTimeout(() => resolve('en-cola'), ESPERA_MAXIMA); });
            const resultado = await Promise.race([peticion.then(() => 'hecho'), plazo]).finally(() => clearTimeout(temporizador));
            if (resultado === 'en-cola') {
                peticion.catch((e) => console.error(`Orden pendiente en Discord (servidor ${guild.id}):`, e.message));
                return res.json({ success: true, aviso: 'en_cola', ignorados });
            }
            res.json({ success: true, ignorados });
        } catch (error) {
            console.error('Error al reordenar canales:', error);
            const { status, cuerpo } = respuestaDeError(error);
            res.status(status).json(cuerpo);
        }
    });

    // Crear un canal (texto, voz, anuncios, foro o escenario).
    router.post('/config/:guildId/canales', puedeEditar, async (req, res) => {
        try {
            const guild = client.guilds.cache.get(req.params.guildId);
            if (!guild) return res.status(404).json({ error: 'Servidor no encontrado' });

            const { tipo, nombre, categoriaId, topic, nsfw, slowmode, bitrate, userLimit, overwrites } = req.body;
            const tipoDiscord = TIPOS[tipo];
            if (tipoDiscord === undefined) return res.status(400).json({ error: 'Tipo de canal no válido' });
            const nombreLimpio = String(nombre || '').trim().slice(0, 100);
            if (!nombreLimpio) return res.status(400).json({ error: 'El nombre es obligatorio' });

            const opciones = {
                name: nombreLimpio,
                type: tipoDiscord,
                parent: categoriaId || undefined,
                permissionOverwrites: construirOverwrites(overwrites),
            };
            if ([ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum].includes(tipoDiscord)) {
                if (topic !== undefined) opciones.topic = String(topic || '').slice(0, 1024);
                if (nsfw !== undefined) opciones.nsfw = !!nsfw;
                if (slowmode !== undefined) opciones.rateLimitPerUser = Math.min(21600, Math.max(0, parseInt(slowmode, 10) || 0));
            }
            if ([ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(tipoDiscord)) {
                if (bitrate !== undefined) opciones.bitrate = Math.min(guild.maximumBitrate || 96000, Math.max(8000, parseInt(bitrate, 10) || 64000));
                if (userLimit !== undefined) opciones.userLimit = Math.min(99, Math.max(0, parseInt(userLimit, 10) || 0));
            }

            const canal = await guild.channels.create(opciones);
            res.json({ success: true, canal: serializarCanal(canal, guild) });
        } catch (error) {
            console.error('Error al crear canal:', error);
            res.status(500).json({ error: 'No se pudo crear el canal' });
        }
    });

    // Editar un canal (cualquier campo, incluida su categoría o sus permisos).
    router.patch('/config/:guildId/canales/:id', puedeEditar, async (req, res) => {
        try {
            const guild = client.guilds.cache.get(req.params.guildId);
            if (!guild) return res.status(404).json({ error: 'Servidor no encontrado' });
            const canal = guild.channels.cache.get(req.params.id);
            if (!canal || canal.type === ChannelType.GuildCategory) return res.status(404).json({ error: 'Canal no encontrado' });

            const { nombre, categoriaId, posicion, topic, nsfw, slowmode, bitrate, userLimit, overwrites } = req.body || {};
            // Solo lo que cambia de verdad (el nombre y el tema tienen límite en Discord).
            const cambios = {};
            const poner = (clave, valor, actual) => { if (valor !== actual) cambios[clave] = valor; };
            if (nombre !== undefined && String(nombre).trim()) poner('name', String(nombre).trim().slice(0, 100), canal.name);
            if (categoriaId !== undefined) poner('parent', categoriaId || null, canal.parentId || null);
            if (posicion !== undefined) poner('position', Math.max(0, parseInt(posicion, 10) || 0), canal.position);
            if (topic !== undefined) poner('topic', String(topic || '').slice(0, 1024), canal.topic || '');
            if (nsfw !== undefined) poner('nsfw', !!nsfw, !!canal.nsfw);
            if (slowmode !== undefined) poner('rateLimitPerUser', Math.min(21600, Math.max(0, parseInt(slowmode, 10) || 0)), canal.rateLimitPerUser || 0);
            if (bitrate !== undefined) poner('bitrate', Math.min(guild.maximumBitrate || 96000, Math.max(8000, parseInt(bitrate, 10) || 64000)), canal.bitrate);
            if (userLimit !== undefined) poner('userLimit', Math.min(99, Math.max(0, parseInt(userLimit, 10) || 0)), canal.userLimit || 0);
            if (Array.isArray(overwrites)) {
                const permisos = overwritesConLosDeMiembro(canal, overwrites);
                if (!mismosPermisos(canal, permisos)) cambios.permissionOverwrites = permisos;
            }
            const aviso = await guardarEnDiscord(canal, cambios);

            res.json({ success: true, ...aviso, canal: serializarCanal(canal, guild) });
        } catch (error) {
            console.error('Error al editar canal:', error);
            res.status(500).json({ error: 'No se pudo editar el canal' });
        }
    });

    // Eliminar un canal.
    router.delete('/config/:guildId/canales/:id', puedeEditar, async (req, res) => {
        try {
            const guild = client.guilds.cache.get(req.params.guildId);
            if (!guild) return res.status(404).json({ error: 'Servidor no encontrado' });
            const canal = guild.channels.cache.get(req.params.id);
            if (!canal || canal.type === ChannelType.GuildCategory) return res.status(404).json({ error: 'Canal no encontrado' });

            await canal.delete();
            res.json({ success: true });
        } catch (error) {
            console.error('Error al eliminar canal:', error);
            res.status(500).json({ error: 'No se pudo eliminar el canal' });
        }
    });

    return router;
};
