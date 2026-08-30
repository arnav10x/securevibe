// Test helpers: a fake registry so dependency checks run fully offline
// and deterministically, plus a fixture loader for the structural grader.

import fs from 'node:fs';
import path from 'node:path';
import { analyzeStructure, type SourceFile } from '@/lib/scanner/uiux';

const TEXT_FILE = /\.(?:tsx|jsx|ts|js|mjs|astro|vue|svelte|html|css|scss|sass|less|json)$/;

/** Read a fixture directory into the shapes analyzeStructure takes. */
export function loadFixture(dir: string): { sources: SourceFile[]; allPaths: string[] } {
  const sources: SourceFile[] = [];
  const allPaths: string[] = [];
  const walk = (abs: string, rel: string): void => {
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const absChild = path.join(abs, entry.name);
      const relChild = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(absChild, relChild);
      else {
        allPaths.push(relChild);
        if (TEXT_FILE.test(relChild)) {
          sources.push({ relPath: relChild, content: fs.readFileSync(absChild, 'utf8') });
        }
      }
    }
  };
  walk(dir, '');
  return { sources, allPaths };
}

/** Run the structural grader over a fixture directory. */
export function analyzeFixture(dir: string, nowYear = 2026) {
  const { sources, allPaths } = loadFixture(dir);
  return analyzeStructure(sources, allPaths, { nowYear });
}

/** Run the structural grader over inline files (paths -> contents). */
export function analyzeFiles(files: Record<string, string>, nowYear = 2026) {
  const sources = Object.entries(files).map(([relPath, content]) => ({ relPath, content }));
  return analyzeStructure(sources, Object.keys(files), { nowYear });
}

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

/** Mimics registry.npmjs.org, api.npmjs.org, pypi.org, pypistats.org, osv.dev. */
export const fakeRegistryFetch: typeof fetch = async (input) => {
  const url = String(input);

  // OSV.dev — by default report no known vulnerabilities for anything.
  if (url === 'https://api.osv.dev/v1/querybatch') {
    return json({ results: [] });
  }
  if (url.startsWith('https://api.osv.dev/v1/vulns/')) {
    return json({ message: 'Not found' }, 404);
  }

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
