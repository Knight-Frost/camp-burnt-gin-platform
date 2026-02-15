# Architecture Decision Records (ADR)

This document records key architectural decisions made during the development of the Camp Burnt Gin API, following the ADR format: Decision, Context, Consequences.

---

## ADR-001: MVC + Service Layer Architecture

**Status:** Accepted
**Date:** 2025
**Decision Makers:** Backend Team

### Decision

Implement MVC (Model-View-Controller) architecture with an additional Service layer for complex business logic.

### Context

Laravel promotes MVC by default, but complex workflows (application approval, medical provider integration) require more than simple CRUD operations.

### Consequences

**Positive:**
- Controllers remain thin, focused on HTTP concerns
- Business logic centralized in services (testable, reusable)
- Models focus on data relationships and persistence
- Clear separation of concerns

**Negative:**
- Additional layer increases initial complexity
- Developers must understand where logic belongs

**Mitigations:**
- Clear naming convention: `{Entity}Service`
- Documentation of service responsibilities

---

## ADR-002: Policy-Based Authorization

**Status:** Accepted
**Date:** 2025
**Decision Makers:** Backend Team, Security Team

### Decision

Use Laravel Policies for all authorization decisions instead of inline permission checks.

### Context

Application handles PHI (Protected Health Information) under HIPAA. Authorization errors could expose sensitive medical data. Need consistent, auditable authorization.

### Consequences

**Positive:**
- Centralized authorization logic in Policy classes
- Automatic audit trail integration
- Easier security reviews
- Consistent enforcement across endpoints
- Unit testable authorization rules

**Negative:**
- Requires policy registration for each model
- Learning curve for developers unfamiliar with policies

**Mitigations:**
- Comprehensive policy documentation
- Policy test coverage > 95%
- Automated policy registration verification

---

## ADR-003: Sanctum Token-Based Authentication

**Status:** Accepted
**Date:** 2025
**Decision Makers:** Backend Team

### Decision

Use Laravel Sanctum for API authentication with 60-minute token expiration.

### Context

SPA (Single Page Application) frontend requires stateless API authentication. HIPAA requires automatic session timeout.

### Consequences

**Positive:**
- Stateless authentication (scalable)
- Built-in CSRF protection
- Simple token management
- Configurable expiration (HIPAA compliant at 60 min)
- No additional dependencies

**Negative:**
- Tokens must be refreshed every 60 minutes
- No built-in token refresh mechanism

**Mitigations:**
- Frontend implements token expiration handling
- Clear error messages on token expiration
- Redirect to login on 401

---

## ADR-004: Database-Backed Queues (Default)

**Status:** Accepted
**Date:** 2025
**Decision Makers:** Backend Team, DevOps

### Decision

Use database-backed queues by default, with option to migrate to Redis in production.

### Context

Need asynchronous processing (email notifications, document scanning) but want simple deployment without additional infrastructure initially.

### Consequences

**Positive:**
- No additional infrastructure (Redis/SQS) required initially
- Simple setup for development and small deployments
- Persistent job storage (survives server restarts)
- Built-in failed job tracking

**Negative:**
- Lower performance than Redis
- Database table grows with job history
- Not ideal for high-volume production

**Mitigations:**
- Clear migration path to Redis documented
- Production recommendation: use Redis
- Job table cleanup scheduled task

---

## ADR-005: Polymorphic Document Storage

**Status:** Accepted
**Date:** 2025
**Decision Makers:** Backend Team

### Decision

Implement polymorphic relationships for document storage, allowing documents to be attached to multiple entity types (Camper, MedicalRecord, Application).

### Context

Documents (medical forms, identification, insurance cards) need to be associated with various entities. Don't want separate document tables for each entity type.

### Consequences

**Positive:**
- Single documents table handles all entity types
- Flexible: easily add new documentable entities
- Consistent document management logic
- Reusable DocumentService

**Negative:**
- Polymorphic queries slightly more complex
- Foreign key constraints not enforceable at database level
- Risk of orphaned documents if parent deleted

**Mitigations:**
- Cascade delete on parent entities
- Orphan cleanup scheduled task
- Clear documentation of polymorphic usage

---

## ADR-006: Soft Deletes for Audit Trail

**Status:** Accepted
**Date:** 2025
**Decision Makers:** Backend Team, Compliance

### Decision

Use soft deletes (deleted_at timestamp) for all user-facing data instead of hard deletes.

### Context

HIPAA requires audit trail of all PHI access and modifications. Hard deletes destroy audit trail. Need ability to restore accidentally deleted data.

