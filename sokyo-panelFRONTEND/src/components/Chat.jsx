// Conversación de un ticket. modo="lista" (panel, estilo Discord) o modo="burbujas" (portal).
import { useLayoutEffect, useRef, useState } from 'react';
import { useAhora } from '../hooks.js';
import { esImagen, etiquetaDia, fechaLarga, hora, nombreArchivo } from '../utils.js';
import { Avatar, Cargando } from './ui.jsx';
import Icono from './Icono.jsx';
import Markdown from './Markdown.jsx';

const AGRUPAR_MS = 5 * 60 * 1000;
const esDeStaff = (m) => m.esStaff || m.usuarioId === 'sokyo-web'; // 'sokyo-web': respuestas web de versiones anteriores

function agrupar(mensajes) {
  const items = [];
  let anterior = null;
  for (const m of mensajes) {
    const fecha = new Date(m.fecha);
    const nuevoDia = !anterior || new Date(anterior.fecha).toDateString() !== fecha.toDateString();
    if (nuevoDia) items.push({ tipo: 'dia', fecha: m.fecha, clave: `dia-${m._id}` });
    const agrupado = !nuevoDia && anterior.usuarioId === m.usuarioId && fecha - new Date(anterior.fecha) < AGRUPAR_MS;
    items.push({ tipo: 'msg', m, agrupado, clave: m._id });
    anterior = m;
  }
  return items;
}

function Adjunto({ url, alCargar }) {
  const [rota, setRota] = useState(false);
  if (esImagen(url) && !rota) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img className="adjunto-img" src={url} alt="Imagen adjunta" onLoad={alCargar} onError={() => setRota(true)} loading="lazy" />
      </a>
    );
  }
  return <a className="adjunto-archivo" href={url} target="_blank" rel="noopener noreferrer"><Icono nombre="clip" />{nombreArchivo(url)}</a>;
}

function Adjuntos({ urls, alCargar }) {
  if (!urls?.length) return null;
  return <div className="adjuntos">{urls.map(url => <Adjunto key={url} url={url} alCargar={alCargar} />)}</div>;
}

export default function Chat({
  mensajes, modo = 'lista', miId, descripcion, puedeEscribir, motivoBloqueo,
  onEnviar, placeholder = 'Escribe un mensaje…', ayuda, maximo = 2000, contexto = {}
}) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const refLista = useRef(null);
  const refTexto = useRef(null);
  const pegadoAbajo = useRef(true);
  const ahora = useAhora();

  const bajar = () => {
    const el = refLista.current;
    if (el && pegadoAbajo.current) el.scrollTop = el.scrollHeight;
  };
  // Solo bajamos solos si el usuario ya estaba abajo (no le movemos mientras lee).
  useLayoutEffect(bajar, [mensajes?.length]);

  const alDesplazar = () => {
    const el = refLista.current;
    pegadoAbajo.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const ajustarAltura = () => {
    const el = refTexto.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };

  const enviar = async () => {
    const limpio = texto.trim();
    if (!limpio || enviando || limpio.length > maximo) return;
    setEnviando(true);
    try {
      await onEnviar(limpio);
      setTexto('');
      pegadoAbajo.current = true;
      requestAnimationFrame(ajustarAltura);
    } catch {
      // Quien llama ya muestra el error; conservamos el texto para no perderlo.
    } finally {
      setEnviando(false);
      refTexto.current?.focus();
    }
  };

  const burbujas = modo === 'burbujas';
  const items = mensajes ? agrupar(mensajes) : [];

  return (
    <div className={`chat ${burbujas ? 'burbujas' : ''}`}>
      <div className="chat-mensajes" ref={refLista} onScroll={alDesplazar}>
        {descripcion && (
          <div className="chat-inicial">
            <span className="etiqueta">📝 Descripción inicial</span>
            <p>{descripcion}</p>
          </div>
        )}
        {!mensajes && <Cargando texto="Cargando conversación…" />}
        {mensajes?.length === 0 && <p className="texto-3" style={{ textAlign: 'center', padding: '32px 0' }}>Todavía no hay mensajes. ¡Escribe el primero!</p>}
        {items.map(item => {
          if (item.tipo === 'dia') return <div key={item.clave} className="chat-dia">{etiquetaDia(item.fecha, ahora)}</div>;
          const { m, agrupado } = item;
          const staff = esDeStaff(m);
          const mio = burbujas && m.usuarioId === miId;
          const clases = ['msg', agrupado ? '' : 'inicio-grupo', staff ? 'staff' : '', m.borrado ? 'borrado' : '', mio ? 'mio' : ''].join(' ');
          const contenido = (
            <>
              {m.contenido && <div className="texto"><Markdown texto={m.contenido} {...contexto} /></div>}
              <Adjuntos urls={m.imagenes} alCargar={bajar} />
              {(m.editado || m.borrado) && (
                <span className="marca-msg">{m.borrado ? '🗑️ borrado en Discord' : '(editado)'}</span>
              )}
            </>
          );
          return (
            <div key={item.clave} className={clases}>
              <div className="lateral-msg">
                {agrupado
                  ? <div className="hora-lateral">{hora(m.fecha)}</div>
                  : !mio && <Avatar src={m.avatar} nombre={m.usuario} tamaño={40} />}
              </div>
              <div className="cuerpo">
                {!agrupado && (
                  <div className="cabecera-msg">
                    <span className="autor">{mio ? 'Tú' : m.usuario}</span>
                    {staff && <span className="insignia-staff">STAFF</span>}
                    <span className="hora-msg" title={fechaLarga(m.fecha)}>{hora(m.fecha)}</span>
                    {m.origen && m.origen !== 'discord' && <span className="marca-msg">· vía {m.origen === 'panel' ? 'panel web' : 'portal'}</span>}
                  </div>
                )}
                {burbujas ? <div className="burbuja">{contenido}</div> : contenido}
              </div>
            </div>
          );
        })}
      </div>

      {puedeEscribir ? (
        <>
          <div className="composer">
            <textarea
              ref={refTexto}
              className="entrada"
              rows={1}
              value={texto}
              placeholder={placeholder}
              maxLength={maximo}
              aria-label="Mensaje"
              onChange={(e) => { setTexto(e.target.value); ajustarAltura(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
            />
            <button className="btn btn-primario" onClick={enviar} disabled={!texto.trim() || enviando} aria-label="Enviar mensaje">
              {enviando ? <span className="cargador" style={{ width: 16, height: 16 }} /> : <Icono nombre="enviar" />}
              <span>Enviar</span>
            </button>
          </div>
          <div className="composer-ayuda">
            <span><kbd>Enter</kbd> para enviar · <kbd>Shift</kbd>+<kbd>Enter</kbd> nueva línea{ayuda ? ` · ${ayuda}` : ''}</span>
            {texto.length > maximo * 0.8 && <span>{texto.length}/{maximo}</span>}
          </div>
        </>
      ) : (
        <div className="composer-cerrado">{motivoBloqueo || 'No puedes escribir en esta conversación.'}</div>
      )}
    </div>
  );
}
