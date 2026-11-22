const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const { PermissionFlagsBits } = require('discord.js');
const mascota = require('../utils/mascota.js');
const vida = require('../utils/mascotaVida.js');
const X = require('../utils/mascotaExtras.js');
const Mascota = require('../models/Mascota.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');
const { t } = require('../utils/i18n.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });
const MEDALLAS = ['🥇', '🥈', '🥉'];

// /mascota ver · alimentar · acariciar · jugar · cuidadores · proteger
module.exports = {
    data: new SlashCommandBuilder()
        .setName('pet')
        .setNameLocalizations(ES('mascota'))
        .setDescription('The server pet: look after it together')
        .setDescriptionLocalizations(ES('La mascota del servidor: cuidadla entre todos'))
        .setContexts(InteractionContextType.Guild)
        .addSubcommand((s) => s.setName('view').setNameLocalizations(ES('ver'))
            .setDescription('How the pet is doing and what it unlocks')
            .setDescriptionLocalizations(ES('Cómo está la mascota y qué desbloquea')))
        .addSubcommand((s) => s.setName('feed').setNameLocalizations(ES('alimentar'))
            .setDescription('Feed it with gold (10 gold = 1% food)')
            .setDescriptionLocalizations(ES('Dale de comer con oro (10 de oro = 1 % de comida)'))
            .addIntegerOption((o) => o.setName('gold').setNameLocalizations(ES('oro')).setDescription('How much gold (it only takes what fits)').setDescriptionLocalizations(ES('Cuánto oro (solo coge lo que le cabe)')).setRequired(true).setMinValue(10).setMaxValue(1000)))
        .addSubcommand((s) => s.setName('pet').setNameLocalizations(ES('acariciar'))
            .setDescription('Pet it (once a day): it cheers it up')
            .setDescriptionLocalizations(ES('Acaríciala (una vez al día): la alegra')))
        .addSubcommand((s) => s.setName('play').setNameLocalizations(ES('jugar'))
            .setDescription('Find the treat under the cups')
            .setDescriptionLocalizations(ES('Encuentra la golosina debajo de los vasos')))
        .addSubcommand((s) => s.setName('carers').setNameLocalizations(ES('cuidadores'))
            .setDescription('Who looks after it the most this month')
            .setDescriptionLocalizations(ES('Quién la cuida más este mes')))
        .addSubcommand((s) => s.setName('train').setNameLocalizations(ES('entrenar'))
            .setDescription('Train it for battles (once an hour per person, uses its energy)')
            .setDescriptionLocalizations(ES('Entrénala para los combates (una vez por hora, gasta su energía)'))
            .addStringOption((o) => o.setName('stat').setNameLocalizations(ES('atributo')).setDescription('What to train').setDescriptionLocalizations(ES('Qué entrenar')).setRequired(true)
                .addChoices(...Object.entries(X.STATS).map(([id, v]) => ({ name: `${v.emoji} ${v.en}`, name_localizations: ES(`${v.emoji} ${v.es}`), value: id })))))
        .addSubcommand((s) => s.setName('shop').setNameLocalizations(ES('tienda'))
            .setDescription('Special food, accessories and habitats for the pet')
            .setDescriptionLocalizations(ES('Comida especial, accesorios y hábitats para la mascota')))
        .addSubcommand((s) => s.setName('dress').setNameLocalizations(ES('vestir'))
            .setDescription('(Staff) Change its accessory or habitat (among the ones it has)')
            .setDescriptionLocalizations(ES('(Staff) Cambia su accesorio o su hábitat (de los que tiene)'))
            .addStringOption((o) => o.setName('accessory').setNameLocalizations(ES('accesorio')).setDescription('Accessory').setDescriptionLocalizations(ES('Accesorio'))
                .addChoices({ name: '❌ None', name_localizations: ES('❌ Ninguno'), value: 'ninguno' }, ...Object.entries(X.ACCESORIOS).map(([id, a]) => ({ name: `${a.emoji} ${a.en}`, name_localizations: ES(`${a.emoji} ${a.es}`), value: id }))))
            .addStringOption((o) => o.setName('habitat').setNameLocalizations(ES('habitat')).setDescription('Habitat').setDescriptionLocalizations(ES('Hábitat'))
                .addChoices(...Object.entries(X.HABITATS).map(([id, h]) => ({ name: h.en, name_localizations: ES(h.es), value: id })))))
        .addSubcommand((s) => s.setName('talk').setNameLocalizations(ES('hablar'))
            .setDescription('Say hi and see what it tells you')
            .setDescriptionLocalizations(ES('Salúdala y mira qué te cuenta')))
        .addSubcommand((s) => s.setName('diary').setNameLocalizations(ES('diario'))
            .setDescription('Its memories and achievements')
            .setDescriptionLocalizations(ES('Sus recuerdos y sus logros')))
        .addSubcommand((s) => s.setName('protect').setNameLocalizations(ES('proteger'))
            .setDescription('(Level 15) The pet protects someone from pranks for 6 h')
            .setDescriptionLocalizations(ES('(Nivel 15) La mascota protege a alguien de las bromas 6 h'))
            .addUserOption((o) => o.setName('member').setNameLocalizations(ES('miembro')).setDescription('Who').setDescriptionLocalizations(ES('A quién')).setRequired(true))),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        const sub = interaction.options.getSubcommand();
        const gid = interaction.guildId;
        const uid = interaction.user.id;
        const privado = (content) => interaction.reply({ content, flags: 64 });
        if (!cfg?.mascota?.activo) return privado(t(idioma, '🐾 Este servidor no tiene mascota. El staff puede activarla en el panel (Diversión → Mascota).', '🐾 This server has no pet. The staff can turn it on in the panel (Fun → Pet).'));

        if (sub === 'view') {
            const m = await Mascota.findOne({ guildId: gid });
            if (!m) return privado(t(idioma, '🥚 El huevo aparecerá en unos minutos en su canal.', '🥚 The egg will appear in its channel in a few minutes.'));
            if (m.estado === 'huevo') return privado(t(idioma, `🥚 Todavía es un huevo. Votad su especie y su nombre en <#${m.votacion?.canalId || cfg.mascota.canalId}>.`, `🥚 It’s still an egg. Vote for its species and name in <#${m.votacion?.canalId || cfg.mascota.canalId}>.`));
            await interaction.deferReply();
            const adj = await mascota.tarjeta(m, idioma);
            return interaction.editReply({ embeds: [mascota.embedMascota(m, idioma, { imagen: !!adj })], files: adj ? [adj] : [], allowedMentions: { parse: [] } });
        }
        if (sub === 'feed') {
            const r = await mascota.alimentar(gid, uid, interaction.options.getInteger('gold'), idioma, interaction.member?.displayName || interaction.user.username);
            if (r.error) return privado(`❌ ${r.error}`);
            const extra = r.desperto ? t(idioma, ` ¡Y se ha despertado! ☀️`, ` And it woke up! ☀️`) : '';
            return interaction.reply({ content: t(idioma, `🍖 <@${uid}> le ha dado de comer a **${r.m.nombre}** (🪙 ${r.usado}). Comida: **${r.m.hambre}%**.${extra}`, `🍖 <@${uid}> fed **${r.m.nombre}** (🪙 ${r.usado}). Food: **${r.m.hambre}%**.${extra}`), allowedMentions: { parse: [] } });
        }
        if (sub === 'pet') {
            const r = await mascota.acariciar(gid, uid, idioma);
            if (r.error) return privado(`❌ ${r.error}`);
            const frases = t(idioma,
                [`ronronea feliz`, `cierra los ojos de gusto`, `da una voltereta de alegría`, `te lame la mano`],
                [`purrs happily`, `closes its eyes in delight`, `does a happy flip`, `licks your hand`]);
            const f = frases[Math.floor(Math.random() * frases.length)];
            return interaction.reply({ content: `${mascota.emojiDe(r.m)} **${r.m.nombre}** ${f} 💕${r.oro ? t(idioma, ` (+🪙 ${r.oro})`, ` (+🪙 ${r.oro})`) : ''}`, allowedMentions: { parse: [] } });
        }
        if (sub === 'play') {
            const r = await mascota.empezarJuego(gid, uid, idioma);
            if (r.error) return privado(`❌ ${r.error}`);
            return interaction.reply({ ...r.payload, allowedMentions: { parse: [] } });
        }
        if (sub === 'carers') {
            const lista = await mascota.rankingCuidadores(gid, 10);
            const texto = lista.length
                ? lista.map((c, i) => `${MEDALLAS[i] || `**${i + 1}.**`} <@${c.userId}> — ${c.puntos} ${t(idioma, 'puntos', 'points')}`).join('\n')
                : t(idioma, 'Nadie la ha cuidado todavía este mes. ¡Sé el primero!', 'Nobody has looked after it yet this month. Be the first!');
            return interaction.reply({ content: `${t(idioma, '🏅 **Cuidadores de este mes**', '🏅 **This month’s carers**')}\n${texto}\n-# ${t(idioma, 'El primero a final de mes es el «Cuidador del mes».', 'Whoever is first at the end of the month becomes “Carer of the month”.')}`, allowedMentions: { parse: [] } });
        }
        if (sub === 'train') {
            const stat = interaction.options.getString('stat');
            const r = await vida.entrenar(client, cfg, gid, uid, stat, idioma);
            if (r.error) return privado(`❌ ${r.error}`);
            const v = X.STATS[stat];
            const frases = {
                fuerza: t(idioma, 'levanta piedras enormes', 'lifts huge rocks'),
                defensa: t(idioma, 'aguanta los golpes sin moverse', 'takes the hits without budging'),
                agilidad: t(idioma, 'esquiva todo lo que le lanzas', 'dodges everything you throw'),
            };
            return interaction.reply({ content: t(idioma,
                `🏋️ <@${uid}> entrena con **${r.m.nombre}**, que ${frases[stat]}. ${v.emoji} ${v.es} **${r.nuevo}** (+${r.sube})${r.perfecto ? ' ✨ ¡Entreno perfecto!' : ''} · ⚡ ${r.m.energia}%`,
                `🏋️ <@${uid}> trains with **${r.m.nombre}**, who ${frases[stat]}. ${v.emoji} ${v.en} **${r.nuevo}** (+${r.sube})${r.perfecto ? ' ✨ Perfect session!' : ''} · ⚡ ${r.m.energia}%`), allowedMentions: { parse: [] } });
        }
        if (sub === 'shop') {
            const m = await Mascota.findOne({ guildId: gid, estado: 'viva' });
            if (!m) return privado(t(idioma, 'Todavía no hay mascota (o sigue en el huevo).', 'There’s no pet yet (or it’s still an egg).'));
            return interaction.reply({ embeds: [vida.embedTienda(m, idioma)], components: [vida.menuTienda(m, idioma)], flags: 64 });
        }
        if (sub === 'dress') {
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return privado(t(idioma, 'Solo el staff (con «Gestionar servidor») puede cambiarle el aspecto. Si le compras algo en `/mascota tienda`, se lo pone al momento.', 'Only staff (with “Manage Server”) can change its look. If you buy it something in `/pet shop`, it wears it right away.'));
            const acc = interaction.options.getString('accessory');
            const hab = interaction.options.getString('habitat');
            if (!acc && !hab) return privado(t(idioma, 'Elige un accesorio o un hábitat.', 'Pick an accessory or a habitat.'));
            for (const [tipo, id] of [['accesorio', acc === 'ninguno' ? null : acc], ['habitat', hab]]) {
                if ((tipo === 'accesorio' && acc === null) || (tipo === 'habitat' && !hab)) continue;
                const r = await vida.vestir(gid, tipo, id);
                if (r.fallo) return privado(r.fallo === 'noTiene' ? t(idioma, 'Todavía no lo tiene: se compra en `/mascota tienda`.', 'It doesn’t have that yet: buy it in `/pet shop`.') : t(idioma, 'Todavía no hay mascota.', 'There’s no pet yet.'));
            }
            const m = await Mascota.findOne({ guildId: gid });
            await interaction.deferReply();
            const adj = await mascota.tarjeta(m, idioma);
            return interaction.editReply({ content: t(idioma, `🎨 ¡Así ha quedado **${m.nombre}**!`, `🎨 Here’s **${m.nombre}**’s new look!`), files: adj ? [adj] : [], allowedMentions: { parse: [] } });
        }
        if (sub === 'talk') {
            const r = await vida.hablar(gid, idioma);
            if (r.error) return privado(`❌ ${r.error}`);
            return interaction.reply({ content: `${mascota.emojiDe(r.m)} **${r.m.nombre}:** ${r.texto}`, allowedMentions: { parse: [] } });
        }
        if (sub === 'diary') {
            const m = await Mascota.findOne({ guildId: gid, estado: 'viva' }).lean();
            if (!m) return privado(t(idioma, 'Todavía no hay mascota (o sigue en el huevo).', 'There’s no pet yet (or it’s still an egg).'));
            return interaction.reply({ embeds: [vida.embedDiario(m, idioma)], allowedMentions: { parse: [] } });
        }
        if (sub === 'protect') {
            const objetivo = interaction.options.getUser('member');
            const r = await mascota.proteger(gid, uid, objetivo.id, idioma);
            if (r.error) return privado(`❌ ${r.error}`);
            return interaction.reply({ content: t(idioma, `🛡️ **${r.m.nombre}** protege a <@${objetivo.id}> de las bromas hasta <t:${Math.floor(r.hasta / 1000)}:t>.`, `🛡️ **${r.m.nombre}** protects <@${objetivo.id}> from pranks until <t:${Math.floor(r.hasta / 1000)}:t>.`), allowedMentions: { users: [objetivo.id] } });
        }
        return privado('?');
    },
};
