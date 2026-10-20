import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ContextoConfirmar, ContextoToast } from '../contexto.js';
import Icono from './Icono.jsx';

let siguienteId = 1;

export function ProveedorToast({ children }) {
  const [toasts, setToasts] = useState([]);
  const quitar = useCallback((id) => setToasts(lista => lista.filter(t => t.id !== id)), []);
  const mostrar = useCallback((tipo, texto) => {
    const id = siguienteId++;
    setToasts(lista => [...lista.slice(-3), { id, tipo, texto }]);
    setTimeout(() => quitar(id), tipo === 'error' ? 6000 : 3500);
  }, [quitar]);
  const api = useMemo(() => ({
    exito: (texto) => mostrar('exito', texto),
    error: (texto) => mostrar('error', texto),
    info: (texto) => mostrar('info', texto)
  }), [mostrar]);

  return (
    <ContextoToast.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.tipo}`}>
            <span aria-hidden>{t.tipo === 'exito' ? '✅' : t.tipo === 'error' ? '⚠️' : 'ℹ️'}</span>
            <p>{t.texto}</p>
            <button onClick={() => quitar(t.id)} aria-label="Cerrar aviso"><Icono nombre="cerrar" /></button>
          </div>
        ))}
      </div>
    </ContextoToast.Provider>
  );
}

function Dialogo({ opciones, onResolver }) {
  const [valor, setValor] = useState(opciones.campo?.valorInicial || '');
  const refCampo = useRef(null);
  const refConfirmar = useRef(null);

  useEffect(() => {
    (refCampo.current || refConfirmar.current)?.focus();
    const alPulsar = (e) => { if (e.key === 'Escape') onResolver(false); };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [onResolver]);

  const confirmar = () => onResolver(true, valor);

  return (
    <div className="modal-fondo" onMouseDown={(e) => { if (e.target === e.currentTarget) onResolver(false); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="dialogo-titulo">
        <div className="modal-cuerpo">
          <h2 id="dialogo-titulo">{opciones.titulo}</h2>
          {opciones.mensaje && <p>{opciones.mensaje}</p>}
          {opciones.campo && (
            <div className="campo" style={{ marginTop: 6 }}>
              <label htmlFor="dialogo-campo">{opciones.campo.etiqueta}</label>
              <textarea
                id="dialogo-campo" ref={refCampo} className="entrada" value={valor} maxLength={opciones.campo.max || 500}
                placeholder={opciones.campo.placeholder} onChange={(e) => setValor(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) confirmar(); }}
              />
              {opciones.campo.ayuda && <span className="ayuda">{opciones.campo.ayuda}</span>}
            </div>
          )}
        </div>
        <div className="modal-pie">
          <button className="btn btn-secundario" onClick={() => onResolver(false)}>{opciones.textoCancelar || 'Cancelar'}</button>
          <button ref={refConfirmar} className={`btn ${opciones.peligro ? 'btn-peligro' : 'btn-primario'}`} onClick={confirmar}>
            {opciones.textoConfirmar || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProveedorConfirmar({ children }) {
  const [opciones, setOpciones] = useState(null);
  const resolverRef = useRef(null);

  const confirmar = useCallback((nuevas) => new Promise(resolve => {
    resolverRef.current?.(false); // si había otro diálogo abierto, se cancela
    resolverRef.current = (ok, valor) => resolve(nuevas.campo ? { ok, valor: (valor || '').trim() } : ok);
    setOpciones(nuevas);
  }), []);
  const resolver = useCallback((ok, valor) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setOpciones(null);
    resolve?.(ok, valor);
  }, []);

  // Si se cambia de página (p. ej. con el botón "atrás"), el diálogo pierde su sentido: se cancela.
  useEffect(() => {
    const alNavegar = () => { if (resolverRef.current) resolver(false); };
    window.addEventListener('hashchange', alNavegar);
    return () => window.removeEventListener('hashchange', alNavegar);
  }, [resolver]);

  return (
    <ContextoConfirmar.Provider value={confirmar}>
      {children}
      {opciones && <Dialogo opciones={opciones} onResolver={resolver} />}
    </ContextoConfirmar.Provider>
  );
}
