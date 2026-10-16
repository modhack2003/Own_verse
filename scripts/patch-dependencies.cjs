'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const hash = value => createHash('sha256').update(value).digest('hex');
const patches = require('./security/braces-patch.json');
const guard = fs.readFileSync(path.join(__dirname, 'security/braces-depth-guard.cjs'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const verifyOnly = process.argv.includes('--verify');
const packages = Object.keys(lock.packages).filter(name => name.endsWith('/braces'));
if (!packages.length) throw new Error('Review and remove the braces mitigation: dependency is absent.');
const writes = [];
let installed = 0;
for (const name of packages) {
  const directory = path.resolve(root, name);
  if (!directory.startsWith(root + path.sep + 'node_modules' + path.sep)) throw new Error('Invalid package path');
  // Production installs omit build-only glob libraries. Do not create absent packages.
  if (lock.packages[name].dev === true && !fs.existsSync(directory)) continue;
  installed++;
  const pkg = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  if (pkg.name !== 'braces' || pkg.version !== '3.0.3') throw new Error('Review braces mitigation for changed version');
  for (const patch of patches) {
    const file = path.join(directory, patch.file);
    const original = fs.readFileSync(file, 'utf8');
    if (hash(original) === patch.patchedHash) continue;
    if (verifyOnly || hash(original) !== patch.originalHash) throw new Error('Missing or unexpected braces patch: ' + file);
    let modified = original;
    for (const [before, after] of patch.replacements) {
      if (modified.split(before).length !== 2) throw new Error('Unexpected braces source: ' + file);
      modified = modified.replace(before, after);
    }
    if (hash(modified) !== patch.patchedHash) throw new Error('Invalid patch result: ' + file);
    writes.push([file, modified]);
  }
  const target = path.join(directory, 'lib/own-verse-depth-guard.cjs');
  if (!fs.existsSync(target)) {
    if (verifyOnly) throw new Error('Missing braces AST guard');
    writes.push([target, guard]);
  } else if (hash(fs.readFileSync(target)) !== hash(guard)) {
    throw new Error('Unexpected braces AST guard');
  }
}
// Validate every installed copy before changing any of them.
for (const [file, contents] of writes) fs.writeFileSync(file, contents);
console.log('Braces 3.0.3 nesting mitigation ' + (verifyOnly ? 'verified' : 'applied') + ' (' + installed + ' installed copy/copies).');
