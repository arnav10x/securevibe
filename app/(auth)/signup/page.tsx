'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { authErrorMessage } from '@/lib/auth-errors';
import { Alert, Button, Card, Input, Label } from '@/components/ui';
import { IconMail } from '@/components/icons';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Use a password of at least 8 characters.');
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth
      .signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      })
      .catch((e: unknown) => ({ data: { user: null }, error: e as { message: string } }));
    setLoading(false);
    if (error) {
      setError(authErrorMessage(error.message));
      return;
    }
    // Supabase quirk: signing up with an existing email returns a fake user
    // with an empty identities array instead of an error (anti-enumeration).
    if (data.user && data.user.identities?.length === 0) {
      setError('An account with this email already exists. Try signing in instead.');
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <Card>
        <h1 className="mb-3 flex items-center gap-2.5 display text-2xl text-ink">
          <span className="grid h-8 w-8 place-items-center rounded-2xl border-[1.5px] border-ink/40 text-ink">
            <IconMail className="h-4 w-4" />
          </span>
          Check your email
        </h1>
        <p className="text-sm leading-relaxed text-ink-soft">
          We sent a verification link to <strong className="text-ink">{email}</strong>.
          Click it to activate your account, then sign in.
        </p>
        <p className="mt-4 text-sm text-ink-soft">
          Nothing arriving? Check spam, or{' '}
          <button onClick={() => setSent(false)} className="u-link text-verdant-ink">
            try again
          </button>
          .
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="mb-1 display text-2xl text-ink">Create your account</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Free plan: 3 scans a month. No credit card needed.
      </p>

      {error && (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="mt-1.5 text-xs text-ink-mute">At least 8 characters.</p>
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        Already have an account?{' '}
        <Link href="/login" className="u-link text-verdant-ink">
          Sign in
        </Link>
      </p>
      <p className="mt-4 text-center text-xs leading-relaxed text-ink-mute">
        By signing up you agree to our{' '}
        <Link href="/terms" className="underline transition-colors hover:text-ink-soft">
          Terms
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="underline transition-colors hover:text-ink-soft">
          Privacy Policy
        </Link>
        .
      </p>
    </Card>
  );
}
