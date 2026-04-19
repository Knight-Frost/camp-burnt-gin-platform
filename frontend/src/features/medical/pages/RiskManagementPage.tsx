/**
 * RiskManagementPage.tsx
 *
 * Medical staff interface for configuring the dynamic risk scoring engine.
 *
 * Three tabs:
 *  1. Risk Factors — individual conditions and their point values
 *  2. Scoring Rules — conditional bonus rules (IF a AND b THEN +N)
 *  3. Thresholds — supervision level and complexity tier score boundaries
 *
 * Route: /medical/risk-management
 */

import { useState, useEffect } from 'react';
import {
  ShieldAlert, Sliders, Zap, ChevronDown, ChevronUp,
  Save, AlertTriangle, Info, Check, X, Plus, Trash2,
} from 'lucide-react';
import {
  getRiskFactors, updateRiskFactor,
  getRiskRules, updateRiskRule, deleteRiskRule,
  getRiskThresholds, updateRiskThreshold,
  type RiskFactor, type RiskRule, type RiskThreshold,
} from '@/features/medical/api/medical.api';
import { toast } from 'sonner';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';

// Shared error handler so a 403 (medical role trying to write) surfaces a
// clear message instead of looking like a silent no-op. Other errors fall
// back to a generic save-failed toast with the server message if present.
function handleSaveError(err: unknown, actionDescription: string): void {
  const e = err as { status?: number; message?: string };
  if (e?.status === 403 || e?.message?.toLowerCase().includes('permission')) {
    toast.error('You do not have permission to modify risk configuration.');
    return;
  }
  toast.error(e?.message ?? `Failed to ${actionDescription}. Please try again.`);
}

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = 'factors' | 'rules' | 'thresholds';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'factors', label: 'Risk Factors', icon: <ShieldAlert className="h-4 w-4" /> },
  { id: 'rules', label: 'Scoring Rules', icon: <Zap className="h-4 w-4" /> },
  { id: 'thresholds', label: 'Thresholds', icon: <Sliders className="h-4 w-4" /> },
];

const CATEGORY_LABELS: Record<string, string> = {
  medical: 'Medical',
  behavioral: 'Behavioral',
  physical: 'Physical',
  feeding: 'Feeding',
  allergy: 'Allergy',
};

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  medical: { bg: 'rgba(220,38,38,0.08)', color: '#dc2626' },
  behavioral: { bg: 'rgba(37,99,235,0.08)', color: '#2563eb' },
  physical: { bg: 'rgba(5,150,105,0.08)', color: '#059669' },
  feeding: { bg: 'rgba(217,119,6,0.08)', color: '#d97706' },
  allergy: { bg: 'rgba(124,58,237,0.08)', color: '#7c3aed' },
};

// ─── Risk Factors tab ─────────────────────────────────────────────────────────

