'use strict';
// Pure business logic for the wallet API. No I/O, so it can be verified.

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Returns a NEW balances object with `amount` moved from src to dst.
function transfer(balances, src, dst, amount) {
  if (!Number.isInteger(amount) || amount <= 0) throw new ApiError(400, 'amount must be a positive integer');
  if (!(src in balances) || !(dst in balances)) throw new ApiError(404, 'unknown account');
  if (balances[src] < amount) throw new ApiError(409, 'insufficient funds');

  const newSrc = balances[src] - amount;
  const newDst = balances[dst] + amount;
  const out = { ...balances };
  out[src] = newSrc;
  out[dst] = newDst;
  return out;
}

module.exports = { transfer, ApiError };
