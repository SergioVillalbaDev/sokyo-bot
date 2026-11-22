// Cofres de mascotas (1.16.0) — reglas puras. Cada persona tiene su colección de
// compañeros (1.30.0: por servidor, como el oro). Se consiguen abriendo cofres con oro; cada
// compañero tiene una rareza y, si lo llevas equipado, te da ventajas: más XP, más oro
// en /diario y un poco de vuelta de lo que pierdes en el casino. Los repetidos suben
// estrellas (hasta 5), y cada estrella mejora sus ventajas.
// Hay UNO divino: «Sokyo, el Dragón Celestial». Rarísimo y muy chetado.

const RAREZAS = {
    comun: { orden: 0, emoji: '⚪', es: 'Común', en: 'Common', color: '#9ca3af', xp: 0.02, diario: 0, vuelta: 0, bromas: 0, liga: 0, expedicion: 0 },
    rara: { orden: 1, emoji: '🔵', es: 'Rara', en: 'Rare', color: '#3b82f6', xp: 0.04, diario: 0.05, vuelta: 0, bromas: 0.05, liga: 0.05, expedicion: 0.10 },
    epica: { orden: 2, emoji: '🟣', es: 'Épica', en: 'Epic', color: '#a855f7', xp: 0.07, diario: 0.10, vuelta: 0.01, bromas: 0.10, liga: 0.10, expedicion: 0.20 },
    legendaria: { orden: 3, emoji: '🟡', es: 'Legendaria', en: 'Legendary', color: '#f59e0b', xp: 0.10, diario: 0.20, vuelta: 0.02, bromas: 0.15, liga: 0.20, expedicion: 0.35 },
    mitica: { orden: 4, emoji: '🔴', es: 'Mítica', en: 'Mythic', color: '#ef4444', xp: 0.15, diario: 0.35, vuelta: 0.04, bromas: 0.25, liga: 0.30, expedicion: 0.50 },
    divina: { orden: 5, emoji: '🌈', es: 'DIVINA', en: 'DIVINE', color: '#fde68a', xp: 0.50, diario: 1.00, vuelta: 0.10, bromas: 0.40, liga: 0.50, expedicion: 1.00 },
};

