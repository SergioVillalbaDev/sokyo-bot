# 🚀 Despliegue — Sprints comerciales 0, 1 y 2

Resumen para subir a la Raspberry Pi todo el trabajo de comercialización
(landing honesta, conversión, moderación por IA, permisos y base de cosméticos).
Rama: **`feature/frontend-redesign`**.

---

## 📦 Qué entra en este despliegue

| Commit | Sprint | Qué cambia |
|---|---|---|
| `6f119d2` | 0 | Landing honesta (fuera métricas falsas), índices Mongo, caché de config |
| `7cad82c` | 0 | Métricas de la landing centradas en beneficio, sin el trial |
| `e13bf29` | 1 | Candados premium con upsell contextual + comparativa y FAQ en la landing |
| `ed67e44` | 2 | **Moderación por IA (Pro)** — el diferenciador |
| `54b11e9` | 2 | Permisos granulares por sección (incluida facturación) |
| `98eda01` | 2 | Anuncios recurrentes mensuales |
| `d36be27` | 2 | Base de cosméticos de economía (lista pero **dormida**) |

---

## ✅ Requisitos antes de desplegar

- **`ANTHROPIC_API_KEY`** en el `.env` de la Pi → necesaria para la **moderación por IA**
  (probablemente ya está, la usa la IA de tickets). Sin ella, el bot funciona igual
  y el automod IA simplemente no actúa.
- Sin cambios de dependencias: **no hace falta** tocar `package.json`.
- No hay nuevas variables de entorno aparte de la de arriba.

---

## 🛠️ Pasos en la Raspberry Pi

```bash
# 1. Entrar al proyecto
cd ~/sokyo-bot                 # ajusta la ruta si es otra

# 2. Bajar los cambios
git fetch origin
git checkout feature/frontend-redesign     # si no estabas ya en ella
git pull origin feature/frontend-redesign

# 3. RECONSTRUIR EL PANEL (imprescindible: dist/ no está en el repo
#    y la API sirve la web desde sokyo-panelFRONTEND/dist)
cd sokyo-panelFRONTEND
npm run build
cd ..

# 4. Reiniciar el bot (también reinicia la API + web).
#    Los índices de Mongo se crean solos al arrancar.
pm2 restart sokyo              # o: sudo systemctl restart sokyo-bot
```

> Si arrancas el bot a mano (screen/tmux), para el proceso y vuelve a hacer `npm start`.

---

## 🔍 Verificación post-despliegue

1. **Logs** sin errores al arrancar: `pm2 logs sokyo --lines 30` (o `journalctl -u sokyo-bot -n 30`).
2. **Landing** (abre `sokyo.studio` con **Ctrl+F5** para saltar la caché):
   - Banda de stats nueva: *5+ bots · 37 comandos · 100% sin código · <60s*.
   - Hero todo-en-uno + secciones nuevas **Comparativa** y **FAQ**.
3. **Panel** (entra como servidor **Free**, no con tu cuenta de dueño):
   - Los ítems Analítica, Resumen, Embudo y Backup salen con **corona** y al pulsarlos abren el modal de upgrade.
4. **Automod IA** (servidor Pro): Automod → tarjeta "Moderación por IA", actívala y manda un mensaje claramente tóxico en un canal no exento → debería borrarse. ⚠️ *Esto no se pudo probar en desarrollo (sin clave de IA): conviene una prueba en vivo.*
5. **Permisos**: Acceso y permisos → ahora aparecen todas las secciones (incluida facturación) para restringir por rol.

---

## ⏸️ Lo que NO hace nada todavía (esperado)

- **Cosméticos de economía**: la base está hecha (`utils/cosmeticos.js`, campos en `Usuario`)
  pero **no está activada** a propósito, a la espera de cerrar la economía. No aparece en
  comandos ni panel. Instrucciones de activación en el cabecero de `utils/cosmeticos.js`.

---

## 📋 Pendiente manual (no es código)

- [ ] **Activar backup automático en MongoDB Atlas** (antes de cobrar a nadie).
- [ ] **Grabar un GIF/Loom del panel** para la landing (hueco reservado en el Hero).
- [ ] (Opcional) Separar **API+web a un PaaS** barato para desacoplar los pagos del bot.
