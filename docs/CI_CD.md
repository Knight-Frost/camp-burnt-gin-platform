# CI/CD Pipeline

## 1. Overview

This document describes the continuous integration and deployment pipeline for the Camp Burnt Gin project. The pipeline is implemented as GitHub Actions workflows and enforces code quality, security policy, and deployment gating automatically on every relevant push and pull request.

---

## 2. Goals

- Prevent regressions from reaching `main` on any active development branch
- Enforce repository policy (prohibited references, credential hygiene, debug artifacts)
- Validate the backend (PHP tests, style, static analysis) on every PHP version in the support matrix
- Validate the frontend (TypeScript, lint, production build) on every commit
- Gate deployment so it only occurs after all validation passes
- Provide a foundation for scaling the pipeline as the project grows

---

## 3. Repository Discovery

The pipeline was designed from direct inspection of the repository. The following facts informed every implementation decision.

| Aspect | Value |
|---|---|
| Backend path | `backend/camp-burnt-gin-api/` |
| Frontend path | `frontend/` |
| Backend framework | Laravel 12, PHP ^8.2 |
| Backend test runner | PHPUnit 11.5.3 via `php artisan test` |
| Backend code style | Laravel Pint (config: `pint.json`) |
| Backend static analysis | PHPStan + Larastan (config: `phpstan.neon`) |
| Test database (unit/feature) | SQLite `:memory:` as configured in `phpunit.xml` |
| Frontend package manager | pnpm (lockfile: `frontend/pnpm-lock.yaml`) |
| Frontend build tool | Vite 5 |
| Frontend test command | `pnpm type-check`, `pnpm lint`, `pnpm build` |
| Frontend deployment | Vercel (config: `frontend/vercel.json`) |
| Backend deployment | Docker multi-stage (config: `backend/camp-burnt-gin-api/docker/`) |
| Pre-commit hook | `.git/hooks/pre-commit` (scans staged content for prohibited terms) |
| Dependabot | `.github/dependabot.yml` (composer + github-actions, weekly) |

---

## 4. Workflow Architecture

Four workflows exist under `.github/workflows/`:

### `ci.yml` — Core Validation (primary gate)

**Triggers:** Push and pull request to `main`, `frontend`, `backend`, `develop`

**Job dependency graph:**
```
policy
  ├── backend-tests (PHP 8.2, 8.3, 8.4 in parallel)
  ├── code-style
  ├── static-analysis
  └── frontend
```

**Concurrency:** Uses `cancel-in-progress: true` so only the latest commit runs CI on a given branch.

---

### `security.yml` — Security Audits

**Triggers:** Push and pull request to all active branches, plus a daily scheduled run at 02:00 UTC

**Jobs (all independent, run in parallel):**
- `composer-audit` — `composer audit` against the PHP lockfile
- `node-audit` — `pnpm audit --audit-level=high` against the JS lockfile
- `env-file-check` — Verifies no `.env` files (other than `.env.example`) are committed
- `secret-scan` — Grep-based scan for credential patterns; **hard fails** on any finding
- `code-security` — Scans PHP application source for dangerous function calls

The scheduled run detects newly disclosed vulnerabilities in existing dependencies without requiring a commit.

---

### `database.yml` — Migration Validation

**Triggers:** Push and pull request to all active branches, **but only when files under `database/migrations/` or `database/seeders/` change**

**Jobs:**
- `migration-validation` — Runs `migrate:fresh`, tests rollback + re-migration, runs full seeder suite against MySQL 8.0
- `migration-conflict-check` — Detects duplicate timestamps and non-standard naming (no DB required)
- `schema-documentation` — Outputs `migrate:status` and table list for human review

---

### `deploy.yml` — Deployment

**Trigger:** `workflow_run` — fires when the `CI` workflow completes on `main`. Deployment only proceeds if `github.event.workflow_run.conclusion == 'success'`.

**Jobs:**
- `deploy-frontend` — Builds and deploys the React app to Vercel production
- `deploy-backend` — SSH + Docker deployment to the production server; gracefully skips if secrets are not yet configured

---

## 5. Repository Policy Enforcement

Policy is enforced by three scripts in `scripts/` that run as the first job in `ci.yml` and as a dedicated job in `security.yml`. All three jobs block all downstream work if they fail.

### Prohibited Reference Scan (`scripts/check-forbidden-terms.sh`)

