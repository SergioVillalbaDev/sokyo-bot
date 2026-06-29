// ============================================================================
// automod — Automoderador de mensajes.
// Revisa cada mensaje de un servidor contra los filtros configurados (palabras
// prohibidas, invitaciones, enlaces, spam/flood, menciones masivas y mayúsculas).
// Cuando un filtro salta: borra el mensaje y, si su acción no es solo "borrar",
// aplica una sanción real reutilizando el motor de moderación (mod-log + MD ya
// incluidos). Devuelve true si actuó, para que messageCreate corte el resto.
// ============================================================================
const { PermissionsBitField } = require('discord.js');
const { aplicarSancion } = require('./moderationManager.js');
const { esPro, estadoIA, consumirIA } = require('./billing.js');
const { iaDisponible, moderarTexto } = require('./ia.js');

// Historial reciente por usuario para el anti-spam (en memoria).
// Clave `${guildId}:${userId}` -> [{ t: timestamp, contenido }]
const historial = new Map();

// Detección de invitaciones de Discord y de URLs.
const INVITE_RE = /(?:discord(?:app)?\.com\/invite|discord\.(?:gg|io|me|li))\/\S+/i;
const URL_RE = /https?:\/\/[^\s]+|www\.[^\s]+/i;

// Palabras/frases típicas de estafa (cripto, nitro falso, cuentas hackeadas).
// Se usa cuando el servidor no define su propia lista en `estafas.palabrasClave`.
const ESTAFA_DEFECTO = [
    'free nitro', 'nitro gratis', 'nitro free', 'discord nitro free', 'steam gift', 'regalo de steam',
    'free steam', 'gift card gratis', 'airdrop', 'claim your reward', 'reclama tu premio', 'free crypto',
    'cripto gratis', 'invest in crypto', 'invierte en cripto', 'invertir en cripto', 'doblar tu dinero',
    'double your money', 'trading signals', 'señales de trading', 'ganancias garantizadas', 'guaranteed profit',
    'ganar dinero rapido', 'earn money fast', 'make money fast', 'onlyfans leaked', 'telegram @', 'whatsapp +',
];

// Enlaces/dominios falsos típicos de estos timos (suplantan a Discord/Steam).
const ENLACE_ESTAFA_RE = /(d[il]sc[o0]rd[-.]?nitro|discord(?:app)?[-.]gift|discordgift|steam(?:community)?[-.][a-z]{2,}\.[a-z]|stearncommunity|free[-.]?nitro|nitro[-.]?free|claim[-.]?discord)/i;

// Limpieza periódica del historial de spam (entradas de más de 60s).
setInterval(() => {
    const corte = Date.now() - 60000;
    for (const [clave, arr] of historial) {
        const vivos = arr.filter((e) => e.t > corte);
        if (vivos.length) historial.set(clave, vivos);
        else historial.delete(clave);
    }
}, 60000).unref();

// ¿El miembro está exento del automod? Admins, roles de moderación y roles exentos.
function exento(member, am, cfg) {
    if (!member) return false;
    if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
    const mods = (cfg && cfg.rolesModeracion) || [];
    if (mods.some((id) => member.roles.cache.has(id))) return true;
    return (am.rolesExentos || []).some((id) => member.roles.cache.has(id));
}

// Borra el mensaje infractor y, según la acción del filtro, aplica una sanción.
async function castigar(message, client, regla, am, motivo) {
    await message.delete().catch(() => {});

    // Aviso efímero al usuario en el canal (se autoborra a los 6s).
    if (am.avisarEnCanal) {
        message.channel
            .send({ content: `<@${message.author.id}> ⚠️ ${motivo}.` })
            .then((m) => setTimeout(() => m.delete().catch(() => {}), 6000))
            .catch(() => {});
    }

    const accion = regla.accion || 'borrar';
    if (accion === 'borrar') return; // solo eliminar, sin registro de sanción

    try {
        await aplicarSancion(client, {
            guildId: message.guild.id,
            usuarioId: message.author.id,
            tipo: {
                nombre: 'Automod',
                accion,
                duracionMin: accion === 'timeout' ? (regla.timeoutMin || 5) : 0,
                borrarMensajesHoras: regla.borrarMensajesHoras || 0,
            },
            motivo: `[Automod] ${motivo}`,
            moderador: { id: client.user.id, tag: 'Automod' },
        });
    } catch (e) {
        console.error('Automod: error aplicando sanción:', e.message);
    }
}

