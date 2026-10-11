import React, { useState, useEffect } from 'react';
import { 
  X, 
  FileText, 
  Check, 
  Info,
  Copy,
  CheckCheck
} from 'lucide-react';
import { Complaint, Department, PriorityLevel } from '../types';

interface ComplaintDetailModalProps {
  complaint: Complaint | null;
  onClose: () => void;
  onSaveOverride: (
    complaintId: string,
    field: string,
    newValue: string
  ) => Promise<void>;
  onApproveCustomReply: (
    complaintId: string,
    replyText: string
  ) => Promise<void>;
}

export const ComplaintDetailModal: React.FC<ComplaintDetailModalProps> = ({
  complaint,
  onClose,
  onSaveOverride,
  onApproveCustomReply,
}) => {
  const [selectedDept, setSelectedDept] = useState<Department>('other');
  const [selectedPriority, setSelectedPriority] = useState<PriorityLevel>('P3');
  const [replyText, setReplyText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [copiedDraft, setCopiedDraft] = useState(false);

  useEffect(() => {
    if (complaint) {
      setSelectedDept(complaint.dept_primary);
      setSelectedPriority(complaint.priority);
      setReplyText(complaint.reply_draft || '');
    }
  }, [complaint]);

  if (!complaint) return null;

  const handleCopy = () => {
    if (replyText) {
      navigator.clipboard.writeText(replyText);
      setCopiedDraft(true);
      setTimeout(() => setCopiedDraft(false), 2000);
    }
  };

  const handleOverrideDept = async () => {
    if (selectedDept === complaint.dept_primary) return;
    setIsSaving(true);
    await onSaveOverride(complaint.id, 'dept_primary', selectedDept);
    setIsSaving(false);
  };

  const handleOverridePriority = async () => {
    if (selectedPriority === complaint.priority) return;
    setIsSaving(true);
    await onSaveOverride(complaint.id, 'priority', selectedPriority);
    setIsSaving(false);
  };

  const handleApprove = async () => {
    setIsSaving(true);
    await onApproveCustomReply(complaint.id, replyText);
    setIsSaving(false);
    onClose();
  };

  const hasDeptChanged = selectedDept !== complaint.dept_primary;
  const hasPriorityChanged = selectedPriority !== complaint.priority;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-header-info">
            <div className="modal-title">Controller Override &amp; Review Studio</div>
            <div className="modal-subtitle">
              <span>Ticket: <code>{complaint.id}</code></span>
              <span>&bull;</span>
              <span>Station: <strong>{complaint.station_id.replace('STN_', '')}</strong></span>
              <span>&bull;</span>
              <span>Channel: <strong>{complaint.channel.toUpperCase()}</strong></span>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* Passenger Original Grievance Text */}
          <div className="form-group">
            <div className="form-label-row">
              <span className="form-label">Passenger Original Text (Immutable Log)</span>
              <span className="meta-badge-small">{complaint.reply_lang.toUpperCase()}</span>
            </div>
            <div className="raw-complaint-box">
              <FileText size={16} className="raw-box-icon" />
              <div className="raw-box-text">"{complaint.raw_text}"</div>
            </div>
          </div>

          {/* Classification Overrides Grid */}
          <div className="override-grid">
            {/* Department Override */}
            <div className="form-group">
              <div className="form-label-row">
                <span className="form-label">Department Route</span>
                {hasDeptChanged && <span className="override-pending-tag">Changed</span>}
              </div>
              <div className="select-with-save">
                <select
                  className="input-select"
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value as Department)}
                >
                  <option value="safety">Safety &amp; Security</option>
                  <option value="cleanliness">Cleanliness &amp; Hygiene</option>
                  <option value="lifts_escalators">Lifts &amp; Escalators</option>
                  <option value="fare">Fare &amp; AFC Cards</option>
                  <option value="staff_behaviour">Staff Conduct</option>
                  <option value="other">General / Other</option>
                </select>
                {hasDeptChanged && (
                  <button
                    className="btn btn-primary btn-save-override"
                    onClick={handleOverrideDept}
                    disabled={isSaving}
                  >
                    <span>Save</span>
                  </button>
                )}
              </div>
            </div>

            {/* Priority Override */}
            <div className="form-group">
              <div className="form-label-row">
                <span className="form-label">Priority Severity</span>
                {hasPriorityChanged && <span className="override-pending-tag">Changed</span>}
              </div>
              <div className="select-with-save">
                <select
                  className="input-select"
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value as PriorityLevel)}
                >
                  <option value="P1">P1 Critical (Urgency &ge; 80)</option>
                  <option value="P2">P2 Medium Impact</option>
                  <option value="P3">P3 Routine</option>
                  <option value="REVIEW">Review (Uncertain)</option>
                </select>
                {hasPriorityChanged && (
                  <button
                    className="btn btn-primary btn-save-override"
                    onClick={handleOverridePriority}
                    disabled={isSaving}
                  >
                    <span>Save</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Legal Guardrail Box */}
          <div className="legal-box">
            <div className="legal-box-header">
              <Info size={14} color="var(--signal-amber)" />
              <strong>Operational Legal Guardrail (GMRC TRD 5.4)</strong>
            </div>
            <p>
              Passenger responses acknowledge received feedback without admitting legal liability or promising unverified financial compensation. Human overrides are recorded into the active retraining dataset.
            </p>
          </div>

          {/* Draft Reply Editor */}
          <div className="form-group">
            <div className="form-label-row">
              <span className="form-label">
                Passenger Response Draft ({complaint.reply_lang.toUpperCase()}):
              </span>
              <button
                type="button"
                className="copy-draft-btn"
                onClick={handleCopy}
                title="Copy text"
              >
                {copiedDraft ? <CheckCheck size={12} color="var(--signal-green)" /> : <Copy size={12} />}
                <span>{copiedDraft ? 'COPIED' : 'COPY'}</span>
              </button>
            </div>
            <textarea
              className="form-textarea"
              rows={4}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Edit response before dispatching..."
            />
            <div className="char-count-text">
              {replyText.length} characters &bull; Language: {complaint.reply_lang.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            className="btn btn-success"
            onClick={handleApprove}
            disabled={isSaving || !replyText.trim()}
          >
            <Check size={16} />
            <span>Approve &amp; Dispatch</span>
          </button>
        </div>
      </div>
    </div>
  );
};
