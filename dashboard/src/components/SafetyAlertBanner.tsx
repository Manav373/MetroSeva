import React from 'react';
import { X, ArrowRight, ShieldAlert } from 'lucide-react';
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
    <aside className="safety-banner" role="alert" aria-label="Critical P1 Safety Alert">
      <div className="safety-banner-content">
        <div className="safety-alert-indicator">
          <ShieldAlert size={18} className="safety-icon-pulse" />
          <span className="safety-pill-tag">P1 CRITICAL SAFETY</span>
        </div>

        <div className="safety-details-wrap">
          <span className="safety-stn-badge">
            📍 {topP1.station_id.replace('STN_', '')}
          </span>
          <span className="safety-text-snippet">
            {hitNames ? <strong className="safety-hit-prefix">[{hitNames}] </strong> : ''}
            "{topP1.raw_text.length > 90 ? `${topP1.raw_text.substring(0, 90)}...` : topP1.raw_text}"
          </span>
        </div>
      </div>

      <div className="safety-banner-actions">
        <button
          className="btn btn-primary safety-jump-btn"
          onClick={() => onJumpToCard(topP1.id)}
          title="Scroll to ticket"
        >
          <span>INSPECT NOW</span>
          <ArrowRight size={13} />
        </button>
        <button
          onClick={onDismiss}
          className="safety-dismiss-btn"
          title="Dismiss banner"
          aria-label="Dismiss banner"
        >
          <X size={16} />
        </button>
      </div>
    </aside>
  );
};