// Revisa un mensaje. Devuelve true si el automod actuó (borró el mensaje).
async function revisarMensaje(message, cfg, client) {
    const am = cfg && cfg.automod;
    if (!message.guild || !am || !am.activo) return false;
    if ((am.canalesExentos || []).includes(message.channelId)) return false;
    if (exento(message.member, am, cfg)) return false;

    const contenido = message.content || '';

    // 1. Palabras prohibidas (coincidencia por subcadena, sin distinguir mayúsculas).
    if (am.palabras?.activo && am.palabras.lista?.length) {
        const texto = contenido.toLowerCase();
        const hit = am.palabras.lista.find((p) => p && texto.includes(p.toLowerCase()));
        if (hit) {
            await castigar(message, client, am.palabras, am, `Banned word: "${hit}"`);
            return true;
        }
    }

    // 1.5. Estafas / cripto / nitro falso / cuentas hackeadas.
    if (am.estafas?.activo) {
        const e = am.estafas;
        const texto = contenido.toLowerCase();
        const lista = (e.palabrasClave && e.palabrasClave.length) ? e.palabrasClave : ESTAFA_DEFECTO;
        const hit = lista.find((p) => p && texto.includes(p.toLowerCase()));
        const tieneEnlace = URL_RE.test(contenido) || INVITE_RE.test(contenido);
        const tieneImagen = message.attachments?.some((a) => (a.contentType || '').startsWith('image'));
        const enlaceFalso = e.nitroFalso && ENLACE_ESTAFA_RE.test(contenido);

        let motivo = null;
        if (enlaceFalso) motivo = 'Scam link (fake Nitro/Steam)';
        else if (hit && (!e.conEnlace || tieneEnlace || (e.conImagen && tieneImagen))) motivo = `Possible scam: "${hit}"`;

        if (motivo) {
            await castigar(message, client, { accion: e.accion, timeoutMin: e.timeoutMin, borrarMensajesHoras: e.borrarHoras }, am, motivo);
            return true;
        }
    }

    // 2. Invitaciones a otros servidores.
    if (am.invitaciones?.activo && INVITE_RE.test(contenido)) {
        await castigar(message, client, am.invitaciones, am, 'Discord invites are not allowed');
        return true;
    }

    // 3. Enlaces externos (con lista blanca de dominios).
    if (am.enlaces?.activo && URL_RE.test(contenido)) {
        const texto = contenido.toLowerCase();
        const permitido = (am.enlaces.listaBlanca || []).some((d) => d && texto.includes(d.toLowerCase()));
        if (!permitido) {
            await castigar(message, client, am.enlaces, am, 'Links are not allowed');
            return true;
        }
    }

    // 4. Menciones masivas.
    if (am.menciones?.activo) {
        const everyone = message.mentions.everyone && am.menciones.bloquearEveryone;
        const total = message.mentions.users.size + message.mentions.roles.size;
        if (everyone || total > (am.menciones.max || 5)) {
            await castigar(message, client, am.menciones, am, everyone ? '@everyone/@here is not allowed' : `Too many mentions (${total})`);
            return true;
        }
    }

    // 5. Exceso de mayúsculas (solo en mensajes con suficientes letras).
    if (am.mayusculas?.activo && contenido.length >= (am.mayusculas.minLongitud || 10)) {
        const letras = contenido.replace(/[^a-zA-ZáéíóúñüÁÉÍÓÚÑÜ]/g, '');
        if (letras.length >= 8) {
            const mays = (letras.match(/[A-ZÁÉÍÓÚÑÜ]/g) || []).length;
            const pct = (mays / letras.length) * 100;
            if (pct >= (am.mayusculas.porcentaje || 70)) {
                await castigar(message, client, am.mayusculas, am, `Too many capital letters (${Math.round(pct)}%)`);
                return true;
            }
        }
    }

    // 6. Anti-spam / flood (ventana deslizante en memoria).
    if (am.spam?.activo) {
        const clave = `${message.guildId}:${message.author.id}`;
        const ahora = Date.now();
        const ventanaMs = (am.spam.enSegundos || 5) * 1000;
        const lista = (historial.get(clave) || []).filter((e) => ahora - e.t < ventanaMs);
        lista.push({ t: ahora, contenido });
        historial.set(clave, lista);

        const flood = lista.length > (am.spam.maxMensajes || 5);
        const repetido = am.spam.repetidos && contenido.length > 0 && lista.length >= 3
            && lista.slice(-3).every((e) => e.contenido === contenido);
        if (flood || repetido) {
            historial.delete(clave);
            await castigar(message, client, am.spam, am, flood ? 'Spam (too many messages in a row)' : 'Repeated messages');
            return true;
        }
    }

    return false;
}

// Categorías de moderación que el admin dejó activas -> array de strings.
function categoriasActivas(ia) {
    const c = (ia && ia.categorias) || {};
    return Object.keys(c).filter((k) => c[k]);
}

// Moderación por IA (Pro). NO bloquea el flujo de mensajes: se llama SIN await
// desde messageCreate y, si la IA detecta una infracción de contexto (toxicidad,
// acoso, amenazas, NSFW...), borra/sanciona después. Acota el coste: solo con
// plan Pro, solo si queda cuota de IA y solo en mensajes con texto suficiente.
async function revisarConIA(message, cfg, client) {
    const am = cfg && cfg.automod;
    const ia = am && am.ia;
    if (!message.guild || !am || !am.activo || !ia || !ia.activo) return;
    if (!iaDisponible() || !esPro(cfg)) return;                // gate: clave de IA + plan Pro
    if ((am.canalesExentos || []).includes(message.channelId)) return;
    if (exento(message.member, am, cfg)) return;

    const contenido = (message.content || '').trim();
    if (contenido.length < (ia.minLongitud || 12)) return;     // mensajes muy cortos: no gastamos IA
    if (estadoIA(cfg).restantes <= 0) return;                  // sin cuota de IA este mes

    const cats = categoriasActivas(ia);
    if (!cats.length) return;

    let veredicto;
    try {
        veredicto = await moderarTexto(contenido, { categorias: cats, sensibilidad: ia.sensibilidad || 'media' });
    } catch (e) {
        console.error('Automod IA: error consultando la IA:', e.message);
        return;
    }
    // La llamada a la IA tiene coste: consumimos 1 uso de cuota (haya o no infracción).
    await consumirIA(message.guild.id, cfg).catch(() => {});

    if (!veredicto || !veredicto.accionar) return;
    await castigar(message, client, { accion: ia.accion, timeoutMin: ia.timeoutMin }, am, `IA: ${veredicto.motivo}`);
}

// Publica una alerta del automod en el canal configurado (raids, etc.).
async function enviarAlerta(client, guild, am, payload) {
    const id = am && am.canalAlertasId;
    if (!id || !guild) return;
    const canal = guild.channels.cache.get(id);
    if (!canal) return;
    await canal.send(payload).catch(() => {});
}

module.exports = { revisarMensaje, revisarConIA, enviarAlerta, ESTAFA_DEFECTO };
