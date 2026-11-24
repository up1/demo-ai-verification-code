'use strict';
// Thin Express layer. All decisions live in core.js.
const express = require('express');
const { transfer, ApiError } = require('./core');

function createApp() {
  const app = express();
  app.use(express.json());
  const state = { balances: Object.create(null) };

  app.post('/accounts', (req, res) => {
    const { id, balance = 0 } = req.body || {};
    if (!id || !Number.isInteger(balance) || balance < 0) throw new ApiError(400, 'need id and non-negative integer balance');
    if (id in state.balances) throw new ApiError(409, 'account exists');
    state.balances[id] = balance;
    res.status(201).json({ id, balance });
  });

  app.get('/accounts/:id', (req, res) => {
    if (!(req.params.id in state.balances)) throw new ApiError(404, 'unknown account');
    res.json({ id: req.params.id, balance: state.balances[req.params.id] });
  });

  app.post('/transfers', (req, res) => {
    const { from, to, amount } = req.body || {};
    state.balances = transfer(state.balances, from, to, amount);
    res.json({ ok: true });
  });

  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ error: err.message });
  });
  return app;
}

if (require.main === module) createApp().listen(3000, () => console.log('listening on :3000'));
module.exports = { createApp };
