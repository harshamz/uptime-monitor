import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { checkUrl } from '@/lib/checker';
import type { Monitor } from '@/lib/db';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const monitor = db.prepare('SELECT * FROM monitors WHERE id = ?').get(id) as Monitor | undefined;
  if (!monitor) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const result = await checkUrl(monitor.url);

  db.prepare(`
    INSERT INTO checks (monitor_id, status, status_code, response_time, error, ssl_days_left, ssl_valid)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    monitor.id,
    result.status,
    result.status_code ?? null,
    result.response_time ?? null,
    result.error ?? null,
    result.ssl_days_left ?? null,
    result.ssl_valid == null ? null : result.ssl_valid ? 1 : 0
  );

  return NextResponse.json(result);
}
