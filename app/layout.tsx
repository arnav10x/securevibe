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
    default: 'SecureVibe — does your AI-built app look it?',
    template: '%s — SecureVibe',
  },
  description:
    'Built your app with AI? Find out what marks it as machine-built — with evidence, file ' +
    'by file. Seven craft layers graded, security included, plus a fix prompt for every ' +
    'finding. About a minute, and your code is deleted the moment the scan finishes.',
  openGraph: {
    title: 'SecureVibe — does your AI-built app look it?',
    description:
      'See exactly what marks your product as machine-built, with a citation for every ' +
      'finding and a fix prompt you can paste straight into your coding agent.',
    url: appUrl,
    siteName: 'SecureVibe',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SecureVibe — does your AI-built app look it?',
    description:
      'See what marks your product as machine-built, with evidence and a fix for each finding.',
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
