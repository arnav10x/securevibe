// Dev-only harness: runs the real scanner over the vibe-coded test fixture
// and renders the real report-card plate + design findings, so the grade UI
// can be designed and checked without needing a signed-in scan.
// Returns 404 in production.

import { notFound } from 'next/navigation';
import path from 'node:path';
import { scanDirectory } from '@/lib/scanner';
import { FindingsBrowser } from '@/components/findings-browser';
import { ReportCardPlate } from '@/components/report-card';

export const metadata = { title: 'Report card preview (dev)' };

export default async function ReportPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const fixture = path.join(process.cwd(), 'tests/fixtures/vibe-app');
  const offline: typeof fetch = async () => new Response('{}', { status: 404 });
  const result = await scanDirectory(fixture, { fetchImpl: offline });
  const design = result.findings.filter((f) => f.checkType === 'design');

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="label mb-5">Dev preview — vibe-app fixture, scanned live</p>

      {result.stats.report && <ReportCardPlate report={result.stats.report} />}

      <div className="mt-8">
        <FindingsBrowser
          findings={design.map((f, i) => ({
            id: String(i),
            severity: f.severity,
            title: f.title,
            filePath: f.filePath ?? null,
            lineStart: f.lineStart ?? null,
            evidenceMasked: f.evidenceMasked ?? null,
            explanation: f.explanation,
            recommendation: f.recommendation,
            typeLabel: 'Design',
          }))}
        />
      </div>
    </div>
  );
}
