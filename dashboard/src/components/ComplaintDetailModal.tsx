import React, { useState, useEffect } from 'react';
import { X, ArrowRight } from 'lucide-react';
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

  useEffect(() => {
    if (complaint) {
      setSelectedDept(complaint.dept_primary);
      setSelectedPriority(complaint.priority);
      setReplyText(complaint.reply_draft || '');
    }
  }, [complaint]);

  if (!complaint) return null;

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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Human-in-the-Loop Override &bull; Audit Trail</div>
            <div style={{ fontSize: '0.72rem', fontFamily: 'JetBrains Mono', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              ID: {complaint.id} &bull; NODE: {complaint.station_id}
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Raw Text Box */}
          <div className="form-group">
            <label className="form-label">Passenger Original Text (Immutable Record):</label>
            <div
              style={{
                background: 'var(--bg-box)',
                border: '1px solid var(--border-medium)',
                borderRadius: '8px',
                padding: '1rem',
                fontSize: '0.94rem',
                color: 'var(--text-primary)',
                lineHeight: 1.5,
              }}
            >
              "{complaint.raw_text}"
            </div>
          </div>

          {/* Department & Priority Overrides */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Department Classification:</label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <select
                  className="input-select"
                  style={{ flex: 1 }}
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value as Department)}
                >
                  <option value="safety">SAFETY &amp; SECURITY</option>
                  <option value="cleanliness">CLEANLINESS</option>
                  <option value="lifts_escalators">LIFTS &amp; ESCALATORS</option>
                  <option value="fare">FARE &amp; AFC CARDS</option>
                  <option value="staff_behaviour">STAFF CONDUCT</option>
                  <option value="other">GENERAL / OTHER</option>
                </select>
                {selectedDept !== complaint.dept_primary && (
                  <button
                    className="btn btn-primary"
                    style={{ padding: '0.4rem 0.65rem' }}
                    onClick={handleOverrideDept}
                    disabled={isSaving}
                  >
                    SAVE
                  </button>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Priority Level:</label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <select
                  className="input-select"
                  style={{ flex: 1 }}
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value as PriorityLevel)}
                >
                  <option value="P1">P1 (CRITICAL &ge;80)</option>
                  <option value="P2">P2 (SERVICE IMPACT)</option>
                  <option value="P3">P3 (ROUTINE)</option>
                  <option value="REVIEW">REVIEW (UNCERTAIN)</option>
                </select>
                {selectedPriority !== complaint.priority && (
                  <button
                    className="btn btn-primary"
                    style={{ padding: '0.4rem 0.65rem' }}
                    onClick={handleOverridePriority}
                    disabled={isSaving}
                  >
                    SAVE
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Legal Guardrail Box */}
          <div className="legal-box">
            <strong style={{ color: 'var(--text-primary)', textTransform: 'uppercase', fontFamily: 'JetBrains Mono', display: 'block', marginBottom: '0.2rem' }}>
              Operational Legal Guardrail (TRD 5.4)
            </strong>
            Replies must acknowledge action without admitting civil liability or guaranteeing financial refunds without supervisor approval.
          </div>

          {/* Draft Reply Editor */}
          <div className="form-group">
            <label className="form-label">
              Draft Passenger Response ({complaint.reply_lang.toUpperCase()}):
            </label>
            <textarea
              className="form-textarea"
              rows={4}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Edit draft response..."
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            className="btn btn-success"
            onClick={handleApprove}
            disabled={isSaving || !replyText.trim()}
          >
            <span>APPROVE &amp; DISPATCH</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};
