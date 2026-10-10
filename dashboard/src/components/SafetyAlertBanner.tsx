import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Complaint } from '../types';

interface SafetyAlertBannerProps {
  topP1: Complaint | null;
  onDismiss: () => void;
  onJumpToCard: (id: string) => void;
}

export const SafetyAlertBanner: React.FC<SafetyAlertBannerProps> = ({
  topP1,
  onDismiss,
  onJumpToCard,
}) => {
  if (!topP1) return null;

  const hitNames = topP1.safety_hits?.map((h) => (typeof h === 'string' ? h : h.id || 'SAFETY_RULE')).join(', ');

  return (
    <div className="safety-banner" role="alert">
      <div className="safety-banner-content">
        <span className="safety-banner-icon">
          <AlertTriangle color="#fca5a5" />
        </span>
        <div>
          <strong>CRITICAL SAFETY ALERT (P1 Floor):</strong> Station <strong>[{topP1.station_id}]</strong>{' '}
          {hitNames ? `— Trigger: [${hitNames}]` : ''} — "{topP1.raw_text.substring(0, 95)}..."
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <button
          className="btn btn-outline"
          style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', background: 'rgba(0,0,0,0.3)', color: '#fff' }}
          onClick={() => onJumpToCard(topP1.id)}
        >
          Inspect Complaint
        </button>
        <button
          onClick={onDismiss}
          style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}
          title="Dismiss Alert"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};
