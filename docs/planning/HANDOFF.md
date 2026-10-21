# API Model Bridge Handoff

**Repository:** `aliasfoxkde/api-model-bridge`  
**Component:** `web-model-bridge`  
**Status:** Experimental integration candidate; deterministic repository gates
are qualified, provider/browser production readiness is not.

## Purpose and boundary

The bridge owns browser-session lifecycle, provider adapters, request
translation, and local HTTP serving. Amortyx owns routing policy, batching,
telemetry, accounting, and failover. Control Center owns operator UX and task
lifecycle. The bridge must remain an adapter behind those boundaries and must
not become a credentials or durable-state store.

See `PLATFORM_INTEGRATION.md` for the canonical API and ownership contract.

## Verified repository state

- The current integration contract was merged on 2026-09-21 as commit
  `dc42756c7f55ba54632e6e599dbf98282f0f7b98`.
- Package metadata declares version `0.1.0` and requires Node.js 20 or newer.
- The default service bind is loopback (`127.0.0.1:3456`); non-loopback use
  requires explicit authentication and network review.

## Deterministic validation

The following commands were run from a clean isolated worktree based on
`origin/master` after `npm ci --ignore-scripts`:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run test:unit -- --run` | Pass: 20 files, 192 tests |
| `npm run test:integration -- --run` | Pass: 4 files, 19 tests |
| lint | `npm run lint` fails: 37 errors, 216 warnings. |
| `npm run build` | Pass: tsup produced `dist/cli.js` |
| provider/browser E2E | Not claimed; requires authenticated browser sessions |

The lint findings are in existing provider and diagnostic code.

The lint configuration fix in this branch adds `tsconfig.eslint.json` and points
the flat ESLint configuration at it. The repository therefore has a functioning
lint diagnostic, but not a clean strict-lint gate yet. The existing workflow's
lint step is currently allowed to continue after failure; that policy must be
removed only after the reported source and test findings are remediated.

## Remaining qualification work

1. Prove each advertised provider/model with authenticated requests and
   structured response validation; `/webmodel/health` alone is insufficient.
2. Add Amortyx contract tests for timeout, streaming, malformed output,
   rate-limit, and provider-session failure paths.
3. Establish browser-session storage, rotation, privacy, crash recovery, and
   bounded-concurrency policy.
4. Qualify tool-call and vision semantics independently from wire-format
   compatibility.
5. Define a release artifact and publication receipt before calling a package
   release production-ready.

## Provenance and Audit Context

The cross-project authorities for this handoff are:

- `HANDOFF_AUDIT_2026-08-13.md` (Platform-Architecture).
- `CODEX_CLI_EXECUTION_PACKETS_2026-08-13.md` (Platform-Architecture).

**Rating:** Not scored; no calibrated rubric was applied in this update.

<!-- markdownlint-disable MD013 -->
Evidence boundary (central audit): branch `codex/handoff-refresh-20261021`, HEAD `700e96abc9eb9c58f3e1a430f464b31a1cdc24c1`, 0 dirty status entries.
<!-- markdownlint-enable MD013 -->

This is the clean worktree snapshot before the handoff-only edit.

## Acceptance criteria for production admission

- Typecheck, strict lint, unit tests, integration tests, and build pass from a
  clean checkout with bounded commands.
- Provider capability claims have authenticated evidence with model ID,
  request class, response validation, and failure classification.
- Amortyx routes the adapter through an explicit admission policy with timeout,
  retry, concurrency, provenance, and redaction controls.
- Browser state is isolated from repository state and survives/restarts only
  through documented operator-safe procedures.
- GitHub CI and the platform’s remote validation lane agree on the same commit
  and report receipts that can be traced back to that commit.
