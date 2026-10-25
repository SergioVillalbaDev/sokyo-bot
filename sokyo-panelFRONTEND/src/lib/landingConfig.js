// Datos NO traducibles de la landing (enlaces, colores, anchos de barras…).
// El texto vive en src/i18n/locales/*. Aquí solo lo que no cambia entre idiomas.

// Enlace de invitación del bot (OAuth de Discord).
// permissions=8 -> Administrador (gestiona tickets, roles, moderación y voz).
// scope bot+applications.commands -> entra como bot y habilita los slash commands.
export const inviteUrl = 'https://discord.com/oauth2/authorize?client_id=1512125911439376506&permissions=8&scope=bot+applications.commands';

// «Mi cuenta» de cada miembro (main.jsx la abre en /cuenta).
export const URL_CUENTA = '/cuenta';

// Color de cada cifra, en el mismo orden que landing.stats.
export const statsAccent = ['#b4d8fc', '#c4b5fd', '#f0abfc', '#f9a8d4'];

// Colores de las barras de prioridad del tile grande de Features (por orden).
export const prioridadBar = ['bg-red-400', 'bg-amber-400', 'bg-brand', 'bg-emerald-400'];

// Redes sociales del pie de página. Solo se muestran las que tengan enlace:
// añade aquí { icono: 'discord' | 'email' | 'x', href: 'https://…', label: '…' }.
export const redes = [];

