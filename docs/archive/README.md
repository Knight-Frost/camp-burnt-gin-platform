# Documentation Archive

This directory contains historical documents that are no longer part of the active documentation set. Files here are retained for audit trail and legal record purposes only.

**Do not use these documents as references for the current system.** All findings described in archived reports have been applied to the codebase and superseded by authoritative documents in the canonical `/docs/` tree.

---

## Contents

| File | Original Purpose | Archived |
|------|-----------------|----------|
| `HIPAA_Compliance_Alignment_Report.md` | Point-in-time HIPAA technical safeguard assessment — findings applied; current posture documented in `security/Security.md` | April 2026 |
| `OWASP_Compliance_Report.md` | Point-in-time OWASP Top-10 assessment — findings applied; current posture documented in `security/Security.md` | April 2026 |

---

## Why These Files Were Archived (Not Deleted)

- **Legal and compliance record:** HIPAA requires maintaining records of security assessments and their remediation.
- **Audit trail continuity:** The findings in these reports drove specific code changes; the reports demonstrate due diligence.
- **Non-sensitive content:** Neither file contains PHI, credentials, or actionable attack vectors.

---

## What Was Deleted (Not Archived)

The following files were permanently deleted during the April 2026 documentation audit because they were either duplicates, contained stale architectural descriptions, or were historical noise with no audit value:

- `backend/camp-burnt-gin-api/docs/` (37 backend-local doc files) — all superseded by `/docs/`
- `backend/camp-burnt-gin-api/CONTRIBUTING.md` — superseded by `/docs/governance/Contributing.md`
- `backend/camp-burnt-gin-api/TESTING_GUIDE.md` — superseded by `/docs/testing/Testing.md`
- `docs/reports/FORENSIC_AUDIT_REPORT.md` and related 2026-03-24 to 2026-03-29 audit reports — findings fully applied; reports contained no information relevant to ongoing operations
- `docs/security/Phase2_Hardening_Report.md` — hardening complete; findings live in code
- `frontend/memory/MEMORY.md` — stale AI working memory file with incorrect route prefixes
- `backend/camp-burnt-gin-api/docs/SECURITY_INCIDENT_ENV_EXPOSURE.md` (both copies) — contained a historical database password in plaintext; deleted as a security measure

---

**Canonical documentation:** [`/docs/INDEX.md`](../INDEX.md)
