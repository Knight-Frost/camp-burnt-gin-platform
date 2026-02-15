# Documentation Governance

This document establishes rules, standards, and processes for maintaining high-quality, non-duplicative documentation across the Camp Burnt Gin project.

---

## Core Principles

### Single Source of Truth

**Rule:** Each topic must have exactly ONE canonical document.

**Enforcement:**
- No duplicate documents on the same topic
- Cross-references instead of copying content
- Consolidate overlapping documents immediately
- Archive superseded documents with clear replacement links

### Anti-Duplication Policy

**Prohibited:**
- Creating new documents when existing ones cover the topic
- Copying content between documents
- Maintaining multiple versions of the same information

**Required:**
- Search existing docs before creating new ones
- Use cross-references: `See [Topic](./DOCUMENT.md)`
- Consolidate when overlap > 30%

---

## Document Standards

### Required Metadata

Every documentation file MUST include at bottom:

```markdown
---

**Document Status:** [Authoritative|Draft|Deprecated|Archived]
**Last Updated:** [Month Year]
**Version:** [X.Y.Z]
```

**Optional Metadata:**
```markdown
**Supersedes:** [Old document names]
**Superseded By:** [New document name]
```

### Status Definitions

| Status | Meaning | Action |
|--------|---------|--------|
| Authoritative | Current, official reference | Use this document |
| Draft | Work in progress | Review before using |
| Deprecated | Being phased out | Use replacement document |
| Archived | Historical reference only | Do not use for current work |

---

## File Naming Conventions

### Backend Documentation

**Location:** `/docs/backend/`

**Naming Pattern:**
- ALL_CAPS_WITH_UNDERSCORES.md for technical docs
- lowercase-with-hyphens.md for plans/guides

**Examples:**
- `API_REFERENCE.md` (technical reference)
- `TROUBLESHOOTING.md` (technical guide)
- `deployment-checklist.md` (operational guide)

### Frontend Documentation

**Location:** `/docs/frontend/`

**Naming Pattern:**
- ALL_CAPS for major technical docs
- lowercase-with-hyphens for plans/reports
- PascalCase for component guides

**Examples:**
- `DESIGN_SYSTEM.md` (major reference)
- `frontend-architecture-plan.md` (plan doc)
- `ComponentGuide.md` (component reference)

### Governance Documentation

**Location:** `/docs/governance/` (plus root for README.md and CHANGELOG.md)

**Naming Pattern:** ALL_CAPS_WITH_UNDERSCORES.md

**Examples:**
- `DOCUMENTATION_INDEX.md`
- `DOCUMENTATION_GOVERNANCE.md`
- `CHANGELOG.md`

---

## File Placement Rules

### Placement Decision Tree

```
Is it about the API backend?
  YES → /docs/backend/
    Is it operational (deployment, config)?
      YES → Use descriptive name (DEPLOYMENT.md, CONFIGURATION.md)
    Is it a technical reference?
      YES → Use ALL_CAPS (API_REFERENCE.md, DATA_MODEL.md)
    Is it compliance/security?
      YES → Keep in backend/ (SECURITY.md, AUDIT_LOGGING.md)

Is it about the frontend?
  YES → /docs/frontend/
    Is it architecture or design system?
      YES → Use ALL_CAPS or descriptive (DESIGN_SYSTEM.md)
    Is it a plan or report?
      YES → Use lowercase-with-hyphens

Is it project-wide governance or ADR?
  YES → /docs/governance/
    Use ALL_CAPS (ARCHITECTURE_DECISIONS.md, FRONTEND_PRD.md)
  Exception: README.md and CHANGELOG.md stay in project root

Is it outdated but worth keeping?
  YES → /docs/archive/[backend|frontend|root]/
    Add "Archived" status in metadata
```

---

## Document Structure

### Required Sections

All technical documents MUST include:

1. **Title** (H1)
2. **Brief description** (1-2 sentences)
3. **Table of Contents** (if > 100 lines)
4. **Content sections** (logical hierarchy)
5. **Cross-References** (related docs)
6. **Metadata** (status, date, version)

### Optional Sections

- Prerequisites
- Examples
- Troubleshooting
- FAQ
- Change Log (for living documents)

### Forbidden Content

