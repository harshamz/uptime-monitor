'use client';

import { useState } from 'react';

type Props = {
  onClose: () => void;
  onAdded: () => void;
};

export default function AddMonitorModal({ onClose, onAdded }: Props) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [interval, setInterval] = useState('5');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/monitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url, check_interval: parseInt(interval, 10) }),
    });

    setLoading(false);

    if (res.ok) {
      onAdded();
    } else {
      const body = await res.json();
      setError(body.error || 'Something went wrong');
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h2 className="modal-title">Add Monitor</h2>
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Monitor Name</label>
            <input
              type="text"
              placeholder="My Website"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">URL</label>
            <input
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Check Interval (minutes)</label>
            <select value={interval} onChange={(e) => setInterval(e.target.value)}>
              <option value="1">Every 1 minute</option>
              <option value="5">Every 5 minutes</option>
              <option value="10">Every 10 minutes</option>
              <option value="30">Every 30 minutes</option>
              <option value="60">Every hour</option>
            </select>
          </div>

          {error && (
            <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</p>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Adding...' : 'Add Monitor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
