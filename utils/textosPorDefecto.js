// Textos de fábrica de la configuración en los dos idiomas del bot. Los valores
// por defecto del modelo están en inglés; si un servidor tiene el bot en español
// (o cambia de idioma), los textos que siguen EXACTAMENTE como venían de fábrica
// se pasan al otro idioma. Lo que el dueño haya personalizado no se toca nunca.
const ServidorConfig = require('../models/ServidorConfig.js');

// [ruta en la configuración, inglés, español]
const TEXTOS = [
    ['mensajeSoporteTitulo', '🎫 Support is open', '🎫 El soporte está abierto'],
    ['mensajeSoporteDescripcion', 'Click the button below to open a support ticket.', 'Pulsa el botón de abajo para abrir un ticket de soporte.'],
    ['footerPersonalizado', 'Sokyo management system', 'Sistema de gestión Sokyo'],
    ['textoBoton', '📩 Open a ticket', '📩 Abrir un ticket'],
    ['mensajeBienvenida', 'A team member will review it shortly.', 'Un miembro del equipo lo revisará en breve.'],
    ['mensajeSubida', '🎉 {mention} reached **level {level}**!', '🎉 ¡{mention} ha llegado al **nivel {level}**!'],
    ['verificacion.titulo', '🔒 Verification', '🔒 Verificación'],
    ['verificacion.descripcion', 'Click the button to verify and access the server.', 'Pulsa el botón para verificarte y acceder al servidor.'],
    ['verificacion.textoBoton', '✅ Verify me', '✅ Verificarme'],
    ['embudoAB.varianteA.titulo', '📋 Welcome — Read the rules', '📋 Bienvenida — Lee las normas'],
    ['embudoAB.varianteA.reglas', '1. Be respectful to everyone.\n2. No spam or advertising.\n3. Use channels for their topic.\n\nSolve the captcha to get access.', '1. Respeta a todo el mundo.\n2. Nada de spam ni publicidad.\n3. Usa cada canal para su tema.\n\nResuelve el captcha para entrar.'],
    ['embudoAB.varianteA.textoBoton', '✅ Accept and enter', '✅ Aceptar y entrar'],
    ['embudoAB.varianteB.titulo', '👋 Welcome!', '👋 ¡Te damos la bienvenida!'],
    ['embudoAB.varianteB.descripcion', 'We’re glad to have you here. Click **View rules** to get to know the community, then **Join** to access all channels.', 'Nos alegra tenerte aquí. Pulsa **Ver normas** para conocer la comunidad y después **Entrar** para acceder a todos los canales.'],
    ['embudoAB.varianteB.reglas', '1. Be respectful to everyone.\n2. No spam or advertising.\n3. Use channels for their topic.', '1. Respeta a todo el mundo.\n2. Nada de spam ni publicidad.\n3. Usa cada canal para su tema.'],
    ['embudoAB.varianteB.textoBoton', '🎉 Join', '🎉 Entrar'],
    ['bienvenida.contenido', 'Welcome {mention} to **{server}**! 🎉 We are now {members} members.', '¡Te damos la bienvenida a **{server}**, {mention}! 🎉 Ya somos {members} miembros.'],
    ['despedida.contenido', '👋 **{user}** left **{server}**. We are now {members}.', '👋 **{user}** ha salido de **{server}**. Ahora somos {members}.'],
    ['presentaciones.plantilla', 'Age: \nWhere you’re from: \nHobbies: \nWhy you’re joining: ', 'Edad: \nDe dónde eres: \nAficiones: \nPor qué te unes: '],
    ['vozTemporal.panelTitulo', '🔊 Your voice channel', '🔊 Tu canal de voz'],
    ['vozTemporal.panelDescripcion', 'Join the generator channel to create your room. Then use these buttons to manage it.', 'Entra en el canal generador para crear tu sala. Después usa estos botones para gestionarla.'],
    ['crecimiento.invitaciones.mensaje', '📨 {mention} joined thanks to {inviter}, who now has **{invitesText}**.', '📨 {mention} ha entrado gracias a {inviter}, que ya lleva **{invitesText}**.'],
    ['crecimiento.bump.mensajeRecordatorio', '⏰ The server can be bumped again! Use `/bump` from DISBOARD and earn gold 🪙', '⏰ ¡Ya se puede volver a hacer bump! Usa `/bump` de DISBOARD y gana oro 🪙'],
    ['crecimiento.bump.mensajeGracias', '🙌 Thanks for the bump, {mention}! Next bump {next}.', '🙌 ¡Gracias por el bump, {mention}! Próximo bump {next}.'],
    ['crecimiento.directos.mensaje', '🔴 **{streamer}** is live!', '🔴 ¡**{streamer}** está en directo!'],
    ['crecimiento.directos.mensajeVideo', '📺 **{streamer}** just posted on YouTube!', '📺 ¡**{streamer}** acaba de publicar en YouTube!'],
    ['crecimiento.directos.mensajePost', '📰 New post from **{streamer}**', '📰 Nueva publicación de **{streamer}**'],
    ['cumpleanos.mensaje', '🎂 Happy birthday {mention}! The whole **{server}** wishes you an amazing day 🎉', '🎂 ¡Feliz cumpleaños, {mention}! Todo **{server}** te desea un día genial 🎉'],
    ['solicitudes.titulo', '📝 Applications', '📝 Solicitudes'],
    ['solicitudes.descripcion', 'Want to join the team? Pick a form below and answer a few questions.', '¿Quieres formar parte del equipo? Elige un formulario y responde a unas preguntas.'],
];

