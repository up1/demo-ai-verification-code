'use strict';
// FROZEN SPEC: formal properties of transfer(). Hash-locked by lock.js.
// Each property: (Z, {bal, after, src, dst, amt, k, exists}) -> Z3 Bool.
// bal/after map integer account id -> balance; `k` is an arbitrary extra
// account, so one check covers every account in the system.
// Do NOT edit to make a proof pass. Changing this file needs human sign-off.

const PROPERTIES = {
  // P1: money is conserved (net change over touched accounts is zero)
  'P1 conservation': (Z, { bal, after, src, dst }) => {
    const dSrc = after.select(src).sub(bal.select(src));
    const dDst = after.select(dst).sub(bal.select(dst));
    return Z.If(src.eq(dst), dSrc, dSrc.add(dDst)).eq(0);
  },
  // P2: no account ever goes negative
  'P2 non-negative': (Z, { after, k, exists }) =>
    Z.Implies(exists.select(k), after.select(k).ge(0)),
  // P3: exact effect when src != dst
  'P3 exact effect': (Z, { bal, after, src, dst, amt }) =>
    Z.Implies(src.neq(dst), Z.And(
      after.select(src).eq(bal.select(src).sub(amt)),
      after.select(dst).eq(bal.select(dst).add(amt)))),
};

// Invariant assumed before the call: every existing account is >= 0.
const precondition = (Z, { bal, src, dst, k, exists }) =>
  Z.And(...[src, dst, k].map((x) => Z.Implies(exists.select(x), bal.select(x).ge(0))));

module.exports = { PROPERTIES, precondition };