const COMPANEROS = {
    // Comunes
    gato: { rareza: 'comun', svg: '1f431', emoji: '🐱', es: 'Gato', en: 'Cat' },
    perro: { rareza: 'comun', svg: '1f436', emoji: '🐶', es: 'Perro', en: 'Dog' },
    conejo: { rareza: 'comun', svg: '1f430', emoji: '🐰', es: 'Conejo', en: 'Bunny' },
    hamster: { rareza: 'comun', svg: '1f439', emoji: '🐹', es: 'Hámster', en: 'Hamster' },
    rana: { rareza: 'comun', svg: '1f438', emoji: '🐸', es: 'Rana', en: 'Frog' },
    pollito: { rareza: 'comun', svg: '1f425', emoji: '🐥', es: 'Pollito', en: 'Chick' },
    tortuga: { rareza: 'comun', svg: '1f422', emoji: '🐢', es: 'Tortuga', en: 'Turtle', voz: 'sabio' },
    cerdito: { rareza: 'comun', svg: '1f437', emoji: '🐷', es: 'Cerdito', en: 'Piglet', voz: 'glotón' },
    oso: { rareza: 'comun', svg: '1f43b', emoji: '🐻', es: 'Osito', en: 'Teddy bear', voz: 'tierno' },
    mono: { rareza: 'comun', svg: '1f435', emoji: '🐵', es: 'Monito', en: 'Monkey', voz: 'bromista' },
    raton: { rareza: 'comun', svg: '1f42d', emoji: '🐭', es: 'Ratoncito', en: 'Mouse', voz: 'timido' },
    erizo: { rareza: 'comun', svg: '1f994', emoji: '🦔', es: 'Erizo', en: 'Hedgehog', voz: 'timido' },
    pato: { rareza: 'comun', svg: '1f986', emoji: '🦆', es: 'Pato', en: 'Duck', voz: 'bromista' },
    pixel: { rareza: 'comun', svg: '1f916', emoji: '🤖', es: 'Pixel, el robot ayudante', en: 'Pixel, the helper robot', tipo: 'personaje', voz: 'robot' },
    boo: { rareza: 'comun', svg: '1f47b', emoji: '👻', es: 'Boo, el fantasma tímido', en: 'Boo, the shy ghost', tipo: 'personaje', voz: 'timido' },
    // Raras
    zorro: { rareza: 'rara', svg: '1f98a', emoji: '🦊', es: 'Zorro', en: 'Fox' },
    panda: { rareza: 'rara', svg: '1f43c', emoji: '🐼', es: 'Panda', en: 'Panda' },
    koala: { rareza: 'rara', svg: '1f428', emoji: '🐨', es: 'Koala', en: 'Koala' },
    buho: { rareza: 'rara', svg: '1f989', emoji: '🦉', es: 'Búho', en: 'Owl' },
    pinguino: { rareza: 'rara', svg: '1f427', emoji: '🐧', es: 'Pingüino', en: 'Penguin' },
    mapache: { rareza: 'rara', svg: '1f99d', emoji: '🦝', es: 'Mapache', en: 'Raccoon', voz: 'bromista' },
    nutria: { rareza: 'rara', svg: '1f9a6', emoji: '🦦', es: 'Nutria', en: 'Otter', voz: 'tierno' },
    perezoso: { rareza: 'rara', svg: '1f9a5', emoji: '🦥', es: 'Perezoso', en: 'Sloth', voz: 'dormilon' },
    flamenco: { rareza: 'rara', svg: '1f9a9', emoji: '🦩', es: 'Flamenco', en: 'Flamingo', voz: 'orgulloso' },
    mariposa: { rareza: 'rara', svg: '1f98b', emoji: '🦋', es: 'Mariposa', en: 'Butterfly', voz: 'sonador' },
    zim: { rareza: 'rara', svg: '1f47d', emoji: '👽', es: 'Zim, la alienígena curiosa', en: 'Zim, the curious alien', tipo: 'personaje', voz: 'alien' },
    kuro: { rareza: 'rara', svg: '1f9df', emoji: '🧟', es: 'Kuro, el zombi dormilón', en: 'Kuro, the sleepy zombie', tipo: 'personaje', voz: 'dormilon' },
    tomo: { rareza: 'rara', svg: '1f9d1-200d-1f373', emoji: '🧑‍🍳', es: 'Tomo, el chef', en: 'Tomo, the chef', tipo: 'personaje', voz: 'glotón' },
    // Épicas
    leon: { rareza: 'epica', svg: '1f981', emoji: '🦁', es: 'León', en: 'Lion' },
    tigre: { rareza: 'epica', svg: '1f42f', emoji: '🐯', es: 'Tigre', en: 'Tiger' },
    unicornio: { rareza: 'epica', svg: '1f984', emoji: '🦄', es: 'Unicornio', en: 'Unicorn' },
    lobo: { rareza: 'epica', svg: '1f43a', emoji: '🐺', es: 'Lobo', en: 'Wolf' },
    pavo: { rareza: 'epica', svg: '1f99a', emoji: '🦚', es: 'Pavo real', en: 'Peacock', voz: 'orgulloso' },
    leopardo: { rareza: 'epica', svg: '1f406', emoji: '🐆', es: 'Leopardo', en: 'Leopard', voz: 'energico' },
    loro: { rareza: 'epica', svg: '1f99c', emoji: '🦜', es: 'Loro parlanchín', en: 'Chatty parrot', voz: 'bromista' },
    kaede: { rareza: 'epica', svg: '1f977', emoji: '🥷', es: 'Kaede, la ninja de la luna', en: 'Kaede, the moon ninja', tipo: 'personaje', voz: 'ninja' },
    lumi: { rareza: 'epica', svg: '1f9da', emoji: '🧚', es: 'Lumi, el hada traviesa', en: 'Lumi, the mischievous fairy', tipo: 'personaje', voz: 'sonador' },
    ren: { rareza: 'epica', svg: '1f93a', emoji: '🤺', es: 'Ren, el espadachín errante', en: 'Ren, the wandering swordsman', tipo: 'personaje', voz: 'guerrero' },
    mika: { rareza: 'epica', svg: '1f9d9-200d-2640-fe0f', emoji: '🧙‍♀️', es: 'Mika, la maga aprendiz', en: 'Mika, the apprentice mage', tipo: 'personaje', voz: 'maga' },
    nova: { rareza: 'epica', svg: '1f9d1-200d-1f680', emoji: '🧑‍🚀', es: 'Nova, la astronauta', en: 'Nova, the astronaut', tipo: 'personaje', voz: 'energico' },
    yuki: { rareza: 'epica', svg: '1f9d1-200d-1f3a4', emoji: '🧑‍🎤', es: 'Yuki, la idol', en: 'Yuki, the idol', tipo: 'personaje', voz: 'idol' },
    // Legendarias
    dragon: { rareza: 'legendaria', svg: '1f409', emoji: '🐉', es: 'Dragón', en: 'Dragon' },
    aguila: { rareza: 'legendaria', svg: '1f985', emoji: '🦅', es: 'Águila real', en: 'Royal eagle' },
    tiburon: { rareza: 'legendaria', svg: '1f988', emoji: '🦈', es: 'Tiburón', en: 'Shark' },
    vlad: { rareza: 'legendaria', svg: '1f9db', emoji: '🧛', es: 'Vlad, el vampiro elegante', en: 'Vlad, the elegant vampire', tipo: 'personaje', voz: 'vampiro' },
    marina: { rareza: 'legendaria', svg: '1f9dc-200d-2640-fe0f', emoji: '🧜‍♀️', es: 'Marina, la sirena cantora', en: 'Marina, the singing mermaid', tipo: 'personaje', voz: 'idol' },
    sylva: { rareza: 'legendaria', svg: '1f9dd-200d-2640-fe0f', emoji: '🧝‍♀️', es: 'Sylva, la elfa arquera', en: 'Sylva, the elf archer', tipo: 'personaje', voz: 'sabio' },
    hikari: { rareza: 'legendaria', svg: '1f9b8-200d-2640-fe0f', emoji: '🦸‍♀️', es: 'Hikari, la heroína', en: 'Hikari, the heroine', tipo: 'personaje', voz: 'heroe' },
    oni: { rareza: 'legendaria', svg: '1f479', emoji: '👹', es: 'Oni, el guardián rojo', en: 'Oni, the red guardian', tipo: 'personaje', voz: 'guerrero' },
    // Míticas
    fenix: { rareza: 'mitica', svg: '1f426-200d-1f525', emoji: '🔥', es: 'Fénix', en: 'Phoenix' },
    trex: { rareza: 'mitica', svg: '1f996', emoji: '🦖', es: 'T-Rex', en: 'T-Rex' },
    ballena: { rareza: 'mitica', svg: '1f40b', emoji: '🐋', es: 'Ballena ancestral', en: 'Ancient whale' },
    kraken: { rareza: 'mitica', svg: '1f991', emoji: '🦑', es: 'Kraken', en: 'Kraken', voz: 'misterioso' },
    djinn: { rareza: 'mitica', svg: '1f9de', emoji: '🧞', es: 'Djinn, el genio del farol', en: 'Djinn, the lantern genie', tipo: 'personaje', voz: 'genio' },
    nyx: { rareza: 'mitica', svg: '1f9b9-200d-2640-fe0f', emoji: '🦹‍♀️', es: 'Nyx, la reina de las sombras', en: 'Nyx, the queen of shadows', tipo: 'personaje', voz: 'misterioso' },
    aurora: { rareza: 'mitica', svg: '1f478', emoji: '👸', es: 'Aurora, la princesa estelar', en: 'Aurora, the star princess', tipo: 'personaje', voz: 'princesa' },
    // Divina (solo hay una)
    celestial: { rareza: 'divina', svg: '1f432', emoji: '🐲', es: 'Sokyo, el Dragón Celestial', en: 'Sokyo, the Celestial Dragon', titulo: { es: '👑 Elegido de Sokyo', en: '👑 Chosen by Sokyo' } },
};

