// Check 3: dependency risk.
//
// Two questions, not one:
//   1. Does this package even exist? AI tools invent plausible names
//      ("slopsquatting"); attackers register them with malware.
//   2. Does the version you use have a KNOWN vulnerability? Verified against
//      OSV.dev (free, aggregates GitHub Advisories + PyPA), the same data
//      `npm audit` uses — which the old check never looked at.
//
// Exact versions come from a lockfile when present (a fact); otherwise we fall
// back to the floor of the declared range (a strong guess, flagged as such).

import path from 'node:path';
import type { Finding, PackageCache, PackageInfo, RegistryName, ScannerOptions } from '../types';
import type { WalkedFile } from '../walk';
import { LIMITS } from '../limits';
import { lookupNpmPackage } from '../registry/npm';
import { lookupPypiPackage } from '../registry/pypi';
import { queryOsv, type OsvEcosystem, type OsvQuery } from '../registry/osv';
import { versionFromSpec } from '../util';

const NEW_PACKAGE_DAYS = 30;
const LOW_DOWNLOADS_PER_WEEK = 500;

interface DependencyRef {
  registry: RegistryName;
  name: string;
  /** The raw version spec as declared, e.g. "^1.2.0" or "==2.3.1". */
  spec: string;
  manifestPath: string;
}

/** Version specs that point at local paths/URLs — not registry packages. */
function isNonRegistrySpec(spec: string): boolean {
  return /^(file:|link:|workspace:|git\+|git:|github:|https?:|\.{0,2}\/)/.test(spec);
}

export function parsePackageJson(relPath: string, content: string): DependencyRef[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }
  const refs: DependencyRef[] = [];
  const sections = ['dependencies', 'devDependencies'] as const;
  for (const section of sections) {
    const deps = (parsed as Record<string, Record<string, string>>)[section];
    if (!deps || typeof deps !== 'object') continue;
    for (const [name, spec] of Object.entries(deps)) {
      if (typeof spec !== 'string' || isNonRegistrySpec(spec)) continue;
      // Basic npm name validity — anything weirder is likely a parse artifact.
      if (!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i.test(name)) continue;
      refs.push({ registry: 'npm', name, spec, manifestPath: relPath });
    }
  }
  return refs;
}

export function parseRequirementsTxt(relPath: string, content: string): DependencyRef[] {
  const refs: DependencyRef[] = [];
  for (const rawLine of content.split('\n')) {
    const line = rawLine.replace(/#.*$/, '').trim(); // strip comments
    if (!line) continue;
    if (line.startsWith('-')) continue; // flags like -r, -e, --hash
    if (/^(https?|git\+|file:)/.test(line)) continue; // direct URLs
    // Name is everything before extras/version specifiers: "requests[socks]>=2.0"
    const match = /^([A-Za-z0-9][A-Za-z0-9._-]*)/.exec(line);
    if (!match) continue;
    const spec = line.slice(match[0].length).replace(/^\[[^\]]*\]/, ''); // drop extras
    refs.push({ registry: 'pypi', name: match[1], spec, manifestPath: relPath });
  }
  return refs;
}

function isManifest(relPath: string): 'npm' | 'pypi' | null {
  const base = path.posix.basename(relPath).toLowerCase();
  if (base === 'package.json') return 'npm';
  if (/^requirements[^/]*\.txt$/.test(base)) return 'pypi';
  return null;
}

/**
 * Exact installed versions from a lockfile, keyed "registry:name" (lowercased).
 * Only package-lock.json (npm) is parsed today — it is reliable JSON and
 * covers most vibe-coded repos. yarn/pnpm lockfiles fall back to spec floors.
 */
