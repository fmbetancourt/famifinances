#!/usr/bin/env node
// QLT-01 · scoped dependency audit. Blocks the build ONLY on high/critical advisories that
// affect the deployed server's runtime — the production dependency set of `apps/api`. Advisories
// confined to the mobile app or devDependencies are reported but do not block (they are not
// deployed). An advisory is allowed through only if it is recorded in the root package.json
// `pnpm.auditConfig.ignoreGhsas`/`ignoreCves` (mirrored, with rationale, in docs/security-checklist.md).
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** Runs a command and returns stdout, tolerating a non-zero exit (pnpm audit exits 1 on findings). */
function run(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    return typeof error.stdout === 'string' ? error.stdout : '';
  }
}

/** Recursively collect every package name in a pnpm `list --json` dependency tree. */
function collectNames(deps, set) {
  if (!deps) return;
  for (const [name, info] of Object.entries(deps)) {
    set.add(name);
    collectNames(info.dependencies, set);
  }
}

// 1 · the apps/api PRODUCTION dependency set (what the server runs).
const apiProd = new Set();
try {
  const listed = JSON.parse(run('pnpm --filter @famifinances/api list --prod --depth Infinity --json'));
  for (const project of Array.isArray(listed) ? listed : [listed]) {
    collectNames(project.dependencies, apiProd);
  }
} catch {
  console.error('audit-api: could not read the apps/api production dependency set.');
  process.exit(2);
}

// 2 · accepted-risk allowlist (the ONLY way an apps/api-prod advisory is allowed through).
const rootPkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const auditConfig = rootPkg.pnpm?.auditConfig ?? {};
const ignoreGhsas = new Set(auditConfig.ignoreGhsas ?? []);
const ignoreCves = new Set(auditConfig.ignoreCves ?? []);

// 3 · high/critical advisories.
const audit = JSON.parse(run('pnpm audit --audit-level=high --json') || '{}');
const advisories = Object.values(audit.advisories ?? {}).filter(
  (a) => a.severity === 'high' || a.severity === 'critical',
);

const blocking = [];
console.log(`\nDependency audit — ${advisories.length} high/critical advisor${advisories.length === 1 ? 'y' : 'ies'}:`);
for (const a of advisories) {
  const inApi = apiProd.has(a.module_name);
  const accepted = ignoreGhsas.has(a.github_advisory_id) || (a.cves ?? []).some((c) => ignoreCves.has(c));
  const scope = inApi ? 'apps/api-prod' : 'mobile/dev';
  const mark = inApi && !accepted ? 'BLOCK' : accepted ? 'accepted' : 'report';
  console.log(`  [${mark}] ${a.severity.padEnd(8)} ${a.module_name} (${a.github_advisory_id}) — ${scope}`);
  if (inApi && !accepted) blocking.push(a);
}

if (blocking.length > 0) {
  console.error(`\n✗ ${blocking.length} high/critical advisor${blocking.length === 1 ? 'y' : 'ies'} in the deployed apps/api runtime — build blocked.`);
  console.error('  Fix, or record an accepted risk in package.json pnpm.auditConfig + docs/security-checklist.md.');
  process.exit(1);
}
console.log('\n✓ No unaccepted high/critical advisory in the deployed apps/api runtime.');
