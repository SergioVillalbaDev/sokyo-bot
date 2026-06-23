// Datos NO traducibles de la landing (enlaces, colores, anchos de barras…).
// El texto vive en src/i18n/locales/*. Aquí solo lo que no cambia entre idiomas.

// Enlace de invitación del bot (OAuth de Discord).
// permissions=8 -> Administrador (gestiona tickets, roles, moderación y voz).
// scope bot+applications.commands -> entra como bot y habilita los slash commands.
export const inviteUrl = 'https://discord.com/oauth2/authorize?client_id=1512125911439376506&permissions=8&scope=bot+applications.commands';

// Clases de color (acento) de cada stat, en el mismo orden que landing.stats.
export const statsAccent = ['text-brand', 'text-emerald-400', 'text-lime-300', 'text-zinc-200'];

// Colores de las barras de prioridad del tile grande de Features (por orden).
export const prioridadBar = ['bg-red-400', 'bg-amber-400', 'bg-brand', 'bg-emerald-400'];

// Comandos de ejemplo (no se traducen: son literales del bot).
export const comandos = ['!sokyo', '!user', '!dado', '!moneda'];
