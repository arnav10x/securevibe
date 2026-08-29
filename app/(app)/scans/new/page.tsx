'use client';

// New scan page: paste a public GitHub URL or upload a .zip.
// The zip goes straight from the browser to Supabase Storage (bypassing
// serverless body-size limits); the API only ever receives its path.

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Alert, Button, Card, Input, Label } from '@/components/ui';
import { IconGitHub, IconUpload, LogoMark } from '@/components/icons';

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
      <Card className="mx-auto max-w-xl py-14 text-center">
        <div className="relative mx-auto h-20 w-20">
          <span className="absolute inset-0 rounded-2xl border-[1.5px] border-verdant/60 [animation:ping-square_2s_ease-out_infinite]" />
          <span className="absolute inset-0 grid place-items-center rounded-2xl border-[1.5px] border-ink/40 text-ink">
            <LogoMark className="h-9 w-9" />
          </span>
        </div>
        <p className="mx-auto mt-7 w-fit">
          <span className="tag text-[11px]">Scan in progress</span>
        </p>
        <p className="prose-serif mx-auto mt-4 max-w-sm text-[15px] text-ink-soft">
          Checking for exposed secrets, database misconfigurations, risky dependencies and
          insecure code patterns. Bigger projects can take a minute or two — keep this tab open.
        </p>
        <div className="readout mx-auto mt-7 h-1.5 w-56 overflow-hidden border-0">
          <div className="h-full w-1/4 bg-verdant [animation:scan-bar_1.6s_linear_infinite]" />
        </div>
        <p className="label label--bare mt-5 justify-center">
          Source deleted the moment the report is ready
        </p>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <p className="label">New scan</p>
      <h1 className="display mt-3 text-3xl">Point us at your code</h1>
      <p className="prose-serif mb-7 mt-3.5 text-[15px] text-ink-soft">
        Your code is scanned in an isolated workspace and permanently deleted the moment the
        report is ready. We keep findings only — never your source.
      </p>

      <Card>
        {/* Segmented source picker — a two-position switch */}
        <div className="mb-6 grid grid-cols-2 gap-1 bg-well p-1">
          {(
            [
              ['github', 'Public GitHub repo', IconGitHub],
              ['zip', 'Upload a .zip', IconUpload],
            ] as [Tab, string, typeof IconGitHub][]
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              aria-pressed={tab === value}
              className={`flex cursor-pointer items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                tab === value
                  ? 'border border-ink/70 bg-sheet text-ink shadow-[0_1px_2px_rgba(17,26,68,0.10)]'
                  : 'border border-transparent text-ink-mute hover:text-ink-soft'
              }`}
            >
              <Icon className="h-4 w-4" />
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
              <Link href="/account" className="u-link font-semibold text-verdant-ink">
                Upgrade to Pro ($9/month)
              </Link>{' '}
              for unlimited scans.
            </Alert>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
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
              <p className="mt-2 text-xs leading-relaxed text-ink-mute">
                Public repositories only (up to 50 MB). Private repo support is coming later.
              </p>
            </div>
          ) : (
            <div>
              <Label htmlFor="zip">Project .zip</Label>
              <label
                htmlFor="zip"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const dropped = e.dataTransfer.files?.[0];
                  if (dropped) setFile(dropped);
                }}
                className={`group flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed px-4 py-9 text-center transition-colors duration-150 ${
                  file
                    ? 'border-safe/70 bg-safe/5'
                    : 'border-[var(--line-strong)] bg-well/50 hover:border-ink/60 hover:bg-well'
                }`}
              >
                <span className="grid h-11 w-11 place-items-center rounded-2xl border-[1.5px] border-ink/40 bg-sheet text-ink transition-transform duration-150 group-hover:-translate-y-0.5">
                  <IconUpload className="h-5 w-5" />
                </span>
                {file ? (
                  <span className="text-sm font-medium text-safe">{file.name}</span>
                ) : (
                  <span className="text-sm text-ink-soft">
                    <span className="font-medium text-ink">Choose a .zip</span> or drop it here
                  </span>
                )}
                <span className="text-xs text-ink-mute">
                  Up to 50 MB — no need to include node_modules
                </span>
              </label>
              <input
                ref={fileInputRef}
                id="zip"
                type="file"
                accept=".zip,application/zip"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          )}

          <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-ink-soft">
            <input
              type="checkbox"
              required
              checked={rightsConfirmed}
              onChange={(e) => setRightsConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer border-[var(--line-strong)] bg-sheet accent-[#0b2fa3]"
            />
            <span>
              I have the right to submit this code for analysis (it&apos;s mine, or I&apos;m
              authorized to scan it).
            </span>
          </label>

          <Button type="submit" disabled={busy} className="w-full py-3">
            {phase === 'uploading' ? 'Uploading…' : 'Start scan'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
