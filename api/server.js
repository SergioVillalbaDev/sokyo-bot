const express = require('express');
const cors = require('cors');
const ServidorConfig = require('../models/ServidorConfig.js');
const Ticket = require('../models/Ticket.js');
const Mensaje = require('../models/Mensaje.js');

module.exports = (client) => {
    const app = express();
    const port = process.env.PORT || 3000;
    
    app.use(cors());
    app.use(express.json());

    // --- RUTAS API ---
    app.get('/api/estado', (req, res) => res.json({ message: 'Sokyo Bot está operativo' }));
    
    app.get('/api/servidores', async (req, res) => res.json(await ServidorConfig.find()));
    
    app.get('/api/tickets', async (req, res) => {
        res.json(await Ticket.find({ visibleWeb: true }).sort({ fechaCreacion: -1 }));
    });
    
    app.get('/api/mensajes/:ticketId', async (req, res) => {
        res.json(await Mensaje.find({ ticketId: req.params.ticketId }).sort({ fecha: 1 }));
    });
// Estadísticas de usuarios para el Registro
    app.get('/api/usuarios/stats', async (req, res) => {
        try {
            const stats = await Ticket.aggregate([
                {
                    $group: {
                        _id: "$creadorId",
                        nombre: { $first: "$creadorNombre" },
                        totalTickets: { $sum: 1 },
                        ticketsAbiertos: {
                            $sum: { $cond: [{ $eq: ["$estado", "Abierto"] }, 1, 0] }
                        },
                        // Si tu modelo de Ticket tiene un campo de fecha (ej. fechaCreacion), lo cogemos:
                        ultimoTicket: { $max: "$fechaCreacion" } 
                    }
                },
                { $sort: { totalTickets: -1 } } // Ordenamos de más tickets a menos
            ]);
            res.json(stats);
        } catch (error) {
            console.error('Error al cargar stats de usuarios:', error);
            res.status(500).json({ error: 'Fallo interno' });
        }
    });
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

    app.put('/api/tickets/:canalId/cerrar', async (req, res) => {
        try {
            const { canalId } = req.params;

            const ticketActualizado = await Ticket.findOneAndUpdate(
                { canalId: canalId },
                { estado: 'Cerrado' },
                { new: true }
            );

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

    app.put('/api/tickets/:canalId/ocultar', async (req, res) => {
        try {
            const { canalId } = req.params;
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

    app.put('/api/config/:guildId/motivos', async (req, res) => {
        try {
            const { guildId } = req.params;
            const { motivos } = req.body; 

            const configActualizada = await ServidorConfig.findOneAndUpdate(
                { guildId: guildId },
                { motivos: motivos },
                { new: true } 
            );

            res.json({ success: true, config: configActualizada });
        } catch (error) {
            console.error('Error al actualizar los motivos:', error);
            res.status(500).json({ error: 'Fallo interno al actualizar la configuración' });
        }
    });

    app.listen(port, () => console.log(`🌐 API corriendo en puerto ${port}`));
};