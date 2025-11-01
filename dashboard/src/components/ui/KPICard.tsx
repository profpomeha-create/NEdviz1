import { memo } from 'react';
import type { ReactNode } from 'react';

interface KPICardProps {
  title: string;
  value: ReactNode;
  delta?: number; // percent +/-
}

function formatDelta(delta?: number) {
  if (delta == null) return '';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(2)}%`;
}

function KPICardBase({ title, value, delta }: KPICardProps) {
  const color = delta == null ? 'var(--color-text)' : delta >= 0 ? 'var(--color-success)' : 'var(--color-danger)';
  return (
    <div className="kpi-card">
      <div className="kpi-title">{title}</div>
      <div className="kpi-row">
        <div className="kpi-value">{value}</div>
        {delta != null && <div className="kpi-delta" style={{ color }}>{formatDelta(delta)}</div>}
      </div>
    </div>
  );
}

export const KPICard = memo(KPICardBase);
