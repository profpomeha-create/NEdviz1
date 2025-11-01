import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { RootData } from './types';

interface DataContextValue {
  data: RootData | null;
  loading: boolean;
  error: string | null;
  selectedJK: string | null;
  setSelectedJK: (name: string) => void;
}

const DataContext = createContext<DataContextValue>({ data: null, loading: true, error: null, selectedJK: null, setSelectedJK: () => {} });

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<RootData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJK, setSelectedJK] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const dataPath = (import.meta as any).env?.VITE_DATA_PATH || '/data.json';
        const res = await fetch(dataPath, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        const normalized: RootData = Array.isArray(raw)
          ? { projects: raw }
          : raw;
        if (!cancelled) {
          setData(normalized);
          const first = normalized.projects?.[0]?.jk_name ?? null;
          setSelectedJK((prev) => prev ?? first);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load data.json');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true };
  }, []);

  const value = useMemo(() => ({ data, loading, error, selectedJK, setSelectedJK }), [data, loading, error, selectedJK]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  return useContext(DataContext);
}

export function useSelectedProject() {
  const ctx = useData();
  const project = useMemo(() => ctx.data?.projects?.find((p:any) => p.jk_name === ctx.selectedJK) ?? null, [ctx.data, ctx.selectedJK]);
  return { project, selectedJK: ctx.selectedJK, setSelectedJK: ctx.setSelectedJK };
}
