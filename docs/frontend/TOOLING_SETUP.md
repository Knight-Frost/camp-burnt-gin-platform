# Frontend Development Tooling Reference

**Document Version:** 1.0
**Last Updated:** 2026-02-14
**Maintainer:** Development Team

---

## 1. Executive Summary

This document provides configuration details, usage instructions, and maintenance guidance for frontend development tools. The tooling stack includes accessibility auditing, performance monitoring, visual accuracy verification, and motion inspection capabilities.

---

## 2. Purpose and Scope

### 2.1 Purpose

This reference document serves as the authoritative guide for frontend development tooling configuration and usage. It provides installation procedures, command-line interface instructions, and integration specifications.

### 2.2 Scope

The document covers:

- VS Code editor configuration
- Accessibility testing tools (Lighthouse, axe-core)
- Performance monitoring (bundle analyzer, compression)
- Design token validation
- Motion and animation inspection
- CI/CD integration specifications

---

## 3. VS Code Configuration

### 3.1 Required Extensions

The following VS Code extensions enhance development productivity:

| Extension ID | Name | Purpose |
|-------------|------|---------|
| bradlc.vscode-tailwindcss | Tailwind CSS IntelliSense | Auto-completion and syntax highlighting for Tailwind classes |
| esbenp.prettier-vscode | Prettier | Code formatting |
| dbaeumer.vscode-eslint | ESLint | JavaScript/TypeScript linting |
| csstools.postcss | PostCSS Language Support | PostCSS syntax highlighting |
| usernamehm.errorlens | Error Lens | Inline error and warning display |
| streetsidesoftware.code-spell-checker | Code Spell Checker | Spelling verification |
| ms-playwright.playwright | Playwright Test | End-to-end test support |

**Installation Method:**

Extensions are recommended via `.vscode/extensions.json`. VS Code will prompt for installation upon project opening.

### 3.2 Workspace Settings

Location: `.vscode/settings.json`

**Key Configurations:**

**Tailwind IntelliSense:**
```json
{
  "tailwindCSS.experimental.classRegex": [
    ["clsx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"],
    ["cn\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"],
    ["className\\s*:\\s*['\"]([^'\"]*)['\"]", "([\\w-:./]+)"]
  ],
  "tailwindCSS.validate": true,
  "tailwindCSS.includeLanguages": {
    "typescript": "javascript",
    "typescriptreact": "javascript"
  }
}
```

**Editor Configuration:**
```json
{
  "css.validate": false,
  "editor.quickSuggestions": {
    "strings": true
  },
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```

### 3.3 CSS Custom Property IntelliSense

Location: `.vscode/css-custom-data.json`

This file provides autocomplete and documentation for design token CSS variables. Refer to the file for the complete property list.

---

## 4. Accessibility Tooling

### 4.1 Installed Packages

| Package | Version | Purpose |
|---------|---------|---------|
| lighthouse | 13.0.3 | Performance and accessibility auditing |
| axe-core | 4.11.1 | Core accessibility testing engine |
| @axe-core/cli | 4.11.1 | Command-line accessibility testing |
| @axe-core/react | 4.11.1 | React-specific accessibility testing |
| eslint-plugin-jsx-a11y | 6.10.2 | JSX accessibility linting |

### 4.2 Command-Line Interface

**Full Accessibility Audit:**
```bash
npm run a11y
```

Executes Lighthouse and axe-core audits. Generates `lighthouse-report.html` with detailed findings.

**Lighthouse Only:**
```bash
npm run a11y:lighthouse
```

