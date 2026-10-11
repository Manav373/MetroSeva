import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Send, 
  MapPin, 
  Radio 
} from 'lucide-react';
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
    tag: 'GUJARATI',
    label: '🚨 Fire / Smoke on Track',
    text: 'પ્લેટફોર્મ 2 પર ટ્રેક પાસે વાયરમાંથી મોટો ધુમાડો અને આગ નીકળે છે, તાત્કાલિક ગાડી રોકો!',
    channel: 'app' as IngestChannel,
    station: 'STN_PALDI',
  },
  {
    tag: 'GUJLISH',
    label: '🛗 Lift Failure (Wheelchair)',
    text: 'Platform 1 ni lift bandh chhe ane wheelchair sathe elderly passengers atkayela chhiye, koi staff nathi.',
    channel: 'app' as IngestChannel,
    station: 'STN_KALUPUR',
  },
  {
    tag: 'HINDI',
    label: '💳 Smart Card Debit Issue',
    text: 'मेट्रो स्मार्ट कार्ड ऑनलाइन 500 रुपये रिचार्ज किया पैसे कट गए पर गेट पर कार्ड इनवैलिड दिखा रहा है।',
    channel: 'social' as IngestChannel,
    station: 'STN_CENTRAL',
  },
  {
    tag: 'GUJARATI',
    label: '🧹 Washroom Hygiene (OCR)',
    text: 'સ્ટેશન પર પીવાનું પાણી ગંદુ આવે છે અને ગેટ 1 નું શૌચાલય તૂટેલું છે કચરો ફેલાયેલો છે.',
    channel: 'paper' as IngestChannel,
    station: 'STN_APMC',
  },
  {
    tag: 'ENGLISH',
    label: '👮 Security Scanner Conduct',
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
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-header-info">
            <div className="modal-title">Live Grievance Ingestion Studio</div>
            <div className="modal-subtitle">
              Sub-second on-device code-mixed NLP classifier &amp; deterministic safety triage
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Quick Test Chips Section */}
            <div>
              <div className="form-label-row" style={{ marginBottom: '0.65rem' }}>
                <span className="form-label">
                  <Sparkles size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  One-Click Test Scenarios (Multilingual):
                </span>
              </div>
              <div className="chips-row">
                {TEST_SCENARIOS.map((scen, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`scenario-chip ${rawText === scen.text ? 'active' : ''}`}
                    onClick={() => handleSelectScenario(scen)}
                  >
                    <span className="scenario-tag-lang">{scen.tag}</span>
                    <span className="scenario-label-text">{scen.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Station & Channel Selectors Grid */}
            <div className="override-grid">
              <div className="form-group">
                <label className="form-label">
                  <MapPin size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  Station Ingestion Node:
                </label>
                <select
                  className="input-select"
                  value={stationId}
                  onChange={(e) => setStationId(e.target.value)}
                >
                  <option value="STN_PALDI">STN_PALDI — Paldi Station</option>
                  <option value="STN_KALUPUR">STN_KALUPUR — Kalupur Junction</option>
                  <option value="STN_CENTRAL">STN_CENTRAL — Central (High Court)</option>
                  <option value="STN_APMC">STN_APMC — APMC Depot</option>
                  <option value="STN_THALTEJ">STN_THALTEJ — Thaltej Terminus</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <Radio size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  Grievance Source Channel:
                </label>
                <select
                  className="input-select"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as IngestChannel)}
                >
                  <option value="app">Mobile App (REST Ingest API)</option>
                  <option value="social">Social Feeds (X Batch Scrape)</option>
                  <option value="email">Passenger Email (.eml Relay)</option>
                  <option value="paper">Paper Grievance Form (Vision OCR)</option>
                </select>
              </div>
            </div>

            {/* Raw Grievance Input */}
            <div className="form-group">
              <div className="form-label-row">
                <label className="form-label">Raw Grievance String (Multilingual):</label>
                <span className="char-count-text">{rawText.length} chars</span>
              </div>
              <textarea
                className="form-textarea"
                rows={4}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Enter grievance text in Gujarati, Hindi, Gujlish, or English..."
                required
              />
            </div>
          </div>

          {/* Modal Footer */}
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
              <Send size={15} />
              <span>{isSubmitting ? 'TRIAGING...' : 'TRIAGE & DISPATCH'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
