# 📋 Resumen de sesión — sokyo-bot

Trabajo realizado sobre la rama `feature/frontend-redesign`. Pila añadida al panel:
**Tailwind CSS v4**, **Framer Motion**, **lucide-react**, **i18next/react-i18next**.

Verificación en cada fase: `node -c` (bot), `npm run build` y `npm run lint` (panel) → **0 errores**
(quedan 2 *warnings* preexistentes en `Portal.jsx`).

---

## 1. 🎨 Rediseño del frontend
- Landing nueva + dashboard "soft" rediseñado. La lógica original se extrajo **verbatim** a un hook.
- **Archivos clave:**
  - `sokyo-panelFRONTEND/src/hooks/useDashboard.js` — TODA la lógica (estado, fetch, handlers).
  - `sokyo-panelFRONTEND/src/lib/api.js` — `apiFetch`, token de staff, sesión.
  - `sokyo-panelFRONTEND/src/components/landing/*` — Navbar, Hero, Stats, Features, Steps, Pricing, Footer, Landing.
  - `sokyo-panelFRONTEND/src/components/dashboard/Dashboard.jsx` / `Sidebar.jsx` / `Header.jsx`.
  - `sokyo-panelFRONTEND/src/components/dashboard/views/*` — InicioView, TicketsView, ChatView, UsersView, TextsView, IncidentsView, LogsView, ModulesView, ComportamientoView, RulesView, MacrosView.

## 2. 🌈 Sistema de temas (11) + acento "Acid"
- 3 free (Claro, Oscuro, Acid/lima) + 8 premium (bloqueados sin plan). Todo por variables CSS.
- **Archivos:** `src/index.css` (paletas `[data-theme]`), `src/lib/themes.js`, `src/components/dashboard/ThemePicker.jsx`.

## 3. 🏠 Vista Inicio + gauges + avatar del servidor
- Resumen con equipo, tickets recientes, actividad y rail de gauges (memoria del plan, logs, CSAT).
- **Archivos:** `views/InicioView.jsx`, `src/components/ui/CircularGauge.jsx`, endpoint `GET /api/stats/uso` en `api/server.js`.

## 4. ⚙️ Configurabilidad (3 fases) — todo en `models/ServidorConfig.js`
| Fase | Qué | Dónde se lee/edita |
|---|---|---|
| **1 · Comportamiento** | CSAT, transcript DM, aviso de cierre, ping a rol, logs on/off | `utils/ticketManager.js`, eventos de logs, `views/ComportamientoView.jsx` |
| **2 · Marca/Textos** | color del panel, texto del botón, bienvenida, prefijo, categoría archivados | `comandos/setupSoporte.js`, `events/messageCreate.js`, `views/TextsView.jsx` |
| **3 · Reglas** | rol staff, categoría de creación, límite de tickets, auto-cierre, auto-asignación | `events/interactionCreate.js`, `utils/autoClose.js`, `views/RulesView.jsx` |
- Helpers: `utils/config.js` (`getConfig`, `getConfigCached`, `logActivo`).
- Script: `scripts/premium.js` (`node scripts/premium.js on|off|status [guildId]`).

## 5. 🌍 Internacionalización (ES / EN)
- **Todo** el texto (landing + dashboard) vive en `src/i18n/locales/es.js` y `en.js`. Componentes usan `t('clave')`.
- Config: `src/i18n/index.js`. Selector: `src/components/LanguageSwitcher.jsx`. Datos no-texto: `src/lib/landingConfig.js`.
- Añadir idioma = copiar `es.js` → `xx.js`, registrarlo en `index.js`.

## 6. ⚡ Productividad del staff
- **Macros:** `respuestasRapidas` en config → `views/MacrosView.jsx` + botón ⚡ en `ChatView.jsx`.
- **Etiquetas:** `etiquetas` en `models/Ticket.js` → editor en `ChatView.jsx`, chips + filtro en `TicketsView.jsx`.
- **Historial del usuario:** tarjeta en `ChatView.jsx` (derivado de los tickets ya cargados).
- **Auto-asignación round-robin:** `autoAsignar`/`autoAsignarIndex` en config → lógica en `events/interactionCreate.js`.

## 7. 🏢 Multi-servidor (Fase A) — aislamiento por `guildId`
- `GET /api/guilds` + filtrado por `?guildId=` en tickets, logs, usuarios, uso, config, roles y categorías.
- Selector de servidor en `Sidebar.jsx`; estado `guildId` en `useDashboard.js` (localStorage `sokyoGuild`).

## 8. 🔐 Seguridad — login del staff (Fase B) + endurecido
- Login con **Discord OAuth** (reutiliza el flujo del Portal con `state=staff`). El bot calcula tus servidores de staff y firma un **JWT** acotado.
- Middleware acota por servidor (403 fuera de los tuyos) + `scopeTicket` en las 7 rutas por `canalId`.
- **Archivos:** `api/server.js` (auth, middleware, `scopeTicket`), `src/components/dashboard/StaffLogin.jsx`, `src/App.jsx` (gate), `src/lib/api.js`.
- **Dos modos:** *propietario* (panel con `VITE_API_KEY` = acceso total sin login) y *staff* (sin esa key = login obligatorio + acotado).

## 9. 👑 Modo Propietario
- `OWNER_IDS` en el `.env` (IDs de usuario de Discord, separados por comas). Al iniciar sesión, ven **TODO** (todos los servidores/tickets), sin filtros. Insignia "👑 Propietario" en `Sidebar.jsx`.

---

## 🔑 Variables nuevas en `.env` (bot)
```env
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/discord/callback
FRONTEND_URL=http://localhost:5173
JWT_SECRET=...largo y aleatorio...
OWNER_IDS=tu_id_de_usuario,otro_id   # los que lo ven todo
```
> En el Developer Portal de Discord → OAuth2 → Redirects, añade la `OAUTH_REDIRECT_URI` exacta.

## ▶️ Cómo arrancar (2 terminales)
```bash
# Terminal 1 — bot + API (raíz)
npm start
# Terminal 2 — panel
cd sokyo-panelFRONTEND && npm run dev
```
- Panel: http://localhost:5173/ · Dashboard: #dashboard · Login staff: http://localhost:3000/api/auth/discord?state=staff
- ⚠️ Reinicia el **bot** tras cambios de código del bot o del `.env` (no se recargan en caliente).

## 🧭 Pendiente / ideas futuras
- Pasarela de pago (Stripe) para Premium real.
- Analítica con gráficas.
- Vista "🌍 Global" para propietarios (todos los servidores a la vez).
- Despliegue (Vercel + VPS + Atlas) y dominio propio.
- Producción: HTTPS + rotar `JWT_SECRET`.
