/**
 * ParentApplicationsPage.tsx
 * Lists all applications for the current parent's campers.
 * Each row links to application detail. "New Application" CTA at top.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, FileText, ArrowRight, Calendar, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

import { getApplications } from '@/features/parent/api/parent.api';
import type { Application } from '@/shared/types';
import type { CamperInfoValues } from '@/features/parent/schemas/application.schema';
import { ROUTES } from '@/shared/constants/routes';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { EmptyState } from '@/ui/components/EmptyState';
import { ErrorState } from '@/ui/components/EmptyState';
import { SkeletonTable } from '@/ui/components/Skeletons';
import { Button } from '@/ui/components/Button';
import {
  staggerContainerVariants,
  staggerChildVariants,
  cardHoverMotion,
} from '@/shared/constants/motion';

export function ParentApplicationsPage() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true);
    setError(false);
    getApplications()
      .then(setApplications)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-xl font-headline font-semibold"
            style={{ color: 'var(--foreground)' }}
          >
            Applications
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Track the status of your camper applications.
          </p>
        </div>
        <Button as={Link} to={ROUTES.PARENT_APPLICATION_NEW} size="sm">
          <Plus className="h-4 w-4" />
          New application
        </Button>
      </div>

      {/* Content */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.02)',
          borderColor: 'var(--border)',
        }}
      >
        {loading ? (
          <div className="p-4">
            <SkeletonTable rows={5} />
          </div>
        ) : error ? (
          <ErrorState onRetry={load} />
        ) : applications.length === 0 ? (
          <EmptyState
            title="No applications yet"
            description="Submit an application to register a camper for a session."
            icon={FileText}
            action={{
              label: 'Start your first application',
              onClick: () => {},
            }}
          />
        ) : (
          <motion.ul
            variants={staggerContainerVariants}
            initial="hidden"
            animate="visible"
            className="divide-y"
            style={{ borderColor: 'var(--border)' }}
          >
            {applications.map((app) => (
              <motion.li
                key={app.id}
                variants={staggerChildVariants}
                {...cardHoverMotion}
              >
                <div className="flex items-center justify-between gap-4 px-6 py-4">
                  <Link
                    to={ROUTES.PARENT_APPLICATION_DETAIL(app.id)}
                    className="flex items-center gap-4 min-w-0 flex-1 hover:bg-[var(--dash-nav-hover-bg)] rounded-lg transition-colors -mx-2 px-2 py-1"
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(96,165,250,0.1)' }}
                    >
                      <FileText className="h-4 w-4" style={{ color: 'var(--night-sky-blue)' }} />
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: 'var(--foreground)' }}
                      >
                        {app.camper?.full_name ?? `Camper #${app.camper_id}`}
                      </p>
                      <div
                        className="flex items-center gap-2 text-xs mt-0.5"
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        <Calendar className="h-3 w-3" />
                        <span>
                          {app.session?.name ?? `Session #${app.session_id}`}
                        </span>
                        {app.submitted_at && (
                          <>
                            <span aria-hidden="true">&middot;</span>
                            <span>
                              Submitted {format(new Date(app.submitted_at), 'MMM d, yyyy')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge status={app.status} />
                    {/* Re-apply button for closed applications */}
                    {(app.status === 'accepted' || app.status === 'rejected') && app.camper && (
                      <button
                        onClick={() =>
                          navigate(ROUTES.PARENT_APPLICATION_NEW, {
                            state: {
                              prefill: {
                                first_name:    app.camper!.first_name,
                                last_name:     app.camper!.last_name,
                                date_of_birth: app.camper!.date_of_birth,
                                gender:        app.camper!.gender as CamperInfoValues['gender'],
                                tshirt_size:   app.camper!.tshirt_size as CamperInfoValues['tshirt_size'],
                              } satisfies Partial<CamperInfoValues>,
                            },
                          })
                        }
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors hover:border-[var(--ember-orange)]"
                        style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                        title="Re-apply with same camper info"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Re-apply
                      </button>
                    )}
                    <Link to={ROUTES.PARENT_APPLICATION_DETAIL(app.id)}>
                      <ArrowRight
                        className="h-4 w-4"
                        style={{ color: 'var(--muted-foreground)' }}
                      />
                    </Link>
                  </div>
                </div>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </div>
    </div>
  );
}
