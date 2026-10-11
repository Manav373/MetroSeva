import React from 'react';
import { ArrowUpRight, ShieldCheck, Activity, Train, Database } from 'lucide-react';

interface FooterProps {
  isOffline: boolean;
  outboxCount: number;
}

export const Footer: React.FC<FooterProps> = ({ isOffline, outboxCount }) => {
  return (
    <footer className="metro-footer">
      <div className="metro-footer-inner">
        {/* Operations Headline */}
        <div className="footer-headline-band">
          <div className="footer-brand-title">
            <span className="footer-brand-badge">GMRC PS-07</span>
            <h3>Metro Grievance Triage Engine</h3>
            <p>
              Automated multi-lingual complaint categorization, deterministic safety emergency routing, 
              and offline-first station controller workflows for Ahmedabad &amp; Gandhinagar Metro Network.
            </p>
          </div>
          <div className="footer-status-pill">
            <span className={`status-indicator-dot ${isOffline ? 'offline' : 'online'}`} />
            <span>{isOffline ? 'OFFLINE STATION MODE' : 'CENTRAL OCC LIVE ONLINE'}</span>
          </div>
        </div>

        {/* 4 Balanced Columns */}
        <div className="metro-footer-grid">
          {/* Column 1: Core System Telemetry */}
          <div className="metro-col">
            <div className="metro-col-header">
              <Activity size={14} />
              <span>Operational Telemetry</span>
            </div>
            <div className="metro-telemetry-list">
              <div className="telemetry-item">
                <span className="t-label">Network Mode</span>
                <span className={`t-val ${isOffline ? 'amber' : 'green'}`}>
                  {isOffline ? 'Offline Platform' : 'Central Cloud'}
                </span>
              </div>
              <div className="telemetry-item">
                <span className="t-label">Queued Outbox</span>
                <span className="t-val">{outboxCount} Actions Pending</span>
              </div>
              <div className="telemetry-item">
                <span className="t-label">Safety Floor Recall</span>
                <span className="t-val red">&ge; 98.0% Guaranteed</span>
              </div>
              <div className="telemetry-item">
                <span className="t-label">Inference Target</span>
                <span className="t-val">&lt; 180ms Sub-Second</span>
              </div>
            </div>
          </div>

          {/* Column 2: Ingestion Pipelines */}
          <div className="metro-col">
            <div className="metro-col-header">
              <Database size={14} />
              <span>Ingestion Channels</span>
            </div>
            <ul className="metro-link-list">
              <li>
                <span>Passenger App</span>
                <span className="badge-tag">REST API</span>
              </li>
              <li>
                <span>Social Feeds (X Feeds)</span>
                <span className="badge-tag">BATCH OCR</span>
              </li>
              <li>
                <span>Station Email Relay</span>
                <span className="badge-tag">MIME .EML</span>
              </li>
              <li>
                <span>Physical Paper Forms</span>
                <span className="badge-tag">VISION OCR</span>
              </li>
            </ul>
          </div>

          {/* Column 3: Active Station Corridors */}
          <div className="metro-col">
            <div className="metro-col-header">
              <Train size={14} />
              <span>Network Corridors</span>
            </div>
            <ul className="metro-link-list">
              <li>
                <span>Paldi Station</span>
                <span className="corridor-tag">North-South Line</span>
              </li>
              <li>
                <span>Kalupur Junction</span>
                <span className="corridor-tag">Railway Interchange</span>
              </li>
              <li>
                <span>Central (High Court)</span>
                <span className="corridor-tag">East-West Line</span>
              </li>
              <li>
                <span>Thaltej &amp; APMC Depots</span>
                <span className="corridor-tag">Terminus Nodes</span>
              </li>
            </ul>
          </div>

          {/* Column 4: Architecture & Compliance */}
          <div className="metro-col">
            <div className="metro-col-header">
              <ShieldCheck size={14} />
              <span>Standards &amp; Governance</span>
            </div>
            <ul className="metro-link-list">
              <li>
                <a href="http://127.0.0.1:8000/docs" target="_blank" rel="noreferrer">
                  <span>FastAPI OpenAPI Spec</span>
                  <ArrowUpRight size={13} />
                </a>
              </li>
              <li>
                <span>Model Quantization</span>
                <span className="badge-tag">Int8 TFLite</span>
              </li>
              <li>
                <span>Bundle Verification</span>
                <span className="badge-tag">Ed25519 Signed</span>
              </li>
              <li>
                <span>PII Privacy Retention</span>
                <span className="badge-tag">90-Day Auto Purge</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Legal & Copyright Bar */}
        <div className="metro-bottom-bar">
          <div>
            &copy; 2026 Gujarat Metro Rail Corporation (GMRC) &bull; Operations &amp; Safety Division &bull; PS-07 Complaint Triage Engine
          </div>
          <div className="bottom-meta">
            SQLCipher Encrypted Local Kiosk Cache &bull; RDSO Transit Standards Compliant
          </div>
        </div>
      </div>
    </footer>
  );
};
