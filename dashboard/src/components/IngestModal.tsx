import React, { useState } from 'react';
import { X, Zap, Camera } from 'lucide-react';
import { IngestChannel } from '../types';

interface IngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    station_id: string;
    channel: IngestChannel;
    raw_text: string;
  }) => Promise<void>;
}

const TEST_SCENARIOS = [
  {
    label: '🚨 Gujarati Fire Hazard (આગ)',
    text: 'પ્લેટફોર્મ 2 પર ટ્રેક પાસે વાયરમાંથી મોટો ધુમાડો અને આગ નીકળે છે, તાત્કાલિક ગાડી રોકો!',
    channel: 'app' as IngestChannel,
    station: 'STN_PALDI',
  },
  {
    label: '🛗 Gujlish Lift Failure (bandh chhe)',
    text: 'Platform 1 ni lift bandh chhe ane wheelchair sathe elderly passengers atkayela chhiye, koi staff nathi.',
    channel: 'app' as IngestChannel,
    station: 'STN_KALUPUR',
  },
  {
    label: '💳 Hindi Fare Deduction (कार्ड रिचार्ज)',
    text: 'मेट्रो स्मार्ट कार्ड ऑनलाइन रिचार्ज किया 500 रुपये कट गए पर गेट पर कार्ड इनवैलिड दिखा रहा है।',
    channel: 'social' as IngestChannel,
    station: 'STN_CENTRAL',
  },
  {
    label: '🧹 Gujarati Paper OCR Scan (શૌચાલય)',
    text: 'સ્ટેશન પર પીવાનું પાણી ગંદુ આવે છે અને ગેટ 1 નું શૌચાલય તૂટેલું છે કચરો ફેલાયેલો છે.',
    channel: 'paper' as IngestChannel,
    station: 'STN_APMC',
  },
  {
    label: '👮 English Staff Conduct',
    text: 'The security staff at baggage scanner near Concourse East was shouting aggressively at passengers.',
    channel: 'email' as IngestChannel,
    station: 'STN_THALTEJ',
  },
];

export const IngestModal: React.FC<IngestModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [stationId, setStationId] = useState('STN_PALDI');
  const [channel, setChannel] = useState<IngestChannel>('app');
  const [rawText, setRawText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSelectScenario = (scen: typeof TEST_SCENARIOS[0]) => {
    setRawText(scen.text);
    setChannel(scen.channel);
    setStationId(scen.station);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) return;

    setIsSubmitting(true);
    await onSubmit({
      station_id: stationId,
      channel,
      raw_text: rawText.trim(),
    });
    setIsSubmitting(false);
    setRawText('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">+ Ingest Passenger Grievance / OCR Form</div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Quick Test Chips */}
            <div>
              <div className="form-label" style={{ marginBottom: '0.4rem' }}>
                Quick Test Scenarios (Gujarati, Hindi, English, Gujlish):
              </div>
              <div className="chips-row">
                {TEST_SCENARIOS.map((scen, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="scenario-chip"
                    onClick={() => handleSelectScenario(scen)}
                  >
                    {scen.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Station & Channel selectors */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Station ID:</label>
                <select
                  className="input-select"
                  value={stationId}
                  onChange={(e) => setStationId(e.target.value)}
                >
                  <option value="STN_PALDI">STN_PALDI (Paldi)</option>
                  <option value="STN_KALUPUR">STN_KALUPUR (Kalupur)</option>
                  <option value="STN_CENTRAL">STN_CENTRAL (Old High Court)</option>
                  <option value="STN_APMC">STN_APMC (APMC)</option>
                  <option value="STN_THALTEJ">STN_THALTEJ (Thaltej)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Ingest Channel:</label>
                <select
                  className="input-select"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as IngestChannel)}
                >
                  <option value="app">Mobile App (API)</option>
                  <option value="social">Social Media (X / Twitter)</option>
                  <option value="email">Passenger Email (.eml)</option>
                  <option value="paper">Paper Grievance Form (Camera OCR)</option>
                </select>
              </div>
            </div>

            {channel === 'paper' && (
              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  color: '#38bdf8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <Camera size={16} />
                <span>Simulating on-device Multilingual OCR digitization (Tesseract Gujarati + ML Kit Devanagari/Latin)</span>
              </div>
            )}

            {/* Complaint Text */}
            <div className="form-group">
              <label className="form-label">
                Complaint Raw Text (Accepts Gujarati, Hindi, English, Gujlish):
              </label>
              <textarea
                className="form-textarea"
                rows={4}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Type or paste passenger grievance..."
                required
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || !rawText.trim()}
            >
              <Zap size={14} />
              Ingest &amp; Triage Immediately
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
