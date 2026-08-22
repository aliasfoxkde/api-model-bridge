import { describe, it, expect, afterEach } from 'vitest';
import { createTestContext, type TestContext } from '../../helpers/test-server.js';
import { MockProvider } from '../../helpers/mock-provider.js';
import type { StreamEvent } from '../../../src/core/stream.js';
import type { ChatRequest } from '../../../src/core/provider.js';

class ErrorMockProvider extends MockProvider {
  constructor(
    id: string,
    private errorProvider = false,
    private errorOnStream = false,
  ) {
    super(id, { authenticated: true });
  }

  async *chat(_req: ChatRequest): AsyncIterable<StreamEvent> {
    if (this.errorProvider) {
      throw new Error('Provider error');
    }
    if (this.errorOnStream) {
      yield { type: 'text_delta', delta: 'partial ' };
      yield { type: 'error', message: 'Stream error' };
      return;
    }
    yield { type: 'text_delta', delta: 'Hello' };
    yield { type: 'done', reason: 'stop' };
  }
}

describe('POST /v1/chat/completions', () => {
  let ctx: TestContext;
  afterEach(() => ctx?.cleanup());

  it('returns streaming SSE response', async () => {
    ctx = createTestContext();
    const res = await ctx.app.request('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-web/claude-sonnet-4-6',
        messages: [{ role: 'user', content: 'Hi' }],
        stream: true,
      }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const text = await res.text();
    expect(text).toContain('data: {');
    expect(text).toContain('"object":"chat.completion.chunk"');
    expect(text).toContain('Hello from claude-web');
    expect(text).toContain('data: [DONE]');
  });

  it('returns non-streaming JSON response', async () => {
    ctx = createTestContext();
    const res = await ctx.app.request('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-web/claude-sonnet-4-6',
        messages: [{ role: 'user', content: 'Hi' }],
        stream: false,
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.object).toBe('chat.completion');
    expect(body.choices[0].message.content).toContain('Hello from claude-web');
  });

  it('returns 400 for missing model', async () => {
    ctx = createTestContext();
    const res = await ctx.app.request('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hi' }] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('invalid_body');
  });

  it('returns 400 for missing messages field', async () => {
    ctx = createTestContext();
    const res = await ctx.app.request('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-web/claude-sonnet-4-6' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('invalid_body');
  });

  it('returns 400 for invalid model ID', async () => {
    ctx = createTestContext();
    const res = await ctx.app.request('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'no-slash',
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('invalid_model');
  });

  it('returns 401 for unauthenticated provider', async () => {
    ctx = createTestContext({
      providers: [new MockProvider('claude-web', { authenticated: false })],
    });
    const res = await ctx.app.request('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-web/claude-sonnet-4-6',
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('auth_required');
  });

  it('returns 403 when auth token required but not provided', async () => {
    ctx = createTestContext({ authToken: 'secret-123' });
    const res = await ctx.app.request('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-web/claude-sonnet-4-6',
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    });
    expect(res.status).toBe(403);
  });

  it('passes with correct auth token', async () => {
    ctx = createTestContext({ authToken: 'secret-123' });
    const res = await ctx.app.request('/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer secret-123',
      },
      body: JSON.stringify({
        model: 'claude-web/claude-sonnet-4-6',
        messages: [{ role: 'user', content: 'Hi' }],
        stream: false,
      }),
    });
    expect(res.status).toBe(200);
  });

  it('returns error event in non-streaming when provider yields error', async () => {
    ctx = createTestContext({
      providers: [new ErrorMockProvider('claude-web', false, true)],
    });
    const res = await ctx.app.request('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-web/claude-sonnet-4-6',
        messages: [{ role: 'user', content: 'Hi' }],
        stream: false,
      }),
    });
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.code).toBe('provider_error');
  });

  it('handles streaming error events', async () => {
    ctx = createTestContext({
      providers: [new ErrorMockProvider('claude-web', false, true)],
    });
    const res = await ctx.app.request('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-web/claude-sonnet-4-6',
        messages: [{ role: 'user', content: 'Hi' }],
        stream: true,
      }),
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    // Should have partial content followed by error
    expect(text).toContain('partial');
    expect(text).toContain('Stream error');
    expect(text).toContain('data: [DONE]');
  });
});

describe('GET /v1/models', () => {
  let ctx: TestContext;
  afterEach(() => ctx?.cleanup());

  it('returns model list', async () => {
    ctx = createTestContext();
    const res = await ctx.app.request('/v1/models');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.object).toBe('list');
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].id).toBe('claude-web/claude-sonnet-4-6');
    expect(body.data[0].object).toBe('model');
  });
});
