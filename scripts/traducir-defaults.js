// ============================================================================
// Migración: traduce a inglés los TEXTOS POR DEFECTO de servidores ya existentes.
//
// Por qué: al cambiar los `default` del esquema, Mongo NO actualiza los documentos
// que ya existían (los defaults solo se aplican al CREAR). Este script recorre todos
// los ServidorConfig y, SOLO si un campo sigue teniendo el texto por defecto en
// español (es decir, el admin no lo ha personalizado), lo reemplaza por el inglés.
// Si alguien ya cambió su texto, NO se toca.
//
// Uso (desde la raíz del proyecto):
//   node scripts/traducir-defaults.js            -> SIMULACIÓN (no escribe nada; muestra qué cambiaría)
//   node scripts/traducir-defaults.js apply      -> aplica los cambios de verdad
//   node scripts/traducir-defaults.js apply <guildId>  -> solo ese servidor
//
// Lee MONGO_URI del .env (el mismo que usa el bot).
// ============================================================================
require('dotenv').config();
const mongoose = require('mongoose');
const ServidorConfig = require('../models/ServidorConfig.js');

const apply = (process.argv[2] || '').toLowerCase() === 'apply';
const guildId = process.argv[3] || null;

// Pares [ruta, viejoDefaultES, nuevoDefaultEN]. Solo se reemplaza si el valor
// actual === viejoDefaultES (campo sin personalizar).
const CAMPOS = [
  // --- Tickets / soporte ---
  ['mensajeSoporteTitulo', '🎫 Soporte Técnico Activo', '🎫 Support is open'],
  ['mensajeSoporteDescripcion', 'Haz clic en el botón de abajo para abrir un ticket de soporte.', 'Click the button below to open a support ticket.'],
  ['footerPersonalizado', 'Sistema de Gestión Sokyo', 'Sokyo management system'],
  ['textoBoton', '📩 Abrir Ticket', '📩 Open a ticket'],
  ['mensajeBienvenida', 'Un miembro del equipo lo revisará en breve.', 'A team member will review it shortly.'],
  ['categoriaArchivados', '🗄️ Tickets Archivados', '🗄️ Archived Tickets'],
  // --- Niveles ---
  ['mensajeSubida', '🎉 ¡{mention} ha subido a **nivel {level}**!', '🎉 {mention} reached **level {level}**!'],
  // --- Bienvenida / despedida ---
  ['bienvenida.contenido', '¡Bienvenido/a {mention} a **{servidor}**! 🎉 Ya sois {miembros} miembros.', 'Welcome {mention} to **{server}**! 🎉 We are now {members} members.'],
  ['despedida.contenido', '👋 **{user}** ha dejado **{servidor}**. Ahora sois {miembros}.', '👋 **{user}** left **{server}**. We are now {members}.'],
  // --- Verificación ---
  ['verificacion.titulo', '🔒 Verificación', '🔒 Verification'],
  ['verificacion.descripcion', 'Pulsa el botón para verificarte y acceder al servidor.', 'Click the button to verify and access the server.'],
  ['verificacion.textoBoton', '✅ Verificarme', '✅ Verify me'],
  // --- Embudo de bienvenida A/B ---
  ['embudoAB.varianteA.titulo', '📋 Bienvenido/a — Lee las normas', '📋 Welcome — Read the rules'],
  ['embudoAB.varianteA.reglas', '1. Sé respetuoso con todos.\n2. Nada de spam ni publicidad.\n3. Usa los canales para su tema.\n\nResuelve el captcha para acceder.', '1. Be respectful to everyone.\n2. No spam or advertising.\n3. Use channels for their topic.\n\nSolve the captcha to get access.'],
  ['embudoAB.varianteA.textoBoton', '✅ Aceptar y acceder', '✅ Accept and enter'],
  ['embudoAB.varianteB.titulo', '👋 ¡Te damos la bienvenida!', '👋 Welcome!'],
  ['embudoAB.varianteB.descripcion', 'Nos alegra tenerte aquí. Pulsa **Ver normas** para conocer la comunidad y luego **Unirme** para acceder a todos los canales.', 'We’re glad to have you here. Click **View rules** to get to know the community, then **Join** to access all channels.'],
  ['embudoAB.varianteB.reglas', '1. Sé respetuoso con todos.\n2. Nada de spam ni publicidad.\n3. Usa los canales para su tema.', '1. Be respectful to everyone.\n2. No spam or advertising.\n3. Use channels for their topic.'],
  ['embudoAB.varianteB.textoBoton', '🎉 Unirme', '🎉 Join'],
  // --- Presentaciones ---
  ['presentaciones.plantilla', 'Edad: \nDe dónde eres: \nAficiones: \nPor qué te unes: ', 'Age: \nWhere you’re from: \nHobbies: \nWhy you’re joining: '],
  // --- Voz temporal (panel) ---
  ['vozTemporal.panelTitulo', '🔊 Tu canal de voz', '🔊 Your voice channel'],
  ['vozTemporal.panelDescripcion', 'Entra al canal generador para crear tu sala. Luego usa estos botones para gestionarla.', 'Join the generator channel to create your room. Then use these buttons to manage it.'],
  // --- Dinámicas (mensajes configurables) ---
  ['dinamicas.qotd.mensajes.acierto.texto', '⭐ ¡{user} ha sido el primero en responder! +{xp} XP 🎉', '⭐ {user} was the first to answer! +{xp} XP 🎉'],
  ['dinamicas.gota.mensajes.anuncio.texto', '¡Reacciona con {emoji} para llevarte **{xp} XP**!\nSolo el primero se la lleva. ¡Rápido! ⚡', 'React with {emoji} to grab **{xp} XP**!\nOnly the first one gets it. Quick! ⚡'],
  ['dinamicas.gota.mensajes.acierto.texto', '{emoji} ¡{user} ha recogido la gota y gana **{xp} XP**! 🎉', '{emoji} {user} grabbed the drop and wins **{xp} XP**! 🎉'],
  ['dinamicas.gota.mensajes.fallo.texto', 'Nadie la recogió a tiempo… 😢', 'Nobody grabbed it in time… 😢'],
  ['dinamicas.contador.mensajes.fallo.texto', '💥 ¡Se rompió la cuenta! El número correcto era **{numero}**. ¡Vuelta a empezar desde **1**!', '💥 The count broke! The correct number was **{number}**. Start over from **1**!'],
  ['dinamicas.trivia.mensajes.acierto.texto', '✅ ¡Correcto! +{xp} XP', '✅ Correct! +{xp} XP'],
  ['dinamicas.trivia.mensajes.fallo.texto', '❌ Respuesta incorrecta. ¡Suerte la próxima!', '❌ Wrong answer. Better luck next time!'],
  ['dinamicas.reto.mensajes.acierto.texto', '🎯 ¡{user} ha completado el reto diario! +{xp} XP · Racha 🔥 **{racha}** día(s).', '🎯 {user} completed the daily challenge! +{xp} XP · Streak 🔥 **{streak}** day(s).'],
  ['dinamicas.tesoro.mensajes.acierto.texto', '🏆 ¡{user} ha encontrado la palabra secreta!', '🏆 {user} found the secret word!'],
  ['dinamicas.miembroSemana.mensajes.anuncio.texto', '¡Enhorabuena {user}! Has sido el miembro más activo de la semana con **{mensajes}** mensajes.', 'Congrats {user}! You were the most active member of the week with **{messages}** messages.'],
  ['dinamicas.logros.mensajes.miembros.texto', '¡Ya somos **{miembros}** miembros en **{servidor}**! Gracias por estar aquí 💜', 'We’re now **{members}** members in **{server}**! Thanks for being here 💜'],
  ['dinamicas.logros.mensajes.nivel.texto', '¡{user} es el primero en alcanzar el **nivel {nivel}**! 🚀', '{user} is the first to reach **level {level}**! 🚀'],
];

