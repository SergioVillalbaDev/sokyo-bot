// 🎮 Actividad de Discord (1.34.0). Discord abre /actividad dentro de su ventana (botón «Actividades»). Aquí se entra
// con el SDK de Discord (sin pedir nada al usuario: prompt 'none'), y se enseña lo mismo que /menu en Discord: tu oro y
// el diario, tu mascota, la granja, el pase, lo siguiente que te toca y qué hay encendido en el servidor. Las acciones
// llaman a la misma lógica del bot (api/routes/actividad.js). Fuera de Discord explica cómo abrirla.
// Para activarla en el portal de Discord: ACTIVIDAD.md.
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const dentroDeDiscord = () => new URLSearchParams(window.location.search).has('frame_id')
const fmt = (n, idioma) => Number(n || 0).toLocaleString(idioma === 'es' ? 'es-ES' : 'en-US')

function Barra({ etiqueta, valor, color }) {
  const v = Math.max(0, Math.min(100, Math.round(valor ?? 0)))
  return (
    <div className="text-[11px]">
      <div className="mb-0.5 flex justify-between text-white/60"><span>{etiqueta}</span><span>{v}</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${color}`} style={{ width: `${v}%` }} /></div>
    </div>
  )
}

function Tarjeta({ titulo, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-white/[.04] p-4 ${className}`}>
      {titulo && <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/50">{titulo}</h2>}
      {children}
    </section>
  )
}

function Pantalla({ children }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-[#0d0b16] p-6 text-center text-white">
      <div className="max-w-md space-y-4">{children}</div>
    </div>
  )
}

