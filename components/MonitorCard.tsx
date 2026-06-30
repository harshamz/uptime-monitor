'use client';

import { useState } from 'react';

type Monitor = {
  id: number;
  name: string;
  url: string;
  check_interval: number;
  enabled: number;
  last_status: string | null;
  status_code: number | null;
  response_time: number | null;
  ssl_days_left: number | null;
  last_checked: number | null;
};

type Props = {
  monitor: Monitor;
  onDelete: (id: number) => void;
  onToggle: (id: number, enabled: number) => void;
  onCheck: (id: number) => Promise<void>;
};

export default function MonitorCard({ monitor, onDelete, onToggle, onCheck }: Props) {
  const [checking, setChecking] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const status = monitor.last_status || 'unknown';
  const enabled = monitor.enabled === 1;

  const handleCheck = async () => {
    setChecking(true);
    await onCheck(monitor.id);
    setChecking(false);
  };

  const timeAgo = (unix: number | null) => {
    if (!unix) return 'Never';
    const diff = Math.floor(Date.now() / 1000) - unix;
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const statusLabel = (s: string) => {
    if (s === 'ssl_warning') return 'SSL WARN';
    if (s === 'ssl_expired') return 'SSL EXPIRED';
    return s.toUpperCase();
  };

  return (
    <>
      <div className={`monitor-card ${!enabled ? 'disabled' : ''}`}>
        <div className={`status-dot ${status}`} title={status} />

        <div className="monitor-info">
          <div className="monitor-name">{monitor.name}</div>
          <div className="monitor-url">{monitor.url}</div>
        </div>

        <div className="monitor-meta">
          <div className="meta-item">
            <div className="meta-label">Status</div>
            <div className={`meta-value ${status}`}>
              <span className={`badge ${status}`}>{statusLabel(status)}</span>
            </div>
          </div>
          {monitor.response_time != null && (
            <div className="meta-item">
              <div className="meta-label">Response</div>
              <div className="meta-value">{monitor.response_time}ms</div>
            </div>
          )}
          {monitor.ssl_days_left != null && (
            <div className="meta-item">
              <div className="meta-label">SSL</div>
              <div className={`meta-value ${monitor.ssl_days_left <= 14 ? 'yellow' : ''}`}>
                {monitor.ssl_days_left}d
              </div>
            </div>
          )}
          <div className="meta-item">
            <div className="meta-label">Checked</div>
            <div className="meta-value">{timeAgo(monitor.last_checked)}</div>
          </div>
        </div>

        <div className="monitor-actions">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowHistory(!showHistory)}
            title="History"
          >
            History
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleCheck}
            disabled={checking}
            title="Check now"
          >
            {checking ? <span className="spinner" style={{ width: 12, height: 12 }} /> : 'Check'}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onToggle(monitor.id, monitor.enabled)}
            title={enabled ? 'Pause' : 'Resume'}
          >
            {enabled ? 'Pause' : 'Resume'}
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => { if (confirm(`Delete "${monitor.name}"?`)) onDelete(monitor.id); }}
            title="Delete"
          >
            Delete
          </button>
        </div>
      </div>

      {showHistory && <HistoryPanel monitorId={monitor.id} />}
    </>
  );
}

function HistoryPanel({ monitorId }: { monitorId: number }) {
  const [checks, setChecks] = useState<{ status: string; response_time: number | null; checked_at: number; error: string | null }[]>([]);
  const [loaded, setLoaded] = useState(false);

  if (!loaded) {
    fetch(`/api/monitors/${monitorId}/history`)
      .then((r) => r.json())
      .then((data) => { setChecks(data); setLoaded(true); });
  }

  if (!loaded) {
    return (
      <div style={{ padding: '12px 18px', background: 'var(--bg-hover)', borderRadius: '0 0 10px 10px', border: '1px solid var(--border)', borderTop: 'none' }}>
        <div className="spinner" style={{ margin: '0 auto' }} />
      </div>
    );
  }

  const recent = checks.slice(0, 50);

  return (
    <div style={{ padding: '14px 18px', background: 'var(--bg-hover)', borderRadius: '0 0 10px 10px', border: '1px solid var(--border)', borderTop: 'none' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Last {recent.length} checks</div>
      <div className="history-bar-row">
        {recent.reverse().map((c, i) => (
          <div
            key={i}
            className={`history-bar ${c.status}`}
            style={{ height: c.response_time ? `${Math.min(100, (c.response_time / 2000) * 100)}%` : '30%' }}
            title={`${c.status} — ${c.response_time ?? 0}ms${c.error ? ` — ${c.error}` : ''}`}
          />
        ))}
      </div>
      {checks[0] && checks[0].error && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--red)' }}>
          Last error: {checks[0].error}
        </div>
      )}
    </div>
  );
}
