'use strict';
// Verify src/core.js::transfer against verify/spec.js.
// 1) lock check  2) model-vs-code differential test
// 3) SMT proof per property  4) replay any counterexample on the REAL code.
const { execFileSync } = require('child_process');
const path = require('path');
const { init } = require('z3-solver');
const { transfer, ApiError } = require('../src/core');
const { modelTransfer } = require('./model');
const { PROPERTIES, precondition } = require('./spec');

const NAME = (i) => `acc${i}`;

function realCall(d, s, t, a) {
  try { return { ok: true, after: transfer({ ...d }, NAME(s), NAME(t), a) }; }
  catch (e) { if (e instanceof ApiError) return { ok: false, after: { ...d } }; throw e; }
}

(async () => {
  console.log('[1] spec/test lock');
  try { process.stdout.write(execFileSync('node', [path.join(__dirname, 'lock.js')], { encoding: 'utf8' })); }
  catch (e) { process.stdout.write(e.stdout); process.exit(2); }

  const { Context } = await init();
  const Z = Context('main');
  const I = Z.Int.sort();

  // concrete JS object -> Z3 arrays (so the SAME spec/model code evaluates it)
  const toArrays = (d, ids) => {
    let bal = Z.Array.K(I, Z.Int.val(0)), ex = Z.Array.K(I, Z.Bool.val(false));
    for (const i of ids) if (NAME(i) in d) {
      bal = bal.store(Z.Int.val(i), Z.Int.val(d[NAME(i)]));
      ex = ex.store(Z.Int.val(i), Z.Bool.val(true));
    }
    return { bal, ex };
  };
  const holds = async (expr) => Z.isTrue(await Z.simplify(expr));
  const rec = (bal, after, ex, s, t, a, k) =>
    ({ bal, after, exists: ex, src: Z.Int.val(s), dst: Z.Int.val(t), amt: Z.Int.val(a), k: Z.Int.val(k) });

  console.log('[2] model vs real code (differential test)');
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const ri = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
  for (let n = 0; n < 400; n++) {
    const ids = [0, 1, 2], d = {};
    for (const i of ids) if (rnd() < 0.85) d[NAME(i)] = ri(0, 5);
    const s = ri(0, 2), t = ri(0, 2), a = ri(-2, 7);
    const { bal, ex } = toArrays(d, ids);
    const m = modelTransfer(Z, ex, bal, Z.Int.val(s), Z.Int.val(t), Z.Int.val(a));
    const r = realCall(d, s, t, a);
    const { bal: balR } = toArrays(r.after, ids);
    let same = true;
    for (const i of ids) same = same && await holds(m.after.select(Z.Int.val(i)).eq(balR.select(Z.Int.val(i))));
    if ((await holds(m.ok)) !== r.ok || (r.ok && !same)) {
      console.log(`  MODEL/CODE MISMATCH on ${JSON.stringify(d)}, ${NAME(s)}->${NAME(t)}, amount=${a}`); process.exit(3);
    }
  }
  console.log('  model agrees with code on 400 random cases');

  console.log('[3] SMT proofs');
  const exists = Z.Array.const('exists', I, Z.Bool.sort()), bal = Z.Array.const('bal', I, I);
  const [src, dst, amt, k] = ['src', 'dst', 'amt', 'k'].map((n) => Z.Int.const(n));
  const { ok, after } = modelTransfer(Z, exists, bal, src, dst, amt);
  const ctx = { bal, after, src, dst, amt, k, exists };
  let failed = false;

  for (const [name, prop] of Object.entries(PROPERTIES)) {
    const solver = new Z.Solver();
    solver.add(precondition(Z, ctx), ok, Z.Not(prop(Z, ctx)));
    if ((await solver.check()) === 'unsat') { console.log(`  PROVED          ${name}`); continue; }
    failed = true;
    console.log(`  COUNTEREXAMPLE  ${name}`);
    const m = solver.model();
    const num = (e) => Number(m.eval(e, true).value());
    const flag = (e) => Z.isTrue(m.eval(e, true));
    const [S, T, A, K] = [src, dst, amt, k].map(num);
    const d = {};
    for (const i of new Set([S, T, K])) if (flag(exists.select(Z.Int.val(i)))) d[NAME(i)] = num(bal.select(Z.Int.val(i)));
    console.log(`      state=${JSON.stringify(d)}  request: ${NAME(S)} -> ${NAME(T)}  amount=${A}`);
    const r = realCall(d, S, T, A);
    if (!r.ok) { console.log('      replay on real code: rejected -> SPURIOUS, model is too loose'); continue; }
    const ids = [S, T, K], b0 = toArrays(d, ids), b1 = toArrays(r.after, ids);
    const ok2 = await holds(prop(Z, rec(b0.bal, b1.bal, b0.ex, S, T, A, K)));
    console.log(`      replay on real code: result=${JSON.stringify(r.after)}  property holds? ${ok2}` + (ok2 ? '' : '  -> CONFIRMED REAL BUG'));
  }
  process.exit(failed ? 1 : 0);
})();
