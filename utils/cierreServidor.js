// ============================================================================
// Cerrar el servidor hasta verificarse (1.9.12).
//
// Sin esto, el «rol de acceso» de la verificación no cerraba nada: quien entraba
// veía todos los canales igual, tuviera el rol o no. Cerrar hace lo que haría un
// administrador a mano en Discord:
//   1. @everyone deja de tener «Ver canales» (a nivel de rol): sin otro rol, no ve nada.
//   2. El rol de acceso sí lo tiene: al verificarse, lo ve todo.
//   3. El canal de verificación se abre para @everyone (y, si se quiere, se le
//      oculta a quien ya tiene el rol de acceso).
//   4. Los canales que dejaban verlos a @everyone a propósito (permiso del canal)
//      pasan a dejárselo al rol de acceso; si no, seguirían a la vista.
//   5. Las categorías ligadas a una respuesta de las preguntas al entrar (juegos):
//      solo las ve quien tiene ese rol.
// «Abrir» devuelve «Ver canales» a @everyone (lo demás no estorba).
// ============================================================================
const { PermissionsBitField, ChannelType, OverwriteType } = require('discord.js');
const { preguntasValidas } = require('./preguntasEntrada.js');

const F = PermissionsBitField.Flags;
const TIPOS_CANAL = [ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildAnnouncement, ChannelType.GuildForum, ChannelType.GuildStageVoice, ChannelType.GuildMedia, ChannelType.GuildCategory];

// La verificación que está en marcha (la normal o la doble bienvenida) → su rol y su canal.
function puertaDeEntrada(cfg) {
    const v = (cfg && cfg.verificacion) || {};
    const e = (cfg && cfg.embudoAB) || {};
    if (e.activo) return { rolId: e.rolVerificadoId || null, canalId: e.canalId || null, modo: 'embudo' };
    return { rolId: v.rolVerificadoId || null, canalId: v.canalId || null, modo: v.activo ? 'verif' : null };
}

// Categorías que abre cada respuesta (rol → categorías).
function categoriasPorRol(cfg) {
    const pares = [];
    for (const q of preguntasValidas(cfg)) {
        for (const o of q.opciones) if (o.rolId && o.categoriaId) pares.push({ rolId: String(o.rolId), categoriaId: String(o.categoriaId) });
    }
    return pares;
}

// ¿Este canal deja verlo a @everyone por su propio permiso? (con el servidor cerrado seguiría a la vista)
function abiertoATodos(canal, everyoneId) {
    const ow = canal.permissionOverwrites?.cache?.get(everyoneId);
    return !!(ow && ow.allow.has(F.ViewChannel));
}

// Cómo está el servidor: lo que enseña el panel antes de cerrar o para comprobarlo.
function estadoCierre(guild, cfg) {
    const { rolId, canalId, modo } = puertaDeEntrada(cfg);
    const everyone = guild.roles.everyone;
    const acceso = rolId ? guild.roles.cache.get(rolId) : null;
    const canalVerif = canalId ? guild.channels.cache.get(canalId) : null;
    const yo = guild.members.me;
    const abiertos = guild.channels.cache
        .filter((c) => TIPOS_CANAL.includes(c.type) && c.id !== canalId && abiertoATodos(c, everyone.id))
        .map((c) => ({ id: c.id, nombre: c.name, categoria: c.type === ChannelType.GuildCategory }));
    // Roles que el bot da al entrar y que dejan ver todo (se saltarían el cierre).
    const autoRolesQueVen = (cfg && cfg.autoRoles || []).map((id) => guild.roles.cache.get(id))
        .filter((r) => r && r.permissions.has(F.ViewChannel)).map((r) => ({ id: r.id, nombre: r.name }));
    return {
        modo,
        rolAccesoId: rolId,
        rolAccesoExiste: !!acceso,
        canalVerificacionId: canalId,
        canalVerificacionExiste: !!canalVerif,
        cerrado: !everyone.permissions.has(F.ViewChannel),
        accesoVe: !!(acceso && acceso.permissions.has(F.ViewChannel)),
        verificacionVisible: !!(canalVerif && canalVerif.permissionsFor(everyone)?.has(F.ViewChannel)),
        abiertos,
        autoRolesQueVen,
        bot: {
            gestionarRoles: !!yo?.permissions.has(F.ManageRoles),
            gestionarCanales: !!yo?.permissions.has(F.ManageChannels),
            rolAccesoEditable: !!(acceso && acceso.editable),
        },
        categorias: categoriasPorRol(cfg).map((p) => ({ ...p, existe: !!guild.channels.cache.get(p.categoriaId) })),
    };
}

