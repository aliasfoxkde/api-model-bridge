# Architectural Limitations

**Date:** 2026-08-22

This document outlines known limitations in the web-model-bridge project that cannot be resolved without significant architectural changes.

---

## 1. Test Coverage Ceiling (~90%)

**Limitation:** True 99% test coverage is not achievable without CDP mocking infrastructure.

### Why

The project relies on Chrome DevTools Protocol (CDP) via Playwright for:
- Browser-based authentication detection
- Cookie extraction from live browser sessions
- In-browser fetch requests for authenticated API calls
- Provider login detection via DOM observation

These operations require a real browser instance, which cannot be reliably mocked at the unit test level without extensive infrastructure.

### Current Coverage

| Module | Achievable | Notes |
|--------|------------|-------|
| `src/config/` | ~95% | Fully testable without browser |
| `src/core/` | ~90% | Stream formatting, routing, errors |
| `src/routes/` | ~85% | HTTP handlers, auth middleware |
| `src/providers/` | ~40% | Requires CDP/browser for real testing |
| `src/browser/` | ~30% | Playwright CDP interactions |
| `src/auth/` | ~80% | File-based, testable |

### Path to 99%

To achieve 99% coverage, the project would need:

1. **CDP Mock Server** - A mock CDP server that simulates Chrome's debugging interface
2. **Synthetic Cookie Stores** - Pre-configured auth states for each provider
3. **In-Browser Eval Mocking** - Intercept `page.evaluate()` calls
4. **Network Interception** - Mock fetch responses from provider APIs

This is equivalent to building a browser automation testing framework, which is beyond the project's scope.

### Current Threshold

The project targets **90% coverage** on unit-testable code (config, core, routes, auth), with E2E tests covering the browser-dependent paths.

---

## 2. ESLint Type Checking Timeouts

**Limitation:** Running `typescript-eslint` with `parserOptions.project` enabled causes timeouts in resource-constrained environments.

### Why

Type-aware linting with `typescript-eslint` requires:
- Loading the full TypeScript compiler
- Building program graphs for all source files
- Resolving type information for every reference

In environments with limited CPU/memory (such as CI runners or sandboxed containers), this can exceed reasonable time limits.

### Workaround

The ESLint configuration (`eslint.config.js`) is configured to run without type checking for provider/browser code, and with type checking only for core modules where feasible.

For strict type-aware linting, run locally:
```bash
npx eslint src tests --max-warnings 0
```

---

## 3. WCAG 2.1 AAA Conformance

**Limitation:** The dashboard achieves WCAG 2.1 AA compliance but has gaps for AAA conformance.

### AAA Gaps Identified

| Criterion | Status | Notes |
|-----------|--------|-------|
| 1.4.6 Contrast (Enhanced) | AA only | Some text doesn't meet 7:1 ratio |
| 2.2.2 Pause, Stop, Hide | Partial | Some animations cannot be disabled |
| 2.4.7 Focus Visible | AA | Custom focus indicators needed |
| 2.4.11 Focus Not Obscured | Partial | Modal overlays may obscure focus |
| 3.1.5 Reading Level | N/A | Content is programmatic, not natural language |

### Rationale

WCAG AAA conformance is intentionally not targeted because:
- Enhanced contrast ratios (7:1) severely limit design aesthetics
- Some provider APIs return content that cannot be controlled
- The dashboard is an admin tool, not a public-facing application
- Full AAA compliance would require significant design overhaul

---

## Summary

| Goal | Achievable | Notes |
|------|------------|-------|
| 90% coverage | ✓ Yes | Current target |
| 99% coverage | ✗ No | Requires CDP mocking |
| WCAG AA | ✓ Yes | Achieved |
| WCAG AAA | Partial | Some gaps remain |
| ESLint strict | Limited | Type checking times out in constrained envs |

These limitations are documented honestly to set correct expectations for contributors and users.
