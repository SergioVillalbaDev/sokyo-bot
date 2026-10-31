// Sesión del panel web: guarda los servidores de Discord del usuario (scope "guilds")
// para poder mostrarle el selector de servidores.
const mongoose = require('mongoose');

const sesionPanelSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    accessToken: { type: String, default: null },
    tokenExpira: { type: Date, default: null },
    guilds: {
        type: [{ id: String, name: String, icon: String, owner: Boolean, permissions: String, _id: false }],
        default: []
    },
    guildsActualizado: { type: Date, default: null }
});

module.exports = mongoose.model('SesionPanel', sesionPanelSchema);
