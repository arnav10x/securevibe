// Check 3: dependency risk.
//
// Every package named in package.json / requirements.txt is verified against
// the REAL npm / PyPI registry. AI coding tools sometimes invent plausible
// package names that don't exist ("slopsquatting") — attackers register
// those names with malware, and the next `npm install` pulls it in.

import path from 'node:path';
import type { Finding, PackageCache, PackageInfo, RegistryName, ScannerOptions } from '../types';
import type { WalkedFile } from '../walk';
import { LIMITS } from '../limits';
import { lookupNpmPackage } from '../registry/npm';
import { lookupPypiPackage } from '../registry/pypi';

const NEW_PACKAGE_DAYS = 30;
const LOW_DOWNLOADS_PER_WEEK = 500;

interface DependencyRef {
  registry: RegistryName;
  name: string;
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
      refs.push({ registry: 'npm', name, manifestPath: relPath });
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
    refs.push({ registry: 'pypi', name: match[1], manifestPath: relPath });
  }
  return refs;
}

function isManifest(relPath: string): 'npm' | 'pypi' | null {
  const base = path.posix.basename(relPath).toLowerCase();
  if (base === 'package.json') return 'npm';
  if (/^requirements[^/]*\.txt$/.test(base)) return 'pypi';
  return null;
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

    if (info.publishedAt) {
      const ageDays = (now.getTime() - new Date(info.publishedAt).getTime()) / 86_400_000;
      if (ageDays >= 0 && ageDays < NEW_PACKAGE_DAYS) {
        findings.push({
          checkType: 'dependency',
          severity: 'medium',
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

  return { findings, packagesChecked: refs.length, lookupFailures };
}
