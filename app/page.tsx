'use client';

import { useEffect, useState, useCallback } from 'react';
import AddMonitorModal from '@/components/AddMonitorModal';
import MonitorCard from '@/components/MonitorCard';
import AlertsList from '@/components/AlertsList';
import Toast from '@/components/Toast';

type Monitor = {
  id: number;
  name: string;
  url: string;
  check_interval: number;
  enabled: number;
  created_at: number;
  last_status: string | null;
  status_code: number | null;
  response_time: number | null;
  ssl_days_left: number | null;
  last_checked: number | null;
};

type ToastMsg = { id: number; text: string; type: 'success' | 'error' };

export default function Home() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const toast = (text: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts((t) => [...t, { id, text, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  };

  const load = useCallback(async () => {
    const res = await fetch('/api/monitors');
    if (res.ok) setMonitors(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/monitors/${id}`, { method: 'DELETE' });
    if (res.ok) { toast('Monitor deleted'); load(); }
    else toast('Failed to delete', 'error');
  };

  const handleToggle = async (id: number, enabled: number) => {
    await fetch(`/api/monitors/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: enabled ? 0 : 1 }),
    });
    load();
  };

  const handleCheck = async (id: number) => {
    const res = await fetch(`/api/monitors/${id}/check`, { method: 'POST' });
    if (res.ok) { toast('Check complete'); load(); }
    else toast('Check failed', 'error');
  };

  const up = monitors.filter((m) => m.last_status === 'up').length;
  const down = monitors.filter((m) => m.last_status === 'down').length;
  const sslIssue = monitors.filter((m) => m.last_status === 'ssl_warning' || m.last_status === 'ssl_expired').length;
  const unknown = monitors.filter((m) => !m.last_status).length;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-logo">
          <span className="logo-dot" />
          Uptime Monitor
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Auto-refresh: 30s</span>
      </header>

      <main className="main-content">
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Total Monitors</div>
            <div className="stat-value blue">{monitors.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Online</div>
            <div className="stat-value green">{up}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Down</div>
            <div className="stat-value red">{down}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">SSL Issues</div>
            <div className="stat-value yellow">{sslIssue}</div>
          </div>
        </div>

        <div className="section-header">
          <h2 className="section-title">Monitors</h2>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            + Add Monitor
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 48 }}>
            <div className="spinner" />
          </div>
        ) : monitors.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📡</div>
            <div className="empty-state-text">No monitors yet</div>
            <div className="empty-state-sub">Add your first website to start monitoring</div>
          </div>
        ) : (
          <div className="monitor-list">
            {monitors.map((m) => (
              <MonitorCard
                key={m.id}
                monitor={m}
                onDelete={handleDelete}
                onToggle={handleToggle}
                onCheck={handleCheck}
              />
            ))}
          </div>
        )}

        {unknown > 0 && (
          <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
            {unknown} monitor{unknown > 1 ? 's' : ''} pending first check — start the worker process.
          </p>
        )}

        <AlertsList />
      </main>

      {showAdd && (
        <AddMonitorModal
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); toast('Monitor added'); load(); }}
        />
      )}

      <div className="toast-container">
        {toasts.map((t) => (
          <Toast key={t.id} text={t.text} type={t.type} />
        ))}
      </div>
    </div>
  );
}
