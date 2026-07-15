'use client';

// Last-resort boundary: catches errors in the root layout itself.
// Must render its own <html>/<body>.

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
          background: '#020617',
          color: '#f1f5f9',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: '1rem',
        }}
      >
        <p style={{ fontSize: '3rem', margin: 0 }}>⚠️</p>
        <h1>Something went badly wrong</h1>
        <p style={{ color: '#94a3b8', maxWidth: '24rem' }}>
          The app hit an unexpected error. Reloading usually fixes it.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: '1.5rem',
            padding: '0.6rem 1.2rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: '#10b981',
            color: '#020617',
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
