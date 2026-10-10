/**
 * Date and timestamp utilities for UTC parsing and relative time formatting.
 */

export function parseIsoDate(dateStr?: string | null): Date {
  if (!dateStr) return new Date();
  const trimmed = dateStr.trim();
  // If timestamp lacks timezone indicator (Z or +HH:MM or -HH:MM), treat as UTC
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)) {
    return new Date(`${trimmed}Z`);
  }
  return new Date(trimmed);
}

export function formatTime(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  const d = parseIsoDate(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = parseIsoDate(dateStr);
  const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (diffSec < 45) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
