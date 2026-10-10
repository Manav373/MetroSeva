import { Complaint, OutboxItem, StatsOverview, Hotspot, ReviewEvent } from '../types';
import {
  getStoredComplaints,
  saveStoredComplaints,
  getStoredOutbox,
  saveStoredOutbox,
  queueOutboxAction,
  clearOutbox,
  triageOnDevice
} from './offlineStorage';

const API_BASE = 'http://localhost:8000/v1';

export class ApiService {
  private static isForcedOffline = false;

  public static setOfflineMode(offline: boolean) {
    this.isForcedOffline = offline;
  }

  public static getOfflineMode(): boolean {
    return this.isForcedOffline;
  }

  /**
   * Fetch complaint queue with filters
   */
  public static async fetchQueue(params: {
    station_id?: string;
    department?: string;
    priority?: string;
    channel?: string;
    reply_status?: string;
    search?: string;
  }): Promise<{ complaints: Complaint[]; isLiveBackend: boolean }> {
    if (this.isForcedOffline) {
      return { complaints: this.filterLocal(params), isLiveBackend: false };
    }

    try {
      const q = new URLSearchParams();
      if (params.station_id) q.append('station_id', params.station_id);
      if (params.department) q.append('department', params.department);
      if (params.priority) q.append('priority', params.priority);
      if (params.channel) q.append('channel', params.channel);
      if (params.reply_status) q.append('reply_status', params.reply_status);
      if (params.search) q.append('search', params.search);
      q.append('limit', '100');

      const res = await fetch(`${API_BASE}/dashboard/queue?${q.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Complaint[] = await res.json();
      
      // Update local storage cache
      if (data && data.length > 0) {
        saveStoredComplaints(data);
      }
      return { complaints: data, isLiveBackend: true };
    } catch {
      // Graceful offline fallback
      return { complaints: this.filterLocal(params), isLiveBackend: false };
    }
  }

  /**
   * Filter local complaints
   */
  private static filterLocal(params: {
    station_id?: string;
    department?: string;
    priority?: string;
    channel?: string;
    reply_status?: string;
    search?: string;
  }): Complaint[] {
    let items = getStoredComplaints();

    if (params.station_id) {
      items = items.filter(c => c.station_id === params.station_id);
    }
    if (params.department) {
      items = items.filter(c => c.dept_primary === params.department);
    }
    if (params.priority) {
      items = items.filter(c => c.priority === params.priority);
    }
    if (params.channel) {
      items = items.filter(c => c.channel === params.channel);
    }
    if (params.reply_status) {
      items = items.filter(c => c.reply_status === params.reply_status);
    }
    if (params.search) {
      const s = params.search.toLowerCase();
      items = items.filter(c =>
        c.raw_text.toLowerCase().includes(s) ||
        c.id.toLowerCase().includes(s) ||
        c.station_id.toLowerCase().includes(s)
      );
    }

    const prioRank: Record<string, number> = { P1: 0, P2: 1, REVIEW: 2, P3: 3 };
    items.sort((a, b) => {
      const pDiff = (prioRank[a.priority] ?? 4) - (prioRank[b.priority] ?? 4);
      if (pDiff !== 0) return pDiff;
      return (b.urgency || 0) - (a.urgency || 0);
    });

    return items;
  }

  /**
   * Submit / ingest new complaint
   */
  public static async ingestComplaint(payload: {
    station_id: string;
    channel: 'app' | 'social' | 'email' | 'paper';
    raw_text: string;
  }): Promise<{ complaint: Complaint; synced: boolean }> {
    if (!this.isForcedOffline) {
      try {
        const res = await fetch(`${API_BASE}/complaints`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const complaint: Complaint = await res.json();
          // update cache
          const local = getStoredComplaints();
          local.unshift(complaint);
          saveStoredComplaints(local);
          return { complaint, synced: true };
        }
      } catch {
        // Fall back to offline triage
      }
    }

    // Offline on-device triage
    const complaint = triageOnDevice(payload.raw_text, payload.station_id, payload.channel);
    const local = getStoredComplaints();
    local.unshift(complaint);
    saveStoredComplaints(local);

    // Queue in Outbox
    queueOutboxAction('CREATE_COMPLAINT', complaint);

    return { complaint, synced: false };
  }

  /**
   * Approve draft reply
   */
  public static async approveReply(
    complaintId: string,
    customText?: string,
    actor = 'station_controller'
  ): Promise<{ success: boolean; synced: boolean }> {
    // Update local cache first
    const complaints = getStoredComplaints();
    const target = complaints.find(c => c.id === complaintId);
    if (target) {
      target.reply_status = 'approved';
      if (customText) target.reply_draft = customText;
      target.updated_at = new Date().toISOString();
      saveStoredComplaints(complaints);
    }

    if (!this.isForcedOffline) {
      try {
        const url = new URL(`${API_BASE}/complaints/${complaintId}/approve`);
        url.searchParams.append('actor', actor);
        if (customText) url.searchParams.append('custom_text', customText);

        const res = await fetch(url.toString(), { method: 'POST' });
        if (res.ok) {
          return { success: true, synced: true };
        }
      } catch {
        // network failed
      }
    }

    // Queue to outbox
    queueOutboxAction('APPROVE_REPLY', {
      complaint_id: complaintId,
      custom_text: customText,
      actor
    });

    return { success: true, synced: false };
  }

  /**
   * Review / Override complaint field
   */
  public static async reviewOverride(
    complaintId: string,
    field: string,
    newValue: string,
    actor = 'station_controller'
  ): Promise<{ success: boolean; synced: boolean }> {
    const complaints = getStoredComplaints();
    const target = complaints.find(c => c.id === complaintId);
    if (target) {
      (target as any)[field] = newValue;
      target.updated_at = new Date().toISOString();
      saveStoredComplaints(complaints);
    }

    if (!this.isForcedOffline) {
      try {
        const res = await fetch(`${API_BASE}/complaints/${complaintId}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actor, field, new_value: newValue })
        });
        if (res.ok) {
          return { success: true, synced: true };
        }
      } catch {
        // network failed
      }
    }

    queueOutboxAction('OVERRIDE_REVIEW', {
      complaint_id: complaintId,
      actor,
      field,
      new_value: newValue
    });

    return { success: true, synced: false };
  }

  /**
   * Sync outbox items to backend
   */
  public static async syncOutbox(): Promise<{
    syncedCount: number;
    errors: string[];
    success: boolean;
  }> {
    const outbox = getStoredOutbox();
    if (outbox.length === 0) {
      return { syncedCount: 0, errors: [], success: true };
    }

    try {
      const res = await fetch(`${API_BASE}/sync/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_uuid: 'station_controller_device_01',
          items: outbox
        })
      });

      if (res.ok) {
        const data = await res.json();
        clearOutbox();
        return {
          syncedCount: data.synced_count ?? outbox.length,
          errors: [],
          success: true
        };
      } else {
        return {
          syncedCount: 0,
          errors: [`Server responded with ${res.status}`],
          success: false
        };
      }
    } catch (err: any) {
      return {
        syncedCount: 0,
        errors: [err.message || 'Network unreachable'],
        success: false
      };
    }
  }

  /**
   * Fetch Operational Stats
   */
  public static async fetchStats(): Promise<StatsOverview> {
    try {
      const res = await fetch(`${API_BASE}/dashboard/stats`);
      if (res.ok) return await res.json();
    } catch {
      // offline computed stats
    }

    const items = getStoredComplaints();
    const p1 = items.filter(c => c.priority === 'P1').length;
    const p2 = items.filter(c => c.priority === 'P2').length;
    const p3 = items.filter(c => c.priority === 'P3').length;
    const rev = items.filter(c => c.priority === 'REVIEW').length;

    const deptDist: Record<string, number> = {};
    const chanDist: Record<string, number> = {};
    const langDist: Record<string, number> = {};

    items.forEach(c => {
      deptDist[c.dept_primary] = (deptDist[c.dept_primary] || 0) + 1;
      chanDist[c.channel] = (chanDist[c.channel] || 0) + 1;
      langDist[c.reply_lang] = (langDist[c.reply_lang] || 0) + 1;
    });

    const cutoff = Date.now() - 15 * 60000;
    const sla = items.filter(c => c.priority === 'P1' && c.reply_status === 'draft' && new Date(c.created_at).getTime() < cutoff).length;

    return {
      total_complaints: items.length,
      p1_active: p1,
      p2_active: p2,
      p3_active: p3,
      review_needed: rev,
      sla_breaches: sla,
      dept_distribution: deptDist,
      channel_distribution: chanDist,
      language_distribution: langDist,
      safety_alerts_today: items.filter(c => c.dept_primary === 'safety').length
    };
  }

  /**
   * Fetch Hotspots
   */
  public static async fetchHotspots(): Promise<Hotspot[]> {
    try {
      const res = await fetch(`${API_BASE}/dashboard/hotspots`);
      if (res.ok) return await res.json();
    } catch {
      // local
    }

    const counts: Record<string, number> = {};
    getStoredComplaints().forEach(c => {
      counts[c.station_id] = (counts[c.station_id] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([station_id, count]) => ({ station_id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Fetch Review Audit Log
   */
  public static async fetchAuditLog(): Promise<ReviewEvent[]> {
    try {
      const res = await fetch(`${API_BASE}/dashboard/reviews`);
      if (res.ok) return await res.json();
    } catch {
      // empty
    }
    return [];
  }
}
