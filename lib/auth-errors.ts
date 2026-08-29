// Turns a Supabase auth error into something a person can act on.
//
// The default failure mode this fixes: when the database is unreachable
// (paused project, dropped wifi, DNS), supabase-js rejects with the
// browser's raw "Failed to fetch". Rendering that string tells the user
// nothing and reads as unfinished software — it is the exact pattern this
// product flags in other people's code (a raw error object rendered into
// the UI, with no recovery path).
//
// Every message here follows the same three-part shape the scanner asks
// for: what happened, why, and the specific next action.

/**
 * A network-layer failure, not a credentials problem. supabase-js surfaces
 * these as a TypeError from fetch, whose message differs per browser.
 */
function isNetworkFailure(message: string): boolean {
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(
    message,
  );
}

export function authErrorMessage(message: string): string {
  if (isNetworkFailure(message)) {
    return (
      'Could not reach the server. Check your internet connection and try ' +
      'again. If it keeps failing, the service may be down.'
    );
  }
  if (message === 'Invalid login credentials') {
    return 'Wrong email or password.';
  }
  if (message === 'Email not confirmed') {
    return 'Confirm your email first. Check your inbox for the verification link.';
  }
  if (/already registered|already exists/i.test(message)) {
    return 'An account with this email already exists. Sign in instead.';
  }
  if (/rate limit|too many requests/i.test(message)) {
    return 'Too many attempts. Wait a minute, then try again.';
  }
  if (/session|token|expired/i.test(message)) {
    return 'This link has expired. Request a new one and use it within the hour.';
  }
  if (/password/i.test(message) && /short|least|weak/i.test(message)) {
    return 'Use a password of at least 8 characters.';
  }
  return message;
}
