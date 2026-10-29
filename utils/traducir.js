// Traducir (clic derecho en un mensaje → Apps → Traducir): traduce el mensaje al
// idioma de quien lo pide (el de su Discord, o el que eligió en /preferencias).
// Primero con un traductor gratuito (MyMemory, sin clave); si falla o se acaba su
// cupo diario, con la IA del servidor si la tiene (y le quedan usos este mes).
const { t } = require('./i18n.js');

const TROZO = 450; // MyMemory admite ~500 caracteres por petición

// Código de idioma que entienden los traductores a partir del de Discord.
function idiomaDestino(locale, preferido) {
    if (preferido === 'es' || preferido === 'en') return preferido;
    const l = String(locale || 'en');
    if (['pt-BR', 'zh-CN', 'zh-TW'].includes(l)) return l;
    return l.split('-')[0] || 'en';
}

// Nombre del idioma en el idioma de quien lee ('francés', 'French').
function nombreIdioma(codigo, idioma) {
    try { return new Intl.DisplayNames([idioma], { type: 'language' }).of(codigo) || codigo; } catch { return codigo; }
}

// Parte el texto en trozos de como mucho `max` caracteres, por frases si se puede.
function trocear(texto, max = TROZO) {
    const trozos = [];
    let resto = String(texto).trim();
    while (resto.length > max) {
        let corte = Math.max(resto.lastIndexOf('. ', max), resto.lastIndexOf('\n', max), resto.lastIndexOf('! ', max), resto.lastIndexOf('? ', max));
        if (corte < max / 2) corte = resto.lastIndexOf(' ', max);
        const fin = corte < max / 2 ? max : corte + 1;
        trozos.push(resto.slice(0, fin).trim());
        resto = resto.slice(fin).trim();
    }
    if (resto) trozos.push(resto);
    return trozos;
}

async function conMyMemory(texto, destino) {
    const partes = [];
    let origen = null;
    for (const trozo of trocear(texto)) {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trozo)}&langpair=${encodeURIComponent(`autodetect|${destino}`)}`;
        const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
        const j = await r.json().catch(() => null);
        // Si el texto ya está en el idioma de destino, MyMemory lo dice así.
        if (j && /DISTINCT LANGUAGES/i.test(String(j.responseDetails || ''))) return { mismo: true };
        if (!j || j.quotaFinished || Number(j.responseStatus) !== 200 || !j.responseData) throw new Error('MyMemory');
        origen = origen || j.responseData.detectedLanguage || null;
        partes.push(j.responseData.translatedText || '');
    }
    return { texto: partes.join(' '), origen, motor: 'MyMemory' };
}

// Devuelve { texto, origen, motor } o { mismo: true } si ya está en ese idioma.
async function traducir(texto, destino, cfg) {
    const base = destino.split('-')[0];
    try {
        const r = await conMyMemory(texto, destino);
        if (r.mismo || (r.origen && r.origen.split('-')[0] === base)) return { mismo: true };
        return r;
    } catch (e) {
        const ia = require('./ia.js');
        const { estadoIA, consumirIA } = require('./billing.js');
        if (!ia.iaDisponible() || !cfg || estadoIA(cfg).restantes <= 0) throw new Error('sin-traductor');
        const traducido = await ia.traducirTexto(texto, destino);
        await consumirIA(cfg.guildId, cfg).catch(() => {});
        return traducido === null ? { mismo: true } : { texto: traducido, origen: null, motor: 'IA' };
    }
}

// Respuesta para el clic derecho (solo la ve quien lo pide).
async function respuestaTraduccion(mensaje, { locale, preferido, idioma, cfg }) {
    const texto = (mensaje.content || '').trim();
    if (!texto) return t(idioma, '🤷 Ese mensaje no tiene texto que traducir.', '🤷 That message has no text to translate.');
    const destino = idiomaDestino(locale, preferido);
    let r;
    try { r = await traducir(texto.slice(0, 4000), destino, cfg); } catch {
        return t(idioma, '😕 Ahora mismo no puedo traducir (el traductor gratuito ha llegado a su límite de hoy). Prueba más tarde.', '😕 I can’t translate right now (the free translator has hit today’s limit). Try again later.');
    }
    if (r.mismo) return t(idioma, `✅ Ese mensaje ya está en ${nombreIdioma(destino, idioma)}.`, `✅ That message is already in ${nombreIdioma(destino, idioma)}.`);
    const de = r.origen ? t(idioma, ` del ${nombreIdioma(r.origen, 'es')}`, ` from ${nombreIdioma(r.origen, 'en')}`) : '';
    const pie = t(idioma, `🌐 Traducido${de} · ${r.motor}`, `🌐 Translated${de} · ${r.motor}`);
    return `${r.texto.slice(0, 1900 - pie.length)}\n\n-# ${pie}`;
}

module.exports = { idiomaDestino, trocear, traducir, respuestaTraduccion, nombreIdioma };
