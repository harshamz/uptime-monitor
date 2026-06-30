'use client';

import { useEffect, useState } from 'react';

type Alert = {
  id: number;
  monitor_id: number;
  type: string;
  message: string;
  sent_at: number;
  monitor_name: string;
  monitor_url: string;
};

const ICONS: Record<string, string> = {
  down: '🔴',
  up: '✅',
  ssl_warning: '⚠️',
  ssl_expired: '🔴',
};

export default function AlertsList() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    fetch('/api/alerts').then((r) => r.json()).then(setAlerts);
  }, []);

  if (alerts.length === 0) return null;

  const timeAgo = (unix: number) => {
    const diff = Math.floor(Date.now() / 1000) - unix;
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div style={{ marginTop: 40 }}>
      <div className="section-header">
        <h2 className="section-title">Recent Alerts</h2>
      </div>
      <div className="alerts-list">
        {alerts.slice(0, 20).map((a) => (
          <div key={a.id} className="alert-item">
            <span className="alert-icon">{ICONS[a.type] || '🔔'}</span>
            <div className="alert-body">
              <div className="alert-msg">{a.message}</div>
              <div className="alert-sub">{a.monitor_name} — {a.monitor_url}</div>
            </div>
            <div className="alert-time">{timeAgo(a.sent_at)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
