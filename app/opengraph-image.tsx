// Social share card, rendered at request time by Next's built-in OG engine.

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
          background: 'linear-gradient(135deg, #020617 0%, #0f172a 100%)',
          color: '#f1f5f9',
          fontSize: 64,
          fontWeight: 700,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 40 }}>
          <span>🛡️</span>
          <span style={{ color: '#34d399' }}>SecureVibe</span>
        </div>
        <div style={{ marginTop: 40, lineHeight: 1.15 }}>Your AI built the app.</div>
        <div style={{ color: '#34d399', lineHeight: 1.15 }}>Did it build it safely?</div>
        <div style={{ marginTop: 40, fontSize: 28, fontWeight: 400, color: '#94a3b8' }}>
          Secrets · Open databases · Fake dependencies · Insecure code — checked in a minute.
        </div>
      </div>
    ),
    size,
  );
}
