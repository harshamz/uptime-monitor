import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const alerts = db.prepare(`
    SELECT a.*, m.name AS monitor_name, m.url AS monitor_url
    FROM alerts a
    JOIN monitors m ON m.id = a.monitor_id
    ORDER BY a.sent_at DESC
    LIMIT 100
  `).all();

  return NextResponse.json(alerts);
}
