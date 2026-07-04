const mongoose = require('mongoose');

// Perfil de búsqueda de empleo del propietario (función solo para OWNER_IDS,
// ver slash/cv.js y slash/buscoempleo.js). Uno por discordId.
//
// cvTexto es la fuente de verdad (el texto crudo extraído del PDF/DOCX subido):
// nunca se pierde aunque estructurarPerfilCV falle o dé un resultado pobre, y
// permite regenerar cvEstructurado sin tener que volver a subir el archivo.
const ExperienciaSchema = new mongoose.Schema({
    puesto: { type: String, default: '' },
    empresa: { type: String, default: '' },
    periodo: { type: String, default: '' },
    descripcion: { type: String, default: '' },
}, { _id: false });

const EducacionSchema = new mongoose.Schema({
    titulo: { type: String, default: '' },
    centro: { type: String, default: '' },
    periodo: { type: String, default: '' },
}, { _id: false });

const PerfilEmpleoSchema = new mongoose.Schema({
    discordId: { type: String, required: true, unique: true, index: true },

    cvTexto: { type: String, default: '' },
    cvEstructurado: {
        resumen: { type: String, default: '' },
        experiencia: { type: [ExperienciaSchema], default: [] },
        educacion: { type: [EducacionSchema], default: [] },
        habilidades: { type: [String], default: [] },
        contacto: { type: String, default: '' },
    },
    archivoOriginalNombre: { type: String, default: '' },
    archivoOriginalTipo: { type: String, default: '' },

    // Foto de perfil opcional (algunas ofertas, sobre todo de cara al público u
    // hostelería/retail, piden adjuntar una foto reciente en el CV). Se guarda en
    // disco (ver utils/cvParser.js); aquí solo la ruta relativa.
    fotoRuta: { type: String, default: null },

    // Barrido automático diario (mismo patrón que ServidorConfig.resumenDiario).
    busquedaAuto: {
        activo: { type: Boolean, default: false },
        puesto: { type: String, default: '' },
        ubicacion: { type: String, default: '' },
        hora: { type: Number, default: 9 }, // hora UTC (0-23)
        lastDia: { type: String, default: null }, // 'YYYY-MM-DD', evita reenvíos el mismo día
        lastSemana: { type: String, default: null }, // 'YYYY-MM-DD' del lunes ya resumido, evita reenvíos del resumen semanal
    },

    // Lock simple: evita lanzar dos búsquedas (dos Puppeteer) a la vez en la Pi,
    // ya sea porque el comando manual y el barrido automático coinciden, o por
    // dos ejecuciones manuales seguidas.
    enEjecucion: { type: Boolean, default: false },
    ultimaEjecucionEn: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('PerfilEmpleo', PerfilEmpleoSchema);
