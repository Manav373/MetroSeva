import React from 'react';
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
    <>
      <div className="section-heading">
        <span>01 / Telemetry</span>
        <span>LIVE</span>
      </div>
      <div className="kpi-grid">
        <div className="kpi-box p1-box">
          <span className="kpi-val">{String(p1Count).padStart(2, '0')}</span>
          <span className="kpi-label">P1 Safety</span>
        </div>
        <div className="kpi-box">
          <span className="kpi-val">{String(totalCount).padStart(2, '0')}</span>
          <span className="kpi-label">Active Queue</span>
        </div>
        <div className="kpi-box sla-box">
          <span className="kpi-val">{String(slaBreaches).padStart(2, '0')}</span>
          <span className="kpi-label">SLA Breach</span>
        </div>
        <div className="kpi-box">
          <span className="kpi-val">{String(outboxCount).padStart(2, '0')}</span>
          <span className="kpi-label">Outbox Sync</span>
        </div>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <div className="section-heading">
          <span>02 / Hotspots (2h Window)</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {hotspots.length === 0 ? (
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>
              No repeat clusters detected
            </div>
          ) : (
            hotspots.slice(0, 5).map((h) => (
              <div key={h.station_id} className="hotspot-item">
                <span>{h.station_id}</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{h.count} REPS</span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};
