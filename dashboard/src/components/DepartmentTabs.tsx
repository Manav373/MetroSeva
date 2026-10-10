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

const DEPARTMENTS: { id: Department | ''; num: string; label: string }[] = [
  { id: '', num: '00', label: 'All Queues' },
  { id: 'safety', num: '01', label: 'Safety & Security' },
  { id: 'cleanliness', num: '02', label: 'Cleanliness & Hygiene' },
  { id: 'lifts_escalators', num: '03', label: 'Lifts & Escalators' },
  { id: 'fare', num: '04', label: 'Fare & AFC Cards' },
  { id: 'staff_behaviour', num: '05', label: 'Staff Conduct' },
  { id: 'other', num: '06', label: 'General / Other' },
];

const PRIORITIES: { id: PriorityLevel | ''; label: string; class: string }[] = [
  { id: '', label: 'ALL', class: 'all' },
  { id: 'P1', label: 'P1', class: 'p1' },
  { id: 'P2', label: 'P2', class: 'p2' },
  { id: 'P3', label: 'P3', class: 'p3' },
  { id: 'REVIEW', label: 'REVIEW', class: 'review' },
];

const CHANNELS: { id: IngestChannel | ''; label: string }[] = [
  { id: '', label: 'ALL' },
  { id: 'app', label: 'APP' },
  { id: 'social', label: 'SOCIAL' },
  { id: 'email', label: 'EMAIL' },
  { id: 'paper', label: 'PAPER' },
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
                <span>
                  <span className="font-mono" style={{ opacity: 0.5, marginRight: '0.45rem', fontSize: '0.72rem' }}>
                    {d.num}
                  </span>
                  {d.label}
                </span>
                <span className="count-badge">[{String(count).padStart(2, '0')}]</span>
              </button>
            );
          })}
        </div>
      </div>

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
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};
