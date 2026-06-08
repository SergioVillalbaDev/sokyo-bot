require('dotenv').config();

const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');

// 1. IMPORTACIONES UNIFICADAS (Más limpio)
const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Events,
    PermissionsBitField,
    ChannelType,
    StringSelectMenuBuilder,
    EmbedBuilder
} = require('discord.js');

const ServidorConfig = require('./models/ServidorConfig.js');
const Ticket = require('./models/Ticket.js');
const Mensaje = require('./models/Mensaje.js');

const app = express();
const port = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once(Events.ClientReady, (readyClient) => { 
    console.log(`Bienvenidos a la órbita. Logged in as ${readyClient.user.tag}!`);
});

// Evento para capturar mensajes y guardarlos en la base de datos
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    if (message.channel.name && message.channel.name.startsWith('ticket-')) {
        try {
            await Mensaje.create({
                ticketId: message.channel.id,
                usuario: message.author.username,
                usuarioId: message.author.id,
                contenido: message.content
            });
        } catch (error) {
            console.error('Error al guardar mensaje:', error);
        } 
    }

    if (message.content === '!sokyo') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ Acceso denegado.');
        
        await ServidorConfig.findOneAndUpdate(
            { guildId: message.guild.id },
            { canalTicketsId: message.channel.id },
            { upsert: true, new: true }
        );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('create_ticket').setLabel('Abrir Ticket').setStyle(ButtonStyle.Primary).setEmoji('🎫')
        );

        await message.channel.send({ content: '**Soporte Técnico Activo**', components: [row] });
        await message.delete();
    }
});

// Evento de Interacciones (Botones y Menús)
client.on(Events.InteractionCreate, async (interaction) => {
    
    // --- LÓGICA DE BOTONES ---
    if (interaction.isButton()) {
        
        // PASO 1: EL USUARIO PULSA "ABRIR TICKET" (Ahora muestra el menú)
        if (interaction.customId === 'create_ticket') {
            try {
                // Buscamos la configuración del servidor
                let config = await ServidorConfig.findOne({ guildId: interaction.guildId });

                // Usamos los motivos de la DB o unos por defecto
                const listaMotivos = (config && config.motivos && config.motivos.length > 0) 
                    ? config.motivos 
                    : ['Fallo Técnico', 'Reportar Usuario', 'Duda de Pago'];

                // Creamos el menú desplegable
                const menuMotivos = new StringSelectMenuBuilder()
                    .setCustomId('seleccionar_motivo_ticket')
                    .setPlaceholder('👉 Selecciona el motivo de tu consulta...')
                    .addOptions(
                        listaMotivos.map((motivo) => ({
                            label: motivo,
                            description: `Abrir un caso por: ${motivo}`,
                            value: motivo,
                        }))
                    );

                const filaComponentes = new ActionRowBuilder().addComponents(menuMotivos);

                await interaction.reply({
                    content: 'Por favor, selecciona una categoría para poder ayudarte mejor:',
                    components: [filaComponentes],
                    ephemeral: true // Solo lo ve el usuario
                });

            } catch (error) {
                console.error('Error al mostrar menú de motivos:', error);
                await interaction.reply({ content: '❌ Hubo un error al procesar tu solicitud.', ephemeral: true });
            }
        }

        // --- LÓGICA PARA CERRAR EL TICKET ---
        if (interaction.customId === 'close_ticket') {
            await interaction.reply({ content: 'Cerrando este ticket en 5 segundos...', ephemeral: true });
            
            try {
                // Actualizamos el estado en la base de datos
                await Ticket.findOneAndUpdate(
                    { canalId: interaction.channel.id }, 
                    { estado: 'Cerrado' }
                );

                setTimeout(() => {
                    interaction.channel.delete().catch(console.error);
                }, 5000);

            } catch (error) {
                console.error('Error al cerrar el ticket:', error);
            }
        }
    }

    // --- LÓGICA DE MENÚS DESPLEGABLES (NUEVO) ---
    if (interaction.isStringSelectMenu()) {
        
        // PASO 2: EL USUARIO ELIGE UN MOTIVO (Se crea el canal)
        if (interaction.customId === 'seleccionar_motivo_ticket') {
            await interaction.deferUpdate(); // Avisamos a Discord de que estamos procesando
            
            const motivoSeleccionado = interaction.values[0];

            try {
                // 1. Creamos el canal en Discord (Añadimos el motivo al nombre si quieres)
                const canalTicket = await interaction.guild.channels.create({
                    name: `ticket-${interaction.user.username}`,
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.id,
                            deny: [PermissionsBitField.Flags.ViewChannel],
                        },
                        {
                            id: interaction.user.id,
                            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                        }
                    ]
                });

                // 2. Guardamos en MongoDB con los NUEVOS CAMPOS
                await Ticket.create({
                    guildId: interaction.guild.id,
                    canalId: canalTicket.id,
                    creadorId: interaction.user.id,
                    creadorNombre: interaction.user.username,
                    motivo: motivoSeleccionado, // Guardamos el motivo
                    estado: 'Abierto',
                    visibleWeb: true // Por defecto es visible en la web
                });

                /// 3. Mensaje dentro del ticket con el motivo y petición de detalles
                const embedBienvenida = new EmbedBuilder()
                    .setTitle(`🎫 Ticket de Soporte: ${motivoSeleccionado}`)
                    .setDescription(`¡Gracias por contactar con soporte!\n\nPara poder ayudarte lo más rápido posible, **por favor describe tu problema o consulta con el mayor nivel de detalle posible en este canal.**\n\nPuedes adjuntar capturas de pantalla si es necesario. Un miembro del equipo lo leerá en breve.`)
                    .setColor('#2ecc71');

                const rowCerrar = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('Cerrar Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
                );
                
                // Añadimos el "content" para forzar el ping real en Discord
                await canalTicket.send({ 
                    content: `¡Hola <@${interaction.user.id}>! Necesitamos un poco más de información. 👇`,
                    embeds: [embedBienvenida],
                    components: [rowCerrar] 
                });

                // 4. Confirmamos al usuario en el menú efímero original
                await interaction.followUp({ 
                    content: `✅ Tu ticket ha sido creado: <#${canalTicket.id}>`,
                    ephemeral: true 
                });

            } catch (error) {
                console.error('Error al crear el ticket desde el menú:', error);
                await interaction.followUp({ content: '❌ Hubo un error al crear el ticket en el servidor.', ephemeral: true });
            }
        }
    }
});