Scans application source code for references to specific external tools and services that must not appear in the codebase. The full term list is maintained in the script itself (stored in encoded form to avoid false positives during self-scan).

**Scanned paths:**
- `backend/camp-burnt-gin-api/app/`
- `backend/camp-burnt-gin-api/database/`
- `backend/camp-burnt-gin-api/routes/`
- `backend/camp-burnt-gin-api/tests/`
- `frontend/src/` (`.ts`, `.tsx`, `.css`)
- `docs/` (`.md`)

**Excluded from scan:** `.github/`, `scripts/`, `vendor/`, `node_modules/` — these are CI infrastructure or third-party code that cannot meaningfully be scanned with this policy.

### Environment File Check (`scripts/check-env-files.sh`)

Verifies that no real environment configuration files (`.env`, `.env.local`, `.env.production`, `.env.staging`, `.env.testing`) exist in the tracked tree. Only `.env.example` files are permitted.

### Debug Artifact Check (`scripts/check-debug-artifacts.sh`)

Scans for debug helpers that must not reach the repository:
- PHP: `dd(`, `dump(`, `var_dump(`, `print_r(`, `die(`
- TypeScript/TSX: `console.log(`, `console.debug(` (test files are excluded)

---

## 6. Backend Validation

### Tests (`backend-tests`)

- Runs against PHP 8.2, 8.3, and 8.4 in a matrix (3 parallel runners)
- Uses SQLite `:memory:` as configured in `phpunit.xml` — no external database service required
- Explicit env vars override the `.env` to ensure clean test isolation: `MAIL_MAILER=array`, `CACHE_STORE=array`, `SESSION_DRIVER=array`, `QUEUE_CONNECTION=sync`
- Composer dependencies are cached by PHP version and lockfile hash

> **Why SQLite here, MySQL in `database.yml`?**
> Unit and feature tests are designed for SQLite (see `phpunit.xml`). SQLite requires no service, starts instantly, and each test run gets a fresh in-memory database. MySQL-specific migration integrity is the concern of `database.yml`, which runs the full migration cycle against real MySQL 8.0 whenever schema files change.

### Code Style (`code-style`)

Runs `./vendor/bin/pint --test` (dry-run). Fails if any file does not match the style rules defined in `pint.json`. Does not modify files.

### Static Analysis (`static-analysis`)

Runs `./vendor/bin/phpstan analyse --memory-limit=2G`. Configuration is loaded automatically from `phpstan.neon`. Larastan provides Laravel-specific type inference.

---

## 7. Frontend Validation

The `frontend` job in `ci.yml`:

1. **pnpm install --frozen-lockfile** — fails if `pnpm-lock.yaml` is out of sync with `package.json`
2. **pnpm type-check** — runs `tsc --noEmit`; any type error fails the build
3. **pnpm lint** — runs ESLint with `--max-warnings 0`; any warning or error fails the build
4. **pnpm build** — runs `tsc && vite build`; any compilation or bundle error fails the build

Build env vars set for CI: `VITE_API_BASE_URL=http://localhost:8000`, `VITE_ENVIRONMENT=ci`, `VITE_ENABLE_DEVTOOLS=false`.

---

## 8. Deployment Gating

```
push to main
    └── CI workflow (ci.yml) runs
            └── on success only → deploy.yml fires
                    ├── deploy-frontend
                    └── deploy-backend (needs: deploy-frontend)
```

Deployment is **completely blocked** if:
- Any CI job fails (policy, tests, style, analysis, frontend build)
- The commit is not on `main`
- The triggering event is a pull request (CI runs on PRs but deploy.yml is `workflow_run` — it only fires when CI completes on `main`)

The `environment: production` declaration on both deploy jobs activates GitHub's environment protection rules (approval gates, deployment secrets) if configured in repository settings.

---

## 9. Required Secrets

### Frontend Deployment (Vercel)

| Secret | Description |
|---|---|
| `VERCEL_TOKEN` | Personal access token from Vercel dashboard |
| `VERCEL_ORG_ID` | Obtained by running `npx vercel link` in `frontend/` |
| `VERCEL_PROJECT_ID` | Obtained by running `npx vercel link` in `frontend/` |
| `VITE_API_BASE_URL` | Production API URL (e.g. `https://api.campburntgin.org`) |

### Backend Deployment (SSH + Docker)

