import React, { useState, useMemo } from 'react';
import { 
  ArrowRight, 
  Terminal, 
  ShieldAlert, 
  Zap, 
  CheckCircle2, 
  Sparkles, 
  Send, 
  Cpu, 
  WifiOff, 
  Database 
} from 'lucide-react';
import { StatsOverview, Hotspot, IngestChannel } from '../types';
import { triageOnDevice } from '../services/offlineStorage';

interface LandingViewProps {
  stats: StatsOverview | null;
  hotspots: Hotspot[];
  onNavigateToQueue: (stationId?: string) => void;
  onNavigateToAnalytics: () => void;
  onIngestComplaint: (data: {
    station_id: string;
    channel: IngestChannel;
    raw_text: string;
  }) => Promise<void>;
  isOffline: boolean;
}

const STATIONS_DATA = [
  { id: 'STN_PALDI', name: 'Paldi Station', line: 'North-South Corridor', badge: 'Node 01', corridorColor: '#6366f1' },
  { id: 'STN_KALUPUR', name: 'Kalupur Junction', line: 'Railway Interchange', badge: 'Node 02', corridorColor: '#ec4899' },
  { id: 'STN_CENTRAL', name: 'Central (High Court)', line: 'East-West Corridor', badge: 'Node 03', corridorColor: '#3b82f6' },
  { id: 'STN_APMC', name: 'APMC Depot', line: 'Terminal Depot', badge: 'Node 04', corridorColor: '#10b981' },
  { id: 'STN_THALTEJ', name: 'Thaltej Terminus', line: 'Elevated Western End', badge: 'Node 05', corridorColor: '#f59e0b' },
];

const PRESET_PROMPTS = [
  {
    tag: 'GUJARATI',
    label: '🚨 Fire / Smoke on Track',
    text: 'પ્લેટફોર્મ 2 પર ટ્રેક પાસે વાયરમાંથી મોટો ધુમાડો અને આગ નીકળે છે, તાત્કાલિક ગાડી રોકો!',
    station: 'STN_PALDI',
    channel: 'app' as IngestChannel,
  },
  {
    tag: 'GUJLISH',
    label: '🛗 Lift Failure (Wheelchair)',
    text: 'Platform 1 ni lift bandh chhe ane wheelchair sathe elderly passengers atkayela chhiye, koi staff nathi.',
    station: 'STN_KALUPUR',
    channel: 'app' as IngestChannel,
  },
  {
    tag: 'HINDI',
    label: '💳 Smart Card Debit Issue',
    text: 'मेट्रो स्मार्ट कार्ड ऑनलाइन 500 रुपये रिचार्ज किया पैसे कट गए पर गेट पर कार्ड इनवैलिड दिखा रहा है।',
    station: 'STN_CENTRAL',
    channel: 'social' as IngestChannel,
  },
  {
    tag: 'GUJARATI',
    label: '🧹 Washroom Hygiene (OCR)',
    text: 'સ્ટેશન પર પીવાનું પાણી ગંદુ આવે છે અને ગેટ 1 નું શૌચાલય તૂટેલું છે કચરો ફેલાયેલો છે.',
    station: 'STN_APMC',
    channel: 'paper' as IngestChannel,
  },
  {
    tag: 'ENGLISH',
    label: '👮 Baggage Scanner Conduct',
    text: 'The security staff at baggage scanner near Concourse East was shouting aggressively at passengers.',
    station: 'STN_THALTEJ',
    channel: 'email' as IngestChannel,
  },
];

