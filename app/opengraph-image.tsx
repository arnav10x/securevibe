// Social share card, rendered at request time by Next's built-in OG engine.
// Mirrors the site's "Obsidian Signal" identity: obsidian field, phosphor
// accent, shield-waveform mark.

import { ImageResponse } from 'next/og';

export const alt = 'SecureVibe — security checkup for AI-built apps';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background:
            'radial-gradient(80% 90% at 80% 0%, rgba(54,226,168,0.16), transparent 60%), #060a09',
          color: '#eaf4ef',
          fontSize: 64,
          fontWeight: 700,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <svg
            viewBox="0 0 24 24"
            width="52"
            height="52"
            fill="none"
            stroke="#36e2a8"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2.75 19.25 5.6v5.15c0 4.8-2.9 8.5-7.25 10.5-4.35-2-7.25-5.7-7.25-10.5V5.6L12 2.75Z" />
            <path d="M8.75 10.75v2.5" />
            <path d="M12 8.5v7" />
            <path d="M15.25 10.25v3.5" />
          </svg>
          <span style={{ fontSize: 44 }}>
            Secure<span style={{ color: '#36e2a8' }}>Vibe</span>
          </span>
        </div>
        <div style={{ marginTop: 48, lineHeight: 1.12, letterSpacing: '-0.03em' }}>
          Your AI built the app.
        </div>
        <div
          style={{
            color: '#7cf5cb',
            lineHeight: 1.12,
            letterSpacing: '-0.03em',
            fontStyle: 'italic',
            fontWeight: 400,
          }}
        >
          Did it build it safely?
        </div>
        <div style={{ marginTop: 44, fontSize: 27, fontWeight: 400, color: '#9db4ab' }}>
          Secrets · Open databases · Fake dependencies · Insecure code — checked in a minute.
        </div>
      </div>
    ),
    size,
  );
}
