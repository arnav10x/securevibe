'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Alert, Button, Card, Input, Label } from '@/components/ui';
import { IconMail } from '@/components/icons';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
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
          If an account exists for <strong className="text-fg">{email}</strong>, we sent a
          link to reset its password.
        </p>
        <p className="mt-4 text-sm text-fg-dim">
          <Link href="/login" className="text-signal transition-colors hover:text-signal-bright">
            Back to sign in
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="mb-1 text-xl font-semibold tracking-tight text-fg">Reset your password</h1>
      <p className="mb-6 text-sm text-fg-dim">
        Enter your email and we&apos;ll send you a reset link.
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
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-fg-dim">
        <Link href="/login" className="text-signal transition-colors hover:text-signal-bright">
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}
