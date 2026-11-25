// Cabecera común de cada sección (1.34.0): la misma en todas, sacada del catálogo de funciones (el del bot): qué es,
// si está bien (🟢 encendida y sin problemas · 🟡 con avisos · 🔴 con errores · ⚪ apagada, según el Diagnóstico),
// cómo se usa en Discord (los comandos de verdad; un clic los copia) y su guía. Así todas las secciones se entienden
// igual y se ve de un vistazo si funcionan.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Copy, Check, Stethoscope } from 'lucide-react';
import { useCatalogo, modulosDeTab } from '../../lib/catalogo';
import { apiFetch, procesarRespuesta } from '../../lib/api';

const diagCache = new Map(); // guildId → { t, promesa }
function diagnostico(guildId) {
  const c = diagCache.get(guildId);
  if (c && Date.now() - c.t < 60000) return c.promesa;
  const promesa = apiFetch(`/api/diagnostico?guildId=${encodeURIComponent(guildId)}`).then(procesarRespuesta).catch(() => null);
  diagCache.set(guildId, { t: Date.now(), promesa });
  return promesa;
}

export default function CabeceraSeccion({ tab, dash }) {
  const { t, i18n } = useTranslation();
  const { guildId, estadoModulos = {}, setActiveTab } = dash;
  const idioma = i18n.language?.startsWith('es') ? 'es' : 'en';
  const catalogo = useCatalogo(guildId, idioma, estadoModulos[tab] ? 1 : 0);
  const [diag, setDiag] = useState(null);
  const [copiado, setCopiado] = useState('');
  useEffect(() => {
    let vivo = true;
    if (guildId) diagnostico(guildId).then((d) => { if (vivo) setDiag(d); });
    return () => { vivo = false; };
  }, [guildId]);
  const mods = modulosDeTab(catalogo, tab);
  if (!mods.length) return null;
  const problemas = (diag?.problemas || []).filter((p) => p.tab === tab);
  const errores = problemas.filter((p) => p.nivel === 'error').length;
  const encendida = estadoModulos[tab] ?? mods.some((m) => m.activo);
  const estado = !encendida ? 'apagada' : errores ? 'error' : problemas.length ? 'aviso' : 'bien';
  const punto = { bien: 'bg-success', aviso: 'bg-warning', error: 'bg-danger', apagada: 'bg-muted/50' }[estado];
  const copiar = (c) => { navigator.clipboard?.writeText(c).then(() => { setCopiado(c); setTimeout(() => setCopiado(''), 1500); }).catch(() => {}); };
  return (
    <div className="sk-aparece mb-4 rounded-2xl border border-line bg-card/70 px-4 py-3 text-sm shadow-soft" data-cabecera-seccion>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex items-center gap-2 font-semibold text-fg" title={t(`dashboard.cabecera.estado.${estado}`)}>
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${punto}`} aria-hidden="true" />
          {t(`dashboard.cabecera.estado.${estado}`)}
        </span>
        {estado === 'error' || estado === 'aviso' ? (
          <button type="button" onClick={() => setActiveTab?.('config-diagnostico')} className="sk-foco inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold text-warning hover:bg-elevated">
            <Stethoscope size={13} /> {t('dashboard.cabecera.verProblemas', { count: problemas.length })}
          </button>
        ) : null}
        <span className="hidden h-4 w-px bg-line sm:inline-block" aria-hidden="true" />
        <span className="text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.cabecera.enDiscord')}</span>
        <span className="flex min-w-0 flex-wrap gap-1.5">
          {[...new Set(mods.flatMap((m) => m.comandos))].slice(0, 8).map((c) => (
            <button key={c} type="button" onClick={() => copiar(c)} title={t('dashboard.cabecera.copiar')}
              className="sk-foco inline-flex items-center gap-1 rounded-lg border border-line bg-elevated/60 px-2 py-0.5 font-mono text-[12px] text-fg hover:border-brand/50">
              {copiado === c ? <Check size={12} className="text-success" /> : <Copy size={11} className="opacity-50" />} {c}
            </button>
          ))}
        </span>
        <a href={mods[0].guia} target="_blank" rel="noopener noreferrer" className="sk-foco ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold text-brand hover:bg-elevated">
          <BookOpen size={13} /> {t('dashboard.cabecera.guia')}
        </a>
      </div>
      {mods.length === 1 && <p className="mt-1.5 text-xs text-muted">{mods[0].emoji} {mods[0].frase}</p>}
    </div>
  );
}
