import { BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { openGuide, selectGuideOpen } from '@/features/guides';

export function GuideButton() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const open = useAppSelector(selectGuideOpen);

  return (
    <button
      type="button"
      onClick={() => dispatch(openGuide({ mode: 'page' }))}
      className="p-2 rounded-xl transition-colors"
      style={{ color: 'var(--muted-foreground)' }}
      aria-label={t('guide.open_button_aria')}
      aria-expanded={open}
      data-guide-anchor="header.help-button"
    >
      <BookOpen className="h-5 w-5" />
    </button>
  );
}
