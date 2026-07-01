import { config } from 'dotenv';
import { resolve } from 'path';

// __dirname se path resolve karo taake PM2 kisi bhi directory se start kare
config({ path: resolve(__dirname, '..', '.env.local') });

import cron from 'node-cron';
import { getDb } from '../lib/db';
import { checkUrl } from '../lib/checker';
import { sendAlert } from '../lib/mailer';
import type { Monitor } from '../lib/db';

// Per-monitor state — memory mein track karo
const lastChecked = new Map<number, number>();  // monitor_id -> ms timestamp
const lastStatus  = new Map<number, string>();   // monitor_id -> last status
const downSince   = new Map<number, number>();   // monitor_id -> ms when went down
const lastSslAlert = new Map<number, number>();  // monitor_id -> ms last ssl alert sent

const SSL_ALERT_INTERVAL_MS = 24 * 60 * 60 * 1000;

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s} seconds`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m > 1 ? 's' : ''}`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h} hour${h > 1 ? 's' : ''}`;
}

async function runChecks() {
  const db = getDb();
  const monitors = db.prepare('SELECT * FROM monitors WHERE enabled = 1').all() as Monitor[];
  const now = Date.now();

  // Sirf wahi monitors check karo jinki interval poori ho gayi
  const due = monitors.filter((m) => {
    const last = lastChecked.get(m.id) || 0;
    return now - last >= m.check_interval * 60 * 1000;
  });

  if (due.length > 0) {
    console.log(`[${new Date().toISOString()}] Checking ${due.length} monitor(s)...`);
  }

  await Promise.allSettled(due.map((m) => checkMonitor(m)));
}

async function checkMonitor(monitor: Monitor) {
  const db = getDb();
  lastChecked.set(monitor.id, Date.now());

  try {
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

    const prev = lastStatus.get(monitor.id);

    // Site gai down
    if (result.status === 'down' && prev !== 'down') {
      downSince.set(monitor.id, Date.now());
      await sendAlert({ monitorName: monitor.name, url: monitor.url, type: 'down', error: result.error });
      db.prepare('INSERT INTO alerts (monitor_id, type, message) VALUES (?, ?, ?)').run(
        monitor.id, 'down', `Site is down: ${result.error || 'Unknown error'}`
      );
    }

    // Site recover hui — downtime duration include karo
    if (result.status === 'up' && prev === 'down') {
      const since = downSince.get(monitor.id);
      const duration = since ? formatDuration(Date.now() - since) : null;
      downSince.delete(monitor.id);

      await sendAlert({ monitorName: monitor.name, url: monitor.url, type: 'up', downtimeDuration: duration });
      db.prepare('INSERT INTO alerts (monitor_id, type, message) VALUES (?, ?, ?)').run(
        monitor.id, 'up', `Site recovered${duration ? ` after ${duration}` : ''}`
      );
    }

    // SSL alerts — din mein sirf ek baar
    if (result.status === 'ssl_expired' || result.status === 'ssl_warning') {
      const lastSent = lastSslAlert.get(monitor.id) || 0;
      if (Date.now() - lastSent > SSL_ALERT_INTERVAL_MS) {
        const type = result.status === 'ssl_expired' ? 'ssl_expired' : 'ssl_warning';
        await sendAlert({ monitorName: monitor.name, url: monitor.url, type, sslDaysLeft: result.ssl_days_left });
        db.prepare('INSERT INTO alerts (monitor_id, type, message) VALUES (?, ?, ?)').run(
          monitor.id, type, `SSL ${type}: ${result.ssl_days_left} days left`
        );
        lastSslAlert.set(monitor.id, Date.now());
      }
    }

    lastStatus.set(monitor.id, result.status);
    console.log(`[${new Date().toISOString()}] ${monitor.name} (every ${monitor.check_interval}m) → ${result.status} (${result.response_time}ms)`);
  } catch (err) {
    console.error(`[Worker] Error checking ${monitor.name}:`, err);
  }
}

console.log(`[Worker] Starting — cron tick every 1 minute, each monitor respects its own interval`);
runChecks();
cron.schedule('* * * * *', runChecks);
