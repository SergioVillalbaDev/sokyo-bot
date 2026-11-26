// Tienda del servidor (2.0.0). Sustituye a la vieja tienda global de objetos (que cualquiera
// podía rellenar desde la web). Aquí SOLO los admins del servidor ponen productos, desde el
// panel (Diversión → Tienda del servidor), y cada producto es un ROL COSMÉTICO (color, título,
// acceso a un canal de charla…) que se compra con el oro de ESE servidor, para siempre o por
// unas horas. Nunca se vende un rol con permisos de staff, de moderación o de acceso al panel:
// se comprueba al guardar (panel) y otra vez al comprar (por si alguien le añadió permisos).
//
// Discord: /tienda (slash/tienda.js) → menú `tnd_c` → confirmar `tnd_ok:<id>` / `tnd_no`.
// Web «Mi cuenta»: GET/POST /api/portal/tienda (api/routes/economia.js), misma función comprar().
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const CompraTienda = require('../models/CompraTienda.js');
const RolTemporal = require('../models/RolTemporal.js');
const ContadorTienda = require('../models/ContadorTienda.js');
const { errorRolPeligroso } = require('./permisos.js');
const { t } = require('./i18n.js');

const MAX_PRODUCTOS = 25;                 // lo que cabe en un menú de Discord
const fmt = (n, idioma) => Number(n || 0).toLocaleString(idioma === 'en' ? 'en-US' : 'es-ES');

// Las compras de un servidor van en fila (una detrás de otra): así el stock nunca se vende dos
// veces aunque dos personas pulsen a la vez.
const colas = new Map();
function enFila(guildId, fn) {
    const anterior = colas.get(guildId) || Promise.resolve();
    const siguiente = anterior.catch(() => {}).then(fn);
    colas.set(guildId, siguiente.finally(() => { if (colas.get(guildId) === siguiente) colas.delete(guildId); }));
    return siguiente;
}

// Roles que nunca se venden: los del staff / panel / moderación y TODOS los que el bot da por su cuenta
// (acceso de la verificación y de la doble bienvenida, preguntas al entrar, recompensas de nivel e
// invitaciones, campeón, votante…). Venderlos sería saltarse la verificación o comprar un premio.
function rolesSensibles(cfg) {
    return new Set([cfg?.rolStaffId, ...(cfg?.rolesModeracion || []), ...(cfg?.rolesPanelAcceso || []),
        ...require('./permisos.js').rolesQueDaElBot(cfg || {})].filter(Boolean));
}

// ¿Se puede vender este rol aquí? Devuelve el motivo si no, o null si sí.
function errorRol(guild, rol, cfg, idioma = 'es') {
    if (!rol) return t(idioma, 'Ese rol ya no existe.', 'That role no longer exists.');
    if (rol.id === guild.id) return t(idioma, 'No se puede vender @everyone.', '@everyone can’t be sold.');
    if (rol.managed) return t(idioma, `«${rol.name}» lo gestiona una integración (un bot o las mejoras): no se puede vender.`, `“${rol.name}” is managed by an integration: it can’t be sold.`);
    const peligro = errorRolPeligroso(rol);
    if (peligro) return t(idioma, `«${rol.name}» tiene permisos de staff: en la tienda solo puede haber roles cosméticos.`, `“${rol.name}” has staff permissions: the shop can only sell cosmetic roles.`);
    if (rolesSensibles(cfg).has(rol.id)) return t(idioma, `«${rol.name}» es un rol del staff, de la verificación o un premio que da el bot: no se vende.`, `“${rol.name}” is a staff or verification role, or a reward the bot gives: it isn’t for sale.`);
    const yo = guild.members.me;
    if (yo && rol.position >= yo.roles.highest.position) return t(idioma, `«${rol.name}» está por encima del rol de Sokyo: súbelo en Ajustes del servidor → Roles o elige otro.`, `“${rol.name}” is above Sokyo’s role: move Sokyo higher in Server Settings → Roles or pick another.`);
    if (yo && !yo.permissions.has(PermissionsBitField.Flags.ManageRoles)) return t(idioma, 'A Sokyo le falta el permiso «Gestionar roles».', 'Sokyo is missing the “Manage Roles” permission.');
    return null;
}

