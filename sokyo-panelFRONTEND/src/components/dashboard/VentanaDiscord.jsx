// Vista previa de una ventana (formulario) de Discord: la que se abre al pulsar un botón del
// bot (nueva sugerencia, presentarme, solicitud…). Se ve como en Discord: título, cada campo
// con su etiqueta, si es obligatorio, lo que lleva escrito de antes y el botón de enviar.
//
//   <VentanaDiscord titulo="Nueva sugerencia" campos={[{ etiqueta: 'Tu sugerencia', valor: plantilla, parrafo: true, obligatorio: true }]} />
//
// - `campos`: [{ etiqueta, valor (ya escrito, opcional), parrafo (caja grande), obligatorio }].
// - Discord corta la etiqueta a 45 letras y no da formato al texto de dentro: se ve tal cual.
import { useTranslation } from 'react-i18next';
import { Eye, X } from 'lucide-react';

export default function VentanaDiscord({ titulo, campos = [], className = '' }) {
  const { t } = useTranslation();
  return (
    <div className={`rounded-2xl border border-line bg-[#313338] p-3.5 text-left ${className}`} aria-label={t('dashboard.ventanaDiscord.titulo')}>
      <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/40">
        <Eye size={12} /> {t('dashboard.ventanaDiscord.titulo')}
      </p>
      <div className="mx-auto max-w-[440px] overflow-hidden rounded-lg bg-[#313338] shadow-lg ring-1 ring-black/40">
        <div className="flex items-start justify-between gap-3 px-4 pb-1 pt-4">
          <p className="min-w-0 break-words text-lg font-bold text-white">{titulo}</p>
          <X size={18} className="mt-1 shrink-0 text-white/50" aria-hidden="true" />
        </div>
        <div className="space-y-4 px-4 py-3">
          {campos.length === 0 && <p className="text-sm italic text-white/40">{t('dashboard.ventanaDiscord.vacio')}</p>}
          {campos.map((c, i) => (
            <div key={i}>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[#b5bac1]">
                {String(c.etiqueta || '…').slice(0, 45)}{c.obligatorio && <span className="ml-0.5 text-[#f23f42]">*</span>}
              </p>
              <div className={`whitespace-pre-wrap break-words rounded-[3px] bg-[#1e1f22] px-2.5 py-2 text-sm ${c.parrafo ? 'min-h-[4.5rem]' : ''} ${c.valor ? 'text-[#dbdee1]' : 'text-transparent'}`}>
                {c.valor || '·'}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 bg-[#2b2d31] px-4 py-3">
          <span className="rounded-[3px] px-4 py-1.5 text-sm font-medium text-white/80">{t('dashboard.ventanaDiscord.cancelar')}</span>
          <span className="rounded-[3px] bg-[#5865f2] px-4 py-1.5 text-sm font-medium text-white">{t('dashboard.ventanaDiscord.enviar')}</span>
        </div>
      </div>
    </div>
  );
}
