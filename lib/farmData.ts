// Shared CSV parsing + farm data types

export interface CropPlan {
  cpNo: string;
  crop: string;
  plot: string;
  transplantPlan: string;
  removalPlan: string;
  landPrep: string;
  transplantActual: string;
  removalActual: string;
  areaSqm: number;
  seedlingTray: string;
  seedlingQty: number;
  year: number;
  month: number;
}

export function parseCSVLine(line: string): string[] {
  const cols: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === ',' && !inQ) { cols.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  cols.push(cur.trim());
  return cols;
}

export function parseDate(s: string): string {
  if (!s) return '';
  s = s.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // M/D/YYYY
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slash) return `${slash[3]}-${slash[1].padStart(2,'0')}-${slash[2].padStart(2,'0')}`;
  const m = s.match(/^(\d{1,2})[-\s]([A-Za-z]+)[-\s](\d{4})/);
  if (!m) return s;
  const months: Record<string, string> = {
    jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
    jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12',
  };
  const mo = months[m[2].toLowerCase().slice(0,3)];
  if (!mo) return s;
  return `${m[3]}-${mo}-${m[1].padStart(2,'0')}`;
}

export function fmtDateTh(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

export function fmtDateThFull(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

export async function fetchCropPlans(): Promise<CropPlan[]> {
  const res = await fetch('/Crop plan.csv');
  const text = await res.text();
  const lines = text.split('\n');
  const records: CropPlan[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('CP.')) continue;
    const c = parseCSVLine(trimmed);
    if (c.length < 17) continue;
    const yr = parseInt(c[16]);
    if (!yr || yr < 2020) continue;
    records.push({
      cpNo:             c[0],
      crop:             c[2],
      plot:             c[3],
      transplantPlan:   parseDate(c[4]),
      removalPlan:      parseDate(c[5]),
      landPrep:         parseDate(c[6]),
      transplantActual: parseDate(c[7]),
      removalActual:    parseDate(c[9]),
      areaSqm:          parseFloat(c[10].replace(/,/g,'')) || 0,
      seedlingTray:     c[19] || '',
      seedlingQty:      parseInt(c[20]) || 0,
      year:             yr,
      month:            parseInt(c[17]) || 0,
    });
  }
  return records;
}

// Status for unplanted plots
export type PlotStatus = 'ล่าช้า' | 'รอปลูก' | 'รอเตรียมดิน' | 'วางแผน';

export interface StatusStyle { label: string; color: string; bg: string; border: string }

export const STATUS_STYLES: Record<string, StatusStyle> = {
  'ล่าช้า':       { label: 'ล่าช้า',       color: '#dc2626', bg: '#fee2e2', border: '#dc2626' },
  'รอปลูก':       { label: 'รอปลูก',       color: '#d97706', bg: '#fef3c7', border: '#d97706' },
  'รอเตรียมดิน':  { label: 'รอเตรียมดิน', color: '#0284c7', bg: '#e0f2fe', border: '#0284c7' },
  'วางแผน':       { label: 'วางแผน',       color: '#8b5cf6', bg: '#ede9fe', border: '#8b5cf6' },
  'ปลูกแล้ว':     { label: 'ปลูกแล้ว',     color: '#16a34a', bg: '#dcfce7', border: '#16a34a' },
  'เสร็จสิ้น':    { label: 'เสร็จสิ้น',    color: '#64748b', bg: '#f1f5f9', border: '#64748b' },
};

export function getPlotStatus(r: CropPlan): StatusStyle {
  const today = new Date(); today.setHours(0,0,0,0);
  if (r.removalActual) return STATUS_STYLES['เสร็จสิ้น'];
  if (r.transplantActual) return STATUS_STYLES['ปลูกแล้ว'];
  const lp = r.landPrep ? new Date(r.landPrep) : null;
  const tp = r.transplantPlan ? new Date(r.transplantPlan) : null;
  if (tp && tp < today) return STATUS_STYLES['ล่าช้า'];
  if (lp && lp <= today) return STATUS_STYLES['รอปลูก'];
  if (lp) return STATUS_STYLES['รอเตรียมดิน'];
  return STATUS_STYLES['วางแผน'];
}

export function daysUntil(isoDate: string): number {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(isoDate + 'T00:00:00');
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}