// Limpia y valida la lista que manda el panel. Devuelve { productos } o { error }.
function validarProductos(guild, cfg, lista, idioma = 'es') {
    if (!Array.isArray(lista)) return { error: t(idioma, 'Lista de productos no válida.', 'Invalid product list.') };
    if (lista.length > MAX_PRODUCTOS) return { error: t(idioma, `Como mucho ${MAX_PRODUCTOS} productos.`, `${MAX_PRODUCTOS} products at most.`) };
    const productos = [];
    const ids = new Set();
    for (const p of lista) {
        const nombre = String(p?.nombre || '').trim().slice(0, 60);
        if (!nombre) return { error: t(idioma, 'Cada producto necesita un nombre.', 'Every product needs a name.') };
        const rol = guild.roles.cache.get(String(p?.rolId || ''));
        const malRol = errorRol(guild, rol, cfg, idioma);
        if (malRol) return { error: `${nombre}: ${malRol}` };
        const precio = Math.floor(Number(p?.precio));
        if (!Number.isFinite(precio) || precio < 1 || precio > 10000000) return { error: t(idioma, `${nombre}: el precio va de 1 a 10.000.000 de oro.`, `${nombre}: price must be 1 to 10,000,000 gold.`) };
        const horas = Math.max(0, Math.min(2160, Math.floor(Number(p?.horas) || 0)));
        const stock = p?.stock === '' || p?.stock == null ? null : Math.max(0, Math.min(100000, Math.floor(Number(p.stock) || 0)));
        let id = String(p?.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 10);
        if (!id || ids.has(id)) { do { id = Math.random().toString(36).slice(2, 8); } while (ids.has(id)); }
        ids.add(id);
        const emoji = String(p?.emoji || '🎁').trim();
        productos.push({
            id, nombre, rolId: rol.id, precio, horas, stock,
            descripcion: String(p?.descripcion || '').trim().slice(0, 150),
            emoji: /^\p{RGI_Emoji}$/v.test(emoji) ? emoji : '🎁',
            activo: p?.activo !== false,
        });
    }
    return { productos };
}

// Unidades vendidas de cada producto (solo los que llevan stock). En ContadorTienda, que no caduca.
async function vendidos(guildId, ids) {
    if (!ids.length) return {};
    const filas = await ContadorTienda.find({ guildId, productoId: { $in: ids } }).lean();
    return Object.fromEntries(filas.map((f) => [f.productoId, f.vendidos || 0]));
}

// Productos a la venta con lo que queda de cada uno (para Discord, la web y el panel).
// En Free solo se venden los primeros (limites.tiendaProductos): si un servidor deja Pro, la tienda sigue
// abierta con lo de arriba del todo.
function aLaVenta(cfg) {
    const lista = (cfg?.tienda?.productos || []).filter((p) => p.activo !== false);
    return lista.slice(0, require('./limites.js').limite(cfg, 'tiendaProductos'));
}

async function catalogo(guildId, cfg) {
    const lista = aLaVenta(cfg);
    const conStock = lista.filter((p) => typeof p.stock === 'number').map((p) => p.id);
    const v = await vendidos(guildId, conStock);
    return lista.map((p) => ({ ...(p.toObject ? p.toObject() : p), quedan: typeof p.stock === 'number' ? Math.max(0, p.stock - (v[p.id] || 0)) : null }));
}

const duracion = (h, idioma) => (!h ? t(idioma, 'para siempre', 'forever')
    : h % 24 === 0 ? t(idioma, `${h / 24} ${h === 24 ? 'día' : 'días'}`, `${h / 24} day${h === 24 ? '' : 's'}`)
        : t(idioma, `${h} h`, `${h} h`));

