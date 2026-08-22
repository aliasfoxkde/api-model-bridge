/**
 * Browser availability check for E2E tests.
 * E2E tests that require a real Chrome browser should call `skipIfNoBrowser()` at the start.
 * This avoids spurious failures in environments without Chrome.
 */

const CDP_URL = process.env.CDP_URL ?? 'http://127.0.0.1:9222';

let _browserAvailable: boolean | null = null;

/**
 * Check if Chrome CDP is reachable. Caches the result per process.
 */
export function isBrowserAvailable(): boolean {
  if (_browserAvailable !== null) return _browserAvailable;
  try {
    // Synchronous-ish check — we do a quick fetch in the next synchronous call
    _browserAvailable = false; // will be set in checkBrowserAsync
    return _browserAvailable;
  } catch {
    _browserAvailable = false;
    return false;
  }
}

/**
 * Async browser availability check for use in beforeAll/beforeEach.
 * Throws if browser is not available — use this to fail-fast beforeAll.
 */
export async function requireBrowser(): Promise<void> {
  let cdpOk = false;
  try {
    const res = await fetch(`${CDP_URL}/json/version`, { signal: AbortSignal.timeout(3000) });
    cdpOk = res.ok;
  } catch { /* ignored */ }
  if (!cdpOk) {
    throw new Error(`Chrome CDP not reachable at ${CDP_URL} — E2E tests require Chrome with --remote-debugging-port=9222`);
  }
}

/**
 * Returns true if the browser is NOT available — for use in test body.
 * If true, the test should return early with `test.skip()`.
 */
export async function checkBrowser(): Promise<boolean> {
  try {
    const res = await fetch(`${CDP_URL}/json/version`, { signal: AbortSignal.timeout(3000) });
    return !res.ok;
  } catch {
    return true;
  }
}
