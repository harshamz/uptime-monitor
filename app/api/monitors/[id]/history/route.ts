import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const monitor = db.prepare('SELECT id FROM monitors WHERE id = ?').get(id);
  if (!monitor) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const checks = db.prepare(`
    SELECT * FROM checks
    WHERE monitor_id = ?
    ORDER BY checked_at DESC
    LIMIT 200
  `).all(id);

  return NextResponse.json(checks);
}
