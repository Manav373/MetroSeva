export type PriorityLevel = 'P1' | 'P2' | 'P3' | 'REVIEW';

export type Department = 
  | 'safety' 
  | 'cleanliness' 
  | 'lifts_escalators' 
  | 'fare' 
  | 'staff_behaviour' 
  | 'other';

export type IngestChannel = 'app' | 'social' | 'email' | 'paper';

export type ReplyLanguage = 'gu' | 'hi' | 'en' | 'gu-latn';

export type ReplyStatus = 'draft' | 'approved' | 'sent';

export type SyncState = 'local' | 'pending' | 'synced';

export interface SafetyHit {
  id?: string;
  description?: string;
  pattern?: string;
  keyword?: string;
}

export interface Complaint {
  id: string;
  station_id: string;
  channel: IngestChannel;
  raw_text: string;
  raw_image_ref?: string | null;
  normalised: string;
  dept_primary: Department;
  dept_secondary?: string | null;
  dept_conf: number;
  urgency: number;
  priority: PriorityLevel;
  safety_hits: SafetyHit[];
  reply_lang: ReplyLanguage;
  reply_draft?: string | null;
  reply_status: ReplyStatus;
  dedupe_key?: string | null;
  duplicate_of?: string | null;
  model_version?: string;
  rule_version?: string;
  sync_state?: SyncState;
  created_at: string;
  updated_at?: string;
}

export interface OutboxItem {
  client_uuid: string;
  idempotency_key: string;
  op_type: 'CREATE_COMPLAINT' | 'APPROVE_REPLY' | 'OVERRIDE_REVIEW';
  payload: any;
  created_at: string;
}

export interface StatsOverview {
  total_complaints: number;
  p1_active: number;
  p2_active: number;
  p3_active: number;
  review_needed: number;
  sla_breaches: number;
  dept_distribution: Record<string, number>;
  channel_distribution: Record<string, number>;
  language_distribution: Record<string, number>;
  safety_alerts_today: number;
}

export interface Hotspot {
  station_id: string;
  count: number;
}

export interface ReviewEvent {
  id: number;
  complaint_id: string;
  actor: string;
  field: string;
  old_value?: string;
  new_value: string;
  at: string;
}
