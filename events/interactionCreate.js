const { Events, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, EmbedBuilder } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const Ticket = require('../models/Ticket.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        
        // --- LÓGICA DE BOTONES ---
        if (interaction.isButton()) {
            
            // EL USUARIO PULSA "ABRIR TICKET"
            if (interaction.customId === 'create_ticket') {
                try {
                    let config = await ServidorConfig.findOne({ guildId: interaction.guildId });
                    const listaMotivos = (config && config.motivos && config.motivos.length > 0) 
                        ? config.motivos 
                        : ['Fallo Técnico', 'Reportar Usuario', 'Duda de Pago'];

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
                        ephemeral: true 
                    });

                } catch (error) {
                    console.error('Error al mostrar menú de motivos:', error);
                    await interaction.reply({ content: '❌ Hubo un error al procesar tu solicitud.', ephemeral: true });
                }
            }

 // --- LÓGICA PARA CERRAR EL TICKET ---
if (interaction.customId === 'close_ticket') {
    // 1. Guardamos la referencia del canal AQUÍ MISMO antes de que pasen los 5 segundos
    const canal = interaction.channel;

    if (!canal) {
        return await interaction.reply({ content: '❌ No se ha podido encontrar el canal.', ephemeral: true });
    }

    await interaction.reply({ content: 'Cerrando este ticket en 5 segundos...', ephemeral: true });
    
    try {
        // Actualizamos el estado en la base de datos usando nuestra variable segura
        await Ticket.findOneAndUpdate(
            { canalId: canal.id }, 
            { estado: 'Cerrado' }
        );

        // 2. Usamos 'canal' directamente dentro del timeout
        setTimeout(() => {
            canal.delete().catch(console.error);
        }, 5000);

    } catch (error) {
        console.error('Error al cerrar el ticket:', error);
    }
}
        }

        // --- LÓGICA DE MENÚS DESPLEGABLES ---
        if (interaction.isStringSelectMenu()) {
            
            // EL USUARIO ELIGE UN MOTIVO (Se crea el canal)
            if (interaction.customId === 'seleccionar_motivo_ticket') {
                await interaction.deferUpdate(); 
                
                const motivoSeleccionado = interaction.values[0];

                try {
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

                    await Ticket.create({
                        guildId: interaction.guild.id,
                        canalId: canalTicket.id,
                        creadorId: interaction.user.id,
                        creadorNombre: interaction.user.username,
                        motivo: motivoSeleccionado,
                        estado: 'Abierto',
                        visibleWeb: true
                    });

                    const embedBienvenida = new EmbedBuilder()
                        .setTitle(`🎫 Ticket de Soporte: ${motivoSeleccionado}`)
                        .setDescription(`¡Gracias por contactar con soporte!\n\nPara poder ayudarte lo más rápido posible, **por favor describe tu problema o consulta con el mayor nivel de detalle posible en este canal.**\n\nPuedes adjuntar capturas de pantalla si es necesario. Un miembro del equipo lo leerá en breve.`)
                        .setColor('#2ecc71');

                    const rowCerrar = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('close_ticket').setLabel('Cerrar Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
                    );
                    
                    await canalTicket.send({ 
                        content: `¡Hola <@${interaction.user.id}>! Necesitamos un poco más de información. 👇`,
                        embeds: [embedBienvenida],
                        components: [rowCerrar] 
                    });

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
    }
};