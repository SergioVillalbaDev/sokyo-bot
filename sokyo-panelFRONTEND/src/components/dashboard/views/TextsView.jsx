// Comandos y prefijo — cambia el prefijo de los comandos de texto del bot y
// muestra la guía completa de comandos (slash y de texto), agrupada por
// categoría. Los textos del panel de tickets se movieron a Tickets > Ajustes.
import { useTranslation } from 'react-i18next';
import { Save, Terminal, BookOpen } from 'lucide-react';
import { Card } from '../../ui/primitives';

// Guía de comandos. `s` = comando slash (/), `p` = comando de texto (prefijo).
const GUIA = [
  { cat: 'music', icon: '🎵', cmds: [
    ['play', 's'], ['queue', 's'], ['nowplaying', 's'], ['pause', 's'],
    ['resume', 's'], ['skip', 's'], ['stop', 's'], ['volume', 's'], ['247', 's'], ['filter', 's'],
  ] },
  { cat: 'economy', icon: '🪙', cmds: [
    ['daily', 's'], ['shop', 's'], ['inventory', 's'], ['use', 's'], ['givegold', 's'], ['rich', 's'], ['system', 's'],
  ] },
  { cat: 'levels', icon: '📈', cmds: [['level', 's'], ['ranking', 'p'], ['xp', 'p']] },
  { cat: 'moderation', icon: '🛡️', cmds: [
    ['ban', 'p'], ['unban', 'p'], ['kick', 'p'], ['timeout', 'p'], ['warn', 'p'],
    ['sanction', 'p'], ['history', 'p'], ['report', 'p'],
  ] },
  { cat: 'utility', icon: '🧰', cmds: [
    ['ping', 'p'], ['user', 'p'], ['activity', 'p'], ['role', 'p'], ['remind', 'p'],
    ['emoji', 'p'], ['sticker', 'p'], ['dice', 'p'], ['setup', 'p'], ['sokyo', 'p'],
  ] },
];

export default function TextsView({ dash }) {
  const { t } = useTranslation();
  const { configServidor, prefijo, setPrefijo, guardarTextosConfig } = dash;

  if (!configServidor) {
    return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;
  }

  const field = 'w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm text-fg outline-none transition-shadow focus:ring-2 focus:ring-brand/40';
  const label = 'text-xs font-bold uppercase tracking-wide text-muted';
  const pfx = prefijo || '!';

  return (
    <div className="flex flex-col gap-6">
      {/* Prefijo de comandos */}
      <Card className="flex flex-col gap-5 p-6 shadow-soft">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-fg"><Terminal size={18} className="text-brand" /> {t('dashboard.commands_v.prefixTitle')}</h2>
            <p className="mt-1 text-sm text-muted">{t('dashboard.commands_v.prefixDesc')}</p>
          </div>
          <button onClick={guardarTextosConfig} className="flex items-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-on-brand glow-brand transition-transform hover:scale-[1.03]">
            <Save size={16} /> {t('dashboard.texts_v.save')}
          </button>
        </div>
        <div className="max-w-xs">
          <label className={label}>{t('dashboard.texts_v.prefix')}</label>
          <input type="text" value={prefijo} onChange={(e) => setPrefijo(e.target.value)} maxLength={5} placeholder="!" className={`${field} mt-2`} />
          <p className="mt-1 text-xs text-muted">{t('dashboard.texts_v.prefixHint', { prefix: pfx })}</p>
        </div>
      </Card>

      {/* Guía de comandos */}
      <Card className="flex flex-col gap-4 p-6 shadow-soft">
        <div>
          <h3 className="flex items-center gap-2 font-bold text-fg"><BookOpen size={18} className="text-brand" /> {t('dashboard.commands_v.guideTitle')}</h3>
          <p className="mt-1 text-sm text-muted">{t('dashboard.commands_v.guideDesc', { prefix: pfx })}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {GUIA.map((grupo) => (
            <div key={grupo.cat} className="rounded-2xl border border-line bg-bg p-4">
              <p className="mb-3 text-sm font-bold text-fg">{grupo.icon} {t(`dashboard.commands_v.cat.${grupo.cat}`)}</p>
              <div className="flex flex-wrap gap-1.5">
                {grupo.cmds.map(([nombre, tipo]) => (
                  <span key={nombre} className="rounded-lg border border-line bg-card px-2 py-1 font-mono text-xs text-brand">
                    {tipo === 's' ? '/' : pfx}{nombre}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="rounded-xl border border-line bg-bg px-3 py-2 text-xs text-muted">{t('dashboard.commands_v.legend', { prefix: pfx })}</p>
      </Card>
    </div>
  );
}
