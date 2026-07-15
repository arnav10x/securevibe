// Webhook tests with REAL Stripe signature verification (the SDK generates
// valid test signatures locally — no network, no real keys).

import { beforeEach, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';

const WEBHOOK_SECRET = 'whsec_test_secret_for_unit_tests';

// ---- Fake Supabase admin client that records every write ----
interface RecordedCall {
  table: string;
  op: 'update' | 'upsert';
  fields: Record<string, unknown>;
  match?: [string, unknown];
}
const calls: RecordedCall[] = [];

function fakeAdmin() {
  return {
    from(table: string) {
      return {
        update(fields: Record<string, unknown>) {
          return {
            eq(col: string, val: unknown) {
              calls.push({ table, op: 'update', fields, match: [col, val] });
              return Promise.resolve({ error: null });
            },
          };
        },
        upsert(fields: Record<string, unknown>) {
          calls.push({ table, op: 'upsert', fields });
          return Promise.resolve({ error: null });
        },
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({ data: { id: 'user-from-customer-lookup' } }),
              };
            },
          };
        },
      };
    },
  };
}

vi.mock('@/lib/supabase/admin', () => ({
  adminConfigured: () => true,
  createAdminClient: () => fakeAdmin(),
}));

// Route import AFTER the mock so it picks up the fake.
import { POST } from '@/app/api/stripe/webhook/route';

function signedRequest(event: Record<string, unknown>): Request {
  const payload = JSON.stringify(event);
  const stripe = new Stripe('sk_test_fake_key_for_unit_tests');
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET,
  });
  return new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    body: payload,
  });
}

beforeEach(() => {
  calls.length = 0;
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_for_unit_tests';
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
});

describe('POST /api/stripe/webhook', () => {
  it('rejects a request with a bad signature', async () => {
    const res = await POST(
      new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 't=1,v1=deadbeef' },
        body: '{}',
      }),
    );
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('checkout.session.completed grants Pro immediately', async () => {
    const res = await POST(
      signedRequest({
        id: 'evt_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_123',
            client_reference_id: 'user-abc',
            customer: 'cus_123',
            subscription: 'sub_123',
          },
        },
      }),
    );
    expect(res.status).toBe(200);

    const planUpdate = calls.find((c) => c.table === 'profiles' && c.op === 'update');
    expect(planUpdate?.fields.plan).toBe('pro');
    expect(planUpdate?.match).toEqual(['id', 'user-abc']);

    const subUpsert = calls.find((c) => c.table === 'subscriptions');
    expect(subUpsert?.fields.stripe_subscription_id).toBe('sub_123');
  });

  it('subscription.updated (active) mirrors details and keeps Pro', async () => {
    const res = await POST(
      signedRequest({
        id: 'evt_2',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_123',
            status: 'active',
            customer: 'cus_123',
            metadata: { user_id: 'user-abc' },
            cancel_at_period_end: false,
            current_period_end: 1799999999,
            items: { data: [{ price: { id: 'price_pro' } }] },
          },
        },
      }),
    );
    expect(res.status).toBe(200);

    const subUpsert = calls.find((c) => c.table === 'subscriptions');
    expect(subUpsert?.fields.status).toBe('active');
    expect(subUpsert?.fields.price_id).toBe('price_pro');
    expect(subUpsert?.fields.current_period_end).toBe(
      new Date(1799999999 * 1000).toISOString(),
    );

    const planUpdate = calls.find((c) => c.table === 'profiles');
    expect(planUpdate?.fields.plan).toBe('pro');
  });

  it('subscription.deleted downgrades the user to free', async () => {
    const res = await POST(
      signedRequest({
        id: 'evt_3',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_123',
            status: 'canceled',
            customer: 'cus_123',
            metadata: { user_id: 'user-abc' },
            items: { data: [] },
          },
        },
      }),
    );
    expect(res.status).toBe(200);

    const subUpsert = calls.find((c) => c.table === 'subscriptions');
    expect(subUpsert?.fields.status).toBe('canceled');
    const planUpdate = calls.find((c) => c.table === 'profiles');
    expect(planUpdate?.fields.plan).toBe('free');
    expect(planUpdate?.match).toEqual(['id', 'user-abc']);
  });

  it('falls back to customer lookup when metadata is missing', async () => {
    await POST(
      signedRequest({
        id: 'evt_4',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_456',
            status: 'active',
            customer: 'cus_456',
            metadata: {},
            items: { data: [] },
          },
        },
      }),
    );
    const planUpdate = calls.find((c) => c.table === 'profiles');
    expect(planUpdate?.match).toEqual(['id', 'user-from-customer-lookup']);
  });

  it('invoice.payment_failed marks the subscription past_due but keeps the plan', async () => {
    const res = await POST(
      signedRequest({
        id: 'evt_5',
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_123',
            subscription: 'sub_123',
          },
        },
      }),
    );
    expect(res.status).toBe(200);

    const update = calls.find((c) => c.table === 'subscriptions' && c.op === 'update');
    expect(update?.fields.status).toBe('past_due');
    expect(update?.match).toEqual(['stripe_subscription_id', 'sub_123']);
    // No plan change on a mere payment failure — Stripe retries first.
    expect(calls.find((c) => c.table === 'profiles')).toBeUndefined();
  });

  it('acknowledges unknown event types without writing anything', async () => {
    const res = await POST(
      signedRequest({ id: 'evt_6', type: 'customer.created', data: { object: {} } }),
    );
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(0);
  });
});
