'use client';

// New scan page: paste a public GitHub URL or upload a .zip.
// The zip goes straight from the browser to Supabase Storage (bypassing
// serverless body-size limits); the API only ever receives its path.

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Alert, Button, Card, Input, Label } from '@/components/ui';

const MAX_ZIP_BYTES = 50 * 1024 * 1024;

type Tab = 'github' | 'zip';

export default function NewScanPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('github');
  const [repoUrl, setRepoUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaHit, setQuotaHit] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'scanning'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = phase !== 'idle';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setQuotaHit(false);

    try {
      let body: Record<string, string>;

      if (tab === 'github') {
        body = { sourceType: 'github', url: repoUrl };
      } else {
        if (!file) {
          setError('Please choose a .zip file first.');
          return;
        }
        if (file.size > MAX_ZIP_BYTES) {
          setError('That zip is over the 50 MB limit. Tip: leave out node_modules and build folders.');
          return;
        }
        setPhase('uploading');
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }
        const objectPath = `${user.id}/${crypto.randomUUID()}.zip`;
        const { error: uploadError } = await supabase.storage
          .from('uploads')
          .upload(objectPath, file, { contentType: 'application/zip' });
        if (uploadError) {
          setPhase('idle');
          setError(`Upload failed: ${uploadError.message}`);
          return;
        }
        body = { sourceType: 'zip', objectPath, fileName: file.name };
      }

      setPhase('scanning');
      const res = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        router.push(`/scans/${data.id}`);
        return;
      }
      setPhase('idle');
      if (res.status === 402) {
        setQuotaHit(true);
      } else if (data.id) {
        // The scan ran but failed — its page explains what went wrong.
        router.push(`/scans/${data.id}`);
      } else {
        setError(data.error ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setPhase('idle');
      setError('Something went wrong. Please check your connection and try again.');
    }
  }

  if (phase === 'scanning') {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <p className="text-4xl" aria-hidden>
          🔎
        </p>
        <h1 className="mt-3 text-xl font-bold">Scanning your code…</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
          Checking for exposed secrets, database misconfigurations, risky dependencies and
          insecure code patterns. Bigger projects can take a minute or two — keep this tab open.
        </p>
        <div className="mx-auto mt-6 h-1.5 w-48 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-emerald-500" />
        </div>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 text-2xl font-bold">New scan</h1>
      <p className="mb-6 text-sm text-slate-400">
        Your code is scanned in an isolated workspace and permanently deleted the moment the
        report is ready. We keep findings only — never your source.
      </p>

      <Card>
        <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-slate-800/60 p-1">
          {(
            [
              ['github', 'Public GitHub repo'],
              ['zip', 'Upload a .zip'],
            ] as [Tab, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                tab === value ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4">
            <Alert tone="error">{error}</Alert>
          </div>
        )}
        {quotaHit && (
          <div className="mb-4">
            <Alert tone="info">
              You&apos;ve used all 3 free scans this month.{' '}
              <Link href="/account" className="font-semibold underline">
                Upgrade to Pro ($9/month)
              </Link>{' '}
              for unlimited scans.
            </Alert>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {tab === 'github' ? (
            <div>
              <Label htmlFor="repo">Repository URL</Label>
              <Input
                id="repo"
                type="url"
                required
                placeholder="https://github.com/you/your-app"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Public repositories only (up to 50 MB). Private repo support is coming later.
              </p>
            </div>
          ) : (
            <div>
              <Label htmlFor="zip">Project .zip</Label>
              <input
                ref={fileInputRef}
                id="zip"
                type="file"
                accept=".zip,application/zip"
                className="block w-full cursor-pointer rounded-lg border border-dashed border-slate-600 bg-slate-900 px-3.5 py-6 text-sm text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-sm file:text-white hover:border-slate-500"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Up to 50 MB. Zip your project folder — no need to include node_modules.
              </p>
            </div>
          )}

          <label className="flex items-start gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              required
              checked={rightsConfirmed}
              onChange={(e) => setRightsConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900 accent-emerald-500"
            />
            <span>
              I have the right to submit this code for analysis (it&apos;s mine, or I&apos;m
              authorized to scan it).
            </span>
          </label>

          <Button type="submit" disabled={busy} className="w-full">
            {phase === 'uploading' ? 'Uploading…' : 'Start scan'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
