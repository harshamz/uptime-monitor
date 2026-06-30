import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const monitors = db.prepare(`
    SELECT
      m.*,
      c.status AS last_status,
      c.status_code,
      c.response_time,
      c.ssl_days_left,
      c.checked_at AS last_checked
    FROM monitors m
    LEFT JOIN checks c ON c.id = (
      SELECT id FROM checks WHERE monitor_id = m.id ORDER BY checked_at DESC LIMIT 1
    )
    ORDER BY m.created_at ASC
  `).all();

  return NextResponse.json(monitors);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, url, check_interval = 5 } = body;

  if (!name || !url) {
    return NextResponse.json({ error: 'name and url are required' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return NextResponse.json({ error: 'URL must be http or https' }, { status: 400 });
  }

  const db = getDb();
  const result = db.prepare(
    'INSERT INTO monitors (name, url, check_interval) VALUES (?, ?, ?)'
  ).run(name.trim(), parsed.toString(), check_interval);

  const monitor = db.prepare('SELECT * FROM monitors WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(monitor, { status: 201 });
}
