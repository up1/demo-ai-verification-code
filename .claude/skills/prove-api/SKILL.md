---
name: prove-api
description: Run the formal verifier (Z3) on the REST API's core logic and explain the result. Use when asked to verify, prove, or check invariants of the API, or after any change to src/core.js.
---

# prove-api

## Run
```
npm test          # example-based tests
npm run verify    # formal proof
```

`verify/run.js` does four things, in order:
1. **Lock check**: spec and tests must match `verify/spec.lock`. Exit 2 means they were edited: stop and tell the human.
2. **Differential test**: `verify/model.js` (Z3 model of `core.js`) is compared with the real code on random inputs. Exit 3 means the model drifted from the code; fix `model.js` to mirror `core.js`, never the reverse.
3. **Proof**: each property in `spec.js` is checked for all inputs. `PROVED` means no input violates it, under the model.
4. **Replay**: any `COUNTEREXAMPLE` is re-run on the real code. `CONFIRMED REAL BUG` means it is genuine. `SPURIOUS` means the model is too loose.

## Report back
- Per property: PROVED or the concrete failing request in plain words
  (e.g. "transfer acc4 to itself with amount 1 turns balance 1 into 2").
- Note that passing `npm test` and failing `npm run verify` is expected for the demo bug.
- If everything is proved, finish with the trusted-base caveats from `patch-and-reprove`.
