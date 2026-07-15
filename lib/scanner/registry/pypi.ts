// Talks to the public PyPI JSON API, plus pypistats.org for download counts.
// No API keys needed for either.

import type { PackageInfo } from '../types';
import { LIMITS } from '../limits';

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
    if (!res.ok) return null;
    return { status: res.status, json: await res.json() };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function lookupPypiPackage(
  name: string,
  fetchImpl: typeof fetch,
): Promise<PackageInfo | null> {
  const doc = await fetchJson(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`, fetchImpl);
  if (doc === null) return null;
  if (doc.status === 404) return { existsOnRegistry: false };

  // Earliest upload across all releases = "first published".
  let publishedAt: string | undefined;
  const releases = (doc.json as { releases?: Record<string, { upload_time_iso_8601?: string }[]> })
    ?.releases;
  if (releases) {
    for (const files of Object.values(releases)) {
      for (const file of files ?? []) {
        const t = file.upload_time_iso_8601;
        if (t && (!publishedAt || t < publishedAt)) publishedAt = t;
      }
    }
  }

  // Download stats come from pypistats.org (a free community service).
  // If it's down we simply skip download-based findings — never guess.
  let weeklyDownloads: number | undefined;
  const stats = await fetchJson(
    `https://pypistats.org/api/packages/${encodeURIComponent(name.toLowerCase())}/recent`,
    fetchImpl,
  );
  const lastWeek = (stats?.json as { data?: { last_week?: number } })?.data?.last_week;
  if (typeof lastWeek === 'number') weeklyDownloads = lastWeek;

  return { existsOnRegistry: true, publishedAt, weeklyDownloads };
}
