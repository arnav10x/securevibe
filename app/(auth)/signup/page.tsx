'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
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
      setError('Please use a password of at least 8 characters.');
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
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
        <h1 className="mb-3 flex items-center gap-2.5 text-xl font-semibold tracking-tight text-fg">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-signal/30 bg-signal/10 text-signal">
            <IconMail className="h-4 w-4" />
          </span>
          Check your email
        </h1>
        <p className="text-sm leading-relaxed text-fg-dim">
          We sent a verification link to <strong className="text-fg">{email}</strong>.
          Click it to activate your account, then sign in.
        </p>
        <p className="mt-4 text-sm text-fg-dim">
          Nothing arriving? Check spam, or{' '}
          <button onClick={() => setSent(false)} className="text-signal transition-colors hover:text-signal-bright">
            try again
          </button>
          .
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="mb-1 text-xl font-semibold tracking-tight text-fg">Create your account</h1>
      <p className="mb-6 text-sm text-fg-dim">
        Free plan: 3 security scans a month. No credit card needed.
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
          <p className="mt-1.5 text-xs text-fg-mute">At least 8 characters.</p>
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-fg-dim">
        Already have an account?{' '}
        <Link href="/login" className="text-signal transition-colors hover:text-signal-bright">
          Sign in
        </Link>
      </p>
      <p className="mt-4 text-center text-xs leading-relaxed text-fg-mute">
        By signing up you agree to our{' '}
        <Link href="/terms" className="underline transition-colors hover:text-fg-dim">
          Terms
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="underline transition-colors hover:text-fg-dim">
          Privacy Policy
        </Link>
        .
      </p>
    </Card>
  );
}
