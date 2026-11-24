const mongoose = require('mongoose');

// Colección de compañeros de cada persona (global, como el oro): los que ha sacado de
// los cofres, con sus estrellas, y el que lleva equipado. Lógica en utils/cofres.js.
// 1.30.0: POR SERVIDOR. Cada persona tiene una colección distinta en cada servidor (todos empiezan
// de 0). Los documentos antiguos (sin guildId, globales) se quedan guardados sin usarse.
const ColeccionMascotasSchema = new mongoose.Schema({
    guildId: { type: String, default: null },
    userId: { type: String, required: true },
    // 1.20.0: cada compañero tiene también sus necesidades (tamagotchi), afinidad, apodo,
    // expedición en curso y recuerdos. Lógica en utils/compisNucleo.js y utils/compis.js.
    mascotas: { type: [{
        id: String, estrellas: { type: Number, default: 1 }, primera: { type: Date, default: Date.now },
        hambre: Number, alegria: Number, energia: Number, actualizado: Date,
        afinidad: { type: Number, default: 0 }, apodo: String, ultMimo: Date,
        exp: { tipo: String, desde: Date, hasta: Date },
        recuerdos: { type: [Number], default: [] },
        cuidados: { type: Number, default: 0 },
        cds: { type: Object, default: undefined }, // 1.21.0: cuándo se hizo cada interacción (para su espera)
        botinX: { type: Number, default: undefined }, // 1.24.0: una carta multiplicó el oro de su próxima expedición
        variante: { type: String, default: undefined }, // 1.32.0: 'brillante' (colores raros, sale a veces en los cofres)
        acc: { type: String, default: undefined },      // 1.32.0: accesorio puesto (sprites.ACCESORIOS)
        gustos: { type: Object, default: undefined },   // 1.32.0: comida favorita/odiada ya descubiertas ({ favorita: true, odiada: true })
        _id: false,
    }], default: [] },
    equipada: { type: String, default: null },
    abiertos: { type: Number, default: 0 },
    sinEpica: { type: Number, default: 0 },   // cofres seguidos sin épica o mejor (piedad)
    gastado: { type: Number, default: 0 },
    divinas: { type: Number, default: 0 },
    // Racha de días cuidando, misiones del día y expediciones de hoy (1.20.0).
    racha: { type: Number, default: 0 },
    mejorRacha: { type: Number, default: 0 },
    ultimoDiaCuidado: { type: String, default: null },
    misiones: { dia: String, prog: { type: Object, default: {} }, hechas: { type: [String], default: [] }, todas: Boolean },
    expHoy: { dia: String, n: Number },
    oroCompis: { type: Number, default: 0 },
    // 1.21.0: poder del día (uno cada 20 h) y su efecto activo de XP.
    poderUsado: { type: Date, default: null },
    buff: { xp: Number, hasta: Date },
    // Cartas de anime (1.24.0, utils/cartas.js): las que tienes, con sus estrellas y cuándo se usó
    // cada una; los sobres abiertos, la piedad, las usadas hoy y el empujón activo de una carta.
    cartas: { type: [{ id: String, estrellas: { type: Number, default: 1 }, primera: { type: Date, default: Date.now }, usada: Date, _id: false }], default: [] },
    sobresAbiertos: { type: Number, default: 0 },
    sinEpicaCartas: { type: Number, default: 0 },
    gastadoSobres: { type: Number, default: 0 },
    cartasHoy: { dia: String, n: Number },
    potencia: { valor: Number, hasta: Date, mascota: String },
    // 1.25.0: series del Pack anime completadas (ya premiadas) y regalos de cartas de hoy.
    seriesCompletas: { type: [String], default: [] },
    regalosHoy: { dia: String, n: Number },
    // 1.32.0 (utils/cartas.js, utils/combate.js): polvo de cartas (desencantar/crear), las holográficas,
    // el mazo de combate (hasta 3 cartas) y los intercambios de hoy.
    polvo: { type: Number, default: 0 },
    holos: { type: [String], default: [] },
    mazo: { type: [String], default: [] },
    intercambiosHoy: { dia: String, n: Number },
    armario: { type: [String], default: [] },                    // 1.32.0: accesorios comprados (para cualquiera de sus compañeros)
    mjHoy: { dia: String, n: Number },                          // 1.32.0: minijuegos premiados hoy
    cbt: { victorias: { type: Number, default: 0 }, torre: { type: Number, default: 0 }, jefe: { type: Number, default: 0 } }, // para los logros
    // 1.28.0 (utils/granja.js): granja (desde cuándo produce), oro sacado de ella, hitos del álbum
    // ya premiados («3», «5»… «todas») y misiones de la semana.
    granja: { desde: Date },
    oroGranja: { type: Number, default: 0 },
    hitosAlbum: { type: [String], default: [] },
    semana: { id: String, prog: { type: Object, default: {} }, hechas: { type: [String], default: [] }, todas: Boolean },
    // 1.29.0 (utils/pase.js): pase de temporada (mes UTC), su versión (para no pisarse), tickets de
    // sobres/cofres gratis, logros conseguidos y título de pase completo.
    pase: { temp: String, xp: Number, max: Number, casinoHoy: { dia: String, n: Number } },
    paseV: { type: Number, default: 0 },
    tickets: { type: Object, default: {} },
    logros: { type: [String], default: [] },
    tituloPase: { type: String, default: null },
}, { minimize: false });
ColeccionMascotasSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('ColeccionMascotas', ColeccionMascotasSchema);
