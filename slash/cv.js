// /cv — Gestión del CV para la búsqueda de empleo (solo OWNER_IDS).
//   /cv subir        — sube un PDF/DOCX, se extrae y estructura con la IA.
//   /cv foto         — sube una foto opcional, para las ofertas que la piden.
//   /cv ver          — muestra el perfil guardado, para confirmar que se leyó bien.
//   /cv autobusqueda — activa/desactiva el barrido diario automático.
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const PerfilEmpleo = require('../models/PerfilEmpleo.js');
const { extraerTextoCV, extensionValida, TAMANO_MAXIMO_BYTES, extensionFotoValida, guardarFoto, TAMANO_MAXIMO_FOTO_BYTES } = require('../utils/cvParser.js');
const { estructurarPerfilCV } = require('../utils/ia.js');

const OWNER_IDS = new Set((process.env.OWNER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean));

async function subirCV(interaction) {
    const adjunto = interaction.options.getAttachment('archivo');
    if (!extensionValida(adjunto.name || '')) {
        return interaction.editReply('⛔ Only .pdf and .docx files are accepted.');
    }
    if (adjunto.size > TAMANO_MAXIMO_BYTES) {
        return interaction.editReply('⛔ File too large (max 5MB).');
    }

    const res = await fetch(adjunto.url);
    if (!res.ok) return interaction.editReply('⛔ Could not download the attachment.');
    const buffer = Buffer.from(await res.arrayBuffer());

    let texto;
    try {
        texto = await extraerTextoCV(buffer, adjunto.name);
    } catch (e) {
        return interaction.editReply(`⛔ Couldn't read the file: ${e.message}`);
    }
    if (!texto || texto.length < 50) {
        return interaction.editReply('⛔ Couldn\'t extract meaningful text from the file.');
    }

    const cvEstructurado = await estructurarPerfilCV(texto, 'en');

    await PerfilEmpleo.updateOne(
        { discordId: interaction.user.id },
        {
            $set: {
                cvTexto: texto,
                cvEstructurado,
                archivoOriginalNombre: adjunto.name,
                archivoOriginalTipo: adjunto.contentType || '',
            },
        },
        { upsert: true },
    );

    const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('✅ CV saved')
        .setDescription(cvEstructurado.resumen || '(no summary extracted)')
        .addFields({ name: 'Skills', value: (cvEstructurado.habilidades || []).join(', ').slice(0, 1024) || '—' });

    return interaction.editReply({ embeds: [embed] });
}

async function subirFoto(interaction) {
    const adjunto = interaction.options.getAttachment('archivo');
    const ext = extensionFotoValida(adjunto.name || '');
    if (!ext) return interaction.editReply('⛔ Only .jpg, .jpeg or .png images are accepted.');
    if (adjunto.size > TAMANO_MAXIMO_FOTO_BYTES) return interaction.editReply('⛔ Photo too large (max 5MB).');

    const res = await fetch(adjunto.url);
    if (!res.ok) return interaction.editReply('⛔ Could not download the attachment.');
    const buffer = Buffer.from(await res.arrayBuffer());

    const ruta = guardarFoto(buffer, interaction.user.id, ext);
    await PerfilEmpleo.updateOne({ discordId: interaction.user.id }, { $set: { fotoRuta: ruta } }, { upsert: true });

    return interaction.editReply('✅ Photo saved. It\'ll be added automatically to the CV for offers that ask for one.');
}

