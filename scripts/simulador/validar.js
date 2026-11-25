// Comprueba un mensaje (ya en JSON) contra los límites de Discord. Si Discord lo rechazaría,
// devuelve la lista de motivos (en Discord real el mensaje no sale y el usuario ve un error).
const esEmoji = (e) => {
    if (!e) return true;
    if (typeof e === 'object') return !!(e.id || (e.name && esEmoji(e.name)));
    return /^\p{RGI_Emoji}$/v.test(e) || /^<a?:\w+:\d+>$/.test(e);
};
const url = (u) => typeof u === 'string' && /^(https?:\/\/|attachment:\/\/)/.test(u);

function validarMensaje(m, { donde = '' } = {}) {
    const mal = [];
    const p = (txt) => mal.push(`${donde}${txt}`);
    const content = m.content ?? '';
    if (typeof content !== 'string') p('content no es texto');
    else if (content.length > 2000) p(`content de ${content.length} (máx 2000)`);
    const embeds = m.embeds || [];
    const files = m.files || [];
    const comps = m.components || [];
    if (!content && !embeds.length && !files.length && !comps.length && !m.poll && !m.__permitirVacio) p('mensaje vacío (Discord 50006)');
    if (embeds.length > 10) p(`${embeds.length} embeds (máx 10)`);
    let total = 0;
    const nombresArchivos = new Set(files.map((f) => f.name));
    embeds.forEach((e, i) => {
        const q = (t) => p(`embed ${i}: ${t}`);
        if (!e || typeof e !== 'object') return q('vacío');
        const len = (s) => (s ? String(s).length : 0);
        if (len(e.title) > 256) q(`título ${len(e.title)}`);
        if (len(e.description) > 4096) q(`descripción ${len(e.description)}`);
        if ((e.fields || []).length > 25) q(`${e.fields.length} campos`);
        for (const f of e.fields || []) {
            if (!f.name || !String(f.name).length) q('campo sin nombre');
            if (f.value == null || !String(f.value).length) q(`campo «${f.name}» sin valor`);
            if (len(f.name) > 256) q(`nombre de campo ${len(f.name)}`);
            if (len(f.value) > 1024) q(`campo «${String(f.name).slice(0, 30)}» de ${len(f.value)} (máx 1024)`);
        }
        if (len(e.footer?.text) > 2048) q('pie largo');
        if (len(e.author?.name) > 256) q('autor largo');
        for (const k of ['image', 'thumbnail']) {
            if (e[k]?.url && !url(e[k].url)) q(`${k} no es una URL: ${String(e[k].url).slice(0, 60)}`);
            if (e[k]?.url?.startsWith('attachment://') && !nombresArchivos.has(e[k].url.slice(13)) && !m.__editar) q(`${k} apunta a ${e[k].url} y no va adjunto`);
        }
        if (e.url && !url(e.url)) q('url no válida');
        const vacio = !e.title && !e.description && !(e.fields || []).length && !e.image && !e.thumbnail && !e.author && !e.footer;
        if (vacio) q('embed vacío');
        total += len(e.title) + len(e.description) + len(e.footer?.text) + len(e.author?.name) + (e.fields || []).reduce((a, f) => a + len(f.name) + len(f.value), 0);
    });
    if (total > 6000) p(`embeds suman ${total} letras (máx 6000)`);
    if (comps.length > 5) p(`${comps.length} filas (máx 5)`);
    const ids = new Set();
    comps.forEach((fila, i) => {
        const q = (t) => p(`fila ${i}: ${t}`);
        if (fila?.type !== 1) return q(`tipo ${fila?.type}`);
        const cs = fila.components || [];
        if (!cs.length) q('fila vacía');
        if (cs.length > 5) q(`${cs.length} componentes`);
        const menus = cs.filter((c) => c.type >= 3 && c.type <= 8);
        if (menus.length && cs.length > 1) q('un desplegable tiene que ir solo en su fila');
        for (const c of cs) {
            if (c.custom_id != null) {
                if (c.custom_id.length > 100) q(`customId de ${c.custom_id.length}: ${c.custom_id.slice(0, 40)}…`);
                if (ids.has(c.custom_id)) q(`customId repetido: ${c.custom_id}`);
                ids.add(c.custom_id);
            }
            if (c.type === 2) {
                if (c.style === 5) { if (!url(c.url)) q(`botón enlace sin URL válida (${c.label})`); }
                else if (!c.custom_id) q(`botón sin customId (${c.label})`);
                if (!c.label && !c.emoji) q('botón sin texto ni emoji');
                if (c.label && c.label.length > 80) q(`botón de ${c.label.length} letras`);
                if (!esEmoji(c.emoji?.id ? c.emoji : c.emoji?.name)) q(`emoji no válido en botón: ${c.emoji?.name}`);
            }
            if (c.type === 3) {
                const ops = c.options || [];
                if (!ops.length || ops.length > 25) q(`desplegable con ${ops.length} opciones`);
                const vals = new Set();
                for (const o of ops) {
                    if (!o.label || o.label.length > 100) q(`opción con etiqueta de ${o.label?.length}`);
                    if (!o.value || o.value.length > 100) q(`opción con valor de ${o.value?.length}`);
                    if (o.description && o.description.length > 100) q('descripción de opción larga');
                    if (vals.has(o.value)) q(`valor repetido: ${o.value}`);
                    vals.add(o.value);
                    if (o.emoji && !esEmoji(o.emoji.id ? o.emoji : o.emoji.name)) q(`emoji no válido en opción: ${o.emoji.name}`);
                }
                if (c.placeholder && c.placeholder.length > 150) q('placeholder largo');
                if ((c.max_values ?? 1) > ops.length) q('max_values mayor que las opciones');
            }
        }
    });
    return mal;
}

function validarModal(m) {
    const mal = [];
    if (!m?.title || m.title.length > 45) mal.push(`modal: título de ${m?.title?.length}`);
    if (!m?.custom_id || m.custom_id.length > 100) mal.push('modal: customId');
    const filas = m?.components || [];
    if (!filas.length || filas.length > 5) mal.push(`modal: ${filas.length} filas`);
    for (const f of filas) {
        for (const c of f.components || []) {
            if (c.type !== 4) continue;
            if (!c.label || c.label.length > 45) mal.push(`modal: etiqueta de ${c.label?.length} («${c.label}»)`);
            if (c.placeholder && c.placeholder.length > 100) mal.push('modal: placeholder largo');
            if (c.value && c.value.length > 4000) mal.push('modal: valor largo');
            if (c.max_length && c.max_length > 4000) mal.push('modal: max_length');
        }
    }
    return mal;
}

module.exports = { validarMensaje, validarModal, esEmoji };
