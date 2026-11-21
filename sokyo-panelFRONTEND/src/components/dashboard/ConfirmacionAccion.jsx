// Ventana de la confirmación doble (1.13.0, utils/confirmacionPanel.js del bot): para
// borrar un rol, un canal o una categoría, o sancionar a varias personas a la vez, hay que
// escribir el código que el bot manda por privado (o, si no puede, el nombre del servidor).
// Se registra en lib/api.js: apiFetch la abre sola cuando la API lo pide.
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, Loader2, X } from 'lucide-react';
import { registrarConfirmacion } from '../../lib/api';

export default function ConfirmacionAccion() {
  const { t } = useTranslation();
  const [pedido, setPedido] = useState(null); // { datos, resolver }
  const [valor, setValor] = useState('');
  const [enviando, setEnviando] = useState(false);
  const campo = useRef(null);

  useEffect(() => registrarConfirmacion((datos) => new Promise((resolver) => {
    setValor(''); setEnviando(false);
    setPedido({ datos, resolver });
  })), []);
  useEffect(() => { if (pedido) setTimeout(() => campo.current?.focus(), 50); }, [pedido]);

  if (!pedido) return null;
  const { datos } = pedido;
  const porNombre = datos.via === 'nombre';
  const cerrar = (v) => { pedido.resolver(v); setPedido(null); };
  const enviar = (e) => { e.preventDefault(); if (!valor.trim()) return; setEnviando(true); cerrar(valor.trim()); };

  return (
    <div className="sk-velo flex items-center justify-center p-3 sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) cerrar(null); }}>
      <form onSubmit={enviar} role="dialog" aria-modal="true" aria-labelledby="conf-titulo"
        className="sk-glass sk-aparece w-full max-w-md rounded-3xl border border-line bg-card p-5 shadow-xl sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-danger/15 text-danger"><ShieldAlert size={20} /></span>
          <div className="min-w-0 flex-1">
            <h2 id="conf-titulo" className="text-lg font-extrabold tracking-tight text-fg">{t('dashboard.confirmar.title')}</h2>
            <p className="mt-0.5 text-sm text-muted">{t(`dashboard.confirmar.acciones.${datos.accion}`, { defaultValue: t('dashboard.confirmar.acciones.otra') })}</p>
          </div>
          <button type="button" onClick={() => cerrar(null)} className="sk-boton-icono shrink-0" aria-label={t('dashboard.confirmar.cancel')}><X size={17} /></button>
        </div>
        <p className="mt-4 text-sm text-fg">{porNombre ? t('dashboard.confirmar.byName', { servidor: datos.servidor }) : t('dashboard.confirmar.byDm')}</p>
        <input ref={campo} value={valor} onChange={(e) => setValor(e.target.value)} autoComplete="one-time-code"
          inputMode={porNombre ? 'text' : 'numeric'} maxLength={porNombre ? 100 : 6} placeholder={porNombre ? datos.servidor : '123456'}
          className={`mt-3 w-full rounded-xl border bg-bg px-3 py-2.5 text-fg outline-none focus:border-brand ${porNombre ? 'text-sm' : 'text-center font-mono text-2xl tracking-[0.4em]'} ${datos.incorrecto ? 'border-danger' : 'border-line'}`} />
        {datos.incorrecto && <p className="mt-2 text-sm font-semibold text-danger">{t('dashboard.confirmar.wrong')}</p>}
        <p className="mt-3 text-xs text-muted">{t('dashboard.confirmar.why')}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => cerrar(null)} className="sk-foco rounded-xl px-4 py-2 text-sm font-semibold text-muted hover:text-fg">{t('dashboard.confirmar.cancel')}</button>
          <button type="submit" disabled={!valor.trim() || enviando} className="sk-foco flex items-center gap-1.5 rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {enviando && <Loader2 size={14} className="animate-spin" />} {t('dashboard.confirmar.confirm')}
          </button>
        </div>
      </form>
    </div>
  );
}
