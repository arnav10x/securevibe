export const metadata = {
  title: 'Palletbase',
  description: 'Warehouse reconciliation that files count drift as morning tasks.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
