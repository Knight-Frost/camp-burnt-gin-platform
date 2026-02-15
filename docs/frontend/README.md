# Camp Burnt Gin Frontend

Production-grade HIPAA-compliant frontend for Camp Burnt Gin registration and management platform.

## Project Overview

**Version:** 1.0.0
**Backend API:** Laravel 12.0 REST API
**Compliance:** HIPAA, WCAG 2.1 AA
**Architecture:** Feature-Driven Architecture (FDA)

## Technology Stack

- React 18.3
- TypeScript 5.7 (strict mode)
- Vite 6.0
- Redux Toolkit 2.5
- React Router 7.0
- Tailwind CSS 4.0
- Framer Motion 12.4
- Zod 3.24

## Getting Started

### Prerequisites

- Node.js 20+
- npm or pnpm
- Backend API running on http://localhost:8000

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Application will be available at http://localhost:5173

### Build

```bash
npm run build
```

### Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

### Code Quality

```bash
# Linting
npm run lint

# Type checking
npm run type-check

# Formatting
npm run format
```

## Project Structure

See architectural blueprint for complete folder structure documentation.

## Security

This application handles Protected Health Information (PHI) and implements strict security controls:

- Memory-only token storage
- Zero PHI persistence
- HIPAA-compliant session management
- Permission-based access control
- Input validation via Zod schemas

## License

Proprietary - Camp Burnt Gin
