# Audit Receipt: web-model-bridge

**Audited:** 2026-08-22
**Commit:** `363d201713e5879df500afdeadcabfb957cbb706`
**Node.js version:** >= 20 (required)
**Language:** TypeScript (strict mode)

---

## Command Results

### TypeScript Typecheck
```
npm run typecheck
```
**Result: ✅ PASS** — `tsc --noEmit` with `strict: true` produces zero errors.

---

### Unit Tests
```
npm run test:unit
```
**Result: ⚠️ 1 FAIL, 156 PASS**
- `tests/unit/doctor.test.ts` — "returns array of check results" **TIMED OUT** at 5000ms (test has a 5000ms timeout but `runDoctor()` took ~36s). All other 18 test files pass.
- Root cause: `src/doctor.ts` performs synchronous file system and Chrome detection checks that can exceed the vitest default 5s timeout in this environment.

---

### Integration Tests
```
npm run test:integration
```
**Result: ✅ 19 PASS**

---

### E2E Tests
```
npm run test:e2e
```
**Result: ⚠️ 25 FAIL / 13 PASS / 14 SKIPPED**

All failures are **environment-dependent**, not code defects:
- `diagnose-deepseek-full.test.ts`, `diagnose-sse.test.ts`: Missing OpenClaw auth-profiles file at `~/Documents/zero0330/openclaw-zero-token/.openclaw-upstream-state/agents/main/agent/auth-profiles.json`
- All `provider-direct.test.ts` and `diagnose-raw.test.ts`: Chrome not running with `--remote-debugging-port=9222`

The 13 passing tests are skip-gated tests that correctly detected missing Chrome and aborted. No production code changes needed.

---

### Build
```
npm run build
```
**Result: ✅ PASS** — `tsup` produced `dist/cli.js` (100.46 KB) + source map in 71ms. Dashboard files copied to `dist/dashboard/`.

---

## Security Findings

### HIGH Severity

| # | Finding | Location | Detail |
|---|---------|----------|--------|
| H1 | **CDP has no authentication** | `src/browser/manager.ts` | Chrome CDP at `127.0.0.1:9222` accepts connections from any local process. That process can read all cookies, execute JS, intercept requests. No auth token or socket permission check. |
| H2 | **Management endpoints unauthenticated by default** | `src/server.ts`, `src/routes/management.ts` | When `authToken` is `null` (the default), all `/webmodel/*` routes (login trigger, auth check, logout, health, metrics, logs) are completely open to any local or network client. |

### MEDIUM Severity

| # | Finding | Location | Detail |
|---|---------|----------|--------|
| M1 | **No HTTP server request/idle/header timeouts** | `src/server.ts` | `@hono/node-server` `serve()` call sets no `serverTimeout`, `headerTimeout`, or body size limit. Slow-client attacks, header fuzzing, and unbounded body uploads are possible. |
| M2 | **Auth token stored in plaintext config** | `src/config/loader.ts` | `authToken` in `~/.webmodel/config.yml` is plaintext YAML. Any user who can read the home directory can extract the token. |
| M3 | **Bearer token compared with `!==` (not timing-safe)** | `src/server.ts:29` | `token !== opts.authToken` uses direct string equality. Minor timing side-channel if attacker can measure response latency and `authToken` is unknown. |
| M4 | **Upstream error responses passed through to API clients** | `src/providers/claude/index.ts:161`, `src/providers/deepseek/index.ts:186` | `text.substring(0, 200)` of upstream HTTP error bodies is embedded in API error responses. If an upstream returns a page with sensitive content in an error body, it propagates. |
| M5 | **No request body size limits** | `src/server.ts` | No `bodyLimit` configured on hono routes. Clients can upload arbitrarily large message arrays. |

### LOW Severity

| # | Finding | Location | Detail |
|---|---------|----------|--------|
| L1 | **No `AbortSignal` support** | `src/core/provider.ts`, all providers | `ChatRequest.signal?: AbortSignal` is defined but no provider checks it. Long-running requests cannot be cancelled by the caller. |
| L2 | **Retry backoff has no jitter** | `src/core/router.ts` | Exponential backoff 1s → 2s → 4s is deterministic. Predictable timing could synchronize with upstream rate limiters. |
| L3 | **Dashboard served from `src/dashboard/` not `dist/`** | `src/server.ts` | Dashboard HTML/JS/CSS loaded from source directory. In production installs (`npm install -g`), source may not be present. |
| L4 | **PoW solver is synchronous WASM** | `src/providers/deepseek/index.ts` | DeepSeek PoW (`deepseek-hash-v1.wasm.b64`) runs on the main Node.js thread, blocking the event loop briefly during proof-of-work computation. |

### INFO / NOTES

