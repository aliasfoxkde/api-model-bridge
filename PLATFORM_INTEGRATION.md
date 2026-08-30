# Platform Integration: API Model Bridge

**Component:** web-model-bridge  
**Template version:** 1.0  
**Created:** 2026-08-30  
**Status:** Experimental integration candidate; provider/session reliability must be qualified before production routing

## Role

api-model-bridge exposes browser-backed, OpenAI-compatible and Anthropic-compatible interfaces for web AI providers. It can provide additional free-capacity lanes for low-risk research and planning, while preserving paid/local provider capacity for work that requires stronger reliability or privacy.

## Ownership boundary

The bridge owns browser sessions, provider adapters, dashboard/login flows, request translation, and local API serving. Amortyx owns routing policy, request/token accounting, batching decisions, and failover; the bridge must remain a provider adapter behind that boundary. Control Center owns operator UX and task lifecycle. The bridge must not be treated as a source of truth for credentials, project state, or durable knowledge.

## Canonical repository path

```text
/nas/Temp/repos/api-model-bridge
```

## Startup and health

```bash
cd /nas/Temp/repos/api-model-bridge
npm ci
npm run build
node dist/cli.js --no-open
curl --fail http://127.0.0.1:3456/webmodel/health
```

The default bind is `127.0.0.1:3456`. `--host`, `--port`, `--auth-token`, and `--no-open` are supported; configuration may also be supplied through `~/.webmodel/config.yml` and `WMB_HOST`/`WMB_AUTH_TOKEN`. Remote exposure requires an explicit authenticated configuration and network boundary review.

## API surface

### Inbound APIs

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/` | GET | Dashboard |
| `/v1/chat/completions` | POST | OpenAI-compatible chat requests |
| `/v1/messages` | POST | Anthropic-compatible messages requests |
| `/v1/models` | GET | Advertised model inventory |
| `/webmodel/health` | GET | Bridge/provider health status |
| `/webmodel/providers` | GET | Provider authentication status |
| `/webmodel/auth/login` | POST | Start provider login flow |
| `/webmodel/auth/logout` | POST | Clear provider session |

### Outbound dependencies

| Component | Boundary | Purpose |
| --- | --- | --- |
| Playwright/browser | Local browser process | Maintains normal web sessions and provider interaction |
| Web AI providers | Provider websites | Generates bridged responses through logged-in sessions |
| Amortyx | Configured internal router boundary | Optional upstream routing/telemetry integration; requires independent contract tests |

## Depends on

- Node.js >= 20
- npm lockfile and installed dependencies
- A browser runtime supported by the provider adapters
- Explicitly authenticated provider sessions for any non-health request

## Used by

- Amortyx as a candidate free-capacity/provider adapter
- Local CLI agents and research jobs after capability qualification
- Control Center only through an explicit Amortyx or service contract, not direct browser-session assumptions

## Required environment variables

| Variable | Description | Example |
| --- | --- | --- |
| `WMB_HOST` | Optional bind host override | `127.0.0.1` |
| `WMB_AUTH_TOKEN` | Optional API bearer token; required for non-local exposure | `<secret from secret manager>` |

Provider cookies and login state are local sensitive data and must never be committed, copied into receipts, or emitted in logs.

## Test and quality commands

```bash
cd /nas/Temp/repos/api-model-bridge
npm run typecheck
npm run lint
npm test -- --run
npm run build
```

Use bounded execution through GitForge for heavy or concurrent validation. Do not run `vitest watch` in shared infrastructure.

## Current gaps

- [ ] Prove each advertised provider/model with a real authenticated request and structured response validation; health 200 alone is insufficient.
- [ ] Establish model capability metadata from observed behavior rather than documentation claims.
- [ ] Add Amortyx adapter contract tests for timeout, streaming, malformed response, rate-limit, and provider-session failure paths.
- [ ] Define browser-session storage, rotation, privacy, and crash-recovery policy.
- [ ] Add bounded concurrency/admission control so browser automation cannot exhaust system resources.
- [ ] Qualify vision/tool-call support separately; OpenAI/Anthropic shape compatibility does not prove semantic support.
- [ ] Resolve current repository working-tree ownership before implementation changes; this contract branch is documentation-only.

## Validation boundary

This file records an integration candidate, not production readiness. Free web-provider output is untrusted external data and must be routed through policy, limits, provenance, and independent validation before it can affect source code or durable state.
