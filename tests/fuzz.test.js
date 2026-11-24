'use strict';
// Fuzz tests: hostile/malformed input must never cause a 5xx, crash, or corrupt state.
const test = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const { startApp } = require('./helpers');

const RUNS = Number(process.env.FC_RUNS || 100);
const nasty = fc.oneof(
  fc.anything(),
  fc.constantFrom('__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf', '', ' ', '../etc', '\u0000', '😀'),
  fc.constantFrom(NaN, Infinity, -0, 1e308, Number.MAX_SAFE_INTEGER + 2, 0.5),
  fc.string({ unit: 'binary' }),
);
const jsonSafe = nasty.map((v) => JSON.parse(JSON.stringify({ v })).v ?? null);
const paths = fc.constantFrom('/accounts', '/transfers');

async function seeded() {
  const app = await startApp();
  await app.post('/accounts', { id: 'alice', balance: 100 });
  await app.post('/accounts', { id: 'bob', balance: 50 });
  return app;
}
const total = async (app) => (await app.get('/accounts/alice')).body.balance + (await app.get('/accounts/bob')).body.balance;

test('fuzz: arbitrary JSON bodies never yield 5xx', async (t) => {
  const app = await seeded(); t.after(() => app.close());
  await fc.assert(fc.asyncProperty(paths, jsonSafe, async (p, body) => {
    const r = await app.post(p, JSON.stringify(body));
    assert.ok(r.status < 500, `${p} ${JSON.stringify(body)} -> ${r.status} ${r.text}`);
  }), { numRuns: RUNS });
});

test('fuzz: arbitrary field values for transfers/accounts never yield 5xx', async (t) => {
  const app = await seeded(); t.after(() => app.close());
  await fc.assert(fc.asyncProperty(paths, jsonSafe, jsonSafe, jsonSafe, async (p, a, b, c) => {
    const body = p === '/transfers' ? { from: a, to: b, amount: c } : { id: a, balance: c };
    const r = await app.post(p, body);
    assert.ok(r.status < 500, `${p} ${JSON.stringify(body)} -> ${r.status} ${r.text}`);
  }), { numRuns: RUNS });
});

test('fuzz: garbage raw bodies and content-types never yield 5xx', async (t) => {
  const app = await seeded(); t.after(() => app.close());
  await fc.assert(fc.asyncProperty(paths, fc.string({ unit: 'binary' }),
    fc.constantFrom('application/json', 'text/plain', 'application/x-www-form-urlencoded', ''),
    async (p, raw, ct) => {
      const r = await app.post(p, raw, ct || 'text/plain');
      assert.ok(r.status < 500, `${p} ct=${ct} ${JSON.stringify(raw)} -> ${r.status}`);
    }), { numRuns: RUNS });
});

test('fuzz: arbitrary account ids in URL never yield 5xx', async (t) => {
  const app = await seeded(); t.after(() => app.close());
  await fc.assert(fc.asyncProperty(fc.oneof(fc.string(), fc.constantFrom('__proto__', 'constructor', 'toString')), async (id) => {
    const r = await app.get(`/accounts/${encodeURIComponent(id)}`);
    assert.ok(r.status < 500 && (r.status === 404 || r.status === 200), `${id} -> ${r.status}`);
    if (r.status === 200) assert.ok(Number.isInteger(r.body.balance), `non-account ${id} returned ${r.text}`);
  }), { numRuns: RUNS });
});

test('fuzz: random transfer storms preserve total money', async (t) => {
  const app = await seeded(); t.after(() => app.close());
  const t0 = await total(app);
  await fc.assert(fc.asyncProperty(
    fc.constantFrom('alice', 'bob', 'nobody', '__proto__'), fc.constantFrom('alice', 'bob', 'nobody', 'constructor'), jsonSafe,
    async (from, to, amount) => {
      await app.post('/transfers', { from, to, amount });
      assert.strictEqual(await total(app), t0);
    }), { numRuns: RUNS });
});
