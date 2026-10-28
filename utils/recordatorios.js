// Recordatorios personales (/recordar, !recordar, /recordatorios): crearlos,
// listarlos con su botón de borrar y posponerlos desde el propio aviso.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Recordatorio = require('../models/Recordatorio.js');
const { parseDuracion, formatoDuracion } = require('./duracion.js');
const { t } = require('./i18n.js');

const MAX_PENDIENTES = 25; // por persona, para que nadie llene la base de datos
const MAX_MS = 365 * 24 * 60 * 60 * 1000;
const MIN_MS = 60 * 1000;
const MOSTRAR = 10; // en /recordatorios

// Sugerencias del autocompletado de «cuándo»: [valor, es, en].
const SUGERENCIAS = [
    ['10m', 'Dentro de 10 minutos', 'In 10 minutes'],
    ['30m', 'Dentro de 30 minutos', 'In 30 minutes'],
    ['1h', 'Dentro de 1 hora', 'In 1 hour'],
    ['2h', 'Dentro de 2 horas', 'In 2 hours'],
    ['6h', 'Dentro de 6 horas', 'In 6 hours'],
    ['1d', 'Mañana a esta hora', 'Tomorrow at this time'],
    ['3d', 'Dentro de 3 días', 'In 3 days'],
    ['7d', 'Dentro de una semana', 'In a week'],
];

// Lo que se ve mientras se escribe el tiempo: si ya es válido, cuánto es; si no, ideas.
function opcionesCuando(escrito, idioma) {
    const txt = String(escrito || '').trim().toLowerCase();
    const ms = parseDuracion(txt);
    const out = [];
    if (ms >= MIN_MS && ms <= MAX_MS) {
        out.push({ name: t(idioma, `Dentro de ${formatoDuracion(ms)}`, `In ${formatoDuracion(ms)}`), value: txt.slice(0, 100) });
    } else if (/^\d+$/.test(txt)) {
        // Solo un número: se ofrece en minutos, horas o días.
        for (const [u, es, en] of [['m', 'minutos', 'minutes'], ['h', 'horas', 'hours'], ['d', 'días', 'days']]) {
            if (parseDuracion(txt + u) <= MAX_MS) out.push({ name: t(idioma, `Dentro de ${txt} ${es}`, `In ${txt} ${en}`), value: txt + u });
        }
    }
    for (const [v, es, en] of SUGERENCIAS) {
        if (out.length >= 25) break;
        if (!out.some((o) => o.value === v) && (!txt || v.startsWith(txt) || es.toLowerCase().includes(txt) || en.toLowerCase().includes(txt))) {
            out.push({ name: t(idioma, es, en), value: v });
        }
    }
    return out.slice(0, 25);
}

// Crea un recordatorio. Devuelve { ok, error?, fechaAviso?, ms? }.
async function crearRecordatorio({ guildId, canalId, userId, userTag, cuando, texto, porMD = false }, idioma) {
    const ms = parseDuracion(String(cuando || ''));
    if (!ms || ms < MIN_MS) {
        return { ok: false, error: t(idioma, '❌ No entiendo ese tiempo. Escribe, por ejemplo, `10m`, `2h` o `1d` (m = minutos, h = horas, d = días).', '❌ I don’t understand that time. Type, for example, `10m`, `2h` or `1d` (m = minutes, h = hours, d = days).') };
    }
    if (ms > MAX_MS) return { ok: false, error: t(idioma, '❌ El máximo es un año.', '❌ The maximum is one year.') };
    const pendientes = await Recordatorio.countDocuments({ userId, avisado: false });
    if (pendientes >= MAX_PENDIENTES) {
        return { ok: false, error: t(idioma, `❌ Ya tienes ${MAX_PENDIENTES} recordatorios pendientes. Borra alguno con \`/recordatorios\`.`, `❌ You already have ${MAX_PENDIENTES} pending reminders. Delete some with \`/reminders\`.`) };
    }
    const fechaAviso = new Date(Date.now() + ms);
    await Recordatorio.create({ guildId, canalId, userId, userTag, mensaje: String(texto || '').slice(0, 1500), fechaAviso, porMD: !!porMD });
    return { ok: true, fechaAviso, ms };
}

