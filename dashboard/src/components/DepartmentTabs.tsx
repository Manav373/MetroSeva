import React from 'react';
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

const DEPARTMENTS: { id: Department | ''; label: string; icon: string }[] = [
  { id: '', label: 'All Departments', icon: '📋' },
  { id: 'safety', label: 'Safety & Security', icon: '🚨' },
  { id: 'cleanliness', label: 'Cleanliness & Hygiene', icon: '🧹' },
  { id: 'lifts_escalators', label: 'Lifts & Escalators', icon: '🛗' },
  { id: 'fare', label: 'Fare & Smart Cards', icon: '💳' },
  { id: 'staff_behaviour', label: 'Staff Behaviour', icon: '👮' },
  { id: 'other', label: 'Other / General', icon: 'ℹ️' },
];

const PRIORITIES: { id: PriorityLevel | ''; label: string; class: string }[] = [
  { id: '', label: 'All', class: 'all' },
  { id: 'P1', label: 'P1', class: 'p1' },
  { id: 'P2', label: 'P2', class: 'p2' },
  { id: 'P3', label: 'P3', class: 'p3' },
  { id: 'REVIEW', label: 'REVIEW', class: 'review' },
];

const CHANNELS: { id: IngestChannel | ''; label: string }[] = [
  { id: '', label: 'All Channels' },
  { id: 'app', label: 'App' },
  { id: 'social', label: 'Social (X)' },
  { id: 'email', label: 'Email' },
  { id: 'paper', label: 'Paper OCR' },
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
    <>
      <div>
        <div className="section-heading">Department Queues</div>
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
                <span>
                  {d.icon} {d.label}
                </span>
                <span className="count-badge">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: '0.85rem' }}>
        <div className="section-heading">Priority Filter</div>
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

      <div style={{ marginTop: '0.85rem' }}>
        <div className="section-heading">Ingest Channel</div>
        <div className="priority-pills-row">
          {CHANNELS.map((c) => (
            <button
              key={c.id}
              className={`priority-pill ${selectedChannel === c.id ? 'active' : ''}`}
              onClick={() => onSelectChannel(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};
