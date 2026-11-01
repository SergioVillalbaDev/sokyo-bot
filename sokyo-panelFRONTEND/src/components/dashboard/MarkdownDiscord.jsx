// Texto con el formato de Discord para las vistas previas del panel (VistaDiscord.jsx,
// EmbedBuilder.jsx): negrita, cursiva, subrayado, tachado, código, enlaces,
// encabezados, citas y listas; además, las menciones (@alguien, #canal) en azul
// como en Discord y los emojis del servidor (<:nombre:id>) como imagen.
// --- Mini-renderizador de Markdown para la vista previa (imita a Discord) ---
// Reglas en línea: el orden importa (los marcadores largos antes que los cortos).
const REGLAS_MD = [
  { re: /\*\*\*([\s\S]+?)\*\*\*/, wrap: (n, k) => <strong key={k} className="font-bold text-white"><em>{n}</em></strong> },
  { re: /\*\*([\s\S]+?)\*\*/, wrap: (n, k) => <strong key={k} className="font-bold text-white">{n}</strong> },
  { re: /__([\s\S]+?)__/, wrap: (n, k) => <span key={k} className="underline">{n}</span> },
  { re: /~~([\s\S]+?)~~/, wrap: (n, k) => <span key={k} className="line-through">{n}</span> },
  { re: /\*([\s\S]+?)\*/, wrap: (n, k) => <em key={k}>{n}</em> },
  { re: /_([\s\S]+?)_/, wrap: (n, k) => <em key={k}>{n}</em> },
  { re: /`([^`]+?)`/, code: true },
  { re: /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/, link: true },
  { re: /<(a?):(\w{2,32}):(\d{5,25})>/, emoji: true },
  // @nombre y #canal (como salen las variables {mention}, {inviter}…): no cuentan «#123»,
  // «C#» ni lo que va dentro de una dirección web (https://x.com/#seccion).
  { re: /(?<![\p{L}\p{N}/:=&<@#])([@#](?!\d)[^\s@#<>.,;:!?¡¿()"'[\]{}*~|`]+)/u, mencion: true },
];

// Procesa el texto en línea y devuelve nodos React (negrita, cursiva, código…).
function parseInline(text, kp = 'i') {
  if (!text) return [];
  let best = null;
  REGLAS_MD.forEach((rule, r) => {
    const m = new RegExp(rule.re.source, rule.re.flags).exec(text); // con sus banderas (la «u» de \p{L})
    if (m && (best === null || m.index < best.m.index)) best = { r, m, rule };
  });
  if (!best) return [text];
  const { m, rule } = best;
  const key = `${kp}-${m.index}`;
  const before = text.slice(0, m.index);
  const after = text.slice(m.index + m[0].length);
  let node;
  if (rule.code) node = <code key={key} className="rounded bg-black/40 px-1 py-0.5 text-[0.85em]">{m[1]}</code>;
  else if (rule.emoji) node = <img key={key} src={`https://cdn.discordapp.com/emojis/${m[3]}.${m[1] ? 'gif' : 'webp'}?size=48`} alt={`:${m[2]}:`} title={`:${m[2]}:`} className="inline-block h-[1.3em] w-[1.3em] align-[-0.3em] object-contain" />;
  else if (rule.mencion) node = <span key={key} className="rounded-[3px] bg-[#5865f2]/30 px-0.5 font-medium text-[#c9cdfb]">{m[1]}</span>;
  else if (rule.link) node = <span key={key} className="text-[#00a8fc]">{m[1]}</span>;
  else node = rule.wrap(parseInline(m[1], `${key}.`), key);
  return [before, node, ...parseInline(after, `${kp}x`)];
}

// Renderiza el texto completo (bloques: encabezados, citas, listas, código).
export default function MarkdownDiscord({ text }) {
  const lineas = String(text || '').split('\n');
  const out = [];
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    if (l.trim().startsWith('```')) {                       // bloque de código
      const buf = [];
      i++;
      while (i < lineas.length && !lineas[i].trim().startsWith('```')) { buf.push(lineas[i]); i++; }
      out.push(<pre key={`c${i}`} className="my-1 overflow-x-auto whitespace-pre-wrap rounded bg-black/40 p-2 text-xs">{buf.join('\n')}</pre>);
    } else if (/^>\s?/.test(l)) {                           // cita (agrupa líneas seguidas)
      const buf = [];
      while (i < lineas.length && /^>\s?/.test(lineas[i])) { buf.push(lineas[i].replace(/^>\s?/, '')); i++; }
      i--;
      out.push(<div key={`q${i}`} className="my-1 border-l-4 border-white/30 pl-2">{buf.map((b, j) => <p key={j}>{parseInline(b)}</p>)}</div>);
    } else if (/^###\s/.test(l)) out.push(<p key={i} className="mt-1 text-base font-bold text-white">{parseInline(l.replace(/^###\s/, ''))}</p>);
    else if (/^##\s/.test(l)) out.push(<p key={i} className="mt-1 text-lg font-bold text-white">{parseInline(l.replace(/^##\s/, ''))}</p>);
    else if (/^#\s/.test(l)) out.push(<p key={i} className="mt-1 text-xl font-bold text-white">{parseInline(l.replace(/^#\s/, ''))}</p>);
    else if (/^[-*]\s/.test(l)) out.push(<p key={i} className="flex gap-1.5"><span>•</span><span>{parseInline(l.replace(/^[-*]\s/, ''))}</span></p>);
    else if (l.trim() === '') out.push(<div key={i} className="h-2" />);
    else out.push(<p key={i}>{parseInline(l)}</p>);
  }
  return <>{out}</>;
}

