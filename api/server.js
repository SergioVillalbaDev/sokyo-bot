const express = require('express');
const cors = require('cors');
const ServidorConfig = require('../models/ServidorConfig.js');
const Ticket = require('../models/Ticket.js');
const Mensaje = require('../models/Mensaje.js');
const Log = require('../models/Log.js');

module.exports = (client) => {
    const app = express();
    const port = process.env.PORT || 3000;
    
    app.use(cors());
    app.use(express.json());

    // --- RUTAS API ---
    app.get('/api/estado', (req, res) => res.json({ message: 'Sokyo Bot está operativo' }));
    
    app.get('/api/servidores', async (req, res) => res.json(await ServidorConfig.find()));
    
    // Todos los tickets
    app.get('/api/tickets', async (req, res) => {
        res.json(await Ticket.find({ visibleWeb: true }).sort({ fechaCreacion: -1 }));
    });

    // --- NUEVA RUTA: Tickets asignados a un miembro del Staff concreto ---
    app.get('/api/tickets/asignados/:staffId', async (req, res) => {
        try {
            const ticketsStaff = await Ticket.find({ asignadoA: req.params.staffId, visibleWeb: true }).sort({ fechaCreacion: -1 });
            res.json(ticketsStaff);
        } catch (error) {
            console.error('Error al obtener tickets asignados:', error);
            res.status(500).json({ error: 'Fallo interno' });
        }
    });
    
    app.get('/api/mensajes/:ticketId', async (req, res) => {
        res.json(await Mensaje.find({ ticketId: req.params.ticketId }).sort({ fecha: 1 }));
    });


// --- RUTA PARA ESTADÍSTICAS DE USUARIOS ---
app.get('/api/usuarios/stats', async (req, res) => {
    try {
        const stats = await Ticket.aggregate([
            // 1. PRIMERO ordenamos los tickets del más nuevo al más viejo
            { $sort: { fechaCreacion: -1 } },
            // 2. LUEGO agrupamos por usuario
            {
                $group: {
                    _id: "$creadorId",
                    nombre: { $first: "$creadorNombre" },
                    // Como está ordenado, $first coge la foto de tu ticket MÁS RECIENTE
                    avatar: { $first: "$creadorAvatar" }, 
                    totalTickets: { $sum: 1 },
                    ticketsAbiertos: {
                        $sum: { $cond: [{ $eq: ["$estado", "Abierto"] }, 1, 0] }
                    },
                    ratingTotal: { $sum: "$valoracionCSAT" },
                    ratingCount: {
                        $sum: { $cond: [{ $gt: ["$valoracionCSAT", 0] }, 1, 0] }
                    },
                    ultimoTicket: { $first: "$fechaCreacion" } 
                }
            },
            {
                $project: {
                    nombre: 1,
                    avatar: 1, 
                    totalTickets: 1,
                    ticketsAbiertos: 1,
                    ratingMedio: {
                        $cond: [{ $eq: ["$ratingCount", 0] }, null, { $divide: ["$ratingTotal", "$ratingCount"] }]
                    },
                    ultimoTicket: 1
                }
            },
            { $sort: { totalTickets: -1 } }
        ]);
        res.json(stats);
    } catch (error) {
        console.error('Error en stats:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});
// --- RUTA PARA OBTENER LOS LOGS (CON LÍMITES FREE/PREMIUM) ---
app.get('/api/logs', async (req, res) => {
    try {
        // Buscamos la configuración del servidor
        const ServidorConfig = require('../models/ServidorConfig.js');
        const config = await ServidorConfig.findOne();
        
        // Si tienes un campo 'isPremium' en el futuro, lo leerá de aquí. Por ahora asume 'false' (Gratis)
        const esPremium = config && config.isPremium === true; 
        const limiteLogs = esPremium ? 150 : 50;

        // Devuelve los logs respetando el límite
        const logs = await Log.find().sort({ fecha: -1 }).limit(limiteLogs);
        
        // Enviamos los logs y también los datos del límite para pintarlos en la web
        res.json({ logs: logs, limite: limiteLogs, esPremium: esPremium });
    } catch (error) {
        console.error('Error al obtener logs:', error);
        res.status(500).json({ error: 'Error del servidor' });
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

    // --- NUEVA RUTA: Añadir Nota Interna a un Ticket ---
    app.post('/api/tickets/:canalId/notas', async (req, res) => {
        try {
            const { canalId } = req.params;
            const { contenido, autor } = req.body;

            const ticketActualizado = await Ticket.findOneAndUpdate(
                { canalId: canalId },
                { $push: { notasInternas: { contenido: contenido, autor: autor } } },
                { returnDocument: 'after' }
            );

            res.json({ success: true, ticket: ticketActualizado });
        } catch (error) {
            console.error('Error al añadir nota interna:', error);
            res.status(500).json({ error: 'Fallo interno al guardar la nota' });
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
        { returnDocument: 'after' }
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
                { returnDocument: 'after' } 
            );

            res.json({ success: true, config: configActualizada });
        } catch (error) {
            console.error('Error al actualizar los motivos:', error);
            res.status(500).json({ error: 'Fallo interno al actualizar la configuración' });
        }
    });

    app.put('/api/config/:guildId/urgencias', async (req, res) => {
        try {
            const { guildId } = req.params;
            const { urgencias } = req.body; 

            const configActualizada = await ServidorConfig.findOneAndUpdate(
                { guildId: guildId },
                { urgencias: urgencias },
                { new: true } 
            );

            res.json({ success: true, config: configActualizada });
        } catch (error) {
            console.error('Error al actualizar las urgencias:', error);
            res.status(500).json({ error: 'Fallo interno al actualizar' });
        }
    });

    // --- NUEVA RUTA: Actualizar textos de Marca Blanca ---
    app.put('/api/config/:guildId/textos', async (req, res) => {
        try {
            const { guildId } = req.params;
            const { titulo, descripcion, footer } = req.body; 

            const configActualizada = await ServidorConfig.findOneAndUpdate(
                { guildId: guildId },
                { 
                    mensajeSoporteTitulo: titulo,
                    mensajeSoporteDescripcion: descripcion,
                    footerPersonalizado: footer
                },
                { returnDocument: 'after' } 
            );

            res.json({ success: true, config: configActualizada });
        } catch (error) {
            console.error('Error al actualizar textos personalizados:', error);
            res.status(500).json({ error: 'Fallo interno al actualizar los textos' });
        }
    });

    app.listen(port, () => console.log(`🌐 API corriendo en puerto ${port}`));
};