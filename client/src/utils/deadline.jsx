import { useState, useEffect } from 'react';
import { CalendarClock, TriangleAlert, Hourglass } from 'lucide-react';

/**
 * Current time, re-sampled every `intervalMs` (default: once a minute).
 * Lets deadline badges tick from "Due" to "Overdue" while a page stays open.
 */
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/**
 * Format an ISO deadline for display, e.g. "Sep 12, 2026, 18:00".
 */
export function formatDeadline(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Compute the urgency state of a deadline for a task.
 * Returns 'none' when there is no deadline or the task is already done.
 */
export function getDeadlineState(task, now = Date.now()) {
  if (!task?.deadline || task.status === 'done') return 'none';
  const ms = new Date(task.deadline).getTime() - now;
  if (ms < 0) return 'overdue';
  if (ms < 24 * 60 * 60 * 1000) return 'due-soon';
  return 'on-track';
}

const STYLES = {
  overdue: {
    background: 'rgba(220, 38, 38, 0.12)',
    color: '#dc2626',
    border: '1px solid rgba(220, 38, 38, 0.35)',
    label: 'Overdue',
  },
  'due-soon': {
    background: 'rgba(217, 119, 6, 0.12)',
    color: '#d97706',
    border: '1px solid rgba(217, 119, 6, 0.35)',
    label: 'Due soon',
  },
  'on-track': {
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    border: '1px solid var(--border-accent)',
    label: 'Due',
  },
};

/**
 * Compact deadline badge: "Due Sep 12, 18:00" / "Overdue · 2d" / "Due soon · 5h".
 * Pass `size="sm"` for table rows.
 */
export function DeadlineBadge({ task, size = 'md' }) {
  const now = useNow();
  const state = getDeadlineState(task, now);
  if (state === 'none') return null;

  const s = STYLES[state];
  const dl = new Date(task.deadline);
  const ms = dl.getTime() - now;
  let detail;
  if (state === 'overdue') {
    const days = Math.floor(-ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor(-ms / (60 * 60 * 1000));
    detail = days >= 1 ? `${days}d late` : `${hours}h late`;
  } else if (state === 'due-soon') {
    const hours = Math.max(1, Math.floor(ms / (60 * 60 * 1000)));
    detail = `${hours}h left`;
  } else {
    detail = dl.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  const Icon = state === 'overdue' ? TriangleAlert : state === 'due-soon' ? Hourglass : CalendarClock;
  const pad = size === 'sm' ? '3px 9px' : '4px 12px';
  const font = size === 'sm' ? '0.65rem' : '0.7rem';

  return (
    <span
      title={`Deadline: ${formatDeadline(task.deadline)}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: pad, borderRadius: 20, fontSize: font, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.04em',
        background: s.background, color: s.color, border: s.border, whiteSpace: 'nowrap',
      }}
    >
      <Icon size={size === 'sm' ? 11 : 12} />
      {state === 'on-track' ? 'Due' : s.label} · {detail}
    </span>
  );
}

/**
 * "Deliver by Sep 12, 2026 · 18:00" line used in task detail cards.
 */
export function DeadlineLine({ task }) {
  if (!task?.deadline) return null;
  const state = getDeadlineState(task);
  const color = state === 'overdue' ? '#dc2626' : state === 'due-soon' ? '#d97706' : 'var(--text-muted)';
  const Icon = state === 'overdue' ? TriangleAlert : CalendarClock;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', fontWeight: 600, color }}>
      <Icon size={12} />
      {state === 'overdue' ? 'Was due' : 'Deliver by'} {formatDeadline(task.deadline)}
    </div>
  );
}

/**
 * Convert a Date to the value format required by <input type="datetime-local">.
 */
export function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
