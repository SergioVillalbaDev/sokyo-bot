// Copiar la configuración de un servidor a otro: los canales y roles se buscan
// por su nombre en el servidor de destino (y, en los canales, también por tipo).
// Lo que allí no existe se deja vacío y se cuenta, para avisar de qué falta.
const ES_ID = /^\d{15,22}$/;
// Mensajes publicados en el servidor de origen: en el destino no existen.
const ES_MENSAJE = /mensajeId$|MensajeId$|^ultimoAvisoId$|^invitacionCodigo$/;

function remapearIds(cfg, origen, destino) {
    const canalDestino = new Map();
    for (const c of destino.channels.cache.values()) {
        const k = `${c.type}|${c.name.toLowerCase()}`;
        if (!canalDestino.has(k)) canalDestino.set(k, c.id);
        if (!canalDestino.has(`*|${c.name.toLowerCase()}`)) canalDestino.set(`*|${c.name.toLowerCase()}`, c.id);
    }
    const rolDestino = new Map();
    for (const r of destino.roles.cache.values()) if (!rolDestino.has(r.name.toLowerCase())) rolDestino.set(r.name.toLowerCase(), r.id);

    const faltan = new Map(); // `tipo|nombre` -> { tipo, nombre }
    const mapear = (v) => {
        if (typeof v !== 'string' || !ES_ID.test(v)) return v;
        if (v === origen.id) return destino.id;
        const canal = origen.channels.cache.get(v);
        if (canal) {
            const n = canal.name.toLowerCase();
            const id = canalDestino.get(`${canal.type}|${n}`) || canalDestino.get(`*|${n}`);
            if (!id) faltan.set(`canal|${canal.name}`, { tipo: 'canal', nombre: canal.name });
            return id || null;
        }
        const rol = origen.roles.cache.get(v);
        if (rol) {
            const id = rolDestino.get(rol.name.toLowerCase());
            if (!id) faltan.set(`rol|${rol.name}`, { tipo: 'rol', nombre: rol.name });
            return id || null;
        }
        return v; // un usuario u otra cosa: igual sirve en el otro servidor
    };
    // En una lista, lo que se queda sin su canal o su rol (una recompensa de nivel, un
    // autorol…) sobra: se quita entero.
    const perdido = (x) => x === null || (!!x && typeof x === 'object' && (('rolId' in x && x.rolId === null) || ('canalId' in x && x.canalId === null)));
    const recorrer = (v, clave = '') => {
        if (ES_MENSAJE.test(clave)) return null;
        if (Array.isArray(v)) return v.map((x) => recorrer(x)).filter((x) => !perdido(x));
        if (v && typeof v === 'object' && !(v instanceof Date)) {
            const out = {};
            for (const [k, x] of Object.entries(v)) out[k] = recorrer(x, k);
            return out;
        }
        return mapear(v);
    };
    return { cfg: recorrer(cfg), faltan: [...faltan.values()] };
}

module.exports = { remapearIds };
