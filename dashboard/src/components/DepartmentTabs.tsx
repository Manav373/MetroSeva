import React from 'react';
import { 
  ShieldAlert, 
  Sparkles, 
  ArrowUpDown, 
  CreditCard, 
  UserCheck, 
  HelpCircle,
  LayoutGrid,
  Smartphone,
  Share2,
  Mail,
  FileText
} from 'lucide-react';
import { Department, PriorityLevel, IngestChannel } from '../types';

interface DepartmentTabsProps {
  selectedDept: string;
  onSelectDept: (dept: string) => void;
  deptCounts: Record<string, number>;
  selectedPriority: string;
  onSelectPriority: (prio: string) => void;
  selectedChannel: string;
  onSelectChannel: (chan: string) => void;
}

const DEPARTMENTS: { 
  id: Department | ''; 
  num: string; 
  label: string;
  icon: React.ReactNode;
}[] = [
  { id: '', num: '00', label: 'All Queues', icon: <LayoutGrid size={14} /> },
  { id: 'safety', num: '01', label: 'Safety & Security', icon: <ShieldAlert size={14} /> },
  { id: 'cleanliness', num: '02', label: 'Cleanliness', icon: <Sparkles size={14} /> },
  { id: 'lifts_escalators', num: '03', label: 'Lifts & Escalators', icon: <ArrowUpDown size={14} /> },
  { id: 'fare', num: '04', label: 'Fare & Cards', icon: <CreditCard size={14} /> },
  { id: 'staff_behaviour', num: '05', label: 'Staff Conduct', icon: <UserCheck size={14} /> },
  { id: 'other', num: '06', label: 'General / Other', icon: <HelpCircle size={14} /> },
];

const PRIORITIES: { id: PriorityLevel | ''; label: string; class: string }[] = [
  { id: '', label: 'ALL', class: 'all' },
  { id: 'P1', label: 'P1 CRITICAL', class: 'p1' },
  { id: 'P2', label: 'P2 MEDIUM', class: 'p2' },
  { id: 'P3', label: 'P3 ROUTINE', class: 'p3' },
  { id: 'REVIEW', label: 'REVIEW', class: 'review' },
];

const CHANNELS: { id: IngestChannel | ''; label: string; icon: React.ReactNode }[] = [
  { id: '', label: 'ALL', icon: <LayoutGrid size={12} /> },
  { id: 'app', label: 'APP', icon: <Smartphone size={12} /> },
  { id: 'social', label: 'SOCIAL', icon: <Share2 size={12} /> },
  { id: 'email', label: 'EMAIL', icon: <Mail size={12} /> },
  { id: 'paper', label: 'PAPER', icon: <FileText size={12} /> },
];

export const DepartmentTabs: React.FC<DepartmentTabsProps> = ({
  selectedDept,
  onSelectDept,
  deptCounts,
  selectedPriority,
  onSelectPriority,
  selectedChannel,
  onSelectChannel,
}) => {
  return (
    <div className="sidebar-filters-container">
      {/* 1. Department Index */}
      <div>
        <div className="section-heading">
          <span>03 / Department Index</span>
        </div>
        <div className="dept-tab-list">
          {DEPARTMENTS.map((d) => {
            const count = d.id === ''
              ? Object.values(deptCounts).reduce((a, b) => a + b, 0)
              : (deptCounts[d.id] || 0);

            const isSafety = d.id === 'safety';
            const isActive = selectedDept === d.id;

            return (
              <button
                key={d.id}
                className={`dept-tab-btn ${isSafety ? 'safety-tab' : ''} ${isActive ? 'active' : ''}`}
                onClick={() => onSelectDept(d.id)}
              >
                <div className="dept-label-group">
                  <span className="dept-icon">{d.icon}</span>
                  <span className="dept-text">{d.label}</span>
                </div>
                <span className="count-badge">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Priority Severity Filter */}
      <div style={{ marginTop: '1.5rem' }}>
        <div className="section-heading">
          <span>04 / Priority Severity</span>
        </div>
        <div className="priority-pills-row">
          {PRIORITIES.map((p) => (
            <button
              key={p.id}
              className={`priority-pill ${p.class} ${selectedPriority === p.id ? 'active' : ''}`}
              onClick={() => onSelectPriority(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Ingest Channel Source */}
      <div style={{ marginTop: '1.5rem' }}>
        <div className="section-heading">
          <span>05 / Channel Source</span>
        </div>
        <div className="priority-pills-row">
          {CHANNELS.map((c) => (
            <button
              key={c.id}
              className={`priority-pill ${selectedChannel === c.id ? 'active' : ''}`}
              onClick={() => onSelectChannel(c.id)}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                {c.icon}
                <span>{c.label}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