Runs Lighthouse audit against preview server (http://localhost:4173). Requires prior build execution.

**axe-core Only:**
```bash
npm run a11y:axe
```

Runs axe accessibility checks. Requires preview server to be running.

**Development Server Quick Check:**
```bash
npm run a11y:dev
```

Runs axe-core against development server (http://localhost:5173). No build required.

### 4.3 Lighthouse Configuration

Location: `lighthouse.config.js`

**Threshold Specifications:**

- Accessibility: Minimum 90% (WCAG AA compliance)
- Performance: Minimum 85%
- Best Practices: Minimum 90%

**Configuration Parameters:**

```javascript
{
  formFactor: 'desktop',
  screenEmulation: {
    width: 1350,
    height: 940,
    deviceScaleFactor: 1
  },
  throttling: {
    rttMs: 40,
    throughputKbps: 10240,
    cpuSlowdownMultiplier: 1
  }
}
```

### 4.4 ESLint Accessibility Rules

Active rules in `.eslintrc.cjs`:

```javascript
{
  'jsx-a11y/anchor-is-valid': 'error',
  'jsx-a11y/no-autofocus': 'warn',
  'jsx-a11y/alt-text': 'error',
  'jsx-a11y/aria-props': 'error',
  'jsx-a11y/aria-role': 'error'
}
```

---

## 5. Performance Monitoring

### 5.1 Installed Packages

| Package | Version | Purpose |
|---------|---------|---------|
| rollup-plugin-visualizer | 6.0.5 | Bundle composition visualization |
| vite-plugin-compression | 0.5.1 | Gzip compression generation |

### 5.2 Command-Line Interface

**Bundle Analysis:**
```bash
npm run analyze
```

Builds the application and opens bundle visualization at `dist/stats.html`. Displays:
- Chunk sizes (gzipped and brotli)
- Module dependencies
- Largest modules

**Performance Audit:**
```bash
npm run perf
```

Executes build, starts preview server, and runs Lighthouse performance audit. Generates comprehensive performance report.

### 5.3 Vite Configuration

Location: `vite.config.ts`

**Bundle Analyzer Settings:**

```typescript
visualizer({
  filename: './dist/stats.html',
  open: false,
  gzipSize: true,
  brotliSize: true
})
```

**Compression Settings:**

```typescript
viteCompression({
  algorithm: 'gzip',
  ext: '.gz',
  threshold: 10240  // 10KB minimum
})
```

**Manual Chunking Strategy:**

```typescript
manualChunks: {
  'vendor-react': ['react', 'react-dom', 'react-router-dom'],
  'vendor-redux': ['@reduxjs/toolkit', 'react-redux'],
  'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-accordion', ...],
  'vendor-motion': ['framer-motion']
}
```

### 5.4 Performance Budgets

**Landing Page Chunk Budget:** Less than 60KB gzipped

Monitor bundle size with each build. The analyzer identifies chunks exceeding budget thresholds.

---

## 6. Design Token Validation

### 6.1 Token Reference

Authoritative design tokens are documented in `FIGMA_DESIGN_TOKENS.md`.

### 6.2 Validation Methods

**Manual Validation:**

1. Compare component styles against token specification
2. Verify no hardcoded pixel values in new code
3. Ensure all colors reference CSS custom properties
4. Check shadow definitions against token system

**Automated Validation:**

ESLint rules enforce token usage. The `no-console` rule prevents unauthorized console statements:

```javascript
{
  'no-console': ['warn', { allow: ['warn', 'error'] }]
}
```

---

## 7. Motion and Animation Inspection

### 7.1 Framer Motion Utilities

Location: `src/utils/motion.ts`

**Exported Constants:**

```typescript
EASING = {
  smooth: [0.25, 0.1, 0.25, 1],
  linear: [0, 0, 1, 1],
  easeIn: [0.42, 0, 1, 1],
  easeOut: [0, 0, 0.58, 1],
  easeInOut: [0.42, 0, 0.58, 1]
}

DURATION = {
  fast: 0.15,
  base: 0.25,
  slow: 0.4,
  hover: 0.5,
  content: 1.2,
  hero: 1.4,
  theme: 1.5
}
```

**Utility Functions:**

- `useReducedMotion()` - Hook for detecting reduced motion preference
- `getMotionVariant()` - Returns variant based on reduced motion setting
- `safeAnimation()` - Wraps animation with reduced motion support
- `AnimationMonitor` - Performance monitoring class
- `validateAnimation()` - Validates animation against design system

### 7.2 Browser DevTools

**Chrome:**

Performance tab provides animation timeline. Record during interaction to analyze frame rate and identify performance issues.

**Firefox:**

Inspector panel includes Animations tab for inspecting running animations.

### 7.3 Reduced Motion Detection

Verify reduced motion support in components:

```typescript
const shouldReduceMotion = useReducedMotion();
const duration = shouldReduceMotion ? 0 : 1.4;
```

All motion-heavy components must respect `prefers-reduced-motion` media query.

---

## 8. Development Workflow

### 8.1 Pre-Commit Checklist

Execute before committing code:

```bash
npm run lint
npm run type-check
npm run test
```

### 8.2 Weekly Audit Schedule

**Accessibility:**
```bash
npm run a11y
```

Execute weekly. Review generated report and address violations.

**Bundle Analysis:**
```bash
npm run analyze
```

Execute weekly. Monitor bundle size trends and identify optimization opportunities.

### 8.3 Pre-Release Checklist

Execute before production deployment:

1. Run full test suite
2. Execute accessibility audit
3. Execute performance audit
4. Verify bundle size within budget
5. Review Lighthouse report scores

---

## 9. CI/CD Integration

### 9.1 GitHub Actions Integration

**Accessibility Testing:**

```yaml
- name: Run accessibility tests
  run: npm run a11y

- name: Upload Lighthouse report
  uses: actions/upload-artifact@v3
  with:
    name: lighthouse-report
    path: lighthouse-report.html
```

**Bundle Size Monitoring:**

```yaml
- name: Analyze bundle
  run: npm run analyze

- name: Check bundle size
  run: |
    # Custom script to verify bundle size against budget
    node scripts/check-bundle-size.js
```

### 9.2 Pre-Commit Hook Integration

Install husky for git hook management:

```bash
npm install --save-dev husky lint-staged
npx husky init
```

Configure `.husky/pre-commit`:

```bash
#!/bin/sh
npm run lint
npm run type-check
```

Configure `package.json`:

```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,css}": [
      "prettier --write"
    ]
  }
}
```

---

## 10. Maintenance Guidance

### 10.1 Package Updates

Update development tools quarterly:

```bash
npm update --save-dev lighthouse axe-core @axe-core/cli rollup-plugin-visualizer
```

Test thoroughly after updates. Verify tool configurations remain compatible.

### 10.2 Configuration Audits

Review `.vscode/settings.json` and `lighthouse.config.js` quarterly. Update thresholds and configurations as project requirements evolve.

### 10.3 Documentation Updates

Update this document when:

1. New tools are added to the stack
2. NPM scripts are modified
3. CI/CD integration changes
4. Threshold values are adjusted
5. Workflow procedures change

Maintain version number and last updated date in document header.

---

## 11. Troubleshooting

### 11.1 Lighthouse Fails to Run

**Symptom:** Lighthouse command errors or times out.

**Solution:**
1. Verify preview server is running: `npm run preview`
2. Check port 4173 is available
3. Increase timeout in package.json script
4. Verify Lighthouse CLI installation: `lighthouse --version`

### 11.2 axe-core Reports False Positives

**Symptom:** axe-core reports violations for compliant code.

**Solution:**
1. Review axe-core documentation for specific rule
2. Add inline axe disable comments if necessary:
   ```typescript
   {/* axe-core disable-next-line rule-name */}
   ```
3. Configure axe-core rules in `.axerc.json` if needed

### 11.3 Bundle Analyzer Not Opening

**Symptom:** `npm run analyze` completes but browser does not open.

**Solution:**
1. Manually open `dist/stats.html` in browser
2. Verify build completed successfully
3. Check console output for errors

---

## 12. Conclusion

This document provides comprehensive tooling reference for frontend development. Adherence to documented procedures ensures consistent code quality, accessibility compliance, and performance optimization. Update this document when tooling configurations change.
