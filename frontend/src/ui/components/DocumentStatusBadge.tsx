/**
 * DocumentStatusBadge — single-source-of-truth pill for document lifecycle status.
 *
 * Every page that displays a document state (Document Control Center,
 * Application Review, Applicant Documents, reviewer cards) must render this
 * component so wording and color never drift between surfaces. The previous
 * practice of each page defining its own STATUS_CONFIG table produced the
 * "Pending Review / Uploaded / Submitted" divergence the 2026-04-23 audit
 * flagged.
 *
 * The component is purely presentational: pass a resolved DocumentUIStatus
 * and optionally an i18n `t` function. Resolution (request × document →
 * status) belongs in the page, not here — callers pass the already-resolved
 * status so this component never has to understand request lifecycle.
 */

import { useTranslation } from 'react-i18next';
import {
  DOCUMENT_STATUS_META,
  statusI18nKey,
  type DocumentUIStatus,
} from '@/shared/constants/documentStatuses';

interface Props {
  status: DocumentUIStatus;
  /** Optional className for layout tweaks (e.g. width constraints). */
  className?: string;
  /** Size variant. 'sm' keeps the compact pill used in dense tables. */
  size?: 'sm' | 'md';
}

export function DocumentStatusBadge({ status, className = '', size = 'sm' }: Props) {
  const { t } = useTranslation();
  const meta = DOCUMENT_STATUS_META[status];

  // Defensive fallback: an unknown status value shouldn't crash the UI.
  if (!meta) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${className}`}
        style={{ background: 'rgba(107,114,128,0.10)', color: '#6b7280' }}
      >
        {status}
      </span>
    );
  }

  const Icon = meta.icon;
  const label = t(statusI18nKey(status), meta.label);

  const sizeClasses =
    size === 'md'
      ? 'text-sm px-2.5 py-1'
      : 'text-xs px-2 py-0.5';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap ${sizeClasses} ${className}`}
      style={{ background: meta.bg, color: meta.color }}
      title={label}
    >
      <Icon className={size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3'} />
      {label}
    </span>
  );
}
