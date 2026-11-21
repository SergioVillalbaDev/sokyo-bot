// Quién puede entrar al panel y a qué partes: la MISMA regla que utils/accesoPanel.js del
// bot (calcularAcceso). Aquí se recalcula al momento mientras se cambian los roles en
// Configuración → Acceso al panel, antes de guardar. Si cambias una, cambia la otra.
export const AREAS = ['tickets', 'moderacion', 'entrada', 'roles', 'crecimiento', 'musica', 'mensajes', 'datos', 'logs', 'config', 'cuenta'];

// `concesion`: acceso dado a esa persona { areas, moderar, expiraEn } (1.13.0) o null.
export const concesionVigente = (c, ahora = Date.now()) => !!(c && (!c.expiraEn || new Date(c.expiraEn).getTime() > ahora));

export function calcularAcceso(m, cfg = {}, concesion = null) {
  const roles = new Set(m.roles || []);
  const motivos = [];
  if (m.propietarioBot) motivos.push('propietarioBot');
  if (m.admin) motivos.push('admin');
  if (m.gestionarCanales && !m.admin) motivos.push('gestionarCanales'); // un admin ya lo tiene todo
  if (cfg.rolStaffId && roles.has(cfg.rolStaffId)) motivos.push('rolStaff');
  if ((cfg.rolesPanelAcceso || []).some((id) => roles.has(id))) motivos.push('rolAcceso');
  const dada = concesionVigente(concesion) ? concesion : null;
  if (dada) motivos.push('concedido');
  const acceso = motivos.length > 0;
  const todo = !!(m.propietarioBot || m.admin);
  const areas = {};
  for (const a of AREAS) {
    const lista = (cfg.accesoAreas && cfg.accesoAreas[a]) || [];
    areas[a] = acceso && (todo || lista.length === 0 || lista.some((id) => roles.has(id)) || !!(dada && (dada.areas || []).includes(a)));
  }
  const moderar = acceso && !!(todo || m.moderarNativo || (cfg.rolesModeracion || []).some((id) => roles.has(id)) || (dada && dada.moderar));
  return { acceso, motivos, areas, moderar };
}
