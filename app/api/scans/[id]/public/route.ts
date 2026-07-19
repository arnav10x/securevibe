// GET /api/scans/:id/public — the teaser view of an anonymous scan.
//
// Serves the landing-page scan bay while a scan runs and after it
// finishes. Only unclaimed anonymous scans answer here; the payload is
// shaped by lib/teaser.ts so critical/high findings never leave the
// server as anything more than a severity marker.

import { NextResponse } from 'next/server';
import { getPublicScan } from '@/lib/teaser';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const scan = await getPublicScan(id);
  if (!scan) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }
  return NextResponse.json(scan, { headers: { 'cache-control': 'no-store' } });
}
