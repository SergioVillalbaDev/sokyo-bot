// Vista de módulos del bot — placeholder "próximamente".
import { useTranslation } from 'react-i18next';
import { Plug } from 'lucide-react';
import { Card } from '../../ui/primitives';

export default function ModulesView() {
  const { t } = useTranslation();
  return (
    <Card className="flex flex-col items-center justify-center p-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/15 text-brand">
        <Plug size={30} />
      </div>
      <h2 className="mt-5 text-xl font-bold text-fg">{t('dashboard.modules_v.title')}</h2>
      <p className="mt-1 text-sm text-muted">{t('dashboard.modules_v.subtitle')}</p>
      <span className="mt-5 rounded-lg bg-brand/10 px-4 py-2 text-sm font-bold text-brand">{t('dashboard.modules_v.soon')}</span>
    </Card>
  );
}
