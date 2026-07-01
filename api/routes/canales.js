// ============================================================================
// Rutas de gestión de CATEGORÍAS y CANALES del servidor (texto, voz, anuncios,
// foro, escenario), con las opciones que permite Discord: tema, NSFW, modo
// lento, bitrate, límite de usuarios, posición y permisos por rol/canal.
// El middleware global de server.js ya acota el acceso por /config/:guildId.
// ============================================================================
const express = require('express');
const { ChannelType } = require('discord.js');

// Tipos de canal que el panel puede crear/editar (clave en español -> tipo real).
const TIPOS = {
    texto: ChannelType.GuildText,
    voz: ChannelType.GuildVoice,
    anuncios: ChannelType.GuildAnnouncement,
    foro: ChannelType.GuildForum,
    escenario: ChannelType.GuildStageVoice,
};
const TIPO_DE_VALOR = Object.fromEntries(Object.entries(TIPOS).map(([k, v]) => [v, k]));

// Permisos con sentido para un permiso "por canal" (overwrite), agrupados por
// contexto. Es un catálogo curado (no los ~40 flags de Discord), igual que
// PERMISOS_CATALOGO hace para los roles.
const PERMISOS_CANAL = [
    { grupo: 'General', permisos: ['ViewChannel', 'ManageChannels', 'ManageRoles'] },
    { grupo: 'Texto', permisos: ['SendMessages', 'ReadMessageHistory', 'EmbedLinks', 'AttachFiles', 'AddReactions', 'ManageMessages', 'MentionEveryone', 'UseApplicationCommands', 'SendMessagesInThreads', 'CreatePublicThreads'] },
    { grupo: 'Voz', permisos: ['Connect', 'Speak', 'Stream', 'UseVAD', 'PrioritySpeaker', 'MuteMembers', 'DeafenMembers', 'MoveMembers'] },
];
const FLAGS_VALIDOS = new Set(PERMISOS_CANAL.flatMap((g) => g.permisos));

module.exports = ({ client }) => {
    const router = express.Router();

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

    // Aplica los overwrites de ROL que edita el panel sin tocar los de MIEMBRO
    // (p. ej. el acceso del creador de un ticket o del dueño de una sala de voz
    // temporal), que gestionan otros sistemas del bot y no deben desaparecer.
    async function aplicarOverwritesDeRol(canalOCategoria, listaRoles) {
        const nuevos = construirOverwrites(listaRoles) || [];
        const idsNuevos = new Set(nuevos.map((o) => o.id));
        const miembrosPrevios = canalOCategoria.permissionOverwrites.cache
            .filter((ov) => ov.type === 1 && !idsNuevos.has(ov.id))
            .map((ov) => ({ id: ov.id, allow: ov.allow.toArray(), deny: ov.deny.toArray() }));
        await canalOCategoria.permissionOverwrites.set([...nuevos, ...miembrosPrevios]);
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
                .filter((c) => c.parentId === categoria.id)
                .sort((a, b) => a.position - b.position)
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
                .sort((a, b) => a.position - b.position)
                .map((c) => serializarCategoria(c, guild));

            const sinCategoria = guild.channels.cache
                .filter((c) => !c.parentId && c.type !== ChannelType.GuildCategory && TIPO_DE_VALOR[c.type])
                .sort((a, b) => a.position - b.position)
                .map((c) => serializarCanal(c, guild));

            res.json({ categorias, sinCategoria });
        } catch (error) {
            console.error('Error al obtener la estructura de canales:', error);
            res.status(500).json({ error: 'Error del servidor' });
        }
    });

    // Crear una categoría.
    router.post('/config/:guildId/canales/categorias', async (req, res) => {
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
    router.patch('/config/:guildId/canales/categorias/:id', async (req, res) => {
        try {
            const guild = client.guilds.cache.get(req.params.guildId);
            if (!guild) return res.status(404).json({ error: 'Servidor no encontrado' });
            const categoria = guild.channels.cache.get(req.params.id);
            if (!categoria || categoria.type !== ChannelType.GuildCategory) return res.status(404).json({ error: 'Categoría no encontrada' });

            const cambios = {};
            if (req.body.nombre !== undefined) cambios.name = String(req.body.nombre).trim().slice(0, 100);
            if (req.body.posicion !== undefined) cambios.position = Math.max(0, parseInt(req.body.posicion, 10) || 0);
            if (Object.keys(cambios).length) await categoria.edit(cambios);
            if (Array.isArray(req.body.overwrites)) await aplicarOverwritesDeRol(categoria, req.body.overwrites);

            res.json({ success: true, categoria: serializarCategoria(categoria, guild) });
        } catch (error) {
            console.error('Error al editar categoría:', error);
            res.status(500).json({ error: 'No se pudo editar la categoría' });
        }
    });

    // Eliminar una categoría (sus canales quedan sin categoría, como en Discord).
    router.delete('/config/:guildId/canales/categorias/:id', async (req, res) => {
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

    // Crear un canal (texto, voz, anuncios, foro o escenario).
    router.post('/config/:guildId/canales', async (req, res) => {
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
    router.patch('/config/:guildId/canales/:id', async (req, res) => {
        try {
            const guild = client.guilds.cache.get(req.params.guildId);
            if (!guild) return res.status(404).json({ error: 'Servidor no encontrado' });
            const canal = guild.channels.cache.get(req.params.id);
            if (!canal || canal.type === ChannelType.GuildCategory) return res.status(404).json({ error: 'Canal no encontrado' });

            const { nombre, categoriaId, posicion, topic, nsfw, slowmode, bitrate, userLimit, overwrites } = req.body;
            const cambios = {};
            if (nombre !== undefined) cambios.name = String(nombre).trim().slice(0, 100);
            if (categoriaId !== undefined) cambios.parent = categoriaId || null;
            if (posicion !== undefined) cambios.position = Math.max(0, parseInt(posicion, 10) || 0);
            if (topic !== undefined) cambios.topic = String(topic || '').slice(0, 1024);
            if (nsfw !== undefined) cambios.nsfw = !!nsfw;
            if (slowmode !== undefined) cambios.rateLimitPerUser = Math.min(21600, Math.max(0, parseInt(slowmode, 10) || 0));
            if (bitrate !== undefined) cambios.bitrate = Math.min(guild.maximumBitrate || 96000, Math.max(8000, parseInt(bitrate, 10) || 64000));
            if (userLimit !== undefined) cambios.userLimit = Math.min(99, Math.max(0, parseInt(userLimit, 10) || 0));

            if (Object.keys(cambios).length) await canal.edit(cambios);
            if (Array.isArray(overwrites)) await aplicarOverwritesDeRol(canal, overwrites);

            res.json({ success: true, canal: serializarCanal(canal, guild) });
        } catch (error) {
            console.error('Error al editar canal:', error);
            res.status(500).json({ error: 'No se pudo editar el canal' });
        }
    });

    // Eliminar un canal.
    router.delete('/config/:guildId/canales/:id', async (req, res) => {
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
