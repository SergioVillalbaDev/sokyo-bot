// Botón «Guardar» que dice cómo ha ido («✅ Guardado» o «No se ha podido guardar»),
// sin ventanas del navegador. `onGuardar` devuelve false si falla.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Loader2 } from 'lucide-react';

const BOTON = 'flex items-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-on-brand glow-brand transition-transform hover:scale-[1.03] disabled:opacity-60';

export default function BotonGuardar({ onGuardar, children }) {
  const { t } = useTranslation();
  const [estado, setEstado] = useState(null); // null | 'guardando' | 'ok' | 'error'
  const pulsar = async () => {
    setEstado('guardando');
    let ok;
    try { ok = (await onGuardar()) !== false; } catch { ok = false; }
    setEstado(ok ? 'ok' : 'error');
    if (ok) setTimeout(() => setEstado((e) => (e === 'ok' ? null : e)), 4000);
  };
  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <button type="button" disabled={estado === 'guardando'} onClick={pulsar} className={BOTON}>
        {estado === 'guardando' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {children}
      </button>
      {estado === 'ok' && <span role="status" className="text-xs font-semibold text-success">{t('dashboard.botonGuardar.ok')}</span>}
      {estado === 'error' && <span role="status" className="text-xs font-semibold text-danger">{t('dashboard.botonGuardar.error')}</span>}
    </div>
  );
}