async function verCV(interaction) {
    const perfil = await PerfilEmpleo.findOne({ discordId: interaction.user.id }).lean();
    if (!perfil || !perfil.cvEstructurado || !perfil.cvEstructurado.resumen) {
        return interaction.editReply('You haven\'t uploaded a CV yet — use `/cv subir`.');
    }
    const cv = perfil.cvEstructurado;
    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('📄 Your stored CV profile')
        .setDescription(cv.resumen || '—')
        .addFields(
            { name: 'Skills', value: (cv.habilidades || []).join(', ').slice(0, 1024) || '—' },
            { name: 'Experience', value: (cv.experiencia || []).map((e) => `• ${e.puesto} @ ${e.empresa}`).join('\n').slice(0, 1024) || '—' },
        )
        .setFooter({ text: `File: ${perfil.archivoOriginalNombre || '—'} · Photo: ${perfil.fotoRuta ? 'saved' : 'none (use /cv foto)'}` });
    return interaction.editReply({ embeds: [embed] });
}

async function autobusqueda(interaction) {
    const activar = interaction.options.getBoolean('activar');
    const puesto = interaction.options.getString('puesto');
    const ubicacion = interaction.options.getString('ubicacion');
    const hora = interaction.options.getInteger('hora');

    const perfil = await PerfilEmpleo.findOne({ discordId: interaction.user.id });
    if (!perfil || !perfil.cvEstructurado || !perfil.cvEstructurado.resumen) {
        return interaction.editReply('Upload a CV first with `/cv subir`.');
    }
    if (activar && !puesto && !(perfil.busquedaAuto && perfil.busquedaAuto.puesto)) {
        return interaction.editReply('Give a `puesto` (job title) the first time you activate this.');
    }

    const set = {};
    if (activar !== null) set['busquedaAuto.activo'] = activar;
    if (puesto !== null) set['busquedaAuto.puesto'] = puesto;
    if (ubicacion !== null) set['busquedaAuto.ubicacion'] = ubicacion;
    if (hora !== null) set['busquedaAuto.hora'] = hora;

    await PerfilEmpleo.updateOne({ discordId: interaction.user.id }, { $set: set });
    const actualizado = await PerfilEmpleo.findOne({ discordId: interaction.user.id }).lean();
    const ba = actualizado.busquedaAuto || {};
    return interaction.editReply(`${ba.activo ? '✅ Daily auto-search ON' : '⏸️ Daily auto-search OFF'} — puesto: "${ba.puesto || '—'}", ubicación: "${ba.ubicacion || '—'}", hora UTC: ${ba.hora ?? 9}`);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cv')
        .setDescription('📄 Manage your CV for the job search feature (owners only)')
        .addSubcommand((sub) => sub
            .setName('subir')
            .setDescription('Upload your CV (PDF or DOCX)')
            .addAttachmentOption((opt) => opt.setName('archivo').setDescription('Your CV file (.pdf or .docx)').setRequired(true)))
        .addSubcommand((sub) => sub
            .setName('foto')
            .setDescription('Upload a photo, used automatically for offers that ask for one')
            .addAttachmentOption((opt) => opt.setName('archivo').setDescription('Your photo (.jpg or .png)').setRequired(true)))
        .addSubcommand((sub) => sub
            .setName('ver')
            .setDescription('Show your stored CV profile'))
        .addSubcommand((sub) => sub
            .setName('autobusqueda')
            .setDescription('Enable/disable the daily automatic job search')
            .addBooleanOption((opt) => opt.setName('activar').setDescription('Turn the daily auto-search on/off'))
            .addStringOption((opt) => opt.setName('puesto').setDescription('Job title to search for'))
            .addStringOption((opt) => opt.setName('ubicacion').setDescription('Location (optional)'))
            .addIntegerOption((opt) => opt.setName('hora').setDescription('UTC hour to run it (0-23)').setMinValue(0).setMaxValue(23))),

    async execute(interaction) {
        if (!OWNER_IDS.has(interaction.user.id)) {
            return interaction.reply({ content: '⛔ This command is only for the bot owners.', ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: true });

        const sub = interaction.options.getSubcommand();
        if (sub === 'subir') return subirCV(interaction);
        if (sub === 'foto') return subirFoto(interaction);
        if (sub === 'ver') return verCV(interaction);
        if (sub === 'autobusqueda') return autobusqueda(interaction);
    },
};
