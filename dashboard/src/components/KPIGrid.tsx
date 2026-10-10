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
      <div className="section-heading">Operational Status</div>
      <div className="kpi-grid">
        <div className="kpi-box p1-box">
          <span className="kpi-val">{p1Count}</span>
          <span className="kpi-label">P1 Safety Alerts</span>
        </div>
        <div className="kpi-box">
          <span className="kpi-val">{totalCount}</span>
          <span className="kpi-label">Active In Queue</span>
        </div>
        <div className="kpi-box sla-box">
          <span className="kpi-val">{slaBreaches}</span>
          <span className="kpi-label">SLA Breaches (&gt;15m)</span>
        </div>
        <div className="kpi-box">
          <span className="kpi-val">{outboxCount}</span>
          <span className="kpi-label">Pending Sync</span>
        </div>
      </div>

      <div style={{ marginTop: '0.85rem' }}>
        <div className="section-heading">Repeat Hotspots (2h Window)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {hotspots.length === 0 ? (
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>No cluster hotspots detected</div>
          ) : (
            hotspots.slice(0, 5).map((h) => (
              <div key={h.station_id} className="hotspot-item">
                <span>📍 {h.station_id}</span>
                <span style={{ fontWeight: 700, color: '#38bdf8' }}>{h.count} reports</span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};
