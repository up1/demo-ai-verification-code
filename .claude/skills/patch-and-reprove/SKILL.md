---
name: patch-and-reprove
description: Fix a bug found by the formal verifier, keep the model in sync, and re-prove, with anti-gaming checks. Use after prove-api reports a confirmed counterexample.
---

# patch-and-reprove

The loop from Anthropic's approach: find reachable bug, patch the code, regenerate the
model, re-prove. The danger is "fixing" by gaming the spec, so follow the guardrails.

## Loop
1. Take the confirmed counterexample from `prove-api`. Explain the root cause in one sentence.
2. Make the **smallest** fix in `src/core.js` (e.g. reject `src === dst` with 400).
3. Update `verify/model.js` so it mirrors the new code, line by line.
4. `npm test && npm run verify`. Repeat from step 1 if a new counterexample appears.

## Guardrails (do not violate)
- Never edit `verify/spec.js`, `verify/spec.lock`, or `tests/`. If a property is truly wrong,
  stop and ask the human.
- Never make the function trivially safe (always throw, always return input). Check that
  `tests/` still pass and that P3 (exact effect) still PROVES, since it forces real behavior.
- Never touch `verify/run.js` or `lock.js` to loosen checks.
- Show the final diff to the human.

## Final report must include the trusted base
A proof is only as good as what it assumes. State plainly:
- The model in `verify/model.js` is checked against the code only by random testing, not proven equal.
- Only `src/core.js` is covered. Express routing, JSON parsing, persistence and concurrency are not.
- Arithmetic is mathematical integers; JS numbers lose exactness above 2^53.
- Z3 and the Node runtime are trusted.
- Properties cover what is in `spec.js` only (no authentication, rate limits, etc.).

A reference fix is in `demo/fix.patch` (`patch -p1 < demo/fix.patch`). Do not apply it
before attempting the loop yourself unless asked.
