'use strict';
// Z3 model of src/core.js::transfer. Must mirror the code line by line.
// run.js differential-tests this model against the real code, so a model
// that drifts from the implementation is caught.
function modelTransfer(Z, exists, bal, src, dst, amt) {
  const ok = Z.And(
    amt.gt(0), exists.select(src), exists.select(dst), bal.select(src).ge(amt));
  const newSrc = bal.select(src).sub(amt);   // read BOTH from original state
  const newDst = bal.select(dst).add(amt);
  const written = bal.store(src, newSrc).store(dst, newDst);  // dst written last
  return { ok, after: Z.If(ok, written, bal) };
}
module.exports = { modelTransfer };
