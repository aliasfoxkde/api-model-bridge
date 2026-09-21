# Agent Operating Notes

## Scope

This repository is the `web-model-bridge` browser-session adapter. It translates
OpenAI- and Anthropic-shaped requests to provider-specific browser flows. The
adapter is not the source of truth for routing policy, credentials, project
state, or durable knowledge; those responsibilities belong to the surrounding
platform services documented in `PLATFORM_INTEGRATION.md`.

## Required workflow

1. Read `PLATFORM_INTEGRATION.md` before changing an integration boundary.
2. Keep browser sessions, provider cookies, and API credentials outside the
   repository and outside logs, receipts, test fixtures, and pull requests.
3. Run deterministic checks with bounded, non-watch commands:
   `npm run typecheck`, `npm run lint`, `npm test -- --run`, and `npm run build`.
4. Treat provider/browser E2E as a separate qualification lane. It requires an
   explicitly authenticated browser session and must not be represented by a
   localhost health response or mocked provider result.
5. Preserve the default loopback bind. Any non-loopback deployment requires an
   authenticated configuration and an explicit network-boundary review.

## Resource safety

Use `vitest run`, never `vitest watch`, in shared infrastructure. Run heavy or
concurrent validation through the designated remote CI runner rather than
starting unconstrained local browser or test processes. Record command, commit,
result, and limitations in the applicable handoff or audit receipt.

## Completion standard

A change is ready for review only when its tests and documentation describe the
same behavior, the deterministic quality gates pass, and any provider-specific
claim has an observable authenticated evidence record or is clearly marked as
unqualified.