// Habilidad EXCLUSIVA de cada mascota (1.24.0), además de las ventajas de su rareza y su poder
// del día. Tipos (compisNucleo/compis/cartas las aplican):
//   xp · diario · vuelta · bromas · liga · expedicion → suma `valor` a esa ventaja
//   gloton (el hambre baja a la mitad) · alegre (la alegría baja a la mitad) · incansable (energía ×1,5)
//   rapido (expediciones un 25 % más cortas) · tesoro (siempre traen recuerdo) · afin (afinidad ×1,5)
//   cartas (las cartas usadas en ella, +valor de fuerza) · recarga (+valor cartas al día) · divino (cartas +50 % y +1 al día)
const H = (tipo, valor, es, en) => ({ tipo, valor, es, en });
const HABILIDADES = {
    gato: H('vuelta', 0.02, 'Siete vidas: un 2 % más de vuelta en el casino', 'Nine lives: 2% more casino cashback'),
    perro: H('afin', 0.5, 'Leal hasta el final: gana afinidad un 50 % más rápido', 'Loyal to the end: gains affinity 50% faster'),
    conejo: H('rapido', 0.25, 'Saltos dobles: sus expediciones duran un 25 % menos', 'Double hops: its expeditions are 25% shorter'),
    hamster: H('gloton', 0.5, 'Mofletes llenos: el hambre le baja a la mitad', 'Stuffed cheeks: gets hungry half as fast'),
    rana: H('diario', 0.05, 'Croar de la suerte: +5 % de oro en /diario', 'Lucky croak: +5% gold on /daily'),
    pollito: H('xp', 0.02, 'Pío madrugador: +2 % de XP', 'Early chirp: +2% XP'),
    tortuga: H('bromas', 0.05, 'Caparazón: bromas un 5 % más baratas', 'Shell: pranks 5% cheaper'),
    cerdito: H('tesoro', 1, 'Hocico trufero: sus expediciones siempre traen un recuerdo', 'Truffle snout: its expeditions always bring a souvenir'),
    oso: H('alegre', 0.5, 'Abrazo de oso: la alegría le baja a la mitad', 'Bear hug: its joy drops half as fast'),
    mono: H('bromas', 0.08, 'Travesura: bromas un 8 % más baratas', 'Mischief: pranks 8% cheaper'),
    raton: H('rapido', 0.25, 'Escurridizo: sus expediciones duran un 25 % menos', 'Slippery: its expeditions are 25% shorter'),
    erizo: H('bromas', 0.06, 'Púas: bromas un 6 % más baratas', 'Spikes: pranks 6% cheaper'),
    pato: H('diario', 0.05, 'Cuac de oro: +5 % de oro en /diario', 'Golden quack: +5% gold on /daily'),
    pixel: H('recarga', 1, 'Overclock: puedes usar 1 carta más al día', 'Overclock: you can use 1 more card a day'),
    boo: H('cartas', 0.3, 'Susto amistoso: las cartas en él son un 30 % más fuertes', 'Friendly scare: cards on it are 30% stronger'),
    zorro: H('vuelta', 0.03, 'Astucia: un 3 % más de vuelta en el casino', 'Cunning: 3% more casino cashback'),
    panda: H('incansable', 0.5, 'Siesta de bambú: recupera energía un 50 % más rápido', 'Bamboo nap: recovers energy 50% faster'),
    koala: H('alegre', 0.5, 'Abrazo de eucalipto: la alegría le baja a la mitad', 'Eucalyptus hug: its joy drops half as fast'),
    buho: H('xp', 0.04, 'Sabiduría nocturna: +4 % de XP', 'Night wisdom: +4% XP'),
    pinguino: H('rapido', 0.25, 'Tobogán de hielo: sus expediciones duran un 25 % menos', 'Ice slide: its expeditions are 25% shorter'),
    mapache: H('tesoro', 1, 'Manos rápidas: sus expediciones siempre traen un recuerdo', 'Quick hands: its expeditions always bring a souvenir'),
    nutria: H('afin', 0.5, 'De la manita: gana afinidad un 50 % más rápido', 'Holding hands: gains affinity 50% faster'),
    perezoso: H('gloton', 0.5, 'Modo ahorro: el hambre le baja a la mitad', 'Power saving: gets hungry half as fast'),
    flamenco: H('liga', 0.05, 'Equilibrio: +5 % de puntos de Liga', 'Balance: +5% League points'),
    mariposa: H('cartas', 0.3, 'Efecto mariposa: las cartas en ella son un 30 % más fuertes', 'Butterfly effect: cards on it are 30% stronger'),
    zim: H('recarga', 1, 'Tecnología alien: 1 carta más al día', 'Alien tech: 1 more card a day'),
    kuro: H('gloton', 0.5, 'No-muerto: el hambre le baja a la mitad', 'Undead: gets hungry half as fast'),
    tomo: H('diario', 0.08, 'Banquete: +8 % de oro en /diario', 'Feast: +8% gold on /daily'),
    leon: H('liga', 0.10, 'Rugido del rey: +10 % de puntos de Liga', 'King’s roar: +10% League points'),
    tigre: H('xp', 0.05, 'Garra feroz: +5 % de XP', 'Fierce claw: +5% XP'),
    unicornio: H('cartas', 0.35, 'Arcoíris: las cartas en él son un 35 % más fuertes', 'Rainbow: cards on it are 35% stronger'),
    lobo: H('afin', 0.6, 'Llamada de la manada: gana afinidad un 60 % más rápido', 'Pack call: gains affinity 60% faster'),
    pavo: H('liga', 0.08, 'Plumaje deslumbrante: +8 % de puntos de Liga', 'Dazzling plumage: +8% League points'),
    leopardo: H('rapido', 0.3, 'Sprint: sus expediciones duran un 30 % menos', 'Sprint: its expeditions are 30% shorter'),
    loro: H('bromas', 0.10, 'Repetir y repetir: bromas un 10 % más baratas', 'Repeat and repeat: pranks 10% cheaper'),
    kaede: H('tesoro', 1, 'Sombra lunar: sus expediciones siempre traen un recuerdo', 'Moon shadow: its expeditions always bring a souvenir'),
    lumi: H('cartas', 0.35, 'Polvo de hada: las cartas en ella son un 35 % más fuertes', 'Fairy dust: cards on her are 35% stronger'),
    ren: H('xp', 0.06, 'Corte del viento: +6 % de XP', 'Wind slash: +6% XP'),
    mika: H('recarga', 1, 'Grimorio: 1 carta más al día', 'Grimoire: 1 more card a day'),
    nova: H('rapido', 0.35, 'Propulsores: sus expediciones duran un 35 % menos', 'Thrusters: its expeditions are 35% shorter'),
    yuki: H('alegre', 0.6, 'Concierto: la alegría casi no le baja', 'Concert: its joy barely drops'),
    dragon: H('xp', 0.08, 'Aliento de fuego: +8 % de XP', 'Fire breath: +8% XP'),
    aguila: H('tesoro', 1, 'Vista de águila: sus expediciones siempre traen un recuerdo', 'Eagle eye: its expeditions always bring a souvenir'),
    tiburon: H('vuelta', 0.04, 'Frenesí: un 4 % más de vuelta en el casino', 'Frenzy: 4% more casino cashback'),
    vlad: H('incansable', 0.8, 'Noche eterna: recupera energía casi al doble', 'Eternal night: recovers energy almost twice as fast'),
    marina: H('liga', 0.12, 'Canto de sirena: +12 % de puntos de Liga', 'Siren song: +12% League points'),
    sylva: H('expedicion', 0.25, 'Flecha certera: +25 % de oro en expediciones', 'True arrow: +25% expedition gold'),
    hikari: H('bromas', 0.15, 'Justicia: bromas un 15 % más baratas', 'Justice: pranks 15% cheaper'),
    oni: H('xp', 0.08, 'Furia oni: +8 % de XP', 'Oni fury: +8% XP'),
    fenix: H('incansable', 1, 'Renacer de las cenizas: recupera energía al doble', 'Rise from the ashes: recovers energy twice as fast'),
    trex: H('liga', 0.15, 'Rugido jurásico: +15 % de puntos de Liga', 'Jurassic roar: +15% League points'),
    ballena: H('tesoro', 1, 'Canto abisal: sus expediciones siempre traen un recuerdo', 'Abyssal song: its expeditions always bring a souvenir'),
    kraken: H('expedicion', 0.4, 'Tentáculos: +40 % de oro en expediciones', 'Tentacles: +40% expedition gold'),
    djinn: H('recarga', 2, 'Tres deseos: 2 cartas más al día', 'Three wishes: 2 more cards a day'),
    nyx: H('bromas', 0.2, 'Manto de sombras: bromas un 20 % más baratas', 'Cloak of shadows: pranks 20% cheaper'),
    aurora: H('cartas', 0.5, 'Bendición estelar: las cartas en ella son un 50 % más fuertes', 'Star blessing: cards on her are 50% stronger'),
    celestial: H('divino', 0.5, 'Dragón del cielo: cartas un 50 % más fuertes y 1 carta más al día', 'Sky dragon: cards 50% stronger and 1 more card a day'),
};
const habilidad = (id) => HABILIDADES[id] || null;
const AREAS_HABILIDAD = ['xp', 'diario', 'vuelta', 'bromas', 'liga', 'expedicion'];

