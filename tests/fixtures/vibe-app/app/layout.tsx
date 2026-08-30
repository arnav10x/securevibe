import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'GrowthKit',
  description:
    'GrowthKit helps small teams grow their business on autopilot with smart automation and beautiful analytics.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
