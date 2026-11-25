# Sokyo: textos de marketing y ficha de top.gg

Todo lo que hace falta copiar y pegar para publicar el bot. Si cambia lo que hace Sokyo, cambia esto
y `utils/descripcionBot.js` (la descripción de Discord, que el bot pone solo al arrancar).

## Posicionamiento (en una frase)
**El bot de Discord que gestiona tu servidor y además le da vida: tickets y moderación para el staff;
mascotas, cartas, combates y casino para los miembros. Todo desde un panel web, listo en 1 minuto.**

Lo que nos diferencia (usar siempre en este orden):
1. **Dos bots en uno de verdad**: gestión seria (tickets, automod con IA, verificación) + un juego que
   engancha (mascotas que crecen, 643 cartas de anime, combates, casino, pase de temporada).
2. **Cero barrera de entrada**: «Configurar en 1 minuto», todo en español, sin comandos que aprender
   (`/menu` con botones), y un panel web con buscador.
3. **Cada servidor es su propio mundo**: el oro y el progreso son de cada servidor, todos empiezan de 0.
   La Liga Sokyo enfrenta a servidores entre sí.
4. **Justo**: el oro nunca se compra con dinero y nadie puede regalarlo. Premium es para el servidor
   (comodidad, marca blanca, IA), no para ganar.

## top.gg

**Prefijo:** `/` (comandos con barra) · **Etiquetas:** Moderation, Tickets, Economy, Fun, Leveling,
Music, Games, Anime, Spanish, Dashboard

**Descripción corta (máx. 300):**
> Bot todo en uno en español: tickets, moderación con IA, bienvenidas y roles, y además mascotas,
> cartas de anime, combates, casino y niveles para que tu comunidad no pare. Panel web y listo en 1 minuto.

**Descripción larga (markdown):**

```markdown
# 👋 Sokyo: gestiona tu servidor y dale vida

Sokyo hace dos cosas que normalmente necesitan cinco bots:

## 🛠️ Para el staff
- 🎫 **Tickets** con categorías, prioridades, transcripciones, valoraciones y respuesta desde la web.
- 🛡️ **Moderación**: avisos, aislamientos, baneos con deshacer, **automod con IA**, anti-raid y verificación.
- 👋 **Bienvenidas** con imagen, roles al entrar, paneles de roles y mensajes programados.
- 🚀 **Crecimiento**: invitaciones con premios, bump, avisos de Twitch/YouTube y página pública.
- 🔒 Tú eliges **quién entra al panel y a qué partes**. Todo queda registrado y se puede deshacer.

## 🎮 Para tus miembros (todo con el oro de TU servidor)
- 🐾 **57 mascotas** que cuidas, crecen, evolucionan, trabajan en tu granja y van de expedición.
- 🃏 **643 cartas de anime** coleccionables, con series, holográficas, intercambios y mercado.
- ⚔️ **Combates** por turnos, torre de 50 pisos, **jefe semanal** de todo el servidor y ELO.
- 🎰 **Casino** con 17 juegos: tragaperras, blackjack, póker, crash, ruleta, bingo y más.
- 🎟️ **Pase de temporada gratis**, logros, clanes con guerra semanal y la **Liga contra otros servidores**.
- 🛒 **Tienda del servidor**: los admins venden roles cosméticos por oro.

## ⚡ Listo en 1 minuto
1. Añade Sokyo. 2. Pulsa **Configurar en 1 minuto** y elige el tipo de servidor. 3. Tus miembros escriben `/menu`.

## 🗳️ Vota y gana
Cada voto: **300 de oro** (el doble en fin de semana) en cada servidor donde juegas, **un cofre gratis al día**
y **un cofre épico cada 7 días seguidos**. Usa `/votar`.

## 💎 Gratis de verdad
Todo lo de arriba es gratis. **Sokyo Pro** (7 €/mes, 7 días de prueba en cada servidor) añade moderación con IA,
marca blanca, música 24/7, estadísticas avanzadas, tienda de 25 productos y 100 mascotas propias.
El oro **nunca** se compra con dinero.

🌐 Panel: https://dashboard.sokyo.studio · 📖 Ayuda: https://dashboard.sokyo.studio/ayuda
```

## Configurar top.gg (una vez)
- **Webhook URL:** `https://dashboard.sokyo.studio/api/topgg/voto`
- **Authorization:** una clave larga inventada; la misma en el `.env` de la Pi como `TOPGG_WEBHOOK_AUTH`.
- **Token de la API de top.gg** → `.env` como `TOPGG_TOKEN` (publica el número de servidores cada hora).
- Pulsa «Test» en top.gg: el bot lo recibe y no premia (los votos de prueba se ignoran).

## Plan de lanzamiento
1. **Semana 1 (servidor de prueba)**: alguien que no conoce el bot lo instala solo con el mensaje de entrada.
   Apuntar dónde se atasca (panel → «Uso de las funciones» y los «🤔 No lo entiendo»).
2. **top.gg + discordbotlist + discords.com**: misma ficha. Pedir el voto con el premio de arriba.
3. **Contenido corto** (TikTok/Shorts/Reels): «de 0 a servidor completo en 60 s», «mi mascota evolucionó»,
   «abrí 10 cofres». Los GIF del bot ya sirven de vídeo.
4. **Comunidades hispanas** de Discord (servidores de anime, gaming y streamers): la parte de juego en
   español es lo que no tiene nadie más.
5. **Referidos**: `/referidos` da días de Pro a quien recomiende el bot a otro servidor.
6. **SEO**: las 26 páginas de `/ayuda/*` están en el sitemap. Dar de alta el sitemap en Google Search
   Console (`https://dashboard.sokyo.studio/sitemap.xml`).
