'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { authErrorMessage } from '@/lib/auth-errors';
import { Alert, Button, Card, Input, Label } from '@/components/ui';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Messages passed from other pages, e.g. after email confirmation.
  const notice = searchParams.get('message');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    // signInWithPassword rejects (rather than returning an error) when the
    // network call itself fails, so catch that too — otherwise an
    // unreachable server surfaces as an unhandled rejection.
    const { error } = await supabase.auth
      .signInWithPassword({ email, password })
      .catch((e: unknown) => ({ error: e as { message: string } }));
    setLoading(false);
    if (error) {
      setError(authErrorMessage(error.message));
      return;
    }
    router.push(searchParams.get('next') ?? '/dashboard');
    router.refresh();
  }

  return (
    <Card>
      <h1 className="mb-1 display text-2xl text-ink">Welcome back</h1>
      <p className="mb-6 text-sm text-ink-soft">Sign in to run your security scans.</p>

      {notice && (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      )}
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
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="mb-1.5 text-xs u-link text-verdant-ink"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        No account yet?{' '}
        <Link href="/signup" className="u-link text-verdant-ink">
          Sign up free
        </Link>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
