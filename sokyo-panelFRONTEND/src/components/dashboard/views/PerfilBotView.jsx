// Configuración · Perfil del bot (2.4.0): cómo se ve Sokyo SOLO en este servidor. El apodo es gratis;
// la foto, el banner y la descripción son de Pro (marca blanca de verdad). Con vista previa como en
// Discord. Lógica en utils/perfilBot.js; rutas GET/PUT /api/config/:guildId/perfil-bot.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Palette, Upload, RotateCcw, Crown, Lock } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { prepararImagen, aDataUrl, textoErrorImagen } from '../../../lib/imagenes';
import { tarjeta, campo, CabeceraTarjeta, Campo, Aviso, BotonGuardar } from './crecimientoShared';

// 4 MB por imagen: la foto y el banner pueden ir en el mismo guardado y la API acepta hasta 12 MB.
const MAX_MB = 4;

// Como en el resto del panel (lib/imagenes.js): se mira qué es el archivo por sus bytes (galerías del
// móvil sin tipo) y los GIF grandes se encogen.
async function leerImagen(file) {
  if (!file) throw new Error('vacio');
  const r = await prepararImagen(file, { max: MAX_MB * 1048576, video: false });
  return aDataUrl(r.archivo);
}

// Cómo se verá el perfil en Discord (tarjeta de miembro).
function Previa({ nombre, avatar, banner, bio, t }) {
  return (
    <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-2xl border border-line bg-[#232428] text-white shadow-soft">
      <div className="h-[110px] w-full bg-gradient-to-br from-[#8b5cf6] to-[#1e1b4b]" style={banner ? { backgroundImage: `url(${banner})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined} />
      <div className="relative px-4 pb-4">
        <div className="-mt-10 mb-2 h-20 w-20 overflow-hidden rounded-full border-[6px] border-[#232428] bg-[#313338]">
          {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="truncate text-lg font-bold">{nombre}</span>
          <span className="rounded bg-[#5865F2] px-1.5 py-0.5 text-[10px] font-bold">APP</span>
        </div>
        <div className="mt-3 rounded-lg bg-[#111214] p-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-white/70">{t('dashboard.perfilBot_v.sobreMi')}</div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-white/90">{bio || t('dashboard.perfilBot_v.bioVacia')}</p>
        </div>
      </div>
    </div>
  );
}

export default function PerfilBotView({ dash }) {
  const { t, i18n } = useTranslation();
  const { guildId, esPremium, setActiveTab } = dash;
  const [datos, setDatos] = useState(null);
  const [apodo, setApodo] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState(undefined); // undefined = sin tocar · null = el de Sokyo · dataURL = nuevo
  const [banner, setBanner] = useState(undefined);
  const [estado, setEstado] = useState('');
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    let vivo = true;
    apiFetch(`/api/config/${guildId}/perfil-bot`).then((r) => r.json()).then((d) => {
      if (!vivo) return;
      setDatos(d);
      if (!d.error) { setApodo(d.apodo || ''); setBio(d.bio || ''); setAvatar(undefined); setBanner(undefined); }
    }).catch(() => vivo && setDatos({ error: t('dashboard.perfilBot_v.errorCargar') }));
    return () => { vivo = false; };
  }, [guildId, i18n.language, t]);

  if (!datos) return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;
  if (datos.error) return <Aviso tipo="alerta">{datos.error}</Aviso>;

  // Lo que dice la API manda; si no lo dice, el plan del panel (y mientras se carga, null, no se trata como Free).
  const pro = typeof datos.pro === 'boolean' ? datos.pro : esPremium !== false;
  const fotoVista = avatar === undefined ? (datos.avatarUrl || datos.avatarSokyo) : avatar === null ? datos.avatarSokyo : avatar;
  const bannerVista = banner === undefined ? datos.bannerUrl : banner;
  const elegir = (set) => async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try { set(await leerImagen(f)); setAviso(''); } catch (err) { setAviso(textoErrorImagen(err, t, { max: MAX_MB * 1048576, idioma: i18n.language })); }
  };
  const cambios = {};
  if ((apodo || '') !== (datos.apodo || '')) cambios.apodo = apodo.trim() || null;
  if (pro && (bio || '') !== (datos.bio || '')) cambios.bio = bio.trim() || null;
  if (pro && avatar !== undefined) cambios.avatar = avatar;
  if (pro && banner !== undefined) cambios.banner = banner;
  const hayCambios = Object.keys(cambios).length > 0;

  const guardar = async () => {
    setEstado('guardando'); setAviso('');
    try {
      const r = await apiFetch(`/api/config/${guildId}/perfil-bot`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cambios) });
      const d = await r.json();
      if (!r.ok || d.error) {
        setEstado(d.error || t('dashboard.perfilBot_v.errorGuardar'));
        return;
      }
      setDatos(d); setApodo(d.apodo || ''); setBio(d.bio || ''); setAvatar(undefined); setBanner(undefined);
      setEstado('ok');
    } catch { setEstado(t('dashboard.perfilBot_v.errorGuardar')); }
  };

  const bloqueado = (contenido) => (pro ? contenido : (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-40">{contenido}</div>
      <div className="absolute inset-0 flex items-center justify-center"><span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-bold text-fg shadow-soft"><Lock size={12} /> Pro</span></div>
    </div>
  ));

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.perfilBot_v.intro')}</p>

      {!pro && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-fg">
          <span className="flex items-center gap-2"><Crown size={16} className="text-amber-400" /> {t('dashboard.perfilBot_v.proHint')}</span>
          <button type="button" onClick={() => setActiveTab?.('cuenta-plan')} className="rounded-xl bg-gradient-brand px-4 py-2 text-sm font-bold text-on-brand">{t('dashboard.plan.upgrade')}</button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className={tarjeta}>
          <CabeceraTarjeta icono={Palette} titulo={t('dashboard.perfilBot_v.titulo')} />
          <div className="mt-4 space-y-4">
            <Campo etiqueta={t('dashboard.perfilBot_v.apodo')} ayuda={t('dashboard.perfilBot_v.apodoAyuda', { nombre: datos.nombreBot })}>
              <input value={apodo} maxLength={datos.limites?.apodo || 32} onChange={(e) => setApodo(e.target.value)} placeholder={datos.nombreBot} className={campo} />
            </Campo>
            {bloqueado(
              <div className="space-y-4">
                <div>
                  <div className="mb-1.5 text-xs font-semibold text-muted">{t('dashboard.perfilBot_v.foto')}</div>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-elevated px-3 py-2 text-sm font-semibold text-fg">
                      <Upload size={15} /> {t('dashboard.perfilBot_v.subir')}
                      <input type="file" accept="image/*" className="hidden" disabled={!pro} onChange={elegir(setAvatar)} />
                    </label>
                    <button type="button" disabled={!pro} onClick={() => setAvatar(null)} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-muted hover:bg-elevated"><RotateCcw size={15} /> {t('dashboard.perfilBot_v.volverSokyo')}</button>
                  </div>
                  <p className="mt-1.5 text-xs text-muted">{t('dashboard.perfilBot_v.fotoAyuda', { mb: MAX_MB })}</p>
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-semibold text-muted">{t('dashboard.perfilBot_v.banner')}</div>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-elevated px-3 py-2 text-sm font-semibold text-fg">
                      <Upload size={15} /> {t('dashboard.perfilBot_v.subir')}
                      <input type="file" accept="image/*" className="hidden" disabled={!pro} onChange={elegir(setBanner)} />
                    </label>
                    <button type="button" disabled={!pro} onClick={() => setBanner(null)} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-muted hover:bg-elevated"><RotateCcw size={15} /> {t('dashboard.perfilBot_v.quitarBanner')}</button>
                  </div>
                  <p className="mt-1.5 text-xs text-muted">{t('dashboard.perfilBot_v.bannerAyuda', { mb: MAX_MB })}</p>
                </div>
                <Campo etiqueta={t('dashboard.perfilBot_v.bio')} ayuda={t('dashboard.perfilBot_v.bioAyuda', { n: datos.limites?.bio || 190 })}>
                  <textarea value={bio} disabled={!pro} maxLength={datos.limites?.bio || 190} rows={3} onChange={(e) => setBio(e.target.value)} placeholder={t('dashboard.perfilBot_v.bioPh')} className={campo} />
                </Campo>
              </div>,
            )}
            {aviso && <Aviso tipo="alerta">{aviso}</Aviso>}
            <Aviso tipo="info">{t('dashboard.perfilBot_v.nota')}</Aviso>
            <BotonGuardar estado={estado} onClick={guardar} disabled={!hayCambios} />
          </div>
        </div>
        <div className={tarjeta}>
          <CabeceraTarjeta icono={Palette} titulo={t('dashboard.perfilBot_v.previa')} />
          <div className="mt-4">
            <Previa nombre={apodo.trim() || datos.nombreBot} avatar={fotoVista} banner={pro ? bannerVista : null} bio={pro ? bio : ''} t={t} />
          </div>
        </div>
      </div>
    </div>
  );
}
