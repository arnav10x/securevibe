// The auth error translator. The case that matters most is the network
// failure: when the database is unreachable, supabase-js surfaces the
// browser's raw "Failed to fetch", and rendering that string tells the
// user nothing. Every message must say what happened and what to do next.

import { describe, expect, it } from 'vitest';
import { authErrorMessage } from '@/lib/auth-errors';
import { voiceViolations } from '@/lib/scanner/voice';

describe('authErrorMessage', () => {
  it('translates every browser spelling of a network failure', () => {
    for (const raw of [
      'Failed to fetch',
      'NetworkError when attempting to fetch resource.',
      'Network request failed',
      'Load failed',
      'fetch failed',
    ]) {
      const msg = authErrorMessage(raw);
      expect(msg).toContain('Could not reach the server');
      expect(msg).not.toMatch(/fetch/i);
    }
  });

  it('keeps the credential and confirmation cases plain', () => {
    expect(authErrorMessage('Invalid login credentials')).toBe('Wrong email or password.');
    expect(authErrorMessage('Email not confirmed')).toContain('Confirm your email first');
  });

  it('handles duplicate accounts, rate limits, and expired links', () => {
    expect(authErrorMessage('User already registered')).toContain('Sign in instead');
    expect(authErrorMessage('Request rate limit reached')).toContain('Wait a minute');
    expect(authErrorMessage('Auth session missing!')).toContain('expired');
  });

  it('passes an unrecognized message through rather than inventing one', () => {
    expect(authErrorMessage('Something specific from the API')).toBe(
      'Something specific from the API',
    );
  });

  it('writes every message in the product voice', () => {
    for (const raw of [
      'Failed to fetch',
      'Invalid login credentials',
      'Email not confirmed',
      'User already registered',
      'Request rate limit reached',
      'Auth session missing!',
    ]) {
      expect(voiceViolations(authErrorMessage(raw))).toEqual([]);
    }
  });
});
