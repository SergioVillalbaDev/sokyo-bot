// ============================================================================
// «#reglas» → mención de canal de verdad (<#id>).
// En Discord, un mensaje del bot solo enlaza un canal si lleva <#id>; escribir
// «#reglas» en el panel quedaba como texto. Aquí se busca un canal del servidor
// con ese nombre y se cambia por su mención (enlace azul que se puede pulsar).
// Tolerante: no distingue mayúsculas, tildes ni los adornos del nombre
// («📜・reglas» vale con «#reglas»). Si no hay canal con ese nombre, se deja igual.
// Lo usa utils/bienvenida.js (bienvenidas y despedidas).
// ============================================================================
const { ChannelType } = require('discord.js');

// Solo letras y números, en minúsculas y sin tildes: «📜・Reglas-Del-Server» → «reglasdelserver».
const normalizar = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');

// «#nombre»: no justo después de una letra, número, «<», «/», «:», «=» o «&»
// (así no toca <#123>, enlaces con #, ni «C#»), y el nombre acaba en un espacio
// o en un signo de puntuación. «# Título» (con espacio) no es un canal.
const PATRON = /(?<![\p{L}\p{N}<\/:=&#])#([^\s#<>@.,;:!?¡¿()"'[\]{}*~|`]+)/gu;

// Busca el canal: primero por el nombre exacto, luego por el nombre normalizado.
// Si hay varios, el que está más arriba. Nunca categorías.
function buscarCanal(canales, escrito) {
    const exacto = escrito.toLowerCase();
    const norm = normalizar(escrito);
    if (!norm) return null;
    const candidatos = canales.filter((c) => c && c.type !== ChannelType.GuildCategory);
    const ordenar = (a, b) => (a.rawPosition ?? a.position ?? 0) - (b.rawPosition ?? b.position ?? 0);
    const exactos = candidatos.filter((c) => String(c.name).toLowerCase() === exacto).sort(ordenar);
    if (exactos.length) return exactos[0];
    return candidatos.filter((c) => normalizar(c.name) === norm).sort(ordenar)[0] || null;
}

// Cambia cada «#nombre» que sea un canal del servidor por su mención.
function mencionarCanales(texto, guild) {
    const s = String(texto || '');
    if (!s.includes('#') || !guild || !guild.channels) return s;
    const canales = [...guild.channels.cache.values()];
    return s.replace(PATRON, (todo, nombre) => {
        // «_#reglas_» (cursiva): los «_» del final son del formato, salvo que el
        // canal se llame así de verdad.
        const sinCola = nombre.replace(/_+$/, '');
        const exacto = sinCola !== nombre && canales.find((c) => c && c.type !== ChannelType.GuildCategory && String(c.name).toLowerCase() === nombre.toLowerCase());
        if (exacto) return `<#${exacto.id}>`;
        const canal = sinCola && buscarCanal(canales, sinCola);
        return canal ? `<#${canal.id}>${nombre.slice(sinCola.length)}` : todo;
    });
}

// Lo mismo para un mensaje entero: el texto, la descripción del embed y el valor
// de sus campos (donde Discord enseña los enlaces). Devuelve copias.
function mencionarEnMensaje(contenido, embed, guild) {
    const texto = mencionarCanales(contenido, guild);
    if (!embed) return { contenido: texto, embed };
    const copia = { ...embed, descripcion: mencionarCanales(embed.descripcion, guild) };
    if (Array.isArray(embed.campos)) copia.campos = embed.campos.map((c) => ({ ...c, valor: mencionarCanales(c && c.valor, guild) }));
    return { contenido: texto, embed: copia };
}

module.exports = { mencionarCanales, mencionarEnMensaje, normalizar };
