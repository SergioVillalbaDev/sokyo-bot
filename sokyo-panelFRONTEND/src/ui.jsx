import { useEffect, useState } from 'react';

export function Interruptor({ checked, onChange, disabled, titulo }) {
  return (
    <label className="switch" title={titulo}>
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />
      <span className="pista" />
    </label>
  );
}

export function FilaInterruptor({ titulo, descripcion, checked, onChange, disabled }) {
  return (
    <div className="fila-switch">
      <div><strong style={{ fontSize: '.92rem' }}>{titulo}</strong>{descripcion && <div className="small muted" style={{ marginTop: 2 }}>{descripcion}</div>}</div>
      <Interruptor checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export function Campo({ etiqueta, ayuda, children }) {
  return <div className="campo"><label>{etiqueta}</label>{children}{ayuda && <span className="ayuda">{ayuda}</span>}</div>;
}

export function Aviso({ tipo = 'info', children }) {
  const icono = { info: 'ℹ️', warn: '⚠️', error: '⛔', ok: '✅' }[tipo];
  return <div className={`aviso ${tipo}`}><span>{icono}</span><div>{children}</div></div>;
}

export function Modal({ titulo, onCerrar, children }) {
  useEffect(() => {
    const f = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onCerrar]);
  return (
    <div className="modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <h3>{titulo}</h3>
        {children}
      </div>
    </div>
  );
}

export function Toasts() {
  const [lista, setLista] = useState([]);
  useEffect(() => {
    const f = (e) => {
      const t = e.detail;
      setLista((l) => [...l.slice(-3), t]);
      setTimeout(() => setLista((l) => l.filter((x) => x.id !== t.id)), 4500);
    };
    window.addEventListener('sokyo:toast', f);
    return () => window.removeEventListener('sokyo:toast', f);
  }, []);
  return <div className="toasts" aria-live="polite">{lista.map((t) => <div key={t.id} className={`toast ${t.tipo}`}>{t.mensaje}</div>)}</div>;
}

export function RolChip({ rol }) {
  return <span className="rol-chip" style={{ borderColor: `${rol.color}88` }}><i style={{ background: rol.color }} />{rol.nombre}</span>;
}

export const Estrellas = ({ valor }) => (
  valor ? <span className="estrellas">{'★'.repeat(Math.round(valor))}{'☆'.repeat(5 - Math.round(valor))}</span> : <span className="muted small">Sin valorar</span>
);
