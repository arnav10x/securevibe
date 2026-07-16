'use client';

// Last-resort boundary: catches errors in the root layout itself.
// Must render its own <html>/<body> — styles stay inline and self-contained
// because the design system's CSS may not have loaded.

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#060a09',
          color: '#eaf4ef',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: '1rem',
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="48"
          height="48"
          fill="none"
          stroke="#36e2a8"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M10.3 4.1 3.05 16.65c-.75 1.3.2 2.95 1.7 2.95h14.5c1.5 0 2.45-1.65 1.7-2.95L13.7 4.1a1.95 1.95 0 0 0-3.4 0Z" />
          <path d="M12 9.25v4M12 16.4v.1" />
        </svg>
        <h1 style={{ marginTop: '1.5rem' }}>Something went badly wrong</h1>
        <p style={{ color: '#9db4ab', maxWidth: '24rem' }}>
          The app hit an unexpected error. Reloading usually fixes it.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: '1.5rem',
            padding: '0.6rem 1.4rem',
            borderRadius: '9999px',
            border: 'none',
            background: '#36e2a8',
            color: '#060a09',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
