// Talks to the public npm registry. No API key needed.

import type { PackageInfo } from '../types';
import { LIMITS } from '../limits';

function encodeName(name: string): string {
  // Scoped packages (@scope/name) need the slash encoded.
  return name.startsWith('@') ? name.replace('/', '%2F') : encodeURIComponent(name);
}

async function fetchJson(
  url: string,
  fetchImpl: typeof fetch,
): Promise<{ status: number; json: unknown } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIMITS.REGISTRY_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      headers: { accept: 'application/json', 'user-agent': 'securevibe-scanner' },
    });
    if (res.status === 404) return { status: 404, json: null };
    if (!res.ok) return null; // treat rate limits / 5xx as "unknown"
    return { status: res.status, json: await res.json() };
  } catch {
    return null; // network error / timeout -> unknown, never a finding
  } finally {
    clearTimeout(timer);
  }
}

export async function lookupNpmPackage(
  name: string,
  fetchImpl: typeof fetch,
): Promise<PackageInfo | null> {
  const doc = await fetchJson(`https://registry.npmjs.org/${encodeName(name)}`, fetchImpl);
  if (doc === null) return null; // lookup failed
  if (doc.status === 404) return { existsOnRegistry: false };

  let publishedAt: string | undefined;
  const time = (doc.json as { time?: Record<string, string> })?.time;
  if (time?.created) publishedAt = time.created;

  let weeklyDownloads: number | undefined;
  const dl = await fetchJson(
    `https://api.npmjs.org/downloads/point/last-week/${encodeName(name)}`,
    fetchImpl,
  );
  if (dl?.json && typeof (dl.json as { downloads?: number }).downloads === 'number') {
    weeklyDownloads = (dl.json as { downloads: number }).downloads;
  }

  return { existsOnRegistry: true, publishedAt, weeklyDownloads };
}
