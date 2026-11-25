// ⚙️ /configurar (1.34.0): encender y apagar funciones desde Discord (admins: «Gestionar servidor»). Sale del catálogo
// (utils/catalogo.js): cada función con su estado (🟢/⚪), qué hace y un botón. «⚡ Activar» usa el mismo setup rápido
// que el panel (deja canales y todo listo) o pone su ajuste a true; «⏸️ Apagar» lo pone a false. Lo que necesita más
// (elegir canales, textos…) lleva a su sección del panel. Cada cambio se apunta en el historial («Deshacer» en el
// panel) y los comandos del servidor y la guía automática se ponen al día solos. Botones: cfg:ver · cfg:z:<zona> ·
// cfg:m (desplegable) · cfg:on:<mod> · cfg:off:<mod> · cfg:guia (canal «📖 Cómo funciona»). Último trozo = quien abrió.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const C = require('./catalogo.js');
const { urlPanel } = require('./enlacesPanel.js');
const { t } = require('./i18n.js');

const ZONAS_CFG = ['jugar', 'mascotas', 'comunidad', 'musica', 'crecimiento', 'staff'];
const conmutable = (m) => !!m.campo;
const valor = (cfg, ruta) => ruta.split('.').reduce((o, k) => (o == null ? o : o[k]), cfg);

function vista(cfg, idioma, userId, zona = null, modId = null, aviso = '') {
    const e = new EmbedBuilder().setColor('#64748b').setTitle(t(idioma, '⚙️ Configurar el bot', '⚙️ Set up the bot'));
    const filas = [];
    const m = modId ? C.modulo(modId) : null;
    if (m) {
        const on = m.activo(cfg);
        e.setTitle(`${m.emoji} ${t(idioma, m.es, m.en)} · ${on ? t(idioma, '🟢 encendido', '🟢 on') : t(idioma, '⚪ apagado', '⚪ off')}`)
            .setDescription([aviso, t(idioma, m.frase.es, m.frase.en), '', ...t(idioma, m.pasos.es, m.pasos.en).map((l) => `• ${l}`)].filter((x) => x !== null).join('\n'));
        const b = [];
        if (!on && m.activar) b.push(new ButtonBuilder().setCustomId(`cfg:on:${m.id}:${userId}`).setEmoji('⚡').setLabel(t(idioma, 'Activar con lo recomendado', 'Turn on with the defaults')).setStyle(ButtonStyle.Success));
        if (on && conmutable(m)) b.push(new ButtonBuilder().setCustomId(`cfg:off:${m.id}:${userId}`).setEmoji('⏸️').setLabel(t(idioma, 'Apagar', 'Turn off')).setStyle(ButtonStyle.Danger));
        if (m.tab) b.push(new ButtonBuilder().setURL(urlPanel(m.tab)).setEmoji('🛠️').setLabel(t(idioma, on || !m.activar ? 'Ajustarlo en el panel' : 'Elegir yo los detalles', on || !m.activar ? 'Adjust it in the panel' : 'Choose the details myself')).setStyle(ButtonStyle.Link));
        b.push(new ButtonBuilder().setCustomId(`cfg:z:${m.zona}:${userId}`).setEmoji('↩️').setLabel(t(idioma, 'Volver', 'Back')).setStyle(ButtonStyle.Secondary));
        filas.push(new ActionRowBuilder().addComponents(b));
    } else {
        const zs = zona ? [zona] : ZONAS_CFG;
        e.setDescription([aviso, t(idioma, 'Elige una función para ver qué hace y encenderla o apagarla. 🟢 = encendida · ⚪ = apagada.', 'Pick a feature to see what it does and turn it on or off. 🟢 = on · ⚪ = off.'), '',
            ...zs.map((z) => `${C.ZONAS[z].emoji} **${t(idioma, C.ZONAS[z].es, C.ZONAS[z].en)}**: ${C.MODULOS.filter((x) => x.zona === z).map((x) => `${x.activo(cfg) ? '🟢' : '⚪'} ${t(idioma, x.es, x.en)}`).join(' · ')}`)].filter((x) => x !== null).join('\n'));
        const mods = C.MODULOS.filter((x) => zs.includes(x.zona) && (conmutable(x) || x.activar || x.tab));
        filas.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`cfg:m:${userId}`).setPlaceholder(t(idioma, 'Elige una función…', 'Pick a feature…'))
            .addOptions(mods.slice(0, 25).map((x) => ({ value: x.id, emoji: x.emoji, label: `${x.activo(cfg) ? '🟢' : '⚪'} ${t(idioma, x.es, x.en)}`.slice(0, 100), description: t(idioma, x.frase.es, x.frase.en).slice(0, 100) })))));
        filas.push(new ActionRowBuilder().addComponents(ZONAS_CFG.slice(0, 5).map((z) => new ButtonBuilder().setCustomId(`cfg:z:${z}:${userId}`).setEmoji(C.ZONAS[z].emoji).setLabel(t(idioma, C.ZONAS[z].es, C.ZONAS[z].en).slice(0, 80)).setStyle(z === zona ? ButtonStyle.Primary : ButtonStyle.Secondary))));
        filas.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`cfg:guia:${userId}`).setEmoji('📖').setLabel(cfg?.guiaCanal?.activo ? t(idioma, 'Canal «Cómo funciona» (encendido)', '“How it works” channel (on)') : t(idioma, 'Crear el canal «Cómo funciona»', 'Create the “How it works” channel')).setStyle(cfg?.guiaCanal?.activo ? ButtonStyle.Secondary : ButtonStyle.Success),
            new ButtonBuilder().setURL(urlPanel('funciones')).setEmoji('🛠️').setLabel(t(idioma, 'Todo en el panel', 'Everything in the panel')).setStyle(ButtonStyle.Link)));
    }
    return { embeds: [e], components: filas };
}

