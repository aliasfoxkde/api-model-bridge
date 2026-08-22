# Contributing to web-model-bridge

## Development Setup

```bash
git clone https://github.com/linuxhsj/WebModel.git
cd WebModel
npm install
npm run dev        # Start in dev mode (tsx)
```

## Quality Gates

Before committing, run:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # typecheck + unit tests
npm test            # all tests
npm run build       # production build
```

## Project Structure

- `src/core/` — Registry, router, formatters, stream types, errors
- `src/providers/` — Provider implementations (one subdir per provider)
- `src/routes/` — HTTP route handlers
- `src/browser/` — BrowserManager (CDP + Playwright)
- `src/auth/` — AuthStore
- `src/config/` — Config loader
- `tests/unit/` — Unit tests
- `tests/integration/` — Integration tests
- `tests/e2e/` — E2E tests (require Chrome CDP)

## Running Tests

```bash
npm test              # All tests
npm run test:unit    # Unit tests only
npm run test:integration  # Integration tests only
npm run test:e2e     # E2E tests (requires Chrome with --remote-debugging-port=9222)
npm run test:coverage # With coverage report
```

## Adding a New Provider

1. Create `src/providers/{name}/index.ts` extending `BaseProvider`
2. Implement: `info`, `models()`, `isAuthenticated()`, `login()`, `detectLoginComplete()`, `chat()`
3. Add tests in `tests/unit/providers/`
4. Register in `src/core/registry.ts` if using `ProviderRegistry`

## TypeScript Conventions

- Strict mode enabled (`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`)
- ESM modules — use `.js` extensions in imports
- No `unwrap()` in library code — use `?` or proper error handling
- Async generators for streaming: `async *chat(): AsyncIterable<StreamEvent>`
