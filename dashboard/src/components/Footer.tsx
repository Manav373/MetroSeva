import React from 'react';
import { ArrowUpRight } from 'lucide-react';

interface FooterProps {
  isOffline: boolean;
  outboxCount: number;
}

export const Footer: React.FC<FooterProps> = ({ isOffline, outboxCount }) => {
  return (
    <footer className="nothin-footer">
      {/* Editorial Headline Statement */}
      <div className="footer-statement">
        <h2 className="footer-statement-headline">
          Safety precedes speed.<br />
          Clarity precedes automation.
        </h2>
        <p className="footer-statement-sub">
          A protean grievance triage engine for Ahmedabad &amp; Gandhinagar Metro Operations. 
          Deterministic safety floors, canonical Gujlish lexicons, and offline-first transactional outbox for station controllers who refuse the generic.
        </p>
      </div>

      {/* Nothin' Editorial Columns Grid */}
      <div className="nothin-footer-grid">
        {/* Column 1: Core System Telemetry */}
        <div className="nothin-col">
          <div className="nothin-col-label">01 / Operational State</div>
          <div className="nothin-telemetry">
            <div className="telemetry-row">
              <span>ENGINE MODE</span>
              <strong style={{ color: isOffline ? '#e5a93c' : '#22c55e' }}>
                {isOffline ? 'OFFLINE PLATFORM' : 'CENTRAL ONLINE'}
              </strong>
            </div>
            <div className="telemetry-row">
              <span>PENDING OUTBOX</span>
              <strong style={{ color: '#fff' }}>{outboxCount} ITEMS</strong>
            </div>
            <div className="telemetry-row">
              <span>SAFETY FLOOR</span>
              <strong style={{ color: '#ff3333' }}>&ge; 98.0% RECALL</strong>
            </div>
            <div className="telemetry-row">
              <span>LATENCY BUDGET</span>
              <strong style={{ color: '#fff' }}>&lt; 300MS / ITEM</strong>
            </div>
          </div>
        </div>

        {/* Column 2: Ingest Channels */}
        <div className="nothin-col">
          <div className="nothin-col-label">02 / Ingestion</div>
          <ul className="nothin-link-list">
            <li><span>Passenger App (REST)</span> <span className="font-mono" style={{ fontSize: '0.72rem' }}>P0</span></li>
            <li><span>Social Feeds (X CSV)</span> <span className="font-mono" style={{ fontSize: '0.72rem' }}>BATCH</span></li>
            <li><span>Email Relay (.eml)</span> <span className="font-mono" style={{ fontSize: '0.72rem' }}>MIME</span></li>
            <li><span>Paper Forms (OCR)</span> <span className="font-mono" style={{ fontSize: '0.72rem' }}>GUJ/HIN</span></li>
          </ul>
        </div>

        {/* Column 3: Station Grid */}
        <div className="nothin-col">
          <div className="nothin-col-label">03 / Station Nodes</div>
          <ul className="nothin-link-list">
            <li><span>STN_PALDI</span> <span className="font-mono" style={{ fontSize: '0.72rem' }}>PLATFORM 1-2</span></li>
            <li><span>STN_KALUPUR</span> <span className="font-mono" style={{ fontSize: '0.72rem' }}>JUNCTION</span></li>
            <li><span>STN_CENTRAL</span> <span className="font-mono" style={{ fontSize: '0.72rem' }}>OLD HIGH COURT</span></li>
            <li><span>STN_THALTEJ</span> <span className="font-mono" style={{ fontSize: '0.72rem' }}>TERMINUS</span></li>
          </ul>
        </div>

        {/* Column 4: Architecture & Specs */}
        <div className="nothin-col">
          <div className="nothin-col-label">04 / Specifications</div>
          <ul className="nothin-link-list">
            <li>
              <a href="http://127.0.0.1:8000/docs" target="_blank" rel="noreferrer">
                <span>FastAPI Swagger Spec</span>
                <ArrowUpRight size={14} className="arrow-icon" />
              </a>
            </li>
            <li>
              <a href="https://www.noth.in/" target="_blank" rel="noreferrer">
                <span>Aesthetic: Nothin' Paris</span>
                <ArrowUpRight size={14} className="arrow-icon" />
              </a>
            </li>
            <li><span>Quantization: Int8 TFLite</span></li>
            <li><span>Signing: Ed25519 Manifest</span></li>
          </ul>
        </div>
      </div>

      {/* Massive Editorial Watermark Typography */}
      <div className="nothin-watermark">
        <div className="watermark-hero-type">NOTHIN' BUT TRIAGE</div>
      </div>

      {/* Bottom Legal Line */}
      <div className="nothin-bottom-row">
        <div>
          &copy; 2026 METRO CTE — OPERATIONS &amp; SAFETY DIVISION — PS-07
        </div>
        <div>
          ZERO LEGAL LIABILITY ADMISSION &bull; 90-DAY PII RETENTION PURGE &bull; SQLCIPHER ENCRYPTED
        </div>
      </div>
    </footer>
  );
};
