import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, LayoutList, BarChart3, Plus, RefreshCw, Sparkles, X, Filter } from 'lucide-react';
import { Complaint, StatsOverview, Hotspot, ReviewEvent, Department } from './types';
import { ApiService } from './services/api';
import { getStoredOutbox } from './services/offlineStorage';
import { parseIsoDate } from './utils/dateUtils';
import { Navbar } from './components/Navbar';
import { LandingView } from './components/LandingView';
import { SafetyAlertBanner } from './components/SafetyAlertBanner';
import { KPIGrid } from './components/KPIGrid';
import { DepartmentTabs } from './components/DepartmentTabs';
import { ComplaintCard } from './components/ComplaintCard';
import { ComplaintDetailModal } from './components/ComplaintDetailModal';
import { IngestModal } from './components/IngestModal';
import { AnalyticsView } from './components/AnalyticsView';
import { Footer } from './components/Footer';

const MOBILE_DEPARTMENTS: { id: Department | ''; label: string; icon: string }[] = [
  { id: '', label: 'All', icon: '📋' },
  { id: 'safety', label: 'Safety', icon: '🚨' },
  { id: 'lifts_escalators', label: 'Lifts', icon: '🛗' },
  { id: 'cleanliness', label: 'Cleanliness', icon: '🧹' },
  { id: 'fare', label: 'Fare', icon: '💳' },
  { id: 'staff_behaviour', label: 'Staff', icon: '👮' },
  { id: 'other', label: 'Other', icon: 'ℹ️' },
];