// Apunta el cambio en el historial del panel (para «Deshacer») con quién lo hizo.
async function apuntar(guildId, user, antes, despues) {
    const H = require('./historialCambios.js');
    const claves = H.diferencias(antes, despues);
    if (!claves.length) return;
    const leer = (o, k) => k.split('.').reduce((x, p) => (x == null ? x : x[p]), o);
    await require('../models/CambioPanel.js').create({ guildId, usuarioId: user.id, usuarioNombre: user.username, secciones: [...new Set(claves.map(H.seccionDe))], claves, antes: claves.map((k) => leer(antes, k) ?? null), despues: claves.map((k) => leer(despues, k) ?? null) }).catch(() => {});
}

async function cambiar(interaction, client, modId, encender, idioma) {
    const ServidorConfig = require('../models/ServidorConfig.js');
    const m = C.modulo(modId);
    if (!m) return t(idioma, '❌ Esa función no existe.', '❌ That feature doesn’t exist.');
    const antes = await ServidorConfig.findOne({ guildId: interaction.guildId }).lean() || {};
    if (encender && String(m.activar).startsWith('setup:')) {
        const setup = require('./setupRapido.js');
        const clave = m.activar.slice(6);
        const { respuestas, error } = setup.validar({ uno: true, modulos: [clave], idioma: antes.idioma === 'es' ? 'es' : 'en' }, interaction.guild);
        if (error) return `❌ ${error}`;
        if (!setup.puedePasar(interaction.guildId, Date.now(), clave)) return t(idioma, '⏳ Un momento, ya se está preparando.', '⏳ One moment, it’s already being set up.');
        const r = await setup.aplicar(client, interaction.guild, respuestas, { idiomaTextos: idioma });
        const fallos = (r?.pasos || []).filter((p) => p.estado === 'error');
        if (fallos.length) return t(idioma, `⚠️ No se ha podido del todo: ${fallos.map((f) => f.detalle).join(' · ')}`.slice(0, 500), `⚠️ It couldn’t be fully done: ${fallos.map((f) => f.detalle).join(' · ')}`.slice(0, 500));
    } else if (m.campo) {
        await ServidorConfig.updateOne({ guildId: interaction.guildId }, { $set: { [m.campo]: !!encender } }, { upsert: true });
    } else return t(idioma, '🛠️ Esto se configura en el panel.', '🛠️ This is set up in the panel.');
    const despues = await ServidorConfig.findOne({ guildId: interaction.guildId }).lean() || {};
    await apuntar(interaction.guildId, interaction.user, antes, despues);
    void valor;
    return encender
        ? t(idioma, `✅ **${m.es}** encendido. Sus comandos aparecerán en unos segundos (escribe «/» para verlos).`, `✅ **${m.en}** turned on. Its commands will show up in a few seconds (type “/” to see them).`)
        : t(idioma, `⏸️ **${m.es}** apagado. Puedes deshacerlo en el panel → Historial de cambios.`, `⏸️ **${m.en}** turned off. You can undo it in the panel → Change history.`);
}

