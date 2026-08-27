// POST /api/scans — create and run a scan.
//
// Two callers, one pipeline:
//  - Signed-in users: Row Level Security applies to every database touch,
//    with the hourly rate limit and the free-tier monthly quota.
//  - Anonymous visitors (the landing-page scan bay): public GitHub repos
//    only, limited per visitor per day, written through the service-role
//    client because no user exists yet. The response sets an httpOnly
//    claim cookie so the account they create afterwards can adopt the
//    scan — until then only medium/low findings are ever shown.

import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createClient } from '@/lib/supabase/server';
import { adminConfigured, createAdminClient } from '@/lib/supabase/admin';
import { canStartScan, startOfMonthUtc, type Plan } from '@/lib/quota';
import {
  ANON_SCANS_PER_DAY,
  CLAIM_COOKIE,
  CLAIM_COOKIE_MAX_AGE,
  clientIpHash,
} from '@/lib/anon';
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

  let body: GithubBody | ZipBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  // ---- Who is scanning, and are they allowed to? ----
  let anonIpHash: string | null = null;

  if (user) {
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
  } else {
    // Anonymous: instant scans cover public GitHub repos only. Zip uploads
    // need per-user storage, which needs an account.
    if (body.sourceType !== 'github') {
      return NextResponse.json(
        { error: 'Create a free account to scan zip uploads — instant scans take public GitHub repos.' },
        { status: 401 },
      );
    }
    if (!adminConfigured()) {
      return NextResponse.json(
        { error: 'Instant scans are unavailable right now. Please create a free account instead.' },
        { status: 503 },
      );
    }
    anonIpHash = clientIpHash(request);
    const admin = createAdminClient();
    const { count: dayCount } = await admin
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .eq('anon_ip_hash', anonIpHash)
      .gte('created_at', new Date(Date.now() - 86_400_000).toISOString());
    if ((dayCount ?? 0) >= ANON_SCANS_PER_DAY) {
      return NextResponse.json(
        {
          error:
            `That's ${ANON_SCANS_PER_DAY} instant scans in a day — the visitor limit. ` +
            'Create a free account to keep scanning (and to unlock full reports).',
          reason: 'rate_limited',
        },
        { status: 429 },
      );
    }
  }

  // Everything the pipeline writes goes through this client: the user's
  // RLS-scoped client when signed in, the service-role client when not.
  const db = user ? supabase : createAdminClient();

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
    if (!objectPath.startsWith(`${user!.id}/`) || objectPath.includes('..')) {
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
  const claimToken = user ? null : crypto.randomUUID();
  const { data: scan, error: insertError } = await db
    .from('scans')
    .insert({
      user_id: user?.id ?? null,
      anon_ip_hash: anonIpHash,
      claim_token: claimToken,
      source_type: body.sourceType,
      source_ref: sourceRef,
      status: 'queued',
    })
    .select('id')
    .single();
  if (insertError || !scan) {
    return NextResponse.json({ error: 'Could not create the scan.' }, { status: 500 });
  }

  // The browser that ran an anonymous scan gets the claim cookie: the
  // account it creates later adopts this scan and unlocks the full report.
  function withClaimCookie(response: NextResponse) {
    if (claimToken) {
      response.cookies.set(CLAIM_COOKIE, `${scan!.id}.${claimToken}`, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: CLAIM_COOKIE_MAX_AGE,
      });
    }
    return response;
  }

  // ---- Run the pipeline ----
  const packageCache = createSupabasePackageCache(db);
  const outcome = await runScanPipeline({
    acquire,
    disposeSource,
    scan: (dir) =>
      scanDirectory(body.sourceType === 'zip' ? path.join(dir, 'source') : dir, {
        packageCache,
        // Tells the scanner whether a committed .env is provable (github) or
        // only a warning (zip) — see the git-awareness fix in checks/secrets.
        sourceType: body.sourceType,
        // Optional model-assisted copy check (off unless the key is set).
        // Only short visible-text excerpts are ever sent — never code.
        llm: process.env.SECUREVIBE_LLM_API_KEY
          ? {
              apiKey: process.env.SECUREVIBE_LLM_API_KEY,
              baseUrl: process.env.SECUREVIBE_LLM_BASE_URL || undefined,
              model: process.env.SECUREVIBE_LLM_MODEL || undefined,
            }
          : undefined,
      }),
    persistFindings: async (findings) => {
      if (findings.length === 0) return;
      const rows = findings.map((f) => ({
        scan_id: scan.id,
        check_type: f.checkType,
        severity: f.severity,
        confidence: f.confidence ?? 'heuristic',
        title: f.title,
        explanation: f.explanation,
        file_path: f.filePath ?? null,
        line_start: f.lineStart ?? null,
        evidence_masked: f.evidenceMasked ?? null,
        recommendation: f.recommendation,
      }));
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await db.from('findings').insert(rows.slice(i, i + 100));
        if (error) throw new Error(`Failed to save findings: ${error.message}`);
      }
    },
    updateScan: async (fields) => {
      await db.from('scans').update(fields).eq('id', scan.id);
    },
  });

  if (!outcome.ok) {
    return withClaimCookie(
      NextResponse.json({ id: scan.id, anon: !user, error: outcome.userMessage }, { status: 422 }),
    );
  }
  return withClaimCookie(NextResponse.json({ id: scan.id, anon: !user }));
}
