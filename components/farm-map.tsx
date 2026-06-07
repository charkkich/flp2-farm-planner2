'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type Field, type FieldStatus, FIELD_STATUSES } from '@/lib/supabase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { X } from 'lucide-react';

const STATUS_FILL: Record<string, string> = {
  'Not Started':          '#64748b',
  'Plowing':              '#d97706',
  'Harrowing':            '#ea580c',
  'Ridging':              '#16a34a',
  'Ready For Transplant': '#0284c7',
};
const STATUS_BADGE: Record<string, string> = {
  'Not Started':          'bg-slate-500',
  'Plowing':              'bg-amber-600',
  'Harrowing':            'bg-orange-600',
  'Ridging':              'bg-green-700',
  'Ready For Transplant': 'bg-sky-700',
};

// Static area data (m²) for each field — used when Supabase is unavailable
const FIELD_AREA: Record<string, number> = {
  E01:1126,E02:1126,E03:1126,E04:1126,E05:1126,E06:1126,E07:1126,E08:1126,E09:1126,
  E10:1152,E11:1165,E12:1123,E13:1120,E14:1152,E15:1126,E16:1088,E17:653,E18:672,
  E19:1008,E20:1126,E21:1126,E22:1126,E23:1126,E24:1126,E25:1126,E26:1126,E27:1126,
  E28:1126,E29:1126,E30:1126,E31:1126,E32:1126,E33:1126,E34:1126,E35:1126,E36:1104,
  E37:1104,E38:1104,E39:608,E40:608,E41:1440,EX:720,
  NH01:232,NH02:232,NH03:232,NH04:232,NH05:232,NH06:232,NH07:232,NH08:232,NH09:232,
  NH10:232,NH11:232,NH12:232,NH13:232,NH14:232,NH15:232,NH16:232,NH17:232,NH18:232,
  NH19:232,NH20:232,NH21:232,NH22:232,NH23:232,NH24:232,NH25:232,NH26:232,NH27:232,
  NH28:232,NH29:232,NH30:232,NH31:232,NH32:232,NH33:232,NH34:232,NH35:232,NH36:232,
  NH37:232,NH38:232,NH39:232,
  P01:640,P02:888,P03:888,P04:888,P05:888,P06:288,P07:288,P08:614,
  P09:655,P10:655,P11:655,P12:655,
  S01:1024,S02:1024,S03:1024,S04:1024,S05:1024,S06:1126,S07:1126,S08:1126,S09:1126,
  S10:1126,S11:1126,S12:1126,S13:1126,S14:1126,S15:1126,S16:1126,S17:1126,S18:1126,
  S19:1126,S20:1126,S21:1126,S22:1126,S23:1126,S24:1126,S25:1126,S26:1126,S27:1126,
  S28:1126,S29:1126,
  W01:950,W02:912,W03:1144,W04:1144,W05:1144,W06:1144,W07:1144,W08:1144,W09:1144,
  W10:1144,W11:1144,W12:1144,W13:1144,W14:528,W15:864,W16:1040,W17:1040,W18:1040,
  W19:1040,W20:1144,W21:1144,W22:1144,W23:1144,W24:1144,W25:1144,W26:1144,W27:1144,
  W28:605,W29:1144,W30:1144,W31:1144,W32:1144,W33:1144,W34:1144,W35:1104,W37:1040,
  W39:538,W40:538,W41:538,W42:538,
};

