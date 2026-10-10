import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search } from 'lucide-react';
import { Complaint, StatsOverview, Hotspot, ReviewEvent } from './types';
import { ApiService } from './services/api';
import { getStoredOutbox } from './services/offlineStorage';
import { Navbar } from './components/Navbar';
import { SafetyAlertBanner } from './components/SafetyAlertBanner';
import { KPIGrid } from './components/KPIGrid';
import { DepartmentTabs } from './components/DepartmentTabs';
import { ComplaintCard } from './components/ComplaintCard';
import { ComplaintDetailModal } from './components/ComplaintDetailModal';
import { IngestModal } from './components/IngestModal';
import { AnalyticsView } from './components/AnalyticsView';

export const App: React.FC = () => {
  // Global & Filter State
  const [selectedStation, setSelectedStation] = useState<string>('STN_PALDI');
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeView, setActiveView] = useState<'queue' | 'analytics'>('queue');
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch Complaints & Stats
  const refreshData = useCallback(async () => {
    // Outbox count
    const outbox = getStoredOutbox();
    setOutboxCount(outbox.length);

    // Queue
    const queueRes = await ApiService.fetchQueue({
      station_id: selectedStation,
      department: selectedDept,
      priority: selectedPriority,
      channel: selectedChannel,
      search: searchQuery,
    });
    setComplaints(queueRes.complaints);

    // Operational Stats & Hotspots
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
        ? '⚠️ Switched to Offline Station Mode (Actions stored in Outbox)'
        : '🟢 Switched to Online Central Cloud Mode'
    );
    refreshData();
  };

  // Sync Outbox
  const handleSyncOutbox = async () => {
    setIsSyncing(true);
    const result = await ApiService.syncOutbox();
    setIsSyncing(false);
    if (result.success) {
      showToast(`🔄 Synced ${result.syncedCount} items successfully with central backend!`);
      refreshData();
    } else {
      showToast(`❌ Sync error: ${result.errors.join(', ')}`);
    }
  };

  // Approve reply
  const handleApproveReply = async (complaintId: string, customText?: string) => {
    setIsApproving(true);
    const res = await ApiService.approveReply(complaintId, customText);
    setIsApproving(false);
    showToast(
      res.synced
        ? '✓ Reply approved & dispatched to passenger channel!'
        : '⏳ Reply approved locally and queued to Outbox.'
    );
    refreshData();
  };

  // Human-in-the-loop Override
  const handleSaveOverride = async (complaintId: string, field: string, newValue: string) => {
    const res = await ApiService.reviewOverride(complaintId, field, newValue);
    showToast(
      res.synced
        ? `✓ Corrected ${field} to "${newValue}" & logged for model retraining!`
        : `⏳ Override saved locally and queued in Outbox.`
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
    showToast(
      res.complaint.priority === 'P1'
        ? '🚨 P1 Safety complaint triaged! Priority pinned to top!'
        : `✓ Complaint triaged into [${res.complaint.dept_primary}] (${res.complaint.priority})`
    );
    setIsP1BannerDismissed(false);
    refreshData();
  };

  // Computed Department Counts
  const deptCounts = useMemo(() => {
    const map: Record<string, number> = {};
    complaints.forEach((c) => {
      map[c.dept_primary] = (map[c.dept_primary] || 0) + 1;
    });
    return map;
  }, [complaints]);

  // Top P1 Complaint for Alert Banner
  const topP1 = useMemo(() => {
    if (isP1BannerDismissed) return null;
    return complaints.find((c) => c.priority === 'P1') || null;
  }, [complaints, isP1BannerDismissed]);

  const p1Count = complaints.filter((c) => c.priority === 'P1').length;
  const slaBreaches = useMemo(() => {
    const cutoff = Date.now() - 15 * 60000;
    return complaints.filter(
      (c) => c.priority === 'P1' && c.reply_status === 'draft' && new Date(c.created_at).getTime() < cutoff
    ).length;
  }, [complaints]);

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: '#1e293b',
            color: '#fff',
            border: '1px solid #3b82f6',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            padding: '0.75rem 1.25rem',
            borderRadius: '8px',
            zIndex: 1000,
            fontSize: '0.88rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        selectedStation={selectedStation}
        onSelectStation={setSelectedStation}
        isOffline={isOffline}
        onToggleOffline={handleToggleOffline}
        outboxCount={outboxCount}
        onSyncOutbox={handleSyncOutbox}
        isSyncing={isSyncing}
        onOpenIngest={() => setIsIngestOpen(true)}
      />

      {/* Critical P1 Safety Alert Banner */}
      <SafetyAlertBanner
        topP1={topP1}
        onDismiss={() => setIsP1BannerDismissed(true)}
        onJumpToCard={(id) => {
          const el = document.getElementById(`card-${id}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }}
      />

      <div className="main-wrapper">
        {/* Left Sidebar: KPIs, Department Queues, Priority, Hotspots */}
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

        {/* Main Content: Search Toolbar & List or Analytics */}
        <main className="main-content">
          <div className="content-toolbar">
            <div className="search-input-wrap">
              <Search className="search-icon" size={16} />
              <input
                type="text"
                className="search-input"
                placeholder="Search complaints across Gujarati, Hindi, English, Gujlish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="view-tabs">
              <button
                className={`view-tab ${activeView === 'queue' ? 'active' : ''}`}
                onClick={() => setActiveView('queue')}
              >
                Live Triage Queue ({complaints.length})
              </button>
              <button
                className={`view-tab ${activeView === 'analytics' ? 'active' : ''}`}
                onClick={() => setActiveView('analytics')}
              >
                Ops Analytics &amp; Retraining Audit
              </button>
            </div>
          </div>

          {/* Conditional View Rendering */}
          {activeView === 'queue' ? (
            <div className="complaints-list">
              {complaints.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '3.5rem 1rem',
                    color: '#64748b',
                    background: '#131d2e',
                    borderRadius: '8px',
                    border: '1px dashed #334155',
                  }}
                >
                  <p style={{ fontSize: '1rem', fontWeight: 600 }}>No complaints matching current filters.</p>
                  <p style={{ fontSize: '0.82rem', marginTop: '0.35rem' }}>
                    Try clearing department/priority filters or click <strong>"+ New / OCR Ingest"</strong> to submit test complaints.
                  </p>
                </div>
              ) : (
                complaints.map((item) => (
                  <ComplaintCard
                    key={item.id}
                    complaint={item}
                    onOpenReview={setReviewComplaint}
                    onApproveReply={handleApproveReply}
                    isApproving={isApproving}
                  />
                ))
              )}
            </div>
          ) : (
            <AnalyticsView stats={stats} auditLogs={auditLogs} />
          )}
        </main>
      </div>

      {/* Review / Human Override Modal */}
      <ComplaintDetailModal
        complaint={reviewComplaint}
        onClose={() => setReviewComplaint(null)}
        onSaveOverride={handleSaveOverride}
        onApproveCustomReply={async (id, text) => {
          await handleApproveReply(id, text);
          setReviewComplaint(null);
        }}
      />

      {/* Ingest Passenger Grievance / OCR Form Modal */}
      <IngestModal
        isOpen={isIngestOpen}
        onClose={() => setIsIngestOpen(false)}
        onSubmit={handleIngestSubmit}
      />
    </div>
  );
};
