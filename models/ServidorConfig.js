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

    // --- PRODUCTIVIDAD: auto-respuestas / triggers ---
    // Si un mensaje (que no sea comando) coincide con `patron` según `tipo`, el bot
    // responde con `respuesta`. FAQs automáticas.
    autoRespuestas: {
        type: [{
            activo: { type: Boolean, default: true },
            nombre: { type: String, default: '' },            // etiqueta para el panel
            patron: { type: String, default: '' },            // texto que dispara la respuesta
            tipo: { type: String, enum: ['contiene', 'exacto', 'empieza'], default: 'contiene' },
            respuesta: { type: String, default: '' },
            comoEmbed: { type: Boolean, default: false },     // responder dentro de un embed
            eliminarMensaje: { type: Boolean, default: false }, // borrar el mensaje que la disparó
        }],
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

    // --- MÚSICA (Lavalink) ---
    // Controla quién puede usar la música y cómo se comporta el reproductor.
    musica: {
        activo: { type: Boolean, default: true },              // interruptor general de la música
        canalMusicaId: { type: String, default: null },        // canal de texto donde se anuncia/gestiona la música
        djRolId: { type: String, default: null },              // si está, SOLO este rol puede controlar
        soloMismoCanal: { type: Boolean, default: true },      // hay que estar en el mismo canal de voz que el bot
        volumenDefecto: { type: Number, default: 60 },         // volumen al empezar (0-150)
        volumenMax: { type: Number, default: 150 },            // tope de volumen que se puede poner
        maxCola: { type: Number, default: 100 },               // máx. canciones en cola (0 = ilimitada)
        permitirPlaylists: { type: Boolean, default: true },   // permitir encolar playlists enteras
        anunciarAhora: { type: Boolean, default: true },       // mensaje "reproduciendo ahora" en Discord
        autoSalir: { type: Boolean, default: true },           // salir del canal al quedarse solo/sin cola
        modo247: { type: Boolean, default: false },            // 24/7 (Pro): NO salir aunque se vacíe cola/canal
        // Autoplay (Pro): qué hacer cuando se acaba la cola.
        //   'off' = nada (comportamiento normal) · 'aleatorio' = añade música
        //   similar a la última · 'repetir' = repite la cola en bucle.
        autoplay: { type: String, enum: ['off', 'aleatorio', 'repetir'], default: 'off' },
        fuentes: {                                             // de dónde se permite reproducir
            youtube: { type: Boolean, default: true },
            spotify: { type: Boolean, default: true },
            soundcloud: { type: Boolean, default: true },
        },
    },

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
        // Filtro: moderación por IA (Pro). Entiende el CONTEXTO, no solo palabras
        // sueltas: detecta toxicidad, acoso, amenazas o NSFW que las listas no
        // pillan (jerga, ironía, l3tras...). Consume la cuota mensual de IA del
        // servidor para acotar el coste y no bloquea el flujo de mensajes.
        ia: {
            activo: { type: Boolean, default: false },
            accion: { type: String, default: 'borrar' },     // borrar | timeout | expulsion | ban
            timeoutMin: { type: Number, default: 10 },
            sensibilidad: { type: String, default: 'media' }, // baja | media | alta
            categorias: {
                toxicidad: { type: Boolean, default: true },
                acoso: { type: Boolean, default: true },
                amenazas: { type: Boolean, default: true },
                nsfw: { type: Boolean, default: true },
                autolesion: { type: Boolean, default: true },
            },
            minLongitud: { type: Number, default: 12 },       // ignora mensajes muy cortos (ahorra coste)
        },
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

    // --- SEGURIDAD: verificación de entrada (gate) ---
    verificacion: {
        activo: { type: Boolean, default: false },
        canalId: { type: String, default: null },          // canal donde se publica el panel de verificación
        rolVerificadoId: { type: String, default: null },  // rol que se concede al verificarse
        modo: { type: String, enum: ['boton', 'captcha'], default: 'boton' }, // botón directo o captcha
        titulo: { type: String, default: '🔒 Verificación' },
        descripcion: { type: String, default: 'Pulsa el botón para verificarte y acceder al servidor.' },
        textoBoton: { type: String, default: '✅ Verificarme' },
        mensajeId: { type: String, default: null },         // id del mensaje publicado (para republicar/editar)
    },

    // --- EMBUDO DE BIENVENIDA: Test A/B de retención (Pro) ---
    // Al entrar un usuario se le asigna una variante (50/50) y se mide cuál
    // retiene/engancha más. Variante A = reglas en texto + captcha; variante B =
    // embed visual con botones interactivos. El recorrido se guarda en EmbudoCohorte.
    embudoAB: {
        activo: { type: Boolean, default: false },
        entrega: { type: String, enum: ['panel', 'md', 'ambos'], default: 'panel' }, // botón en canal, MD, o los dos
        canalId: { type: String, default: null },           // canal donde se publica el panel (entrega panel/ambos)
        rolVerificadoId: { type: String, default: null },   // rol que se concede al completar el onboarding
        mensajeId: { type: String, default: null },         // id del panel publicado (para republicar/editar)

        // Variante A — reglas en texto plano + captcha
        varianteA: {
            titulo: { type: String, default: '📋 Bienvenido/a — Lee las normas' },
            reglas: { type: String, default: '1. Sé respetuoso con todos.\n2. Nada de spam ni publicidad.\n3. Usa los canales para su tema.\n\nResuelve el captcha para acceder.' },
            captcha: { type: Boolean, default: true },       // exigir captcha de imagen
            textoBoton: { type: String, default: '✅ Aceptar y acceder' },
        },
        // Variante B — embed visual con botones interactivos
        varianteB: {
            titulo: { type: String, default: '👋 ¡Te damos la bienvenida!' },
            descripcion: { type: String, default: 'Nos alegra tenerte aquí. Pulsa **Ver normas** para conocer la comunidad y luego **Unirme** para acceder a todos los canales.' },
            color: { type: String, default: '#5865F2' },
            reglas: { type: String, default: '1. Sé respetuoso con todos.\n2. Nada de spam ni publicidad.\n3. Usa los canales para su tema.' },
            textoBoton: { type: String, default: '🎉 Unirme' },
        },
    },

    // --- COMUNIDAD: mensajes de bienvenida y despedida ---
    // Mensaje totalmente editable (texto + embed con imágenes/GIFs, reutiliza el
    // creador de embeds) que se publica en un canal cuando alguien entra/sale.
    // Placeholders: {mention} {user} {servidor} {miembros} {avatar}.
    bienvenida: {
        activo: { type: Boolean, default: false },
        canalId: { type: String, default: null },
        contenido: { type: String, default: '¡Bienvenido/a {mention} a **{servidor}**! 🎉 Ya sois {miembros} miembros.' },
        mencionar: { type: Boolean, default: true },        // pingear al usuario que entra
        embed: { type: mongoose.Schema.Types.Mixed, default: null }, // embed opcional (null = solo texto)
    },
    despedida: {
        activo: { type: Boolean, default: false },
        canalId: { type: String, default: null },
        contenido: { type: String, default: '👋 **{user}** ha dejado **{servidor}**. Ahora sois {miembros}.' },
        mencionar: { type: Boolean, default: false },
        embed: { type: mongoose.Schema.Types.Mixed, default: null },
    },

    // --- SEGURIDAD: reportes de usuarios ---
    reportes: {
        activo: { type: Boolean, default: false },
        canalId: { type: String, default: null },           // canal de staff donde llegan los reportes
    },

    // --- COMUNIDAD: sugerencias ---
    // Canal donde los miembros proponen sugerencias; el bot las convierte en un
    // embed con botones de voto 👍/👎 y las registra para gestionarlas en el panel.
    canalSugerencias: { type: String, default: null },
    // modo 'mensaje' = escribir en el canal y el bot lo transforma.
    // modo 'formulario' = el canal queda bloqueado para chat libre y se sugiere
    //   con un botón que abre un formulario (modal) con una plantilla rellenable.
    sugerenciasModo: { type: String, enum: ['mensaje', 'formulario'], default: 'mensaje' },
    sugerenciasPlantilla: { type: String, default: '' }, // plantilla prerellenada del formulario
    sugerenciasMinLong: { type: Number, default: 0 },    // longitud mínima (0 = sin mínimo)

    // --- COMUNIDAD: presentaciones de nuevos miembros ---
    // Al entrar un miembro, el bot publica en `canalIntro` un botón para abrir un
    // formulario (modal) con `preguntas`. Las respuestas se publican al `canalStaff`
    // y los `filtros` pueden descartar/marcar automáticamente.
    presentaciones: {
        activo: { type: Boolean, default: false },
        canalIntro: { type: String, default: null },        // canal donde se pide la presentación
        canalStaff: { type: String, default: null },        // canal donde se publican para el staff
        // modo 'preguntas' = campos sueltos (uno por pregunta).
        // modo 'plantilla' = un único texto rellenable que el usuario edita.
        modo: { type: String, enum: ['preguntas', 'plantilla'], default: 'preguntas' },
        plantilla: { type: String, default: 'Edad: \nDe dónde eres: \nAficiones: \nPor qué te unes: ' },
        preguntas: {
            type: [{
                id: { type: String },
                texto: { type: String },
                tipo: { type: String, enum: ['texto', 'numero', 'seleccion'], default: 'texto' },
                requerida: { type: Boolean, default: false },
            }],
            default: [],
        },
        filtros: {
            type: [{
                id: { type: String },
                campo: { type: String },                    // id de la pregunta a evaluar
                operador: { type: String },                 // menor_que/mayor_que/igual_a/contiene/no_contiene
                valor: { type: String },
                accion: { type: String, default: 'descartar' }, // descartar | marcar
                avisarUsuario: { type: Boolean, default: true },
                mensajeAviso: { type: String, default: '' },
            }],
            default: [],
        },
    },

    // --- ACCESO Y PERMISOS ---
    rolesPanelAcceso: { type: [String], default: [] },  // roles que pueden entrar al panel web
    rolesModeracion: { type: [String], default: [] },   // roles que pueden moderar (panel + comandos)
    // Distribución "quién ve qué": roles que ven cada sección. Lista vacía = la ven
    // todos los que tengan acceso al panel. Admins/propietario ven todo siempre.
    // Qué roles ven cada SECCIÓN del panel. Lista vacía = visible para todos los
    // que tengan acceso al panel; con roles = solo quien tenga uno de ellos.
    // Cubre todos los grupos del nav, incluida 'cuenta' (facturación), para poder
    // ocultarle la suscripción a los moderadores.
    accesoAreas: {
        cuenta: { type: [String], default: [] },
        datos: { type: [String], default: [] },
        entrada: { type: [String], default: [] },
        musica: { type: [String], default: [] },
        tickets: { type: [String], default: [] },
        roles: { type: [String], default: [] },
        moderacion: { type: [String], default: [] },
        logs: { type: [String], default: [] },
        mensajes: { type: [String], default: [] },
        config: { type: [String], default: [] },
    },

    // --- PLAN / SUSCRIPCIÓN ---
    // `esPremium` se conserva como "tiene algún plan de pago activo" (lo leen muchas
    // funciones). `plan` añade el NIVEL concreto para gatear funciones por tramo.
    esPremium: { type: Boolean, default: false },
    plan: { type: String, enum: ['free', 'pro', 'agency'], default: 'free' },
    premiumHasta: { type: Date, default: null },          // fin del periodo pagado (null = de por vida)
    premiumCancelaAlFinal: { type: Boolean, default: false }, // suscripción cancelada: activa hasta que caduque
    stripeCustomerId: { type: String, default: null },    // cliente en Stripe (para renovar / portal)
    stripeSubscriptionId: { type: String, default: null }, // suscripción en Stripe (null si es pago único/lifetime)
    trialUsado: { type: Boolean, default: false },        // ya disfrutó la prueba gratuita de Pro
    iaUsos: { type: Number, default: 0 },                 // usos de IA consumidos en el mes en curso
    iaMesRef: { type: String, default: '' },              // 'YYYY-MM' del contador (se reinicia al cambiar de mes)

    // Briefing diario por IA (Pro): MD al dueño + canal opcional, a la hora fijada.
    resumenDiario: {
        activo: { type: Boolean, default: false },
        hora: { type: Number, default: 9 },               // hora UTC (0-23) del envío
        canalId: { type: String, default: null },         // canal opcional donde publicarlo además del MD
        lastDia: { type: String, default: '' },           // 'YYYY-MM-DD' del último envío (anti-duplicado)
    },

    // Webhooks salientes (Pro): avisan a un endpoint externo (Slack, Discord,
    // n8n, propio) de eventos del servidor. Lógica en utils/webhooks.js.
    webhooksSalientes: {
        activo: { type: Boolean, default: false },
        url: { type: String, default: '' },               // endpoint https de destino
        secret: { type: String, default: '' },            // opcional: se envía como cabecera X-Sokyo-Secret
        eventos: {
            ticketNuevo: { type: Boolean, default: true },
            sancion: { type: Boolean, default: true },
            raid: { type: Boolean, default: true },
        },
    },
});

// Invalida el caché en memoria (utils/config.js) cada vez que se guarda la
// configuración, para que los cambios del panel se apliquen sin esperar al TTL.
// Require perezoso dentro del hook para evitar el ciclo de dependencias
// (config.js -> este modelo -> config.js).
function _invalidarCache(guildId) {
    try {
        require('../utils/config.js').invalidateConfig(guildId);
    } catch (_) { /* el caché se refrescará por TTL de todas formas */ }
}

ServidorConfigSchema.post('save', function () {
    _invalidarCache(this.guildId);
});

// En las actualizaciones por query el guildId va en el filtro. Si no hay uno
// concreto (p. ej. una actualización masiva), limpiamos todo el caché.
['findOneAndUpdate', 'updateOne', 'updateMany', 'findOneAndDelete'].forEach((op) => {
    ServidorConfigSchema.post(op, function () {
        const filtro = (typeof this.getFilter === 'function' && this.getFilter()) || {};
        _invalidarCache(filtro.guildId);
    });
});

module.exports = mongoose.model('ServidorConfig', ServidorConfigSchema);