import React from 'react';
import { StatsOverview, ReviewEvent } from '../types';

interface AnalyticsViewProps {
  stats: StatsOverview | null;
  auditLogs: ReviewEvent[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ stats, auditLogs }) => {
  if (!stats) {
    return <div style={{ color: '#94a3b8', padding: '2rem' }}>Loading analytics...</div>;
  }

  const renderBarChart = (title: string, dataMap: Record<string, number>) => {
    const entries = Object.entries(dataMap || {});
    const maxVal = Math.max(...entries.map(([_, v]) => v), 1);

    return (
      <div className="analytics-card">
        <h3>{title}</h3>
        <div className="chart-bars-list">
          {entries.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '0.8rem' }}>No data available</div>
          ) : (
            entries.map(([label, count]) => {
              const pct = Math.round((count / maxVal) * 100);
              return (
                <div key={label} className="bar-row">
                  <span className="bar-label">{label.replace('_', ' ')}</span>
                  <div className="bar-outer">
                    <div className="bar-inner" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="bar-count">{count}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="analytics-grid">
      {renderBarChart('Department Complaint Distribution', stats.dept_distribution)}
      {renderBarChart('Complainant Language Mix', stats.language_distribution)}
      {renderBarChart('Channel Ingestion Breakdown', stats.channel_distribution)}

      {/* Audit Log Table */}
      <div className="analytics-card full-width">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3>Controller Override &amp; Retraining Audit Trail</h3>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Every human controller correction is recorded as active learning ground truth for model bundle retraining.
            </div>
          </div>
          <span className="count-badge">{auditLogs.length} Events</span>
        </div>

        <div className="audit-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Complaint ID</th>
                <th>Controller / Actor</th>
                <th>Field Adjusted</th>
                <th>Original Value</th>
                <th>Corrected Value</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem' }}>
                    No manual controller overrides logged yet.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      {log.at
                        ? new Date(log.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : 'N/A'}
                    </td>
                    <td>
                      <code>{log.complaint_id}</code>
                    </td>
                    <td>
                      <strong>{log.actor}</strong>
                    </td>
                    <td>
                      <span className="badge-pill badge-p3" style={{ fontSize: '0.7rem' }}>
                        {log.field}
                      </span>
                    </td>
                    <td style={{ color: '#94a3b8' }}>{log.old_value || '—'}</td>
                    <td style={{ color: '#10b981', fontWeight: 600 }}>{log.new_value}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
