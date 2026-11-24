---
name: spec-from-tests
description: Turn a REST API's existing tests and routes into formal, machine-checkable properties (verify/spec.js). Use before proving anything, or when a new endpoint or invariant is added.
---

# spec-from-tests

Goal: produce `verify/spec.js`, the formal statement of "correct". Borrowed idea from
Anthropic's formal-verification work: you do not need a hand-written spec when the
developers' tests already say what must hold. Lift each test's intent into a property.

## Steps
1. Read `src/server.js` (routes) and `tests/*.test.js`. List what each test asserts.
2. Generalize each assertion from one example to all inputs. Example:
   "transfer 30 from alice to bob gives 70/80" becomes
   *P3: for any src != dst, after[src] = before[src] - amt and after[dst] = before[dst] + amt.*
3. Add invariants the tests imply but never state (conservation of money, no negative
   balance). Ask: "what would a bug that passes every test look like?"
4. Write each property in `verify/spec.js` as `(Z, {bal, after, src, dst, amt, k, exists}) => Z3 Bool`.
   Use an arbitrary extra account `k` so one proof covers every account.
5. Keep verified logic pure. If a rule lives in the Express handler, move it into
   `src/core.js` first; the proof only sees `core.js`.
6. Show the human the property list in plain English and STOP. Only a human runs
   `npm run lock` to freeze the spec.

## Rules
- Never weaken a property to make something pass. Never delete a test.
- Never run `npm run lock` yourself.
