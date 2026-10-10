import { Complaint, OutboxItem, Department, PriorityLevel, ReplyLanguage, SafetyHit } from '../types';
import { INITIAL_COMPLAINTS } from './mockData';

const COMPLAINTS_KEY = 'metro_cte_local_complaints';
const OUTBOX_KEY = 'metro_cte_local_outbox';

// On-device safety patterns (mirroring ml/rules/safety_rules.json)
const SAFETY_PATTERNS = [
  { id: 'SAFE_TRACK_INTRUSION', regex: /track.*padi|track.*gir|jump.*track|on track|રેલવે ટ્રેક|ટ્રેક પર|पटरी पर|पटरी/i, desc: 'Person or object on tracks' },
  { id: 'SAFE_FIRE_SMOKE', regex: /fire|smoke|aag|dhua|blaze|spark|સળગ|આગ|ધુમાડો|धुआं|आग लगी/i, desc: 'Fire, smoke or spark hazard' },
  { id: 'SAFE_GAS_HAZARD', regex: /gas.*leak|smell.*gas|suffocat|ગેસ લીક|ગૂંગળામણ|गैस लीक/i, desc: 'Gas leakage or toxic fumes' },
  { id: 'SAFE_MEDICAL_FALL', regex: /unconscious|injured|bleeding|cardiac|fall.*stair|બેભાન|ઇજા|ચક્કર|બેહોશ|घायल/i, desc: 'Severe passenger medical injury' },
  { id: 'SAFE_HARASSMENT', regex: /harass|molest|eve tease|threat|violence|છેડતી|હુમલો|मारपीट|छेड़छाड़/i, desc: 'Passenger physical assault or harassment' },
  { id: 'SAFE_CHILD_ALONE', regex: /child.*alone|lost.*kid|lost.*child|બાળક એકલું|ખોવાયેલું બાળક|लावारिस बच्चा/i, desc: 'Unattended or lost child alert' }
];

export function getStoredComplaints(): Complaint[] {
  try {
    const raw = localStorage.getItem(COMPLAINTS_KEY);
    if (!raw) {
      localStorage.setItem(COMPLAINTS_KEY, JSON.stringify(INITIAL_COMPLAINTS));
      return [...INITIAL_COMPLAINTS];
    }
    return JSON.parse(raw);
  } catch {
    return [...INITIAL_COMPLAINTS];
  }
}

export function saveStoredComplaints(complaints: Complaint[]) {
  try {
    localStorage.setItem(COMPLAINTS_KEY, JSON.stringify(complaints));
  } catch (err) {
    console.error('Failed to save complaints to localStorage:', err);
  }
}

export function getStoredOutbox(): OutboxItem[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredOutbox(outbox: OutboxItem[]) {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
  } catch (err) {
    console.error('Failed to save outbox to localStorage:', err);
  }
}