// Coordinates mapped to 2500×1333 image
// [code, x, y, w, h]
const LAYOUT: [string, number, number, number, number][] = [
  // ── W ZONE ────────────────────────────────────────────────────────────
  ['W37',  395,  28, 490, 100],

  // row 1 (y=133)
  ['W42',  10, 133, 100, 100], ['W41', 115, 133, 100, 100],
  ['W14', 222, 133, 118, 100],
  ['W13', 345, 133, 100, 100], ['W12', 450, 133, 100, 100],
  ['W11', 555, 133, 100, 100], ['W10', 660, 133, 100, 100],
  ['W09', 765, 133, 100, 100], ['W08', 870, 133, 100, 100],
  ['W07', 975, 133, 100, 100], ['W06',1080, 133, 100, 100],
  ['W05',1185, 133, 100, 100], ['W04',1290, 133, 100, 100],
  ['W03',1395, 133, 100, 100],
  ['W01',1500, 133, 100, 100],

  // row 2 (y=238)
  ['W39',  10, 238, 100, 100], ['W40', 115, 238, 100, 100],
  ['W16', 222, 238, 100, 100], ['W17', 327, 238, 100, 100],
  ['W18', 432, 238, 100, 100], ['W19', 537, 238, 100, 100],
  ['W20', 642, 238, 100, 100], ['W21', 747, 238, 100, 100],
  ['W22', 852, 238, 100, 100], ['W23', 957, 238, 100, 100],
  ['W24',1062, 238, 100, 100], ['W25',1167, 238, 100, 100],
  ['W26',1272, 238, 100, 100], ['W27',1377, 238, 100, 100],
  ['W02',1500, 238, 100, 100],

  // row 3 (y=343)
  ['W15',  10, 343, 205, 205],
  ['W28', 222, 343,  75, 100],
  ['W29', 302, 343, 100, 100], ['W30', 407, 343, 100, 100],
  ['W31', 512, 343, 100, 100], ['W32', 617, 343, 100, 100],
  ['W33', 722, 343, 100, 100], ['W34', 827, 343, 100, 100],
  ['EX',  960, 343, 100, 100],

  // row 4 (y=448)
  ['W35', 222, 448, 310, 100],

  // ── S ZONE ────────────────────────────────────────────────────────────
  // row 1 (y=28)
  ['S05',1075,  28,  72, 100], ['S04',1152,  28,  72, 100],
  ['S03',1229,  28,  72, 100], ['S02',1306,  28,  72, 100],
  ['S01',1383,  28,  72, 100],

  // row 2 (y=133)
  ['S06',1075, 133,  72, 100], ['S07',1152, 133,  72, 100],
  ['S08',1229, 133,  72, 100], ['S09',1306, 133,  72, 100],
  ['S10',1383, 133,  72, 100], ['S11',1460, 133,  72, 100],

  // row 3 (y=238)
  ['S19',1075, 238,  72, 100], ['S18',1152, 238,  72, 100],
  ['S17',1229, 238,  72, 100], ['S16',1306, 238,  72, 100],
  ['S15',1383, 238,  72, 100], ['S14',1460, 238,  72, 100],
  ['S13',1537, 238,  72, 100], ['S12',1614, 238,  72, 100],

  // row 4 (y=343)
  ['S20',1075, 343,  72, 100], ['S21',1152, 343,  72, 100],
  ['S22',1229, 343,  72, 100], ['S23',1306, 343,  72, 100],
  ['S24',1383, 343,  72, 100], ['S25',1460, 343,  72, 100],
  ['S26',1537, 343,  72, 100], ['S27',1614, 343,  72, 100],
  ['S28',1691, 343,  72, 100], ['S29',1768, 343,  72, 100],

  // ── E ZONE ────────────────────────────────────────────────────────────
  // row 1a: E01–E06 (y=28)
  ['E01',1460,  28,  72, 100], ['E02',1537,  28,  72, 100],
  ['E03',1614,  28,  72, 100], ['E04',1691,  28,  72, 100],
  ['E05',1768,  28,  72, 100], ['E06',1845,  28,  72, 100],

  // row 1b: E07–E17 right group (y=28)
  ['E07',1922,  28,  52, 100], ['E08',1978,  28,  52, 100],
  ['E09',2034,  28,  52, 100], ['E10',2090,  28,  52, 100],
  ['E11',2146,  28,  52, 100], ['E12',2202,  28,  52, 100],
  ['E13',2258,  28,  52, 100], ['E14',2314,  28,  52, 100],
  ['E15',2370,  28,  52, 100], ['E16',2426,  28,  52, 100],
  ['E17',2430,  28,  62, 100],
  ['E18',2430,  28,  62, 215],  // tall, right edge

  // row 2a: E35–E30 (y=133)
  ['E35',1460, 133,  72, 100], ['E34',1537, 133,  72, 100],
  ['E33',1614, 133,  72, 100], ['E32',1691, 133,  72, 100],
  ['E31',1768, 133,  72, 100], ['E30',1845, 133,  72, 100],

  // row 2b: E29–E20 (y=133)
  ['E29',1922, 133,  52, 100], ['E28',1978, 133,  52, 100],
  ['E27',2034, 133,  52, 100], ['E26',2090, 133,  52, 100],
  ['E25',2146, 133,  52, 100], ['E24',2202, 133,  52, 100],
  ['E23',2258, 133,  52, 100], ['E22',2314, 133,  52, 100],
  ['E21',2370, 133,  52, 100], ['E20',2426, 133,  52, 100],
  ['E19',2430, 248,  62, 210],  // tall, right edge

  // E36–E41 lower section
  ['E36',1460, 553, 100, 100], ['E37',1565, 553, 100, 100],
  ['E38',1670, 553, 100, 100],
  ['E39',1775, 553,  70,  70], ['E40',1850, 553,  70,  70],
  ['E41',1460, 658, 285, 125],

  // ── NH ZONE (small greenhouse plots) ─────────────────────────────────
  // row 1 (y=658): NH01–NH11
  ['NH01',1755, 658,  62,  62], ['NH02',1822, 658,  62,  62],
  ['NH03',1889, 658,  62,  62], ['NH04',1956, 658,  62,  62],
  ['NH05',2023, 658,  62,  62], ['NH06',2090, 658,  62,  62],
  ['NH07',2157, 658,  62,  62], ['NH08',2224, 658,  62,  62],
  ['NH09',2291, 658,  62,  62], ['NH10',2358, 658,  62,  62],
  ['NH11',2425, 658,  62,  62],

  // row 2 (y=725): NH12–NH22
  ['NH12',1460, 725,  62,  62], ['NH13',1527, 725,  62,  62],
  ['NH14',1594, 725,  62,  62], ['NH15',1661, 725,  62,  62],
  ['NH16',1728, 725,  62,  62], ['NH17',1795, 725,  62,  62],
  ['NH18',1862, 725,  62,  62], ['NH19',1929, 725,  62,  62],
  ['NH20',1996, 725,  62,  62], ['NH21',2063, 725,  62,  62],
  ['NH22',2130, 725,  62,  62],

  // row 3 (y=792): NH23–NH33
  ['NH23',1460, 792,  62,  62], ['NH24',1527, 792,  62,  62],
  ['NH25',1594, 792,  62,  62], ['NH26',1661, 792,  62,  62],
  ['NH27',1728, 792,  62,  62], ['NH28',1795, 792,  62,  62],
  ['NH29',1862, 792,  62,  62], ['NH30',1929, 792,  62,  62],
  ['NH31',1996, 792,  62,  62], ['NH32',2063, 792,  62,  62],
  ['NH33',2130, 792,  62,  62],

  // row 4 (y=859): NH34–NH39
  ['NH34',1460, 859,  62,  62], ['NH35',1527, 859,  62,  62],
  ['NH36',1594, 859,  62,  62], ['NH37',1661, 859,  62,  62],
  ['NH38',1728, 859,  62,  62], ['NH39',1795, 859,  62,  62],

  // ── P ZONE ────────────────────────────────────────────────────────────
  ['P01',  358, 560,  95, 100],
  ['P02',  255, 665,  95, 100], ['P03',  158, 665,  95, 100],
  ['P04',   62, 665,  93, 100], ['P05',   10, 665,  48, 100],
  ['P06',   10, 560,  48,  50], ['P07',   10, 613,  48,  48],
  ['P08',   62, 560,  93, 100],
  ['P09',   10, 775,  93, 100], ['P10',  108, 775,  93, 100],
  ['P11',  206, 775,  93, 100], ['P12',  304, 775,  93, 100],
];

