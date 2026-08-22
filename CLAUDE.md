# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**web-model-bridge** is a standalone HTTP service that bridges web-based AI models (Claude, ChatGPT, DeepSeek, etc.) through OpenAI-compatible (`/v1/chat/completions`) and Anthropic-compatible (`/v1/messages`) API endpoints, using a real Chrome browser via CDP (Chrome DevTools Protocol).

```
AI Tool → web-model-bridge → Chrome (browser) → AI Website
```

## Build Commands

```bash
npm run build       # tsup → dist/cli.js (ESM, Node 20+)
npm run dev         # tsx src/cli.ts (direct execution without build)
```

## Test Commands

```bash
npm test            # All tests (vitest run)
npm run test:unit   # tests/unit/** only
npm run test:integration  # tests/integration/** only
npm run test:e2e    # tests/e2e/** only
npm run test:watch  # Vitest watch mode
npm run test:coverage  # Vitest with v8 coverage
```

## Lint / Type Check

```bash
npm run typecheck   # tsc --noEmit (strict TypeScript)
npm run lint        # tsc --noEmit && vitest run
```

## Architecture

### Request Flow

```
HTTP Request (OpenAI or Anthropic format)
  → src/server.ts (Hono app)
    → src/routes/openai-compat.ts or anthropic-compat.ts
      → src/core/registry.ts: resolve(modelId) → { provider, model }
      → provider.chat() → AsyncIterable<StreamEvent>
        → src/browser/manager.ts: BrowserManager.getPageForOrigin()
          → Playwright Page (CDP connection to Chrome)
          → page.evaluate() runs fetch() in browser context (CORS-free, cookies available)
          → SSE response parsed into StreamEvent[]
      → SSE formatter (openai-formatter.ts or anthropic-formatter.ts)
        → HTTP SSE response or JSON response
```

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| **BrowserManager** | `src/browser/manager.ts` | CDP connection, tab caching, `fetchInBrowser()` — navigates to domain before fetch to avoid CORS |
| **ProviderRegistry** | `src/core/registry.ts` | Registers providers, resolves model IDs to provider instances |
| **BaseProvider** | `src/core/provider.ts` | Abstract base for all providers; defines `chat()`, `isAuthenticated()`, `login()`, `detectLoginComplete()` |
| **StreamEvent** | `src/core/stream.ts` | Union type: `text_delta`, `thinking_delta`, `tool_call`, `done`, `error` |
| **AuthStore** | `src/auth/store.ts` | Persists provider auth status to `~/.webmodel/auth.json` |
| **ConfigLoader** | `src/config/loader.ts` | Loads `~/.webmodel/config.yml` + CLI/env overrides |

### Provider Pattern

Each provider in `src/providers/{name}/` extends `BaseProvider`:
- `info: ProviderInfo` — id, name, website, loginUrl, needsBrowser
- `models()` — returns available `ModelInfo[]`
- `isAuthenticated()` — checks AuthStore
- `chat(req): AsyncIterable<StreamEvent>` — main API call
- `login()` — opens login URL
- `detectLoginComplete()` — detects login success

Model IDs use format `{providerId}/{modelId}` (e.g., `deepseek-web/deepseek-v4`).

### BrowserManager Modes

- **Attach mode** (`"attach"`) — connect to existing Chrome via CDP ws:// URL
- **Launch mode** (`"launch"`) — launch new Chrome process
- `fetchInBrowser(url, init)` — navigates to domain first, then runs `fetch()` in browser context
- `autoDetectAuth()` — reads session cookies to detect which providers are logged in
- `domainPages: Map<origin, Page>` — reused page per domain to preserve session

### Config & Auth

- Config: `~/.webmodel/config.yml` (YAML) + env vars (`WMB_PORT`, `WMB_HOST`, `WMB_AUTH_TOKEN`, `WMB_LOG_LEVEL`, `WMB_STATE_DIR`)
- Auth: `~/.webmodel/auth.json` — provider auth status (`'active' | 'expired' | 'none'`), NOT cookies (cookies stay in browser)

### StreamEvent Types

```typescript
{ type: 'text_delta'; delta: string }
{ type: 'thinking_delta'; delta: string }
{ type: 'tool_call'; id: string; name: string; args: string }
{ type: 'done'; reason: 'stop' | 'tool_use' | 'length' }
{ type: 'error'; message: string; code?: string }
```

## TypeScript Configuration

Strict mode enabled (`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`). ESM modules (`"type": "module"`), `.js` extensions required in imports. Target: ES2022.

## File Layout

```
src/
  cli.ts              # CLI entry point
  server.ts           # Hono app factory
  doctor.ts           # Environment checks (Node, Chrome, playwright-core)
  dashboard/          # Pre-built frontend (index.html, app.js, style.css)
  auth/store.ts       # AuthStore
  browser/manager.ts  # BrowserManager
  config/loader.ts    # Config loader
  core/               # Core types, registry, router, formatters
  providers/           # 11 provider implementations
  routes/             # openai-compat, anthropic-compat, management routes
tests/
  unit/               # Unit tests
  integration/        # Integration tests (SSE, error handling, auth)
  e2e/                # E2E tests
  helpers/            # Mock providers, test server helpers
```

## Provider List

`claude`, `chatgpt`, `deepseek` (includes PoW solver), `kimi-web`, `qwen-web`, `glm-web`, `grok-web`, `gemini-web`, `perplexity-web`, `doubao-web`, `xiaomimo-web`
