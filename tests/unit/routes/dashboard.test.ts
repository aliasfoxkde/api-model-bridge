import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestContext, type TestContext } from '../../helpers/test-server.js';

// When vitest runs, src/server.ts resolves __dirname to <repo>/src, so the
// route serves assets from the source dashboard directory.
const dashboardDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'src',
  'dashboard'
);

// Encode a path (relative to the dashboard dir) the way traversal requests do:
// every separator becomes %2F so Hono decodes it back into the path.
function encodeTraversalPath(relPath: string): string {
  return relPath.split(sep).map(encodeURIComponent).join('%2F');
}

describe('Dashboard asset routes', () => {
  let ctx: TestContext;
  afterEach(() => ctx?.cleanup());

  describe('legitimate assets', () => {
    it('serves app.js with a JavaScript content type and exact content', async () => {
      ctx = createTestContext();
      const res = await ctx.app.request('/dashboard/app.js');
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('application/javascript');
      expect(await res.text()).toBe(readFileSync(join(dashboardDir, 'app.js'), 'utf-8'));
    });

    it('serves style.css with a CSS content type', async () => {
      ctx = createTestContext();
      const res = await ctx.app.request('/dashboard/style.css');
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/css');
    });

    it('serves index.html through the parameterized route', async () => {
      ctx = createTestContext();
      const res = await ctx.app.request('/dashboard/index.html');
      expect(res.status).toBe(200);
    });
  });

  describe('path traversal (G-1)', () => {
    it('rejects an encoded-slash traversal to a benign sentinel outside the asset root', async () => {
      const sentinelDir = mkdtempSync(join(tmpdir(), 'wmb-traversal-'));
      const sentinelPath = join(sentinelDir, 'sentinel.txt');
      const marker = 'WMB-BENIGN-SENTINEL-CONTENT';
      writeFileSync(sentinelPath, marker);
      try {
        const rel = relative(dashboardDir, sentinelPath);
        expect(rel.startsWith('..')).toBe(true); // sentinel really is outside the asset root

        ctx = createTestContext();
        const res = await ctx.app.request(`/dashboard/${encodeTraversalPath(rel)}`);
        expect(res.status).toBe(404);
        expect((await res.text()).includes(marker)).toBe(false);
      } finally {
        rmSync(sentinelDir, { recursive: true, force: true });
      }
    });

    it('rejects the %2e%2e%2f-encoded traversal form', async () => {
      const sentinelDir = mkdtempSync(join(tmpdir(), 'wmb-traversal-'));
      const sentinelPath = join(sentinelDir, 'sentinel.txt');
      const marker = 'WMB-BENIGN-SENTINEL-CONTENT';
      writeFileSync(sentinelPath, marker);
      try {
        const rel = relative(dashboardDir, sentinelPath);
        const encoded = rel
          .split(sep)
          .map((segment) => (segment === '..' ? '%2e%2e' : encodeURIComponent(segment)))
          .join('%2F');

        ctx = createTestContext();
        const res = await ctx.app.request(`/dashboard/${encoded}`);
        expect(res.status).toBe(404);
        expect((await res.text()).includes(marker)).toBe(false);
      } finally {
        rmSync(sentinelDir, { recursive: true, force: true });
      }
    });

    it('rejects the handoff reproduction path without returning any file content', async () => {
      // docs/handoffs/2026-10-11-platform-role-handoff.md G-1 reproduction:
      // GET /dashboard/..%2F..%2F..%2Fetc%2Fpasswd. Asserted on status and on
      // the absence of content; the file itself is never read by this test.
      ctx = createTestContext();
      const res = await ctx.app.request('/dashboard/..%2F..%2F..%2Fetc%2Fpasswd');
      expect(res.status).toBe(404);
      expect((await res.text()).includes('root:')).toBe(false);
    });

    it('rejects percent-encoded backslash separators', async () => {
      ctx = createTestContext();
      const res = await ctx.app.request('/dashboard/..%5C..%5C..%5Cetc%5Cpasswd');
      expect(res.status).toBe(404);
      expect((await res.text()).includes('root:')).toBe(false);
    });

    it('rejects NUL-byte file names', async () => {
      ctx = createTestContext();
      const res = await ctx.app.request('/dashboard/index.html%00.js');
      expect(res.status).toBe(404);
    });
  });
});