// Motivos de ticket de fábrica (se comparan por nombre; la urgencia se conserva).
const MOTIVOS = [
    ['General support', 'Soporte general'],
    ['Report a user', 'Reportar a un usuario'],
    ['Donations', 'Donaciones'],
];

const leer = (obj, ruta) => ruta.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

// Calcula los cambios ($set) para dejar los textos de fábrica en `idioma`.
function cambiosParaIdioma(cfg, idioma) {
    const destino = idioma === 'es' ? 2 : 1;
    const origen = idioma === 'es' ? 1 : 2;
    const cambios = {};
    for (const fila of TEXTOS) {
        if (leer(cfg, fila[0]) === fila[origen]) cambios[fila[0]] = fila[destino];
    }
    const motivos = Array.isArray(cfg.motivos) ? cfg.motivos : [];
    const nombresOrigen = MOTIVOS.map((m) => m[origen - 1]);
    // Solo si la lista de motivos es la de fábrica tal cual (mismos nombres y orden).
    if (motivos.length === MOTIVOS.length && motivos.every((m, i) => m && m.nombre === nombresOrigen[i])) {
        cambios.motivos = motivos.map((m, i) => ({ nombre: MOTIVOS[i][destino - 1], urgencia: m.urgencia }));
    }
    return cambios;
}

// Adapta los textos de fábrica de un servidor a su idioma (o al indicado).
async function adaptarTextosAlIdioma(guildId, idioma) {
    // Documento completo (no lean): así cuentan también los valores por defecto de
    // campos añadidos al modelo después de crear la configuración.
    const cfg = await ServidorConfig.findOne({ guildId });
    if (!cfg) return {};
    const cambios = cambiosParaIdioma(cfg, idioma || cfg.idioma);
    if (Object.keys(cambios).length) await ServidorConfig.updateOne({ guildId }, { $set: cambios });
    return cambios;
}

// Texto de fábrica de un campo en un idioma (para rellenar un campo vacío).
function textoDeFabrica(ruta, idioma) {
    const fila = TEXTOS.find(([r]) => r === ruta);
    return fila ? (idioma === 'es' ? fila[2] : fila[1]) : '';
}

// Al arrancar: los servidores con el bot en español pasan a español los textos de
// fábrica que aún estaban en inglés (los valores por defecto del modelo). Los que
// están en inglés no se tocan: sus textos en español pueden ser elegidos a mano.
async function adaptarTodos() {
    const configs = await ServidorConfig.find({ idioma: 'es' }).select('guildId').lean();
    let adaptados = 0;
    for (const c of configs) {
        try {
            if (Object.keys(await adaptarTextosAlIdioma(c.guildId, 'es')).length) adaptados++;
        } catch (e) { console.error(`Error adaptando textos de ${c.guildId}:`, e.message); }
    }
    if (adaptados) console.log(`🌐 Textos de fábrica adaptados al idioma en ${adaptados} servidor(es).`);
}

// Nombres de urgencia de fábrica, solo para mostrarlos (se guardan en inglés porque
// son los identificadores con los que se enlazan motivos, tickets y colores).
const URGENCIAS_ES = { Urgent: 'Urgente', High: 'Alta', Normal: 'Normal', Low: 'Baja' };
const nombreUrgencia = (idioma, nombre) => (idioma === 'es' && URGENCIAS_ES[nombre]) || nombre;

module.exports = { cambiosParaIdioma, adaptarTextosAlIdioma, adaptarTodos, textoDeFabrica, nombreUrgencia, TEXTOS, MOTIVOS };
