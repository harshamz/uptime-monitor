import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import cron from 'node-cron';
import { getDb } from '../lib/db';
import { checkUrl } from '../lib/checker';
import { sendAlert } from '../lib/mailer';
import type { Monitor } from '../lib/db';

const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL || '1', 10);
const cronExpr = `*/${CHECK_INTERVAL} * * * *`;

const lastStatus = new Map<number, string>();
const lastSslAlert = new Map<number, number>();
const SSL_ALERT_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function runChecks() {
  const db = getDb();
  const monitors = db.prepare('SELECT * FROM monitors WHERE enabled = 1').all() as Monitor[];
  await Promise.allSettled(monitors.map((m) => checkMonitor(m)));
}

async function checkMonitor(monitor: Monitor) {
  const db = getDb();

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

    if (result.status === 'down' && prev !== 'down') {
      await sendAlert({ monitorName: monitor.name, url: monitor.url, type: 'down', error: result.error });
      db.prepare('INSERT INTO alerts (monitor_id, type, message) VALUES (?, ?, ?)').run(
        monitor.id, 'down', `Site is down: ${result.error}`
      );
    }

    if (result.status === 'up' && prev === 'down') {
      await sendAlert({ monitorName: monitor.name, url: monitor.url, type: 'up' });
      db.prepare('INSERT INTO alerts (monitor_id, type, message) VALUES (?, ?, ?)').run(
        monitor.id, 'up', 'Site recovered'
      );
    }

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
    console.log(`[${new Date().toISOString()}] ${monitor.name} → ${result.status} (${result.response_time}ms)`);
  } catch (err) {
    console.error(`Error checking ${monitor.name}:`, err);
  }
}

console.log(`[Worker] Starting — checking every ${CHECK_INTERVAL} minute(s)`);
runChecks();
cron.schedule(cronExpr, runChecks);