export function buildVersionIndex(files: { file: WalkedFile; content: string }[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const { file, content } of files) {
    if (path.posix.basename(file.relPath).toLowerCase() !== 'package-lock.json') continue;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content) as Record<string, unknown>;
    } catch {
      continue;
    }
    // npm lockfile v2/v3: { packages: { "node_modules/lodash": { version } } }
    const packages = parsed['packages'] as Record<string, { version?: string }> | undefined;
    if (packages) {
      for (const [key, meta] of Object.entries(packages)) {
        const m = key.match(/node_modules\/((?:@[^/]+\/)?[^/]+)$/);
        if (m && meta?.version) index.set(`npm:${m[1].toLowerCase()}`, meta.version);
      }
    }
    // npm lockfile v1: { dependencies: { lodash: { version } } } (recursive)
    const walkV1 = (deps: Record<string, { version?: string; dependencies?: unknown }>) => {
      for (const [name, meta] of Object.entries(deps)) {
        if (meta?.version && !index.has(`npm:${name.toLowerCase()}`)) {
          index.set(`npm:${name.toLowerCase()}`, meta.version);
        }
        const nested = meta?.dependencies as Record<string, { version?: string }> | undefined;
        if (nested) walkV1(nested as Record<string, { version?: string; dependencies?: unknown }>);
      }
    };
    const v1 = parsed['dependencies'] as
      | Record<string, { version?: string; dependencies?: unknown }>
      | undefined;
    if (v1 && !packages) walkV1(v1);
  }
  return index;
}

