import React from 'react';
import { 
  History, 
  UserCheck, 
  Activity, 
  Layers, 
  Languages, 
  Radio
} from 'lucide-react';
import { StatsOverview, ReviewEvent } from '../types';
import { formatTime, formatRelativeTime } from '../utils/dateUtils';

interface AnalyticsViewProps {
  stats: StatsOverview | null;
  auditLogs: ReviewEvent[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ stats, auditLogs }) => {
  if (!stats) {
    return (
      <div className="analytics-loading">
        <Activity size={24} className="spin" />
        <span>Loading telemetry &amp; audit trails...</span>
      </div>
    );
  }

  const renderBarChart = (
    title: string, 
    dataMap: Record<string, number>,
    icon: React.ReactNode,
    colorScheme: 'accent' | 'emerald' | 'amber' = 'accent'
  ) => {
    const entries = Object.entries(dataMap || {});
    const total = entries.reduce((acc, [_, v]) => acc + v, 0);
    const maxVal = Math.max(...entries.map(([_, v]) => v), 1);

    return (
      <div className="analytics-card">
        <div className="analytics-card-header">
          <div className="analytics-title-group">
            {icon}
            <h3>{title}</h3>
          </div>
          <span className="total-metric-pill">{total} total</span>
        </div>

        <div className="chart-bars-list">
          {entries.length === 0 ? (
            <div className="chart-empty-msg">No distribution data recorded yet</div>
          ) : (
            entries.map(([label, count]) => {
              const pct = Math.round((count / maxVal) * 100);
              const share = total > 0 ? Math.round((count / total) * 100) : 0;

              return (
                <div key={label} className="bar-row">
                  <div className="bar-label-group">
                    <span className="bar-label">{label.replace(/_/g, ' ')}</span>
                    <span className="bar-share-label">{share}%</span>
                  </div>
                  <div className="bar-outer">
                    <div 
                      className={`bar-inner ${colorScheme}`} 
                      style={{ width: `${pct}%` }} 
                    />
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
    <div className="analytics-container-inner">
      {/* Page Header */}
      <div className="analytics-header-section">
        <div>
          <h2 className="analytics-page-title">Operations Telemetry &amp; Continuous Learning</h2>
          <p className="analytics-page-subtitle">
            Model performance distribution, incoming channel volume, and immutable ground-truth controller audit trails.
          </p>
        </div>
      </div>

      {/* 3 Metric Distribution Cards */}
      <div className="analytics-grid">
        {renderBarChart(
          'Department Routing Distribution', 
          stats.dept_distribution,
          <Layers size={16} color="var(--accent-light)" />,
          'accent'
        )}
        {renderBarChart(
          'Complainant Language Mix', 
          stats.language_distribution,
          <Languages size={16} color="var(--signal-green)" />,
          'emerald'
        )}
        {renderBarChart(
          'Channel Ingestion Breakdown', 
          stats.channel_distribution,
          <Radio size={16} color="var(--signal-amber)" />,
          'amber'
        )}

        {/* Full-Width Controller Audit Trail Table */}
        <div className="analytics-card full-width">
          <div className="analytics-card-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <History size={17} color="var(--accent-light)" />
                <h3>Controller Override &amp; Retraining Ground Truth</h3>
              </div>
              <div className="audit-subtitle-text">
                Every manual supervisor adjustment is signed and recorded for active learning dataset compilation.
              </div>
            </div>
            <span className="count-badge">{auditLogs.length} Events Logged</span>
          </div>

          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Ticket ID</th>
                  <th>Supervisor / Actor</th>
                  <th>Field Adjusted</th>
                  <th>Original Value</th>
                  <th>Ground Truth Value</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="audit-empty-td">
                      No manual controller overrides logged yet in this session.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="audit-time-cell">
                        <span>{log.at ? formatTime(log.at) : 'N/A'}</span>
                        <span className="audit-rel-time">({log.at ? formatRelativeTime(log.at) : ''})</span>
                      </td>
                      <td>
                        <code className="audit-ticket-code">{log.complaint_id}</code>
                      </td>
                      <td>
                        <div className="actor-badge">
                          <UserCheck size={12} />
                          <span>{log.actor}</span>
                        </div>
                      </td>
                      <td>
                        <span className="field-pill">
                          {log.field}
                        </span>
                      </td>
                      <td className="old-val-cell">
                        <span>{log.old_value || '—'}</span>
                      </td>
                      <td className="new-val-cell">
                        <span className="diff-arrow">&rarr;</span>
                        <span className="new-val-text">{log.new_value}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
