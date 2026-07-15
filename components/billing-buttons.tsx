'use client';

// Buttons that talk to our Stripe routes and then hand the browser to
// Stripe's hosted pages (Checkout / Customer Portal).

import { useState } from 'react';
import { Alert, Button } from '@/components/ui';

function useStripeRedirect(endpoint: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? 'Billing is not available right now. Please try again later.');
    } catch {
      setError('Billing is not available right now. Please try again later.');
    }
    setLoading(false);
  }

  return { go, loading, error };
}

export function UpgradeButton() {
  const { go, loading, error } = useStripeRedirect('/api/stripe/checkout');
  return (
    <div className="space-y-3">
      <Button onClick={go} disabled={loading}>
        {loading ? 'Opening checkout…' : 'Upgrade to Pro — $9/month'}
      </Button>
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}

export function ManageBillingButton() {
  const { go, loading, error } = useStripeRedirect('/api/stripe/portal');
  return (
    <div className="space-y-3">
      <Button variant="secondary" onClick={go} disabled={loading}>
        {loading ? 'Opening portal…' : 'Manage billing'}
      </Button>
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
