'use strict';
// Existing example tests. They PASS on the buggy code (that is the point).
const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { createApp } = require('../src/server');

async function setup() {
  const app = createApp();
  await request(app).post('/accounts').send({ id: 'alice', balance: 100 });
  await request(app).post('/accounts').send({ id: 'bob', balance: 50 });
  return app;
}
const bal = async (app, id) => (await request(app).get(`/accounts/${id}`)).body.balance;
const xfer = (app, from, to, amount) => request(app).post('/transfers').send({ from, to, amount });

test('transfer moves money', async () => {
  const app = await setup();
  assert.strictEqual((await xfer(app, 'alice', 'bob', 30)).status, 200);
  assert.deepStrictEqual([await bal(app, 'alice'), await bal(app, 'bob')], [70, 80]);
});
test('insufficient funds leaves state unchanged', async () => {
  const app = await setup();
  assert.strictEqual((await xfer(app, 'alice', 'bob', 101)).status, 409);
  assert.deepStrictEqual([await bal(app, 'alice'), await bal(app, 'bob')], [100, 50]);
});
test('unknown account', async () => {
  const app = await setup();
  assert.strictEqual((await xfer(app, 'alice', 'zed', 1)).status, 404);
});
test('bad amount', async () => {
  const app = await setup();
  assert.strictEqual((await xfer(app, 'alice', 'bob', -5)).status, 400);
});
