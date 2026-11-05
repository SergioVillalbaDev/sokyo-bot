// Seguridad · Verificación → «Cerrar el servidor hasta verificarse» (1.9.12).
// Sin el rol de acceso no se ve nada salvo el canal de verificación. Enseña cómo
// está ahora (y qué lo deja abierto) y lo cierra o abre con un botón (solo
// administradores). Bot: utils/cierreServidor.js.
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, LockOpen, Loader2, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Toggle } from '../../ui/primitives';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';

// Una línea de la lista de comprobación (✅ bien / ⚠️ falta algo).
function Punto({ ok, children }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" />}
      <span className="min-w-0 text-fg">{children}</span>
    </li>
  );
}

export default function CierreServidor({ dash }) {
  const { t } = useTranslation();
  const { configServidor, roles = [], canales = [], estadoCierre, cambiarCierre, guardarPreguntasEntrada } = dash;
  const [estado, setEstado] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState(null); // { ok, texto }

  const cargar = useCallback(async () => { setEstado(await estadoCierre()); }, [estadoCierre]);
  // La primera lectura al abrir (y si cambia el rol o el canal de la verificación).
  const clave = `${configServidor?.verificacion?.rolVerificadoId}:${configServidor?.verificacion?.canalId}:${configServidor?.embudoAB?.rolVerificadoId}:${configServidor?.embudoAB?.canalId}:${configServidor?.embudoAB?.activo}`;
  useEffect(() => {
    let vivo = true;
    estadoCierre().then((e) => { if (vivo) setEstado(e); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const accion = async (a) => {
    if (a === 'cerrar' && !window.confirm(t('dashboard.verif_v.lock.confirm'))) return;
    setOcupado(true); setAviso(null);
    const r = await cambiarCierre(a);
    setOcupado(false);
    if (r.error) { setAviso({ ok: false, texto: typeof r.error === 'string' ? r.error : t('dashboard.verif_v.lock.err') }); return; }
    setEstado(r.estado);
    const fallos = (r.fallos || []).map((c) => `#${c.nombre}`).join(', ');
    setAviso({ ok: true, texto: a === 'cerrar' ? t('dashboard.verif_v.lock.closedOk') + (fallos ? ` ${t('dashboard.verif_v.lock.someFailed', { lista: fallos })}` : '') : t('dashboard.verif_v.lock.openedOk') });
  };

  const ocultar = configServidor?.preguntasEntrada?.ocultarVerificacion !== false;
  const nombreRol = (id) => roles.find((r) => r.id === id)?.nombre;
  const nombreCanal = (id) => canales.find((c) => c.id === id)?.nombre;

  return (
    <div data-help="verif-cierre" className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-bold text-fg">{estado?.cerrado ? <Lock size={18} className="text-success" /> : <LockOpen size={18} className="text-warning" />} {t('dashboard.verif_v.lock.title')}</h3>
          <p className="mt-1 text-xs leading-snug text-muted">{t('dashboard.verif_v.lock.desc')}</p>
        </div>
        <button type="button" onClick={cargar} className="rounded-xl border border-line p-2 text-muted transition-colors hover:text-fg" aria-label={t('dashboard.verif_v.lock.refresh')} title={t('dashboard.verif_v.lock.refresh')}><RefreshCw size={14} /></button>
      </div>

      {!estado ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted"><Loader2 size={15} className="animate-spin" /> {t('dashboard.verif_v.lock.loading')}</p>
      ) : (
        <>
          <ul className="mt-4 space-y-2 border-t border-line pt-4">
            <Punto ok={estado.cerrado}>{estado.cerrado ? t('dashboard.verif_v.lock.isClosed') : t('dashboard.verif_v.lock.isOpen')}</Punto>
            <Punto ok={estado.rolAccesoExiste}>{estado.rolAccesoExiste ? t('dashboard.verif_v.lock.role', { r: nombreRol(estado.rolAccesoId) || estado.rolAccesoId }) : t('dashboard.verif_v.lock.noRole')}</Punto>
            <Punto ok={estado.canalVerificacionExiste}>{estado.canalVerificacionExiste ? t('dashboard.verif_v.lock.channel', { c: nombreCanal(estado.canalVerificacionId) || estado.canalVerificacionId }) : t('dashboard.verif_v.lock.noChannel')}</Punto>
            {estado.abiertos.length > 0 && (
              <Punto ok={false}>{t('dashboard.verif_v.lock.openChannels', { lista: estado.abiertos.slice(0, 8).map((c) => `${c.categoria ? '📁' : '#'}${c.nombre}`).join(', ') + (estado.abiertos.length > 8 ? '…' : '') })}</Punto>
            )}
            {estado.autoRolesQueVen.length > 0 && (
              <Punto ok={false}>{t('dashboard.verif_v.lock.autoRoles', { lista: estado.autoRolesQueVen.map((r) => `@${r.nombre}`).join(', ') })}</Punto>
            )}
            {estado.categorias.length > 0 && (
              <Punto ok>{t('dashboard.verif_v.lock.categories', { n: estado.categorias.filter((c) => c.existe).length })}</Punto>
            )}
            {(!estado.bot.gestionarRoles || !estado.bot.gestionarCanales) && <Punto ok={false}>{t('dashboard.verif_v.lock.botPerms')}</Punto>}
          </ul>

          <div className="mt-4 flex items-start justify-between gap-3 border-t border-line pt-4">
            <span className="min-w-0"><span className="block text-sm font-semibold text-fg">{t('dashboard.verif_v.lock.hideVerif')}</span><span className="block text-xs text-muted">{t('dashboard.verif_v.lock.hideVerifDesc')}</span></span>
            <Toggle checked={ocultar} onChange={(v) => guardarPreguntasEntrada({ ocultarVerificacion: v })} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" disabled={ocupado || !estado.rolAccesoExiste || !estado.canalVerificacionExiste} onClick={() => accion('cerrar')}
              className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
              {ocupado ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} {estado.cerrado ? t('dashboard.verif_v.lock.reapply') : t('dashboard.verif_v.lock.close')}
            </button>
            {estado.cerrado && (
              <button type="button" disabled={ocupado} onClick={() => accion('abrir')}
                className="flex items-center gap-2 rounded-2xl border border-line bg-bg px-5 py-2.5 text-sm font-bold text-fg transition-colors hover:border-brand disabled:opacity-50">
                <LockOpen size={16} /> {t('dashboard.verif_v.lock.open')}
              </button>
            )}
          </div>
          {aviso && <p role="status" className={`mt-3 text-sm font-semibold ${aviso.ok ? 'text-success' : 'text-danger'}`}>{aviso.texto}</p>}
          <p className="mt-3 text-xs text-muted">{t('dashboard.verif_v.lock.note')}</p>
        </>
      )}
    </div>
  );
}
