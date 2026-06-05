const mongoose = require('mongoose');


const servidorSchema = new mongoose.Schema({
    guildId: { 
        type: String, 
        required: true, 
        unique: true 
    },
    canalTicketsId: { 
        type: String, 
        required: true 
    }
});

module.exports = mongoose.model('ServidorConfig', servidorSchema);