const marca = (fecha, estilo = 'R') => `<t:${Math.floor(new Date(fecha).getTime() / 1000)}:${estilo}>`;

function textoCreado(r, texto, porMD, idioma) {
    const donde = porMD ? t(idioma, ' por mensaje privado', ' by DM') : '';
    return t(idioma,
        `⏰ Hecho: te lo recordaré ${marca(r.fechaAviso)}${donde} (${marca(r.fechaAviso, 'f')})${texto ? `: «${texto}»` : ''}.\nMíralos o bórralos con \`/recordatorios\`.`,
        `⏰ Done: I’ll remind you ${marca(r.fechaAviso)}${donde} (${marca(r.fechaAviso, 'f')})${texto ? `: “${texto}”` : ''}.\nSee or delete them with \`/reminders\`.`);
}

// Lista de los pendientes con un botón de borrar para cada uno.
async function mensajeRecordatorios(userId, idioma) {
    const lista = await Recordatorio.find({ userId, avisado: false }).sort({ fechaAviso: 1 }).limit(MOSTRAR).lean();
    const total = await Recordatorio.countDocuments({ userId, avisado: false });
    const embed = new EmbedBuilder().setColor('#5865F2').setTitle(t(idioma, '⏰ Tus recordatorios', '⏰ Your reminders'));
    if (!lista.length) {
        embed.setDescription(t(idioma,
            'No tienes ninguno pendiente.\nCrea uno con `/recordar`: por ejemplo, **cuándo** `2h` y **qué** «sacar la basura».',
            'You have none pending.\nCreate one with `/remind`: for example, **when** `2h` and **what** “take out the trash”.'));
        return { embeds: [embed], components: [] };
    }
    embed.setDescription(lista.map((r, i) => `**${i + 1}.** ${marca(r.fechaAviso)} — ${(r.mensaje || t(idioma, '(sin texto)', '(no text)')).slice(0, 120)}${r.porMD ? ' ✉️' : ''}`).join('\n'));
    if (total > lista.length) embed.setFooter({ text: t(idioma, `…y ${total - lista.length} más. Se ven los ${MOSTRAR} más próximos.`, `…and ${total - lista.length} more. Showing the ${MOSTRAR} soonest.`) });
    else embed.setFooter({ text: t(idioma, 'Pulsa 🗑️ con su número para borrar uno.', 'Press 🗑️ with its number to delete one.') });
    const filas = [];
    for (let i = 0; i < lista.length; i += 5) {
        filas.push(new ActionRowBuilder().addComponents(lista.slice(i, i + 5).map((r, j) =>
            new ButtonBuilder().setCustomId(`rec_borrar:${r._id}`).setStyle(ButtonStyle.Secondary).setEmoji('🗑️').setLabel(String(i + j + 1)))));
    }
    return { embeds: [embed], components: filas };
}

// Botones del aviso: posponer 10 min o 1 h (solo la persona del recordatorio).
const filaPosponer = (id, idioma) => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`rec_pos:${id}:10`).setStyle(ButtonStyle.Secondary).setEmoji('💤').setLabel(t(idioma, '10 min más', '10 more min')),
    new ButtonBuilder().setCustomId(`rec_pos:${id}:60`).setStyle(ButtonStyle.Secondary).setEmoji('💤').setLabel(t(idioma, '1 hora más', '1 more hour')),
);

async function posponer(id, userId, minutos) {
    const r = await Recordatorio.findOne({ _id: id, userId }).catch(() => null);
    if (!r) return null;
    r.fechaAviso = new Date(Date.now() + minutos * 60000);
    r.avisado = false;
    await r.save();
    return r;
}

module.exports = { opcionesCuando, crearRecordatorio, textoCreado, mensajeRecordatorios, filaPosponer, posponer, MAX_PENDIENTES };