// --- RUTAS API ---
app.get('/api/estado', (req, res) => res.json({ message: 'Sokyo Bot está operativo' }));
app.get('/api/servidores', async (req, res) => res.json(await ServidorConfig.find()));
app.get('/api/tickets', async (req, res) => {
    res.json(await Ticket.find({ visibleWeb: true }).sort({ fechaCreacion: -1 }));
});
app.get('/api/mensajes/:ticketId', async (req, res) => {
    res.json(await Mensaje.find({ ticketId: req.params.ticketId }).sort({ fecha: 1 }));
});

// Ruta POST: Recibe el mensaje desde React y lo envía a Discord
app.post('/api/mensajes/:ticketId', async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { usuario, contenido } = req.body; 

        const nuevoMsg = await Mensaje.create({
            ticketId: ticketId,
            usuarioId: 'sokyo-web', 
            usuario: usuario,
            contenido: contenido
        });

        const canal = client.channels.cache.get(ticketId);
        if (canal) {
            await canal.send(`**[${usuario}]** ${contenido}`);
        }

        res.json({ success: true, mensaje: nuevoMsg });
    } catch (error) {
        console.error('Error al enviar mensaje desde la web:', error);
        res.status(500).json({ error: 'Fallo interno al enviar' });
    }
});

// RUTA PUT: Cambiar el estado del ticket a 'Cerrado' desde la web
app.put('/api/tickets/:canalId/cerrar', async (req, res) => {
    try {
        const { canalId } = req.params;

        // 1. Actualizamos el estado en MongoDB
        const ticketActualizado = await Ticket.findOneAndUpdate(
            { canalId: canalId },
            { estado: 'Cerrado' },
            { new: true }
        );

        // 2. Avisamos en Discord y borramos el canal
        const canal = client.channels.cache.get(canalId);
        if (canal) {
            await canal.send('🔒 **Este ticket ha sido cerrado de forma remota desde el panel de control web.**\nEl canal se eliminará en 5 segundos.');
            
            setTimeout(() => {
                canal.delete().catch(console.error);
            }, 5000);
        }

        res.json({ success: true, ticket: ticketActualizado });
    } catch (error) {
        console.error('Error al cerrar ticket desde la API:', error);
        res.status(500).json({ error: 'Fallo interno al cerrar el ticket' });
    }
});

// RUTA PUT: Ocultar el ticket de la web (El botón de la papelera)
app.put('/api/tickets/:canalId/ocultar', async (req, res) => {
    try {
        const { canalId } = req.params;

        // Cambiamos visibleWeb a false para hacer el "borrado lógico"
        const ticketOcultado = await Ticket.findOneAndUpdate(
            { canalId: canalId },
            { visibleWeb: false },
            { new: true }
        );

        res.json({ success: true, ticket: ticketOcultado });
    } catch (error) {
        console.error('Error al ocultar ticket desde la API:', error);
        res.status(500).json({ error: 'Fallo interno al ocultar el ticket' });
    }
});

// RUTA: Actualizar la lista de motivos desde la web
app.put('/api/config/:guildId/motivos', async (req, res) => {
    try {
        const { guildId } = req.params;
        const { motivos } = req.body; // Recibe el array ["Fallo", "Duda", ...]

        const configActualizada = await ServidorConfig.findOneAndUpdate(
            { guildId: guildId },
            { motivos: motivos },
            { new: true } // Para que devuelva el documento actualizado
        );

        res.json({ success: true, config: configActualizada });
    } catch (error) {
        console.error('Error al actualizar los motivos:', error);
        res.status(500).json({ error: 'Fallo interno al actualizar la configuración' });
    }
});

app.listen(port, () => console.log(`🌐 API corriendo en puerto ${port}`));

mongoose.connect(process.env.MONGO_URI).then(() => console.log('🟢 Conectado a MongoDB'));
client.login(process.env.DISCORD_TOKEN);