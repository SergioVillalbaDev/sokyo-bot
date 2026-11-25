# Plan de lanzamiento — lo que falta para que Sokyo esté listo para venderse

Revisión hecha el 25-11-2026 sobre `feature/frontend-redesign` (1.34.1). Punto de partida: 677 tests en verde,
lint y build del panel sin errores. Cada punto se marca con [x] cuando está hecho y probado. Al final: 895 tests en verde, lint y build sin
errores, recorrido de las 343 rutas de la API con MongoDB y un Discord simulado, y capturas en móvil y escritorio.

## A. Quitar lo que sobra
- [x] A1. `/dado` y `/moneda` (comandos `!dice`/`!coin`, sus slash y el GIF del dado fuera del casino).
- [x] A2. Búsqueda de empleo entera: `/empleo`, `/buscoempleo`, `/cv`, modelos `OfertaEmpleo`/`PerfilEmpleo`, scraping,
      PDF del CV, lector de CV con IA, botones, tareas del programador, catálogo, panel y dependencias (puppeteer, mammoth,
      pdf-parse, pdfkit).
- [x] A3. Tienda global de objetos («estilo exchange»): `/tienda`, `/usar`, la forja de la web (cualquiera podía crear
      objetos a 0 de oro que daban roles o XP ×N en cualquier servidor), cajas, ofertas y subida de imágenes abierta.
      **Fallo de seguridad y de trampas**. El oro se gasta en lo que ya tiene sentido: cofres, cartas, casa, mascota,
      mercado, bromas y la nueva tienda del servidor (C4).
- [x] A4. `/daroro`: nadie puede dar oro (ni los admins). El oro solo se gana jugando.
- [x] A5. Que ningún texto, guía, ayuda, web, tutorial ni el panel nombre lo quitado (tests de referencias al día).

## B. Seguridad y trampas
- [x] B1. Test automático que recorre TODAS las rutas de la API con una sesión de staff de otro servidor y exige 403/404.
- [x] B2. Las rutas de Comunidad (sorteos, eventos, encuestas, sugerencias, presentaciones, trivia), anuncios, reportes,
      emojis/stickers y paneles respetan el ÁREA del panel, no solo «es staff de ese servidor».
- [x] B3. Revisión de todas las fuentes de oro: que cada una tenga tope, sea por servidor y no se pueda repetir con
      doble clic (diario, votos, granja, misiones, pase, casino, combates, mercado).
- [x] B4. Subidas de archivos: solo staff con área, con límite de tamaño y por servidor.

## C. Primera experiencia (romper la barrera de entrada)
- [x] C1. Al entrar el bot: privado al dueño con los 3 pasos y, SIEMPRE, un mensaje corto y público en el servidor
      («Hola, soy Sokyo: esto es lo que hago, empieza aquí») con botones a la configuración en 1 minuto y a `/menu`.
- [x] C2. Quien entra al panel sin ser staff no ve «No eres staff»: se le lleva a «Mi cuenta» explicándole por qué y
      qué puede hacer allí. El panel dice quién puede entrar y a qué (vista de acceso clara).
- [x] C3. Tutoriales, guía del canal, `/empezar`, `/ayuda`, web `/ayuda` y setup rápido al día con lo que hay.
- [x] C4. **Tienda del servidor** (nueva, por servidor): los admins ponen roles cosméticos a la venta por oro desde el
      panel (nunca roles con permisos). Da sentido al oro dentro de cada comunidad.

## D. Que todo tenga relación y sentido
- [x] D1. Ocio y gestión separados: en Discord `/menu` con las dos zonas; en el panel, «Gestión» y «Diversión» bien
      separados; cada función de ocio conecta con el oro, la mascota y el pase.
- [x] D2. Clanes: ganan puntos con XP y combates, guerra semanal y premio. Se añade ventaja real del clan ganador.
- [x] D3. Votar en top.gg: oro + ticket de cofre gratis + racha de votos, recordatorio, botón en `/diario` y `/menu`.

## E. Premium que vende sin estropear lo gratis
- [x] E1. Revisar que cada ventaja Pro funcione y que el plan Free sea generoso.
- [x] E2. Ventajas Pro nuevas de ocio que no rompen el juego (cosméticas y de comodidad para el servidor).
- [x] E3. Avisos de «Esto es Pro» claros, con prueba de 7 días visible y enlace de compra.

## F. Marketing, web y Google
- [x] F1. Descripción del bot (Discord, top.gg y la web) con todo lo que hace, en `MARKETING.md`.
- [x] F2. Web principal: que se vea también la parte de ocio (casino, mascotas, cartas, combates) y que se entienda en
      10 segundos.
- [x] F3. SEO: sitemap con todas las páginas reales (`/ayuda/*`, `/novedades`, `/estado`, `/servidores`), metadatos y
      datos estructurados al día.

## G. Cierre
- [ ] G1. Tests, lint, build, prueba en navegador (móvil y escritorio) y revisión del propio cambio.
- [ ] G2. Versión 2.0.0 con novedades, despliegue en la Pi y aviso «Bot actualizado» por privado.
- [ ] G3. Pregunta final: ¿está listo para venderse y entrar en muchísimos servidores? Si no es un SÍ rotundo, seguir.

## Notas de lo hecho
- B4: la única subida abierta a cualquiera con sesión era la de la forja de la tienda global (8 MB sin límite de
  veces): se ha quitado entera. Las demás subidas son del panel y ya piden su área.
- D1: ocio y gestión ya estaban separados (en Discord, `/menu` con zonas de juego y comandos de staff aparte; en el
  panel, bloques «Día a día», «Tu comunidad» con su grupo «Diversión», y «Administración»). Ahora además el área
  «Comunidad y diversión» deja dar acceso al panel a los moderadores sin que toquen el casino o los sorteos.
- Riesgo conocido y aceptado: cuentas secundarias que juegan para pasar oro a la principal (pasa en todos los bots de
  economía). Lo frenan la comisión del mercado, los topes diarios y que la Liga entre servidores tiene tope por persona.

## Segunda ronda (2.1.0)
- [x] Simulador de Discord en el repo: todos los comandos y cientos de botones, como usuario nuevo y con oro: 0 fallos.
- [x] Revisión del bot real en producción (5 servidores) con la clave de soporte: sanos; arreglado un aviso falso.
- [x] Primera mascota el primer día (cofre de bienvenida) y configuración rápida que abre la tienda.
- [x] Sentido de cada función de ocio y comunidad: todas cumplen un papel; ninguna sobra.
- [x] Seguridad: subidas con tope, API cerrada sin clave, IP real tras Cloudflare, subidas sin ejecución, sin operadores
      de MongoDB en las peticiones, librerías sin vulnerabilidades en el bot.
- [x] Recorrido de las 74 secciones del panel, Mi cuenta y la portada (es/en, móvil/escritorio, todo apagado y encendido).
- [x] Pagos de punta a punta (firma, mensual, único, renovación, impago, cancelación): arreglado el «de por vida».
- [x] Web: FAQ de juegos y oro, datos para Google y tutorial de la tienda.
