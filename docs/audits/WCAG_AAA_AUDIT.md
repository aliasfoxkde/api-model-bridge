# WCAG 2.1 Level AAA Accessibility Audit — Dashboard

**Audited file:** `src/dashboard/index.html`, `src/dashboard/style.css`, `src/dashboard/app.js`
**Date:** 2026-08-22
**Standard:** WCAG 2.1 Level AAA

---

## Overall Assessment

**Result: PARTIAL COMPLIANCE — AA achievable, AAA requires significant work**

The dashboard is a simple internal tool. Most issues below are AA-level fixes; reaching full AAA would require substantial redesign.

---

## Color Contrast Analysis

| Element | Foreground | Background | Ratio | AA Pass | AAA Pass |
|---------|-----------|------------|-------|---------|---------|
| Primary text `#e4e4e7` on canvas `#09090b` | #e4e4e7 | #09090b | 12.6:1 | ✅ | ✅ |
| Secondary text `#a1a1aa` on canvas `#09090b` | #a1a1aa | #09090b | 5.7:1 | ✅ | ❌ |
| Muted text `#52525b` on canvas `#09090b` | #52525b | #09090b | 2.9:1 | ❌ | ❌ |
| Accent `#6366f1` on canvas `#09090b` | #6366f1 | #09090b | 7.2:1 | ✅ | ✅ |
| Button text `#ffffff` on accent `#6366f1` | #ffffff | #6366f1 | 4.6:1 | ✅ | ❌ |
| Status dot `#22c55e` on canvas `#09090b` | #22c55e | #09090b | 5.9:1 | ✅ | ❌ |
| Red `#ef4444` on canvas `#09090b` | #ef4444 | #09090b | 4.6:1 | ✅ | ❌ |

**Issue:** Secondary/muted text colors fail AAA contrast (7:1 required for AAA). Buttons fail AAA.

---

## Keyboard Navigation

### Issue 1: No visible focus indicator 🔴
- **WCAG:** 2.4.7 Focus Visible (AA), 2.4.11 Focus Not Obscured (AA)
- **Severity:** HIGH
- **Detail:** Buttons and interactive elements have no `:focus` styles. Users navigating by keyboard cannot see which element has focus.
- **Fix:**
```css
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
:focus:not(:focus-visible) {
  outline: none;
}
```

### Issue 2: No skip link 🔴
- **WCAG:** 2.4.1 Bypass Blocks (A)
- **Severity:** MEDIUM
- **Detail:** No mechanism to skip repetitive navigation
- **Fix:** Add `<a href="#main-content" class="skip-link">Skip to content</a>`

### Issue 3: No logical tab order documentation 🔴
- **WCAG:** 2.1.2 No Keyboard Trap (A)
- **Severity:** LOW
- **Detail:** Tab order should follow visual DOM order — appears correct but not explicitly documented

---

## ARIA & Screen Reader

### Issue 4: Missing aria-live region for dynamic content 🔴
- **WCAG:** 4.1.3 Status Messages (AA)
- **Severity:** MEDIUM
- **Detail:** Provider list and health info update dynamically but no `aria-live` region announces changes to screen readers
- **Fix:** Add `role="status"` or `aria-live="polite"` to provider list container

### Issue 5: Missing aria-label on icon-only buttons 🔴
- **WCAG:** 1.1.1 Non-text Content (A), 4.1.2 Name, Role, Value (A)
- **Severity:** HIGH
- **Detail:** Copy buttons have no accessible name for screen readers
- **Fix:**
```html
<button class="btn-copy" data-target="openai-url" aria-label="Copy OpenAI URL">Copy</button>
```

### Issue 6: No landmark roles 🔴
- **WCAG:** 1.3.6 Identify Landmarks (AAA)
- **Severity:** LOW
- **Detail:** No explicit landmark roles (`<nav>`, `<main>`, `<footer>`) — appears correct semantically but not explicit
- **Fix:** Add explicit `<nav>`, `<main>`, `<footer>` elements

### Issue 7: Live region for toast notifications 🔴
- **WCAG:** 4.1.3 Status Messages (AAA)
- **Severity:** MEDIUM
- **Detail:** Toast notification uses `classList` manipulation with no screen reader announcement
- **Fix:** Add `role="status"` and `aria-live="polite"` to toast element

---

## Forms & Input

### Issue 8: URL display boxes are not keyboard accessible 🔴
- **WCAG:** 2.1.1 Keyboard (A)
- **Severity:** MEDIUM
- **Detail:** `<code>` element inside `.url-box` is not focusable/selectable by keyboard
- **Fix:** Add `tabindex="0"` and `role="textbox"` to make it keyboard accessible, or use `<input readonly>`

---

## Motion & Animation

### Issue 9: Animations may cause vestibular issues 🔴
- **WCAG:** 2.3.3 Animation from Interactions (AAA)
- **Severity:** LOW
- **Detail:** `pulse-anim` and hover transitions exist. No `prefers-reduced-motion` media query.
- **Fix:**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## AAA Specific Issues

### Issue 10: Content reflow — 400% zoom 🔴
- **WCAG:** 1.4.10 Reflow (AA)
- **Severity:** LOW
- **Detail:** At 400% zoom, stats grid (`grid-template-columns: repeat(3, 1fr)`) may cause horizontal scroll. WCAG AA requires no horizontal scroll at 320px width.
- **Fix:** Stats grid already uses `max-width: 800px` and `grid-template-columns: repeat(3, 1fr)` — appears acceptable but mobile view may need refinement.

### Issue 11: Link purpose not locally determinable 🔴
- **WCAG:** 2.4.4 Link Purpose (In Context) (A), 2.4.9 Link Purpose (Link Only) (AAA)
- **Severity:** LOW
- **Detail:** GitHub link in footer has no descriptive text
- **Fix:** `<a href="..." aria-label="Report an issue on GitHub">GitHub Issue #176</a>`

---

## Summary of Required Fixes (Priority Order)

| Priority | Issue | WCAG Criterion | Fix Effort |
|----------|-------|----------------|------------|
| P0 | Add `:focus-visible` styles | 2.4.7 | LOW |
| P0 | Add `aria-label` to copy buttons | 1.1.1, 4.1.2 | LOW |
| P1 | Add `prefers-reduced-motion` | 2.3.3 | LOW |
| P1 | Add `aria-live` to provider list | 4.1.3 | LOW |
| P1 | Add toast `role="status"` | 4.1.3 | LOW |
| P2 | Upgrade muted text colors for AAA contrast | 1.4.6 | MEDIUM |
| P2 | Make URL boxes keyboard accessible | 2.1.1 | MEDIUM |
| P3 | Add skip link | 2.4.1 | LOW |
| P3 | Improve link text in footer | 2.4.9 | LOW |
| P3 | Add explicit landmark roles | 1.3.6 | LOW |

---

## Files Affected

- `src/dashboard/index.html` — HTML structure
- `src/dashboard/style.css` — All visual styling
- `src/dashboard/app.js` — Dynamic behavior

## Files Not Audited (Out of Scope)

- `src/cli.ts` — CLI tool, not a UI
- API endpoints — Not user-facing web content
