// Modal para elegir qué servidor gestionar. Se muestra al entrar cuando hay
// varios servidores y aún no se eligió uno en este dispositivo, y también al
// pulsar el servidor activo en la cabecera para cambiarlo.
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { Avatar } from '../ui/primitives';

export default function ServerPicker({ abierto, servidores = [], guildId, onSeleccionar, onCerrar }) {
  // Solo se puede cerrar sin elegir si ya hay un servidor activo (no en el
  // arranque, donde es obligatorio elegir uno para poder usar el panel).
  const puedeCerrar = !!guildId;

  return (
    <AnimatePresence>
      {abierto && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => puedeCerrar && onCerrar?.()}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-line bg-card p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-fg">Elige un servidor</h2>
                <p className="mt-0.5 text-sm text-muted">Gestionas varios; elige cuál ver ahora.</p>
              </div>
              {puedeCerrar && (
                <button onClick={onCerrar} aria-label="Cerrar"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-elevated hover:text-fg">
                  <X size={18} />
                </button>
              )}
            </div>

            <div className="max-h-[60vh] space-y-2 overflow-y-auto">
              {servidores.map((s) => {
                const activo = s.id === guildId;
                return (
                  <button key={s.id} onClick={() => onSeleccionar(s.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors ${activo ? 'border-brand bg-brand/10' : 'border-line bg-bg hover:bg-elevated'}`}>
                    <Avatar src={s.icono} name={s.nombre} size={40} />
                    <span className="min-w-0 flex-1 truncate font-semibold text-fg">{s.nombre}</span>
                    {activo && <Check size={18} className="shrink-0 text-brand" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