// Probabilidades (en %) de cada rareza por cofre.
const COFRES = {
    basico: { precio: 500, emoji: '📦', es: 'Cofre básico', en: 'Basic chest', color: '#a16207', prob: { comun: 70, rara: 22, epica: 6.5, legendaria: 1.3, mitica: 0.19, divina: 0.01 } },
    epico: { precio: 2000, emoji: '💜', es: 'Cofre épico', en: 'Epic chest', color: '#7c3aed', prob: { comun: 35, rara: 38, epica: 20, legendaria: 5.5, mitica: 1.45, divina: 0.05 } },
    legendario: { precio: 7500, emoji: '👑', es: 'Cofre legendario', en: 'Legendary chest', color: '#d97706', prob: { comun: 0, rara: 35, epica: 40, legendaria: 19, mitica: 5.8, divina: 0.2 } },
};
const PIEDAD = 10;        // a los 10 cofres seguidos sin épica o mejor, el siguiente la trae segura
const MAX_ESTRELLAS = 5;
const DEVOLUCION_REPETIDO = 0.25; // con 5 estrellas, un repetido devuelve el 25 % del cofre en oro

function rarezaAlAzar(cofre, azar, sinEpica = 0) {
    const prob = { ...COFRES[cofre].prob };
    // Piedad: quita común y rara y reparte su probabilidad entre las demás.
    if (sinEpica >= PIEDAD - 1) { prob.comun = 0; prob.rara = 0; }
    const total = Object.values(prob).reduce((a, b) => a + b, 0);
    let x = azar() * total;
    // De la más rara a la más común (así los decimales pequeños cuentan bien).
    for (const r of ['divina', 'mitica', 'legendaria', 'epica', 'rara', 'comun']) {
        x -= prob[r] || 0;
        if (x < 0) return r;
    }
    return 'comun';
}
// Compañeros propios de cada servidor (1.20.0): los sube el admin desde el panel con su foto.
// Solo salen en los cofres de ese servidor (`extra`), pero luego son tuyos en todos.
// Su id es «s:<guildId>:<cid>». Se cargan en memoria (utils/compis.js → cargarPersonalizados).
const PERSONALIZADOS = new Map();
const RAREZAS_PERSONALIZADAS = ['comun', 'rara', 'epica', 'legendaria', 'mitica'];
const esPersonalizado = (id) => typeof id === 'string' && id.startsWith('s:');
// Fuera del catálogo fijo (de un servidor o del Pack anime).
const esExtra = (id) => typeof id === 'string' && (id.startsWith('s:') || id.startsWith('a:'));
function registrarPersonalizado(c) {
    if (!c || !c.id || !RAREZAS_PERSONALIZADAS.includes(c.rareza)) return;
    PERSONALIZADOS.set(c.id, { rareza: c.rareza, svg: null, imagen: c.imagen || null, emoji: c.emoji || '⭐', es: c.nombre, en: c.nombre, tipo: 'servidor', voz: c.voz || 'tierno', frases: c.frases || [], guildId: c.guildId, desc: c.desc || '', activo: c.activo !== false });
}
const olvidarPersonalizado = (id) => PERSONALIZADOS.delete(id);

