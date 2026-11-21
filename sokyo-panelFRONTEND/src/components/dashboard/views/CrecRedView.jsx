// Crecimiento · Red Sokyo — los servidores que la activan se promocionan entre sí: el
// bot publica cada X horas otro servidor de la red en tu canal, y el tuyo sale en los
// de los demás (solo si tienes página pública en el directorio). Lógica en utils/redSokyo.js.
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Handshake, Globe2, Ban, Undo2, Filter } from 'lucide-react';
import { Toggle, Avatar } from '../../ui/primitives';
import { tarjeta, campo, CabeceraTarjeta, Campo, SelectCanal, Numero, Aviso, BotonGuardar } from './crecimientoShared';
import { FilaInterruptor } from './modulosShared';
import { relativo } from './crecimientoUtils';
import { useAutoguardado } from '../../../hooks/useAutoguardado';
import VistaDiscord from '../VistaDiscord';

const HORAS = [6, 12, 24, 48, 72, 168];

export default function CrecRedView({ dash }) {
  const { t, i18n } = useTranslation();
  const idiomaPanel = i18n.language;
  const { canales, cargarCrecimiento, guardarCrecimiento, setActiveTab } = dash;
  const [datos, setDatos] = useState(null);
  const [form, setForm] = useState(null);
  const [estado, setEstado] = useState('');

  const cargar = useCallback(async () => {
    const r = await cargarCrecimiento('red');
    if (r.error) { setDatos({ error: r.error }); return; }
    setDatos(r);
    setForm(r.config);
    // Con el idioma nuevo se vuelve a pedir (los errores de la API vienen en el idioma del panel).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idiomaPanel]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async () => {
    setEstado('guardando');
    const r = await guardarCrecimiento('red', form);
    if (r.error) { setEstado(r.error); return false; }
    setEstado('ok');
    const d = await cargarCrecimiento('red');
    if (!d.error) setDatos(d);
    return true;
  };
  const autoguardado = useAutoguardado(form, guardar, { listo: !!form, borrador: 'crec-red', restaurar: setForm });

  if (!datos) return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;
  if (datos.error) return <Aviso tipo="alerta">{datos.error}</Aviso>;
  if (!form) return null;
  const set = (k) => (v) => { setForm((f) => ({ ...f, [k]: v })); setEstado(''); };
  const bloqueados = form.bloqueados || [];
  const bloquear = (id) => set('bloqueados')(bloqueados.includes(id) ? bloqueados.filter((x) => x !== id) : [...bloqueados, id]);
  // Temas: se escriben separados por comas (los mismos que las etiquetas de la página pública).
  const temasTexto = (form.etiquetas || []).join(', ');

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.red_v.intro')}</p>
      {form.activo && !form.canalId && <Aviso tipo="alerta">{t('dashboard.red_v.needChannel')}</Aviso>}
      {!datos.paginaLista && (
        <Aviso tipo="alerta" accion={(
          <button type="button" onClick={() => setActiveTab('crec-pagina')} className="text-xs font-semibold text-brand hover:underline">{t('dashboard.red_v.goPage')}</button>
        )}>{t('dashboard.red_v.needPage')}</Aviso>
      )}

      <div data-help="red-config" className={tarjeta}>
        <CabeceraTarjeta icono={Handshake} titulo={t('dashboard.red_v.title')} activo={form.activo} onActivo={set('activo')} />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Campo etiqueta={t('dashboard.red_v.channel')} ayuda={t('dashboard.red_v.channelHint')}>
            <SelectCanal canales={canales} value={form.canalId} onChange={set('canalId')} />
          </Campo>
          <Campo etiqueta={t('dashboard.red_v.every')}>
            <select value={form.cadaHoras ?? 24} onChange={(e) => set('cadaHoras')(Number(e.target.value))} className={campo}>
              {HORAS.map((h) => <option key={h} value={h}>{t('dashboard.red_v.hours', { count: h })}</option>)}
            </select>
          </Campo>
          <div className="sm:col-span-2">
            <FilaInterruptor titulo={t('dashboard.red_v.sameLang')} desc={t('dashboard.red_v.sameLangHint')}>
              <Toggle checked={form.mismoIdioma !== false} onChange={set('mismoIdioma')} />
            </FilaInterruptor>
          </div>
          <div className="sm:col-span-2">
            {/* Mismo formato que utils/redSokyo.js (mensajeRed). */}
            <VistaDiscord embed={{
              autor: t('dashboard.red_v.exAuthor'), titulo: 'Nébula Gaming', descripcion: t('dashboard.red_v.exDesc'), color: '#7c5cff',
              campos: [{ nombre: t('dashboard.red_v.exMembers'), valor: '1.280', inline: true }], pie: t('dashboard.red_v.exFooter'),
            }} botones={[{ texto: `🔗 ${t('dashboard.red_v.exButton')}`, estilo: 'gris' }]} />
          </div>
        </div>
        <div className="mt-5"><BotonGuardar estado={estado} onClick={guardar} autoguardado={autoguardado} /></div>
      </div>

      <div data-help="red-filtros" className={tarjeta}>
        <CabeceraTarjeta icono={Filter} titulo={t('dashboard.red_v.filters')} />
        <p className="mt-1 text-xs text-muted">{t('dashboard.red_v.filtersHint')}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Campo etiqueta={t('dashboard.red_v.minMembers')} ayuda={t('dashboard.red_v.minMembersHint')}>
            <Numero value={form.minMiembros ?? 0} onChange={set('minMiembros')} max={1000000} />
          </Campo>
          <Campo etiqueta={t('dashboard.red_v.topics')} ayuda={t('dashboard.red_v.topicsHint')}>
            <input defaultValue={temasTexto} key={temasTexto} placeholder={t('dashboard.red_v.topicsPh')} className={campo}
              onBlur={(e) => set('etiquetas')(e.target.value.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 8))} />
          </Campo>
        </div>
        <h4 className="mt-5 text-sm font-semibold text-fg">{t('dashboard.red_v.recent')}</h4>
        {datos.recientes?.length ? (
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {datos.recientes.map((g) => (
              <li key={g.id} className="flex items-center gap-3 rounded-2xl border border-line bg-bg px-3 py-2.5">
                <Avatar src={g.icono} name={g.nombre} size={30} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{g.nombre}</span>
                <button type="button" onClick={() => bloquear(g.id)}
                  className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ${bloqueados.includes(g.id) ? 'text-muted hover:text-fg' : 'text-danger hover:bg-danger/10'}`}>
                  {bloqueados.includes(g.id) ? <><Undo2 size={12} /> {t('dashboard.red_v.unblock')}</> : <><Ban size={12} /> {t('dashboard.red_v.block')}</>}
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-xs italic text-muted">{t('dashboard.red_v.noRecent')}</p>}
        {datos.bloqueados?.length > 0 && (
          <>
            <h4 className="mt-5 text-sm font-semibold text-fg">{t('dashboard.red_v.blocked', { n: bloqueados.length })}</h4>
            <ul className="mt-2 flex flex-wrap gap-2">
              {datos.bloqueados.filter((g) => bloqueados.includes(g.id)).map((g) => (
                <li key={g.id}>
                  <button type="button" onClick={() => bloquear(g.id)} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted hover:text-fg">
                    <Ban size={12} /> {g.nombre} · {t('dashboard.red_v.unblock')}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div data-help="red-estado" className={tarjeta}>
        <CabeceraTarjeta icono={Globe2} titulo={t('dashboard.red_v.status')} />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Dato titulo={t('dashboard.red_v.inNetwork')} valor={form.mismoIdioma !== false ? datos.mismoIdioma : datos.enLaRed} />
          <Dato titulo={t('dashboard.red_v.shown')} valor={datos.mostrado} />
          <Dato titulo={t('dashboard.red_v.next')} valor={datos.proxima ? relativo(datos.proxima, i18n.language) : '—'} />
        </div>
        <p className="mt-3 text-xs text-muted">{datos.visible ? t('dashboard.red_v.visibleYes') : t('dashboard.red_v.visibleNo')}</p>
      </div>
    </div>
  );
}

function Dato({ titulo, valor }) {
  return (
    <div className="rounded-2xl border border-line bg-bg px-4 py-3">
      <span className="block text-xs text-muted">{titulo}</span>
      <span className="block text-xl font-bold text-fg">{valor}</span>
    </div>
  );
}
