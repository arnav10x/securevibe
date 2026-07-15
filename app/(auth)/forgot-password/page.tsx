'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Alert, Button, Card, Input, Label } from '@/components/ui';

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
        <h1 className="mb-3 text-xl font-bold text-slate-100">Check your email 📬</h1>
        <p className="text-sm leading-relaxed text-slate-300">
          If an account exists for <strong className="text-slate-100">{email}</strong>, we sent a
          link to reset its password.
        </p>
        <p className="mt-4 text-sm text-slate-400">
          <Link href="/login" className="text-emerald-400 hover:text-emerald-300">
            Back to sign in
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="mb-1 text-xl font-bold text-slate-100">Reset your password</h1>
      <p className="mb-6 text-sm text-slate-400">
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

      <p className="mt-6 text-center text-sm text-slate-400">
        <Link href="/login" className="text-emerald-400 hover:text-emerald-300">
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}