// Pack anime (1.22.0): personajes de anime populares sacados de AniList (data/animePack.json:
// id de AniList, nombre, serie, rareza por popularidad, voz e imagen). Las fotos se cargan
// de AniList al usarse (no van en el repo). Solo salen en los cofres de los servidores que
// lo activan (cfg.compis.anime). Su id es «a:<idAniList>». Kurumi Tokisaki es DIVINA.
const ANILIST_IMG = 'https://s4.anilist.co/file/anilistcdn/character/large/';
const KURUMI = 70069;
const FRASES_KURUMI = [
    ['Ara ara… ¿vienes a visitarme, {d}? Qué detalle.', 'Ara ara… coming to visit me, {d}? How sweet.'],
    ['El tiempo es lo más valioso que tengo. Hoy te regalo un poco.', 'Time is the most precious thing I have. Today I’ll give you some.'],
    ['*el reloj de su ojo marca las doce*', '*the clock in her eye strikes twelve*'],
    ['Tic, tac… ¿lo oyes? Es el sonido de pasar el rato contigo.', 'Tick, tock… hear that? That’s the sound of spending time with you.'],
    ['Podría parar el tiempo… pero prefiero que dure esto.', 'I could stop time… but I’d rather this lasted.'],
    ['Qué suerte tienes. Muy pocos llegan a conocerme.', 'How lucky you are. Very few ever get to meet me.'],
];
// Poder de cada personaje según su personalidad (data/animePoderes.txt: id|tipo|es|en).
const PODERES_ANIME = new Map();
for (const l of require('fs').readFileSync(require('path').join(__dirname, '..', 'data', 'animePoderes.txt'), 'utf8').split('\n')) {
    if (!l.trim() || l.startsWith('#')) continue;
    const [id, tipo, es, en] = l.split('|');
    PODERES_ANIME.set(Number(id), { tipo: tipo.trim(), es: es.trim(), en: (en && !en.startsWith('#') ? en : es).trim() });
}
const ANIME = new Map();
for (const c of require('../data/animePack.json')) {
    ANIME.set(`a:${c.id}`, {
        rareza: c.r, svg: null, imagen: ANILIST_IMG + c.i, emoji: c.id === KURUMI ? '🕰️' : '🌸', es: c.n, en: c.n,
        tipo: 'anime', serie: c.s, voz: c.v, anilist: c.id, poder: PODERES_ANIME.get(c.id) || null,
        ...(c.id === KURUMI ? { titulo: { es: '🕰️ Dueño del tiempo', en: '🕰️ Master of time' }, frases: FRASES_KURUMI } : {}),
    });
}
const esAnime = (id) => typeof id === 'string' && id.startsWith('a:');
// Ids del pack que pueden salir aquí (sin las series que el servidor ha quitado).
function idsAnime(fuera = []) {
    const quitar = new Set(fuera);
    return [...ANIME.entries()].filter(([, c]) => !quitar.has(c.serie)).map(([id]) => id);
}
// Datos de un compañero (del catálogo o de un servidor). Nunca devuelve undefined.
function def(id) {
    return COMPANEROS[id] || PERSONALIZADOS.get(id) || ANIME.get(id) || { rareza: 'comun', svg: null, emoji: '❔', es: 'Compañero perdido', en: 'Lost companion', perdido: true };
}
// `quitados`: los que este servidor no quiere (series quitadas del Pack anime). Se tira sobre la
// lista COMPLETA y, si toca uno quitado, sale en su lugar uno del catálogo de esa rareza. Así
// quitar series nunca hace más fácil a nadie (no vale quitarlo todo menos tu favorito).
function companeroAlAzar(rareza, azar, extra = [], quitados = null) {
    const catalogo = Object.keys(COMPANEROS).filter((id) => COMPANEROS[id].rareza === rareza);
    const lista = [...catalogo, ...extra.filter((id) => def(id).rareza === rareza)];
    const id = lista[Math.floor(azar() * lista.length) % lista.length];
    if (!quitados || !quitados.has(id) || !catalogo.length) return id;
    return catalogo[Math.floor(azar() * catalogo.length) % catalogo.length];
}
// Abre un cofre sobre una colección. Devuelve lo que sale y cómo queda la colección.
function abrir(coleccion, cofre, azar = require('./casinoNucleo.js').azarSeguro, extra = [], quitados = null) {
    if (!COFRES[cofre]) return { fallo: 'cofre' };
    const sinEpica = coleccion.sinEpica || 0;
    const rareza = rarezaAlAzar(cofre, azar, sinEpica);
    const id = companeroAlAzar(rareza, azar, extra, quitados);
    const yaLo = (coleccion.mascotas || []).find((x) => x.id === id);
    let estrellas = 1; let devuelto = 0; let nuevo = true;
    if (yaLo) {
        nuevo = false;
        if (yaLo.estrellas >= MAX_ESTRELLAS) { estrellas = MAX_ESTRELLAS; devuelto = Math.floor(COFRES[cofre].precio * DEVOLUCION_REPETIDO); }
        else estrellas = yaLo.estrellas + 1;
    }
    const piedad = sinEpica >= PIEDAD - 1;
    return { id, rareza, nuevo, estrellas, devuelto, piedad, sinEpica: RAREZAS[rareza].orden >= 2 ? 0 : sinEpica + 1 };
}