/** Simple concurrency pool so we don't blast the registries. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export interface DependencyCheckResult {
  findings: Finding[];
  packagesChecked: number;
  lookupFailures: number;
}

export async function checkDependencies(
  files: { file: WalkedFile; content: string }[],
  options: ScannerOptions,
): Promise<DependencyCheckResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const cache: PackageCache | undefined = options.packageCache;
  const now = options.now ? options.now() : new Date();

  // Collect unique package references from every manifest we found.
  const manifests = files
    .filter(({ file }) => isManifest(file.relPath) !== null)
    .slice(0, LIMITS.MAX_MANIFESTS);

  const versionIndex = buildVersionIndex(files);

  const byKey = new Map<string, DependencyRef>();
  for (const { file, content } of manifests) {
    const kind = isManifest(file.relPath);
    const refs =
      kind === 'npm'
        ? parsePackageJson(file.relPath, content)
        : parseRequirementsTxt(file.relPath, content);
    for (const ref of refs) {
      const key = `${ref.registry}:${ref.name.toLowerCase()}`;
      if (!byKey.has(key)) byKey.set(key, ref);
    }
  }

  const refs = Array.from(byKey.values()).slice(0, LIMITS.MAX_PACKAGES);
  const findings: Finding[] = [];
  let lookupFailures = 0;

  // A resolved (existing) package + the version we'll ask OSV about.
  interface Resolved {
    ref: DependencyRef;
    version: string;
    /** true when the version came from a lockfile (exact), not a range floor. */
    exact: boolean;
  }
  const resolved: Resolved[] = [];

  await mapWithConcurrency(refs, LIMITS.REGISTRY_CONCURRENCY, async (ref) => {
    let info: PackageInfo | null = (await cache?.get(ref.registry, ref.name)) ?? null;
    if (!info) {
      info =
        ref.registry === 'npm'
          ? await lookupNpmPackage(ref.name, fetchImpl)
          : await lookupPypiPackage(ref.name, fetchImpl);
      if (info) await cache?.set(ref.registry, ref.name, info);
    }

    if (info === null) {
      lookupFailures++;
      return; // network problem — say nothing rather than guess
    }

    const registryLabel = ref.registry === 'npm' ? 'npm' : 'PyPI';

    if (!info.existsOnRegistry) {
      findings.push({
        checkType: 'dependency',
        severity: 'high',
        confidence: 'verified', // the registry itself returned 404
        ruleId: 'dep-nonexistent',
        title: `Dependency "${ref.name}" does not exist on ${registryLabel}`,
        explanation:
          `Your project declares "${ref.name}" as a dependency, but no such ` +
          `package exists on ${registryLabel}. This usually means an AI ` +
          'coding tool invented the name. It is dangerous beyond being ' +
          'broken: attackers watch for these hallucinated names and register ' +
          'them with malicious code ("slopsquatting"), so a future install ' +
          'could pull in malware.',
        filePath: ref.manifestPath,
        recommendation:
          `Remove "${ref.name}" from your dependencies or replace it with ` +
          'the real package you intended. Search the registry to find the ' +
          'correct name, and check what your code actually imports.',
      });
      return;
    }

    // The package exists — line it up for a known-vulnerability lookup.
    const key = `${ref.registry}:${ref.name.toLowerCase()}`;
    const lockVersion = versionIndex.get(key);
    const version = lockVersion ?? versionFromSpec(ref.spec) ?? undefined;
    if (version) resolved.push({ ref, version, exact: Boolean(lockVersion) });

    if (info.publishedAt) {
      const ageDays = (now.getTime() - new Date(info.publishedAt).getTime()) / 86_400_000;
      if (ageDays >= 0 && ageDays < NEW_PACKAGE_DAYS) {
        findings.push({
          checkType: 'dependency',
          severity: 'medium',
          confidence: 'heuristic',
          ruleId: 'dep-new',
          title: `Dependency "${ref.name}" is very new (${Math.max(1, Math.round(ageDays))} days old)`,
          explanation:
            `"${ref.name}" was first published less than ${NEW_PACKAGE_DAYS} days ago. ` +
            'Brand-new packages are occasionally malicious lookalikes of ' +
            'popular ones, published to catch typos and AI-suggested names.',
          filePath: ref.manifestPath,
          recommendation:
            'Verify this is really the package you meant: check its page on ' +
            `${registryLabel}, its repository, and its author before shipping.`,
        });
        return; // a new package always has low downloads; don't double-flag
      }
    }

    if (typeof info.weeklyDownloads === 'number' && info.weeklyDownloads < LOW_DOWNLOADS_PER_WEEK) {
      findings.push({
        checkType: 'dependency',
        severity: 'low',
        confidence: 'heuristic',
        ruleId: 'dep-low-downloads',
        title: `Dependency "${ref.name}" has very few downloads`,
        explanation:
          `"${ref.name}" gets fewer than ${LOW_DOWNLOADS_PER_WEEK} downloads a week. ` +
          'Low-adoption packages get less scrutiny, are abandoned more ' +
          'often, and are sometimes typo-lookalikes of popular packages.',
        filePath: ref.manifestPath,
        recommendation:
          'Double-check the spelling against the package you intended, and ' +
          'consider whether a widely-used alternative exists.',
      });
    }
  });

  // ── known-vulnerability lookup (OSV.dev) ────────────────────────────────
  if (!options.skipVulnerabilityLookup && resolved.length > 0) {
    const queries: OsvQuery[] = resolved.map((r) => ({
      key: `${r.ref.registry}:${r.ref.name.toLowerCase()}@${r.version}`,
      ecosystem: (r.ref.registry === 'npm' ? 'npm' : 'PyPI') as OsvEcosystem,
      name: r.ref.name,
      version: r.version,
    }));
    const vulnMap = await queryOsv(queries, fetchImpl);

    for (const r of resolved) {
      const qKey = `${r.ref.registry}:${r.ref.name.toLowerCase()}@${r.version}`;
      const vulns = vulnMap.get(qKey);
      if (!vulns || vulns.length === 0) continue;

      // One finding per package at its worst severity; list the rest in text.
      const rank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
      const worst = [...vulns].sort((a, b) => rank[a.severity] - rank[b.severity])[0];
      const idList = vulns
        .map((v) => v.aliases.find((a) => a.startsWith('CVE-')) ?? v.id)
        .slice(0, 5)
        .join(', ');
      const more = vulns.length > 5 ? ` (+${vulns.length - 5} more)` : '';

      findings.push({
        checkType: 'dependency',
        severity: worst.severity,
        // Exact (lockfile) version match is a fact; a range-floor guess is 'likely'.
        confidence: r.exact ? 'verified' : 'likely',
        ruleId: 'dep-known-vuln',
        title: `"${r.ref.name}" ${r.version} has ${vulns.length === 1 ? 'a known vulnerability' : `${vulns.length} known vulnerabilities`}`,
        explanation:
          `The version of "${r.ref.name}" your project uses (${r.version}` +
          `${r.exact ? '' : ', inferred from your version range — check your lockfile'}) ` +
          `has published security ${vulns.length === 1 ? 'advisory' : 'advisories'}: ${idList}${more}. ` +
          (worst.summary ? `The most serious: ${worst.summary} ` : '') +
          'Known vulnerabilities are the ones attackers scan for first, ' +
          'because the exploit is already public.',
        filePath: r.ref.manifestPath,
        evidenceMasked: worst.reference ?? undefined,
        recommendation:
          `Update "${r.ref.name}" to a patched version (run "npm audit fix" ` +
          'for npm, or bump the version and reinstall). If no fix exists yet, ' +
          'check the advisory for a workaround or a maintained alternative.',
      });
    }
  }

  return { findings, packagesChecked: refs.length, lookupFailures };
}
