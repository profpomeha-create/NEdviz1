export function fmtNum(v: number | undefined | null, digits = 0) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('ru-RU', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function safeGet(obj: any, ...path: (string | number)[]) {
  return path.reduce((acc, key) => (acc && acc[key] != null ? acc[key] : undefined), obj);
}
