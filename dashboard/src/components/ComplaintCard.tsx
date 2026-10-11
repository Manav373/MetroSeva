import React, { useState } from 'react';
import { 
  ArrowUpRight, 
  Check, 
  AlertOctagon, 
  AlertTriangle,
  Copy, 
  CheckCheck, 
  Smartphone, 
  Share2, 
  Mail, 
  FileText,
  MapPin,
  Clock,
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import { Complaint, IngestChannel } from '../types';
import { formatTime, formatRelativeTime } from '../utils/dateUtils';

interface ComplaintCardProps {
  complaint: Complaint;
  onOpenReview: (complaint: Complaint) => void;
  onApproveReply: (id: string) => void;
  isApproving: boolean;
  onFilterStation?: (stationId: string) => void;
  onFilterDept?: (dept: string) => void;
}

const CHANNEL_ICONS: Record<IngestChannel, React.ReactNode> = {
  app: <Smartphone size={13} />,
  social: <Share2 size={13} />,
  email: <Mail size={13} />,
  paper: <FileText size={13} />,
};

const LANG_LABEL_MAP: Record<string, { label: string; script: string }> = {
  gu: { label: 'ગુજરાતી', script: 'Gujarati' },
  hi: { label: 'हिंदी', script: 'Hindi' },
  'gu-latn': { label: 'Gujlish', script: 'Latin-Gujarati' },
  en: { label: 'English', script: 'English' },
};

export const ComplaintCard: React.FC<ComplaintCardProps> = ({
  complaint,
  onOpenReview,
  onApproveReply,
  isApproving,
  onFilterStation,
  onFilterDept,
}) => {
  const [showNormalised, setShowNormalised] = useState(false);
  const [copiedDraft, setCopiedDraft] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (complaint.reply_draft) {
      navigator.clipboard.writeText(complaint.reply_draft);
      setCopiedDraft(true);
      setTimeout(() => setCopiedDraft(false), 2000);
    }
  };

  const isP1 = complaint.priority === 'P1';
  const isP2 = complaint.priority === 'P2';
  const urgencyColor =
    complaint.urgency >= 80 ? 'var(--signal-red)' : complaint.urgency >= 50 ? 'var(--signal-amber)' : 'var(--accent-light)';

  const langInfo = LANG_LABEL_MAP[complaint.reply_lang] || { label: complaint.reply_lang.toUpperCase(), script: '' };
  const isPendingOutbox = complaint.sync_state === 'pending';

  return (
    <article
      className={`complaint-card ${isP1 ? 'p1-card' : isP2 ? 'p2-card' : ''}`}
      id={`card-${complaint.id}`}
    >
      {/* 1. Header Metadata Bar */}
      <div className="card-top">
        <div className="card-badges">
          {/* Priority Pill */}
          <span className={`badge-pill badge-${complaint.priority.toLowerCase()}`}>
            {isP1 ? <AlertOctagon size={13} className="badge-icon" /> : isP2 ? <AlertTriangle size={13} className="badge-icon" /> : null}
            {complaint.priority} {isP1 ? 'CRITICAL' : ''}
          </span>

          {/* Station Pill */}
          <button 
            type="button"
            className="station-pill clickable-pill"
            onClick={() => onFilterStation && onFilterStation(complaint.station_id)}
            title={`Filter by ${complaint.station_id}`}
          >
            <MapPin size={12} className="pin-icon" />
            <span>{complaint.station_id.replace('STN_', '')}</span>
          </button>

          {/* Channel Pill */}
          <span className="channel-pill">
            {CHANNEL_ICONS[complaint.channel] || null}
            <span>{complaint.channel.toUpperCase()}</span>
          </span>

          {/* Language Pill */}
          <span className="lang-pill" title={langInfo.script}>
            <span>{langInfo.label}</span>
          </span>

          {/* Outbox Sync Tag */}
          {isPendingOutbox && (
            <span className="outbox-queued-tag">
              <Clock size={11} />
              <span>OUTBOX</span>
            </span>
          )}
        </div>

        {/* Urgency Progress Gauge */}
        <div className="urgency-gauge">
          <span className="gauge-score-label">Urgency {complaint.urgency}/100</span>
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

      {/* 2. Main Grievance Text Display */}
      <div className="complaint-body-wrap">
        <div className="complaint-body-text">
          "{complaint.raw_text}"
        </div>

        {/* Code-Mixed Normalization Drawer */}
        {complaint.normalised && complaint.normalised !== complaint.raw_text && (
          <div style={{ marginTop: '0.65rem' }}>
            <button
              onClick={() => setShowNormalised(!showNormalised)}
              className="norm-toggle-btn"
            >
              <Sparkles size={12} />
              <span>{showNormalised ? 'Hide NLP Tokens' : 'View Code-Mixed NLP Tokens'}</span>
            </button>
            {showNormalised && (
              <div className="norm-toggle-text">
                <span className="norm-title">Normalized Tokens:</span>
                <code>{complaint.normalised}</code>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Deterministic Safety Hits Tags */}
      {complaint.safety_hits && complaint.safety_hits.length > 0 && (
        <div className="safety-tags-container">
          {complaint.safety_hits.map((hit, idx) => {
            const hitId = typeof hit === 'string' ? hit : hit.id || 'SAFETY_RULE';
            const desc = typeof hit === 'object' ? hit.description : undefined;
            return (
              <span key={idx} className="safety-tag-item">
                <ShieldAlert size={12} />
                <span>{hitId}</span>
                {desc && <span className="safety-desc">&bull; {desc}</span>}
              </span>
            );
          })}
        </div>
      )}

      {/* 4. Classification & Routing Meta Row */}
      <div className="card-dept-meta-row">
        <div className="meta-item">
          <span className="meta-label">Routing Dept:</span>
          <strong 
            className="clickable-dept"
            onClick={() => onFilterDept && onFilterDept(complaint.dept_primary)}
            title={`Filter by ${complaint.dept_primary}`}
          >
            {complaint.dept_primary.replace(/_/g, ' ').toUpperCase()}
          </strong>
        </div>

        {complaint.dept_secondary && (
          <div className="meta-item">
            <span className="meta-label">Secondary:</span>
            <strong>{complaint.dept_secondary.replace(/_/g, ' ').toUpperCase()}</strong>
          </div>
        )}

        <div className="meta-item">
          <span className="meta-label">Confidence:</span>
          <span className="conf-badge">
            {Math.round(complaint.dept_conf * 100)}%
          </span>
        </div>
      </div>

      {/* 5. AI Draft Passenger Reply */}
      <div className="draft-reply-box">
        <div className="draft-reply-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={13} className="reply-sparkle-icon" />
            <span>AI Draft Response ({complaint.reply_lang.toUpperCase()})</span>
            <button 
              type="button" 
              className="copy-draft-btn"
              onClick={handleCopy}
              title="Copy response text"
            >
              {copiedDraft ? <CheckCheck size={12} color="var(--signal-green)" /> : <Copy size={12} />}
              <span>{copiedDraft ? 'COPIED' : 'COPY'}</span>
            </button>
          </div>
          <span className={`status-pill ${complaint.reply_status === 'approved' ? 'approved' : 'draft'}`}>
            &bull; {complaint.reply_status.toUpperCase()}
          </span>
        </div>
        <div className="draft-reply-text">
          "{complaint.reply_draft || 'Generating verified safe draft response...'}"
        </div>
      </div>

      {/* 6. Card Footer with Action Buttons */}
      <div className="card-footer">
        <div className="meta-timestamp">
          <span>Received {formatTime(complaint.created_at)} ({formatRelativeTime(complaint.created_at)})</span>
          <span className="ticket-id-tag">ID: {complaint.id.substring(0, 10)}</span>
        </div>

        <div className="card-actions-row">
          <button
            className="btn btn-outline btn-mobile-action"
            onClick={() => onOpenReview(complaint)}
          >
            <span>EDIT / OVERRIDE</span>
            <ArrowUpRight size={14} />
          </button>

          {complaint.reply_status === 'approved' ? (
            <div className="approved-dispatched-box">
              <Check size={16} />
              <span>DISPATCHED TO PASSENGER</span>
            </div>
          ) : (
            <button
              className="btn btn-success btn-mobile-action"
              onClick={() => onApproveReply(complaint.id)}
              disabled={isApproving}
            >
              <Check size={16} />
              <span>APPROVE &amp; SEND</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
