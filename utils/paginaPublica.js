// ============================================================================
// paginaPublica — Crecimiento: página pública de cada servidor (/s/<dirección>)
// y directorio de servidores con Sokyo (/servidores).
//
// Se generan en el servidor (no en el navegador): así, al compartir el enlace en
// WhatsApp, Discord, X… sale la vista previa con el nombre y el icono, y Google
// puede indexarlas. El botón "Unirse" usa una invitación permanente que crea el
// propio bot, de modo que las entradas desde la web se reconocen en Invitaciones.
// ============================================================================
const { ChannelType, PermissionsBitField } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const Evento = require('../models/Evento.js');
const ActividadUsuario = require('../models/ActividadUsuario.js');

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;
const MAX_ETIQUETAS = 5;

// "Los Tokyto 🍣" -> "los-tokyto". Vacío si no queda nada utilizable.
function slugDe(texto) {
    return String(texto || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
        .slice(0, 32).replace(/-+$/g, '');
}
const slugValido = (s) => SLUG_RE.test(String(s || ''));

function limpiarEtiquetas(lista) {
    const vistas = new Set();
    return (Array.isArray(lista) ? lista : [])
        .map((e) => String(e || '').replace(/[<>#]/g, '').trim().slice(0, 24))
        .filter((e) => e && !vistas.has(e.toLowerCase()) && vistas.add(e.toLowerCase()))
        .slice(0, MAX_ETIQUETAS);
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// URL pública base (https://dashboard.sokyo.studio). FRONTEND_URL si es absoluta;
// si no, la del propio dominio por el que ha llegado la petición.
function urlBase(req) {
    const env = process.env.FRONTEND_URL || '';
    if (/^https?:\/\//.test(env) && !/localhost|127\.0\.0\.1/.test(env)) return env.replace(/\/+$/, '');
    return req ? `${req.protocol}://${req.get('host')}` : env.replace(/\/+$/, '');
}

const urlInvitarBot = () => (process.env.DISCORD_CLIENT_ID
    ? `https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=8&scope=bot+applications.commands`
    : '/');

// ----------------------------- datos ----------------------------------------

// Miembros y conectados aproximados (los da Discord con withCounts). 10 min de caché.
const contadores = new Map();
async function contar(client, guild) {
    const c = contadores.get(guild.id);
    if (c && Date.now() - c.t < 10 * 60 * 1000) return c;
    const g = await client.guilds.fetch({ guild: guild.id, withCounts: true, force: true }).catch(() => null);
    const v = {
        miembros: (g && g.approximateMemberCount) || guild.memberCount || 0,
        enLinea: (g && g.approximatePresenceCount) || null,
        t: Date.now(),
    };
    contadores.set(guild.id, v);
    return v;
}

// Canal donde el bot puede crear la invitación: el elegido, el de mensajes del
// sistema o el primer canal de texto donde tenga permiso.
function canalParaInvitar(guild, preferido) {
    const me = guild.members.me;
    const ok = (c) => c && c.type === ChannelType.GuildText && c.permissionsFor(me)?.has(PermissionsBitField.Flags.CreateInstantInvite);
    const elegido = preferido && guild.channels.cache.get(preferido);
    if (ok(elegido)) return elegido;
    if (ok(guild.systemChannel)) return guild.systemChannel;
    return guild.channels.cache.filter(ok).sort((a, b) => a.rawPosition - b.rawPosition).first() || null;
}

// Devuelve el código de una invitación permanente del bot que siga viva (la crea
// si hace falta). `forzar` vuelve a comprobarla aunque se haya mirado hace poco.
const comprobadas = new Map();
async function asegurarInvitacion(client, guild, cfg, { forzar = false } = {}) {
    const p = cfg.crecimiento.pagina;
    let codigo = p.invitacionCodigo;
    const visto = codigo && comprobadas.get(codigo);
    if (codigo && !forzar && visto && Date.now() - visto < 30 * 60 * 1000) return codigo;
    if (codigo) {
        const inv = await client.fetchInvite(codigo).catch((e) => (e.code === 10006 ? null : 'error'));
        if (inv === 'error') return codigo; // Discord no responde: se usa la que había
        if (inv && inv.guild && inv.guild.id === guild.id && (!inv.channel || !p.canalInvitacionId || inv.channel.id === p.canalInvitacionId)) {
            comprobadas.set(codigo, Date.now());
            return codigo;
        }
    }
    const canal = canalParaInvitar(guild, p.canalInvitacionId);
    if (!canal) return null;
    const nueva = await canal.createInvite({ maxAge: 0, maxUses: 0, unique: true, reason: 'Sokyo: página pública del servidor' }).catch(() => null);
    if (!nueva) return null;
    codigo = nueva.code;
    comprobadas.set(codigo, Date.now());
    await ServidorConfig.updateOne({ guildId: guild.id }, { $set: { 'crecimiento.pagina.invitacionCodigo': codigo } });
    return codigo;
}

// Todo lo que se muestra en la página de un servidor (o null si no está publicada).
async function datosServidor(client, slug) {
    if (!slugValido(slug)) return null;
    const cfg = await ServidorConfig.findOne({ 'crecimiento.pagina.slug': slug, 'crecimiento.pagina.activo': true });
    const guild = cfg && client.guilds.cache.get(cfg.guildId);
    if (!guild) return null;
    const p = cfg.crecimiento.pagina;
    const [n, codigo, eventos, ranking] = await Promise.all([
        contar(client, guild),
        asegurarInvitacion(client, guild, cfg).catch(() => null),
        p.mostrarEventos ? Evento.find({ guildId: guild.id, fechaInicio: { $gte: new Date() } }).sort({ fechaInicio: 1 }).limit(3).lean() : [],
        p.mostrarRanking && cfg.nivelesActivo
            ? ActividadUsuario.find({ guildId: guild.id, xp: { $gt: 0 } }).sort({ xp: -1 }).limit(5).select('usuarioTag nivel').lean()
            : [],
    ]);
    return {
        cfg,
        guildId: guild.id,
        slug: p.slug,
        nombre: guild.name,
        icono: guild.iconURL({ size: 256, extension: 'png' }),
        banner: guild.bannerURL({ size: 1024, extension: 'png' }) || (guild.splashURL && guild.splashURL({ size: 1024, extension: 'png' })) || null,
        descripcion: (p.descripcion || guild.description || '').slice(0, 1000),
        etiquetas: p.etiquetas || [],
        miembros: n.miembros,
        enLinea: n.enLinea,
        nivelBoost: guild.premiumTier || 0,
        idioma: cfg.idioma === 'es' ? 'es' : 'en',
        invitacion: codigo ? `https://discord.gg/${codigo}` : null,
        eventos: eventos.map((e) => ({ titulo: e.titulo, descripcion: e.descripcion || '', fecha: e.fechaInicio, portada: e.portada || null })),
        ranking: ranking.filter((r) => r.usuarioTag).map((r) => ({ nombre: r.usuarioTag, nivel: r.nivel || 0 })),
    };
}

// Servidores del directorio (publicados y listados), de más a menos miembros.
let cacheDirectorio = null;
async function datosDirectorio(client) {
    if (cacheDirectorio && Date.now() - cacheDirectorio.t < 2 * 60 * 1000) return cacheDirectorio.lista;
    const cfgs = await ServidorConfig.find({ 'crecimiento.pagina.activo': true, 'crecimiento.pagina.listado': true, 'crecimiento.pagina.slug': { $type: 'string' } })
        .select('guildId idioma crecimiento.pagina').lean();
    const lista = [];
    for (const cfg of cfgs) {
        const guild = client.guilds.cache.get(cfg.guildId);
        if (!guild) continue;
        const p = cfg.crecimiento.pagina;
        lista.push({
            slug: p.slug,
            nombre: guild.name,
            icono: guild.iconURL({ size: 128, extension: 'png' }),
            descripcion: (p.descripcion || guild.description || '').slice(0, 220),
            etiquetas: p.etiquetas || [],
            miembros: (contadores.get(guild.id) || {}).miembros || guild.memberCount || 0,
            idioma: cfg.idioma === 'es' ? 'es' : 'en',
        });
    }
    lista.sort((a, b) => b.miembros - a.miembros);
    cacheDirectorio = { lista, t: Date.now() };
    return lista;
}
const olvidarDirectorio = () => { cacheDirectorio = null; };

const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function filtrarDirectorio(lista, { q = '', etiqueta = '' } = {}) {
    const nq = normalizar(q).trim();
    const ne = normalizar(etiqueta).trim();
    return lista.filter((s) => {
        if (ne && !s.etiquetas.some((e) => normalizar(e) === ne)) return false;
        if (!nq) return true;
        return normalizar(`${s.nombre} ${s.descripcion} ${s.etiquetas.join(' ')}`).includes(nq);
    });
}

// Visitas: una por persona y página cada 6 h (sin contar bots de buscadores).
const visitas = new Map();
async function contarVisita(guildId, ip, agente) {
    if (/bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|discord/i.test(agente || '')) return;
    const clave = `${guildId}|${ip}`;
    const ahora = Date.now();
    if (visitas.has(clave) && ahora - visitas.get(clave) < 6 * 3600 * 1000) return;
    visitas.set(clave, ahora);
    if (visitas.size > 20000) for (const [k, v] of visitas) if (ahora - v > 6 * 3600 * 1000) visitas.delete(k);
    await ServidorConfig.updateOne({ guildId }, { $inc: { 'crecimiento.pagina.visitas': 1 } }).catch(() => {});
}

// ----------------------------- HTML -----------------------------------------

const TEXTO = {
    es: {
        miembros: (n) => `${n.toLocaleString('es-ES')} miembros`,
        enLinea: (n) => `${n.toLocaleString('es-ES')} conectados`,
        boost: (n) => `Mejora nivel ${n}`,
        unirse: 'Unirse al servidor',
        sinInvitacion: 'La invitación no está disponible ahora mismo.',
        compartir: 'Compartir',
        copiado: '¡Enlace copiado!',
        eventos: 'Próximos eventos',
        ranking: 'Los más activos',
        nivel: (n) => `Nivel ${n}`,
        explorar: 'Explorar servidores',
        hecho: 'Página creada con',
        anadir: 'Añade Sokyo a tu servidor',
        dirTitulo: 'Servidores de Discord con Sokyo',
        dirDesc: 'Descubre comunidades que usan Sokyo y únete a la que más te guste.',
        buscar: 'Buscar por nombre, tema o etiqueta…',
        buscarBtn: 'Buscar',
        todas: 'Todas',
        ver: 'Ver servidor',
        vacio: 'No hay servidores que coincidan con tu búsqueda.',
        vacioTodo: 'Todavía no hay servidores en el directorio.',
        tuServidor: '¿Quieres que aparezca el tuyo? Activa su página en el panel de Sokyo → Crecimiento → Página pública.',
        noExiste: 'Esta página no existe',
        noExisteDesc: 'Puede que el servidor la haya desactivado o que la dirección esté mal escrita.',
        inicio: 'Ir al inicio',
        descDefecto: (n) => `Únete a ${n} en Discord.`,
    },
    en: {
        miembros: (n) => `${n.toLocaleString('en-US')} members`,
        enLinea: (n) => `${n.toLocaleString('en-US')} online`,
        boost: (n) => `Boost level ${n}`,
        unirse: 'Join the server',
        sinInvitacion: 'The invite isn’t available right now.',
        compartir: 'Share',
        copiado: 'Link copied!',
        eventos: 'Upcoming events',
        ranking: 'Most active',
        nivel: (n) => `Level ${n}`,
        explorar: 'Browse servers',
        hecho: 'Page made with',
        anadir: 'Add Sokyo to your server',
        dirTitulo: 'Discord servers with Sokyo',
        dirDesc: 'Discover communities that use Sokyo and join the one you like most.',
        buscar: 'Search by name, topic or tag…',
        buscarBtn: 'Search',
        todas: 'All',
        ver: 'View server',
        vacio: 'No servers match your search.',
        vacioTodo: 'There are no servers in the directory yet.',
        tuServidor: 'Want yours listed? Turn on its page in the Sokyo panel → Growth → Public page.',
        noExiste: 'This page doesn’t exist',
        noExisteDesc: 'The server may have turned it off, or the address may be misspelled.',
        inicio: 'Go home',
        descDefecto: (n) => `Join ${n} on Discord.`,
    },
};

const CSS = `
:root{--bg:#07080f;--card:#0e1020;--el:#181a2c;--fg:#e9ebf7;--muted:#9498b3;--line:#1e2036;--accent:#9db4fa;--from:#b4d8fc;--to:#7860c0;--on:#0a0b18;--discord:#5865F2}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;min-height:100vh;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;color:var(--fg);line-height:1.55;
background:radial-gradient(900px 500px at 10% -10%,rgba(120,96,192,.22),transparent 60%),radial-gradient(800px 500px at 100% 0,rgba(157,180,250,.14),transparent 60%),var(--bg);background-attachment:fixed}
a{color:inherit}
.cab{max-width:1080px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 20px}
.marca{display:flex;align-items:center;gap:10px;text-decoration:none;font-weight:800;letter-spacing:-.02em;font-size:18px}
.marca img{width:34px;height:34px;border-radius:50%;object-fit:cover}
.enlace{font-size:14px;font-weight:600;color:var(--muted);text-decoration:none;padding:8px 12px;border-radius:10px;border:1px solid var(--line);background:rgba(14,16,32,.6);white-space:nowrap}
.enlace:hover{color:var(--fg);border-color:#2c2f4d}
main{max-width:1080px;margin:0 auto;padding:0 20px 56px}
.tarjeta{background:var(--card);border:1px solid var(--line);border-radius:24px;overflow:hidden;box-shadow:0 18px 50px -24px rgba(0,0,0,.7)}
.banner{height:170px;background:linear-gradient(135deg,var(--from),var(--to));background-size:cover;background-position:center}
.cuerpo{padding:0 24px 26px}
.cabecera{display:flex;align-items:flex-end;gap:18px;margin-top:-46px;flex-wrap:wrap}
.icono{width:104px;height:104px;border-radius:28px;border:5px solid var(--card);background:var(--el);object-fit:cover;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:800;color:var(--accent)}
h1{margin:12px 0 4px;font-size:clamp(26px,5vw,36px);line-height:1.15;letter-spacing:-.03em;word-break:break-word}
.datos{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 0;padding:0;list-style:none}
.dato{font-size:13px;font-weight:600;color:var(--muted);background:var(--el);border:1px solid var(--line);border-radius:999px;padding:5px 11px;display:flex;align-items:center;gap:6px}
.punto{width:8px;height:8px;border-radius:50%;background:#4ade80;display:inline-block}
.etiquetas{display:flex;flex-wrap:wrap;gap:7px;margin-top:14px}
.etiqueta{font-size:12px;font-weight:700;color:var(--accent);background:rgba(157,180,250,.1);border:1px solid rgba(157,180,250,.25);border-radius:999px;padding:4px 10px;text-decoration:none}
.desc{margin:18px 0 0;font-size:16px;color:#cfd2ea;white-space:pre-line;word-break:break-word}
.acciones{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;font:inherit;font-weight:700;font-size:16px;border-radius:14px;padding:13px 22px;text-decoration:none;cursor:pointer;border:0;transition:transform .15s,opacity .15s}
.btn:hover{transform:translateY(-1px)}
.btn-discord{background:var(--discord);color:#fff;box-shadow:0 10px 30px -10px rgba(88,101,242,.7)}
.btn-sec{background:var(--el);color:var(--fg);border:1px solid var(--line)}
.aviso{color:var(--muted);font-size:14px;margin-top:18px}
.rejilla{display:grid;gap:16px;margin-top:22px;grid-template-columns:repeat(auto-fill,minmax(280px,1fr))}
.seccion{margin-top:22px}
.seccion h2{font-size:18px;margin:0 0 12px;letter-spacing:-.01em}
.lista{display:grid;gap:10px}
.fila{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px 14px}
.fila img{width:56px;height:56px;border-radius:12px;object-fit:cover;flex-shrink:0}
.fila b{display:block}
.tenue{color:var(--muted);font-size:13px}
.pos{width:28px;text-align:center;font-weight:800;color:var(--accent)}
.srv{display:flex;flex-direction:column;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:20px;padding:18px;text-decoration:none;transition:border-color .15s,transform .15s}
.srv:hover{border-color:#34385e;transform:translateY(-2px)}
.srv-cab{display:flex;align-items:center;gap:12px;min-width:0}
.srv-cab img,.srv-cab .icono{width:52px;height:52px;border-radius:14px;border:0;font-size:22px;flex-shrink:0}
.srv-cab b{display:block;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.srv p{margin:0;color:#c3c6e0;font-size:14px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.titulo{font-size:clamp(28px,6vw,44px);letter-spacing:-.035em;line-height:1.1;margin:20px 0 8px}
.grad{background:linear-gradient(135deg,var(--from),var(--to));-webkit-background-clip:text;background-clip:text;color:transparent}
.buscador{display:flex;gap:8px;margin-top:22px;flex-wrap:wrap}
.buscador input{flex:1 1 240px;min-width:0;font:inherit;font-size:15px;color:var(--fg);background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px;outline:none}
.buscador input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(157,180,250,.25)}
.btn-marca{background:linear-gradient(135deg,var(--from),var(--to));color:var(--on)}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.chip{font-size:13px;font-weight:600;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:6px 12px;text-decoration:none;background:var(--card)}
.chip.on{color:var(--on);background:var(--accent);border-color:var(--accent)}
.vacio{text-align:center;color:var(--muted);padding:48px 16px;border:1px dashed var(--line);border-radius:20px;margin-top:22px}
.pie{max-width:1080px;margin:0 auto;padding:26px 20px 40px;color:var(--muted);font-size:13px;display:flex;flex-wrap:wrap;gap:10px 18px;justify-content:center;border-top:1px solid var(--line)}
.pie a{color:var(--accent);text-decoration:none;font-weight:600}
@media (max-width:520px){.banner{height:120px}.cuerpo{padding:0 16px 20px}.icono{width:84px;height:84px;border-radius:22px;font-size:32px}.cabecera{margin-top:-38px}.btn{width:100%}main{padding:0 16px 44px}.cab{padding:14px 16px}}
`;

function documento({ lang, titulo, descripcion, url, imagen, cuerpo, indexar = true }) {
    return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descripcion)}">
${indexar ? `<link rel="canonical" href="${esc(url)}">` : '<meta name="robots" content="noindex">'}
<meta name="theme-color" content="#07080f">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Sokyo">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descripcion)}">
<meta property="og:url" content="${esc(url)}">
${imagen ? `<meta property="og:image" content="${esc(imagen)}">` : ''}
<meta name="twitter:card" content="summary">
<link rel="icon" href="/assets/logo.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
<style>${CSS}</style>
</head>
<body>
${cuerpo}
</body>
</html>`;
}

const cabecera = (L) => `<header class="cab">
<a class="marca" href="/"><img src="/assets/logo.jpg" alt="" width="34" height="34">Sokyo</a>
<a class="enlace" href="/servidores">${esc(L.explorar)}</a>
</header>`;

const pie = (L) => `<footer class="pie">
<span>${esc(L.hecho)} <a href="/">Sokyo</a></span>
<a href="${esc(urlInvitarBot())}" rel="noopener">${esc(L.anadir)}</a>
<a href="/servidores">${esc(L.explorar)}</a>
</footer>`;

const inicial = (nombre) => esc((Array.from(String(nombre || '?').trim())[0] || '?').toUpperCase());
const icono = (url, nombre, cls = 'icono') => (url
    ? `<img class="${cls}" src="${esc(url)}" alt="" width="104" height="104">`
    : `<div class="${cls}" aria-hidden="true">${inicial(nombre)}</div>`);

function paginaServidor(d, base) {
    const L = TEXTO[d.idioma];
    const url = `${base}/s/${d.slug}`;
    const resumen = (d.descripcion || L.descDefecto(d.nombre)).replace(/\s+/g, ' ').slice(0, 200);
    const datos = [
        `<li class="dato">👥 ${esc(L.miembros(d.miembros))}</li>`,
        d.enLinea ? `<li class="dato"><span class="punto"></span>${esc(L.enLinea(d.enLinea))}</li>` : '',
        d.nivelBoost ? `<li class="dato">🚀 ${esc(L.boost(d.nivelBoost))}</li>` : '',
    ].join('');
    const etiquetas = d.etiquetas.length
        ? `<div class="etiquetas">${d.etiquetas.map((e) => `<a class="etiqueta" href="/servidores?etiqueta=${encodeURIComponent(e)}">#${esc(e)}</a>`).join('')}</div>`
        : '';
    const unirse = d.invitacion
        ? `<a class="btn btn-discord" href="${esc(d.invitacion)}" rel="nofollow noopener">
<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.3 18.3 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18.1a19.9 19.9 0 0 0 6 3l1.3-2.1a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.8 19.8 0 0 0 6-3c.5-5.2-.8-9.7-3.6-13.7ZM8 15.4c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.6 8 10.6s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z"/></svg>
${esc(L.unirse)}</a>`
        : `<p class="aviso">${esc(L.sinInvitacion)}</p>`;
    const eventos = d.eventos.length ? `<section class="seccion"><h2>📅 ${esc(L.eventos)}</h2><div class="lista">${d.eventos.map((e) => `
<div class="fila">${e.portada ? `<img src="${esc(e.portada)}" alt="" loading="lazy">` : ''}<div><b>${esc(e.titulo)}</b>
<span class="tenue"><time datetime="${esc(new Date(e.fecha).toISOString())}">${esc(new Date(e.fecha).toLocaleString(d.idioma === 'es' ? 'es-ES' : 'en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }))} UTC</time></span>
${e.descripcion ? `<div class="tenue">${esc(e.descripcion.slice(0, 160))}</div>` : ''}</div></div>`).join('')}</div></section>` : '';
    const ranking = d.ranking.length ? `<section class="seccion"><h2>🏆 ${esc(L.ranking)}</h2><div class="lista">${d.ranking.map((r, i) => `
<div class="fila"><span class="pos">${['🥇', '🥈', '🥉'][i] || i + 1}</span><div><b>${esc(r.nombre)}</b><span class="tenue">${esc(L.nivel(r.nivel))}</span></div></div>`).join('')}</div></section>` : '';

    const cuerpo = `${cabecera(L)}
<main>
<article class="tarjeta">
<div class="banner"${d.banner ? ` style="background-image:url('${esc(d.banner)}')"` : ''}></div>
<div class="cuerpo">
<div class="cabecera">${icono(d.icono, d.nombre)}</div>
<h1>${esc(d.nombre)}</h1>
<ul class="datos">${datos}</ul>
${etiquetas}
${d.descripcion ? `<p class="desc">${esc(d.descripcion)}</p>` : ''}
<div class="acciones">${unirse}
<button class="btn btn-sec" type="button" id="compartir" data-url="${esc(url)}" data-titulo="${esc(d.nombre)}" data-ok="${esc(L.copiado)}">🔗 ${esc(L.compartir)}</button>
</div>
</div>
</article>
${eventos}${ranking}
</main>
${pie(L)}
<script>
(function(){
  // Fechas de los eventos en la zona horaria de quien visita.
  document.querySelectorAll('time[datetime]').forEach(function(t){
    try { t.textContent = new Date(t.getAttribute('datetime')).toLocaleString(document.documentElement.lang === 'es' ? 'es-ES' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) {}
  });
  var b = document.getElementById('compartir');
  if (!b) return;
  b.addEventListener('click', function(){
    var url = b.getAttribute('data-url');
    if (navigator.share) { navigator.share({ title: b.getAttribute('data-titulo'), url: url }).catch(function(){}); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(function(){ var t = b.textContent; b.textContent = b.getAttribute('data-ok'); setTimeout(function(){ b.textContent = t; }, 1800); });
  });
})();
</script>`;
    return documento({ lang: d.idioma, titulo: `${d.nombre} · Discord`, descripcion: resumen, url, imagen: d.icono, cuerpo });
}

function paginaDirectorio(lista, { lang, base, q = '', etiqueta = '' }) {
    const L = TEXTO[lang];
    const filtrados = filtrarDirectorio(lista, { q, etiqueta });
    // Las etiquetas más usadas, para filtrar con un toque.
    const cuenta = new Map();
    for (const s of lista) for (const e of s.etiquetas) cuenta.set(e, (cuenta.get(e) || 0) + 1);
    const top = [...cuenta.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([e]) => e);
    const enlace = (e) => `/servidores?${new URLSearchParams({ ...(q ? { q } : {}), ...(e ? { etiqueta: e } : {}) })}`;
    const chips = top.length ? `<nav class="chips" aria-label="tags"><a class="chip${etiqueta ? '' : ' on'}" href="${esc(enlace(''))}">${esc(L.todas)}</a>${top.map((e) => `<a class="chip${normalizar(e) === normalizar(etiqueta) ? ' on' : ''}" href="${esc(enlace(e))}">#${esc(e)}</a>`).join('')}</nav>` : '';
    const tarjetas = filtrados.length
        ? `<div class="rejilla">${filtrados.slice(0, 120).map((s) => `
<a class="srv" href="/s/${esc(s.slug)}">
<div class="srv-cab">${icono(s.icono, s.nombre)}<div style="min-width:0"><b>${esc(s.nombre)}</b><span class="tenue">👥 ${esc(TEXTO[lang].miembros(s.miembros))}</span></div></div>
${s.descripcion ? `<p>${esc(s.descripcion)}</p>` : ''}
${s.etiquetas.length ? `<div class="etiquetas" style="margin-top:0">${s.etiquetas.map((e) => `<span class="etiqueta">#${esc(e)}</span>`).join('')}</div>` : ''}
</a>`).join('')}</div>`
        : `<div class="vacio">${esc(lista.length ? L.vacio : L.vacioTodo)}<br><br>${esc(L.tuServidor)}</div>`;
    const cuerpo = `${cabecera(L)}
<main>
<h1 class="titulo"><span class="grad">${esc(L.dirTitulo)}</span></h1>
<p class="tenue" style="font-size:16px;margin:0">${esc(L.dirDesc)}</p>
<form class="buscador" method="get" action="/servidores" role="search">
<input type="search" name="q" value="${esc(q)}" placeholder="${esc(L.buscar)}" aria-label="${esc(L.buscar)}">
${etiqueta ? `<input type="hidden" name="etiqueta" value="${esc(etiqueta)}">` : ''}
<button class="btn btn-marca" type="submit">${esc(L.buscarBtn)}</button>
</form>
${chips}
${tarjetas}
${lista.length ? `<p class="aviso" style="text-align:center;margin-top:28px">${esc(L.tuServidor)}</p>` : ''}
</main>
${pie(L)}`;
    const filtrado = !!(q || etiqueta);
    return documento({ lang, titulo: `${L.dirTitulo} · Sokyo`, descripcion: L.dirDesc, url: `${base}/servidores`, imagen: `${base}/og-image.png`, cuerpo, indexar: !filtrado });
}

function paginaNoEncontrada(lang) {
    const L = TEXTO[lang];
    const cuerpo = `${cabecera(L)}
<main><div class="vacio" style="margin-top:40px"><h1 style="margin-top:0">${esc(L.noExiste)}</h1><p>${esc(L.noExisteDesc)}</p>
<div class="acciones" style="justify-content:center"><a class="btn btn-marca" href="/servidores">${esc(L.explorar)}</a><a class="btn btn-sec" href="/">${esc(L.inicio)}</a></div></div></main>
${pie(L)}`;
    return documento({ lang, titulo: `${L.noExiste} · Sokyo`, descripcion: L.noExisteDesc, url: '/', cuerpo, indexar: false });
}

module.exports = {
    SLUG_RE, MAX_ETIQUETAS, slugDe, slugValido, limpiarEtiquetas, esc, urlBase,
    asegurarInvitacion, canalParaInvitar, datosServidor, datosDirectorio, olvidarDirectorio, filtrarDirectorio, contarVisita,
    paginaServidor, paginaDirectorio, paginaNoEncontrada,
};
