import { describe, it, expect, afterEach } from 'vitest';
import { createTestContext, type TestContext } from '../../helpers/test-server.js';
import { MockProvider } from '../../helpers/mock-provider.js';
import type { LoginState } from '../../../src/browser/manager.js';
import type { MetricsCollector } from '../../../src/core/metrics.js';

describe('Management endpoints', () => {
  let ctx: TestContext;
  afterEach(() => ctx?.cleanup());

  describe('GET /webmodel/providers', () => {
    it('returns provider statuses', async () => {
      ctx = createTestContext({
        providers: [
          new MockProvider('claude-web', { authenticated: true }),
          new MockProvider('deepseek-web', { authenticated: false }),
        ],
      });
      const res = await ctx.app.request('/webmodel/providers');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.providers).toHaveLength(2);
      expect(body.providers.find((p: any) => p.id === 'claude-web').authenticated).toBe(true);
      expect(body.providers.find((p: any) => p.id === 'deepseek-web').authenticated).toBe(false);
    });
  });

  describe('GET /webmodel/health', () => {
    it('returns health status', async () => {
      ctx = createTestContext();
      const res = await ctx.app.request('/webmodel/health');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('healthy');
      expect(body).toHaveProperty('ready');
      expect(body).toHaveProperty('readiness');
      expect(body).toHaveProperty('uptime');
      expect(body).toHaveProperty('providers');
    });

    it('reports not ready with no providers registered', async () => {
      ctx = createTestContext({ providers: [] });
      const res = await ctx.app.request('/webmodel/health');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('healthy'); // liveness preserved
      expect(body.ready).toBe(false);
      expect(body.readiness.ready).toBe(false);
      expect(body.readiness.readyProviders).toBe(0);
      expect(body.readiness.totalProviders).toBe(0);
      expect(body.readiness.availableModels).toBe(0);
      expect(body.readiness.reason).toBe('no providers registered');
    });

    it('reports not ready when providers are unauthenticated', async () => {
      ctx = createTestContext({
        providers: [new MockProvider('deepseek-web', { authenticated: false })],
      });
      const res = await ctx.app.request('/webmodel/health');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('healthy');
      expect(body.ready).toBe(false);
      expect(body.readiness.ready).toBe(false);
      expect(body.readiness.readyProviders).toBe(0);
      expect(body.readiness.totalProviders).toBe(1);
      expect(body.readiness.availableModels).toBe(0);
      expect(body.readiness.reason).toBe('no authenticated provider reports models');
    });

    it('reports ready when an authenticated provider reports models', async () => {
      ctx = createTestContext({
        providers: [
          new MockProvider('claude-web', {
            authenticated: true,
            models: [{ id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', contextWindow: 200000, maxOutput: 8192 }],
          }),
          new MockProvider('deepseek-web', { authenticated: false }),
        ],
      });
      const res = await ctx.app.request('/webmodel/health');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('healthy'); // liveness preserved alongside readiness
      expect(body.ready).toBe(true);
      expect(body.readiness.ready).toBe(true);
      expect(body.readiness.readyProviders).toBe(1);
      expect(body.readiness.totalProviders).toBe(2);
      expect(body.readiness.availableModels).toBe(1);
      expect(body.readiness.reason).toBeNull();
    });
  });

  describe('POST /webmodel/auth/logout', () => {
    it('clears provider auth status', async () => {
      ctx = createTestContext({
        providers: [new MockProvider('claude-web', { authenticated: true })],
      });
      // Set auth first
      ctx.authStore.setStatus('claude-web', 'active');

      const res = await ctx.app.request('/webmodel/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: 'claude-web' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('logged_out');
      expect(body.providerId).toBe('claude-web');

      // Verify cleared
      const status = ctx.authStore.getStatus('claude-web');
      expect(status.status).toBe('none');
    });

    it('returns 400 for invalid JSON', async () => {
      ctx = createTestContext();
      const res = await ctx.app.request('/webmodel/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      });
      expect(res.status).toBe(400);
    });

    it('handles missing providerId gracefully', async () => {
      ctx = createTestContext();
      const res = await ctx.app.request('/webmodel/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      // Route does not validate providerId presence - it just passes undefined
      expect(res.status).toBe(200);
    });
  });

  describe('POST /webmodel/auth/check', () => {
    it('returns auth status for a provider', async () => {
      ctx = createTestContext();
      ctx.authStore.setStatus('claude-web', 'active');

      const res = await ctx.app.request('/webmodel/auth/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: 'claude-web' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('active');
      expect(body.providerId).toBe('claude-web');
    });

    it('returns 400 for invalid JSON', async () => {
      ctx = createTestContext();
      const res = await ctx.app.request('/webmodel/auth/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'bad json',
      });
      expect(res.status).toBe(400);
    });

    it('handles missing providerId gracefully', async () => {
      ctx = createTestContext();
      const res = await ctx.app.request('/webmodel/auth/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      // Route does not validate providerId presence
      expect(res.status).toBe(200);
    });
  });

  describe('GET /webmodel/auth/login-status', () => {
    it('returns idle when getLoginState not configured', async () => {
      ctx = createTestContext();
      const res = await ctx.app.request('/webmodel/auth/login-status');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.providerId).toBeNull();
      expect(body.status).toBe('idle');
    });
  });

  describe('GET /webmodel/metrics', () => {
    it('returns 503 when metrics not configured', async () => {
      ctx = createTestContext();
      const res = await ctx.app.request('/webmodel/metrics');
      expect(res.status).toBe(503);
    });
  });

  describe('GET /webmodel/logs', () => {
    it('returns 503 when metrics not configured', async () => {
      ctx = createTestContext();
      const res = await ctx.app.request('/webmodel/logs');
      expect(res.status).toBe(503);
    });

    it('accepts count query param', async () => {
      ctx = createTestContext();
      const res = await ctx.app.request('/webmodel/logs?count=10');
      expect(res.status).toBe(503);
    });
  });
});