export function queueOutboxAction(
  opType: 'CREATE_COMPLAINT' | 'APPROVE_REPLY' | 'OVERRIDE_REVIEW',
  payload: any,
  clientUuid = 'station_controller_device_01'
): OutboxItem {
  const item: OutboxItem = {
    client_uuid: clientUuid,
    idempotency_key: `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    op_type: opType,
    payload,
    created_at: new Date().toISOString()
  };
  const outbox = getStoredOutbox();
  outbox.push(item);
  saveStoredOutbox(outbox);
  return item;
}

export function clearOutbox() {
  saveStoredOutbox([]);
}

/**
 * On-device Multilingual Triage Engine simulator
 * Matches Python ml/triage_engine logic
 */
export function triageOnDevice(
  rawText: string,
  stationId: string,
  channel: 'app' | 'social' | 'email' | 'paper'
): Complaint {
  const norm = rawText.trim().replace(/\s+/g, ' ');
  
  // 1. Language detection
  let lang: ReplyLanguage = 'en';
  if (/[\u0A80-\u0AFF]/.test(norm)) {
    lang = 'gu';
  } else if (/[\u0900-\u097F]/.test(norm)) {
    lang = 'hi';
  } else if (/chhe|nathi|karvu|thay|bandh|loko|madad|bahu/i.test(norm)) {
    lang = 'gu-latn';
  }

  // 2. Safety Rules Engine (Auditable deterministic floor)
  const hits: SafetyHit[] = [];
  for (const rule of SAFETY_PATTERNS) {
    if (rule.regex.test(norm)) {
      hits.push({
        id: rule.id,
        description: rule.desc,
        pattern: rule.regex.source
      });
    }
  }

  const isSafetyCritical = hits.length > 0;

  // 3. Department classification heuristic
  let dept: Department = 'other';
  let conf = 0.85;

  if (isSafetyCritical) {
    dept = 'safety';
    conf = 0.98;
  } else if (/lift|escalator|elevator|bandh chhe|સીડી|લિફ્ટ|लिफ्ट|एस्केलेटर/i.test(norm)) {
    dept = 'lifts_escalators';
    conf = 0.94;
  } else if (/washroom|toilet|clean|dirty|trash|kachro|ગંદુ|કચરો|શૌચાલય|सफाई|गंदा|कचरा/i.test(norm)) {
    dept = 'cleanliness';
    conf = 0.93;
  } else if (/smart card|fare|ticket|recharge|token|money|પૈસા|કાર્ડ|ભાડું|पैसे कट|कार्ड रिचार्ज|किराया/i.test(norm)) {
    dept = 'fare';
    conf = 0.95;
  } else if (/staff|rude|behaviour|counter guy|security guard|વર્તન|દુર્વ્યવહાર|बदतमीजी|कर्मचारी/i.test(norm)) {
    dept = 'staff_behaviour';
    conf = 0.91;
  } else {
    conf = 0.52; // Low confidence triggers REVIEW
  }

  // 4. Urgency and Priority scoring
  let urgency = 45;
  let priority: PriorityLevel = 'P3';

  if (isSafetyCritical) {
    priority = 'P1';
    urgency = Math.min(100, 85 + (hits.length * 5));
  } else if (conf < 0.6) {
    priority = 'REVIEW';
    urgency = 55;
  } else if (dept === 'lifts_escalators' || dept === 'fare' || dept === 'staff_behaviour') {
    priority = 'P2';
    urgency = 68;
  }

  // 5. Reply generation (legal guardrails: no liability / no financial promises)
  let draftReply = '';
  const refCode = `CTE-${Math.floor(1000 + Math.random() * 9000)}`;

  if (lang === 'gu') {
    draftReply = `માનનીય મુસાફર, ${stationId} ખાતેની તમારી ફરિયાદ (${refCode}) સંબંધિત વિભાગને તાત્કાલિક મોકલવામાં આવી છે. ટીમ જરૂરી કાર્યવાહી કરી રહી છે.`;
  } else if (lang === 'hi') {
    draftReply = `प्रिय यात्री, ${stationId} पर दर्ज आपकी शिकायत (${refCode}) संबंधित कार्यपालक टीम को प्रेषित कर दी गई है। उचित कार्यवाही की जा रही है।`;
  } else if (lang === 'gu-latn') {
    draftReply = `Dear Passenger, tamari ${stationId} par ni takrar (${refCode}) concerned department ne forward kari didhi chhe. Action levama avi rahi chhe.`;
  } else {
    draftReply = `Dear Passenger, your report regarding ${dept} at ${stationId} (Ref: ${refCode}) has been logged. Our operations team is attending to this matter.`;
  }

  const newId = `CTE-${priority}-${Math.floor(1000 + Math.random() * 9000)}`;

  return {
    id: newId,
    station_id: stationId,
    channel,
    raw_text: rawText,
    normalised: norm,
    dept_primary: dept,
    dept_secondary: null,
    dept_conf: conf,
    urgency,
    priority,
    safety_hits: hits,
    reply_lang: lang,
    reply_draft: draftReply,
    reply_status: 'draft',
    model_version: 'v1.0.0-tflite-int8',
    rule_version: 'v1.0.0-safety',
    sync_state: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}
