// Renderizador mínimo y seguro del Markdown de Discord (sin dangerouslySetInnerHTML):
// **negrita**, *cursiva*, __subrayado__, `código`, [enlaces](url), URLs y menciones <#id> <@id> <@&id>.

// Los caracteres escapados (\*) se protegen para que no se interpreten como formato.
const ESCAPABLES = '*_`~|>\\[]()#-';
const proteger = (texto) => texto.replace(/\\([*_`~|>\\[\]()#-])/g, (_, c) => String.fromCharCode(0xe000 + ESCAPABLES.indexOf(c)));
const restaurar = (texto) => texto.replace(/[\uE000-\uE0FF]/g, (c) => ESCAPABLES[c.charCodeAt(0) - 0xe000]);

const PATRON = /(\*\*[^*]+?\*\*|__[^_]+?__|`[^`]+?`|\[[^\]]+?\]\(https?:\/\/[^\s)]+\)|<#\d+>|<@&\d+>|<@!?\d+>|https?:\/\/[^\s<>]+|\*[^*\s][^*]*?\*)/g;

function renderizarLinea(linea, opciones, claveBase) {
  const partes = linea.split(PATRON);
  return partes.map((parte, i) => {
    const clave = `${claveBase}-${i}`;
    if (!parte) return null;
    if (i % 2 === 0) return restaurar(parte);
    if (parte.startsWith('**')) return <strong key={clave}>{restaurar(parte.slice(2, -2))}</strong>;
    if (parte.startsWith('__')) return <u key={clave}>{restaurar(parte.slice(2, -2))}</u>;
    if (parte.startsWith('`')) return <code key={clave}>{restaurar(parte.slice(1, -1))}</code>;
    if (parte.startsWith('[')) {
      const [, texto, url] = parte.match(/^\[([^\]]+)\]\((.+)\)$/) || [];
      return <a key={clave} href={url} target="_blank" rel="noopener noreferrer">{restaurar(texto || url)}</a>;
    }
    if (parte.startsWith('<#')) {
      const id = parte.slice(2, -1);
      return <span key={clave} className="mencion">#{opciones.canales?.[id] || 'canal'}</span>;
    }
    if (parte.startsWith('<@&')) {
      const id = parte.slice(3, -1);
      return <span key={clave} className="mencion">@{opciones.roles?.[id] || 'rol'}</span>;
    }
    if (parte.startsWith('<@')) {
      const id = parte.replace(/[<@!>]/g, '');
      return <span key={clave} className="mencion">@{opciones.usuarios?.[id] || 'usuario'}</span>;
    }
    if (parte.startsWith('http')) {
      return <a key={clave} href={parte} target="_blank" rel="noopener noreferrer">{parte}</a>;
    }
    return <em key={clave}>{restaurar(parte.slice(1, -1))}</em>;
  });
}

export default function Markdown({ texto, canales, roles, usuarios }) {
  if (!texto) return null;
  const lineas = proteger(String(texto)).split('\n');
  return lineas.map((linea, i) => {
    const cita = linea.startsWith('> ');
    const contenido = renderizarLinea(cita ? linea.slice(2) : linea, { canales, roles, usuarios }, i);
    return (
      <span key={i}>
        {cita ? <span style={{ borderLeft: '3px solid var(--border-strong)', paddingLeft: 8, display: 'inline-block' }}>{contenido}</span> : contenido}
        {i < lineas.length - 1 && '\n'}
      </span>
    );
  });
}
