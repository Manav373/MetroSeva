import React, { useState } from 'react';
import { CheckCircle2, Edit3, ShieldAlert, Sparkles, FileText } from 'lucide-react';
import { Complaint } from '../types';

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
    complaint.urgency >= 80 ? '#ef4444' : complaint.urgency >= 50 ? '#f59e0b' : '#38bdf8';

  const langLabelMap: Record<string, { label: string; class: string }> = {
    gu: { label: 'ગુજરાતી (gu)', class: 'gu' },
    hi: { label: 'हिंदी (hi)', class: 'hi' },
    'gu-latn': { label: 'Gujlish (gu-latn)', class: 'gu-latn' },
    en: { label: 'English (en)', class: 'en' },
  };

  const langInfo = langLabelMap[complaint.reply_lang] || {
    label: complaint.reply_lang,
    class: 'en',
  };

  const isPendingOutbox = complaint.sync_state === 'pending';

  return (
    <div
      className={`complaint-card ${isP1 ? 'p1-card' : ''}`}
      id={`card-${complaint.id}`}
    >
      {/* Top Bar */}
      <div className="card-top">
        <div className="card-badges">
          <span className={`badge-pill badge-${complaint.priority.toLowerCase()}`}>
            {complaint.priority}
          </span>
          <span className="station-pill">📍 {complaint.station_id}</span>
          <span className="channel-pill">
            Channel: {complaint.channel.toUpperCase()}
          </span>
          <span className={`lang-pill ${langInfo.class}`}>{langInfo.label}</span>
          {isPendingOutbox && (
            <span
              style={{
                background: '#f59e0b',
                color: '#0f172a',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '0.15rem 0.5rem',
                borderRadius: '4px',
              }}
            >
              ⏳ Local Outbox
            </span>
          )}
          {complaint.raw_image_ref && (
            <span
              style={{
                background: '#475569',
                color: '#fff',
                fontSize: '0.72rem',
                padding: '0.15rem 0.45rem',
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <FileText size={12} /> Paper Scan
            </span>
          )}
        </div>

        <div className="urgency-gauge">
          <span>Urgency: {complaint.urgency}/100</span>
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

      {/* Complaint Body */}
      <div>
        <div className="complaint-body-text">
          "{complaint.raw_text}"
        </div>

        {complaint.normalised && complaint.normalised !== complaint.raw_text && (
          <div style={{ marginTop: '0.35rem' }}>
            <button
              onClick={() => setShowNormalised(!showNormalised)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#60a5fa',
                fontSize: '0.75rem',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              {showNormalised ? 'Hide Gujlish Canonical Normalization' : 'Show Gujlish Canonical Normalization'}
            </button>
            {showNormalised && (
              <div className="norm-toggle-text">
                Cleaned Tokens: <code>{complaint.normalised}</code>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Safety Alert Tags */}
      {complaint.safety_hits && complaint.safety_hits.length > 0 && (
        <div className="safety-tags-container">
          {complaint.safety_hits.map((hit, idx) => {
            const hitId = typeof hit === 'string' ? hit : hit.id || 'SAFETY_RULE';
            const desc = typeof hit === 'object' ? hit.description : undefined;
            return (
              <span key={idx} className="safety-tag-item">
                <ShieldAlert size={13} />
                {hitId} {desc ? `— ${desc}` : ''}
              </span>
            );
          })}
        </div>
      )}

      {/* Classification Meta */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          fontSize: '0.78rem',
          color: '#94a3b8',
          background: 'rgba(0,0,0,0.2)',
          padding: '0.4rem 0.6rem',
          borderRadius: '6px',
        }}
      >
        <span>
          Primary: <strong style={{ color: '#fff', textTransform: 'capitalize' }}>{complaint.dept_primary.replace('_', ' ')}</strong>
        </span>
        {complaint.dept_secondary && (
          <span>
            Secondary: <strong style={{ color: '#cbd5e1', textTransform: 'capitalize' }}>{complaint.dept_secondary.replace('_', ' ')}</strong>
          </span>
        )}
        <span>
          Confidence: <strong>{Math.round(complaint.dept_conf * 100)}%</strong>
        </span>
        {complaint.model_version && (
          <span style={{ marginLeft: 'auto', color: '#64748b' }}>
            Model: {complaint.model_version}
          </span>
        )}
      </div>

      {/* Draft Reply Box */}
      <div className="draft-reply-box">
        <div className="draft-reply-header">
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Sparkles size={13} color="#a855f7" /> Draft Reply ({langInfo.label})
          </span>
          <span
            style={{
              color: complaint.reply_status === 'approved' ? '#10b981' : '#94a3b8',
              fontWeight: 700,
            }}
          >
            Status: {complaint.reply_status.toUpperCase()}
          </span>
        </div>
        <div className="draft-reply-text">
          "{complaint.reply_draft || 'Generating draft reply...'}"
        </div>
      </div>

      {/* Footer & Actions */}
      <div className="card-footer">
        <span className="meta-timestamp">
          Received: {new Date(complaint.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ID: <code>{complaint.id}</code>
        </span>

        <div className="card-actions-row">
          <button
            className="btn btn-outline"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
            onClick={() => onOpenReview(complaint)}
          >
            <Edit3 size={13} />
            Review / Override
          </button>

          {complaint.reply_status === 'approved' ? (
            <span
              style={{
                color: '#10b981',
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.4rem 0.6rem',
              }}
            >
              <CheckCircle2 size={15} /> Dispatched
            </span>
          ) : (
            <button
              className="btn btn-success"
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
              onClick={() => onApproveReply(complaint.id)}
              disabled={isApproving}
            >
              <CheckCircle2 size={14} />
              Approve Draft
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
