// Daily safety net (Vercel Cron): delete any uploaded zip older than an
// hour. The scan pipeline already deletes uploads immediately — this sweep
// only catches objects orphaned by a crash mid-scan.

import { NextResponse } from 'next/server';
import { adminConfigured, createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>".
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!adminConfigured()) {
    return NextResponse.json({ error: 'SUPABASE_SECRET_KEY not configured' }, { status: 503 });
  }

  const admin = createAdminClient();
  const cutoff = Date.now() - 3_600_000; // 1 hour
  let deleted = 0;

  // Bucket layout is {user_id}/{uuid}.zip — list folders, then their files.
  const { data: folders } = await admin.storage.from('uploads').list('', { limit: 1000 });
  for (const folder of folders ?? []) {
    if (folder.id) continue; // a file at the root (unexpected) — skip
    const { data: files } = await admin.storage
      .from('uploads')
      .list(folder.name, { limit: 1000 });
    const stale = (files ?? [])
      .filter((f) => f.created_at && new Date(f.created_at).getTime() < cutoff)
      .map((f) => `${folder.name}/${f.name}`);
    if (stale.length > 0) {
      const { error } = await admin.storage.from('uploads').remove(stale);
      if (!error) deleted += stale.length;
    }
  }

  return NextResponse.json({ ok: true, deleted });
}