function RiskFactorsTab() {
  const [factorsByCategory, setFactorsByCategory] = useState<Record<string, RiskFactor[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [editingPoints, setEditingPoints] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState<string[]>([]);
  const [saved, setSaved] = useState<number | null>(null);

  useEffect(() => {
    getRiskFactors()
      .then(setFactorsByCategory)
      .catch(() => setError('Failed to load risk factors.'))
      .finally(() => setLoading(false));
  }, []);

  const toggleCategory = (cat: string) =>
    setExpanded((prev) => prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]);

  const handlePointsChange = (factor: RiskFactor, value: string) =>
    setEditingPoints((prev) => ({ ...prev, [factor.id]: value }));

  const handleSaveFactor = async (factor: RiskFactor) => {
    const rawValue = editingPoints[factor.id];
    if (rawValue === undefined) return;

    const points = parseInt(rawValue, 10);
    if (isNaN(points) || points < 0 || points > 100) return;

    setSaving(factor.id);
    try {
      const updated = await updateRiskFactor(factor.id, { points });
      setFactorsByCategory((prev) => {
        const next = { ...prev };
        next[factor.category] = (next[factor.category] ?? []).map((f) =>
          f.id === updated.id ? updated : f
        );
        return next;
      });
      setEditingPoints((prev) => { const n = { ...prev }; delete n[factor.id]; return n; });
      setSaved(factor.id);
      setTimeout(() => setSaved(null), 2000);
    } catch (err) {
      handleSaveError(err, 'save factor points');
    } finally {
      setSaving(null);
    }
  };

  const handleToggleActive = async (factor: RiskFactor) => {
    setSaving(factor.id);
    try {
      const updated = await updateRiskFactor(factor.id, { is_active: !factor.is_active });
      setFactorsByCategory((prev) => {
        const next = { ...prev };
        next[factor.category] = (next[factor.category] ?? []).map((f) =>
          f.id === updated.id ? updated : f
        );
        return next;
      });
    } catch (err) {
      handleSaveError(err, 'toggle factor');
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="space-y-3">{[1,2,3].map((i) => <Skeletons.Card key={i} />)}</div>;
  if (error) return <EmptyState title="Error" description={error} />;

  const categories = Object.keys(factorsByCategory);

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl px-4 py-3 flex gap-3"
        style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.18)' }}
      >
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#2563eb' }} />
        <p className="text-xs" style={{ color: 'var(--foreground)' }}>
          Adjust point values and enable/disable factors below. Changes take effect on the next risk assessment calculation.
          Factor detection logic (which clinical conditions trigger each factor) remains in the system code.
        </p>
      </div>

      {categories.map((category) => {
        const factors = factorsByCategory[category] ?? [];
        const isExpanded = expanded.includes(category);
        const colors = CATEGORY_COLORS[category] ?? { bg: 'var(--muted)', color: 'var(--muted-foreground)' };

        return (
          <div key={category} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
              style={{ background: 'var(--glass-medium)' }}
            >
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={colors}
              >
                {CATEGORY_LABELS[category] ?? category}
              </span>
              <span className="flex-1 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                {factors.length} factors
              </span>
              {isExpanded ? <ChevronUp className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                : <ChevronDown className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />}
            </button>

            {isExpanded && (
              <div className="border-t divide-y" style={{ borderColor: 'var(--border)' }}>
                {factors.map((factor) => {
                  const currentPoints = editingPoints[factor.id] ?? String(factor.points);
                  const isDirty = editingPoints[factor.id] !== undefined;
                  const isSavingThis = saving === factor.id;
                  const wasSaved = saved === factor.id;

                  return (
                    <div
                      key={factor.id}
                      className="px-4 py-3 flex items-start gap-4"
                      style={{
                        background: factor.is_active ? 'var(--card)' : 'rgba(0,0,0,0.02)',
                        opacity: factor.is_active ? 1 : 0.6,
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{factor.label}</p>
                        {factor.tooltip && (
                          <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--muted-foreground)' }}>{factor.tooltip}</p>
                        )}
                        {factor.per_item && (
                          <span className="text-xs mt-1 inline-block px-1.5 py-0.5 rounded" style={{ background: 'rgba(37,99,235,0.08)', color: '#2563eb' }}>
                            Points × count
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Points input */}
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={currentPoints}
                            onChange={(e) => handlePointsChange(factor, e.target.value)}
                            className="w-16 rounded-lg border px-2 py-1 text-sm text-center outline-none focus:ring-2 focus:ring-[var(--ember-orange)]/40"
                            style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                          />
                          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>pts</span>
                        </div>

                        {/* Save button */}
                        {isDirty && (
                          <button
                            onClick={() => handleSaveFactor(factor)}
                            disabled={isSavingThis}
                            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                            style={{ color: 'var(--ember-orange)' }}
                            title="Save points"
                          >
                            {isSavingThis ? <span className="text-xs">…</span> : <Save className="h-3.5 w-3.5" />}
                          </button>
                        )}
                        {wasSaved && !isDirty && <Check className="h-3.5 w-3.5" style={{ color: 'var(--ember-orange)' }} />}

                        {/* Active toggle */}
                        <button
                          onClick={() => handleToggleActive(factor)}
                          disabled={isSavingThis}
                          className="p-1.5 rounded-lg transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                          style={{ color: factor.is_active ? 'var(--ember-orange)' : 'var(--muted-foreground)' }}
                          title={factor.is_active ? 'Disable factor' : 'Enable factor'}
                        >
                          {factor.is_active ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Scoring Rules tab ────────────────────────────────────────────────────────

function ScoringRulesTab() {
  const [rules, setRules] = useState<RiskRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewRule, setShowNewRule] = useState(false);
  const [saving] = useState(false);
  const [newRule, setNewRule] = useState({ name: '', description: '', points_adjustment: 5, is_active: true });

  useEffect(() => {
    getRiskRules()
      .then(setRules)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleToggleRule = async (rule: RiskRule) => {
    try {
      const updated = await updateRiskRule(rule.id, { is_active: !rule.is_active });
      setRules((prev) => prev.map((r) => r.id === updated.id ? updated : r));
    } catch (err) {
      handleSaveError(err, 'toggle rule');
    }
  };

  const handleDeleteRule = async (rule: RiskRule) => {
    if (!confirm(`Delete rule "${rule.name}"?`)) return;
    try {
      await deleteRiskRule(rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
    } catch (err) {
      handleSaveError(err, 'delete rule');
    }
  };

  if (loading) return <Skeletons.Card />;

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl px-4 py-3 flex gap-3"
        style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.18)' }}
      >
        <Zap className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#7c3aed' }} />
        <p className="text-xs" style={{ color: 'var(--foreground)' }}>
          Conditional rules add bonus points when multiple factors are present simultaneously.
          Example: Seizures + Life-threatening allergy = additional +5 points for combined clinical complexity.
        </p>
      </div>

      {rules.length === 0 ? (
        <EmptyState title="No conditional rules" description="Add a rule to define bonus scoring for factor combinations." />
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="rounded-xl border p-4 flex items-start gap-4"
              style={{
                borderColor: rule.is_active ? 'rgba(124,58,237,0.30)' : 'var(--border)',
                background: rule.is_active ? 'rgba(124,58,237,0.03)' : 'var(--glass-light)',
                opacity: rule.is_active ? 1 : 0.65,
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{rule.name}</p>
                {rule.description && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{rule.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {rule.conditions.map((c, i) => (
                    <span key={i} className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--foreground)' }}>
                      {c.present ? '✓ ' : '✗ '}{c.factor_key}
                    </span>
                  ))}
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(124,58,237,0.10)', color: '#7c3aed' }}>
                    {rule.points_adjustment > 0 ? '+' : ''}{rule.points_adjustment} pts
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleToggleRule(rule)}
                  className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)]"
                  style={{ color: rule.is_active ? '#7c3aed' : 'var(--muted-foreground)' }}
                  title={rule.is_active ? 'Disable' : 'Enable'}
                >
                  {rule.is_active ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => handleDeleteRule(rule)}
                  className="p-1.5 rounded-lg hover:bg-red-50"
                  style={{ color: 'var(--destructive)' }}
                  title="Delete rule"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setShowNewRule((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-dashed transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
        style={{ color: 'var(--ember-orange)', borderColor: 'var(--ember-orange)' }}
      >
        <Plus className="h-4 w-4" />
        Add Rule
      </button>

      {showNewRule && (
        <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>New Conditional Rule</p>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            To create a rule with complex conditions, contact your system administrator to configure via the API.
            Simple rules can be added here.
          </p>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ember-orange)]/40"
            style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            placeholder="Rule name"
            value={newRule.name}
            onChange={(e) => setNewRule((p) => ({ ...p, name: e.target.value }))}
          />
          <textarea
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ember-orange)]/40 resize-none"
            style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            placeholder="Description (clinical rationale)"
            rows={2}
            value={newRule.description}
            onChange={(e) => setNewRule((p) => ({ ...p, description: e.target.value }))}
          />
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Contact your administrator to configure factor conditions for this rule after creation.
          </p>
          <button
            disabled={!newRule.name || saving}
            onClick={() => {}}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
            style={{ background: 'var(--ember-orange)' }}
          >
            Contact Administrator to Configure
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Thresholds tab ───────────────────────────────────────────────────────────

function ThresholdsTab() {
  const [thresholds, setThresholds] = useState<Record<string, RiskThreshold[]>>({});
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ min_score: string; max_score: string; staffing_ratio: string }>({ min_score: '', max_score: '', staffing_ratio: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);

  useEffect(() => {
    getRiskThresholds()
      .then(setThresholds)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const startEdit = (t: RiskThreshold) => {
    setEditingId(t.id);
    setEditForm({
      min_score: String(t.min_score),
      max_score: t.max_score !== null ? String(t.max_score) : '',
      staffing_ratio: t.staffing_ratio ?? '',
    });
  };

  const handleSave = async (threshold: RiskThreshold) => {
    setSaving(true);
    try {
      const payload: { min_score?: number; max_score?: number | null; staffing_ratio?: string } = {
        min_score: parseInt(editForm.min_score, 10),
      };
      if (editForm.max_score !== '') {
        payload.max_score = parseInt(editForm.max_score, 10);
      } else {
        payload.max_score = null;
      }
      if (editForm.staffing_ratio) payload.staffing_ratio = editForm.staffing_ratio;

      const updated = await updateRiskThreshold(threshold.id, payload);
      setThresholds((prev) => {
        const next = { ...prev };
        next[threshold.threshold_type] = (next[threshold.threshold_type] ?? [])
          .map((t) => t.id === updated.id ? updated : t);
        return next;
      });
      setEditingId(null);
      setSaved(threshold.id);
      setTimeout(() => setSaved(null), 2000);
    } catch (err) {
      handleSaveError(err, 'save threshold');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Skeletons.Card />;

  const typeLabels: Record<string, string> = {
    supervision: 'Supervision Levels',
    complexity: 'Medical Complexity Tiers',
  };

  return (
    <div className="space-y-6">
      <div
        className="rounded-xl px-4 py-3 flex gap-3"
        style={{ background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.18)' }}
      >
        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--ember-orange)' }} />
        <p className="text-xs" style={{ color: 'var(--foreground)' }}>
          <strong>Caution:</strong> Raising thresholds relaxes supervision requirements. Lowering them increases them.
          Any change affects ALL future risk assessments. Consult your medical director before modifying.
        </p>
      </div>

      {Object.entries(thresholds).map(([type, levels]) => (
        <div key={type}>
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>{typeLabels[type] ?? type}</p>
          <div className="space-y-3">
            {levels.map((threshold) => {
              const isEditing = editingId === threshold.id;
              const wasSaved = saved === threshold.id;

              return (
                <div
                  key={threshold.id}
                  className="rounded-xl border p-4"
                  style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{threshold.label}</p>
                      {threshold.intervention_description && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{threshold.intervention_description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {wasSaved && <Check className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />}
                      {!isEditing && (
                        <button
                          onClick={() => startEdit(threshold)}
                          className="text-xs px-2 py-1 rounded-lg border hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
                          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>

                  {!isEditing ? (
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(22,163,74,0.10)', color: 'var(--ember-orange)' }}>
                        Score {threshold.min_score}–{threshold.max_score ?? '∞'}
                      </span>
                      {threshold.staffing_ratio && (
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          Ratio: {threshold.staffing_ratio}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-end gap-3 mt-3 flex-wrap">
                      <div>
                        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                        <label className="text-xs mb-1 block" style={{ color: 'var(--muted-foreground)' }}>Min Score</label>
                        <input
                          type="number" min={0} max={100}
                          value={editForm.min_score}
                          onChange={(e) => setEditForm((p) => ({ ...p, min_score: e.target.value }))}
                          className="w-20 rounded-lg border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ember-orange)]/40"
                          style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                        />
                      </div>
                      <div>
                        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                        <label className="text-xs mb-1 block" style={{ color: 'var(--muted-foreground)' }}>Max Score (blank = unlimited)</label>
                        <input
                          type="number" min={0} max={100}
                          value={editForm.max_score}
                          onChange={(e) => setEditForm((p) => ({ ...p, max_score: e.target.value }))}
                          className="w-24 rounded-lg border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ember-orange)]/40"
                          style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                        />
                      </div>
                      {threshold.threshold_type === 'supervision' && (
                        <div>
                          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                          <label className="text-xs mb-1 block" style={{ color: 'var(--muted-foreground)' }}>Staffing Ratio</label>
                          <input
                            type="text"
                            value={editForm.staffing_ratio}
                            onChange={(e) => setEditForm((p) => ({ ...p, staffing_ratio: e.target.value }))}
                            placeholder="e.g. 1:3"
                            className="w-24 rounded-lg border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ember-orange)]/40"
                            style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                          />
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(threshold)}
                          disabled={saving}
                          className="px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
                          style={{ background: 'var(--ember-orange)' }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 rounded-lg text-sm border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                          style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RiskManagementPage() {
  const [activeTab, setActiveTab] = useState<Tab>('factors');

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <ShieldAlert className="h-6 w-6" style={{ color: 'var(--ember-orange)' }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Risk Management</h1>
        </div>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Configure the dynamic risk scoring engine. Changes affect all future camper risk assessments.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--glass-medium)' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={
              activeTab === tab.id
                ? { background: 'var(--card)', color: 'var(--ember-orange)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                : { color: 'var(--muted-foreground)' }
            }
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'factors' && <RiskFactorsTab />}
      {activeTab === 'rules' && <ScoringRulesTab />}
      {activeTab === 'thresholds' && <ThresholdsTab />}
    </div>
  );
}
