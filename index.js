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
const comandosExtras = require('./comandos/extras.js'); 

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

    // Registro de mensajes en tickets
    if (message.channel.name && message.channel.name.startsWith('ticket-')) {
        await Mensaje.create({
            ticketId: message.channel.id,
            usuario: message.author.username,
            contenido: message.content
        });
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

    if (interaction.customId === 'create_ticket') {
        // ... (Tu lógica de creación)
    }

    if (interaction.customId === 'close_ticket') {
        // ... (Tu lógica de cierre)
    }
});

// Rutas API
app.get('/api/estado', (req, res) => res.json({ message: 'Sokyo Bot está operativo' }));
app.get('/api/servidores', async (req, res) => res.json(await ServidorConfig.find()));
app.get('/api/tickets', async (req, res) => res.json(await Ticket.find().sort({ fechaCreacion: -1 })));
app.get('/api/mensajes/:ticketId', async (req, res) => {
    res.json(await Mensaje.find({ ticketId: req.params.ticketId }).sort({ fecha: 1 }));
});

app.listen(port, () => console.log(`🌐 API corriendo en puerto ${port}`));

mongoose.connect(process.env.MONGO_URI).then(() => console.log('🟢 Conectado a MongoDB'));
client.login(process.env.DISCORD_TOKEN);