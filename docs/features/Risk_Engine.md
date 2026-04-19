# Risk Engine

**Camp Burnt Gin — Medical Risk Assessment System**

---

## Overview

The risk engine automatically calculates a medical complexity score for each camper based on their full health profile. The score determines a supervision level and complexity tier that inform staffing decisions, placement, and resource planning before and during camp operations.

The engine is fully database-driven. Point values, conditional rules, and tier thresholds are stored in the database and configurable by medical staff through the Risk Management UI — no code change or deployment is required to adjust scoring weights.

---

## Architecture

```
Medical Profile Data (PHI)
  allergies, diagnoses, behavioral_profile,
  feeding_plan, assistive_devices, medications,
  activity_permissions, medical_record

        │
        ▼
SpecialNeedsRiskAssessmentService
  loadFactors()   → risk_factors table (cached 60 min)
  loadRules()     → risk_rules table   (cached 60 min)
  loadThresholds()→ risk_thresholds table (cached 60 min)
  buildFactorBreakdown()
  scoreFromBreakdown()
  determineSupervisionLevel()
  determineComplexityTier()
  extractFlags()

        │
        ▼
risk_assessments table
  (persisted result; linked to camper)

        │
        ▼
RiskAssessmentController
  GET  /campers/{id}/risk-assessment         → current assessment
  POST /campers/{id}/risk-assessment/review  → clinical review
  POST /campers/{id}/risk-assessment/override→ supervision override
  GET  /campers/{id}/risk-assessment/history → audit history
```

---

## Database Tables

### `risk_factors`

Defines what aspects of a camper's medical profile contribute to the score.

| Column | Type | Purpose |
|---|---|---|
| `id` | bigint | Primary key |
| `key` | string | Stable identifier referenced by detection logic (e.g. `anaphylaxis_risk`, `wandering_risk`) |
| `label` | string | Human-readable name shown in UI |
| `points` | integer | Base points awarded when this factor is detected |
| `is_active` | boolean | Inactive factors are ignored during scoring |

### `risk_rules`

Conditional modifiers that add bonus points when a factor meets a specific threshold.

| Column | Type | Purpose |
|---|---|---|
| `risk_factor_id` | FK → risk_factors | The factor this rule modifies |
| `condition_type` | string | Type of check: `count_gte`, `severity_gte`, `field_equals`, etc. |
| `condition_value` | string | The threshold value for the condition |
| `bonus_points` | integer | Additional points added when the condition is met |

### `risk_thresholds`

Maps score ranges to supervision levels and complexity tiers.

| Column | Type | Purpose |
|---|---|---|
| `label` | string | Display label (e.g. "Standard", "Enhanced", "Intensive") |
| `min_score` | integer | Inclusive lower bound of this range |
| `max_score` | integer | Inclusive upper bound (or null for open-ended) |
| `supervision_level` | enum | `standard`, `enhanced`, `intensive`, `one_to_one` |
| `complexity_tier` | enum | `tier_1` through `tier_4` |

### `risk_assessments`

Stores the persisted result of each scoring run.

| Column | Type | Notes |
|---|---|---|
| `camper_id` | FK → campers | |
| `risk_score` | integer | Calculated total (capped at 100) |
| `supervision_level` | enum | Derived from thresholds |
| `complexity_tier` | enum | Derived from thresholds |
| `factor_breakdown` | JSON | Per-factor detail: detected = true/false, points awarded |
| `flags` | JSON | Critical boolean flags: `has_anaphylaxis`, `has_seizures`, `is_one_to_one`, etc. |
| `review_status` | enum | `pending_review`, `reviewed`, `overridden` |
| `reviewed_by` | FK → users | Medical staff who performed the clinical review |
| `override_reason` | text | Mandatory when supervision_level is manually overridden |
| `clinical_notes` | text (encrypted) | PHI — free-text notes from medical staff |

---

## Scoring Algorithm

1. **Load config** — Risk factors, rules, and thresholds are loaded from the database and cached for 60 minutes. The cache is invalidated when any of these records are updated via the Risk Management UI.

2. **Build factor breakdown** — For each active risk factor, the service checks whether the camper's medical data triggers it. Detection logic lives in PHP (which model fields map to which factors). Point values live in the database.