- Duplicate information from other docs (use cross-references)
- Outdated information (update or archive)
- Proprietary/sensitive data (use .env for secrets)
- Personal opinions without context
- Uncommitted code examples (ensure examples work)

---

## Update Requirements

### When to Update

Update documentation when:
- Code changes affect documented behavior
- New features added
- Bugs fixed that were documented as "known issues"
- Configuration options change
- Deployment procedures change
- Security vulnerabilities addressed

### Update Process

1. **Make Changes:** Edit the canonical document
2. **Update Metadata:** Change "Last Updated" date and increment version
3. **Test Examples:** Verify code examples still work
4. **Review Cross-References:** Ensure links still valid
5. **Commit:** Include docs in the same PR as code changes

### Version Numbering

Semantic versioning for docs:

- **Major (X.0.0):** Complete rewrite or restructure
- **Minor (0.X.0):** New sections, significant additions
- **Patch (0.0.X):** Minor corrections, clarifications, updates

---

## Review and Approval

### Documentation Review Checklist

Before committing documentation changes:

- [ ] No duplicate content from other docs
- [ ] All cross-references valid and working
- [ ] Code examples tested and functional
- [ ] Metadata updated (status, date, version)
- [ ] Naming conventions followed
- [ ] File placed in correct directory
- [ ] Table of contents updated (if applicable)
- [ ] No sensitive information (passwords, keys)
- [ ] Spelling and grammar checked
- [ ] Follows project style guide

### Approval Requirements

| Document Type | Approval Required |
|--------------|-------------------|
| Governance docs | Project lead |
| Architecture docs | Tech lead or architect |
| API/technical reference | Backend lead |
| Security/compliance | Security team |
| Operational (deployment) | DevOps lead |
| General updates | Any team member (peer review recommended) |

---

## Archival Process

### When to Archive

Archive documents when:
- Superseded by new document
- Feature/system deprecated
- Historical value only
- No longer accurate but worth preserving

### Archive Procedure

1. **Move file:** `/docs/[domain]/DOCUMENT.md` → `/docs/archive/[domain]/DOCUMENT.md`
2. **Update status:** Set to "Archived"
3. **Add notice at top:**
   ```markdown
   **ARCHIVED:** This document has been archived. See [NEW_DOCUMENT.md](../NEW_DOCUMENT.md) for current information.
   ```
4. **Update index:** Remove from main index, add to archive section
5. **Update cross-references:** Point to replacement document

---

## Enforcement

### Anti-Duplication Enforcement

**Monthly Review:**
- Run duplication detection tools
- Review new documents for overlap
- Consolidate identified duplicates
- Update DOCUMENTATION_INDEX.md

**Tools:**
```bash
# Find potential duplicates by title similarity
find docs -name "*.md" -exec basename {} \; | sort

# Search for duplicate content (manual review)
grep -r "specific unique phrase" docs/

# Verify no .md files remain outside /docs (except root README/CHANGELOG)
find backend frontend -name "*.md" 2>/dev/null | grep -v node_modules
```

### Compliance Checks

Before major releases:
- All docs have required metadata
- No dead links in cross-references
- Archive directory organized
- Index is up-to-date
- No deprecated docs in main directories

---

## Migration from Old Structure

For teams migrating to this governance model:

1. **Audit:** List all existing documentation
2. **Categorize:** Assign to backend/frontend/governance
3. **De-duplicate:** Merge overlapping documents
4. **Reorganize:** Move to correct directories
5. **Update:** Add metadata, fix cross-references
6. **Archive:** Move outdated docs to archive/
7. **Index:** Create/update DOCUMENTATION_INDEX.md

---

## Cross-References

Related governance documents:

- [Documentation Index](DOCUMENTATION_INDEX.md) — Complete documentation catalog
- [Architecture Decisions](governance/ARCHITECTURE_DECISIONS.md) — Technical decision records
- [Frontend PRD](governance/FRONTEND_PRD.md) — Frontend product requirements
- [Backend Changelog](governance/BACKEND_CHANGELOG.md) — Backend version history
- [Root Changelog](../CHANGELOG.md) — Project version history

---

**Document Status:** Authoritative
**Last Updated:** February 2026
**Version:** 1.0.0
