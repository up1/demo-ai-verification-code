'use strict';
// Property-based tests: generated inputs for core.transfer, plus a stateful
// model-based test that drives the real HTTP API with random command sequences.
const test = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const { transfer, ApiError } = require('../src/core');
const { startApp } = require('./helpers');

const NUM_RUNS = Number(process.env.FC_RUNS || 100);
const ids = fc.constantFrom('a', 'b', 'c');
const money = fc.integer({ min: 0, max: 1000 });
const balancesArb = fc.record({ a: money, b: money, c: money });
const sum = (o) => Object.values(o).reduce((x, y) => x + y, 0);
const statusOf = (fn) => { try { fn(); return 200; } catch (e) { assert.ok(e instanceof ApiError, String(e)); return e.status; } };

test('transfer: conserves total money', () => {
  fc.assert(fc.property(balancesArb, ids, ids, fc.integer({ min: -50, max: 1200 }), (b, s, d, amt) => {
    let out; try { out = transfer(b, s, d, amt); } catch { return; }
    assert.strictEqual(sum(out), sum(b));
  }), { numRuns: NUM_RUNS });
});

test('transfer: never produces negative balances', () => {
  fc.assert(fc.property(balancesArb, ids, ids, fc.integer({ min: -50, max: 1200 }), (b, s, d, amt) => {
    let out; try { out = transfer(b, s, d, amt); } catch { return; }
    assert.ok(Object.values(out).every((v) => v >= 0));
  }), { numRuns: NUM_RUNS });
});

test('transfer: does not mutate its input and only touches src/dst', () => {
  fc.assert(fc.property(balancesArb, ids, ids, fc.integer({ min: 1, max: 1200 }), (b, s, d, amt) => {
    const snap = JSON.stringify(b);
    let out; try { out = transfer(b, s, d, amt); } catch { return; }
    assert.strictEqual(JSON.stringify(b), snap);
    for (const k of Object.keys(b)) if (k !== s && k !== d) assert.strictEqual(out[k], b[k]);
  }), { numRuns: NUM_RUNS });
});

test('transfer: error status classification is exact', () => {
  fc.assert(fc.property(balancesArb, fc.anything(), fc.anything(), fc.anything(), (b, s, d, amt) => {
    const st = statusOf(() => transfer(b, s, d, amt));
    if (!Number.isInteger(amt) || amt <= 0) assert.strictEqual(st, 400);
    else if (!(typeof s === 'string' && s in b) || !(typeof d === 'string' && d in b)) assert.strictEqual(st, 404);
  }), { numRuns: NUM_RUNS });
});

// ---- Stateful model-based test over HTTP ----
class Create {
  constructor(id, balance) { this.id = id; this.balance = balance; }
  check() { return true; }
  async run(model, real) {
    const r = await real.app.post('/accounts', { id: this.id, balance: this.balance });
    if (this.id in model.bal) assert.strictEqual(r.status, 409);
    else { assert.strictEqual(r.status, 201); model.bal[this.id] = this.balance; }
  }
  toString() { return `create(${this.id},${this.balance})`; }
}
class Get {
  constructor(id) { this.id = id; }
  check() { return true; }
  async run(model, real) {
    const r = await real.app.get(`/accounts/${this.id}`);
    if (this.id in model.bal) { assert.strictEqual(r.status, 200); assert.strictEqual(r.body.balance, model.bal[this.id]); }
    else assert.strictEqual(r.status, 404);
  }
  toString() { return `get(${this.id})`; }
}
class Xfer {
  constructor(from, to, amount) { this.from = from; this.to = to; this.amount = amount; }
  check() { return true; }
  async run(model, real) {
    const r = await real.app.post('/transfers', { from: this.from, to: this.to, amount: this.amount });
    const { from, to, amount } = this;
    if (amount <= 0) assert.strictEqual(r.status, 400);
    else if (!(from in model.bal) || !(to in model.bal)) assert.strictEqual(r.status, 404);
    else if (from === to) assert.strictEqual(r.status, 400); // self-transfer rejected
    else if (model.bal[from] < amount) assert.strictEqual(r.status, 409);
    else { assert.strictEqual(r.status, 200); model.bal[from] -= amount; model.bal[to] += amount; }
    // global invariant: real state agrees with model for every known account
    for (const [id, v] of Object.entries(model.bal)) {
      assert.strictEqual((await real.app.get(`/accounts/${id}`)).body.balance, v);
    }
  }
  toString() { return `transfer(${this.from}->${this.to}, ${this.amount})`; }
}

test('stateful: HTTP API matches a simple reference model', async () => {
  const cmds = [
    fc.tuple(ids, money).map(([i, b]) => new Create(i, b)),
    ids.map((i) => new Get(i)),
    fc.tuple(ids, ids, fc.integer({ min: -5, max: 300 })).map(([f, t, a]) => new Xfer(f, t, a)),
  ];
  await fc.assert(fc.asyncProperty(fc.commands(cmds, { maxCommands: 25 }), async (c) => {
    const app = await startApp();
    try { await fc.asyncModelRun(() => ({ model: { bal: {} }, real: { app } }), c); } finally { await app.close(); }
  }), { numRuns: Number(process.env.FC_RUNS || 50) });
});