export default function FarmMap() {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Field | null>(null);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  const loadFields = useCallback(async () => {
    try {
      const { data } = await supabase.from('fields').select('*').order('field_code');
      if (data) setFields(data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFields(); }, [loadFields]);

  const fieldMap = Object.fromEntries(fields.map(f => [f.field_code, f]));

  function handleClick(code: string) {
    const dbField = fieldMap[code];
    if (dbField) {
      setSelected(dbField);
    } else {
      // Field not in DB yet or Supabase not connected — show static info
      setSelected({
        id: '',
        field_code: code,
        area_m2: FIELD_AREA[code] ?? 0,
        status: 'Not Started',
        planned_transplant_date: null,
        actual_transplant_date: null,
        polygon: null,
        center_lat: null,
        center_lng: null,
        created_at: '',
        updated_at: '',
        user_id: '',
      } as Field);
    }
  }

  async function changeStatus(fieldId: string, status: FieldStatus) {
    setUpdating(true);
    const { error } = await supabase.from('fields').update({ status }).eq('id', fieldId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Updated', description: `Status → ${status}` });
      setFields(p => p.map(f => f.id === fieldId ? { ...f, status } : f));
      setSelected(p => p?.id === fieldId ? { ...p, status } : p);
    }
    setUpdating(false);
  }

  if (loading) {
    return (
      <div className="p-8 animate-pulse space-y-4">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-[600px] bg-muted rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Farm Map</h1>
          <p className="text-muted-foreground text-sm mt-1">Farm Lert Phan 2 (FLP2) — click a plot to view or update status</p>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs">
          {FIELD_STATUSES.map(s => (
            <div key={s} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm opacity-80" style={{ background: STATUS_FILL[s] }} />
              <span className="text-muted-foreground">{s}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-4 items-start">
        {/* Map container */}
        <div className="flex-1 overflow-auto rounded-lg border border-border" style={{ maxHeight: '75vh' }}>
          <svg
            viewBox="0 0 2500 1333"
            style={{ display: 'block', width: '100%', minWidth: '900px' }}
          >
            {/* Background image */}
            <image href="/farm-map.jpg" x="0" y="0" width="2500" height="1333" preserveAspectRatio="xMidYMid slice" />

            {/* Field overlays */}
            {LAYOUT.map(([code, x, y, w, h]) => {
              const field = fieldMap[code];
              const status = field?.status ?? 'Not Started';
              const isNotStarted = status === 'Not Started';
              const fill = STATUS_FILL[status];
              const isSelected = selected?.field_code === code;
              const fs = code.length > 4 ? 11 : code.length > 3 ? 13 : 15;
              return (
                <g key={code} style={{ cursor: 'pointer' }} onClick={() => handleClick(code)}>
                  <rect
                    x={x} y={y} width={w} height={h}
                    rx={4}
                    fill={fill}
                    fillOpacity={isSelected ? 0.75 : isNotStarted ? 0.08 : 0.60}
                    stroke={isSelected ? '#ffffff' : isNotStarted ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.5)'}
                    strokeWidth={isSelected ? 3 : 1}
                  />
                  {/* Show label only when selected or has non-default status */}
                  {(!isNotStarted || isSelected) && (
                    <text
                      x={x + w / 2}
                      y={y + h / 2 + fs * 0.35}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={fs}
                      fontWeight="700"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                      filter="url(#shadow)"
                    >
                      {code}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Text shadow filter */}
            <defs>
              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="black" floodOpacity="0.8" />
              </filter>
            </defs>
          </svg>
        </div>

        {/* Sidebar */}
        {selected && (
          <div className="w-60 shrink-0 rounded-lg border border-border bg-card p-4 space-y-4 self-start sticky top-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{selected.field_code}</h2>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Area</span>
                <span className="font-medium">{Number(selected.area_m2).toLocaleString()} m²</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status</span>
                <Badge className={`${STATUS_BADGE[selected.status]} text-white text-xs`}>
                  {selected.status}
                </Badge>
              </div>
              {selected.planned_transplant_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Planned</span>
                  <span>{selected.planned_transplant_date}</span>
                </div>
              )}
              {selected.actual_transplant_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Actual</span>
                  <span>{selected.actual_transplant_date}</span>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Change Status</p>
              {selected.id ? (
                <Select value={selected.status} onValueChange={v => changeStatus(selected.id, v as FieldStatus)} disabled={updating}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FIELD_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-xs text-amber-500">Supabase not connected — set env vars in Vercel</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
