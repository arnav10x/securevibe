// Fetches a PUBLIC GitHub repository as a tarball — no git binary needed.
//
// Two-step process:
//  1. Ask the GitHub API about the repo (exists? public? how big?)
//     so we can reject oversized repos BEFORE downloading anything.
//  2. Stream the tarball from codeload.github.com into the workspace,
//     enforcing byte caps while extracting.

import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import * as tar from 'tar';
import { LIMITS } from '../limits';

/** Errors with messages safe to show directly to the user. */
export class AcquireError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AcquireError';
  }
}

export interface ParsedRepo {
  owner: string;
  repo: string;
  /** Branch/tag if the URL included /tree/<ref>. */
  ref?: string;
}

export function parseGitHubUrl(input: string): ParsedRepo {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new AcquireError(
      'That does not look like a valid URL. Expected something like https://github.com/owner/repo',
    );
  }
  if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') {
    throw new AcquireError('Only public github.com repositories are supported in v1.');
  }
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 2) {
    throw new AcquireError('The URL is missing the repository name. Expected github.com/owner/repo');
  }
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/, '');
  let ref: string | undefined;
  if (parts[2] === 'tree' && parts[3]) {
    ref = decodeURIComponent(parts.slice(3).join('/'));
  }
  const namePattern = /^[A-Za-z0-9_.-]+$/;
  if (!namePattern.test(owner) || !namePattern.test(repo)) {
    throw new AcquireError('The owner or repository name contains unexpected characters.');
  }
  return { owner, repo, ref };
}

export interface RepoMetadata {
  defaultBranch: string;
  sizeKb: number;
}

export async function fetchRepoMetadata(
  parsed: ParsedRepo,
  fetchImpl: typeof fetch = fetch,
  githubToken?: string,
): Promise<RepoMetadata> {
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'user-agent': 'securevibe-scanner',
  };
  if (githubToken) headers.authorization = `Bearer ${githubToken}`;

  const res = await fetchImpl(
    `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`,
    { headers },
  );
  if (res.status === 404) {
    throw new AcquireError(
      'Repository not found. Check the URL — and note that v1 only supports PUBLIC repositories.',
    );
  }
  if (res.status === 403 || res.status === 429) {
    throw new AcquireError(
      'GitHub is rate-limiting our requests right now. Please try again in a few minutes.',
    );
  }
  if (!res.ok) {
    throw new AcquireError('GitHub returned an unexpected error. Please try again.');
  }
  const data = (await res.json()) as {
    default_branch?: string;
    size?: number;
    private?: boolean;
  };
  if (data.private) {
    throw new AcquireError('That repository is private. v1 only supports public repositories.');
  }
  const sizeKb = data.size ?? 0;
  if (sizeKb * 1024 > LIMITS.MAX_ARCHIVE_BYTES) {
    throw new AcquireError(
      `That repository is about ${Math.round(sizeKb / 1024)} MB — v1 supports projects up to ` +
        `${Math.round(LIMITS.MAX_ARCHIVE_BYTES / 1024 / 1024)} MB.`,
    );
  }
  return { defaultBranch: data.default_branch ?? 'main', sizeKb };
}

/**
 * Downloads and extracts the repo tarball into `destDir`.
 * Enforces the compressed-size cap while streaming and refuses
 * anything in the archive that isn't a plain file or directory.
 */
export async function downloadGitHubRepo(
  parsed: ParsedRepo,
  destDir: string,
  fetchImpl: typeof fetch = fetch,
  githubToken?: string,
): Promise<{ ref: string }> {
  const meta = await fetchRepoMetadata(parsed, fetchImpl, githubToken);
  const ref = parsed.ref ?? meta.defaultBranch;

  const url = `https://codeload.github.com/${parsed.owner}/${parsed.repo}/tar.gz/${encodeURIComponent(ref)}`;
  const res = await fetchImpl(url, {
    headers: { 'user-agent': 'securevibe-scanner' },
  });
  if (res.status === 404) {
    throw new AcquireError(`Branch or tag "${ref}" was not found in that repository.`);
  }
  if (!res.ok || !res.body) {
    throw new AcquireError('Could not download the repository archive. Please try again.');
  }

  let downloadedBytes = 0;
  let extractedBytes = 0;
  let fileCount = 0;
  let sizeExceeded = false;

  const source = Readable.fromWeb(res.body as import('stream/web').ReadableStream);
  source.on('data', (chunk: Buffer) => {
    downloadedBytes += chunk.length;
    if (downloadedBytes > LIMITS.MAX_ARCHIVE_BYTES) {
      source.destroy(new AcquireError('The repository archive exceeds the 50 MB limit.'));
    }
  });

  const extractor = tar.x({
    cwd: destDir,
    strip: 1, // GitHub tarballs wrap everything in "repo-ref/"
    filter: (filePath, entry) => {
      if (sizeExceeded) return false;
      // When extracting from a stream, `entry` is a ReadEntry with a type.
      // Plain files and directories only — no symlinks, devices, hardlinks.
      const type = 'type' in entry ? entry.type : undefined;
      if (type !== 'File' && type !== 'Directory') return false;
      if (filePath.includes('..')) return false;
      if (type === 'File') {
        fileCount++;
        extractedBytes += entry.size ?? 0;
        if (fileCount > LIMITS.MAX_FILES * 2) return false; // hard stop, walker caps the rest
        if (extractedBytes > LIMITS.MAX_UNCOMPRESSED_BYTES) {
          sizeExceeded = true; // stop writing anything further
          return false;
        }
      }
      return true;
    },
  });

  try {
    await pipeline(source, extractor);
  } catch (error) {
    if (error instanceof AcquireError) throw error;
    throw new AcquireError('The repository archive could not be unpacked. Please try again.');
  }
  if (sizeExceeded) {
    throw new AcquireError('The repository expands beyond the 200 MB limit.');
  }

  return { ref };
}
