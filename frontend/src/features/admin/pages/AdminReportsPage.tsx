/**
 * AdminReportsPage.tsx
 *
 * Visual analytics dashboard + CSV export.
 * Charts: applications by status, acceptance rate, applications over time, enrollment per session.
 */

import { useState, useEffect, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Download, FileText, Users, CheckCircle, XCircle, Tag, TrendingUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  LineChart, Line,
} from 'recharts';

import { getReportsSummary, downloadReport } from '@/features/admin/api/admin.api';
import type { ReportsSummary } from '@/features/admin/api/admin.api';
import { SkeletonCard } from '@/ui/components/Skeletons';
import { scrollRevealVariants, staggerContainerVariants, staggerChildVariants } from '@/shared/constants/motion';

type ReportType = 'applications' | 'accepted' | 'rejected' | 'mailing-labels' | 'id-labels';

const CHART_COLORS = {
  pending: '#f59e0b',
  under_review: '#3b82f6',
  accepted: '#16a34a',
  rejected: '#dc2626',
  submitted: '#8b5cf6',
};

const EXPORT_REPORTS = [
  { type: 'applications' as ReportType,   label: 'All Applications',   icon: FileText,   color: '#3b82f6' },
  { type: 'accepted' as ReportType,       label: 'Accepted Only',      icon: CheckCircle, color: '#16a34a' },
  { type: 'rejected' as ReportType,       label: 'Rejected Only',      icon: XCircle,    color: '#dc2626' },
  { type: 'mailing-labels' as ReportType, label: 'Mailing Labels',     icon: Users,      color: '#16a34a' },
  { type: 'id-labels' as ReportType,      label: 'ID Labels',          icon: Tag,        color: '#059669' },
];

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      className="rounded-2xl border p-6"
      style={{ background: '#ffffff', borderColor: 'var(--border)' }}
    >
      <h3 className="font-headline font-semibold text-base mb-5" style={{ color: 'var(--foreground)' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

export function AdminReportsPage() {
  const [summary, setSummary]         = useState<ReportsSummary | null>(null);
  const [loading, setLoading]         = useState(true);
  const [downloading, setDownloading] = useState<ReportType | null>(null);

  useEffect(() => {
    getReportsSummary()
      .then(setSummary)
      .catch(() => toast.error('Failed to load report data.'))
      .finally(() => setLoading(false));
  }, []);

  // ── Chart data ───────────────────────────────────────────────────────────────

  const byStatus = summary?.applications_by_status ?? {};
  const statusCounts = [
    { name: 'Submitted',    value: byStatus['submitted']    ?? 0, color: CHART_COLORS.submitted },
    { name: 'Under Review', value: byStatus['under_review'] ?? 0, color: CHART_COLORS.under_review },
    { name: 'Accepted',     value: byStatus['accepted']     ?? 0, color: CHART_COLORS.accepted },
    { name: 'Rejected',     value: byStatus['rejected']     ?? 0, color: CHART_COLORS.rejected },
    { name: 'Pending',      value: byStatus['pending']      ?? 0, color: CHART_COLORS.pending },
  ].filter((s) => s.value > 0);

  const total    = summary?.total_applications ?? 0;
  const accepted = summary?.accepted_applications ?? 0;
  const rejected = summary?.rejected_applications ?? 0;
  const rate     = total > 0 ? Math.round((accepted / total) * 100) : 0;

  const acceptancePieData = [
    { name: 'Accepted', value: accepted,                        color: '#16a34a' },
    { name: 'Rejected', value: rejected,                        color: '#dc2626' },
    { name: 'Pending',  value: Math.max(0, total - accepted - rejected), color: '#e5e7eb' },
  ].filter((d) => d.value > 0);

  const timelineData = (summary?.applications_over_time ?? []).map(({ month, count }) => ({
    month: new Date(`${month}-01`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    count,
  }));

  // Enrollment per session
  const sessionData = (summary?.sessions ?? []).map((s) => ({
    name:     s.name,
    enrolled: s.enrolled,
    capacity: s.capacity,
  })).slice(0, 8);

  async function handleDownload(type: ReportType) {
    setDownloading(type);
    try {
      await downloadReport(type);
      toast.success('Report downloaded successfully.');
    } catch {
      toast.error('Failed to download report.');
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="flex flex-col gap-8 max-w-6xl">

      {/* Header */}
      <motion.div variants={scrollRevealVariants} initial="hidden" animate="visible">
        <p className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: 'var(--ember-orange)' }}>
          Analytics
        </p>
        <h2 className="text-2xl font-headline font-semibold" style={{ color: 'var(--foreground)' }}>
          Reports
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Application statistics, enrollment data, and downloadable exports.
        </p>
      </motion.div>

      {/* Summary stats */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1,2,3,4].map((i) => <SkeletonCard key={i} lines={1} />)}
        </div>
      ) : (
        <motion.div
          variants={staggerContainerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 sm:grid-cols-4 gap-4"
        >
          {[
            { label: 'Campers',  value: summary?.total_campers ?? 0, color: '#3b82f6' },
            { label: 'Accepted', value: accepted,                    color: '#16a34a' },
            { label: 'Rejected', value: rejected,                    color: '#dc2626' },
            { label: 'Rate',     value: `${rate}%`,                  color: '#16a34a' },
          ].map(({ label, value, color }) => (
            <motion.div
              key={label}
              variants={staggerChildVariants}
              className="rounded-2xl border px-5 py-4 flex flex-col gap-1"
              style={{ background: '#ffffff', borderColor: 'var(--border)' }}
            >
              <p className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--muted-foreground)' }}>
                {label}
              </p>
              <p className="text-3xl font-headline font-bold" style={{ color }}>
                {value}
              </p>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Charts grid */}
      {!loading && (
        <motion.div
          variants={staggerContainerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Applications by status — bar */}
          <motion.div variants={staggerChildVariants}>
            <ChartCard title="Applications by Status">
              {statusCounts.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={statusCounts} barSize={36}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <Tooltip
                      contentStyle={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, fontSize: 13 }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {statusCounts.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-center py-12" style={{ color: 'var(--muted-foreground)' }}>No data yet.</p>
              )}
            </ChartCard>
          </motion.div>

          {/* Acceptance rate — pie */}
          <motion.div variants={staggerChildVariants}>
            <ChartCard title="Acceptance Rate">
              {acceptancePieData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="60%" height={220}>
                    <PieChart>
                      <Pie
                        data={acceptancePieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {acceptancePieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, fontSize: 13 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-3">
                    <div className="text-center">
                      <p className="text-3xl font-headline font-bold" style={{ color: '#16a34a' }}>{rate}%</p>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>acceptance rate</p>
                    </div>
                    {acceptancePieData.map((d) => (
                      <div key={d.name} className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.color }} />
                        <span className="text-xs" style={{ color: 'var(--foreground)' }}>{d.name}: {d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-center py-12" style={{ color: 'var(--muted-foreground)' }}>No data yet.</p>
              )}
            </ChartCard>
          </motion.div>

          {/* Applications over time — line */}
          <motion.div variants={staggerChildVariants}>
            <ChartCard title="Applications Over Time">
              {timelineData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <Tooltip
                      contentStyle={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, fontSize: 13 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#16a34a"
                      strokeWidth={2.5}
                      dot={{ fill: '#16a34a', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-center py-12" style={{ color: 'var(--muted-foreground)' }}>No timeline data yet.</p>
              )}
            </ChartCard>
          </motion.div>

          {/* Enrollment per session — bar */}
          <motion.div variants={staggerChildVariants}>
            <ChartCard title="Enrollment per Session">
              {sessionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={sessionData} layout="vertical" barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <Tooltip
                      contentStyle={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, fontSize: 13 }}
                    />
                    <Bar dataKey="capacity" fill="rgba(22,163,74,0.15)" radius={[0, 4, 4, 0]} name="Capacity" />
                    <Bar dataKey="enrolled" fill="#16a34a" radius={[0, 4, 4, 0]} name="Enrolled" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-center py-12" style={{ color: 'var(--muted-foreground)' }}>No session data yet.</p>
              )}
            </ChartCard>
          </motion.div>
        </motion.div>
      )}

      {/* CSV / Excel exports */}
      <motion.div variants={scrollRevealVariants} initial="hidden" animate="visible">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />
          <h3 className="font-headline font-semibold text-base" style={{ color: 'var(--foreground)' }}>
            Export Reports
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {EXPORT_REPORTS.map(({ type, label, icon: Icon, color }) => (
            <button
              key={type}
              onClick={() => handleDownload(type)}
              disabled={!!downloading}
              className="flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all hover:shadow-sm"
              style={{
                background: '#ffffff',
                borderColor: 'var(--border)',
                opacity: downloading && downloading !== type ? 0.6 : 1,
              }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}15` }}
              >
                <Icon className="h-4 w-4" style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{label}</p>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Download CSV</p>
              </div>
              {downloading === type ? (
                <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: color, borderTopColor: 'transparent' }} />
              ) : (
                <Download className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
              )}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
