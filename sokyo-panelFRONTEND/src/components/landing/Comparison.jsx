// Tabla comparativa vs. los bots de un solo propósito más conocidos. El objetivo
// es dejar claro el ángulo "todo en uno": lo que con Sokyo es un bot, con la
// competencia son tres o cuatro. Comparativa ORIENTATIVA (ver nota al pie).
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Check, Minus, X } from 'lucide-react';

// Columnas (Sokyo siempre primero y destacado). Nombres = literales de marca.
const COLUMNAS = ['Sokyo', 'MEE6', 'Dyno', 'Ticket Tool'];

// Matriz de capacidades por fila, en el mismo orden que COLUMNAS.
// 'si' = incluido · 'lim' = limitado / de pago · 'no' = no es su propósito.
const FILAS = [
  { key: 'todo',       cells: ['si', 'no', 'no', 'no'] },
  { key: 'tickets',    cells: ['si', 'no', 'no', 'si'] },
  { key: 'panel',      cells: ['si', 'lim', 'lim', 'lim'] },
  { key: 'moderacion', cells: ['si', 'lim', 'si', 'no'] },
  { key: 'niveles',    cells: ['si', 'si', 'no', 'no'] },
  { key: 'economia',   cells: ['si', 'no', 'no', 'no'] },
  { key: 'musica',     cells: ['si', 'lim', 'no', 'no'] },
  { key: 'portal',     cells: ['si', 'no', 'no', 'no'] },
];

function Celda({ estado }) {
  if (estado === 'si') return <Check size={18} className="mx-auto text-brand" strokeWidth={3} />;
  if (estado === 'lim') return <Minus size={18} className="mx-auto text-amber-400" strokeWidth={3} />;
  return <X size={16} className="mx-auto text-muted/50" strokeWidth={2.5} />;
}

export default function Comparison() {
  const { t } = useTranslation();
  const rows = t('landing.comparison.rows', { returnObjects: true });

  return (
    <section className="relative mx-auto max-w-5xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-4xl font-extrabold tracking-tight text-fg sm:text-5xl">
          {t('landing.comparison.title')} <span className="text-gradient-brand">{t('landing.comparison.titleHighlight')}</span>
        </h2>
        <p className="mt-4 text-lg text-muted">{t('landing.comparison.subtitle')}</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.5 }}
        className="mt-14 overflow-x-auto"
      >
        <table className="w-full min-w-[560px] border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="w-1/3 px-4 py-3 text-left text-sm font-semibold text-muted"> </th>
              {COLUMNAS.map((col, i) => (
                <th
                  key={col}
                  className={`px-4 py-3 text-center text-sm font-bold ${
                    i === 0
                      ? 'rounded-t-2xl bg-gradient-brand text-on-brand'
                      : 'text-muted'
                  }`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FILAS.map((fila, r) => (
              <tr key={fila.key}>
                <td className="px-4 py-3 text-sm font-medium text-fg/90">{rows[fila.key]}</td>
                {fila.cells.map((estado, c) => (
                  <td
                    key={c}
                    className={`px-4 py-3 ${c === 0 ? 'bg-brand/[0.07] ring-1 ring-inset ring-brand/15' : ''} ${
                      r === FILAS.length - 1 && c === 0 ? 'rounded-b-2xl' : ''
                    }`}
                  >
                    <Celda estado={estado} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      <p className="mt-6 flex items-center justify-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1"><Check size={13} className="text-brand" /> {t('landing.comparison.legendYes')}</span>
        <span className="flex items-center gap-1"><Minus size={13} className="text-amber-400" /> {t('landing.comparison.legendLimited')}</span>
        <span className="flex items-center gap-1"><X size={13} className="text-muted/50" /> {t('landing.comparison.legendNo')}</span>
      </p>
      <p className="mt-3 text-center text-[11px] text-muted/70">{t('landing.comparison.footnote')}</p>
    </section>
  );
}