### Consequences

**Positive:**
- Complete audit trail preserved
- Data recovery possible
- Meets HIPAA retention requirements
- Debugging easier (can see deleted records)

**Negative:**
- Database grows larger (deleted records retained)
- Queries require `withTrashed()` to see deleted
- Unique constraints complicated by soft deletes

**Mitigations:**
- Scheduled archival process for old deleted records
- Clear query scopes for deleted/non-deleted data
- Unique constraints include deleted_at in compound key

---

## ADR-007: Medical Provider Secure Link System

**Status:** Accepted
**Date:** 2025
**Decision Makers:** Backend Team, Security Team

### Decision

Implement time-limited, single-use secure links for medical providers instead of requiring provider accounts.

### Context

Medical providers need to submit camper medical information but shouldn't require full system accounts. Must balance security with usability.

### Consequences

**Positive:**
- No provider account management required
- Reduced friction for providers
- Time-limited links (72 hours) reduce exposure
- Single-use prevents replay attacks
- Audit trail via link tracking

**Negative:**
- Links could be forwarded to wrong person
- No provider authentication beyond link possession
- Expiration may require resending links

**Mitigations:**
- 64-character cryptographically secure tokens
- IP logging on link usage
- Email to parent when provider submits
- Link revocation capability
- Clear expiration warnings

---

## ADR-008: Quarantine-Based Document Scanning

**Status:** Accepted
**Date:** 2025
**Decision Makers:** Backend Team, Security Team

### Decision

Implement manual approval workflow for uploaded documents (quarantine) rather than automated virus scanning initially.

### Context

Document uploads could contain malware. Enterprise virus scanning (ClamAV, VirusTotal) requires additional infrastructure. Need secure solution that works in all environments.

### Consequences

**Positive:**
- Works in any environment (no external dependencies)
- Admin manually reviews each document
- Explicitly HIPAA compliant (human review)
- No false positives from automated scanning

**Negative:**
- Manual process doesn't scale
- Delay before documents available
- Admin workload increases

**Mitigations:**
- Clear upgrade path to automated scanning documented
- Integration guides for ClamAV, VirusTotal, AWS GuardDuty
- Quarantine system remains as fallback even with automation

---

## ADR-009: Form Request Validation

**Status:** Accepted
**Date:** 2025
**Decision Makers:** Backend Team

### Decision

Use Laravel Form Request classes for all input validation instead of inline controller validation.

### Context

Need consistent, testable, reusable validation. Want to keep controllers thin.

### Consequences

**Positive:**
- Validation logic separated from controller logic
- Reusable across multiple controllers
- Easily unit testable
- Consistent error response format
- Authorization can be included in Form Request

**Negative:**
- Additional files to maintain
- Developers must remember to create Form Request

**Mitigations:**
- Naming convention: `Store{Entity}Request`, `Update{Entity}Request`
- Code generation templates
- Code review checklist includes Form Request usage

---

## ADR-010: Enum-Based Application Status

**Status:** Accepted
**Date:** 2025
**Decision Makers:** Backend Team

### Decision

Use PHP 8.1+ Enums for application status instead of string constants or database-backed enums.

### Context

Application status (pending, under_review, approved, etc.) is fixed set of values that doesn't change frequently. Need type safety and IDE autocomplete.

### Consequences

**Positive:**
- Type-safe status values
- IDE autocomplete support
- Centralized status logic (e.g., isFinal() method)
- No database lookup for enum values
- Reduced risk of typos

**Negative:**
- Requires PHP 8.1+
- Adding new status requires code deployment (not database change)
- Slightly more complex than simple strings

**Mitigations:**
- PHP 8.2 minimum version requirement documented
- Enum backed by string values for database compatibility
- Clear process for adding new statuses

---

## Decision Review Process

### When to Create ADR

Create new ADR when making decisions about:
- Architectural patterns
- Technology choices
- Security implementations
- Compliance approaches
- Cross-cutting concerns

### ADR Template

```markdown
## ADR-###: [Title]

**Status:** [Proposed|Accepted|Deprecated|Superseded]
**Date:** [YYYY-MM]
**Decision Makers:** [Team/Role]

### Decision
[What we decided]

### Context
[Why we needed to make this decision]

### Consequences
**Positive:**
- [Benefits]

**Negative:**
- [Drawbacks]

**Mitigations:**
- [How we address drawbacks]
```

---

**Document Status:** Authoritative
**Last Updated:** February 2026
**Version:** 1.0.0
