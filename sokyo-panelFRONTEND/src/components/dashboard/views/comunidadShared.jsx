// Componentes compartidos de la sección Comunidad: selector de hora amigable
// (con preview en la zona horaria del usuario) y subida de imágenes desde el PC.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Clock, Image as ImageIcon, X, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { API_URL } from '../../../lib/api';
import EstadoSubida from '../EstadoSubida';
import { useSubidaImagen, resolverEnlaceImagen, ACEPTA_IMAGEN } from '../../../hooks/useSubidaImagen';

const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';
const label = 'mb-1.5 block text-sm font-semibold text-fg';

// Zona horaria detectada del navegador (p. ej. "Europe/Madrid").
const ZONA = Intl.DateTimeFormat().resolvedOptions().timeZone || 'tu zona';

function isoLocalPreview(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' });
}

const dosDig = (n) => String(n).padStart(2, '0');

// Selector visual de fecha + hora (calendario propio, sin librerías). Devuelve
// un ISO UTC en onChange a partir de la hora LOCAL elegida.
export function CalendarTimePicker({ value, onChange }) {
  const { t } = useTranslation();
  const MESES = t('dashboard.shared.months', { returnObjects: true });
  const DIAS_SEM = t('dashboard.shared.weekdays', { returnObjects: true });
  const base = value ? new Date(value) : null;
  const valido = base && !isNaN(base.getTime());
  // Fecha con la que abre el calendario: la elegida o, si no hay, dentro de una hora.
  const [arranque] = useState(() => (valido ? base : new Date(Date.now() + 3600000)));

  const [open, setOpen] = useState(false);
  const [vista, setVista] = useState({ y: arranque.getFullYear(), m: arranque.getMonth() });
  const [h, setH] = useState(arranque.getHours());
  const [min, setMin] = useState(Math.floor(arranque.getMinutes() / 5) * 5);
  const [sel, setSel] = useState(valido ? { y: base.getFullYear(), m: base.getMonth(), d: base.getDate() } : null);

  // Si el padre limpia el valor (tras crear), reseteamos la selección. Se hace
  // al renderizar (patrón de React para estado derivado), no en un efecto.
  const [valorAnterior, setValorAnterior] = useState(value);
  if (value !== valorAnterior) {
    setValorAnterior(value);
    if (!value) setSel(null);
  }

  const emitir = (dia, hh, mm) => {
    if (!dia) return;
    onChange(new Date(dia.y, dia.m, dia.d, hh, mm, 0, 0).toISOString());
  };

  const cambiarMes = (delta) => {
    setVista((v) => {
      const nm = v.m + delta;
      return { y: v.y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 };
    });
  };

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const primerDia = (new Date(vista.y, vista.m, 1).getDay() + 6) % 7; // 0 = lunes
  const diasMes = new Date(vista.y, vista.m + 1, 0).getDate();

  const textoBtn = valido
    ? base.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : t('dashboard.shared.pickDateTime');

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${valido ? 'border-brand text-fg' : 'border-line text-muted'} bg-bg hover:border-brand`}>
        <Calendar size={15} className="text-brand" />
        {textoBtn}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-2 w-[18rem] rounded-2xl border border-line bg-card p-3 shadow-soft">
            {/* Navegación de mes */}
            <div className="mb-2 flex items-center justify-between">
              <button type="button" onClick={() => cambiarMes(-1)} className="rounded-lg p-1.5 text-muted transition-colors hover:bg-elevated hover:text-fg">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-bold text-fg">{MESES[vista.m]} {vista.y}</span>
              <button type="button" onClick={() => cambiarMes(1)} className="rounded-lg p-1.5 text-muted transition-colors hover:bg-elevated hover:text-fg">
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Cabecera de días */}
            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-muted">
              {DIAS_SEM.map((d, i) => <span key={i}>{d}</span>)}
            </div>

            {/* Rejilla de días */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: primerDia }).map((_, i) => <span key={`b${i}`} />)}
              {Array.from({ length: diasMes }).map((_, i) => {
                const d = i + 1;
                const fecha = new Date(vista.y, vista.m, d);
                const pasado = fecha < hoy;
                const elegido = sel && sel.y === vista.y && sel.m === vista.m && sel.d === d;
                return (
                  <button key={d} type="button" disabled={pasado}
                    onClick={() => { const nd = { y: vista.y, m: vista.m, d }; setSel(nd); emitir(nd, h, min); }}
                    className={`h-8 rounded-lg text-xs transition-colors ${
                      elegido ? 'bg-gradient-brand font-bold text-white'
                      : pasado ? 'cursor-not-allowed text-muted/30'
                      : 'text-fg hover:bg-elevated'}`}>
                    {d}
                  </button>
                );
              })}
            </div>

            {/* Selector de hora */}
            <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
              <Clock size={15} className="text-brand" />
              <select value={h} onChange={(e) => { const nh = Number(e.target.value); setH(nh); emitir(sel, nh, min); }}
                className="rounded-lg border border-line bg-bg px-2 py-1.5 text-sm text-fg focus:border-brand focus:outline-none">
                {Array.from({ length: 24 }).map((_, i) => <option key={i} value={i}>{dosDig(i)}</option>)}
              </select>
              <span className="font-bold text-muted">:</span>
              <select value={min} onChange={(e) => { const nm = Number(e.target.value); setMin(nm); emitir(sel, h, nm); }}
                className="rounded-lg border border-line bg-bg px-2 py-1.5 text-sm text-fg focus:border-brand focus:outline-none">
                {Array.from({ length: 12 }).map((_, i) => <option key={i} value={i * 5}>{dosDig(i * 5)}</option>)}
              </select>
              <button type="button" onClick={() => setOpen(false)} className="ml-auto rounded-lg bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand/20">
                {t('dashboard.shared.done')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Presets de duración (minutos) para "cierra en…". La etiqueta sale de i18n.
const PRESETS = [
  { key: 'm30', min: 30 },
  { key: 'h1', min: 60 },
  { key: 'h6', min: 360 },
  { key: 'h12', min: 720 },
  { key: 'd1', min: 1440 },
  { key: 'd3', min: 4320 },
  { key: 'w1', min: 10080 },
];

// Selector de CIERRE para sorteos/encuestas: elige una duración rápida o una
// fecha personalizada. Devuelve siempre un ISO UTC en onChange.
export function CierrePicker({ value, onChange, titulo }) {
  const { t } = useTranslation();
  const [modo, setModo] = useState('preset'); // 'preset' | 'custom'
  const [preset, setPreset] = useState('');

  const elegirPreset = (min) => {
    setPreset(String(min));
    if (!min) { onChange(''); return; }
    onChange(new Date(Date.now() + Number(min) * 60000).toISOString());
  };

  const preview = isoLocalPreview(value);

  return (
    <div>
      <span className={label}>{titulo ?? t('dashboard.shared.whenCloses')}</span>
      <div className="mb-2 flex gap-2">
        <button type="button" onClick={() => setModo('preset')}
          className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${modo === 'preset' ? 'border-brand bg-brand/10 text-brand' : 'border-line text-muted hover:text-fg'}`}>
          ⏱️ {t('dashboard.shared.duration')}
        </button>
        <button type="button" onClick={() => setModo('custom')}
          className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${modo === 'custom' ? 'border-brand bg-brand/10 text-brand' : 'border-line text-muted hover:text-fg'}`}>
          📅 {t('dashboard.shared.exactDate')}
        </button>
      </div>

      {modo === 'preset' ? (
        <select value={preset} onChange={(e) => elegirPreset(e.target.value)} className={input}>
          <option value="">{t('dashboard.shared.pickDuration')}</option>
          {PRESETS.map((p) => <option key={p.min} value={p.min}>{t(`dashboard.shared.presets.${p.key}`)}</option>)}
        </select>
      ) : (
        <CalendarTimePicker value={value} onChange={onChange} />
      )}

      {preview && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-success">
          <Clock size={11} /> {t('dashboard.shared.closes')}: {preview} <span className="text-muted">({ZONA})</span>
        </p>
      )}
    </div>
  );
}

// Selector de FECHA EXACTA para eventos: datetime-local con preview y zona.
export function FechaPicker({ value, onChange, titulo }) {
  const { t } = useTranslation();
  const preview = isoLocalPreview(value);
  return (
    <div>
      <span className={label}>{titulo ?? t('dashboard.shared.dateTime')} <span className="font-normal text-muted">· {t('dashboard.shared.yourTime')} ({ZONA})</span></span>
      <CalendarTimePicker value={value} onChange={onChange} />
      {preview && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-success">
          <Clock size={11} /> {preview}
        </p>
      )}
    </div>
  );
}

// Campo de imagen: enlace o "Subir del PC/móvil". Devuelve la URL en onChange (las
// subidas, como «/uploads/…»; el bot les pone delante la dirección pública).
// 1.9.10: lo elegido pasa por useSubidaImagen (GIF de más de 8 MB, WebP animados,
// vídeos → GIF, galerías que no dicen el tipo). El enlace se escribe en su caja y se
// pone al pegarlo, con Enter o al salir (antes cada letra se guardaba como enlace); si
// es la página de Tenor/Giphy se cambia por el GIF, y si no carga como imagen se avisa.
export function SubirImagen({ value, onChange, subirImagen, titulo }) {
  const { t } = useTranslation();
  const sub = useSubidaImagen();
  const [texto, setTexto] = useState('');
  const [avisoEnlace, setAvisoEnlace] = useState('');
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });
  const vista = value && value.startsWith('/uploads/') ? `${API_URL}${value}` : value;
  // El aviso de «no es una imagen» va con ese enlace: si cambia (borrador, otro elemento), se va.
  const [rotaDe, setRotaDe] = useState(null);
  const rota = !!value && rotaDe === value;
  // Una respuesta de Tenor tardía no pisa lo hecho después; el mismo enlace no se pide dos veces.
  const turno = useRef(0);
  const ultimoEnlace = useRef('');

  const ponerEnlace = async (valor) => {
    const limpio = String(valor || '').trim();
    if (!limpio) return;
    if (!/^https?:\/\//i.test(limpio)) { setAvisoEnlace(`error:${t('dashboard.imagen.enlace.noImagen')}`); return; }
    if (limpio === ultimoEnlace.current) return;
    ultimoEnlace.current = limpio;
    const mio = ++turno.current;
    const r = await resolverEnlaceImagen(limpio);
    if (mio !== turno.current) return; // mientras tanto se ha hecho otra cosa
    ultimoEnlace.current = '';
    if (r.error) { setAvisoEnlace(`error:${t('dashboard.imagen.enlace.tenorFallo')}`); return; }
    setTexto('');
    setAvisoEnlace(r.origen ? t(`dashboard.imagen.enlace.${r.origen}`) : '');
    onChangeRef.current(r.url);
  };

  const onFile = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    turno.current++;
    setAvisoEnlace('');
    const r = await sub.preparar(file);
    if (!r) return;
    const res = await sub.subir(subirImagen, r.archivo);
    if (res) onChangeRef.current(res.url);
  };

  return (
    <div>
      <span className={label}>{titulo ?? t('dashboard.shared.image')} <span className="font-normal text-muted">({t('dashboard.shared.optional')})</span></span>
      {value ? (
        <div className="flex items-center gap-2">
          {!rota && <img src={vista} alt="" className="h-12 w-20 rounded-lg border border-line object-cover" onLoad={() => setRotaDe(null)} onError={() => setRotaDe(value)} />}
          <span className={`flex-1 truncate text-xs ${rota ? 'text-danger' : 'text-success'}`}>{rota ? `⚠ ${value}` : `✓ ${t('dashboard.shared.imageReady')}`}</span>
          <button type="button" onClick={() => { onChange(''); setAvisoEnlace(''); sub.setNota(''); }} className="rounded-xl border border-line px-2 py-2 text-muted transition-colors hover:text-danger" aria-label={t('dashboard.recorte.quitar')}>
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input value={texto} onChange={(e) => { turno.current++; ultimoEnlace.current = ''; setTexto(e.target.value); setAvisoEnlace(''); }}
            onBlur={() => ponerEnlace(texto)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); ponerEnlace(texto); } }}
            onPaste={(e) => { const v = e.clipboardData.getData('text'); e.preventDefault(); setTexto(v); ponerEnlace(v); }}
            className={`${input} flex-1`} placeholder={t('dashboard.shared.imageUrlPh')} maxLength={500} />
          <label className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-bg px-3 py-2 text-xs font-semibold text-fg transition-colors hover:border-brand ${sub.ocupado ? 'pointer-events-none opacity-60' : ''}`}>
            {sub.ocupado ? <ImageIcon size={14} className="animate-pulse" /> : <Upload size={14} />}
            {sub.ocupado ? t('dashboard.shared.uploading') : t('dashboard.shared.uploadFromPC')}
            <input type="file" accept={ACEPTA_IMAGEN} onChange={onFile} className="hidden" disabled={sub.ocupado} />
          </label>
        </div>
      )}
      {rota && value && <p role="alert" className="mt-1 text-xs text-danger">{t('dashboard.imagen.enlace.noImagen')}</p>}
      {avisoEnlace && (avisoEnlace.startsWith('error:')
        ? <p role="alert" className="mt-1 text-xs text-danger">{avisoEnlace.slice(6)}</p>
        : <p className="mt-1 text-xs text-success">{avisoEnlace}</p>)}
      <EstadoSubida sub={sub} />
    </div>
  );
}
