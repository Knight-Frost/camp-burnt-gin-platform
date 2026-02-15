import { Link } from 'react-router-dom';
import type { SessionConfig } from '../config/sessions.config';

interface SessionCardProps {
  session: SessionConfig;
}

const AVAILABILITY_CONFIG = {
  open: {
    label: 'Open',
    className: 'bg-success-50 text-success-700 border-success-200 dark:bg-success-900/20 dark:text-success-400 dark:border-success-800',
  },
  limited: {
    label: 'Limited Spots',
    className: 'bg-warning-50 text-warning-700 border-warning-200 dark:bg-warning-900/20 dark:text-warning-400 dark:border-warning-800',
  },
  waitlist: {
    label: 'Join Waitlist',
    className: 'bg-info-50 text-info-700 border-info-200 dark:bg-info-900/20 dark:text-info-400 dark:border-info-800',
  },
  full: {
    label: 'Session Full',
    className: 'bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700',
  },
};

export function SessionCard({ session }: SessionCardProps) {
  const availabilityConfig = AVAILABILITY_CONFIG[session.availability];

  return (
    <div className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-6 shadow-lg transition-all duration-hover hover:shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="font-headline mb-4 text-[1.5rem] font-bold">
        {session.name}
      </h3>

      <div className="font-body mb-6 space-y-2">
        <div className="flex justify-between">
          <span className="text-neutral-600 dark:text-neutral-400">Dates:</span>
          <span className="font-medium text-neutral-900 dark:text-neutral-100">
            {session.dates}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-600 dark:text-neutral-400">Ages:</span>
          <span className="font-medium text-neutral-900 dark:text-neutral-100">
            {session.ageRange} years
          </span>
        </div>
        <div className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
          {session.eligibility}
        </div>
      </div>

      <div className="mb-4">
        <span
          className={`inline-block rounded-full border px-3 py-1 text-sm font-semibold ${availabilityConfig.className}`}
        >
          {availabilityConfig.label}
        </span>
      </div>

      <Link
        to={`/register?session=${session.id}`}
        className={`mt-auto inline-flex items-center justify-center rounded-lg px-6 py-3 font-semibold transition-all duration-hover ${
          session.availability === 'full'
            ? 'cursor-not-allowed bg-neutral-200 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-600'
            : 'bg-brand-600 text-white hover:bg-brand-700'
        }`}
        aria-disabled={session.availability === 'full'}
        onClick={(e) => session.availability === 'full' && e.preventDefault()}
      >
        {session.availability === 'full' ? 'Session Full' : 'Apply for This Session'}
      </Link>
    </div>
  );
}
