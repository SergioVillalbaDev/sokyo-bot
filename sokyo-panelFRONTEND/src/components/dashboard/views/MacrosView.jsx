// Vista de Respuestas rápidas (macros) — crear/borrar plantillas de respuesta.
// Se guardan automáticamente. El staff las inserta en el chat con el botón ⚡.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Zap, X, Plus, Info } from 'lucide-react';
import { Card } from '../../ui/primitives';

export default function MacrosView({ dash }) {
  const { t } = useTranslation();
  const { configServidor, guardarMacros } = dash;
  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');

  if (!configServidor) {
    return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;
  }

  const macros = configServidor.respuestasRapidas || [];
  const field = 'w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm text-fg outline-none transition-shadow focus:ring-2 focus:ring-brand/40';

  const añadir = () => {
    if (!titulo.trim() || !contenido.trim()) return;
    guardarMacros([...macros, { titulo: titulo.trim(), contenido: contenido.trim() }]);
    setTitulo('');
    setContenido('');
  };

  const eliminar = (i) => guardarMacros(macros.filter((_, idx) => idx !== i));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-card px-4 py-3 text-xs text-muted shadow-soft">
        <Info size={15} className="text-brand" /> {t('dashboard.macros_v.hint')}
      </div>

      {/* Crear nueva */}
      <Card className="flex flex-col gap-3 p-6 shadow-soft">
        <h3 className="flex items-center gap-2 font-bold text-fg"><Zap size={18} className="text-brand" /> {t('dashboard.macros_v.title')}</h3>
        <p className="-mt-1 text-sm text-muted">{t('dashboard.macros_v.subtitle')}</p>
        <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={t('dashboard.macros_v.newTitle')} maxLength={100} className={field} />
        <textarea value={contenido} onChange={(e) => setContenido(e.target.value)} placeholder={t('dashboard.macros_v.newContent')} maxLength={2000} className={`${field} min-h-[90px] resize-y`} />
        <button
          onClick={añadir}
          className="flex w-fit items-center gap-1.5 rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-on-brand transition-transform hover:scale-[1.03]"
        >
          <Plus size={15} /> {t('dashboard.macros_v.add')}
        </button>
      </Card>

      {/* Lista */}
      {macros.length === 0 ? (
        <p className="py-4 text-center text-sm italic text-muted">{t('dashboard.macros_v.empty')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {macros.map((m, i) => (
            <Card key={i} className="flex items-start justify-between gap-4 p-4 shadow-soft">
              <div className="min-w-0">
                <p className="text-sm font-bold text-fg">{m.titulo}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{m.contenido}</p>
              </div>
              <button onClick={() => eliminar(i)} className="shrink-0 text-muted transition-colors hover:text-danger" aria-label="Eliminar">
                <X size={18} />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
