# Changelog

This file records repository changes that affect users, operators, or platform
integration. It is maintained separately from generated build output.

## Unreleased

- Added a typed ESLint project configuration so type-aware rules execute against
  both `src/` and `tests/` instead of failing during ESLint startup.
- Added repository operating notes and a platform handoff describing the
  adapter boundary, validation lanes, and known qualification gaps.
- Merged `PLATFORM_INTEGRATION.md`, which documents the Amortyx and Control
  Center ownership boundary and the current experimental status.

## 0.1.0

- The package manifest currently declares version `0.1.0`.
- The repository provides OpenAI-compatible and Anthropic-compatible HTTP
  adapters backed by browser sessions, with deterministic unit and integration
  test suites.

The manifest version is recorded here as repository state; no independent
published-package release receipt is asserted by this changelog.
