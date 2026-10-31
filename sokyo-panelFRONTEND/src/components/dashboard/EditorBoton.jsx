// Texto y color de un botón de Discord (paneles de verificación y de la doble
// bienvenida). Se ve igual que en Discord en la vista previa del embed
// (EmbedBuilder, prop `botones`). Colores en lib/estilosBoton.js.
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { ESTILOS_BOTON } from '../../lib/estilosBoton';

const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';

export default function EditorBoton({ texto, estilo, onTexto, onEstilo, placeholder }) {
  const { t } = useTranslation();
  const idColor = useId();
  const actual = ESTILOS_BOTON.some((e) => e.id === estilo) ? estilo : 'verde';
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-fg">{t('dashboard.botonDiscord.texto')}</span>
        <input value={texto || ''} onChange={(ev) => onTexto(ev.target.value)} className={input} maxLength={80} placeholder={placeholder} />
        <span className="mt-1 block text-xs text-muted">{t('dashboard.botonDiscord.textoAyuda')}</span>
      </label>
      <div>
        <span className="mb-1.5 block text-sm font-semibold text-fg" id={idColor}>{t('dashboard.botonDiscord.color')}</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby={idColor}>
          {ESTILOS_BOTON.map((e) => (
            <button key={e.id} type="button" role="radio" aria-checked={actual === e.id} onClick={() => onEstilo(e.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03] ${actual === e.id ? 'ring-2 ring-brand ring-offset-2 ring-offset-[var(--solido-card)]' : 'opacity-80'}`}
              style={{ background: e.fondo }}>
              {actual === e.id && <Check size={14} />}
              {t(`dashboard.botonDiscord.${e.id}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
