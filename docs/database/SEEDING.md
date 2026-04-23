# Database Seeding — Camp Burnt Gin

## Modes

The seeder router reads `SEED_MODE` from the environment and delegates accordingly.

| Mode | Seeder | Purpose |
|------|--------|---------|
| `demo` (default) | `DemoSeeder` | Polished small dataset — 5 accounts, 3 campers, 3 applications |
| `development` | `FullSimulationSeeder` | Complete scenario simulation — ~76 campers, every status and edge case |
| `full` | `FullSimulationSeeder` | Alias for `development` (backward compat) |
| `minimal` | `MinimalSeeder` | System config only — roles, rules, form definitions, super admin account |

---

## Commands

```bash
# Demo (default — good starting point for all developers)
php artisan migrate:fresh --seed
SEED_MODE=demo php artisan migrate:fresh --seed

# Full developer dataset
SEED_MODE=development php artisan migrate:fresh --seed

# Production bootstrap (super admin + system config only, no test data)
SEED_MODE=minimal php artisan migrate:fresh --seed

# Run a specific seeder directly (bypasses mode router)
php artisan db:seed --class=DemoSeeder
php artisan db:seed --class=MinimalSeeder
php artisan db:seed --class=FullSimulationSeeder
```

---

## Mode: demo

**Best for:** demos, presentations, first-time dev setup, applicant portal testing.

### Accounts

| Role | Email | Password |
|------|-------|---------|
| super_admin | admin.campburntgin@gmail.com | see `ADMIN_BOOTSTRAP_PASSWORD` env var |
| admin | coordinator@campburntgin.org | password |
| medical | medical@campburntgin.org | password |
| applicant | sarah.johnson@example.com | password |
| applicant | david.martinez@example.com | password |

### Data

- **Session:** Session 1 — Summer 2026 (portal open)
- **Campers:** Ethan Johnson (approved), Lily Johnson (submitted), Sofia Martinez (under review)
- **Ethan's medical record:** active, diagnoses Epilepsy + ASD, 3 verified documents
- **Activity permissions:** all 8 canonical activities; Ethan has swimming/boating restricted

---

## Mode: development

**Best for:** day-to-day development, QA, feature work, dashboard and filter testing.

### Staff Accounts (password: password)

| Role | Email | Name |
|------|-------|------|
| super_admin | admin.campburntgin@gmail.com | Super Administrator (bootstrap) |
| super_admin | admin2@campburntgin.org | Jordan Blake |
| admin | admin@example.com | Alex Rivera |
| admin | admin3@campburntgin.org | Taylor Brooks |
| medical | medical@example.com | Dr. Morgan Chen |
| medical | medical2@campburntgin.org | Jamie Santos RN |
| admin | mfa.admin@campburntgin.org | Dana Forsythe (MFA enabled) |

### Applicant Accounts (password: password)

| Email | Campers |
|-------|---------|
| sarah.johnson@example.com | Ethan (approved S1), Lily (submitted S1) |
| david.martinez@example.com | Sofia (under review S1) |
| jennifer.thompson@example.com | Noah (rejected S1, submitted S2) |
| michael.williams@example.com | Ava (approved S2), Lucas (submitted S1) |
| patricia.davis@example.com | Mia (past approved + 2026 draft) |
| grace.wilson@example.com | Tyler (waitlisted S1) |
| james.carter@example.com | Henry (paper app approved S1 + submitted S2) |
| michelle.robinson@example.com | Olivia (draft S2 — no medical data) |

### Edge-Case Accounts (password: password)

