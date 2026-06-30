import https from 'https';
import http from 'http';
import tls from 'tls';
import { URL } from 'url';

export type CheckResult = {
  status: 'up' | 'down' | 'ssl_warning' | 'ssl_expired';
  status_code: number | null;
  response_time: number | null;
  error: string | null;
  ssl_days_left: number | null;
  ssl_valid: boolean | null;
};

const SSL_WARN_DAYS = parseInt(process.env.SSL_WARN_DAYS || '14', 10);
const TIMEOUT_MS = 15000;

export async function checkUrl(url: string): Promise<CheckResult> {
  const parsed = new URL(url);
  const isHttps = parsed.protocol === 'https:';

  const [httpResult, sslResult] = await Promise.all([
    checkHttp(url),
    isHttps ? checkSsl(parsed.hostname, parseInt(parsed.port || '443', 10)) : Promise.resolve(null),
  ]);

  if (httpResult.status === 'down') {
    return { ...httpResult, ssl_days_left: null, ssl_valid: null };
  }

  if (sslResult) {
    if (!sslResult.valid) {
      return {
        ...httpResult,
        status: 'ssl_expired',
        ssl_days_left: sslResult.daysLeft,
        ssl_valid: false,
      };
    }
    if (sslResult.daysLeft <= SSL_WARN_DAYS) {
      return {
        ...httpResult,
        status: 'ssl_warning',
        ssl_days_left: sslResult.daysLeft,
        ssl_valid: true,
      };
    }
    return {
      ...httpResult,
      ssl_days_left: sslResult.daysLeft,
      ssl_valid: true,
    };
  }

  return { ...httpResult, ssl_days_left: null, ssl_valid: null };
}

async function checkHttp(url: string): Promise<Omit<CheckResult, 'ssl_days_left' | 'ssl_valid'>> {
  return new Promise((resolve) => {
    const start = Date.now();
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;

    const req = lib.get(
      url,
      {
        headers: { 'User-Agent': 'UptimeMonitor/1.0' },
        timeout: TIMEOUT_MS,
        rejectUnauthorized: false,
      },
      (res) => {
        res.resume();
        const elapsed = Date.now() - start;
        const code = res.statusCode ?? 0;
        if (code >= 200 && code < 400) {
          resolve({ status: 'up', status_code: code, response_time: elapsed, error: null });
        } else {
          resolve({ status: 'down', status_code: code, response_time: elapsed, error: `HTTP ${code}` });
        }
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 'down', status_code: null, response_time: TIMEOUT_MS, error: 'Connection timed out' });
    });

    req.on('error', (err) => {
      resolve({ status: 'down', status_code: null, response_time: Date.now() - start, error: err.message });
    });
  });
}

type SslResult = { valid: boolean; daysLeft: number };

async function checkSsl(hostname: string, port: number): Promise<SslResult> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host: hostname, port, servername: hostname, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate();
        socket.destroy();

        if (!cert || !cert.valid_to) {
          resolve({ valid: false, daysLeft: 0 });
          return;
        }

        const expiry = new Date(cert.valid_to);
        const now = new Date();
        const daysLeft = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        resolve({ valid: daysLeft > 0, daysLeft });
      }
    );

    socket.on('error', () => {
      resolve({ valid: false, daysLeft: 0 });
    });

    socket.setTimeout(TIMEOUT_MS, () => {
      socket.destroy();
      resolve({ valid: false, daysLeft: 0 });
    });
  });
}
