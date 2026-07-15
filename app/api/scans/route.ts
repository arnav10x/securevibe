// POST /api/scans — create and run a scan.
//
// Runs as the signed-in user (Row Level Security applies to every database
// touch). Enforces the hourly rate limit and the free-tier monthly quota,
// then executes the pipeline: acquire -> scan -> delete source -> persist.

import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createClient } from '@/lib/supabase/server';
import { canStartScan, startOfMonthUtc, type Plan } from '@/lib/quota';
import { runScanPipeline } from '@/lib/pipeline';
import { scanDirectory } from '@/lib/scanner';
import { LIMITS } from '@/lib/scanner/limits';
import {
  AcquireError,
  downloadGitHubRepo,
  parseGitHubUrl,
} from '@/lib/scanner/acquire/github-tarball';
import { extractZip } from '@/lib/scanner/acquire/zip-extract';
import { createSupabasePackageCache } from '@/lib/package-cache';

// Scans can legitimately take minutes on Vercel's Fluid Compute.
export const maxDuration = 300;

interface GithubBody {
  sourceType: 'github';
  url: string;
}
interface ZipBody {
  sourceType: 'zip';
  objectPath: string;
  fileName: string;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 });
  }

  let body: GithubBody | ZipBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  // ---- Quota + rate limit ----
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();
  const plan: Plan = profile?.plan === 'pro' ? 'pro' : 'free';

  // Failed scans don't count against the monthly quota (not the user's fault)…
  const { count: monthCount } = await supabase
    .from('scans')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .neq('status', 'failed')
    .gte('created_at', startOfMonthUtc().toISOString());

  // …but every attempt counts toward the hourly rate limit (abuse control).
  const { count: hourCount } = await supabase
    .from('scans')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', new Date(Date.now() - 3_600_000).toISOString());

  const decision = canStartScan({
    plan,
    scansThisMonth: monthCount ?? 0,
    scansLastHour: hourCount ?? 0,
  });
  if (!decision.allowed) {
    return NextResponse.json(
      { error: decision.message, reason: decision.reason },
      { status: decision.reason === 'rate_limited' ? 429 : 402 },
    );
  }

  // ---- Validate input & build the acquire step ----
  let sourceRef: string;
  let acquire: (dir: string) => Promise<void>;
  let disposeSource: () => Promise<void> = async () => {};

  if (body.sourceType === 'github') {
    let parsed;
    try {
      parsed = parseGitHubUrl(body.url);
    } catch (error) {
      const message =
        error instanceof AcquireError ? error.message : 'That URL could not be understood.';
      return NextResponse.json({ error: message }, { status: 400 });
    }
    sourceRef = `github.com/${parsed.owner}/${parsed.repo}${parsed.ref ? `@${parsed.ref}` : ''}`;
    acquire = async (dir) => {
      await downloadGitHubRepo(parsed, dir, fetch, process.env.GITHUB_TOKEN || undefined);
    };
  } else if (body.sourceType === 'zip') {
    const objectPath = body.objectPath ?? '';
    // Users may only scan objects inside their own storage folder.
    // (Storage RLS enforces this too — this check just gives a clear error.)
    if (!objectPath.startsWith(`${user.id}/`) || objectPath.includes('..')) {
      return NextResponse.json({ error: 'Invalid upload reference.' }, { status: 400 });
    }
    sourceRef = (body.fileName || 'upload.zip').slice(0, 120);
    acquire = async (dir) => {
      const { data, error } = await supabase.storage.from('uploads').download(objectPath);
      if (error || !data) {
        throw new AcquireError('Your upload could not be retrieved. Please try uploading again.');
      }
      if (data.size > LIMITS.MAX_ARCHIVE_BYTES) {
        throw new AcquireError('The zip exceeds the 50 MB limit.');
      }
      const zipPath = path.join(dir, '__upload.zip');
      await fs.writeFile(zipPath, Buffer.from(await data.arrayBuffer()));
      const extractDir = path.join(dir, 'source');
      await fs.mkdir(extractDir);
      await extractZip(zipPath, extractDir);
      await fs.rm(zipPath, { force: true }); // done with the archive itself
    };
    disposeSource = async () => {
      // Delete the uploaded zip from storage the moment the scan ends.
      await supabase.storage.from('uploads').remove([objectPath]);
    };
  } else {
    return NextResponse.json({ error: 'Unknown source type.' }, { status: 400 });
  }

  // ---- Create the scan row ----
  const { data: scan, error: insertError } = await supabase
    .from('scans')
    .insert({
      user_id: user.id,
      source_type: body.sourceType,
      source_ref: sourceRef,
      status: 'queued',
    })
    .select('id')
    .single();
  if (insertError || !scan) {
    return NextResponse.json({ error: 'Could not create the scan.' }, { status: 500 });
  }

  // ---- Run the pipeline ----
  const packageCache = createSupabasePackageCache(supabase);
  const outcome = await runScanPipeline({
    acquire,
    disposeSource,
    scan: (dir) =>
      scanDirectory(body.sourceType === 'zip' ? path.join(dir, 'source') : dir, {
        packageCache,
      }),
    persistFindings: async (findings) => {
      if (findings.length === 0) return;
      const rows = findings.map((f) => ({
        scan_id: scan.id,
        check_type: f.checkType,
        severity: f.severity,
        title: f.title,
        explanation: f.explanation,
        file_path: f.filePath ?? null,
        line_start: f.lineStart ?? null,
        evidence_masked: f.evidenceMasked ?? null,
        recommendation: f.recommendation,
      }));
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await supabase.from('findings').insert(rows.slice(i, i + 100));
        if (error) throw new Error(`Failed to save findings: ${error.message}`);
      }
    },
    updateScan: async (fields) => {
      await supabase.from('scans').update(fields).eq('id', scan.id);
    },
  });

  if (!outcome.ok) {
    return NextResponse.json({ id: scan.id, error: outcome.userMessage }, { status: 422 });
  }
  return NextResponse.json({ id: scan.id });
}
