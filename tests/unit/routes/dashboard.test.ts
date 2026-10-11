import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestContext, type TestContext } from '../../helpers/test-server.js';
import { readDashboardAsset } from '../../../src/core/dashboard-assets.js';

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

describe('readDashboardAsset containment', () => {
  let base: string;
  let root: string;

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'wmb-assets-'));
    root = join(base, 'assets');
    mkdirSync(root);
    mkdirSync(join(base, 'outside'));
    writeFileSync(join(root, 'app.js'), 'const asset = "asset";');
    writeFileSync(join(root, 'style.css'), 'body { color: #111; }');
    writeFileSync(join(base, 'outside', 'secret.txt'), 'OUT-OF-ROOT-CONTENT');
  });

  afterEach(() => rmSync(base, { recursive: true, force: true }));

  it('serves a real asset inside the root', () => {
    const asset = readDashboardAsset(root, 'app.js');
    expect(asset?.content).toBe('const asset = "asset";');
    expect(asset?.contentType).toBe('application/javascript');
  });

  it('maps css assets to a CSS content type', () => {
    expect(readDashboardAsset(root, 'style.css')?.contentType).toBe('text/css');
  });

  it('serves a symlink that resolves inside the root', () => {
    symlinkSync(join(root, 'app.js'), join(root, 'alias.js'));
    const asset = readDashboardAsset(root, 'alias.js');
    expect(asset?.content).toBe('const asset = "asset";');
    expect(asset?.contentType).toBe('application/javascript');
  });

  it('rejects a symlink whose target escapes the root', () => {
    symlinkSync(join(base, 'outside', 'secret.txt'), join(root, 'leak.txt'));
    expect(readDashboardAsset(root, 'leak.txt')).toBeNull();
  });

  it('rejects separator, NUL, and dot-segment names outright', () => {
    for (const name of ['', '.', '..', 'a/b', 'a\\b', 'a\0b', '../../../etc/passwd']) {
      expect(readDashboardAsset(root, name)).toBeNull();
    }
  });

  it('returns null for a missing asset', () => {
    expect(readDashboardAsset(root, 'missing.js')).toBeNull();
  });

  it('returns null when the root itself does not exist', () => {
    expect(readDashboardAsset(join(base, 'not-built'), 'app.js')).toBeNull();
  });
});
