# Platform Role Handoff — API-Model-Bridge

**Date:** 2026-10-11
**Commit boundary:** `master` @ `9622bcdf726cdaf7a84aa2155eea09c208d2c0b5` (2026-10-07, PR #4)
**Scope of this document:** evidence-led planning only. No runtime code, gates, or release state were changed.
**Evidence rule:** every factual claim below carries a source anchor (`file:line` at the commit boundary) or is
explicitly marked *inference* or *not validated*. Recorded (not re-run) validation results are labeled as such.

---

## 1. Executive verdict

**Retain web-model-bridge as a standalone, optional browser-session adapter lane behind Amortyx — but it is
not admissible to production routing today. Fix the P0 security defects, wire the dormant
observability/admission subsystems, and run a bounded provider-qualification campaign before any Amortyx
admission policy references it. Do not retire it, and do not expand its feature surface.**

Basis, in one paragraph each:

- **Why not retire:** the bridge is the only component in the stack that produces *free-capacity inference
  lanes from real browser sessions* (11 provider adapters, `src/providers/*`, `src/cli.ts:30-42`). Nothing
  else in the platform provides this; Amortyx routes to paid/local API providers. Deleting it removes the
  only free-capacity option with no replacement.
- **Why not production routing now:** (a) an unauthenticated path-traversal file read exists in the served
  dashboard route (§7.1, demonstrated at the routing layer); (b) management endpoints and the dashboard are
  open by default and remain unauthenticated even when `--auth-token` is set (`src/server.ts:27-65`);
  (c) the service has **zero** working request observability — `/webmodel/metrics` and `/webmodel/logs`
  always return 503 because the metrics collector is never wired (`src/server.ts:71-78`,
  `src/routes/management.ts:121-130`); (d) no provider/model has a recorded authenticated qualification
  (acknowledged in `PLATFORM_INTEGRATION.md:93-101`); (e) there are no request timeouts, body limits,
  cancellation, or concurrency limits anywhere in the serving path (§7.4).
- **Why not expand features:** the bridge already contains dead, tested subsystems that duplicate platform
  responsibilities — a fallback/retry `Router` (`src/core/router.ts`) duplicates Amortyx's routing-policy
  ownership, and `toolCalling`/`logging` config blocks have no consumers (§5.3). Adding features before the
  existing surface is wired and qualified increases unowned surface.
- **Integration reality:** ownership contracts are documented (`PLATFORM_INTEGRATION.md:12-15`) but **no
  consumer code exists**: a grep of the Amortyx and Control-Center source and docs trees for
  `web-model-bridge|api-model-bridge|webmodel` returns zero hits (checked 2026-10-11; other trees such as
  configs were not swept). The bridge is a
  documented candidate, not an integrated dependency. This is the last cheap moment to fix or retire it.

### Decision table

| Question | Verdict | Confidence | Basis |
| --- | --- | --- | --- |
| Unique web-chat/session capability? | **Yes** — only browser-session bridge in stack | High | `src/providers/*` (11 adapters), grep of Amortyx/CC repos (0 hits) |
| Optional tool adapter behind Amortyx? | **Yes, target state** — after P0/P1 | High | `PLATFORM_INTEGRATION.md:12-15` ownership contract |
| Remain standalone repo? | **Yes** | High | No consumer coupling exists to force a merge; adapter isolation is the contract |
| Retire? | **Not now** | Medium | Unique capability vs. small remediation cost; revisit if P2 qualification fails (§6, G-3) |
| Production routing now? | **No** | High | §7 findings; `PLATFORM_INTEGRATION.md:105` validation boundary |

---

## 2. Current state at the commit boundary

| Area | State | Anchor / evidence |
| --- | --- | --- |
| Repo | Fork `aliasfoxkde/api-model-bridge` of `linuxhsj/WebModel`; default branch `master` | `git remote -v`; `gh repo view` (`isFork: true`, parent `linuxhsj/WebModel`) |
| Upstream | Dormant since 2026-04-11 (`363d201`, "DeepSeek PoW solver…"). Fork is **0 behind / 13 ahead**; merge-base = upstream tip. Fork is the live lineage. | `git rev-list --left-right --count upstream/master...master` → `0 13` |
| Latest merged PR | #4 `feat(health): expose authenticated router readiness` (2026-10-08). No open PRs (checked 2026-10-11). CI green on `9622bcd`. | `gh pr list --state all`; `gh run list` |
| Service identity | HTTP bridge: OpenAI (`/v1/chat/completions`) + Anthropic (`/v1/messages`) over real Chrome sessions via CDP (playwright-core) | `src/server.ts`, `src/browser/manager.ts:142-171` |
| Providers / models | 11 provider adapters; 16 model IDs advertised in README; model lists are **hardcoded static arrays**, not discovered | `src/cli.ts:30-42`, `src/providers/claude/index.ts:42-47`, `README.md:118-138` |
| Default bind | `127.0.0.1:3456`; `--host`, `--auth-token` supported; token optional by default | `src/config/loader.ts:36-39`, `src/server.ts:28` |
| Auth store | `~/.webmodel/auth.json` holds status flags only (`active/expired/none`) — no cookies/tokens | `src/auth/store.ts:12-26` |
| Cookies | Live only in the browser profile (stateDir `chrome-profile/` in launch mode; the user's own Chrome in attach mode) | `src/cli.ts:193`, `src/browser/manager.ts:49-59` |
| Readiness | `GET /webmodel/health` returns `status: healthy` (liveness) plus `ready` (≥1 authenticated provider reporting models). Readiness reflects *reported* store state, not a live probe. | `src/routes/management.ts:88-119`, PR #4 |
| Deterministic gates | Recorded 2026-09-21 from clean worktree at `origin/master`: typecheck pass; unit 20 files/192 tests pass; integration 4 files/19 tests pass; build pass; **lint fails honestly (37 errors, 216 warnings)** and CI lint step is `continue-on-error: true` | `docs/planning/HANDOFF.md:28-44`; `.github/workflows/ci.yml:30` |
| CI lanes | unit + integration + build only; no e2e in CI (correct per `AGENTS.md:18-20`); lint is non-blocking | `.github/workflows/ci.yml` |
| Release state | Version `0.1.0`, no publish workflow, no Dockerfile, no `files`/`repository`/`publishConfig` in `package.json`; npm artifact not published (not validated — no registry check run) | `package.json`, `.github/workflows/` (only `ci.yml`) |
| Platform docs | `PLATFORM_INTEGRATION.md` (created 2026-08-30, readiness amendment 2026-10-07), `docs/planning/HANDOFF.md` (2026-09-21), audit receipt at upstream tip (`docs/audits/AUDIT_RECEIPT_2026-08-22.md`) | files at boundary commit |
| Platform consumers | **None.** Amortyx and Control-Center source/docs trees contain no reference to this bridge (grep, 2026-10-11) | grep of `/nas/Temp/repos/Amortyx`, `/nas/Temp/repos/Control-Center` |

---

## 3. Verified capability and integration map

### 3.1 Inbound surface (verified against routes)

| Endpoint | Auth when token set | Behavior | Anchor |
| --- | --- | --- | --- |
| `GET /` | **Never** (middleware covers only `/v1/*`, `/webmodel/*`) | Dashboard HTML from `dist/dashboard/` | `src/server.ts:27-51` |
| `GET /dashboard/:file` | **Never** | Static dashboard asset; **no path normalization** (§7.1) | `src/server.ts:53-65` |
| `POST /v1/chat/completions` | Bearer | OpenAI chat; streaming + non-streaming | `src/routes/openai-compat.ts:17-101` |
| `GET /v1/models` | Bearer | Models of *authenticated* providers only | `src/routes/openai-compat.ts:103-106`, `src/core/registry.ts:45-57` |
| `POST /v1/messages` | Bearer | Anthropic messages; streaming + non-streaming | `src/routes/anthropic-compat.ts:21-131` |
| `GET /webmodel/health` | Bearer | Liveness + readiness | `src/routes/management.ts:88-119` |
| `GET /webmodel/providers` | Bearer | Per-provider auth status + model count | `src/routes/management.ts:22-25` |
| `POST /webmodel/auth/login` | Bearer | Starts login (returns immediately) | `src/routes/management.ts:27-56` |
| `GET /webmodel/auth/login-status` | Bearer | Login poll state | `src/routes/management.ts:59-64` |
| `POST /webmodel/auth/check`, `/auth/logout` | Bearer | Store read / clear | `src/routes/management.ts:66-86` |
| `GET /webmodel/metrics`, `/webmodel/logs` | Bearer | **Always 503** — collector never wired | `src/routes/management.ts:121-130`, `src/server.ts:71-78` |

Note: `/webmodel/auth/login-status` and `/webmodel/auth/check` are implemented but absent from both
`README.md:205-218` and `PLATFORM_INTEGRATION.md:38-50` — doc drift.

### 3.2 Outbound behavior (verified)

- Requests execute as `fetch()` **inside the provider's page context** (cookies included, CORS moot):
  `src/browser/manager.ts:142-171`. Provider endpoints are **hardcoded per adapter**
  (claude.ai, chatgpt.com backend-api, chat.deepseek.com + PoW challenge, qwen, kimi, glm, grok, gemini,
  perplexity, doubao, xiaomimo; grep of `https://` in `src/providers`). The API consumer cannot steer the
  fetch target — model/messages content only. No user-controlled SSRF surface found (inference from code;
  not penetration-tested).
- **Each chat request creates a fresh upstream conversation** (claude: `POST .../chat_conversations`,
  `src/providers/claude/index.ts:94-122`; deepseek: `chat_session/create`,
  `src/providers/deepseek/index.ts:93-112`). Prompts and outputs persist in the *operator's* provider web
  account; there is no cleanup or retention control.
- DeepSeek additionally reloads the page to intercept its own Bearer token from outgoing requests
  (`src/providers/deepseek/index.ts:64-86`) and solves a WASM proof-of-work challenge
  (`src/providers/deepseek/pow.ts`, `deepseek-hash-v1.wasm.b64`).

### 3.3 Semantic model of a "chat" request (critical, under-documented)

`buildWebPrompt` (`src/core/provider.ts:80-104`) is applied by the providers before sending:

1. `system` and `tool` role messages are **silently dropped** (`provider.ts:84`).
2. The function returns **only the last element** of the collected parts (`provider.ts:103`) — i.e. the final
   message's text, not the conversation. The doc comment claims "last user exchange"; the code sends one
   part. Multi-turn history is not transmitted; the bridge is effectively stateless single-shot per request.
3. Content-block arrays are filtered to text only (`provider.ts:56-65`); **images are dropped silently**.

Consequences: agent frameworks that depend on system prompts, tool schemas, or multi-turn context (Claude
Code, OpenClaw agents) get silently degraded behavior, not an error.

### 3.4 Streaming, tool calls, thinking (verified)

- `stream: true` is **buffered end-to-end**: providers read the entire upstream SSE body inside the browser
  before emitting any event (`src/providers/claude/index.ts:165-176`; `fetchInBrowser` does `res.text()`,
  `src/browser/manager.ts:157`). The incremental `readSSE` helper (`src/providers/_shared/sse-reader.ts`)
  parses an already-complete response. First byte to the client ≈ last byte from the provider.
- Tool calling is **type-level only**: `StreamEvent` defines `tool_call` (`src/core/stream.ts:4`) and the
  OpenAI formatter can render it (`src/core/openai-formatter.ts:50-52`), but **no provider emits
  `tool_call`**; Claude sends `tools: []` (`src/providers/claude/index.ts:154`). The `toolCalling` config
  block has zero consumers (grep, boundary commit).
- Anthropic streaming folds `thinking_delta` into the same text block as answer text
  (`src/routes/anthropic-compat.ts:98-99`), and mid-stream provider errors are emitted as **assistant text**
  (`"\n\nError: …"`, `anthropic-compat.ts:104-106`) — indistinguishable from model output downstream.
- OpenAI non-streaming accumulates `text_delta` only; `thinking_delta`/`tool_call` are dropped
  (`src/routes/openai-compat.ts:88-94`).

### 3.5 Ownership map (target state, per `PLATFORM_INTEGRATION.md:12-15` + this audit)

| Responsibility | Owner | Bridge status |
| --- | --- | --- |
| Routing policy, fallback, retry, failover, accounting | **Amortyx** | Bridge must not implement. Dead `Router` (`src/core/router.ts`) duplicates this — see G-6 |
| Admission control / concurrency | **Amortyx** (policy) + bridge (local resource guard) | Bridge has none wired (`ProviderQueue` unused) — G-5 |
| Telemetry / request accounting | **Amortyx** | Bridge exposes none (metrics 503) — G-4 |
| Operator UX / task lifecycle | **Control Center** | None; CC reaches the bridge only via Amortyx contract, per contract doc |
| Browser sessions, provider adapters, login flows, request translation, local serving | **Bridge** | Implemented; partially qualified |
| Credentials / durable knowledge / project state | **Not the bridge** (anywhere) | Holds status flags only; cookies stay in browser profile — contract respected |
| Knowledge corpus / distillation (VIVERE) | **VIVERE** | Zero overlap; no shared code or references (verified) |
| MCP tooling surface | **MCP-Manage** | No references in this repo (verified); no seam today |

### 3.6 Explicit non-goals for the next phase

1. No new providers, models, or API formats.
2. No routing/fallback/retry logic in the bridge (Amortyx owns it; delete the dead `Router`, G-6).
3. No bridge-side accounting/optimization of request tokens (Amortyx owns token accounting).
4. No VIVERE knowledge-corpus or distillation responsibilities in this repo.
5. No production routing of platform traffic until G-1..G-3 close with recorded evidence.

---

## 4. Provenance and identity notes

- **Identity:** `web-model-bridge` v`0.1.0` (package.json:3), Node ≥ 20.19 (package.json:24), TypeScript
  strict, ESM, Hono 4.12.10 + `@hono/node-server` + `playwright-core` 1.59 (package.json:36-44).
- **Provenance:** fork of `linuxhsj/WebModel` at upstream tip `363d201` (2026-04-11). The 13 fork commits
  (2026-08-22 → 2026-10-07) are: test/E2E-skip + coverage tooling, dashboard accessibility, docs/audits,
  lint config, Node runtime alignment (PR #1), the platform integration contract (PRs #2/#3), and the
  readiness feature (PR #4). Upstream is dormant; **this fork is the maintained lineage** — a decision to
  (optionally) upstream the P0 security fix later is worth one sentence in any fix PR.
- **Upstream-carried design traits** (inherited, not introduced by the fork): single-shot prompt building,
  per-request upstream conversations, screen-scraped auth, static model tables, the E2E lane's
  operator-specific cookie-injection path (`tests/e2e/real-providers.test.ts:31-37` references a hardcoded
  `~/Documents/zero0330/...` auth-profiles path from the upstream author's machine).

---

## 5. Gap register (ranked; each with falsifiable completion criterion)

Severity = impact × exposure at the *target* role (optional adapter behind Amortyx, loopback-first).

### P0

**G-1 — Unauthenticated path traversal in `/dashboard/:file` (arbitrary local file read)**
- Evidence: `src/server.ts:53-65` builds `join(__dirname, 'dashboard', file)` from a URL param with no
  normalization or containment check, and the route is outside the auth middleware (`server.ts:39-40`).
  Hono 4.12.10 (the pinned dependency, package.json:40) decodes `%2F` in route params — demonstrated 2026-10-11
  with the installed dependency: `GET /dashboard/..%2F..%2F..%2Fetc%2Fpasswd` → `c.req.param('file')` =
  `../../../etc/passwd`; Node `join('/opt/wmb/dist','dashboard','../../../etc/passwd')` → `/opt/etc/passwd`.
  The handler then `readFileSync`s it as UTF-8 text and returns it (`server.ts:60-64`).
- Impact: unauthenticated read of any text file readable by the service user on any reachable interface —
  including `~/.webmodel/config.yml`, which may contain the auth token (loader accepts it there,
  `src/config/loader.ts:103`). When `--host 0.0.0.0 --auth-token …` is used (README documents this,
  `README.md:148`), the token is bypassed entirely for this route. Not yet executed against a live server
  (§8, NV-1).
- Dependencies: none. Single-file fix.
- Completion criterion (falsifiable): a route-level test asserting that
  `GET /dashboard/..%2F..%2F..%2Fetc%2Fpasswd` (and `%2e%2e%2f` form) returns 400/404 and that the resolved
  path stays inside the dashboard directory passes in CI; manual curl against a locally started bridge
  returns 400/404 and no file content.

**G-2 — Auth posture: management API and dashboard open by default; token does not cover dashboard**
- Evidence: middleware attaches only when `authToken` is configured and only to `/v1/*` + `/webmodel/*`
  (`src/server.ts:28-41`); default `authToken: null` (`src/config/loader.ts:39`). The 2026-08-22 audit
  flagged this as H2 (`docs/audits/AUDIT_RECEIPT_2026-08-22.md:62-76`); still unfixed at the boundary.
- Impact: any local process (or network peer when `--host` is used) can trigger provider logins, clear auth
  state, and read provider status; combined with G-1 it yields unauthenticated file reads plus a config
  disclosure chain. `AGENTS.md:21-22` already requires loopback default + review for non-loopback, but the
  code does not enforce it.
- Dependencies: none.
- Completion criterion: (a) starting with a non-loopback `--host` **without** an auth token exits non-zero
  with an explicit error; (b) with a token set, `GET /` and `GET /dashboard/<asset>` behave correctly for
  authorized use while traversal attempts are rejected; (c) unit tests cover both branches.

### P1

**G-3 — Provider/model claims unqualified; readiness reflects reported state, not truth**
- Evidence: model lists are static arrays (`src/providers/claude/index.ts:42-47` et al.); `isAuthenticated`
  reads the status flag only (`src/providers/claude/index.ts:34-36`); attach-mode login marks `success`
  unconditionally when the login tab closes or times out (`src/browser/manager.ts:194-220`), and
  `onLogin` then writes `active` (`src/cli.ts:300-311`); cookie *presence* also sets `active`
  (`autoDetectAuth`, `src/browser/manager.ts:317-352`, via the startup loop `src/cli.ts:276-292`). `PLATFORM_INTEGRATION.md:93-101` and
  `docs/planning/HANDOFF.md:46-57` both list this as open.
- Impact: readiness can be `true` while every session is dead; first real request fails. Agents built on
  readiness get false confidence; Amortyx cannot make admission decisions from this signal.
- Dependencies: none for the state-integrity fix; qualification campaign needs one authenticated browser
  session per provider (operator-provisioned, per `AGENTS.md:18-20`).
- Completion criterion: (a) login completion requires a cheap authenticated probe (e.g. the provider's own
  session-validation endpoint) before `setStatus(active)`, with unit-testable seams; (b) a recorded
  qualification receipt exists for at least 2 providers × N≥10 real requests with structured response
  validation and failure classification, committed under `docs/audits/`.

**G-4 — Zero live observability: metrics/logs endpoints are dead features**
- Evidence: `MetricsCollector` (`src/core/metrics.ts`) is implemented and unit-tested but never constructed
  in `src/server.ts` or `src/cli.ts`; `ManagementDeps.metrics` is optional and unpassed
  (`src/routes/management.ts:14`, `src/server.ts:71-78`) → `/webmodel/metrics` and `/webmodel/logs` always
  503 (`management.ts:121-130`). No file logger consumes `logging.file` (`src/config/loader.ts:62-65` has no
  readers). Per the platform's validation discipline, a feature that engages but produces no observable
  metric is blocker-grade: this is that, pre-admission.
- Impact: no latency/error/per-provider signal for Amortyx admission policy, no debugging trail, no
  detection of the silent degradations in §3.3-3.4.
- Dependencies: none.
- Completion criterion: after N requests, `GET /webmodel/metrics` returns non-zero totals whose per-provider
  counts match a scripted client's request count (latency/status recorded per request, no message bodies);
  `/webmodel/logs` returns the same requests; unit + integration tests cover the wiring.

**G-5 — No request lifecycle guards: timeouts, body limits, cancellation, concurrency**
- Evidence: `serve()` called with no timeout options (`src/cli.ts:323-327`); no `bodyLimit` on any route
  (grep, boundary commit); `ChatRequest.signal?: AbortSignal` defined but unused by any provider
  (`src/core/provider.ts:38`, grep); no concurrency/admission wiring — `ProviderQueue`
  (`src/core/queue.ts:1-22`) has no imports (grep). Carried findings M1/M5/L1 of the 2026-08-22 audit; still
  unfixed.
- Impact: a hung provider page can pin a request (and its browser page) indefinitely; N concurrent callers
  can exhaust browser/memory; large bodies are unbounded. Disqualifying for multi-tenant use behind Amortyx.
- Dependencies: G-4 (metrics make the guards observable).
- Completion criterion: (a) requests exceeding a configurable timeout abort with a mapped 504 and the
  provider page is released; (b) bodies over a configurable limit get 413; (c) concurrent requests beyond a
  configurable bound queue (bounded memory); each proven by a deterministic test with a mock slow provider
  (`tests/helpers/mock-provider.ts` seam already exists).

**G-6 — Dead code duplicates platform responsibilities and misleads integrators**
- Evidence: `Router` with fallback/retry (`src/core/router.ts:11-92`), `ProviderQueue`
  (`src/core/queue.ts`), `MetricsCollector` (`src/core/metrics.ts`) are imported nowhere in the serving path
  (grep); `toolCalling` and `logging` config blocks have zero consumers. All are tested as if live.
- Impact: suggests capabilities the service does not have (retry/fallback is Amortyx's job by contract);
  inflates maintenance; the config blocks document behavior that does not exist.
- Dependencies: G-4 decides metrics fate (wire, don't delete); G-5 may adopt `ProviderQueue`.
- Completion criterion: repo contains no unreferenced core module and no config key without a consumer —
  verified by a grep-based check or by `knip`-style unused-export CI step; `Router` removed (ownership) and
  the decision recorded in `PLATFORM_INTEGRATION.md`.

### P2

**G-7 — Error semantics unusable for a router client**
- Evidence: semantic error classes (`UpstreamRateLimitError`, `UpstreamBlockedError`, `TimeoutError`,
  `AuthExpiredError`, `ProviderDisabledError`, `BrowserUnavailableError` — `src/core/errors.ts:14-66`) are
  never thrown (grep); providers emit string messages (`claude/index.ts:189-192`); Anthropic streaming turns
  errors into assistant text (§3.4); OpenAI non-stream collapses everything to 502 `provider_error`
  (`openai-compat.ts:95-99`). Upstream HTTP error bodies are passed through truncated to 200 chars
  (`claude/index.ts:160-162`; audit finding M4).
- Impact: Amortyx cannot distinguish 401-session-expired from 429-rate-limited from block-page, so failover
  policy cannot be expressed. This is the single largest *contract* gap for integration.
- Completion criterion: provider failures surface as classified `error` StreamEvents (code field) mapped to
  distinct HTTP statuses on the non-stream path; a contract test enumerates the mapping table; upstream body
  passthrough limited to status + generic message.

**G-8 — Streaming honesty and capability metadata**
- Evidence: §3.3-3.4 (buffered streaming, no tool calls, thinking folded into text, images dropped, static
  model tables, context-window numbers are documentation claims).
- Impact: consumers select models on false metadata; interactive tools behave "laggy then all-at-once".
- Completion criterion: either (a) one provider implements true incremental streaming via CDP response
  interception with a recorded A/B latency receipt, or (b) `PLATFORM_INTEGRATION.md` and README document the
  buffered behavior and remove/annotate unsupported capability fields, with `/v1/models` exposing only
  verified fields.

**G-9 — Docs drift and stale claims**
- Evidence: README claims "132 passing" tests (`README.md:269`) vs. recorded 192 unit + 19 integration
  (`docs/planning/HANDOFF.md:33-34`); Development section still clones upstream
  (`README.md:279-281`); `/webmodel/metrics`/`/webmodel/logs` absent from endpoint tables;
  `auth/login-status`/`auth/check` implemented but undocumented; model table presents unqualified numbers as
  fact.
- Completion criterion: README and `PLATFORM_INTEGRATION.md` regenerated against the boundary commit; a
  docs-check step (link + endpoint-table diff vs. routes) added to CI.

**G-10 — Release hygiene**
- Evidence: no `files`/`repository`/`publishConfig` in `package.json`; no publish/release workflow; no
  Dockerfile (README lists it as "help wanted", `README.md:294`); `install-service`/`uninstall-service` are
  placeholders ("planned for Phase 2", `src/cli.ts:365-377`).
- Completion criterion: a release receipt defines artifact contents (npm or tarball), and CI produces it on
  tag; placeholders either implemented or removed. (Gate for any "use it from the platform" claim.)

---

## 6. Phased work packets

Owners are role suggestions for the agent/operator split. Packet = one reviewable PR. Each packet lists
prerequisites; none requires the bridge to be deployed anywhere.

### Phase 0 — Stop the bleeding (this or the immediately following PR; runtime code)

| # | Packet | Files | Owner role | Validation route | Risk / rollback | Prereqs |
| --- | --- | --- | --- | --- | --- | --- |
| WP-0.1 | Fix G-1 traversal: normalize + contain `file` to the dashboard dir; reject `..`, null bytes, absolute paths; return 400 | `src/server.ts`, `tests/unit/routes/` | code agent | `npm run typecheck && npm run lint && npm test -- --run` (unit suite includes a new traversal test); manual curl repro | Trivial; rollback = revert single commit | none |
| WP-0.2 | Enforce G-2 posture: refuse non-loopback bind without `authToken`; extend token middleware decision to dashboard routes or serve dashboard only on loopback | `src/cli.ts`, `src/server.ts`, `src/config/loader.ts`, `tests/unit/` | code agent | same gates + new startup-guard tests | Startup behavior change — document in README "Configuration" | none |
| WP-0.3 | Docs truth pass for security posture: README security section + `PLATFORM_INTEGRATION.md` security note reflecting WP-0.1/0.2 | `README.md`, `PLATFORM_INTEGRATION.md` | docs agent | `git diff --check`; endpoint-table review | none | WP-0.1/0.2 merged |

Rollout gate 0: CI green (including the now-real lint failures fixed or explicitly waived line-by-line —
see §9), no loopback bypass reachable in tests.

### Phase 1 — Make it observable and survivable (runtime code, small PRs)

| # | Packet | Files | Owner role | Validation route | Risk / rollback | Prereqs |
| --- | --- | --- | --- | --- | --- | --- |
| WP-1.1 | Wire `MetricsCollector` through `createApp` → management routes; record per-request provider/model/latency/status/format; never record message content | `src/server.ts`, `src/routes/openai-compat.ts`, `src/routes/anthropic-compat.ts`, `src/cli.ts`, `tests/unit/routes/` | code agent | unit + integration suites; curl-driven count-match check | Low; endpoints change 503 → data | G-4 |
| WP-1.2 | Lifecycle guards: request timeout (default e.g. 120s, config), body limit (default e.g. 2MB), bounded in-flight per provider via `ProviderQueue` or a semaphore; providers observe `AbortSignal` | `src/routes/*`, `src/providers/*` (signal check at loop granularity), `src/config/loader.ts`, tests | code agent | mock-provider slow/abort tests; integration timeout test | Medium: abort paths can flake — keep defaults generous, one provider first | G-5; WP-1.1 |
| WP-1.3 | Login-state integrity: require authenticated probe before `setStatus(active)`; surface `expired` with reason in `/webmodel/providers` and health readiness | `src/browser/manager.ts`, `src/cli.ts`, provider probes, tests | code agent | unit tests with mocked probe; manual attach-mode login test | Medium: probe endpoint per provider must be chosen conservatively | G-3a |
| WP-1.4 | Delete dead `Router`; remove or implement `toolCalling`/`logging` config (recommend: remove, note in changelog) | `src/core/router.ts` (delete), `src/config/loader.ts`, `tests/unit/core/router.test.ts` (delete), docs | code agent | gates; grep check "no unreferenced core modules" | Low — nothing imports them | G-6 |

Rollout gate 1: `/webmodel/metrics` live; timeout/body/concurrency proven by tests; readiness no longer
reportable as true without a passing probe; dead code gone.

### Phase 2 — Qualify and contract (evidence + platform integration)

| # | Packet | Files / area | Owner role | Validation route | Risk / rollback | Prereqs |
| --- | --- | --- | --- | --- | --- | --- |
| WP-2.1 | Provider qualification campaign, 2 providers first (recommend `deepseek-web`, `claude-web`): N≥10 real requests each across short/long-context/concurrent-burst classes, structured validation, failure classification; receipt in `docs/audits/` with commit SHA | `docs/audits/`, throwharness under `tests/` excluded from CI | operator + agent (operator supplies authenticated browser; run bounded via GitForge per `AGENTS.md:26-29`) | recorded receipts; `PLATFORM_INTEGRATION.md` gap checkbox ticked | Provider ToS/rate-limit exposure is inherent — keep volume low, single-account | Phase 1; explicit operator authorization |
| WP-2.2 | Error-semantics contract (G-7): classified error events + HTTP mapping table; upstream body passthrough reduced to status + generic message | `src/providers/_shared/`, `src/core/errors.ts`, routes, tests | code agent | contract tests enumerating the mapping | Medium: changes error bodies consumers may match on — release-note it | WP-1.1 |
| WP-2.3 | Amortyx admission contract tests at the HTTP boundary (timeout, streaming, malformed, rate-limit, session-failure paths) using `MockProvider`; no live browser needed | `tests/integration/` or `tests/contract/`, docs | platform agent | vitest contract suite in CI | Low | WP-2.2 |
| WP-2.4 | Decision + docs: streaming honesty or one-provider true streaming (G-8); docs regeneration (G-9); release receipt (G-10) | `PLATFORM_INTEGRATION.md`, `README.md`, `docs/` | docs + platform agents | docs-check CI step | Low | WP-2.1 |

Rollout gate 2 (admission): Amortyx may add the bridge as an **explicitly opt-in, capacity-lane-limited
adapter** for low-risk research traffic only, with per-provider admission policy derived from WP-2.1
receipts; production/critical routing stays on paid/local providers. Platform traffic must flow **through
Amortyx** (its policy, accounting, provenance), never direct-to-bridge from CC or agents.

### Explicitly rejected for this phase

- New providers/models; dashboard redesign; Docker; `install-service`; any "router" features in the bridge;
  any VIVERE-related ingestion role. Each fails the "simple maintainable plan" test while P0/P1 remain open.

---

## 7. Security / privacy / reliability review

### 7.1 Findings verified in this audit (at `9622bcd`)

| ID | Severity | Finding | Anchor |
| --- | --- | --- | --- |
| F-1 | **High** | Unauthenticated path traversal → arbitrary text-file read via `/dashboard/:file` (G-1); amplified by config-file token disclosure chain | `src/server.ts:53-65`; hono 4.12.10 param-decode probe (2026-10-11) |
| F-2 | **High** | Dashboard + static file route exempt from auth even when token configured | `src/server.ts:28-41` |
| F-3 | **High** | Management endpoints (`/webmodel/*`) unauthenticated by default (token optional) | `src/server.ts:28`, `src/config/loader.ts:39` |
| F-4 | **Medium** | Login success recorded unconditionally on tab close/timeout; auth state therefore unverified → false readiness (G-3) | `src/browser/manager.ts:194-220`, `src/cli.ts:300-311` |
| F-5 | **Medium** | No request timeout, no body limit, no cancellation, no concurrency bound | `src/cli.ts:323-327`; grep evidence §5 G-5 |
| F-6 | **Medium** | Data retention: every request creates a persisted conversation in the operator's provider account; no cleanup, no opt-out | `src/providers/claude/index.ts:94-122`, `src/providers/deepseek/index.ts:93-112` |
| F-7 | **Medium** | Silent semantic degradation: system prompts dropped, history truncated to last message, images dropped, tool calls unsupported (§3.3) | `src/core/provider.ts:80-104`, `src/routes/anthropic-compat.ts:71-76` |
| F-8 | **Low** | Auth token compared with `!==` (non-timing-safe); token can sit in plaintext `config.yml` | `src/server.ts:33`, `src/config/loader.ts:103` |
| F-9 | **Low** | Upstream error bodies embedded in error strings (200 chars) | `src/providers/claude/index.ts:160-162` |
| F-10 | **Low** | DeepSeek PoW + page reload per request: event-loop spikes, slow requests, fragile auth | `src/providers/deepseek/index.ts:64-86`, `pow.ts` |
| F-11 | Info | Attach mode connects to `contexts[0]` of the user's real Chrome — the bridge process can execute JS in the operator's authenticated browser context. Trust boundary is "bridge process ≈ browser owner"; CDP itself has no auth (audit H1) | `src/browser/manager.ts:49-59`, `docs/audits/AUDIT_RECEIPT_2026-08-22.md:64-65` |

Privacy posture (verified): cookies never leave the browser profile; `auth.json` holds flags only
(`src/auth/store.ts`); no request/response logging exists at all (which cuts both ways — see G-4); prompts
are exposed to provider web accounts (F-6). No secrets, tokens, or cookie values are committed to this
repository (grep sweep of `tests/` for token-shaped literals at the boundary commit returned nothing beyond
mock values).

### 7.2 Carried findings from the 2026-08-22 receipt, still open at this boundary

H1 (CDP no auth), H2 (=F-3), M1 (=F-5 timeouts), M2 (=F-8 config), M3 (=F-8 compare), M4 (=F-9),
M5 (=F-5 body), L1 (AbortSignal unused), L4 (PoW on main thread). Fixed since then: none of the above;
the only security-adjacent change was additive readiness exposure (PR #4).

### 7.3 Unknowns and not-validated items

- **NV-1** G-1 was demonstrated at the routing layer against the pinned hono dependency plus Node `join`
  semantics; the full read was **not executed against a running bridge** (no service was started in this
  docs-only pass). The remaining uncertainty is negligible but stated.
- **NV-2** No test/build/lint suite was run in this session (docs-only task). Test counts cited are the
  recorded 2026-09-21 results (`docs/planning/HANDOFF.md:28-44`) and CI outcomes (2026-10-08).
- **NV-3** No provider/model was exercised; all capability claims (16 models, context windows, "strongest
  anti-blocking") are static code/README claims and remain unqualified per `AGENTS.md:32-36`.
- **NV-4** npm registry publication status was not checked (no `npm view` run).
- **NV-5** Behavior of `@hono/node-server` under slow-client attacks was not measured.
- **NV-6** Whether any operator currently runs a bridge instance (local or `/nas/Temp/repos`) and with what
  exposure was not surveyed; F-1/F-3 urgency depends on that answer.

---

## 8. Test / CI / observability / release strategy

**Test lanes (keep the current shape; tighten the gate):**
1. Unit + integration in CI as today (deterministic, browser-free). Add: traversal test (WP-0.1),
   startup-guard tests (WP-0.2), metrics-wiring tests (WP-1.1), timeout/body/concurrency tests with
   `MockProvider` (WP-1.2), error-mapping contract tests (WP-2.2/2.3).
2. E2E browser lane stays **out of CI** by design (`AGENTS.md:18-20`); convert it from upstream's
   operator-specific cookie injection (`tests/e2e/real-providers.test.ts:31-37`) into a documented,
   operator-run qualification harness producing receipts (WP-2.1).
3. CI honesty: `continue-on-error: true` on lint (`.github/workflows/ci.yml:30`) exists deliberately
   (`docs/planning/HANDOFF.md:41-44`) with a recorded 37 errors / 216 warnings baseline. Gate 0 includes
   triaging that baseline to zero (or annotation-with-reason per suppression) and then removing the flag —
   the removal is the measurable event, not the intention.
4. Coverage: keep the documented 90% unit-testable threshold (`vitest.config.ts:27-32`); do not chase the
   CDP-dependent remainder (rationale: `docs/ARCHITECTURAL_LIMITATIONS.md`).

**Observability (matches Amortyx boundary):** bridge exposes local primitives (`/webmodel/metrics`,
`/webmodel/logs`, readiness); Amortyx remains the telemetry/accounting/aggregation owner. Rule: the bridge
records *operational* facts (latency, status, provider) and never message content; anything
request-content-shaped is Amortyx's redacted/provenance-controlled domain.

**Release strategy:** versioned receipts over npm publishing. Until G-10 closes, "release" = a tagged
commit with a receipt (commands, SHA, results, limitations) in `docs/audits/`, matching
`AGENTS.md:26-29`. npm publish only after: strict lint gate green, `files` allowlist added, and Phase 2
qualification receipts exist.

**Rollout gates:** Gate 0 (WP-0.x merged, no loopback bypass) → Gate 1 (observable + guarded + honest auth
state) → Gate 2 (qualified + Amortyx contract tests) → admission as opt-in free-capacity lane. Each gate is
a checkbox set in `PLATFORM_INTEGRATION.md` "Current gaps", ticked with a receipt link.

---

## 9. Acceptance checklist for the next phase

- [ ] G-1 traversal fixed with regression test; manual curl repro returns 400/404 (WP-0.1)
- [ ] Non-loopback bind without token refuses to start; dashboard auth posture decided and tested (WP-0.2)
- [ ] `/webmodel/metrics` + `/webmodel/logs` live; per-request counts match a scripted client (WP-1.1)
- [ ] Timeout, body limit, and bounded concurrency enforced and tested (WP-1.2)
- [ ] Auth status flips to `active` only after a passing authenticated probe (WP-1.3)
- [ ] `Router` deleted; no config key without a consumer (WP-1.4)
- [ ] Error classification contract implemented + mapping table tested (WP-2.2)
- [ ] ≥2 providers qualified with committed receipts, request classes, and failure classification (WP-2.1)
- [ ] Amortyx contract suite green at the HTTP boundary (WP-2.3)
- [ ] Docs regenerated; stale claims (test counts, upstream URL, capability table) corrected (WP-2.4)
- [ ] CI lint `continue-on-error` removed after the recorded baseline reaches zero
- [ ] `PLATFORM_INTEGRATION.md` gap list ticked with receipt links; a new dated handoff supersedes this one

---

## 10. Durable sources

**In this repo (boundary `9622bcd`):**
`PLATFORM_INTEGRATION.md` — canonical ownership/API contract · `docs/planning/HANDOFF.md` (2026-09-21
validation record) · `docs/audits/AUDIT_RECEIPT_2026-08-22.md` (security baseline at upstream tip) ·
`docs/ARCHITECTURAL_LIMITATIONS.md` · `AGENTS.md` (operating rules) · `src/server.ts`,
`src/routes/*.ts`, `src/core/*.ts`, `src/browser/manager.ts`, `src/providers/**`, `src/cli.ts`,
`src/config/loader.ts`, `src/auth/store.ts` · `.github/workflows/ci.yml` · `vitest.config.ts`,
`tsup.config.ts`, `package.json`.

**External (checked 2026-10-11):**
`origin` = github.com/aliasfoxkde/api-model-bridge (fork; default branch `master`; HEAD `9622bcd`; PRs #1-#4
merged, none open; CI run 2026-10-08 success) · `upstream` = github.com/linuxhsj/WebModel (tip `363d201`,
2026-04-11, dormant; merge-base = tip) · Amortyx repo (`/nas/Temp/repos/Amortyx`) and Control-Center repo
(`/nas/Temp/repos/Control-Center`): zero references to this bridge · hono 4.12.10 routing behavior:
demonstrated against the dependency pinned in `package.json`.

**Supersession:** this handoff extends, and where contradictory replaces, `docs/planning/HANDOFF.md`
(2026-09-21). The readiness contract of PR #4 (`PLATFORM_INTEGRATION.md:34`) remains normative.
