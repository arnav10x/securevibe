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
          background: '#f6f6f4',
          color: '#131313',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: '1rem',
          borderTop: '4px solid #131313',
        }}
      >
        <span
          style={{
            fontFamily: 'ui-monospace, monospace',
            fontWeight: 700,
            fontSize: '0.9rem',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: '#a02019',
            border: '1px solid #a02019',
            borderRadius: '999px',
            padding: '0.3em 0.75em',
            transform: 'rotate(-1.5deg)',
          }}
        >
          Incident report
        </span>
        <h1
          style={{
            marginTop: '1.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
          }}
        >
          Something went badly wrong
        </h1>
        <p
          style={{
            color: '#545454',
            maxWidth: '24rem',
            fontFamily: 'system-ui, sans-serif',
            fontSize: '0.95rem',
          }}
        >
          The app hit an unexpected error. Reloading usually fixes it.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: '1.5rem',
            padding: '0.6rem 1.5rem',
            border: '1px solid #131313',
            borderRadius: '999px',
            background: '#131313',
            color: '#f6f6f4',
            fontFamily: 'ui-monospace, monospace',
            fontWeight: 600,
            fontSize: '0.8rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            boxShadow: '0 8px 20px -8px rgba(19,19,19,0.5)',
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