export const App: React.FC = () => {
  // Theme State (Dark / Light)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('cte_theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cte_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Global & Filter State (Default to '' for All Stations so full queue is visible)
  const [selectedStation, setSelectedStation] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeView, setActiveView] = useState<'landing' | 'queue' | 'analytics'>('landing');
  const [isOffline, setIsOffline] = useState<boolean>(false);

  // Data State
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [auditLogs, setAuditLogs] = useState<ReviewEvent[]>([]);
  const [outboxCount, setOutboxCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isApproving, setIsApproving] = useState<boolean>(false);

  // UI Interactive Modals & Banners
  const [isP1BannerDismissed, setIsP1BannerDismissed] = useState<boolean>(false);
  const [reviewComplaint, setReviewComplaint] = useState<Complaint | null>(null);
  const [isIngestOpen, setIsIngestOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (reviewComplaint || isIngestOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [reviewComplaint, isIngestOpen]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch Complaints & Stats
  const refreshData = useCallback(async () => {
    const outbox = getStoredOutbox();
    setOutboxCount(outbox.length);

    const queueRes = await ApiService.fetchQueue({
      station_id: selectedStation,
      department: selectedDept,
      priority: selectedPriority,
      channel: selectedChannel,
      search: searchQuery,
    });
    setComplaints(queueRes.complaints);

    const [statsRes, spotsRes, auditRes] = await Promise.all([
      ApiService.fetchStats(),
      ApiService.fetchHotspots(),
      ApiService.fetchAuditLog(),
    ]);
    setStats(statsRes);
    setHotspots(spotsRes);
    setAuditLogs(auditRes);
  }, [selectedStation, selectedDept, selectedPriority, selectedChannel, searchQuery]);

  // Polling loop
  useEffect(() => {
    refreshData();
    const timer = setInterval(() => {
      refreshData();
    }, 8000);
    return () => clearInterval(timer);
  }, [refreshData]);

  // Toggle Network Online / Offline Platform mode
  const handleToggleOffline = () => {
    const nextState = !isOffline;
    setIsOffline(nextState);
    ApiService.setOfflineMode(nextState);
    showToast(
      nextState
        ? '⚠️ Offline Station Mode: Actions stored in Outbox'
        : '🟢 Online Central Mode: Live Cloud Active'
    );
    refreshData();
  };

  // Sync Outbox
  const handleSyncOutbox = async () => {
    setIsSyncing(true);
    const result = await ApiService.syncOutbox();
    setIsSyncing(false);
    if (result.success) {
      showToast(`🔄 Synced ${result.syncedCount} items successfully!`);
      refreshData();
    } else {
      showToast(`❌ Sync error: ${result.errors.join(', ')}`);
    }
  };

  // Approve reply
  const handleApproveReply = async (complaintId: string, customText?: string) => {
    setIsApproving(true);
    // Optimistic UI update
    setComplaints((prev) =>
      prev.map((c) =>
        c.id === complaintId
          ? {
              ...c,
              reply_status: 'approved',
              reply_draft: customText || c.reply_draft,
              updated_at: new Date().toISOString(),
            }
          : c
      )
    );

    const res = await ApiService.approveReply(complaintId, customText);
    setIsApproving(false);
    setOutboxCount(getStoredOutbox().length);
    showToast(
      res.synced
        ? '✓ Reply approved & dispatched!'
        : '⏳ Reply approved locally (Outbox queued)'
    );
    refreshData();
  };

  // Human-in-the-loop Override
  const handleSaveOverride = async (complaintId: string, field: string, newValue: string) => {
    // Optimistic UI update
    setComplaints((prev) =>
      prev.map((c) =>
        c.id === complaintId
          ? {
              ...c,
              [field]: newValue,
              updated_at: new Date().toISOString(),
            }
          : c
      )
    );
    if (reviewComplaint && reviewComplaint.id === complaintId) {
      setReviewComplaint((prev: Complaint | null) => (prev ? { ...prev, [field]: newValue } : null));
    }

    const res = await ApiService.reviewOverride(complaintId, field, newValue);
    setOutboxCount(getStoredOutbox().length);
    showToast(
      res.synced
        ? `✓ Logged ${field} override for model retraining!`
        : `⏳ Override queued in Outbox.`
    );
    refreshData();
  };

  // Ingest new complaint
  const handleIngestSubmit = async (data: {
    station_id: string;
    channel: 'app' | 'social' | 'email' | 'paper';
    raw_text: string;
  }) => {
    const res = await ApiService.ingestComplaint(data);
    setOutboxCount(getStoredOutbox().length);
    showToast(
      res.complaint.priority === 'P1'
        ? '🚨 P1 Critical Safety Grievance Triaged!'
        : `✓ Triaged: [${res.complaint.dept_primary}] (${res.complaint.priority})`
    );
    setIsP1BannerDismissed(false);

    // If an active station or department filter would hide the new ticket, clear filter
    if (selectedStation && selectedStation !== data.station_id) {
      setSelectedStation('');
    }
    if (selectedDept && selectedDept !== res.complaint.dept_primary) {
      setSelectedDept('');
    }

    refreshData();
  };

  // Computed Department Counts (Preserve system-wide counts across filters)
  const deptCounts = useMemo(() => {
    if (stats?.dept_distribution && Object.keys(stats.dept_distribution).length > 0) {
      return stats.dept_distribution;
    }
    const map: Record<string, number> = {};
    complaints.forEach((c) => {
      map[c.dept_primary] = (map[c.dept_primary] || 0) + 1;
    });
    return map;
  }, [stats, complaints]);

  // Top P1 Complaint for Alert Banner
  const topP1 = useMemo(() => {
    if (isP1BannerDismissed) return null;
    return complaints.find((c) => c.priority === 'P1') || null;
  }, [complaints, isP1BannerDismissed]);

  const p1Count = stats?.p1_active ?? complaints.filter((c) => c.priority === 'P1').length;
  const slaBreaches = useMemo(() => {
    if (stats?.sla_breaches !== undefined) {
      return stats.sla_breaches;
    }
    const cutoff = Date.now() - 15 * 60000;
    return complaints.filter(
      (c) => c.priority === 'P1' && c.reply_status === 'draft' && parseIsoDate(c.created_at).getTime() < cutoff
    ).length;
  }, [stats, complaints]);

  return (
    <div className="app-container" data-theme={theme}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="app-toast">
          {toastMessage}
        </div>
      )}

      {/* Mobile-Native & Desktop Top Navbar */}
      <Navbar
        selectedStation={selectedStation}
        onSelectStation={setSelectedStation}
        isOffline={isOffline}
        onToggleOffline={handleToggleOffline}
        outboxCount={outboxCount}
        onSyncOutbox={handleSyncOutbox}
        isSyncing={isSyncing}
        onOpenIngest={() => setIsIngestOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
        activeView={activeView}
        onSelectView={setActiveView}
        queueCount={complaints.length}
      />

      {/* VIEW 1: INTERACTIVE LANDING / OVERVIEW PORTAL */}
      {activeView === 'landing' && (
        <LandingView
          stats={stats}
          hotspots={hotspots}
          onNavigateToQueue={(stnId) => {
            if (stnId) setSelectedStation(stnId);
            setActiveView('queue');
          }}
          onNavigateToAnalytics={() => setActiveView('analytics')}
          onIngestComplaint={handleIngestSubmit}
          isOffline={isOffline}
        />
      )}

      {/* VIEW 2: REAL-TIME OPERATIONAL QUEUE & COCKPIT */}
      {activeView === 'queue' && (
        <>
          {/* Critical P1 Safety Alert Banner */}
          <SafetyAlertBanner
            topP1={topP1}
            onDismiss={() => setIsP1BannerDismissed(true)}
            onJumpToCard={(id) => {
              const el = document.getElementById(`card-${id}`);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
          />

          {/* Mobile-Only Horizontal Department Strip (Big, Thumb-Friendly Filter Pills) */}
          <nav className="mobile-dept-strip" aria-label="Mobile department selector">
            {MOBILE_DEPARTMENTS.map((d) => {
              const count = d.id === ''
                ? complaints.length
                : (deptCounts[d.id] || 0);
              const isSafety = d.id === 'safety';
              const isActive = selectedDept === d.id;

              return (
                <button
                  key={d.id}
                  className={`mobile-dept-pill ${isSafety ? 'safety-tab' : ''} ${isActive ? 'active' : ''}`}
                  onClick={() => setSelectedDept(d.id)}
                >
                  <span className="pill-icon">{d.icon}</span>
                  <span className="pill-text">{d.label}</span>
                  <span className="pill-count">({count})</span>
                </button>
              );
            })}
          </nav>

          <div className="main-wrapper">
            {/* Desktop Left Sidebar (Hidden on Phones) */}
            <aside className="sidebar">
              <KPIGrid
                p1Count={p1Count}
                totalCount={complaints.length}
                slaBreaches={slaBreaches}
                outboxCount={outboxCount}
                hotspots={hotspots}
              />

              <DepartmentTabs
                selectedDept={selectedDept}
                onSelectDept={setSelectedDept}
                deptCounts={deptCounts}
                selectedPriority={selectedPriority}
                onSelectPriority={setSelectedPriority}
                selectedChannel={selectedChannel}
                onSelectChannel={setSelectedChannel}
              />
            </aside>

            {/* Main Content: Search Toolbar & Complaints Cards */}
            <main className="main-content">
              <div className="content-toolbar">
                <div className="search-input-wrap">
                  <Search className="search-icon" size={18} />
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search Gujarati, Hindi, English, Gujlish..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* View Toggles on Desktop */}
                <div className="view-tabs desktop-only">
                  <button
                    className="view-tab"
                    onClick={() => setActiveView('landing')}
                  >
                    Overview
                  </button>
                  <button
                    className="view-tab active"
                    onClick={() => setActiveView('queue')}
                  >
                    Queue ({complaints.length})
                  </button>
                  <button
                    className="view-tab"
                    onClick={() => setActiveView('analytics')}
                  >
                    Analytics &amp; Audit
                  </button>
                </div>
              </div>

              {/* Active Filter Chips Strip */}
              {(selectedStation || selectedDept || selectedPriority || selectedChannel || searchQuery) && (
                <div className="active-filters-bar">
                  <div className="active-filters-label">
                    <Filter size={13} />
                    <span>Active Filters:</span>
                  </div>
                  <div className="active-filters-list">
                    {selectedStation && (
                      <span className="filter-pill-tag">
                        <span>Station: {selectedStation.replace('STN_', '')}</span>
                        <button onClick={() => setSelectedStation('')} title="Remove filter"><X size={12} /></button>
                      </span>
                    )}
                    {selectedDept && (
                      <span className="filter-pill-tag">
                        <span>Dept: {selectedDept.replace(/_/g, ' ')}</span>
                        <button onClick={() => setSelectedDept('')} title="Remove filter"><X size={12} /></button>
                      </span>
                    )}
                    {selectedPriority && (
                      <span className="filter-pill-tag">
                        <span>Priority: {selectedPriority}</span>
                        <button onClick={() => setSelectedPriority('')} title="Remove filter"><X size={12} /></button>
                      </span>
                    )}
                    {selectedChannel && (
                      <span className="filter-pill-tag">
                        <span>Channel: {selectedChannel.toUpperCase()}</span>
                        <button onClick={() => setSelectedChannel('')} title="Remove filter"><X size={12} /></button>
                      </span>
                    )}
                    {searchQuery && (
                      <span className="filter-pill-tag">
                        <span>Search: "{searchQuery}"</span>
                        <button onClick={() => setSearchQuery('')} title="Clear search"><X size={12} /></button>
                      </span>
                    )}
                    <button
                      className="clear-all-filters-btn"
                      onClick={() => {
                        setSelectedStation('');
                        setSelectedDept('');
                        setSelectedPriority('');
                        setSelectedChannel('');
                        setSearchQuery('');
                      }}
                    >
                      Reset All
                    </button>
                  </div>
                </div>
              )}

              <div className="complaints-list">
                {complaints.length === 0 ? (
                  <div className="empty-queue-box">
                    <p className="empty-title">No complaints matching current filter.</p>
                    <p className="empty-sub">
                      Tap the <strong>+</strong> button below to ingest test grievances in Gujarati, Hindi, or Gujlish.
                    </p>
                    {(selectedStation || selectedDept || selectedPriority || selectedChannel || searchQuery) && (
                      <button
                        className="btn btn-outline"
                        style={{ marginTop: '1.25rem', padding: '0.6rem 1.4rem' }}
                        onClick={() => {
                          setSelectedStation('');
                          setSelectedDept('');
                          setSelectedPriority('');
                          setSelectedChannel('');
                          setSearchQuery('');
                        }}
                      >
                        CLEAR ALL FILTERS
                      </button>
                    )}
                  </div>
                ) : (
                  complaints.map((item) => (
                    <ComplaintCard
                      key={item.id}
                      complaint={item}
                      onOpenReview={setReviewComplaint}
                      onApproveReply={handleApproveReply}
                      isApproving={isApproving}
                      onFilterStation={(stn) => setSelectedStation(stn)}
                      onFilterDept={(dept) => setSelectedDept(dept)}
                    />
                  ))
                )}
              </div>
            </main>
          </div>
        </>
      )}

      {/* VIEW 3: TELEMETRY & AUDIT LOGS */}
      {activeView === 'analytics' && (
        <div className="analytics-page-wrapper">
          <AnalyticsView stats={stats} auditLogs={auditLogs} />
        </div>
      )}

      {/* Review / Human Override Modal (Bottom sheet on phone) */}
      <ComplaintDetailModal
        complaint={reviewComplaint}
        onClose={() => setReviewComplaint(null)}
        onSaveOverride={handleSaveOverride}
        onApproveCustomReply={async (id, text) => {
          await handleApproveReply(id, text);
          setReviewComplaint(null);
        }}
      />

      {/* Ingest Passenger Grievance / OCR Form Modal (Bottom sheet on phone) */}
      <IngestModal
        isOpen={isIngestOpen}
        onClose={() => setIsIngestOpen(false)}
        onSubmit={handleIngestSubmit}
      />

      {/* Desktop Website Footer (HIDDEN ON PHONE APP VIEW) */}
      <div className="desktop-footer-wrap desktop-only">
        <Footer isOffline={isOffline} outboxCount={outboxCount} />
      </div>

      {/* Phone Native Sticky Bottom Tab Bar */}
      <nav className="mobile-bottom-bar" aria-label="Mobile Navigation">
        <button
          className={`mobile-nav-btn ${activeView === 'landing' ? 'active' : ''}`}
          onClick={() => setActiveView('landing')}
        >
          <Sparkles size={21} />
          <span className="btn-label">Overview</span>
        </button>

        <button
          className={`mobile-nav-btn ${activeView === 'queue' ? 'active' : ''}`}
          onClick={() => setActiveView('queue')}
        >
          <LayoutList size={21} />
          <span className="btn-label">Queue</span>
        </button>

        {/* Big Center Thumb Action Button (FAB) */}
        <button
          className="mobile-fab-center"
          onClick={() => setIsIngestOpen(true)}
          aria-label="Add or Ingest Grievance"
        >
          <Plus size={28} />
        </button>

        <button
          className={`mobile-nav-btn ${activeView === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveView('analytics')}
        >
          <BarChart3 size={21} />
          <span className="btn-label">Analytics</span>
        </button>

        {/* Sync Outbox Button */}
        <button
          className="mobile-nav-btn"
          onClick={handleSyncOutbox}
          disabled={isSyncing}
          title="Sync Outbox"
        >
          <RefreshCw size={20} className={isSyncing ? 'spin' : ''} />
          <span className="btn-label">Sync ({outboxCount})</span>
        </button>
      </nav>
    </div>
  );
};