// Compra: valida, cobra (puerta atómica), da el rol y, si algo falla, lo devuelve todo.
// Devuelve { ok, producto, saldo, hasta, extendido } o { ok: false, error }.
function comprar(guild, member, productoId, idioma = 'es') {
    return enFila(guild.id, async () => {
        const cfg = await ServidorConfig.findOne({ guildId: guild.id }).lean();
        if (!cfg?.tienda?.activo) return { ok: false, error: t(idioma, 'La tienda de este servidor está cerrada.', 'This server’s shop is closed.') };
        const producto = aLaVenta(cfg).find((p) => p.id === productoId);
        if (!producto) return { ok: false, error: t(idioma, 'Ese producto ya no está a la venta.', 'That product is no longer for sale.') };
        const rol = guild.roles.cache.get(producto.rolId);
        const malRol = errorRol(guild, rol, cfg, idioma);
        if (malRol) return { ok: false, error: t(idioma, `Ahora mismo no se puede comprar: ${malRol} Avisa a un admin.`, `It can’t be bought right now: ${malRol} Tell an admin.`) };
        const lo = member.roles.cache.has(rol.id);
        // ¿El que tiene caduca? (si lo tiene sin RolTemporal, es suyo para siempre)
        const previo = lo ? await RolTemporal.findOne({ guildId: guild.id, userId: member.id, roleId: rol.id }).lean() : null;
        const caduca = !!(previo && new Date(previo.expiraEn) > new Date());
        if (lo && !caduca) return { ok: false, error: t(idioma, `Ya tienes **${rol.name}** para siempre.`, `You already have **${rol.name}** forever.`) };
        if (typeof producto.stock === 'number') {
            const v = (await vendidos(guild.id, [producto.id]))[producto.id] || 0;
            if (v >= producto.stock) return { ok: false, error: t(idioma, '¡Agotado! No quedan unidades.', 'Sold out! None left.') };
        }
        const eco = require('./economia.js').en(guild.id);
        const saldo = await eco.cobrar(member.id, producto.precio);
        if (saldo === null) {
            const u = await eco.obtenerUsuario(member.id);
            return { ok: false, error: t(idioma, `Cuesta 🪙 ${fmt(producto.precio, idioma)} y tienes 🪙 ${fmt(u.balance, idioma)}. Gana oro con \`/diario\`, la granja y los juegos.`, `It costs 🪙 ${fmt(producto.precio, idioma)} and you have 🪙 ${fmt(u.balance, idioma)}. Earn gold with \`/daily\`, the farm and the games.`) };
        }
        const dado = lo || await member.roles.add(rol.id, `Tienda del servidor: ${producto.nombre}`).then(() => true).catch(() => false);
        if (!dado) {
            await eco.darOro(member.id, producto.precio);
            await CompraTienda.create({ guildId: guild.id, userId: member.id, productoId: producto.id, nombre: producto.nombre, rolId: rol.id, precio: producto.precio, devuelta: true }).catch(() => {});
            return { ok: false, error: t(idioma, 'No he podido darte el rol (revisa que Sokyo esté por encima). Te he devuelto el oro.', 'I couldn’t give you the role (check Sokyo’s role is higher). Your gold was refunded.') };
        }
        let hasta = null;
        let extendido = false;
        if (producto.horas) {
            const base = caduca ? new Date(previo.expiraEn).getTime() : Date.now();
            extendido = caduca;
            hasta = new Date(base + producto.horas * 3600000);
            await RolTemporal.findOneAndUpdate({ guildId: guild.id, userId: member.id, roleId: rol.id }, { $set: { expiraEn: hasta } }, { upsert: true });
        } else {
            await RolTemporal.deleteMany({ guildId: guild.id, userId: member.id, roleId: rol.id }); // ahora es suyo para siempre
        }
        await CompraTienda.create({ guildId: guild.id, userId: member.id, productoId: producto.id, nombre: producto.nombre, rolId: rol.id, precio: producto.precio, hasta });
        if (typeof producto.stock === 'number') await ContadorTienda.updateOne({ guildId: guild.id, productoId: producto.id }, { $inc: { vendidos: 1 } }, { upsert: true });
        require('./uso.js').sumar(guild.id, 'tienda:compra');
        return { ok: true, producto, rol, saldo, hasta, extendido };
    });
}

// ---------------------------------------------------------------- Discord
async function vista(guild, cfg, member, idioma) {
    const eco = require('./economia.js').en(guild.id);
    const yo = await eco.obtenerUsuario(member.id);
    const lista = await catalogo(guild.id, cfg);
    const e = new EmbedBuilder().setColor('#c9a227')
        .setTitle(t(idioma, `🛒 Tienda de ${guild.name}`, `🛒 ${guild.name} shop`))
        .setFooter({ text: t(idioma, `Tienes 🪙 ${fmt(yo.balance, idioma)} · El oro se gana jugando, nunca con dinero`, `You have 🪙 ${fmt(yo.balance, idioma)} · Gold is earned by playing, never with money`) });
    if (!cfg?.tienda?.activo || !lista.length) {
        e.setDescription(t(idioma,
            'Aquí los admins ponen a la venta **roles especiales** (colores, títulos, canales VIP…) para comprarlos con tu oro.\n\nAún no hay nada a la venta. Mientras, el oro sirve para cofres, cartas, la casa de tus mascotas y el casino: `/menu`.',
            'Admins put **special roles** up for sale here (colours, titles, VIP channels…) to buy with your gold.\n\nNothing is for sale yet. Meanwhile, gold is for chests, cards, your pets’ house and the casino: `/menu`.'));
        return { embeds: [e], components: [] };
    }
    e.setDescription(lista.map((p) => {
        const rol = guild.roles.cache.get(p.rolId);
        const agotado = p.quedan === 0;
        const tiene = member.roles.cache.has(p.rolId);
        const extra = [duracion(p.horas, idioma), p.quedan != null ? t(idioma, `quedan ${p.quedan}`, `${p.quedan} left`) : null, tiene ? t(idioma, '✅ lo tienes', '✅ you have it') : null].filter(Boolean).join(' · ');
        return `${p.emoji} **${p.nombre}** — 🪙 ${fmt(p.precio, idioma)}${agotado ? t(idioma, ' · **agotado**', ' · **sold out**') : ''}\n${rol ? `<@&${rol.id}>` : ''}${p.descripcion ? ` ${p.descripcion}` : ''}\n-# ${extra}`;
    }).join('\n\n').slice(0, 4000));
    const opciones = lista.filter((p) => p.quedan !== 0).slice(0, 25).map((p) => ({
        label: `${p.nombre} · ${fmt(p.precio, idioma)} ${t(idioma, 'oro', 'gold')}`.slice(0, 100),
        description: duracion(p.horas, idioma).slice(0, 100),
        value: p.id, emoji: p.emoji,
    }));
    const filas = opciones.length ? [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('tnd_c').setPlaceholder(t(idioma, '¿Qué quieres comprar?', 'What do you want to buy?')).addOptions(opciones))] : [];
    return { embeds: [e], components: filas };
}

