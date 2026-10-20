// Piezas pequeñas de interfaz reutilizadas en el panel y el portal.
import { useState } from 'react';
import { textoSobre } from '../utils.js';

const COLORES_AVATAR = ['#5865f2', '#eb459e', '#3ba55c', '#faa61a', '#ed4245', '#9b59b6', '#1abc9c'];

export function Avatar({ src, nombre = '?', tamaño = 32 }) {
  const [fallo, setFallo] = useState(false);
  const estilo = { width: tamaño, height: tamaño };
  if (src && !fallo) {
    return <img className="avatar" src={src} alt="" style={estilo} loading="lazy" onError={() => setFallo(true)} />;
  }
  const inicial = (nombre || '?').trim().charAt(0).toUpperCase() || '?';
  const color = COLORES_AVATAR[[...(nombre || '')].reduce((s, c) => s + c.charCodeAt(0), 0) % COLORES_AVATAR.length];
  return (
    <span className="avatar avatar-iniciales" style={{ ...estilo, background: color, fontSize: tamaño * 0.42 }} aria-hidden>
      {inicial}
    </span>
  );
}

export function Estrellas({ valor, tamaño = 14 }) {
  if (!valor) return <span className="texto-3 pequeño">Sin valorar</span>;
  const redondeado = Math.round(valor);
  return (
    <span className="estrellas" style={{ fontSize: tamaño }} role="img" aria-label={`${Number(valor).toFixed(1)} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map(n => <span key={n} className={n <= redondeado ? '' : 'apagada'}>★</span>)}
    </span>
  );
}

export function SelectorEstrellas({ valor, onCambio }) {
  const [hover, setHover] = useState(0);
  const mostrado = hover || valor;
  return (
    <div className="selector-estrellas" role="radiogroup" aria-label="Valoración" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" role="radio" aria-checked={valor === n} aria-label={`${n} estrella${n > 1 ? 's' : ''}`}
          className={n <= mostrado ? 'activa' : ''} onMouseEnter={() => setHover(n)} onClick={() => onCambio(n)}>★</button>
      ))}
    </div>
  );
}

export function InsigniaPrioridad({ nombre, color }) {
  return <span className="insignia insignia-prioridad" style={{ background: color, color: textoSobre(color) }}>{nombre}</span>;
}

export function InsigniaEstado({ ticket }) {
  if (ticket.canalEliminado) return <span className="insignia">🗑️ Canal eliminado</span>;
  if (ticket.estado === 'Cerrado') return <span className="insignia insignia-peligro"><span className="punto" />Cerrado</span>;
  return <span className="insignia insignia-ok"><span className="punto" />Abierto</span>;
}

export function InsigniaEspera({ ticket }) {
  if (ticket.estado !== 'Abierto') return null;
  return ticket.esperando === 'usuario'
    ? <span className="insignia">💬 Esperando al usuario</span>
    : <span className="insignia insignia-aviso">⏳ Esperando respuesta</span>;
}

export function Vacio({ emoji = '📭', titulo, children, accion }) {
  return (
    <div className="vacio">
      <div className="emoji" aria-hidden>{emoji}</div>
      {titulo && <h3>{titulo}</h3>}
      {children && <p>{children}</p>}
      {accion}
    </div>
  );
}

export function Cargando({ texto = 'Cargando…' }) {
  return (
    <div className="cargador-centrado" role="status">
      <div className="columna" style={{ alignItems: 'center' }}>
        <div className="cargador" />
        <span className="texto-3 pequeño">{texto}</span>
      </div>
    </div>
  );
}

export function AvisoError({ error, onReintentar }) {
  if (!error) return null;
  return (
    <div className="aviso aviso-error" role="alert">
      <span aria-hidden>⚠️</span>
      <div style={{ flex: 1 }}>
        <strong>{error.message || 'Ha ocurrido un error'}</strong>
        {error.status === 0 && <span className="pequeño">Revisa que el bot esté encendido y que VITE_API_URL apunte a él.</span>}
      </div>
      {onReintentar && <button className="btn btn-sm btn-secundario" onClick={onReintentar}>Reintentar</button>}
    </div>
  );
}

// Campo de formulario con etiqueta, ayuda y contador de caracteres opcional.
export function Campo({ etiqueta, ayuda, id, max, valor, children }) {
  const largo = typeof valor === 'string' ? valor.length : 0;
  return (
    <div className="campo">
      <div className="fila-entre">
        <label htmlFor={id}>{etiqueta}</label>
        {max && <span className={`contador ${largo > max * 0.9 ? 'limite' : ''}`}>{largo}/{max}</span>}
      </div>
      {children}
      {ayuda && <span className="ayuda">{ayuda}</span>}
    </div>
  );
}

export function Interruptor({ titulo, descripcion, activo, onCambio }) {
  return (
    <label className="interruptor">
      <div>
        <div className="negrita">{titulo}</div>
        {descripcion && <div className="texto-3 pequeño">{descripcion}</div>}
      </div>
      <input type="checkbox" checked={activo} onChange={(e) => onCambio(e.target.checked)} />
      <span className="pista" aria-hidden />
    </label>
  );
}

export function Segmentos({ opciones, valor, onCambio, etiqueta }) {
  return (
    <div className="segmentos" role="group" aria-label={etiqueta}>
      {opciones.map(o => (
        <button key={o.valor} type="button" aria-pressed={valor === o.valor} onClick={() => onCambio(o.valor)}>
          {o.texto}
          {o.cuenta != null && <span className="cuenta">{o.cuenta}</span>}
        </button>
      ))}
    </div>
  );
}

// Barra fija inferior que aparece cuando hay cambios sin guardar.
export function BarraGuardar({ visible, guardando, errores = [], onGuardar, onDescartar }) {
  if (!visible) return null;
  return (
    <>
    <div className="barra-guardar-hueco" aria-hidden />
    <div className="barra-guardar" role="region" aria-label="Cambios sin guardar">
      <div className="columna" style={{ gap: 2 }}>
        <strong>Tienes cambios sin guardar</strong>
        {errores.length > 0
          ? <span className="pequeño" style={{ color: 'var(--danger-text)' }}>⚠️ {errores[0]}</span>
          : <span className="texto-3 pequeño">Se aplicarán al momento en Discord.</span>}
      </div>
      <div className="fila">
        <button className="btn btn-fantasma" onClick={onDescartar} disabled={guardando}>Descartar</button>
        <button className="btn btn-primario" onClick={onGuardar} disabled={guardando || errores.length > 0}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
    </>
  );
}
