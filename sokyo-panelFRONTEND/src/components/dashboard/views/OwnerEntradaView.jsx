// Panel → Propietario → «Mensaje de entrada» (solo propietarios del bot).
// El mensaje que manda el bot al ENTRAR en un servidor nuevo, explicándolo todo:
// a quién se manda (privado al dueño, canal), los textos en español e inglés, la guía
// completa de funciones, vista previa como en Discord y «Enviar prueba» a tu privado.
// Es GLOBAL: vale para todos los servidores (utils/onboarding.js, models/MensajeEntrada.js).
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquareHeart, Send, Save, RotateCcw, Loader2 } from 'lucide-react';
import { Card, Toggle } from '../../ui/primitives';
import { apiFetch } from '../../../lib/api';
import { useAutoguardado, avisarGuardado } from '../../../hooks/useAutoguardado';
import EstadoAutoguardado from '../EstadoAutoguardado';
import VistaDiscord from '../VistaDiscord';

const inputCls = 'w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-fg outline-none focus:border-brand';

// Llama a la API y devuelve { ok, datos } sin lanzar (el error, en datos.error).
async function llamar(ruta, opciones) {
  try {
    const r = await apiFetch(ruta, opciones);
    const datos = await r.json().catch(() => ({}));
    return { ok: r.ok, datos };
  } catch { return { ok: false, datos: {} }; }
}

// La misma regla que la API al guardar: si no va por privado, el «respaldo» es el canal.
const ajustar = (f) => (f.activo && !f.alDueno && f.alCanal === 'respaldo' ? { ...f, alCanal: 'siempre' } : f);

