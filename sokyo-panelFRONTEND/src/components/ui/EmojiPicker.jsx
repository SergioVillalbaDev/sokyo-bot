// Selector de emojis ligero y sin dependencias: un botón que abre una cuadrícula
// de emojis comunes. Incluye un campo para pegar un emoji personalizado del
// servidor (formato <:nombre:id>). Devuelve el emoji elegido por onChange.
import { useState } from 'react';
import { Smile, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const EMOJIS = [
  '😀', '😁', '😂', '🤣', '😊', '😇', '🙂', '😉', '😍', '😘', '😜', '🤪', '🤩', '🥳', '😎', '🤓',
  '🧐', '🤔', '🤗', '🙃', '😴', '😢', '😭', '😡', '😱', '🤯', '😈', '👻', '💀', '🤖', '🎃', '👽',
  '👍', '👎', '👌', '✌️', '🤞', '🤙', '👏', '🙌', '🙏', '💪', '👀', '🫶', '🤝', '✋', '👋', '🫡',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💖', '💯', '🔥', '⭐', '🌟', '✨', '⚡', '💥',
  '🎉', '🎊', '🎁', '🎮', '🕹️', '🎧', '🎵', '🎶', '🎤', '🎨', '🎬', '📷', '📚', '✏️', '📌', '🔔',
  '💬', '💡', '🔑', '🔒', '🔓', '🛡️', '⚔️', '🏆', '🥇', '🎯', '🚀', '🛰️', '🌙', '☀️', '🌈', '❄️',
  '🐶', '🐱', '🦊', '🐻', '🐼', '🦁', '🐯', '🐸', '🐵', '🐧', '🦄', '🐝', '🦋', '🌸', '🌹', '🍀',
  '🍎', '🍕', '🍔', '🍟', '🍿', '🍩', '🍪', '🎂', '☕', '🍺', '🍷', '🎲', '⚽', '🏀', '🎸', '🎹',
  '🇪🇸', '🇬🇧', '🇺🇸', '🇫🇷', '🇩🇪', '🇮🇹', '🇵🇹', '🇲🇽', '🇦🇷', '🇧🇷', '🇯🇵', '🇰🇷', '🇨🇳', '🇷🇺',
];

export function EmojiPicker({ value, onChange, personalizados = [] }) {
  const { t } = useTranslation();
  const [abierto, setAbierto] = useState(false);
  const elegir = (e) => { onChange(e); setAbierto(false); };

  // Si el valor es un emoji personalizado (<:nombre:id>), buscamos su imagen para mostrarla.
  const customSel = personalizados.find((e) => e.codigo === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center gap-2 rounded-xl border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-brand"
      >
        {customSel ? <img src={customSel.url} alt={customSel.nombre} className="h-5 w-5 object-contain" />
          : value ? <span className="text-lg leading-none">{value}</span>
          : <Smile size={16} className="text-muted" />}
        <span className={value ? 'truncate text-fg' : 'text-muted'}>{customSel ? `:${customSel.nombre}:` : (value || t('dashboard.paneles_v.emojiPh'))}</span>
        {value && (
          <X size={13} className="ml-auto shrink-0 text-muted hover:text-fg" onClick={(ev) => { ev.stopPropagation(); onChange(''); }} />
        )}
      </button>

      {abierto && (
        <>
          {/* Capa para cerrar al pulsar fuera */}
          <div className="fixed inset-0 z-[60]" onClick={() => setAbierto(false)} />
          <div className="absolute left-0 top-full z-[61] mt-1 w-64 rounded-2xl border border-line bg-card p-3 shadow-soft">
            <input
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={t('dashboard.paneles_v.emojiCustomPh')}
              className="mb-2 w-full rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs text-fg outline-none focus:border-brand"
            />
            <div className="max-h-44 overflow-y-auto">
              {/* Emojis personalizados del servidor */}
              {personalizados.length > 0 && (
                <>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted">{t('dashboard.paneles_v.emojiServer')}</p>
                  <div className="mb-2 grid grid-cols-8 gap-1">
                    {personalizados.map((e) => (
                      <button key={e.id} type="button" title={`:${e.nombre}:`} onClick={() => elegir(e.codigo)} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-elevated">
                        <img src={e.url} alt={e.nombre} className="h-5 w-5 object-contain" />
                      </button>
                    ))}
                  </div>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted">{t('dashboard.paneles_v.emojiCommon')}</p>
                </>
              )}
              {/* Emojis unicode comunes */}
              <div className="grid grid-cols-8 gap-1">
                {EMOJIS.map((e) => (
                  <button key={e} type="button" onClick={() => elegir(e)} className="flex h-7 w-7 items-center justify-center rounded-lg text-lg hover:bg-elevated">
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
