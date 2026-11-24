# verified-rest-demo

A tiny Node.js + Express wallet API with a planted bug that unit tests miss and a
formal check (Z3) catches. Three agent skills drive the workflow.

Inspired by Anthropic's [formal verification research](https://www.anthropic.com/research/formal-verification):
reuse tests as the spec, let a checker (not the model) judge proofs, patch bugs and
re-prove, and guard against gaming the spec. This demo is a drastic simplification:
SMT checking of one pure function instead of Rocq proofs over compiled binaries.

## Run
```
npm install
```

### 1. Example tests (bug hidden)
```
npm run test:unit       # 4 pass: the bug slips through
```

### 2. Property-based tests (fast-check)
Generated inputs for `transfer()` plus a stateful test that drives the HTTP API
against a reference model.
```
npm run test:property   # FAILS: shrinks to transfer(b->b, 1) minting money
```

### 3. Fuzz tests
Hostile/malformed requests must never cause a 5xx or break conservation.
```
npm run test:fuzz       # 5 pass
```
Run everything with `npm test`. Raise the generated cases per property with
`FC_RUNS=1000 npm run test:property` (defaults: 100, stateful test 50).

### 4. Formal verification (Z3)
```
npm run verify          # P1 conservation fails: self-transfer mints money
```

### 5. Fix and re-check everything
```
patch -p1 < demo/fix.patch
npm test                # all pass
npm run verify          # all PROVED
patch -R -p1 < demo/fix.patch   # replay the demo
```

## Layout
| Path | Role |
|---|---|
| `src/core.js` | Pure `transfer()` logic (verified) |
| `src/server.js` | Express routes (not verified) |
| `verify/spec.js` | Frozen formal properties |
| `verify/model.js` | Z3 model of `core.js` |
| `verify/run.js` | Lock check, differential test, proofs, counterexample replay |
| `.claude/skills/` | `spec-from-tests`, `prove-api`, `patch-and-reprove` |

## Try with Claude Code
Open this folder and ask: *"Use prove-api, then patch-and-reprove to fix whatever it finds."*

## Limits
Proofs cover `core.js` under a hand-written model, validated by differential testing.
HTTP layer, persistence and concurrency are out of scope.

## Comparision


| Dimension | Property-Based Testing (PBT) | Fuzz Testing (Fuzzing) | Formal Verification |
| :--- | :--- | :--- | :--- |
| **Core Goal** | Verify business logic and invariants hold across valid, structured inputs. | Find crashes, hangs, memory leaks, and security bugs via malformed/unexpected inputs. | Mathematically prove a system satisfies a specification for 100% of possible inputs. |
| **Input Generation** | Type- and schema-aware generators (arbitraries) that construct valid domain objects. | Mutation- or coverage-guided raw bytes, strings, or mutated files designed to break parsers. | Exhaustive state-space exploration or symbolic execution (no random sampling). |
| **Pass/Fail Oracle** | Explicit user-defined properties (e.g., round-trip, idempotency, invariants). | Implicit crash/sanitizer checks (segfaults, unhandled exceptions, timeouts, memory corruption). | Formal mathematical theorems or temporal logic assertions (e.g., TLA+, Coq, Lean). |
| **Failure Debugging** | Automatic shrinking reduces failing inputs to the minimal human-readable counterexample. | Corpus minimization tools reduce crashing byte payloads (often still hard to read). | Produces an exact counterexample trace of state transitions leading to violation. |
| **Setup & Effort** | Low to Moderate — integrates directly into standard unit test suites (e.g., `fast-check`). | Moderate — requires dedicated fuzz harnesses, sanitizers, and long CPU runs. | Very High — requires specialized formal languages and deep mathematical expertise. |

