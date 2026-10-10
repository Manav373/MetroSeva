import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Save, Send } from 'lucide-react';
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
            <div className="modal-title">Complaint Review &amp; Human-in-the-Loop Override</div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Ticket: <code>{complaint.id}</code> · Station: <strong>{complaint.station_id}</strong>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Raw Text Box */}
          <div className="form-group">
            <label className="form-label">Passenger Original Complaint (Raw Text — Immutable):</label>
            <div
              style={{
                background: '#090d16',
                border: '1px solid #334155',
                padding: '0.85rem',
                borderRadius: '6px',
                fontSize: '0.92rem',
                color: '#f8fafc',
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
                  <option value="safety">🚨 Safety & Security</option>
                  <option value="cleanliness">🧹 Cleanliness & Hygiene</option>
                  <option value="lifts_escalators">🛗 Lifts & Escalators</option>
                  <option value="fare">💳 Fare & Smart Cards</option>
                  <option value="staff_behaviour">👮 Staff Behaviour</option>
                  <option value="other">ℹ️ Other / General</option>
                </select>
                {selectedDept !== complaint.dept_primary && (
                  <button
                    className="btn btn-primary"
                    style={{ padding: '0.4rem 0.65rem' }}
                    onClick={handleOverrideDept}
                    disabled={isSaving}
                    title="Log Department correction for model active learning"
                  >
                    <Save size={14} />
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
                  <option value="P1">P1 (Safety Critical &ge;80)</option>
                  <option value="P2">P2 (Service Impacting 50-79)</option>
                  <option value="P3">P3 (Routine &lt;50)</option>
                  <option value="REVIEW">REVIEW (Human Review)</option>
                </select>
                {selectedPriority !== complaint.priority && (
                  <button
                    className="btn btn-primary"
                    style={{ padding: '0.4rem 0.65rem' }}
                    onClick={handleOverridePriority}
                    disabled={isSaving}
                    title="Log Priority adjustment"
                  >
                    <Save size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Legal Guardrail Box */}
          <div className="legal-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, marginBottom: '0.2rem' }}>
              <AlertCircle size={15} /> Operational Legal Guardrail (TRD Section 5.4)
            </div>
            Replies must acknowledge and dispatch action without admitting legal liability or guaranteeing financial refunds/reimbursements without supervisor sign-off.
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
              placeholder="Enter edited response in complainant's language..."
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
            <Send size={14} />
            Approve &amp; Dispatch Reply
          </button>
        </div>
      </div>
    </div>
  );
};