async function manejar(interaction, client) {
    const id = interaction.customId || '';
    if (!id.startsWith('cfg:')) return false;
    const { getConfigCached, invalidateConfig } = require('./config.js');
    const { idiomaInteraccion } = require('./preferencias.js');
    let cfg = await getConfigCached(interaction.guildId).catch(() => null) || {};
    const idioma = await idiomaInteraccion(interaction, cfg);
    const partes = id.split(':');
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: t(idioma, '⚙️ Solo los admins (con «Gestionar servidor») pueden configurar el bot.', '⚙️ Only admins (with “Manage server”) can set up the bot.'), flags: 64 });
        return true;
    }
    const tipo = partes[1]; const userId = interaction.user.id;
    const enviar = (v) => (interaction.message?.flags?.has?.(64) ? interaction.update(v) : interaction.reply({ ...v, flags: 64 }));
    if (tipo === 'ver') { await enviar(vista(cfg, idioma, userId)); return true; }
    if (tipo === 'z') { await enviar(vista(cfg, idioma, userId, partes[2])); return true; }
    if (tipo === 'm') { await enviar(vista(cfg, idioma, userId, null, interaction.values[0])); return true; }
    if (tipo === 'on' || tipo === 'off') {
        await interaction.deferUpdate().catch(() => {});
        const aviso = await cambiar(interaction, client, partes[2], tipo === 'on', idioma).catch((e) => `❌ ${e.message}`);
        invalidateConfig?.(interaction.guildId);
        cfg = await require('../models/ServidorConfig.js').findOne({ guildId: interaction.guildId }).lean() || {};
        await interaction.editReply(vista(cfg, idioma, userId, null, partes[2], aviso));
        return true;
    }
    if (tipo === 'guia') {
        if (interaction.isChannelSelectMenu?.()) {
            await interaction.deferUpdate();
            const r = await require('./guiaServidor.js').activar(interaction.guild, interaction.values[0], interaction.user).catch((e) => ({ error: e.message }));
            cfg = await require('../models/ServidorConfig.js').findOne({ guildId: interaction.guildId }).lean() || {};
            await interaction.editReply(vista(cfg, idioma, userId, null, null, r.error ? `❌ ${r.error}` : t(idioma, `📖 Listo: <#${interaction.values[0]}> explica todo lo que hay activo y se pone al día solo.`, `📖 Done: <#${interaction.values[0]}> explains everything that’s on and keeps itself up to date.`)));
            return true;
        }
        await enviar({ embeds: [new EmbedBuilder().setColor('#a855f7').setTitle(t(idioma, '📖 Canal «Cómo funciona»', '📖 “How it works” channel'))
            .setDescription(t(idioma, 'El bot escribe en ese canal una guía con **todo lo que hay encendido** (qué es, cómo se usa y con qué botón) y la **reescribe sola** cuando enciendes o apagas algo. Lo ideal: un canal donde solo escriba el bot.', 'The bot writes a guide in that channel with **everything that’s on** (what it is, how to use it and which button) and **rewrites it by itself** when you turn something on or off. Ideally a channel only the bot writes in.'))],
        components: [new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId(`cfg:guia:${userId}`).setChannelTypes(ChannelType.GuildText).setPlaceholder(t(idioma, 'Elige el canal…', 'Pick the channel…')))] });
        return true;
    }
    return false;
}

module.exports = { vista, cambiar, manejar, apuntarCambio: apuntar };
