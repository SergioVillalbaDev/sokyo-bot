const mongoose = require('mongoose');

const ServidorConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    motivos: { 
        type: [{ nombre: String, urgencia: String }], 
        default: [
            { nombre: 'Soporte General', urgencia: 'Normal' },
            { nombre: 'Reportar Usuario', urgencia: 'Alta' },
            { nombre: 'Donaciones', urgencia: 'Baja' }
        ] 
    },
    
    // --- NUEVO SISTEMA DE URGENCIAS PERSONALIZADAS ---
    urgencias: {
        type: [{ nombre: String, color: String, nivel: Number }],
        default: [
            { nombre: 'Urgente', color: '#e74c3c', nivel: 4 },
            { nombre: 'Alta', color: '#e67e22', nivel: 3 },
            { nombre: 'Normal', color: '#3498db', nivel: 2 },
            { nombre: 'Baja', color: '#95a5a6', nivel: 1 }
        ]
    },

    mensajeSoporteTitulo: { type: String, default: '🎫 Soporte Técnico Activo' },
    mensajeSoporteDescripcion: { type: String, default: 'Haz clic en el botón de abajo para abrir un ticket de soporte.' },
    footerPersonalizado: { type: String, default: 'Sistema de Gestión Sokyo' },

    // --- PERSONALIZACIÓN / MARCA (Fase 2) ---
    colorEmbed: { type: String, default: '#5865F2' },                                  // color del panel !sokyo
    textoBoton: { type: String, default: '📩 Abrir Ticket' },                          // texto del botón del panel
    mensajeBienvenida: { type: String, default: 'Un miembro del equipo lo revisará en breve.' }, // nota al abrir ticket
    prefijo: { type: String, default: '!' },                                           // prefijo de comandos
    categoriaArchivados: { type: String, default: '🗄️ Tickets Archivados' },          // categoría de tickets cerrados

    // --- REGLAS Y CONTROL (Fase 3) ---
    rolStaffId: { type: String, default: null },              // rol que puede reclamar/cerrar (además de admins)
    categoriaTicketsId: { type: String, default: null },      // categoría de Discord donde se crean los tickets
    maxTicketsAbiertos: { type: Number, default: 0 },         // máx. tickets abiertos por usuario (0 = sin límite)
    autoCierreDias: { type: Number, default: 0 },             // cierre automático por inactividad (0 = desactivado)
    autoAsignar: { type: Boolean, default: false },           // repartir tickets nuevos entre el rol de soporte (round-robin)
    autoAsignarIndex: { type: Number, default: 0 },           // puntero interno del round-robin

    // --- PRODUCTIVIDAD DEL STAFF ---
    respuestasRapidas: {                                      // macros: plantillas de respuesta reutilizables
        type: [{ titulo: String, contenido: String }],
        default: [],
    },

    // --- AJUSTES DE COMPORTAMIENTO (Fase 1) ---
    // Todos los defaults reproducen el comportamiento que tenía el bot antes.
    ratingActivo: { type: Boolean, default: true },        // encuesta CSAT (estrellas) al cerrar
    enviarTranscript: { type: Boolean, default: true },    // mandar copia de la conversación por DM
    avisoCierreCanal: { type: Boolean, default: true },    // mensaje "ticket cerrado" en el canal
    pingSoporte: { type: Boolean, default: false },        // avisar a un rol al abrir un ticket
    rolSoporteId: { type: String, default: null },         // ID del rol a avisar
    logsActivos: {                                         // qué categorías de logs se registran
        entradas: { type: Boolean, default: true },
        salidas: { type: Boolean, default: true },
        mensajesBorrados: { type: Boolean, default: true },
        mensajesEditados: { type: Boolean, default: true },
        tickets: { type: Boolean, default: true },
    },

    // --- SISTEMA DE ROLES: autorol al entrar ---
    autoRoles: { type: [String], default: [] },       // roles que se asignan a una PERSONA al entrar
    autoRolesBots: { type: [String], default: [] },   // roles que se asignan a un BOT al entrar

    // --- MODERACIÓN ---
    canalModLogId: { type: String, default: null },   // canal donde se registran las sanciones
    dmSancion: { type: Boolean, default: true },       // avisar por MD al usuario sancionado

    // --- AUTOMODERADOR ---
    // Cada filtro tiene su propio `activo`, `accion` (borrar | aviso | timeout | expulsion | ban)
    // y `timeoutMin` (minutos de aislamiento si la acción es timeout). "borrar" solo elimina el
    // mensaje; cualquier otra acción además registra una sanción por el motor de moderación.
    automod: {
        activo: { type: Boolean, default: false },          // interruptor general del automod
        preset: { type: String, default: '' },               // id del preset aplicado (informativo)
        rolesExentos: { type: [String], default: [] },      // roles que ignoran TODOS los filtros
        canalesExentos: { type: [String], default: [] },    // canales donde el automod no actúa
        avisarEnCanal: { type: Boolean, default: true },     // mandar aviso efímero al usuario en el canal
        canalAlertasId: { type: String, default: null },     // canal donde el automod publica alertas (raids, etc.)
        // Filtro: palabras prohibidas
        palabras: {
            activo: { type: Boolean, default: false },
            lista: { type: [String], default: [] },
            accion: { type: String, default: 'borrar' },
            timeoutMin: { type: Number, default: 10 },
        },
        // Filtro: invitaciones a otros servidores de Discord
        invitaciones: {
            activo: { type: Boolean, default: false },
            accion: { type: String, default: 'borrar' },
            timeoutMin: { type: Number, default: 10 },
        },
        // Filtro: enlaces externos (con lista blanca de dominios permitidos)
        enlaces: {
            activo: { type: Boolean, default: false },
            accion: { type: String, default: 'borrar' },
            timeoutMin: { type: Number, default: 10 },
            listaBlanca: { type: [String], default: [] },   // dominios permitidos (ej. "youtube.com")
        },
        // Filtro: anti-spam / flood
        spam: {
            activo: { type: Boolean, default: false },
            accion: { type: String, default: 'timeout' },
            timeoutMin: { type: Number, default: 5 },
            maxMensajes: { type: Number, default: 5 },       // nº de mensajes...
            enSegundos: { type: Number, default: 5 },        // ...en esta ventana de tiempo
            repetidos: { type: Boolean, default: true },     // también detectar el mismo mensaje repetido
        },
        // Filtro: menciones masivas
        menciones: {
            activo: { type: Boolean, default: false },
            accion: { type: String, default: 'borrar' },
            timeoutMin: { type: Number, default: 10 },
            max: { type: Number, default: 5 },               // máx. menciones por mensaje
            bloquearEveryone: { type: Boolean, default: true }, // bloquear @everyone/@here
        },
        // Filtro: exceso de mayúsculas
        mayusculas: {
            activo: { type: Boolean, default: false },
            accion: { type: String, default: 'borrar' },
            timeoutMin: { type: Number, default: 5 },
            porcentaje: { type: Number, default: 70 },       // % de mayúsculas para considerarse spam
            minLongitud: { type: Number, default: 10 },      // solo en mensajes de al menos N caracteres
        },
        // Filtro: estafas / cripto / nitro falso / cuentas hackeadas
        estafas: {
            activo: { type: Boolean, default: false },
            accion: { type: String, default: 'ban' },        // por defecto banear (suelen ser cuentas hackeadas)
            timeoutMin: { type: Number, default: 60 },
            palabrasClave: { type: [String], default: [] },  // vacío = usa la lista por defecto del bot
            conEnlace: { type: Boolean, default: true },     // exigir que el mensaje lleve también un enlace
            conImagen: { type: Boolean, default: true },     // detectar también imagen + palabra clave (sin enlace)
            nitroFalso: { type: Boolean, default: true },    // detectar "nitro gratis"/regalos de Steam falsos
            borrarHoras: { type: Number, default: 1 },       // al banear, borra los mensajes de las últimas N horas
        },
        // Módulo: anti-raid (oleadas de entradas en poco tiempo)
        antiRaid: {
            activo: { type: Boolean, default: false },
            uniones: { type: Number, default: 8 },            // nº de entradas...
            enSegundos: { type: Number, default: 10 },        // ...en esta ventana = raid
            accion: { type: String, default: 'kick' },        // qué hacer con los que entran durante el raid: kick|ban|timeout
            timeoutMin: { type: Number, default: 60 },        // si accion=timeout
            edadMinHoras: { type: Number, default: 0 },       // 0 = afecta a todos; si >0, solo a cuentas más nuevas que esto
            lockdownMin: { type: Number, default: 10 },       // minutos que dura el bloqueo tras detectar un raid
        },
        // Módulo: cuentas nuevas / multicuentas (alts) al entrar
        cuentasNuevas: {
            activo: { type: Boolean, default: false },
            edadMinHoras: { type: Number, default: 72 },      // cuentas más nuevas que esto = sospechosas
            sinAvatar: { type: Boolean, default: true },      // marcar también cuentas sin avatar
            accion: { type: String, default: 'alerta' },      // alerta|timeout|kick|ban
            timeoutMin: { type: Number, default: 60 },        // si accion=timeout
            asignarRolId: { type: String, default: null },    // rol opcional de "cuarentena" que se asigna al entrar
        },
    },

    // --- NIVELES / XP ---
    nivelesActivo: { type: Boolean, default: false },        // sistema de niveles activado
    // Ganancia por mensaje
    xpMin: { type: Number, default: 15 },
    xpMax: { type: Number, default: 25 },
    xpCooldownSeg: { type: Number, default: 60 },            // segundos entre ganancias por mensaje
    // Ganancia por voz
    xpVozActivo: { type: Boolean, default: false },
    xpVozPorMin: { type: Number, default: 5 },               // XP por minuto en voz
    // Dificultad: multiplica la curva (1 = normal, >1 más difícil, <1 más fácil)
    dificultad: { type: Number, default: 1 },
    // Anuncios de subida
    anuncioTipo: { type: String, enum: ['canal', 'dm', 'off'], default: 'canal' },
    canalNivelesId: { type: String, default: null },         // canal de anuncios (null = donde escribió)
    mensajeSubida: { type: String, default: '🎉 ¡{mention} ha subido a **nivel {level}**!' },
    // Recompensas por nivel
    recompensasNivel: { type: [{ nivel: Number, rolId: String }], default: [] },
    recompensaAcumulativa: { type: Boolean, default: true }, // true = acumula roles; false = sustituye por el más alto
    // Exclusiones
    canalesSinXp: { type: [String], default: [] },           // canales que no dan XP
    rolesSinXp: { type: [String], default: [] },             // roles cuyos miembros no ganan XP
    // Multiplicadores: roles que ganan XP a un ritmo distinto (se aplica el mayor)
    multiplicadoresRol: { type: [{ rolId: String, multiplicador: Number }], default: [] },
    // Tarjeta de rango (imagen) al subir de nivel y en !nivel
    tarjetaActiva: { type: Boolean, default: true },

    // --- ACCESO Y PERMISOS ---
    rolesPanelAcceso: { type: [String], default: [] },  // roles que pueden entrar al panel web
    rolesModeracion: { type: [String], default: [] },   // roles que pueden moderar (panel + comandos)
    // Distribución "quién ve qué": roles que ven cada sección. Lista vacía = la ven
    // todos los que tengan acceso al panel. Admins/propietario ven todo siempre.
    accesoAreas: {
        tickets: { type: [String], default: [] },
        roles: { type: [String], default: [] },
        moderacion: { type: [String], default: [] },
        logs: { type: [String], default: [] },
        config: { type: [String], default: [] },
    },

    esPremium: { type: Boolean, default: false },
    premiumHasta: { type: Date, default: null }
});

module.exports = mongoose.model('ServidorConfig', ServidorConfigSchema);