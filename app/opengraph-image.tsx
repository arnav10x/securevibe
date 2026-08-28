// Social share card, rendered at request time by Next's built-in OG engine.
// Mirrors the monochrome "Oryn" identity: paper white, near-black ink,
// grays, one clean grotesk (the engine's default sans stands in).

import { ImageResponse } from 'next/og';

export const alt = 'SecureVibe — does your AI-built app look it?';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const paper = '#f6f6f4';
const ink = '#131313';
const inkSoft = '#545454';
const inkMute = '#757575';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: paper,
          color: ink,
          padding: '64px 80px',
        }}
      >
        {/* Hairline frame */}
        <div
          style={{
            position: 'absolute',
            top: 28,
            left: 28,
            right: 28,
            bottom: 28,
            border: '1px solid rgba(19,19,19,0.18)',
            borderRadius: 20,
          }}
        />

        {/* Masthead row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <svg
              viewBox="0 0 24 24"
              width="56"
              height="56"
              fill="none"
              stroke={ink}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2.75 20 7.25v9.5L12 21.25 4 16.75v-9.5L12 2.75Z" />
              <path d="M12 7.25 16 9.5v5L12 16.75 8 14.5v-5l4-2.25Z" />
            </svg>
            <span style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1.5 }}>
              SecureVibe
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              border: `2px solid ${ink}`,
              color: ink,
              borderRadius: 999,
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: 'uppercase',
              padding: '12px 26px',
            }}
          >
            Code deleted after scan
          </div>
        </div>

        {/* Section label */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginTop: 84,
            fontSize: 22,
            letterSpacing: 5,
            textTransform: 'uppercase',
            color: inkMute,
          }}
        >
          <div
            style={{
              display: 'flex',
              width: 10,
              height: 10,
              borderRadius: 999,
              background: ink,
            }}
          />
          Design audit · for AI-built products
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 24 }}>
          <div
            style={{
              fontSize: 92,
              fontWeight: 700,
              letterSpacing: -4,
              lineHeight: 1.05,
            }}
          >
            Your AI built the app.
          </div>
          <div
            style={{
              fontSize: 92,
              fontWeight: 700,
              letterSpacing: -4,
              lineHeight: 1.05,
              color: inkMute,
            }}
          >
            Can everyone tell?
          </div>
        </div>

        <div
          style={{
            marginTop: 'auto',
            fontSize: 27,
            color: inkSoft,
            display: 'flex',
          }}
        >
          Secrets · Open databases · Fake dependencies · Insecure code — checked in a minute.
        </div>
      </div>
    ),
    size,
  );
}
