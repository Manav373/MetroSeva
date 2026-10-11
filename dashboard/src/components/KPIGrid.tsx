import React from 'react';
import { ShieldAlert, ListFilter, AlertTriangle, RefreshCw, Flame } from 'lucide-react';
import { Hotspot } from '../types';

interface KPIGridProps {
  p1Count: number;
  totalCount: number;
  slaBreaches: number;
  outboxCount: number;
  hotspots: Hotspot[];
}

export const KPIGrid: React.FC<KPIGridProps> = ({
  p1Count,
  totalCount,
  slaBreaches,
  outboxCount,
  hotspots,
}) => {
  return (
    <div className="sidebar-kpi-container">
      {/* Telemetry Header */}
      <div className="section-heading">
        <span>01 / System Telemetry</span>
        <span className="live-telemetry-badge">
          <span className="pulse-dot" /> LIVE
        </span>
      </div>

      {/* KPI 4-Cell Grid */}
      <div className="kpi-grid">
        {/* P1 Safety Alert */}
        <div className="kpi-box p1-box">
          <div className="kpi-header-row">
            <ShieldAlert size={16} className="kpi-icon" />
            <span className="kpi-tag-label">P1 Safety</span>
          </div>
          <span className="kpi-val">{String(p1Count).padStart(2, '0')}</span>
          <span className="kpi-caption">Active Critical</span>
        </div>

        {/* Total Queue */}
        <div className="kpi-box">
          <div className="kpi-header-row">
            <ListFilter size={16} className="kpi-icon" />
            <span className="kpi-tag-label">Queue</span>
          </div>
          <span className="kpi-val">{String(totalCount).padStart(2, '0')}</span>
          <span className="kpi-caption">Total Tickets</span>
        </div>

        {/* SLA Breaches */}
        <div className="kpi-box sla-box">
          <div className="kpi-header-row">
            <AlertTriangle size={16} className="kpi-icon" />
            <span className="kpi-tag-label">SLA Breach</span>
          </div>
          <span className="kpi-val">{String(slaBreaches).padStart(2, '0')}</span>
          <span className="kpi-caption">&gt; 15m Delayed</span>
        </div>

        {/* Outbox Pending */}
        <div className="kpi-box outbox-box">
          <div className="kpi-header-row">
            <RefreshCw size={16} className="kpi-icon" />
            <span className="kpi-tag-label">Outbox</span>
          </div>
          <span className="kpi-val">{String(outboxCount).padStart(2, '0')}</span>
          <span className="kpi-caption">Sync Queue</span>
        </div>
      </div>

      {/* Hotspots Section */}
      <div className="hotspots-section" style={{ marginTop: '1.5rem' }}>
        <div className="section-heading">
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Flame size={13} color="var(--signal-amber)" />
            <span>02 / Hotspots (2h Window)</span>
          </span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Top Clusters</span>
        </div>

        <div className="hotspots-list">
          {hotspots.length === 0 ? (
            <div className="hotspot-empty">
              <span>No repeat clusters detected in this window</span>
            </div>
          ) : (
            hotspots.slice(0, 5).map((h, index) => {
              const maxCount = Math.max(...hotspots.map((item) => item.count), 1);
              const pct = Math.round((h.count / maxCount) * 100);

              return (
                <div key={h.station_id} className="hotspot-item">
                  <div className="hotspot-info">
                    <span className="hotspot-rank">#{index + 1}</span>
                    <span className="hotspot-name">{h.station_id.replace('STN_', '')}</span>
                  </div>
                  <div className="hotspot-count-pill">
                    <span>{h.count} reps</span>
                  </div>
                  <div className="hotspot-mini-bar">
                    <div className="hotspot-mini-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
