// 🔓 Desbloqueo poco a poco (1.34.0) — reglas puras (test/menu.test.js). Nadie se encuentra 20 cosas el primer día:
// los menús (/menu y sus zonas) enseñan primero lo básico y van abriendo lo demás según lo que ya has hecho. No se
// bloquea nada (los comandos siguen funcionando): solo se ordena lo que se enseña y se avisa «🔓 Nuevo para ti».
const ETAPAS = [
    { id: 'base', cuando: () => true },
    { id: 'primerDiario', cuando: (d) => !!d.ultimoDaily || d.mascotas > 0,
        es: '🎰 **El casino y los cofres.** Con tu oro puedes abrir un cofre y conseguir tu primera mascota.', en: '🎰 **The casino and chests.** With your gold you can open a chest and get your first pet.',
        pista: { es: 'reclama tu primer `/diario`', en: 'claim your first `/daily`' } },
    { id: 'conMascota', cuando: (d) => d.mascotas > 0,
        es: '🧺 **Tu granja y las expediciones.** Tus mascotas producen oro solas y traen tesoros de sus viajes.', en: '🧺 **Your farm and expeditions.** Your pets make gold on their own and bring back treasures from trips.',
        pista: { es: 'consigue tu primera mascota en un cofre', en: 'get your first pet from a chest' } },
    { id: 'dosDias', cuando: (d) => d.racha >= 2 || d.sobres > 0 || d.mascotas >= 3,
        es: '🃏 **Las cartas y el mercado.** Sobres de cartas que dan poderes a tus mascotas.', en: '🃏 **Cards and the market.** Card packs that give your pets powers.',
        pista: { es: 'vuelve mañana (2 días seguidos)', en: 'come back tomorrow (2 days in a row)' } },
    { id: 'nivel5', cuando: (d) => d.nivelMax >= 5,
        es: '⚔️ **Los combates.** Tu mascota ya puede pelear: retos, torre y el jefe de la semana.', en: '⚔️ **Battles.** Your pet can now fight: challenges, the tower and the weekly boss.',
        pista: { es: 'sube una mascota a nivel 5 cuidándola', en: 'get a pet to level 5 by caring for it' } },
    { id: 'tresMascotas', cuando: (d) => d.mascotas >= 3,
        es: '🏠 **La casa de tus mascotas.** Decórala: cuanto más cómoda, más produce tu granja.', en: '🏠 **Your pets’ house.** Decorate it: the comfier it is, the more your farm makes.',
        pista: { es: 'ten 3 mascotas distintas', en: 'have 3 different pets' } },
    { id: 'nivel10', cuando: (d) => d.nivelMax >= 10,
        es: '🥚 **La guardería.** Dos mascotas de nivel 10 pueden tener un huevo.', en: '🥚 **The nursery.** Two level-10 pets can have an egg.',
        pista: { es: 'sube una mascota a nivel 10', en: 'get a pet to level 10' } },
];
const etapa = (id) => ETAPAS.find((e) => e.id === id) || ETAPAS[0];
// Datos que miran las etapas, sacados del monedero y la colección.
function datosDe(usuario = {}, col = null) {
    const P = require('./compisNucleo.js');
    const ms = col?.mascotas || [];
    return { ultimoDaily: usuario.ultimoDaily || null, racha: usuario.rachaDaily || 0, mascotas: ms.length, sobres: col?.sobresAbiertos || 0, nivelMax: ms.reduce((a, m) => Math.max(a, P.nivel(m.afinidad || 0)), 0) };
}
const abiertas = (datos) => new Set(ETAPAS.filter((e) => e.cuando(datos)).map((e) => e.id));
// Las que se acaban de abrir (no estaban en `vistas`), sin contar 'base'.
const nuevas = (datos, vistas = []) => ETAPAS.filter((e) => e.id !== 'base' && e.cuando(datos) && !vistas.includes(e.id));
// La siguiente que falta (para decir «se abre cuando…»).
const siguiente = (datos) => ETAPAS.find((e) => !e.cuando(datos)) || null;

module.exports = { ETAPAS, etapa, datosDe, abiertas, nuevas, siguiente };
