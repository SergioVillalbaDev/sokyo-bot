const mongoose = require('mongoose');

// La mascota del servidor (1.14.0): una por servidor. Nace de un huevo que el
// servidor vota (especie y nombre), crece con lo que la cuidan y con lo vivo que
// está el servidor, y desbloquea ventajas para todos. Lógica en utils/mascota.js
// (las reglas puras, en utils/mascotaNucleo.js).
const MascotaSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    estado: { type: String, enum: ['huevo', 'viva'], default: 'huevo' },
    especie: { type: String, default: null },
    nombre: { type: String, default: null },
    nivel: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },          // XP dentro del nivel
    hambre: { type: Number, default: 80 },     // 0 = muerta de hambre · 100 = llena
    alegria: { type: Number, default: 70 },
    salud: { type: Number, default: 100 },
    forma: { type: String, default: null },
    // 1.15.0: personalidad, energía y atributos de combate, aspecto, logros, diario y sorpresas.
    personalidad: { type: String, default: null },
    energia: { type: Number, default: 100 },
    stats: {
        fuerza: { type: Number, default: 5 },
        defensa: { type: Number, default: 5 },
        agilidad: { type: Number, default: 5 },
    },
    accesorio: { type: String, default: null },        // el que lleva puesto
    accesorios: { type: [String], default: [] },       // los que tiene
    habitat: { type: String, default: 'prado' },
    habitats: { type: [String], default: ['prado'] },
    logros: { type: [String], default: [] },
    diario: { type: [{ tipo: String, fecha: Date, datos: mongoose.Schema.Types.Mixed, _id: false }], default: [] },
    evento: {
        id: { type: String, default: null },
        tipo: { type: String, default: null },
        premio: { type: Number, default: 0 },
        respuesta: { type: Number, default: null },
        expira: { type: Date, default: null },
        resuelto: { type: Boolean, default: false },
        canalId: { type: String, default: null },
        mensajeId: { type: String, default: null },
        fallos: { type: [String], default: [] },
    },
    ultimoEvento: { type: Date, default: null },    // al hacerse adulta: nocturna, musical, guerrera o social
    hibernando: { type: Boolean, default: false },
    hibernaDesde: { type: Date, default: null },
    nacida: { type: Date, default: null },
    ultimoTick: { type: Date, default: Date.now },
    ultimoSaludo: { type: String, default: '' },     // 'YYYY-MM-DD'
    ultimoAvisoHambre: { type: Date, default: null },
    ultimoProteger: { type: String, default: '' },   // 'YYYY-MM-DD'
    mesCuidador: { type: String, default: '' },      // último mes cerrado del «Cuidador del mes»
    cuidadorId: { type: String, default: null },     // quien lleva ahora el rol de cuidador
    // Cómo es el servidor (decide su forma de adulta).
    contadores: {
        noche: { type: Number, default: 0 },
        dia: { type: Number, default: 0 },
        musica: { type: Number, default: 0 },
        victorias: { type: Number, default: 0 },
        derrotas: { type: Number, default: 0 },
        racha: { type: Number, default: 0 },
        comida: { type: Number, default: 0 },    // oro que se ha comido en total
        caricias: { type: Number, default: 0 },
        entrenos: { type: Number, default: 0 },
        eventos: { type: Number, default: 0 },   // sorpresas resueltas
        despertares: { type: Number, default: 0 },
        mejorRacha: { type: Number, default: 0 },
    },
    // Votación del huevo.
    votacion: {
        fin: { type: Date, default: null },
        canalId: { type: String, default: null },
        mensajeId: { type: String, default: null },
        especies: { type: [{ userId: String, especie: String, _id: false }], default: [] },
        nombres: { type: [{ userId: String, nombre: String, votos: [String], _id: false }], default: [] },
    },
});

module.exports = mongoose.model('Mascota', MascotaSchema);
