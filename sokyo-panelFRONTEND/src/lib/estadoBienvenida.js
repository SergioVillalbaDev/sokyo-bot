// ¿Se va a mandar de verdad la bienvenida (o la despedida) cuando alguien entre
// (o salga)? Lo usa BienvenidaView para avisar arriba, en palabras normales, de
// por qué no sale o de por qué sale sin notificación. Mismas reglas que el bot
// (utils/bienvenida.js y utils/embeds.js). Tiene test (test/bienvenidas.test.js).

const camposCompletos = (e) => (Array.isArray(e?.campos) ? e.campos.filter((c) => c && c.nombre && c.valor) : []);

// Lo que cuenta como «hay embed» al enviar (embedTieneContenido del bot).
export function embedTieneContenido(e) {
  if (!e) return false;
  return !!(e.titulo || e.descripcion || e.imagenUrl || e.imagenArchivo
    || e.miniaturaUrl || e.miniaturaArchivo || e.autorNombre || e.footer
    || camposCompletos(e).length);
}

// Textos del embed donde se puede escribir {mention}.
const textosEmbed = (e) => (e ? [e.titulo, e.descripcion, e.autorNombre, e.footer, ...camposCompletos(e).flatMap((c) => [c.nombre, c.valor])] : []);

// `conf`: { activo, canalId, contenido, mencionar, embed } · `canales`: los de texto del servidor.
// Devuelve { tipo: 'ok' | 'aviso' | 'error', clave } — `clave` es el texto en dashboard.bienvenida_v.estado.
export function estadoMensaje(conf, { tipo = 'bienvenida', canales = [] } = {}) {
  const c = conf || {};
  if (!c.activo) return { tipo: 'error', clave: 'apagado' };
  if (!c.canalId) return { tipo: 'error', clave: 'sinCanal' };
  if (canales.length && !canales.some((x) => x.id === c.canalId)) return { tipo: 'error', clave: 'canalBorrado' };
  const texto = String(c.contenido || '');
  if (!texto.trim() && !embedTieneContenido(c.embed)) return { tipo: 'error', clave: 'vacio' };

  // Solo en la bienvenida: ¿le llega notificación a quien entra?
  // Discord solo avisa por las menciones del texto, nunca por las de un embed.
  if (tipo === 'bienvenida') {
    const enTexto = texto.includes('{mention}');
    if (!c.mencionar && enTexto) return { tipo: 'aviso', clave: 'sinPing' };
    if (!enTexto) {
      const enEmbed = textosEmbed(c.embed).some((t) => String(t || '').includes('{mention}'));
      return { tipo: 'aviso', clave: enEmbed ? 'mencionEnEmbed' : 'sinMencion' };
    }
    return { tipo: 'ok', clave: 'okConAviso' };
  }
  return { tipo: 'ok', clave: 'ok' };
}
