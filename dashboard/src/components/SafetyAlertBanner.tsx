import React from 'react';
import { X, ArrowRight } from 'lucide-react';
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
        <span className="safety-pill-tag">P1 / CRITICAL</span>
        <div>
          <strong style={{ color: '#fff', letterSpacing: '0.02em' }}>
            [{topP1.station_id}]
          </strong>{' '}
          <span style={{ color: 'rgba(255,255,255,0.7)' }}>
            {hitNames ? `TRIGGER: ${hitNames} — ` : ''}"{topP1.raw_text.substring(0, 90)}..."
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          className="btn btn-outline"
          style={{ padding: '0.35rem 0.75rem', fontSize: '0.72rem' }}
          onClick={() => onJumpToCard(topP1.id)}
        >
          <span>INSPECT</span>
          <ArrowRight size={12} />
        </button>
        <button
          onClick={onDismiss}
          style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}
          title="Dismiss Alert"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
