import { describe, it, expect } from 'vitest';
import { GeminiProvider } from '../../../src/providers/gemini-web/index.js';
import { GrokProvider } from '../../../src/providers/grok-web/index.js';
import { PerplexityProvider } from '../../../src/providers/perplexity-web/index.js';
import { XiaomimoProvider } from '../../../src/providers/xiaomimo-web/index.js';
import { AuthStore } from '../../../src/auth/store.js';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function makeAuthStore() {
  const dir = join(tmpdir(), `wmb-auth-${Date.now()}-${Math.random()}`);
  mkdirSync(dir, { recursive: true });
  const store = new AuthStore(dir);
  return { store, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe('GeminiProvider', () => {
  it('info has correct id and name', () => {
    const { store, cleanup } = makeAuthStore();
    try {
      const p = new GeminiProvider(store);
      expect(p.info.id).toBe('gemini-web');
      expect(p.info.name).toBe('Gemini Web');
      expect(p.info.needsBrowser).toBe(true);
    } finally { cleanup(); }
  });

  it('models returns expected list', async () => {
    const { store, cleanup } = makeAuthStore();
    try {
      const p = new GeminiProvider(store);
      const models = await p.models();
      expect(models).toHaveLength(2);
      expect(models.find(m => m.id === 'gemini-3-flash')).toBeTruthy();
      expect(models.find(m => m.id === 'gemini-2.5-pro')).toBeTruthy();
    } finally { cleanup(); }
  });

  it('isAuthenticated returns false when not logged in', async () => {
    const { store, cleanup } = makeAuthStore();
    try {
      const p = new GeminiProvider(store);
      expect(await p.isAuthenticated()).toBe(false);
    } finally { cleanup(); }
  });

  it('isAuthenticated returns true when active', async () => {
    const { store, cleanup } = makeAuthStore();
    try {
      store.setStatus('gemini-web', 'active');
      const p = new GeminiProvider(store);
      expect(await p.isAuthenticated()).toBe(true);
    } finally { cleanup(); }
  });

  it('detectLoginComplete always returns false', async () => {
    const { store, cleanup } = makeAuthStore();
    try {
      const p = new GeminiProvider(store);
      expect(await p.detectLoginComplete()).toBe(false);
    } finally { cleanup(); }
  });

  it('chat without browser returns error event', async () => {
    const { store, cleanup } = makeAuthStore();
    try {
      const p = new GeminiProvider(store);
      const events: any[] = [];
      for await (const ev of p.chat({ model: 'gemini-3-flash', messages: [{ role: 'user', content: 'hi' }], stream: false })) {
        events.push(ev);
      }
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('error');
      expect(events[0].message).toBe('Browser not connected');
    } finally { cleanup(); }
  });
});

describe('GrokProvider', () => {
  it('info has correct id and name', () => {
    const { store, cleanup } = makeAuthStore();
    try {
      const p = new GrokProvider(store);
      expect(p.info.id).toBe('grok-web');
      expect(p.info.name).toBe('Grok Web');
      expect(p.info.needsBrowser).toBe(true);
    } finally { cleanup(); }
  });

  it('models returns expected list', async () => {
    const { store, cleanup } = makeAuthStore();
    try {
      const p = new GrokProvider(store);
      const models = await p.models();
      expect(models).toHaveLength(1);
      expect(models[0].id).toBe('grok-3');
    } finally { cleanup(); }
  });

  it('isAuthenticated returns false when not logged in', async () => {
    const { store, cleanup } = makeAuthStore();
    try {
      const p = new GrokProvider(store);
      expect(await p.isAuthenticated()).toBe(false);
    } finally { cleanup(); }
  });

  it('isAuthenticated returns true when active', async () => {
    const { store, cleanup } = makeAuthStore();
    try {
      store.setStatus('grok-web', 'active');
      const p = new GrokProvider(store);
      expect(await p.isAuthenticated()).toBe(true);
    } finally { cleanup(); }
  });

  it('chat without browser returns error event', async () => {
    const { store, cleanup } = makeAuthStore();
    try {
      const p = new GrokProvider(store);
      const events: any[] = [];
      for await (const ev of p.chat({ model: 'grok-3', messages: [{ role: 'user', content: 'hi' }], stream: false })) {
        events.push(ev);
      }
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('error');
      expect(events[0].message).toBe('Browser not connected');
    } finally { cleanup(); }
  });
});

describe('PerplexityProvider', () => {
  it('info has correct id and name', () => {
    const { store, cleanup } = makeAuthStore();
    try {
      const p = new PerplexityProvider(store);
      expect(p.info.id).toBe('perplexity-web');
      expect(p.info.name).toBe('Perplexity Web');
      expect(p.info.needsBrowser).toBe(true);
    } finally { cleanup(); }
  });

  it('models returns expected list', async () => {
    const { store, cleanup } = makeAuthStore();
    try {
      const p = new PerplexityProvider(store);
      const models = await p.models();
      expect(models).toHaveLength(1);
      expect(models[0].id).toBe('perplexity-default');
    } finally { cleanup(); }
  });

  it('isAuthenticated returns false when not logged in', async () => {
    const { store, cleanup } = makeAuthStore();
    try {
      const p = new PerplexityProvider(store);
      expect(await p.isAuthenticated()).toBe(false);
    } finally { cleanup(); }
  });

  it('chat without browser returns error event', async () => {
    const { store, cleanup } = makeAuthStore();
    try {
      const p = new PerplexityProvider(store);
      const events: any[] = [];
      for await (const ev of p.chat({ model: 'perplexity-default', messages: [{ role: 'user', content: 'hi' }], stream: false })) {
        events.push(ev);
      }
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('error');
      expect(events[0].message).toBe('Browser not connected');
    } finally { cleanup(); }
  });
});

describe('XiaomimoProvider', () => {
  it('info has correct id and name', () => {
    const { store, cleanup } = makeAuthStore();
    try {
      const p = new XiaomimoProvider(store);
      expect(p.info.id).toBe('xiaomimo-web');
      expect(p.info.name).toBe('Xiaomimo Web');
      expect(p.info.needsBrowser).toBe(true);
    } finally { cleanup(); }
  });

  it('models returns expected list', async () => {
    const { store, cleanup } = makeAuthStore();
    try {
      const p = new XiaomimoProvider(store);
      const models = await p.models();
      expect(models).toHaveLength(1);
      expect(models[0].id).toBe('mimo-v2-pro');
    } finally { cleanup(); }
  });

  it('isAuthenticated returns false when not logged in', async () => {
    const { store, cleanup } = makeAuthStore();
    try {
      const p = new XiaomimoProvider(store);
      expect(await p.isAuthenticated()).toBe(false);
    } finally { cleanup(); }
  });

  it('chat without browser returns error event', async () => {
    const { store, cleanup } = makeAuthStore();
    try {
      const p = new XiaomimoProvider(store);
      const events: any[] = [];
      for await (const ev of p.chat({ model: 'mimo-v2-pro', messages: [{ role: 'user', content: 'hi' }], stream: false })) {
        events.push(ev);
      }
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('error');
      expect(events[0].message).toBe('Browser not connected');
    } finally { cleanup(); }
  });
});
