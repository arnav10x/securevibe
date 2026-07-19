import type { Metadata } from 'next';
import { Inter, Geist_Mono } from 'next/font/google';
import './globals.css';

// One clean grotesk for everything — headlines, prose, controls. Tight
// tracking at display sizes, quiet neutrality at body sizes.
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

// Instrument face: file paths, telemetry, ledger figures.
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'SecureVibe — security checkup for AI-built apps',
    template: '%s — SecureVibe',
  },
  description:
    'Built your app with AI? Scan it for exposed secrets, open databases, fake dependencies ' +
    'and insecure code before you launch. Plain-English report in about a minute. ' +
    'Your code is deleted the moment the scan finishes.',
  openGraph: {
    title: 'SecureVibe — security checkup for AI-built apps',
    description:
      'Find the security holes AI coding tools leave behind — before someone else does. ' +
      'Plain-English report, code deleted right after scanning.',
    url: appUrl,
    siteName: 'SecureVibe',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SecureVibe — security checkup for AI-built apps',
    description:
      'Find the security holes AI coding tools leave behind — before someone else does.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // The tiny script below adds a "js" class before hydration; this tells
      // React that's expected rather than a bug.
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="film flex min-h-full flex-col bg-paper text-ink">
        {/* Marks that JS is running so scroll-reveal styles can apply.
            Without JS the site renders fully visible — nothing is hidden. */}
        <script
          dangerouslySetInnerHTML={{ __html: `document.documentElement.classList.add('js')` }}
        />
        {children}
      </body>
    </html>
  );
}
