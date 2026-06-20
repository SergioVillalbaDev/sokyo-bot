// Seguridad · Backup — exporta la configuración del servidor a un archivo JSON
// y restáurala importándolo (útil para mover ajustes entre servidores).
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Upload, Info, Check, AlertTriangle } from 'lucide-react';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';

export default function BackupView({ dash }) {
  const { t } = useTranslation();
  const { configServidor, exportarConfig, importarConfig } = dash;
  const fileRef = useRef(null);
  const [estado, setEstado] = useState(''); // '', 'export-ok', 'import-ok', 'error'

  const exportar = async () => {
    const ok = await exportarConfig();
    setEstado(ok ? 'export-ok' : 'error');
  };

  const elegirArchivo = () => fileRef.current && fileRef.current.click();

  const alSubir = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const texto = await file.text();
      const objeto = JSON.parse(texto);
      if (!window.confirm(t('dashboard.backup_v.confirm'))) { e.target.value = ''; return; }
      const ok = await importarConfig(objeto);
      setEstado(ok ? 'import-ok' : 'error');
    } catch {
      setEstado('error');
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.backup_v.intro')}</p>

      <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-elevated px-4 py-3">
        <Info size={16} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-xs text-muted">{t('dashboard.backup_v.note')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Exportar */}
        <div className={card}>
          <h3 className="flex items-center gap-2 font-bold text-fg"><Download size={18} className="text-brand" /> {t('dashboard.backup_v.exportTitle')}</h3>
          <p className="mt-1 mb-4 text-xs text-muted">{t('dashboard.backup_v.exportDesc')}</p>
          <button
            type="button"
            onClick={exportar}
            disabled={!configServidor}
            className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={16} /> {t('dashboard.backup_v.exportBtn')}
          </button>
        </div>

        {/* Importar */}
        <div className={card}>
          <h3 className="flex items-center gap-2 font-bold text-fg"><Upload size={18} className="text-brand" /> {t('dashboard.backup_v.importTitle')}</h3>
          <p className="mt-1 mb-3 text-xs text-muted">{t('dashboard.backup_v.importDesc')}</p>
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning" />
            <p className="text-xs text-warning">{t('dashboard.backup_v.importWarn')}</p>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={alSubir} className="hidden" />
          <button
            type="button"
            onClick={elegirArchivo}
            disabled={!configServidor}
            className="flex items-center gap-2 rounded-2xl border border-line bg-bg px-5 py-2.5 text-sm font-bold text-fg transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload size={16} /> {t('dashboard.backup_v.importBtn')}
          </button>
        </div>
      </div>

      {estado === 'export-ok' && <p className="flex items-center gap-1.5 text-sm font-semibold text-success"><Check size={16} /> {t('dashboard.backup_v.exported')}</p>}
      {estado === 'import-ok' && <p className="flex items-center gap-1.5 text-sm font-semibold text-success"><Check size={16} /> {t('dashboard.backup_v.imported')}</p>}
      {estado === 'error' && <p className="text-sm font-semibold text-danger">{t('dashboard.backup_v.error')}</p>}
    </div>
  );
}