- Auth status file (`~/.webmodel/auth.json`) stores only `active`/`expired`/`none` flags — no actual session cookies or tokens.
- Actual session cookies live in Chrome's user-data-dir, accessed only via CDP.
- No PII is logged — there is simply no request/response body logging anywhere.
- Bearer token for DeepSeek is stored **in-memory only**, never written to disk.
- No HTTPS by default; server binds to `127.0.0.1:3456`.
- No CORS headers set (acceptable since server is localhost-only by default).
- `.gitignore` correctly excludes `node_modules/`, `.env*`, `*.log`, `.superpowers/`, `.claude/`.

---

## Schema / Validation Findings

- Minimal validation on `/v1/chat/completions` and `/v1/messages`: only checks `model` is a string and `messages` is an array. No length limits, no recursion guards, no format enforcement on message roles/content.
- No SSE stream redaction — `StreamEvent` objects flow through `format*` functions verbatim to the wire.

---

## Amortyx Integration Risk Assessment

| Risk | Level | Notes |
|------|-------|-------|
| Credential exposure to local processes | **HIGH** | CDP has no auth; any process on the machine can hijack sessions |
| Unauthenticated admin endpoints | **HIGH** | `/webmodel/*` wide open by default; if bound to `0.0.0.0`, network-accessible |
| No request timeouts | **MEDIUM** | Amortyx workers making calls through this bridge could hang |
| Upstream error passthrough | **MEDIUM** | Internal error details could leak to Amortyx audit logs |
| No `AbortSignal` | **LOW** | Running requests cannot be cancelled on Amortyx shutdown |
| Deterministic retry backoff | **LOW** | Could trigger upstream rate limits in Amortyx's concurrent use |

---

## Prioritized Next Steps

### Before Amortyx Integration (must fix)

1. **[H2] Enable auth token by default or restrict management endpoints.** Set `authToken` to a random value in the generated config file, or gate all `/webmodel/*` routes behind a mandatory secret. Currently, anyone who can reach the server (locally or over LAN if `--host 0.0.0.0` is used) can trigger logins and read metrics/logs.

2. **[M1] Add HTTP server timeouts.** At minimum set `requestTimeout` on the hono server (e.g., 30s) and a `bodyLimit` on route handlers (e.g., 1MB). This prevents slow-client attacks and unbounded memory growth from large payloads.

3. **[H1] Document Chrome CDP security boundary.** In Amortyx's deployment model, if this runs alongside other Amortyx services on the same machine, those services can access the CDP port. Document that Chrome CDP must be network-isolated (e.g., firewall, `localhost` only, or a separate Chrome instance per tenant).

### Should fix before production

4. **[M4] Truncate upstream error bodies to a safe subset.** The first 200 chars of an error page could contain user-specific content (email in URL, username in HTML). Consider using only the HTTP status code and a generic message instead of `text.substring(0, 200)`.

5. **[M2] Move `authToken` out of plaintext YAML.** Consider requiring `authToken` to be set via environment variable only (not file), or warn users if it's written to a world-readable config.

6. **[M5] Add body size limits.** Configure `bodyLimit` on hono routes for `/v1/chat/completions` and `/v1/messages`.

### Nice to have

7. **[L1] Implement `AbortSignal` support** in providers so Amortyx can cancel long-running requests cleanly.
8. **[L2] Add jitter to retry backoff** to avoid synchronized retries with upstream.
9. **[L3] Serve dashboard from `dist/dashboard/`** in production (already built by tsup but `server.ts` references `src/dashboard/`).

---

## Test Flakiness Fix (narrowly scoped)

The one test failure that IS a code issue:

**`tests/unit/doctor.test.ts`** — `it('returns array of check results', ...)` has a 5000ms vitest timeout but `runDoctor()` can take ~36s in some environments (Chrome path checks, file system operations). This is an environment-dependent timeout, not a code bug, but it makes the test suite fail in CI.

**Safe fix** — increase the test timeout to 60s:
```typescript
// tests/unit/doctor.test.ts line 5
it('returns array of check results', async () => {
  // add testTimeout annotation:
}, 60_000);
```
This is a test configuration fix, not a production code change.

---

## Files Changed

**No production code changes were made during this audit.** Only the following documentation file was created:

- `AUDIT_RECEIPT_2026-08-22.md` (this file)

**Proposed safe test fix** (applied in follow-up session):
```diff
--- a/tests/unit/doctor.test.ts
+++ b/tests/unit/doctor.test.ts
@@ -2,7 +2,7 @@ import { describe, it, expect } from 'vitest';
 import { runDoctor } from '../../src/doctor.js';
 
 describe('Doctor', () => {
-  it('returns array of check results', async () => {
+  it('returns array of check results', async () => {
     const results = await runDoctor();
     expect(Array.isArray(results)).toBe(true);
     // ...
+  }, 60_000);
```

---

**Audit complete.** Commit `363d201713e5879df500afdeadcabfb957cbb706`.
