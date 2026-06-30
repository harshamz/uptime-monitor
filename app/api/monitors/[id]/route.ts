import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  const monitor = db.prepare('SELECT * FROM monitors WHERE id = ?').get(id);
  if (!monitor) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(monitor);
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  const body = await req.json();
  const { name, url, check_interval, enabled } = body;

  const monitor = db.prepare('SELECT * FROM monitors WHERE id = ?').get(id);
  if (!monitor) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (url) {
    try { new URL(url); } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }
  }

  db.prepare(`
    UPDATE monitors SET
      name = COALESCE(?, name),
      url = COALESCE(?, url),
      check_interval = COALESCE(?, check_interval),
      enabled = COALESCE(?, enabled)
    WHERE id = ?
  `).run(name ?? null, url ?? null, check_interval ?? null, enabled ?? null, id);

  return NextResponse.json(db.prepare('SELECT * FROM monitors WHERE id = ?').get(id));
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  const result = db.prepare('DELETE FROM monitors WHERE id = ?').run(id);
  if (result.changes === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