// Cierra el servidor. Devuelve el estado nuevo y lo que no se ha podido hacer.
async function cerrar(guild, cfg, { arreglarCanales = true } = {}) {
    const { rolId, canalId } = puertaDeEntrada(cfg);
    const everyone = guild.roles.everyone;
    const acceso = rolId ? guild.roles.cache.get(rolId) : null;
    const canalVerif = canalId ? guild.channels.cache.get(canalId) : null;
    if (!acceso) throw new Error('sin-rol');
    if (!canalVerif) throw new Error('sin-canal');
    const yo = guild.members.me;
    if (!yo?.permissions.has(F.ManageRoles) || !yo?.permissions.has(F.ManageChannels)) throw new Error('sin-permisos');
    const fallos = [];
    const motivo = 'Sokyo: cerrar el servidor hasta verificarse';

    // 1-2. Primero el canal de verificación y el rol de acceso (así nunca queda nadie sin ver nada).
    await canalVerif.permissionOverwrites.edit(everyone.id, { ViewChannel: true, ReadMessageHistory: true }, { type: OverwriteType.Role, reason: motivo })
        .catch(() => fallos.push({ id: canalVerif.id, nombre: canalVerif.name }));
    if (cfg && cfg.preguntasEntrada && cfg.preguntasEntrada.ocultarVerificacion !== false) {
        await canalVerif.permissionOverwrites.edit(acceso.id, { ViewChannel: false }, { type: OverwriteType.Role, reason: motivo }).catch(() => {});
    }
    if (!acceso.permissions.has(F.ViewChannel)) {
        if (!acceso.editable) throw new Error('rol-alto');
        await acceso.setPermissions(acceso.permissions.add(F.ViewChannel), motivo);
    }
    // 4. Canales abiertos a @everyone a propósito → abiertos al rol de acceso.
    if (arreglarCanales) {
        for (const c of guild.channels.cache.values()) {
            if (!TIPOS_CANAL.includes(c.type) || c.id === canalVerif.id || !abiertoATodos(c, everyone.id)) continue;
            try {
                await c.permissionOverwrites.edit(everyone.id, { ViewChannel: null }, { type: OverwriteType.Role, reason: motivo });
                await c.permissionOverwrites.edit(acceso.id, { ViewChannel: true }, { type: OverwriteType.Role, reason: motivo });
            } catch { fallos.push({ id: c.id, nombre: c.name }); }
        }
    }
    // 5. Categorías de juegos (o lo que sea): solo con su rol.
    for (const { rolId: rid, categoriaId } of categoriasPorRol(cfg)) {
        const cat = guild.channels.cache.get(categoriaId);
        if (!cat || !guild.roles.cache.get(rid)) continue;
        for (const c of [cat, ...(cat.children?.cache?.values?.() || [])]) {
            try {
                await c.permissionOverwrites.edit(everyone.id, { ViewChannel: false }, { type: OverwriteType.Role, reason: motivo });
                await c.permissionOverwrites.edit(rid, { ViewChannel: true }, { type: OverwriteType.Role, reason: motivo });
            } catch { fallos.push({ id: c.id, nombre: c.name }); }
        }
    }
    // 3. Por último, @everyone deja de ver los canales.
    if (everyone.permissions.has(F.ViewChannel)) await everyone.setPermissions(everyone.permissions.remove(F.ViewChannel), motivo);
    return { estado: estadoCierre(guild, cfg), fallos };
}

// Vuelve a abrir el servidor: @everyone recupera «Ver canales».
async function abrir(guild) {
    const everyone = guild.roles.everyone;
    if (!everyone.permissions.has(F.ViewChannel)) await everyone.setPermissions(everyone.permissions.add(F.ViewChannel), 'Sokyo: abrir el servidor');
}

module.exports = { estadoCierre, cerrar, abrir, puertaDeEntrada, categoriasPorRol };