| Secret | Description |
|---|---|
| `DEPLOY_SSH_HOST` | Production server hostname or IP |
| `DEPLOY_SSH_USER` | SSH user with Docker access |
| `DEPLOY_SSH_KEY` | Full PEM private key (no passphrase) |
| `DEPLOY_APP_DIR` | Absolute path on the server (e.g. `/var/www/camp-burnt-gin`) |
| `DEPLOY_API_URL` | (Optional) API base URL for the post-deploy health check |

Until `DEPLOY_SSH_HOST` is set, the backend deployment step skips cleanly. The frontend deploys independently.

---

## 10. Interpreting Failures

| Failing job | Likely cause |
|---|---|
| `policy` — forbidden reference scan | A prohibited term was introduced in application source or docs. See the script output for the file and line. |
| `policy` — environment file check | A `.env` file (not `.env.example`) was committed. Remove it and add to `.gitignore`. |
| `policy` — debug artifact check | A `dd(`, `dump(`, or `console.log(` was left in source. |
| `backend-tests` | A PHP test failed. See the PHPUnit output for the specific test and assertion. |
| `code-style` | A PHP file does not pass Pint rules. Run `./vendor/bin/pint` locally to auto-fix. |
| `static-analysis` | PHPStan found a type error or Larastan rule violation. |
| `frontend` (type-check) | TypeScript type error. Run `pnpm type-check` locally to reproduce. |
| `frontend` (lint) | ESLint violation. Run `pnpm lint:fix` locally to auto-fix where possible. |
| `frontend` (build) | Vite or TypeScript compilation error in the production build. |
| `composer-audit` | A known CVE in a Composer dependency. Update the package or file a suppression with justification. |
| `node-audit` | A high-severity CVE in an npm/pnpm dependency. Update the package. |
| `secret-scan` | A hardcoded credential pattern was detected. Move the value to environment variables. |
| `migration-validation` | A migration fails to apply, roll back, or re-apply against MySQL. Fix the migration file. |

---

## 11. Branch Protection Recommendations

Configure the following in GitHub Settings → Branches → `main` protection rules:

- [x] Require status checks to pass before merging
  - Required: `Repository Policy`
  - Required: `Backend Tests (PHP 8.2)`
  - Required: `Backend Tests (PHP 8.3)`
  - Required: `Backend Tests (PHP 8.4)`
  - Required: `Code Style (Pint)`
  - Required: `Static Analysis (PHPStan)`
  - Required: `Frontend Validation`
- [x] Require branches to be up to date before merging
- [x] Require linear history (optional but recommended)
- [x] Do not allow bypassing the above settings

---

## 12. Extending the Pipeline

### Adding a new PHP version to the test matrix

In `ci.yml`, append to `matrix.php`:
```yaml
matrix:
  php: ['8.2', '8.3', '8.4', '8.5']
```

### Adding coverage reporting

In `ci.yml` `backend-tests`, change `coverage: none` to `coverage: pcov` or `coverage: xdebug`, then add:
```yaml
- name: Generate coverage report
  run: php artisan test --coverage
```

Upload to Codecov or similar via the `codecov/codecov-action` action.

### Adding frontend unit tests

The project has Vitest and `@testing-library/react` installed. To add CI testing:
1. Create test files alongside components (e.g. `MyComponent.test.tsx`)
2. In `ci.yml` `frontend` job, add after `pnpm lint`:
   ```yaml
   - name: Run frontend tests
     working-directory: frontend
     run: pnpm exec vitest run
   ```

### Enabling backend deployment

1. Provision a production server with Docker and SSH access
2. Set all five `DEPLOY_SSH_*` secrets in GitHub repository settings
3. Configure `DEPLOY_API_URL` to enable the post-deploy health check
4. Ensure the server has a `/api/health` endpoint that returns HTTP 200

### Adding Dependabot for npm/pnpm

To enable automated frontend dependency updates, add to `.github/dependabot.yml`:
```yaml
- package-ecosystem: "npm"
  directory: "/frontend"
  schedule:
    interval: "weekly"
```

---

## 13. Local Development Hooks

A pre-commit hook exists at `.git/hooks/pre-commit`. It scans staged files for prohibited external-tool references before every commit. This is a local-only file and must be set up manually on each developer machine. The hook is not automatically distributed via `git clone`.

To ensure the hook stays consistent across the team, distribute `scripts/install-hooks.sh` (if created) or document the manual setup step in the project's `docs/backend/SETUP.md`.

The hook should exclude `scripts/` from its scan (consistent with the CI behavior) to allow the enforcement scripts themselves to be committed without triggering false positives.
