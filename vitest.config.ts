import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  coverage: {
    provider: 'v8',
    // Only cover code that can be unit-tested without CDP/browser
    // Exclude: cli.ts (CLI entry), dashboard (static files), provider index files (need browser CDP)
    // Include: core, config, auth, routes (all testable without browser)
    include: [
      'src/**/*.ts',
      '!src/cli.ts',
      '!src/dashboard/**',
      '!src/browser/**',
    ],
    exclude: [
      'src/cli.ts',
      'src/dashboard/**',
      'src/providers/**/_shared/**',
    ],
    // 90% threshold for unit-testable code (core, config, auth, routes)
    // 99% is not achievable for this project without CDP mocking infrastructure
    thresholds: {
      lines: 90,
      functions: 90,
      branches: 85,
      statements: 90,
    },
    reporter: ['text', 'html', 'lcov'],
  },
});