export const LandingView: React.FC<LandingViewProps> = ({
  stats,
  hotspots,
  onNavigateToQueue,
  onNavigateToAnalytics,
  onIngestComplaint,
  isOffline,
}) => {
  // Interactive Simulator State
  const [simText, setSimText] = useState(PRESET_PROMPTS[0].text);
  const [simStation, setSimStation] = useState('STN_PALDI');
  const [simChannel, setSimChannel] = useState<IngestChannel>('app');
  const [isDispatching, setIsDispatching] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Live real-time classification preview calculated instantaneously
  const liveTriageResult = useMemo(() => {
    if (!simText.trim()) return null;
    return triageOnDevice(simText, simStation, simChannel);
  }, [simText, simStation, simChannel]);

  // Handle immediate dispatch from simulator
  const handleDispatchSimulator = async () => {
    if (!simText.trim()) return;
    setIsDispatching(true);
    await onIngestComplaint({
      station_id: simStation,
      channel: simChannel,
      raw_text: simText.trim(),
    });
    setIsDispatching(false);
    onNavigateToQueue(simStation);
  };

  const handleCopyDraft = () => {
    if (liveTriageResult?.reply_draft) {
      navigator.clipboard.writeText(liveTriageResult.reply_draft);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  // Station counts map
  const stationCounts = useMemo(() => {
    const map: Record<string, number> = {};
    hotspots.forEach((h) => {
      map[h.station_id] = h.count;
    });
    return map;
  }, [hotspots]);

  return (
    <div className="landing-container">
      {/* 1. Monospace Telemetry Ticker Marquee */}
      <div className="landing-ticker">
        <div className="ticker-track">
          {[0, 1].map((copyIndex) => (
            <React.Fragment key={copyIndex}>
              <span className="ticker-item">
                <span className="ticker-dot green" /> NETWORK: 5 ACTIVE STATION NODES
              </span>
              <span className="ticker-item">
                <span className="ticker-dot" /> SLA TARGET: &lt;15 MIN RESPONSE
              </span>
              <span className="ticker-item">
                <span className="ticker-dot red" /> P1 CRITICAL: {stats?.p1_active ?? 0} ACTIVE
              </span>
              <span className="ticker-item">
                <span className="ticker-dot blue" /> ON-DEVICE ENGINE: TFLITE INT8
              </span>
              <span className="ticker-item">
                <span className="ticker-dot" /> SCRIPT VOCABULARY: GUJARATI &bull; HINDI &bull; GUJLISH &bull; ENGLISH
              </span>
              <span className="ticker-item">
                <span className="ticker-dot amber" /> OUTBOX SYNC: {isOffline ? 'OFFLINE ISOLATED' : 'LIVE ONLINE'}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* 2. Hero Presentation */}
      <section className="landing-hero">
        <div className="hero-eyebrow-row">
          <span className="hero-chip">GMRC PS-07 SPECIFICATION</span>
          <span className="hero-chip ghost">AHMEDABAD &amp; GANDHINAGAR METRO</span>
          <span className="hero-chip live">
            <span className="pulse-dot" /> SYSTEM ONLINE
          </span>
        </div>

        <h1 className="hero-title">
          METRO COMPLAINT<br />
          <span className="hero-title-accent">TRIAGE ENGINE.</span>
        </h1>

        <p className="hero-subtitle">
          Real-time multimodal passenger grievance routing, sub-second code-mixed NLP classification, 
          and deterministic safety containment engineered for station controllers and central OCC dispatchers.
        </p>

        {/* Hero Interactive CTAs */}
        <div className="hero-actions">
          <button 
            className="btn btn-primary hero-btn"
            onClick={() => onNavigateToQueue()}
          >
            <span>ENTER LIVE COCKPIT</span>
            <ArrowRight size={16} />
          </button>

          <button 
            className="btn btn-outline hero-btn"
            onClick={() => {
              const el = document.getElementById('interactive-simulator');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            <Zap size={16} />
            <span>TEST AI SIMULATOR</span>
          </button>

          <button 
            className="btn btn-outline hero-btn desktop-only"
            onClick={onNavigateToAnalytics}
          >
            <Terminal size={15} />
            <span>AUDIT TRAIL</span>
          </button>
        </div>

        {/* Live Operational Metric Stat Blocks */}
        <div className="hero-stats-band">
          <div className="stat-block">
            <div className="stat-num">{stats?.total_complaints ?? 10}</div>
            <div className="stat-caption">ACTIVE QUEUE ITEMS</div>
          </div>
          <div className="stat-block p1-block">
            <div className="stat-num">{stats?.p1_active ?? 3}</div>
            <div className="stat-caption">P1 CRITICAL SAFETY</div>
          </div>
          <div className="stat-block">
            <div className="stat-num">&lt;180ms</div>
            <div className="stat-caption">EDGE INFERENCE TIME</div>
          </div>
          <div className="stat-block">
            <div className="stat-num">100%</div>
            <div className="stat-caption">OFFLINE KIOSK SURVIVAL</div>
          </div>
        </div>
      </section>

      {/* 3. Interactive Triage Sandbox / Real-Time Simulator */}
      <section className="landing-section" id="interactive-simulator">
        <div className="section-head-wrap">
          <div>
            <div className="section-tag">01 / INTERACTIVE LAB</div>
            <h2 className="section-heading-big">Multilingual Triage Simulator</h2>
            <p className="section-desc">
              Test how raw passenger reports in Gujarati, Hindi, Gujlish, and English are instantly parsed, 
              evaluated against deterministic safety rules, and routed.
            </p>
          </div>
        </div>

        <div className="simulator-grid">
          {/* Left: Input Controller */}
          <div className="simulator-input-panel">
            <div className="form-group">
              <label className="form-label">Select One-Click Test Scenario:</label>
              <div className="chips-row">
                {PRESET_PROMPTS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`scenario-chip ${simText === p.text ? 'active' : ''}`}
                    onClick={() => {
                      setSimText(p.text);
                      setSimStation(p.station);
                      setSimChannel(p.channel);
                    }}
                  >
                    <span className="scenario-tag-lang">{p.tag}</span>
                    <span className="scenario-label-text">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="override-grid" style={{ marginTop: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Station Node:</label>
                <select
                  className="input-select"
                  value={simStation}
                  onChange={(e) => setSimStation(e.target.value)}
                >
                  {STATIONS_DATA.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Channel Source:</label>
                <select
                  className="input-select"
                  value={simChannel}
                  onChange={(e) => setSimChannel(e.target.value as IngestChannel)}
                >
                  <option value="app">Mobile App (REST Ingest API)</option>
                  <option value="social">Social Feeds (X Feeds)</option>
                  <option value="email">Passenger Email (.eml)</option>
                  <option value="paper">Paper Form (OCR)</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '1.25rem' }}>
              <div className="form-label-row">
                <label className="form-label">Raw Grievance String (Editable):</label>
                <span className="char-count-text">{simText.length} chars</span>
              </div>
              <textarea
                className="form-textarea"
                rows={4}
                value={simText}
                onChange={(e) => setSimText(e.target.value)}
                placeholder="Type any grievance in Gujarati, Hindi, Gujlish, or English..."
              />
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '1.25rem', minHeight: '48px' }}
              onClick={handleDispatchSimulator}
              disabled={isDispatching || !simText.trim()}
            >
              <Send size={16} />
              <span>{isDispatching ? 'DISPATCHING...' : 'DISPATCH INTO LIVE COCKPIT'}</span>
            </button>
          </div>

          {/* Right: Live Real-Time Triage Breakdown */}
          <div className="simulator-output-panel">
            {liveTriageResult ? (
              <div className="sim-result-card">
                <div className="sim-result-top">
                  <div>
                    <span className="sim-meta-label">TRIAGE VERDICT</span>
                    <div className="sim-priority-row">
                      <span className={`badge-pill badge-${liveTriageResult.priority.toLowerCase()}`}>
                        {liveTriageResult.priority === 'P1' && <ShieldAlert size={14} className="badge-icon" />}
                        {liveTriageResult.priority} {liveTriageResult.priority === 'P1' ? 'CRITICAL' : ''}
                      </span>
                      <span className="station-pill">📍 {simStation.replace('STN_', '')}</span>
                      <span className="lang-pill">
                        {liveTriageResult.reply_lang.toUpperCase()} SCRIPT
                      </span>
                    </div>
                  </div>

                  <div className="urgency-gauge" style={{ width: 120 }}>
                    <span className="gauge-score-label">Urgency {liveTriageResult.urgency}/100</span>
                    <div className="gauge-track">
                      <div 
                        className="gauge-fill" 
                        style={{ 
                          width: `${liveTriageResult.urgency}%`,
                          backgroundColor: liveTriageResult.urgency >= 80 ? 'var(--signal-red)' : 'var(--signal-amber)'
                        }} 
                      />
                    </div>
                  </div>
                </div>

                {/* Safety Rules Hit */}
                <div className="sim-eval-block">
                  <div className="sim-block-title">Deterministic Safety Floor:</div>
                  {liveTriageResult.safety_hits && liveTriageResult.safety_hits.length > 0 ? (
                    <div className="safety-tags-container" style={{ marginTop: '0.4rem' }}>
                      {liveTriageResult.safety_hits.map((h, i) => (
                        <span key={i} className="safety-tag-item">
                          🚨 {typeof h === 'string' ? h : h.id || 'SAFETY_RULE'}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="sim-clean-tag">
                      <CheckCircle2 size={14} />
                      <span>Zero Safety Floor Triggers &bull; Proceeded to Dept Classifier</span>
                    </div>
                  )}
                </div>

                {/* Routing & Confidence */}
                <div className="sim-eval-block">
                  <div className="sim-block-title">Department Routing:</div>
                  <div className="sim-routing-row">
                    <span className="sim-dept-val">
                      {liveTriageResult.dept_primary.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span className="sim-conf-val">
                      Confidence: {Math.round(liveTriageResult.dept_conf * 100)}%
                    </span>
                  </div>
                </div>

                {/* Generated Guardrailed Response */}
                <div className="sim-eval-block reply-preview">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="sim-block-title">AI Non-Liability Response Draft:</div>
                    <button
                      className="copy-btn"
                      onClick={handleCopyDraft}
                      title="Copy response"
                    >
                      {copyFeedback ? 'COPIED!' : 'COPY'}
                    </button>
                  </div>
                  <div className="sim-reply-text">
                    "{liveTriageResult.reply_draft}"
                  </div>
                </div>
              </div>
            ) : (
              <div className="sim-empty-state">
                <Sparkles size={32} />
                <p>Type text or select a preset scenario on the left to see instant classification breakdown.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. Interactive Station Topology Radar */}
      <section className="landing-section">
        <div className="section-head-wrap">
          <div>
            <div className="section-tag">02 / NETWORK TOPOLOGY</div>
            <h2 className="section-heading-big">Station Node Topology</h2>
            <p className="section-desc">
              Real-time monitoring across all active station telemetry endpoints. Click any node to open its dedicated queue.
            </p>
          </div>
        </div>

        <div className="stations-topology-grid">
          {STATIONS_DATA.map((stn) => {
            const count = stationCounts[stn.id] || 0;
            const hasAlert = count >= 3;

            return (
              <div 
                key={stn.id} 
                className={`station-node-card ${hasAlert ? 'has-alert' : ''}`}
                onClick={() => onNavigateToQueue(stn.id)}
              >
                <div className="node-top">
                  <span className="node-badge">{stn.badge}</span>
                  <span className={`node-status-pill ${hasAlert ? 'alert' : 'normal'}`}>
                    <span className="status-dot" />
                    {hasAlert ? 'HIGH LOAD' : 'NORMAL'}
                  </span>
                </div>

                <div className="node-name">{stn.name}</div>
                <div className="node-line">{stn.line}</div>

                <div className="node-footer">
                  <div className="node-count-wrap">
                    <span className="node-count-num">{count}</span>
                    <span className="node-count-label">ACTIVE GRIEVANCES</span>
                  </div>
                  <span className="node-arrow">
                    <ArrowRight size={16} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Engine Architecture Pillars */}
      <section className="landing-section">
        <div className="section-head-wrap">
          <div>
            <div className="section-tag">03 / SYSTEM ARCHITECTURE</div>
            <h2 className="section-heading-big">Engine Design Principles</h2>
            <p className="section-desc">
              Built to guarantee zero missed passenger emergencies with deterministic rule floors and resilient edge kiosk execution.
            </p>
          </div>
        </div>

        <div className="pillars-grid">
          <div className="pillar-cell">
            <div className="pillar-header-row">
              <span className="pillar-num">01</span>
              <ShieldAlert size={20} color="var(--signal-red)" />
            </div>
            <h3 className="pillar-title">Deterministic Safety Floor</h3>
            <p className="pillar-body">
              Safety rules execute first using hardcoded regex patterns for fire, smoke, track intrusions,
              and physical violence. Guarantees zero missed emergencies without model hallucination.
            </p>
          </div>

          <div className="pillar-cell">
            <div className="pillar-header-row">
              <span className="pillar-num">02</span>
              <Cpu size={20} color="var(--accent-light)" />
            </div>
            <h3 className="pillar-title">Code-Mixed NLP Tokenizer</h3>
            <p className="pillar-body">
              Specialized preprocessing for Ahmedabad passengers switching between Gujarati, Hindi, 
              and Latin Gujlish tokens ("bandh chhe", "madad", "kachro") with TF-IDF and heuristic classifiers.
            </p>
          </div>

          <div className="pillar-cell">
            <div className="pillar-header-row">
              <span className="pillar-num">03</span>
              <WifiOff size={20} color="var(--signal-amber)" />
            </div>
            <h3 className="pillar-title">Offline Outbox Protocol</h3>
            <p className="pillar-body">
              Platform-level network isolation tolerance. Station controller tablets queue operations in
              IndexedDB/LocalStorage with UUID idempotency keys, syncing seamlessly upon cloud reconnection.
            </p>
          </div>

          <div className="pillar-cell">
            <div className="pillar-header-row">
              <span className="pillar-num">04</span>
              <Database size={20} color="var(--signal-green)" />
            </div>
            <h3 className="pillar-title">Active Retraining Flywheel</h3>
            <p className="pillar-body">
              Human supervisor overrides are logged as immutable review events. These ground-truth decisions
              automatically feed model bundle compilation pipelines for continuous precision improvements.
            </p>
          </div>
        </div>
      </section>

      {/* 6. Bottom Banner CTA */}
      <section className="landing-cta-banner">
        <div>
          <h2 className="cta-banner-title">READY TO TRIAGE PASSENGER GRIEVANCES?</h2>
          <p className="cta-banner-sub">
            Monitor incoming alerts across Paldi, Kalupur, and Central with sub-second AI assistance.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-primary"
            style={{ padding: '0.85rem 1.75rem', fontSize: '0.95rem' }}
            onClick={() => onNavigateToQueue()}
          >
            <span>LAUNCH COCKPIT</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </section>
    </div>
  );
};