async function manejar(interaction) {
    const id = interaction.customId || '';
    if (!id.startsWith('tnd_')) return false;
    if (!interaction.guild) return true;
    const cfg = await ServidorConfig.findOne({ guildId: interaction.guildId }).lean();
    const idioma = cfg?.idioma || 'en';
    if (id === 'tnd_c' && interaction.isStringSelectMenu()) {
        const p = (cfg?.tienda?.productos || []).find((x) => x.id === interaction.values[0]);
        if (!p) { await interaction.reply({ content: t(idioma, '❌ Ese producto ya no está a la venta.', '❌ That product is no longer for sale.'), flags: 64 }); return true; }
        const fila = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`tnd_ok:${p.id}`).setStyle(ButtonStyle.Success).setEmoji('🛒').setLabel(t(idioma, `Comprar por ${fmt(p.precio, idioma)} de oro`, `Buy for ${fmt(p.precio, idioma)} gold`)),
            new ButtonBuilder().setCustomId('tnd_no').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Ahora no', 'Not now')),
        );
        await interaction.reply({ content: t(idioma, `${p.emoji} **${p.nombre}**: el rol <@&${p.rolId}> ${duracion(p.horas, idioma)}. ¿Lo compras?`, `${p.emoji} **${p.nombre}**: the <@&${p.rolId}> role ${duracion(p.horas, idioma)}. Buy it?`), components: [fila], flags: 64, allowedMentions: { parse: [] } });
        return true;
    }
    // 2.5.0: «Ahora no» y el resultado de la compra vuelven a la tienda en el mismo mensaje, con lo que ha pasado
    // arriba (antes se quedaba en un mensaje sin botones y había que escribir /tienda otra vez).
    const deVuelta = async (texto) => ({ ...(await vista(interaction.guild, cfg, interaction.member, idioma)), content: texto, allowedMentions: { parse: [] } });
    if (id === 'tnd_no') { await interaction.deferUpdate(); await interaction.editReply(await deVuelta(t(idioma, 'Vale, sin compras. 👍', 'Okay, nothing bought. 👍'))); return true; }
    if (id.startsWith('tnd_ok:')) {
        await interaction.deferUpdate();
        const r = await comprar(interaction.guild, interaction.member, id.split(':')[1], idioma);
        if (!r.ok) { await interaction.editReply(await deVuelta(`❌ ${r.error}`)); return true; }
        const cuando = r.hasta ? t(idioma, ` hasta <t:${Math.floor(r.hasta.getTime() / 1000)}:f>`, ` until <t:${Math.floor(r.hasta.getTime() / 1000)}:f>`) : t(idioma, ' para siempre', ' forever');
        await interaction.editReply(await deVuelta(t(idioma, `✅ ¡Hecho! ${r.extendido ? 'Has alargado' : 'Ya tienes'} <@&${r.rol.id}>${cuando}. Te quedan 🪙 ${fmt(r.saldo, idioma)}.`, `✅ Done! ${r.extendido ? 'You extended' : 'You now have'} <@&${r.rol.id}>${cuando}. You have 🪙 ${fmt(r.saldo, idioma)} left.`)));
        return true;
    }
    return false;
}

module.exports = { MAX_PRODUCTOS, errorRol, validarProductos, catalogo, comprar, vista, manejar, duracion, _enFila: enFila };
