import { memo, useMemo } from 'react';
import type { ReactNode } from 'react';

type Align = 'left' | 'right' | 'center';

export interface ColumnDef<T> {
  key: string; // use string to support complex labels and avoid TS literal issues
  title: string;
  align?: Align;
  format?: (v: any, row?: T) => string;
  highlightMinMax?: boolean;
  render?: (v: any, row: T) => ReactNode;
}

interface Props<T> {
  rows: T[];
  columns: ColumnDef<T>[];
  rowKey: (row: T, idx: number) => string | number;
}

function DataTableBase<T>({ rows, columns, rowKey }: Props<T>) {
  const minMax = useMemo(() => {
    const result: Record<string, { min: number; max: number }> = {};
    columns.forEach((c) => {
      if (!c.highlightMinMax) return;
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      rows.forEach((r) => {
        const v = Number((r as any)[c.key]);
        if (!Number.isNaN(v)) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      });
      result[c.key] = { min, max };
    });
    return result;
  }, [columns, rows]);

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: c.align || 'left' }}>{c.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={rowKey(r, i)}>
              {columns.map((c) => {
                const raw = (r as any)[c.key];
                const content = c.render 
                  ? c.render(raw, r) 
                  : (c.format ? c.format(raw, r) : raw);
                let cls = '';
                if (c.highlightMinMax && typeof raw === 'number') {
                  const mm = minMax[c.key];
                  if (raw === mm?.min) cls = 'cell-min';
                  if (raw === mm?.max) cls = 'cell-max';
                }
                return (
                  <td key={c.key} className={cls + ' num'} style={{ textAlign: c.align || 'left' }}>{content}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const DataTable = memo(DataTableBase) as typeof DataTableBase;
