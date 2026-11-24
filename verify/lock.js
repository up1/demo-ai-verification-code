'use strict';
// Anti-gaming lock: hashes tests/ and verify/spec.js.
//   node verify/lock.js --write   (human only) record current hashes
//   node verify/lock.js           check; exit 1 if spec or tests changed
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const files = [...fs.readdirSync(path.join(root, 'tests')).sort().map((f) => path.join(root, 'tests', f)),
  path.join(root, 'verify/spec.js')];
const lockFile = path.join(root, 'verify/spec.lock');
const h = crypto.createHash('sha256');
for (const f of files) { h.update(path.basename(f)); h.update(fs.readFileSync(f)); }
const digest = h.digest('hex');

if (process.argv.includes('--write')) { fs.writeFileSync(lockFile, digest + '\n'); console.log('lock written'); }
else if (fs.existsSync(lockFile) && fs.readFileSync(lockFile, 'utf8').trim() === digest) console.log('lock OK: spec and tests unchanged');
else { console.log('LOCK MISMATCH: spec or tests were modified. Stop and ask a human.'); process.exit(1); }