// Arrays (motivos / urgencias): se comparan por su contenido relevante; si igualan
// el default ES, se reemplazan por el default EN.
const MOTIVOS_ES = [
  { nombre: 'Soporte General', urgencia: 'Normal' },
  { nombre: 'Reportar Usuario', urgencia: 'Alta' },
  { nombre: 'Donaciones', urgencia: 'Baja' },
];
const MOTIVOS_EN = [
  { nombre: 'General support', urgencia: 'Normal' },
  { nombre: 'Report a user', urgencia: 'High' },
  { nombre: 'Donations', urgencia: 'Low' },
];
const URGENCIAS_ES = [
  { nombre: 'Urgente', color: '#e74c3c', nivel: 4 },
  { nombre: 'Alta', color: '#e67e22', nivel: 3 },
  { nombre: 'Normal', color: '#3498db', nivel: 2 },
  { nombre: 'Baja', color: '#95a5a6', nivel: 1 },
];
const URGENCIAS_EN = [
  { nombre: 'Urgent', color: '#e74c3c', nivel: 4 },
  { nombre: 'High', color: '#e67e22', nivel: 3 },
  { nombre: 'Normal', color: '#3498db', nivel: 2 },
  { nombre: 'Low', color: '#95a5a6', nivel: 1 },
];

const getByPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

const igualMotivos = (a) => Array.isArray(a) && a.length === MOTIVOS_ES.length
  && a.every((m, i) => m && m.nombre === MOTIVOS_ES[i].nombre && m.urgencia === MOTIVOS_ES[i].urgencia);
const igualUrgencias = (a) => Array.isArray(a) && a.length === URGENCIAS_ES.length
  && a.every((u, i) => u && u.nombre === URGENCIAS_ES[i].nombre && u.color === URGENCIAS_ES[i].color && u.nivel === URGENCIAS_ES[i].nivel);

(async () => {
  if (!process.env.MONGO_URI) { console.error('🔴 Falta MONGO_URI en el .env'); process.exit(1); }
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`🟢 Conectado a MongoDB · modo ${apply ? 'APLICAR' : 'SIMULACIÓN (no escribe)'}`);

  const filtro = guildId ? { guildId } : {};
  const docs = await ServidorConfig.find(filtro).lean();
  console.log(`📋 ${docs.length} servidor(es) a revisar.\n`);

  let servidoresTocados = 0;
  let camposTotales = 0;

  for (const doc of docs) {
    const set = {};
    for (const [ruta, viejo, nuevo] of CAMPOS) {
      if (getByPath(doc, ruta) === viejo) set[ruta] = nuevo;
    }
    if (igualMotivos(doc.motivos)) set.motivos = MOTIVOS_EN;
    if (igualUrgencias(doc.urgencias)) set.urgencias = URGENCIAS_EN;

    const claves = Object.keys(set);
    if (!claves.length) continue;

    servidoresTocados++;
    camposTotales += claves.length;
    console.log(`• ${doc.guildId}: ${claves.length} campo(s) → ${claves.join(', ')}`);

    if (apply) {
      await ServidorConfig.updateOne({ _id: doc._id }, { $set: set });
    }
  }

  console.log(`\n${apply ? '✅ Aplicado' : '🔍 Simulación'}: ${camposTotales} campo(s) en ${servidoresTocados} servidor(es).`);
  if (!apply && camposTotales > 0) console.log('   Ejecuta con `apply` para escribir los cambios: node scripts/traducir-defaults.js apply');

  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