// Ventajas del compañero equipado (cada estrella de más suma un 20 % de lo base).
// `extra`: lo que suma el cuidado (nivel de afinidad y si está feliz), de utils/compisNucleo.js.
function ventajas(id, estrellas = 1, extra = 0) {
    const c = def(id);
    if (c.perdido) return { xp: 0, diario: 0, vuelta: 0, bromas: 0, liga: 0, expedicion: 0 };
    const r = RAREZAS[c.rareza];
    const k = (1 + 0.2 * (Math.max(1, Math.min(MAX_ESTRELLAS, estrellas)) - 1)) * (1 + Math.max(0, extra));
    const red = (v) => Math.round(v * k * 1000) / 1000;
    const v = { xp: red(r.xp), diario: red(r.diario), vuelta: red(r.vuelta), bromas: red(r.bromas), liga: red(r.liga), expedicion: red(r.expedicion) };
    // Su habilidad exclusiva suma a esa ventaja (también crece con estrellas y cuidado).
    const h = habilidad(id);
    if (h && AREAS_HABILIDAD.includes(h.tipo)) v[h.tipo] = red(r[h.tipo] + h.valor);
    // Descuento en bromas: tope del 60 % (con todas las estrellas y nivel).
    v.bromas = Math.min(0.6, v.bromas);
    return v;
}

module.exports = { RAREZAS, COMPANEROS, COFRES, PIEDAD, MAX_ESTRELLAS, DEVOLUCION_REPETIDO, rarezaAlAzar, companeroAlAzar, abrir, ventajas, def, PERSONALIZADOS, RAREZAS_PERSONALIZADAS, registrarPersonalizado, olvidarPersonalizado, esPersonalizado, esExtra, ANIME, esAnime, idsAnime, KURUMI, PODERES_ANIME, HABILIDADES, habilidad, AREAS_HABILIDAD };