| Email | Scenario |
|-------|---------|
| inactive@example.com | Login denied (is_active=false) |
| locked.applicant@example.com | Login denied (lockout active) |
| ec001.no.contact@edgecase.test | No emergency contact |
| ec002.all.flags@edgecase.test | All behavioral flags true |
| ec003.cancelled@edgecase.test | Admin-cancelled application |
| ec004.withdrawn@edgecase.test | Parent-withdrawn application |
| ec005.all.devices@edgecase.test | All assistive devices + G-tube |
| ec006.seizure.noplan@edgecase.test | Seizure disorder — no action plan |
| ec007.inactive.parent@edgecase.test | Inactive parent (login denied) |
| ec008.maxlength@edgecase.test | Max-length strings in all fields |
| ec009.empty.medical@edgecase.test | Empty medical profile |
| ec010.max.meds@edgecase.test | 5 medications + conflicting dietary restrictions |
| ec011.duplicate.session@edgecase.test | Duplicate session (cancelled) |
| ec012.espanol.only@edgecase.test | All-Spanish, all interpreters |
| ec013.all.health.flags@edgecase.test | All health parity flags true |
| ec014.same.session@edgecase.test | Second session choice = first session choice |

### Coverage

- **Application statuses:** submitted, under_review, approved, rejected, cancelled, waitlisted, withdrawn, draft
- **Medical complexity:** no record, partial, complete (mild / moderate / severe)
- **Sessions:** 1 past, 2 upcoming; capacity variation
- **Scale:** ~76 campers across ~62 families (8 core + 32 scale + 14 edge)

---

## Mode: minimal

**Best for:** production deployment, clean-slate staging.

Creates only:
- 4 roles: `super_admin`, `admin`, `applicant`, `medical`
- Required document rules
- Activity permission defaults (empty — no campers yet)
- Form definition (Camp Burnt Gin Application v1)
- Risk engine configuration
- One super admin account (`admin.campburntgin@gmail.com`)

No test data. Safe for production.

---

## Super Admin Bootstrap

The super admin account is always created by `MinimalSeeder` (Tier 1 — runs in all modes including production).

```bash
# Use a known password (recommended for CI/staging):
ADMIN_BOOTSTRAP_PASSWORD=yourpassword php artisan db:seed

# Let the seeder generate a random password (check console output):
php artisan db:seed
```

The generated password is printed once to the console and never stored in plain text. Change it immediately after first login.

---

## Seeder Architecture

```
DatabaseSeeder (mode router)
├── MinimalSeeder (Tier 1 — always runs)
│   ├── RoleSeeder
│   ├── RequiredDocumentRuleSeeder
│   ├── ActivityPermissionSeeder
│   ├── FormDefinitionSeeder
│   └── RiskEngineSeeder
│   └── bootstrapSuperAdmin()
│
├── DemoSeeder → calls MinimalSeeder + seeds demo data inline
│
└── FullSimulationSeeder → calls MinimalSeeder + all scenario seeders
    ├── Tier 2: StaffSeeder, CampSeeder, FamilySeeder, ScaleSeeder, ...
    ├── Tier 3: ApplicationSeeder
    ├── Tier 4: MedicalSeeder, MedicalPhase11Seeder, ...
    └── Tier 5: DocumentSeeder, MessagingSeeder, AuditLogSeeder, ...
```

---

## Canonical Activity Slugs

`ActivityPermissionSeeder` and `ActivityPermissionFactory` use these slugs — they must match `ApplicationCompletenessService::CANONICAL_ACTIVITIES` exactly:

```
sports_games  arts_crafts  nature  fine_arts
swimming      boating      camping  camp_out
```

Using display names (e.g. "Swimming & Boating") instead of slugs will break the completeness engine.

---

## Extending the Seeders

- **Add a new demo account:** edit `DemoSeeder::run()` — follow the existing User + Camper + Application pattern
- **Add a new edge case:** edit `EdgeCaseSeeder` — each case has its own labeled block (EC-001 through EC-014)
- **Add a new scale family:** edit `ScaleSeeder` — uses the `Family` factory pattern
- **Add a new activity:** update `CANONICAL_ACTIVITIES` in `ApplicationCompletenessService`, `ActivityPermissionSeeder::$defaultActivities`, and `ActivityPermissionFactory`
- **Add a new required document rule:** add a row in `RequiredDocumentRuleSeeder` — the completeness engine reads from the database, not hardcoded constants
