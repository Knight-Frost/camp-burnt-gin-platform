# Camp Burnt Gin — Backend API Documentation

This directory contains the complete technical documentation for the Camp Burnt Gin API backend system. This documentation serves as the authoritative reference for developers, system administrators, security auditors, and technical stakeholders.

---

## Documentation Overview

The Camp Burnt Gin API is a Laravel 12-based RESTful API backend designed to manage camp registration, medical records, staff workflows, and administrative operations. The system handles Protected Health Information (PHI) and implements HIPAA-compliant security controls.

**Current Status:** Production-ready. 308 passing tests. Zero known security vulnerabilities. Frontend application fully implemented and integrated.

---

## Documentation Structure

### System Overview and Architecture

| Document | Purpose | Audience |
|----------|---------|----------|
| [SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md) | High-level system description, capabilities, and scope | All stakeholders |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Technical architecture, design patterns, and component organization | Developers, architects |
| [DATA_MODEL.md](DATA_MODEL.md) | Database schema, relationships, and entity descriptions | Developers, DBAs |
| [BUSINESS_RULES.md](BUSINESS_RULES.md) | Business logic, validation rules, and workflow constraints | Developers, product team |

### API Documentation

| Document | Purpose | Audience |
|----------|---------|----------|
| [API_OVERVIEW.md](API_OVERVIEW.md) | API capabilities and endpoint organization | All developers |
| [API_REFERENCE.md](API_REFERENCE.md) | Complete endpoint reference with request/response examples | Frontend developers, integrators |
| [AUTHENTICATION_AND_AUTHORIZATION.md](AUTHENTICATION_AND_AUTHORIZATION.md) | Authentication mechanisms, token management, and session handling | Security team, developers |
| [ROLES_AND_PERMISSIONS.md](ROLES_AND_PERMISSIONS.md) | RBAC system, role definitions, and permission matrix | Security team, developers |

### Security and Compliance

| Document | Purpose | Audience |
|----------|---------|----------|
| [SECURITY.md](SECURITY.md) | Security architecture, controls, and HIPAA compliance | Security auditors, compliance team |
| [AUDIT_LOGGING.md](AUDIT_LOGGING.md) | Audit trail implementation and PHI access logging | Compliance team, security auditors |

> Historical security audit reports are located in `docs/archive/backend/`.

### Workflows and Operations

| Document | Purpose | Audience |
|----------|---------|----------|
| [APPLICATION_WORKFLOWS.md](APPLICATION_WORKFLOWS.md) | Application lifecycle, state transitions, and business processes | Developers, business analysts |
| [FILE_UPLOADS.md](FILE_UPLOADS.md) | Document management, upload security, and validation | Developers, security team |
| [ERROR_HANDLING.md](ERROR_HANDLING.md) | Error handling patterns, status codes, and error responses | Frontend developers, support team |
| [INBOX_SYSTEM_DOCUMENTATION.md](INBOX_SYSTEM_DOCUMENTATION.md) | Messaging system architecture and implementation | Developers, architects |

### Configuration and Deployment

| Document | Purpose | Audience |
|----------|---------|----------|
| [SETUP.md](SETUP.md) | Development environment setup | Developers |
| [CI_CD.md](CI_CD.md) | CI/CD workflows and GitHub Actions configuration | Developers, DevOps |
| [CONFIGURATION.md](CONFIGURATION.md) | Configuration reference and environment variables | DevOps, system administrators |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Production deployment procedures | DevOps, system administrators |

### Testing and Quality Assurance

| Document | Purpose | Audience |
|----------|---------|----------|
| [TESTING.md](TESTING.md) | Testing strategy, test execution, and quality assurance | Developers, QA |

### Performance and Reliability

| Document | Purpose | Audience |
|----------|---------|----------|
| [PERFORMANCE_AND_SCALABILITY.md](PERFORMANCE_AND_SCALABILITY.md) | Performance considerations and benchmarks | Developers, architects |

### Maintenance and Support

| Document | Purpose | Audience |
|----------|---------|----------|
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Common issues, solutions, and diagnostic procedures | Support, system administrators |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution guidelines and development standards | Developers, contributors |

### Project Management

| Document | Purpose | Audience |
|----------|---------|----------|
| [REQUIREMENTS_AND_TRACEABILITY.md](REQUIREMENTS_AND_TRACEABILITY.md) | Functional requirements and traceability | Product team, stakeholders |
| [FUTURE_WORK.md](FUTURE_WORK.md) | Deferred features and roadmap | Product team, management |

---

## Quick Start

### For Developers

1. **Setup:** Read [SETUP.md](SETUP.md) for development environment installation
2. **Architecture:** Review [ARCHITECTURE.md](ARCHITECTURE.md) to understand system design
3. **API:** Reference [API_REFERENCE.md](API_REFERENCE.md) for endpoint documentation
4. **Testing:** See [TESTING.md](TESTING.md) for running and writing tests
5. **Security:** Understand [AUTHENTICATION_AND_AUTHORIZATION.md](AUTHENTICATION_AND_AUTHORIZATION.md) for auth implementation

### For Security Auditors

1. **Security:** Start with [SECURITY.md](SECURITY.md) for comprehensive security documentation
2. **Logging:** Check [AUDIT_LOGGING.md](AUDIT_LOGGING.md) for PHI access audit trails
3. **Compliance:** Verify HIPAA compliance sections in [SECURITY.md](SECURITY.md)
4. **Historical audit:** See `docs/archive/backend/SECURITY_AUDIT_FINAL_REPORT.md`

### For System Administrators

1. **Deployment:** Follow [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment
2. **Configuration:** Reference [CONFIGURATION.md](CONFIGURATION.md) for environment variables
3. **Troubleshooting:** Use [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues
4. **Security:** Implement secret rotation per [SECURITY.md](SECURITY.md#secret-management-and-rotation)

### For Frontend Developers

1. **API:** Start with [API_OVERVIEW.md](API_OVERVIEW.md) for API capabilities
2. **Reference:** Use [API_REFERENCE.md](API_REFERENCE.md) for detailed endpoint specs
3. **Auth:** Implement authentication per [AUTHENTICATION_AND_AUTHORIZATION.md](AUTHENTICATION_AND_AUTHORIZATION.md)
4. **Errors:** Handle errors per [ERROR_HANDLING.md](ERROR_HANDLING.md)
5. **Frontend reference:** See [frontend/FRONTEND_GUIDE.md](../../frontend/FRONTEND_GUIDE.md)

---

## Documentation Standards

All documentation in this directory adheres to the following standards:

1. **Accuracy** — Documentation reflects actual backend implementation
2. **Completeness** — No undocumented features or placeholder sections
3. **Clarity** — Professional language without informal expressions
4. **Consistency** — Cross-references are accurate and terminology is consistent
5. **Currency** — Documentation is maintained and updated with code changes

---

## Version Information

| Component | Value |
|-----------|-------|
| Backend Version | 1.1.0 |
| Laravel Framework | 12.x |
| PHP Version | 8.2+ |
| Database | MySQL 8.0+ |
| Test Count | 308 passing (708 assertions) |
| Documentation Last Updated | March 2026 |

---

**Document Status:** Authoritative
**Last Updated:** March 2026
**Version:** 2.0.0