export default function Actividad() {
  const { t, i18n } = useTranslation()
  const idioma = i18n.language?.startsWith('es') ? 'es' : 'en'
  const [fase, setFase] = useState(dentroDeDiscord() ? 'cargando' : 'fuera')
  const [sesion, setSesion] = useState(null)
  const [guildId, setGuildId] = useState(null)
  const [datos, setDatos] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [ocupado, setOcupado] = useState(null)
  const [nombre, setNombre] = useState('')

  const pedir = useCallback(async (ruta, opciones = {}) => {
    const r = await fetch(`/api${ruta}`, {
      ...opciones,
      headers: { 'Content-Type': 'application/json', 'X-Sokyo-Lang': idioma, ...(sesion ? { Authorization: `Bearer ${sesion}` } : {}), ...opciones.headers },
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw Object.assign(new Error(j.error || r.statusText), { codigo: j.codigo, status: r.status })
    return j
  }, [idioma, sesion])

  // 1) Entrar con Discord (solo dentro de Discord).
  useEffect(() => {
    if (!dentroDeDiscord()) return
    let vivo = true
    ;(async () => {
      try {
        const cfg = await (await fetch('/api/auth/actividad/config')).json()
        if (!cfg.lista || !cfg.clientId) { if (vivo) setFase('noLista'); return }
        const { DiscordSDK } = await import('@discord/embedded-app-sdk')
        const sdk = new DiscordSDK(cfg.clientId)
        await sdk.ready()
        const { code } = await sdk.commands.authorize({ client_id: cfg.clientId, response_type: 'code', state: '', prompt: 'none', scope: ['identify'] })
        const r = await fetch('/api/auth/actividad/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })
        const tk = await r.json()
        if (!r.ok) throw new Error(tk.error)
        await sdk.commands.authenticate({ access_token: tk.access_token })
        if (!vivo) return
        setNombre(tk.usuario?.nombre || '')
        setSesion(tk.sesion)
        if (!sdk.guildId) { setFase('sinServidor'); return }
        setGuildId(sdk.guildId)
      } catch (e) {
        console.error('Actividad:', e)
        if (vivo) setFase('error')
      }
    })()
    return () => { vivo = false }
  }, [])

  // 2) Cargar el estado del jugador en este servidor.
  const cargar = useCallback(async () => {
    if (!sesion || !guildId) return
    try {
      const j = await pedir(`/portal/actividad/estado?guildId=${encodeURIComponent(guildId)}`)
      setDatos(j); setFase('lista')
    } catch (e) {
      setFase(e.codigo === 'sin-bot' ? 'sinBot' : 'error')
    }
  }, [sesion, guildId, pedir])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- cargar() cambia el estado al llegar la respuesta, no al momento
  useEffect(() => { cargar() }, [cargar])

  async function accion(que) {
    setOcupado(que); setAviso(null)
    try {
      const r = await pedir(`/portal/actividad/${que}`, { method: 'POST', body: JSON.stringify({ guildId }) })
      if (que === 'diario') setAviso(r.ok ? t('actividad.diarioHecho', { n: fmt(r.total, idioma), racha: r.racha }) : t('actividad.diarioEspera', { h: r.esperaHoras }))
      else setAviso(r.nueva ? t('actividad.granjaEmpezada') : r.ok ? t('actividad.granjaHecho', { n: fmt(r.oro, idioma) }) : t('actividad.granjaVacia'))
      await cargar()
    } catch (e) {
      setAviso(e.message)
    } finally { setOcupado(null) }
  }

  if (fase === 'fuera') {
    return (
      <Pantalla>
        <div className="text-5xl">🎮</div>
        <h1 className="text-2xl font-extrabold">{t('actividad.fueraTitulo')}</h1>
        <p className="text-white/70">{t('actividad.fueraTexto')}</p>
        <a href="/cuenta" className="inline-block rounded-xl bg-violet-600 px-5 py-2.5 font-bold hover:bg-violet-500">{t('actividad.irCuenta')}</a>
      </Pantalla>
    )
  }
  if (fase !== 'lista' || !datos) {
    const texto = fase === 'cargando' ? t('actividad.cargando') : t(`actividad.${fase}`)
    return (
      <Pantalla>
        <div className={`text-5xl ${fase === 'cargando' ? 'animate-pulse' : ''}`}>{fase === 'cargando' ? '✨' : '🌙'}</div>
        <p className="text-white/80">{texto}</p>
        {fase === 'error' && <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-white/10 px-4 py-2 font-bold hover:bg-white/20">{t('actividad.reintentar')}</button>}
      </Pantalla>
    )
  }

  const e = datos.estado
  const eq = e.equipada
  const sprite = eq && /^[a-z0-9-]+$/.test(eq.id) ? `/sprites/${eq.id}.webp` : null
  const paso = e.siguiente?.id
  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_20%_0%,#3b1d6e_0%,#0d0b16_55%)] p-4 text-white sm:p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-violet-300">Sokyo · {datos.servidor.nombre}</p>
            <h1 className="text-2xl font-extrabold">{t('actividad.hola', { nombre: nombre || '👋' })}</h1>
          </div>
          {aviso && <p role="status" className="rounded-xl border border-violet-400/30 bg-violet-500/15 px-3 py-2 text-sm">{aviso}</p>}
        </header>

        {paso && t(`actividad.pasos.${paso}`, { defaultValue: '' }) && (
          <Tarjeta className="border-amber-400/30 bg-amber-400/[.08]">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300">👉 {t('actividad.ahora')}</p>
            <p className="mt-1 font-semibold">{t(`actividad.pasos.${paso}`, { falta: fmt(e.siguiente.falta, idioma), oro: fmt(e.siguiente.oro, idioma) })}</p>
          </Tarjeta>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Tarjeta titulo={t('actividad.oro')}>
            <p className="text-3xl font-extrabold">🪙 {fmt(e.oro, idioma)}</p>
            {e.racha > 0 && <p className="text-sm text-white/60">🔥 {t('actividad.racha', { count: e.racha })}</p>}
            <button type="button" disabled={!e.diarioListo || ocupado === 'diario'} onClick={() => accion('diario')}
              className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-2.5 font-bold transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40">
              {e.diarioListo ? `🎁 ${t('actividad.diario')}` : `✅ ${t('actividad.diarioYa')}`}
            </button>
          </Tarjeta>

          <Tarjeta titulo={t('actividad.mascota')}>
            {eq ? (
              <div className="flex items-center gap-3">
                <div className="grid size-20 shrink-0 place-items-center rounded-2xl bg-white/5">
                  {sprite ? <img src={sprite} alt="" className="size-20 object-contain" /> : <span className="text-4xl">{eq.emoji}</span>}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="truncate font-bold">{idioma === 'es' ? eq.nombre : eq.nombreEn} <span className="text-xs font-semibold text-white/50">· {eq.humor === 'fuera' ? t('actividad.fuera') : t('actividad.nivel', { n: eq.nivel })}</span></p>
                  <Barra etiqueta={t('actividad.barras.hambre')} valor={eq.estado?.hambre} color="bg-orange-400" />
                  <Barra etiqueta={t('actividad.barras.alegria')} valor={eq.estado?.alegria} color="bg-pink-400" />
                  <Barra etiqueta={t('actividad.barras.energia')} valor={eq.estado?.energia} color="bg-sky-400" />
                </div>
              </div>
            ) : <p className="text-white/70">{t('actividad.sinMascota')}</p>}
          </Tarjeta>

          {e.granja && (
            <Tarjeta titulo={`🧺 ${t('actividad.granja')}`}>
              <p className="font-semibold">{e.granja.nueva ? t('actividad.granjaNueva') : e.granja.lleno ? t('actividad.granjaLlena') : t('actividad.granjaOro', { n: fmt(e.granja.oro, idioma) })}</p>
              <button type="button" disabled={ocupado === 'granja' || (!e.granja.nueva && (e.granja.oro || 0) < 1)} onClick={() => accion('granja')}
                className="mt-3 w-full rounded-xl bg-violet-600 px-4 py-2.5 font-bold transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40">
                {e.granja.nueva ? `▶️ ${t('actividad.granjaNueva')}` : `🧺 ${t('actividad.recoger')}`}
              </button>
            </Tarjeta>
          )}

          <Tarjeta titulo={`🎟️ ${t('actividad.pase')}`}>
            <p className="font-semibold">{t('actividad.paseNivel', { n: e.pase?.nivel || 0, t: e.pase?.tickets || 0 })}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-amber-400" style={{ width: `${(e.pase?.xp || 0) % 100}%` }} /></div>
          </Tarjeta>
        </div>

        {datos.zonas.length > 0 && (
          <Tarjeta titulo={t('actividad.queHay')}>
            <div className="space-y-3">
              {datos.zonas.map((z) => (
                <div key={z.id}>
                  <p className="mb-1.5 text-sm font-bold">{z.emoji} {z.nombre}</p>
                  <div className="flex flex-wrap gap-2">
                    {z.modulos.map((m) => (
                      <span key={m.id} title={`${m.frase}\n${m.comandos.join(' · ')}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">{m.emoji} {m.nombre}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-white/50">💬 {t('actividad.consejo')}</p>
          </Tarjeta>
        )}
      </div>
    </div>
  )
}
