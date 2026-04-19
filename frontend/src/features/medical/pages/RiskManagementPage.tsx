/**
 * RiskManagementPage.tsx
 *
 * Clinical configuration interface for the risk scoring engine.
 * Medical staff and administrators can configure:
 *   - Risk Factors: point values and enable/disable state per condition
 *   - Scoring Rules: conditional bonus rules with a full condition builder
 *   - Thresholds: supervision level and complexity tier score boundaries
 *
 * Routes: /medical/risk-management  /admin/risk-management
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert, Sliders, Zap, ChevronDown, ChevronUp,
  Save, AlertTriangle, Info, Check, X, Plus, Trash2, Eye,
  Activity, HelpCircle,
} from 'lucide-react';
import {
  getRiskFactors, updateRiskFactor,
  getRiskRules, updateRiskRule, deleteRiskRule, createRiskRule,
  getRiskThresholds, updateRiskThreshold,
  type RiskFactor, type RiskRule, type RiskThreshold,
} from '@/features/medical/api/medical.api';
import { toast } from 'sonner';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';

// ─── Error handling ───────────────────────────────────────────────────────────

function handleSaveError(err: unknown, actionDescription: string): void {
  const e = err as { status?: number; message?: string };
  if (e?.status === 403 || e?.message?.toLowerCase().includes('permission')) {
    toast.error('You do not have permission to modify risk configuration.');
    return;
  }
  toast.error(e?.message ?? `Failed to ${actionDescription}. Please try again.`);
}

// ─── Detection descriptions — plain English for each factor key ───────────────

const DETECTION_DESCRIPTIONS: Record<string, string> = {
  seizures:               'Reads: Medical Record → "Has Seizures" checkbox',
  neurostimulator:        'Reads: Medical Record → "Has Neurostimulator" checkbox',
  life_threatening_allergy: 'Reads: Allergies list → any allergy marked Life-Threatening severity',
  g_tube:                 'Reads: Feeding Plan → "G-Tube" checkbox',
  special_diet:           'Reads: Feeding Plan → "Special Diet" checkbox',
  one_to_one_required:    'Reads: Behavioral Profile → "One-to-One Supervision Required" checkbox',
  wandering_risk:         'Reads: Behavioral Profile → "Wandering Risk" checkbox',
  aggression:             'Reads: Behavioral Profile → "Aggression" checkbox',
  self_abuse:             'Reads: Behavioral Profile → "Self-Injurious Behavior" checkbox',
  developmental_delay:    'Reads: Behavioral Profile → "Developmental Delay" checkbox',
  transfer_assistance:    'Reads: Assistive Devices → any device with "Requires Transfer Assistance" checked',
  cpap_bipap:             'Reads: Assistive Devices → any device named CPAP or BiPAP',
  severe_diagnosis:       'Reads: Diagnoses list → count of diagnoses marked Severe severity (points × count)',
  moderate_diagnosis:     'Reads: Diagnoses list → count of diagnoses marked Moderate severity (points × count)',
};

// ─── Tab setup ────────────────────────────────────────────────────────────────

type Tab = 'factors' | 'rules' | 'thresholds';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'factors',    label: 'Risk Factors',  icon: <ShieldAlert className="h-4 w-4" /> },
  { id: 'rules',      label: 'Scoring Rules', icon: <Zap className="h-4 w-4" /> },
  { id: 'thresholds', label: 'Thresholds',    icon: <Sliders className="h-4 w-4" /> },
];

const CATEGORY_LABELS: Record<string, string> = {
  medical:    'Medical',
  behavioral: 'Behavioral',
  physical:   'Physical',
  feeding:    'Feeding',
  allergy:    'Allergy',
};

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  medical:    { bg: 'rgba(220,38,38,0.08)',  color: '#dc2626' },
  behavioral: { bg: 'rgba(37,99,235,0.08)',  color: '#2563eb' },
  physical:   { bg: 'rgba(5,150,105,0.08)',  color: '#059669' },
  feeding:    { bg: 'rgba(217,119,6,0.08)',  color: '#d97706' },
  allergy:    { bg: 'rgba(124,58,237,0.08)', color: '#7c3aed' },
};

// ─── Risk Factors Tab ─────────────────────────────────────────────────────────

function RiskFactorsTab() {
  const [factorsByCategory, setFactorsByCategory] = useState<Record<string, RiskFactor[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [saving, setSaving]   = useState<number | null>(null);
  const [editingPoints, setEditingPoints] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState<string[]>([]);
  const [saved, setSaved]     = useState<number | null>(null);

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
    if (isNaN(points) || points < 0 || points > 100) {
      toast.error('Points must be between 0 and 100.');
      return;
    }
    setSaving(factor.id);
    try {
      const updated = await updateRiskFactor(factor.id, { points });
      setFactorsByCategory((prev) => {
        const next = { ...prev };
        next[factor.category] = (next[factor.category] ?? []).map((f) => f.id === updated.id ? updated : f);
        return next;
      });
      setEditingPoints((prev) => { const n = { ...prev }; delete n[factor.id]; return n; });
      setSaved(factor.id);
      setTimeout(() => setSaved(null), 2000);
      toast.success(`"${factor.label}" updated to ${points} pts.`);
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
        next[factor.category] = (next[factor.category] ?? []).map((f) => f.id === updated.id ? updated : f);
        return next;
      });
      toast.success(`"${factor.label}" ${updated.is_active ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      handleSaveError(err, 'toggle factor');
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="space-y-3">{[1,2,3].map((i) => <Skeletons.Card key={i} />)}</div>;
  if (error)   return <EmptyState title="Error" description={error} />;

  const categories = Object.keys(factorsByCategory);
  const totalActive = Object.values(factorsByCategory).flat().filter(f => f.is_active && f.points > 0).length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-4 text-sm flex-wrap">
        <span style={{ color: 'var(--muted-foreground)' }}>
          {totalActive} scored factors active across {categories.length} categories
        </span>
      </div>

      {/* Info banner */}
      <div
        className="rounded-xl px-4 py-3 flex gap-3"
        style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.18)' }}
      >
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#2563eb' }} />
        <div>
          <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--foreground)' }}>How risk factors work</p>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Each factor reads a specific field from the camper's medical record. When that condition is present,
            the factor's point value is added to the camper's total risk score. Set a factor to 0 pts to treat it
            as informational only (still flagged, no score impact). Disable a factor to exclude it from scoring entirely.
          </p>
        </div>
      </div>

      {categories.map((category) => {
        const factors   = factorsByCategory[category] ?? [];
        const isExpanded = expanded.includes(category);
        const colors    = CATEGORY_COLORS[category] ?? { bg: 'var(--muted)', color: 'var(--muted-foreground)' };
        const activeCount = factors.filter(f => f.is_active).length;

        return (
          <div key={category} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
              style={{ background: 'var(--glass-medium)' }}
            >
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={colors}>
                {CATEGORY_LABELS[category] ?? category}
              </span>
              <span className="flex-1 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                {activeCount} of {factors.length} active
              </span>
              {isExpanded
                ? <ChevronUp className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                : <ChevronDown className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />}
            </button>

            {isExpanded && (
              <div className="border-t divide-y" style={{ borderColor: 'var(--border)' }}>
                {factors.map((factor) => {
                  const currentPoints = editingPoints[factor.id] ?? String(factor.points);
                  const isDirty       = editingPoints[factor.id] !== undefined;
                  const isSavingThis  = saving === factor.id;
                  const wasSaved      = saved === factor.id;
                  const detectionDesc = DETECTION_DESCRIPTIONS[factor.key];

                  return (
                    <div
                      key={factor.id}
                      className="px-4 py-3 flex items-start gap-4"
                      style={{
                        background: factor.is_active ? 'var(--card)' : 'rgba(0,0,0,0.015)',
                        opacity: factor.is_active ? 1 : 0.55,
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{factor.label}</p>
                        {/* Detection source — plain English */}
                        {detectionDesc && (
                          <p className="text-xs mt-0.5" style={{ color: '#2563eb' }}>
                            {detectionDesc}
                          </p>
                        )}
                        {factor.tooltip && (
                          <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--muted-foreground)' }}>
                            {factor.tooltip}
                          </p>
                        )}
                        {factor.per_item && (
                          <span className="text-xs mt-1 inline-block px-1.5 py-0.5 rounded" style={{ background: 'rgba(37,99,235,0.08)', color: '#2563eb' }}>
                            Points × count (per occurrence)
                          </span>
                        )}
                        {!factor.is_active && (
                          <span className="text-xs mt-1 inline-block px-1.5 py-0.5 rounded" style={{ background: 'rgba(107,114,128,0.1)', color: '#6b7280' }}>
                            Disabled — excluded from scoring
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
                            disabled={!factor.is_active}
                            className="w-16 rounded-lg border px-2 py-1 text-sm text-center outline-none focus:ring-2 focus:ring-[var(--ember-orange)]/40 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: 'var(--input)', borderColor: isDirty ? 'var(--ember-orange)' : 'var(--border)', color: 'var(--foreground)' }}
                          />
                          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>pts</span>
                        </div>

                        {/* Save button (only when dirty) */}
                        {isDirty && (
                          <button
                            onClick={() => handleSaveFactor(factor)}
                            disabled={isSavingThis}
                            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                            style={{ color: 'var(--ember-orange)' }}
                            title="Save point change"
                          >
                            {isSavingThis ? <span className="text-xs">…</span> : <Save className="h-3.5 w-3.5" />}
                          </button>
                        )}
                        {wasSaved && !isDirty && <Check className="h-3.5 w-3.5" style={{ color: '#16a34a' }} />}

                        {/* Enable/disable toggle */}
                        <button
                          onClick={() => handleToggleActive(factor)}
                          disabled={isSavingThis}
                          className="p-1.5 rounded-lg transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                          style={{ color: factor.is_active ? 'var(--ember-orange)' : 'var(--muted-foreground)' }}
                          title={factor.is_active ? 'Disable this factor' : 'Enable this factor'}
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

      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
        Detection logic (which data field triggers each factor) is managed by the system and cannot be changed here.
        Contact your administrator if a new clinical condition needs to be tracked.
      </p>
    </div>
  );
}

// ─── Scoring Rules Tab ────────────────────────────────────────────────────────

interface NewRuleForm {
  name: string;
  description: string;
  points_adjustment: number;
  conditions: Array<{ factor_key: string; present: boolean }>;
}

function ScoringRulesTab() {
  const [rules, setRules]           = useState<RiskRule[]>([]);
  const [allFactors, setAllFactors] = useState<RiskFactor[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showNewRule, setShowNewRule] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [newRule, setNewRule]       = useState<NewRuleForm>({
    name: '',
    description: '',
    points_adjustment: 5,
    conditions: [],
  });

  useEffect(() => {
    Promise.all([
      getRiskRules(),
      getRiskFactors(),
    ])
      .then(([rulesList, factorsByCategory]) => {
        setRules(rulesList);
        setAllFactors(Object.values(factorsByCategory).flat());
      })
      .catch(() => toast.error('Failed to load scoring rules.'))
      .finally(() => setLoading(false));
  }, []);

  const handleToggleRule = async (rule: RiskRule) => {
    try {
      const updated = await updateRiskRule(rule.id, { is_active: !rule.is_active });
      setRules((prev) => prev.map((r) => r.id === updated.id ? updated : r));
      toast.success(`Rule "${rule.name}" ${updated.is_active ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      handleSaveError(err, 'toggle rule');
    }
  };

  const handleDeleteRule = async (rule: RiskRule) => {
    if (!confirm(`Delete rule "${rule.name}"? This cannot be undone.`)) return;
    try {
      await deleteRiskRule(rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
      toast.success(`Rule "${rule.name}" deleted.`);
    } catch (err) {
      handleSaveError(err, 'delete rule');
    }
  };

  const addCondition = () =>
    setNewRule((p) => ({
      ...p,
      conditions: [...p.conditions, { factor_key: allFactors[0]?.key ?? '', present: true }],
    }));

  const removeCondition = (idx: number) =>
    setNewRule((p) => ({ ...p, conditions: p.conditions.filter((_, i) => i !== idx) }));

  const updateCondition = (idx: number, patch: Partial<{ factor_key: string; present: boolean }>) =>
    setNewRule((p) => ({
      ...p,
      conditions: p.conditions.map((c, i) => i === idx ? { ...c, ...patch } : c),
    }));

  const handleCreateRule = async () => {
    if (!newRule.name.trim()) { toast.error('Rule name is required.'); return; }
    if (newRule.conditions.length === 0) { toast.error('At least one condition is required.'); return; }
    setSaving(true);
    try {
      const created = await createRiskRule({
        name: newRule.name.trim(),
        description: newRule.description.trim() || null,
        points_adjustment: newRule.points_adjustment,
        conditions: newRule.conditions,
        is_active: true,
      });
      setRules((prev) => [...prev, created]);
      setNewRule({ name: '', description: '', points_adjustment: 5, conditions: [] });
      setShowNewRule(false);
      toast.success(`Rule "${created.name}" created.`);
    } catch (err) {
      handleSaveError(err, 'create rule');
    } finally {
      setSaving(false);
    }
  };

  const factorLabelForKey = useCallback((key: string) =>
    allFactors.find(f => f.key === key)?.label ?? key,
  [allFactors]);

  if (loading) return <Skeletons.Card />;

  return (
    <div className="space-y-4">
      {/* Explanation */}
      <div
        className="rounded-xl px-4 py-3 flex gap-3"
        style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.18)' }}
      >
        <Zap className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#7c3aed' }} />
        <div>
          <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--foreground)' }}>How scoring rules work</p>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            A scoring rule fires when ALL of its conditions are simultaneously true for the same camper,
            adding (or subtracting) bonus points from their total risk score. Use rules to account for combined
            clinical complexity that individual factors can't capture alone — for example,
            "Seizures + Life-threatening allergy" is more complex together than the sum of each factor.
          </p>
        </div>
      </div>

      {/* Existing rules */}
      {rules.length === 0 ? (
        <EmptyState title="No conditional rules" description="Add a rule below to define bonus scoring for factor combinations." />
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="rounded-xl border p-4 flex items-start gap-4"
              style={{
                borderColor: rule.is_active ? 'rgba(124,58,237,0.30)' : 'var(--border)',
                background: rule.is_active ? 'rgba(124,58,237,0.03)' : 'var(--glass-light)',
                opacity: rule.is_active ? 1 : 0.6,
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{rule.name}</p>
                {rule.description && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{rule.description}</p>
                )}
                {/* Conditions in plain English */}
                <div className="mt-2">
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                    Fires when ALL are true:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {rule.conditions.map((c, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-0.5 rounded-lg font-medium"
                        style={{
                          background: c.present ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)',
                          color: c.present ? '#16a34a' : '#dc2626',
                          border: `1px solid ${c.present ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.2)'}`,
                        }}
                      >
                        {c.present ? '✓' : '✗'} {factorLabelForKey(c.factor_key)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-2">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(124,58,237,0.10)', color: '#7c3aed' }}
                  >
                    {rule.points_adjustment > 0 ? `+${rule.points_adjustment}` : rule.points_adjustment} pts added to score
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleToggleRule(rule)}
                  className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)]"
                  style={{ color: rule.is_active ? '#7c3aed' : 'var(--muted-foreground)' }}
                  title={rule.is_active ? 'Disable rule' : 'Enable rule'}
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

      {/* Add rule button */}
      <button
        onClick={() => setShowNewRule((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-dashed transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
        style={{ color: 'var(--ember-orange)', borderColor: 'var(--ember-orange)' }}
      >
        <Plus className="h-4 w-4" />
        {showNewRule ? 'Cancel' : 'Add Conditional Rule'}
      </button>

      {/* New rule form */}
      {showNewRule && (
        <div
          className="rounded-xl border p-5 space-y-4"
          style={{ borderColor: 'rgba(124,58,237,0.3)', background: 'rgba(124,58,237,0.02)' }}
        >
          <p className="text-sm font-semibold" style={{ color: '#7c3aed' }}>New Conditional Rule</p>

          {/* Name */}
          <div className="space-y-1">
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
              Rule Name <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ember-orange)]/40"
              style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              placeholder="e.g. Seizures with Life-Threatening Allergy"
              value={newRule.name}
              onChange={(e) => setNewRule((p) => ({ ...p, name: e.target.value }))}
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
              Clinical Rationale (optional)
            </label>
            <textarea
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ember-orange)]/40 resize-none"
              style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              placeholder="Explain why this combination of factors is clinically significant…"
              rows={2}
              value={newRule.description}
              onChange={(e) => setNewRule((p) => ({ ...p, description: e.target.value }))}
            />
          </div>

          {/* Conditions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                Conditions — rule fires when ALL are true <span style={{ color: '#dc2626' }}>*</span>
              </p>
              <button
                onClick={addCondition}
                disabled={allFactors.length === 0}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] disabled:opacity-50"
                style={{ color: '#7c3aed' }}
              >
                <Plus className="h-3 w-3" /> Add Condition
              </button>
            </div>

            {newRule.conditions.length === 0 && (
              <p className="text-xs py-2 text-center rounded-lg" style={{ background: 'rgba(0,0,0,0.02)', color: 'var(--muted-foreground)' }}>
                Click "Add Condition" to define when this rule fires.
              </p>
            )}

            {newRule.conditions.map((cond, idx) => (
              <div key={idx} className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                  {idx === 0 ? 'IF' : 'AND'}
                </span>

                {/* Factor selector */}
                <select
                  value={cond.factor_key}
                  onChange={(e) => updateCondition(idx, { factor_key: e.target.value })}
                  className="flex-1 rounded-lg border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ember-orange)]/40"
                  style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  {allFactors.map((f) => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>

                {/* Present/absent toggle */}
                <select
                  value={cond.present ? 'present' : 'absent'}
                  onChange={(e) => updateCondition(idx, { present: e.target.value === 'present' })}
                  className="rounded-lg border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ember-orange)]/40"
                  style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  <option value="present">is present</option>
                  <option value="absent">is absent</option>
                </select>

                <button
                  onClick={() => removeCondition(idx)}
                  className="p-1 rounded hover:bg-red-50"
                  style={{ color: 'var(--destructive)' }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Points adjustment */}
          <div className="space-y-1">
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
              Points to Add (negative to subtract) <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={-50}
                max={50}
                value={newRule.points_adjustment}
                onChange={(e) => setNewRule((p) => ({ ...p, points_adjustment: parseInt(e.target.value, 10) || 0 }))}
                className="w-24 rounded-lg border px-3 py-2 text-sm text-center outline-none focus:ring-2 focus:ring-[var(--ember-orange)]/40"
                style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              />
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                pts added to score when rule fires
                {newRule.points_adjustment > 0 && <> (bonus +{newRule.points_adjustment})</>}
                {newRule.points_adjustment < 0 && <> (reduction {newRule.points_adjustment})</>}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => { setShowNewRule(false); setNewRule({ name: '', description: '', points_adjustment: 5, conditions: [] }); }}
              className="px-3 py-1.5 rounded-lg text-sm border hover:bg-[var(--dash-nav-hover-bg)]"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              Cancel
            </button>
            <button
              disabled={!newRule.name.trim() || newRule.conditions.length === 0 || saving}
              onClick={handleCreateRule}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
              style={{ background: '#7c3aed' }}
            >
              {saving ? 'Creating…' : 'Create Rule'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Thresholds Tab ───────────────────────────────────────────────────────────

interface ImpactState {
  thresholdId: number;
  count: number | null;
  loading: boolean;
}

function ThresholdsTab() {
  const [thresholds, setThresholds] = useState<Record<string, RiskThreshold[]>>({});
  const [loading, setLoading]       = useState(true);
  const [editingId, setEditingId]   = useState<number | null>(null);
  const [editForm, setEditForm]     = useState<{ min_score: string; max_score: string; staffing_ratio: string; label: string; intervention_description: string }>({
    min_score: '', max_score: '', staffing_ratio: '', label: '', intervention_description: '',
  });
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState<number | null>(null);
  const [impact, setImpact]         = useState<ImpactState | null>(null);

  useEffect(() => {
    getRiskThresholds()
      .then(setThresholds)
      .catch(() => toast.error('Failed to load thresholds.'))
      .finally(() => setLoading(false));
  }, []);

  const startEdit = (t: RiskThreshold) => {
    setEditingId(t.id);
    setEditForm({
      min_score: String(t.min_score),
      max_score: t.max_score !== null ? String(t.max_score) : '',
      staffing_ratio: t.staffing_ratio ?? '',
      label: t.label,
      intervention_description: t.intervention_description ?? '',
    });
    setImpact(null);
  };

  const fetchImpact = async (id: number) => {
    const min = parseInt(editForm.min_score, 10);
    const max = editForm.max_score !== '' ? parseInt(editForm.max_score, 10) : null;
    if (isNaN(min)) return;

    setImpact({ thresholdId: id, count: null, loading: true });
    try {
      const params = new URLSearchParams({ min_score: String(min) });
      if (max !== null) params.append('max_score', String(max));
      const resp = await fetch(`/api/risk-thresholds/impact?${params}`, {
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem('auth_token') ?? ''}`,
          Accept: 'application/json',
        },
      });
      const body = await resp.json();
      setImpact({ thresholdId: id, count: body?.data?.affected_camper_count ?? 0, loading: false });
    } catch {
      setImpact({ thresholdId: id, count: null, loading: false });
    }
  };

  const handleSave = async (threshold: RiskThreshold) => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        min_score: parseInt(editForm.min_score, 10),
        max_score: editForm.max_score !== '' ? parseInt(editForm.max_score, 10) : null,
        label: editForm.label.trim() || threshold.label,
      };
      if (threshold.threshold_type === 'supervision' && editForm.staffing_ratio) {
        payload.staffing_ratio = editForm.staffing_ratio;
      }
      if (editForm.intervention_description) {
        payload.intervention_description = editForm.intervention_description;
      }

      const updated = await updateRiskThreshold(threshold.id, payload as Parameters<typeof updateRiskThreshold>[1]);
      setThresholds((prev) => {
        const next = { ...prev };
        next[threshold.threshold_type] = (next[threshold.threshold_type] ?? [])
          .map((t) => t.id === updated.id ? updated : t);
        return next;
      });
      setEditingId(null);
      setImpact(null);
      setSaved(threshold.id);
      setTimeout(() => setSaved(null), 2500);
      toast.success(`"${updated.label}" threshold saved.`);
    } catch (err) {
      handleSaveError(err, 'save threshold');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Skeletons.Card />;

  const typeLabels: Record<string, string> = {
    supervision: 'Supervision Levels',
    complexity:  'Medical Complexity Tiers',
  };

  const typeDescriptions: Record<string, string> = {
    supervision: 'Score ranges that determine the required staff-to-camper ratio for each camper. Raising a boundary reduces the number of campers assigned to enhanced/one-to-one supervision. Lowering it increases assignments.',
    complexity:  'Score ranges that assign overall medical complexity. Used by document compliance rules (e.g. high complexity requires additional documents) and staffing planning.',
  };

  return (
    <div className="space-y-6">
      {/* Caution banner */}
      <div
        className="rounded-xl px-4 py-3 flex gap-3"
        style={{ background: 'rgba(234,88,12,0.06)', border: '1px solid rgba(234,88,12,0.2)' }}
      >
        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#ea580c' }} />
        <div>
          <p className="text-xs font-medium mb-0.5" style={{ color: '#ea580c' }}>Important: System-wide effect</p>
          <p className="text-xs" style={{ color: 'var(--foreground)' }}>
            Threshold changes affect <strong>every future risk assessment</strong>. Raising a boundary (higher minimum score for a level)
            moves campers to lower supervision. Lowering it moves campers to higher supervision.
            Use the "Preview Impact" button to see how many campers a range change would affect before saving.
          </p>
        </div>
      </div>

      {Object.entries(thresholds).map(([type, levels]) => (
        <div key={type}>
          <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--foreground)' }}>{typeLabels[type] ?? type}</p>
          <p className="text-xs mb-3" style={{ color: 'var(--muted-foreground)' }}>{typeDescriptions[type]}</p>

          <div className="space-y-3">
            {levels.map((threshold) => {
              const isEditing = editingId === threshold.id;
              const wasSaved  = saved === threshold.id;
              const thisImpact = impact?.thresholdId === threshold.id ? impact : null;

              return (
                <div
                  key={threshold.id}
                  className="rounded-xl border p-4"
                  style={{ borderColor: isEditing ? 'rgba(234,88,12,0.35)' : 'var(--border)', background: 'var(--card)' }}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{threshold.label}</p>
                      {threshold.intervention_description && !isEditing && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{threshold.intervention_description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {wasSaved && <Check className="h-4 w-4" style={{ color: '#16a34a' }} />}
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
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: 'rgba(22,101,52,0.10)', color: 'var(--ember-orange)' }}
                      >
                        Score {threshold.min_score}–{threshold.max_score ?? '∞'}
                      </span>
                      {threshold.staffing_ratio && (
                        <span className="text-xs font-mono px-2 py-0.5 rounded-lg font-semibold"
                          style={{ background: 'rgba(22,101,52,0.08)', color: '#166534' }}>
                          {threshold.staffing_ratio}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {/* Label */}
                      <div>
                        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                        <label className="text-xs mb-1 block font-semibold" style={{ color: 'var(--muted-foreground)' }}>Level Label</label>
                        <input
                          type="text"
                          value={editForm.label}
                          onChange={(e) => setEditForm((p) => ({ ...p, label: e.target.value }))}
                          className="w-full max-w-xs rounded-lg border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ember-orange)]/40"
                          style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                        />
                      </div>

                      {/* Score range */}
                      <div className="flex items-end gap-3 flex-wrap">
                        <div>
                          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                          <label className="text-xs mb-1 block font-semibold" style={{ color: 'var(--muted-foreground)' }}>Min Score</label>
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
                          <label className="text-xs mb-1 block font-semibold" style={{ color: 'var(--muted-foreground)' }}>Max Score (blank = unlimited)</label>
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
                            <label className="text-xs mb-1 block font-semibold" style={{ color: 'var(--muted-foreground)' }}>Staffing Ratio</label>
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
                      </div>

                      {/* Description */}
                      <div>
                        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                        <label className="text-xs mb-1 block font-semibold" style={{ color: 'var(--muted-foreground)' }}>Description</label>
                        <input
                          type="text"
                          value={editForm.intervention_description}
                          onChange={(e) => setEditForm((p) => ({ ...p, intervention_description: e.target.value }))}
                          placeholder="Brief description of this level's requirements…"
                          className="w-full rounded-lg border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ember-orange)]/40"
                          style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                        />
                      </div>

                      {/* Impact preview */}
                      <div
                        className="rounded-lg p-3 flex items-center gap-3"
                        style={{ background: 'rgba(37,99,235,0.04)', border: '1px solid rgba(37,99,235,0.12)' }}
                      >
                        <Activity className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#2563eb' }} />
                        <div className="flex-1 text-xs" style={{ color: 'var(--foreground)' }}>
                          {thisImpact?.loading
                            ? 'Checking impact…'
                            : thisImpact != null && thisImpact.count !== null
                              ? <>This score range currently covers <strong>{thisImpact.count}</strong> active camper {thisImpact.count === 1 ? 'assessment' : 'assessments'}.</>
                              : 'Preview how many campers currently score in this range.'
                          }
                        </div>
                        <button
                          onClick={() => fetchImpact(threshold.id)}
                          disabled={thisImpact?.loading}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors disabled:opacity-50"
                          style={{ color: '#2563eb' }}
                        >
                          <Eye className="h-3 w-3" />
                          {thisImpact?.loading ? 'Checking…' : 'Preview Impact'}
                        </button>
                      </div>

                      {/* Save / Cancel */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(threshold)}
                          disabled={saving}
                          className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                          style={{ background: 'var(--ember-orange)' }}
                        >
                          {saving ? 'Saving…' : 'Save Changes'}
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setImpact(null); }}
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

      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
        <HelpCircle className="h-3 w-3 inline mr-1" />
        Score boundaries apply to all campers from the next assessment onwards. Existing overridden assessments are unaffected until their override is cleared.
      </p>
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
          Configure the risk scoring engine. All changes take effect on the next camper risk assessment.
          Changes to points or thresholds do not retroactively alter stored assessment records.
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
      {activeTab === 'factors'    && <RiskFactorsTab />}
      {activeTab === 'rules'      && <ScoringRulesTab />}
      {activeTab === 'thresholds' && <ThresholdsTab />}
    </div>
  );
}