export default function OwnerEntradaView({ dash }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(null);
  const [piezas, setPiezas] = useState(null);
  const [errorCarga, setErrorCarga] = useState(null);
  const [idioma, setIdioma] = useState('es');
  const [estado, setEstado] = useState(null); // { tipo: 'ok' | 'error', texto }
  const [ocupado, setOcupado] = useState(null); // 'guardar' | 'probar'

  // Se carga una vez al abrir (no al cambiar el idioma del panel: pisaría lo escrito).
  useEffect(() => {
    let vivo = true;
    llamar('/api/owner/mensaje-entrada').then(({ ok, datos }) => {
      if (!vivo) return;
      if (!ok) { setErrorCarga(datos.error || ''); return; }
      setForm(datos.config); setPiezas(datos.piezas);
    });
    return () => { vivo = false; };
  }, []);

  // Guarda lo que hay en el formulario. Lo usa el autoguardado (al dejar de tocar, con
  // Ctrl + S y al salir de la sección) y el botón. `form` no se pisa con lo guardado.
  const guardar = async () => {
    const { ok, datos } = await llamar('/api/owner/mensaje-entrada', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (!ok) { setEstado({ tipo: 'error', texto: datos.error || t('dashboard.ownerEntrada.saveErr') }); return false; }
    return true;
  };
  const autoguardado = useAutoguardado(form, guardar, { listo: !!form, borrador: 'owner-entrada', restaurar: setForm });

  if (!form || !piezas) {
    return (
      <Card className="flex items-center gap-2 p-6 text-sm text-muted">
        {errorCarga !== null ? <span className="text-danger">{errorCarga || t('dashboard.ownerEntrada.loadErr')}</span> : <><Loader2 size={16} className="animate-spin" /> {t('dashboard.ownerEntrada.loading')}</>}
      </Card>
    );
  }

  const cambiar = (parche) => { setForm((f) => ajustar({ ...f, ...parche })); setEstado(null); };
  const cambiarTexto = (campo, valor) => cambiar({ [idioma]: { ...form[idioma], [campo]: valor } });
  const p = piezas[idioma];
  const textos = form[idioma] || {};
  const sinCambios = ['al-dia', 'guardado', 'apagado'].includes(autoguardado);

  const guardarYa = async () => {
    setOcupado('guardar');
    const ok = await guardar();
    setOcupado(null);
    if (ok) { avisarGuardado(); setEstado({ tipo: 'ok', texto: t('dashboard.ownerEntrada.saved') }); }
  };
  const probar = async () => {
    setOcupado('probar');
    const { ok, datos } = await llamar('/api/owner/mensaje-entrada/probar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, idioma, guildId: dash?.guildId }) });
    setOcupado(null);
    setEstado(ok ? { tipo: 'ok', texto: t('dashboard.ownerEntrada.testSent') } : { tipo: 'error', texto: datos.error || t('dashboard.ownerEntrada.testErr') });
  };
  const restaurar = () => cambiar({ [idioma]: { titulo: '', descripcion: '' } });

  // Vista previa: lo mismo que construye el bot (utils/onboarding.js).
  const servidor = t('dashboard.ownerEntrada.exampleServer');
  const embed = {
    color: '#5865F2',
    titulo: (textos.titulo || '').trim() || p.porDefecto.titulo,
    descripcion: ((textos.descripcion || '').trim() || p.porDefecto.descripcion).replace(/\{(server|servidor)\}/gi, servidor),
    campos: [
      { nombre: p.pasos.nombre, valor: p.pasos.valor },
      { nombre: p.panel.nombre, valor: p.panel.valor, inline: true },
      { nombre: p.consejo.nombre, valor: p.consejo.valor, inline: true },
      ...(form.guiaCompleta ? p.guia : []),
    ],
  };
  const botones = [
    { texto: p.botones[0], estilo: 'gris' }, { texto: p.botones[1], estilo: 'gris' },
    { texto: p.botones[2], estilo: 'azul' }, { texto: p.botones[3], estilo: 'gris' },
  ];

  const fila = (titulo, desc, control) => (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="min-w-0"><span className="block text-sm font-semibold text-fg">{titulo}</span><span className="block text-xs leading-snug text-muted">{desc}</span></span>
      {control}
    </label>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-elevated px-4 py-3">
        <MessageSquareHeart size={18} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-xs leading-relaxed text-muted">{t('dashboard.ownerEntrada.intro')}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Card className="space-y-4 p-5" data-help="entrada-envio">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.ownerEntrada.sendTitle')}</p>
            {fila(t('dashboard.ownerEntrada.active'), t('dashboard.ownerEntrada.activeDesc'), <Toggle checked={!!form.activo} onChange={() => cambiar({ activo: !form.activo })} />)}
            {fila(t('dashboard.ownerEntrada.toOwner'), t('dashboard.ownerEntrada.toOwnerDesc'), <Toggle checked={!!form.alDueno} disabled={!form.activo} onChange={() => cambiar({ alDueno: !form.alDueno })} />)}
            <div>
              <span className="block text-sm font-semibold text-fg">{t('dashboard.ownerEntrada.toChannel')}</span>
              <span className="mb-2 block text-xs leading-snug text-muted">{t('dashboard.ownerEntrada.toChannelDesc')}</span>
              <select value={form.alCanal} disabled={!form.activo} onChange={(e) => cambiar({ alCanal: e.target.value })} className={inputCls}>
                <option value="respaldo">{t('dashboard.ownerEntrada.channelFallback')}</option>
                <option value="siempre">{t('dashboard.ownerEntrada.channelAlways')}</option>
                <option value="nunca">{t('dashboard.ownerEntrada.channelNever')}</option>
              </select>
            </div>
            {fila(t('dashboard.ownerEntrada.fullGuide'), t('dashboard.ownerEntrada.fullGuideDesc'), <Toggle checked={!!form.guiaCompleta} onChange={() => cambiar({ guiaCompleta: !form.guiaCompleta })} />)}
          </Card>

          <Card className="space-y-4 p-5" data-help="entrada-textos">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.ownerEntrada.textsTitle')}</p>
              <div role="radiogroup" className="flex gap-1 rounded-xl border border-line bg-bg p-1">
                {['es', 'en'].map((l) => (
                  <button key={l} type="button" role="radio" aria-checked={idioma === l} onClick={() => setIdioma(l)}
                    className={`rounded-lg px-3 py-1 text-xs font-bold ${idioma === l ? 'bg-gradient-brand text-white' : 'text-muted hover:text-fg'}`}>
                    {l === 'es' ? 'Español' : 'English'}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted">{t('dashboard.ownerEntrada.langHint')}</p>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.ownerEntrada.fieldTitle')}</span>
              <input value={textos.titulo || ''} maxLength={256} onChange={(e) => cambiarTexto('titulo', e.target.value)} placeholder={p.porDefecto.titulo} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.ownerEntrada.fieldDesc')}</span>
              <textarea value={textos.descripcion || ''} maxLength={2000} rows={4} onChange={(e) => cambiarTexto('descripcion', e.target.value)} placeholder={p.porDefecto.descripcion} className={`${inputCls} resize-y`} />
              <span className="mt-1 block text-[11px] text-muted">{t('dashboard.ownerEntrada.vars')}</span>
            </label>
            <button type="button" onClick={restaurar} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-semibold text-muted transition-colors hover:text-fg">
              <RotateCcw size={13} /> {t('dashboard.ownerEntrada.reset')}
            </button>
          </Card>
        </div>

        <Card className="p-5" data-help="entrada-previa">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.ownerEntrada.preview')}</p>
          {form.activo
            ? <VistaDiscord embed={embed} botones={botones} />
            : <p className="text-sm italic text-muted">{t('dashboard.ownerEntrada.offPreview')}</p>}
        </Card>
      </div>

      {estado && (
        <p role="status" className={`rounded-2xl border px-4 py-2.5 text-sm ${estado.tipo === 'ok' ? 'border-success/40 bg-success/10 text-success' : 'border-danger/40 bg-danger/10 text-danger'}`}>{estado.texto}</p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <EstadoAutoguardado estado={autoguardado} />
        <button type="button" onClick={probar} disabled={!!ocupado} className="inline-flex items-center gap-2 rounded-2xl border border-line px-4 py-2.5 text-sm font-semibold text-fg transition-colors hover:border-brand disabled:opacity-50">
          {ocupado === 'probar' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {t('dashboard.ownerEntrada.test')}
        </button>
        <button type="button" onClick={guardarYa} disabled={!!ocupado || sinCambios} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:opacity-50">
          {ocupado === 'guardar' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} {sinCambios ? t('dashboard.ownerEntrada.allSaved') : t('dashboard.ownerEntrada.save')}
        </button>
      </div>
    </div>
  );
}
