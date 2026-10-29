// Ayuda antes de abrir un ticket: cuando alguien rellena el formulario del ticket,
// el bot busca la respuesta en las respuestas automáticas del servidor (su FAQ) y,
// si no hay una que encaje y el servidor lo quiere, le pide a la IA que responda
// usando SOLO esas respuestas. Si encuentra algo, pregunta «¿esto resuelve tu
// duda?»: con «Sí» no se abre el ticket (y se cuenta en el panel); con «No», se abre
// como siempre.
const crypto = require('crypto');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { t } = require('./i18n.js');

const VIGENCIA = 30 * 60 * 1000;
const pendientes = new Map(); // clave -> { guildId, userId, motivo, asunto, descripcion, momento }

const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const faqDe = (cfg) => (cfg?.autoRespuestas || []).filter((a) => a && a.activo !== false && a.patron && a.respuesta);

// La primera respuesta automática cuyo texto clave aparece en lo que ha escrito.
function buscarEnFAQ(cfg, texto) {
    const escrito = normalizar(texto);
    return faqDe(cfg).find((a) => {
        const patron = normalizar(a.patron).trim();
        return patron.length >= 3 && escrito.includes(patron);
    }) || null;
}

// { texto, fuente: 'faq' | 'ia' } o null si no hay nada que sugerir.
async function sugerencia(cfg, { asunto, descripcion }, idioma) {
    const hit = buscarEnFAQ(cfg, `${asunto}\n${descripcion}`);
    if (hit) return { texto: String(hit.respuesta).slice(0, 1800), fuente: 'faq' };
    if (cfg?.ayudaPrevia?.usarIA === false) return null;
    const ia = require('./ia.js');
    const { estadoIA, consumirIA } = require('./billing.js');
    const faq = faqDe(cfg);
    if (!faq.length || !ia.iaDisponible() || estadoIA(cfg).restantes <= 0) return null;
    try {
        const texto = await ia.responderConFAQ(faq.slice(0, 40), asunto, descripcion, idioma);
        await consumirIA(cfg.guildId, cfg).catch(() => {});
        return texto ? { texto: texto.slice(0, 1800), fuente: 'ia' } : null;
    } catch (e) {
        console.error('Ayuda previa (IA):', e.message);
        return null;
    }
}

function guardarPendiente(datos) {
    const ahora = Date.now();
    for (const [k, v] of pendientes) if (ahora - v.momento > VIGENCIA) pendientes.delete(k);
    const clave = crypto.randomBytes(6).toString('hex');
    pendientes.set(clave, { ...datos, momento: ahora });
    return clave;
}
// Solo quien abrió el formulario puede usar sus botones.
function tomarPendiente(clave, userId) {
    const p = pendientes.get(clave);
    if (!p || p.userId !== userId || Date.now() - p.momento > VIGENCIA) return null;
    pendientes.delete(clave);
    return p;
}

function mensajeSugerencia(sug, clave, idioma) {
    const embed = new EmbedBuilder()
        .setColor('#22c55e')
        .setTitle(t(idioma, '💡 Puede que esto te ayude', '💡 This might help'))
        .setDescription(sug.texto)
        .setFooter({ text: sug.fuente === 'ia'
            ? t(idioma, 'Respuesta escrita por la IA a partir de las respuestas del servidor', 'Answer written by AI from the server’s answers')
            : t(idioma, 'De las respuestas frecuentes del servidor', 'From the server’s frequent answers') });
    const fila = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`tkayuda_si:${clave}`).setStyle(ButtonStyle.Success).setEmoji('✅').setLabel(t(idioma, 'Sí, ya está resuelto', 'Yes, that solved it')),
        new ButtonBuilder().setCustomId(`tkayuda_no:${clave}`).setStyle(ButtonStyle.Secondary).setEmoji('📩').setLabel(t(idioma, 'No, abrir el ticket', 'No, open the ticket')),
    );
    return { content: t(idioma, 'Antes de abrir el ticket, ¿esto resuelve tu duda?', 'Before opening the ticket, does this answer your question?'), embeds: [embed], components: [fila] };
}

const marcarResuelta = (guildId) => ServidorConfig.updateOne({ guildId }, { $inc: { 'ayudaPrevia.resueltas': 1 } }).catch(() => {});

module.exports = { buscarEnFAQ, sugerencia, guardarPendiente, tomarPendiente, mensajeSugerencia, marcarResuelta };
