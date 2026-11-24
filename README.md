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
npm test            # 4 passing example tests (bug hidden)
npm run verify      # P1 conservation fails: self-transfer mints money
patch -p1 < demo/fix.patch && npm run verify   # all PROVED
# replay the demo: patch -R -p1 < demo/fix.patch
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
