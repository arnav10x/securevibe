// Known-vulnerability lookups against OSV.dev — the free, no-auth aggregate
// of GitHub Advisories, PyPA, and more, covering npm and PyPI. This is the
// ground truth the old dependency check was missing: not "does this package
// exist?" but "does the version you're using have a published CVE?".
//
// Flow: one batched POST tells us WHICH (package, version) pairs have vulns
// (ids only), then we hydrate just those ids for severity + details. A
// clean project makes one cheap call and no hydration.

import type { Severity } from '../types';
import { LIMITS } from '../limits';

export type OsvEcosystem = 'npm' | 'PyPI';

export interface OsvVulnerability {
  id: string;
  /** CVE / GHSA aliases, best one shown to the user. */
  aliases: string[];
  summary: string;
  severity: Severity;
  reference: string | null;
}

export interface OsvQuery {
  /** Caller's key to join results back to a dependency, e.g. "npm:lodash". */
  key: string;
  ecosystem: OsvEcosystem;
  name: string;
  version: string;
}

/** Never hydrate more than this many distinct advisories per scan. */
const MAX_HYDRATIONS = 60;

async function postJson(url: string, body: unknown, fetchImpl: typeof fetch): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIMITS.REGISTRY_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', 'user-agent': 'securevibe-scanner' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(url: string, fetchImpl: typeof fetch): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIMITS.REGISTRY_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      headers: { accept: 'application/json', 'user-agent': 'securevibe-scanner' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Map OSV/GHSA severity words (and a CVSS fallback) to our four levels. */
function mapSeverity(record: Record<string, unknown>): Severity {
  const dbSpecific = record['database_specific'] as { severity?: string } | undefined;
  const word = dbSpecific?.severity?.toUpperCase();
  if (word === 'CRITICAL') return 'critical';
  if (word === 'HIGH') return 'high';
  if (word === 'MODERATE' || word === 'MEDIUM') return 'medium';
  if (word === 'LOW') return 'low';

  // Fallback: a CVSS base score if one is present as a plain number.
  const sev = record['severity'] as { score?: string }[] | undefined;
  for (const s of sev ?? []) {
    const n = Number(s.score);
    if (!Number.isNaN(n)) {
      if (n >= 9) return 'critical';
      if (n >= 7) return 'high';
      if (n >= 4) return 'medium';
      return 'low';
    }
  }
  return 'high'; // an unrated advisory is still an advisory — err serious
}

function toVulnerability(record: Record<string, unknown>): OsvVulnerability {
  const id = String(record['id'] ?? '');
  const aliases = Array.isArray(record['aliases']) ? (record['aliases'] as string[]) : [];
  const summary = String(record['summary'] ?? record['details'] ?? '').slice(0, 300);
  const refs = record['references'] as { url?: string }[] | undefined;
  const reference = refs?.find((r) => r.url)?.url ?? null;
  return { id, aliases, summary, severity: mapSeverity(record), reference };
}

/**
 * Returns a map from each query's `key` to the vulnerabilities affecting that
 * exact version. Empty map on total network failure (we never invent a CVE).
 */
export async function queryOsv(
  queries: OsvQuery[],
  fetchImpl: typeof fetch,
): Promise<Map<string, OsvVulnerability[]>> {
  const out = new Map<string, OsvVulnerability[]>();
  if (queries.length === 0) return out;

  const body = {
    queries: queries.map((q) => ({
      package: { name: q.name, ecosystem: q.ecosystem },
      version: q.version,
    })),
  };
  const batch = (await postJson('https://api.osv.dev/v1/querybatch', body, fetchImpl)) as
    | { results?: { vulns?: { id: string }[] }[] }
    | null;
  if (!batch) return out;

  // Align results to queries by index (OSV guarantees this order; we stay
  // defensive in case a mock or a partial response is shorter).
  const results = batch.results ?? [];
  const idsPerQuery: string[][] = queries.map((_, i) => (results[i]?.vulns ?? []).map((v) => v.id));
  const uniqueIds = Array.from(new Set(idsPerQuery.flat())).slice(0, MAX_HYDRATIONS);

  const hydrated = new Map<string, OsvVulnerability>();
  await Promise.all(
    uniqueIds.map(async (id) => {
      const rec = (await getJson(`https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`, fetchImpl)) as
        | Record<string, unknown>
        | null;
      if (rec) hydrated.set(id, toVulnerability(rec));
    }),
  );

  queries.forEach((q, i) => {
    const vulns = idsPerQuery[i]
      .map((id) => hydrated.get(id))
      .filter((v): v is OsvVulnerability => Boolean(v));
    if (vulns.length > 0) out.set(q.key, vulns);
  });
  return out;
}
