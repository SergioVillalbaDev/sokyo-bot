// Validación de los cambios de configuración que llegan desde el panel web.
// Cualquier problema lanza un TicketError(400) con un mensaje listo para mostrar.
const { ChannelType } = require('discord.js');
const { TicketError } = require('../utils/ticketManager.js');

const HEX = /^#[0-9a-f]{6}$/i;
const CAMPOS_TEXTO = {
    mensajeSoporteTitulo: { nombre: 'El título del panel', min: 1, max: 256 },
    mensajeSoporteDescripcion: { nombre: 'La descripción del panel', min: 1, max: 4000 },
    footerPersonalizado: { nombre: 'El pie de página', min: 0, max: 200 },
    textoBoton: { nombre: 'El texto del botón', min: 1, max: 80 },
    mensajeBienvenida: { nombre: 'El mensaje de bienvenida', min: 0, max: 500 }
};
const MODULOS = ['valoraciones', 'transcriptDM', 'mencionarStaff', 'logsMensajes', 'logsMiembros'];
const CAMPOS_PANEL = ['mensajeSoporteTitulo', 'mensajeSoporteDescripcion', 'footerPersonalizado', 'colorPanel', 'textoBoton'];

const fallo = (mensaje) => { throw new TicketError(mensaje, 400); };

function texto(valor, nombre, { min = 0, max }) {
    if (typeof valor !== 'string') fallo(`${nombre} debe ser un texto.`);
    const limpio = valor.trim();
    if (limpio.length < min) fallo(min === 1 ? `${nombre} no puede estar vacío.` : `${nombre} es demasiado corto.`);
    if (limpio.length > max) fallo(`${nombre} no puede superar los ${max} caracteres.`);
    return limpio;
}

function color(valor, nombre) {
    if (typeof valor !== 'string' || !HEX.test(valor)) fallo(`${nombre} debe ser un color hexadecimal como #5865F2.`);
    return valor.toLowerCase();
}

function canalOpcional(guild, id, tipos, nombre) {
    if (id === null || id === '') return null;
    const canal = guild.channels.cache.get(String(id));
    if (!canal || !tipos.includes(canal.type)) fallo(`${nombre} no existe en el servidor.`);
    return canal.id;
}

function validarCambiosConfig(body, guild, actual) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) fallo('Datos de configuración no válidos.');
    const cambios = {};

    if ('urgencias' in body) {
        if (!Array.isArray(body.urgencias) || body.urgencias.length < 1 || body.urgencias.length > 10) fallo('Debe haber entre 1 y 10 niveles de urgencia.');
        const vistos = new Set();
        cambios.urgencias = body.urgencias.map(u => {
            const nombre = texto(u?.nombre, 'El nombre de la urgencia', { min: 1, max: 30 });
            if (vistos.has(nombre.toLowerCase())) fallo(`La urgencia "${nombre}" está repetida.`);
            vistos.add(nombre.toLowerCase());
            const nivel = Number(u?.nivel);
            if (!Number.isInteger(nivel) || nivel < 1 || nivel > 1000) fallo(`El nivel de "${nombre}" debe ser un número entero entre 1 y 1000.`);
            return { nombre, color: color(u?.color, `El color de "${nombre}"`), nivel };
        });
    }
    const urgencias = cambios.urgencias || actual.urgencias || [];
    const existeUrgencia = (nombre) => urgencias.some(u => u.nombre === nombre);

    if ('motivos' in body) {
        if (!Array.isArray(body.motivos) || body.motivos.length < 1) fallo('Debe haber al menos una categoría.');
        if (body.motivos.length > 25) fallo('Discord permite como máximo 25 categorías.');
        const vistos = new Set();
        cambios.motivos = body.motivos.map(m => {
            const nombre = texto(m?.nombre, 'El nombre de la categoría', { min: 1, max: 80 });
            if (vistos.has(nombre.toLowerCase())) fallo(`La categoría "${nombre}" está repetida.`);
            vistos.add(nombre.toLowerCase());
            if (!existeUrgencia(m?.urgencia)) fallo(`La categoría "${nombre}" usa una urgencia que no existe.`);
            return { nombre, urgencia: m.urgencia };
        });
    } else if (cambios.urgencias) {
        const huerfano = (actual.motivos || []).find(m => !existeUrgencia(m.urgencia));
        if (huerfano) fallo(`La categoría "${huerfano.nombre}" usa la urgencia "${huerfano.urgencia}". Cámbiala antes de eliminarla.`);
    }

    for (const [campo, reglas] of Object.entries(CAMPOS_TEXTO)) {
        if (campo in body) cambios[campo] = texto(body[campo], reglas.nombre, reglas);
    }
    if ('colorPanel' in body) cambios.colorPanel = color(body.colorPanel, 'El color del panel');

    if ('rolesStaff' in body) {
        if (!Array.isArray(body.rolesStaff) || body.rolesStaff.length > 10) fallo('Puedes elegir hasta 10 roles de staff.');
        cambios.rolesStaff = [...new Set(body.rolesStaff.map(String))].map(id => {
            if (id === guild.id || !guild.roles.cache.has(id)) fallo('Uno de los roles de staff no existe en el servidor.');
            return id;
        });
    }
    if ('categoriaTicketsId' in body) {
        cambios.categoriaTicketsId = canalOpcional(guild, body.categoriaTicketsId, [ChannelType.GuildCategory], 'La categoría de tickets');
    }
    const textuales = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
    if ('canalTranscriptsId' in body) cambios.canalTranscriptsId = canalOpcional(guild, body.canalTranscriptsId, textuales, 'El canal de transcripts');
    if ('canalLogsId' in body) cambios.canalLogsId = canalOpcional(guild, body.canalLogsId, textuales, 'El canal de auditoría');

    if ('maxTicketsPorUsuario' in body) {
        const max = Number(body.maxTicketsPorUsuario);
        if (!Number.isInteger(max) || max < 1 || max > 10) fallo('El límite de tickets por usuario debe estar entre 1 y 10.');
        cambios.maxTicketsPorUsuario = max;
    }

    if ('autoCierreHoras' in body) {
        const horas = Number(body.autoCierreHoras);
        if (!Number.isInteger(horas) || horas < 0 || horas > 720) fallo('El cierre por inactividad debe estar entre 0 (desactivado) y 720 horas.');
        cambios.autoCierreHoras = horas;
    }

    if ('modulos' in body) {
        if (!body.modulos || typeof body.modulos !== 'object') fallo('Módulos no válidos.');
        for (const clave of MODULOS) {
            if (clave in body.modulos) cambios[`modulos.${clave}`] = Boolean(body.modulos[clave]);
        }
    }

    if (Object.keys(cambios).length === 0) fallo('No hay cambios que guardar.');
    return cambios;
}

const afectaAlPanel = (cambios) => CAMPOS_PANEL.some(campo => campo in cambios);

module.exports = { validarCambiosConfig, afectaAlPanel };
