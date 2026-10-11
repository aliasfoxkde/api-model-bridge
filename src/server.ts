import { Hono } from 'hono';
import { openaiRoutes } from './routes/openai-compat.js';
import { anthropicRoutes } from './routes/anthropic-compat.js';
import { managementRoutes, type ManagementDeps } from './routes/management.js';
import { ProviderRegistry } from './core/registry.js';
import { AuthStore } from './auth/store.js';
import type { BrowserStatus, LoginState } from './browser/manager.js';
import { InvalidTokenError, errorToHttpResponse } from './core/errors.js';
import { readDashboardAsset } from './core/dashboard-assets.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashboardDir = join(__dirname, 'dashboard');

export interface AppOptions {
  registry: ProviderRegistry;
  authStore: AuthStore;
  authToken: string | null;
  onLogin?: (providerId: string) => Promise<{ status: string; message: string }>;
  getBrowserStatus?: () => BrowserStatus;
  getLoginState?: () => LoginState;
}

export function createApp(opts: AppOptions): Hono {
  const app = new Hono();

  // Auth middleware for API routes (both /v1/* and /webmodel/*)
  if (opts.authToken) {
    const checkToken = async (c: any, next: any) => {
      const authHeader = c.req.header('Authorization');
      const xApiKey = c.req.header('x-api-key');
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : xApiKey ?? null;
      if (token !== opts.authToken) {
        const res = errorToHttpResponse(new InvalidTokenError());
        return c.json(res.body, res.status as any);
      }
      await next();
    };
    app.use('/v1/*', checkToken);
    app.use('/webmodel/*', checkToken);
  }

  // Dashboard
  app.get('/', (c) => {
    try {
      const html = readFileSync(join(dashboardDir, 'index.html'), 'utf-8');
      return c.html(html);
    } catch {
      return c.text('Dashboard available after build. Run: npx tsup', 404);
    }
  });

  app.get('/dashboard/:file', (c) => {
    const asset = readDashboardAsset(dashboardDir, c.req.param('file'));
    if (!asset) {
      return c.text('Not found', 404);
    }
    return c.text(asset.content, 200, { 'Content-Type': asset.contentType });
  });

  // Mount API routes
  app.route('/', openaiRoutes(opts.registry));
  app.route('/', anthropicRoutes(opts.registry));

  const mgmtDeps: ManagementDeps = {
    registry: opts.registry,
    authStore: opts.authStore,
    onLogin: opts.onLogin,
    getLoginState: opts.getLoginState,
    getBrowserStatus: opts.getBrowserStatus,
    startTime: Date.now(),
  };
  app.route('/', managementRoutes(mgmtDeps));

  return app;
}
