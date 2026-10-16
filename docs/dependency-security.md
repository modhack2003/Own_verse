# Dependency security remediation — 16 October 2026

Scope: the npm dependency findings on main commit `2f75af1`. GitHub's private code-scanning, secret-scanning and Dependabot alert states were not accessible through the available connection. This work does not certify the entire application as vulnerability-free.

## Changes, in order

1. Upgrade Next.js and its ESLint config from 15.5.23 to 15.5.28. Stay on the existing React 18 / Next 15 application architecture.
2. Override Next's pinned PostCSS to 8.5.30 and optional Sharp to 0.35.5. These clear the image-codec and CSS advisories without leaving an older nested copy. The security regression script actually encodes AVIF and decodes it to resized WebP.
3. Align Prisma CLI and client at 6.19.3. Override `@prisma/config → deepmerge-ts` to 8.0.2, rather than migrating this MongoDB application to another Prisma major. Verify client generation, merge behavior and transactional database integrations.
4. Refresh compatible patched transitive dependencies (including Undici, fast-uri, js-yaml, brace-expansion and source-map-js). Update ESLint within major 9 and Jest within major 30.
5. Override both Tailwind and postcss-nested's selector parser to 7.1.6. Test the production CSS build and browser flows to validate this major-version override.
6. Override js-yaml to 4.3.2. Its `load` API is the one used by the legacy NYC loader; this removes that loader's obsolete argparse/sprintf-js dependency chain. A real temporary YAML coverage configuration is loaded in the regression script.
7. Remove unused patch-package (there were no patches or script references). Move tailwindcss-animate to devDependencies: it is required only by tailwind.config.ts, never by application runtime code. Tailwind's globbing tools can now be omitted from production dependency installations.
8. Add the specific local braces mitigation below, its install-time verification, regression checks and a CI audit gate.

Node.js 22 or newer is required. This matches the existing CI Node 22 setup and supports the patched image dependencies. Keep development dependencies installed for builds, tests and Prisma generation, as before.

## Remaining upstream advisory: braces 3.0.3

- [GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
- [Upstream discussion and depth-guard recommendation](https://github.com/micromatch/braces/issues/70)
- No patched braces release was published at the time of this change.
- The dependency remains in development tooling (Tailwind, ESLint, globbing), and no public API accepts user-provided glob patterns.
- Raw `npm audit` still reports **7 high affected packages**, all from this single advisory: braces, chokidar, fast-glob, micromatch, tailwindcss, @next/eslint-plugin-next, eslint-config-next. These are dependency-chain counts, not seven separate flaws.
- `npm audit --omit=dev` reports **0 vulnerabilities** after this change. Excluding build-only packages does not remove the need to protect build tooling.

`scripts/patch-dependencies.cjs` applies a narrow, reproducible mitigation to every installed braces 3.0.3 copy before Prisma generation:

- Cap parser stack nesting, including parentheses and mixed brace/parenthesis patterns.
- Validate AST depth, size and child-node cycles iteratively before compile/expand/stringify recursion.
- Check original and patched SHA-256 hashes; unknown source/version changes fail installation rather than guessing.
- Support repeated installation without double-patching. A production install may omit absent, dev-only copies.
- Keep package versions, registry metadata and raw audit alerts unchanged.

Tests cover normal expansions/ranges/escaped literals, deeply nested inputs under the upstream character limit, caller-supplied deep/cyclic ASTs, real image codecs, YAML loading and Prisma configuration merging. The nesting mitigation addresses this advisory; it does not claim to make arbitrary untrusted glob patterns safe against every possible CPU or memory exhaustion pattern.

## Checks and future maintenance

```sh
npm ci
npm run security:check
npm run typecheck
npm run lint
npm test -- --runInBand
npm audit --omit=dev
```

The normal database integration, release-content check, production build and desktop/mobile Playwright checks remain in CI.

`security:check` first verifies hashes and runs the mitigation regression checks, then fetches the current npm audit report. It prints the actual remaining counts and an explicit OPEN UPSTREAM ALERT warning. Its only exception is the exact braces advisory and affected version above; new advisories, malformed/incomplete reports, mismatched counts, missing patches and registry failures fail the check. It does not dismiss GitHub alerts or suppress raw npm audit results.

When a patched braces release is available, upgrade its consuming tooling, remove the local mitigation/exception, and rerun clean-install, security, CSS build and browser checks. Retest the cross-major deepmerge, selector-parser, YAML and Sharp overrides before removing or changing them. Avoid `npm audit fix --force`: its suggested major upgrades/downgrades do not preserve this application's compatibility.

The baseline audit was **56 affected packages: 1 critical, 51 high, 4 moderate** (including development dependencies), with **18 affected packages** when development dependencies were omitted.

## Verification recorded for this change

- A clean npm ci applied the exact mitigation and generated matching Prisma 6.19.3 clients.
- Dependency regression checks and the live audit gate passed.
- TypeScript and ESLint passed; 37 Jest suites / 372 tests passed.
- Real disposable MongoDB tests passed for concurrency limits, auth, contact/import/sync, content history and atomic backup recovery.
- Missing-database content validation correctly refused the build.
- The Next.js 15.5.28 production build passed. All 12 desktop/mobile Playwright scenarios passed against real local APIs and the disposable database.

Raw audit counts remain 7 high / 0 critical for all dependencies and 0 for dependencies with development tools omitted. No GitHub alerts were dismissed and no production content was modified.

A production-only clean npm ci --omit=dev also passed, generated Prisma, reported zero audit findings, and served /, /blog, /api/site-audio and /robots.txt from the standalone server.
