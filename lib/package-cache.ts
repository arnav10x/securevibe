// Database-backed cache for npm/PyPI lookups (the scanner's PackageCache).
//
// Reads happen as the signed-in user (the cache table is readable by any
// authenticated user — it holds public registry data). Writes require the
// admin client so users can't poison results for each other; when the
// secret key isn't configured, writes silently no-op and scans just do a
// few more live lookups.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PackageCache, PackageInfo, RegistryName } from '@/lib/scanner/types';
import { adminConfigured, createAdminClient } from '@/lib/supabase/admin';

const CACHE_TTL_DAYS = 7;

export function createSupabasePackageCache(reader: SupabaseClient): PackageCache {
  const writer = adminConfigured() ? createAdminClient() : null;

  return {
    async get(registry: RegistryName, name: string): Promise<PackageInfo | null> {
      const { data } = await reader
        .from('package_checks')
        .select('exists_on_registry, published_at, weekly_downloads, fetched_at')
        .eq('registry', registry)
        .eq('name', name.toLowerCase())
        .maybeSingle();
      if (!data) return null;

      const ageMs = Date.now() - new Date(data.fetched_at).getTime();
      if (ageMs > CACHE_TTL_DAYS * 86_400_000) return null; // stale — refetch

      return {
        existsOnRegistry: data.exists_on_registry,
        publishedAt: data.published_at ?? undefined,
        weeklyDownloads: data.weekly_downloads ?? undefined,
      };
    },

    async set(registry: RegistryName, name: string, info: PackageInfo): Promise<void> {
      if (!writer) return;
      await writer.from('package_checks').upsert(
        {
          registry,
          name: name.toLowerCase(),
          exists_on_registry: info.existsOnRegistry,
          published_at: info.publishedAt ?? null,
          weekly_downloads: info.weeklyDownloads ?? null,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: 'registry,name' },
      );
    },
  };
}
