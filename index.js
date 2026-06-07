require('dotenv').config();

const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');

const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Events,
    PermissionsBitField,
    ChannelType
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

// Evento de Interacciones (Botones)
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;

    // --- LÓGICA PARA CREAR EL TICKET ---
    if (interaction.customId === 'create_ticket') {
        await interaction.deferReply({ ephemeral: true });

        try {
            // 1. Creamos el canal en Discord
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

            // 2. Guardamos en MongoDB cumpliendo tu Schema estrictamente
            await Ticket.create({
                guildId: interaction.guild.id,
                canalId: canalTicket.id,
                creadorId: interaction.user.id,
                creadorNombre: interaction.user.username, // Mapeado correctamente para la web
                estado: 'Abierto'
            });

            // 3. Enviamos el mensaje con el botón de cerrar dentro del nuevo canal
            const rowCerrar = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_ticket').setLabel('Cerrar Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );
            await canalTicket.send({ 
                content: `¡Hola <@${interaction.user.id}>! Un moderador te atenderá en breve.`, 
                components: [rowCerrar] 
            });

            // 4. Confirmamos el éxito al usuario
            await interaction.editReply({ content: `✅ Tu ticket ha sido creado: <#${canalTicket.id}>` });

        } catch (error) {
            console.error('Error al crear el ticket:', error);
            await interaction.editReply({ content: '❌ Hubo un error al crear el ticket en el servidor.' });
        }
    }

    // --- LÓGICA PARA CERRAR EL TICKET ---
    if (interaction.customId === 'close_ticket') {
        await interaction.reply({ content: 'Cerrando este ticket en 5 segundos...', ephemeral: true });
        
        try {
            // Actualizamos el estado a 'Cerrado' en la base de datos antes de borrar el canal
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
});

// Rutas API
app.get('/api/estado', (req, res) => res.json({ message: 'Sokyo Bot está operativo' }));
app.get('/api/servidores', async (req, res) => res.json(await ServidorConfig.find()));
app.get('/api/tickets', async (req, res) => res.json(await Ticket.find().sort({ fechaCreacion: -1 })));
app.get('/api/mensajes/:ticketId', async (req, res) => {
    res.json(await Mensaje.find({ ticketId: req.params.ticketId }).sort({ fecha: 1 }));
});

// NUEVA RUTA POST: Recibe el mensaje desde React y lo envía a Discord
app.post('/api/mensajes/:ticketId', async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { usuario, contenido } = req.body; 

        // 1. Guardamos el mensaje en la base de datos
        const nuevoMsg = await Mensaje.create({
            ticketId: ticketId,
            usuarioId: 'sokyo-web', // ID simbólica para diferenciar que viene del panel
            usuario: usuario,
            contenido: contenido
        });

        // 2. Buscamos el canal de Discord y hacemos que el bot envíe el mensaje
        const canal = client.channels.cache.get(ticketId);
        if (canal) {
            await canal.send(`**[${usuario}]** ${contenido}`);
        }

        // 3. Confirmamos a React que todo ha ido bien
        res.json({ success: true, mensaje: nuevoMsg });
    } catch (error) {
        console.error('Error al enviar mensaje desde la web:', error);
        res.status(500).json({ error: 'Fallo interno al enviar' });
    }
});

app.listen(port, () => console.log(`🌐 API corriendo en puerto ${port}`));

mongoose.connect(process.env.MONGO_URI).then(() => console.log('🟢 Conectado a MongoDB'));
client.login(process.env.DISCORD_TOKEN);