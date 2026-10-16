'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

async function main() {
  const verified = spawnSync(process.execPath, [path.join(__dirname, 'patch-dependencies.cjs'), '--verify'], { stdio: 'inherit' });
  assert.equal(verified.status, 0, 'Every installed braces copy must have the exact reviewed patch');
  const lock = require('../package-lock.json');
  for (const name of Object.keys(lock.packages).filter(name => name.endsWith('/braces'))) {
    // Isolate malicious inputs with a timeout so a regression cannot hang CI.
    const code = `
      const assert = require('node:assert/strict');
      const braces = require(${JSON.stringify(path.join(root, name))});
      const reject = fn => assert.throws(fn, e => e instanceof SyntaxError && /safe nesting|safe size|AST size/.test(e.message));
      assert.deepEqual(braces.expand('src/{app,lib}/file{1..2}.ts'), ['src/app/file1.ts','src/app/file2.ts','src/lib/file1.ts','src/lib/file2.ts']);
      assert.equal(braces.compile('a/{b,c}/d'), 'a/(b|c)/d');
      assert.deepEqual(braces.expand('{a,{b,c}}'), ['a','b','c']);
      assert.deepEqual(braces.expand('a/'+String.fromCharCode(92)+'{b,c'+String.fromCharCode(92)+'}/d'), ['a/{b,c}/d']);
      for (const depth of [101, 3500, 4000]) {
        for (const pattern of ['{'.repeat(depth)+'a,b'+'}'.repeat(depth), '('.repeat(depth)+'a'+')'.repeat(depth), '{('.repeat(Math.ceil(depth/2))+'a'+')}'.repeat(Math.ceil(depth/2))]) {
          for (const method of ['parse','compile','expand','stringify']) reject(() => braces[method](pattern, {maxLength: Infinity}));
          reject(() => braces(pattern));
        }
      }
      let tree = {type:'text',value:'a'};
      for (let i=0; i<4000; i++) tree = {type:'root', nodes:[tree]};
      const cyclic = {type:'root',nodes:[]}; cyclic.nodes.push(cyclic);
      for (const ast of [tree,cyclic]) for (const method of ['compile','expand','stringify']) reject(() => braces[method](ast));
      for (const method of ['compile','expand','stringify']) braces[method]('('.repeat(50)+'a'+')'.repeat(50));
    `;
    const test = spawnSync(process.execPath, ['-e', code], { encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024 });
    assert.equal(test.status, 0, test.stderr || test.error?.message);
  }
  // Exercise the image codec after the sharp override, not only its version.
  const sharp = require(require.resolve('sharp', { paths: [path.dirname(require.resolve('next/package.json'))] }));
  const input = Buffer.from('<svg width="12" height="8"><rect width="12" height="8" fill="red"/></svg>');
  const avif = await sharp(input).avif().toBuffer();
  const webp = await sharp(avif).resize(6, 4).webp().toBuffer();
  const metadata = await sharp(webp).metadata();
  assert.equal(metadata.width, 6); assert.equal(metadata.height, 4); assert.equal(metadata.format, 'webp');

  // Prove that the YAML override keeps Jest coverage-config loading working.
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'own-verse-nyc-'));
  try {
    fs.writeFileSync(path.join(temp, 'package.json'), JSON.stringify({ private: true }));
    fs.writeFileSync(path.join(temp, '.nycrc.yml'), 'all: true\ninclude:\n  - src/**/*.ts\n');
    const { loadNycConfig } = require('@istanbuljs/load-nyc-config');
    const config = await loadNycConfig({ cwd: temp });
    assert.equal(config.all, true); assert.deepEqual(config.include, ['src/**/*.ts']);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }

  const fromPrisma = createRequire(require.resolve('@prisma/config'));
  const { deepmerge } = fromPrisma('deepmerge-ts');
  assert.deepEqual(deepmerge({ a: { x: 1 } }, { a: { y: 2 } }), { a: { x: 1, y: 2 } });
  const left = {}, right = {}; left.self = left; right.self = right;
  try { deepmerge(left, right); } catch (error) { assert.doesNotMatch(error.message, /Maximum call stack size exceeded/); }

  const { evaluateAudit } = require('./audit-dependencies.cjs');
  assert.throws(() => evaluateAudit({}), /valid vulnerability report/);
  const base = { metadata: { vulnerabilities: { total: 0 } }, vulnerabilities: {} };
  assert.deepEqual(evaluateAudit(base), { packages: 0, mitigated: 0 });
  assert.throws(() => evaluateAudit({ metadata: { vulnerabilities: { total: 1 } }, vulnerabilities: { surprise: { via: [{ url: 'https://example.com/new-advisory' }] } } }), /Unmitigated/);
  assert.throws(() => evaluateAudit({ metadata: { vulnerabilities: { total: 2 } }, vulnerabilities: { a: { via: ['b'] }, b: { via: ['a'] } } }), /no reviewed advisory/);
  assert.throws(() => evaluateAudit({ metadata: { vulnerabilities: { total: 1 } }, vulnerabilities: {} }), /Inconsistent/);
  const reviewed = { name: 'braces', url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm', range: '<=3.0.3' };
  const known = { metadata: { vulnerabilities: { total: 1 } }, vulnerabilities: { braces: { via: [reviewed], nodes: ['node_modules/braces'] } } };
  assert.equal(evaluateAudit(known).mitigated, 1);
  assert.throws(() => evaluateAudit({ ...known, vulnerabilities: { braces: { ...known.vulnerabilities.braces, via: [{ ...reviewed, url: 'https://example.com/new-advisory' }] } } }), /Unmitigated/);
  console.log('Dependency security regression checks passed: nesting/AST guards, image AVIF/WebP codecs, YAML coverage config, Prisma merging, and fail-closed audit parsing.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