3. **Apply conditional rules** — For each triggered factor, the service checks whether any associated rules apply (e.g. "if 3 or more anaphylactic allergies, add 15 bonus points"). Matching rules stack on top of base factor points.

4. **Calculate total score** — All awarded points are summed and capped at 100.

5. **Resolve supervision level and complexity tier** — The score is matched against the `risk_thresholds` table to determine the output enums.

6. **Extract flags** — Boolean flags for critical conditions (anaphylaxis, seizures, one-to-one requirement) are extracted and stored separately for fast access without decrypting the full factor breakdown.

7. **Persist** — The result is written to `risk_assessments`. A new row is created each time the assessment runs, building a complete audit history.

---

## API Endpoints

All endpoints require authentication. The `view` action is available to `admin`, `super_admin`, and `medical` roles. Write actions (review, override) are restricted to `medical` and `super_admin`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/campers/{camper}/risk-assessment` | Run a fresh assessment and return the result with clinical review state merged in |
| `POST` | `/api/campers/{camper}/risk-assessment/review` | Mark the current assessment as clinically reviewed; optionally add clinical notes |
| `POST` | `/api/campers/{camper}/risk-assessment/override` | Override the supervision level; `override_reason` is required |
| `GET` | `/api/campers/{camper}/risk-assessment/history` | Paginated history of all past assessments for this camper |

**Risk configuration endpoints** (super_admin only):

| Method | Endpoint | Description |
|---|---|---|
| `GET/POST/PUT/DELETE` | `/api/risk-factors` | Manage risk factor definitions |
| `GET/POST/PUT/DELETE` | `/api/risk-rules` | Manage conditional scoring rules |
| `GET/POST/PUT/DELETE` | `/api/risk-thresholds` | Manage score-to-tier mappings |

---

## Clinical Review Workflow

After the engine produces a score, medical staff are expected to validate the result:

1. **Pending review** — Every fresh assessment starts with `review_status = pending_review`.

2. **Review** — A medical staff member reads the factor breakdown, compares it against clinical judgment, and marks it reviewed via `POST .../review`. Optional clinical notes (PHI, encrypted) can be attached.

3. **Override** — If the staff member disagrees with the calculated supervision level, they submit an override via `POST .../override` with a documented reason. The override changes the supervision level on the assessment record without re-running the algorithm. All overrides are logged to `audit_logs`.

---

## Frontend Pages

| Route | Component | Access |
|---|---|---|
| `/admin/campers/:id/risk` | `CamperRiskPage` | admin, super_admin |
| `/medical/records/:id/risk` | `CamperRiskPage` | medical |
| `/admin/risk-management` | `RiskManagementPage` | admin, super_admin |
| `/medical/risk-management` | `RiskManagementPage` | medical (read-only config view) |
| `/super-admin/campers/:id/risk` | `CamperRiskPage` | super_admin |

`CamperRiskPage` shows the score, factor breakdown, supervision level, complexity tier, extracted flags, and the clinical review/override controls.

`RiskManagementPage` shows the risk engine configuration: active factors, conditional rules, and scoring thresholds. Super admins can edit them; medical providers can view them.

---

## Caching

Factor, rule, and threshold configuration is cached for 60 minutes under the keys:

- `risk_engine:factors`
- `risk_engine:rules`
- `risk_engine:thresholds`

Cache is invalidated automatically when records in these tables are saved or deleted. If a scoring run returns unexpected results after a config change, clearing the cache (`php artisan cache:clear`) will force a fresh DB load on the next request.

---

## HIPAA Compliance

Every read of a risk assessment is logged to `audit_logs` with the `phi_access` event type. Clinical notes stored on `risk_assessments.clinical_notes` use Laravel's `encrypted` cast. Override reasons and review decisions are also audit-logged as `admin_action` events.

---

## Known Limitations

- The scoring algorithm runs synchronously on request. For campers with extensive medical records, this adds a small amount of latency to the risk assessment endpoint. A background recalculation job is a possible future improvement.
- Assessment history grows unbounded. There is currently no retention policy for old assessment rows; archiving old records is a future concern.
