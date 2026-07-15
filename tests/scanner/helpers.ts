// Test helpers: a fake registry so dependency checks run fully offline
// and deterministically.

const KNOWN_NPM: Record<string, { created: string; downloads: number }> = {
  react: { created: '2011-10-26T17:46:21.942Z', downloads: 25_000_000 },
  express: { created: '2010-12-29T19:38:25.450Z', downloads: 30_000_000 },
};

const KNOWN_PYPI: Record<string, { created: string; downloads: number }> = {
  requests: { created: '2011-02-14T00:00:00Z', downloads: 100_000_000 },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Mimics registry.npmjs.org, api.npmjs.org, pypi.org and pypistats.org. */
export const fakeRegistryFetch: typeof fetch = async (input) => {
  const url = String(input);

  let match = /^https:\/\/registry\.npmjs\.org\/(.+)$/.exec(url);
  if (match) {
    const name = decodeURIComponent(match[1]).replace('%2F', '/');
    const known = KNOWN_NPM[name];
    if (!known) return json({ error: 'Not found' }, 404);
    return json({ name, time: { created: known.created } });
  }

  match = /^https:\/\/api\.npmjs\.org\/downloads\/point\/last-week\/(.+)$/.exec(url);
  if (match) {
    const name = decodeURIComponent(match[1]).replace('%2F', '/');
    const known = KNOWN_NPM[name];
    if (!known) return json({ error: 'Not found' }, 404);
    return json({ downloads: known.downloads });
  }

  match = /^https:\/\/pypi\.org\/pypi\/([^/]+)\/json$/.exec(url);
  if (match) {
    const known = KNOWN_PYPI[decodeURIComponent(match[1])];
    if (!known) return json({ message: 'Not Found' }, 404);
    return json({
      releases: { '1.0.0': [{ upload_time_iso_8601: known.created }] },
    });
  }

  match = /^https:\/\/pypistats\.org\/api\/packages\/([^/]+)\/recent$/.exec(url);
  if (match) {
    const known = KNOWN_PYPI[decodeURIComponent(match[1])];
    if (!known) return json({ message: 'Not Found' }, 404);
    return json({ data: { last_week: known.downloads } });
  }

  throw new Error(`fakeRegistryFetch: unexpected URL ${url}`);
};

export const FIXED_NOW = () => new Date('2026-07-14T12:00:00Z');
