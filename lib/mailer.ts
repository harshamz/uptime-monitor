import nodemailer from 'nodemailer';
import https from 'https';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

async function sendWhatsApp(message: string): Promise<void> {
  const phone = process.env.WHATSAPP_PHONE;
  const apiKey = process.env.WHATSAPP_APIKEY;
  if (!phone || !apiKey) return;

  const groupId = process.env.WHATSAPP_GROUP_ID;
  const encoded = encodeURIComponent(message);

  // Group ID set hai toh group mein bhejo, warna personal number pe
  const url = groupId
    ? `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encoded}&apikey=${apiKey}&groupid=${groupId}`
    : `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encoded}&apikey=${apiKey}`;

  return new Promise((resolve) => {
    https.get(url, (res) => {
      res.resume();
      resolve();
    }).on('error', () => resolve());
  });
}

type AlertType = 'down' | 'up' | 'ssl_warning' | 'ssl_expired';

const waMessages: Record<AlertType, (name: string, url: string, extra?: string | null) => string> = {
  down:        (name, url, err) => `🔴 *DOWN*: ${name}\n${url}\nError: ${err || 'Unknown'}\nTime: ${new Date().toLocaleString()}`,
  up:          (name, url)      => `✅ *RECOVERED*: ${name}\n${url}\nTime: ${new Date().toLocaleString()}`,
  ssl_warning: (name, url, d)   => `⚠️ *SSL WARNING*: ${name}\n${url}\nDays left: ${d}\nTime: ${new Date().toLocaleString()}`,
  ssl_expired: (name, url)      => `🔴 *SSL EXPIRED*: ${name}\n${url}\nTime: ${new Date().toLocaleString()}`,
};

export async function sendAlert(params: {
  monitorName: string;
  url: string;
  type: AlertType;
  error?: string | null;
  sslDaysLeft?: number | null;
}): Promise<void> {
  const { monitorName, url, type, error, sslDaysLeft } = params;
  const extra = type === 'ssl_warning' ? String(sslDaysLeft ?? '') : error;

  await Promise.allSettled([
    sendEmail(params),
    sendWhatsApp(waMessages[type](monitorName, url, extra)),
  ]);
}

async function sendEmail(params: {
  monitorName: string;
  url: string;
  type: AlertType;
  error?: string | null;
  sslDaysLeft?: number | null;
}): Promise<void> {
  const to = process.env.ALERT_TO;
  const from = process.env.ALERT_FROM;
  if (!to || !from || !process.env.SMTP_USER) return;

  const { monitorName, url, type, error, sslDaysLeft } = params;

  const subjects: Record<AlertType, string> = {
    down:        `🔴 ALERT: ${monitorName} is DOWN`,
    up:          `✅ RECOVERED: ${monitorName} is back UP`,
    ssl_warning: `⚠️ SSL WARNING: ${monitorName} expires in ${sslDaysLeft} days`,
    ssl_expired: `🔴 SSL EXPIRED: ${monitorName} certificate has expired`,
  };

  const bodies: Record<AlertType, string> = {
    down: `
      <h2 style="color:#dc2626">Site Down Alert</h2>
      <p><strong>Monitor:</strong> ${monitorName}</p>
      <p><strong>URL:</strong> <a href="${url}">${url}</a></p>
      <p><strong>Error:</strong> ${error || 'Unknown error'}</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
    `,
    up: `
      <h2 style="color:#16a34a">Site Recovered</h2>
      <p><strong>Monitor:</strong> ${monitorName}</p>
      <p><strong>URL:</strong> <a href="${url}">${url}</a></p>
      <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
    `,
    ssl_warning: `
      <h2 style="color:#d97706">SSL Certificate Warning</h2>
      <p><strong>Monitor:</strong> ${monitorName}</p>
      <p><strong>URL:</strong> <a href="${url}">${url}</a></p>
      <p><strong>Days remaining:</strong> ${sslDaysLeft} days</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
    `,
    ssl_expired: `
      <h2 style="color:#dc2626">SSL Certificate Expired</h2>
      <p><strong>Monitor:</strong> ${monitorName}</p>
      <p><strong>URL:</strong> <a href="${url}">${url}</a></p>
      <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
    `,
  };

  await getTransporter().sendMail({
    from: `"Uptime Monitor" <${from}>`,
    to,
    subject: subjects[type],
    html: `<div style="font-family:sans-serif;max-width:600px">${bodies[type]}</div>`,
  });
}
