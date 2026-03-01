# Documentation Index

Comprehensive catalog of all documentation for the Camp Burnt Gin project, organized by category with purpose and intended audience. This is the authoritative entry point for all project documentation.

---

## Table of Contents

1. [Backend API Documentation](#1-backend-api-documentation)
2. [Frontend Documentation](#2-frontend-documentation)
3. [Governance Documentation](#3-governance-documentation)
4. [Root-Level Documents](#4-root-level-documents)
5. [Archive](#5-archive)
6. [Document Categories](#6-document-categories)
7. [Quick Reference](#7-quick-reference)

---

## 1. Backend API Documentation

**Location:** `/docs/backend/`

### Core Architecture

| Document | Purpose | Audience |
|----------|---------|----------|
| [SYSTEM_OVERVIEW.md](backend/SYSTEM_OVERVIEW.md) | High-level system description and capabilities | All stakeholders |
| [ARCHITECTURE.md](backend/ARCHITECTURE.md) | Technical architecture and design patterns | Developers, architects |
| [DATA_MODEL.md](backend/DATA_MODEL.md) | Database schema and entity relationships | Developers, DBAs |
| [BUSINESS_RULES.md](backend/BUSINESS_RULES.md) | Application business logic and constraints | All developers, product team |

### API Reference

| Document | Purpose | Audience |
|----------|---------|----------|
| [API_OVERVIEW.md](backend/API_OVERVIEW.md) | API capabilities and endpoint organization | All developers |
| [API_REFERENCE.md](backend/API_REFERENCE.md) | Complete endpoint reference with request/response examples | Frontend developers, integrators |
| [AUTHENTICATION_AND_AUTHORIZATION.md](backend/AUTHENTICATION_AND_AUTHORIZATION.md) | Auth mechanisms, token management, and session handling | Security team, developers |
| [ROLES_AND_PERMISSIONS.md](backend/ROLES_AND_PERMISSIONS.md) | RBAC system, role definitions, and permission matrix | Security team, developers |
| [ERROR_HANDLING.md](backend/ERROR_HANDLING.md) | Error codes, status codes, and error response formats | Frontend developers, support |

### Security and Compliance

| Document | Purpose | Audience |
|----------|---------|----------|
| [SECURITY.md](backend/SECURITY.md) | Security architecture, controls, and HIPAA compliance | Security auditors, compliance |
| [AUDIT_LOGGING.md](backend/AUDIT_LOGGING.md) | Audit trail implementation and PHI access logging | Compliance, security |
| [ROLES_AND_PERMISSIONS.md](backend/ROLES_AND_PERMISSIONS.md) | Authorization matrix and role definitions | Security, all developers |

### Workflows and Features

| Document | Purpose | Audience |
|----------|---------|----------|
| [APPLICATION_WORKFLOWS.md](backend/APPLICATION_WORKFLOWS.md) | Application lifecycle and state transitions | Developers, business analysts |
| [FILE_UPLOADS.md](backend/FILE_UPLOADS.md) | Document management, upload security, validation | Developers, security team |
| [INBOX_SYSTEM_DOCUMENTATION.md](backend/INBOX_SYSTEM_DOCUMENTATION.md) | Messaging system: architecture, security, and implementation | Developers, architects |

### Configuration and Deployment

| Document | Purpose | Audience |
|----------|---------|----------|
| [SETUP.md](backend/SETUP.md) | Development environment setup and installation | Developers |
| [CONFIGURATION.md](backend/CONFIGURATION.md) | Configuration reference and environment variables | DevOps, system administrators |
| [DEPLOYMENT.md](backend/DEPLOYMENT.md) | Production deployment procedures | DevOps, system administrators |
| [CI_CD.md](backend/CI_CD.md) | Continuous integration and deployment pipeline | DevOps |

### Testing and Quality

| Document | Purpose | Audience |
|----------|---------|----------|
| [TESTING.md](backend/TESTING.md) | Testing strategy, test execution, and quality assurance | Developers, QA |
| [PERFORMANCE_AND_SCALABILITY.md](backend/PERFORMANCE_AND_SCALABILITY.md) | Performance considerations and benchmarks | Developers, architects |

### Maintenance and Support

| Document | Purpose | Audience |
|----------|---------|----------|
| [TROUBLESHOOTING.md](backend/TROUBLESHOOTING.md) | Common issues, solutions, and diagnostic procedures | Support, system administrators |
| [CONTRIBUTING.md](backend/CONTRIBUTING.md) | Contribution guidelines and development standards | Developers, contributors |
| [REQUIREMENTS_AND_TRACEABILITY.md](backend/REQUIREMENTS_AND_TRACEABILITY.md) | Functional requirements and implementation traceability | Product team, stakeholders |
| [FUTURE_WORK.md](backend/FUTURE_WORK.md) | Deferred features and roadmap | Product team, management |

---

## 2. Frontend Documentation

**Location:** `/docs/frontend/` and `/frontend/`

### Primary Reference

| Document | Purpose | Audience |
|----------|---------|----------|
| [frontend/FRONTEND_GUIDE.md](../frontend/FRONTEND_GUIDE.md) | Complete frontend development reference — canonical | Frontend developers |
| [docs/frontend/README.md](frontend/README.md) | Frontend module overview and structure | All developers |

### Design System

| Document | Purpose | Audience |
|----------|---------|----------|
| [docs/frontend/DESIGN_SYSTEM.md](frontend/DESIGN_SYSTEM.md) | Design system architecture and token reference | Frontend developers, design |
| [docs/frontend/COMPONENT_GUIDE.md](frontend/COMPONENT_GUIDE.md) | Component library reference | Frontend developers |
| [docs/frontend/FIGMA_DESIGN_TOKENS.md](frontend/FIGMA_DESIGN_TOKENS.md) | Design tokens derived from Figma specifications | Frontend developers, design |
| [design/DESIGN_SYSTEM.md](../design/DESIGN_SYSTEM.md) | Project-level design system documentation | All developers, design |

### Setup and Tooling

| Document | Purpose | Audience |
|----------|---------|----------|
| [docs/frontend/TOOLING_SETUP.md](frontend/TOOLING_SETUP.md) | Development tools configuration and setup | Frontend developers |

### Historical Planning Documents (Informational)

> These documents reflect the planning phase and may not fully align with the current implementation. Refer to `frontend/FRONTEND_GUIDE.md` for the current system state.

| Document | Notes |
|----------|-------|
| [frontend-architecture-considerations.md](frontend/frontend-architecture-considerations.md) | Architecture analysis from planning phase |
| [frontend-architecture-plan.md](frontend/frontend-architecture-plan.md) | Original implementation plan |
| [frontend-development-plan.md](frontend/frontend-development-plan.md) | Development roadmap from planning phase |
| [landing-page-plan.md](frontend/landing-page-plan.md) | Landing page specifications |

---

## 3. Governance Documentation

**Location:** `/docs/` and `/docs/governance/`

| Document | Purpose | Audience |
|----------|---------|----------|
| [DOCUMENTATION_GOVERNANCE.md](DOCUMENTATION_GOVERNANCE.md) | Documentation standards and procedures | All contributors |
| [governance/ARCHITECTURE_DECISIONS.md](governance/ARCHITECTURE_DECISIONS.md) | Architectural decision records (ADR) | Architects, senior developers |
| [governance/FRONTEND_PRD.md](governance/FRONTEND_PRD.md) | Frontend product requirements document | Product team, frontend developers |
| [governance/BACKEND_CHANGELOG.md](governance/BACKEND_CHANGELOG.md) | Backend version history and changes | All stakeholders |

---

## 4. Root-Level Documents

| Document | Purpose |
|----------|---------|
| [README.md](../README.md) | Project overview, structure, and quick start |
| [Issues.md](../Issues.md) | Resolved issue archive (historical reference) |
| [Parent_Portal_Audit.md](../Parent_Portal_Audit.md) | Applicant portal audit — resolved findings |
| [SuperAdmin_Portal_Audit_Report.md](../SuperAdmin_Portal_Audit_Report.md) | Super Admin portal audit — resolved findings |
| [camp-burnt-gin-system-notes.md](../camp-burnt-gin-system-notes.md) | System requirements and design reference |
| [DATABASE_ARCHITECTURE_AND_SCHEMA_DOCUMENTATION.md](../DATABASE_ARCHITECTURE_AND_SCHEMA_DOCUMENTATION.md) | Complete database schema documentation |

---

## 5. Archive

Historical documents preserved for reference. Do not use archived documents for current development.

### Backend Archive

**Location:** `/docs/archive/backend/`

| Document | Archived | Reason |
|----------|----------|--------|
| DOCUMENTATION_INTEGRITY_AUDIT.md | Feb 2026 | Superseded by governance documents |
| BACKEND_COMPLETION_STATUS.md | Feb 2026 | Point-in-time completion snapshot |
| COMPREHENSIVE_BACKEND_AUDIT_REPORT.md | Feb 2026 | Historical audit |
| SECURITY_AUDIT_FINAL_REPORT.md | Feb 2026 | Historical security audit |
| SECURITY_INCIDENT_ENV_EXPOSURE.md | Feb 2026 | Remediated incident report |
| STRUCTURE_AUDIT_ANALYSIS.md | Feb 2026 | Structural analysis |
| STRUCTURE_REFACTOR_VERIFICATION.md | Feb 2026 | Refactor verification |

### Frontend Archive

**Location:** `/docs/archive/frontend/`

| Document | Archived | Reason |
|----------|----------|--------|
| REORGANIZATION_REPORT.md | Feb 2026 | Historical reorganization record |
| CODEBASE_AUDIT_REPORT.md | Feb 2026 | Historical code audit |
| DESIGN_GAP_ANALYSIS.md | Feb 2026 | Historical design analysis |
| FORENSIC_AUDIT_REPORT.md | Feb 2026 | Historical forensic audit |
| ARCHITECTURE_STABILITY_REPORT.md | Feb 2026 | Stability snapshot |
| FIX_IMPLEMENTATION_LOG.md | Feb 2026 | Implementation log |
| BEFORE_AFTER_SUMMARY.md | Feb 2026 | Refactor summary |
| CLEANUP_REPORT.md | Feb 2026 | Cleanup phase record |
| DEPENDENCY_REDUCTION_REPORT.md | Feb 2026 | Dependency reduction record |
| MULTILINGUAL_IMPLEMENTATION_REPORT.md | Feb 2026 | i18n implementation record |
| FUNCTIONAL_INTEGRATION_REPORT.md | Feb 2026 | Integration report |
| STRUCTURE_REORGANIZATION_REPORT.md | Feb 2026 | Structure reorganization |
| THEME_BACKGROUND_SWITCH_FIX_REPORT.md | Feb 2026 | Theme fix record |
| THEME_ENGINE_IMPLEMENTATION_REPORT.md | Feb 2026 | Theme engine record |
| TOOLING_COMPLETION_REPORT.md | Feb 2026 | Tooling phase completion |
| BUG_FIX_REPORT.md | Feb 2026 | Bug fix history |

### Root Archive

**Location:** `/docs/archive/root/`

| Document | Archived | Reason |
|----------|----------|--------|
| DOCUMENTATION_OPTIMIZATION_REPORT.md | Feb 2026 | Historical optimization report |
| DOCUMENTATION_OPTIMIZATION_SUMMARY.md | Feb 2026 | Historical optimization summary |
| DOCUMENTATION_RATIONALIZATION_AUDIT.md | Feb 2026 | Historical rationalization audit |

---

## 6. Document Categories

### By Domain

| Domain | Canonical Documents | Location |
|--------|-------------------|----------|
| Backend API | 22 | docs/backend/ |
| Frontend | 5 canonical + 4 planning | docs/frontend/, frontend/ |
| Governance | 4 | docs/governance/, docs/ |
| Root | 6 | project root |
| Archive | 26 historical | docs/archive/ |

### By Audience

| Audience | Primary Documents |
|----------|-------------------|
| All Developers | README.md, API_REFERENCE.md, BUSINESS_RULES.md, APPLICATION_WORKFLOWS.md |
| Backend Developers | DATA_MODEL.md, AUTHENTICATION_AND_AUTHORIZATION.md, CONFIGURATION.md, SECURITY.md |
| Frontend Developers | frontend/FRONTEND_GUIDE.md, DESIGN_SYSTEM.md, COMPONENT_GUIDE.md, API_REFERENCE.md |
| DevOps | DEPLOYMENT.md, CONFIGURATION.md, TROUBLESHOOTING.md, CI_CD.md |
| Security and Compliance | SECURITY.md, AUDIT_LOGGING.md, ROLES_AND_PERMISSIONS.md |
| Product and Management | BUSINESS_RULES.md, FRONTEND_PRD.md, REQUIREMENTS_AND_TRACEABILITY.md |

### By Type

| Type | Documents |
|------|-----------|
| Reference | API_REFERENCE.md, DATA_MODEL.md, CONFIGURATION.md, ERROR_HANDLING.md |
| How-To | SETUP.md, DEPLOYMENT.md, TROUBLESHOOTING.md, TESTING.md |
| Architecture | ARCHITECTURE.md, ARCHITECTURE_DECISIONS.md, DESIGN_SYSTEM.md |
| Compliance | AUDIT_LOGGING.md, SECURITY.md, ROLES_AND_PERMISSIONS.md |
| Governance | DOCUMENTATION_GOVERNANCE.md, DOCUMENTATION_INDEX.md |
| Requirements | REQUIREMENTS_AND_TRACEABILITY.md, FRONTEND_PRD.md, BUSINESS_RULES.md |
| Audit Reports | Parent_Portal_Audit.md, SuperAdmin_Portal_Audit_Report.md (both resolved) |

---

## 7. Quick Reference

| Task | Document |
|------|---------|
| Integrate with the API | [API_REFERENCE.md](backend/API_REFERENCE.md) |
| Understand authentication | [AUTHENTICATION_AND_AUTHORIZATION.md](backend/AUTHENTICATION_AND_AUTHORIZATION.md) |
| Configure environment | [CONFIGURATION.md](backend/CONFIGURATION.md) |
| Deploy to production | [DEPLOYMENT.md](backend/DEPLOYMENT.md) |
| Troubleshoot issues | [TROUBLESHOOTING.md](backend/TROUBLESHOOTING.md) |
| Run tests | [TESTING.md](backend/TESTING.md) |
| Build frontend features | [frontend/FRONTEND_GUIDE.md](../frontend/FRONTEND_GUIDE.md) |
| Understand HIPAA compliance | [SECURITY.md](backend/SECURITY.md), [AUDIT_LOGGING.md](backend/AUDIT_LOGGING.md) |
| Understand business rules | [BUSINESS_RULES.md](backend/BUSINESS_RULES.md), [APPLICATION_WORKFLOWS.md](backend/APPLICATION_WORKFLOWS.md) |
| Understand the database | [DATABASE_ARCHITECTURE_AND_SCHEMA_DOCUMENTATION.md](../DATABASE_ARCHITECTURE_AND_SCHEMA_DOCUMENTATION.md) |

---

**Document Status:** Authoritative
**Last Updated:** March 2026
**Version:** 2.0.0
