import React, { useState } from 'react';
import { ArrowUpRight, RefreshCw, Sun, Moon, MapPin, ChevronDown } from 'lucide-react';

interface NavbarProps {
  selectedStation: string;
  onSelectStation: (stn: string) => void;
  isOffline: boolean;
  onToggleOffline: () => void;
  outboxCount: number;
  onSyncOutbox: () => void;
  isSyncing: boolean;
  onOpenIngest: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

const STATIONS = [
  { id: '', label: 'All Stations (HQ)' },
  { id: 'STN_PALDI', label: 'Paldi Station' },
  { id: 'STN_KALUPUR', label: 'Kalupur Junction' },
  { id: 'STN_CENTRAL', label: 'Central (High Court)' },
  { id: 'STN_APMC', label: 'APMC Depot' },
  { id: 'STN_THALTEJ', label: 'Thaltej Terminus' },
];

export const Navbar: React.FC<NavbarProps> = ({
  selectedStation,
  onSelectStation,
  isOffline,
  onToggleOffline,
  outboxCount,
  onSyncOutbox,
  isSyncing,
  onOpenIngest,
  theme,
  onToggleTheme,
}) => {
  const [showStationPicker, setShowStationPicker] = useState(false);

  React.useEffect(() => {
    if (showStationPicker) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showStationPicker]);

  const currentStationLabel =
    STATIONS.find((s) => s.id === selectedStation)?.label || 'All Stations';

  return (
    <>
      <header className="navbar">
        {/* Mobile Left: Native Station Switcher Pill */}
        <div className="mobile-station-picker-wrap">
          <button
            className="mobile-station-btn"
            onClick={() => setShowStationPicker(!showStationPicker)}
            aria-label="Switch Station Node"
          >
            <MapPin size={16} className="pin-icon" />
            <span className="station-name-text">{currentStationLabel}</span>
            <ChevronDown size={14} />
          </button>
        </div>

        {/* Desktop Brand Info */}
        <div className="brand-section desktop-only">
          <div className="brand-monogram">M</div>
          <div className="brand-info">
            <div className="brand-title">Metro / CTE</div>
            <div className="brand-sub">PS-07 Station Cockpit</div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="nav-actions">
          {/* Desktop Station Select */}
          <div className="control-item desktop-only">
            <select
              id="station-select"
              className="input-select"
              value={selectedStation}
              onChange={(e) => onSelectStation(e.target.value)}
              aria-label="Select Station Node"
            >
              {STATIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Network State Pill */}
          <button
            className={`net-indicator ${isOffline ? 'offline' : 'online'}`}
            onClick={onToggleOffline}
            title={isOffline ? 'Switch to Central Online' : 'Switch to Platform Offline'}
            aria-label="Toggle network mode"
          >
            <span className={`dot ${isOffline ? 'offline' : 'online'}`}></span>
            <span className="net-status-text">{isOffline ? 'OFFLINE' : 'ONLINE'}</span>
          </button>

          {/* Theme Switcher Button */}
          <button
            className="theme-toggle-btn"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle light and dark theme"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {/* Desktop Outbox Sync */}
          <button
            className="btn btn-outline desktop-only"
            onClick={onSyncOutbox}
            disabled={isSyncing || outboxCount === 0}
            title="Sync Outbox"
          >
            <RefreshCw size={12} className={isSyncing ? 'spin' : ''} />
            <span>OUTBOX [{outboxCount}]</span>
          </button>

          {/* Desktop Ingest Button */}
          <button
            className="btn btn-primary desktop-only"
            onClick={onOpenIngest}
            aria-label="Open Ingest Form"
          >
            <span>+ INGEST</span>
            <ArrowUpRight size={13} />
          </button>
        </div>
      </header>

      {/* Mobile Station Picker Bottom Sheet Drawer */}
      {showStationPicker && (
        <div
          className="modal-overlay"
          onClick={() => setShowStationPicker(false)}
        >
          <div
            className="modal-dialog station-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title">Select Station Node</div>
              <button
                className="modal-close-btn"
                onClick={() => setShowStationPicker(false)}
              >
                &times;
              </button>
            </div>
            <div className="station-drawer-list">
              {STATIONS.map((s) => (
                <button
                  key={s.id}
                  className={`station-drawer-item ${selectedStation === s.id ? 'active' : ''}`}
                  onClick={() => {
                    onSelectStation(s.id);
                    setShowStationPicker(false);
                  }}
                >
                  <span className="stn-name">{s.label}</span>
                  {selectedStation === s.id && (
                    <span className="stn-active-badge">&bull; CURRENT</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
