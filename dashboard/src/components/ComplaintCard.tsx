import React, { useState } from 'react';
import { ArrowUpRight, Check, AlertOctagon } from 'lucide-react';
import { Complaint } from '../types';
import { formatTime, formatRelativeTime } from '../utils/dateUtils';

interface ComplaintCardProps {
  complaint: Complaint;
  onOpenReview: (complaint: Complaint) => void;
  onApproveReply: (id: string) => void;
  isApproving: boolean;
}

export const ComplaintCard: React.FC<ComplaintCardProps> = ({
  complaint,
  onOpenReview,
  onApproveReply,
  isApproving,
}) => {
  const [showNormalised, setShowNormalised] = useState(false);

  const isP1 = complaint.priority === 'P1';
  const urgencyColor =
    complaint.urgency >= 80 ? '#ef4444' : complaint.urgency >= 50 ? '#f59e0b' : '#3b82f6';

  const langLabelMap: Record<string, string> = {
    gu: 'ગુજરાતી (gu)',
    hi: 'हिंदी (hi)',
    'gu-latn': 'Gujlish (gu-latn)',
    en: 'English (en)',
  };

  const isPendingOutbox = complaint.sync_state === 'pending';

  return (
    <article
      className={`complaint-card ${isP1 ? 'p1-card' : ''}`}
      id={`card-${complaint.id}`}
    >
      {/* Top Metadata Row */}
      <div className="card-top">
        <div className="card-badges">
          <span className={`badge-pill badge-${complaint.priority.toLowerCase()}`}>
            {isP1 && <AlertOctagon size={14} className="badge-icon" />}
            {complaint.priority} {isP1 ? 'CRITICAL' : ''}
          </span>
          <span className="station-pill">
            📍 {complaint.station_id.replace('STN_', '')}
          </span>
          <span className="channel-pill">
            {complaint.channel.toUpperCase()}
          </span>
          <span className="lang-pill">
            {langLabelMap[complaint.reply_lang] || complaint.reply_lang.toUpperCase()}
          </span>
          {isPendingOutbox && (
            <span className="outbox-queued-tag">
              OUTBOX
            </span>
          )}
        </div>

        <div className="urgency-gauge">
          <span className="gauge-score-label">{complaint.urgency}/100</span>
          <div className="gauge-track">
            <div
              className="gauge-fill"
              style={{
                width: `${complaint.urgency}%`,
                backgroundColor: urgencyColor,
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Passenger Grievance Text - BOLD, LARGE, HIGH-CONTRAST FOR PHONES */}
      <div className="complaint-body-wrap">
        <div className="complaint-body-text">
          "{complaint.raw_text}"
        </div>

        {complaint.normalised && complaint.normalised !== complaint.raw_text && (
          <div style={{ marginTop: '0.65rem' }}>
            <button
              onClick={() => setShowNormalised(!showNormalised)}
              className="norm-toggle-btn"
            >
              {showNormalised ? '[ - Hide Gujlish Tokens ]' : '[ + View Gujlish Normalization ]'}
            </button>
            {showNormalised && (
              <div className="norm-toggle-text">
                Cleaned Tokens: <code>{complaint.normalised}</code>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Deterministic Safety Hits Tags */}
      {complaint.safety_hits && complaint.safety_hits.length > 0 && (
        <div className="safety-tags-container">
          {complaint.safety_hits.map((hit, idx) => {
            const hitId = typeof hit === 'string' ? hit : hit.id || 'SAFETY_RULE';
            const desc = typeof hit === 'object' ? hit.description : undefined;
            return (
              <span key={idx} className="safety-tag-item">
                <span>🚨 {hitId}</span>
                {desc && <span className="safety-desc">({desc})</span>}
              </span>
            );
          })}
        </div>
      )}

      {/* Classification Meta Pills */}
      <div className="card-dept-meta-row">
        <span>
          Department: <strong>{complaint.dept_primary.replace('_', ' ').toUpperCase()}</strong>
        </span>
        {complaint.dept_secondary && (
          <span>
            Secondary: <strong>{complaint.dept_secondary.replace('_', ' ').toUpperCase()}</strong>
          </span>
        )}
        <span>
          Confidence: <strong>{Math.round(complaint.dept_conf * 100)}%</strong>
        </span>
      </div>

      {/* AI Draft Reply Box */}
      <div className="draft-reply-box">
        <div className="draft-reply-header">
          <span>AI DRAFT RESPONSE ({complaint.reply_lang.toUpperCase()})</span>
          <span className={`status-pill ${complaint.reply_status === 'approved' ? 'approved' : 'draft'}`}>
            &bull; {complaint.reply_status.toUpperCase()}
          </span>
        </div>
        <div className="draft-reply-text">
          "{complaint.reply_draft || 'Generating draft response...'}"
        </div>
      </div>

      {/* Card Footer Actions: BIG, THUMB-FRIENDLY FULL-WIDTH BUTTONS */}
      <div className="card-footer">
        <div className="meta-timestamp">
          Received: {formatTime(complaint.created_at)} &bull; {formatRelativeTime(complaint.created_at)} &bull; ID: <code>{complaint.id.substring(0, 12)}</code>
        </div>

        <div className="card-actions-row">
          <button
            className="btn btn-outline btn-mobile-action"
            onClick={() => onOpenReview(complaint)}
          >
            <span>EDIT / OVERRIDE</span>
            <ArrowUpRight size={15} />
          </button>

          {complaint.reply_status === 'approved' ? (
            <div className="approved-dispatched-box">
              <Check size={18} />
              <span>APPROVED &amp; SENT</span>
            </div>
          ) : (
            <button
              className="btn btn-success btn-mobile-action"
              onClick={() => onApproveReply(complaint.id)}
              disabled={isApproving}
            >
              <Check size={18} />
              <span>APPROVE DISPATCH</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
