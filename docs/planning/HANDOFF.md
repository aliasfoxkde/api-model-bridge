# API Model Bridge Handoff

**Repository:** `aliasfoxkde/api-model-bridge`  
**Component:** `web-model-bridge`  
**Ledger date:** 2026-10-20  
**Branch:** `worktree-readiness-hardening-20261019` (hardening lane; never deploy/merge without platform review)  
**Status:** Experimental integration candidate; deterministic repository gates are
qualified, provider/browser production readiness is not.

See `PLATFORM_INTEGRATION.md` for the canonical API and ownership contract.

## 2026-10-19/20 audit: live service vs source contract

**Verdict: stale deployment. The source contract is correct; the running
service predates it.**

Evidence, all captured read-only (no state was altered):

| Observation | Value |
| --- | --- |
| Serving process | PID 2004, `/usr/bin/node /home/mkinney/work/api-model-bridge-validation-20260828/dist/cli.js --host 127.0.0.1 --port 3456 --no-open --state-dir /home/mkinney/.webmodel --browser-mode attach --cdp-url http://127.0.0.1:9222` |
| Deployed artifact mtime | `2026-08-28 13:25` (`dist/cli.js`) |
| Deployed clone source | `src/routes/management.ts` contains `uptime` and **zero** occurrences of `readiness` |
| Live `GET /webmodel/health` (2026-10-20T04:54Z) | 200 with `status`, `uptime` (662,078 s), `browser`, `providers` — **no `ready`, no `readiness`** |
| Live `GET /v1/models` | `{"object":"list","data":[]}` — truthful: every provider reports `authenticated: false`, `models: 0`, browser `stopped` |
| Readiness in source | Commit `9622bcd` (PR #4, merged 2026-10-07) added `ready`/`readiness` with tests |

Implications:

- Consumers gating on `ready` correctly see the missing field as falsy, so the
  additive-field design protected them; the operator-visible symptom
  (`{"status":"healthy"}` only) was an artifact of the August build.
- The zero-entry `/v1/models` response is correct behavior, not a bug: no
  provider is authenticated on that instance.
- Remediation for the instance itself (out of scope here, nothing was
  restarted): rebuild from current `master` and restart under the operator's
  own procedures, then confirm `ready`, `readiness`, and `version` appear in
  the health body.

## Changes in this branch

Deterministic hardening of readiness/health semantics and diagnostics:

1. `src/core/registry.ts` — `providerStatus()` now contains per-provider
   adapter failures: a throwing `isAuthenticated()`/`models()` yields
   `authenticated: false`, `modelCount: 0`, and a surfaced `error` string
   instead of breaking the always-200 liveness contract. `ProviderStatus`
   gained `loginUrl` (operator action) and `error?`.
2. `src/routes/management.ts` + `src/server.ts` + `src/cli.ts` — health
   response now reports `version` (read at runtime from the deployed
   `package.json`, `null` when unavailable) so stale deployments are
   detectable from the outside; provider entries surface `error` when their
   adapter failed. The CLI banner version now reads the same source.
3. Tests that make false readiness impossible to miss: authenticated-but-
   zero-models cannot be ready; a failing adapter cannot break liveness and
   cannot be counted ready; version propagation; registry containment.
4. `PLATFORM_INTEGRATION.md` — additive documentation of `version`, `error`
   surfacing, `loginUrl`, and the liveness guarantee under adapter failure.

## Validation receipts (this branch, this host)

All commands bounded, run from this worktree on NVMe
(`/dev/nvme0n1p3`, btrfs, non-rotating — confirmed before testing):

| Check | Result |
| --- | --- |
| `npm ci` (canonical, with scripts) | Pass: 445 packages |
| `npm run typecheck` | Pass |
| `npm run lint` | Fails honestly: 35 errors / 214 warnings repo-wide, all pre-existing debt; touched files contribute 0 errors and only pre-existing-category warnings (cli.ts `no-console`, server.ts middleware `any`) |
| `npm run test:unit` | Pass: 21 files, 219 tests |
| `npm run test:integration` | Pass: 4 files, 19 tests |
| `npm run build` | Pass: `dist/cli.js` (103 KB) |
| `node dist/cli.js --version` | Pass: `0.1.0` read from deployed `package.json` |
| provider/browser E2E | **Not claimed** — requires an authenticated browser session; none was used |

Environment deviations, disclosed:

- Local Node is `v20.18.2`, below the repository's declared `>=20.19.0`
  engine floor (CI uses 22.12.0). Consequence encountered: npm silently skips
  the `@rolldown/binding-linux-x64-gnu` optional dependency (engines-gated),
  which broke vitest until the binding was installed directly. Future local
  runs on this host should either upgrade Node or re-install that binding.
- GitForge (`~/.local/bin/gitforge`) is installed but not authenticated in
  this session and this repository has no `.gitforge.yml` pipeline; the
  canonical full-validation lane for this repo remains GitHub CI
  (`.github/workflows/ci.yml`). GitForge was therefore not used.

## Explicit non-claims

- No authenticated real-provider request was made; **no provider availability
  or capability is claimed**.
- No browser sessions were started, no cookies or credentials copied,
  no private user content accessed, and the running service on 127.0.0.1:3456
  was not altered. GPU was not used.

## Milestone ledger

Concrete, evidence-gated milestones. Each milestone needs a dated receipt in
this file (command, commit, result, limitations) before it may be checked.

### M1 — Provider qualification (highest value)

- [ ] Stand up one explicitly authenticated provider session (operator-driven
  login; browser/profile stays outside the repository).
- [ ] For each advertised `{provider}/{model}`: real authenticated request,
  structured response validation, failure classification, recorded as
  `{model-id, request-class, timestamp, commit, result}` in this ledger.
- [ ] Mark every unqualified model as unqualified wherever it is advertised.
- **Gate:** no readiness or marketing claim may cite a model without its
  receipt row. Health 200 and `ready: true` alone do not satisfy this.

### M2 — Tool/vision semantics

- [ ] Define a minimal tool-call probe (definition in, observable tool_call
  event out) and a vision probe (image in, grounded reference out) per
  provider class.
- [ ] Run both against qualified M1 sessions; record pass/fail per model.
- **Gate:** OpenAI/Anthropic wire compatibility is explicitly not evidence of
  semantic support; capability metadata comes from observed behavior only.

### M3 — Bounded concurrency

- [ ] Wire `src/core/queue.ts` (`ProviderQueue`) — it currently exists but is
  dead code, so chat routes have no admission control.
- [ ] Add per-provider serialization, a global concurrent-request cap, queue
  timeout, and browser-tab acquisition timeout; expose queue depth via
  `/webmodel/metrics`.
- [ ] Bounded-load test through the remote validation lane (no unconstrained
  local browser processes).
- **Gate:** a burst of N requests cannot spawn unbounded browser work or
  exhaust host resources.

### M4 — Security

- [ ] Default-deny for non-loopback binds: refuse to serve on non-loopback
  hosts without an explicit auth token (config-level guard + test).
- [ ] Log/metrics redaction tests: no provider cookies, tokens, or prompts in
  `/webmodel/logs` output.
- [ ] Keep dashboard asset containment (G-1, commit `5e1632b`) covered by
  route-level traversal tests; extend to any new file-serving path.
- [ ] Security scan (`atheon --json .`) as a recurring gate where available.

### M5 — Amortyx integration

- [ ] Contract tests at the adapter boundary: timeout, streaming mid-stream
  failure, malformed provider output, rate-limit, provider-session expiry.
- [ ] Explicit admission policy (timeout, retry, concurrency, provenance,
  redaction) exercised against a real Amortyx instance before routing.
- **Gate:** Amortyx routes only adapters that pass the contract suite on the
  same commit reported in the receipt.

### M6 — Deployment

- [ ] Redeploy the 3456 instance from current `master` build via the
  documented operator procedure; verify `ready`, `readiness`, and `version`
  in the served health body against `PLATFORM_INTEGRATION.md`.
- [ ] Define the release artifact and publication receipt (version, commit,
  build command, checksum) before calling any package release
  production-ready.
- [ ] Startup runbook note: never serve a pre-contract build; check
  `version` on boot and log it.

## Acceptance criteria for production admission

- Typecheck, strict lint, unit tests, integration tests, and build pass from
  a clean checkout with bounded commands on the canonical lane.
- Provider capability claims carry authenticated evidence per M1; tool/vision
  claims per M2.
- Amortyx routes the adapter through an explicit admission policy per M5.
- Browser state stays isolated from repository state and survives restarts
  only through documented operator-safe procedures.
- GitHub CI and the platform's remote validation lane agree on the same
  commit and produce receipts traceable to it.
