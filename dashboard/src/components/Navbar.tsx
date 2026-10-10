import React from 'react';
import { RefreshCw, Wifi, WifiOff, PlusCircle } from 'lucide-react';

interface NavbarProps {
  selectedStation: string;
  onSelectStation: (stn: string) => void;
  isOffline: boolean;
  onToggleOffline: () => void;
  outboxCount: number;
  onSyncOutbox: () => void;
  isSyncing: boolean;
  onOpenIngest: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  selectedStation,
  onSelectStation,
  isOffline,
  onToggleOffline,
  outboxCount,
  onSyncOutbox,
  isSyncing,
  onOpenIngest,
}) => {
  return (
    <header className="navbar">
      <div className="brand-section">
        <div className="brand-icon">🚇</div>
        <div>
          <div className="brand-title">Metro Complaint Triage System</div>
          <div className="brand-sub">PS-07 · Station Controller & Ops Center (React / TS)</div>
        </div>
      </div>

      <div className="nav-actions">
        {/* Station Selector */}
        <div className="control-item">
          <label htmlFor="station-select">Station:</label>
          <select
            id="station-select"
            className="input-select"
            value={selectedStation}
            onChange={(e) => onSelectStation(e.target.value)}
          >
            <option value="">All Stations (Central HQ View)</option>
            <option value="STN_PALDI">STN_PALDI (Paldi)</option>
            <option value="STN_KALUPUR">STN_KALUPUR (Kalupur)</option>
            <option value="STN_CENTRAL">STN_CENTRAL (Old High Court)</option>
            <option value="STN_APMC">STN_APMC (APMC)</option>
            <option value="STN_THALTEJ">STN_THALTEJ (Thaltej)</option>
          </select>
        </div>

        {/* Network Toggle */}
        <button
          className={`net-indicator ${isOffline ? 'offline' : 'online'}`}
          onClick={onToggleOffline}
          title={isOffline ? 'Switch to Online Mode' : 'Simulate Station Offline Mode'}
        >
          <span className={`dot ${isOffline ? 'offline' : 'online'}`}></span>
          {isOffline ? (
            <>
              <WifiOff size={14} /> Offline Mode (Platform)
            </>
          ) : (
            <>
              <Wifi size={14} /> Central Online
            </>
          )}
        </button>

        {/* Sync Outbox Button */}
        <button
          className="btn btn-sync"
          onClick={onSyncOutbox}
          disabled={isSyncing || outboxCount === 0}
          title="Push pending local actions to central backend with P1 prioritized first"
        >
          <RefreshCw size={14} className={isSyncing ? 'spin' : ''} />
          Sync Outbox ({outboxCount})
        </button>

        {/* Ingest / OCR Form Button */}
        <button className="btn btn-accent" onClick={onOpenIngest}>
          <PlusCircle size={15} />
          New / OCR Ingest
        </button>
      </div>
    </header>
  );
};
