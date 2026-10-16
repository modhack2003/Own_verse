'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const advisory = 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm';

// Keep the registry alert visible. Accept only this exact, locally patched leaf;
// every other advisory, malformed response and registry failure fails the check.
function evaluateAudit(report) {
  if (!report || report.error || !report.metadata?.vulnerabilities || !report.vulnerabilities) {
    throw new Error('Dependency audit did not return a valid vulnerability report');
  }
  const alerts = Object.entries(report.vulnerabilities);
  if (!Number.isInteger(report.metadata.vulnerabilities.total) || report.metadata.vulnerabilities.total !== alerts.length) {
    throw new Error('Inconsistent audit vulnerability count');
  }
  let mitigated = 0;
  for (const [name, alert] of alerts) {
    if (!Array.isArray(alert.via) || !alert.via.length) throw new Error('Invalid audit dependency: ' + name);
    for (const via of alert.via) {
      if (typeof via === 'string') {
        if (!report.vulnerabilities[via]) throw new Error('Incomplete audit dependency chain');
      } else if (name === 'braces' && via.name === 'braces' && via.url === advisory && via.range === '<=3.0.3') {
        if (!Array.isArray(alert.nodes) || !alert.nodes.length) throw new Error('Missing braces paths');
        const lock = require('../package-lock.json');
        for (const node of alert.nodes) {
          if (!node.endsWith('/braces') || lock.packages[node]?.version !== '3.0.3') throw new Error('Unreviewed braces copy');
        }
        mitigated++;
      } else {
        throw new Error('Unmitigated dependency advisory: ' + name + ' ' + (via.url || 'unknown'));
      }
    }
  }
  // A report consisting only of circular string references must never pass.
  for (const [name] of alerts) {
    const pending = [name], seen = new Set();
    let reachesAdvisory = false;
    while (pending.length) {
      const key = pending.pop();
      if (seen.has(key)) continue;
      seen.add(key);
      for (const via of report.vulnerabilities[key].via) {
        if (typeof via === 'string') pending.push(via);
        else reachesAdvisory = true;
      }
    }
    if (!reachesAdvisory) throw new Error('Audit chain has no reviewed advisory: ' + name);
  }
  return { packages: alerts.length, mitigated };
}

if (require.main === module) {
  const verify = spawnSync(process.execPath, [path.join(__dirname, 'patch-dependencies.cjs'), '--verify'], { stdio: 'inherit' });
  if (verify.status !== 0) process.exit(1);
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['audit', '--json'], {
    cwd: root, encoding: 'utf8', timeout: 90000, maxBuffer: 10 * 1024 * 1024,
    shell: process.platform === 'win32',
  });
  if (result.error || ![0, 1].includes(result.status)) throw result.error || new Error('npm audit failed');
  const report = JSON.parse(result.stdout);
  const reviewed = evaluateAudit(report);
  console.log('npm audit counts (not suppressed): ' + JSON.stringify(report.metadata.vulnerabilities));
  if (reviewed.mitigated) {
    console.warn('OPEN UPSTREAM ALERT: ' + advisory + '; locally mitigated in ' + reviewed.packages + ' affected dependency packages. See docs/dependency-security.md.');
  }
  console.log('No unmitigated advisories found in the dependency audit.');
}
module.exports = { evaluateAudit };
